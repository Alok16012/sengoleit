import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui/Table'
import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import { Search, Download, FileX, Edit } from 'lucide-react'
import { generateStudentPDF } from '../../utils/generateStudentPDF'
import { resolveStudentDocUrls } from '../../utils/resolveStudentDocs'
import { formatDate } from '../../utils/formatDate'

const STATUS_META = {
  Pending:  { color: 'amber',   label: 'Pending Students',  desc: 'Forms have been submitted, awaiting Document Dept. verification' },
  Hold:     { color: 'indigo',  label: 'Hold Students',     desc: 'Documents verified & awaiting Account Dept., or sent back for correction' },
  Approved: { color: 'emerald', label: 'Approved Students', desc: 'Entire process complete — Admission confirmed' },
  Rejected: { color: 'red',     label: 'Rejected Students', desc: 'Application has been rejected' },
}

export default function StudentListReport({ status }) {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const role = profile?.role || user?.user_metadata?.role || 'center'
  const editBase = role === 'super_center' ? '/super-center' : role === 'admin' ? '/admin' : '/center'
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [downloading, setDownloading] = useState(null)
  const [myCenterId, setMyCenterId] = useState(null)

  const meta = STATUS_META[status] || { color: 'gray', label: status + ' Students', desc: '' }

  useEffect(() => {
    if (!user) return
    supabase.from('centers').select('id').eq('email', user.email).single()
      .then(({ data: cd }) => {
        if (!cd) return
        setMyCenterId(cd.id)
        fetchStudents(cd.id)
      })
  }, [user, status])

  async function fetchStudents(centerId) {
    setLoading(true)

    let centerIds = [centerId]

    if (role === 'super_center') {
      const { data: subCenters } = await supabase
        .from('centers')
        .select('id')
        .eq('super_center_id', centerId)
      centerIds = [centerId, ...(subCenters || []).map(c => c.id)]
    }

    const { data: students } = await supabase
      .from('students')
      .select('id, student_name, enrollment_no, admission_number, mobile_no, gender, status, remarks, submitted_by, created_at, doc_verified_at, programs(program_name), academic_sessions(session_name), centers(id, center_name, center_code)')
      .in('center_id', centerIds)
      .eq('status', status)
      .order('created_at', { ascending: false })

    setData(students || [])
    setLoading(false)
  }

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

  const filtered = data.filter(s =>
    `${s.student_name} ${s.enrollment_no} ${s.mobile_no} ${s.admission_number}`.toLowerCase().includes(search.toLowerCase())
  )

  const colorMap = {
    amber:   { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   count: 'bg-amber-500' },
    indigo:  { bg: 'bg-indigo-50',  border: 'border-indigo-200',  text: 'text-indigo-700',  count: 'bg-indigo-500' },
    emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', count: 'bg-emerald-500' },
    red:     { bg: 'bg-red-50',     border: 'border-red-200',     text: 'text-red-700',     count: 'bg-red-500' },
    gray:    { bg: 'bg-gray-50',    border: 'border-gray-200',    text: 'text-gray-700',    count: 'bg-gray-500' },
  }
  const c = colorMap[meta.color]

  return (
    <div className="p-6">
      <PageHeader title={meta.label} subtitle={meta.desc} />

      {/* Count banner */}
      <div className={`${c.bg} ${c.border} border rounded-2xl p-4 mb-5 flex items-center gap-4`}>
        <div className={`${c.count} text-white text-2xl font-black w-14 h-14 rounded-xl flex items-center justify-center shrink-0`}>
          {loading ? '…' : data.length}
        </div>
        <div>
          <p className={`font-bold text-base ${c.text}`}>{data.length} {meta.label}</p>
          <p className="text-xs text-gray-500 mt-0.5">{meta.desc}</p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4 relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#933d18] focus:ring-2 focus:ring-[#933d18]/15 bg-white"
          placeholder="Search by name, mobile, admission no..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 flex flex-col items-center justify-center text-center">
          <div className={`w-14 h-14 ${c.bg} rounded-2xl flex items-center justify-center mb-3`}>
            <FileX size={26} className={c.text} />
          </div>
          <p className="font-bold text-gray-700">{search ? 'No results found' : `No ${status} students`}</p>
          <p className="text-xs text-gray-400 mt-1">
            {search ? 'Try changing your search terms' : `No students are in ${status} status yet`}
          </p>
        </div>
      ) : (
        <Table>
          <Thead>
            <tr>
              <Th>#</Th>
              <Th>Student Name</Th>
              <Th>Admission No</Th>
              {status === 'Approved' && <Th>Enrollment No</Th>}
              <Th>Program</Th>
              <Th>Session</Th>
              {role === 'super_center' && <Th>Center</Th>}
              <Th>Mobile</Th>
              <Th>Submitted On</Th>
              {(status === 'Rejected' || status === 'Hold' || status === 'Approved') && <Th>Remarks</Th>}
              <Th>Status</Th>
              <Th>Download</Th>
            </tr>
          </Thead>
          <Tbody>
            {filtered.map((s, i) => (
              <Tr key={s.id}>
                <Td className="text-gray-400 text-xs w-10">{i + 1}</Td>
                <Td>
                  <p className="font-semibold text-gray-900">{s.student_name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{s.gender}</p>
                </Td>
                <Td>
                  {s.admission_number
                    ? <span className="font-mono text-xs font-bold text-[#933d18]">{s.admission_number}</span>
                    : <span className="text-xs text-gray-300">—</span>}
                </Td>
                {status === 'Approved' && (
                  <Td>
                    {s.enrollment_no
                      ? <span className="font-mono text-xs font-bold text-emerald-700">{s.enrollment_no}</span>
                      : <span className="text-xs text-gray-300">—</span>}
                  </Td>
                )}
                <Td className="text-gray-500 text-xs max-w-[140px] truncate">{s.programs?.program_name || '—'}</Td>
                <Td className="text-gray-500 text-xs">{s.academic_sessions?.session_name || '—'}</Td>
                {role === 'super_center' && (
                  <Td>
                    <p className="text-xs font-medium text-gray-700">{s.centers?.center_name || '—'}</p>
                    {s.centers?.id === myCenterId && (
                      <span className="text-[10px] bg-purple-50 text-purple-600 font-bold px-1.5 py-0.5 rounded-full">Mine</span>
                    )}
                  </Td>
                )}
                <Td className="text-gray-500">{s.mobile_no || '—'}</Td>
                <Td className="text-gray-400 text-xs">
                  {formatDate(s.created_at)}
                </Td>
                {(status === 'Rejected' || status === 'Hold' || status === 'Approved') && (
                  <Td className="text-xs max-w-[240px] align-top" title={s.remarks}>
                    {s.remarks
                      ? <span className={`whitespace-pre-line break-words ${status === 'Rejected' ? 'text-red-600 font-medium' : 'text-gray-500'}`}>{s.remarks}</span>
                      : <span className="text-gray-300">—</span>}
                  </Td>
                )}
                <Td>
                  <Badge status={s.status?.toLowerCase()}>{s.status}</Badge>
                  {s.status === 'Hold' && (
                    <p className={`text-[10px] font-semibold mt-0.5 ${s.doc_verified_at ? 'text-indigo-500' : 'text-amber-600'}`}>
                      {s.doc_verified_at ? 'Awaiting Account Dept.' : 'Sent back for correction'}
                    </p>
                  )}
                </Td>
                <Td>
                  <div className="flex items-center gap-1">
                    {s.status === 'Hold' && !s.doc_verified_at && role !== 'admin' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigate(`${editBase}/students/edit/${s.id}`)}
                        title="Correct & resubmit"
                      >
                        <Edit size={14} className="text-amber-600" />
                        <span className="text-xs ml-1 text-amber-600">Correct</span>
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDownload(s.id)}
                      disabled={downloading === s.id}
                      title="Download PDF"
                    >
                      <Download size={14} className={downloading === s.id ? 'animate-pulse text-[#933d18]' : 'text-gray-500'} />
                      <span className="text-xs ml-1">{downloading === s.id ? '...' : 'PDF'}</span>
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
