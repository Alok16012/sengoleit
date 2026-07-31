import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import PageHeader from '../../components/ui/PageHeader'
import { Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui/Table'
import { Search, CheckCircle2, XCircle, FileText } from 'lucide-react'

// Which uploads count towards the summary — mirrors the student Documents page.
const DOC_COLS = [
  { key: 'photo_url', label: 'Photo' },
  { key: 'signature_url', label: 'Sign' },
  { key: 'aadhar_url', label: 'Aadhar' },
  { key: 'tenth_marksheet_url', label: '10th' },
  { key: 'twelfth_marksheet_url', label: '12th' },
  { key: 'ug_marksheet_url', label: 'UG' },
  { key: 'pg_marksheet_url', label: 'PG' },
  { key: 'declaration_url', label: 'Declaration' },
]

// Per-student matrix of which documents have been uploaded. A center sees its
// own students; a super center sees its own plus its sub-centers'.
export default function DocumentSummary() {
  const { user, profile } = useAuth()
  const role = profile?.role || user?.user_metadata?.role || 'center'
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')

  useEffect(() => {
    if (!user?.email) return
    async function load() {
      const { data: me } = await supabase.from('centers').select('id').eq('email', user.email).maybeSingle()
      if (!me) { setLoading(false); return }
      let ids = [me.id]
      if (role === 'super_center') {
        const { data: subs } = await supabase.from('centers').select('id').eq('super_center_id', me.id)
        ids = [me.id, ...(subs || []).map(c => c.id)]
      }
      const { data } = await supabase
        .from('students')
        .select(`id, student_name, admission_number, enrollment_no, status, ${DOC_COLS.map(d => d.key).join(', ')}, programs(program_name), centers(center_name)`)
        .in('center_id', ids)
        .order('created_at', { ascending: false })
      setRows(data || [])
      setLoading(false)
    }
    load()
  }, [user?.email, role])

  const filtered = rows.filter(s =>
    !q.trim() || `${s.student_name} ${s.admission_number} ${s.enrollment_no} ${s.programs?.program_name} ${s.centers?.center_name}`.toLowerCase().includes(q.toLowerCase()))

  const done = (s) => DOC_COLS.filter(d => s[d.key]).length

  return (
    <div className="p-6 space-y-4">
      <PageHeader title="Document Summary"
        subtitle="Which documents each student has uploaded — ✓ uploaded, ✗ still missing" />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-gray-500">{filtered.length} students</p>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name / application no…"
            className="pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#933d18]/30 w-72" />
        </div>
      </div>

      <Table>
        <Thead>
          <Tr>
            <Th>#</Th>
            <Th>Student</Th>
            {role === 'super_center' && <Th>Center</Th>}
            <Th>Programme</Th>
            {DOC_COLS.map(d => <Th key={d.key} className="text-center">{d.label}</Th>)}
            <Th>Uploaded</Th>
          </Tr>
        </Thead>
        <Tbody>
          {loading ? (
            <Tr><Td colSpan={DOC_COLS.length + 5} className="text-center text-gray-400 py-8">Loading...</Td></Tr>
          ) : filtered.length === 0 ? (
            <Tr><Td colSpan={DOC_COLS.length + 5} className="text-center text-gray-400 py-8">
              <FileText size={32} className="text-gray-200 mx-auto mb-2" /> No students found.
            </Td></Tr>
          ) : filtered.map((s, i) => (
            <Tr key={s.id}>
              <Td>{i + 1}</Td>
              <Td>
                <div className="font-semibold text-gray-900">{s.student_name}</div>
                <div className="text-xs text-gray-400 font-mono">{s.admission_number || s.enrollment_no || '—'}</div>
              </Td>
              {role === 'super_center' && <Td className="text-xs">{s.centers?.center_name || '—'}</Td>}
              <Td className="text-xs">{s.programs?.program_name || '—'}</Td>
              {DOC_COLS.map(d => (
                <Td key={d.key} className="text-center">
                  {s[d.key]
                    ? <CheckCircle2 size={15} className="text-emerald-500 inline" />
                    : <XCircle size={15} className="text-gray-200 inline" />}
                </Td>
              ))}
              <Td>
                <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${done(s) === DOC_COLS.length ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                  {done(s)}/{DOC_COLS.length}
                </span>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </div>
  )
}
