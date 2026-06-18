import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import { Plus, Trash2, Save, GraduationCap, Pencil, List, Eye, Download, X, ChevronDown, Search, ChevronRight } from 'lucide-react'
import { generateFeePDF } from '../../utils/generateFeePDF'

// category types:
//  'entry'     = one-time (Prospectus etc.)
//  'divide'    = enter TOTAL, per-sem = total ÷ sems  (University Fee)
//  'multiply'  = enter PER-SEM, charged every sem (Exam, Form etc.)
//  'multiply2' = enter PER-SEM, charged from Sem 2 onwards (Re-Registration etc.)

const DEFAULTS = [
  { label: 'Prospectus Fee',       category: 'entry',     amount: 0 },
  { label: 'Enrollment Fee',       category: 'entry',     amount: 0 },
  { label: 'University Fee',       category: 'divide',    amount: 0 },
  { label: 'Form Fee',             category: 'multiply',  amount: 0 },
  { label: 'Exam Fee',             category: 'multiply',  amount: 0 },
  { label: 'Re-Registration Fee',  category: 'multiply2', amount: 0 },
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
  let entryTotal = 0, divideTotal = 0, multiplyPerSem = 0, multiply2PerSem = 0
  ;(feeItems || []).forEach(i => {
    const a = parseFloat(i.amount) || 0
    if (i.category === 'entry')     entryTotal      += a
    if (i.category === 'divide')    divideTotal     += a
    if (i.category === 'multiply')  multiplyPerSem  += a
    if (i.category === 'multiply2') multiply2PerSem += a
  })
  const dividePerSem = divideTotal / sems
  const perSem1      = dividePerSem + multiplyPerSem                    // Sem 1 recurring
  const perSem       = dividePerSem + multiplyPerSem + multiply2PerSem  // Sem 2+ recurring
  const grandTotal   = entryTotal + divideTotal + multiplyPerSem * sems + multiply2PerSem * Math.max(sems - 1, 0)
  return { entryTotal, divideTotal, dividePerSem, multiplyPerSem, multiply2PerSem, perSem1, perSem, grandTotal }
}

