import { supabase } from '../lib/supabase'
import { computeSemesterFeeStatus } from './courseFee'

// Re-Registration — moving a student into their next semester / year.
// The centre raises the request; the admin approves it, which holds the fee
// from the centre's wallet and advances the student's term.

const ORD = (n) => {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
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
// Returns { fee, hold } — `hold` is the 50% held from the wallet, matching what
// a new admission holds at forward time.
export async function reRegistrationFee(student) {
  const t = nextTerm(student)
  const { sems } = await computeSemesterFeeStatus({
    programme_id: student.programme_id,
    session_id: student.session_id,
    duration: Number(student?.programs?.duration) || 1,
    fee_collected: 0,
  })
  const cum = (n) => (n <= 0 ? 0 : (sems.find(s => s.sem === n)?.cumFee ?? 0))
  const perYear = t.unit === 'Year' ? 2 : 1
  const from = t.current * perYear
  const to = (t.current + 1) * perYear
  const fee = Math.max(cum(to) - cum(from), 0)
  return { fee, hold: Math.ceil(fee * 0.5), ...t }
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
export async function approveReRegistration(req) {
  if (req.fee_amount > 0 && req.center_id) {
    const { data: ctr } = await supabase
      .from('centers').select('virtual_balance').eq('id', req.center_id).maybeSingle()
    const balance = Number(ctr?.virtual_balance || 0)
    if (balance < Number(req.fee_amount)) {
      return { error: { message: `The centre's wallet has ₹${balance.toLocaleString('en-IN')} — ₹${Number(req.fee_amount).toLocaleString('en-IN')} is needed.` } }
    }
    const { error: wErr } = await supabase.from('centers')
      .update({ virtual_balance: balance - Number(req.fee_amount) })
      .eq('id', req.center_id)
    if (wErr) return { error: wErr }
  }

  const { error: sErr } = await supabase.from('students')
    .update({ semester_year: req.to_term }).eq('id', req.student_id)
  if (sErr) return { error: sErr }

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
