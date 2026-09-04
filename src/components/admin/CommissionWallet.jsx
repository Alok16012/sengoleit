import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import RecordCommissionModal from './RecordCommissionModal'

const fmt = n => '₹' + (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

// The "real" admission price a student paid: payment_amount (if set, includes letter
// fee) else base_fee.  Returns null if neither is set.
function realAdmissionPrice(app) {
  const hasPayment = app.payment_amount != null && Number(app.payment_amount) > 0
  const hasBase = app.base_fee != null && Number(app.base_fee) > 0
  if (hasPayment) return Number(app.payment_amount)
  if (hasBase) return Number(app.base_fee)
  return null
}

// `superCenterId` comes from the page's own Super Center filter, which sits
// above every tab. This used to carry a second dropdown of its own, so the
// screen asked the same question twice and the two could disagree.
export default function CommissionWallet({ superCenterId = '' }) {
  const [centers, setCenters] = useState([])
  const [ledger, setLedger] = useState([])
  const [recharges, setRecharges] = useState([])
  const [rates, setRates] = useState([])          // center_commissions
  const [paidRows, setPaidRows] = useState([])    // recharge_commissions + coupon
  const [rechargeErr, setRechargeErr] = useState('')
  const [genBusy, setGenBusy] = useState(null)                // recharge id while minting
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('history')                   // 'history' | 'recharges' | 'record'
  const [recordModal, setRecordModal] = useState(null)         // { superCenter } or null
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const fetchAll = useCallback(async () => {
    setLoading(true)
    // Every centre, not just the super ones: a ledger row names the CENTRE the
    // commission came from, and looking that up in a super-centre-only list
    // found nothing and printed a slice of its uuid instead.
    const { data: ctr } = await supabase
      .from('centers')
      .select('id, center_name, center_code, center_type, commission_balance, base_fee')
      .order('center_name')

    const { data: led } = await supabase
      .from('commission_ledger')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)

    // Every recharge, in one read — filtered per super centre below. Fetching
    // per selection would need a second effect, and the volume here is small.
    const { data: rr, error: rrErr } = await supabase
      .from('recharge_requests')
      .select('id, center_id, amount, notes, created_at, status')
      .order('created_at', { ascending: false })
      .limit(1000)

    // Who earns on which centre, and what has already been paid out. Both are
    // separate reads rather than PostgREST embeds: a wrong embed hint fails the
    // WHOLE query, and the tab would then read as "no recharges" — not as an
    // error.
    const { data: rates, error: rateErr } = await supabase
      .from('center_commissions').select('center_id, super_center_id, percent')
    const { data: paid } = await supabase
      .from('recharge_commissions').select('recharge_id, super_center_id, coupon_id, percent, amount')

    const couponIds = [...new Set((paid || []).map(p => p.coupon_id).filter(Boolean))]
    let couponMap = {}
    if (couponIds.length) {
      const { data: cps } = await supabase
        .from('coupons').select('id, coupon_code, face_value, is_used').in('id', couponIds)
      couponMap = Object.fromEntries((cps || []).map(c => [c.id, c]))
    }

    setCenters(ctr || [])
    setLedger(led || [])
    // A missing table (migration not run) fails these reads; say so rather than
    // showing an empty tab.
    setRechargeErr(rrErr?.message || rateErr?.message || '')
    setRecharges(rr || [])
    setRates(rates || [])
    setPaidRows((paid || []).map(p => ({ ...p, coupon: couponMap[p.coupon_id] || null })))
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Derived, not held: the page filter is the single source of truth for which
  // super centre is in view.
  const selectedSC = useMemo(
    () => centers.find(c => c.id === superCenterId && c.center_type === 'super_center') || null,
    [centers, superCenterId]
  )

  const scLedger = useMemo(() => {
    if (!selectedSC) return []
    let rows = ledger.filter(r => r.super_center_id === selectedSC.id)
    if (startDate) rows = rows.filter(r => r.created_at?.startsWith(startDate))
    if (endDate) rows = rows.filter(r => r.created_at?.startsWith(endDate))
    return rows
  }, [ledger, selectedSC, startDate, endDate])

  const totalCommission = useMemo(() => scLedger.reduce((s, r) => s + Number(r.amount || 0), 0), [scLedger])
  const currentBalance = Number(selectedSC?.commission_balance || 0)

  // The recharges this super centre EARNS on. Not "its own centres" — a centre
  // sits under one super centre but may pay two, so the list is driven by the
  // commission rates, and a centre under someone else still shows here if this
  // super centre is paid on it.
  // The centres this super centre is paid on. Empty is the usual reason the
  // Center Recharges tab looks blank, so it is named rather than inferred.
  const myRates = useMemo(
    () => (selectedSC ? rates.filter(r => r.super_center_id === selectedSC.id) : []),
    [rates, selectedSC]
  )

  const scRecharges = useMemo(() => {
    if (!selectedSC) return []
    const rateFor = new Map(
      rates.filter(r => r.super_center_id === selectedSC.id).map(r => [r.center_id, Number(r.percent)])
    )
    const centerById = new Map(centers.map(c => [c.id, c]))
    return recharges
      .filter(r => rateFor.has(r.center_id))
      .map(r => {
        const pct = rateFor.get(r.center_id) || 0
        const mine = paidRows.find(p => p.recharge_id === r.id && p.super_center_id === selectedSC.id)
        return {
          ...r,
          center: centerById.get(r.center_id),
          pct,
          commission: Math.round((Number(r.amount) || 0) * pct / 100),
          paid: mine || null,
          // Everyone this recharge owes, so the confirm can name them.
          owedTo: rates.filter(x => x.center_id === r.center_id),
        }
      })
  }, [recharges, centers, rates, paidRows, selectedSC])

  async function generateCoupon(row) {
    // One click pays EVERY super centre that earns on this centre, not only the
    // one on screen — the commission is owed to all of them, and minting them
    // separately would be a way to forget one.
    const others = row.owedTo.filter(o => o.super_center_id !== selectedSC.id)
    const nameOf = id => centers.find(c => c.id === id)?.center_name || 'another super center'
    if (!confirm(
      `Generate the commission on ${row.center?.center_name || 'this center'}'s recharge of ${fmt(row.amount)}?\n\n` +
      `${selectedSC.center_name}: ${row.pct}% = ${fmt(row.commission)}\n` +
      others.map(o => `${nameOf(o.super_center_id)}: ${o.percent}% = ${fmt(Math.round((Number(row.amount) || 0) * Number(o.percent) / 100))}`).join('\n') +
      (others.length ? '\n\nAll of the above are paid — the commission is owed to each.' : '') +
      `\n\nNo wallet is debited.`
    )) return
    setGenBusy(row.id)
    const { data, error } = await supabase.rpc('generate_commission_coupons', { p_recharge: row.id })
    setGenBusy(null)
    if (error) {
      const missing = /generate_commission_coupons|PGRST202|42883|schema cache/i.test(error.message || '')
      alert(missing
        ? 'This needs a database update — nothing was created.\n\nPlease run add_commission_recipients.sql in Supabase.'
        : 'Nothing was created:\n\n' + error.message)
      await fetchAll()
      return
    }
    await fetchAll()
    const made = Array.isArray(data) ? data : data ? [data] : []
    alert(made.length
      ? made.map(g => `${g.super_center_name}: coupon ${g.coupon_code} for ${fmt(g.amount)} (${g.percent}%)`).join('\n')
      : 'Nothing was generated.')
  }

  return (
    <div className="space-y-4">
      {loading ? (
        <p className="text-gray-400 text-sm py-8 text-center">Loading…</p>
      ) : !selectedSC ? (
        <p className="text-gray-400 text-sm">
          Pick one super center in the <strong className="text-gray-500">Super Center</strong> filter above
          to view its commission wallet.
        </p>
      ) : (
        <>
          {/* A missing table is a setup problem, not a tab problem — it used to
              be reported only inside Center Recharges, so anyone standing on
              Ledger History saw three zeroes and no reason for them. */}
          {rechargeErr && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-3 text-sm">
              Commission data could not be read: {rechargeErr}
              {/does not exist|relation|schema cache|column/i.test(rechargeErr) &&
                <> — run <strong>add_commission_recipients.sql</strong> in Supabase.</>}
            </div>
          )}

          {/* ---- Summary cards ---- */}
          <div className="grid grid-cols-3 gap-4 max-w-2xl">
            <div className="bg-white border rounded-lg p-4 shadow-sm">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Total Commission</p>
              <p className="text-2xl font-black text-green-700">{fmt(totalCommission)}</p>
            </div>
            <div className="bg-white border rounded-lg p-4 shadow-sm">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Balance (withdrawn)</p>
              <p className="text-2xl font-black text-gray-700">{fmt(currentBalance)}</p>
            </div>
            <div className="bg-white border rounded-lg p-4 shadow-sm">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Outstanding</p>
              <p className="text-2xl font-black text-blue-700">{fmt(totalCommission - currentBalance)}</p>
            </div>
          </div>

          {/* ---- Tab switcher ---- */}
          <div className="flex gap-2 border-b">
            <button
              onClick={() => setTab('history')}
              className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${tab === 'history' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >Ledger History</button>
            <button
              onClick={() => setTab('recharges')}
              className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${tab === 'recharges' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >Center Recharges ({scRecharges.length})</button>
            <button
              onClick={() => setTab('record')}
              className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${tab === 'record' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >Record New Commission</button>
          </div>

          {/* ---- History tab ---- */}
          {tab === 'history' && (
            <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
              {/* Filters */}
              <div className="flex items-end gap-3 p-3 bg-gray-50 border-b flex-wrap">
                <div>
                  <label className="block text-xs font-semibold text-gray-500">From</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                    className="border rounded px-2 py-1 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500">To</label>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                    className="border rounded px-2 py-1 text-sm" />
                </div>
                {(startDate || endDate) && (
                  <button onClick={() => { setStartDate(''); setEndDate('') }}
                    className="text-xs text-blue-600 hover:underline mb-1">Clear filters</button>
                )}
                <div className="ml-auto text-sm text-gray-600">
                  Showing <span className="font-bold">{scLedger.length}</span> entries
                </div>
              </div>

              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2">Date</th>
                    <th className="text-left px-3 py-2">Type</th>
                    <th className="text-left px-3 py-2">Center</th>
                    <th className="text-right px-3 py-2">Charged</th>
                    <th className="text-right px-3 py-2">Base Fee</th>
                    <th className="text-right px-3 py-2">Commission</th>
                    <th className="text-left px-3 py-2">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {scLedger.length === 0 ? (
                    <tr><td colSpan="7" className="text-center text-gray-400 py-8">No transactions yet.</td></tr>
                  ) : scLedger.map(r => {
                    const center = centers.find(c => c.id === r.center_id)
                    return (
                      <tr key={r.id} className="border-t hover:bg-gray-50">
                        <td className="px-3 py-2 whitespace-nowrap">{r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN') : '-'}</td>
                        <td className="px-3 py-2"><span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800">{r.kind}</span></td>
                        <td className="px-3 py-2">{center ? `${center.center_name} (${center.center_code})` : r.center_id?.slice(0, 8) || '-'}</td>
                        <td className="px-3 py-2 text-right">{fmt(r.charged_amount)}</td>
                        <td className="px-3 py-2 text-right">{fmt(r.base_fee)}</td>
                        <td className="px-3 py-2 text-right font-bold text-green-700">+{fmt(r.amount)}</td>
                        <td className="px-3 py-2 text-xs text-gray-500">{r.note || '-'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ---- Center recharges tab ---- */}
          {/* The same list the super centre sees in its own Wallet Summary,
              with the commission columns added: what it works out to, the
              coupon it was paid out as, and whether that coupon is still
              unused. Generate is disabled once a coupon exists, but the
              database enforces one-per-recharge regardless. */}
          {tab === 'recharges' && rechargeErr && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-4 py-3 text-sm">
              Could not read the recharges: {rechargeErr}
              {/commission_coupon_id|column/i.test(rechargeErr) && <> — run <strong>add_commission_coupon.sql</strong> in Supabase.</>}
            </div>
          )}
          {tab === 'recharges' && !rechargeErr && (
            <div className="bg-white border rounded-lg shadow-sm overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2">#</th>
                    <th className="text-left px-3 py-2">Center</th>
                    <th className="text-right px-3 py-2">Amount</th>
                    <th className="text-left px-3 py-2">Notes</th>
                    <th className="text-left px-3 py-2">Requested On</th>
                    <th className="text-left px-3 py-2">Recharge</th>
                    <th className="text-right px-3 py-2">Commission</th>
                    <th className="text-center px-3 py-2">Generate</th>
                    <th className="text-left px-3 py-2">Coupon No</th>
                    <th className="text-left px-3 py-2">Coupon Status</th>
                    <th className="text-center px-3 py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {scRecharges.length === 0 ? (
                    // "Nothing here" has two quite different causes and the old
                    // message covered both, so an unset rate looked like an
                    // empty ledger. The list is driven by RATES, not by which
                    // super centre a centre sits under.
                    <tr><td colSpan="11" className="text-center text-gray-400 py-8">
                      {myRates.length === 0 ? (
                        <>
                          <p className="text-gray-500 font-semibold">No commission rate is set for {selectedSC.center_name}.</p>
                          <p className="text-xs mt-1">
                            Open <strong>Centers</strong>, click the <strong>Commission</strong> cell on a center,
                            and add {selectedSC.center_name} with a percentage. Its recharges then appear here.
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-gray-500 font-semibold">No recharges yet.</p>
                          <p className="text-xs mt-1">
                            {selectedSC.center_name} earns on {myRates.length} center{myRates.length > 1 ? 's' : ''},
                            but {myRates.length > 1 ? 'none of them has' : 'it has not'} made a recharge.
                          </p>
                        </>
                      )}
                    </td></tr>
                  ) : scRecharges.map((r, i) => {
                    const done = !!r.paid
                    const verified = r.status === 'verified'
                    return (
                      <tr key={r.id} className="border-t hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-400 text-xs">{i + 1}</td>
                        <td className="px-3 py-2">
                          <p className="font-semibold text-gray-900">{r.center?.center_name || '—'}</p>
                          {r.center?.center_code && <span className="text-[10px] text-gray-400 font-mono">{r.center.center_code}</span>}
                        </td>
                        <td className="px-3 py-2 text-right font-bold">{fmt(r.amount)}</td>
                        <td className="px-3 py-2 text-xs text-gray-500">{r.notes || '—'}</td>
                        <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">
                          {r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN') : '—'}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                            verified ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}`}>
                            {r.status || 'pending'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span className="font-bold text-green-700">{fmt(r.commission)}</span>
                          <span className="block text-[10px] text-gray-400">{r.pct}%</span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            onClick={() => generateCoupon(r)}
                            disabled={done || !verified || r.commission < 1 || genBusy === r.id}
                            title={done ? `Already generated — ${r.paid?.coupon?.coupon_code || ''}`
                              : !verified ? 'Only a verified recharge earns commission'
                              : r.commission < 1 ? 'No commission % set for this center' : 'Generate commission coupons'}
                            className="px-3 py-1 rounded text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed"
                          >{genBusy === r.id ? '…' : done ? 'Done' : 'Generate'}</button>
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-gray-800">{r.paid?.coupon?.coupon_code || <span className="text-gray-300">—</span>}</td>
                        <td className="px-3 py-2">
                          {!done ? <span className="text-xs text-gray-400">Not generated</span>
                            : r.paid?.coupon?.is_used
                              ? <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-gray-200 text-gray-700">Used</span>
                              : <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-800">Unused</span>}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {r.paid?.coupon?.coupon_code ? (
                            <button onClick={() => navigator.clipboard?.writeText(r.paid.coupon.coupon_code)}
                              title="Copy coupon code"
                              className="text-xs font-semibold text-blue-600 hover:underline">Copy</button>
                          ) : <span className="text-gray-300 text-xs">—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ---- Record tab ---- */}
          {tab === 'record' && (
            <div>
              {recordModal ? (
                <RecordCommissionModal
                  superCenter={selectedSC}
                  onClose={() => setRecordModal(null)}
                  onSaved={() => { setRecordModal(null); fetchAll() }}
                />
              ) : (
                <button
                  onClick={() => setRecordModal(selectedSC)}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-semibold"
                >Record Commission Transaction</button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
