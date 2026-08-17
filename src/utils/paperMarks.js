import { supabase } from '../lib/supabase'
import { paperKeyOf } from './fetchSyllabus'

// A semester's papers with their scheme (maximums, credits) and the marks the
// student obtained — everything the Statement of Marks prints.
//
// The three sources are keyed together by paperKeyOf, not by row id: saving
// the syllabus deletes and re-inserts every paper, so ids do not survive an
// edit. Returns [] when the course has no syllabus for that semester.
export async function fetchPaperMarks(student, semester) {
  const pid = student?.programme_id || student?.program_id
  if (!pid || !semester) return []

  const [subs, scheme, marks] = await Promise.all([
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
  ])

  const byScheme = Object.fromEntries((scheme.data || []).map(r => [r.paper_key, r]))
  const byMark   = Object.fromEntries((marks.data || []).map(r => [r.paper_key, r]))

  return (subs.data || []).map(s => {
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
