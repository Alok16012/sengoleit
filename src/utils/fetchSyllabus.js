import { supabase } from '../lib/supabase'

// Returns formatted "Papers to be appeared" strings for a student's course
// (program + session), narrowed to the student's current semester when
// semester-specific rows exist. Used by the Admit Card generator.
export async function fetchAdmitCardSubjects(student) {
  const pid = student?.programme_id || student?.program_id
  if (!pid) return []
  const sid = student.session_id || null

  const build = (cols) => {
    let q = supabase.from('syllabus_subjects').select(cols).eq('program_id', pid)
    if (sid) q = q.or(`session_id.eq.${sid},session_id.is.null`)
    else q = q.is('session_id', null)
    return q.order('sort_order', { ascending: true })
  }
  // Include exam_date for the date sheet; fall back if the column is missing.
  let { data, error } = await build('semester, paper_no, subject_code, subject_name, exam_date, sort_order')
  if (error) ({ data, error } = await build('semester, paper_no, subject_code, subject_name, sort_order'))
  if (error || !data) return []

  let rows = data
  const sem = parseInt(student.semester_year, 10)
  if (sem) {
    const matched = data.filter(r => Number(r.semester) === sem)
    if (matched.length) rows = matched   // only narrow when sem-specific rows exist
  }

  const fmtDate = (v) => {
    if (!v) return ''
    const d = new Date(v)
    if (isNaN(d.getTime())) return v
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  return rows.map(r => {
    const paper = r.paper_no ? `Paper ${r.paper_no}: ` : ''
    const code  = r.subject_code ? `${r.subject_code} ` : ''
    const name  = r.subject_name || ''
    const date  = r.exam_date ? `  —  ${fmtDate(r.exam_date)}` : ''
    return `${paper}${code}${name}${date}`.trim()
  }).filter(Boolean)
}
