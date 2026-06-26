import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { Search, ChevronDown, X, AlertCircle, Download, Eye } from 'lucide-react'
import { Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui/Table'
import PageHeader from '../../components/ui/PageHeader'
import { generateCourseFeeListPDF } from '../../utils/generateCourseFeeListPDF'

// ── Searchable single-select dropdown ──────────────────────────────────────
function SearchableSelect({ options, value, onChange, placeholder = 'All', label }) {
  const [open,  setOpen]  = useState(false)
  const [query, setQuery] = useState('')
  const ref               = useRef(null)

  const selected = options.find(o => o.id === value)
  const filtered = query
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options

  useEffect(() => {
    function handle(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  function select(id) { onChange(id); setOpen(false); setQuery('') }

  return (
    <div className="relative" ref={ref}>
      {label && <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">{label}</p>}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center justify-between border rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none transition-all ${
          open ? 'border-[#933d18] ring-2 ring-[#933d18]/10' : 'border-gray-200 hover:border-gray-300'
        }`}
      >
        <span className={`truncate ${selected ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <div className="flex items-center gap-1 shrink-0 ml-2">
          {value && (
            <span role="button" onClick={e => { e.stopPropagation(); select('') }}
              className="p-0.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600">
              <X size={12} />
            </span>
          )}
          <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {open && (
        <div className="absolute z-50 mt-1.5 w-full bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Search..."
                className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-[#933d18]" />
            </div>
          </div>
          <ul className="max-h-52 overflow-y-auto">
            <li onClick={() => select('')}
              className={`px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 ${!value ? 'text-[#933d18] font-semibold bg-[#933d18]/5' : 'text-gray-500'}`}>
              {placeholder}
            </li>
            {filtered.length === 0
              ? <li className="px-3 py-3 text-xs text-gray-400 text-center">No results</li>
              : filtered.map(o => (
                <li key={o.id} onClick={() => select(o.id)}
                  className={`px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 ${value === o.id ? 'text-[#933d18] font-semibold bg-[#933d18]/5' : 'text-gray-700'}`}>
                  {o.label}
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ── Fee calculation ─────────────────────────────────────────────────────────
// Same maths as the admin Fee Master so the numbers line up exactly.
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
  const perSem       = dividePerSem + multiplyPerSem + multiply2PerSem  // Sem 2+ recurring
  const grandTotal   = entryTotal + divideTotal + multiplyPerSem * sems + multiply2PerSem * Math.max(sems - 1, 0)
  return { entryTotal, perSem, grandTotal }
}

function semFee(feeItems, semIndex, totalSems) {
  let total = 0
  ;(feeItems || []).forEach(item => {
    const a = parseFloat(item.amount) || 0
    if (item.category === 'entry'     && semIndex === 0) total += a
    if (item.category === 'divide')                      total += totalSems > 0 ? a / totalSems : 0
    if (item.category === 'multiply')                    total += a
    if (item.category === 'multiply2' && semIndex > 0)   total += a
  })
  return total
}

const fmt = n => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`

// ── Main Component ──────────────────────────────────────────────────────────
export default function CourseFeeView() {
  const { user } = useAuth()

  // When a center is logged in, the report must show ONLY the courses the
  // admin has allotted + approved to that center (via center_courses).
  // Admins have no row in `centers`, so they stay unrestricted.
  const [centerRowId, setCenterRowId] = useState(null) // null = admin/unrestricted
  const [scoped,      setScoped]      = useState(false) // true once we know this is a center
  const [allotRows,   setAllotRows]   = useState(null)  // null = unrestricted (admin); else the center's approved courses

  const [sessions,    setSessions]    = useState([])
  const [departments, setDepartments] = useState([])
  const [progTypes,   setProgTypes]   = useState([])
  const [modes,       setModes]       = useState([])
  const [programs,    setPrograms]    = useState([])

  const [selSession, setSelSession] = useState('')
  const [selDept,    setSelDept]    = useState('')
  const [selType,    setSelType]    = useState('')
  const [selMode,    setSelMode]    = useState('')
  const [selProg,    setSelProg]    = useState('')

  const [results,  setResults]  = useState([])
  const [loading,  setLoading]  = useState(false)
  const [searched, setSearched] = useState(false)
  const [errMsg,   setErrMsg]   = useState('')
  const [viewRow,  setViewRow]  = useState(null)  // course selected for the detailed View modal

  // Resolve whether the logged-in user is a center (restrict results) or admin,
  // and derive the dropdown options from the center's allotted+approved courses.
  useEffect(() => {
    if (!user?.email) return
    supabase.from('centers').select('id').eq('email', user.email).maybeSingle()
      .then(async ({ data }) => {
        if (!data) { setCenterRowId(null); setScoped(false); setAllotRows(null); return }
        setCenterRowId(data.id); setScoped(true)

        const { data: cc } = await supabase.from('center_courses')
          .select('fee_structure_id').eq('center_id', data.id).eq('status', 'approved')
        const fsIds = [...new Set((cc || []).map(r => r.fee_structure_id).filter(Boolean))]
        if (!fsIds.length) { setAllotRows([]); return }

        const { data: fs } = await supabase.from('fee_structures')
          .select('id, program_id, session_id').in('id', fsIds)
        const progIds = [...new Set((fs || []).map(f => f.program_id).filter(Boolean))]
        const { data: progs } = progIds.length
          ? await supabase.from('programs').select('id, program_name, department_id, programme_type_id, semester_year').in('id', progIds)
          : { data: [] }
        const progMap = Object.fromEntries((progs || []).map(p => [p.id, p]))

        // One row per allotted+approved fee structure, carrying its facets so the
        // filter dropdowns can cascade (e.g. a session shows only its own depts).
        const rows = (fs || []).map(f => {
          const p = progMap[f.program_id] || {}
          return {
            fee_structure_id:  f.id,
            session_id:        f.session_id,
            program_id:        f.program_id,
            program_name:      p.program_name,
            department_id:     p.department_id,
            programme_type_id: p.programme_type_id,
            semester_year:     p.semester_year,
          }
        }).filter(r => r.program_id)
        setAllotRows(rows)
      })
  }, [user?.email])

  // Load master dropdowns
  useEffect(() => {
    Promise.all([
      supabase.from('academic_sessions').select('id, session_name').order('session_name', { ascending: false }),
      supabase.from('departments').select('id, name').order('name'),
      supabase.from('programme_types').select('id, programme_type_name').order('programme_type_name'),
      supabase.from('study_modes').select('id, mode_name').order('mode_name'),
    ]).then(([sess, depts, types, mds]) => {
      setSessions(sess.data || [])
      setDepartments(depts.data || [])
      setProgTypes(types.data || [])
      setModes(mds.data || [])
    })
  }, [])

  // Programs don't store mode_id (it's null for every row). The Sem/Year
  // distinction actually lives in programs.semester_year, while the Mode
  // dropdown comes from study_modes ("Sem" / "Yearly"). Map mode → semester_year.
  const modeSemYear = (modeId) => {
    const n = modes.find(m => m.id === modeId)?.mode_name || ''
    if (/year/i.test(n)) return 'Year'
    if (/sem/i.test(n))  return 'Semester'
    return null
  }

  // Reload program dropdown
  useEffect(() => {
    let q = supabase.from('programs').select('id, program_name').order('program_name')
    if (selDept) q = q.eq('department_id', selDept)
    if (selType) q = q.eq('programme_type_id', selType)
    const sy = modeSemYear(selMode)
    if (sy) q = q.eq('semester_year', sy)
    q.then(({ data }) => { setPrograms(data || []); setSelProg('') })
  }, [selDept, selType, selMode, modes])

  // For a center, drop any selected filter that no longer matches an allotted
  // course (cascading top-down), so the boxes can never show a contradictory
  // combo like Program Type "Bachelor's" when only a Master's course is allotted.
  useEffect(() => {
    if (!allotRows) return
    if (selSession && !allotRows.some(r => r.session_id === selSession)) { setSelSession(''); return }
    const inSess = allotRows.filter(r => !selSession || r.session_id === selSession)
    if (selDept && !inSess.some(r => r.department_id === selDept)) { setSelDept(''); return }
    const inDept = inSess.filter(r => !selDept || r.department_id === selDept)
    if (selType && !inDept.some(r => r.programme_type_id === selType)) { setSelType(''); return }
    const inType = inDept.filter(r => !selType || r.programme_type_id === selType)
    if (selMode) {
      const sy = modeSemYear(selMode)
      if (sy && !inType.some(r => r.semester_year === sy)) { setSelMode(''); return }
    }
    const inMode = inType.filter(r => { if (!selMode) return true; const sy = modeSemYear(selMode); return !sy || r.semester_year === sy })
    if (selProg && !inMode.some(r => r.program_id === selProg)) setSelProg('')
  }, [allotRows, selSession, selDept, selType, selMode, selProg])

  async function handleSearch() {
    setLoading(true)
    setSearched(true)
    setResults([])
    setErrMsg('')

    try {
      // Step 1: resolve program IDs from dept/type/mode/specific-prog filters
      // Do this as a separate DB query so we never rely on nested column names
      let matchProgIds = null
      if (selProg) {
        matchProgIds = [selProg]
      } else if (selDept || selType || selMode) {
        let pq = supabase.from('programs').select('id')
        if (selDept) pq = pq.eq('department_id',     selDept)
        if (selType) pq = pq.eq('programme_type_id', selType)
        const sy = modeSemYear(selMode)
        if (sy) pq = pq.eq('semester_year', sy)
        const { data: mp, error: mpErr } = await pq
        if (mpErr) throw mpErr
        matchProgIds = (mp || []).map(p => p.id)
        if (!matchProgIds.length) { setResults([]); setLoading(false); return }
      }

      // Step 2: fetch fee_structures (simple columns only — no nested joins)
      let fsQ = supabase
        .from('fee_structures')
        .select('id, program_id, session_id, total_semesters')
      if (selSession)     fsQ = fsQ.eq('session_id', selSession)
      if (matchProgIds)   fsQ = fsQ.in('program_id', matchProgIds)

      const { data: fsRaw, error: fsErr } = await fsQ
      if (fsErr) throw fsErr
      let fsList = fsRaw || []

      // Restrict to courses the admin has approved for this center.
      if (centerRowId) {
        const { data: cc, error: ccErr } = await supabase
          .from('center_courses')
          .select('fee_structure_id')
          .eq('center_id', centerRowId)
          .eq('status', 'approved')
        if (ccErr) throw ccErr
        const allow = new Set((cc || []).map(r => r.fee_structure_id))
        fsList = fsList.filter(f => allow.has(f.id))
      }

      if (!fsList.length) { setResults([]); setLoading(false); return }

      // Step 3: fetch fee_items for these fee_structure IDs
      const fsIds   = fsList.map(f => f.id)
      const progIds = [...new Set(fsList.map(f => f.program_id).filter(Boolean))]
      const sessIds = [...new Set(fsList.map(f => f.session_id).filter(Boolean))]

      const [{ data: itemList, error: itemErr }, { data: progList, error: progErr }, { data: sessList, error: sessErr }] =
        await Promise.all([
          supabase.from('fee_items').select('fee_structure_id, label, category, amount, sort_order').in('fee_structure_id', fsIds),
          supabase.from('programs').select('id, program_name, duration, semester_year, department_id, programme_type_id, mode_id').in('id', progIds),
          supabase.from('academic_sessions').select('id, session_name').in('id', sessIds),
        ])

      if (itemErr) throw itemErr
      if (progErr) throw progErr
      if (sessErr) throw sessErr

      // Step 4: build lookup maps
      const itemMap = {}
      ;(itemList || []).forEach(item => {
        if (!itemMap[item.fee_structure_id]) itemMap[item.fee_structure_id] = []
        itemMap[item.fee_structure_id].push(item)
      })
      const progMap = Object.fromEntries((progList || []).map(p => [p.id, p]))
      const sessMap = Object.fromEntries((sessList || []).map(s => [s.id, s]))
      const deptMap = Object.fromEntries(departments.map(d => [d.id, d.name]))
      const typeMap = Object.fromEntries(progTypes.map(t => [t.id, t.programme_type_name]))
      const modeMap = Object.fromEntries(modes.map(m => [m.id, m.mode_name]))

      // Step 5: build ONE row per fee structure (program + session). The on-screen
      // table groups these by course; the PDF expands them per semester.
      const rows = []
      fsList.forEach(fs => {
        const prog = progMap[fs.program_id]
        const sess = sessMap[fs.session_id]
        if (!prog) return

        const feeItems  = (itemMap[fs.id] || []).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        const totalSems = fs.total_semesters ||
          (prog.semester_year === 'Year' ? (prog.duration || 1) * 2 : (prog.duration || 1))

        rows.push({
          key:           fs.id,
          program_id:    fs.program_id,
          session_id:    fs.session_id,
          session:       sess?.session_name              || 'All Sessions',
          department:    deptMap[prog.department_id]     || '—',
          progType:      typeMap[prog.programme_type_id] || '—',
          mode:          modeMap[prog.mode_id]           || '—',
          programName:   prog.program_name               || '—',
          feeItems,
          totalSems,
          feeComponents: feeItems.length,
        })
      })

      setResults(rows)
    } catch (err) {
      setErrMsg(`Error: ${err.message}`)
    }
    setLoading(false)
  }

  // Group the per-session fee rows into ONE row per course (program), exactly
  // like the admin Fee Master. Representative = first matching structure.
  const byProgram = new Map()
  results.forEach(r => {
    if (!byProgram.has(r.program_id)) byProgram.set(r.program_id, [])
    byProgram.get(r.program_id).push(r)
  })
  const groupedRows = [...byProgram.values()].map(list => {
    const rep = list[0]
    return { ...rep, __sessionCount: list.length, ...calcTotals(rep.feeItems, rep.totalSems) }
  })
  const grandTotal = groupedRows.reduce((s, g) => s + g.grandTotal, 0)

  // Expand the (grouped) representative structures back to per-semester rows for
  // the detailed PDF export.
  const buildPdfRows = () => {
    const out = []
    groupedRows.forEach(g => {
      for (let i = 0; i < g.totalSems; i++) {
        out.push({ programName: g.programName, semester: `Semester ${i + 1}`, fee: semFee(g.feeItems, i, g.totalSems) })
      }
    })
    return out
  }

  // For a center, dropdown options cascade off the other selected filters so
  // that, e.g., picking a session only offers departments allotted in it.
  const isCenter = allotRows !== null
  const rowsMatching = (ignore) => (allotRows || []).filter(r => {
    if (ignore !== 'session' && selSession && r.session_id !== selSession) return false
    if (ignore !== 'dept'    && selDept    && r.department_id !== selDept) return false
    if (ignore !== 'type'    && selType    && r.programme_type_id !== selType) return false
    if (ignore !== 'mode'    && selMode)   { const sy = modeSemYear(selMode); if (sy && r.semester_year !== sy) return false }
    if (ignore !== 'prog'    && selProg    && r.program_id !== selProg) return false
    return true
  })

  let sessionOpts, deptOpts, typeOpts, modeOpts, programOpts
  if (isCenter) {
    const sIds = new Set(rowsMatching('session').map(r => r.session_id))
    const dIds = new Set(rowsMatching('dept').map(r => r.department_id))
    const tIds = new Set(rowsMatching('type').map(r => r.programme_type_id))
    const sys  = new Set(rowsMatching('mode').map(r => r.semester_year))
    const pSeen = new Map()
    rowsMatching('prog').forEach(r => { if (r.program_id && !pSeen.has(r.program_id)) pSeen.set(r.program_id, r.program_name) })

    sessionOpts = sessions.filter(s => sIds.has(s.id)).map(s => ({ id: s.id, label: s.session_name }))
    deptOpts    = departments.filter(d => dIds.has(d.id)).map(d => ({ id: d.id, label: d.name }))
    typeOpts    = progTypes.filter(t => tIds.has(t.id)).map(t => ({ id: t.id, label: t.programme_type_name }))
    modeOpts    = modes.filter(m => sys.has(modeSemYear(m.id))).map(m => ({ id: m.id, label: m.mode_name }))
    programOpts = [...pSeen.entries()]
      .map(([id, label]) => ({ id, label: label || '—' }))
      .sort((a, b) => a.label.localeCompare(b.label))
  } else {
    sessionOpts = sessions.map(s  => ({ id: s.id, label: s.session_name }))
    deptOpts    = departments.map(d => ({ id: d.id, label: d.name }))
    typeOpts    = progTypes.map(t  => ({ id: t.id, label: t.programme_type_name }))
    modeOpts    = modes.map(m      => ({ id: m.id, label: m.mode_name }))
    programOpts = programs.map(p   => ({ id: p.id, label: p.program_name }))
  }

  return (
    <div className="p-6 space-y-5">
      <PageHeader title="Center Course Fee" subtitle="Search fee structure by session, department and program" />

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
          <SearchableSelect label="Session"      options={sessionOpts} value={selSession} onChange={v => { setSelSession(v); if (isCenter) { setSelDept(''); setSelType(''); setSelMode(''); setSelProg('') } }} placeholder="All Sessions" />
          <SearchableSelect label="Department"   options={deptOpts}    value={selDept}    onChange={v => { setSelDept(v); setSelType(''); setSelMode(''); setSelProg('') }} placeholder="All Departments" />
          <SearchableSelect label="Program Type" options={typeOpts}    value={selType}    onChange={v => { setSelType(v); setSelProg('') }} placeholder="All Types" />
          <SearchableSelect label="Mode"         options={modeOpts}    value={selMode}    onChange={v => { setSelMode(v); setSelProg('') }} placeholder="All Modes" />
          <SearchableSelect label="Program Name" options={programOpts} value={selProg}    onChange={setSelProg} placeholder="All Programs" />
        </div>

        <button
          onClick={handleSearch}
          disabled={loading}
          className="flex items-center gap-2 px-6 py-2.5 bg-[#933d18] text-white rounded-xl text-sm font-bold hover:bg-[#b05a30] active:scale-[0.98] transition-all disabled:opacity-60"
        >
          <Search size={15} />
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {/* Error */}
      {errMsg && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{errMsg}</span>
        </div>
      )}

      {/* Results */}
      {searched && !loading && !errMsg && (
        results.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
            {scoped
              ? 'No courses have been allotted to your center yet, or none match these filters. Please contact the administrator.'
              : 'No fee structures found for selected filters.'}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-800">Fee Structure</h3>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-lg font-semibold">{groupedRows.length} course{groupedRows.length !== 1 ? 's' : ''}</span>
                <button
                  onClick={() => generateCourseFeeListPDF(buildPdfRows(), {
                    session:    sessions.find(s    => s.id === selSession)?.session_name,
                    department: departments.find(d => d.id === selDept)?.name,
                    progType:   progTypes.find(t   => t.id === selType)?.programme_type_name,
                    mode:       modes.find(m       => m.id === selMode)?.mode_name,
                    program:    programs.find(p    => p.id === selProg)?.program_name,
                  })}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#933d18] text-white rounded-lg text-xs font-bold hover:bg-[#b05a30] active:scale-[0.98] transition-all"
                >
                  <Download size={13} /> Download PDF
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <Thead>
                  <tr>
                    <Th>S.No</Th>
                    <Th>Program Name</Th>
                    <Th>Session</Th>
                    <Th className="text-center">Semesters</Th>
                    <Th className="text-right">Entry Fees</Th>
                    <Th className="text-right">Per Sem</Th>
                    <Th className="text-right">Grand Total</Th>
                    <Th className="text-center">Actions</Th>
                  </tr>
                </Thead>
                <Tbody>
                  {groupedRows.map((row, i) => (
                    <Tr key={row.key}>
                      <Td className="text-gray-400 text-xs w-10">{i + 1}</Td>
                      <Td>
                        <span className="font-semibold text-gray-900">{row.programName}</span>
                        <span className="block text-[11px] text-gray-400">{row.feeComponents} fee components</span>
                      </Td>
                      <Td className="text-gray-500 text-xs whitespace-nowrap">
                        {row.__sessionCount > 1
                          ? <span className="bg-indigo-50 text-indigo-700 font-semibold px-2 py-0.5 rounded-full">{row.__sessionCount} sessions</span>
                          : row.session}
                      </Td>
                      <Td className="text-center">
                        <span className="bg-gray-100 text-gray-700 font-bold text-xs px-2.5 py-1 rounded-full whitespace-nowrap">{row.totalSems} Sem</span>
                      </Td>
                      <Td className="text-right font-mono font-semibold text-amber-700 whitespace-nowrap text-xs">{fmt(row.entryTotal)}</Td>
                      <Td className="text-right font-mono font-semibold text-[#933d18] whitespace-nowrap text-xs">{fmt(row.perSem)}</Td>
                      <Td className="text-right font-mono font-black text-gray-900 whitespace-nowrap">{fmt(row.grandTotal)}</Td>
                      <Td className="text-center">
                        <button
                          onClick={() => setViewRow(row)}
                          title="View"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg transition-colors"
                        >
                          <Eye size={12} /> View
                        </button>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </div>
            <div className="flex justify-end items-center gap-3 px-5 py-3 border-t border-gray-100 bg-[#933d18]/5">
              <span className="text-xs font-black text-gray-500 uppercase tracking-wider">Grand Total</span>
              <span className="font-black text-[#933d18] text-base font-mono">{fmt(grandTotal)}</span>
            </div>
          </div>
        )
      )}

      {viewRow && <FeeViewModal row={viewRow} onClose={() => setViewRow(null)} />}
    </div>
  )
}

// ── Detailed fee-breakdown modal (mirrors the admin Fee Master "View") ───────
function FeeViewModal({ row, onClose }) {
  const sems     = row.totalSems || 4
  const feeItems = row.feeItems || []
  const entryItems     = feeItems.filter(i => i.category === 'entry')
  const divideItems    = feeItems.filter(i => i.category === 'divide')
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
            <h2 className="font-black text-gray-900 text-base">{row.programName}</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {row.__sessionCount > 1 ? `${row.__sessionCount} sessions` : row.session} &nbsp;•&nbsp; {sems} Semesters
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={18} />
          </button>
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
                      <td className="px-3 py-2 text-right font-semibold text-amber-700">{parseFloat(item.amount) > 0 ? fmt(parseFloat(item.amount)) : '—'}</td>
                      {Array.from({ length: sems }, (_, i) => <td key={i} className="px-3 py-2 text-right text-gray-300">—</td>)}
                      <td className="px-4 py-2 text-right font-bold text-gray-800">{parseFloat(item.amount) > 0 ? fmt(parseFloat(item.amount)) : '—'}</td>
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
                        {Array.from({ length: sems }, (_, i) => <td key={i} className="px-3 py-2 text-right font-semibold text-[#933d18]">{ps > 0 ? fmt(ps) : '—'}</td>)}
                        <td className="px-4 py-2 text-right font-bold text-gray-800">{total > 0 ? fmt(total) : '—'}</td>
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
                        {Array.from({ length: sems }, (_, i) => <td key={i} className="px-3 py-2 text-right font-semibold text-indigo-700">{ps > 0 ? fmt(ps) : '—'}</td>)}
                        <td className="px-4 py-2 text-right font-bold text-gray-800">{ps > 0 ? fmt(ps * sems) : '—'}</td>
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
                        {Array.from({ length: sems - 1 }, (_, i) => <td key={i} className="px-3 py-2 text-right font-semibold text-purple-700">{ps > 0 ? fmt(ps) : '—'}</td>)}
                        <td className="px-4 py-2 text-right font-bold text-gray-800">{ps > 0 ? fmt(ps * Math.max(sems - 1, 0)) : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-800">
                    <td className="px-4 py-3 font-black text-white">TOTAL</td>
                    <td className="px-3 py-3"></td>
                    <td className="px-3 py-3 text-right font-black text-amber-300">{entryTotal > 0 ? fmt(entryTotal) : '—'}</td>
                    {Array.from({ length: sems }, (_, i) => {
                      const semAmt = i === 0 ? entryTotal + perSem1 : perSem
                      return <td key={i} className="px-3 py-3 text-right font-black text-white">{fmt(semAmt)}</td>
                    })}
                    <td className="px-4 py-3 text-right font-black text-emerald-400">{fmt(grandTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Summary bar */}
          <div className="flex flex-wrap gap-5 mt-3 px-1 text-xs">
            <span className="text-gray-500">Entry: <strong className="text-amber-700">{fmt(entryTotal)}</strong></span>
            <span className="text-gray-500">Univ. Fee/sem: <strong className="text-[#933d18]">{fmt(dividePerSem)}</strong></span>
            <span className="text-gray-500">Sem 1: <strong className="text-indigo-700">{fmt(entryTotal + perSem1)}</strong></span>
            <span className="text-gray-500">Sem 2+: <strong className="text-purple-700">{fmt(perSem)}</strong></span>
            <span className="text-gray-500">Grand Total: <strong className="text-[#933d18] text-sm">{fmt(grandTotal)}</strong></span>
          </div>
        </div>
      </div>
    </div>
  )
}
