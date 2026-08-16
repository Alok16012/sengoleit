import { supabase } from '../lib/supabase'
import { computeSemesterFeeStatus } from './courseFee'
import { recordFeeDeduction } from './feeLedger'

// Re-Registration — moving a student into their next semester / year.
// The centre raises the request; the admin approves it, which holds the fee
// from the centre's wallet and advances the student's term.

const ORD = (n) => {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

// The term label semester N falls in for this student's course — "3rd Semester",
// or "2nd Year" for a Year-based course (two semesters to the year). Used by the
// Exam Section to move a student's term forward when it issues a card for a
// semester beyond the recorded one.
export function termForSemester(student, sem) {
  const unit = /year/i.test(String(student?.semester_year || student?.programs?.semester_year || '')) ? 'Year' : 'Semester'
  const n = unit === 'Year' ? Math.ceil(Number(sem) / 2) : Number(sem)
  return { unit, n, label: `${ORD(n)} ${unit}` }
}

// `students.semester_year` holds a label like "1st Semester" / "2nd Year".
// programs.duration is the total SEMESTER count for every programme, so a
// Year-based course has duration / 2 years.
export function nextTerm(student) {
  const label = String(student?.semester_year || '')
  const unit = /year/i.test(label) ? 'Year' : 'Semester'
  const current = Math.max(parseInt(label, 10) || 1, 1)
  const semesters = Number(student?.programs?.duration) || 0
  const total = unit === 'Year' ? Math.max(Math.round(semesters / 2), 1) : semesters
  const atEnd = total > 0 && current >= total
  return {
    unit,
    current,
    total,
    atEnd,
    currentLabel: label || `${ORD(current)} ${unit}`,
    nextLabel: `${ORD(current + 1)} ${unit}`,
  }
}

// What the next term costs. The fee tables are cumulative per semester, so the
// step from term N to N+1 is the difference between their cumulative amounts.
// A Year-based course covers two semesters per year.
//
// Returns { fee, hold, outstanding } — `hold` is the 50% held from the wallet,
// matching what a new admission holds at forward time, but never more than
// `outstanding`: what the target term still lacks after everything already
// collected. The Exam Section can collect a semester's whole fee when issuing
// its admit card, and a re-registration approved after that must not take the
// same money again — with everything collected the hold is ₹0 and approving
// only advances the term.
export async function reRegistrationFee(student) {
  const t = nextTerm(student)
  const { sems } = await computeSemesterFeeStatus({
    programme_id: student.programme_id,
    session_id: student.session_id,
    duration: Number(student?.programs?.duration) || 1,
    fee_collected: student.fee_collected,
    coupon_discount: student.coupon_discount,
  })
  const cum = (n) => (n <= 0 ? 0 : (sems.find(s => s.sem === n)?.cumFee ?? 0))
  const due = (n) => (n <= 0 ? 0 : (sems.find(s => s.sem === n)?.dueFee ?? 0))
  const perYear = t.unit === 'Year' ? 2 : 1
  const from = t.current * perYear
  const to = (t.current + 1) * perYear
  const fee = Math.max(cum(to) - cum(from), 0)
  const outstanding = Math.max(due(to) - (Number(student.fee_collected) || 0), 0)
  return { fee, hold: Math.min(Math.ceil(fee * 0.5), outstanding), outstanding, ...t }
}

// The Registration Certificate is issued once per YEAR of the course: a
// 6-semester course has three, starting at Semester 1, 3 and 5. A year opens
// once the fee up to its FIRST semester is cleared — the same rule the
// semester-wise admit card uses, applied to the year's opening semester.
// Returns [{ year, fromSem, toSem, cumFee, dueFee, cleared }].
export async function registrationYears(student) {
  const totalSems = Number(student?.programs?.duration) || 0
  if (!totalSems) return []
  const { sems } = await computeSemesterFeeStatus({
    programme_id: student.programme_id,
    session_id: student.session_id,
    duration: totalSems,
    fee_collected: student.fee_collected,
    coupon_discount: student.coupon_discount,
  })
  const years = []
  for (let y = 1; (y - 1) * 2 + 1 <= totalSems; y++) {
    const fromSem = (y - 1) * 2 + 1
    const toSem = Math.min(fromSem + 1, totalSems)
    const gate = sems.find(x => x.sem === fromSem)
    years.push({ year: y, fromSem, toSem, cumFee: gate?.cumFee ?? 0, dueFee: gate?.dueFee ?? 0, cleared: !!gate?.cleared })
  }
  return years
}

// Centre → request. One open request per student (enforced by a unique index).
export async function requestReRegistration({ student, feeAmount, remarks }) {
  const t = nextTerm(student)
  const { error } = await supabase.from('re_registrations').insert({
    student_id: student.id,
    center_id: student.center_id || student.centers?.id || null,
    session_id: student.session_id || null,
    from_term: t.currentLabel,
    to_term: t.nextLabel,
    fee_amount: feeAmount,
    remarks: remarks || null,
  })
  return { error }
}

// Admin → approve. Holds the fee from the centre's wallet, advances the
// student's term, and closes the request. The wallet is written first: if that
// fails there is nothing to undo, whereas advancing the term first could leave
// a student re-registered without the fee being taken.
//
// The amount actually taken is re-derived at approval time, not trusted from
// the request: the Exam Section may have collected some or all of the target
// term's fee since the request was raised (its admit-card "Collect" flow), and
// the same term's money must never be taken twice. The charge is the request's
// amount capped at what the term still lacks — ₹0 when it is fully paid, in
// which case approving only advances the term.
export async function approveReRegistration(req) {
  const { data: st } = await supabase
    .from('students')
    .select('fee_collected, coupon_discount, programme_id, session_id, semester_year, programs(duration, semester_year)')
    .eq('id', req.student_id).maybeSingle()
  const collectedNow = Number(st?.fee_collected || 0)

  // The request's target term → its closing semester ("2nd Year" covers sems
  // 3–4). An unparseable term (old/odd data) falls back to charging as before.
  let charge = Number(req.fee_amount || 0)
  const termN = parseInt(String(req.to_term || ''), 10)
  if (st && termN) {
    const toSem = /year/i.test(req.to_term) ? termN * 2 : termN
    const { sems } = await computeSemesterFeeStatus({
      programme_id: st.programme_id,
      session_id: st.session_id,
      duration: Number(st.programs?.duration) || 1,
      fee_collected: collectedNow,
      coupon_discount: st.coupon_discount,
    })
    const due = sems.find(s => s.sem === toSem)?.dueFee ?? 0
    const outstanding = Math.max(due - collectedNow, 0)
    charge = Math.min(charge, outstanding)
  }

  if (charge > 0 && req.center_id) {
    const { data: ctr } = await supabase
      .from('centers').select('virtual_balance').eq('id', req.center_id).maybeSingle()
    const balance = Number(ctr?.virtual_balance || 0)
    if (balance < charge) {
      return { error: { message: `The centre's wallet has ₹${balance.toLocaleString('en-IN')} — ₹${charge.toLocaleString('en-IN')} is needed.` } }
    }
    const { error: wErr } = await supabase.from('centers')
      .update({ virtual_balance: balance - charge })
      .eq('id', req.center_id)
    if (wErr) return { error: wErr }
  }

  // Credit what was taken to the student's collected fee as well as advancing
  // the term. The admit card gate reads fee_collected, so without this the
  // centre paid for the next term and the student still could not sit its exam.
  // The term only ever moves FORWARD: if the Exam Section has already advanced
  // the student past this request's target, approving the stale request must
  // not drag them back.
  const curN = parseInt(String(st?.semester_year || ''), 10) || 0
  const advance = termN && termN > curN ? { semester_year: req.to_term } : {}
  const { error: sErr } = await supabase.from('students')
    .update({ ...advance, fee_collected: collectedNow + charge }).eq('id', req.student_id)
  if (sErr) return { error: sErr }

  // Itemise the charge for the Payment Summary (best-effort — the money has
  // already moved and fee_collected is authoritative).
  await recordFeeDeduction({
    studentId: req.student_id,
    centerId: req.center_id,
    amount: charge,
    kind: 're_registration',
    term: req.to_term,
    note: `Re-Registration ${req.from_term} → ${req.to_term}`,
  })

  const { error } = await supabase.from('re_registrations')
    .update({ status: 'Approved', decided_at: new Date().toISOString() })
    .eq('id', req.id)
  return { error }
}

export async function rejectReRegistration(req, remarks) {
  const { error } = await supabase.from('re_registrations')
    .update({ status: 'Rejected', decided_at: new Date().toISOString(), remarks: remarks || req.remarks })
    .eq('id', req.id)
  return { error }
}

// Open + decided requests for a set of students, keyed by student id.
// Returns null when the table hasn't been created yet, so callers can hide
// the feature instead of erroring.
export async function fetchReRegistrations(studentIds) {
  if (!studentIds?.length) return {}
  const { data, error } = await supabase
    .from('re_registrations')
    .select('id, student_id, center_id, from_term, to_term, fee_amount, status, remarks, requested_at, decided_at')
    .in('student_id', studentIds)
    .order('requested_at', { ascending: false })
  if (error) return null
  const byStudent = {}
  for (const r of data || []) if (!byStudent[r.student_id]) byStudent[r.student_id] = r
  return byStudent
}
