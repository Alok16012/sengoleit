import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Search } from 'lucide-react'
import { Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui/Table'
import PageHeader from '../../components/ui/PageHeader'

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
const sel = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-[#933d18] focus:ring-2 focus:ring-[#933d18]/10'

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

  // Reload program dropdown when filters change
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
      // Step 1: fetch fee_structures (raw IDs only)
      let fsQuery = supabase
        .from('fee_structures')
        .select('id, programme_id, session_id, fee_items, total_sems')
      if (selSession) fsQuery = fsQuery.eq('session_id', selSession)
      if (selProg)    fsQuery = fsQuery.eq('programme_id', selProg)

      const { data: fsList, error: fsErr } = await fsQuery
      if (fsErr) throw fsErr
      if (!fsList?.length) { setResults([]); setLoading(false); return }

      // Step 2: fetch programs for those IDs with all meta
      const progIds  = [...new Set(fsList.map(f => f.programme_id).filter(Boolean))]
      const sessIds  = [...new Set(fsList.map(f => f.session_id).filter(Boolean))]

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

      // Step 3: build lookup maps
      const progMap = {}
      ;(progList || []).forEach(p => { progMap[p.id] = p })
      const sessMap = {}
      ;(sessList || []).forEach(s => { sessMap[s.id] = s })

      // Step 4: build rows, apply client-side filters
      const rows = []
      fsList.forEach(fs => {
        const prog = progMap[fs.programme_id]
        const sess = sessMap[fs.session_id]
        if (!prog) return

        if (selDept && prog.department_id     !== selDept) return
        if (selType && prog.programme_type_id !== selType) return
        if (selMode && prog.study_mode_id     !== selMode) return

        const totalSems = fs.total_sems ||
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
            fee:         semFee(fs.fee_items, i, totalSems),
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

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Center Course Fee"
        subtitle="Search fee structure by session, department and program"
      />

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">

          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">Session</label>
            <select value={selSession} onChange={e => setSelSession(e.target.value)} className={sel}>
              <option value="">All Sessions</option>
              {sessions.map(s => <option key={s.id} value={s.id}>{s.session_name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">Department</label>
            <select
              value={selDept}
              onChange={e => { setSelDept(e.target.value); setSelType(''); setSelMode(''); setSelProg('') }}
              className={sel}
            >
              <option value="">All Departments</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">Program Type</label>
            <select
              value={selType}
              onChange={e => { setSelType(e.target.value); setSelProg('') }}
              className={sel}
            >
              <option value="">All Types</option>
              {progTypes.map(t => <option key={t.id} value={t.id}>{t.programme_type_name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">Mode</label>
            <select
              value={selMode}
              onChange={e => { setSelMode(e.target.value); setSelProg('') }}
              className={sel}
            >
              <option value="">All Modes</option>
              {modes.map(m => <option key={m.id} value={m.id}>{m.mode_name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1.5">Program Name</label>
            <select value={selProg} onChange={e => setSelProg(e.target.value)} className={sel}>
              <option value="">All Programs</option>
              {programs.map(p => <option key={p.id} value={p.id}>{p.program_name}</option>)}
            </select>
          </div>

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
