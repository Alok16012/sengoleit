import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui/Table'
import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import { Search, Edit, Plus, Download } from 'lucide-react'
import { generateStudentPDF } from '../../utils/generateStudentPDF'
import { resolveStudentDocUrls } from '../../utils/resolveStudentDocs'

const STATUS_FILTERS = ['All', 'Pending', 'Reviewing', 'Document Verified', 'Account Section', 'Hold', 'Rejected', 'Admitted']

const STATUS_DISPLAY = {
  'Pending': 'Pending',
  'Reviewing': 'Documents Verification',
  'Document Verified': 'Documents Verified',
  'Account Section': 'Under Process for Enrollment',
  'Rejected': 'Rejected',
  'Admitted': 'Enrolled',
  'Hold': 'Hold',
}

const STATUS_COLOR = {
  'Pending': 'bg-amber-50 text-amber-700',
  'Reviewing': 'bg-blue-50 text-blue-700',
  'Document Verified': 'bg-indigo-50 text-indigo-700',
  'Account Section': 'bg-purple-50 text-purple-700',
  'Rejected': 'bg-red-50 text-red-700',
  'Admitted': 'bg-emerald-50 text-emerald-700',
  'Hold': 'bg-orange-50 text-orange-700',
}

export default function SuperCenterStudents() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [myCenterId, setMyCenterId] = useState(null)
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [sourceFilter, setSourceFilter] = useState('All') // 'All', 'Mine', 'Sub-Centers'
  const [downloading, setDownloading] = useState(null)

  useEffect(() => {
    if (!user) return
    supabase.from('centers').select('id').eq('email', user.email).single()
      .then(({ data: cd }) => {
        if (cd) {
          setMyCenterId(cd.id)
          fetchStudents(cd.id)
        }
      })
  }, [user])

  async function handleDownload(studentId) {
    setDownloading(studentId)
    const { data: s } = await supabase
      .from('students')
      .select('*, programs(program_name), academic_sessions(session_name), centers(center_name, center_code), departments(name), study_modes(mode_name)')
      .eq('id', studentId)
      .single()
    if (s) {
      const resolved = await resolveStudentDocUrls(s)
      generateStudentPDF(resolved, resolved.programs?.program_name, resolved.academic_sessions?.session_name, resolved.centers?.center_name)
    }
    setDownloading(null)
  }

  async function fetchStudents(superCenterId) {
    setLoading(true)

    // Get sub-center IDs
    const { data: subCenters } = await supabase
      .from('centers')
      .select('id, center_name, center_code')
      .eq('super_center_id', superCenterId)

    const subCenterIds = (subCenters || []).map(c => c.id)
    const allIds = [superCenterId, ...subCenterIds]

    // Get students from all centers
    const { data: students } = await supabase
      .from('students')
      .select('id, student_name, enrollment_no, admission_number, mobile_no, gender, status, remarks, entry_type, submitted_by, created_at, programs(program_name), academic_sessions(session_name), centers(id, center_name, center_code)')
      .in('center_id', allIds)
      .order('created_at', { ascending: false })

    setData(students || [])
    setLoading(false)
  }

  const filtered = data.filter(s => {
    const searchStr = `${s.student_name} ${s.enrollment_no} ${s.mobile_no} ${s.admission_number} ${s.programs?.program_name || ''} ${s.academic_sessions?.session_name || ''} ${s.centers?.center_name || ''}`.toLowerCase()
    const matchSearch = searchStr.includes(search.toLowerCase())
    const matchStatus = statusFilter === 'All' || s.status === statusFilter
    const matchSource = sourceFilter === 'All'
      ? true
      : sourceFilter === 'Mine'
        ? s.centers?.id === myCenterId
        : s.centers?.id !== myCenterId
    return matchSearch && matchStatus && matchSource
  })

  const pendingCount = data.filter(s => s.status === 'Pending').length
  const holdCount = data.filter(s => s.status === 'Hold').length

  return (
    <div className="p-6">
      <PageHeader
        title="Students"
        subtitle={`${data.length} total students`}
        action={{ label: <><Plus size={15} /> Add Student</>, onClick: () => navigate('/super-center/students/new') }}
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Total', value: data.length, color: 'gray' },
          { label: 'Pending', value: pendingCount, color: 'amber' },
          { label: 'Hold (Acc. Dept.)', value: holdCount, color: 'indigo' },
          { label: 'Approved', value: data.filter(s => s.status === 'Approved').length, color: 'emerald' },
        ].map(card => (
          <div key={card.label} className={`bg-${card.color}-50 border border-${card.color}-100 rounded-xl p-4`}>
            <p className={`text-xs font-semibold text-${card.color}-600 mb-1`}>{card.label}</p>
            <p className={`text-2xl font-black text-${card.color}-800`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm w-64 focus:outline-none focus:border-[#933d18] focus:ring-2 focus:ring-[#933d18]/15 bg-white"
            placeholder="Search students..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Source filter */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {['All', 'Mine', 'Sub-Centers'].map(s => (
            <button key={s} onClick={() => setSourceFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${sourceFilter === s ? 'bg-white text-[#933d18] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {s}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_FILTERS.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                statusFilter === s ? 'bg-[#933d18] text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-500 hover:border-[#933d18]/40 hover:text-[#933d18]'
              }`}>
              {s === 'All' ? 'All' : (STATUS_DISPLAY[s] || s)}
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
              <Th>Center</Th>
              <Th>Mobile</Th>
              <Th>Remarks</Th>
              <Th>Status</Th>
              <Th>Actions</Th>
            </tr>
          </Thead>
          <Tbody>
            {filtered.length === 0 ? (
              <Tr><Td colSpan={11} className="text-center text-gray-400 py-12">No students found</Td></Tr>
            ) : filtered.map((s, i) => (
              <Tr key={s.id}>
                <Td className="text-gray-400 text-xs w-10">{i + 1}</Td>
                <Td>
                  <p className="font-semibold text-gray-900">{s.student_name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{s.gender}</p>
                </Td>
                <Td className="font-mono text-xs text-[#933d18] font-bold">
                  {s.status === 'Approved' || s.status === 'Hold' ? (s.admission_number || '—') : '—'}
                </Td>
                <Td className="font-mono text-xs text-gray-700">
                  {s.status === 'Approved' ? (s.enrollment_no || '—') : '—'}
                </Td>
                <Td className="text-gray-500 text-xs min-w-[160px] whitespace-normal break-words">{s.programs?.program_name || '—'}</Td>
                <Td className="text-gray-500 text-xs">{s.academic_sessions?.session_name || '—'}</Td>
                <Td>
                  <p className="text-xs font-medium text-gray-700">{s.centers?.center_name || '—'}</p>
                  {s.centers?.id === myCenterId && (
                    <span className="text-[10px] bg-purple-50 text-purple-600 font-bold px-1.5 py-0.5 rounded-full">Mine</span>
                  )}
                </Td>
                <Td className="text-gray-500">{s.mobile_no || '—'}</Td>
                <Td className="text-gray-500 text-xs max-w-[120px] truncate" title={s.remarks}>{s.remarks || '—'}</Td>
                <Td>
                  <span className={`text-[11px] font-bold px-2 py-1 rounded-full whitespace-nowrap ${STATUS_COLOR[s.status] || 'bg-gray-50 text-gray-600'}`}>
                    {STATUS_DISPLAY[s.status] || s.status || 'Pending'}
                  </span>
                </Td>
                <Td>
                  <div className="flex gap-1">
                    {s.centers?.id === myCenterId && (
                      <Button size="sm" variant="ghost" onClick={() => navigate(`/super-center/students/edit/${s.id}`)}>
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
