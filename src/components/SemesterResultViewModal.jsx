import { useEffect, useState } from 'react'
import { X, Award, Eye, ChevronUp } from 'lucide-react'
import Button from './ui/Button'
import { supabase } from '../lib/supabase'
import { fetchResultsForMany } from '../utils/semesterResults'
import { fetchMarksheetFor } from '../utils/paperMarks'
import ResultSheetView from './ResultSheetView'
import { formatDate } from '../utils/formatDate'

// A centre's read-only view of its student's released results, semester by
// semester, with the result sheet each one opens.
//
// The sheet is the STUDENT's sheet — the same ResultSheetView the student
// portal renders, from the same portal_marksheet rows, so a centre and the
// student it belongs to are never looking at different numbers. It opens in
// the page; there is no print or download here. Only the Exam Section issues
// the university's Statement of Marks.
export default function SemesterResultViewModal({ student, onClose }) {
  const [rows, setRows] = useState(null)
  const [openSem, setOpenSem] = useState(null)
  const [busySem, setBusySem] = useState(null)
  const [sheets, setSheets] = useState({})
  const [failed, setFailed] = useState({})
  // The list row carries no course_code, and the sheet prints one — read the
  // full student once, the first time a sheet is opened.
  const [full, setFull] = useState(null)

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

  const pct = (o, t) => (o && t ? `${((Number(o) / Number(t)) * 100).toFixed(1)}%` : '—')
  const anyOpen = openSem != null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className={`bg-white rounded-2xl shadow-2xl w-full max-h-[90vh] overflow-auto transition-all ${anyOpen ? 'max-w-2xl' : 'max-w-lg'}`}
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
                          {r.released_at ? ` · declared ${formatDate(r.released_at)}` : ''}
                        </p>
                      </div>
                      <Button size="sm" variant="secondary" disabled={busySem === r.semester}
                        onClick={() => toggleView(r)}>
                        {open ? <ChevronUp size={13} /> : <Eye size={13} />}
                        {busySem === r.semester ? '…' : open ? 'Hide' : 'View'}
                      </Button>
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
                            papers={sheets[r.semester]?.papers || []} status={r.status} />
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
