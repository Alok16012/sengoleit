import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { Users, FileText, CheckCircle, Clock } from 'lucide-react'

function StatCard({ label, value, icon: Icon, color }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        <Icon size={24} className="text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value ?? '—'}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  )
}

export default function CenterDashboard() {
  const { user } = useAuth()
  const [center, setCenter] = useState(null)
  const [stats, setStats] = useState({})

  useEffect(() => {
    if (!user) return
    supabase.from('centers').select('*').eq('email', user.email).single()
      .then(({ data }) => {
        setCenter(data)
        if (data) {
          Promise.all([
            supabase.from('students').select('id', { count: 'exact', head: true }).eq('center_id', data.id),
            supabase.from('students').select('id', { count: 'exact', head: true }).eq('center_id', data.id).eq('status', 'Active'),
            supabase.from('students').select('id', { count: 'exact', head: true }).eq('center_id', data.id).eq('status', 'Pending'),
          ]).then(([total, active, pending]) => {
            setStats({ total: total.count, active: active.count, pending: pending.count })
          })
        }
      })
  }, [user])

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Center Dashboard</h1>
        {center && (
          <div className="mt-2 flex items-center gap-4">
            <p className="text-gray-500">{center.center_name}</p>
            {center.center_code && <span className="bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5 rounded">Code: {center.center_code}</span>}
            <span className={`text-xs font-medium px-2 py-0.5 rounded ${center.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
              {center.status || 'Pending'}
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <StatCard label="Total Students" value={stats.total} icon={Users} color="bg-blue-500" />
        <StatCard label="Active Students" value={stats.active} icon={CheckCircle} color="bg-green-500" />
        <StatCard label="Pending Students" value={stats.pending} icon={Clock} color="bg-yellow-500" />
      </div>

      {center && (
        <div className="mt-8 bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="font-semibold text-gray-800 mb-4">Center Details</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><p className="text-gray-500">Center Name</p><p className="font-medium">{center.center_name}</p></div>
            <div><p className="text-gray-500">Center Code</p><p className="font-medium">{center.center_code || '—'}</p></div>
            <div><p className="text-gray-500">Email</p><p className="font-medium">{center.email}</p></div>
            <div><p className="text-gray-500">Phone</p><p className="font-medium">{center.phone || '—'}</p></div>
            <div><p className="text-gray-500">KYC Status</p><p className={`font-medium ${center.kyc_status === 'Verified' ? 'text-green-600' : 'text-yellow-600'}`}>{center.kyc_status || 'Pending'}</p></div>
            <div><p className="text-gray-500">Revenue Share</p><p className="font-medium">{center.revenue_share_percentage || 50}%</p></div>
          </div>
        </div>
      )}
    </div>
  )
}
