import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui/Table'
import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import { Plus, Search, Edit, Download } from 'lucide-react'
import { generateStudentPDF } from '../../utils/generateStudentPDF'

const STATUS_FILTERS = ['All', 'Pending', 'Hold', 'Approved', 'Rejected']

export default function CenterStudents() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [downloading, setDownloading] = useState(null)
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!user) return
    supabase.from('centers').select('id').eq('email', user.email).single()
      .then(({ data: cd }) => { if (cd) fetchStudents(cd.id) })
  }, [user])

  async function handleDownload(studentId) {
    setDownloading(studentId)
    const { data: s } = await supabase
      .from('students')
      .select('*, programs(program_name), academic_sessions(session_name), centers(center_name, center_code), departments(name), study_modes(mode_name)')
      .eq('id', studentId)
      .single()
    if (s) generateStudentPDF(s, s.programs?.program_name, s.academic_sessions?.session_name, s.centers?.center_name)
    setDownloading(null)
  }

  async function fetchStudents(centerId) {
    setLoading(true)
    const { data } = await supabase
      .from('students')
      .select('id, student_name, enrollment_no, admission_number, mobile_no, gender, status, remarks, programs(program_name), academic_sessions(session_name)')
      .eq('center_id', centerId)
      .order('created_at', { ascending: false })
    setData(data || [])
    setLoading(false)
  }

  const filtered = data.filter(s => {
    const matchSearch = `${s.student_name} ${s.enrollment_no} ${s.mobile_no} ${s.admission_number}`.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'All' || s.status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <div className="p-6">
      <PageHeader
        title="My Students"
        subtitle={`${data.length} students`}
        action={{ label: <><Plus size={15} /> Add Student</>, onClick: () => navigate('/center/students/new') }}
      />

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm w-64 focus:outline-none focus:border-[#933d18] focus:ring-2 focus:ring-[#933d18]/15 bg-white"
            placeholder="Search students..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_FILTERS.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                statusFilter === s ? 'bg-[#933d18] text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-500 hover:border-[#933d18]/40 hover:text-[#933d18]'
              }`}>
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
              <Th>Admission No</Th>
              <Th>Enrollment No</Th>
              <Th>Program</Th>
              <Th>Session</Th>
              <Th>Mobile</Th>
              <Th>Remarks</Th>
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
                  <p className="text-xs text-gray-400 mt-0.5">{s.gender}</p>
                </Td>
                <Td>
                  {s.status === 'Approved' || s.status === 'Hold'
                    ? <span className="font-mono text-xs font-bold text-[#933d18]">{s.admission_number || '—'}</span>
                    : <span className="text-xs text-gray-300">—</span>
                  }
                </Td>
                <Td>
                  {s.status === 'Approved'
                    ? <span className="font-mono text-xs font-bold text-emerald-700">{s.enrollment_no || '—'}</span>
                    : <span className="text-xs text-gray-300">—</span>
                  }
                </Td>
                <Td className="text-gray-500 text-xs">{s.programs?.program_name || '—'}</Td>
                <Td className="text-gray-500 text-xs">{s.academic_sessions?.session_name || '—'}</Td>
                <Td className="text-gray-500">{s.mobile_no || '—'}</Td>
                <Td className="text-xs max-w-[120px] truncate" title={s.remarks}>
                  {s.remarks
                    ? <span className={s.status === 'Rejected' ? 'text-red-600 font-medium' : 'text-gray-500'}>{s.remarks}</span>
                    : <span className="text-gray-300">—</span>
                  }
                </Td>
                <Td><Badge status={s.status?.toLowerCase()}>{s.status || 'Pending'}</Badge></Td>
                <Td>
                  <div className="flex gap-1">
                    {s.status === 'Pending' && (
                      <Button size="sm" variant="ghost" onClick={() => navigate(`/center/students/edit/${s.id}`)}>
                        <Edit size={14} />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDownload(s.id)}
                      disabled={downloading === s.id}
                      title="Download Form PDF"
                    >
                      <Download size={14} className={downloading === s.id ? 'animate-pulse text-[#933d18]' : 'text-gray-500'} />
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
