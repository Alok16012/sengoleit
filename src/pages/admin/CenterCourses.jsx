import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import Button from '../../components/ui/Button'
import { fetchAllRows } from '../../utils/fetchAllRows'
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
  const [ccRows, setCcRows]         = useState([])   // center_courses: { center_id, fee_structure_id }
  const [countsErr, setCountsErr]   = useState('')
  const [countsTotal, setCountsTotal] = useState(null) // rows read; null until loaded
  const [centersLoading, setCentersLoading] = useState(true)

  // List view state
  const [centerSearch, setCenterSearch] = useState('')
  const [superFilter, setSuperFilter] = useState('all')   // super_center id or 'all'
  const [centerFilter, setCenterFilter] = useState('all') // center id or 'all'

  // Detail view state — the opened center lives in the URL (?center=…) so the
  // browser Back button returns to the center list instead of leaving the page.
  const [searchParams, setSearchParams] = useSearchParams()
  const centerId = searchParams.get('center') || ''
  const setCenterId = (id) => setSearchParams(prev => {
    const next = new URLSearchParams(prev)
    if (id) next.set('center', id); else next.delete('center')
    return next
  })
  const [allot, setAllot]           = useState({})   // fee_structure_id -> { id, status }
  const [loadingAllot, setLoadingAllot] = useState(false)
  // 'pending'  = the Fee Master catalog, courses this center does NOT have yet
  // 'approved' = the courses it has been given
  const [subTab, setSubTab]         = useState('pending')

  // Catalog filters
  const [search, setSearch]   = useState('')
  const [fDept, setFDept]     = useState('all')
  const [fType, setFType]     = useState('all')
  const [fSessions, setFSessions] = useState([])   // [] = all sessions (multi-select)
  const [sessOpen, setSessOpen]   = useState(false)

  // Courses ticked in the Pending tab, by grouped-row key. Ticking a row takes
  // the whole course — every session of it — exactly as its own button does.
  const [picked, setPicked] = useState(new Set())
  const togglePicked = (key) => setPicked(prev => {
    const next = new Set(prev)
    next.has(key) ? next.delete(key) : next.add(key)
    return next
  })

  const [busy, setBusy] = useState(null)

  // [] means "no session filter", which is every session — so on screen every
  // session is ticked, not none of them. The empty array is only how that is
  // stored; showing it as nothing selected made "All Sessions" look like it had
  // switched the others off.
  const allSessionsOn = fSessions.length === 0
  const sessionOn = (id) => allSessionsOn || fSessions.includes(id)

  // Because they all read as ticked, clicking one has to UNtick it — the old
  // code added it, so clicking a ticked session left it as the only one chosen,
  // the opposite of what the tick said.
  const toggleSession = (id) =>
    setFSessions(prev => {
      const next = prev.length === 0
        ? sessions.map(s => s.id).filter(x => x !== id)     // all but this one
        : prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      // Every session ticked, or none left, both mean "not filtering by
      // session" — and nothing is ever served by a filter that matches no
      // session at all.
      return (next.length === sessions.length || next.length === 0) ? [] : next
    })

  useEffect(() => {
    setCentersLoading(true)
    supabase.from('centers')
      .select('id, center_name, center_code, center_type, email, approval_status, super_center_id')
      .in('center_type', ['super_center', 'center'])
      .order('center_name')
      .then(({ data }) => { setCenters(data || []); setCentersLoading(false) })
    // All of them — past the 1000 a single select returns, or the courses with
    // the oldest fee structures cannot be allotted here at all.
    fetchAllRows(() => supabase.from('fee_structures')
      .select('id, total_semesters, program_id, session_id, programs(program_name), academic_sessions(session_name), fee_items(label, category, amount)')
      .order('created_at', { ascending: false })
      .order('id'))
      .then(({ data }) => setStructs(data || []))
    supabase.from('programs').select('id, program_name, department_id, programme_type_id, duration, semester_year')
      .then(({ data }) => setPrograms(data || []))
    supabase.from('departments').select('id, name').order('name')
      .then(({ data }) => setDepartments(data || []))
    supabase.from('programme_types').select('id, programme_type_name').order('programme_type_name')
      .then(({ data }) => setProgTypes(data || []))
    supabase.from('academic_sessions').select('id, session_name').or('status.eq.Active,status.is.null').order('session_name', { ascending: false })
      .then(({ data }) => setSessions(data || []))
    loadCounts()
  }, [])

  function loadCounts() {
    // The error was dropped here, so a failed read and an empty table both came
    // out as a column of zeroes with nothing on screen to tell them apart.
    fetchAllRows(() => supabase.from('center_courses').select('center_id, fee_structure_id').order('id')).then(({ data, error }) => {
      setCountsErr(error ? error.message : '')
      const rows = data || []
      setCcRows(rows)
      setCountsTotal(rows.length)
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

  // ── Center list ──
  // One single list — Pending and Approved used to be separate TABS, and a
  // centre with both kinds of course appeared in both, so splitting the list
  // only hid centres. They are columns now: every centre once, with the two
  // numbers side by side.
  //
  // The columns mean exactly what the tabs inside the centre mean, counted the
  // same way — per COURSE, not per fee structure — so opening Allot Courses
  // shows the same two numbers rather than a larger pair counted per session:
  //   Pending  = courses with a fee in Fee Master that this centre lacks
  //   Approved = courses this centre has
  // A course whose sessions are only partly allotted is genuinely in both.
  const counts = useMemo(() => {
    const progOf = new Map(structs.map(s => [s.id, s.program_id || s.id]))
    const allottedByCenter = new Map()
    for (const r of ccRows) {
      if (!allottedByCenter.has(r.center_id)) allottedByCenter.set(r.center_id, new Set())
      allottedByCenter.get(r.center_id).add(r.fee_structure_id)
    }
    const out = {}
    for (const c of centers) {
      const have = allottedByCenter.get(c.id) || new Set()
      const pend = new Set(), appr = new Set()
      for (const s of structs) {
        const pid = progOf.get(s.id)
        if (have.has(s.id)) appr.add(pid); else pend.add(pid)
      }
      out[c.id] = { pending: pend.size, approved: appr.size }
    }
    return out
  }, [centers, structs, ccRows])

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
  const listCenters = centers
    // Super Center filter → that super center's child centers (and the super
    // center row itself). Then optionally narrow to one specific center.
    .filter(c => superFilter === 'all' || c.super_center_id === superFilter || c.id === superFilter)
    .filter(c => centerFilter === 'all' || c.id === centerFilter)
    .filter(c => !cq || (c.center_name || '').toLowerCase().includes(cq) || (c.center_code || '').toLowerCase().includes(cq))
    // Centres with no course yet come first — those are the ones needing work.
    .sort((a, b) =>
      ((counts[a.id]?.approved || 0) === 0 ? 0 : 1) - ((counts[b.id]?.approved || 0) === 0 ? 0 : 1)
      || typeRank(a) - typeRank(b)
      || (a.center_name || '').localeCompare(b.center_name || ''))

  // ── Detail lists ──
  // Both tabs come out of the SAME source — `structs`, every fee structure,
  // which is exactly Fee Master's "Done" list (a course is "done" there once it
  // has a fee). What separates them is only whether this center has the course:
  //   Pending  = in Fee Master, NOT given to this center yet → "+ Add Course"
  //   Approved = given to this center, live for it right away
  // A course without a fee cannot be allotted at all, so it appears in neither
  // — set its fee in Fee Master first.
  const catalogFilterActive = !!search || fDept !== 'all' || fType !== 'all' || fSessions.length > 0
  const clearCatalogFilters = () => { setSearch(''); setFDept('all'); setFType('all'); setFSessions([]) }

  const deptMap = Object.fromEntries(departments.map(d => [d.id, d.name]))

  // The search / department / type / session filters apply to both tabs.
  const matchesFilters = (s) => {
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
  }

  // One row per course: bundle all of a program's sessions together so the same
  // course isn't repeated once per session. Sessions are shown comma-separated
  // on a single line, and one button acts on the whole bundle.
  const groupByProgram = (rows) => Object.values(
    rows.reduce((acc, s) => {
      const key = s.program_id || s.id
      if (!acc[key]) acc[key] = { key, program_id: s.program_id, program_name: s.programs?.program_name || '—', items: [] }
      acc[key].items.push(s)
      return acc
    }, {})
  )
    .map(g => ({ ...g, items: g.items.slice().sort((a, b) => (a.academic_sessions?.session_name || '').localeCompare(b.academic_sessions?.session_name || '')) }))
    .sort((a, b) => a.program_name.localeCompare(b.program_name))

  const visibleRows = structs.filter(s => (subTab === 'approved' ? !!allot[s.id] : !allot[s.id]) && matchesFilters(s))
  const groupedRows = groupByProgram(visibleRows)

  // Only what is ticked AND on screen. A course ticked before the filters
  // narrowed stays ticked but is not acted on — adding a course you cannot see
  // is not what "Add 4 Selected" says it does.
  const pickedRows = groupedRows.filter(g => picked.has(g.key))
  const allShownPicked  = groupedRows.length > 0 && pickedRows.length === groupedRows.length
  const someShownPicked = pickedRows.length > 0

  // Tab badges count COURSES and ignore the filters, so the numbers don't move
  // around as you search — the table below is what the filters narrow.
  const countCourses = (pred) => new Set(structs.filter(pred).map(s => s.program_id || s.id)).size
  const pendingCount  = countCourses(s => !allot[s.id])
  const approvedCount = countCourses(s => !!allot[s.id])

  // Rows left at status 'pending' by the old two-step flow. They sit in the
  // Approved tab (the center HAS them) but the center portal, admission and
  // Syllabus all read status = 'approved', so until they are flipped the center
  // cannot actually use them — a gap you cannot see from this screen otherwise.
  // approve_all_center_courses.sql does this in one shot for every center; this
  // is the same fix for the center in front of you.
  const staleIds = Object.values(allot).filter(a => a.status !== 'approved').map(a => a.id)

  function openCenter(id) {
    setCenterId(id); setSubTab('pending'); setPicked(new Set())
    setSearch(''); setFDept('all'); setFType('all'); setFSessions([]); setSessOpen(false)
  }

  // Tick or clear every course the table is currently showing.
  const toggleAllShown = () => setPicked(prev => {
    const next = new Set(prev)
    if (allShownPicked) groupedRows.forEach(g => next.delete(g.key))
    else groupedRows.forEach(g => next.add(g.key))
    return next
  })
  function backToList() { setCenterId(''); loadCounts() }

  // ── Group actions: a grouped row bundles every session of one course, so the
  // action applies to all of that course's sessions at once. ──

  // There is no approval step any more: a course added here is live for the
  // center immediately. 'approved' is not decoration — the center portal,
  // student admission and Syllabus all read only status = 'approved' rows.
  async function addGroup(items) {
    if (busy || !centerId) return
    setBusy('grp-' + (items[0]?.program_id || ''))
    const toAdd = items.filter(s => !allot[s.id])
    if (toAdd.length) {
      const now = new Date().toISOString()
      const { data } = await supabase.from('center_courses')
        .insert(toAdd.map(s => ({ center_id: centerId, fee_structure_id: s.id, status: 'approved', approved_at: now })))
        .select('id, fee_structure_id, status')
      if (data) setAllot(prev => {
        const next = { ...prev }
        data.forEach(r => { next[r.fee_structure_id] = { id: r.id, status: r.status } })
        return next
      })
    }
    setBusy(null); loadCounts()
  }

  // Add every ticked course in one go — 300-odd courses one button at a time is
  // not a workflow, and the header tick makes "all of them" one click.
  async function addGroups(groups) {
    if (busy || !centerId) return
    const toAdd = groups.flatMap(g => g.items).filter(s => !allot[s.id])
    if (!toAdd.length) return
    if (!confirm(`Add ${groups.length} course(s) — ${toAdd.length} session(s) — to ${center?.center_name || 'this center'}?`)) return
    setBusy('all')
    const now = new Date().toISOString()
    // Chunked: one insert of several hundred rows trips Supabase's payload
    // limit, and a center with the full catalog is the normal case here.
    for (let i = 0; i < toAdd.length; i += 200) {
      const { data } = await supabase.from('center_courses')
        .insert(toAdd.slice(i, i + 200).map(s => ({ center_id: centerId, fee_structure_id: s.id, status: 'approved', approved_at: now })))
        .select('id, fee_structure_id, status')
      if (data) setAllot(prev => {
        const next = { ...prev }
        data.forEach(r => { next[r.fee_structure_id] = { id: r.id, status: r.status } })
        return next
      })
    }
    // The rows just added leave the Pending tab, so their ticks go with them.
    setPicked(prev => { const n = new Set(prev); groups.forEach(g => n.delete(g.key)); return n })
    setBusy(null); loadCounts()
  }

  async function activateStale() {
    if (busy || !staleIds.length) return
    setBusy('stale')
    await supabase.from('center_courses')
      .update({ status: 'approved', approved_at: new Date().toISOString() })
      .in('id', staleIds)
    setAllot(prev => {
      const next = { ...prev }
      Object.keys(next).forEach(k => { next[k] = { ...next[k], status: 'approved' } })
      return next
    })
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

  // The Approved tab's counterpart to addGroups — take every ticked course off
  // the center at once. Removing means the center can no longer offer it, so
  // the confirm names the size of it rather than just asking.
  async function removeGroups(groups) {
    if (busy) return
    const items = groups.flatMap(g => g.items)
    const ids = items.map(s => allot[s.id]?.id).filter(Boolean)
    if (!ids.length) return
    if (!confirm(
      `Remove ${groups.length} course(s) — ${ids.length} session(s) — from ${center?.center_name || 'this center'}?\n\n`
      + `The center will no longer be able to offer them.`
    )) return
    setBusy('all')
    // Chunked for the same reason the insert is: a few hundred ids in one
    // .in() blows past the URL length limit and the delete quietly matches
    // nothing.
    for (let i = 0; i < ids.length; i += 200) {
      const { error } = await supabase.from('center_courses').delete().in('id', ids.slice(i, i + 200))
      if (error) { setBusy(null); alert('Could not remove these:\n\n' + error.message); loadCounts(); return }
    }
    setAllot(prev => { const next = { ...prev }; items.forEach(s => delete next[s.id]); return next })
    setPicked(prev => { const n = new Set(prev); groups.forEach(g => n.delete(g.key)); return n })
    setBusy(null); loadCounts()
  }

  // ═══════════════ CENTER LIST VIEW ═══════════════
  if (!centerId) {
    return (
      <div>
        {/* A column of zeroes has two quite different causes, and the page used
            to look identical either way. Say which one it is. */}
        {countsErr ? (
          <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-2.5 text-sm">
            Course allotments could not be read: {countsErr} — the Pending and Approved
            counts below are not real until this is fixed.
          </div>
        ) : countsTotal === 0 ? (
          <div className="mb-4 bg-blue-50 border border-blue-100 text-blue-800 rounded-xl px-4 py-2.5 text-sm">
            No course has been allotted to any center yet, so every Approved count reads 0
            and every center's whole catalog sits in Pending.
            Open a center with <strong>Allot Courses</strong> to give it its first course.
          </div>
        ) : null}

        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
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
          All centers in one list — the ones with no course yet come first.
          <strong> Pending</strong> is the courses that have a fee in Fee Master but are not with
          this center yet; <strong>Approved</strong> is the ones it has. Same two numbers you see
          inside <strong>Allot Courses</strong>.
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
                <tr><td colSpan={8} className="text-center text-gray-400 py-12">No centers found</td></tr>
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
  // Shared search + filter bar — used by both tabs.
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
              {/* Carries the same tick as the rows below it. As a bare line of
                  text it read as a heading, so the way back to "no session
                  filter" looked like it was not there at all. */}
              <button type="button" onClick={() => setFSessions([])}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 rounded-lg">
                <span className={`w-4 h-4 rounded border flex items-center justify-center ${
                  allSessionsOn ? 'bg-[#933d18] border-[#933d18]' : 'border-gray-300'}`}>
                  {allSessionsOn && <Check size={11} className="text-white" />}
                </span>
                All Sessions
              </button>
              <div className="h-px bg-gray-100 my-1" />
              {sessions.map(s => {
                const on = sessionOn(s.id)
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
            Allotted: <strong className="text-[#933d18]">{Object.keys(allot).length}</strong> session(s)
          </span>
          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${approvedCount > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
            {approvedCount > 0 ? `${approvedCount} course(s) live` : 'No course yet'}
          </span>
        </div>
      </div>

      {/* Status sub-tabs. Pending is the Fee Master catalog; Approved is what
          this center has. There is no approve step in between. */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
          {[
            { key: 'pending',  label: 'Pending',  count: pendingCount,  icon: <Clock size={13} /> },
            { key: 'approved', label: 'Approved', count: approvedCount, icon: <CheckCircle2 size={13} /> },
          ].map(t => (
            <button key={t.key} onClick={() => { setSubTab(t.key); setPicked(new Set()) }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                subTab === t.key ? 'bg-white text-[#933d18] shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {t.icon} {t.label}
              {t.count > 0 && <span className="bg-[#933d18] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{t.count}</span>}
            </button>
          ))}
        </div>
        {someShownPicked && (
          <div className="flex items-center gap-2">
            <button onClick={() => setPicked(new Set())}
              className="text-xs font-semibold text-gray-500 hover:text-gray-700 px-2 py-2">
              Clear
            </button>
            {subTab === 'pending' ? (
              <Button onClick={() => addGroups(pickedRows)} disabled={busy != null}>
                <Plus size={14} /> {busy === 'all' ? 'Adding…' : `Add ${pickedRows.length} Selected`}
              </Button>
            ) : (
              // Not the primary button: removing takes courses away from a
              // center, so it should not look like the thing to click.
              <button onClick={() => removeGroups(pickedRows)} disabled={busy != null}
                className="flex items-center gap-1.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50">
                <Trash2 size={14} /> {busy === 'all' ? 'Removing…' : `Remove ${pickedRows.length} Selected`}
              </button>
            )}
          </div>
        )}
      </div>

      {staleIds.length > 0 && (
        <div className="mb-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-4 py-3 text-sm flex items-center justify-between gap-3 flex-wrap">
          <span>
            <strong>{staleIds.length}</strong> of this center's courses are still on the old
            “awaiting approval” status, so the center cannot actually use them yet.
          </span>
          <button onClick={activateStale} disabled={busy != null}
            className="shrink-0 flex items-center gap-1 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 px-3 py-2 rounded-lg transition-colors disabled:opacity-50">
            <Check size={13} /> {busy === 'stale' ? 'Activating…' : 'Activate all'}
          </button>
        </div>
      )}

      {filterBar}

      <p className="text-xs text-gray-400 mb-3">
        {subTab === 'pending'
          ? <>Every course that has a fee in Fee Master and is not with this center yet. <strong>Add Course</strong> on a row gives it to <strong>{center?.center_name}</strong> straight away — no approval step, it appears under Approved and goes live for the center. Tick several (or the box in the header for all of them) to add them together.</>
          : <>Courses this center can offer right now. <strong>Remove</strong> takes one back to the Pending tab — tick several (or the box in the header for all of them) to remove them together.</>}
      </p>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#933d18]">
              <th className="text-center text-white font-semibold px-4 py-3 w-12">
                <button onClick={toggleAllShown} disabled={busy != null || groupedRows.length === 0}
                  title={allShownPicked ? 'Untick all shown' : 'Tick all shown'}
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors mx-auto
                    ${allShownPicked ? 'bg-white border-white'
                      : someShownPicked ? 'bg-white/30 border-white'
                      : 'border-white/70 bg-transparent hover:bg-white/20'}
                    ${busy != null ? 'opacity-50' : ''}`}>
                  {allShownPicked
                    ? <Check size={13} className="text-[#933d18]" />
                    : someShownPicked ? <span className="block w-2.5 h-0.5 bg-white rounded" /> : null}
                </button>
              </th>
              <th className="text-left text-white font-semibold px-4 py-3">#</th>
              <th className="text-left text-white font-semibold px-4 py-3">Program</th>
              <th className="text-left text-white font-semibold px-4 py-3">Department</th>
              <th className="text-left text-white font-semibold px-4 py-3">Session</th>
              <th className="text-center text-white font-semibold px-4 py-3">Semesters</th>
              <th className="text-right text-white font-semibold px-4 py-3">Grand Total</th>
              <th className="text-center text-white font-semibold px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {loadingAllot ? (
              <tr><td colSpan={8} className="text-center text-gray-400 py-12">Loading...</td></tr>
            ) : groupedRows.length === 0 ? (
              <tr><td colSpan={8} className="text-center text-gray-400 py-12">
                {subTab === 'pending'
                  ? (catalogFilterActive
                      ? 'No course matches these filters — the rest are already with this center (see Approved), or try clearing the filters.'
                      : 'This center already has every course that has a fee. Add a fee in Fee Master to offer more.')
                  : (Object.keys(allot).length === 0
                      ? <>
                          <p className="text-gray-500 font-semibold">No course is with this center yet.</p>
                          <p className="text-xs mt-1">Open the <strong>Pending</strong> tab and click <strong>Add Course</strong> on the ones it should offer.</p>
                        </>
                      : catalogFilterActive
                        ? 'No course matches these filters — try clearing them.'
                        : 'No course is with this center yet — add one from the Pending tab.')}
              </td></tr>
            ) : groupedRows.map((g, i) => {
              const grpBusy = busy === 'grp-' + (g.program_id || '')
              const sessions = [...new Set(g.items.map(s => s.academic_sessions?.session_name || 'All Sessions'))].join(', ')
              const semSet = [...new Set(g.items.map(s => s.total_semesters).filter(v => v != null))]
              const totalSet = [...new Set(g.items.map(s => fmt(grandTotal(s.fee_items, s.total_semesters))))]
              const isPicked = picked.has(g.key)
              return (
                <tr key={g.key} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                  isPicked ? 'bg-[#933d18]/5' : i % 2 ? 'bg-gray-50/50' : ''}`}>
                  <td className="px-4 py-3 text-center align-top">
                    <button onClick={() => togglePicked(g.key)} disabled={busy != null}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors mx-auto
                        ${isPicked ? 'bg-[#933d18] border-[#933d18]' : 'border-gray-300 bg-white hover:border-[#933d18]'}
                        ${busy != null ? 'opacity-50' : ''}`}>
                      {isPicked && <Check size={13} className="text-white" />}
                    </button>
                  </td>
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
                        // One click = allotted AND live. The row's every session
                        // goes together, same as the count next to the name.
                        <button onClick={() => addGroup(g.items)} disabled={grpBusy || busy === 'all'}
                          className="flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                          <Plus size={12} /> Add Course
                        </button>
                      ) : (
                        <button onClick={() => removeGroup(g.items)} disabled={grpBusy}
                          className="flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                          <Trash2 size={12} /> Remove
                        </button>
                      )}
                    </div>
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
