import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import { Plus, Trash2, Save, GraduationCap, Pencil, List, Eye, Download, X } from 'lucide-react'
import { generateFeePDF } from '../../utils/generateFeePDF'

// category types:
//  'entry'    = one-time (Prospectus etc.)
//  'divide'   = enter TOTAL, per-sem = total ÷ sems  (University Fee)
//  'multiply' = enter PER-SEM, total = per-sem × sems (Exam, Form etc.)

const DEFAULTS = [
  { label: 'Prospectus Fee',       category: 'entry',    amount: 0 },
  { label: 'Enrollment Fee',       category: 'entry',    amount: 0 },
  { label: 'University Fee',       category: 'divide',   amount: 0 },
  { label: 'Form Fee',             category: 'multiply', amount: 0 },
  { label: 'Exam Fee',             category: 'multiply', amount: 0 },
  { label: 'Re-Registration Fee',  category: 'multiply', amount: 0 },
]

let _k = 0
const uid   = () => ++_k
const keyed = arr => arr.map(i => ({ ...i, _key: uid() }))
const fmt   = n => (n % 1 === 0 ? n.toLocaleString() : n.toFixed(2))

/* ─────────────────────────────────────────
   helpers to compute totals from fee_items
───────────────────────────────────────── */
function calcTotals(feeItems, totalSems) {
  const sems = totalSems || 1
  let entryTotal = 0, divideTotal = 0, multiplyPerSem = 0
  ;(feeItems || []).forEach(i => {
    const a = parseFloat(i.amount) || 0
    if (i.category === 'entry')    entryTotal    += a
    if (i.category === 'divide')   divideTotal   += a
    if (i.category === 'multiply') multiplyPerSem += a
  })
  const dividePerSem  = divideTotal / sems
  const perSem        = dividePerSem + multiplyPerSem
  const grandTotal    = entryTotal + divideTotal + multiplyPerSem * sems
  return { entryTotal, divideTotal, dividePerSem, multiplyPerSem, perSem, grandTotal }
}

