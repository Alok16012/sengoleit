import { useEffect, useState } from 'react'
import { useStudentAuth } from '../../context/StudentAuthContext'
import { fetchStudentSelf } from '../../utils/studentSelf'
import { GraduationCap, Award } from 'lucide-react'

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

  useEffect(() => {
    if (!student?.id) return
    fetchStudentSelf()
      .then((data) => { setData(data); setLoading(false) })
  }, [student?.id])

  if (loading) return <div className="p-8 text-center text-gray-400">Loading...</div>

  // Shown only after the Exam Section presses "Send Result".
  const released = data?.exam_result_status && data.exam_result_status !== 'Pending' && data.result_released_at

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
            <Field label="Declared On" value={data.exam_result_declared_at ? new Date(data.exam_result_declared_at).toLocaleDateString() : '—'} />
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
