import { useEffect, useState } from 'react'
import { formatDate } from '../../utils/formatDate'
import { useStudentAuth } from '../../context/StudentAuthContext'
import { fetchStudentSelf } from '../../utils/studentSelf'
import { studentSession } from '../../utils/studentSelf'
import { fetchMyResults } from '../../utils/semesterResults'
import { fetchPaperMarks, fetchPaperMarksUpto } from '../../utils/paperMarks'
import { generateMarksStatement, sgpaOf } from '../../utils/generateStudentCards'
import { resolveStudentDocUrls } from '../../utils/resolveStudentDocs'
import { fetchExamDates } from '../../utils/examSettings'
import { GraduationCap, Award, FileText } from 'lucide-react'

function Field({ label, value }) {
  return (
    <div>
      <p className="text-[11px] text-gray-400">{label}</p>
      <p className="text-sm font-semibold text-gray-800 mt-0.5">{value || '—'}</p>
    </div>
  )
}

function pct(obt, tot) {
  const o = parseFloat(obt), t = parseFloat(tot)
  if (!o || !t) return null
  return ((o / t) * 100).toFixed(1) + '%'
}

// Only the university's own exam result lives here. The student's previous
// education used to be listed below it, but that already shows on My Profile —
// and the university asked for it to be dropped from the Results page.
export default function StudentResults() {
  const { student } = useStudentAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const [semResults, setSemResults] = useState([])
  const [printing, setPrinting] = useState(null)

  useEffect(() => {
    if (!student?.id) return
    async function load() {
      const [self, sem] = await Promise.all([
        fetchStudentSelf(),
        fetchMyResults(studentSession()?.token),
      ])
      setData(self)
      setSemResults(sem)
      setLoading(false)
    }
    load()
  }, [student?.id])

  // The student's own Statement of Marks — always the student copy: no DMC
  // number and no signature blocks, which belong to the university's copy.
  async function printStatement(r) {
    if (!data) return
    setPrinting(r.semester)
    const resolved = await resolveStudentDocUrls(data)
    const rows = await fetchPaperMarks(data, r.semester)
    const dates = await fetchExamDates(resolved, r.semester)
    // CGPA spans every semester up to this one, not just this one.
    const cgpa = sgpaOf(await fetchPaperMarksUpto(student, r.semester))
    generateMarksStatement(resolved, rows, {
      semester: `Semester ${r.semester}`,
      examHeld: dates.examSession || '',
      resultStatus: r.status === 'Fail' ? 'Failed' : 'Passed',
      dateOfIssue: dates.resultPublished || '',
      cgpa,
      studentCopy: true,
    })
    setPrinting(null)
  }

  if (loading) return <div className="p-8 text-center text-gray-400">Loading...</div>

  // Results are released per semester by the Exam Section. The older
  // single-result columns are still shown as a fallback for students whose
  // result was recorded before results became semester-wise.
  const released = data?.exam_result_status && data.exam_result_status !== 'Pending' && data.result_released_at

  if (semResults.length) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-xl font-black text-gray-900">Results</h1>
        {semResults.map(r => (
          <div key={r.semester} className="bg-white rounded-xl border-2 border-emerald-100 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Award size={20} className={r.status === 'Pass' ? 'text-emerald-600' : 'text-red-500'} />
                <h3 className="font-black text-gray-900 text-lg">Semester {r.semester}</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-black px-3 py-1 rounded-lg ${r.status === 'Pass' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                  {r.status}
                </span>
                <button onClick={() => printStatement(r)} disabled={printing === r.semester}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#933d18] bg-[#933d18]/8 hover:bg-[#933d18]/15 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                  <FileText size={13} /> {printing === r.semester ? '…' : 'Marks Statement'}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-xl mb-4">
              <Field label="Obtained Marks" value={r.obtained_marks} />
              <Field label="Total Marks" value={r.total_marks} />
              <Field label="Percentage" value={pct(r.obtained_marks, r.total_marks)} />
              <Field label="Declared On" value={formatDate(r.declared_at)} />
            </div>
            {r.remarks && (
              <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-100 italic">"{r.remarks}"</div>
            )}
            {r.marksheet_url && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <a href={r.marksheet_url} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-xl transition-colors">
                  Download Marksheet
                </a>
              </div>
            )}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-black text-gray-900">Results</h1>

      {!released ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <GraduationCap size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400">Your result has not been declared yet.</p>
          <p className="text-gray-300 text-xs mt-1">It will appear here once the Exam Section releases it.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border-2 border-emerald-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Award size={20} className="text-emerald-600" />
              <h3 className="font-black text-gray-900 text-lg">University Exam Result</h3>
            </div>
            <span className={`text-xs font-black px-3 py-1 rounded-lg ${data.exam_result_status === 'Pass' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
              {data.exam_result_status}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-xl mb-4">
            <Field label="Obtained Marks" value={data.exam_result_obtained_marks} />
            <Field label="Total Marks" value={data.exam_result_total_marks} />
            <Field label="Percentage" value={pct(data.exam_result_obtained_marks, data.exam_result_total_marks)} />
            <Field label="Declared On" value={formatDate(data.exam_result_declared_at)} />
          </div>

          {data.exam_result_remarks && (
            <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-100 italic">
              "{data.exam_result_remarks}"
            </div>
          )}

          {data.exam_result_marksheet_url && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <a href={data.exam_result_marksheet_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-xl transition-colors">
                Download Marksheet
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
