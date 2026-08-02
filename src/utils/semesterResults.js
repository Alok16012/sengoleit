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

// Send one semester's result to the student.
export async function releaseSemesterResult(studentId, semester) {
  const { error } = await supabase.from('student_results')
    .update({ released_at: new Date().toISOString() })
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
