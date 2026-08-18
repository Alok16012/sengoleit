import { supabase } from '../lib/supabase'

const fmtExamDate = (v) => {
  if (!v) return ''
  const d = new Date(v)
  if (isNaN(d.getTime())) return v
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

// A paper's stable identity within its course — its subject code, or its paper
// number + name. Saving the syllabus deletes and re-inserts every row, so a
// paper's id changes on each edit; anything that has to outlive that (the
// examination scheme's marks, a student's marks) is keyed by this instead.
//
// The NAME is part of the key because a subject code is not unique within a
// semester: B.Ed's Semester 2 carries Teaching of English, of Kannada and of
// Hindi all as BED202 — alternatives a student picks one of. Keying on the
// code alone gave the three of them one identity, and saving the scheme hit
// the unique index on the second one.
export const paperKeyOf = (r) =>
  `${(r.subject_code || '').trim() || (r.paper_no || '').trim()}|${(r.subject_name || '').trim()}`

// One syllabus row → the "Papers to be appeared" line printed on the Admit Card.
export function formatSubjectRow(r) {
  // paper_no may or may not already include the word "Paper" (e.g. "Paper 1" vs
  // "1") — don't prepend it twice.
  const pno = String(r.paper_no || '').trim()
  const paper = pno ? (/^paper\b/i.test(pno) ? `${pno}: ` : `Paper ${pno}: `) : ''
  const code  = r.subject_code ? `${r.subject_code} ` : ''
  const name  = r.subject_name || ''
  const date  = r.exam_date ? `  —  ${fmtExamDate(r.exam_date)}` : ''
  return `${paper}${code}${name}${date}`.trim()
}

// Raw syllabus rows for a student's course (program + session), narrowed to a
// semester when semester-specific rows exist. Used to let the admin pick which
// papers appear on the Admit Card before generating it.
export async function fetchSemesterSubjectRows(student, semOverride) {
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
  let { data, error } = await build('id, semester, paper_no, subject_code, subject_name, exam_date, sort_order')
  if (error) ({ data, error } = await build('id, semester, paper_no, subject_code, subject_name, sort_order'))
  if (error || !data) return []

  let rows = data
  const sem = semOverride != null ? Number(semOverride) : parseInt(student.semester_year, 10)
  if (sem) {
    const matched = data.filter(r => Number(r.semester) === sem)
    if (matched.length) rows = matched   // only narrow when sem-specific rows exist
  }
  return rows
}

// Formatted "Papers to be appeared" strings for the Admit Card generator.
export async function fetchAdmitCardSubjects(student, semOverride) {
  const rows = await fetchSemesterSubjectRows(student, semOverride)
  return rows.map(formatSubjectRow).filter(Boolean)
}
