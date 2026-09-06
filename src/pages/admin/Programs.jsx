import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui/Table'
import PageHeader from '../../components/ui/PageHeader'
import ExportButtons from '../../components/ExportButtons'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import { Edit, Trash2, Plus, Search, X, Check } from 'lucide-react'

const calcSemesters = (p) => {
  if (!p.duration) return p.semester_year || '—'
  // `duration` is stored in semesters. A Year-based program should read in years
  // — prefer the human "Complete Duration" (e.g. "3 Years"), else derive it.
  if (p.semester_year === 'Year') {
    if (p.complete_duration) return p.complete_duration
    const yrs = Number(p.duration) / 2
    return `${yrs} Year${yrs === 1 ? '' : 's'}`
  }
  return `${p.duration} Semester`
}

const stripOnline = (val) => {
  if (!val) return '—'
  return val.split(',').map(s => s.trim()).filter(s => s.toLowerCase() !== 'online').join(', ') || '—'
}

export default function Programs() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [modeFilter, setModeFilter] = useState('all')
  // Programs ticked for deletion, by id.
  const [picked, setPicked] = useState(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const togglePicked = (id) => setPicked(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })
  const navigate = useNavigate()

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const { data, error } = await supabase
      .from('programs')
      .select(`*, universities(university_name), departments(name), programme_types(programme_type_name), study_modes(mode_name), modes_of_study(mode_name)`)
      .order('created_at', { ascending: false })
    if (error) console.error('Programs fetch error:', error)
    setData(data || [])
    setLoading(false)
  }

  async function handleDelete(id) {
    if (!confirm('Delete this program?')) return
    await supabase.from('programs').delete().eq('id', id)
    setPicked(prev => { const n = new Set(prev); n.delete(id); return n })
    fetchData()
  }

  // Count rows in `table` pointing at these programs, asked in chunks — a few
  // hundred ids in one .in() blows past the URL length limit and comes back 0,
  // which would read as "nothing depends on these".
  async function countBy(table, column, ids) {
    let total = 0
    for (let i = 0; i < ids.length; i += 150) {
      const { count, error } = await supabase.from(table)
        .select('id', { count: 'exact', head: true }).in(column, ids.slice(i, i + 150))
      if (error) return null
      total += count || 0
    }
    return total
  }

  // Deleting a programme is not a small thing: its fee structures go with it
  // (ON DELETE CASCADE), and a fee structure leaving withdraws the course from
  // every centre allotted it. So the confirm says the size of it, and a
  // programme that still has students is refused outright — a student whose
  // programme is deleted either blocks the delete on the foreign key or is left
  // pointing at nothing, and neither is worth risking in a bulk action.
  async function handleBulkDelete() {
    const ids = filtered.filter(p => picked.has(p.id)).map(p => p.id)
    if (!ids.length || bulkDeleting) return
    const names = filtered.filter(p => picked.has(p.id)).map(p => p.program_name).filter(Boolean)

    const students = await countBy('students', 'programme_id', ids)
    if (students === null) { alert('Could not check which programs have students, so nothing was deleted.'); return }
    if (students > 0) {
      alert(
        `${students} student${students > 1 ? 's are' : ' is'} admitted in the selected program${ids.length > 1 ? 's' : ''}, `
        + `so they cannot be deleted here.\n\nMove or remove those students first.`
      )
      return
    }
    const fees = await countBy('fee_structures', 'program_id', ids)

    if (!confirm(
      `Delete ${ids.length} program${ids.length > 1 ? 's' : ''}?\n`
      + names.slice(0, 8).join(', ') + (names.length > 8 ? `, +${names.length - 8} more` : '') + '\n\n'
      + (fees ? `This also deletes ${fees} fee structure${fees > 1 ? 's' : ''}, withdrawing the course from every center allotted it.\n\n` : '')
      + `This cannot be undone.`
    )) return

    setBulkDeleting(true)
    for (let i = 0; i < ids.length; i += 150) {
      const { error } = await supabase.from('programs').delete().in('id', ids.slice(i, i + 150))
      if (error) {
        setBulkDeleting(false)
        alert('Deletion stopped:\n\n' + error.message)
        setPicked(new Set()); fetchData()
        return
      }
    }
    setBulkDeleting(false)
    setPicked(new Set())
    fetchData()
  }

  // Dropdown option sources (derived from loaded programs).
  const deptOptions = [...new Map(
    data.filter(p => p.department_id && p.departments?.name).map(p => [p.department_id, p.departments.name])
  ).entries()].sort((a, b) => a[1].localeCompare(b[1]))
  const typeOptions = [...new Map(
    data.filter(p => p.programme_type_id && p.programme_types?.programme_type_name).map(p => [p.programme_type_id, p.programme_types.programme_type_name])
  ).entries()].sort((a, b) => a[1].localeCompare(b[1]))
  const modeOptions = [...new Set(
    data.map(p => p.study_modes?.mode_name).filter(Boolean)
  )].sort()

  const filtered = data.filter(p => {
    if (deptFilter !== 'all' && p.department_id !== deptFilter) return false
    if (typeFilter !== 'all' && p.programme_type_id !== typeFilter) return false
    if (modeFilter !== 'all' && (p.study_modes?.mode_name || '') !== modeFilter) return false
    const haystack = [
      p.program_name, p.course_code, p.enrollment_code, p.short_name,
      p.stream, p.eligibility, p.status, p.complete_duration,
      p.universities?.university_name, p.departments?.name,
      p.programme_types?.programme_type_name,
      p.study_modes?.mode_name, p.modes_of_study?.mode_name,
      p.fees_per_year, p.fees_per_semester, p.seats_limit,
    ].filter(Boolean).join(' ').toLowerCase()
    return haystack.includes(search.toLowerCase())
  })

  const anyFilter = !!search || deptFilter !== 'all' || typeFilter !== 'all' || modeFilter !== 'all'
  const clearFilters = () => { setSearch(''); setDeptFilter('all'); setTypeFilter('all'); setModeFilter('all') }

  // Only what is ticked AND on screen. Tick ten, then filter down to two, and
  // the button says two and deletes two — deleting a program you cannot see is
  // not what it offers to do.
  const pickedShown = filtered.filter(p => picked.has(p.id))
  const allShownPicked  = filtered.length > 0 && pickedShown.length === filtered.length
  const someShownPicked = pickedShown.length > 0
  const toggleAllShown = () => setPicked(prev => {
    const next = new Set(prev)
    if (allShownPicked) filtered.forEach(p => next.delete(p.id))
    else filtered.forEach(p => next.add(p.id))
    return next
  })

  return (
    <div className="p-6">
      <PageHeader
        title="Programs"
        subtitle={anyFilter ? `${filtered.length} of ${data.length} programs` : `${data.length} programs`}
        action={{ label: <><Plus size={15} /> Add Program</>, onClick: () => navigate('/admin/programs/new') }}
      />

      <div className="flex flex-wrap gap-3 mb-4 items-end">
        <div className="relative max-w-sm flex-1 min-w-[220px]">
          <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">Search</label>
          <Search size={15} className="absolute left-3 top-[34px] -translate-y-1/2 text-gray-400" />
          <input
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#933d18] focus:ring-2 focus:ring-[#933d18]/15 bg-white"
            placeholder="Search programs..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">Department</label>
          <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-700 bg-white min-w-[180px] focus:outline-none focus:ring-2 focus:ring-[#933d18]/20">
            <option value="all">All Departments</option>
            {deptOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">Program Type</label>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-700 bg-white min-w-[160px] focus:outline-none focus:ring-2 focus:ring-[#933d18]/20">
            <option value="all">All Types</option>
            {typeOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">Mode</label>
          <select value={modeFilter} onChange={e => setModeFilter(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-700 bg-white min-w-[140px] focus:outline-none focus:ring-2 focus:ring-[#933d18]/20">
            <option value="all">All Modes</option>
            {modeOptions.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
        </div>
        {anyFilter && (
          <button onClick={clearFilters}
            className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-semibold text-[#933d18] bg-[#933d18]/8 hover:bg-[#933d18]/15 rounded-xl transition-colors">
            <X size={14} /> Clear
          </button>
        )}
        <ExportButtons className="ml-auto" title="Programs" rows={filtered}
          filename={`programs${anyFilter ? '_filtered' : ''}`}
          meta={[
            ...(search ? [`Search: ${search}`] : []),
            ...(deptFilter !== 'all' ? [`Department: ${deptOptions.find(d => d.id === deptFilter)?.name || ''}`] : []),
            ...(typeFilter !== 'all' ? [`Type: ${typeOptions.find(t => t.id === typeFilter)?.programme_type_name || ''}`] : []),
            ...(modeFilter !== 'all' ? [`Mode: ${modeOptions.find(m => m.id === modeFilter)?.mode_name || ''}`] : []),
          ]}
          columns={[
            { header: 'Program Name', value: p => p.program_name || '' },
            { header: 'Course Code', value: p => p.course_code || '' },
            { header: 'Enrollment Code', value: p => p.enrollment_code || '' },
            { header: 'Short Name', value: p => p.short_name || '' },
            { header: 'Specialisation', value: p => p.stream || '' },
            { header: 'University', value: p => p.universities?.university_name || '' },
            { header: 'Department', value: p => p.departments?.name || '' },
            { header: 'Program Type', value: p => p.programme_types?.programme_type_name || '' },
            { header: 'Mode', value: p => stripOnline(p.study_modes?.mode_name) },
            { header: 'Mode of Study', value: p => stripOnline(p.modes_of_study?.mode_name) },
            { header: 'Duration', value: p => p.complete_duration || (p.duration ? `${p.duration} Sem` : '') },
            { header: 'Sem / Year', value: p => calcSemesters(p) },
            { header: 'Seats', value: p => p.seats_limit || '' },
            // Bare numbers for Excel so the columns can be summed.
            { header: 'Fees/Year', value: p => Number(p.fees_per_year || 0),
              pdfValue: p => (p.fees_per_year ? `₹${Number(p.fees_per_year).toLocaleString('en-IN')}` : '—') },
            { header: 'Fees/Sem', value: p => Number(p.fees_per_semester || 0),
              pdfValue: p => (p.fees_per_semester ? `₹${Number(p.fees_per_semester).toLocaleString('en-IN')}` : '—') },
            { header: 'Eligibility', value: p => p.eligibility || '' },
            { header: 'Status', value: p => p.status || 'Active' },
          ]} />
      </div>

      {someShownPicked && (
        <div className="flex items-center gap-3 flex-wrap mb-3 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
          <span className="text-sm font-semibold text-red-800">
            {pickedShown.length} program{pickedShown.length > 1 ? 's' : ''} selected
          </span>
          <button onClick={() => setPicked(new Set())}
            className="text-xs font-semibold text-gray-500 hover:text-gray-700">Clear</button>
          <button onClick={handleBulkDelete} disabled={bulkDeleting}
            className="ml-auto flex items-center gap-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 px-3.5 py-2 rounded-lg transition-colors disabled:opacity-50">
            <Trash2 size={13} /> {bulkDeleting ? 'Deleting…' : `Delete ${pickedShown.length} Selected`}
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Loading...</div>
      ) : (
        <Table>
          <Thead>
            <tr>
              <Th className="w-10">
                <button onClick={toggleAllShown} disabled={bulkDeleting || filtered.length === 0}
                  title={allShownPicked ? 'Untick all shown' : 'Tick all shown'}
                  className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors
                    ${allShownPicked ? 'bg-[#933d18] border-[#933d18]'
                      : someShownPicked ? 'bg-[#933d18]/30 border-[#933d18]'
                      : 'border-gray-300 bg-white hover:border-[#933d18]'}
                    ${bulkDeleting ? 'opacity-50' : ''}`}>
                  {allShownPicked
                    ? <Check size={11} className="text-white" />
                    : someShownPicked ? <span className="block w-2 h-0.5 bg-[#933d18] rounded" /> : null}
                </button>
              </Th>
              <Th>#</Th>
              <Th>Program Name</Th>
              <Th>Course Code</Th>
              <Th>Enrollment Code</Th>
              <Th>Short Name</Th>
              <Th>Specialisation</Th>
              <Th>University</Th>
              <Th>Department</Th>
              <Th>Program Type</Th>
              <Th>Mode</Th>
              <Th>Mode of Study</Th>
              <Th>Duration</Th>
              <Th>Sem / Year</Th>
              <Th>Seats</Th>
              <Th>Fees/Year</Th>
              <Th>Fees/Sem</Th>
              <Th>Eligibility</Th>
              <Th>Status</Th>
              <Th>Actions</Th>
            </tr>
          </Thead>
          <Tbody>
            {filtered.length === 0 ? (
              <Tr><Td colSpan={20} className="text-center text-gray-400 py-12">
                {anyFilter ? 'No programs match the current filters — try clearing them.' : 'No programs found'}
              </Td></Tr>
            ) : filtered.map((p, i) => (
              <Tr key={p.id} className={picked.has(p.id) ? 'bg-[#933d18]/5' : undefined}>
                <Td className="w-10">
                  <button onClick={() => togglePicked(p.id)} disabled={bulkDeleting}
                    className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors
                      ${picked.has(p.id) ? 'bg-[#933d18] border-[#933d18]' : 'border-gray-300 bg-white hover:border-[#933d18]'}
                      ${bulkDeleting ? 'opacity-50' : ''}`}>
                    {picked.has(p.id) && <Check size={11} className="text-white" />}
                  </button>
                </Td>
                <Td className="text-gray-400 text-xs w-10">{i + 1}</Td>
                <Td><p className="font-semibold text-gray-900 whitespace-nowrap">{p.program_name}</p></Td>
                <Td className="text-gray-500 text-xs whitespace-nowrap">{p.course_code || '—'}</Td>
                <Td>
                  {p.enrollment_code
                    ? <span className="font-mono text-xs font-bold text-[#933d18] bg-[#933d18]/8 px-2 py-0.5 rounded">{p.enrollment_code}</span>
                    : <span className="text-gray-300 text-xs">—</span>}
                </Td>
                <Td className="text-gray-500 text-xs whitespace-nowrap">{p.short_name || '—'}</Td>
                <Td className="text-gray-500 text-xs whitespace-nowrap">{p.stream || '—'}</Td>
                <Td className="text-gray-500 text-xs whitespace-nowrap">{p.universities?.university_name || '—'}</Td>
                <Td className="text-gray-500 text-xs whitespace-nowrap">{p.departments?.name || '—'}</Td>
                <Td className="text-gray-500 text-xs whitespace-nowrap">{p.programme_types?.programme_type_name || '—'}</Td>
                <Td className="text-gray-500 text-xs whitespace-nowrap">{stripOnline(p.study_modes?.mode_name)}</Td>
                <Td className="text-gray-500 text-xs whitespace-nowrap">{stripOnline(p.modes_of_study?.mode_name)}</Td>
                <Td className="text-gray-500 text-xs whitespace-nowrap">
                  {p.complete_duration || (p.duration ? `${p.duration} Sem` : '—')}
                </Td>
                <Td className="text-gray-500 text-xs whitespace-nowrap">{calcSemesters(p)}</Td>
                <Td className="text-gray-500 text-xs whitespace-nowrap">{p.seats_limit || '—'}</Td>
                <Td className="text-gray-500 text-xs whitespace-nowrap">
                  {p.fees_per_year ? `₹${Number(p.fees_per_year).toLocaleString()}` : '—'}
                </Td>
                <Td className="text-gray-500 text-xs whitespace-nowrap">
                  {p.fees_per_semester ? `₹${Number(p.fees_per_semester).toLocaleString()}` : '—'}
                </Td>
                <Td className="text-gray-500 text-xs max-w-[160px] truncate">{p.eligibility || '—'}</Td>
                <Td><Badge status={p.status?.toLowerCase()}>{p.status || 'Active'}</Badge></Td>
                <Td>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => navigate(`/admin/programs/edit/${p.id}`)}>
                      <Edit size={14} />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(p.id)}>
                      <Trash2 size={14} className="text-red-500" />
                    </Button>
                  </div>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </div>
  )
}
