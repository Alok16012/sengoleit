import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import PageHeader from '../../components/ui/PageHeader'
import { Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui/Table'
import { Search, BadgeCheck, Copy, Check, Eye, EyeOff } from 'lucide-react'
import { isPhdProgram } from '../../utils/generateStudentCards'

// Portal credentials of the center's APPROVED students, so the center can
// hand them out. Ph.D candidates sign in with their email; everyone else
// with the enrollment number.
export default function CenterCredentials() {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [copied, setCopied] = useState(null)

  useEffect(() => {
    if (!user?.email) return
    async function load() {
      const { data: me } = await supabase.from('centers').select('id').eq('email', user.email).maybeSingle()
      if (!me) { setLoading(false); return }
      const { data } = await supabase
        .from('students')
        .select('id, student_name, admission_number, enrollment_no, email, mobile_no, login_password, programs(program_name)')
        .eq('center_id', me.id)
        .eq('status', 'Approved')
        .order('created_at', { ascending: false })
      setRows(data || [])
      setLoading(false)
    }
    load()
  }, [user?.email])

  async function copy(text, key) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key); setTimeout(() => setCopied(null), 1200)
    } catch { /* clipboard unavailable */ }
  }

  const filtered = rows.filter(s =>
    !q.trim() || `${s.student_name} ${s.admission_number} ${s.enrollment_no} ${s.email} ${s.programs?.program_name}`.toLowerCase().includes(q.toLowerCase()))

  return (
    <div className="p-6 space-y-4">
      <PageHeader title="Student Credentials"
        subtitle="Portal login details of your approved students — share each student their own login" />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button onClick={() => setShowPwd(v => !v)}
          className="flex items-center gap-1.5 text-xs font-bold text-[#933d18] bg-[#933d18]/10 hover:bg-[#933d18]/15 px-3 py-2 rounded-xl transition-colors">
          {showPwd ? <EyeOff size={13} /> : <Eye size={13} />} {showPwd ? 'Hide passwords' : 'Show passwords'}
        </button>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name / enrollment / email…"
            className="pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#933d18]/30 w-72" />
        </div>
      </div>

      <Table>
        <Thead>
          <Tr>
            <Th>#</Th><Th>Student</Th><Th>Programme</Th><Th>Login ID</Th><Th>Password</Th><Th></Th>
          </Tr>
        </Thead>
        <Tbody>
          {loading ? (
            <Tr><Td colSpan={6} className="text-center text-gray-400 py-8">Loading...</Td></Tr>
          ) : filtered.length === 0 ? (
            <Tr><Td colSpan={6} className="text-center text-gray-400 py-8">No approved students yet.</Td></Tr>
          ) : filtered.map((s, i) => {
            const isPhd = isPhdProgram(s.programs?.program_name)
            // Ph.D students log in by email until their enrollment number exists.
            const loginId = (isPhd && !s.enrollment_no) ? s.email : (s.enrollment_no || s.email)
            const cred = `Login: ${loginId || '—'}\nPassword: ${s.login_password || '—'}`
            return (
              <Tr key={s.id}>
                <Td>{i + 1}</Td>
                <Td>
                  <div className="font-semibold text-gray-900">{s.student_name}</div>
                  <div className="text-xs text-gray-400 font-mono">{s.admission_number || '—'} · {s.mobile_no || '—'}</div>
                </Td>
                <Td className="text-xs">{s.programs?.program_name || '—'}</Td>
                <Td className="font-mono text-xs font-bold text-gray-800">{loginId || <span className="text-amber-600">not set</span>}</Td>
                <Td className="font-mono text-xs font-bold text-gray-800">
                  {s.login_password
                    ? (showPwd ? s.login_password : '••••••••')
                    : <span className="text-amber-600">not set</span>}
                </Td>
                <Td>
                  <button onClick={() => copy(cred, s.id)} title="Copy login & password"
                    className="flex items-center gap-1 text-[11px] font-bold text-[#933d18] hover:bg-[#933d18]/10 px-2 py-1.5 rounded-lg transition-colors">
                    {copied === s.id ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                    {copied === s.id ? 'Copied' : 'Copy'}
                  </button>
                </Td>
              </Tr>
            )
          })}
        </Tbody>
      </Table>

      <p className="text-[11px] text-gray-400 flex items-center gap-1.5">
        <BadgeCheck size={13} /> Students can change their password from their portal's Settings page after first login.
      </p>
    </div>
  )
}
