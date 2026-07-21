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
  const [superFilter, setSuperFilter] = useState('all')   // super_center id or 'all'
  const [centerFilter, setCenterFilter] = useState('all') // center id or 'all'

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
      .in('center_type', ['super_center', 'center'])
      .order('center_name')
      .then(({ data }) => { setCenters(data || []); setCentersLoading(false) })
    supabase.from('fee_structures')
      .select('id, total_semesters, program_id, session_id, programs(program_name), academic_sessions(session_name), fee_items(label, category, amount)')
      .order('created_at', { ascending: false })
      .then(({ data }) => setStructs(data || []))
    supabase.from('programs').select('id, program_name, department_id, programme_type_id, duration, semester_year')
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
  // Super centers rank before regular centers, then alphabetical by name.
  const typeRank = c => (c.center_type === 'super_center' ? 0 : 1)
  const superCenters = centers
    .filter(c => c.center_type === 'super_center')
    .sort((a, b) => (a.center_name || '').localeCompare(b.center_name || ''))
  // Center dropdown is scoped to the chosen super center.
  const centersForDropdown = centers
    .filter(c => c.center_type === 'center' && (superFilter === 'all' || c.super_center_id === superFilter))
    .sort((a, b) => (a.center_name || '').localeCompare(b.center_name || ''))
  const listCenters = (listTab === 'approved' ? approvedCenters : pendingCenters)
    // Super Center filter → that super center's child centers (and the super
    // center row itself). Then optionally narrow to one specific center.
    .filter(c => superFilter === 'all' || c.super_center_id === superFilter || c.id === superFilter)
    .filter(c => centerFilter === 'all' || c.id === centerFilter)
    .filter(c => !cq || (c.center_name || '').toLowerCase().includes(cq) || (c.center_code || '').toLowerCase().includes(cq))
    .sort((a, b) => typeRank(a) - typeRank(b) || (a.center_name || '').localeCompare(b.center_name || ''))

  // ── Catalog (Add Course) ──
  // A course+session that is already allotted to this center (pending OR
  // approved) is hidden from the Add panel — manage it from the Pending /
  // Approved tabs instead. This keeps "Add Course" to only NEW courses.
  const catalogFiltered = structs.filter(s => {
    if (allot[s.id]) return false   // already added (session-wise) — don't show again
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
  // Only courses that HAVE a fee structure can be allotted, so the Add Course
  // panel shows exactly those (programs without a fee yet are intentionally
  // hidden — set their fee in Fee Master first).
  const catalogDisplay = catalog
  const catalogFilterActive = !!search || fDept !== 'all' || fType !== 'all' || fSessions.length > 0
  const clearCatalogFilters = () => { setSearch(''); setFDept('all'); setFType('all'); setFSessions([]) }

  const allCatalogChecked  = catalog.length > 0 && catalog.every(s => allot[s.id])
  const someCatalogChecked = catalog.some(s => allot[s.id])

  const deptMap = Object.fromEntries(departments.map(d => [d.id, d.name]))

  // The same search / department / type / session filters apply to the
  // Pending & Approved lists too, not just the Add Course catalog.
  const allottedRows = structs.filter(s => {
    if (!(allot[s.id] && allot[s.id].status === subTab)) return false
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
  // One row per course: bundle all of a program's allotted sessions together so
  // the same course isn't repeated once per session. Sessions are shown
  // comma-separated on a single line.
  const groupedRows = Object.values(
    allottedRows.reduce((acc, s) => {
      const key = s.program_id || s.id
      if (!acc[key]) acc[key] = { key, program_id: s.program_id, program_name: s.programs?.program_name || '—', items: [] }
      acc[key].items.push(s)
      return acc
    }, {})
  )
    .map(g => ({ ...g, items: g.items.slice().sort((a, b) => (a.academic_sessions?.session_name || '').localeCompare(b.academic_sessions?.session_name || '')) }))
    .sort((a, b) => a.program_name.localeCompare(b.program_name))
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

  // ── Group actions: a grouped row bundles every session of one course, so the
  // action applies to all of that course's allotments at once. ──
  async function approveGroup(items) {
    if (busy) return
    setBusy('grp-' + (items[0]?.program_id || ''))
    const ids = items.map(s => allot[s.id]?.id).filter(Boolean)
    if (ids.length) await supabase.from('center_courses').update({ status: 'approved', approved_at: new Date().toISOString() }).in('id', ids)
    setAllot(prev => { const next = { ...prev }; items.forEach(s => { if (next[s.id]) next[s.id] = { ...next[s.id], status: 'approved' } }); return next })
    setBusy(null); loadCounts()
  }
  async function unapproveGroup(items) {
    if (busy) return
    setBusy('grp-' + (items[0]?.program_id || ''))
    const ids = items.map(s => allot[s.id]?.id).filter(Boolean)
    if (ids.length) await supabase.from('center_courses').update({ status: 'pending', approved_at: null }).in('id', ids)
    setAllot(prev => { const next = { ...prev }; items.forEach(s => { if (next[s.id]) next[s.id] = { ...next[s.id], status: 'pending' } }); return next })
    setBusy(null); loadCounts()
  }
  async function removeGroup(items) {
    if (busy) return
    if (!confirm(`Remove all ${items.length} session(s) of this course from the center?`)) return
    setBusy('grp-' + (items[0]?.program_id || ''))
    const ids = items.map(s => allot[s.id]?.id).filter(Boolean)
    if (ids.length) await supabase.from('center_courses').delete().in('id', ids)
    setAllot(prev => { const next = { ...prev }; items.forEach(s => delete next[s.id]); return next })
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
          <div className="flex items-center gap-2 flex-wrap flex-1 justify-end min-w-[240px]">
            <select
              className="py-2.5 pl-3 pr-8 text-sm border border-gray-200 rounded-xl bg-white text-gray-700 focus:outline-none focus:border-[#933d18] focus:ring-2 focus:ring-[#933d18]/10 cursor-pointer"
              value={superFilter} onChange={e => { setSuperFilter(e.target.value); setCenterFilter('all') }}>
              <option value="all">All Super Centers</option>
              {superCenters.map(sc => <option key={sc.id} value={sc.id}>{sc.center_name}</option>)}
            </select>
            <select
              className="py-2.5 pl-3 pr-8 text-sm border border-gray-200 rounded-xl bg-white text-gray-700 focus:outline-none focus:border-[#933d18] focus:ring-2 focus:ring-[#933d18]/10 cursor-pointer"
              value={centerFilter} onChange={e => setCenterFilter(e.target.value)}>
              <option value="all">All Centers</option>
              {centersForDropdown.map(c => <option key={c.id} value={c.id}>{c.center_name}</option>)}
            </select>
            <div className="relative max-w-xs flex-1 min-w-[160px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:border-[#933d18] focus:ring-2 focus:ring-[#933d18]/10"
                placeholder="Search center..."
                value={centerSearch} onChange={e => setCenterSearch(e.target.value)} />
            </div>
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
                <th className="text-left text-white font-semibold px-4 py-3">Type</th>
                <th className="text-left text-white font-semibold px-4 py-3">Code</th>
                <th className="text-left text-white font-semibold px-4 py-3">Email</th>
                <th className="text-center text-white font-semibold px-4 py-3">Pending</th>
                <th className="text-center text-white font-semibold px-4 py-3">Approved</th>
                <th className="text-center text-white font-semibold px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {centersLoading ? (
                <tr><td colSpan={8} className="text-center text-gray-400 py-12">Loading...</td></tr>
              ) : listCenters.length === 0 ? (
                <tr><td colSpan={8} className="text-center text-gray-400 py-12">No {listTab} centers</td></tr>
              ) : listCenters.map((c, i) => {
                const cnt = counts[c.id] || { pending: 0, approved: 0 }
                return (
                  <tr key={c.id} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${i % 2 ? 'bg-gray-50/50' : ''}`}>
                    <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{c.center_name}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${c.center_type === 'super_center' ? 'bg-[#933d18]/10 text-[#933d18]' : 'bg-gray-100 text-gray-600'}`}>
                        {c.center_type === 'super_center' ? 'Super Center' : 'Center'}
                      </span>
                    </td>
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
  // Shared search + filter bar — used by the Add Course catalog AND the
  // Pending / Approved lists.
  const filterBar = (
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
  )

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
          {filterBar}

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
                  <th className="text-left text-white font-semibold px-4 py-3">Department</th>
                  <th className="text-left text-white font-semibold px-4 py-3">Session</th>
                  <th className="text-center text-white font-semibold px-4 py-3">Semesters</th>
                  <th className="text-right text-white font-semibold px-4 py-3">Grand Total</th>
                  <th className="text-center text-white font-semibold px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {catalogDisplay.length === 0 ? (
                  (() => {
                    // If the search matches courses that are ALREADY allotted,
                    // say so explicitly (with their status) instead of the
                    // generic empty message — avoids "course dikh nahi raha"
                    // confusion when it's simply sitting in Pending/Approved.
                    const q = search.toLowerCase()
                    const already = q ? structs.filter(s =>
                      allot[s.id] && (
                        (s.programs?.program_name || '').toLowerCase().includes(q) ||
                        (s.academic_sessions?.session_name || '').toLowerCase().includes(q)
                      )
                    ) : []
                    if (already.length > 0) {
                      return (
                        <tr><td colSpan={7} className="text-center py-12">
                          <p className="text-sm font-semibold text-gray-600 mb-3">
                            Already allotted to this center — manage from the tabs above:
                          </p>
                          <div className="flex flex-col items-center gap-1.5">
                            {already.slice(0, 6).map(s => (
                              <span key={s.id} className="text-xs text-gray-500">
                                <strong className="text-gray-700">{s.programs?.program_name}</strong>
                                {' — '}{s.academic_sessions?.session_name || 'All Sessions'}
                                <span className={`ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${allot[s.id].status === 'approved' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                                  {allot[s.id].status === 'approved' ? 'Approved' : 'Pending'}
                                </span>
                              </span>
                            ))}
                            {already.length > 6 && (
                              <span className="text-[11px] text-gray-400">+ {already.length - 6} more</span>
                            )}
                          </div>
                        </td></tr>
                      )
                    }
                    return (
                      <tr><td colSpan={7} className="text-center text-gray-400 py-12">
                        {catalogFilterActive
                          ? 'No new courses match these filters — they may already be allotted (see the Pending / Approved tabs), or try clearing filters.'
                          : 'No new courses to add — all available courses are already allotted to this center.'}
                      </td></tr>
                    )
                  })()
                ) : catalogDisplay.map((s, i) => {
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
                      <td className="px-4 py-3 text-gray-600 text-xs">{deptMap[progMap[s.program_id]?.department_id] || '—'}</td>
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
        <>
        {filterBar}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#933d18]">
                <th className="text-left text-white font-semibold px-4 py-3">#</th>
                <th className="text-left text-white font-semibold px-4 py-3">Program</th>
                <th className="text-left text-white font-semibold px-4 py-3">Department</th>
                <th className="text-left text-white font-semibold px-4 py-3">Session</th>
                <th className="text-center text-white font-semibold px-4 py-3">Semesters</th>
                <th className="text-right text-white font-semibold px-4 py-3">Grand Total</th>
                <th className="text-center text-white font-semibold px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingAllot ? (
                <tr><td colSpan={7} className="text-center text-gray-400 py-12">Loading...</td></tr>
              ) : groupedRows.length === 0 ? (
                <tr><td colSpan={7} className="text-center text-gray-400 py-12">
                  {catalogFilterActive
                    ? `No ${subTab} courses match these filters — try clearing them.`
                    : <>No {subTab} courses. Click “Add Course” to allot.</>}
                </td></tr>
              ) : groupedRows.map((g, i) => {
                const grpBusy = busy === 'grp-' + (g.program_id || '')
                const sessions = [...new Set(g.items.map(s => s.academic_sessions?.session_name || 'All Sessions'))].join(', ')
                const semSet = [...new Set(g.items.map(s => s.total_semesters).filter(v => v != null))]
                const totalSet = [...new Set(g.items.map(s => fmt(grandTotal(s.fee_items, s.total_semesters))))]
                return (
                  <tr key={g.key} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${i % 2 ? 'bg-gray-50/50' : ''}`}>
                    <td className="px-4 py-3 text-gray-400 text-xs align-top">{i + 1}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900 align-top">
                      {g.program_name}
                      <span className="ml-2 text-[10px] font-bold text-gray-400">({g.items.length})</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs align-top">{deptMap[progMap[g.program_id]?.department_id] || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs align-top">{sessions}</td>
                    <td className="px-4 py-3 text-center align-top">
                      <span className="bg-gray-100 text-gray-700 font-bold text-xs px-2.5 py-1 rounded-full">{semSet.length ? `${semSet.join(', ')} Sem` : '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-black text-gray-900 align-top">{totalSet.map(t => `₹${t}`).join(', ')}</td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-center justify-center gap-1.5">
                        {subTab === 'pending' ? (
                          <button onClick={() => approveGroup(g.items)} disabled={grpBusy}
                            className="flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                            <Check size={12} /> Approve
                          </button>
                        ) : (
                          <button onClick={() => unapproveGroup(g.items)} disabled={grpBusy}
                            className="flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                            <Clock size={12} /> Move to Pending
                          </button>
                        )}
                        <button onClick={() => removeGroup(g.items)} disabled={grpBusy}
                          className="flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  )
}
