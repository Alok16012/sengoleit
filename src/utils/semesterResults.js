import { supabase } from '../lib/supabase'
import { computeSemesterFeeStatus } from './courseFee'

// Semester-wise exam results (student_results). A result exists for the same
// semesters the admit card is issued for — i.e. those whose fee is cleared.

// The semesters a student can have a result for, each with its saved result.
// Returns null when add_semester_results.sql hasn't been run yet, so callers
// can fall back instead of erroring.
export async function semesterResults(student) {
  const { sems } = await computeSemesterFeeStatus({
    programme_id: student.programme_id,
    session_id: student.session_id,
    duration: student.programs?.duration,
    fee_collected: student.fee_collected,
    coupon_discount: student.coupon_discount,
  })
  const { data, error } = await supabase
    .from('student_results')
    .select('id, semester, status, obtained_marks, total_marks, remarks, marksheet_url, declared_at, released_at')
    .eq('student_id', student.id)
  if (error) return null
  const bySem = Object.fromEntries((data || []).map(r => [r.semester, r]))
  return sems.map(s => ({ ...s, result: bySem[s.sem] || null }))
}

export async function saveSemesterResult(studentId, semester, values) {
  const { error } = await supabase.from('student_results').upsert({
    student_id: studentId,
    semester,
    ...values,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'student_id,semester' })
  return { error }
}

// Show a semester's result to the student, or take it back — the same
// released_at flag either way, so a result sent by mistake can be pulled
// without deleting the marks behind it.
export async function setSemesterResultVisible(studentId, semester, visible) {
  const { error } = await supabase.from('student_results')
    .update({ released_at: visible ? new Date().toISOString() : null })
    .eq('student_id', studentId).eq('semester', semester)
  return { error }
}

// The signed-in student's own released results (student portal, anon session).
export async function fetchMyResults(token) {
  if (!token) return []
  const { data, error } = await supabase.rpc('student_results_self', { p_token: token })
  if (error) return []
  return Array.isArray(data) ? data : []
}

// Declared results for many students at once, keyed `${student_id}__${semester}`
// — so a list can show each student's standing without a query per row.
// Returns null when add_semester_results.sql hasn't been run.
export async function fetchResultsForMany(studentIds) {
  if (!studentIds?.length) return {}
  const { data, error } = await supabase
    .from('student_results')
    .select('student_id, semester, status, obtained_marks, total_marks, released_at')
    .in('student_id', studentIds)
  if (error) return null
  return Object.fromEntries((data || []).map(r => [`${r.student_id}__${r.semester}`, r]))
}

// Remove a semester's declared result. The paper-wise marks are left alone —
// they are what was typed in, and an admin deleting a wrongly-declared result
// should not have to key every paper again to re-declare it. Deleting the row
// also takes released_at with it, so the student stops seeing the result.
export async function deleteSemesterResult(studentId, semester) {
  const { error } = await supabase.from('student_results')
    .delete().eq('student_id', studentId).eq('semester', semester)
  return { error }
}
