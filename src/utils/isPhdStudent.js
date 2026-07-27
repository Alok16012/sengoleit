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
