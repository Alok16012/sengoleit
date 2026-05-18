import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import PageHeader from '../../components/ui/PageHeader'
import { Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui/Table'
import Badge from '../../components/ui/Badge'
import { Wallet, TrendingUp, Clock, Building2 } from 'lucide-react'

function StatCard({ label, value, sub, color = 'gray' }) {
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
      {sub && <p className="text-xs opacity-70 mt-1">{sub}</p>}
    </div>
  )
}

const TABS = [
  { key: 'balances', label: 'Center Balances' },
  { key: 'recharges', label: 'Recharge History' },
]

export default function WalletSummary() {
  const [tab, setTab] = useState('balances')
  const [centers, setCenters] = useState([])
  const [recharges, setRecharges] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      const [ctr, rch] = await Promise.all([
        supabase
          .from('centers')
          .select('id, center_name, center_code, center_type, virtual_balance, email, approval_status')
          .order('virtual_balance', { ascending: false }),
        supabase
          .from('recharge_requests')
          .select('*, centers(center_name, center_code, center_type)')
          .order('created_at', { ascending: false }),
      ])
      setCenters(ctr.data || [])
      setRecharges(rch.data || [])
      setLoading(false)
    }
    fetchData()
  }, [])

  const totalBalance = centers.reduce((s, c) => s + Number(c.virtual_balance || 0), 0)
  const pendingRecharges = recharges.filter(r => r.status === 'pending')
  const totalPendingAmount = pendingRecharges.reduce((s, r) => s + Number(r.amount || 0), 0)
  const totalVerified = recharges.filter(r => r.status === 'verified').reduce((s, r) => s + Number(r.amount || 0), 0)

  return (
    <div className="p-6">
      <PageHeader title="Wallet Summary" subtitle="Center virtual balances and recharge history" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4 mb-6">
        <StatCard label="Total Centers" value={centers.length} color="blue" />
        <StatCard label="Total Wallet Balance" value={`₹${totalBalance.toLocaleString('en-IN')}`} color="green" sub="across all centers" />
        <StatCard label="Pending Recharges" value={pendingRecharges.length} sub={`₹${totalPendingAmount.toLocaleString('en-IN')} awaiting`} color="amber" />
        <StatCard label="Total Verified" value={`₹${totalVerified.toLocaleString('en-IN')}`} color="gray" sub="all time" />
      </div>

      <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === t.key ? 'bg-white text-[#933d18] shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
            {t.key === 'recharges' && pendingRecharges.length > 0 && (
              <span className="ml-2 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{pendingRecharges.length}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Loading...</div>
      ) : tab === 'balances' ? (
        <Table>
          <Thead>
            <tr>
              <Th>#</Th>
              <Th>Center Name</Th>
              <Th>Type</Th>
              <Th>Code</Th>
              <Th>Email</Th>
              <Th>Status</Th>
              <Th>Wallet Balance</Th>
            </tr>
          </Thead>
          <Tbody>
            {centers.length === 0 ? (
              <Tr><Td colSpan={7} className="text-center text-gray-400 py-12">No centers found</Td></Tr>
            ) : centers.map((c, i) => (
              <Tr key={c.id}>
                <Td className="text-gray-400 text-xs w-10">{i + 1}</Td>
                <Td>
                  <p className="font-semibold text-gray-900">{c.center_name}</p>
                </Td>
                <Td>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    c.center_type === 'super_center' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'
                  }`}>
                    {c.center_type === 'super_center' ? 'Super Center' : 'Center'}
                  </span>
                </Td>
                <Td className="font-mono text-xs text-gray-500">{c.center_code || '—'}</Td>
                <Td className="text-gray-500 text-xs">{c.email || '—'}</Td>
                <Td>
                  <Badge status={c.approval_status?.toLowerCase()}>{c.approval_status || 'pending'}</Badge>
                </Td>
                <Td>
                  <span className={`text-sm font-black ${Number(c.virtual_balance) > 0 ? 'text-emerald-700' : 'text-gray-400'}`}>
                    ₹{Number(c.virtual_balance || 0).toLocaleString('en-IN')}
                  </span>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      ) : (
        <Table>
          <Thead>
            <tr>
              <Th>#</Th>
              <Th>Center</Th>
              <Th>Type</Th>
              <Th>Amount</Th>
              <Th>UTR Number</Th>
              <Th>Notes</Th>
              <Th>Requested On</Th>
              <Th>Verified On</Th>
              <Th>Status</Th>
            </tr>
          </Thead>
          <Tbody>
            {recharges.length === 0 ? (
              <Tr><Td colSpan={9} className="text-center text-gray-400 py-12">No recharge requests</Td></Tr>
            ) : recharges.map((r, i) => (
              <Tr key={r.id}>
                <Td className="text-gray-400 text-xs w-10">{i + 1}</Td>
                <Td>
                  <p className="font-semibold text-gray-900">{r.centers?.center_name || '—'}</p>
                  {r.centers?.center_code && <p className="text-xs text-gray-400">{r.centers.center_code}</p>}
                </Td>
                <Td>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    r.centers?.center_type === 'super_center' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'
                  }`}>
                    {r.centers?.center_type === 'super_center' ? 'Super Center' : 'Center'}
                  </span>
                </Td>
                <Td><span className="font-bold text-gray-900">₹{Number(r.amount || 0).toLocaleString('en-IN')}</span></Td>
                <Td className="font-mono text-sm text-gray-700">{r.utr_number || '—'}</Td>
                <Td className="text-gray-500 text-xs max-w-[120px] truncate">{r.notes || '—'}</Td>
                <Td className="text-gray-400 text-xs">{r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN') : '—'}</Td>
                <Td className="text-gray-400 text-xs">{r.verified_at ? new Date(r.verified_at).toLocaleDateString('en-IN') : '—'}</Td>
                <Td><Badge status={r.status?.toLowerCase()}>{r.status || 'pending'}</Badge></Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </div>
  )
}
