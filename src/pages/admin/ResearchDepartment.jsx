import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui/Table'
import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import { Search, FlaskConical, FileCheck2, ShieldCheck, Settings2, Save } from 'lucide-react'
import { generateOfferLetter, generateEntranceClearance, isPhdProgram } from '../../utils/generateStudentCards'
import { formatDate } from '../../utils/formatDate'

const SETTINGS_KEY = 'phd_doc_settings'

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
  // Master panel — the reference series + date used when generating documents.
  const [cfg, setCfg] = useState({ prefix: 'SIU/PhD/2025/', nextNum: 1, date: new Date().toISOString().slice(0, 10) })
  const [assigned, setAssigned] = useState({}) // { studentId: refNumber } — same ref for both docs of a student
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null')
      if (s?.cfg) setCfg(s.cfg)
      if (s?.assigned) setAssigned(s.assigned)
    } catch { /* ignore */ }
  }, [])

  function persist(nextCfg, nextAssigned) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ cfg: nextCfg, assigned: nextAssigned }))
  }
  function saveCfg() { persist(cfg, assigned); setSaved(true); setTimeout(() => setSaved(false), 1500) }

  // Reuse a student's assigned reference; assign the next one on first use.
  function refFor(student) {
    let num = assigned[student.id]
    if (num == null) {
      num = Number(cfg.nextNum) || 1
      const nextAssigned = { ...assigned, [student.id]: num }
      const nextCfg = { ...cfg, nextNum: num + 1 }
      setAssigned(nextAssigned); setCfg(nextCfg); persist(nextCfg, nextAssigned)
    }
    return `${cfg.prefix}${num}`
  }
  const docOpts = (student) => ({ refNo: refFor(student), date: cfg.date ? formatDate(cfg.date) : undefined })

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    // Account-verified students land here (status Approved). We keep only Ph.D.
    const base = 'id, student_name, registration_no, enrollment_no, admission_number, fathers_name, mobile_no, date_of_birth, academic_year, student_perm_village_town, student_perm_landmark, student_perm_city, student_perm_district, student_perm_state, student_perm_pin_code, programs(program_name, programme_types(programme_type_name)), academic_sessions(session_name), departments(name), centers(center_name, center_code)'
    const run = (cols) => supabase.from('students').select(cols).eq('status', 'Approved').order('created_at', { ascending: false })
    // `specialization` may not be migrated yet — fall back to a query without it.
    let { data, error } = await run('specialization, ' + base)
    if (error && /specialization/.test(error.message || '')) {
      ({ data } = await run(base))
    }
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

      {/* Master panel — set once; used on every document generated below */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Settings2 size={16} className="text-[#933d18]" />
          <p className="text-sm font-bold text-gray-900">Master Panel — Reference Series & Date</p>
        </div>
        <div className="flex items-end gap-4 flex-wrap">
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Reference Prefix</label>
            <input value={cfg.prefix} onChange={e => setCfg(c => ({ ...c, prefix: e.target.value }))}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#933d18]/30 w-48" placeholder="SIU/PhD/2025/" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Next No.</label>
            <input type="number" min="1" value={cfg.nextNum} onChange={e => setCfg(c => ({ ...c, nextNum: e.target.value }))}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#933d18]/30 w-24" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Date</label>
            <input type="date" value={cfg.date} onChange={e => setCfg(c => ({ ...c, date: e.target.value }))}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#933d18]/30" />
          </div>
          <Button variant="primary" size="md" onClick={saveCfg}><Save size={14} /> {saved ? 'Saved ✓' : 'Save'}</Button>
          <p className="text-[11px] text-gray-400">Next document → <span className="font-mono font-bold text-[#933d18]">{cfg.prefix}{cfg.nextNum}</span></p>
        </div>
      </div>

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
              <Td className="font-mono text-xs font-bold text-[#933d18]">
                {s.registration_no || s.admission_number || '—'}
                {assigned[s.id] != null && (
                  <div className="text-[10px] text-gray-400 font-normal mt-0.5">Doc Ref: {cfg.prefix}{assigned[s.id]}</div>
                )}
              </Td>
              <Td className="text-sm">{s.programs?.program_name || '—'}</Td>
              <Td className="text-sm">{s.specialization || '—'}</Td>
              <Td className="text-sm">{s.academic_sessions?.session_name || s.academic_year || '—'}</Td>
              <Td className="text-sm">{s.centers?.center_name || '—'}</Td>
              <Td>
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="secondary" onClick={() => generateOfferLetter(s, docOpts(s))}>
                    <FileCheck2 size={13} /> Offer Letter
                  </Button>
                  <Button size="sm" variant="primary" onClick={() => generateEntranceClearance(s, docOpts(s))}>
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
