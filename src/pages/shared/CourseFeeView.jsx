import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { Search, ChevronDown, X } from 'lucide-react'
import { Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui/Table'
import PageHeader from '../../components/ui/PageHeader'

// ── Searchable single-select dropdown ──────────────────────────────────────
function SearchableSelect({ options, value, onChange, placeholder = 'All', label }) {
  const [open, setOpen]       = useState(false)
  const [query, setQuery]     = useState('')
  const ref                   = useRef(null)

  const selected = options.find(o => o.id === value)

  const filtered = query
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options

  // close on outside click
  useEffect(() => {
    function handle(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  function select(id) {
    onChange(id)
    setOpen(false)
    setQuery('')
  }

  return (
    <div className="relative" ref={ref}>
      {label && (
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">{label}</p>
      )}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center justify-between border rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none transition-all ${
          open ? 'border-[#933d18] ring-2 ring-[#933d18]/10' : 'border-gray-200 hover:border-gray-300'
        }`}
      >
        <span className={selected ? 'text-gray-900 font-medium truncate' : 'text-gray-400'}>
          {selected ? selected.label : placeholder}
        </span>
        <div className="flex items-center gap-1 shrink-0 ml-2">
          {value && (
            <span
              role="button"
              onClick={e => { e.stopPropagation(); select('') }}
              className="p-0.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
            >
              <X size={12} />
            </span>
          )}
          <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {open && (
        <div className="absolute z-50 mt-1.5 w-full bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          {/* Search box */}
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search..."
                className="w-full pl-7 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-[#933d18]"
              />
            </div>
          </div>

          {/* Options list */}
          <ul className="max-h-52 overflow-y-auto">
            <li
              onClick={() => select('')}
              className={`px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 transition-colors ${
                !value ? 'text-[#933d18] font-semibold bg-[#933d18]/5' : 'text-gray-500'
              }`}
            >
              {placeholder}
            </li>
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-xs text-gray-400 text-center">No results</li>
            ) : filtered.map(o => (
              <li
                key={o.id}
                onClick={() => select(o.id)}
                className={`px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 transition-colors ${
                  value === o.id ? 'text-[#933d18] font-semibold bg-[#933d18]/5' : 'text-gray-700'
                }`}
              >
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

  // Load master data on mount
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

  // Reload program list when filters change
  useEffect(() => {
    let q = supabase.from('programs').select('id, program_name').order('program_name')
    if (selDept) q = q.eq('department_id', selDept)
    if (selType) q = q.eq('programme_type_id', selType)
    if (selMode) q = q.eq('study_mode_id', selMode)
    q.then(({ data }) => { setPrograms(data || []); setSelProg('') })
  }, [selDept, selType, selMode])

  async function handleSearch() {
    setLoading(true)
    setSearched(true)
    setResults([])

    try {
      // fee_structures: actual columns are program_id, total_semesters
      // fee_items is a related table (not a JSON column)
      let fsQuery = supabase
        .from('fee_structures')
        .select('id, program_id, session_id, total_semesters, fee_items(label, category, amount, sort_order)')
      if (selSession) fsQuery = fsQuery.eq('session_id', selSession)
      if (selProg)    fsQuery = fsQuery.eq('program_id', selProg)

      const { data: fsList, error: fsErr } = await fsQuery
      if (fsErr) throw fsErr
      if (!fsList?.length) { setResults([]); setLoading(false); return }

      // Fetch programs + sessions in parallel
      const progIds = [...new Set(fsList.map(f => f.program_id).filter(Boolean))]
      const sessIds = [...new Set(fsList.map(f => f.session_id).filter(Boolean))]

      const [{ data: progList }, { data: sessList }] = await Promise.all([
        supabase
          .from('programs')
          .select('id, program_name, duration, semester_year, department_id, programme_type_id, study_mode_id, departments(name), programme_types(programme_type_name), study_modes(mode_name)')
          .in('id', progIds),
        supabase
          .from('academic_sessions')
          .select('id, session_name')
          .in('id', sessIds),
      ])

      const progMap = Object.fromEntries((progList || []).map(p => [p.id, p]))
      const sessMap = Object.fromEntries((sessList || []).map(s => [s.id, s]))

      const rows = []
      fsList.forEach(fs => {
        const prog = progMap[fs.program_id]
        const sess = sessMap[fs.session_id]
        if (!prog) return

        if (selDept && prog.department_id     !== selDept) return
        if (selType && prog.programme_type_id !== selType) return
        if (selMode && prog.study_mode_id     !== selMode) return

        const feeItems  = [...(fs.fee_items || [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        const totalSems = fs.total_semesters ||
          (prog.semester_year === 'Year' ? (prog.duration || 1) * 2 : (prog.duration || 1))

        for (let i = 0; i < totalSems; i++) {
          rows.push({
            key:         `${fs.id}-${i}`,
            session:     sess?.session_name || '—',
            department:  prog.departments?.name || '—',
            progType:    prog.programme_types?.programme_type_name || '—',
            mode:        prog.study_modes?.mode_name || '—',
            programName: prog.program_name || '—',
            semester:    `Semester ${i + 1}`,
            fee:         semFee(feeItems, i, totalSems),
          })
        }
      })

      setResults(rows)
    } catch (err) {
      console.error('Fee search error:', err)
      setResults([])
    }
    setLoading(false)
  }

  const grandTotal = results.reduce((s, r) => s + r.fee, 0)

  // Option arrays for SearchableSelect
  const sessionOpts    = sessions.map(s    => ({ id: s.id, label: s.session_name }))
  const deptOpts       = departments.map(d => ({ id: d.id, label: d.name }))
  const typeOpts       = progTypes.map(t   => ({ id: t.id, label: t.programme_type_name }))
  const modeOpts       = modes.map(m       => ({ id: m.id, label: m.mode_name }))
  const programOpts    = programs.map(p    => ({ id: p.id, label: p.program_name }))

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Center Course Fee"
        subtitle="Search fee structure by session, department and program"
      />

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">

          <SearchableSelect
            label="Session"
            options={sessionOpts}
            value={selSession}
            onChange={setSelSession}
            placeholder="All Sessions"
          />

          <SearchableSelect
            label="Department"
            options={deptOpts}
            value={selDept}
            onChange={v => { setSelDept(v); setSelType(''); setSelMode(''); setSelProg('') }}
            placeholder="All Departments"
          />

          <SearchableSelect
            label="Program Type"
            options={typeOpts}
            value={selType}
            onChange={v => { setSelType(v); setSelProg('') }}
            placeholder="All Types"
          />

          <SearchableSelect
            label="Mode"
            options={modeOpts}
            value={selMode}
            onChange={v => { setSelMode(v); setSelProg('') }}
            placeholder="All Modes"
          />

          <SearchableSelect
            label="Program Name"
            options={programOpts}
            value={selProg}
            onChange={setSelProg}
            placeholder="All Programs"
          />

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

      {/* Results */}
      {searched && !loading && (
        results.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
            No fee structures found for selected filters.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-800">Fee Structure</h3>
              <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-lg font-semibold">
                {results.length} rows
              </span>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <Thead>
                  <tr>
                    <Th>#</Th>
                    <Th>Session</Th>
                    <Th>Department</Th>
                    <Th>Program Type</Th>
                    <Th>Mode</Th>
                    <Th>Program Name</Th>
                    <Th>Sem</Th>
                    <Th>Fee</Th>
                  </tr>
                </Thead>
                <Tbody>
                  {results.map((row, i) => (
                    <Tr key={row.key}>
                      <Td className="text-gray-400 text-xs w-10">{i + 1}</Td>
                      <Td className="text-gray-500 text-xs whitespace-nowrap">{row.session}</Td>
                      <Td className="text-gray-500 text-xs max-w-[150px] truncate">{row.department}</Td>
                      <Td className="text-gray-500 text-xs whitespace-nowrap">{row.progType}</Td>
                      <Td className="text-gray-500 text-xs whitespace-nowrap">{row.mode}</Td>
                      <Td className="font-semibold text-gray-900 whitespace-nowrap">{row.programName}</Td>
                      <Td className="text-gray-500 text-xs whitespace-nowrap">{row.semester}</Td>
                      <Td className="font-mono font-bold text-[#933d18] whitespace-nowrap">{fmt(row.fee)}</Td>
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
    </div>
  )
}
