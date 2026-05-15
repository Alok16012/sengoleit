import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui/Table'
import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import { Plus, Search, Edit } from 'lucide-react'

const STATUS_FILTERS = ['All', 'Pending', 'Reviewing', 'Document Verified', 'Account Section', 'Admitted', 'Rejected']

export default function Students() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const navigate = useNavigate()

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const { data, error } = await supabase
      .from('students')
      .select('id, student_name, enrollment_no, mobile_no, gender, date_of_birth, status, date_of_admission, entry_type, center_id, programme_id, session_id')
      .order('created_at', { ascending: false })
    if (error) console.error('Students fetch error:', error)
    setData(data || [])
    setLoading(false)
  }

  const filtered = data.filter(s => {
    const matchSearch = `${s.student_name} ${s.enrollment_no} ${s.mobile_no}`.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'All' || s.status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <div className="p-6">
      <PageHeader
        title="Students"
        subtitle={`${data.length} students`}
        action={{ label: <><Plus size={15} /> Add Student</>, onClick: () => navigate('/admin/students/new') }}
      />

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm w-72 focus:outline-none focus:border-[#933d18] focus:ring-2 focus:ring-[#933d18]/15 bg-white"
            placeholder="Search by name, enrollment, mobile..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_FILTERS.map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                statusFilter === s
                  ? 'bg-[#933d18] text-white shadow-sm'
                  : 'bg-white border border-gray-200 text-gray-500 hover:border-[#933d18]/40 hover:text-[#933d18]'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Loading...</div>
      ) : (
        <Table>
          <Thead>
            <tr>
              <Th>#</Th>
              <Th>Student Name</Th>
              <Th>Enrollment No</Th>
              <Th>Program</Th>
              <Th>Center</Th>
              <Th>Session</Th>
              <Th>Mobile</Th>
              <Th>Entry</Th>
              <Th>Status</Th>
              <Th>Actions</Th>
            </tr>
          </Thead>
          <Tbody>
            {filtered.length === 0 ? (
              <Tr><Td colSpan={10} className="text-center text-gray-400 py-12">No students found</Td></Tr>
            ) : filtered.map((s, i) => (
              <Tr key={s.id}>
                <Td className="text-gray-400 text-xs w-10">{i + 1}</Td>
                <Td>
                  <p className="font-semibold text-gray-900">{s.student_name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{s.gender}{s.date_of_birth ? ` · ${s.date_of_birth}` : ''}</p>
                </Td>
                <Td className="text-gray-500 font-mono text-xs">{s.enrollment_no || '—'}</Td>
                <Td className="text-gray-500 text-xs max-w-[150px] truncate">{s.programs?.program_name || '—'}</Td>
                <Td className="text-gray-500 text-xs">{s.centers?.center_name || '—'}</Td>
                <Td className="text-gray-500 text-xs">{s.academic_sessions?.session_name || '—'}</Td>
                <Td className="text-gray-500">{s.mobile_no || '—'}</Td>
                <Td className="text-gray-500 text-xs">{s.entry_type || '—'}</Td>
                <Td><Badge status={s.status?.toLowerCase()}>{s.status || 'Pending'}</Badge></Td>
                <Td>
                  <Button size="sm" variant="ghost" onClick={() => navigate(`/admin/students/edit/${s.id}`)}>
                    <Edit size={14} />
                  </Button>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </div>
  )
}
