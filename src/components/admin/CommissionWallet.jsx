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
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('history')                   // 'history' | 'record'
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

    setCenters(ctr || [])
    setLedger(led || [])
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
