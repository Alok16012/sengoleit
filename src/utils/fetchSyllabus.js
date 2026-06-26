import { supabase } from '../lib/supabase'

// Returns formatted "Papers to be appeared" strings for a student's course
// (program + session), narrowed to the student's current semester when
// semester-specific rows exist. Used by the Admit Card generator.
export async function fetchAdmitCardSubjects(student) {
  const pid = student?.programme_id || student?.program_id
  if (!pid) return []
  const sid = student.session_id || null

  let q = supabase.from('syllabus_subjects')
    .select('semester, paper_no, subject_code, subject_name, sort_order')
    .eq('program_id', pid)
  // Match this session, plus rows saved for "all sessions" (null).
  if (sid) q = q.or(`session_id.eq.${sid},session_id.is.null`)
  else q = q.is('session_id', null)

  const { data, error } = await q.order('sort_order', { ascending: true })
  if (error || !data) return []

  let rows = data
  const sem = parseInt(student.semester_year, 10)
  if (sem) {
    const matched = data.filter(r => Number(r.semester) === sem)
    if (matched.length) rows = matched   // only narrow when sem-specific rows exist
  }

  return rows.map(r => {
    const paper = r.paper_no ? `Paper ${r.paper_no}: ` : ''
    const code  = r.subject_code ? `${r.subject_code} ` : ''
    const name  = r.subject_name || ''
    return `${paper}${code}${name}`.trim()
  }).filter(Boolean)
}
