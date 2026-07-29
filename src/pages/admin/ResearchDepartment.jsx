import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui/Table'
import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import { Search, FlaskConical, FileCheck2, ShieldCheck, Settings2, Save, Plus, ToggleLeft, ToggleRight, Send, GraduationCap, BadgeCheck } from 'lucide-react'
import { generateOfferLetter, generateEntranceClearance } from '../../utils/generateStudentCards'
import { isPhdStudent } from '../../utils/isPhdStudent'
import { formatDate } from '../../utils/formatDate'

const SETTINGS_KEY = 'phd_doc_settings'

// Optional columns that only exist after add_phd_portal_flow.sql has been run.
// Every query and update degrades gracefully when they are still missing.
const OPTIONAL_COLS = 'stream, offer_letter_active, entrance_letter_active, research_forwarded_at'

export default function ResearchDepartment() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('letters')      // 'letters' | 'exam'
  const [q, setQ] = useState('')
  const [sessions, setSessions] = useState([])
  const [sessionFilter, setSessionFilter] = useState('all')
  const [busy, setBusy] = useState(null)
  // True once a query proves the new columns are missing — drives the banner.
  const [needsSql, setNeedsSql] = useState(false)
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

  // Letter serials print zero-padded to 3 digits — 010, 011 … 099, 100 — so the
  // running number keeps a fixed width instead of growing (…/9 then …/10).
  const refSerial = (n) => String(Math.max(Number(n) || 0, 0)).padStart(3, '0')

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
    return `${letter.prefix}${refSerial(num)}`
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

  // Ph.D candidates handed over by the Document Dept. `research_forwarded_at` is
  // set the moment their documents are verified, so letters can be issued before
  // the fee is approved; forwarding to the Exam Section still waits for it.
  async function load() {
    setLoading(true)
    const base = 'id, student_name, status, registration_no, enrollment_no, admission_number, session_id, programme_id, fathers_name, mobile_no, date_of_birth, academic_year, fee_collected, exam_forwarded_at, doc_verified_at, student_perm_village_town, student_perm_landmark, student_perm_city, student_perm_district, student_perm_state, student_perm_pin_code, programs(program_name, enrollment_code, programme_types(programme_type_name)), academic_sessions(session_name), departments(name), centers(center_name, center_code)'
    const cols = `specialization, ${OPTIONAL_COLS}, ${base}`

    // Everyone the Document Dept forwarded to Research. `doc_verified_at` is
    // accepted too: candidates verified before add_phd_portal_flow.sql existed
    // never got a research_forwarded_at, and they must not be stranded.
    let { data, error } = await supabase.from('students').select(cols)
      .or('research_forwarded_at.not.is.null,doc_verified_at.not.is.null')
      .order('created_at', { ascending: false })

    if (error) {
      // add_phd_portal_flow.sql not applied yet — fall back to the old rule
      // (account-approved Ph.D students) so the page keeps working.
      setNeedsSql(true)
      ;({ data } = await supabase.from('students').select(`specialization, ${base}`)
        .eq('status', 'Approved').order('created_at', { ascending: false }))
    } else {
      setNeedsSql(false)
    }
    setRows((data || []).filter(isPhdStudent))
    setLoading(false)
  }

  // Publish / unpublish a letter. Active = the Centre and Student panels show a
  // Download button for it; inactive keeps it admin-only.
  async function toggleLetter(student, field) {
    setBusy(`${student.id}-${field}`)
    const next = !student[field]
    const { error } = await supabase.from('students').update({ [field]: next }).eq('id', student.id)
    if (error) {
      alert(`Could not update: ${error.message}\n\nRun add_phd_portal_flow.sql in Supabase first.`)
    } else {
      setRows(rs => rs.map(r => r.id === student.id ? { ...r, [field]: next } : r))
    }
    setBusy(null)
  }

  // Enrollment numbers are sequential per program + session: EN<yy><code><nnnn>.
  // Mirrors the Account Dept's generator so both pipelines stay consistent.
  async function generateEnrollmentNumber(student) {
    const enrollCode = student.programs?.enrollment_code || 'GEN'
    const sessName = student.academic_sessions?.session_name || ''
    const yearMatch = sessName.match(/(\d{4})/)
    const yy = yearMatch ? yearMatch[1].slice(-2) : String(new Date().getFullYear()).slice(-2)
    const prefix = `EN${yy}${enrollCode}`
    let qy = supabase.from('students').select('*', { count: 'exact', head: true })
      .not('enrollment_no', 'is', null).neq('enrollment_no', '')
    if (student.programme_id) qy = qy.eq('programme_id', student.programme_id)
    if (student.session_id) qy = qy.eq('session_id', student.session_id)
    const { count } = await qy
    return `${prefix}${String((count || 0) + 1).padStart(4, '0')}`
  }

  // Forward to the Exam Section. This is the moment a Ph.D candidate's
  // enrollment number is issued — nothing earlier in the pipeline creates one.
  async function forwardToExam(student) {
    if (student.exam_forwarded_at) return
    if (!confirm(`Forward ${student.student_name} to the Exam Section?\n\nAn Enrollment Number will be generated now.`)) return
    setBusy(`${student.id}-exam`)
    const enrollNo = student.enrollment_no || await generateEnrollmentNumber(student)
    const now = new Date().toISOString()
    const { error } = await supabase.from('students')
      .update({ exam_forwarded_at: now, enrollment_no: enrollNo }).eq('id', student.id)
    if (error) alert('Could not forward: ' + error.message)
    else setRows(rs => rs.map(r => r.id === student.id ? { ...r, exam_forwarded_at: now, enrollment_no: enrollNo } : r))
    setBusy(null)
  }

  const filtered = rows.filter(s => {
    if (sessionFilter !== 'all' && s.session_id !== sessionFilter) return false
    if (!q.trim()) return true
    const hay = `${s.student_name} ${s.admission_number} ${s.enrollment_no} ${s.programs?.program_name} ${s.stream} ${s.specialization} ${s.centers?.center_name}`.toLowerCase()
    return hay.includes(q.toLowerCase())
  })

  const TabBtn = ({ id, icon: Icon, label, count }) => (
    <button onClick={() => setTab(id)}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${tab === id ? 'bg-[#933d18] text-white' : 'bg-[#933d18]/8 text-[#933d18] hover:bg-[#933d18]/15'}`}>
      <Icon size={15} /> {label}
      <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === id ? 'bg-white/25' : 'bg-white/70'}`}>{count}</span>
    </button>
  )

  return (
    <div className="p-6 space-y-5">
      <PageHeader title="Research Department"
        subtitle="Ph.D candidates forwarded by the Document Dept — issue letters, then forward to the Exam Section" />

      {needsSql && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <strong>Migration pending.</strong> Run <code className="font-mono text-xs bg-white px-1.5 py-0.5 rounded">add_phd_portal_flow.sql</code> in
          the Supabase SQL Editor to enable Stream, letter Active/Inactive and the Document&nbsp;→&nbsp;Research handover.
          Until then this page falls back to showing account-approved Ph.D students.
        </div>
      )}

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
              title="Everything before the running serial — end it with a slash, e.g. SIU/DR/AL/26/"
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#933d18]/30 w-48" placeholder="SIU/DR/AL/26/" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Next No.</label>
            <input type="number" min="0" value={sel?.nextNum ?? 1} onChange={e => updateSel({ nextNum: e.target.value })}
              title="Serial the next candidate will get. It counts up by 1 automatically after each letter is issued."
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#933d18]/30 w-24" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Date</label>
            <input type="date" value={sel?.date || ''} onChange={e => updateSel({ date: e.target.value })}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#933d18]/30" />
          </div>
          <Button variant="primary" size="md" onClick={saveCfg}><Save size={14} /> {saved ? 'Saved ✓' : 'Save'}</Button>
          <p className="text-[11px] text-gray-400">
            Next → <span className="font-mono font-bold text-[#933d18]">{sel?.prefix}{refSerial(sel?.nextNum)}</span>
            <span className="ml-1 text-gray-300">then {sel?.prefix}{refSerial((Number(sel?.nextNum) || 0) + 1)}</span>
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <TabBtn id="letters" icon={FlaskConical} label="Candidates" count={filtered.length} />
          <TabBtn id="exam" icon={GraduationCap} label="Forward to Exam" count={filtered.filter(s => !s.exam_forwarded_at).length} />
        </div>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name / application no / stream..."
            className="pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#933d18]/30 w-72" />
        </div>
      </div>

      {tab === 'letters' && (
        <Table>
          <Thead>
            <Tr>
              <Th>#</Th>
              <Th>Student</Th>
              <Th>Application No</Th>
              <Th>Stream</Th>
              <Th>Programme</Th>
              <Th>Specialization</Th>
              <Th>Session</Th>
              <Th>Offer Letter</Th>
              <Th>Entrance Certificate</Th>
            </Tr>
          </Thead>
          <Tbody>
            {loading ? (
              <Tr><Td colSpan={9} className="text-center text-gray-400 py-8">Loading...</Td></Tr>
            ) : filtered.length === 0 ? (
              <Tr><Td colSpan={9} className="text-center text-gray-400 py-8">No Ph.D candidates forwarded by the Document Dept yet.</Td></Tr>
            ) : filtered.map((s, i) => (
              <Tr key={s.id}>
                <Td>{i + 1}</Td>
                <Td>
                  <div className="font-semibold text-gray-900">{s.student_name}</div>
                  <div className="text-xs text-gray-400 font-mono">{s.mobile_no || '—'}</div>
                </Td>
                <Td className="font-mono text-xs font-bold text-[#933d18]">
                  {s.admission_number || '—'}
                  {letters.map(l => assigned[l.name]?.[s.id] != null && (
                    <div key={l.name} className="text-[10px] text-gray-400 font-normal mt-0.5">{l.name}: {l.prefix}{assigned[l.name][s.id]}</div>
                  ))}
                </Td>
                <Td className="text-sm">{s.stream || '—'}</Td>
                <Td className="text-sm">{s.programs?.program_name || '—'}</Td>
                <Td className="text-sm">{s.specialization || '—'}</Td>
                <Td className="text-sm">{s.academic_sessions?.session_name || s.academic_year || '—'}</Td>
                <LetterCell student={s} field="offer_letter_active" busy={busy}
                  onGenerate={() => generateOfferLetter(s, docOptsFor(s, 'Offer Letter'))}
                  onToggle={() => toggleLetter(s, 'offer_letter_active')}
                  icon={FileCheck2} label="Offer Letter" />
                <LetterCell student={s} field="entrance_letter_active" busy={busy}
                  onGenerate={() => generateEntranceClearance(s, docOptsFor(s, 'Entrance Certificate'))}
                  onToggle={() => toggleLetter(s, 'entrance_letter_active')}
                  icon={ShieldCheck} label="Entrance Letter" />
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      {tab === 'exam' && (
        <Table>
          <Thead>
            <Tr>
              <Th>#</Th>
              <Th>Student</Th>
              <Th>Application No</Th>
              <Th>Stream</Th>
              <Th>Programme</Th>
              <Th>Fee Status</Th>
              <Th>Enrollment No</Th>
              <Th>Action</Th>
            </Tr>
          </Thead>
          <Tbody>
            {loading ? (
              <Tr><Td colSpan={8} className="text-center text-gray-400 py-8">Loading...</Td></Tr>
            ) : filtered.length === 0 ? (
              <Tr><Td colSpan={8} className="text-center text-gray-400 py-8">No Ph.D candidates to forward.</Td></Tr>
            ) : filtered.map((s, i) => {
              // The fee gate still belongs to the Account Dept: only an approved
              // candidate may move on to the Exam Section.
              const feeCleared = s.status === 'Approved'
              return (
                <Tr key={s.id}>
                  <Td>{i + 1}</Td>
                  <Td>
                    <div className="font-semibold text-gray-900">{s.student_name}</div>
                    <div className="text-xs text-gray-400 font-mono">{s.mobile_no || '—'}</div>
                  </Td>
                  <Td className="font-mono text-xs font-bold text-[#933d18]">{s.admission_number || '—'}</Td>
                  <Td className="text-sm">{s.stream || '—'}</Td>
                  <Td className="text-sm">{s.programs?.program_name || '—'}</Td>
                  <Td>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded ${feeCleared ? 'text-emerald-700 bg-emerald-50' : 'text-amber-700 bg-amber-50'}`}>
                      {feeCleared ? 'Approved' : (s.status || 'Pending')}
                    </span>
                  </Td>
                  <Td className="font-mono text-xs font-bold text-emerald-700">{s.enrollment_no || '—'}</Td>
                  <Td>
                    {s.exam_forwarded_at ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                        <BadgeCheck size={12} /> Forwarded
                      </span>
                    ) : (
                      <Button size="sm" variant="primary" disabled={!feeCleared || busy === `${s.id}-exam`}
                        title={feeCleared ? 'Forward to Exam Section & generate Enrollment No' : 'Waiting for Account Dept approval'}
                        onClick={() => forwardToExam(s)}>
                        <Send size={13} /> {busy === `${s.id}-exam` ? '…' : 'Forward to Exam'}
                      </Button>
                    )}
                  </Td>
                </Tr>
              )
            })}
          </Tbody>
        </Table>
      )}
    </div>
  )
}

// One letter column: generate the PDF, and publish it to the Centre / Student
// panels with the Active toggle.
function LetterCell({ student, field, busy, onGenerate, onToggle, icon: Icon, label }) {
  const active = !!student[field]
  return (
    <Td>
      <div className="flex flex-col gap-1.5">
        <Button size="sm" variant="secondary" onClick={onGenerate} title={`Generate ${label}`} className="w-fit">
          <Icon size={13} /> Generate
        </Button>
        <button onClick={onToggle} disabled={busy === `${student.id}-${field}`}
          title={active ? 'Active — student & center can download' : 'Inactive — hidden from student & center'}
          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded w-fit transition-colors ${active ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100' : 'text-gray-500 bg-gray-100 hover:bg-gray-200'}`}>
          {active ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
          {active ? 'Active' : 'Inactive'}
        </button>
      </div>
    </Td>
  )
}
