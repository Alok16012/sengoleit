import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui/Table'
import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import { Plus, Search, Download, Send, RefreshCw, PencilLine } from 'lucide-react'
import ReRegistrationModal from '../../components/ReRegistrationModal'
import { fetchReRegistrations, nextTerm } from '../../utils/reRegistration'
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

// The DB status is only Pending / Hold / Approved / Rejected; the finer stage
// (shown as the tabs & badge) is derived from status + the workflow flags.
function stageOf(s) {
  if (s.status === 'Rejected') return 'Rejected'
  if (s.status === 'Approved') return 'Admitted'                 // Enrolled
  if (s.status === 'Hold') return s.doc_verified_at ? 'Account Section' : 'Hold'
  return s.forwarded_at ? 'Reviewing' : 'Pending'                // Pending status
}

// Match a student to the selected tab. 'Documents Verified' and 'Under Process
// for Enrollment' are the same underlying state (doc-verified, at Account).
function matchesFilter(s, filter) {
  if (filter === 'All') return true
  const st = stageOf(s)
  if (filter === 'Document Verified' || filter === 'Account Section') return st === 'Account Section'
  return st === filter
}

export default function CenterStudents() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [downloading, setDownloading] = useState(null)
  // Re-Registration: latest request per student ({} = none, null = table missing)
  const [reReg, setReReg] = useState({})
  const [reRegStudent, setReRegStudent] = useState(null)
  const [myCenterId, setMyCenterId] = useState(null)
  const { user } = useAuth()
  // The header search bar lands here as ?q=… — adopt it as the list filter.
  const location = useLocation()
  useEffect(() => {
    const q = new URLSearchParams(location.search).get('q')
    if (q != null) setSearch(q)
  }, [location.search])
  const navigate = useNavigate()

  useEffect(() => {
    if (!user) return
    supabase.from('centers').select('id').eq('email', user.email).single()
      .then(({ data: cd }) => { if (cd) { setMyCenterId(cd.id); fetchStudents(cd.id) } })
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

  async function fetchStudents(centerId) {
    setLoading(true)
    const { data } = await supabase
      .from('students')
      .select('id, student_name, enrollment_no, admission_number, mobile_no, gender, status, remarks, doc_verified_at, forwarded_at, semester_year, fee_collected, coupon_discount, center_id, programme_id, session_id, programs(program_name, duration, semester_year), academic_sessions(session_name)')
      .eq('center_id', centerId)
      .order('created_at', { ascending: false })
    setData(data || [])
    // null = add_re_registration.sql not run yet, so the feature stays hidden.
    setReReg(await fetchReRegistrations((data || []).map(s => s.id)))
    setLoading(false)
  }

  const filtered = data.filter(s => {
    const searchStr = `${s.student_name} ${s.enrollment_no} ${s.mobile_no} ${s.admission_number} ${s.programs?.program_name || ''} ${s.academic_sessions?.session_name || ''}`.toLowerCase()
    const matchSearch = searchStr.includes(search.toLowerCase())
    // "Pending" must mean the same thing as the sidebar Pending Student List:
    // status Pending AND not yet forwarded to the Document Dept. A forwarded
    // pending student is "in process", so it drops out of this tab.
    return matchSearch && matchesFilter(s, statusFilter)
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
              <Th>Application No</Th>
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
                  {s.admission_number
                    ? <span className="font-mono text-xs font-bold text-[#933d18]">{s.admission_number}</span>
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
                <Td className="text-xs max-w-[240px] align-top" title={s.remarks}>
                  {s.remarks
                    ? <span className={`whitespace-pre-line break-words ${s.status === 'Rejected' ? 'text-red-600 font-medium' : 'text-gray-500'}`}>{s.remarks}</span>
                    : <span className="text-gray-300">—</span>
                  }
                </Td>
                <Td>
                  {(() => { const st = stageOf(s); return (
                    <span className={`text-[11px] font-bold px-2 py-1 rounded-full whitespace-nowrap ${STATUS_COLOR[st] || 'bg-gray-50 text-gray-600'}`}>
                      {STATUS_DISPLAY[st] || st}
                    </span>
                  )})()}
                </Td>
                <Td>
                  <div className="flex gap-1 items-center">
                    {/* Sent back for correction. The centre has to be able to
                        act on it from here: the Hold Student List that used to
                        carry this button is hidden from centres, which left a
                        held student with no way back into the form at all.
                        The form itself unlocks only the flagged fields and
                        returns the student to Pending on save. */}
                    {stageOf(s) === 'Hold' && (
                      <Button size="sm" variant="ghost" onClick={() => navigate(`/center/students/edit/${s.id}`)} title="Correct and resubmit">
                        <PencilLine size={13} className="text-[#933d18]" />
                        <span className="text-xs ml-1 text-[#933d18]">Correct</span>
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
                    {s.status === 'Pending' && !s.forwarded_at && (
                      <Button size="sm" variant="ghost" onClick={() => navigate('/center/reports/pending')} title="Forward to Document Dept.">
                        <Send size={13} className="text-[#933d18]" />
                        <span className="text-xs ml-1 text-[#933d18]">Forward</span>
                      </Button>
                    )}
                    {/* Re-Registration — only for an enrolled student, only one
                        open request at a time, and only while there is a next
                        term to register into. A 1-year (2-semester) course
                        with both semesters already re-registered has nothing
                        left, and offering the button just to have the modal
                        say so is noise the centre has no use for. */}
                    {s.status === 'Approved' && reReg !== null && (
                      reReg[s.id]?.status === 'Pending' ? (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded whitespace-nowrap">
                          Re-Reg pending
                        </span>
                      ) : !nextTerm(s).atEnd ? (
                        <Button size="sm" variant="ghost" onClick={() => setReRegStudent(s)} title="Request Re-Registration">
                          <RefreshCw size={13} className="text-[#933d18]" />
                          <span className="text-xs ml-1 text-[#933d18]">Re-Reg</span>
                        </Button>
                      ) : null
                    )}
                  </div>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      {reRegStudent && (
        <ReRegistrationModal
          student={{ ...reRegStudent, center_id: reRegStudent.center_id || myCenterId }}
          mode="request"
          onClose={() => setReRegStudent(null)}
          onDone={() => { setReRegStudent(null); if (myCenterId) fetchStudents(myCenterId) }}
        />
      )}
    </div>
  )
}
