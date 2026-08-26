import { UNI_ESTD } from '../utils/generateStudentCards'

// The result sheet a STUDENT and a CENTRE see, on the page.
//
// One component for both, because the university asked for one sheet: a centre
// that reads a different sheet from the student it belongs to has no way of
// answering a question about it. The Exam Section's own view is untouched —
// it keeps the full Statement of Marks, with credits, grades and SGPA/CGPA,
// which is the document the university issues. This is the summary: what each
// paper is out of, what was scored in it, the total and the division.
//
// It renders in the page. There is deliberately no print or download button
// here — the sheet is to be READ; the university issues the printed statement.

const INK = '#1a5b5d'          // the sheet's rule and banner colour
const DASH = '#c7d1d1'         // the dashed cell rules
const HEAD_BG = '#eef1f1'
const BODY_BG = '#f6f8f8'

const num = v => (v === '' || v == null ? null : Number(v))

// What a paper is out of. The scheme's own total when it sets one, otherwise
// theory + internal added up — a course whose scheme fills only those two.
function paperFullMarks(p) {
  const total = num(p.total_marks)
  if (total) return total
  const sum = (num(p.theory_marks) || 0) + (num(p.internal_marks) || 0)
  return sum || null
}

// What was scored in it. A paper with NEITHER mark entered returns null and
// prints a dash — a blank cell means "not entered", and a 0 there would read
// as a fail the student did not get.
function paperObtained(p) {
  const t = num(p.theory_obtained)
  const i = num(p.internal_obtained)
  if (t == null && i == null) return null
  return (t || 0) + (i || 0)
}

// "Year-1" for a course counted in years, "Semester-1" for one counted in
// semesters — the same distinction the student lists draw.
function termLabel(student, semester) {
  const byYear = student?.programs?.semester_year === 'Year'
  return `${byYear ? 'Year' : 'Semester'}-${semester}`
}

const cell = {
  border: `1px dashed ${DASH}`,
  padding: '7px 10px',
  fontSize: 12,
  color: '#33454a',
  verticalAlign: 'middle',
}
const labelCell = { ...cell, whiteSpace: 'nowrap' }
const bannerCell = {
  padding: '9px 10px',
  fontSize: 12.5,
  fontWeight: 800,
  color: '#ffffff',
  letterSpacing: '0.01em',
}

export default function ResultSheetView({ student, semester, papers = [], status }) {
  const rows = papers.filter(Boolean)
  const totalObtained = rows.reduce((a, p) => a + (paperObtained(p) || 0), 0)
  const anyMarks = rows.some(p => paperObtained(p) != null)
  const session = student?.academic_sessions?.session_name || student?.session_name || '—'

  return (
    <div style={{ border: `2px solid ${INK}`, background: '#fff', overflow: 'hidden' }}>

      {/* Masthead — the logo carries the university's name, so the sheet
          repeats only the establishment line beneath it. */}
      <div style={{ textAlign: 'center', padding: '14px 12px 12px', borderBottom: `2px solid ${INK}` }}>
        <img src="/assets/logo.png" alt="Sengol International University"
          style={{ height: 74, width: 'auto', objectFit: 'contain', margin: '0 auto', display: 'block' }}
          onError={e => { e.currentTarget.style.display = 'none' }} />
        <p style={{ fontSize: 8.5, color: '#5b6b6b', margin: '7px auto 0', maxWidth: 460, lineHeight: 1.45 }}>
          {UNI_ESTD}
        </p>
      </div>

      {/* Who the sheet belongs to. */}
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <tbody>
          <tr>
            <td style={{ ...labelCell, width: '27%' }}>Enrolment No.:</td>
            <td style={{ ...cell, width: '33%', fontWeight: 700 }}>{student?.enrollment_no || '—'}</td>
            <td style={{ ...labelCell, width: '16%' }}>Course Code:</td>
            <td style={{ ...cell, width: '24%', fontWeight: 700 }}>{student?.course_code || '—'}</td>
          </tr>
          <tr>
            <td style={labelCell}>Session :</td>
            <td style={{ ...cell, fontWeight: 700 }}>{session}</td>
            <td style={labelCell}>Semester:</td>
            <td style={{ ...cell, fontWeight: 700 }}>{termLabel(student, semester)}</td>
          </tr>
        </tbody>
      </table>

      {/* The papers. */}
      <div style={{ padding: '10px 10px 0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr style={{ background: HEAD_BG }}>
              <th style={{ ...cell, width: '16%', textAlign: 'left', fontWeight: 600 }}>SL No</th>
              <th style={{ ...cell, width: '29%', textAlign: 'left', fontWeight: 600 }}>Subject Code</th>
              <th style={{ ...cell, width: '24%', textAlign: 'left', fontWeight: 600 }}>Full Marks</th>
              <th style={{ ...cell, width: '31%', textAlign: 'left', fontWeight: 600 }}>Obtain Marks</th>
            </tr>
          </thead>
          <tbody>
            {!rows.length ? (
              <tr style={{ background: BODY_BG }}>
                <td style={{ ...cell, textAlign: 'center' }} colSpan={4}>
                  No papers are recorded for this semester.
                </td>
              </tr>
            ) : rows.map((p, i) => {
              const full = paperFullMarks(p)
              const got = paperObtained(p)
              return (
                <tr key={p.paper_key || i} style={{ background: BODY_BG }}>
                  <td style={cell}>{i + 1}</td>
                  {/* A course whose syllabus carries no code falls back to the
                      subject's name — an empty first column names nothing. */}
                  <td style={cell} title={p.subject_name || ''}>
                    {p.subject_code || p.subject_name || '—'}
                  </td>
                  <td style={cell}>{full ?? '—'}</td>
                  <td style={{ ...cell, fontWeight: 700 }}>{got ?? '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* The outcome. */}
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', marginTop: 10, background: INK }}>
        <tbody>
          <tr>
            <td style={{ ...bannerCell, width: '27%' }}>Total Marks:</td>
            <td style={{ ...bannerCell, width: '33%', fontWeight: 700 }}>{anyMarks ? totalObtained : '—'}</td>
            <td style={{ ...bannerCell, width: '16%' }}>Division:</td>
            <td style={{ ...bannerCell, width: '24%', fontWeight: 700 }}>{status || '—'}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
