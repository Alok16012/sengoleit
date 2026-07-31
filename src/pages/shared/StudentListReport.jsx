import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui/Table'
import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import { Search, Download, FileX, Edit, FileText, CreditCard, ClipboardList, Send, Lock, X, Award } from 'lucide-react'
import { generateStudentPDF } from '../../utils/generateStudentPDF'
import { generateIDCard, generateAdmitCard, generateRegistrationCertificate, generateOfferLetter, generateEntranceClearance, generateHallTicket, isPhdProgram } from '../../utils/generateStudentCards'
import { fetchAdmitCardSubjects } from '../../utils/fetchSyllabus'
import { fetchExamSettingsMeta, fetchExamDates } from '../../utils/examSettings'
import { resolveStudentDocUrls } from '../../utils/resolveStudentDocs'
import { formatDate } from '../../utils/formatDate'
import { computeCumulativeCourseFee } from '../../utils/courseFee'
import { letterOptsFor } from '../../utils/letterSettings'

const STATUS_META = {
  Pending:    { color: 'amber',   label: 'Pending Students',    desc: 'Forms submitted — not yet forwarded to the Document Dept.' },
  Hold:       { color: 'indigo',  label: 'Hold Students',       desc: 'Sent back for correction by the Document Dept.' },
  Forwarding: { color: 'blue',    label: 'Forwarding Students', desc: 'Forwarded by the center — under Document / Account Dept. processing' },
  Approved:   { color: 'emerald', label: 'Approved Students',   desc: 'Entire process complete — Admission confirmed' },
  Rejected:   { color: 'red',     label: 'Rejected Students',   desc: 'Application has been rejected' },
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
  const [forwardModal, setForwardModal] = useState(null) // { student, courseFee, discount, net, balance, loading, staging, targetId }
  const [forwarding, setForwarding] = useState(false)
  const [resultStudent, setResultStudent] = useState(null)
  // Target centers for a Staging-center transfer (super center → center cascade).
  const [allCenters, setAllCenters] = useState([])
  const [superCentersList, setSuperCentersList] = useState([])
  const [targetSuper, setTargetSuper] = useState('all')

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

  // Real (non-staging) centers a Staging center can transfer students into.
  useEffect(() => {
    supabase.from('centers')
      .select('id, center_name, center_code, center_type, super_center_id, virtual_balance')
      .in('center_type', ['center', 'super_center'])
      .order('center_name')
      .then(({ data }) => {
        const rows = (data || []).filter(c => !c.is_staging)
        setAllCenters(rows.filter(c => c.center_type === 'center'))
        setSuperCentersList(rows.filter(c => c.center_type === 'super_center'))
      })
  }, [])

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

    let q = supabase
      .from('students')
      .select('id, student_name, enrollment_no, registration_no, admission_number, semester_year, mobile_no, gender, status, remarks, submitted_by, created_at, doc_verified_at, forwarded_at, admit_card_released_at, exam_result_status, exam_result_obtained_marks, exam_result_total_marks, exam_result_marksheet_url, exam_result_declared_at, exam_result_remarks, fee_held, coupon_discount, programme_id, session_id, programs(program_name, semester_year, duration), academic_sessions(session_name), centers(id, center_name, center_code, virtual_balance, is_staging)')
      .in('center_id', centerIds)
      .not('is_hidden', 'is', true)   // students hidden by admin must not show to centers

    // Stage routing:
    //  - Pending   : submitted by center, NOT yet forwarded (forwarded_at null).
    //  - Forwarding: forwarded by center & still in processing — either awaiting
    //                Document Dept. verification (status Pending + forwarded_at set)
    //                or doc-verified & sent to Account Dept. (status Hold + doc_verified_at set).
    //  - Hold      : Document Dept. sent it back for correction (status Hold + doc_verified_at null).
    if (status === 'Pending') {
      q = q.eq('status', 'Pending').is('forwarded_at', null)
    } else if (status === 'Forwarding') {
      q = q.or('and(status.eq.Pending,forwarded_at.not.is.null),and(status.eq.Hold,doc_verified_at.not.is.null)')
    } else if (status === 'Hold') {
      q = q.eq('status', 'Hold').is('doc_verified_at', null)
    } else {
      q = q.eq('status', status)
    }

    const { data: students } = await q.order('created_at', { ascending: false })

    // Staging-center students are admin-managed drafts (entered for Transfer &
    // Forward) — they must not appear in the CENTER portal's own lists.
    let rows = role === 'center'
      ? (students || []).filter(s => !s.centers?.is_staging)
      : (students || [])

    // Ph.D publication flags live behind add_phd_portal_flow.sql. They are read
    // in a separate query so a database without that migration still lists
    // students normally — the flags simply stay undefined.
    if (rows.length) {
      // hall_ticket_active is newer still (add_hall_ticket.sql) — retry without
      // it so the older flags keep working on a partially migrated database.
      let { data: flags, error: flagsErr } = await supabase
        .from('students')
        .select('id, hall_ticket_active, offer_letter_active, entrance_letter_active, result_released_at')
        .in('id', rows.map(r => r.id))
      if (flagsErr) {
        ;({ data: flags } = await supabase
          .from('students')
          .select('id, offer_letter_active, entrance_letter_active, result_released_at')
          .in('id', rows.map(r => r.id)))
      }
      if (flags) {
        const byId = Object.fromEntries(flags.map(f => [f.id, f]))
        rows = rows.map(r => ({ ...r, ...(byId[r.id] || {}) }))
      }
    }
    setData(rows)
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

  // Registration Certificate / ID Card / Admit Card for enrolled students.
  async function handleCard(studentId, type) {
    setDownloading(`${studentId}-${type}`)
    const { data: s } = await supabase
      .from('students')
      .select('*, programs(program_name, duration, complete_duration, semester_year), academic_sessions(session_name, start_date), centers(center_name, center_code), departments(name), study_modes(mode_name)')
      .eq('id', studentId)
      .single()
    if (s) {
      const resolved = await resolveStudentDocUrls(s)
      if (type === 'reg') generateRegistrationCertificate(resolved)
      else if (type === 'id') generateIDCard(resolved)
      // Reuse the Ref. No. / dates the Research Dept issued for these letters.
      else if (type === 'hall') generateHallTicket(resolved, await letterOptsFor(studentId, 'Hall Ticket', resolved.session_id))
      else if (type === 'offer') generateOfferLetter(resolved, await letterOptsFor(studentId, 'Offer Letter', resolved.session_id))
      else if (type === 'entrance') generateEntranceClearance(resolved, await letterOptsFor(studentId, 'Entrance Certificate', resolved.session_id))
      else if (type === 'admit') {
        const subjects = await fetchAdmitCardSubjects(resolved)
        const meta = await fetchExamSettingsMeta(resolved)
        const dates = await fetchExamDates(resolved)
        generateAdmitCard(resolved, subjects, { ...meta, ...dates })
      }
    }
    setDownloading(null)
  }

  // Compute the FULL course fee for the semester/year this student is admitted
  // into, minus any reserved coupon, plus the center's live wallet balance.
  // Mirrors the calculation in StudentForm / AccountDepartment.
  async function computeNetFee(student) {
    // Same cumulative course fee the center saw on the entry form (shared util).
    const { courseFee } = await computeCumulativeCourseFee({
      programme_id: student.programme_id,
      session_id: student.session_id,
      semester_year: student.semester_year,
      semYear: student.programs?.semester_year,
      duration: student.programs?.duration,
      programName: student.programs?.program_name,
    })

    // Coupon discount applied at submission. Prefer the value stored on the
    // student row; fall back to the coupons-table linkage for older records.
    let discount = Number(student.coupon_discount || 0)
    if (!discount) {
      const { data: cpn } = await supabase
        .from('coupons')
        .select('face_value')
        .eq('application_id', student.id)
        .maybeSingle()
      discount = Number(cpn?.face_value || 0)
    }

    // Fresh wallet balance for the center.
    let balance = Number(student.centers?.virtual_balance || 0)
    if (student.centers?.id) {
      const { data: ctr } = await supabase
        .from('centers').select('virtual_balance').eq('id', student.centers.id).maybeSingle()
      if (ctr) balance = Number(ctr.virtual_balance || 0)
    }

    // Hold 50% of the course fee at forward, minus any coupon — matches the
    // "50% Required" the center saw in the entry wallet check.
    const net = Math.max(Math.ceil(courseFee * 0.5) - discount, 0)
    return { courseFee, discount, net, balance }
  }

  // Open the forward confirmation modal and load the fee that will be held.
  // For a Staging center the wallet balance is the TARGET center's (picked in the
  // modal); for a normal center it's the student's own center.
  async function openForward(student) {
    const staging = !!student.centers?.is_staging
    setTargetSuper('all')
    setForwardModal({ student, loading: true, courseFee: 0, discount: 0, net: 0, balance: 0, staging, targetId: '' })
    const f = await computeNetFee(student)
    setForwardModal({ student, loading: false, staging, targetId: '', ...f, balance: staging ? 0 : f.balance })
  }

  // Staging transfer: pick the destination center; its wallet balance drives the
  // sufficiency check.
  function pickTarget(centerId) {
    const target = allCenters.find(c => c.id === centerId)
    setForwardModal(m => m && { ...m, targetId: centerId, balance: Number(target?.virtual_balance || 0) })
  }

  // Move the student to the Document Dept and HOLD the full net fee: deduct it
  // from the center wallet and record it in students.fee_held.
  async function confirmForward() {
    if (!forwardModal || forwardModal.loading) return
    const { student, net, balance, staging, targetId } = forwardModal
    // Staging transfer must have a destination center.
    if (staging && !targetId) { alert('Please select the center to transfer this student to.'); return }
    if (net > 0 && balance < net) {
      alert(
        `Insufficient wallet balance.\n\n` +
        `Fee to hold: ₹${net.toLocaleString('en-IN')}\n` +
        `Available balance: ₹${Number(balance).toLocaleString('en-IN')}\n\n` +
        `Please recharge the ${staging ? 'destination center' : ''} wallet before forwarding this student.`
      )
      return
    }
    // The wallet the fee is held against: the destination center for a staging
    // transfer, otherwise the student's own center.
    const walletCenterId = staging ? targetId : student.centers?.id
    setForwarding(true)
    try {
      const update = {
        fee_held: net,
        forwarded_at: new Date().toISOString(),
      }
      // Reassign the student to the destination center on transfer. The super
      // center relationship follows automatically (it's derived from the center's
      // super_center_id — students have no super_center_id column of their own).
      if (staging) update.center_id = targetId
      await supabase.from('students').update(update).eq('id', student.id)

      if (net > 0 && walletCenterId) {
        await supabase.from('centers')
          .update({ virtual_balance: balance - net })
          .eq('id', walletCenterId)
      }
      setForwardModal(null)
      fetchStudents(myCenterId)
    } finally {
      setForwarding(false)
    }
  }

  const filtered = data.filter(s =>
    `${s.student_name} ${s.enrollment_no} ${s.mobile_no} ${s.admission_number}`.toLowerCase().includes(search.toLowerCase())
  )

  const colorMap = {
    amber:   { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   count: 'bg-amber-500' },
    indigo:  { bg: 'bg-indigo-50',  border: 'border-indigo-200',  text: 'text-indigo-700',  count: 'bg-indigo-500' },
    blue:    { bg: 'bg-blue-50',    border: 'border-blue-200',    text: 'text-blue-700',    count: 'bg-blue-500' },
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
        <Table className={status === 'Approved' ? 'min-w-[1480px]' : 'min-w-[1000px]'}>
          <Thead>
            <tr>
              <Th>#</Th>
              <Th>Student Name</Th>
              <Th>Application No</Th>
              {status === 'Approved' && <Th>Enrollment No</Th>}
              {status === 'Approved' && <Th>Registration / Application No</Th>}
              <Th>Program</Th>
              <Th>Sem / Year</Th>
              <Th>Session</Th>
              {role === 'super_center' && <Th>Center</Th>}
              <Th>Mobile</Th>
              <Th>Submitted On</Th>
              {(status === 'Rejected' || status === 'Hold' || status === 'Forwarding' || status === 'Approved') &&<Th>Remarks</Th>}
              <Th>Status</Th>
              <Th>{status === 'Approved' ? 'Downloads' : 'Download'}</Th>
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
                {status === 'Approved' && (
                  <Td>
                    {(s.registration_no || s.admission_number)
                      ? <span className="font-mono text-xs font-bold text-indigo-700">{s.registration_no || s.admission_number}</span>
                      : <span className="text-xs text-gray-300">—</span>}
                  </Td>
                )}
                <Td className="text-gray-500 text-xs whitespace-nowrap">{s.programs?.program_name || '—'}</Td>
                <Td className="text-gray-500 text-xs whitespace-nowrap">
                  {s.semester_year
                    ? `${String(s.semester_year).replace(/\s*(semesters?|sems?|years?)\s*/gi, '').trim() || s.semester_year} ${s.programs?.semester_year === 'Year' ? 'Year' : 'Sem'}`
                    : '—'}
                </Td>
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
                {(status === 'Rejected' || status === 'Hold' || status === 'Forwarding' || status === 'Approved') &&(
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
                  {s.status === 'Pending' && s.forwarded_at && (
                    <p className="text-[10px] font-semibold mt-0.5 text-blue-600 flex items-center gap-0.5">
                      <Lock size={9} /> ₹{Number(s.fee_held || 0).toLocaleString('en-IN')} held
                    </p>
                  )}
                </Td>
                <Td>
                  <div className="flex items-center gap-1 flex-nowrap whitespace-nowrap">
                    {status === 'Pending' && role !== 'admin' && !s.forwarded_at && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openForward(s)}
                        title={s.centers?.is_staging ? 'Transfer to a center & forward (holds the fee from that center)' : 'Forward to Document Dept. (holds the full fee)'}
                      >
                        <Send size={14} className="text-blue-600" />
                        <span className="text-xs ml-1 text-blue-600">{s.centers?.is_staging ? 'Transfer' : 'Forward'}</span>
                      </Button>
                    )}
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
                      title="Download Admission Form PDF"
                    >
                      <Download size={14} className={downloading === s.id ? 'animate-pulse text-[#933d18]' : 'text-gray-500'} />
                      <span className="text-xs ml-1">{downloading === s.id ? '...' : 'Form'}</span>
                    </Button>
                    {s.status === 'Approved' && (
                      <>
                        {!isPhdProgram(s.programs?.program_name) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleCard(s.id, 'reg')}
                            disabled={downloading === `${s.id}-reg`}
                            title="Download Registration Certificate"
                          >
                            <FileText size={14} className={downloading === `${s.id}-reg` ? 'animate-pulse text-[#933d18]' : 'text-indigo-600'} />
                            <span className="text-xs ml-1 text-indigo-600">{downloading === `${s.id}-reg` ? '...' : 'Reg Card'}</span>
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCard(s.id, 'id')}
                          disabled={!s.enrollment_no || downloading === `${s.id}-id`}
                          title={s.enrollment_no ? 'Download ID Card' : 'ID card is issued after the Enrollment Number is generated'}
                        >
                          <CreditCard size={14} className={downloading === `${s.id}-id` ? 'animate-pulse text-[#933d18]' : 'text-emerald-600'} />
                          <span className="text-xs ml-1 text-emerald-600">{downloading === `${s.id}-id` ? '...' : 'ID Card'}</span>
                        </Button>
                        {isPhdProgram(s.programs?.program_name) && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => handleCard(s.id, 'hall')} disabled={!s.hall_ticket_active || downloading === `${s.id}-hall`} title={s.hall_ticket_active ? 'Download Ph.D Entrance Exam Hall Ticket' : 'Hall ticket not released by the Research Dept yet'}>
                              <FileText size={14} className={downloading === `${s.id}-hall` ? 'animate-pulse text-[#933d18]' : 'text-[#933d18]'} />
                              <span className="text-xs ml-1 text-[#933d18]">{downloading === `${s.id}-hall` ? '...' : 'Hall Ticket'}</span>
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleCard(s.id, 'offer')} disabled={!s.offer_letter_active || downloading === `${s.id}-offer`} title={s.offer_letter_active ? 'Download Ph.D Offer Letter' : 'Offer letter not released by the Research Dept yet'}>
                              <FileText size={14} className={downloading === `${s.id}-offer` ? 'animate-pulse text-[#933d18]' : 'text-[#933d18]'} />
                              <span className="text-xs ml-1 text-[#933d18]">{downloading === `${s.id}-offer` ? '...' : 'Offer Letter'}</span>
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleCard(s.id, 'entrance')} disabled={!s.entrance_letter_active || downloading === `${s.id}-entrance`} title={s.entrance_letter_active ? 'Download Ph.D Entrance Clearance Certificate' : 'Entrance certificate not released by the Research Dept yet'}>
                              <FileText size={14} className={downloading === `${s.id}-entrance` ? 'animate-pulse text-[#933d18]' : 'text-[#933d18]'} />
                              <span className="text-xs ml-1 text-[#933d18]">{downloading === `${s.id}-entrance` ? '...' : 'Entrance Clr.'}</span>
                            </Button>
                          </>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCard(s.id, 'admit')}
                          disabled={!s.admit_card_released_at || downloading === `${s.id}-admit`}
                          title={s.admit_card_released_at ? 'Download Admit Card' : 'Admit card not released by the Exam Section yet'}
                        >
                          <ClipboardList size={14} className={downloading === `${s.id}-admit` ? 'animate-pulse text-[#933d18]' : 'text-[#933d18]'} />
                          <span className="text-xs ml-1 text-[#933d18]">{downloading === `${s.id}-admit` ? '...' : 'Admit Card'}</span>
                        </Button>
                        {(() => {
                          const hasResult = s.exam_result_status && s.exam_result_status !== 'Pending' && !!s.result_released_at
                          const clr = !hasResult ? 'text-gray-400' : s.exam_result_status === 'Pass' ? 'text-emerald-600' : 'text-red-500'
                          return (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setResultStudent(s)}
                              disabled={!hasResult}
                              title={hasResult ? 'View Result' : 'Result not declared yet'}
                            >
                              <Award size={14} className={clr} />
                              <span className={`text-xs ml-1 ${clr}`}>Result</span>
                            </Button>
                          )
                        })()}
                      </>
                    )}
                  </div>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      {/* Forward confirmation — holds the full fee from the wallet */}
      {forwardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Send size={16} className="text-blue-600" /> {forwardModal.staging ? 'Transfer & Forward' : 'Forward to Document Dept.'}
              </h3>
              <button onClick={() => !forwarding && setForwardModal(null)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <div className="p-5">
              <p className="text-sm text-gray-600 mb-4">
                {forwardModal.staging ? (
                  <>Transfer <span className="font-semibold text-gray-900">{forwardModal.student.student_name}</span> to a
                  center — the form data moves as-is, <span className="font-semibold text-blue-700">50% of the fee is held
                  from that center's wallet</span>, and the application goes to the Document Department.</>
                ) : (
                  <>Forwarding <span className="font-semibold text-gray-900">{forwardModal.student.student_name}</span> will
                  send the application to the Document Department and <span className="font-semibold text-blue-700">hold 50%
                  of the fee</span> from the center wallet. The hold is released if the application is rejected.</>
                )}
              </p>

              {forwardModal.staging && (
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Super Center</label>
                    <select
                      className="w-full py-2 px-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-[#933d18]"
                      value={targetSuper}
                      onChange={e => { setTargetSuper(e.target.value); setForwardModal(m => m && { ...m, targetId: '', balance: 0 }) }}>
                      <option value="all">All Super Centers</option>
                      {superCentersList.map(sc => <option key={sc.id} value={sc.id}>{sc.center_name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wide block mb-1">Center *</label>
                    <select
                      className="w-full py-2 px-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-[#933d18]"
                      value={forwardModal.targetId}
                      onChange={e => pickTarget(e.target.value)}>
                      <option value="">Select Center</option>
                      {allCenters
                        .filter(c => targetSuper === 'all' || c.super_center_id === targetSuper)
                        .map(c => <option key={c.id} value={c.id}>{c.center_name}{c.center_code ? ` (${c.center_code})` : ''}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {forwardModal.loading ? (
                <div className="py-6 text-center text-sm text-gray-400">Calculating fee…</div>
              ) : (
                <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Course Fee</span>
                    <span className="font-semibold text-gray-800">₹{Number(forwardModal.courseFee).toLocaleString('en-IN')}</span>
                  </div>
                  {forwardModal.discount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Coupon Discount</span>
                      <span className="font-semibold text-emerald-600">− ₹{Number(forwardModal.discount).toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-gray-200 pt-2">
                    <span className="text-gray-700 font-semibold flex items-center gap-1"><Lock size={12} /> Amount to Hold</span>
                    <span className="font-black text-blue-700">₹{Number(forwardModal.net).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Wallet Balance</span>
                    <span className={`font-semibold ${forwardModal.balance < forwardModal.net ? 'text-red-600' : 'text-gray-800'}`}>
                      ₹{Number(forwardModal.balance).toLocaleString('en-IN')}
                    </span>
                  </div>
                  {forwardModal.balance < forwardModal.net && (
                    <p className="text-xs text-red-600 font-medium pt-1">
                      Insufficient balance — please recharge the wallet before forwarding.
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setForwardModal(null)} disabled={forwarding}>Cancel</Button>
              <Button
                onClick={confirmForward}
                disabled={forwarding || forwardModal.loading || forwardModal.balance < forwardModal.net || (forwardModal.staging && !forwardModal.targetId)}
              >
                {forwarding ? (forwardModal.staging ? 'Transferring…' : 'Forwarding…') : (forwardModal.staging ? 'Transfer & Forward' : 'Confirm & Forward')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {resultStudent && (
        <ResultViewModal student={resultStudent} onClose={() => setResultStudent(null)} />
      )}
    </div>
  )
}

function ResultViewModal({ student, onClose }) {
  const pct = (o, t) => (o && t ? `${((Number(o) / Number(t)) * 100).toFixed(1)}%` : '—')
  const pass = student.exam_result_status === 'Pass'
  const Field = ({ label, value }) => (
    <div>
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-sm font-bold text-gray-800">{value}</p>
    </div>
  )
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Award size={18} className={pass ? 'text-emerald-600' : 'text-red-500'} />
            <div>
              <h3 className="font-bold text-gray-900 leading-tight">Exam Result</h3>
              <p className="text-xs text-gray-400">{student.student_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Status</span>
            <span className={`text-xs font-black px-3 py-1 rounded-lg ${pass ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
              {student.exam_result_status}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Obtained Marks" value={student.exam_result_obtained_marks ?? '—'} />
            <Field label="Total Marks" value={student.exam_result_total_marks ?? '—'} />
            <Field label="Percentage" value={pct(student.exam_result_obtained_marks, student.exam_result_total_marks)} />
            <Field label="Declared On" value={student.exam_result_declared_at ? new Date(student.exam_result_declared_at).toLocaleDateString() : '—'} />
          </div>
          {student.exam_result_remarks && (
            <p className="text-sm text-gray-600 italic bg-gray-50 rounded-xl px-3 py-2">"{student.exam_result_remarks}"</p>
          )}
          {student.exam_result_marksheet_url && (
            <a href={student.exam_result_marksheet_url} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-xl transition-colors">
              <Download size={14} /> Download Marksheet
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
