import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui/Table'
import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import { Plus, Search, Edit, Download, KeyRound, Copy, RefreshCw, X, Trash2, AlertTriangle } from 'lucide-react'
import { generateStudentPDF } from '../../utils/generateStudentPDF'
import { resolveStudentDocUrls } from '../../utils/resolveStudentDocs'
import { formatDate } from '../../utils/formatDate'

const STATUS_FILTERS = ['All', 'Pending', 'Hold', 'Approved', 'Rejected']

function genPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let pwd = 'Sg@'
  for (let i = 0; i < 5; i++) pwd += chars[Math.floor(Math.random() * chars.length)]
  return pwd
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
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const navigate = useNavigate()

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

  async function fetchData() {
    setLoading(true)
    const { data, error } = await supabase
      .from('students')
      .select('id, student_name, enrollment_no, mobile_no, gender, date_of_birth, status, date_of_admission, entry_type, center_id, programme_id, session_id, programs(program_name), academic_sessions(session_name), centers(center_name, center_code)')
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
                  <p className="text-xs text-gray-400 mt-0.5">{s.gender}{s.date_of_birth ? ` · ${formatDate(s.date_of_birth)}` : ''}</p>
                </Td>
                <Td className="text-gray-500 font-mono text-xs">{s.enrollment_no || '—'}</Td>
                <Td className="text-gray-500 text-xs max-w-[150px] truncate">{s.programs?.program_name || '—'}</Td>
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
