import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui/Table'
import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import { Search, ClipboardList, X } from 'lucide-react'
import { generateAdmitCard } from '../../utils/generateStudentCards'
import { resolveStudentDocUrls } from '../../utils/resolveStudentDocs'
import { formatDate } from '../../utils/formatDate'

export default function ExamSection() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(null)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    // Only students the Account Dept. forwarded to the Exam Section appear here.
    const { data, error } = await supabase
      .from('students')
      .select('id, student_name, mobile_no, gender, enrollment_no, registration_no, semester_year, exam_forwarded_at, programs(program_name), academic_sessions(session_name), centers(center_name, center_code)')
      .not('exam_forwarded_at', 'is', null)
      .order('exam_forwarded_at', { ascending: false })
    if (error) console.error('ExamSection fetch error:', error)
    setData(data || [])
    setLoading(false)
  }

  // Admit card is generated ONLY here — the single point in the workflow.
  async function handleAdmitCard(studentId) {
    setBusy(studentId)
    const { data: s } = await supabase
      .from('students')
      .select('*, programs(program_name), academic_sessions(session_name), centers(center_name, center_code), departments(name), study_modes(mode_name)')
      .eq('id', studentId)
      .single()
    if (s) {
      const resolved = await resolveStudentDocUrls(s)
      generateAdmitCard(resolved)
    }
    setBusy(null)
  }

  const filtered = data.filter(s => {
    const haystack = [
      s.student_name, s.enrollment_no, s.registration_no, s.mobile_no,
      s.programs?.program_name, s.academic_sessions?.session_name,
      s.centers?.center_name, s.centers?.center_code,
    ].filter(Boolean).join(' ').toLowerCase()
    return haystack.includes(search.toLowerCase())
  })

  return (
    <div className="p-6">
      <PageHeader
        title="Exam Section"
        subtitle={`${data.length} student${data.length === 1 ? '' : 's'} forwarded for examination`}
      />

      <div className="flex flex-wrap gap-3 mb-4 items-end">
        <div className="relative max-w-sm flex-1 min-w-[220px]">
          <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">Search</label>
          <Search size={15} className="absolute left-3 top-[34px] -translate-y-1/2 text-gray-400" />
          <input
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#933d18] focus:ring-2 focus:ring-[#933d18]/15 bg-white"
            placeholder="Search by name, enrollment, center..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {search && (
          <button onClick={() => setSearch('')}
            className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-semibold text-[#933d18] bg-[#933d18]/8 hover:bg-[#933d18]/15 rounded-xl transition-colors">
            <X size={14} /> Clear
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Loading...</div>
      ) : (
        <Table>
          <Thead>
            <tr>
              <Th>#</Th>
              <Th>Student Name</Th>
              <Th>Program</Th>
              <Th>Session</Th>
              <Th>Center</Th>
              <Th>Enrollment No</Th>
              <Th>Registration No</Th>
              <Th>Forwarded On</Th>
              <Th>Admit Card</Th>
            </tr>
          </Thead>
          <Tbody>
            {filtered.length === 0 ? (
              <Tr><Td colSpan={9} className="text-center text-gray-400 py-12">
                {search ? 'No students match your search.' : 'No students have been forwarded to the Exam Section yet.'}
              </Td></Tr>
            ) : filtered.map((s, i) => (
              <Tr key={s.id}>
                <Td className="text-gray-400 text-xs w-10">{i + 1}</Td>
                <Td>
                  <p className="font-semibold text-gray-900">{s.student_name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{s.gender} • {s.mobile_no || '—'}</p>
                </Td>
                <Td className="text-gray-500 text-xs min-w-[160px] whitespace-normal break-words">{s.programs?.program_name || '—'}</Td>
                <Td className="text-gray-500 text-xs">{s.academic_sessions?.session_name || '—'}</Td>
                <Td>
                  <p className="text-sm font-medium text-gray-700">{s.centers?.center_name || '—'}</p>
                  {s.centers?.center_code && <p className="text-xs text-gray-400">{s.centers.center_code}</p>}
                </Td>
                <Td className="font-mono text-xs font-bold text-emerald-700">{s.enrollment_no || '—'}</Td>
                <Td className="font-mono text-xs text-[#933d18] font-bold">{s.registration_no || '—'}</Td>
                <Td className="text-gray-400 text-xs">{formatDate(s.exam_forwarded_at)}</Td>
                <Td>
                  <Button size="sm" variant="ghost" onClick={() => handleAdmitCard(s.id)} disabled={busy === s.id} title="Generate Admit Card">
                    <ClipboardList size={14} className={busy === s.id ? 'animate-pulse text-[#933d18]' : 'text-amber-600'} />
                    <span className="text-xs ml-1 text-amber-600">{busy === s.id ? '...' : 'Admit Card'}</span>
                  </Button>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </div>
  )
}
