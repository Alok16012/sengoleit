import { supabase } from '../lib/supabase'
import { fetchSemesterSubjectRows, formatSubjectRow } from './fetchSyllabus'

// Semester-wise admit cards (student_admit_cards). A record exists for each
// semester whose card has been issued; it remembers the papers that were on it
// so the same card can be re-printed, and whether the student can see it.
//
// Every read returns null when add_semester_admit_cards.sql has not been run,
// so callers fall back to the old single-card behaviour instead of erroring.

// Issued cards for one student, keyed by semester.
export async function admitCardsFor(studentId) {
  const { data, error } = await supabase
    .from('student_admit_cards')
    .select('id, semester, subject_ids, generated_at, released_at')
    .eq('student_id', studentId)
  if (error) return null
  return Object.fromEntries((data || []).map(r => [r.semester, r]))
}

// Record a card as issued. Visible to the student straight away — the admin
// asked for a Hide button, which only makes sense if it starts shown.
export async function saveAdmitCard(studentId, semester, subjectIds) {
  const { error } = await supabase.from('student_admit_cards').upsert({
    student_id: studentId,
    semester,
    subject_ids: subjectIds || [],
    generated_at: new Date().toISOString(),
    released_at: new Date().toISOString(),
  }, { onConflict: 'student_id,semester' })
  return { error }
}

// Hide from / show to the student, without losing the record of what was on it.
export async function setAdmitCardVisible(studentId, semester, visible) {
  const { error } = await supabase.from('student_admit_cards')
    .update({ released_at: visible ? new Date().toISOString() : null })
    .eq('student_id', studentId).eq('semester', semester)
  return { error }
}

// Withdraw the card entirely — the semester goes back to "Select Papers".
export async function deleteAdmitCard(studentId, semester) {
  const { error } = await supabase.from('student_admit_cards')
    .delete().eq('student_id', studentId).eq('semester', semester)
  return { error }
}

// The card the Exam Section last issued for a student, with exactly the papers
// it was issued with. Every download outside the Exam Section — the centre's
// list, the admin's Students page — used to re-derive the papers from the
// syllabus instead, so the card a centre printed carried a different set of
// papers from the one the Exam Section had ticked.
//
// Returns null when no card has been issued (or the migration has not been
// run), so callers fall back to their old syllabus-derived behaviour. Centres
// only ever see released cards; RLS, not this function, enforces that.
// An issued card with no subject_ids prints "as per university curriculum".
export async function issuedAdmitCard(student) {
  const bySem = await admitCardsFor(student.id)
  const cards = Object.values(bySem || {})
  if (!cards.length) return null
  // Latest semester = the exam coming up, the same one the student portal shows.
  const card = cards.reduce((a, b) => (Number(b.semester) > Number(a.semester) ? b : a))
  const ids = new Set(card.subject_ids || [])
  if (!ids.size) return { semester: card.semester, subjects: [] }
  const rows = await fetchSemesterSubjectRows(student, card.semester)
  return {
    semester: card.semester,
    subjects: rows.filter(r => ids.has(r.id)).map(formatSubjectRow).filter(Boolean),
  }
}

// The signed-in student's own visible admit cards (student portal, anon session).
export async function fetchMyAdmitCards(token) {
  if (!token) return []
  const { data, error } = await supabase.rpc('student_admit_cards_self', { p_token: token })
  if (error) return []
  return Array.isArray(data) ? data : []
}
