import { useEffect, useState } from 'react'
import { X, Award, FileText } from 'lucide-react'
import Button from './ui/Button'
import { supabase } from '../lib/supabase'
import { fetchResultsForMany } from '../utils/semesterResults'
import { fetchPaperMarks, fetchPaperMarksUpto } from '../utils/paperMarks'
import { generateMarksStatement, sgpaOf } from '../utils/generateStudentCards'
import { resolveStudentDocUrls } from '../utils/resolveStudentDocs'
import { fetchExamDates } from '../utils/examSettings'
import { formatDate } from '../utils/formatDate'

// A centre's read-only view of its student's released results, semester by
// semester, with the Statement of Marks each one prints.
//
// Everything here is the STUDENT copy: no DMC number and no signature blocks,
// which belong to the university's own copy. RLS already limits a centre to
// released rows, so an unreleased result never reaches this list.
export default function SemesterResultViewModal({ student, onClose }) {
  const [rows, setRows] = useState(null)
  const [printing, setPrinting] = useState(null)

  useEffect(() => {
    let alive = true
    fetchResultsForMany([student.id]).then(byKey => {
      if (!alive) return
      setRows(Object.values(byKey || {}).sort((a, b) => a.semester - b.semester))
    })
    return () => { alive = false }
  }, [student.id])

  async function printStatement(r) {
    setPrinting(r.semester)
    const { data: full } = await supabase.from('students')
      .select('*, programs(program_name), academic_sessions(session_name), centers(center_name, center_code), departments(name)')
      .eq('id', student.id).single()
    const resolved = full ? await resolveStudentDocUrls(full) : student
    const papers = await fetchPaperMarks(student, r.semester)
    const dates = await fetchExamDates(resolved, r.semester)
    // CGPA spans every semester up to this one, not just this one.
    const cgpa = sgpaOf(await fetchPaperMarksUpto(student, r.semester))
    generateMarksStatement(resolved, papers, {
      semester: `Semester ${r.semester}`,
      examHeld: dates.examSession || '',
      resultStatus: r.status === 'Fail' ? 'Failed' : 'Passed',
      dateOfIssue: dates.resultPublished || '',
      cgpa,
      studentCopy: true,
    })
    setPrinting(null)
  }

  const pct = (o, t) => (o && t ? `${((Number(o) / Number(t)) * 100).toFixed(1)}%` : '—')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white">
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
              {rows.map(r => (
                <div key={r.semester} className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900">Semester {r.semester}</p>
                    <p className="text-[11px] text-gray-500">
                      <span className={r.status === 'Pass' ? 'text-emerald-700 font-bold' : 'text-red-700 font-bold'}>{r.status}</span>
                      {' · '}{r.obtained_marks || '—'}/{r.total_marks || '—'} · {pct(r.obtained_marks, r.total_marks)}
                      {r.released_at ? ` · declared ${formatDate(r.released_at)}` : ''}
                    </p>
                  </div>
                  <Button size="sm" variant="secondary" disabled={printing === r.semester}
                    onClick={() => printStatement(r)}>
                    <FileText size={13} /> {printing === r.semester ? '…' : 'Marks Statement'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
