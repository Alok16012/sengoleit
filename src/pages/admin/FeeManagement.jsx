import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import { Plus, Trash2, Save, GraduationCap } from 'lucide-react'

// category types:
//  'entry'    = one-time (Prospectus etc.) — enter amount once
//  'divide'   = enter TOTAL, per-sem = total ÷ sems  (University Fee)
//  'multiply' = enter PER-SEM, total = per-sem × sems (Exam, Form, etc.)

const DEFAULTS = [
  { label: 'Prospectus Fee',      category: 'entry',    amount: 0 },
  { label: 'Enrollment Fee',      category: 'entry',    amount: 0 },
  { label: 'University Fee',      category: 'divide',   amount: 0 },
  { label: 'Form Fee',            category: 'multiply', amount: 0 },
  { label: 'Exam Fee',            category: 'multiply', amount: 0 },
  { label: 'Re-Registration Fee', category: 'multiply', amount: 0 },
]

let _k = 0
const uid = () => ++_k
const keyed = arr => arr.map(i => ({ ...i, _key: uid() }))

export default function FeeManagement() {
  const [programs, setPrograms]   = useState([])
  const [sessions, setSessions]   = useState([])
  const [progId, setProgId]       = useState('')
  const [sessId, setSessId]       = useState('')
  const [totalSems, setTotalSems] = useState(4)
  const [structId, setStructId]   = useState(null)
  const [items, setItems]         = useState([])
  const [loading, setLoading]     = useState(false)
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)

  useEffect(() => {
    supabase.from('programs').select('id, program_name').order('program_name')
      .then(({ data }) => setPrograms(data || []))
    supabase.from('academic_sessions').select('id, session_name').order('session_name', { ascending: false })
      .then(({ data }) => setSessions(data || []))
  }, [])

  useEffect(() => {
    if (!progId) { setItems([]); setStructId(null); setSaved(false); return }
    load()
  }, [progId, sessId])

  async function load() {
    setLoading(true); setSaved(false)
    let q = supabase.from('fee_structures')
      .select('*, fee_items(id, label, category, amount, sort_order)')
      .eq('program_id', progId)
    q = sessId ? q.eq('session_id', sessId) : q.is('session_id', null)
    const { data } = await q.maybeSingle()
    if (data) {
      setStructId(data.id)
      setTotalSems(data.total_semesters || 4)
      const sorted = [...(data.fee_items || [])].sort((a, b) => a.sort_order - b.sort_order)
      setItems(sorted.map(i => ({ ...i, _key: uid() })))
      setSaved(true)
    } else {
      setStructId(null); setTotalSems(4)
      setItems(keyed(DEFAULTS))
    }
    setLoading(false)
  }

  const add = cat => setItems(p => [...p, { label: '', category: cat, amount: 0, _key: uid() }])
  const upd = (key, field, val) => setItems(p => p.map(i => i._key === key ? { ...i, [field]: val } : i))
  const del = key => setItems(p => p.filter(i => i._key !== key))

  async function handleSave() {
    if (!progId) return
    setSaving(true); setSaved(false)
    let sid = structId
    if (!sid) {
      const { data } = await supabase.from('fee_structures').insert({
        program_id: progId, session_id: sessId || null, total_semesters: totalSems,
      }).select('id').single()
      sid = data?.id
    } else {
      await supabase.from('fee_structures').update({ session_id: sessId || null, total_semesters: totalSems }).eq('id', sid)
    }
    if (!sid) { setSaving(false); return }
    await supabase.from('fee_items').delete().eq('fee_structure_id', sid)
    const valid = items.filter(i => i.label.trim())
    if (valid.length) {
      await supabase.from('fee_items').insert(
        valid.map((i, idx) => ({
          fee_structure_id: sid, label: i.label.trim(),
          category: i.category, amount: parseFloat(i.amount) || 0, sort_order: idx,
        }))
      )
    }
    setStructId(sid); setSaving(false); setSaved(true)
  }

  /* ── derived numbers ── */
  const entryItems    = items.filter(i => i.category === 'entry')
  const divideItems   = items.filter(i => i.category === 'divide')
  const multiplyItems = items.filter(i => i.category === 'multiply')

  const entryTotal   = entryItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)
  // divide: amount = full course total, per sem = amount/sems
  const dividePerSem = divideItems.reduce((s, i) => s + (parseFloat(i.amount) || 0) / (totalSems || 1), 0)
  const divideTotal  = divideItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)
  // multiply: amount = per sem, total = amount × sems
  const multiplyPerSem  = multiplyItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)
  const multiplyTotal   = multiplyPerSem * totalSems

  const perSem     = dividePerSem + multiplyPerSem
  const grandTotal = entryTotal + divideTotal + multiplyTotal

  const progName = programs.find(p => p.id === progId)?.program_name || ''

  const fmt = n => n % 1 === 0 ? n.toLocaleString() : n.toFixed(2)

  return (
    <div className="p-6">
      <PageHeader title="Fee Management" subtitle="Program-wise fee structure" />

      {/* Selectors */}
      <div className="flex flex-wrap gap-3 mb-6 items-center">
        <select className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#933d18] bg-white min-w-[220px]"
          value={progId} onChange={e => setProgId(e.target.value)}>
          <option value="">— Select Program —</option>
          {programs.map(p => <option key={p.id} value={p.id}>{p.program_name}</option>)}
        </select>
        <select className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#933d18] bg-white"
          value={sessId} onChange={e => setSessId(e.target.value)}>
          <option value="">All Sessions</option>
          {sessions.map(s => <option key={s.id} value={s.id}>{s.session_name}</option>)}
        </select>
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2.5">
          <span className="text-sm text-gray-500 whitespace-nowrap">Total Semesters</span>
          <select className="text-sm font-black text-[#933d18] focus:outline-none bg-transparent"
            value={totalSems} onChange={e => setTotalSems(Number(e.target.value))}>
            {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        {progId && (
          <Button onClick={handleSave} disabled={saving}>
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
        <>
          {/* ── 3 input columns ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">

            {/* ONE-TIME */}
            <FeeCol
              title="One-time Fees" badge="entry"
              hint="Paid once at admission (e.g. Prospectus)"
              headerCls="bg-amber-500" footerCls="bg-amber-50 border-amber-100"
              textCls="text-amber-700" addCls="text-amber-600 border-amber-300 hover:bg-amber-50"
              items={entryItems} totalLabel="One-time Total" total={entryTotal} fmt={fmt}
              onAdd={() => add('entry')} onUpd={upd} onDel={del}
              colRight="Amount"
            />

            {/* DIVIDE (University Fee) */}
            <FeeCol
              title="University Fee" badge="÷ sems"
              hint={`Enter total → ÷ ${totalSems} = per sem`}
              headerCls="bg-[#933d18]" footerCls="bg-[#fef9f6] border-[#f0e6df]"
              textCls="text-[#933d18]" addCls="text-[#933d18] border-[#933d18]/30 hover:bg-[#933d18]/5"
              items={divideItems} totalLabel={`Per Sem (÷${totalSems})`}
              total={dividePerSem} fmt={fmt}
              onAdd={() => add('divide')} onUpd={upd} onDel={del}
              colRight="Total Amount" showPerSem totalSems={totalSems}
            />

            {/* MULTIPLY (per-sem fees) */}
            <FeeCol
              title="Per Semester Fees" badge="× sems"
              hint={`Enter per-sem → × ${totalSems} = total`}
              headerCls="bg-indigo-600" footerCls="bg-indigo-50 border-indigo-100"
              textCls="text-indigo-700" addCls="text-indigo-600 border-indigo-300 hover:bg-indigo-50"
              items={multiplyItems} totalLabel={`Per Sem Total`}
              total={multiplyPerSem} fmt={fmt}
              onAdd={() => add('multiply')} onUpd={upd} onDel={del}
              colRight="Per Sem Amount" showTotal totalSems={totalSems}
            />
          </div>

          {/* ── Fee Table (always visible, updates live) ── */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-gray-800">Fee Structure Table</h3>
                <p className="text-xs text-gray-400 mt-0.5">{progName}{sessId ? ` · ${sessions.find(s=>s.id===sessId)?.session_name}` : ''}</p>
              </div>
              <span className="text-xs font-bold text-[#933d18] bg-[#933d18]/8 px-3 py-1 rounded-full">
                Grand Total: ₹{fmt(grandTotal)}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-[#933d18]">
                    <th className="text-left text-white font-semibold px-4 py-2.5 whitespace-nowrap">Fee Component</th>
                    <th className="text-center text-white font-semibold px-3 py-2.5 whitespace-nowrap">Type</th>
                    <th className="text-right text-white font-semibold px-3 py-2.5 whitespace-nowrap">Entry (One-time)</th>
                    {Array.from({ length: totalSems }, (_, i) => (
                      <th key={i} className="text-right text-white font-semibold px-3 py-2.5 whitespace-nowrap">
                        Sem {i + 1}
                      </th>
                    ))}
                    <th className="text-right text-white font-semibold px-4 py-2.5 whitespace-nowrap">Course Total</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Entry rows */}
                  {entryItems.filter(i => i.label).map((item, idx) => (
                    <tr key={item._key} className={idx % 2 === 0 ? 'bg-amber-50/40' : 'bg-white'}>
                      <td className="px-4 py-2 font-medium text-gray-800">{item.label}</td>
                      <td className="px-3 py-2 text-center">
                        <span className="bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded text-[10px]">One-time</span>
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-amber-700">
                        {parseFloat(item.amount) > 0 ? `₹${fmt(parseFloat(item.amount))}` : '—'}
                      </td>
                      {Array.from({ length: totalSems }, (_, i) => (
                        <td key={i} className="px-3 py-2 text-right text-gray-300">—</td>
                      ))}
                      <td className="px-4 py-2 text-right font-bold text-gray-800">
                        {parseFloat(item.amount) > 0 ? `₹${fmt(parseFloat(item.amount))}` : '—'}
                      </td>
                    </tr>
                  ))}

                  {/* Divide rows (University Fee) */}
                  {divideItems.filter(i => i.label).map((item, idx) => {
                    const total = parseFloat(item.amount) || 0
                    const ps = totalSems > 0 ? total / totalSems : 0
                    return (
                      <tr key={item._key} className={idx % 2 === 0 ? 'bg-[#933d18]/5' : 'bg-white'}>
                        <td className="px-4 py-2 font-medium text-gray-800">{item.label}</td>
                        <td className="px-3 py-2 text-center">
                          <span className="bg-[#933d18]/10 text-[#933d18] font-bold px-2 py-0.5 rounded text-[10px]">÷{totalSems}</span>
                        </td>
                        <td className="px-3 py-2 text-right text-gray-300">—</td>
                        {Array.from({ length: totalSems }, (_, i) => (
                          <td key={i} className="px-3 py-2 text-right font-semibold text-[#933d18]">
                            {ps > 0 ? `₹${fmt(ps)}` : '—'}
                          </td>
                        ))}
                        <td className="px-4 py-2 text-right font-bold text-gray-800">
                          {total > 0 ? `₹${fmt(total)}` : '—'}
                        </td>
                      </tr>
                    )
                  })}

                  {/* Multiply rows */}
                  {multiplyItems.filter(i => i.label).map((item, idx) => {
                    const ps = parseFloat(item.amount) || 0
                    const total = ps * totalSems
                    return (
                      <tr key={item._key} className={idx % 2 === 0 ? 'bg-indigo-50/40' : 'bg-white'}>
                        <td className="px-4 py-2 font-medium text-gray-800">{item.label}</td>
                        <td className="px-3 py-2 text-center">
                          <span className="bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded text-[10px]">×{totalSems}</span>
                        </td>
                        <td className="px-3 py-2 text-right text-gray-300">—</td>
                        {Array.from({ length: totalSems }, (_, i) => (
                          <td key={i} className="px-3 py-2 text-right font-semibold text-indigo-700">
                            {ps > 0 ? `₹${fmt(ps)}` : '—'}
                          </td>
                        ))}
                        <td className="px-4 py-2 text-right font-bold text-gray-800">
                          {total > 0 ? `₹${fmt(total)}` : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>

                {/* Totals footer */}
                <tfoot>
                  <tr className="bg-gray-800 border-t-2 border-gray-700">
                    <td className="px-4 py-3 font-black text-white">TOTAL</td>
                    <td className="px-3 py-3"></td>
                    <td className="px-3 py-3 text-right font-black text-amber-300">
                      {entryTotal > 0 ? `₹${fmt(entryTotal)}` : '—'}
                    </td>
                    {Array.from({ length: totalSems }, (_, i) => {
                      const semAmt = i === 0 ? entryTotal + perSem : perSem
                      return (
                        <td key={i} className="px-3 py-3 text-right font-black text-white">
                          ₹{fmt(semAmt)}
                        </td>
                      )
                    })}
                    <td className="px-4 py-3 text-right font-black text-emerald-400">
                      ₹{fmt(grandTotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Summary bar */}
            <div className="flex flex-wrap gap-6 px-5 py-3 bg-gray-50 border-t border-gray-100 text-xs">
              <span className="text-gray-500">Entry: <strong className="text-amber-700">₹{fmt(entryTotal)}</strong></span>
              <span className="text-gray-500">University Fee: <strong className="text-[#933d18]">₹{fmt(dividePerSem)}/sem</strong></span>
              <span className="text-gray-500">Other/sem: <strong className="text-indigo-700">₹{fmt(multiplyPerSem)}</strong></span>
              <span className="text-gray-500">Per Sem Total: <strong className="text-gray-900">₹{fmt(perSem)}</strong></span>
              <span className="text-gray-500">Grand Total: <strong className="text-[#933d18] text-sm">₹{fmt(grandTotal)}</strong></span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/* ── Reusable fee input column ── */
function FeeCol({ title, badge, hint, headerCls, footerCls, textCls, addCls, items, totalLabel, total, fmt, onAdd, onUpd, onDel, colRight, showPerSem, showTotal, totalSems }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden flex flex-col">
      <div className={`${headerCls} px-4 py-3`}>
        <div className="flex items-center gap-2">
          <h3 className="text-white font-bold text-sm">{title}</h3>
          <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{badge}</span>
        </div>
        <p className="text-white/70 text-xs mt-0.5">{hint}</p>
      </div>

      <div className="p-3 flex-1 space-y-2">
        {/* Column headers */}
        <div className="flex gap-2 px-1">
          <span className="flex-1 text-[10px] text-gray-400 font-bold uppercase tracking-wider">Fee Name</span>
          <span className="w-28 text-[10px] text-gray-400 font-bold uppercase tracking-wider text-right">{colRight}</span>
          {(showPerSem || showTotal) && <span className="w-20 text-[10px] text-gray-400 font-bold uppercase tracking-wider text-right">{showPerSem ? 'Per Sem' : 'Total'}</span>}
          <span className="w-4"></span>
        </div>

        {items.map(item => {
          const amt = parseFloat(item.amount) || 0
          const derived = showPerSem
            ? (totalSems > 0 ? amt / totalSems : 0)
            : showTotal ? amt * totalSems : null
          return (
            <div key={item._key} className="flex items-center gap-2">
              <input
                className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-[#933d18]"
                placeholder="Fee name"
                value={item.label}
                onChange={e => onUpd(item._key, 'label', e.target.value)}
              />
              <div className="relative w-28 shrink-0">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">₹</span>
                <input
                  className="w-full border border-gray-200 rounded-lg pl-5 pr-2 py-1.5 text-sm text-right focus:outline-none focus:border-[#933d18]"
                  type="number" min="0"
                  value={item.amount}
                  onChange={e => onUpd(item._key, 'amount', e.target.value)}
                />
              </div>
              {derived !== null && (
                <div className="w-20 text-right shrink-0">
                  <span className={`text-xs font-bold ${textCls}`}>
                    {derived > 0 ? `₹${fmt(derived)}` : '—'}
                  </span>
                </div>
              )}
              <button onClick={() => onDel(item._key)} className="text-red-300 hover:text-red-500 shrink-0 w-4">
                <Trash2 size={13} />
              </button>
            </div>
          )
        })}

        <button onClick={onAdd}
          className={`w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold border border-dashed rounded-lg transition-colors mt-1 ${addCls}`}>
          <Plus size={13} /> Add Fee
        </button>
      </div>

      <div className={`px-4 py-2.5 border-t flex justify-between text-sm ${footerCls}`}>
        <span className={`font-semibold ${textCls}`}>{totalLabel}</span>
        <span className={`font-black ${textCls}`}>₹{fmt(total)}</span>
      </div>
    </div>
  )
}
