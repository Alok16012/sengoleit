import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { Users, CheckCircle, Clock, Wallet, UserPlus, FileText, Truck, FileCheck, UserCheck, MessageCircle } from 'lucide-react'

const QUICK_ACTIONS = [
  { label: 'Student Entry', icon: UserPlus, color: 'bg-emerald-500', hover: 'hover:bg-emerald-600', to: '/center/students/new' },
  { label: 'Payment Deposit Entry', icon: Wallet, color: 'bg-[#933d18]', hover: 'hover:bg-[#7a3213]', to: '/center/balance' },
  { label: 'Student Documents', icon: FileText, color: 'bg-red-500', hover: 'hover:bg-red-600', to: '/center/documents' },
  { label: 'Courier Entry', icon: Truck, color: 'bg-teal-600', hover: 'hover:bg-teal-700', to: '/center/courier' },
  { label: 'Student Answersheet', icon: FileCheck, color: 'bg-amber-500', hover: 'hover:bg-amber-600', to: '/center/answersheet' },
  { label: 'Supplementary Student', icon: UserCheck, color: 'bg-indigo-500', hover: 'hover:bg-indigo-600', to: '/center/supplementary' },
]

function StatCard({ label, value, icon: Icon, color }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color} flex-shrink-0`}>
        <Icon size={22} className="text-white" />
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
  const navigate = useNavigate()
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
            supabase.from('students').select('id', { count: 'exact', head: true }).eq('center_id', data.id).eq('status', 'Admitted'),
            supabase.from('students').select('id', { count: 'exact', head: true }).eq('center_id', data.id).eq('status', 'Pending'),
          ]).then(([total, admitted, pending]) => {
            setStats({ total: total.count, admitted: admitted.count, pending: pending.count })
          })
        }
      })
  }, [user])

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Center Dashboard</h1>
        {center && (
          <div className="flex items-center gap-3 mt-1.5">
            <p className="text-gray-500 text-sm">{center.center_name}</p>
            {center.center_code && (
              <span className="bg-[#933d18]/10 text-[#933d18] text-xs font-bold px-2 py-0.5 rounded-lg">{center.center_code}</span>
            )}
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg ${center.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
              {center.status || 'Pending'}
            </span>
          </div>
        )}
      </div>

      {/* Quick Action Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-4 mb-8">
        {QUICK_ACTIONS.map(({ label, icon: Icon, color, hover, to }) => (
          <button
            key={to}
            onClick={() => navigate(to)}
            className={`${color} ${hover} text-white rounded-2xl p-5 flex items-center justify-between shadow-sm transition-all active:scale-[0.98] text-left`}
          >
            <span className="text-sm font-bold leading-snug max-w-[120px]">{label}</span>
            <Icon size={32} className="text-white/70 flex-shrink-0" />
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Students" value={stats.total} icon={Users} color="bg-[#933d18]" />
        <StatCard label="Admitted Students" value={stats.admitted} icon={CheckCircle} color="bg-emerald-500" />
        <StatCard label="Pending Students" value={stats.pending} icon={Clock} color="bg-amber-500" />
      </div>

      {/* Center Details */}
      {center && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-bold text-gray-800 mb-4">Center Details</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-5 text-sm">
            <div><p className="text-xs text-gray-400 mb-0.5">Center Name</p><p className="font-semibold">{center.center_name}</p></div>
            <div><p className="text-xs text-gray-400 mb-0.5">Center Code</p><p className="font-semibold">{center.center_code || '—'}</p></div>
            <div><p className="text-xs text-gray-400 mb-0.5">Email</p><p className="font-semibold">{center.email || '—'}</p></div>
            <div><p className="text-xs text-gray-400 mb-0.5">Phone</p><p className="font-semibold">{center.phone || '—'}</p></div>
            <div><p className="text-xs text-gray-400 mb-0.5">KYC Status</p><p className={`font-semibold ${center.kyc_status === 'Verified' ? 'text-emerald-600' : 'text-amber-600'}`}>{center.kyc_status || 'Pending'}</p></div>
            <div><p className="text-xs text-gray-400 mb-0.5">Revenue Share</p><p className="font-semibold">{center.revenue_share_percentage || 50}%</p></div>
          </div>
        </div>
      )}
    </div>
  )
}
