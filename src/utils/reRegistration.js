import { supabase } from '../lib/supabase'
import { computeSemesterFeeStatus } from './courseFee'
import { recordFeeDeduction } from './feeLedger'

// Re-Registration — moving a student into their next semester / year.
// The centre raises the request, and the fee is held from its wallet there and
// then; the admin's approval credits that money to the student and advances the
// term, and a rejection puts it back. The hold used to wait for approval while
// the centre's modal already said the money was held, so a centre that raised a
// batch of requests watched its balance not move and had no way to tell whether
// the deduction was broken or simply hadn't happened yet.

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

// Re-read the request straight from the table. held_at decides whether the fee
// is already out of the wallet, and a caller that did not select that column
// looks exactly like a request that was never held — so the Account Department,
// whose own query omitted it, charged the centre a second time at verification:
// 50% when the centre raised the request, the other 50% when the fee was
// verified. Reading it here means no caller has to remember.
async function liveRequest(req) {
  const { data, error } = await supabase
    .from('re_registrations')
    .select('id, student_id, center_id, from_term, to_term, fee_amount, status, held_at')
    .eq('id', req?.id).maybeSingle()
  // No held_at column at all — nothing is held at request time either, so the
  // caller's own view is right.
  if (error || !data) return req
  return { ...req, ...data }
}

// Take `amount` from a centre's wallet, or put it back with a negative amount.
// The balance is read and written rather than incremented in place, so the write
// is conditional on the value just read: a second request from the same centre
// landing in between changes the balance, the update matches no row, and the
// caller is told to retry instead of silently overwriting the other deduction.
async function moveWallet(centerId, amount) {
  if (!centerId || !amount) return {}
  const { data: ctr, error } = await supabase
    .from('centers').select('virtual_balance').eq('id', centerId).maybeSingle()
  if (error) return { error }
  const balance = Math.round(Number(ctr?.virtual_balance || 0))
  if (amount > 0 && balance < amount) {
    return { error: { message: `The centre's wallet has ₹${balance.toLocaleString('en-IN')} — ₹${amount.toLocaleString('en-IN')} is needed.` } }
  }
  const { data: rows, error: wErr } = await supabase.from('centers')
    .update({ virtual_balance: balance - amount })
    .eq('id', centerId).eq('virtual_balance', ctr?.virtual_balance ?? balance)
    .select('id')
  if (wErr) return { error: wErr }
  if (!rows || !rows.length) {
    return { error: { message: 'The centre wallet changed while this was being saved. Please try again.' } }
  }
  return {}
}

// Whether re_registrations carries held_at yet. Without the column there is
// nowhere to record that the money was taken, so the old behaviour — charge at
// approval — stays in force rather than risking a hold nothing can refund.
async function canHoldAtRequest() {
  const { error } = await supabase.from('re_registrations').select('held_at').limit(1)
  return !error
}

// Centre → request. One open request per student (enforced by a unique index).
// The amount is re-derived here rather than trusted from the caller: the modal
// worked it out before the centre typed its remarks, and the Exam Section may
// have collected some of the term's fee in between.
export async function requestReRegistration({ student, remarks }) {
  const t = nextTerm(student)
  const centerId = student.center_id || student.centers?.id || null
  const { hold } = await reRegistrationFee(student)
  const charge = Math.max(Math.round(Number(hold) || 0), 0)
  const holding = charge > 0 && centerId && (await canHoldAtRequest())

  if (holding) {
    const { error } = await moveWallet(centerId, charge)
    if (error) return { error }
  }

  const { error } = await supabase.from('re_registrations').insert({
    student_id: student.id,
    center_id: centerId,
    session_id: student.session_id || null,
    from_term: t.currentLabel,
    to_term: t.nextLabel,
    fee_amount: charge,
    remarks: remarks || null,
    ...(holding ? { held_at: new Date().toISOString() } : {}),
  })
  // The money is out but the request never landed — put it back, or the centre
  // is short with nothing on record to explain it.
  if (error && holding) await moveWallet(centerId, -charge)
  return { error, held: holding ? charge : 0 }
}

