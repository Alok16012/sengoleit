import { useEffect, useState } from 'react'
import { X, Award, Eye, ChevronUp, Printer } from 'lucide-react'
import Button from './ui/Button'
import { supabase } from '../lib/supabase'
import { fetchResultsForMany } from '../utils/semesterResults'
import { fetchMarksheetFor } from '../utils/paperMarks'
import ResultSheetView from './ResultSheetView'
import { generateStatementOfGrades, sgpaOf } from '../utils/generateStudentCards'
import { formatMonthYear } from '../utils/formatDate'

// A centre's read-only view of its student's released results, semester by
// semester, with the result sheet each one opens.
//
// The sheet is the STUDENT's sheet — the same ResultSheetView the student
// portal renders, from the same portal_marksheet rows, so a centre and the
// student it belongs to are never looking at different numbers. It opens in
// the page; there is no print or download here. Only the Exam Section issues
// the university's Statement of Marks.
//
// printable — also offer the printed Statement of Grades (with its date of
// issue) for a semester the Exam Section has sent to Print. Read-only: it does
// not mark anything printed.
export default function SemesterResultViewModal({ student, onClose, printable = false }) {
  const [rows, setRows] = useState(null)
  const [openSem, setOpenSem] = useState(null)
  const [busySem, setBusySem] = useState(null)
  const [sheets, setSheets] = useState({})
  const [failed, setFailed] = useState({})
  // The list row carries no course_code, and the sheet prints one — read the
  // full student once, the first time a sheet is opened.
  const [full, setFull] = useState(null)
  const [printingSem, setPrintingSem] = useState(null)

  useEffect(() => {
    let alive = true
    fetchResultsForMany([student.id]).then(byKey => {
      if (!alive) return
      setRows(Object.values(byKey || {}).sort((a, b) => a.semester - b.semester))
    })
    return () => { alive = false }
  }, [student.id])

  async function toggleView(r) {
    if (openSem === r.semester) { setOpenSem(null); return }
    setOpenSem(r.semester)
    if (sheets[r.semester] || failed[r.semester]) return
    setBusySem(r.semester)
    const [{ sheet, reason }, whole] = await Promise.all([
      fetchMarksheetFor(student.id, r.semester),
      full ? Promise.resolve(full) : supabase.from('students')
        .select('*, programs(program_name, semester_year), academic_sessions(session_name)')
        .eq('id', student.id).single().then(res => res.data),
    ])
    setBusySem(null)
    if (whole && !full) setFull(whole)
    if (sheet) setSheets(s => ({ ...s, [r.semester]: sheet }))
    else setFailed(f => ({ ...f, [r.semester]: reason }))
  }

  // The same sheet and dates the Print tab uses: the calendar's Marksheet
  // Printing Date, else the day the result went to Print. Each earlier
  // semester's SGPA comes from its own marksheet.
  async function printMarksheet(r) {
    setPrintingSem(r.semester)
    try {
      const sems = Array.from({ length: r.semester }, (_, i) => i + 1)
      const [sheets, whole] = await Promise.all([
        Promise.all(sems.map(n => fetchMarksheetFor(student.id, n))),
        full ? Promise.resolve(full) : supabase.from('students')
          .select('*, programs(program_name, semester_year), academic_sessions(session_name), centers(center_name, center_code), departments(name)')
          .eq('id', student.id).single().then(res => res.data),
      ])
      const last = sheets[sheets.length - 1]
      if (!last?.sheet) return alert(last?.reason || 'The marksheet could not be read.')
      const sheet = last.sheet
      if (whole && !full) setFull(whole)
      const semSgpas = {}
      sheets.forEach((x, i) => { const g = x.sheet ? sgpaOf(x.sheet.papers) : null; if (g != null) semSgpas[i + 1] = g })
      generateStatementOfGrades(whole || student, sheet.papers, {
        dmcNo: r.dmc_no ? String(r.dmc_no) : '',
        semSgpas,
        issueDate: sheet.result_published ? `${sheet.result_published}T12:00:00` : (r.print_forwarded_at || null),
        semester: `Semester ${r.semester}`,
        examHeld: String(sheet.exam_held || '').trim() || formatMonthYear(sheet.exam_start),
        resultStatus: r.status === 'Fail' ? 'Failed' : 'Passed',
        cgpa: sgpaOf(sheet.upto || []),
      })
    } finally { setPrintingSem(null) }
  }

  const pct = (o, t) => (o && t ? `${((Number(o) / Number(t)) * 100).toFixed(1)}%` : '—')
  const anyOpen = openSem != null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className={`bg-white rounded-2xl shadow-2xl w-full max-h-[90vh] overflow-auto transition-all ${anyOpen ? 'max-w-4xl' : 'max-w-lg'}`}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <Award size={17} className="text-[#933d18]" />
            <div>
              <h3 className="font-bold text-gray-900 leading-tight">Results</h3>
              <p className="text-xs text-gray-400">{student.student_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
        </div>

        <div className="p-5">
          {rows == null ? (
            <p className="text-center text-gray-400 py-8 text-sm">Loading…</p>
          ) : !rows.length ? (
            <p className="text-center text-gray-400 py-8 text-sm">No result has been released yet.</p>
          ) : (
            <div className="space-y-2">
              {rows.map(r => {
                const open = openSem === r.semester
                return (
                  <div key={r.semester} className="rounded-xl border border-gray-200 px-4 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-900">Semester {r.semester}</p>
                        <p className="text-[11px] text-gray-500">
                          <span className={r.status === 'Pass' ? 'text-emerald-700 font-bold' : 'text-red-700 font-bold'}>{r.status}</span>
                          {' · '}{r.obtained_marks || '—'}/{r.total_marks || '—'} · {pct(r.obtained_marks, r.total_marks)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button size="sm" variant="secondary" disabled={busySem === r.semester}
                          onClick={() => toggleView(r)}>
                          {open ? <ChevronUp size={13} /> : <Eye size={13} />}
                          {busySem === r.semester ? '…' : open ? 'Hide' : 'View'}
                        </Button>
                        {printable && (r.print_forwarded_at ? (
                          <Button size="sm" variant="primary" disabled={printingSem === r.semester} onClick={() => printMarksheet(r)}>
                            <Printer size={13} /> {printingSem === r.semester ? '…' : 'Marksheet'}
                          </Button>
                        ) : (
                          <span className="text-[10px] text-gray-400" title="The Exam Section has not sent this semester to Print yet">Not printed yet</span>
                        ))}
                      </div>
                    </div>

                    {open && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        {busySem === r.semester ? (
                          <p className="text-sm text-gray-400 py-6 text-center">Loading result…</p>
                        ) : failed[r.semester] ? (
                          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                            {failed[r.semester]}
                          </p>
                        ) : (
                          <ResultSheetView student={full || student} semester={r.semester}
                            sheet={sheets[r.semester]} status={r.status} />
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
