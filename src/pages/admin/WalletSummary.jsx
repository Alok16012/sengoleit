import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import PageHeader from '../../components/ui/PageHeader'
import { Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui/Table'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import { formatDate, localDay } from '../../utils/formatDate'
import { exportCsv, exportPdf } from '../../utils/exportTable'
import { FileSpreadsheet, FileText } from 'lucide-react'

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
  { key: 'online', label: 'Student Online Payments' },
]

const PAYMENT_KIND = {
  re_registration: 'Re-Registration',
  admit_card: 'Admit Card',
}

export default function WalletSummary() {
  const [tab, setTab] = useState('balances')
  const [centers, setCenters] = useState([])
  const [recharges, setRecharges] = useState([])
  const [loading, setLoading] = useState(true)
  const [superFilter, setSuperFilter] = useState('all')
  const [centerFilter, setCenterFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  // Each tab keeps its own date range: the recharge one means "requested on",
  // the balances one means "center registered on". Sharing a single range would
  // silently hide centers the moment you came back from the recharge tab.
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [balFrom, setBalFrom] = useState('')
  const [balTo, setBalTo] = useState('')
  // Fees students paid on the public website (student_online_payments).
  const [online, setOnline] = useState([])
  const [onlineMissing, setOnlineMissing] = useState(false)
  const [onFrom, setOnFrom] = useState('')
  const [onTo, setOnTo] = useState('')

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      const [ctr, rch] = await Promise.all([
        supabase
          .from('centers')
          .select('id, center_name, center_code, center_type, super_center_id, virtual_balance, email, approval_status, created_at')
          .order('virtual_balance', { ascending: false }),
        supabase
          .from('recharge_requests')
          .select('*, centers(center_name, center_code, center_type, super_center_id)')
          .order('created_at', { ascending: false }),
      ])
      setCenters(ctr.data || [])
      setRecharges(rch.data || [])
      setLoading(false)

      // Website payments live behind website_public_api.sql. Read them
      // separately so a database without that migration still shows the rest of
      // the page instead of failing outright.
      const { data: pay, error: payErr } = await supabase
        .from('student_online_payments')
        .select('id, kind, amount, txn_id, paid_at, students(student_name, admission_number, enrollment_no, center_id, centers(center_name, center_code, super_center_id))')
        .order('paid_at', { ascending: false })
      if (payErr) setOnlineMissing(true)
      else setOnline(pay || [])
    }
    fetchData()
  }, [])

  // Dropdown sources + scoping.
  const superCenters = centers.filter(c => c.center_type === 'super_center')
  const regularCenters = centers.filter(c => c.center_type === 'center')
  const scopedCenters = regularCenters.filter(c => superFilter === 'all' ? true : c.super_center_id === superFilter)

  // Rows shown in the balances table after the two filters and the date range.
  const filteredCenters = centers.filter(c => {
    if (superFilter !== 'all' && c.super_center_id !== superFilter) return false
    if (centerFilter !== 'all' && c.id !== centerFilter) return false
    const day = localDay(c.created_at)
    if (balFrom && (!day || day < balFrom)) return false
    if (balTo && (!day || day > balTo)) return false
    return true
  })

  // Recharge rows after the same two filters.
  const filteredRecharges = recharges.filter(r => {
    if (superFilter !== 'all' && r.centers?.super_center_id !== superFilter) return false
    if (centerFilter !== 'all' && r.center_id !== centerFilter) return false
    return true
  })

  // Per-center total verified recharge (money added to the wallet over time).
  const verifiedByCenter = {}
  recharges.filter(r => r.status === 'verified').forEach(r => {
    verifiedByCenter[r.center_id] = (verifiedByCenter[r.center_id] || 0) + Number(r.amount || 0)
  })

  const totalBalance = filteredCenters.reduce((s, c) => s + Number(c.virtual_balance || 0), 0)
  const pendingRecharges = filteredRecharges.filter(r => r.status === 'pending')
  const totalPendingAmount = pendingRecharges.reduce((s, r) => s + Number(r.amount || 0), 0)
  const totalVerified = filteredRecharges.filter(r => r.status === 'verified').reduce((s, r) => s + Number(r.amount || 0), 0)
  // Used = sum of each center's own (recharged - balance), clamped at 0 per
  // center. NOT (totalVerified - totalBalance) globally — a center whose
  // balance was set directly (no matching recharge_request) would otherwise
  // contribute a large negative number and mask genuine usage elsewhere.
  const totalUsed = filteredCenters.reduce((s, c) => {
    const recharge = verifiedByCenter[c.id] || 0
    const balance = Number(c.virtual_balance || 0)
    return s + Math.max(0, recharge - balance)
  }, 0)

  // The date range narrows the Recharge History table only. The stat cards and
  // the tab badge above stay on the full list on purpose — a range must never
  // make a pending recharge look like it isn't waiting.
  const inRange = r => {
    const day = localDay(r.created_at)
    if (fromDate && (!day || day < fromDate)) return false
    if (toDate && (!day || day > toDate)) return false
    return true
  }
  const rangedRecharges = filteredRecharges.filter(inRange)

  // Status sub-filter for the Recharge History table (counts based on the
  // super-center/center filters above, before the status filter itself).
  const STATUS_MATCH = {
    all:      () => true,
    pending:  r => r.status === 'pending',
    hold:     r => r.status === 'hold',
    verified: r => r.status === 'verified',
    rejected: r => r.status === 'rejected',
  }
  const statusCounts = {
    pending:  rangedRecharges.filter(STATUS_MATCH.pending).length,
    hold:     rangedRecharges.filter(STATUS_MATCH.hold).length,
    verified: rangedRecharges.filter(STATUS_MATCH.verified).length,
    rejected: rangedRecharges.filter(STATUS_MATCH.rejected).length,
  }
  const statusedRecharges = rangedRecharges.filter(STATUS_MATCH[statusFilter] || (() => true))
  const shownRechargeTotal = statusedRecharges.reduce((s, r) => s + Number(r.amount || 0), 0)

  // ---- Excel / PDF exports: whichever tab is open, exactly as filtered ----
  const rupees = n => `₹${Number(n || 0).toLocaleString('en-IN')}`
  const RECHARGE_COLUMNS = [
    { header: 'Center', value: r => r.centers?.center_name || '' },
    { header: 'Center Code', value: r => r.centers?.center_code || '' },
    { header: 'Type', value: r => (r.centers?.center_type === 'super_center' ? 'Super Center' : 'Center') },
    { header: 'Amount', value: r => Number(r.amount || 0), pdfValue: r => rupees(r.amount) },
    { header: 'UTR Number', value: r => r.utr_number || '' },
    { header: 'Notes', value: r => r.notes || '' },
    { header: 'Requested On', value: r => (r.created_at ? formatDate(r.created_at) : '') },
    { header: 'Verified On', value: r => (r.verified_at ? formatDate(r.verified_at) : '') },
    { header: 'Status', value: r => r.status || 'pending' },
  ]
  const BALANCE_COLUMNS = [
    { header: 'Center', value: c => c.center_name || '' },
    { header: 'Center Code', value: c => c.center_code || '' },
    { header: 'Type', value: c => (c.center_type === 'super_center' ? 'Super Center' : 'Center') },
    { header: 'Email', value: c => c.email || '' },
    { header: 'Status', value: c => c.approval_status || 'pending' },
    { header: 'Registered On', value: c => (c.created_at ? formatDate(c.created_at) : '') },
    { header: 'Total Recharge', value: c => verifiedByCenter[c.id] || 0, pdfValue: c => rupees(verifiedByCenter[c.id]) },
    { header: 'Used Recharge',
      value: c => Math.max(0, (verifiedByCenter[c.id] || 0) - Number(c.virtual_balance || 0)),
      pdfValue: c => rupees(Math.max(0, (verifiedByCenter[c.id] || 0) - Number(c.virtual_balance || 0))) },
    { header: 'Wallet Balance', value: c => Number(c.virtual_balance || 0), pdfValue: c => rupees(c.virtual_balance) },
  ]

  const ONLINE_COLUMNS = [
    { header: 'Student', value: p => p.students?.student_name || '' },
    { header: 'Application No', value: p => p.students?.admission_number || '' },
    { header: 'Enrollment No', value: p => p.students?.enrollment_no || '' },
    { header: 'Center', value: p => p.students?.centers?.center_name || '' },
    { header: 'Paid For', value: p => PAYMENT_KIND[p.kind] || p.kind },
    { header: 'Amount', value: p => Number(p.amount || 0), pdfValue: p => rupees(p.amount) },
    { header: 'Transaction ID', value: p => p.txn_id || '' },
    { header: 'Paid On', value: p => (p.paid_at ? formatDate(p.paid_at) : '') },
  ]

  const onBalances = tab === 'balances'
  const onOnline = tab === 'online'

  // Website payments follow the same super-center / center scoping as the rest
  // of the page, plus their own paid-on range.
  const filteredOnline = online.filter(p => {
    const c = p.students?.centers
    if (superFilter !== 'all' && c?.super_center_id !== superFilter) return false
    if (centerFilter !== 'all' && p.students?.center_id !== centerFilter) return false
    const day = localDay(p.paid_at)
    if (onFrom && (!day || day < onFrom)) return false
    if (onTo && (!day || day > onTo)) return false
    return true
  })
  const onlineTotal = filteredOnline.reduce((s, p) => s + Number(p.amount || 0), 0)

  const exportColumns = onBalances ? BALANCE_COLUMNS : onOnline ? ONLINE_COLUMNS : RECHARGE_COLUMNS
  const exportRows = onBalances ? filteredCenters : onOnline ? filteredOnline : statusedRecharges
  const exportTitle = onBalances ? 'Center Wallet Balances'
    : onOnline ? 'Student Online Payments' : 'Recharge History Report'
  // The range that applies to whichever tab is open.
  const [rangeFrom, rangeTo] = onBalances ? [balFrom, balTo] : onOnline ? [onFrom, onTo] : [fromDate, toDate]
  const hasRange = !!(rangeFrom || rangeTo)
  const rangeLabel = `${rangeFrom ? formatDate(rangeFrom) : 'start'} to ${rangeTo ? formatDate(rangeTo) : 'today'}`

  const exportMeta = () => {
    const m = []
    if (superFilter !== 'all') m.push(`Super Center: ${centers.find(c => c.id === superFilter)?.center_name || ''}`)
    if (centerFilter !== 'all') m.push(`Center: ${centers.find(c => c.id === centerFilter)?.center_name || ''}`)
    if (onBalances) {
      if (hasRange) m.push(`Registered: ${rangeLabel}`)
      m.push(`Total balance: ₹${totalBalance.toLocaleString('en-IN')}`)
    } else if (onOnline) {
      if (hasRange) m.push(`Paid: ${rangeLabel}`)
      m.push(`Total collected: ₹${onlineTotal.toLocaleString('en-IN')}`)
    } else {
      if (hasRange) m.push(`Requested: ${rangeLabel}`)
      if (statusFilter !== 'all') m.push(`Status: ${statusFilter}`)
      m.push(`Total amount: ₹${shownRechargeTotal.toLocaleString('en-IN')}`)
    }
    return m
  }
  const exportName = () => {
    const range = hasRange ? `_${rangeFrom || 'start'}_to_${rangeTo || 'today'}` : ''
    if (onBalances) return `center-wallet-balances${range}`
    if (onOnline) return `student-online-payments${range}`
    const st = statusFilter === 'all' ? '' : `_${statusFilter}`
    return `recharge-history${st}${range}`
  }

  return (
    <div className="p-6">
      <PageHeader title="Wallet Summary" subtitle="Center virtual balances and recharge history" />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mt-4 mb-6">
        <StatCard label="Total Centers" value={filteredCenters.length} color="blue" />
        <StatCard label="Total Wallet Balance" value={`₹${totalBalance.toLocaleString('en-IN')}`} color="green" sub={superFilter === 'all' && centerFilter === 'all' && !balFrom && !balTo ? 'across all centers' : 'for current filter'} />
        <StatCard label="Used Recharge" value={`₹${totalUsed.toLocaleString('en-IN')}`} color="amber" sub="spent so far" />
        <StatCard label="Pending Recharges" value={pendingRecharges.length} sub={`₹${totalPendingAmount.toLocaleString('en-IN')} awaiting`} color="amber" />
        <StatCard label="Total Verified" value={`₹${totalVerified.toLocaleString('en-IN')}`} color="gray" sub="all time" />
      </div>

      {(
        <div className="flex flex-wrap gap-3 mb-4 items-end">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">Super Center</label>
            <select
              value={superFilter}
              onChange={e => { setSuperFilter(e.target.value); setCenterFilter('all') }}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 bg-white min-w-[200px] focus:outline-none focus:ring-2 focus:ring-[#933d18]/20"
            >
              <option value="all">All Super Centers</option>
              {superCenters.map(s => (
                <option key={s.id} value={s.id}>{s.center_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">Center</label>
            <select
              value={centerFilter}
              onChange={e => setCenterFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 bg-white min-w-[200px] focus:outline-none focus:ring-2 focus:ring-[#933d18]/20"
            >
              <option value="all">All Centers</option>
              {scopedCenters.map(c => (
                <option key={c.id} value={c.id}>{c.center_name}</option>
              ))}
            </select>
          </div>
          {/* Each tab filters on its own date: when the recharge was requested,
              or when the center was registered. */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">
              {onBalances ? 'Registered From' : onOnline ? 'Paid From' : 'Requested From'}
            </label>
            <input type="date"
              value={rangeFrom}
              onChange={e => (onBalances ? setBalFrom : onOnline ? setOnFrom : setFromDate)(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#933d18]/20" />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">To</label>
            <input type="date"
              value={rangeTo}
              onChange={e => (onBalances ? setBalTo : onOnline ? setOnTo : setToDate)(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#933d18]/20" />
          </div>
          {hasRange && (
            <button
              onClick={() => onBalances ? (setBalFrom(''), setBalTo(''))
                : onOnline ? (setOnFrom(''), setOnTo(''))
                : (setFromDate(''), setToDate(''))}
              className="py-2 px-3 text-xs font-bold text-gray-500 hover:text-[#933d18] underline">
              Clear dates
            </button>
          )}
        </div>
      )}

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

      {tab === 'recharges' && (
        <div className="flex flex-wrap gap-1 mb-4 bg-gray-100 p-1 rounded-xl w-fit">
          {[
            { key: 'all',      label: 'All',      color: 'bg-gray-500' },
            { key: 'pending',  label: 'Pending',  color: 'bg-amber-500' },
            { key: 'hold',     label: 'Hold',     color: 'bg-indigo-500' },
            { key: 'verified', label: 'Verified', color: 'bg-emerald-500' },
            { key: 'rejected', label: 'Rejected', color: 'bg-red-500' },
          ].map(s => (
            <button
              key={s.key}
              onClick={() => setStatusFilter(s.key)}
              className={`relative px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                statusFilter === s.key ? 'bg-white text-[#933d18] shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {s.label}
              {s.key !== 'all' && statusCounts[s.key] > 0 && (
                <span className={`ml-2 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ${s.color}`}>{statusCounts[s.key]}</span>
              )}
            </button>
          ))}
        </div>
      )}

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
              <Th>Registered On</Th>
              <Th>Total Recharge</Th>
              <Th>Used Recharge</Th>
              <Th>Wallet Balance</Th>
            </tr>
          </Thead>
          <Tbody>
            {filteredCenters.length === 0 ? (
              <Tr><Td colSpan={10} className="text-center text-gray-400 py-12">No centers found</Td></Tr>
            ) : filteredCenters.map((c, i) => (
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
                <Td className="text-gray-400 text-xs">{formatDate(c.created_at)}</Td>
                {(() => {
                  const totalRecharge = verifiedByCenter[c.id] || 0
                  const balance = Number(c.virtual_balance || 0)
                  const used = Math.max(0, totalRecharge - balance)
                  return (
                    <>
                      <Td><span className="text-sm font-bold text-gray-700">₹{totalRecharge.toLocaleString('en-IN')}</span></Td>
                      <Td><span className="text-sm font-bold text-amber-700">₹{used.toLocaleString('en-IN')}</span></Td>
                      <Td>
                        <span className={`text-sm font-black ${balance > 0 ? 'text-emerald-700' : 'text-gray-400'}`}>
                          ₹{balance.toLocaleString('en-IN')}
                        </span>
                      </Td>
                    </>
                  )
                })()}
              </Tr>
            ))}
          </Tbody>
        </Table>
      ) : onOnline ? (
        <>
          {onlineMissing && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800 mb-3">
              Run <span className="font-mono">website_public_api.sql</span> in Supabase to record fees students pay on the website.
            </div>
          )}
          <Table>
            <Thead>
              <tr>
                <Th>#</Th>
                <Th>Student</Th>
                <Th>Center</Th>
                <Th>Paid For</Th>
                <Th>Amount</Th>
                <Th>Transaction ID</Th>
                <Th>Paid On</Th>
              </tr>
            </Thead>
            <Tbody>
              {filteredOnline.length === 0 ? (
                <Tr><Td colSpan={7} className="text-center text-gray-400 py-12">No payments made on the website yet</Td></Tr>
              ) : filteredOnline.map((p, i) => (
                <Tr key={p.id}>
                  <Td className="text-gray-400 text-xs w-10">{i + 1}</Td>
                  <Td>
                    <p className="font-semibold text-gray-900">{p.students?.student_name || '—'}</p>
                    <p className="text-xs text-gray-400 font-mono">
                      {p.students?.enrollment_no || p.students?.admission_number || ''}
                    </p>
                  </Td>
                  <Td>
                    <p className="text-sm text-gray-700">{p.students?.centers?.center_name || '—'}</p>
                    {p.students?.centers?.center_code && (
                      <p className="text-xs text-gray-400">{p.students.centers.center_code}</p>
                    )}
                  </Td>
                  <Td>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      p.kind === 're_registration' ? 'bg-indigo-50 text-indigo-700' : 'bg-emerald-50 text-emerald-700'
                    }`}>
                      {PAYMENT_KIND[p.kind] || p.kind}
                    </span>
                  </Td>
                  <Td><span className="font-bold text-gray-900">₹{Number(p.amount || 0).toLocaleString('en-IN')}</span></Td>
                  <Td className="font-mono text-xs text-gray-500">{p.txn_id}</Td>
                  <Td className="text-gray-400 text-xs">{formatDate(p.paid_at)}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </>
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
            {statusedRecharges.length === 0 ? (
              <Tr><Td colSpan={9} className="text-center text-gray-400 py-12">No {statusFilter === 'all' ? '' : statusFilter + ' '}recharge requests</Td></Tr>
            ) : statusedRecharges.map((r, i) => (
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
                <Td className="text-gray-500 text-xs max-w-[220px] whitespace-normal break-words">{r.notes || '—'}</Td>
                <Td className="text-gray-400 text-xs">{formatDate(r.created_at)}</Td>
                <Td className="text-gray-400 text-xs">{formatDate(r.verified_at)}</Td>
                <Td><Badge status={r.status?.toLowerCase()}>{r.status || 'pending'}</Badge></Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      {/* Daily / range report — exports exactly what the table above shows. */}
      {!loading && (
        <div className="flex items-center justify-between gap-3 flex-wrap mt-4">
          <p className="text-xs text-gray-500">
            {onBalances ? (
              <>
                Showing <span className="font-bold text-gray-700">{filteredCenters.length}</span> of {centers.length} centers
                {' · '}<span className="font-bold text-gray-700">₹{totalBalance.toLocaleString('en-IN')}</span> total balance
                {hasRange && <> · registered {rangeLabel}</>}
              </>
            ) : onOnline ? (
              <>
                Showing <span className="font-bold text-gray-700">{filteredOnline.length}</span> of {online.length} payments
                {' · '}<span className="font-bold text-gray-700">₹{onlineTotal.toLocaleString('en-IN')}</span> collected
                {hasRange && <> · paid {rangeLabel}</>}
              </>
            ) : (
              <>
                Showing <span className="font-bold text-gray-700">{statusedRecharges.length}</span> of {filteredRecharges.length} recharges
                {' · '}<span className="font-bold text-gray-700">₹{shownRechargeTotal.toLocaleString('en-IN')}</span> total
                {hasRange && <> · requested {rangeLabel}</>}
              </>
            )}
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" size="md"
              onClick={() => exportCsv(exportName(), exportColumns, exportRows)}>
              <FileSpreadsheet size={14} /> Export Excel
            </Button>
            <Button variant="secondary" size="md"
              onClick={() => exportPdf(exportTitle, exportColumns, exportRows, exportMeta())}>
              <FileText size={14} /> Export PDF
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
