import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useStudentAuth } from '../../context/StudentAuthContext'
import { GraduationCap } from 'lucide-react'

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
