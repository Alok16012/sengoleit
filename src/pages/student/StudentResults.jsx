import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useStudentAuth } from '../../context/StudentAuthContext'
import { GraduationCap, Award } from 'lucide-react'

const EDU_SECTIONS = [
  { key: 'tenth', label: '10th (Matriculation)' },
  { key: 'twelfth', label: '12th (Intermediate)' },
  { key: 'diploma', label: 'Diploma' },
  { key: 'ug', label: 'Graduation (UG)' },
  { key: 'pg', label: 'Post Graduation (PG)' },
]

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

export default function StudentResults() {
  const { student } = useStudentAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!student?.id) return
    supabase.from('students').select('*').eq('id', student.id).single()
      .then(({ data }) => { setData(data); setLoading(false) })
  }, [student?.id])

  if (loading) return <div className="p-8 text-center text-gray-400">Loading...</div>

  const sections = EDU_SECTIONS.filter(s =>
    data?.[`${s.key}_board`] || data?.[`${s.key}_institution`]
  )

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-black text-gray-900">Academic Records</h1>

      {sections.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <GraduationCap size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400">No academic records found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          
          {data?.exam_result_status && data.exam_result_status !== 'Pending' && (
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

          <h2 className="text-lg font-black text-gray-900 mt-8 mb-4">Previous Education</h2>

          {sections.map(({ key, label }) => {
            const percentage = pct(data?.[`${key}_obtained_marks`], data?.[`${key}_total_marks`])
            return (
              <div key={key} className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <GraduationCap size={16} className="text-[#933d18]" />
                    <h3 className="font-bold text-gray-900">{label}</h3>
                  </div>
                  {percentage && (
                    <span className="text-xs font-black px-3 py-1 rounded-lg bg-[#933d18]/10 text-[#933d18]">
                      {percentage}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <Field label="Board / University" value={data?.[`${key}_board`]} />
                  <Field label="Institution" value={data?.[`${key}_institution`]} />
                  <Field label="Year of Passing" value={data?.[`${key}_year_of_passing`]} />
                  <Field label="Roll Number" value={data?.[`${key}_roll_no`]} />
                  <Field label="Obtained Marks" value={data?.[`${key}_obtained_marks`]} />
                  <Field label="Total Marks" value={data?.[`${key}_total_marks`]} />
                  <Field label="Grade" value={data?.[`${key}_grade`]} />
                  <Field label="Division" value={data?.[`${key}_division`]} />
                  {(key === 'ug' || key === 'pg' || key === 'diploma') && (
                    <Field label="Stream / Subject" value={data?.[`${key}_stream`]} />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
