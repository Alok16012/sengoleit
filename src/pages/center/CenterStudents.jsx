import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui/Table'
import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import { Plus, Search } from 'lucide-react'

export default function CenterStudents() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!user) return
    supabase.from('centers').select('id').eq('email', user.email).single()
      .then(({ data }) => { if (data) fetchStudents(data.id) })
  }, [user])

  async function fetchStudents(centerId) {
    setLoading(true)
    const { data } = await supabase
      .from('students')
      .select('id, student_name, enrollment_no, mobile_no, gender, status, programs(program_name), academic_sessions(session_name)')
      .eq('center_id', centerId)
      .order('created_at', { ascending: false })
    setData(data || [])
    setLoading(false)
  }

  const filtered = data.filter(s =>
    `${s.student_name} ${s.enrollment_no} ${s.mobile_no}`.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6">
      <PageHeader
        title="My Students"
        subtitle={`${data.length} students`}
        action={{ label: <><Plus size={15} /> Add Student</>, onClick: () => navigate('/center/students/new') }}
      />

      <div className="mb-4 relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#933d18] focus:ring-2 focus:ring-[#933d18]/15 bg-white"
          placeholder="Search students..."
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
              <Th>Student Name</Th>
              <Th>Enrollment No</Th>
              <Th>Program</Th>
              <Th>Session</Th>
              <Th>Mobile</Th>
              <Th>Status</Th>
            </tr>
          </Thead>
          <Tbody>
            {filtered.length === 0 ? (
              <Tr><Td colSpan={7} className="text-center text-gray-400 py-12">No students found</Td></Tr>
            ) : filtered.map((s, i) => (
              <Tr key={s.id}>
                <Td className="text-gray-400 text-xs w-10">{i + 1}</Td>
                <Td>
                  <p className="font-semibold text-gray-900">{s.student_name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{s.gender}</p>
                </Td>
                <Td className="text-gray-500 font-mono text-xs">{s.enrollment_no || '—'}</Td>
                <Td className="text-gray-500 text-xs">{s.programs?.program_name || '—'}</Td>
                <Td className="text-gray-500 text-xs">{s.academic_sessions?.session_name || '—'}</Td>
                <Td className="text-gray-500">{s.mobile_no || '—'}</Td>
                <Td><Badge status={s.status?.toLowerCase()}>{s.status || 'Pending'}</Badge></Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </div>
  )
}
