import { supabase } from '../lib/supabase'
import { fetchSemesterSubjectRows, formatSubjectRow, paperKeyOf } from './fetchSyllabus'

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
    .select('id, semester, subject_ids, subject_keys, generated_at, released_at')
    .eq('student_id', studentId)
  if (error) return null
  return Object.fromEntries((data || []).map(r => [r.semester, r]))
}

// Record a card as issued. Visible to the student straight away — the admin
// asked for a Hide button, which only makes sense if it starts shown.
export async function saveAdmitCard(studentId, semester, subjectIds, subjectKeys) {
  const row = {
    student_id: studentId,
    semester,
    subject_ids: subjectIds || [],
    generated_at: new Date().toISOString(),
    released_at: new Date().toISOString(),
  }
  let { error } = await supabase.from('student_admit_cards')
    .upsert({ ...row, subject_keys: subjectKeys || [] }, { onConflict: 'student_id,semester' })
  // subject_keys needs add_admit_card_subject_keys.sql — issue the card anyway
  // rather than blocking on a column that only makes it more durable.
  if (error && /subject_keys/.test(error.message || '')) {
    ;({ error } = await supabase.from('student_admit_cards')
      .upsert(row, { onConflict: 'student_id,semester' }))
  }
  return { error }
}

// Change the papers on an already-issued card WITHOUT touching released_at —
// editing a hidden card must not quietly publish it back to the student, and
// saveAdmitCard's upsert would do exactly that. generated_at does move: the
// card the student now sees is the one issued today, not the original.
export async function updateAdmitCardSubjects(studentId, semester, subjectIds, subjectKeys) {
  const patch = { subject_ids: subjectIds || [], generated_at: new Date().toISOString() }
  let { error } = await supabase.from('student_admit_cards')
    .update({ ...patch, subject_keys: subjectKeys || [] })
    .eq('student_id', studentId).eq('semester', semester)
  if (error && /subject_keys/.test(error.message || '')) {
    ;({ error } = await supabase.from('student_admit_cards')
      .update(patch).eq('student_id', studentId).eq('semester', semester))
  }
  return { error }
}

// Hide from / show to the student, without losing the record of what was on it.
export async function setAdmitCardVisible(studentId, semester, visible) {
  const { error } = await supabase.from('student_admit_cards')
    .update({ released_at: visible ? new Date().toISOString() : null })
    .eq('student_id', studentId).eq('semester', semester)
  return { error }
}

// Issued cards for many students at once, keyed by student id (each an array
// of { semester, released_at } sorted ascending) — used to list a student's
// cards without one query per row, and to know whether the "Admit Card"
// action has anything to show at all. Returns null when the migration hasn't
// been run, same convention as admitCardsFor.
export async function admitCardsForMany(studentIds) {
  if (!studentIds?.length) return {}
  const { data, error } = await supabase
    .from('student_admit_cards')
    .select('student_id, semester, released_at')
    .in('student_id', studentIds)
  if (error) return null
  const byStudent = {}
  for (const r of data || []) (byStudent[r.student_id] ||= []).push(r)
  for (const id in byStudent) byStudent[id].sort((a, b) => a.semester - b.semester)
  return byStudent
}

// Withdraw the card entirely — the semester goes back to "Select Papers".
export async function deleteAdmitCard(studentId, semester) {
  const { error } = await supabase.from('student_admit_cards')
    .delete().eq('student_id', studentId).eq('semester', semester)
  return { error }
}

// The card the Exam Section issued for a student, with exactly the papers it
// was issued with. Every download outside the Exam Section — the centre's
// list, the admin's Students page — used to re-derive the papers from the
// syllabus instead, so the card a centre printed carried a different set of
// papers from the one the Exam Section had ticked.
//
// With no `semester`, picks the latest issued one — the exam coming up, the
// same one the student portal shows. Pass a semester to get that one
// specifically (a student with several issued cards has more than one).
//
// Returns null when no matching card has been issued (or the migration has
// not been run), so callers fall back to their old syllabus-derived
// behaviour. Centres only ever see released cards; RLS, not this function,
// enforces that. A card with no subject_ids prints "as per university
// curriculum".
export async function issuedAdmitCard(student, semester) {
  const bySem = await admitCardsFor(student.id)
  const cards = Object.values(bySem || {})
  if (!cards.length) return null
  const card = semester != null
    ? cards.find(c => Number(c.semester) === Number(semester))
    : cards.reduce((a, b) => (Number(b.semester) > Number(a.semester) ? b : a))
  if (!card) return null
  const rows = await fetchSemesterSubjectRows(student, card.semester)
  const picked = pickCardRows(rows, card)
  return { semester: card.semester, subjects: picked.map(formatSubjectRow).filter(Boolean) }
}

// The syllabus rows a card was issued with. Keys first — they survive a
// syllabus edit; row ids do not, and a card resolved by stale ids came out
// with no papers on it at all.
export function pickCardRows(rows, card) {
  const keys = new Set(card?.subject_keys || [])
  if (keys.size) {
    const byKey = rows.filter(r => keys.has(paperKeyOf(r)))
    if (byKey.length) return byKey
  }
  const ids = new Set(card?.subject_ids || [])
  return ids.size ? rows.filter(r => ids.has(r.id)) : []
}

// The signed-in student's own visible admit cards (student portal, anon session).
export async function fetchMyAdmitCards(token) {
  if (!token) return []
  const { data, error } = await supabase.rpc('student_admit_cards_self', { p_token: token })
  if (error) return []
  return Array.isArray(data) ? data : []
}
