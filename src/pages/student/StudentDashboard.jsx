import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useStudentAuth } from '../../context/StudentAuthContext'
import { fetchStudentSelf } from '../../utils/studentSelf'
import { BookOpen, Calendar, Award, Hash, User } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import { isPhdProgram } from '../../utils/generateStudentCards'

export default function StudentDashboard() {
  const { student } = useStudentAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!student?.id) return
    fetchStudentSelf()
      .then((data) => { setData(data); setLoading(false) })
  }, [student?.id])

  if (loading) return <div className="p-8 text-center text-gray-400">Loading...</div>

  // Ph.D candidates have no registration number — the application number is
  // their identifier until enrollment.
  const isPhd = isPhdProgram(data?.programs?.program_name)

  const cards = [
    { icon: BookOpen, bg: 'bg-blue-100', text: 'text-blue-600', label: 'Program', value: data?.programs?.program_name || '—' },
    { icon: Calendar, bg: 'bg-emerald-100', text: 'text-emerald-600', label: 'Session', value: data?.academic_sessions?.session_name || '—' },
    { icon: Award, bg: 'bg-orange-100', text: 'text-orange-600', label: 'Status', value: data?.status || 'Pending', isBadge: true },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Welcome banner */}
      <div className="bg-gradient-to-r from-[#933d18] to-[#ab4e2a] rounded-2xl p-6 text-white flex items-center justify-between">
        <div>
          <p className="text-orange-200 text-sm font-medium mb-1">Welcome back</p>
          <h1 className="text-2xl font-black">{data?.student_name || student.student_name}</h1>
          <p className="text-orange-100/70 text-sm mt-1 font-mono">{data?.enrollment_no || student.enrollment_no}</p>
        </div>
        <div className="h-16 w-16 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0">
          <User size={32} className="text-white/80" />
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(({ icon: Icon, bg, text, label, value, isBadge }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${bg}`}>
              <Icon size={20} className={text} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500">{label}</p>
              {isBadge
                ? <div className="mt-0.5"><Badge status={value?.toLowerCase()}>{value}</Badge></div>
                : <p className="text-sm font-semibold text-gray-900 truncate mt-0.5">{value}</p>
              }
            </div>
          </div>
        ))}
      </div>

      {/* Detail panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-sm">
            <Hash size={15} className="text-[#933d18]" /> Enrollment Details
          </h2>
          <dl className="space-y-3 text-sm">
            {[
              ['Enrollment No', data?.enrollment_no],
              [isPhd ? 'Application No' : 'Registration No', isPhd ? data?.admission_number : data?.registration_no],
              ['Date of Admission', data?.date_of_admission],
              ['Entry Type', data?.entry_type],
            ].map(([label, val]) => (
              <div key={label} className="flex justify-between gap-2">
                <dt className="text-gray-400 shrink-0">{label}</dt>
                <dd className="font-semibold font-mono text-right text-gray-800">{val || '—'}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-sm">
            <BookOpen size={15} className="text-[#933d18]" /> Program Details
          </h2>
          <dl className="space-y-3 text-sm">
            {[
              ['Program', data?.programs?.program_name],
              ['Short Name', data?.programs?.short_name],
              ['Department', data?.departments?.name],
              // duration is stored in semesters — for a Year-mode course show
              // years (a 3-year Ph.D is duration 6, not "6 Year").
              ['Duration', data?.programs?.complete_duration
                || (data?.programs?.duration
                  ? (data.programs.semester_year === 'Year'
                    ? `${Math.max(Math.round(data.programs.duration / 2), 1)} Years`
                    : `${data.programs.duration} Semesters`)
                  : null)],
              ['Session', data?.academic_sessions?.session_name],
            ].map(([label, val]) => (
              <div key={label} className="flex justify-between gap-2">
                <dt className="text-gray-400 shrink-0">{label}</dt>
                <dd className="font-semibold text-right text-gray-800">{val || '—'}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  )
}
