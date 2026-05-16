import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui/Table'
import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import { Edit, Trash2, Plus, Search } from 'lucide-react'

const stripOnline = (val) => {
  if (!val) return '—'
  return val.split(',').map(s => s.trim()).filter(s => s.toLowerCase() !== 'online').join(', ') || '—'
}

export default function Programs() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
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
    fetchData()
  }

  const filtered = data.filter(p =>
    `${p.program_name} ${p.course_code} ${p.short_name} ${p.stream} ${p.eligibility}`
      .toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6">
      <PageHeader
        title="Programs"
        subtitle={`${data.length} programs`}
        action={{ label: <><Plus size={15} /> Add Program</>, onClick: () => navigate('/admin/programs/new') }}
      />

      <div className="mb-4 relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#933d18] focus:ring-2 focus:ring-[#933d18]/15 bg-white"
          placeholder="Search programs..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Loading...</div>
      ) : (
        <Table>
          <Thead>
            <tr>
              <Th>#</Th>
              <Th>Program Name</Th>
              <Th>Course Code</Th>
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
              <Tr><Td colSpan={18} className="text-center text-gray-400 py-12">No programs found</Td></Tr>
            ) : filtered.map((p, i) => (
              <Tr key={p.id}>
                <Td className="text-gray-400 text-xs w-10">{i + 1}</Td>
                <Td><p className="font-semibold text-gray-900 whitespace-nowrap">{p.program_name}</p></Td>
                <Td className="text-gray-500 text-xs whitespace-nowrap">{p.course_code || '—'}</Td>
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
                <Td className="text-gray-500 text-xs whitespace-nowrap">{p.semester_year || '—'}</Td>
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
