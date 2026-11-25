import { isPhdProgram } from './generateStudentCards'

// True when a student row belongs to the Ph.D (research) pipeline.
// Works off whichever of the two joins the caller happened to select:
//   programs(program_name)  and/or  programs(programme_types(programme_type_name))
// The Ph.D pipeline differs from the regular one — no registration number and no
// registration card, letters come from the Research Dept, and the enrollment
// number is issued only when Research forwards the student to the Exam Section.
export function isPhdStudent(s) {
  if (!s) return false
  const type = s.programs?.programme_types?.programme_type_name || s.programme_type_name || ''
  if (/doctorate|ph\.?\s*d|doctoral/i.test(type)) return true
  return isPhdProgram(s.programs?.program_name || s.program_name || '')
}

// Research Dept → Candidates: Hide / Unhide for the Ph.D documents that have no
// column of their own (students.phd_doc_visible, add_phd_doc_visibility.sql).
// Unset, the ID Card is visible — as it always was once the Registration No.
// exists — and every other document is hidden.
export const ID_CARD_DOC = 'ID Card'
export function phdDocVisible(s, name) {
  const v = s?.phd_doc_visible?.[name]
  return v == null ? name === ID_CARD_DOC : !!v
}
