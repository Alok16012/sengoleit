import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { Users, CheckCircle, Clock, Wallet, UserPlus, Truck, FileCheck, UserCheck, Lock, RefreshCw, GraduationCap } from 'lucide-react'

const QUICK_ACTIONS = [
  { label: 'Student Entry', icon: UserPlus, color: 'bg-emerald-500', hover: 'hover:bg-emerald-600', to: '/center/students/new' },
  { label: 'Re-Registration', icon: RefreshCw, color: 'bg-blue-600', hover: 'hover:bg-blue-700', to: '/center/re-registration' },
  // The centre's exam work — admit cards and results — lives on the approved
  // list, so that is where this goes rather than a screen of its own.
  { label: 'Exam', icon: GraduationCap, color: 'bg-rose-500', hover: 'hover:bg-rose-600', to: '/center/reports/approved' },
  { label: 'Payment Deposit Entry', icon: Wallet, color: 'bg-[#933d18]', hover: 'hover:bg-[#7a3213]', to: '/center/balance' },
  { label: 'Courier Entry', icon: Truck, color: 'bg-teal-600', hover: 'hover:bg-teal-700', to: '/center/courier' },
  { label: 'Student Answersheet', icon: FileCheck, color: 'bg-amber-500', hover: 'hover:bg-amber-600', to: '/center/answersheet' },
  { label: 'Supplementary Student', icon: UserCheck, color: 'bg-indigo-500', hover: 'hover:bg-indigo-600', to: '/center/supplementary' },
]

function StatCard({ label, value, sub, icon: Icon, color }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color} flex-shrink-0`}>
        <Icon size={22} className="text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-gray-900">{value ?? '—'}</p>
        <p className="text-sm text-gray-500">{label}</p>
        {sub && <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">{sub}</p>}
      </div>
    </div>
  )
}

const rupees = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`

function holdBreakdown({ holdAmount, holdCount, reRegAmount, reRegCount }) {
  if (holdAmount == null) return null
  const parts = []
  if (holdCount) parts.push(`${rupees(holdAmount)} for ${holdCount} student${holdCount > 1 ? 's' : ''}`)
  if (reRegCount) parts.push(`${rupees(reRegAmount)} for ${reRegCount} re-registration${reRegCount > 1 ? 's' : ''}`)
  if (!parts.length) return 'no fee is locked right now'
  return `${parts.join(' · ')} — already deducted from your wallet`
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
            supabase.from('students').select('id', { count: 'exact', head: true }).eq('center_id', data.id).eq('status', 'Approved'),
            supabase.from('students').select('id', { count: 'exact', head: true }).eq('center_id', data.id).eq('status', 'Pending'),
            // Money currently locked in the wallet for forwarded students that
            // haven't been approved/rejected yet. Exclude Approved/Rejected so a
            // stale fee_held left on a decided student never inflates the total.
            supabase.from('students').select('fee_held').eq('center_id', data.id).not('fee_held', 'is', null).not('status', 'in', '("Approved","Rejected")'),
            // Re-Registration holds live in their own table: the fee leaves the
            // wallet when the centre raises the request and stays out until the
            // university verifies or rejects it. Counting only students left the
            // centre looking at a wallet that had visibly shrunk with nothing on
            // the page accounting for the difference.
            supabase.from('re_registrations').select('fee_amount')
              .eq('center_id', data.id).eq('status', 'Pending').not('held_at', 'is', null),
          ]).then(([total, admitted, pending, held, reReg]) => {
            // A TOTAL across students, not a per-student figure — the card says
            // so, because two students holding Rs 2,000 each reads exactly like
            // one student holding Rs 4,000 otherwise.
            const holdRows = held.data || []
            const holdAmount = holdRows.reduce((sum, r) => sum + Number(r.fee_held || 0), 0)
            // held_at arrives with add_re_registration_hold.sql. Without it
            // nothing is held at request time either, so an error here is
            // correctly read as "no re-registration money is locked".
            const reRegRows = reReg.error ? [] : (reReg.data || [])
            const reRegAmount = reRegRows.reduce((sum, r) => sum + Number(r.fee_amount || 0), 0)
            setStats({
              total: total.count, admitted: admitted.count, pending: pending.count,
              holdAmount, holdCount: holdRows.length,
              reRegAmount, reRegCount: reRegRows.length,
            })
          })
        }
      })
  }, [user])

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
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
        {center && (
          <div className="flex items-center gap-3 bg-[#933d18] text-white rounded-2xl px-5 py-3 shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
              <Wallet size={20} className="text-white" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70">Wallet Balance</p>
              <p className="text-xl font-bold leading-tight">₹{Number(center.virtual_balance || 0).toLocaleString('en-IN')}</p>
            </div>
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Students" value={stats.total} icon={Users} color="bg-[#933d18]" />
        <StatCard label="Admitted Students" value={stats.admitted} icon={CheckCircle} color="bg-emerald-500" />
        <StatCard label="Pending Students" value={stats.pending} icon={Clock} color="bg-amber-500" />
        <StatCard
          label="Hold Amount"
          value={stats.holdAmount != null
            ? `₹${(Number(stats.holdAmount) + Number(stats.reRegAmount || 0)).toLocaleString('en-IN')}`
            : '—'}
          // The split, not one merged total: a centre chasing a shrunken wallet
          // needs to see WHICH pending work is holding the money.
          sub={holdBreakdown(stats)}
          icon={Lock}
          color="bg-blue-500"
        />
      </div>

    </div>
  )
}
