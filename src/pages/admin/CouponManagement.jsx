import { useEffect, useState, Fragment } from 'react'
import { supabase } from '../../lib/supabase'
import PageHeader from '../../components/ui/PageHeader'
import { Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui/Table'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import { formatDate } from '../../utils/formatDate'
import { Ticket, Wallet, Sparkles, Eye, EyeOff, ChevronDown, ChevronRight, BadgeCheck, Tag, Copy, Search, Power, PowerOff, Pencil, Trash2 } from 'lucide-react'

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
  const [fetchErr, setFetchErr] = useState(null)
  const [hiddenCenters, setHiddenCenters] = useState({})

  const toggleCenter = (key) =>
    setHiddenCenters(prev => ({ ...prev, [key]: !prev[key] }))

  // Coupon generation modal state
  const [genCenter, setGenCenter] = useState(null)
  const [genRate, setGenRate] = useState('')
  const [genSaving, setGenSaving] = useState(false)

  // Direct single-code generation (Approval Code / Discounted Coupon).
  // directType is null when closed, else 'approval' | 'discount'.
  const [directType, setDirectType] = useState(null)
  const [directCenterId, setDirectCenterId] = useState('')
  const [directAmount, setDirectAmount] = useState('')
  const [directSaving, setDirectSaving] = useState(false)
  const [directResult, setDirectResult] = useState(null) // { code, type, amount, centerName }
  const [viewStatus, setViewStatus] = useState('All')    // status tab inside the type panel
  const [genMode, setGenMode] = useState(false)          // inline generate form inside the panel
  const [panelQ, setPanelQ] = useState('')               // search within the type panel
  // Edit-amount modal for an unused approval code (admin only).
  const [editCode, setEditCode] = useState(null)
  const [editAmount, setEditAmount] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  function openDirect(type) {
    setDirectType(type)
    setDirectCenterId('')
    setDirectAmount('')
    setDirectResult(null)
    setViewStatus('All')
    setGenMode(false)
    setPanelQ('')
  }
  function closeDirect() {
    setDirectType(null)
    setDirectCenterId('')
    setDirectAmount('')
    setDirectResult(null)
    setViewStatus('All')
    setGenMode(false)
    setPanelQ('')
  }

  // Admin activates / deactivates an approval code (centers can only view now).
  async function toggleActivate(c) {
    const next = !c.is_activated
    const payload = next
      ? { is_activated: true, activated_at: new Date().toISOString() }
      : { is_activated: false }
    const { error } = await supabase.from('coupons').update(payload).eq('id', c.id)
    if (error) { alert('Could not update: ' + error.message); return }
    setCoupons(prev => prev.map(x => x.id === c.id ? { ...x, is_activated: next } : x))
  }

  // Edit an unused approval code's amount. Edit modal state holds the row + value.
  async function saveEditCode() {
    const amount = Math.round(Number(editAmount) || 0)
    if (!editCode || amount < 1) { alert('Enter a valid amount (₹1 or more).'); return }
    setEditSaving(true)
    const { error } = await supabase.from('coupons').update({ face_value: amount }).eq('id', editCode.id)
    setEditSaving(false)
    if (error) { alert('Could not update: ' + error.message); return }
    setCoupons(prev => prev.map(x => x.id === editCode.id ? { ...x, face_value: amount } : x))
    setEditCode(null); setEditAmount('')
  }

  // Delete an unused approval code outright.
  async function deleteCode(c) {
    if (!confirm(`Delete approval code ${c.coupon_code || c.id?.slice(0, 8).toUpperCase()}? This cannot be undone.`)) return
    const { error } = await supabase.from('coupons').delete().eq('id', c.id)
    if (error) { alert('Could not delete: ' + error.message); return }
    setCoupons(prev => prev.filter(x => x.id !== c.id))
  }

  async function generateDirectCode() {
    const amount = Math.round(Number(directAmount) || 0)
    if (!directCenterId || amount < 1) return
    setDirectSaving(true)
    const { data: inserted, error } = await supabase.from('coupons')
      .insert({ center_id: directCenterId, face_value: amount, coupon_type: directType })
      .select('id, coupon_code')
      .single()
    setDirectSaving(false)
    if (error) { alert('Error generating code: ' + error.message); return }
    const center = centers.find(c => c.id === directCenterId)
    setDirectResult({
      code: inserted?.coupon_code || inserted?.id?.slice(0, 8).toUpperCase() || '—',
      type: directType,
      amount,
      centerName: center?.center_name || '',
    })
    await fetchData()
  }

  async function fetchData() {
    setLoading(true)

    // Fetch coupons defensively. A missing column (e.g. created_at) or a bad
    // embedded join would otherwise error and blank the whole list. Try the
    // richest query first, then degrade until one works.
    const attempts = [
      () => supabase.from('coupons').select('*, centers(center_name, center_code, center_type, payment_date, super_center:super_center_id(center_name, center_code))').order('created_at', { ascending: false }),
      () => supabase.from('coupons').select('*').order('created_at', { ascending: false }),
      () => supabase.from('coupons').select('*, centers(center_name, center_code, center_type, payment_date, super_center:super_center_id(center_name, center_code))'),
      () => supabase.from('coupons').select('*'),
    ]
    let cpData = null, cpErr = null
    for (const run of attempts) {
      const r = await run()
      if (!r.error) { cpData = r.data; cpErr = null; break }
      cpErr = r.error
    }
    if (cpErr) console.error('coupons fetch failed:', cpErr)
    setCoupons(cpData || [])
    setFetchErr(cpErr ? `Unable to load coupons: ${cpErr.message}` : null)

    const ctrs = await supabase
      .from('centers')
      .select('id, center_name, center_code, center_type, coupon_wallet_balance')
      .order('center_name')
    if (ctrs.error) console.error('centers fetch failed:', ctrs.error)
    setCenters(ctrs.data || [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const filtered = coupons.filter(c => {
    const isUsed = !!(c.is_used || c.used_at)
    if (statusFilter === 'Used' && !isUsed) return false
    if (statusFilter === 'Unused' && isUsed) return false
    if (centerFilter && c.center_id !== centerFilter) return false
    return true
  })

  const totalUsed = coupons.filter(c => !!(c.is_used || c.used_at)).length
  const totalUnused = coupons.length - totalUsed

  // Per-center used/unused counts (used in group headers & wallet cards).
  const statsByCenter = coupons.reduce((acc, c) => {
    const k = c.center_id || 'none'
    if (!acc[k]) acc[k] = { used: 0, unused: 0 }
    if (c.is_used || c.used_at) acc[k].used++; else acc[k].unused++
    return acc
  }, {})

  // The type panel (Approval Code / Discounted Coupon) — codes of one type with a status tab.
  const panelCoupons = directType ? coupons.filter(c => c.coupon_type === directType) : []
  const isApprovalPanel = directType === 'approval'
  // Status matchers shared by the panel tabs + the list filter.
  //  Used     = code consumed to create a center
  //  Unused   = approval: verified/approved & available; discount: any not-used
  //  To Verify= awaiting Account-Dept verification
  //  Reject   = rejected; Hold = on hold (needs is_hold column, empty until then)
  const PANEL_MATCH = {
    All:         () => true,
    Used:        c => !!(c.is_used || c.used_at),
    // Approval: every available code (generated, not used/rejected/held) — activated or not.
    Unused:      c => !(c.is_used || c.used_at) && (isApprovalPanel ? (!c.is_rejected && !c.is_hold) : true),
    'To Verify': c => !(c.is_used || c.used_at) && !c.is_activated && !c.activated_at && !c.is_rejected,
    Reject:      c => !!c.is_rejected,
    Hold:        c => !!c.is_hold,
  }
  const panelUsed = panelCoupons.filter(PANEL_MATCH.Used).length
  const panelUnused = panelCoupons.filter(PANEL_MATCH.Unused).length
  const panelList = panelCoupons.filter(c => {
    if (!(PANEL_MATCH[viewStatus] || (() => true))(c)) return false
    if (panelQ) {
      const hay = `${c.id || ''} ${c.centers?.center_name || ''} ${c.centers?.center_code || ''}`.toLowerCase()
      if (!hay.includes(panelQ.toLowerCase())) return false
    }
    return true
  })
  // To Verify / Reject / Hold tabs show the center's online Payment Date instead of Generated On.
  const showPanelPaymentDate = isApprovalPanel && (viewStatus === 'To Verify' || viewStatus === 'Reject' || viewStatus === 'Hold')
  // Tab definitions — approval codes get the full 6-state bar; discount keeps the simple set.
  const panelTabs = isApprovalPanel
    ? [
        { k: 'All',       on: 'bg-white text-gray-800 shadow-sm',   badgeOn: 'bg-gray-800 text-white' },
        { k: 'Used',      on: 'bg-white text-gray-600 shadow-sm',   badgeOn: 'bg-gray-500 text-white' },
        { k: 'Unused',    on: 'bg-white text-emerald-700 shadow-sm', badgeOn: 'bg-emerald-600 text-white' },
        { k: 'To Verify', on: 'bg-white text-amber-700 shadow-sm',  badgeOn: 'bg-amber-500 text-white' },
        { k: 'Reject',    on: 'bg-white text-red-700 shadow-sm',    badgeOn: 'bg-red-500 text-white' },
        { k: 'Hold',      on: 'bg-white text-orange-700 shadow-sm', badgeOn: 'bg-orange-500 text-white' },
      ].map(t => ({ ...t, n: panelCoupons.filter(PANEL_MATCH[t.k]).length }))
    : [
        { k: 'All',    n: panelCoupons.length, on: 'bg-white text-gray-800 shadow-sm',   badgeOn: 'bg-gray-800 text-white' },
        { k: 'Unused', n: panelUnused,          on: 'bg-white text-emerald-700 shadow-sm', badgeOn: 'bg-emerald-600 text-white' },
        { k: 'Used',   n: panelUsed,            on: 'bg-white text-gray-600 shadow-sm',   badgeOn: 'bg-gray-500 text-white' },
      ]

  // Group the visible coupons by their center so each center's list can be
  // collapsed (hidden) / expanded (unhidden) independently.
  const groups = Object.values(
    filtered.reduce((acc, c) => {
      const key = c.center_id || 'none'
      if (!acc[key]) acc[key] = { key, center: c.centers, items: [] }
      acc[key].items.push(c)
      return acc
    }, {})
  ).sort((a, b) => (a.center?.center_name || '').localeCompare(b.center?.center_name || ''))

  const allHidden = groups.length > 0 && groups.every(g => hiddenCenters[g.key])
  const toggleAll = () => {
    if (allHidden) setHiddenCenters({})
    else setHiddenCenters(Object.fromEntries(groups.map(g => [g.key, true])))
  }

  // Centers that have money deposited in their coupon wallet but not yet minted.
  const walletCenters = centers.filter(c => Number(c.coupon_wallet_balance || 0) > 0)
  const totalWallet = centers.reduce((sum, c) => sum + Number(c.coupon_wallet_balance || 0), 0)

  const genBalance = Math.round(Number(genCenter?.coupon_wallet_balance || 0))
  const genRateNum = Math.round(Number(genRate) || 0)
  const genCount = genRateNum > 0 ? Math.floor(genBalance / genRateNum) : 0
  const genMinted = genCount * genRateNum
  const genRemaining = genBalance - genMinted

  async function generateCoupons() {
    if (!genCenter || genCount < 1) return
    setGenSaving(true)
    const rows = Array.from({ length: genCount }, () => ({
      center_id: genCenter.id,
      face_value: genRateNum,
    }))
    const { data: inserted, error: cpErr } = await supabase.from('coupons').insert(rows).select('id')
    if (cpErr) { alert('Error generating coupons: ' + cpErr.message); setGenSaving(false); return }
    // Deduct the minted money; any remainder (< 1 coupon) stays in the wallet.
    const { error: balErr } = await supabase.from('centers')
      .update({ coupon_wallet_balance: genRemaining })
      .eq('id', genCenter.id)
    if (balErr) { alert('Wallet balance update error: ' + balErr.message) }
    const madeCount = inserted?.length ?? 0
    setGenSaving(false)
    setGenCenter(null)
    setGenRate('')
    await fetchData()
    if (madeCount === 0) {
      alert('The insert ran but returned 0 coupons — RLS may be blocking SELECT/INSERT on the coupons table. Please check.')
    } else {
      alert(`${madeCount} coupons created (₹${genRateNum} each).`)
    }
  }

  return (
    <div className="p-6">
      <PageHeader title="Coupon Management" subtitle="View and manage all admission & wallet coupons" />

      {fetchErr && (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-bold text-red-700">Unable to load coupons</p>
          <p className="text-xs text-red-600 mt-1 font-mono break-all">{fetchErr}</p>
          <p className="text-xs text-red-600/80 mt-2">
            If this looks like "permission denied" / RLS, then Row Level Security is blocking reads on the <span className="font-bold">coupons</span> table.
            Run <span className="font-mono">enable_coupons_read.sql</span> in the Supabase SQL Editor.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 mb-6">
        <StatCard label="Total Coupons" value={coupons.length} color="blue" />
        <StatCard label="Used" value={totalUsed} color="gray" />
        <StatCard label="Unused / Available" value={totalUnused} color="green" />
        <StatCard label="Wallet Balance" value={`₹${totalWallet.toLocaleString('en-IN')}`} color="amber" />
      </div>

      {/* Section tabs — switch the page body inline (no popup) */}
      <div className="flex flex-wrap gap-2 mb-6">
        {[
          { k: null, label: 'All Coupons', icon: Ticket },
          { k: 'approval', label: 'Approval Codes', icon: BadgeCheck },
          { k: 'discount', label: 'Discounted Coupons', icon: Tag },
        ].map(t => {
          const active = directType === t.k
          return (
            <button key={t.label} onClick={() => (t.k ? openDirect(t.k) : closeDirect())}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                active ? 'bg-white text-[#933d18] border border-gray-200 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}>
              <t.icon size={15} /> {t.label}
            </button>
          )
        })}
      </div>

      {/* ─────────── OVERVIEW (All Coupons) ─────────── */}
      {!directType && (<>
      {/* Coupon wallets — deposited money waiting to be minted into coupons */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Wallet size={16} className="text-[#933d18]" />
          <h2 className="text-sm font-black text-gray-700 uppercase tracking-widest">Coupon Wallets — Mint Coupons</h2>
        </div>
        {walletCenters.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">No center currently has a balance in its coupon wallet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {walletCenters.map(c => (
              <div key={c.id} className="rounded-xl border border-amber-100 bg-amber-50/50 p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-gray-900 truncate">{c.center_name}</p>
                  {c.center_code && <p className="text-xs text-gray-400 font-mono">{c.center_code}</p>}
                  <p className="text-lg font-black text-amber-700 mt-1">₹{Number(c.coupon_wallet_balance).toLocaleString('en-IN')}</p>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">{statsByCenter[c.id]?.unused || 0} unused</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">{statsByCenter[c.id]?.used || 0} used</span>
                  </div>
                </div>
                <Button size="sm" onClick={() => { setGenCenter(c); setGenRate('') }} className="shrink-0">
                  <Sparkles size={13} /> Generate
                </Button>
              </div>
            ))}
          </div>
        )}
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
        {groups.length > 0 && (
          <button
            onClick={toggleAll}
            className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:text-[#933d18] hover:border-[#933d18]/30 transition-all bg-white"
          >
            {allHidden ? <Eye size={14} /> : <EyeOff size={14} />}
            {allHidden ? 'Show All' : 'Hide All'}
          </button>
        )}
        <span className="text-xs text-gray-400">{filtered.length} coupons</span>
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
            {groups.length === 0 ? (
              <Tr><Td colSpan={9} className="text-center text-gray-400 py-12">No coupons found</Td></Tr>
            ) : groups.map((g) => {
              const hidden = !!hiddenCenters[g.key]
              const usedInGroup = g.items.filter(c => !!(c.is_used || c.used_at)).length
              const unusedInGroup = g.items.length - usedInGroup
              return (
                <Fragment key={g.key}>
                  {/* Per-center group header — click to hide / unhide its coupons */}
                  <Tr className="bg-gray-50/70">
                    <Td colSpan={9} className="py-2.5">
                      <button
                        onClick={() => toggleCenter(g.key)}
                        className="w-full flex items-center gap-2 text-left group"
                      >
                        {hidden ? <ChevronRight size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
                        <span className="font-bold text-gray-900">{g.center?.center_name || 'Unassigned'}</span>
                        {g.center?.center_code && <span className="text-xs text-gray-400 font-mono">{g.center.center_code}</span>}
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-500">
                          {g.items.length} coupon{g.items.length > 1 ? 's' : ''}
                        </span>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">{unusedInGroup} unused</span>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{usedInGroup} used</span>
                        <span className="ml-auto flex items-center gap-1 text-xs font-semibold text-gray-400 group-hover:text-[#933d18] transition-colors">
                          {hidden ? <><Eye size={13} /> Show</> : <><EyeOff size={13} /> Hide</>}
                        </span>
                      </button>
                    </Td>
                  </Tr>
                  {!hidden && g.items.map((c, i) => {
                    const isUsed = !!(c.is_used || c.used_at)
                    return (
                      <Tr key={c.id}>
                        <Td className="text-gray-400 text-xs w-10">{i + 1}</Td>
                        <Td className="font-mono text-xs text-gray-700">{c.coupon_code || c.id?.slice(0, 8).toUpperCase() || '—'}</Td>
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
                        <Td>
                          <span className="font-bold text-gray-900">₹{Number(c.face_value || 0).toLocaleString('en-IN')}</span>
                          <span className={`block mt-0.5 text-[10px] font-bold uppercase tracking-wide ${
                            c.coupon_type === 'approval' ? 'text-indigo-600' : 'text-emerald-600'
                          }`}>
                            {c.coupon_type === 'approval' ? 'Approval Code' : 'Discount'}
                          </span>
                        </Td>
                        <Td className="font-mono text-xs text-gray-400">{c.application_id?.slice(0, 8) || '—'}</Td>
                        <Td className="text-gray-400 text-xs">{formatDate(c.created_at)}</Td>
                        <Td className="text-gray-400 text-xs">{formatDate(c.used_at)}</Td>
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
                </Fragment>
              )
            })}
          </Tbody>
        </Table>
      )}
      </>)}

      {/* Generate coupons modal */}
      <Modal isOpen={!!genCenter} onClose={() => { setGenCenter(null); setGenRate('') }} title="Generate Coupons">
        {genCenter && (
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <p className="font-bold text-gray-900">{genCenter.center_name}</p>
              {genCenter.center_code && <p className="text-xs text-gray-400 font-mono">{genCenter.center_code}</p>}
              <div className="flex items-center justify-between mt-2">
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Wallet Balance</span>
                <span className="text-lg font-black text-amber-700">₹{genBalance.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Per Coupon Rate (₹)</label>
              <input
                type="number"
                min="1"
                autoFocus
                placeholder="E.g. 100 or 200"
                value={genRate}
                onChange={e => setGenRate(e.target.value)}
                className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#933d18] focus:ring-2 focus:ring-[#933d18]/10 bg-white"
              />
            </div>

            <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
              <p className="text-[11px] font-bold text-emerald-700 uppercase">Coupons to Generate</p>
              {genRateNum > 0 ? (
                <>
                  <p className="text-sm text-emerald-800 mt-0.5">
                    ₹{genBalance.toLocaleString('en-IN')} ÷ ₹{genRateNum} = <span className="text-xl font-black">{genCount}</span> coupons
                  </p>
                  {genRemaining > 0 && (
                    <p className="text-[11px] text-emerald-600/80 mt-1">₹{genRemaining.toLocaleString('en-IN')} will remain in the wallet (less than 1 coupon).</p>
                  )}
                </>
              ) : (
                <p className="text-xs text-emerald-600/80 mt-0.5">Enter a rate to see the coupon count.</p>
              )}
            </div>

            <div className="flex gap-3">
              <Button
                onClick={generateCoupons}
                disabled={genSaving || genCount < 1}
                className="flex-1 justify-center"
              >
                <Sparkles size={14} /> {genSaving ? 'Generating...' : `Generate ${genCount > 0 ? genCount : ''} Coupons`}
              </Button>
              <Button variant="outline" onClick={() => { setGenCenter(null); setGenRate('') }} className="flex-1 justify-center">Cancel</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit amount for an unused approval code (admin only). */}
      <Modal isOpen={!!editCode} onClose={() => { setEditCode(null); setEditAmount('') }} title="Edit Approval Code">
        {editCode && (
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <p className="font-mono font-bold text-gray-900">{editCode.coupon_code || editCode.id?.slice(0, 8).toUpperCase()}</p>
              <p className="text-xs text-gray-400 mt-0.5">{editCode.centers?.center_name || '—'}</p>
            </div>
            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Amount (₹)</label>
              <input
                type="number"
                min="1"
                autoFocus
                value={editAmount}
                onChange={e => setEditAmount(e.target.value)}
                className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#933d18] focus:ring-2 focus:ring-[#933d18]/10 bg-white"
              />
            </div>
            <div className="flex gap-3">
              <Button onClick={saveEditCode} disabled={editSaving} className="flex-1 justify-center">
                {editSaving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button variant="outline" onClick={() => { setEditCode(null); setEditAmount('') }} className="flex-1 justify-center">Cancel</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Type panel — Approval Codes / Discounted Coupons: inline (no popup) */}
      {directType && (
          <div className="space-y-4">
            {/* Top bar: status tabs + Generate button */}
            {!genMode && (
              <>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex gap-1.5 bg-gray-100/70 p-1.5 rounded-2xl flex-wrap">
                    {panelTabs.map(t => (
                      <button key={t.k} onClick={() => setViewStatus(t.k)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                          viewStatus === t.k ? t.on : 'text-gray-500 hover:text-gray-700'
                        }`}>
                        {t.k}
                        <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${viewStatus === t.k ? t.badgeOn : 'bg-gray-200 text-gray-500'}`}>{t.n}</span>
                      </button>
                    ))}
                  </div>
                  <Button onClick={() => { setGenMode(true); setDirectResult(null); setDirectCenterId(''); setDirectAmount('') }} className="ml-auto">
                    <Sparkles size={14} /> Generate New
                  </Button>
                </div>
                <div className="relative">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={panelQ} onChange={e => setPanelQ(e.target.value)}
                    placeholder={`Search ${directType === 'approval' ? 'approval codes' : 'coupons'} by code or center…`}
                    className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:border-[#933d18] focus:ring-2 focus:ring-[#933d18]/10 transition-colors" />
                </div>
              </>
            )}

            {/* Inline generate form / result */}
            {genMode ? (
              directResult ? (
                <>
                  <div className={`rounded-xl border p-5 text-center ${
                    directResult.type === 'approval' ? 'border-indigo-100 bg-indigo-50' : 'border-emerald-100 bg-emerald-50'
                  }`}>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">
                      {directResult.type === 'approval' ? 'Approval Code' : 'Coupon Code'}
                    </p>
                    <div className="flex items-center justify-center gap-2 mt-2">
                      <span className="text-2xl font-black font-mono text-gray-900 tracking-wider">{directResult.code}</span>
                      <button onClick={() => navigator.clipboard?.writeText(directResult.code)} title="Copy code"
                        className="text-gray-400 hover:text-[#933d18] transition-colors">
                        <Copy size={16} />
                      </button>
                    </div>
                    <p className="text-sm text-gray-600 mt-2">₹{directResult.amount.toLocaleString('en-IN')} · {directResult.centerName}</p>
                  </div>
                  <div className="flex gap-3">
                    <Button onClick={() => { setDirectResult(null); setDirectCenterId(''); setDirectAmount('') }} variant="outline" className="flex-1 justify-center">
                      Generate Another
                    </Button>
                    <Button onClick={() => { setGenMode(false); setDirectResult(null) }} className="flex-1 justify-center">Back to List</Button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Center / Super Center</label>
                    <select value={directCenterId} onChange={e => setDirectCenterId(e.target.value)}
                      className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#933d18] focus:ring-2 focus:ring-[#933d18]/10 bg-white">
                      <option value="">Select a center…</option>
                      {centers.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.center_name}{c.center_code ? ` (${c.center_code})` : ''}{c.center_type === 'super_center' ? ' — Super Center' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Amount (₹)</label>
                    <input type="number" min="1" placeholder="E.g. 500 or 1000" value={directAmount} onChange={e => setDirectAmount(e.target.value)}
                      className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#933d18] focus:ring-2 focus:ring-[#933d18]/10 bg-white" />
                  </div>
                  <p className="text-xs text-gray-500">
                    A single {directType === 'approval' ? 'approval code' : 'discounted coupon'} will be created for the selected center with this amount.
                  </p>
                  <div className="flex gap-3">
                    <Button onClick={generateDirectCode} disabled={directSaving || !directCenterId || Math.round(Number(directAmount) || 0) < 1} className="flex-1 justify-center">
                      <Sparkles size={14} /> {directSaving ? 'Generating…' : 'Generate Code'}
                    </Button>
                    <Button variant="outline" onClick={() => setGenMode(false)} className="flex-1 justify-center">Cancel</Button>
                  </div>
                </>
              )
            ) : (
              /* List of codes for this type */
              <div className="border border-gray-100 rounded-2xl overflow-x-auto shadow-sm">
                {isApprovalPanel && viewStatus === 'Unused' ? (
                /* Unused approval codes — compact column set (Code / Center / Amount / Generated / Status), same as the super center view. */
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#933d18] text-left">
                      <th className="px-5 py-3 text-xs font-semibold text-white uppercase tracking-wide">Code</th>
                      <th className="px-5 py-3 text-xs font-semibold text-white uppercase tracking-wide">Center</th>
                      <th className="px-5 py-3 text-xs font-semibold text-white uppercase tracking-wide">Amount</th>
                      <th className="px-5 py-3 text-xs font-semibold text-white uppercase tracking-wide">Generated</th>
                      <th className="px-5 py-3 text-xs font-semibold text-white uppercase tracking-wide">Status</th>
                      <th className="px-5 py-3 text-xs font-semibold text-white uppercase tracking-wide text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {panelList.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                        No unused approval codes {panelQ ? 'match your search.' : 'yet.'}
                      </td></tr>
                    ) : panelList.map((c, i) => (
                      <tr key={c.id} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${i % 2 ? 'bg-gray-50/50' : ''}`}>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-bold text-gray-800 tracking-wide">{c.coupon_code || c.id?.slice(0, 8).toUpperCase() || '—'}</span>
                            <button onClick={() => navigator.clipboard?.writeText(c.coupon_code || c.id?.slice(0, 8).toUpperCase() || '')} title="Copy code"
                              className="text-gray-300 hover:text-[#933d18] transition-colors"><Copy size={13} /></button>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <p className="font-semibold text-gray-900 text-sm">{c.centers?.center_name || '—'}</p>
                          {c.centers?.center_type === 'super_center'
                            ? <span className="text-[10px] font-bold text-purple-600">Super Center</span>
                            : c.centers?.center_code && <span className="text-[10px] text-gray-400 font-mono">{c.centers.center_code}</span>}
                        </td>
                        <td className="px-5 py-3.5 font-bold text-gray-900 text-sm">₹{Number(c.face_value || 0).toLocaleString('en-IN')}</td>
                        <td className="px-5 py-3.5 text-gray-400 text-xs">{formatDate(c.created_at)}</td>
                        <td className="px-5 py-3.5">
                          {c.is_activated ? (
                            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700">● Activated</span>
                          ) : (
                            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">● Unused</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          {c.is_activated ? (
                            <button onClick={() => toggleActivate(c)}
                              className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors">
                              <PowerOff size={13} /> Deactivate
                            </button>
                          ) : (
                            <button onClick={() => toggleActivate(c)}
                              className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors">
                              <Power size={13} /> Activate
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                ) : isApprovalPanel ? (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#933d18] text-left">
                      <th className="px-5 py-3 text-xs font-semibold text-white uppercase tracking-wide">#</th>
                      <th className="px-5 py-3 text-xs font-semibold text-white uppercase tracking-wide">Center</th>
                      <th className="px-5 py-3 text-xs font-semibold text-white uppercase tracking-wide">Super Center</th>
                      <th className="px-5 py-3 text-xs font-semibold text-white uppercase tracking-wide">Type</th>
                      <th className="px-5 py-3 text-xs font-semibold text-white uppercase tracking-wide">Approval Code Amount</th>
                      <th className="px-5 py-3 text-xs font-semibold text-white uppercase tracking-wide">Coupon Code</th>
                      <th className="px-5 py-3 text-xs font-semibold text-white uppercase tracking-wide">Transaction ID</th>
                      <th className="px-5 py-3 text-xs font-semibold text-white uppercase tracking-wide">{showPanelPaymentDate ? 'Payment Date' : 'Generated On'}</th>
                      <th className="px-5 py-3 text-xs font-semibold text-white uppercase tracking-wide">Status</th>
                      <th className="px-5 py-3 text-xs font-semibold text-white uppercase tracking-wide text-center">Actions</th>
                      {viewStatus === 'Unused' && (
                        <th className="px-5 py-3 text-xs font-semibold text-white uppercase tracking-wide text-center">Edit &amp; Delete</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {panelList.length === 0 ? (
                      <tr><td colSpan={viewStatus === 'Unused' ? 11 : 10} className="px-4 py-12 text-center text-gray-400">
                        No {viewStatus !== 'All' ? viewStatus.toLowerCase() + ' ' : ''}approval codes {panelQ ? 'match your search.' : 'yet.'}
                      </td></tr>
                    ) : panelList.map((c, i) => {
                      const used = !!(c.is_used || c.used_at)
                      return (
                        <tr key={c.id} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${i % 2 ? 'bg-gray-50/50' : ''}`}>
                          <td className="px-5 py-3.5 text-gray-400 text-xs">{i + 1}</td>
                          <td className="px-5 py-3.5">
                            <p className="font-semibold text-gray-900 text-sm">{c.centers?.center_name || '—'}</p>
                            {c.centers?.center_code && <span className="text-[10px] text-gray-400 font-mono">{c.centers.center_code}</span>}
                          </td>
                          <td className="px-5 py-3.5">
                            <p className="font-medium text-gray-700 text-sm">{c.centers?.super_center?.center_name || '—'}</p>
                            {c.centers?.super_center?.center_code && <span className="text-[10px] text-gray-400 font-mono">{c.centers.super_center.center_code}</span>}
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${c.centers?.center_type === 'super_center' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>
                              {c.centers?.center_type === 'super_center' ? 'Super Center' : 'Center'}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 font-bold text-gray-900 text-sm">₹{Number(c.face_value || 0).toLocaleString('en-IN')}</td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-bold text-gray-800 tracking-wide">{c.coupon_code || c.id?.slice(0, 8).toUpperCase() || '—'}</span>
                              <button onClick={() => navigator.clipboard?.writeText(c.coupon_code || c.id?.slice(0, 8).toUpperCase() || '')} title="Copy code"
                                className="text-gray-300 hover:text-[#933d18] transition-colors"><Copy size={13} /></button>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 font-mono text-xs text-gray-700">{c.payment_txn_id || '—'}</td>
                          <td className="px-5 py-3.5 text-gray-400 text-xs">{showPanelPaymentDate ? (c.centers?.payment_date ? formatDate(c.centers.payment_date) : '—') : formatDate(c.created_at)}</td>
                          <td className="px-5 py-3.5">
                            {used ? (
                              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">Used</span>
                            ) : c.is_activated ? (
                              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700">● Activated</span>
                            ) : (
                              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">● Unused</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            {used ? (
                              <span className="text-xs text-gray-300">—</span>
                            ) : c.is_activated ? (
                              <button onClick={() => toggleActivate(c)}
                                className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors">
                                <PowerOff size={13} /> Deactivate
                              </button>
                            ) : (
                              <button onClick={() => toggleActivate(c)}
                                className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors">
                                <Power size={13} /> Activate
                              </button>
                            )}
                          </td>
                          {viewStatus === 'Unused' && (
                            <td className="px-5 py-3.5">
                              <div className="flex items-center justify-center gap-2">
                                <button onClick={() => { setEditCode(c); setEditAmount(String(Math.round(Number(c.face_value || 0)))) }}
                                  title="Edit amount"
                                  className="inline-flex items-center gap-1 text-xs font-bold text-[#933d18] bg-[#933d18]/5 hover:bg-[#933d18]/10 px-2.5 py-1.5 rounded-lg transition-colors">
                                  <Pencil size={13} /> Edit
                                </button>
                                <button onClick={() => deleteCode(c)}
                                  title="Delete code"
                                  className="inline-flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg transition-colors">
                                  <Trash2 size={13} /> Delete
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#933d18] text-left">
                      <th className="px-5 py-3 text-xs font-semibold text-white uppercase tracking-wide">Code</th>
                      <th className="px-5 py-3 text-xs font-semibold text-white uppercase tracking-wide">Center</th>
                      <th className="px-5 py-3 text-xs font-semibold text-white uppercase tracking-wide">Amount</th>
                      <th className="px-5 py-3 text-xs font-semibold text-white uppercase tracking-wide">Generated</th>
                      <th className="px-5 py-3 text-xs font-semibold text-white uppercase tracking-wide">Status</th>
                      <th className="px-5 py-3 text-xs font-semibold text-white uppercase tracking-wide text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {panelList.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                        No {viewStatus !== 'All' ? viewStatus.toLowerCase() + ' ' : ''}discounted coupons {panelQ ? 'match your search.' : 'yet.'}
                      </td></tr>
                    ) : panelList.map((c, i) => {
                      const used = !!(c.is_used || c.used_at)
                      return (
                        <tr key={c.id} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${i % 2 ? 'bg-gray-50/50' : ''}`}>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-bold text-gray-800 tracking-wide">{c.coupon_code || c.id?.slice(0, 8).toUpperCase() || '—'}</span>
                              <button onClick={() => navigator.clipboard?.writeText(c.coupon_code || c.id?.slice(0, 8).toUpperCase() || '')} title="Copy code"
                                className="text-gray-300 hover:text-[#933d18] transition-colors"><Copy size={13} /></button>
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            <p className="font-semibold text-gray-900 text-sm">{c.centers?.center_name || '—'}</p>
                            {c.centers?.center_type === 'super_center'
                              ? <span className="text-[10px] font-bold text-purple-600">Super Center</span>
                              : c.centers?.center_code && <span className="text-[10px] text-gray-400 font-mono">{c.centers.center_code}</span>}
                          </td>
                          <td className="px-5 py-3.5 font-bold text-gray-900 text-sm">₹{Number(c.face_value || 0).toLocaleString('en-IN')}</td>
                          <td className="px-5 py-3.5 text-gray-400 text-xs">{formatDate(c.created_at)}</td>
                          <td className="px-5 py-3.5">
                            {used ? (
                              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">Used</span>
                            ) : c.is_activated ? (
                              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700">● Activated</span>
                            ) : (
                              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">● Unused</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            {used ? (
                              <span className="text-xs text-gray-300">—</span>
                            ) : c.is_activated ? (
                              <button onClick={() => toggleActivate(c)}
                                className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors">
                                <PowerOff size={13} /> Deactivate
                              </button>
                            ) : (
                              <button onClick={() => toggleActivate(c)}
                                className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors">
                                <Power size={13} /> Activate
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                )}
              </div>
            )}
          </div>
      )}
    </div>
  )
}
