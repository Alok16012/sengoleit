import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { Users, Building2, Wallet, Clock, PlusCircle, UserPlus } from 'lucide-react'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'

function StatCard({ label, value, icon: Icon, color, sub }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color} flex-shrink-0`}>
        <Icon size={22} className="text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value ?? '—'}</p>
        <p className="text-sm text-gray-500">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

export default function SuperCenterDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [center, setCenter] = useState(null)
  const [stats, setStats] = useState({})

  useEffect(() => {
    if (!user) return
    supabase.from('centers').select('*').eq('email', user.email).eq('center_type', 'super_center').single()
      .then(({ data }) => {
        setCenter(data)
        if (data) {
          Promise.all([
            supabase.from('centers').select('id', { count: 'exact', head: true }).eq('super_center_id', data.id),
            supabase.from('students').select('id', { count: 'exact', head: true }).eq('center_id', data.id),
            supabase.from('recharge_requests').select('id', { count: 'exact', head: true }).eq('center_id', data.id).eq('status', 'pending'),
          ]).then(([ctrs, studs, pending]) => {
            setStats({ centers: ctrs.count, students: studs.count, pendingRecharges: pending.count })
          })
        }
      })
  }, [user])

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Super Center Dashboard</h1>
            {center && (
              <div className="flex items-center gap-3 mt-1.5">
                <p className="text-gray-500 text-sm">{center.center_name}</p>
                {center.center_code && (
                  <span className="bg-[#933d18]/10 text-[#933d18] text-xs font-bold px-2 py-0.5 rounded-lg">{center.center_code}</span>
                )}
                <Badge status={center.approval_status}>{center.approval_status || 'Pending'}</Badge>
              </div>
            )}
          </div>
          {center?.approval_status === 'approved' && (
            <div className="flex gap-2">
              <Button size="sm" onClick={() => navigate('/super-center/centers/new')}>
                <Building2 size={14} /> New Center
              </Button>
              <Button size="sm" variant="outline" onClick={() => navigate('/super-center/students/new')}>
                <UserPlus size={14} /> Add Student
              </Button>
            </div>
          )}
        </div>
      </div>

      {center?.approval_status === 'pending' && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-6">
          <p className="font-semibold text-amber-800">Application Under Review</p>
          <p className="text-sm text-amber-600 mt-1">Your super center application is pending approval from the Account Department. You'll be able to create centers and register students once approved.</p>
        </div>
      )}

      {center?.approval_status === 'rejected' && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 mb-6">
          <p className="font-semibold text-red-800">Application Rejected</p>
          {center.approval_notes && <p className="text-sm text-red-600 mt-1">Reason: {center.approval_notes}</p>}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Virtual Balance" value={`₹${Number(center?.virtual_balance || 0).toLocaleString()}`} icon={Wallet} color="bg-[#933d18]" />
        <StatCard label="Centers Created" value={stats.centers ?? 0} icon={Building2} color="bg-indigo-500" />
        <StatCard label="Total Students" value={stats.students ?? 0} icon={Users} color="bg-blue-500" />
        <StatCard label="Pending Recharges" value={stats.pendingRecharges ?? 0} icon={Clock} color="bg-amber-500" sub="Awaiting verification" />
      </div>

      {center && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-bold text-gray-800 mb-4">Super Center Details</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-5 text-sm">
            <div><p className="text-xs text-gray-400 mb-0.5">Center Name</p><p className="font-semibold">{center.center_name}</p></div>
            <div><p className="text-xs text-gray-400 mb-0.5">Center Code</p><p className="font-semibold">{center.center_code || '—'}</p></div>
            <div><p className="text-xs text-gray-400 mb-0.5">Email</p><p className="font-semibold">{center.email || '—'}</p></div>
            <div><p className="text-xs text-gray-400 mb-0.5">Phone</p><p className="font-semibold">{center.phone || '—'}</p></div>
            <div><p className="text-xs text-gray-400 mb-0.5">KYC Status</p><Badge status={center.kyc_status?.toLowerCase()}>{center.kyc_status || 'Pending'}</Badge></div>
            <div><p className="text-xs text-gray-400 mb-0.5">Status</p><Badge status={center.status?.toLowerCase()}>{center.status || 'Inactive'}</Badge></div>
          </div>
        </div>
      )}
    </div>
  )
}
