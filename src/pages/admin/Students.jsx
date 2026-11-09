import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui/Table'
import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import { Plus, Search, Edit, Download, KeyRound, Copy, RefreshCw, X, Trash2, AlertTriangle, Eye, EyeOff, Send, BadgeCheck, FileText, CreditCard, ClipboardList, Award, FileSpreadsheet, FolderDown, Truck } from 'lucide-react'
import { generateStudentPDF } from '../../utils/generateStudentPDF'
import { generateIDCard, generateRegistrationCertificate, isPhdProgram } from '../../utils/generateStudentCards'
import { admitCardsForMany } from '../../utils/semesterAdmitCards'
import { resolveStudentDocUrls } from '../../utils/resolveStudentDocs'
import { formatDate, localDay } from '../../utils/formatDate'
import DateInput from '../../components/ui/DateInput'
import { exportCsv, exportPdf } from '../../utils/exportTable'
import { matchesSearch } from '../../utils/studentSearch'
import { generateAllDocumentsPDF } from '../../utils/generateAllDocumentsPDF'
import ReRegistrationModal from '../../components/ReRegistrationModal'
import { fetchReRegistrations, nextTerm } from '../../utils/reRegistration'
import { fetchCourierSems } from '../../utils/courierSems'
import { fetchResultsForMany } from '../../utils/semesterResults'
import SemesterResultViewModal from '../../components/SemesterResultViewModal'
import { fetchAllRows } from '../../utils/fetchAllRows'
import RegistrationCardModal from '../../components/RegistrationCardModal'
import AdmitCardListModal from '../../components/AdmitCardListModal'
import { useAuth } from '../../context/AuthContext'

// RR = students with a re-registration request, whatever its outcome.
const STATUS_FILTERS = ['All', 'Pending', 'Hold', 'Approved', 'Rejected', 'RR']

