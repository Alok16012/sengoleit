// What the Exam Section's Print tab can print for a student, and where each
// document stands.
//
// A student's documents are:
//   • a Statement of Grades (MARKSHEET) for every semester whose result has
//     been sent to Print from the Result section;
//   • the three final documents — PROVISIONAL, MIGRATION and DEGREE — once the
//     course is through: every semester declared and passed, the last one sent
//     to Print, and every semester's marksheet printed;
//   • (the Consolidated Marksheet prints on request from the student's
//     document list; it is not one of the documents the office must issue,
//     so it stays outside the status.)
//
// A document is printed once its print_count is 1 or more. Status counts only
// documents that are due now — a final document not yet due is not "pending".
//
// Pure: no React, no database — so it can be checked on its own.

export const DOC = {
  MARKSHEET: 'MARKSHEET',
  PROVISIONAL: 'PROVISIONAL',
  MIGRATION: 'MIGRATION',
  DEGREE: 'DEGREE',
  CONSOLIDATED: 'CONSOLIDATED',
}
export const FINAL_DOCS = [DOC.PROVISIONAL, DOC.MIGRATION, DOC.DEGREE]

export const DOC_LABEL = {
  MARKSHEET: 'Marksheet',
  PROVISIONAL: 'Provisional Certificate',
  MIGRATION: 'Migration Certificate',
  DEGREE: 'Degree Certificate',
  CONSOLIDATED: 'Consolidated Marksheet',
}
export const DOC_SHORT = {
  MARKSHEET: 'Marksheet',
  PROVISIONAL: 'Provisional',
  MIGRATION: 'Migration',
  DEGREE: 'Degree',
  CONSOLIDATED: 'Consolidated',
}

// Final documents carry semester 0, so one key shape serves every document.
export const docKey = (studentId, docType, semester = 0) =>
  `${studentId}__${docType}__${Number(semester) || 0}`

export const docTitle = (d) =>
  d.doc_type === DOC.MARKSHEET ? `Marksheet S${d.semester}` : DOC_SHORT[d.doc_type] || d.doc_type

// 0 → Not Printed, 1 → Printed Once, then Reprint (2), Reprint (3) … — the
// number is the document's print count.
export function printCountLabel(count) {
  const n = Number(count) || 0
  if (n <= 0) return 'Not Printed'
  if (n === 1) return 'Printed Once'
  return `Reprint (${n})`
}

const declared = (r) => !!r && !!r.status && r.status !== 'Pending'
const failed = (r) => /fail/i.test(String(r?.status || ''))

/**
 * @param student  { id, programs: { duration } } — duration is the course's
 *                 semester count
 * @param results  the student's student_results rows (any order)
 * @param printed  { [docKey]: print_documents row } for every student
 * @returns {
 *   totalSems,
 *   marksheets: [doc],          one per semester sent to Print, by semester
 *   finals:     [doc],          the three final documents, due or not
 *   finalsDue,  finalsReason,   whether the final documents are due, and why not
 *   due:        [doc],          every document that counts towards the status
 *   pending:    [doc],          due and never printed
 *   printedDue: [doc],          due and printed at least once
 *   reprints,                   reprints across every document
 *   status:     'pending' | 'partial' | 'completed' | 'none',
 * }
 * where doc = { key, student_id, doc_type, semester, result, count, record }
 */
export function studentPrintPlan(student, results = [], printed = {}) {
  const sid = student.id
  const doc = (doc_type, semester = 0, result = null) => {
    const key = docKey(sid, doc_type, semester)
    const record = printed[key] || null
    return { key, student_id: sid, doc_type, semester: Number(semester) || 0, result, count: Number(record?.print_count) || 0, record }
  }

  const bySem = {}
  for (const r of results || []) if (r && r.semester != null) bySem[Number(r.semester)] = r

  const marksheets = Object.values(bySem)
    .filter(r => r.print_forwarded_at)
    .sort((a, b) => Number(a.semester) - Number(b.semester))
    .map(r => doc(DOC.MARKSHEET, r.semester, r))

  // Are the final documents due? The first reason that holds them back is the
  // one shown, so the office knows what to do next.
  const totalSems = Number(student?.programs?.duration) || 0
  let finalsReason = ''
  if (totalSems < 1) {
    finalsReason = 'Course duration not set'
  } else {
    for (let sem = 1; sem <= totalSems && !finalsReason; sem++) {
      const r = bySem[sem]
      if (!declared(r)) finalsReason = `Sem ${sem} result not declared`
      else if (failed(r)) finalsReason = `Sem ${sem} result is Fail`
    }
    for (let sem = 1; sem <= totalSems && !finalsReason; sem++) {
      if (!bySem[sem]?.print_forwarded_at) finalsReason = `Sem ${sem} not sent to Print`
    }
    for (let sem = 1; sem <= totalSems && !finalsReason; sem++) {
      if (!(Number(printed[docKey(sid, DOC.MARKSHEET, sem)]?.print_count) > 0)) {
        finalsReason = `Marksheet S${sem} not printed`
      }
    }
  }
  const finalsDue = !finalsReason
  // A final document printed before stays reprintable even if the record
  // under it changes later; it simply no longer counts towards the status.
  const finals = FINAL_DOCS.map(t => ({ ...doc(t), due: finalsDue }))

  const due = [...marksheets, ...finals.filter(d => d.due)]
  const pending = due.filter(d => d.count < 1)
  const printedDue = due.filter(d => d.count >= 1)
  const reprints = [...marksheets, ...finals].reduce((a, d) => a + Math.max(d.count - 1, 0), 0)

  const status = !due.length ? 'none'
    : !printedDue.length ? 'pending'
      : pending.length ? 'partial'
        : 'completed'

  return { totalSems, marksheets, finals, finalsDue, finalsReason, due, pending, printedDue, reprints, status }
}

// Every document of a student that has been printed at least once — what the
// history and the reprint list are built from.
export function printedDocsOf(plan) {
  return [...plan.marksheets, ...plan.finals].filter(d => d.count >= 1)
}
