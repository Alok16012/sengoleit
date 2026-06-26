import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui/Table'
import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import { Plus, Search, Edit, Download, KeyRound, Copy, RefreshCw, X, Trash2, AlertTriangle, Eye, EyeOff, Send, BadgeCheck, FileText, CreditCard, ClipboardList, Award } from 'lucide-react'
import { generateStudentPDF } from '../../utils/generateStudentPDF'
import { generateIDCard, generateAdmitCard, generateRegistrationCertificate } from '../../utils/generateStudentCards'
import { fetchAdmitCardSubjects } from '../../utils/fetchSyllabus'
import { fetchExamSettingsMeta } from '../../utils/examSettings'
import { resolveStudentDocUrls } from '../../utils/resolveStudentDocs'
import { formatDate } from '../../utils/formatDate'

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
      .select('student_name, enrollment_no, login_password')
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
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Enrollment Number</p>
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
                  <span className="flex-1 font-mono text-sm font-semibold text-gray-800">
                    {cred?.enrollment_no || '—'}
                  </span>
                  {cred?.enrollment_no && (
                    <button
                      onClick={() => copyText(cred.enrollment_no, 'enroll')}
                      className="text-[#933d18] hover:text-[#933d18]/70 transition-colors"
                      title="Copy"
                    >
                      {copied === 'enroll' ? <span className="text-xs font-bold text-emerald-600">Copied!</span> : <Copy size={14} />}
                    </button>
                  )}
                </div>
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
                  Share enrollment number + password with the student to login at{' '}
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
  const [downloading, setDownloading] = useState(null)
  const [credStudentId, setCredStudentId] = useState(null)
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
  async function handleCard(studentId, type) {
    setDownloading(`${studentId}-${type}`)
    const { data: s } = await supabase
      .from('students')
      .select('*, programs(program_name), academic_sessions(session_name), centers(center_name, center_code), departments(name), study_modes(mode_name)')
      .eq('id', studentId)
      .single()
    if (s) {
      const resolved = await resolveStudentDocUrls(s)
      if (type === 'reg') generateRegistrationCertificate(resolved)
      else if (type === 'id') generateIDCard(resolved)
      else if (type === 'admit') {
        const subjects = await fetchAdmitCardSubjects(resolved)
        const meta = await fetchExamSettingsMeta()
        generateAdmitCard(resolved, subjects, meta)
      }
    }
    setDownloading(null)
  }

  async function fetchData() {
    setLoading(true)
    const FULL = 'id, student_name, enrollment_no, mobile_no, gender, date_of_birth, status, date_of_admission, entry_type, is_hidden, center_id, programme_id, session_id, exam_forwarded_at, admit_card_released_at, exam_result_status, exam_result_obtained_marks, exam_result_total_marks, exam_result_marksheet_url, exam_result_declared_at, exam_result_remarks, programs(program_name), academic_sessions(session_name), centers(center_name, center_code, super_center_id)'
    // Fallback for DBs where the exam-result / admit-card columns are not yet
    // created (run_all_migrations.sql not applied) — students still list; only
    // the admit-card / result actions stay inactive.
    const MIN = 'id, student_name, enrollment_no, mobile_no, gender, date_of_birth, status, date_of_admission, entry_type, is_hidden, center_id, programme_id, session_id, exam_forwarded_at, programs(program_name), academic_sessions(session_name), centers(center_name, center_code, super_center_id)'

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

      <div className="flex flex-wrap gap-3 mb-3 items-end">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm w-72 focus:outline-none focus:border-[#933d18] focus:ring-2 focus:ring-[#933d18]/15 bg-white"
            placeholder="Search by name, enrollment, mobile..."
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
                <Td><Badge status={s.status?.toLowerCase()}>{s.status || 'Pending'}</Badge></Td>
                <Td>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => navigate(`/admin/students/edit/${s.id}`)}>
                      <Edit size={14} />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDownload(s.id)} disabled={downloading === s.id} title="Download PDF">
                      <Download size={14} className={downloading === s.id ? 'animate-pulse text-[#933d18]' : 'text-gray-500'} />
                    </Button>
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
                        <Button size="sm" variant="ghost" onClick={() => handleCard(s.id, 'reg')} disabled={downloading === `${s.id}-reg`} title="Download Registration Certificate">
                          <FileText size={14} className={downloading === `${s.id}-reg` ? 'animate-pulse text-[#933d18]' : 'text-indigo-600'} />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleCard(s.id, 'id')} disabled={downloading === `${s.id}-id`} title="Download ID Card">
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
