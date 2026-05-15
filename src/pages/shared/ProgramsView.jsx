import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui/Table'
import PageHeader from '../../components/ui/PageHeader'
import Badge from '../../components/ui/Badge'
import { Search } from 'lucide-react'

export default function ProgramsView() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [departments, setDepartments] = useState([])
  const [types, setTypes] = useState([])

  useEffect(() => {
    Promise.all([
      supabase.from('programs').select('*, departments(name), programme_types(programme_type_name)').eq('status', 'Active').order('program_name'),
      supabase.from('departments').select('id, name').order('name'),
      supabase.from('programme_types').select('id, programme_type_name').order('programme_type_name'),
    ]).then(([progs, depts, types]) => {
      setData(progs.data || [])
      setDepartments(depts.data || [])
      setTypes(types.data || [])
      setLoading(false)
    })
  }, [])

  const filtered = data.filter(p => {
    const matchSearch = `${p.program_name} ${p.course_code} ${p.stream}`.toLowerCase().includes(search.toLowerCase())
    const matchDept = !deptFilter || p.department_id === deptFilter
    const matchType = !typeFilter || p.programme_type_id === typeFilter
    return matchSearch && matchDept && matchType
  })

  return (
    <div className="p-6">
      <PageHeader title="Programs" subtitle={`${filtered.length} of ${data.length} programs`} />

      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm w-64 focus:outline-none focus:border-[#933d18] focus:ring-2 focus:ring-[#933d18]/15 bg-white"
            placeholder="Search programs..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="border border-gray-200 rounded-xl py-2.5 px-3 text-sm bg-white focus:outline-none focus:border-[#933d18]"
          value={deptFilter}
          onChange={e => setDeptFilter(e.target.value)}
        >
          <option value="">All Departments</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select
          className="border border-gray-200 rounded-xl py-2.5 px-3 text-sm bg-white focus:outline-none focus:border-[#933d18]"
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
        >
          <option value="">All Types</option>
          {types.map(t => <option key={t.id} value={t.id}>{t.programme_type_name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Loading...</div>
      ) : (
        <Table>
          <Thead>
            <tr>
              <Th>#</Th>
              <Th>Program Name</Th>
              <Th>Code</Th>
              <Th>Department</Th>
              <Th>Type</Th>
              <Th>Duration</Th>
              <Th>Fees/Year</Th>
              <Th>Seats</Th>
              <Th>Eligibility</Th>
            </tr>
          </Thead>
          <Tbody>
            {filtered.length === 0 ? (
              <Tr><Td colSpan={9} className="text-center text-gray-400 py-12">No programs found</Td></Tr>
            ) : filtered.map((p, i) => (
              <Tr key={p.id}>
                <Td className="text-gray-400 text-xs w-10">{i + 1}</Td>
                <Td>
                  <p className="font-semibold text-gray-900">{p.program_name}</p>
                  {p.stream && <p className="text-xs text-gray-400 mt-0.5">{p.stream}</p>}
                </Td>
                <Td className="font-mono text-xs text-gray-500">{p.course_code || '—'}</Td>
                <Td className="text-gray-500 text-xs max-w-[140px] truncate">{p.departments?.name || '—'}</Td>
                <Td className="text-gray-500 text-xs">{p.programme_types?.programme_type_name || '—'}</Td>
                <Td className="text-gray-500">{p.complete_duration || (p.duration ? `${p.duration} Sem` : '—')}</Td>
                <Td className="text-gray-500">{p.fees_per_year ? `₹${Number(p.fees_per_year).toLocaleString()}` : '—'}</Td>
                <Td className="text-gray-500">{p.seats_limit ? Number(p.seats_limit).toLocaleString() : '—'}</Td>
                <Td className="text-gray-500 text-xs">{p.eligibility || '—'}</Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </div>
  )
}
