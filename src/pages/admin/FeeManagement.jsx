import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import { Plus, Trash2, Save, GraduationCap } from 'lucide-react'

const DEFAULT_ENTRY = [
  { label: 'Registration Fee',   category: 'entry', amount: 0 },
  { label: 'Enrollment Fee',     category: 'entry', amount: 0 },
]

const DEFAULT_SEM = [
  { label: 'University Fee',     category: 'semester', amount: 0 },
  { label: 'Prospectus Fee',     category: 'semester', amount: 0 },
  { label: 'Exam Fee',           category: 'semester', amount: 0 },
  { label: 'Re-Registration Fee',category: 'semester', amount: 0 },
]

let _uid = 0
function uid() { return ++_uid }
function keyed(arr) { return arr.map(i => ({ ...i, _key: uid() })) }

export default function FeeManagement() {
  const [programs, setPrograms]     = useState([])
  const [sessions, setSessions]     = useState([])
  const [progId, setProgId]         = useState('')
  const [sessId, setSessId]         = useState('')
  const [totalSems, setTotalSems]   = useState(4)
  const [structureId, setStructId]  = useState(null)
  const [items, setItems]           = useState([])
  const [loading, setLoading]       = useState(false)
  const [saving, setSaving]         = useState(false)
  const [saved, setSaved]           = useState(false)

  useEffect(() => {
    supabase.from('programs').select('id, program_name').order('program_name')
      .then(({ data }) => setPrograms(data || []))
    supabase.from('academic_sessions').select('id, session_name').order('session_name', { ascending: false })
      .then(({ data }) => setSessions(data || []))
  }, [])

  useEffect(() => {
    if (!progId) { setItems([]); setStructId(null); return }
    load()
  }, [progId, sessId])

  async function load() {
    setLoading(true)
    let q = supabase
      .from('fee_structures')
      .select('*, fee_items(id, label, category, amount, sort_order)')
      .eq('program_id', progId)
    q = sessId ? q.eq('session_id', sessId) : q.is('session_id', null)
    const { data } = await q.maybeSingle()

    if (data) {
      setStructId(data.id)
      setTotalSems(data.total_semesters || 4)
      const sorted = [...(data.fee_items || [])].sort((a, b) => a.sort_order - b.sort_order)
      setItems(sorted.map(i => ({ ...i, _key: uid() })))
    } else {
      setStructId(null)
      setTotalSems(4)
      setItems(keyed([...DEFAULT_ENTRY, ...DEFAULT_SEM]))
    }
    setLoading(false)
  }

  function addItem(cat) {
    setItems(p => [...p, { label: '', category: cat, amount: 0, _key: uid() }])
  }

  function upd(key, field, val) {
    setItems(p => p.map(i => i._key === key ? { ...i, [field]: val } : i))
  }

  function del(key) {
    setItems(p => p.filter(i => i._key !== key))
  }

  async function save() {
    if (!progId) return
    setSaving(true); setSaved(false)
    let sid = structureId
    if (!sid) {
      const { data } = await supabase.from('fee_structures').insert({
        program_id: progId,
        session_id: sessId || null,
        total_semesters: totalSems,
      }).select('id').single()
      sid = data?.id
    } else {
      await supabase.from('fee_structures').update({
        session_id: sessId || null,
        total_semesters: totalSems,
      }).eq('id', sid)
    }
    if (!sid) { setSaving(false); return }
    await supabase.from('fee_items').delete().eq('fee_structure_id', sid)
    const valid = items.filter(i => i.label.trim())
    if (valid.length) {
      await supabase.from('fee_items').insert(
        valid.map((i, idx) => ({
          fee_structure_id: sid,
          label: i.label.trim(),
          category: i.category,
          amount: parseFloat(i.amount) || 0,
          sort_order: idx,
        }))
      )
    }
    setStructId(sid)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  /* ---- calculations ---- */
  const entryItems  = items.filter(i => i.category === 'entry')
  const semItems    = items.filter(i => i.category === 'semester')
  const entryTotal  = entryItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)
  // semester items store TOTAL amount; divide by sems to get per-sem
  const semTotal    = semItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)
  const perSem      = totalSems > 0 ? semTotal / totalSems : 0
  const grandTotal  = entryTotal + semTotal

  const progName = programs.find(p => p.id === progId)?.program_name || ''

  return (
    <div className="p-6">
      <PageHeader title="Fee Management" subtitle="Program-wise fee structure" />

      {/* Selectors */}
      <div className="flex flex-wrap gap-3 mb-6 items-center">
        <select
          className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#933d18] bg-white min-w-[220px]"
          value={progId} onChange={e => setProgId(e.target.value)}
        >
          <option value="">— Select Program —</option>
          {programs.map(p => <option key={p.id} value={p.id}>{p.program_name}</option>)}
        </select>

        <select
          className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#933d18] bg-white"
          value={sessId} onChange={e => setSessId(e.target.value)}
        >
          <option value="">All Sessions</option>
          {sessions.map(s => <option key={s.id} value={s.id}>{s.session_name}</option>)}
        </select>

        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2.5">
          <span className="text-sm text-gray-500 whitespace-nowrap">Total Semesters</span>
          <select
            className="text-sm font-black text-[#933d18] focus:outline-none bg-transparent"
            value={totalSems} onChange={e => setTotalSems(Number(e.target.value))}
          >
            {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>

        {progId && (
          <Button onClick={save} disabled={saving}>
            <Save size={14} />
            {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save'}
          </Button>
        )}
      </div>

      {!progId ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-300">
          <GraduationCap size={52} className="mb-3" />
          <p className="text-base font-semibold text-gray-400">Select a program to configure fees</p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* ── Entry Fees ── */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden flex flex-col">
            <div className="bg-amber-500 px-4 py-3">
              <h3 className="text-white font-bold text-sm">Entry Fees</h3>
              <p className="text-amber-100 text-xs mt-0.5">One-time at admission (not divided)</p>
            </div>
            <div className="p-3 flex-1 space-y-2">
              {entryItems.map(item => (
                <div key={item._key} className="flex items-center gap-2">
                  <input
                    className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-[#933d18]"
                    placeholder="Fee name"
                    value={item.label}
                    onChange={e => upd(item._key, 'label', e.target.value)}
                  />
                  <AmountInput value={item.amount} onChange={v => upd(item._key, 'amount', v)} />
                  <button onClick={() => del(item._key)} className="text-red-300 hover:text-red-500 shrink-0">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <AddBtn label="Add Entry Fee" color="amber" onClick={() => addItem('entry')} />
            </div>
            <div className="bg-amber-50 px-4 py-2.5 border-t border-amber-100 flex justify-between text-sm">
              <span className="text-amber-700 font-semibold">Entry Total</span>
              <span className="font-black text-amber-800">₹{entryTotal.toLocaleString()}</span>
            </div>
          </div>

          {/* ── Semester Fees ── */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden flex flex-col">
            <div className="bg-[#933d18] px-4 py-3">
              <h3 className="text-white font-bold text-sm">Semester Fees</h3>
              <p className="text-[#f0c9b0] text-xs mt-0.5">
                Enter TOTAL amount → ÷ {totalSems} sem = per semester
              </p>
            </div>
            <div className="p-3 flex-1">
              {/* Table header */}
              <div className="flex items-center gap-2 mb-2 px-1">
                <span className="flex-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Fee Name</span>
                <span className="w-28 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Total Amt</span>
                <span className="w-20 text-[10px] font-bold text-gray-400 uppercase tracking-wider text-right">Per Sem</span>
                <span className="w-5"></span>
              </div>
              <div className="space-y-2">
                {semItems.map(item => {
                  const perSemAmt = totalSems > 0 ? (parseFloat(item.amount) || 0) / totalSems : 0
                  return (
                    <div key={item._key} className="flex items-center gap-2">
                      <input
                        className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-[#933d18]"
                        placeholder="Fee name"
                        value={item.label}
                        onChange={e => upd(item._key, 'label', e.target.value)}
                      />
                      <AmountInput value={item.amount} onChange={v => upd(item._key, 'amount', v)} />
                      <div className="w-20 text-right shrink-0">
                        <span className="text-xs font-bold text-emerald-700">
                          ₹{perSemAmt % 1 === 0 ? perSemAmt.toLocaleString() : perSemAmt.toFixed(2)}
                        </span>
                      </div>
                      <button onClick={() => del(item._key)} className="text-red-300 hover:text-red-500 shrink-0">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )
                })}
              </div>
              <AddBtn label="Add Semester Fee" color="brand" onClick={() => addItem('semester')} />
            </div>
            <div className="bg-[#fef9f6] px-4 py-2.5 border-t border-[#f0e6df]">
              <div className="flex justify-between text-sm">
                <span className="text-[#933d18] font-semibold">
                  Total ÷ {totalSems} =
                </span>
                <div className="text-right">
                  <p className="text-xs text-gray-400">Total: ₹{semTotal.toLocaleString()}</p>
                  <p className="font-black text-[#933d18]">
                    ₹{perSem % 1 === 0 ? perSem.toLocaleString() : perSem.toFixed(2)}/sem
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Summary ── */}
          <div className="space-y-4">
            {/* Grand total */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="bg-gray-800 px-4 py-3">
                <h3 className="text-white font-bold text-sm">Fee Summary</h3>
                <p className="text-gray-400 text-xs truncate">{progName}</p>
              </div>
              <div className="p-4 space-y-3 text-sm">
                <Row label="Entry Fees (one-time)"       val={`₹${entryTotal.toLocaleString()}`} />
                <Row label="Semester Fees (total course)" val={`₹${semTotal.toLocaleString()}`} />
                <Row
                  label={`Per Semester (÷${totalSems})`}
                  val={`₹${perSem % 1 === 0 ? perSem.toLocaleString() : perSem.toFixed(2)}`}
                  highlight
                />
                <div className="border-t border-gray-100 pt-3 flex justify-between items-center">
                  <span className="font-bold text-gray-900">Grand Total</span>
                  <span className="text-2xl font-black text-[#933d18]">₹{grandTotal.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Semester-wise breakdown */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <h3 className="font-bold text-gray-800 text-sm">Semester-wise Payment</h3>
                <p className="text-xs text-gray-400 mt-0.5">Entry fees only in Sem 1</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-3 py-2 text-gray-400 font-semibold">Sem</th>
                      <th className="text-right px-3 py-2 text-gray-400 font-semibold">Fee</th>
                      <th className="text-right px-3 py-2 text-gray-400 font-semibold">Cumulative</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: totalSems }, (_, i) => {
                      const isFirst = i === 0
                      const semFee  = isFirst ? entryTotal + perSem : perSem
                      const cumul   = entryTotal + perSem * (i + 1)
                      return (
                        <tr key={i} className={`border-b border-gray-50 ${isFirst ? 'bg-amber-50/40' : ''}`}>
                          <td className="px-3 py-2 font-semibold text-gray-700">
                            Sem {i + 1}{isFirst ? ' *' : ''}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-gray-700">
                            ₹{semFee % 1 === 0 ? semFee.toLocaleString() : semFee.toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-[#933d18]">
                            ₹{cumul % 1 === 0 ? cumul.toLocaleString() : cumul.toFixed(2)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 bg-gray-50">
                      <td className="px-3 py-2 font-black text-gray-900" colSpan={2}>Grand Total</td>
                      <td className="px-3 py-2 text-right font-black text-[#933d18]">
                        ₹{grandTotal.toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
                <p className="text-[10px] text-gray-400 px-3 pb-2">* Sem 1 includes one-time entry fees</p>
              </div>
            </div>

            {/* Per-fee breakdown per semester */}
            {semItems.some(i => i.label && parseFloat(i.amount) > 0) && (
              <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <h3 className="font-bold text-gray-800 text-sm">Per Semester Breakdown</h3>
                </div>
                <div className="p-3 space-y-1.5">
                  {entryItems.filter(i => i.label && parseFloat(i.amount) > 0).map(i => (
                    <div key={i._key} className="flex justify-between text-xs">
                      <span className="text-gray-500">
                        {i.label}
                        <span className="ml-1 text-[10px] font-bold text-amber-500">(one-time)</span>
                      </span>
                      <span className="font-semibold text-gray-700">₹{Number(i.amount).toLocaleString()}</span>
                    </div>
                  ))}
                  {semItems.filter(i => i.label && parseFloat(i.amount) > 0).map(i => {
                    const ps = totalSems > 0 ? (parseFloat(i.amount) || 0) / totalSems : 0
                    return (
                      <div key={i._key} className="flex justify-between text-xs">
                        <span className="text-gray-500">
                          {i.label}
                          <span className="ml-1 text-[10px] text-gray-400">÷{totalSems}</span>
                        </span>
                        <span className="font-semibold text-[#933d18]">
                          ₹{ps % 1 === 0 ? ps.toLocaleString() : ps.toFixed(2)}/sem
                        </span>
                      </div>
                    )
                  })}
                  <div className="border-t border-gray-100 pt-1.5 flex justify-between text-xs font-bold">
                    <span className="text-gray-700">Total per semester</span>
                    <span className="text-[#933d18]">
                      ₹{perSem % 1 === 0 ? perSem.toLocaleString() : perSem.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  )
}

function AmountInput({ value, onChange }) {
  return (
    <div className="relative w-28 shrink-0">
      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">₹</span>
      <input
        className="w-full border border-gray-200 rounded-lg pl-5 pr-2 py-1.5 text-sm text-right focus:outline-none focus:border-[#933d18]"
        type="number" min="0"
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  )
}

function AddBtn({ label, color, onClick }) {
  const cls = color === 'amber'
    ? 'text-amber-600 border-amber-300 hover:bg-amber-50'
    : 'text-[#933d18] border-[#933d18]/30 hover:bg-[#933d18]/5'
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold border border-dashed rounded-lg transition-colors mt-2 ${cls}`}
    >
      <Plus size={13} /> {label}
    </button>
  )
}

function Row({ label, val, highlight }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-500">{label}</span>
      <span className={`font-bold ${highlight ? 'text-emerald-700' : 'text-gray-800'}`}>{val}</span>
    </div>
  )
}
