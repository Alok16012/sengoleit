import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { BookOpen, Building2, Calendar, Award } from 'lucide-react'

export default function StudentDashboard() {
  const { user } = useAuth()
  const [student, setStudent] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    supabase.from('students')
      .select('*, programs(program_name, duration, fees_per_year), centers(center_name), academic_sessions(session_name)')
      .eq('email', user.email)
      .maybeSingle()
      .then(({ data }) => { setStudent(data); setLoading(false) })
  }, [user])

  if (loading) return <div className="p-8 text-center text-gray-400">Loading...</div>

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Student Dashboard</h1>
        {student && <p className="text-gray-500 mt-1">Welcome, {student.student_name}</p>}
      </div>

      {student ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <BookOpen size={20} className="text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Program</p>
                <p className="text-sm font-semibold text-gray-900">{student.programs?.program_name || '—'}</p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <Building2 size={20} className="text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Center</p>
                <p className="text-sm font-semibold text-gray-900">{student.centers?.center_name || '—'}</p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <Calendar size={20} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Session</p>
                <p className="text-sm font-semibold text-gray-900">{student.academic_sessions?.session_name || '—'}</p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                <Award size={20} className="text-orange-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Status</p>
                <p className="text-sm font-semibold text-gray-900">{student.status || 'Pending'}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-800 mb-4">Personal Details</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div><p className="text-gray-400">Enrollment No</p><p className="font-medium mt-0.5">{student.enrollment_no || '—'}</p></div>
              <div><p className="text-gray-400">Registration No</p><p className="font-medium mt-0.5">{student.registration_no || '—'}</p></div>
              <div><p className="text-gray-400">Mobile</p><p className="font-medium mt-0.5">{student.mobile_no || '—'}</p></div>
              <div><p className="text-gray-400">Date of Birth</p><p className="font-medium mt-0.5">{student.date_of_birth || '—'}</p></div>
              <div><p className="text-gray-400">Gender</p><p className="font-medium mt-0.5">{student.gender || '—'}</p></div>
              <div><p className="text-gray-400">Blood Group</p><p className="font-medium mt-0.5">{student.blood_group || '—'}</p></div>
              <div><p className="text-gray-400">Father's Name</p><p className="font-medium mt-0.5">{student.fathers_name || '—'}</p></div>
              <div><p className="text-gray-400">Mother's Name</p><p className="font-medium mt-0.5">{student.mothers_name || '—'}</p></div>
              <div><p className="text-gray-400">Email</p><p className="font-medium mt-0.5">{student.email || '—'}</p></div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          No student record found for this account.
        </div>
      )}
    </div>
  )
}