/* ═══════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════ */
export default function FeeManagement() {
  const [tab, setTab]           = useState('master')   // 'master' | 'editor'
  const [masterList, setMasterList] = useState([])
  const [masterLoading, setMasterLoading] = useState(true)
  const [viewStruct, setViewStruct] = useState(null)

  // editor state
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
    fetchMaster()
    supabase.from('programs').select('id, program_name').order('program_name')
      .then(({ data }) => setPrograms(data || []))
    supabase.from('academic_sessions').select('id, session_name').order('session_name', { ascending: false })
      .then(({ data }) => setSessions(data || []))
  }, [])

  async function fetchMaster() {
    setMasterLoading(true)
    const { data } = await supabase
      .from('fee_structures')
      .select('id, total_semesters, program_id, session_id, programs(program_name), academic_sessions(session_name), fee_items(label, category, amount)')
      .order('created_at', { ascending: false })
    setMasterList(data || [])
    setMasterLoading(false)
  }

  async function handleDeleteStruct(id) {
    if (!confirm('Delete this fee structure? This cannot be undone.')) return
    await supabase.from('fee_structures').delete().eq('id', id)
    fetchMaster()
  }

  function openEditor(struct = null) {
    if (struct) {
      setProgId(struct.program_id)
      setSessId(struct.session_id || '')
      setTotalSems(struct.total_semesters || 4)
      setStructId(struct.id)
      const sorted = [...(struct.fee_items || [])].sort((a, b) => a.sort_order - b.sort_order)
      setItems(sorted.map(i => ({ ...i, _key: uid() })))
      setSaved(true)
    } else {
      setProgId(''); setSessId(''); setTotalSems(4)
      setStructId(null); setItems(keyed(DEFAULTS)); setSaved(false)
    }
    setTab('editor')
  }

  useEffect(() => {
    if (tab !== 'editor' || !progId) return
    if (!structId) load()
  }, [progId, sessId])

  async function load() {
    setLoading(true); setSaved(false)
    let q = supabase.from('fee_structures')
      .select('*, fee_items(id, label, category, amount, sort_order)')
      .eq('program_id', progId)
    q = sessId ? q.eq('session_id', sessId) : q.is('session_id', null)
    const { data } = await q.maybeSingle()
    if (data) {
      setStructId(data.id); setTotalSems(data.total_semesters || 4)
      const sorted = [...(data.fee_items || [])].sort((a, b) => a.sort_order - b.sort_order)
      setItems(sorted.map(i => ({ ...i, _key: uid() })))
      setSaved(true)
    } else {
      setStructId(null); setTotalSems(4); setItems(keyed(DEFAULTS))
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
    fetchMaster() // refresh master list
  }

  /* ── editor derived totals ── */
  const entryItems    = items.filter(i => i.category === 'entry')
  const divideItems   = items.filter(i => i.category === 'divide')
  const multiplyItems = items.filter(i => i.category === 'multiply')
  const entryTotal    = entryItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)
  const dividePerSem  = divideItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0) / (totalSems || 1)
  const divideTotal   = divideItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)
  const multiplyPerSem = multiplyItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)
  const perSem        = dividePerSem + multiplyPerSem
  const grandTotal    = entryTotal + divideTotal + multiplyPerSem * totalSems
  const progName      = programs.find(p => p.id === progId)?.program_name || ''

  return (
    <div className="p-6">
      <PageHeader title="Fee Management" subtitle="Program-wise fee structure" />

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        {[
          { key: 'master', label: 'Fee Master', icon: <List size={14} /> },
          { key: 'editor', label: 'Add / Edit Fee', icon: <Plus size={14} /> },
        ].map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); if (t.key === 'editor' && !progId) { setItems(keyed(DEFAULTS)); setSaved(false) } }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === t.key ? 'bg-white text-[#933d18] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.icon} {t.label}
            {t.key === 'master' && masterList.length > 0 && (
              <span className="bg-[#933d18] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1">{masterList.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ══════════════ FEE MASTER TAB ══════════════ */}
      {tab === 'master' && (
        masterLoading ? (
          <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Loading...</div>
        ) : masterList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-300">
            <GraduationCap size={52} className="mb-3" />
            <p className="text-base font-semibold text-gray-400">Koi fee structure save nahi hua abhi tak</p>
            <button onClick={() => openEditor()} className="mt-4 bg-[#933d18] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#7a3214]">
              + Add Fee Structure
            </button>
          </div>
        ) : (
          <>
            <div className="flex justify-end mb-4">
              <Button onClick={() => openEditor()}>
                <Plus size={14} /> Add New Fee Structure
              </Button>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#933d18]">
                    <th className="text-left text-white font-semibold px-4 py-3">#</th>
                    <th className="text-left text-white font-semibold px-4 py-3">Program</th>
                    <th className="text-left text-white font-semibold px-4 py-3">Session</th>
                    <th className="text-center text-white font-semibold px-4 py-3">Semesters</th>
                    <th className="text-right text-white font-semibold px-4 py-3">Entry Fees</th>
                    <th className="text-right text-white font-semibold px-4 py-3">Per Sem</th>
                    <th className="text-right text-white font-semibold px-4 py-3">Grand Total</th>
                    <th className="text-center text-white font-semibold px-4 py-3 whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {masterList.map((struct, i) => {
                    const t = calcTotals(struct.fee_items, struct.total_semesters)
                    return (
                      <tr key={struct.id} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                        <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-gray-900">{struct.programs?.program_name || '—'}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{struct.fee_items?.length || 0} fee components</p>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {struct.academic_sessions?.session_name || <span className="text-gray-300">All Sessions</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="bg-gray-100 text-gray-700 font-bold text-xs px-2.5 py-1 rounded-full">
                            {struct.total_semesters} Sem
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-amber-700 font-semibold text-xs">
                          ₹{fmt(t.entryTotal)}
                        </td>
                        <td className="px-4 py-3 text-right text-[#933d18] font-semibold text-xs">
                          ₹{fmt(t.perSem)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-black text-gray-900">₹{fmt(t.grandTotal)}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button onClick={() => setViewStruct(struct)} title="View"
                              className="flex items-center gap-1 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg transition-colors">
                              <Eye size={12} /> View
                            </button>
                            <button onClick={() => generateFeePDF(struct)} title="Download PDF"
                              className="flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 rounded-lg transition-colors">
                              <Download size={12} /> PDF
                            </button>
                            <button onClick={() => openEditor(struct)} title="Edit"
                              className="flex items-center gap-1 text-xs font-semibold text-[#933d18] bg-[#933d18]/8 hover:bg-[#933d18]/15 px-2.5 py-1.5 rounded-lg transition-colors">
                              <Pencil size={12} /> Edit
                            </button>
                            <button onClick={() => handleDeleteStruct(struct.id)} title="Delete"
                              className="flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg transition-colors">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 border-t-2 border-gray-200">
                    <td colSpan={4} className="px-4 py-3 font-bold text-gray-700 text-sm">
                      Total ({masterList.length} programs)
                    </td>
                    <td className="px-4 py-3 text-right font-black text-amber-700">
                      ₹{fmt(masterList.reduce((s, st) => s + calcTotals(st.fee_items, st.total_semesters).entryTotal, 0))}
                    </td>
                    <td className="px-4 py-3"></td>
                    <td className="px-4 py-3 text-right font-black text-[#933d18]">
                      —
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )
      )}

      {/* ══════════════ VIEW MODAL ══════════════ */}
      {viewStruct && <FeeViewModal struct={viewStruct} onClose={() => setViewStruct(null)} onPDF={() => generateFeePDF(viewStruct)} />}

      {/* ══════════════ EDITOR TAB ══════════════ */}
      {tab === 'editor' && (
        <>
          {/* Selectors */}
          <div className="flex flex-wrap gap-3 mb-6 items-center">
            <select className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#933d18] bg-white min-w-[220px]"
              value={progId} onChange={e => { setProgId(e.target.value); setStructId(null); setSaved(false) }}>
              <option value="">— Select Program —</option>
              {programs.map(p => <option key={p.id} value={p.id}>{p.program_name}</option>)}
            </select>
            <select className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#933d18] bg-white"
              value={sessId} onChange={e => { setSessId(e.target.value); setStructId(null); setSaved(false) }}>
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
              {/* 3 input columns */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
                <FeeCol title="One-time Fees" badge="entry"
                  hint="Paid once at admission (e.g. Prospectus)"
                  headerCls="bg-amber-500" footerCls="bg-amber-50 border-amber-100"
                  textCls="text-amber-700" addCls="text-amber-600 border-amber-300 hover:bg-amber-50"
                  items={entryItems} totalLabel="One-time Total" total={entryTotal}
                  onAdd={() => add('entry')} onUpd={upd} onDel={del}
                  colRight="Amount" />

                <FeeCol title="University Fee" badge="÷ sems"
                  hint={`Enter total → ÷ ${totalSems} = per sem`}
                  headerCls="bg-[#933d18]" footerCls="bg-[#fef9f6] border-[#f0e6df]"
                  textCls="text-[#933d18]" addCls="text-[#933d18] border-[#933d18]/30 hover:bg-[#933d18]/5"
                  items={divideItems} totalLabel={`Per Sem (÷${totalSems})`} total={dividePerSem}
                  onAdd={() => add('divide')} onUpd={upd} onDel={del}
                  colRight="Total Amount" showPerSem totalSems={totalSems} />

                <FeeCol title="Per Semester Fees" badge="× sems"
                  hint={`Enter per-sem → × ${totalSems} = total`}
                  headerCls="bg-indigo-600" footerCls="bg-indigo-50 border-indigo-100"
                  textCls="text-indigo-700" addCls="text-indigo-600 border-indigo-300 hover:bg-indigo-50"
                  items={multiplyItems} totalLabel="Per Sem Total" total={multiplyPerSem}
                  onAdd={() => add('multiply')} onUpd={upd} onDel={del}
                  colRight="Per Sem Amount" showTotal totalSems={totalSems} />
              </div>

              {/* Fee Structure Table */}
              <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                  <div>
                    <h3 className="font-bold text-gray-800">Fee Structure Table</h3>
                    <p className="text-xs text-gray-400 mt-0.5">{progName}</p>
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
                        <th className="text-center text-white font-semibold px-3 py-2.5">Type</th>
                        <th className="text-right text-white font-semibold px-3 py-2.5 whitespace-nowrap">Entry</th>
                        {Array.from({ length: totalSems }, (_, i) => (
                          <th key={i} className="text-right text-white font-semibold px-3 py-2.5 whitespace-nowrap">Sem {i+1}</th>
                        ))}
                        <th className="text-right text-white font-semibold px-4 py-2.5 whitespace-nowrap">Course Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entryItems.filter(i => i.label).map((item, idx) => (
                        <tr key={item._key} className={idx % 2 === 0 ? 'bg-amber-50/40' : 'bg-white'}>
                          <td className="px-4 py-2 font-medium text-gray-800">{item.label}</td>
                          <td className="px-3 py-2 text-center"><span className="bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded text-[10px]">One-time</span></td>
                          <td className="px-3 py-2 text-right font-semibold text-amber-700">{parseFloat(item.amount) > 0 ? `₹${fmt(parseFloat(item.amount))}` : '—'}</td>
                          {Array.from({ length: totalSems }, (_, i) => <td key={i} className="px-3 py-2 text-right text-gray-300">—</td>)}
                          <td className="px-4 py-2 text-right font-bold text-gray-800">{parseFloat(item.amount) > 0 ? `₹${fmt(parseFloat(item.amount))}` : '—'}</td>
                        </tr>
                      ))}
                      {divideItems.filter(i => i.label).map((item, idx) => {
                        const total = parseFloat(item.amount) || 0
                        const ps = totalSems > 0 ? total / totalSems : 0
                        return (
                          <tr key={item._key} className={idx % 2 === 0 ? 'bg-[#933d18]/5' : 'bg-white'}>
                            <td className="px-4 py-2 font-medium text-gray-800">{item.label}</td>
                            <td className="px-3 py-2 text-center"><span className="bg-[#933d18]/10 text-[#933d18] font-bold px-2 py-0.5 rounded text-[10px]">÷{totalSems}</span></td>
                            <td className="px-3 py-2 text-right text-gray-300">—</td>
                            {Array.from({ length: totalSems }, (_, i) => <td key={i} className="px-3 py-2 text-right font-semibold text-[#933d18]">{ps > 0 ? `₹${fmt(ps)}` : '—'}</td>)}
                            <td className="px-4 py-2 text-right font-bold text-gray-800">{total > 0 ? `₹${fmt(total)}` : '—'}</td>
                          </tr>
                        )
                      })}
                      {multiplyItems.filter(i => i.label).map((item, idx) => {
                        const ps = parseFloat(item.amount) || 0
                        return (
                          <tr key={item._key} className={idx % 2 === 0 ? 'bg-indigo-50/40' : 'bg-white'}>
                            <td className="px-4 py-2 font-medium text-gray-800">{item.label}</td>
                            <td className="px-3 py-2 text-center"><span className="bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded text-[10px]">×{totalSems}</span></td>
                            <td className="px-3 py-2 text-right text-gray-300">—</td>
                            {Array.from({ length: totalSems }, (_, i) => <td key={i} className="px-3 py-2 text-right font-semibold text-indigo-700">{ps > 0 ? `₹${fmt(ps)}` : '—'}</td>)}
                            <td className="px-4 py-2 text-right font-bold text-gray-800">{ps > 0 ? `₹${fmt(ps * totalSems)}` : '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-800 border-t-2 border-gray-700">
                        <td className="px-4 py-3 font-black text-white">TOTAL</td>
                        <td className="px-3 py-3"></td>
                        <td className="px-3 py-3 text-right font-black text-amber-300">{entryTotal > 0 ? `₹${fmt(entryTotal)}` : '—'}</td>
                        {Array.from({ length: totalSems }, (_, i) => {
                          const semAmt = i === 0 ? entryTotal + perSem : perSem
                          return <td key={i} className="px-3 py-3 text-right font-black text-white">₹{fmt(semAmt)}</td>
                        })}
                        <td className="px-4 py-3 text-right font-black text-emerald-400">₹{fmt(grandTotal)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <div className="flex flex-wrap gap-6 px-5 py-3 bg-gray-50 border-t border-gray-100 text-xs">
                  <span className="text-gray-500">Entry: <strong className="text-amber-700">₹{fmt(entryTotal)}</strong></span>
                  <span className="text-gray-500">Univ. Fee/sem: <strong className="text-[#933d18]">₹{fmt(dividePerSem)}</strong></span>
                  <span className="text-gray-500">Other/sem: <strong className="text-indigo-700">₹{fmt(multiplyPerSem)}</strong></span>
                  <span className="text-gray-500">Per Sem Total: <strong className="text-gray-900">₹{fmt(perSem)}</strong></span>
                  <span className="text-gray-500">Grand Total: <strong className="text-[#933d18] text-sm">₹{fmt(grandTotal)}</strong></span>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

function FeeViewModal({ struct, onClose, onPDF }) {
  const sems       = struct.total_semesters || 4
  const feeItems   = struct.fee_items || []
  const entryItems    = feeItems.filter(i => i.category === 'entry')
  const divideItems   = feeItems.filter(i => i.category === 'divide')
  const multiplyItems = feeItems.filter(i => i.category === 'multiply')

  const entryTotal    = entryItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)
  const divideTotal   = divideItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)
  const dividePerSem  = divideTotal / (sems || 1)
  const multiplyPerSem = multiplyItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)
  const perSem        = dividePerSem + multiplyPerSem
  const grandTotal    = entryTotal + divideTotal + multiplyPerSem * sems

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-black text-gray-900 text-base">{struct.programs?.program_name}</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {struct.academic_sessions?.session_name || 'All Sessions'} &nbsp;•&nbsp; {sems} Semesters
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onPDF}
              className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-4 py-2 rounded-xl transition-colors">
              <Download size={14} /> Download PDF
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Fee Structure Table */}
        <div className="overflow-auto flex-1 p-4">
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-[#933d18]">
                    <th className="text-left text-white font-semibold px-4 py-2.5 whitespace-nowrap">Fee Component</th>
                    <th className="text-center text-white font-semibold px-3 py-2.5">Type</th>
                    <th className="text-right text-white font-semibold px-3 py-2.5 whitespace-nowrap">Entry</th>
                    {Array.from({ length: sems }, (_, i) => (
                      <th key={i} className="text-right text-white font-semibold px-3 py-2.5 whitespace-nowrap">Sem {i + 1}</th>
                    ))}
                    <th className="text-right text-white font-semibold px-4 py-2.5 whitespace-nowrap">Course Total</th>
                  </tr>
                </thead>
                <tbody>
                  {entryItems.filter(i => i.label).map((item, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-amber-50/40' : 'bg-white'}>
                      <td className="px-4 py-2 font-medium text-gray-800">{item.label}</td>
                      <td className="px-3 py-2 text-center"><span className="bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded text-[10px]">One-time</span></td>
                      <td className="px-3 py-2 text-right font-semibold text-amber-700">{parseFloat(item.amount) > 0 ? `₹${fmt(parseFloat(item.amount))}` : '—'}</td>
                      {Array.from({ length: sems }, (_, i) => <td key={i} className="px-3 py-2 text-right text-gray-300">—</td>)}
                      <td className="px-4 py-2 text-right font-bold text-gray-800">{parseFloat(item.amount) > 0 ? `₹${fmt(parseFloat(item.amount))}` : '—'}</td>
                    </tr>
                  ))}
                  {divideItems.filter(i => i.label).map((item, idx) => {
                    const total = parseFloat(item.amount) || 0
                    const ps    = sems > 0 ? total / sems : 0
                    return (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-[#933d18]/5' : 'bg-white'}>
                        <td className="px-4 py-2 font-medium text-gray-800">{item.label}</td>
                        <td className="px-3 py-2 text-center"><span className="bg-[#933d18]/10 text-[#933d18] font-bold px-2 py-0.5 rounded text-[10px]">÷{sems}</span></td>
                        <td className="px-3 py-2 text-right text-gray-300">—</td>
                        {Array.from({ length: sems }, (_, i) => <td key={i} className="px-3 py-2 text-right font-semibold text-[#933d18]">{ps > 0 ? `₹${fmt(ps)}` : '—'}</td>)}
                        <td className="px-4 py-2 text-right font-bold text-gray-800">{total > 0 ? `₹${fmt(total)}` : '—'}</td>
                      </tr>
                    )
                  })}
                  {multiplyItems.filter(i => i.label).map((item, idx) => {
                    const ps = parseFloat(item.amount) || 0
                    return (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-indigo-50/40' : 'bg-white'}>
                        <td className="px-4 py-2 font-medium text-gray-800">{item.label}</td>
                        <td className="px-3 py-2 text-center"><span className="bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded text-[10px]">×{sems}</span></td>
                        <td className="px-3 py-2 text-right text-gray-300">—</td>
                        {Array.from({ length: sems }, (_, i) => <td key={i} className="px-3 py-2 text-right font-semibold text-indigo-700">{ps > 0 ? `₹${fmt(ps)}` : '—'}</td>)}
                        <td className="px-4 py-2 text-right font-bold text-gray-800">{ps > 0 ? `₹${fmt(ps * sems)}` : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-800">
                    <td className="px-4 py-3 font-black text-white">TOTAL</td>
                    <td className="px-3 py-3"></td>
                    <td className="px-3 py-3 text-right font-black text-amber-300">{entryTotal > 0 ? `₹${fmt(entryTotal)}` : '—'}</td>
                    {Array.from({ length: sems }, (_, i) => {
                      const semAmt = i === 0 ? entryTotal + perSem : perSem
                      return <td key={i} className="px-3 py-3 text-right font-black text-white">₹{fmt(semAmt)}</td>
                    })}
                    <td className="px-4 py-3 text-right font-black text-emerald-400">₹{fmt(grandTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Summary bar */}
          <div className="flex flex-wrap gap-5 mt-3 px-1 text-xs">
            <span className="text-gray-500">Entry: <strong className="text-amber-700">₹{fmt(entryTotal)}</strong></span>
            <span className="text-gray-500">Univ. Fee/sem: <strong className="text-[#933d18]">₹{fmt(dividePerSem)}</strong></span>
            <span className="text-gray-500">Other/sem: <strong className="text-indigo-700">₹{fmt(multiplyPerSem)}</strong></span>
            <span className="text-gray-500">Per Sem: <strong className="text-gray-900">₹{fmt(perSem)}</strong></span>
            <span className="text-gray-500">Grand Total: <strong className="text-[#933d18] text-sm">₹{fmt(grandTotal)}</strong></span>
          </div>
        </div>
      </div>
    </div>
  )
}

function FeeCol({ title, badge, hint, headerCls, footerCls, textCls, addCls, items, totalLabel, total, onAdd, onUpd, onDel, colRight, showPerSem, showTotal, totalSems }) {
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
        <div className="flex gap-2 px-1">
          <span className="flex-1 text-[10px] text-gray-400 font-bold uppercase tracking-wider">Fee Name</span>
          <span className="w-28 text-[10px] text-gray-400 font-bold uppercase tracking-wider text-right">{colRight}</span>
          {(showPerSem || showTotal) && <span className="w-20 text-[10px] text-gray-400 font-bold uppercase tracking-wider text-right">{showPerSem ? 'Per Sem' : 'Total'}</span>}
          <span className="w-4"></span>
        </div>
        {items.map(item => {
          const amt = parseFloat(item.amount) || 0
          const derived = showPerSem ? (totalSems > 0 ? amt / totalSems : 0) : showTotal ? amt * totalSems : null
          return (
            <div key={item._key} className="flex items-center gap-2">
              <input className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-[#933d18]"
                placeholder="Fee name" value={item.label} onChange={e => onUpd(item._key, 'label', e.target.value)} />
              <div className="relative w-28 shrink-0">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">₹</span>
                <input className="w-full border border-gray-200 rounded-lg pl-5 pr-2 py-1.5 text-sm text-right focus:outline-none focus:border-[#933d18]"
                  type="number" min="0" value={item.amount} onChange={e => onUpd(item._key, 'amount', e.target.value)} />
              </div>
              {derived !== null && (
                <div className="w-20 text-right shrink-0">
                  <span className={`text-xs font-bold ${textCls}`}>{derived > 0 ? `₹${fmt(derived)}` : '—'}</span>
                </div>
              )}
              <button onClick={() => onDel(item._key)} className="text-red-300 hover:text-red-500 shrink-0 w-4"><Trash2 size={13} /></button>
            </div>
          )
        })}
        <button onClick={onAdd} className={`w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold border border-dashed rounded-lg transition-colors mt-1 ${addCls}`}>
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
