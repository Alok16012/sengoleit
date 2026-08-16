import { supabase } from '../lib/supabase'

// One line per deduction from a centre's wallet, so the Payment Summary can
// show WHAT a student's fee_collected is made of instead of one merged total.
// See add_student_fee_ledger.sql.
//
// Recording is best-effort and never blocks the money movement it describes:
// the deduction has already happened and is authoritative in fee_collected, so
// a missing ledger table (migration not run) must not fail the approval. The
// error is returned for callers that want to surface it.
export async function recordFeeDeduction({ studentId, centerId, amount, kind, term, note }) {
  const value = Number(amount) || 0
  if (!studentId || value <= 0) return { skipped: true }
  const { error } = await supabase.from('student_fee_ledger').insert({
    student_id: studentId,
    center_id: centerId || null,
    amount: value,
    kind,
    term: term || null,
    note: note || null,
  })
  return { error }
}

// Every deduction recorded for a set of students, newest first.
// Returns null when the migration hasn't been run, so callers can fall back to
// the old one-total-per-student view instead of showing an empty statement.
export async function fetchFeeLedger(studentIds) {
  if (!studentIds?.length) return {}
  const { data, error } = await supabase
    .from('student_fee_ledger')
    .select('id, student_id, center_id, amount, kind, term, note, created_at')
    .in('student_id', studentIds)
    .order('created_at', { ascending: false })
  if (error) return null
  const byStudent = {}
  for (const r of data || []) (byStudent[r.student_id] ||= []).push(r)
  return byStudent
}

export const LEDGER_KIND_LABEL = {
  admission: 'Admission',
  re_registration: 'Re-Registration',
  exam_balance: 'Exam Balance',
  opening: 'Earlier Collection',
}
