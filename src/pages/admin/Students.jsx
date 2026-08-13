import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui/Table'
import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import { Plus, Search, Edit, Download, KeyRound, Copy, RefreshCw, X, Trash2, AlertTriangle, Eye, EyeOff, Send, BadgeCheck, FileText, CreditCard, ClipboardList, Award, FileSpreadsheet, FolderDown } from 'lucide-react'
import { generateStudentPDF } from '../../utils/generateStudentPDF'
import { generateIDCard, generateAdmitCard, generateRegistrationCertificate, isPhdProgram } from '../../utils/generateStudentCards'
import { fetchAdmitCardSubjects } from '../../utils/fetchSyllabus'
import { fetchExamSettingsMeta } from '../../utils/examSettings'
import { resolveStudentDocUrls } from '../../utils/resolveStudentDocs'
import { formatDate, localDay } from '../../utils/formatDate'
import { exportCsv, exportPdf } from '../../utils/exportTable'
import { matchesSearch } from '../../utils/studentSearch'
import { generateAllDocumentsPDF } from '../../utils/generateAllDocumentsPDF'
import ReRegistrationModal from '../../components/ReRegistrationModal'
import { fetchReRegistrations } from '../../utils/reRegistration'
import RegistrationCardModal from '../../components/RegistrationCardModal'

const STATUS_FILTERS = ['All', 'Pending', 'Hold', 'Approved', 'Rejected']

function genPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let pwd = 'Sg@'
  for (let i = 0; i < 5; i++) pwd += chars[Math.floor(Math.random() * chars.length)]
  return pwd
}

function ResultViewModal({ student, onClose }) {
  const pct = (o, t) => (o && t ? `${((Number(o) / Number(t)) * 100).toFixed(1)}%` : '—')
  const pass = student.exam_result_status === 'Pass'
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

function Field({ label, value }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-sm font-bold text-gray-800">{value}</p>
    </div>
  )
}

