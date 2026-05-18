import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import PageHeader from '../../components/ui/PageHeader'
import { Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui/Table'
import { Ticket, CheckCircle2, Clock } from 'lucide-react'

export default function CouponView({ type = 'wallet' }) {
  const { user } = useAuth()
  const [center, setCenter] = useState(null)
  const [coupons, setCoupons] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('All')

  useEffect(() => {
    if (!user?.email) return
    supabase.from('centers').select('id, center_name, center_code, virtual_balance').eq('email', user.email).maybeSingle()
      .then(({ data, error: err }) => {
        if (err || !data) { setError('Center not found. Contact admin.'); setLoading(false); return }
        setCenter(data)
        supabase.from('coupons').select('*').eq('center_id', data.id).order('created_at', { ascending: false })
          .then(({ data: cpns }) => { setCoupons(cpns || []); setLoading(false) })
      })
  }, [user?.email])

  const filtered = coupons.filter(c => {
    const isUsed = !!(c.is_used || c.used_at)
    if (filter === 'Used') return isUsed
    if (filter === 'Unused') return !isUsed
    return true
  })

  const total = coupons.length
  const used = coupons.filter(c => !!(c.is_used || c.used_at)).length
  const unused = total - used

  const isWallet = type === 'wallet'
  const title = isWallet ? 'Wallet Coupons' : 'Admission Coupons'
  const subtitle = isWallet
    ? 'Coupons allocated to your center for wallet recharge'
    : 'Admission coupons allocated to your center'

  if (loading) return (
    <div className="p-6 flex items-center justify-center py-20">
      <div className="w-6 h-6 border-2 border-[#933d18] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (error) return (
    <div className="p-6">
      <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">{error}</div>
    </div>
  )

  return (
    <div className="p-6">
      <PageHeader title={title} subtitle={subtitle} />

      {center && (
        <div className="mt-4 mb-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-blue-500 mb-1">Total Coupons</p>
            <p className="text-2xl font-black text-blue-700">{total}</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-500 mb-1">Available</p>
            <p className="text-2xl font-black text-emerald-700">{unused}</p>
          </div>
          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Used</p>
            <p className="text-2xl font-black text-gray-600">{used}</p>
          </div>
          <div className="bg-[#933d18]/5 border border-[#933d18]/10 rounded-2xl p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-[#933d18]/60 mb-1">Wallet Balance</p>
            <p className="text-2xl font-black text-[#933d18]">₹{Number(center.virtual_balance || 0).toLocaleString('en-IN')}</p>
          </div>
        </div>
      )}

      <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-xl w-fit">
        {['All', 'Unused', 'Used'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              filter === s ? 'bg-white text-[#933d18] shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {s}
          </button>
        ))}
      </div>

      <Table>
        <Thead>
          <tr>
            <Th>#</Th>
            <Th>Coupon ID</Th>
            <Th>Face Value</Th>
            <Th>Generated On</Th>
            <Th>Used On</Th>
            <Th>Status</Th>
          </tr>
        </Thead>
        <Tbody>
          {filtered.length === 0 ? (
            <Tr>
              <Td colSpan={6} className="text-center text-gray-400 py-16">
                <Ticket size={28} className="mx-auto mb-2 opacity-30" />
                <p>No coupons found</p>
              </Td>
            </Tr>
          ) : filtered.map((c, i) => {
            const isUsed = !!(c.is_used || c.used_at)
            return (
              <Tr key={c.id}>
                <Td className="text-gray-400 text-xs w-10">{i + 1}</Td>
                <Td className="font-mono text-xs font-bold text-gray-800">{c.id?.slice(0, 8).toUpperCase() || '—'}</Td>
                <Td className="font-bold text-gray-900">₹{Number(c.face_value || 0).toLocaleString('en-IN')}</Td>
                <Td className="text-gray-400 text-xs">{c.created_at ? new Date(c.created_at).toLocaleDateString('en-IN') : '—'}</Td>
                <Td className="text-gray-400 text-xs">{c.used_at ? new Date(c.used_at).toLocaleDateString('en-IN') : '—'}</Td>
                <Td>
                  {isUsed ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                      <CheckCircle2 size={10} /> Used
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                      <Clock size={10} /> Available
                    </span>
                  )}
                </Td>
              </Tr>
            )
          })}
        </Tbody>
      </Table>
    </div>
  )
}
