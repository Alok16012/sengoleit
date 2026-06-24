import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import Button from '../../components/ui/Button'
import { Plus, Search, X, Check, Trash2, Building2, GraduationCap, CheckCircle2, Clock, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'

const fmt = n => (n % 1 === 0 ? n.toLocaleString('en-IN') : n.toFixed(2))

// Grand total for a fee structure (entry once + univ + per-sem charges).
function grandTotal(feeItems, totalSems) {
  const sems = totalSems || 1
  let entry = 0, divide = 0, mul1 = 0, mul2 = 0
  ;(feeItems || []).forEach(i => {
    const a = parseFloat(i.amount) || 0
    if (i.category === 'entry')     entry  += a
    if (i.category === 'divide')    divide += a
    if (i.category === 'multiply')  mul1   += a
    if (i.category === 'multiply2') mul2   += a
  })
  return entry + divide + mul1 * sems + mul2 * Math.max(sems - 1, 0)
}

export default function CenterCourses() {
  const [centers, setCenters]       = useState([])
  const [structs, setStructs]       = useState([])   // fee_structures master
  const [programs, setPrograms]     = useState([])
  const [departments, setDepartments] = useState([])
  const [progTypes, setProgTypes]   = useState([])
  const [sessions, setSessions]     = useState([])
  const [counts, setCounts]         = useState({})   // center_id -> { pending, approved }
  const [centersLoading, setCentersLoading] = useState(true)

  // List view state
  const [listTab, setListTab]       = useState('pending') // 'pending' | 'approved'
  const [centerSearch, setCenterSearch] = useState('')

  // Detail view state
  const [centerId, setCenterId]     = useState('')
  const [allot, setAllot]           = useState({})   // fee_structure_id -> { id, status }
  const [loadingAllot, setLoadingAllot] = useState(false)
  const [subTab, setSubTab]         = useState('pending') // course status in detail
  const [adding, setAdding]         = useState(false)      // Add Course panel open?

  // Catalog filters (Add Course)
  const [search, setSearch]   = useState('')
  const [fDept, setFDept]     = useState('all')
  const [fType, setFType]     = useState('all')
  const [fSessions, setFSessions] = useState([])   // [] = all sessions (multi-select)
  const [sessOpen, setSessOpen]   = useState(false)

  const [busy, setBusy] = useState(null)

  const toggleSession = (id) =>
    setFSessions(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  useEffect(() => {
    setCentersLoading(true)
    supabase.from('centers')
      .select('id, center_name, center_code, center_type, email, approval_status, super_center_id')
      .eq('center_type', 'center')
      .order('center_name')
      .then(({ data }) => { setCenters(data || []); setCentersLoading(false) })
    supabase.from('fee_structures')
      .select('id, total_semesters, program_id, session_id, programs(program_name), academic_sessions(session_name), fee_items(label, category, amount)')
      .order('created_at', { ascending: false })
      .then(({ data }) => setStructs(data || []))
    supabase.from('programs').select('id, department_id, programme_type_id')
      .then(({ data }) => setPrograms(data || []))
    supabase.from('departments').select('id, name').order('name')
      .then(({ data }) => setDepartments(data || []))
    supabase.from('programme_types').select('id, programme_type_name').order('programme_type_name')
      .then(({ data }) => setProgTypes(data || []))
    supabase.from('academic_sessions').select('id, session_name').order('session_name', { ascending: false })
      .then(({ data }) => setSessions(data || []))
    loadCounts()
  }, [])

  function loadCounts() {
    supabase.from('center_courses').select('center_id, status').then(({ data }) => {
      const m = {}
      ;(data || []).forEach(r => {
        if (!m[r.center_id]) m[r.center_id] = { pending: 0, approved: 0 }
        m[r.center_id][r.status] = (m[r.center_id][r.status] || 0) + 1
      })
      setCounts(m)
    })
  }

  // Load allotments whenever a center is opened.
  useEffect(() => {
    if (!centerId) { setAllot({}); return }
    setLoadingAllot(true)
    supabase.from('center_courses')
      .select('id, fee_structure_id, status')
      .eq('center_id', centerId)
      .then(({ data }) => {
        const map = {}
        ;(data || []).forEach(r => { map[r.fee_structure_id] = { id: r.id, status: r.status } })
        setAllot(map)
        setLoadingAllot(false)
      })
  }, [centerId])

  const center  = centers.find(c => c.id === centerId)
  const progMap = Object.fromEntries(programs.map(p => [p.id, p]))

  // ── Center list (status bar) ──
  const isApproved = c => (counts[c.id]?.approved || 0) > 0
  const pendingCenters  = centers.filter(c => !isApproved(c))
  const approvedCenters = centers.filter(c => isApproved(c))
  const cq = centerSearch.toLowerCase()
  const listCenters = (listTab === 'approved' ? approvedCenters : pendingCenters)
    .filter(c => !cq || (c.center_name || '').toLowerCase().includes(cq) || (c.center_code || '').toLowerCase().includes(cq))

  // ── Catalog (Add Course) ──
  const catalogFiltered = structs.filter(s => {
    const prog = progMap[s.program_id]
    if (fDept !== 'all' && prog?.department_id !== fDept) return false
    if (fType !== 'all' && prog?.programme_type_id !== fType) return false
    if (fSessions.length && !fSessions.includes(s.session_id)) return false
    const q = search.toLowerCase()
    if (q && !(
      (s.programs?.program_name || '').toLowerCase().includes(q) ||
      (s.academic_sessions?.session_name || '').toLowerCase().includes(q)
    )) return false
    return true
  })
  const catalog = catalogFiltered
  const catalogFilterActive = !!search || fDept !== 'all' || fType !== 'all' || fSessions.length > 0
  const clearCatalogFilters = () => { setSearch(''); setFDept('all'); setFType('all'); setFSessions([]) }

  const allCatalogChecked  = catalog.length > 0 && catalog.every(s => allot[s.id])
  const someCatalogChecked = catalog.some(s => allot[s.id])

  const allottedRows = structs.filter(s => allot[s.id] && allot[s.id].status === subTab)
  const pendingCount  = Object.values(allot).filter(a => a.status === 'pending').length
  const approvedCount = Object.values(allot).filter(a => a.status === 'approved').length

  function openCenter(id) {
    setCenterId(id); setAdding(false); setSubTab('pending')
    setSearch(''); setFDept('all'); setFType('all'); setFSessions([]); setSessOpen(false)
  }
  function backToList() { setCenterId(''); loadCounts() }

  async function toggleAllot(struct) {
    if (!centerId || busy) return
    setBusy(struct.id)
    const existing = allot[struct.id]
    if (existing) {
      await supabase.from('center_courses').delete().eq('id', existing.id)
      setAllot(prev => { const next = { ...prev }; delete next[struct.id]; return next })
    } else {
      const { data } = await supabase.from('center_courses')
        .insert({ center_id: centerId, fee_structure_id: struct.id, status: 'pending' })
        .select('id, status').single()
      if (data) setAllot(prev => ({ ...prev, [struct.id]: { id: data.id, status: data.status } }))
    }
    setBusy(null); loadCounts()
  }

  // Bulk tick/untick every course currently visible in the catalog.
  async function toggleAllVisible() {
    if (busy || !centerId || catalog.length === 0) return
    setBusy('all')
    const allChecked = catalog.every(s => allot[s.id])
    if (allChecked) {
      const ids = catalog.filter(s => allot[s.id]).map(s => allot[s.id].id)
      if (ids.length) await supabase.from('center_courses').delete().in('id', ids)
      setAllot(prev => { const next = { ...prev }; catalog.forEach(s => delete next[s.id]); return next })
    } else {
      const toAdd = catalog.filter(s => !allot[s.id])
      if (toAdd.length) {
        const { data } = await supabase.from('center_courses')
          .insert(toAdd.map(s => ({ center_id: centerId, fee_structure_id: s.id, status: 'pending' })))
          .select('id, fee_structure_id, status')
        if (data) setAllot(prev => {
          const next = { ...prev }
          data.forEach(r => { next[r.fee_structure_id] = { id: r.id, status: r.status } })
          return next
        })
      }
    }
    setBusy(null); loadCounts()
  }

  async function approve(struct) {
    const existing = allot[struct.id]
    if (!existing || busy) return
    setBusy(struct.id)
    await supabase.from('center_courses')
      .update({ status: 'approved', approved_at: new Date().toISOString() })
      .eq('id', existing.id)
    setAllot(prev => ({ ...prev, [struct.id]: { ...existing, status: 'approved' } }))
    setBusy(null); loadCounts()
  }

  async function unapprove(struct) {
    const existing = allot[struct.id]
    if (!existing || busy) return
    setBusy(struct.id)
    await supabase.from('center_courses')
      .update({ status: 'pending', approved_at: null })
      .eq('id', existing.id)
    setAllot(prev => ({ ...prev, [struct.id]: { ...existing, status: 'pending' } }))
    setBusy(null); loadCounts()
  }

  async function remove(struct) {
    const existing = allot[struct.id]
    if (!existing || busy) return
    setBusy(struct.id)
    await supabase.from('center_courses').delete().eq('id', existing.id)
    setAllot(prev => { const next = { ...prev }; delete next[struct.id]; return next })
    setBusy(null); loadCounts()
  }

  // ═══════════════ CENTER LIST VIEW ═══════════════
  if (!centerId) {
    return (
      <div>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
            {[
              { key: 'pending',  label: 'Pending',  count: pendingCenters.length,  icon: <Clock size={13} /> },
              { key: 'approved', label: 'Approved', count: approvedCenters.length, icon: <CheckCircle2 size={13} /> },
            ].map(t => (
              <button key={t.key} onClick={() => setListTab(t.key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  listTab === t.key ? 'bg-white text-[#933d18] shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}>
                {t.icon} {t.label}
                {t.count > 0 && <span className="bg-[#933d18] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{t.count}</span>}
              </button>
            ))}
          </div>
          <div className="relative max-w-xs flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:border-[#933d18] focus:ring-2 focus:ring-[#933d18]/10"
              placeholder="Search center..."
              value={centerSearch} onChange={e => setCenterSearch(e.target.value)} />
          </div>
        </div>

        <p className="text-xs text-gray-400 mb-3">
          {listTab === 'pending'
            ? 'Newly created centers appear here until at least one course is approved for them.'
            : 'Centers that have at least one approved course.'}
        </p>

        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#933d18]">
                <th className="text-left text-white font-semibold px-4 py-3">#</th>
                <th className="text-left text-white font-semibold px-4 py-3">Center</th>
                <th className="text-left text-white font-semibold px-4 py-3">Code</th>
                <th className="text-left text-white font-semibold px-4 py-3">Email</th>
                <th className="text-center text-white font-semibold px-4 py-3">Pending</th>
                <th className="text-center text-white font-semibold px-4 py-3">Approved</th>
                <th className="text-center text-white font-semibold px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {centersLoading ? (
                <tr><td colSpan={7} className="text-center text-gray-400 py-12">Loading...</td></tr>
              ) : listCenters.length === 0 ? (
                <tr><td colSpan={7} className="text-center text-gray-400 py-12">No {listTab} centers</td></tr>
              ) : listCenters.map((c, i) => {
                const cnt = counts[c.id] || { pending: 0, approved: 0 }
                return (
                  <tr key={c.id} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${i % 2 ? 'bg-gray-50/50' : ''}`}>
                    <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{c.center_name}</td>
                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">{c.center_code || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{c.email || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      {cnt.pending > 0 ? <span className="bg-amber-50 text-amber-700 font-bold text-xs px-2.5 py-1 rounded-full">{cnt.pending}</span> : <span className="text-gray-300 text-xs">0</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {cnt.approved > 0 ? <span className="bg-emerald-50 text-emerald-700 font-bold text-xs px-2.5 py-1 rounded-full">{cnt.approved}</span> : <span className="text-gray-300 text-xs">0</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => openCenter(c.id)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#933d18] bg-[#933d18]/8 hover:bg-[#933d18]/15 px-3 py-1.5 rounded-lg transition-colors">
                        Allot Courses <ChevronRight size={13} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // ═══════════════ CENTER DETAIL VIEW ═══════════════
  return (
    <div>
      <button onClick={backToList}
        className="inline-flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-[#933d18] mb-3 transition-colors">
        <ChevronLeft size={16} /> Back to centers
      </button>

      {/* Center detail */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
          <div className="flex items-center gap-2 text-gray-800 font-bold text-base">
            <Building2 size={17} className="text-[#933d18]" /> {center?.center_name}
          </div>
          {center?.center_code && <span className="text-gray-500 font-mono text-xs">{center.center_code}</span>}
          {center?.email && <span className="text-gray-500 text-xs">{center.email}</span>}
          <span className="text-xs text-gray-400">
            Allotted: <strong className="text-[#933d18]">{Object.keys(allot).length}</strong> course(s)
          </span>
          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${approvedCount > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
            {approvedCount > 0 ? 'Approved' : 'Pending'}
          </span>
        </div>
      </div>

      {/* Status sub-tabs + Add Course */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
          {[
            { key: 'pending',  label: 'Pending',  count: pendingCount,  icon: <Clock size={13} /> },
            { key: 'approved', label: 'Approved', count: approvedCount, icon: <CheckCircle2 size={13} /> },
          ].map(t => (
            <button key={t.key} onClick={() => { setSubTab(t.key); setAdding(false) }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                !adding && subTab === t.key ? 'bg-white text-[#933d18] shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {t.icon} {t.label}
              {t.count > 0 && <span className="bg-[#933d18] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{t.count}</span>}
            </button>
          ))}
        </div>
        <Button onClick={() => setAdding(a => !a)}>
          {adding ? <><X size={14} /> Done</> : <><Plus size={14} /> Add Course</>}
        </Button>
      </div>

      {/* ── ADD COURSE PANEL ── */}
      {adding ? (
        <>
          <div className="flex flex-wrap items-end gap-3 mb-4">
            <div className="relative flex-1 max-w-sm min-w-[200px]">
              <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">Search</label>
              <Search size={14} className="absolute left-3 top-[34px] -translate-y-1/2 text-gray-400" />
              <input
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:border-[#933d18] focus:ring-2 focus:ring-[#933d18]/10"
                placeholder="Search by program or session..."
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">Department</label>
              <select value={fDept} onChange={e => setFDept(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-700 bg-white min-w-[170px] focus:outline-none focus:ring-2 focus:ring-[#933d18]/20">
                <option value="all">All Departments</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">Program Type</label>
              <select value={fType} onChange={e => setFType(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-700 bg-white min-w-[150px] focus:outline-none focus:ring-2 focus:ring-[#933d18]/20">
                <option value="all">All Types</option>
                {progTypes.map(t => <option key={t.id} value={t.id}>{t.programme_type_name}</option>)}
              </select>
            </div>
            <div className="relative">
              <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">Session</label>
              <button type="button" onClick={() => setSessOpen(o => !o)}
                className="flex items-center justify-between gap-2 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-700 bg-white min-w-[170px] focus:outline-none focus:ring-2 focus:ring-[#933d18]/20">
                <span className="truncate">
                  {fSessions.length === 0 ? 'All Sessions'
                    : fSessions.length === 1 ? (sessions.find(s => s.id === fSessions[0])?.session_name || '1 selected')
                    : `${fSessions.length} selected`}
                </span>
                <ChevronDown size={14} className={`text-gray-400 transition-transform ${sessOpen ? 'rotate-180' : ''}`} />
              </button>
              {sessOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setSessOpen(false)} />
                  <div className="absolute z-20 mt-1 w-56 max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-xl shadow-lg p-1">
                    <button type="button" onClick={() => setFSessions([])}
                      className="w-full text-left px-3 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-50 rounded-lg">
                      All Sessions
                    </button>
                    {sessions.map(s => {
                      const on = fSessions.includes(s.id)
                      return (
                        <button key={s.id} type="button" onClick={() => toggleSession(s.id)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg">
                          <span className={`w-4 h-4 rounded border flex items-center justify-center ${on ? 'bg-[#933d18] border-[#933d18]' : 'border-gray-300'}`}>
                            {on && <Check size={11} className="text-white" />}
                          </span>
                          {s.session_name}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
            {catalogFilterActive && (
              <button onClick={clearCatalogFilters}
                className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-semibold text-[#933d18] bg-[#933d18]/8 hover:bg-[#933d18]/15 rounded-xl transition-colors">
                <X size={14} /> Clear
              </button>
            )}
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#933d18]">
                  <th className="text-center text-white font-semibold px-4 py-3 w-12">
                    <button onClick={toggleAllVisible} disabled={busy != null || catalog.length === 0}
                      title={allCatalogChecked ? 'Untick all' : 'Tick all'}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors mx-auto
                        ${allCatalogChecked ? 'bg-white border-white'
                          : someCatalogChecked ? 'bg-white/30 border-white'
                          : 'border-white/70 bg-transparent hover:bg-white/20'}
                        ${busy != null ? 'opacity-50' : ''}`}>
                      {allCatalogChecked
                        ? <Check size={13} className="text-[#933d18]" />
                        : someCatalogChecked ? <span className="block w-2.5 h-0.5 bg-white rounded" /> : null}
                    </button>
                  </th>
                  <th className="text-left text-white font-semibold px-4 py-3">Program</th>
                  <th className="text-left text-white font-semibold px-4 py-3">Session</th>
                  <th className="text-center text-white font-semibold px-4 py-3">Semesters</th>
                  <th className="text-right text-white font-semibold px-4 py-3">Grand Total</th>
                  <th className="text-center text-white font-semibold px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {catalog.length === 0 ? (
                  <tr><td colSpan={6} className="text-center text-gray-400 py-12">
                    {structs.length === 0
                      ? 'No fee structures found. Create one in the Fee Master tab first.'
                      : catalogFilterActive
                        ? 'No courses match these filters — try clearing them.'
                        : 'No courses available.'}
                  </td></tr>
                ) : catalog.map((s, i) => {
                  const a = allot[s.id]
                  const checked = !!a
                  return (
                    <tr key={s.id} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${i % 2 ? 'bg-gray-50/50' : ''}`}>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => toggleAllot(s)} disabled={busy === s.id}
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors mx-auto
                            ${checked ? 'bg-[#933d18] border-[#933d18]' : 'border-gray-300 bg-white hover:border-[#933d18]'}
                            ${busy === s.id ? 'opacity-50' : ''}`}>
                          {checked && <Check size={13} className="text-white" />}
                        </button>
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-900">{s.programs?.program_name || '—'}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{s.academic_sessions?.session_name || 'All Sessions'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="bg-gray-100 text-gray-700 font-bold text-xs px-2.5 py-1 rounded-full">{s.total_semesters} Sem</span>
                      </td>
                      <td className="px-4 py-3 text-right font-black text-gray-900">₹{fmt(grandTotal(s.fee_items, s.total_semesters))}</td>
                      <td className="px-4 py-3 text-center">
                        {a
                          ? <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${a.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{a.status === 'approved' ? 'Approved' : 'Pending'}</span>
                          : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Tick a course to allot it to <strong>{center?.center_name}</strong> (added as Pending). Untick to remove.
            {catalog.length > 0 && <> Use the header checkbox to {allCatalogChecked ? 'untick' : 'tick'} all {catalog.length} shown.</>}
          </p>
        </>
      ) : (
        /* ── PENDING / APPROVED COURSE LISTS ── */
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#933d18]">
                <th className="text-left text-white font-semibold px-4 py-3">#</th>
                <th className="text-left text-white font-semibold px-4 py-3">Program</th>
                <th className="text-left text-white font-semibold px-4 py-3">Session</th>
                <th className="text-center text-white font-semibold px-4 py-3">Semesters</th>
                <th className="text-right text-white font-semibold px-4 py-3">Grand Total</th>
                <th className="text-center text-white font-semibold px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingAllot ? (
                <tr><td colSpan={6} className="text-center text-gray-400 py-12">Loading...</td></tr>
              ) : allottedRows.length === 0 ? (
                <tr><td colSpan={6} className="text-center text-gray-400 py-12">
                  No {subTab} courses. Click “Add Course” to allot.
                </td></tr>
              ) : allottedRows.map((s, i) => (
                <tr key={s.id} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${i % 2 ? 'bg-gray-50/50' : ''}`}>
                  <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900">{s.programs?.program_name || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{s.academic_sessions?.session_name || 'All Sessions'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="bg-gray-100 text-gray-700 font-bold text-xs px-2.5 py-1 rounded-full">{s.total_semesters} Sem</span>
                  </td>
                  <td className="px-4 py-3 text-right font-black text-gray-900">₹{fmt(grandTotal(s.fee_items, s.total_semesters))}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1.5">
                      {subTab === 'pending' ? (
                        <button onClick={() => approve(s)} disabled={busy === s.id}
                          className="flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                          <Check size={12} /> Approve
                        </button>
                      ) : (
                        <button onClick={() => unapprove(s)} disabled={busy === s.id}
                          className="flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                          <Clock size={12} /> Move to Pending
                        </button>
                      )}
                      <button onClick={() => remove(s)} disabled={busy === s.id}
                        className="flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