function CredModal({ studentId, onClose }) {
  const [cred, setCred] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState('')

  useEffect(() => {
    supabase.from('students')
      .select('student_name, enrollment_no, email, login_password')
      .eq('id', studentId)
      .single()
      .then(({ data }) => { setCred(data); setLoading(false) })
  }, [studentId])

  async function handleGenerate() {
    setSaving(true)
    const pwd = genPassword()
    await supabase.from('students').update({ login_password: pwd }).eq('id', studentId)
    setCred(prev => ({ ...prev, login_password: pwd }))
    setSaving(false)
  }

  function copyText(text, key) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(''), 1500)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <KeyRound size={16} className="text-[#933d18]" />
            <h3 className="font-bold text-gray-900">Student Login Credentials</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {loading ? (
            <div className="text-center text-gray-400 py-8">Loading...</div>
          ) : (
            <>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Student</p>
                <p className="font-semibold text-gray-900">{cred?.student_name}</p>
              </div>

              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">
                  {cred?.enrollment_no ? 'Enrollment Number' : 'Email ID (Login ID)'}
                </p>
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                  <span className="flex-1 font-mono text-sm font-semibold text-gray-800">
                    {cred?.enrollment_no || cred?.email || '—'}
                  </span>
                  {(cred?.enrollment_no || cred?.email) && (
                    <button
                      onClick={() => copyText(cred.enrollment_no || cred.email, 'enroll')}
                      className="text-[#933d18] hover:text-[#933d18]/70 transition-colors"
                      title="Copy"
                    >
                      {copied === 'enroll' ? <span className="text-xs font-bold text-emerald-600">Copied!</span> : <Copy size={14} />}
                    </button>
                  )}
                </div>
                {!cred?.enrollment_no && (
                  <p className="text-[11px] text-gray-400 mt-1.5">
                    No enrollment number yet (issued once forwarded to the Exam Section) — this PhD student logs in with their Email ID instead.
                  </p>
                )}
              </div>

              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Password</p>
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                  <span className="flex-1 font-mono text-sm font-semibold text-gray-800">
                    {cred?.login_password || <span className="text-gray-300 italic text-xs font-sans">Not generated yet</span>}
                  </span>
                  {cred?.login_password && (
                    <button
                      onClick={() => copyText(cred.login_password, 'pwd')}
                      className="text-[#933d18] hover:text-[#933d18]/70 transition-colors"
                      title="Copy"
                    >
                      {copied === 'pwd' ? <span className="text-xs font-bold text-emerald-600">Copied!</span> : <Copy size={14} />}
                    </button>
                  )}
                </div>
              </div>

              <button
                onClick={handleGenerate}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#933d18] text-white text-sm font-bold hover:bg-[#b05a30] transition-colors disabled:opacity-60"
              >
                <RefreshCw size={14} className={saving ? 'animate-spin' : ''} />
                {cred?.login_password ? 'Reset Password' : 'Generate Password'}
              </button>

              {cred?.login_password && (
                <p className="text-center text-xs text-gray-400">
                  Share {cred?.enrollment_no ? 'enrollment number' : 'email ID'} + password with the student to login at{' '}
                  <span className="font-semibold text-[#933d18]">/student/login</span>
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Students() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  // Form-submission date range — how many admissions came in over a period.
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  // Re-Registration: latest request per student ({} = none, null = table missing)
  const [reReg, setReReg] = useState({})
  const [reRegStudent, setReRegStudent] = useState(null)
  // Registration Certificate is issued per YEAR — a picker gates each year on fee.
  const [regCardStudent, setRegCardStudent] = useState(null)
  const [downloading, setDownloading] = useState(null)
  const [credStudentId, setCredStudentId] = useState(null)
  // The header search bar lands here as ?q=… — adopt it as the list filter.
  const location = useLocation()
  useEffect(() => {
    const q = new URLSearchParams(location.search).get('q')
    if (q != null) setSearch(q)
  }, [location.search])
  const [resultStudent, setResultStudent] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [showHidden, setShowHidden] = useState(false)
  // Filter dropdowns
  const [superFilter, setSuperFilter] = useState('all')
  const [centerFilter, setCenterFilter] = useState('all')
  const [programFilter, setProgramFilter] = useState('all')
  const [sessionFilter, setSessionFilter] = useState('all')
  const [superCenters, setSuperCenters] = useState([])
  const [centerList, setCenterList] = useState([])
  const [programList, setProgramList] = useState([])
  const [sessionList, setSessionList] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    (async () => {
      const [sc, ct, pr, se] = await Promise.all([
        supabase.from('centers').select('id, center_name, center_code').eq('center_type', 'super_center').order('center_name'),
        supabase.from('centers').select('id, center_name, center_code, super_center_id').eq('center_type', 'center').order('center_name'),
        supabase.from('programs').select('id, program_name').order('program_name'),
        supabase.from('academic_sessions').select('id, session_name').order('session_name'),
      ])
      setSuperCenters(sc.data || [])
      setCenterList(ct.data || [])
      setProgramList(pr.data || [])
      setSessionList(se.data || [])
    })()
  }, [])

  async function toggleHide(s) {
    const newVal = !s.is_hidden
    const { error } = await supabase.from('students').update({ is_hidden: newVal }).eq('id', s.id)
    if (error) { alert('Could not update: ' + error.message); return }
    setData(prev => prev.map(x => x.id === s.id ? { ...x, is_hidden: newVal } : x))
  }

  // After account verification, the student is forwarded to the Exam Section.
  // The admit card is NOT generated here — it is generated only in the Exam Section.
  async function forwardToExam(s) {
    const now = new Date().toISOString()
    const { error } = await supabase.from('students').update({ exam_forwarded_at: now }).eq('id', s.id)
    if (error) { alert('Could not forward to Exam Section: ' + error.message); return }
    setData(prev => prev.map(x => x.id === s.id ? { ...x, exam_forwarded_at: now } : x))
  }

  useEffect(() => { fetchData() }, [])

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    // Free up any coupon reserved by this application so it can be reused.
    await supabase.from('coupons')
      .update({ is_used: false, used_at: null, application_id: null })
      .eq('application_id', deleteTarget.id)
    const { error } = await supabase.from('students').delete().eq('id', deleteTarget.id)
    setDeleting(false)
    if (error) { alert('Delete failed: ' + error.message); return }
    setData(prev => prev.filter(s => s.id !== deleteTarget.id))
    setDeleteTarget(null)
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

  // Registration Certificate / ID Card / Admit Card.
  // Every uploaded document as one printable set, for the office file.
  async function handleAllDocuments(studentId) {
    setDownloading(`${studentId}-docs`)
    const { data: s } = await supabase
      .from('students')
      .select('*, programs(program_name), academic_sessions(session_name), centers(center_name, center_code)')
      .eq('id', studentId)
      .single()
    if (s) generateAllDocumentsPDF(await resolveStudentDocUrls(s))
    setDownloading(null)
  }

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
      else if (type === 'admit') {
        const subjects = await fetchAdmitCardSubjects(resolved)
        const meta = await fetchExamSettingsMeta(resolved)
        generateAdmitCard(resolved, subjects, meta)
      }
    }
    setDownloading(null)
  }

  async function fetchData() {
    setLoading(true)
    const FULL = 'id, student_name, enrollment_no, registration_no, admission_number, mobile_no, gender, date_of_birth, status, date_of_submission, date_of_admission, created_at, entry_type, semester_year, fee_collected, coupon_discount, is_hidden, center_id, programme_id, session_id, exam_forwarded_at, admit_card_released_at, exam_result_status, exam_result_obtained_marks, exam_result_total_marks, exam_result_marksheet_url, exam_result_declared_at, exam_result_remarks, programs(program_name, duration, semester_year), academic_sessions(session_name), centers(center_name, center_code, super_center_id)'
    // Fallback for DBs where the exam-result / admit-card columns are not yet
    // created (run_all_migrations.sql not applied) — students still list; only
    // the admit-card / result actions stay inactive.
    const MIN = 'id, student_name, enrollment_no, registration_no, admission_number, mobile_no, gender, date_of_birth, status, date_of_submission, date_of_admission, created_at, entry_type, semester_year, fee_collected, coupon_discount, is_hidden, center_id, programme_id, session_id, exam_forwarded_at, programs(program_name, duration, semester_year), academic_sessions(session_name), centers(center_name, center_code, super_center_id)'

    let { data, error } = await supabase
      .from('students')
      .select(FULL)
      .order('created_at', { ascending: false })
    if (error) {
      console.error('Students fetch error (full select), retrying minimal:', error)
      ;({ data, error } = await supabase
        .from('students')
        .select(MIN)
        .order('created_at', { ascending: false }))
      if (error) console.error('Students fetch error (minimal select):', error)
    }
    setData(data || [])
    // null = add_re_registration.sql not run yet, so the feature stays hidden.
    setReReg(await fetchReRegistrations((data || []).map(s => s.id)))
    setLoading(false)
  }

  const hiddenCount = data.filter(s => s.is_hidden).length

  // Center dropdown narrows to the chosen super center's centers.
  const scopedCenters = centerList.filter(c => superFilter === 'all' ? true : c.super_center_id === superFilter)

  const filtered = data.filter(s => {
    // Hidden students are excluded unless "Show Hidden" is on (then show ONLY hidden).
    if (showHidden ? !s.is_hidden : s.is_hidden) return false
    if (superFilter !== 'all' && s.centers?.super_center_id !== superFilter) return false
    if (centerFilter !== 'all' && s.center_id !== centerFilter) return false
    if (programFilter !== 'all' && s.programme_id !== programFilter) return false
    if (sessionFilter !== 'all' && s.session_id !== sessionFilter) return false
    // Entry-date range (inclusive) — when the form was actually recorded, not
    // the date typed into it. Compared on the LOCAL day so a late-evening
    // entry doesn't fall into the previous day via UTC.
    const day = localDay(s.created_at)
    if (fromDate && (!day || day < fromDate)) return false
    if (toDate && (!day || day > toDate)) return false
    const matchStatus = statusFilter === 'All' || s.status === statusFilter
    return matchesSearch(s, search) && matchStatus
  })

  // What the Excel / PDF exports contain — the list exactly as filtered.
  const EXPORT_COLUMNS = [
    { header: 'Student Name', value: s => s.student_name },
    { header: 'Enrollment No', value: s => s.enrollment_no || '' },
    { header: 'Gender', value: s => s.gender || '' },
    { header: 'Date of Birth', value: s => (s.date_of_birth ? formatDate(s.date_of_birth) : '') },
    { header: 'Mobile', value: s => s.mobile_no || '' },
    { header: 'Program', value: s => s.programs?.program_name || '' },
    { header: 'Center', value: s => s.centers?.center_name || '' },
    { header: 'Session', value: s => s.academic_sessions?.session_name || '' },
    { header: 'Entry', value: s => s.entry_type || '' },
    { header: 'Entered On', value: s => (s.created_at ? formatDate(s.created_at) : '') },
    { header: 'Form Date', value: s => (s.date_of_submission ? formatDate(s.date_of_submission) : '') },
    { header: 'Status', value: s => s.status || '' },
  ]
  const exportMeta = () => {
    const m = []
    if (fromDate || toDate) {
      m.push(`Entered: ${fromDate ? formatDate(fromDate) : 'start'} to ${toDate ? formatDate(toDate) : 'today'}`)
    }
    if (statusFilter !== 'All') m.push(`Status: ${statusFilter}`)
    if (programFilter !== 'all') m.push(`Program: ${programs.find(p => p.id === programFilter)?.program_name || ''}`)
    if (sessionFilter !== 'all') m.push(`Session: ${sessions.find(s => s.id === sessionFilter)?.session_name || ''}`)
    if (centerFilter !== 'all') m.push(`Center: ${centers.find(c => c.id === centerFilter)?.center_name || ''}`)
    return m
  }
  const exportName = () => {
    const range = fromDate || toDate ? `_${fromDate || 'start'}_to_${toDate || 'today'}` : ''
    return `students${range}`
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Students"
        subtitle={`${data.length} students`}
        action={{ label: <><Plus size={15} /> Add Student</>, onClick: () => navigate('/admin/students/new') }}
      />

      <div className="flex flex-wrap gap-3 mb-3 items-end">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm w-72 focus:outline-none focus:border-[#933d18] focus:ring-2 focus:ring-[#933d18]/15 bg-white"
            placeholder="Search name, enrollment, mobile, program, center..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-col">
          <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1 ml-1">Super Center</label>
          <select
            value={superFilter}
            onChange={e => { setSuperFilter(e.target.value); setCenterFilter('all') }}
            className="py-2.5 px-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 bg-white focus:outline-none focus:border-[#933d18] focus:ring-2 focus:ring-[#933d18]/15 cursor-pointer min-w-[160px]"
          >
            <option value="all">All Super Centers</option>
            {superCenters.map(sc => (
              <option key={sc.id} value={sc.id}>{sc.center_name}{sc.center_code ? ` (${sc.center_code})` : ''}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col">
          <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1 ml-1">Center</label>
          <select
            value={centerFilter}
            onChange={e => setCenterFilter(e.target.value)}
            className="py-2.5 px-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 bg-white focus:outline-none focus:border-[#933d18] focus:ring-2 focus:ring-[#933d18]/15 cursor-pointer min-w-[160px]"
          >
            <option value="all">All Centers</option>
            {scopedCenters.map(c => (
              <option key={c.id} value={c.id}>{c.center_name}{c.center_code ? ` (${c.center_code})` : ''}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col">
          <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1 ml-1">Program</label>
          <select
            value={programFilter}
            onChange={e => setProgramFilter(e.target.value)}
            className="py-2.5 px-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 bg-white focus:outline-none focus:border-[#933d18] focus:ring-2 focus:ring-[#933d18]/15 cursor-pointer min-w-[160px]"
          >
            <option value="all">All Programs</option>
            {programList.map(p => (
              <option key={p.id} value={p.id}>{p.program_name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col">
          <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1 ml-1">Session</label>
          <select
            value={sessionFilter}
            onChange={e => setSessionFilter(e.target.value)}
            className="py-2.5 px-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 bg-white focus:outline-none focus:border-[#933d18] focus:ring-2 focus:ring-[#933d18]/15 cursor-pointer min-w-[140px]"
          >
            <option value="all">All Sessions</option>
            {sessionList.map(se => (
              <option key={se.id} value={se.id}>{se.session_name}</option>
            ))}
          </select>
        </div>
        {/* How many admissions came in over a period — filters on the form's
            submission date, and the exports below carry the same range. */}
        <div className="flex flex-col">
          <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1 ml-1">Entered From</label>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
            className="py-2.5 px-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 bg-white focus:outline-none focus:border-[#933d18] focus:ring-2 focus:ring-[#933d18]/15" />
        </div>
        <div className="flex flex-col">
          <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1 ml-1">To</label>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
            className="py-2.5 px-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 bg-white focus:outline-none focus:border-[#933d18] focus:ring-2 focus:ring-[#933d18]/15" />
        </div>
        {(fromDate || toDate) && (
          <button onClick={() => { setFromDate(''); setToDate('') }}
            className="py-2.5 px-3 text-xs font-bold text-gray-500 hover:text-[#933d18] underline">
            Clear dates
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
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
          <button
            onClick={() => setShowHidden(v => !v)}
            title={showHidden ? 'Back to visible students' : 'Show hidden students'}
            className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all inline-flex items-center gap-1.5 ${
              showHidden
                ? 'bg-gray-700 text-white shadow-sm'
                : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700'
            }`}
          >
            {showHidden ? <EyeOff size={13} /> : <Eye size={13} />}
            {showHidden ? 'Hidden' : 'Show Hidden'}
            {hiddenCount > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${showHidden ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>{hiddenCount}</span>
            )}
          </button>
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
              <Th>Entered On</Th>
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
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900">{s.student_name}</p>
                    {s.is_hidden && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200 inline-flex items-center gap-0.5">
                        <EyeOff size={9} /> Hidden
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{s.gender}{s.date_of_birth ? ` · ${formatDate(s.date_of_birth)}` : ''}</p>
                </Td>
                <Td className="text-gray-500 font-mono text-xs">{s.enrollment_no || '—'}</Td>
                <Td className="text-gray-500 text-xs min-w-[160px] whitespace-normal break-words">{s.programs?.program_name || '—'}</Td>
                <Td className="text-gray-500 text-xs">{s.centers?.center_name || '—'}</Td>
                <Td className="text-gray-500 text-xs">{s.academic_sessions?.session_name || '—'}</Td>
                <Td className="text-gray-500">{s.mobile_no || '—'}</Td>
                <Td className="text-gray-500 text-xs">{s.entry_type || '—'}</Td>
                <Td className="text-gray-600 text-xs whitespace-nowrap"
                  title={s.created_at ? new Date(s.created_at).toLocaleString('en-IN') : ''}>
                  {s.created_at ? formatDate(s.created_at) : '—'}
                </Td>
                <Td><Badge status={s.status?.toLowerCase()}>{s.status || 'Pending'}</Badge></Td>
                <Td>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => navigate(`/admin/students/edit/${s.id}`)}>
                      <Edit size={14} />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDownload(s.id)} disabled={downloading === s.id} title="Download Admission Form PDF">
                      <Download size={14} className={downloading === s.id ? 'animate-pulse text-[#933d18]' : 'text-gray-500'} />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleAllDocuments(s.id)}
                      disabled={downloading === `${s.id}-docs`} title="Download ALL uploaded documents (one per page)">
                      <FolderDown size={14} className={downloading === `${s.id}-docs` ? 'animate-pulse text-[#933d18]' : 'text-gray-500'} />
                    </Button>
                    {/* Re-Registration — a pending request from the centre is
                        highlighted so it can be decided from this list. */}
                    {s.status === 'Approved' && reReg !== null && (
                      <Button size="sm" variant="ghost" onClick={() => setReRegStudent(s)}
                        title={reReg[s.id]?.status === 'Pending'
                          ? `Re-Registration requested: ${reReg[s.id].from_term} → ${reReg[s.id].to_term}`
                          : 'Re-Registration'}>
                        <RefreshCw size={14} className={reReg[s.id]?.status === 'Pending' ? 'text-amber-600' : 'text-gray-500'} />
                        {reReg[s.id]?.status === 'Pending' && (
                          <span className="text-[10px] ml-1 font-bold text-amber-700">Re-Reg</span>
                        )}
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setCredStudentId(s.id)} title="Login Credentials">
                      <KeyRound size={14} className="text-gray-500" />
                    </Button>
                    {s.status === 'Approved' && (
                      s.exam_forwarded_at ? (
                        <span
                          title="Forwarded to Exam Section"
                          className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200"
                        >
                          <BadgeCheck size={12} /> Exam
                        </span>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => forwardToExam(s)} title="Forward to Exam Section">
                          <Send size={14} className="text-[#933d18]" />
                        </Button>
                      )
                    )}
                    {s.status === 'Approved' && (
                      <>
                        {!isPhdProgram(s.programs?.program_name) && (
                          <Button size="sm" variant="ghost" onClick={() => setRegCardStudent(s)}
                            title="Registration Certificate — one per year of the course">
                            <FileText size={14} className="text-indigo-600" />
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => handleCard(s.id, 'id')} disabled={!s.enrollment_no || downloading === `${s.id}-id`} title={s.enrollment_no ? 'Download ID Card' : 'ID card is issued after the Enrollment Number is generated'}>
                          <CreditCard size={14} className={downloading === `${s.id}-id` ? 'animate-pulse text-[#933d18]' : 'text-emerald-600'} />
                        </Button>
                        {s.admit_card_released_at && (
                          <Button size="sm" variant="ghost" onClick={() => handleCard(s.id, 'admit')} disabled={downloading === `${s.id}-admit`} title="Download Admit Card">
                            <ClipboardList size={14} className={downloading === `${s.id}-admit` ? 'animate-pulse text-[#933d18]' : 'text-[#933d18]'} />
                          </Button>
                        )}
                        {s.exam_result_status && s.exam_result_status !== 'Pending' && (
                          <Button size="sm" variant="ghost" onClick={() => setResultStudent(s)} title="View Result">
                            <Award size={14} className={s.exam_result_status === 'Pass' ? 'text-emerald-600' : 'text-red-500'} />
                          </Button>
                        )}
                      </>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => toggleHide(s)} title={s.is_hidden ? 'Unhide Student' : 'Hide Student'}>
                      {s.is_hidden
                        ? <Eye size={14} className="text-emerald-600" />
                        : <EyeOff size={14} className="text-gray-500" />}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(s)} title="Delete Student">
                      <Trash2 size={14} className="text-red-500" />
                    </Button>
                  </div>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      {/* Daily / range report — exports exactly what the filters above show. */}
      <div className="flex items-center justify-between gap-3 flex-wrap mt-4">
        <p className="text-xs text-gray-500">
          Showing <span className="font-bold text-gray-700">{filtered.length}</span> of {data.length} students
          {(fromDate || toDate) && (
            <> · entered {fromDate ? formatDate(fromDate) : 'start'} — {toDate ? formatDate(toDate) : 'today'}</>
          )}
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" size="md"
            onClick={() => exportCsv(exportName(), EXPORT_COLUMNS, filtered)}>
            <FileSpreadsheet size={14} /> Export Excel
          </Button>
          <Button variant="secondary" size="md"
            onClick={() => exportPdf('Student Admission Report', EXPORT_COLUMNS, filtered, exportMeta())}>
            <FileText size={14} /> Export PDF
          </Button>
        </div>
      </div>

      {reRegStudent && (
        <ReRegistrationModal
          student={reRegStudent}
          request={reReg?.[reRegStudent.id]?.status === 'Pending' ? reReg[reRegStudent.id] : null}
          mode={reReg?.[reRegStudent.id]?.status === 'Pending' ? 'review' : 'request'}
          onClose={() => setReRegStudent(null)}
          onDone={() => { setReRegStudent(null); fetchData() }}
        />
      )}

      {regCardStudent && (
        <RegistrationCardModal student={regCardStudent} onClose={() => setRegCardStudent(null)} />
      )}

      {credStudentId && (
        <CredModal studentId={credStudentId} onClose={() => setCredStudentId(null)} />
      )}

      {resultStudent && (
        <ResultViewModal student={resultStudent} onClose={() => setResultStudent(null)} />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4">
            <div className="p-5 border-b border-gray-100 flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle size={17} className="text-red-600" />
              </div>
              <h3 className="font-bold text-gray-900">Delete Student</h3>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-gray-600">
                Are you sure you want to permanently delete{' '}
                <span className="font-bold text-gray-900">{deleteTarget.student_name}</span>?
                This action cannot be undone.
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
                Any coupon reserved by this application will be released back for reuse.
              </div>
            </div>
            <div className="p-5 pt-0 flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
              <Button variant="danger" onClick={handleDelete} disabled={deleting}>
                <Trash2 size={14} /> {deleting ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
