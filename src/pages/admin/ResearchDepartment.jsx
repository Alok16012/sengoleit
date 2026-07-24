import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui/Table'
import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import { Search, FlaskConical, FileCheck2, ShieldCheck } from 'lucide-react'
import { generateOfferLetter, generateEntranceClearance, isPhdProgram } from '../../utils/generateStudentCards'

// A student is a Ph.D research candidate if its programme type or program name
// reads as doctorate / Ph.D.
function isResearchStudent(s) {
  const type = s.programs?.programme_types?.programme_type_name || ''
  return /doctorate|ph\.?\s*d|doctoral/i.test(type) || isPhdProgram(s.programs?.program_name)
}

export default function ResearchDepartment() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    // Account-verified students land here (status Approved). We keep only Ph.D.
    const { data } = await supabase
      .from('students')
      .select('id, student_name, registration_no, enrollment_no, admission_number, specialization, fathers_name, mobile_no, date_of_birth, academic_year, student_perm_village_town, student_perm_landmark, student_perm_city, student_perm_district, student_perm_state, student_perm_pin_code, programs(program_name, programme_types(programme_type_name)), academic_sessions(session_name), departments(name), centers(center_name, center_code)')
      .eq('status', 'Approved')
      .order('created_at', { ascending: false })
    setRows((data || []).filter(isResearchStudent))
    setLoading(false)
  }

  const filtered = rows.filter(s => {
    if (!q.trim()) return true
    const hay = `${s.student_name} ${s.registration_no} ${s.programs?.program_name} ${s.specialization} ${s.centers?.center_name}`.toLowerCase()
    return hay.includes(q.toLowerCase())
  })

  return (
    <div className="p-6 space-y-5">
      <PageHeader title="Research Department" subtitle="Ph.D candidates (account-verified) — generate offer letter & entrance clearance" />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-gray-500 flex items-center gap-2"><FlaskConical size={16} className="text-[#933d18]" /> {filtered.length} Ph.D candidate{filtered.length === 1 ? '' : 's'}</p>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name / reference no / program..."
            className="pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#933d18]/30 w-72" />
        </div>
      </div>

      <Table>
        <Thead>
          <Tr>
            <Th>#</Th>
            <Th>Student</Th>
            <Th>Reference No</Th>
            <Th>Programme</Th>
            <Th>Specialization</Th>
            <Th>Session</Th>
            <Th>Center</Th>
            <Th>Actions</Th>
          </Tr>
        </Thead>
        <Tbody>
          {loading ? (
            <Tr><Td colSpan={8} className="text-center text-gray-400 py-8">Loading...</Td></Tr>
          ) : filtered.length === 0 ? (
            <Tr><Td colSpan={8} className="text-center text-gray-400 py-8">No Ph.D candidates yet.</Td></Tr>
          ) : filtered.map((s, i) => (
            <Tr key={s.id}>
              <Td>{i + 1}</Td>
              <Td>
                <div className="font-semibold text-gray-900">{s.student_name}</div>
                <div className="text-xs text-gray-400 font-mono">{s.mobile_no || '—'}</div>
              </Td>
              <Td className="font-mono text-xs font-bold text-[#933d18]">{s.registration_no || s.admission_number || '—'}</Td>
              <Td className="text-sm">{s.programs?.program_name || '—'}</Td>
              <Td className="text-sm">{s.specialization || '—'}</Td>
              <Td className="text-sm">{s.academic_sessions?.session_name || s.academic_year || '—'}</Td>
              <Td className="text-sm">{s.centers?.center_name || '—'}</Td>
              <Td>
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="secondary" onClick={() => generateOfferLetter(s)}>
                    <FileCheck2 size={13} /> Offer Letter
                  </Button>
                  <Button size="sm" variant="primary" onClick={() => generateEntranceClearance(s)}>
                    <ShieldCheck size={13} /> Entrance Certificate
                  </Button>
                </div>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </div>
  )
}
