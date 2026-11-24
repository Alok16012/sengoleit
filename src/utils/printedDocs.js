import { supabase } from '../lib/supabase'
import { fetchMarksheetFor } from './paperMarks'
import { dateReached } from './examSettings'
import { formatMonthYear, formatDayMonthYear } from './formatDate'
import {
  generateStatementOfGrades, sgpaOf, divisionFor,
  generateProvisionalCertificate, generateMigrationCertificate, generateDegreeCertificate,
} from './generateStudentCards'
import { DOC } from './printDocs'

// The documents the Exam Section has already printed for a student, opened
// again to look at — the same sheets the Print tab printed. Read-only: opening
// one here records nothing.

// student_id -> [print_documents row] for everything printed at least once.
// {} when the table cannot be read (no access, or not migrated).
export async function fetchPrintedDocs(studentIds) {
  if (!studentIds?.length) return {}
  const { data, error } = await supabase.from('print_documents')
    .select('student_id, doc_type, semester, print_count, first_printed_at, last_printed_at')
    .in('student_id', studentIds).gt('print_count', 0)
  if (error) return {}
  const out = {}
  ;(data || []).filter(r => r.doc_type !== DOC.CONSOLIDATED).forEach(r => { (out[r.student_id] ||= []).push(r) })
  const order = { MARKSHEET: 0, PROVISIONAL: 1, MIGRATION: 2, DEGREE: 3 }
  Object.values(out).forEach(list => list.sort((a, b) => (order[a.doc_type] - order[b.doc_type]) || (a.semester - b.semester)))
  return out
}

const fullStudent = async (student) => {
  const { data } = await supabase.from('students')
    .select('*, programs(program_name, semester_year), academic_sessions(session_name), centers(center_name, center_code), departments(name)')
    .eq('id', student.id).single()
  return data || student
}

// The printed Statement of Grades for one semester: the calendar's Marksheet
// Printing Date (else the day it went to Print) as its Date of Issue, each
// earlier semester's SGPA from its own marksheet. Returns an error to show,
// or '' once the sheet is open.
export async function openStatementOfGrades(student, result, whole = null) {
  const sems = Array.from({ length: Number(result.semester) || 1 }, (_, i) => i + 1)
  const [sheets, full] = await Promise.all([
    Promise.all(sems.map(n => fetchMarksheetFor(student.id, n))),
    whole ? Promise.resolve(whole) : fullStudent(student),
  ])
  const last = sheets[sheets.length - 1]
  if (!last?.sheet) return last?.reason || 'The marksheet could not be read.'
  const sheet = last.sheet
  if (!dateReached(sheet.result_published)) {
    return `Semester ${result.semester} marksheets can be printed from ${formatDayMonthYear(sheet.result_published)}.`
  }
  const semSgpas = {}
  sheets.forEach((x, i) => { const g = x.sheet ? sgpaOf(x.sheet.papers) : null; if (g != null) semSgpas[i + 1] = g })
  generateStatementOfGrades(full, sheet.papers, {
    dmcNo: result.dmc_no ? String(result.dmc_no) : '',
    semSgpas,
    issueDate: sheet.result_published ? `${sheet.result_published}T12:00:00` : (result.print_forwarded_at || null),
    semester: `Semester ${result.semester}`,
    examHeld: String(sheet.exam_held || '').trim() || formatMonthYear(sheet.exam_start),
    resultStatus: result.status === 'Fail' ? 'Failed' : 'Passed',
    cgpa: sgpaOf(sheet.upto || []),
  })
  return ''
}

// Provisional / Migration / Degree as printed: passing year and division from
// the semesters sent to Print, the certificate's own number, and the day it
// was first printed as its Date of Issue.
export async function openFinalCertificate(student, record, results = []) {
  const full = await fullStudent(student)
  const sems = results.filter(r => r.print_forwarded_at)
  const num = x => Number(String(x ?? '').replace(/[^\d.]/g, '')) || 0
  const obtained = sems.reduce((a, r) => a + num(r.obtained_marks), 0)
  const maximum = sems.reduce((a, r) => a + num(r.total_marks), 0)
  const lastDeclared = sems.map(r => r.declared_at).filter(Boolean).sort().pop()
  const passingYear = lastDeclared ? new Date(lastDeclared).getFullYear() : ''
  const division = maximum > 0 ? divisionFor((obtained / maximum) * 100) : ''
  const d = record.first_printed_at ? new Date(record.first_printed_at) : null
  const issueDate = record.issue_date
    || (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : undefined)

  if (record.doc_type === DOC.PROVISIONAL) {
    const { data } = await supabase.from('certificate_numbers').select('cert_no')
      .eq('student_id', student.id).eq('doc_type', DOC.PROVISIONAL).maybeSingle()
    generateProvisionalCertificate(full, { passingYear, division, certNo: data?.cert_no || '', issueDate })
  } else if (record.doc_type === DOC.MIGRATION) {
    generateMigrationCertificate(full, { passingYear, issueDate })
  } else if (record.doc_type === DOC.DEGREE) {
    generateDegreeCertificate(full, { passingYear, division, issueDate })
  }
  return ''
}
