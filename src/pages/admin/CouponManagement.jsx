import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import PageHeader from '../../components/ui/PageHeader'
import { Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui/Table'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import { Ticket, Wallet, Sparkles } from 'lucide-react'

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

  // Coupon generation modal state
  const [genCenter, setGenCenter] = useState(null)
  const [genRate, setGenRate] = useState('')
  const [genSaving, setGenSaving] = useState(false)

  async function fetchData() {
    setLoading(true)

    // Fetch coupons defensively. A missing column (e.g. created_at) or a bad
    // embedded join would otherwise error and blank the whole list. Try the
    // richest query first, then degrade until one works.
    const attempts = [
      () => supabase.from('coupons').select('*, centers(center_name, center_code, center_type)').order('created_at', { ascending: false }),
      () => supabase.from('coupons').select('*').order('created_at', { ascending: false }),
      () => supabase.from('coupons').select('*, centers(center_name, center_code, center_type)'),
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
    setFetchErr(cpErr ? `Coupons load nahi ho rahe: ${cpErr.message}` : null)

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
    if (cpErr) { alert('Coupon generate karne mein error: ' + cpErr.message); setGenSaving(false); return }
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
      alert('Insert to chala par 0 coupons mile — possibly RLS coupons table pe SELECT/INSERT block kar rahi hai. Check karo.')
    } else {
      alert(`${madeCount} coupons ban gaye (₹${genRateNum} each).`)
    }
  }

  return (
    <div className="p-6">
      <PageHeader title="Coupon Management" subtitle="View and manage all admission & wallet coupons" />

      {fetchErr && (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-bold text-red-700">Coupons load nahi ho rahe</p>
          <p className="text-xs text-red-600 mt-1 font-mono break-all">{fetchErr}</p>
          <p className="text-xs text-red-600/80 mt-2">
            Agar ye "permission denied" / RLS jaisa hai to <span className="font-bold">coupons</span> table pe Row Level Security read ko block kar rahi hai.
            Supabase SQL Editor mein <span className="font-mono">enable_coupons_read.sql</span> chalao.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 mb-6">
        <StatCard label="Total Coupons" value={coupons.length} color="blue" />
        <StatCard label="Used" value={totalUsed} color="gray" />
        <StatCard label="Unused / Available" value={totalUnused} color="green" />
        <StatCard label="Wallet Balance" value={`₹${totalWallet.toLocaleString('en-IN')}`} color="amber" />
      </div>

      {/* Coupon wallets — deposited money waiting to be minted into coupons */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Wallet size={16} className="text-[#933d18]" />
          <h2 className="text-sm font-black text-gray-700 uppercase tracking-widest">Coupon Wallets — Mint Coupons</h2>
        </div>
        {walletCenters.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">Kisi center ke coupon wallet mein abhi balance nahi hai.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {walletCenters.map(c => (
              <div key={c.id} className="rounded-xl border border-amber-100 bg-amber-50/50 p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-gray-900 truncate">{c.center_name}</p>
                  {c.center_code && <p className="text-xs text-gray-400 font-mono">{c.center_code}</p>}
                  <p className="text-lg font-black text-amber-700 mt-1">₹{Number(c.coupon_wallet_balance).toLocaleString('en-IN')}</p>
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
                placeholder="e.g. 100 or 200"
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
                    <p className="text-[11px] text-emerald-600/80 mt-1">₹{genRemaining.toLocaleString('en-IN')} wallet mein bachega (1 coupon se kam).</p>
                  )}
                </>
              ) : (
                <p className="text-xs text-emerald-600/80 mt-0.5">Rate dalo to coupon count dikhega.</p>
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
    </div>
  )
}