// The documents a lookup role checks for, and can upload when missing: [column, label].
const PENDING_DOCS = [
  ['photo_url', 'Photo'], ['signature_url', 'Signature'],
  ['aadhar_url', 'Aadhar (front)'], ['aadhar_back_url', 'Aadhar (back)'],
  ['declaration_url', 'Declaration'],
  ['tenth_marksheet_url', '10th Marksheet'], ['twelfth_marksheet_url', '12th Marksheet'],
  ['tc_url', 'Transfer Certificate (TC)'], ['migration_url', 'Migration Certificate'],
]

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
            <Field label="Declared On" value={formatDate(student.exam_result_declared_at)} />
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
  const { profile, can, may, mayTab } = useAuth()
  // A staff role with "Show students only after a search" sees nothing until
  // it searches by at least two of: student name, father's name, date of
  // birth — a lookup desk, not a browsable list.
  const searchOnly = profile?.role === 'staff' && can('students.search_only')
  const [sName, setSName] = useState('')
  const [sFather, setSFather] = useState('')
  const [sDob, setSDob] = useState('')
  // The status tabs this login may open (User Management → Roles → Tabs).
  const statusTabs = STATUS_FILTERS.filter(s => mayTab('students', s.toLowerCase()))
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  // Why the list could not be read — shown on the page. A failed read used to
  // look exactly like "No students found", with the reason only in the console.
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState(() => statusTabs[0] || 'All')
  // Form-submission date range — how many admissions came in over a period.
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  // Re-Registration: latest request per student ({} = none, null = table missing)
  const [reReg, setReReg] = useState({})
  const [reRegStudent, setReRegStudent] = useState(null)
  // Every issued semester card, keyed by student id — lets the Admit Card
  // icon open a picker instead of only ever downloading the latest semester.
  const [admitCards, setAdmitCards] = useState({})
  const [admitListStudent, setAdmitListStudent] = useState(null)
  // studentId -> semesters couriered (Courier Details); null = migration not run
  const [courier, setCourier] = useState(null)
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

  // Upload one missing document straight onto the student (lookup role).
  // Same bucket and naming as the admission form's own uploads.
  const [docUploading, setDocUploading] = useState(null)   // `${studentId}:${column}`
  // Semester-wise results of the students a lookup found (student_results),
  // and the student whose results are open.
  const [semResults, setSemResults] = useState({})
  const [semResultStudent, setSemResultStudent] = useState(null)
  async function uploadPendingDoc(s, column, file) {
    if (!file) return
    setDocUploading(`${s.id}:${column}`)
    try {
      const ext = file.name.split('.').pop()
      const path = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${column}.${ext}`
      const up = await supabase.storage.from('student-docs').upload(path, file, { upsert: true })
      if (up.error) throw up.error
      const { data: { publicUrl } } = supabase.storage.from('student-docs').getPublicUrl(path)
      const { data: saved, error } = await supabase.from('students').update({ [column]: publicUrl }).eq('id', s.id).select('id')
      if (error) throw error
      if (!saved?.length) throw new Error('Not allowed to update this student — ask the admin for "Upload missing documents" on your role.')
      setData(rows => rows.map(r => r.id === s.id ? { ...r, [column]: publicUrl } : r))
    } catch (err) {
      alert('Upload failed: ' + (err.message || err))
    }
    setDocUploading(null)
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
    }
    setDownloading(null)
  }

  // Programme, session and centre attached by id — for the no-joins fallback.
  async function attachLookups(rows) {
    const [pr, se, ce] = await Promise.all([
      supabase.from('programs').select('id, program_name, duration, semester_year'),
      supabase.from('academic_sessions').select('id, session_name'),
      supabase.from('centers').select('id, center_name, center_code, super_center_id'),
    ])
    const byId = list => Object.fromEntries((list || []).map(x => [x.id, x]))
    const P = byId(pr.data), S = byId(se.data), C = byId(ce.data)
    return (rows || []).map(r => ({
      ...r,
      programs: P[r.programme_id] || null,
      academic_sessions: S[r.session_id] || null,
      centers: C[r.center_id] || null,
    }))
  }

  async function fetchData() {
    setLoading(true)
    const FULL = 'id, student_name, fathers_name, photo_url, tc_url, migration_url, signature_url, aadhar_url, aadhar_back_url, declaration_url, tenth_marksheet_url, twelfth_marksheet_url, enrollment_no, registration_no, admission_number, mobile_no, gender, date_of_birth, status, date_of_submission, date_of_admission, created_at, entry_type, semester_year, fee_collected, coupon_discount, course_coupon_discount, fee_sharing_pct, is_hidden, center_id, programme_id, session_id, exam_forwarded_at, admit_card_released_at, exam_result_status, exam_result_obtained_marks, exam_result_total_marks, exam_result_marksheet_url, exam_result_declared_at, exam_result_remarks, programs(program_name, duration, semester_year), academic_sessions(session_name), centers(center_name, center_code, super_center_id)'
    // Fallback for DBs where the exam-result / admit-card columns are not yet
    // created (run_all_migrations.sql not applied) — students still list; only
    // the admit-card / result actions stay inactive.
    const MIN = 'id, student_name, fathers_name, photo_url, tc_url, migration_url, signature_url, aadhar_url, aadhar_back_url, declaration_url, tenth_marksheet_url, twelfth_marksheet_url, enrollment_no, registration_no, admission_number, mobile_no, gender, date_of_birth, status, date_of_submission, date_of_admission, created_at, entry_type, semester_year, fee_collected, coupon_discount, course_coupon_discount, fee_sharing_pct, is_hidden, center_id, programme_id, session_id, exam_forwarded_at, programs(program_name, duration, semester_year), academic_sessions(session_name), centers(center_name, center_code, super_center_id)'

    // Last resort: no embedded joins at all. Programme / session / centre are
    // looked up separately and attached, so a join PostgREST refuses (an
    // ambiguous or missing relationship) cannot blank the whole list.
    const BARE = MIN.replace(/, programs\([^)]*\)|, academic_sessions\([^)]*\)|, centers\([^)]*\)/g, '')

    // Paged: one unpaged read of every student, with three joins each, is the
    // heaviest query in the app — past PostgREST's row cap it silently dropped
    // students, and on a large table it can run out of time altogether.
    const read = (sel) => fetchAllRows(() => supabase
      .from('students')
      .select(sel)
      .order('created_at', { ascending: false })
      .order('id'))

    setLoadError('')
    let { data, error } = await read(FULL)
    if (error) {
      console.error('Students fetch error (full select), retrying minimal:', error)
      ;({ data, error } = await read(MIN))
    }
    if (error) {
      console.error('Students fetch error (minimal select), retrying without joins:', error)
      ;({ data, error } = await read(BARE))
      if (!error) data = await attachLookups(data)
    }
    if (error) {
      console.error('Students fetch error (no joins):', error)
      setLoadError([error.message, error.code && `(${error.code})`, error.details, error.hint].filter(Boolean).join(' '))
    }
    setData(data || [])
    // The extras below decorate the list; none of them may stop it showing.
    try {
      // null = add_re_registration.sql not run yet, so the feature stays hidden.
      setReReg(await fetchReRegistrations((data || []).map(s => s.id)))
    } catch (e) { console.error('Re-registrations fetch failed:', e) }
    try {
      // null = add_semester_admit_cards.sql not run yet — admit_card_released_at
      // (the old single-flag) is the fallback for whether the icon shows at all.
      setAdmitCards(await admitCardsForMany((data || []).map(s => s.id)))
    } catch (e) { console.error('Admit cards fetch failed:', e) }
    try {
      setCourier(await fetchCourierSems())
    } catch (e) { console.error('Courier fetch failed:', e) }
    setLoading(false)
  }

  // "Sem 1, 2" for Marksheets, plus any final documents (Provisional,
  // Migration, Degree, Other) that have no semester of their own.
  function courierLabel(entry) {
    if (!entry) return ''
    const finals = [...entry.docTypes].filter(t => t !== 'Marksheet')
    const parts = []
    if (entry.sems.length) parts.push(`Sem ${entry.sems.join(', ')}`)
    if (finals.length) parts.push(finals.join(', '))
    return parts.join(' · ')
  }

  const hiddenCount = data.filter(s => s.is_hidden).length

  // Center dropdown narrows to the chosen super center's centers.
  const scopedCenters = centerList.filter(c => superFilter === 'all' ? true : c.super_center_id === superFilter)

  const norm = v => String(v || '').toLowerCase().replace(/\s+/g, ' ').trim()
  const lookupFields = [sName, sFather, sDob].filter(v => String(v).trim()).length
  const lookupReady = !searchOnly || lookupFields >= 2

  const filtered = !lookupReady ? [] : data.filter(s => {
    if (searchOnly) {
      if (sName.trim() && !norm(s.student_name).includes(norm(sName))) return false
      if (sFather.trim() && !norm(s.fathers_name).includes(norm(sFather))) return false
      if (sDob && String(s.date_of_birth || '').slice(0, 10) !== sDob) return false
    }
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
    const matchStatus = statusFilter === 'All'
      || (statusFilter === 'RR' ? !!reReg?.[s.id] : s.status === statusFilter)
    return matchesSearch(s, search) && matchStatus
  })

  // The lookup role's matches are few — fetch their semester results.
  const lookupIds = searchOnly ? filtered.map(s => s.id).join(',') : ''
  useEffect(() => {
    if (!lookupIds) return
    let cancelled = false
    fetchResultsForMany(lookupIds.split(',')).then(byKey => {
      if (cancelled || !byKey) return
      const by = {}
      Object.values(byKey).forEach(r => { if (r.status && r.status !== 'Pending') (by[r.student_id] ||= []).push(r) })
      setSemResults(by)
    })
    return () => { cancelled = true }
  }, [lookupIds])

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
    { header: 'Courier', value: s => courierLabel(courier?.[s.id]) },
    { header: 'Re-Registration', value: s => (reReg?.[s.id] ? `${reReg[s.id].from_term} → ${reReg[s.id].to_term} · ${reReg[s.id].status}` : '') },
  ]
  const exportMeta = () => {
    const m = []
    if (fromDate || toDate) {
      m.push(`Entered: ${fromDate ? formatDate(fromDate) : 'start'} to ${toDate ? formatDate(toDate) : 'today'}`)
    }
    if (statusFilter !== 'All') m.push(`Status: ${statusFilter}`)
    // programList / sessionList / centerList are what this page actually holds.
    // These lines named programs / sessions / centers, which do not exist here,
    // so choosing any of those filters made Export PDF throw on click and do
    // nothing — Excel kept working only because it never builds this header.
    if (programFilter !== 'all') m.push(`Program: ${programList.find(p => p.id === programFilter)?.program_name || ''}`)
    if (sessionFilter !== 'all') m.push(`Session: ${sessionList.find(s => s.id === sessionFilter)?.session_name || ''}`)
    if (centerFilter !== 'all') m.push(`Center: ${centerList.find(c => c.id === centerFilter)?.center_name || ''}`)
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
        subtitle={searchOnly ? 'Search to find a student' : `${data.length} students`}
        action={may('students.add') ? { label: <><Plus size={15} /> Add Student</>, onClick: () => navigate('/admin/students/new') } : null}
      />

      {loadError && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-bold text-red-700">Could not load students</p>
          <p className="text-xs text-red-600 mt-1 font-mono break-all">{loadError}</p>
        </div>
      )}

      {searchOnly && (
        <div className="mb-4 bg-white border border-gray-200 rounded-2xl p-4">
          <p className="text-sm font-bold text-gray-900 mb-0.5">Find a student</p>
          <p className="text-xs text-gray-500 mb-3">Fill at least two of the three — the list shows only the students that match.</p>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col">
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1 ml-1">Student Name</label>
              <input value={sName} onChange={e => setSName(e.target.value)} placeholder="Student name"
                className="py-2.5 px-3 border border-gray-200 rounded-xl text-sm w-64 focus:outline-none focus:border-[#933d18] focus:ring-2 focus:ring-[#933d18]/15 bg-white" />
            </div>
            <div className="flex flex-col">
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1 ml-1">Father Name</label>
              <input value={sFather} onChange={e => setSFather(e.target.value)} placeholder="Father's name"
                className="py-2.5 px-3 border border-gray-200 rounded-xl text-sm w-64 focus:outline-none focus:border-[#933d18] focus:ring-2 focus:ring-[#933d18]/15 bg-white" />
            </div>
            <div className="flex flex-col">
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1 ml-1">Date of Birth</label>
              <div className="w-40"><DateInput bare value={sDob} onChange={e => setSDob(e.target.value)}
                className="py-2.5 px-3 border border-gray-200 rounded-xl text-sm w-full focus:outline-none focus:border-[#933d18] focus:ring-2 focus:ring-[#933d18]/15 bg-white" /></div>
            </div>
            {lookupFields > 0 && (
              <button type="button" onClick={() => { setSName(''); setSFather(''); setSDob('') }}
                className="text-xs font-semibold text-gray-500 hover:text-gray-800 underline mb-3">Clear</button>
            )}
          </div>
        </div>
      )}

      {/* The search-only lookup has nothing but its own three fields. */}
      {!searchOnly && (
      <div className="flex flex-wrap gap-3 mb-3 items-end">
        {!searchOnly && (
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm w-72 focus:outline-none focus:border-[#933d18] focus:ring-2 focus:ring-[#933d18]/15 bg-white"
            placeholder="Search name, enrollment, mobile, program, center..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        )}
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
      )}

      {/* The lookup role works inside the tab its role allows, without the tab bar. */}
      {!searchOnly && (
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex gap-1.5 flex-wrap">
          {statusTabs.map(s => (
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
          {!searchOnly && (
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
            {hiddenCount > 0 && !searchOnly && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${showHidden ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>{hiddenCount}</span>
            )}
          </button>
          )}
        </div>
      </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Loading...</div>
      ) : searchOnly ? (
        // The lookup role's view: who the student is, and every document and
        // certificate in one row — plus what is still missing, uploadable here.
        <Table>
          <Thead>
            <tr>
              <Th>#</Th><Th>Student Name</Th><Th>Father's Name</Th><Th>Enrollment</Th><Th>Program</Th><Th>Session</Th>
              <Th>Admission Form</Th><Th>Documents</Th><Th>Registration Certificate</Th><Th>ID Card</Th>
              <Th>Admit Card</Th><Th>Result</Th><Th>Pending Documents</Th><Th>View</Th>
            </tr>
          </Thead>
          <Tbody>
            {filtered.length === 0 ? (
              <Tr><Td colSpan={14} className="text-center text-gray-400 py-12">
                {lookupReady ? 'No students found' : 'Search by at least two of: student name, father name, date of birth.'}
              </Td></Tr>
            ) : filtered.map((s, i) => {
              const approved = s.status === 'Approved'
              const hasAdmit = s.admit_card_released_at || admitCards?.[s.id]?.length > 0
              const semDone = semResults[s.id] || []
              const hasResult = semDone.length > 0 || (s.exam_result_status && s.exam_result_status !== 'Pending')
              const missing = PENDING_DOCS.filter(([col]) => !s[col])
              const dash = <span className="text-gray-300 text-xs">—</span>
              return (
                <Tr key={s.id}>
                  <Td className="text-gray-400 text-xs w-10">{i + 1}</Td>
                  <Td>
                    <p className="font-semibold text-gray-900">{s.student_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{s.date_of_birth ? formatDate(s.date_of_birth) : ''}</p>
                  </Td>
                  <Td className="text-gray-600 text-sm">{s.fathers_name || '—'}</Td>
                  <Td className="text-gray-500 font-mono text-xs">{s.enrollment_no || '—'}</Td>
                  <Td className="text-gray-500 text-xs min-w-[150px] whitespace-normal break-words">{s.programs?.program_name || '—'}</Td>
                  <Td className="text-gray-500 text-xs">{s.academic_sessions?.session_name || '—'}</Td>
                  <Td>
                    {may('students.documents') ? (
                      <Button size="sm" variant="ghost" onClick={() => handleDownload(s.id)} disabled={downloading === s.id} title="Admission Form PDF">
                        <Download size={14} className={downloading === s.id ? 'animate-pulse text-[#933d18]' : 'text-gray-600'} />
                      </Button>
                    ) : dash}
                  </Td>
                  <Td>
                    {may('students.documents') ? (
                      <Button size="sm" variant="ghost" onClick={() => handleAllDocuments(s.id)} disabled={downloading === `${s.id}-docs`} title="All uploaded documents">
                        <FolderDown size={14} className={downloading === `${s.id}-docs` ? 'animate-pulse text-[#933d18]' : 'text-gray-600'} />
                      </Button>
                    ) : dash}
                  </Td>
                  <Td>
                    {approved && !isPhdProgram(s.programs?.program_name) && may('students.documents') ? (
                      <Button size="sm" variant="ghost" onClick={() => setRegCardStudent(s)} title="Registration Certificate">
                        <FileText size={14} className="text-indigo-600" />
                      </Button>
                    ) : dash}
                  </Td>
                  <Td>
                    {approved && s.enrollment_no && may('students.documents') ? (
                      <Button size="sm" variant="ghost" onClick={() => handleCard(s.id, 'id')} disabled={downloading === `${s.id}-id`} title="ID Card">
                        <CreditCard size={14} className={downloading === `${s.id}-id` ? 'animate-pulse text-[#933d18]' : 'text-emerald-600'} />
                      </Button>
                    ) : dash}
                  </Td>
                  <Td>
                    {hasAdmit ? (
                      <Button size="sm" variant="ghost" onClick={() => setAdmitListStudent(s)} title="Admit Cards">
                        <ClipboardList size={14} className="text-[#933d18]" />
                      </Button>
                    ) : dash}
                  </Td>
                  <Td>
                    {hasResult ? (
                      <Button size="sm" variant="ghost" onClick={() => semDone.length ? setSemResultStudent(s) : setResultStudent(s)}
                        title={semDone.length ? `Result — Sem ${semDone.map(r => r.semester).sort((a, b) => a - b).join(', ')}` : 'Result'}>
                        <Award size={14} className={(semDone.length ? semDone.every(r => r.status !== 'Fail') : s.exam_result_status === 'Pass') ? 'text-emerald-600' : 'text-red-500'} />
                        {semDone.length > 0 && <span className="text-[10px] font-bold text-gray-500">{semDone.length}</span>}
                      </Button>
                    ) : dash}
                  </Td>
                  <Td className="min-w-[190px]">
                    {missing.length === 0 ? (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">All uploaded</span>
                    ) : (
                      <div className="space-y-1">
                        {missing.map(([col, label]) => {
                          const busy = docUploading === `${s.id}:${col}`
                          return (
                            <div key={col} className="flex items-center justify-between gap-2">
                              <span className="text-xs text-red-600">{label}</span>
                              {may('students.upload_docs') && (
                                <label className={`text-[11px] font-bold px-2 py-0.5 rounded-md border cursor-pointer ${busy ? 'text-gray-400 border-gray-200' : 'text-[#933d18] border-[#933d18]/30 hover:bg-[#933d18]/5'}`}>
                                  {busy ? 'Uploading…' : 'Upload'}
                                  <input type="file" accept="image/*,application/pdf" className="hidden" disabled={busy}
                                    onChange={e => { uploadPendingDoc(s, col, e.target.files?.[0]); e.target.value = '' }} />
                                </label>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </Td>
                  <Td>
                    <Button size="sm" variant="ghost" onClick={() => navigate(`/admin/students/view/${s.id}`)} title="View student and documents">
                      <Eye size={14} className="text-[#933d18]" />
                    </Button>
                  </Td>
                </Tr>
              )
            })}
          </Tbody>
        </Table>
      ) : (
        <Table>
          <Thead>
            <tr>
              <Th>#</Th>
              <Th>Student Name</Th>
              <Th>Enrollment No</Th>
              <Th>Program</Th>
              {!searchOnly && <Th>Center</Th>}
              <Th>Session</Th>
              <Th>Mobile</Th>
              <Th>Entry</Th>
              {!searchOnly && <Th>Entered On</Th>}
              <Th>Status</Th>
              <Th>Courier</Th>
              <Th>Actions</Th>
            </tr>
          </Thead>
          <Tbody>
            {filtered.length === 0 ? (
              <Tr><Td colSpan={searchOnly ? 10 : 12} className="text-center text-gray-400 py-12">
                {lookupReady ? 'No students found' : 'Search by at least two of: student name, father name, date of birth.'}
              </Td></Tr>
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
                {!searchOnly && <Td className="text-gray-500 text-xs">{s.centers?.center_name || '—'}</Td>}
                <Td className="text-gray-500 text-xs">{s.academic_sessions?.session_name || '—'}</Td>
                <Td className="text-gray-500">{s.mobile_no || '—'}</Td>
                <Td className="text-gray-500 text-xs">{s.entry_type || '—'}</Td>
                {!searchOnly && (
                <Td className="text-gray-600 text-xs whitespace-nowrap"
                  title={s.created_at ? new Date(s.created_at).toLocaleString('en-IN') : ''}>
                  {s.created_at ? formatDate(s.created_at) : '—'}
                </Td>
                )}
                <Td>
                  {/* On the RR tab the column reads the re-registration — which
                      term to which, and where the request stands. */}
                  {statusFilter === 'RR' && reReg?.[s.id] ? (() => {
                    const rr = reReg[s.id]
                    const tone = rr.status === 'Approved' ? 'bg-emerald-50 text-emerald-700'
                      : rr.status === 'Rejected' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                    return (
                      <span className={`inline-block text-[10px] font-bold px-2 py-1 rounded-lg whitespace-nowrap ${tone}`}
                        title={rr.requested_at ? `Requested ${formatDate(rr.requested_at)}` : ''}>
                        {rr.from_term} → {rr.to_term} · {rr.status}
                      </span>
                    )
                  })() : <Badge status={s.status?.toLowerCase()}>{s.status || 'Pending'}</Badge>}
                </Td>
                <Td>
                  {/* Documents (and, for a Marksheet, which semesters) that have
                      gone by courier (Courier Details). */}
                  {courierLabel(courier?.[s.id]) ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg whitespace-nowrap bg-sky-50 text-sky-700"
                      title={courier[s.id].couriers.map(c =>
                        `${c.date ? formatDate(c.date) : '—'}${c.docs ? ` · ${c.docs}` : ''}${c.sems.length ? ` · Sem ${c.sems.join(', ')}` : ''}${c.tracking_no ? ` · ${c.tracking_no}` : ''}`).join('\n')}>
                      <Truck size={11} /> {courierLabel(courier?.[s.id])}
                    </span>
                  ) : <span className="text-gray-300 text-xs">—</span>}
                </Td>
                <Td>
                  <div className="flex gap-1">
                    {may('students.edit') ? (
                    <Button size="sm" variant="ghost" onClick={() => navigate(`/admin/students/edit/${s.id}`)}>
                      <Edit size={14} />
                    </Button>
                    ) : (
                    // Without Edit: the full record and documents, read-only.
                    <Button size="sm" variant="ghost" onClick={() => navigate(`/admin/students/view/${s.id}`)} title="View student and documents">
                      <Eye size={14} className="text-[#933d18]" />
                    </Button>
                    )}
                    {may('students.documents') && (
                    <>
                    <Button size="sm" variant="ghost" onClick={() => handleDownload(s.id)} disabled={downloading === s.id} title="Download Admission Form PDF">
                      <Download size={14} className={downloading === s.id ? 'animate-pulse text-[#933d18]' : 'text-gray-500'} />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleAllDocuments(s.id)}
                      disabled={downloading === `${s.id}-docs`} title="Download ALL uploaded documents (one per page)">
                      <FolderDown size={14} className={downloading === `${s.id}-docs` ? 'animate-pulse text-[#933d18]' : 'text-gray-500'} />
                    </Button>
                    </>
                    )}
                    {/* Re-Registration — VERIFYING a pending request belongs to
                        the Account Dept's Re-Registrations queue (the money
                        step), so a pending one here is only a signpost, not a
                        decision point. Raising one on the centre's behalf still
                        works from here while there is a next term to raise it
                        for. */}
                    {s.status === 'Approved' && reReg !== null && (
                      reReg[s.id]?.status === 'Pending' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-lg whitespace-nowrap"
                          title={`Re-Registration requested: ${reReg[s.id].from_term} → ${reReg[s.id].to_term} — verify it in Account Dept → Re-Registrations`}>
                          <RefreshCw size={11} /> Re-Reg pending
                        </span>
                      ) : !nextTerm(s).atEnd && may('students.re_register') ? (
                        <Button size="sm" variant="ghost" onClick={() => setReRegStudent(s)} title="Re-Registration">
                          <RefreshCw size={14} className="text-gray-500" />
                        </Button>
                      ) : null
                    )}
                    {may('students.credentials') && (
                    <Button size="sm" variant="ghost" onClick={() => setCredStudentId(s.id)} title="Login Credentials">
                      <KeyRound size={14} className="text-gray-500" />
                    </Button>
                    )}
                    {s.status === 'Approved' && (
                      s.exam_forwarded_at ? (
                        <span
                          title="Forwarded to Exam Section"
                          className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200"
                        >
                          <BadgeCheck size={12} /> Exam
                        </span>
                      ) : may('exam_section.admit_cards') ? (
                        <Button size="sm" variant="ghost" onClick={() => forwardToExam(s)} title="Forward to Exam Section">
                          <Send size={14} className="text-[#933d18]" />
                        </Button>
                      ) : null
                    )}
                    {s.status === 'Approved' && (
                      <>
                        {!isPhdProgram(s.programs?.program_name) && may('students.documents') && (
                          <Button size="sm" variant="ghost" onClick={() => setRegCardStudent(s)}
                            title="Registration Certificate — one per year of the course">
                            <FileText size={14} className="text-indigo-600" />
                          </Button>
                        )}
                        {may('students.documents') && (
                        <Button size="sm" variant="ghost" onClick={() => handleCard(s.id, 'id')} disabled={!s.enrollment_no || downloading === `${s.id}-id`} title={s.enrollment_no ? 'Download ID Card' : 'ID card is issued after the Enrollment Number is generated'}>
                          <CreditCard size={14} className={downloading === `${s.id}-id` ? 'animate-pulse text-[#933d18]' : 'text-emerald-600'} />
                        </Button>
                        )}
                        {/* admit_card_released_at is the old single-flag release
                            and stays untouched by the per-semester flow, so a
                            student with issued semester cards but no flag would
                            otherwise show no button at all — check both. */}
                        {(s.admit_card_released_at || admitCards?.[s.id]?.length > 0) && (
                          <Button size="sm" variant="ghost" onClick={() => setAdmitListStudent(s)} title="Admit Card — all issued semesters">
                            <ClipboardList size={14} className="text-[#933d18]" />
                          </Button>
                        )}
                        {s.exam_result_status && s.exam_result_status !== 'Pending' && (
                          <Button size="sm" variant="ghost" onClick={() => setResultStudent(s)} title="View Result">
                            <Award size={14} className={s.exam_result_status === 'Pass' ? 'text-emerald-600' : 'text-red-500'} />
                          </Button>
                        )}
                      </>
                    )}
                    {may('students.hide') && (
                    <Button size="sm" variant="ghost" onClick={() => toggleHide(s)} title={s.is_hidden ? 'Unhide Student' : 'Hide Student'}>
                      {s.is_hidden
                        ? <Eye size={14} className="text-emerald-600" />
                        : <EyeOff size={14} className="text-gray-500" />}
                    </Button>
                    )}
                    {may('students.delete') && (
                    <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(s)} title="Delete Student">
                      <Trash2 size={14} className="text-red-500" />
                    </Button>
                    )}
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
          Showing <span className="font-bold text-gray-700">{filtered.length}</span>{searchOnly ? ' matching' : ` of ${data.length}`} students
          {(fromDate || toDate) && (
            <> · entered {fromDate ? formatDate(fromDate) : 'start'} — {toDate ? formatDate(toDate) : 'today'}</>
          )}
        </p>
        {may('students.export') && (
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
        )}
      </div>

      {/* Raise-only: a pending request is decided in the Account Dept queue,
          so this modal never opens in review mode from this page any more. */}
      {reRegStudent && (
        <ReRegistrationModal
          student={reRegStudent}
          request={null}
          mode="request"
          onClose={() => setReRegStudent(null)}
          onDone={() => { setReRegStudent(null); fetchData() }}
        />
      )}

      {regCardStudent && (
        <RegistrationCardModal student={regCardStudent} onClose={() => setRegCardStudent(null)} actionLabel={searchOnly ? 'Download' : 'Generate'} />
      )}

      {admitListStudent && (
        <AdmitCardListModal student={admitListStudent} onClose={() => setAdmitListStudent(null)} />
      )}

      {credStudentId && (
        <CredModal studentId={credStudentId} onClose={() => setCredStudentId(null)} />
      )}

      {resultStudent && (
        <ResultViewModal student={resultStudent} onClose={() => setResultStudent(null)} />
      )}
      {semResultStudent && (
        <SemesterResultViewModal student={semResultStudent} onClose={() => setSemResultStudent(null)} />
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