/* ═══════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════ */
export default function FeeManagement() {
  const [tab, setTab]           = useState('master')   // 'master' | 'editor'
  const [masterList, setMasterList] = useState([])
  const [masterLoading, setMasterLoading] = useState(true)
  const [masterSearch, setMasterSearch] = useState('')
  const [viewStruct, setViewStruct] = useState(null)

  // editor state
  const [programs, setPrograms]             = useState([])
  const [departments, setDepartments]       = useState([])
  const [programmeTypes, setProgrammeTypes] = useState([])
  const [sessions, setSessions]             = useState([])
  const [deptId, setDeptId]                 = useState('')
  const [typeId, setTypeId]                 = useState('')
  const [selectedProgIds, setSelectedProgIds] = useState(new Set())
  const [selectedSessIds, setSelectedSessIds] = useState(new Set())
  const [totalSems, setTotalSems]           = useState(4)
  const [isEditMode, setIsEditMode]         = useState(false)
  const [items, setItems]                   = useState([])
  const [loading, setLoading]               = useState(false)
  const [saving, setSaving]                 = useState(false)
  const [saved, setSaved]                   = useState(false)

  useEffect(() => {
    fetchMaster()
    supabase.from('departments').select('id, name').order('name')
      .then(({ data }) => setDepartments(data || []))
    supabase.from('programme_types').select('id, programme_type_name').order('programme_type_name')
      .then(({ data }) => setProgrammeTypes(data || []))
    supabase.from('programs').select('id, program_name, department_id, programme_type_id, duration, semester_year').order('program_name')
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
      const prog = programs.find(p => p.id === struct.program_id)
      setDeptId(prog?.department_id || '')
      setTypeId(prog?.programme_type_id || '')
      setSelectedProgIds(new Set([struct.program_id]))
      setSelectedSessIds(struct.session_id ? new Set([struct.session_id]) : new Set())
      setTotalSems(struct.total_semesters || 4)
      setIsEditMode(true)
      const sorted = [...(struct.fee_items || [])].sort((a, b) => a.sort_order - b.sort_order)
      setItems(sorted.map(i => ({ ...i, _key: uid() })))
      setSaved(true)
    } else {
      setDeptId(''); setTypeId('')
      setSelectedProgIds(new Set()); setSelectedSessIds(new Set())
      setTotalSems(4); setIsEditMode(false); setItems(keyed(DEFAULTS)); setSaved(false)
    }
    setTab('editor')
  }

  // Auto-load when exactly 1 program is selected (fresh, not edit mode)
  useEffect(() => {
    if (tab !== 'editor' || isEditMode) return
    if (selectedProgIds.size !== 1) return
    const pid = [...selectedProgIds][0]
    const sid = selectedSessIds.size === 1 ? [...selectedSessIds][0] : null
    const prog = programs.find(p => p.id === pid)
    const autoSems = prog?.duration
      ? (prog.semester_year === 'Year' ? prog.duration * 2 : prog.duration)
      : 4
    setTotalSems(autoSems)
    loadSingle(pid, sid, autoSems)
  }, [selectedProgIds, selectedSessIds])

  async function loadSingle(pid, sid, defaultSems = 4) {
    setLoading(true); setSaved(false)
    let q = supabase.from('fee_structures')
      .select('*, fee_items(id, label, category, amount, sort_order)')
      .eq('program_id', pid)
    q = sid ? q.eq('session_id', sid) : q.is('session_id', null)
    const { data } = await q.maybeSingle()
    if (data) {
      setTotalSems(data.total_semesters || defaultSems)
      const sorted = [...(data.fee_items || [])].sort((a, b) => a.sort_order - b.sort_order)
      setItems(sorted.map(i => ({ ...i, _key: uid() })))
      setSaved(true)
    } else {
      setTotalSems(defaultSems); setItems(keyed(DEFAULTS))
    }
    setLoading(false)
  }

  const add = cat => setItems(p => [...p, { label: '', category: cat, amount: 0, _key: uid() }])
  const upd = (key, field, val) => setItems(p => p.map(i => i._key === key ? { ...i, [field]: val } : i))
  const del = key => setItems(p => p.filter(i => i._key !== key))

  async function handleSave() {
    if (selectedProgIds.size === 0) return
    setSaving(true); setSaved(false)

    const progList = [...selectedProgIds]
    const sessList = selectedSessIds.size > 0 ? [...selectedSessIds] : [null]
    const valid = items.filter(i => i.label.trim())

    for (const pid of progList) {
      for (const rawSid of sessList) {
        // Upsert fee_structure
        let q = supabase.from('fee_structures').select('id').eq('program_id', pid)
        q = rawSid ? q.eq('session_id', rawSid) : q.is('session_id', null)
        const { data: existing } = await q.maybeSingle()

        let fid = existing?.id
        if (fid) {
          await supabase.from('fee_structures').update({ total_semesters: totalSems }).eq('id', fid)
        } else {
          const { data } = await supabase.from('fee_structures').insert({
            program_id: pid, session_id: rawSid || null, total_semesters: totalSems,
          }).select('id').single()
          fid = data?.id
        }
        if (!fid) continue

        await supabase.from('fee_items').delete().eq('fee_structure_id', fid)
        if (valid.length) {
          await supabase.from('fee_items').insert(
            valid.map((i, idx) => ({
              fee_structure_id: fid, label: i.label.trim(),
              category: i.category, amount: parseFloat(i.amount) || 0, sort_order: idx,
            }))
          )
        }
      }
    }

    setSaving(false); setSaved(true)
    fetchMaster()
  }

  /* ── cascading filter logic ── */
  const progsByDept  = deptId ? programs.filter(p => p.department_id === deptId) : programs
  const typeIdsInDept = [...new Set(progsByDept.map(p => p.programme_type_id).filter(Boolean))]
  const availableTypes = programmeTypes.filter(t => typeIdsInDept.includes(t.id))
  const filteredProgs  = typeId ? progsByDept.filter(p => p.programme_type_id === typeId) : progsByDept

  /* ── editor derived totals ── */
  const entryItems     = items.filter(i => i.category === 'entry')
  const divideItems    = items.filter(i => i.category === 'divide')
  const multiply1Items = items.filter(i => i.category === 'multiply')
  const multiply2Items = items.filter(i => i.category === 'multiply2')
  const allMultiplyItems = [...multiply1Items, ...multiply2Items]
  const entryTotal      = entryItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)
  const divideTotal     = divideItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)
  const dividePerSem    = divideTotal / (totalSems || 1)
  const multiply1PerSem = multiply1Items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)
  const multiply2PerSem = multiply2Items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)
  const perSem1         = dividePerSem + multiply1PerSem                    // Sem 1 recurring
  const perSem          = dividePerSem + multiply1PerSem + multiply2PerSem  // Sem 2+ recurring
  const grandTotal      = entryTotal + divideTotal + multiply1PerSem * totalSems + multiply2PerSem * Math.max(totalSems - 1, 0)
  const progName = selectedProgIds.size === 1
    ? (programs.find(p => p.id === [...selectedProgIds][0])?.program_name || '')
    : selectedProgIds.size > 1 ? `${selectedProgIds.size} programs selected` : ''

  return (
    <div className="p-6">
      <PageHeader title="Fee Management" subtitle="Program-wise fee structure" />

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        {[
          { key: 'master', label: 'Fee Master', icon: <List size={14} /> },
          { key: 'editor', label: 'Add / Edit Fee', icon: <Plus size={14} /> },
        ].map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); if (t.key === 'editor' && selectedProgIds.size === 0) { setItems(keyed(DEFAULTS)); setSaved(false) } }}
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
            <p className="text-base font-semibold text-gray-400">No fee structure has been saved yet</p>
            <button onClick={() => openEditor()} className="mt-4 bg-[#933d18] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#7a3214]">
              + Add Fee Structure
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1 max-w-sm">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:border-[#933d18] focus:ring-2 focus:ring-[#933d18]/10"
                  placeholder="Search by program or session..."
                  value={masterSearch}
                  onChange={e => setMasterSearch(e.target.value)}
                />
                {masterSearch && (
                  <button onClick={() => setMasterSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X size={13} />
                  </button>
                )}
              </div>
              <Button onClick={() => openEditor()}>
                <Plus size={14} /> Add New Fee Structure
              </Button>
            </div>
            {(() => {
              const q = masterSearch.toLowerCase()
              const filtered = q
                ? masterList.filter(s =>
                    (s.programs?.program_name || '').toLowerCase().includes(q) ||
                    (s.academic_sessions?.session_name || '').toLowerCase().includes(q)
                  )
                : masterList
              return (
            <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
              {filtered.length === 0 && masterSearch && (
                <div className="flex flex-col items-center justify-center py-14 text-gray-300">
                  <Search size={36} className="mb-2" />
                  <p className="text-sm font-semibold text-gray-400">No results for "{masterSearch}"</p>
                </div>
              )}
              {filtered.length > 0 && (
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
                  {filtered.map((struct, i) => {
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
                      {masterSearch ? `${filtered.length} of ${masterList.length} programs` : `Total (${masterList.length} programs)`}
                    </td>
                    <td className="px-4 py-3 text-right font-black text-amber-700">
                      ₹{fmt(filtered.reduce((s, st) => s + calcTotals(st.fee_items, st.total_semesters).entryTotal, 0))}
                    </td>
                    <td className="px-4 py-3"></td>
                    <td className="px-4 py-3 text-right font-black text-[#933d18]">
                      —
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
              )}
            </div>
              )
            })()}
          </>
        )
      )}

      {/* ══════════════ VIEW MODAL ══════════════ */}
      {viewStruct && <FeeViewModal struct={viewStruct} onClose={() => setViewStruct(null)} onPDF={() => generateFeePDF(viewStruct)} />}

      {/* ══════════════ EDITOR TAB ══════════════ */}
      {tab === 'editor' && (
        <>
          {/* Cascading Selectors */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-6 shadow-sm">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Select Programs & Sessions</p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
              <SearchableDropdown
                label="Step 1 — Department"
                placeholder="Search & select department"
                value={deptId}
                onChange={v => { setDeptId(v); setTypeId(''); setSelectedProgIds(new Set()); setIsEditMode(false); setSaved(false) }}
                options={departments}
                getLabel={d => d.name}
              />
              <SearchableDropdown
                label="Step 2 — Program Type"
                placeholder={deptId ? 'Search & select type' : 'Select department first'}
                value={typeId}
                onChange={v => { setTypeId(v); setSelectedProgIds(new Set()); setIsEditMode(false); setSaved(false) }}
                options={availableTypes}
                getLabel={t => t.programme_type_name}
                disabled={!deptId}
              />
              <MultiCheckDropdown
                label="Step 3 — Programs"
                placeholder={typeId ? 'Search by name or short name' : 'Select type first'}
                selectedIds={selectedProgIds}
                onChange={v => { setSelectedProgIds(v); setIsEditMode(false); setSaved(false) }}
                options={filteredProgs}
                getLabel={p => p.program_name}
                getSubLabel={p => p.short_name}
                disabled={!typeId}
              />
              <MultiCheckDropdown
                label="Sessions"
                placeholder="All Sessions (no filter)"
                selectedIds={selectedSessIds}
                onChange={v => { setSelectedSessIds(v); setIsEditMode(false); setSaved(false) }}
                options={sessions}
                getLabel={s => s.session_name}
              />
            </div>
            <div className="flex flex-wrap gap-3 items-center border-t border-gray-100 pt-4">
              {selectedProgIds.size > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <span className="bg-[#933d18]/10 text-[#933d18] font-bold px-2.5 py-1 rounded-full">
                    {selectedProgIds.size} program{selectedProgIds.size > 1 ? 's' : ''}
                  </span>
                  {selectedSessIds.size > 0 && (
                    <><span className="text-gray-300">×</span>
                    <span className="bg-indigo-100 text-indigo-700 font-bold px-2.5 py-1 rounded-full">
                      {selectedSessIds.size} session{selectedSessIds.size > 1 ? 's' : ''}
                    </span>
                    <span className="text-gray-400">= {selectedProgIds.size * selectedSessIds.size} structures</span></>
                  )}
                </div>
              )}
              <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2.5">
                <span className="text-sm text-gray-500 whitespace-nowrap">Total Semesters</span>
                <select className="text-sm font-black text-[#933d18] focus:outline-none bg-transparent"
                  value={totalSems} onChange={e => setTotalSems(Number(e.target.value))}>
                  {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              {selectedProgIds.size > 0 && (
                <Button onClick={handleSave} disabled={saving}>
                  <Save size={14} />
                  {saving ? 'Saving...' : saved ? '✓ Saved' : `Save${selectedProgIds.size > 1 || selectedSessIds.size > 1 ? ' All' : ''}`}
                </Button>
              )}
            </div>
          </div>

          {selectedProgIds.size === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-gray-300">
              <GraduationCap size={52} className="mb-3" />
              <p className="text-base font-semibold text-gray-400">Select at least one program to configure fees</p>
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
                  hint={`Per-sem amount (toggle Sem 2+ for reg. fees)`}
                  headerCls="bg-indigo-600" footerCls="bg-indigo-50 border-indigo-100"
                  textCls="text-indigo-700" addCls="text-indigo-600 border-indigo-300 hover:bg-indigo-50"
                  items={allMultiplyItems} totalLabel="Per Sem (Sem 2+)" total={multiply1PerSem + multiply2PerSem}
                  onAdd={() => add('multiply')} onUpd={upd} onDel={del}
                  colRight="Per Sem Amount" showTotal showToggle totalSems={totalSems} />
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
                      {multiply1Items.filter(i => i.label).map((item, idx) => {
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
                      {multiply2Items.filter(i => i.label).map((item, idx) => {
                        const ps = parseFloat(item.amount) || 0
                        return (
                          <tr key={item._key} className={idx % 2 === 0 ? 'bg-purple-50/40' : 'bg-white'}>
                            <td className="px-4 py-2 font-medium text-gray-800">{item.label}</td>
                            <td className="px-3 py-2 text-center"><span className="bg-purple-100 text-purple-700 font-bold px-2 py-0.5 rounded text-[10px]">Sem 2+</span></td>
                            <td className="px-3 py-2 text-right text-gray-300">—</td>
                            <td className="px-3 py-2 text-right text-gray-300">—</td>
                            {Array.from({ length: totalSems - 1 }, (_, i) => <td key={i} className="px-3 py-2 text-right font-semibold text-purple-700">{ps > 0 ? `₹${fmt(ps)}` : '—'}</td>)}
                            <td className="px-4 py-2 text-right font-bold text-gray-800">{ps > 0 ? `₹${fmt(ps * Math.max(totalSems - 1, 0))}` : '—'}</td>
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
                          const semAmt = i === 0 ? entryTotal + perSem1 : perSem
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
                  <span className="text-gray-500">Sem 1: <strong className="text-indigo-700">₹{fmt(entryTotal + perSem1)}</strong></span>
                  <span className="text-gray-500">Sem 2+: <strong className="text-purple-700">₹{fmt(perSem)}</strong></span>
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

function MultiCheckDropdown({ label, placeholder, selectedIds, onChange, options, getLabel, getSubLabel, disabled }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    function onOut(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onOut)
    return () => document.removeEventListener('mousedown', onOut)
  }, [])

  const q = search.toLowerCase()
  const filtered = options.filter(o =>
    getLabel(o).toLowerCase().includes(q) ||
    (getSubLabel && getSubLabel(o)?.toLowerCase().includes(q))
  )
  const count = selectedIds.size
  const allSelected = count === options.length && options.length > 0

  const toggle = (id) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange(next)
  }

  const toggleAll = () => {
    onChange(allSelected ? new Set() : new Set(options.map(o => o.id)))
  }

  return (
    <div className="relative" ref={ref}>
      <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">{label}</p>
      <button type="button" disabled={disabled} onClick={() => !disabled && setOpen(o => !o)}
        className={`w-full flex items-center justify-between gap-2 border rounded-xl px-3 py-2.5 text-sm text-left transition-all
          ${disabled ? 'bg-gray-50 text-gray-300 cursor-not-allowed border-gray-100'
            : open ? 'border-[#933d18] ring-2 ring-[#933d18]/15 bg-white'
            : 'bg-white border-gray-200 hover:border-[#933d18]'}`}>
        <span className={`truncate flex-1 ${count && !disabled ? 'text-gray-900 font-semibold' : 'text-gray-400'}`}>
          {count ? `${count} selected` : placeholder}
        </span>
        {count > 0 && (
          <span className="bg-[#933d18] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0">{count}</span>
        )}
        <ChevronDown size={14} className={`shrink-0 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-40 top-full mt-1.5 left-0 right-0 min-w-[220px] bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-gray-100 bg-gray-50">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input autoFocus
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-[#933d18]"
                placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          {options.length > 0 && (
            <div className="px-2 pt-1.5 pb-1 border-b border-gray-100">
              <button type="button" onClick={toggleAll}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-bold text-[#933d18] hover:bg-[#933d18]/5 rounded-lg transition-colors">
                <Checkbox checked={allSelected} indeterminate={count > 0 && !allSelected} />
                Select All ({options.length})
              </button>
            </div>
          )}
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-4 py-4 text-xs text-gray-400 text-center">No results</p>
            ) : filtered.map(o => (
              <button type="button" key={o.id} onClick={() => toggle(o.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors border-b border-gray-50 last:border-0
                  ${selectedIds.has(o.id) ? 'bg-[#933d18]/5' : 'hover:bg-gray-50'}`}>
                <Checkbox checked={selectedIds.has(o.id)} />
                <span className="flex-1 text-left">
                  <span className={selectedIds.has(o.id) ? 'text-gray-900 font-semibold text-xs' : 'text-gray-700 text-xs'}>
                    {getLabel(o)}
                  </span>
                  {getSubLabel && getSubLabel(o) && (
                    <span className="ml-1.5 text-[10px] font-bold text-[#933d18] bg-[#933d18]/8 px-1.5 py-0.5 rounded">
                      {getSubLabel(o)}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
          {count > 0 && (
            <div className="px-3 py-2 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
              <span className="text-xs text-gray-500">{count} selected</span>
              <button type="button" onClick={() => onChange(new Set())}
                className="text-xs text-red-500 hover:text-red-700 font-semibold">Clear</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Checkbox({ checked, indeterminate }) {
  return (
    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors
      ${checked ? 'bg-[#933d18] border-[#933d18]' : indeterminate ? 'bg-[#933d18]/20 border-[#933d18]' : 'border-gray-300 bg-white'}`}>
      {checked && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
      {!checked && indeterminate && <div className="w-2 h-0.5 bg-[#933d18] rounded-full" />}
    </div>
  )
}

function SearchableDropdown({ label, placeholder, value, onChange, options, getLabel, disabled }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    function onOutside(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  const filtered = options.filter(o => getLabel(o).toLowerCase().includes(search.toLowerCase()))
  const selectedLabel = value ? (getLabel(options.find(o => o.id === value) || {}) || '') : ''

  return (
    <div className="relative" ref={ref}>
      <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">{label}</p>
      <button type="button" disabled={disabled} onClick={() => !disabled && setOpen(o => !o)}
        className={`w-full flex items-center justify-between gap-2 border rounded-xl px-3 py-2.5 text-sm text-left transition-all
          ${disabled ? 'bg-gray-50 text-gray-300 cursor-not-allowed border-gray-100'
            : open ? 'border-[#933d18] ring-2 ring-[#933d18]/15 bg-white'
            : 'bg-white border-gray-200 hover:border-[#933d18]'}
          ${value && !disabled ? 'text-gray-900 font-semibold' : 'text-gray-400'}`}>
        <span className="truncate flex-1">{selectedLabel || placeholder}</span>
        <ChevronDown size={14} className={`shrink-0 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-40 top-full mt-1.5 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-gray-100 bg-gray-50">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input autoFocus
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-[#933d18]"
                placeholder="Type to search..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            {filtered.length > 0 && (
              <p className="text-[10px] text-gray-400 mt-1 px-1">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</p>
            )}
          </div>
          {/* Options list */}
          <div className="max-h-56 overflow-y-auto">
            {value && (
              <button type="button"
                onClick={() => { onChange(''); setOpen(false); setSearch('') }}
                className="w-full text-left px-3 py-2 text-xs text-gray-400 hover:bg-gray-50 border-b border-gray-50 italic">
                — Clear selection
              </button>
            )}
            {filtered.length === 0 ? (
              <p className="px-4 py-4 text-xs text-gray-400 text-center">No results found</p>
            ) : filtered.map(o => (
              <button type="button" key={o.id}
                onClick={() => { onChange(o.id); setOpen(false); setSearch('') }}
                className={`w-full text-left px-3 py-2.5 text-sm transition-colors border-b border-gray-50 last:border-0
                  ${o.id === value
                    ? 'bg-[#933d18]/8 text-[#933d18] font-semibold'
                    : 'text-gray-700 hover:bg-[#933d18]/5'}`}>
                {getLabel(o)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function FeeViewModal({ struct, onClose, onPDF }) {
  const sems       = struct.total_semesters || 4
  const feeItems   = struct.fee_items || []
  const entryItems    = feeItems.filter(i => i.category === 'entry')
  const divideItems   = feeItems.filter(i => i.category === 'divide')
  const multiply1Items = feeItems.filter(i => i.category === 'multiply')
  const multiply2Items = feeItems.filter(i => i.category === 'multiply2')

  const entryTotal      = entryItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)
  const divideTotal     = divideItems.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)
  const dividePerSem    = divideTotal / (sems || 1)
  const multiply1PerSem = multiply1Items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)
  const multiply2PerSem = multiply2Items.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0)
  const perSem1         = dividePerSem + multiply1PerSem
  const perSem          = dividePerSem + multiply1PerSem + multiply2PerSem
  const grandTotal      = entryTotal + divideTotal + multiply1PerSem * sems + multiply2PerSem * Math.max(sems - 1, 0)

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
                  {multiply1Items.filter(i => i.label).map((item, idx) => {
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
                  {multiply2Items.filter(i => i.label).map((item, idx) => {
                    const ps = parseFloat(item.amount) || 0
                    return (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-purple-50/40' : 'bg-white'}>
                        <td className="px-4 py-2 font-medium text-gray-800">{item.label}</td>
                        <td className="px-3 py-2 text-center"><span className="bg-purple-100 text-purple-700 font-bold px-2 py-0.5 rounded text-[10px]">Sem 2+</span></td>
                        <td className="px-3 py-2 text-right text-gray-300">—</td>
                        <td className="px-3 py-2 text-right text-gray-300">—</td>
                        {Array.from({ length: sems - 1 }, (_, i) => <td key={i} className="px-3 py-2 text-right font-semibold text-purple-700">{ps > 0 ? `₹${fmt(ps)}` : '—'}</td>)}
                        <td className="px-4 py-2 text-right font-bold text-gray-800">{ps > 0 ? `₹${fmt(ps * Math.max(sems - 1, 0))}` : '—'}</td>
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
                      const semAmt = i === 0 ? entryTotal + perSem1 : perSem
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
            <span className="text-gray-500">Sem 1: <strong className="text-indigo-700">₹{fmt(entryTotal + perSem1)}</strong></span>
            <span className="text-gray-500">Sem 2+: <strong className="text-purple-700">₹{fmt(perSem)}</strong></span>
            <span className="text-gray-500">Grand Total: <strong className="text-[#933d18] text-sm">₹{fmt(grandTotal)}</strong></span>
          </div>
        </div>
      </div>
    </div>
  )
}

function FeeCol({ title, badge, hint, headerCls, footerCls, textCls, addCls, items, totalLabel, total, onAdd, onUpd, onDel, colRight, showPerSem, showTotal, showToggle, totalSems }) {
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
          const amt      = parseFloat(item.amount) || 0
          const isSem2   = item.category === 'multiply2'
          const multiplier = isSem2 ? Math.max(totalSems - 1, 0) : totalSems
          const derived  = showPerSem ? (totalSems > 0 ? amt / totalSems : 0) : showTotal ? amt * multiplier : null
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
                  <span className={`text-xs font-bold ${isSem2 ? 'text-purple-600' : textCls}`}>{derived > 0 ? `₹${fmt(derived)}` : '—'}</span>
                </div>
              )}
              {showToggle && (
                <button type="button" title={isSem2 ? 'Click to charge all sems' : 'Click to start from Sem 2'}
                  onClick={() => onUpd(item._key, 'category', isSem2 ? 'multiply' : 'multiply2')}
                  className={`shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded border transition-colors
                    ${isSem2
                      ? 'bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-200'
                      : 'bg-indigo-100 text-indigo-600 border-indigo-200 hover:bg-indigo-200'}`}>
                  {isSem2 ? 'Sem 2+' : 'All'}
                </button>
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