// Admin → approve. Credits the held fee to the student, advances the term and
// closes the request.
//
// A request raised since holds moved to request time already has its money out
// of the wallet (held_at is set) — approving must not take it a second time.
// A request raised before that does not, and is charged here exactly as it was:
// the request's amount capped at what the term still lacks, so the Exam
// Section's own admit-card collection is never taken twice. The wallet is
// written before the term advances — advancing first could leave a student
// re-registered with the fee never taken.
export async function approveReRegistration(req) {
  const req2 = await liveRequest(req)
  const { data: st } = await supabase
    .from('students')
    .select('fee_collected, coupon_discount, programme_id, session_id, semester_year, programs(duration, semester_year)')
    .eq('id', req2.student_id).maybeSingle()
  const collectedNow = Number(st?.fee_collected || 0)

  // The request's target term → its closing semester ("2nd Year" covers sems
  // 3–4). An unparseable term (old/odd data) falls back to charging as before.
  let charge = Number(req2.fee_amount || 0)
  const termN = parseInt(String(req2.to_term || ''), 10)

  if (!req2.held_at) {
    if (st && termN) {
      const toSem = /year/i.test(req2.to_term) ? termN * 2 : termN
      const { sems } = await computeSemesterFeeStatus({
        programme_id: st.programme_id,
        session_id: st.session_id,
        duration: Number(st.programs?.duration) || 1,
        fee_collected: collectedNow,
        coupon_discount: st.coupon_discount,
      })
      const due = sems.find(s => s.sem === toSem)?.dueFee ?? 0
      charge = Math.min(charge, Math.max(due - collectedNow, 0))
    }
    if (charge > 0) {
      const { error } = await moveWallet(req2.center_id, charge)
      if (error) return { error }
    }
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
    .update({ ...advance, fee_collected: collectedNow + charge }).eq('id', req2.student_id)
  if (sErr) return { error: sErr }

  // Itemise the charge for the Payment Summary (best-effort — the money has
  // already moved and fee_collected is authoritative).
  await recordFeeDeduction({
    studentId: req2.student_id,
    centerId: req2.center_id,
    amount: charge,
    kind: 're_registration',
    term: req2.to_term,
    note: `Re-Registration ${req2.from_term} → ${req2.to_term}`,
  })

  const { error } = await supabase.from('re_registrations')
    .update({ status: 'Approved', decided_at: new Date().toISOString() })
    .eq('id', req2.id)
  return { error }
}

// Admin → reject. Whatever was held when the centre raised this goes back to
// its wallet; a request that never held anything just closes.
export async function rejectReRegistration(req, remarks) {
  const req2 = await liveRequest(req)
  const held = req2.held_at ? Math.round(Number(req2.fee_amount) || 0) : 0
  if (held > 0) {
    const { error } = await moveWallet(req2.center_id, -held)
    if (error) return { error }
  }
  const { error } = await supabase.from('re_registrations')
    .update({
      status: 'Rejected',
      decided_at: new Date().toISOString(),
      remarks: remarks || req.remarks,
      ...(held > 0 ? { held_at: null } : {}),
    })
    .eq('id', req.id)
  return { error }
}

// Open + decided requests for a set of students, keyed by student id.
// Returns null when the table hasn't been created yet, so callers can hide
// the feature instead of erroring.
export async function fetchReRegistrations(studentIds) {
  if (!studentIds?.length) return {}
  const cols = 'id, student_id, center_id, from_term, to_term, fee_amount, status, remarks, requested_at, decided_at'
  const load = (c) => supabase.from('re_registrations').select(c)
    .in('student_id', studentIds).order('requested_at', { ascending: false })
  // held_at arrives with add_re_registration_hold.sql — retry without it so the
  // page keeps working on a database that has not run the migration.
  let { data, error } = await load(`${cols}, held_at`)
  if (error) ({ data, error } = await load(cols))
  if (error) return null
  const byStudent = {}
  for (const r of data || []) if (!byStudent[r.student_id]) byStudent[r.student_id] = r
  return byStudent
}
