import { supabase } from '../lib/supabase'
import { paperKeyOf } from './fetchSyllabus'

// A semester lists ALTERNATIVES — PGDCA's Semester 2 offers MS-ACCESS or
// MS-SQL, PYTHON or C++ — and a student sits one of each. The admit card
// records which, so marks are entered against those papers only; the rest were
// never taken and a mark there would be nonsense.
//
// The card stores syllabus row ids, and saving the syllabus re-creates every
// row with new ids. So when NONE of the stored ids still match, the filter
// steps aside and every paper is offered — an empty sheet would be worse than
// a long one.
function keepAdmitCardPapers(subs, cards) {
  const chosen = new Set()
  for (const c of cards || []) for (const id of c.subject_ids || []) chosen.add(id)
  if (!chosen.size) return subs
  const kept = subs.filter(s => chosen.has(s.id))
  return kept.length ? kept : subs
}

// A semester's papers with their scheme (maximums, credits) and the marks the
// student obtained — everything the Statement of Marks prints.
//
// The three sources are keyed together by paperKeyOf, not by row id: saving
// the syllabus deletes and re-inserts every paper, so ids do not survive an
// edit. Returns [] when the course has no syllabus for that semester.
export async function fetchPaperMarks(student, semester) {
  const pid = student?.programme_id || student?.program_id
  if (!pid || !semester) return []

  const [subs, scheme, marks, cards] = await Promise.all([
    supabase.from('syllabus_subjects')
      .select('id, semester, paper_no, subject_code, subject_name, sort_order')
      .eq('program_id', pid).is('session_id', null).eq('semester', semester)
      .order('sort_order', { ascending: true }),
    supabase.from('scheme_papers')
      .select('semester, paper_key, internal_marks, theory_marks, total_marks, credits')
      .eq('program_id', pid).is('session_id', null).eq('semester', semester),
    supabase.from('student_paper_marks')
      .select('semester, paper_key, theory_obtained, internal_obtained')
      .eq('student_id', student.id).eq('semester', semester),
    supabase.from('student_admit_cards')
      .select('semester, subject_ids')
      .eq('student_id', student.id).eq('semester', semester),
  ])

  const byScheme = Object.fromEntries((scheme.data || []).map(r => [r.paper_key, r]))
  const byMark   = Object.fromEntries((marks.data || []).map(r => [r.paper_key, r]))

  return keepAdmitCardPapers(subs.data || [], cards.data).map(s => {
    const key = paperKeyOf(s)
    const sc = byScheme[key] || {}
    const mk = byMark[key] || {}
    return {
      paper_key: key,
      paper_no: s.paper_no,
      subject_code: s.subject_code,
      subject_name: s.subject_name,
      credits:        sc.credits ?? '',
      internal_marks: sc.internal_marks ?? '',
      theory_marks:   sc.theory_marks ?? '',
      total_marks:    sc.total_marks ?? '',
      theory_obtained:   mk.theory_obtained ?? '',
      internal_obtained: mk.internal_obtained ?? '',
    }
  })
}

// Every paper the student has marks for UP TO a semester — what a CGPA is
// averaged over. Three queries whatever the semester, rather than one set per
// semester walked in a loop.
export async function fetchPaperMarksUpto(student, upto) {
  const pid = student?.programme_id || student?.program_id
  if (!pid || !upto) return []

  const [subs, scheme, marks, cards] = await Promise.all([
    supabase.from('syllabus_subjects')
      .select('id, semester, paper_no, subject_code, subject_name')
      .eq('program_id', pid).is('session_id', null).lte('semester', upto),
    supabase.from('scheme_papers')
      .select('semester, paper_key, internal_marks, theory_marks, total_marks, credits')
      .eq('program_id', pid).is('session_id', null).lte('semester', upto),
    supabase.from('student_paper_marks')
      .select('semester, paper_key, theory_obtained, internal_obtained')
      .eq('student_id', student.id).lte('semester', upto),
    supabase.from('student_admit_cards')
      .select('semester, subject_ids')
      .eq('student_id', student.id).lte('semester', upto),
  ])

  const key = (sem, k) => `${sem}__${k}`
  const byScheme = Object.fromEntries((scheme.data || []).map(r => [key(r.semester, r.paper_key), r]))
  const byMark   = Object.fromEntries((marks.data || []).map(r => [key(r.semester, r.paper_key), r]))

  // Filter per semester: a card only speaks for its own.
  const bySem = {}
  for (const s of subs.data || []) (bySem[s.semester] ||= []).push(s)
  const kept = Object.entries(bySem).flatMap(([sem, list]) =>
    keepAdmitCardPapers(list, (cards.data || []).filter(c => String(c.semester) === String(sem))))

  return kept.map(s => {
    const k = key(s.semester, paperKeyOf(s))
    const sc = byScheme[k] || {}
    const mk = byMark[k] || {}
    return {
      semester: s.semester,
      credits: sc.credits ?? '',
      total_marks: sc.total_marks ?? '',
      theory_obtained: mk.theory_obtained ?? '',
      internal_obtained: mk.internal_obtained ?? '',
    }
  })
}

// Replace a semester's marks for one student. Papers left blank are removed
// rather than stored as zero — a blank cell means "not entered", and the
// statement prints a dash for it.
export async function savePaperMarks(studentId, semester, rows) {
  const num = v => (v === '' || v == null ? null : Number(v))
  const filled = rows.filter(r => r.theory_obtained !== '' || r.internal_obtained !== '')

  const { error: delErr } = await supabase.from('student_paper_marks')
    .delete().eq('student_id', studentId).eq('semester', semester)
  if (delErr) return { error: delErr }

  if (!filled.length) return {}
  const { error } = await supabase.from('student_paper_marks').insert(
    filled.map(r => ({
      student_id: studentId,
      semester,
      paper_key: r.paper_key,
      theory_obtained: num(r.theory_obtained),
      internal_obtained: num(r.internal_obtained),
      updated_at: new Date().toISOString(),
    }))
  )
  return { error }
}
