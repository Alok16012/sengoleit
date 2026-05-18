import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import PageHeader from '../../components/ui/PageHeader'
import { Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui/Table'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import { Ticket, CheckCircle, Clock, Hash } from 'lucide-react'

function StatCard({ label, value, color = 'gray' }) {
  const colors = {
    green: 'bg-emerald-50 border-emerald-100 text-emerald-700',
    amber: 'bg-amber-50 border-amber-100 text-amber-700',
    blue: 'bg-blue-50 border-blue-100 text-blue-700',
    gray: 'bg-gray-50 border-gray-100 text-gray-700',
  }
  return (
    <div className={`rounded-2xl border p-5 ${colors[color]}`}>
      <p className="text-xs font-bold uppercase tracking-widest opacity-60 mb-1">{label}</p>
      <p className="text-2xl font-black">{value}</p>
    </div>
  )
}

const STATUS_FILTERS = ['All', 'Unused', 'Used']

export default function CouponManagement() {
  const [coupons, setCoupons] = useState([])
  const [centers, setCenters] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('All')
  const [centerFilter, setCenterFilter] = useState('')

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      const [cpns, ctrs] = await Promise.all([
        supabase
          .from('coupons')
          .select('*, centers(center_name, center_code, center_type)')
          .order('created_at', { ascending: false }),
        supabase
          .from('centers')
          .select('id, center_name, center_code, center_type')
          .order('center_name'),
      ])
      setCoupons(cpns.data || [])
      setCenters(ctrs.data || [])
      setLoading(false)
    }
    fetchData()
  }, [])

  const filtered = coupons.filter(c => {
    const isUsed = !!(c.is_used || c.used_at)
    if (statusFilter === 'Used' && !isUsed) return false
    if (statusFilter === 'Unused' && isUsed) return false
    if (centerFilter && c.center_id !== centerFilter) return false
    return true
  })

  const totalUsed = coupons.filter(c => !!(c.is_used || c.used_at)).length
  const totalUnused = coupons.length - totalUsed

  return (
    <div className="p-6">
      <PageHeader title="Coupon Management" subtitle="View and manage all admission & wallet coupons" />

      <div className="grid grid-cols-3 gap-4 mt-4 mb-6">
        <StatCard label="Total Coupons" value={coupons.length} color="blue" />
        <StatCard label="Used" value={totalUsed} color="gray" />
        <StatCard label="Unused / Available" value={totalUnused} color="green" />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {STATUS_FILTERS.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                statusFilter === s ? 'bg-white text-[#933d18] shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {s}
            </button>
          ))}
        </div>
        <select
          value={centerFilter}
          onChange={e => setCenterFilter(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-[#933d18]/50 bg-white"
        >
          <option value="">All Centers</option>
          {centers.map(c => (
            <option key={c.id} value={c.id}>{c.center_name}{c.center_code ? ` (${c.center_code})` : ''}</option>
          ))}
        </select>
        <span className="text-xs text-gray-400 ml-auto">{filtered.length} coupons</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Loading...</div>
      ) : (
        <Table>
          <Thead>
            <tr>
              <Th>#</Th>
              <Th>Coupon ID</Th>
              <Th>Center</Th>
              <Th>Type</Th>
              <Th>Face Value</Th>
              <Th>Application ID</Th>
              <Th>Generated On</Th>
              <Th>Used On</Th>
              <Th>Status</Th>
            </tr>
          </Thead>
          <Tbody>
            {filtered.length === 0 ? (
              <Tr><Td colSpan={9} className="text-center text-gray-400 py-12">No coupons found</Td></Tr>
            ) : filtered.map((c, i) => {
              const isUsed = !!(c.is_used || c.used_at)
              return (
                <Tr key={c.id}>
                  <Td className="text-gray-400 text-xs w-10">{i + 1}</Td>
                  <Td className="font-mono text-xs text-gray-700">{c.id?.slice(0, 8).toUpperCase() || '—'}</Td>
                  <Td>
                    <p className="font-semibold text-gray-900">{c.centers?.center_name || '—'}</p>
                    {c.centers?.center_code && <p className="text-xs text-gray-400">{c.centers.center_code}</p>}
                  </Td>
                  <Td>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      c.centers?.center_type === 'super_center' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'
                    }`}>
                      {c.centers?.center_type === 'super_center' ? 'Super Center' : 'Center'}
                    </span>
                  </Td>
                  <Td className="font-bold text-gray-900">₹{Number(c.face_value || 0).toLocaleString('en-IN')}</Td>
                  <Td className="font-mono text-xs text-gray-400">{c.application_id?.slice(0, 8) || '—'}</Td>
                  <Td className="text-gray-400 text-xs">{c.created_at ? new Date(c.created_at).toLocaleDateString('en-IN') : '—'}</Td>
                  <Td className="text-gray-400 text-xs">{c.used_at ? new Date(c.used_at).toLocaleDateString('en-IN') : '—'}</Td>
                  <Td>
                    {isUsed ? (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Used</span>
                    ) : (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Available</span>
                    )}
                  </Td>
                </Tr>
              )
            })}
          </Tbody>
        </Table>
      )}
    </div>
  )
}
