import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui/Table'
import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import { Search, FlaskConical, FileCheck2, ShieldCheck, Settings2, Save, Plus } from 'lucide-react'
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
  const [sessions, setSessions] = useState([])
  const [sessionFilter, setSessionFilter] = useState('all')
  // Master panel — each letter type has its own reference series + date.
  const today = new Date().toISOString().slice(0, 10)
  const DEFAULT_LETTERS = [
    { name: 'Offer Letter', prefix: 'SIU/PhD/OL/2025/', nextNum: 1, date: today },
    { name: 'Entrance Certificate', prefix: 'SIU/PhD/EC/2025/', nextNum: 1, date: today },
  ]
  const [letters, setLetters] = useState(DEFAULT_LETTERS)
  const [selIdx, setSelIdx] = useState(0)
  const [newName, setNewName] = useState('')
  const [assigned, setAssigned] = useState({}) // { [letterName]: { [studentId]: num } }
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null')
      if (Array.isArray(s?.letters) && s.letters.length) {
        // De-duplicate by name (case-insensitive) — earlier saves could double up.
        const seen = new Set(), uniq = []
        for (const l of s.letters) {
          const k = (l.name || '').trim().toLowerCase()
          if (k && !seen.has(k)) { seen.add(k); uniq.push(l) }
        }
        setLetters(uniq)
        if (uniq.length !== s.letters.length) {
          localStorage.setItem(SETTINGS_KEY, JSON.stringify({ letters: uniq, assigned: s.assigned || {} }))
        }
      }
      if (s?.assigned) setAssigned(s.assigned)
    } catch { /* ignore */ }
  }, [])

  const sel = letters[selIdx] || letters[0]
  // Safety net: never show duplicate names in the dropdown (keep the first index).
  const uniqueLetters = letters.filter((l, i) =>
    letters.findIndex(x => (x.name || '').trim().toLowerCase() === (l.name || '').trim().toLowerCase()) === i)
  function persist(nextLetters, nextAssigned) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ letters: nextLetters, assigned: nextAssigned }))
  }
  function updateSel(patch) { setLetters(ls => ls.map((l, i) => i === selIdx ? { ...l, ...patch } : l)) }
  function saveCfg() { persist(letters, assigned); setSaved(true); setTimeout(() => setSaved(false), 1500) }

  function addLetter() {
    const name = newName.trim()
    if (!name) return
    const exists = letters.findIndex(l => l.name.toLowerCase() === name.toLowerCase())
    if (exists >= 0) { setSelIdx(exists); setNewName(''); return }
    const next = [...letters, { name, prefix: '', nextNum: 1, date: today }]
    setLetters(next); setSelIdx(next.length - 1); setNewName(''); persist(next, assigned)
  }

  // Assign / reuse a student's reference for a specific letter type.
  function refFor(student, letterName) {
    const li = letters.findIndex(l => l.name === letterName)
    const letter = li >= 0 ? letters[li] : sel
    const map = assigned[letterName] || {}
    let num = map[student.id]
    if (num == null) {
      num = Number(letter.nextNum) || 1
      const nextAssigned = { ...assigned, [letterName]: { ...map, [student.id]: num } }
      const nextLetters = li >= 0 ? letters.map((l, i) => i === li ? { ...l, nextNum: num + 1 } : l) : letters
      setAssigned(nextAssigned); setLetters(nextLetters); persist(nextLetters, nextAssigned)
    }
    return `${letter.prefix}${num}`
  }
  function docOptsFor(student, letterName) {
    const letter = letters.find(l => l.name === letterName) || sel
    return { refNo: refFor(student, letterName), date: letter.date ? formatDate(letter.date) : undefined }
  }

  useEffect(() => { load() }, [])
  useEffect(() => {
    supabase.from('academic_sessions').select('id, session_name, status').order('session_name', { ascending: false })
      .then(({ data }) => setSessions((data || []).filter(s => (s.status || 'Active').toLowerCase() !== 'inactive')))
  }, [])

  async function load() {
    setLoading(true)
    // Account-verified students land here (status Approved). We keep only Ph.D.
    const base = 'id, student_name, registration_no, enrollment_no, admission_number, session_id, fathers_name, mobile_no, date_of_birth, academic_year, student_perm_village_town, student_perm_landmark, student_perm_city, student_perm_district, student_perm_state, student_perm_pin_code, programs(program_name, programme_types(programme_type_name)), academic_sessions(session_name), departments(name), centers(center_name, center_code)'
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
    if (sessionFilter !== 'all' && s.session_id !== sessionFilter) return false
    if (!q.trim()) return true
    const hay = `${s.student_name} ${s.registration_no} ${s.programs?.program_name} ${s.specialization} ${s.centers?.center_name}`.toLowerCase()
    return hay.includes(q.toLowerCase())
  })

  return (
    <div className="p-6 space-y-5">
      <PageHeader title="Research Department" subtitle="Ph.D candidates (account-verified) — generate offer letter & entrance clearance" />

      {/* Master panel — per-letter reference series + date */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Settings2 size={16} className="text-[#933d18]" />
          <p className="text-sm font-bold text-gray-900">Master Panel — Letters, Reference Series & Date</p>
        </div>

        {/* Add a new letter name */}
        <div className="flex items-end gap-2 flex-wrap">
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Add Letter Name</label>
            <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addLetter()}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#933d18]/30 w-56" placeholder="e.g. Provisional Letter" />
          </div>
          <Button variant="secondary" size="md" onClick={addLetter}><Plus size={14} /> Add</Button>
        </div>

        {/* Select a letter, then set its reference + date */}
        <div className="flex items-end gap-4 flex-wrap border-t border-gray-100 pt-4">
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Session</label>
            <select value={sessionFilter} onChange={e => setSessionFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#933d18]/30 bg-white w-48">
              <option value="all">All Sessions</option>
              {sessions.map(s => <option key={s.id} value={s.id}>{s.session_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Letter</label>
            <select value={selIdx} onChange={e => setSelIdx(Number(e.target.value))}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#933d18]/30 bg-white w-56">
              {uniqueLetters.map((l) => <option key={l.name} value={letters.indexOf(l)}>{l.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Reference No. (prefix)</label>
            <input value={sel?.prefix || ''} onChange={e => updateSel({ prefix: e.target.value })}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#933d18]/30 w-48" placeholder="SIU/PhD/OL/2025/" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Next No.</label>
            <input type="number" min="1" value={sel?.nextNum ?? 1} onChange={e => updateSel({ nextNum: e.target.value })}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#933d18]/30 w-24" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Date</label>
            <input type="date" value={sel?.date || ''} onChange={e => updateSel({ date: e.target.value })}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#933d18]/30" />
          </div>
          <Button variant="primary" size="md" onClick={saveCfg}><Save size={14} /> {saved ? 'Saved ✓' : 'Save'}</Button>
          <p className="text-[11px] text-gray-400">Next → <span className="font-mono font-bold text-[#933d18]">{sel?.prefix}{sel?.nextNum}</span></p>
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
                {letters.map(l => assigned[l.name]?.[s.id] != null && (
                  <div key={l.name} className="text-[10px] text-gray-400 font-normal mt-0.5">{l.name}: {l.prefix}{assigned[l.name][s.id]}</div>
                ))}
              </Td>
              <Td className="text-sm">{s.programs?.program_name || '—'}</Td>
              <Td className="text-sm">{s.specialization || '—'}</Td>
              <Td className="text-sm">{s.academic_sessions?.session_name || s.academic_year || '—'}</Td>
              <Td className="text-sm">{s.centers?.center_name || '—'}</Td>
              <Td>
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="secondary" onClick={() => generateOfferLetter(s, docOptsFor(s, 'Offer Letter'))}>
                    <FileCheck2 size={13} /> Offer Letter
                  </Button>
                  <Button size="sm" variant="primary" onClick={() => generateEntranceClearance(s, docOptsFor(s, 'Entrance Certificate'))}>
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
