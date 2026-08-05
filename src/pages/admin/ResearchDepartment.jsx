import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui/Table'
import PageHeader from '../../components/ui/PageHeader'
import ExportButtons from '../../components/ExportButtons'
import Button from '../../components/ui/Button'
import { Search, FlaskConical, FileCheck2, ShieldCheck, Settings2, Save, Plus, ToggleLeft, ToggleRight, Send, GraduationCap, BadgeCheck, Ticket, Trash2, Hash, CreditCard } from 'lucide-react'
import { generateOfferLetter, generateEntranceClearance, generateHallTicket, generateIDCard } from '../../utils/generateStudentCards'
import { resolveStudentDocUrls } from '../../utils/resolveStudentDocs'
import { isPhdStudent } from '../../utils/isPhdStudent'
import { formatDate, formatDateLong } from '../../utils/formatDate'
import { loadLetterSettings, saveLetterSettings, loadAssignedRefs, assignRef, unassignRef, deleteLetterSetting, setSitting } from '../../utils/letterSettings'

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
  // Each entry is one letter type FOR ONE SESSION — so June 2026 and July 2025
  // keep their own reference series and dates. Entries saved before sessions were
  // tracked have no `session` and act as the fallback for any session without its
  // own entry. testDate fills the certificate's "conducted on ____" blank.
  // Prefixes start BLANK on purpose. These defaults are also what refFor sees
  // while the shared settings are still loading (or were never saved), and a
  // sample prefix here once let Generate mint a real ".../001" from it before
  // the true series arrived. An empty prefix trips refFor's guard instead.
  const DEFAULT_LETTERS = [
    { name: 'Hall Ticket', prefix: '', nextNum: 1, date: today, testDate: '', examTime: '', reportTime: '', examCentre: '' },
    { name: 'Offer Letter', prefix: '', nextNum: 1, date: today },
    { name: 'Entrance Certificate', prefix: '', nextNum: 1, date: today, testDate: '' },
  ]
  const LETTER_NAMES = ['Hall Ticket', 'Offer Letter', 'Entrance Certificate']
  const [letters, setLetters] = useState(DEFAULT_LETTERS)
  // Open while asking which exam sitting a candidate's letter is for.
  const [sittingAsk, setSittingAsk] = useState(null)   // { letter, resolve }
  const [newName, setNewName] = useState('')
  // Types down the session list — sessions pile up year on year, so picking one
  // out of a plain dropdown gets slow.
  const [sessionSearch, setSessionSearch] = useState('')
  const [assigned, setAssigned] = useState({}) // { [letterName]: { [studentId]: num } }
  const [saved, setSaved] = useState(false)
  // Whether the shared letter_settings/letter_refs tables exist, and whether the
  // series still has to be pushed there once (table present but empty).
  const [settingsInDb, setSettingsInDb] = useState(false)
  const [settingsNeedSeed, setSettingsNeedSeed] = useState(false)

  // Older saves typed the leading serial digits into the prefix itself (e.g.
  // prefix "SIU/DR/AL/25/01" with Next No. 0 to read as …/010). Now that the
  // serial is zero-padded and appended, that doubles up (…/01 + 001 = …/01001).
  // Fold those trailing digits back into the number — the next reference stays
  // exactly what the panel was already showing, and it keeps counting correctly.
  function migratePrefix(l) {
    const prefix = String(l.prefix || '')
    const m = prefix.match(/(\d+)$/)
    if (!m) return l
    const folded = Number(`${m[1]}${Number(l.nextNum) || 0}`)
    return { ...l, prefix: prefix.slice(0, -m[1].length), nextNum: folded }
  }

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null')
      if (Array.isArray(s?.letters) && s.letters.length) {
        // De-duplicate by name (case-insensitive) — earlier saves could double up.
        const seen = new Set(), uniq = []
        for (const l of s.letters) {
          const k = (l.name || '').trim().toLowerCase()
          if (k && !seen.has(k)) { seen.add(k); uniq.push(migratePrefix(l)) }
        }
        setLetters(uniq)
        const changed = uniq.length !== s.letters.length
          || uniq.some((l, i) => l.prefix !== s.letters[i]?.prefix)
        if (changed) {
          localStorage.setItem(SETTINGS_KEY, JSON.stringify({ letters: uniq, assigned: s.assigned || {} }))
        }
      }
      if (s?.assigned) setAssigned(s.assigned)
    } catch { /* ignore */ }

    // The DB copy is shared by every admin, so it wins over this browser's copy.
    // If the tables aren't migrated yet, loadLetterSettings/loadAssignedRefs
    // return null and we simply keep the local values above.
    ;(async () => {
      const [dbLetters, dbAssigned] = await Promise.all([loadLetterSettings(), loadAssignedRefs()])
      if (dbLetters?.length) setLetters(dbLetters.map(migratePrefix))
      else if (dbLetters) setSettingsNeedSeed(true)   // table exists but is empty
      if (dbAssigned) setAssigned(dbAssigned)
      setSettingsInDb(dbLetters != null)
    })()
  }, [])

  // The entry for one session + letter. An entry saved without a session (from
  // before this was session-aware) stands in for sessions that have none yet.
  const entryFor = (sessionId, name) =>
    letters.find(l => l.name === name && (l.session || '') === (sessionId || ''))
    || letters.find(l => l.name === name && !l.session)

  const sessionName = (id) => sessions.find(s => s.id === id)?.session_name || '—'
  // Editing needs a concrete session; "All Sessions" has no series of its own.
  const editingSession = sessionFilter !== 'all' ? sessionFilter : ''
  const letterNames = [...new Set([...LETTER_NAMES, ...letters.map(l => l.name)])].filter(Boolean)
  const blankLetter = (name, session = '') =>
    ({ name, session, prefix: '', nextNum: 1, date: today, testDate: '', examTime: '', reportTime: '', examCentre: '' })
  // Every letter for the session on screen, so the whole set is filled in one go.
  // A letter with no entry of its own shows the "Any session" fallback's values.
  const sessionLetters = letterNames.map(name => ({
    name,
    entry: entryFor(editingSession, name) || blankLetter(name, editingSession),
    // False while the card is still showing the fallback (or nothing at all).
    own: letters.some(l => l.name === name && (l.session || '') === (editingSession || '')),
  }))
  // Only sessions matching the search box, plus whichever one is selected so it
  // never vanishes from under the user mid-edit.
  const shownSessions = sessions.filter(s =>
    s.id === sessionFilter || s.session_name.toLowerCase().includes(sessionSearch.trim().toLowerCase()))

  // Keep the browser copy as a fallback, but the DB is the shared source of truth.
  function persist(nextLetters, nextAssigned) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ letters: nextLetters, assigned: nextAssigned }))
    if (settingsInDb) saveLetterSettings(nextLetters)
  }
  // Write to this session's entry for one letter, creating it the first time it
  // is edited. Editing a card that was showing the "Any session" fallback copies
  // those values across, so the session starts from what was already on screen.
  function updateLetter(name, patch) {
    setLetters(ls => {
      const i = ls.findIndex(l => l.name === name && (l.session || '') === (editingSession || ''))
      if (i >= 0) return ls.map((l, k) => k === i ? { ...l, ...patch } : l)
      const base = ls.find(l => l.name === name && !l.session) || blankLetter(name)
      return [...ls, { ...base, session: editingSession, name, ...patch }]
    })
  }
  async function saveCfg() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ letters, assigned }))
    const { error } = await saveLetterSettings(letters)
    if (error) { alert('Could not save letter settings.\n\n' + error.message); return }
    setSettingsInDb(true); setSettingsNeedSeed(false)
    setSaved(true); setTimeout(() => setSaved(false), 1500)
  }

  function addLetter() {
    const name = newName.trim()
    if (!name) return
    setNewName('')
    if (letters.some(l => l.name.toLowerCase() === name.toLowerCase())) return
    const next = [...letters, blankLetter(name, editingSession)]
    setLetters(next); persist(next, assigned)
  }

  // Remove one letter entry. Needed to clear out duplicates and the session-less
  // entries left behind from before the panel tracked sessions — there was no
  // way to take a letter off this list once it had been added.
  async function removeLetter(l) {
    const where = l.session ? `for ${sessionName(l.session)}` : 'for “Any session”'
    // Reference numbers already handed to candidates live in letter_refs and are
    // keyed by the letter NAME, so they survive — but they lose the prefix that
    // makes them readable. Say so rather than silently breaking issued letters.
    const issued = Object.keys(assigned[l.name] || {}).length
    const warn = issued
      ? `\n\n${issued} candidate(s) already have a ${l.name} reference number. Their letters will fall back to the application number until you set this letter up again.`
      : ''
    if (!confirm(`Remove “${l.name}” ${where}?${warn}`)) return

    const next = letters.filter(x => !(x.name === l.name && (x.session || '') === (l.session || '')))
    setLetters(next)
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ letters: next, assigned }))
    // The upsert in persist() can't remove a row, so delete it explicitly.
    if (settingsInDb) {
      const { error } = await deleteLetterSetting(l.session || '', l.name)
      if (error) alert('Removed here, but the shared copy could not be deleted:\n\n' + error.message)
    }
  }

  // Letter serials print zero-padded to 3 digits — 010, 011 … 099, 100 — so the
  // running number keeps a fixed width instead of growing (…/9 then …/10).
  const refSerial = (n) => String(Math.max(Number(n) || 0, 0)).padStart(3, '0')
  // The serial is appended to the prefix, so a prefix that itself ends in digits
  // (a leftover from typing the number into it) doubles up: SIU/…/01 + 001.
  const endsInDigit = (prefix) => /\d$/.test(String(prefix || '').trim())

  // Assign / reuse a student's reference for a specific letter type. The series
  // comes from the STUDENT's own session, not whichever session is on screen.
  function refFor(student, letterName) {
    const letter = entryFor(student.session_id, letterName)
    const map = assigned[letterName] || {}
    let num = map[student.id]
    // An already-issued number is shown with whatever series exists — even a
    // missing one — so the admin can still see (and ×-clear) a stale claim.
    if (num != null) return `${letter?.prefix || ''}${refSerial(num)}`
    // Never mint a number without a configured series. This used to fall back
    // to a blank letter and quietly issue "001" with no prefix — e.g. when
    // Generate was pressed before the shared settings finished loading, or for
    // a session that was never set up. Fail loudly instead of numbering junk.
    if (!letter || !String(letter.prefix || '').trim()) {
      alert(`No ${letterName} reference series is set up for ${student.academic_sessions?.session_name || 'this student’s session'} yet.\n\nSet its prefix in the Master Panel and press Save, then Generate again. This copy prints with the application number instead.`)
      return null
    }
    // Never hand out a serial another candidate already holds — the panel's
    // Next No. can drift backwards (an edit, or a stale browser overwriting
    // the shared copy), and that once re-issued 010 to a second student.
    // Walk forward past every taken number; persisting num+1 also heals the
    // drifted series.
    const taken = new Set(Object.values(map).map(Number))
    num = Number(letter.nextNum) || 1
    while (taken.has(num)) num++
    const nextAssigned = { ...assigned, [letterName]: { ...map, [student.id]: num } }
    const nextLetters = letters.map(l => l === letter ? { ...l, nextNum: num + 1 } : l)
    setAssigned(nextAssigned); setLetters(nextLetters); persist(nextLetters, nextAssigned)
    // Record the claim so every admin — and the student's own copy — reuses it.
    if (settingsInDb) assignRef(letterName, student.id, num)
    return `${letter.prefix}${refSerial(num)}`
  }
  function docOptsFor(student, letterName, sitting = 1) {
    const letter = entryFor(student.session_id, letterName) || blankLetter(letterName)
    // The Ph.D entrance exam runs twice for one session; `sitting` says which
    // date this candidate was given.
    const testDate = sitting === 2 ? letter.testDate2 : letter.testDate
    return {
      refNo: refFor(student, letterName),
      date: letter.date ? formatDate(letter.date) : undefined,
      // Only the Entrance Certificate prints this; blank leaves a rule to fill in.
      // Reads inside a sentence on the certificate, so spell the month: 15-June-2026.
      testDate: testDate ? formatDateLong(testDate) : undefined,
      // Hall Ticket only — exam time, reporting time and the exam centre.
      examTime: letter.examTime || undefined,
      reportTime: letter.reportTime || undefined,
      examCentre: letter.examCentre || undefined,
    }
  }
  // The reference this candidate already holds for a letter, or null if the
  // letter has not been issued to them yet.
  function issuedRef(student, letterName) {
    const num = assigned[letterName]?.[student.id]
    if (num == null) return null
    return `${entryFor(student.session_id, letterName)?.prefix || ''}${refSerial(num)}`
  }

  // Let go of a candidate's issued number so the next Generate claims a fresh
  // one from the CURRENT series. Numbers lock on first issue (so reopening a
  // letter never renumbers it), but that also locks in numbers claimed under an
  // old series — like a certificate issued before the session's series existed.
  // `field` is the *_active column, so withdrawing also takes the letter off the
  // student portal — leaving it downloadable after the number is gone would show
  // the candidate a letter the office no longer has a record of.
  async function clearRef(student, letterName, field) {
    const letter = entryFor(student.session_id, letterName)
    const cur = `${letter?.prefix || ''}${refSerial(assigned[letterName]?.[student.id])}`
    if (!confirm(`Withdraw ${student.student_name}'s ${letterName} (${cur})?\n\nIt disappears from the student portal, and pressing Generate again issues the NEXT number of the current series — not this one.`)) return
    if (field && student[field]) {
      const { error } = await supabase.from('students').update({ [field]: false }).eq('id', student.id)
      if (error) { alert('Could not hide it from the student portal:\n\n' + error.message); return }
      setRows(rs => rs.map(r => r.id === student.id ? { ...r, [field]: false } : r))
    }
    const map = { ...(assigned[letterName] || {}) }
    delete map[student.id]
    const nextAssigned = { ...assigned, [letterName]: map }
    setAssigned(nextAssigned)
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ letters, assigned: nextAssigned }))
    if (settingsInDb) {
      const { error } = await unassignRef(letterName, student.id)
      if (error) alert('Cleared here, but the shared copy could not be removed:\n\n' + error.message)
    }
  }

  // Ask which sitting the candidate is being given. Resolves straight away when
  // the letter has only one exam date, so nothing changes for a single sitting.
  function askSitting(letter) {
    if (!letter?.testDate2) return Promise.resolve(1)
    return new Promise(resolve => setSittingAsk({ letter, resolve }))
  }

  // Issue a letter: pick the sitting, record it against the candidate so their
  // own copy prints the same date, then hand the options to the generator.
  async function issue(student, letterName, generate) {
    const letter = entryFor(student.session_id, letterName) || blankLetter(letterName)
    const sitting = await askSitting(letter)
    if (!sitting) return                       // cancelled
    const opts = docOptsFor(student, letterName, sitting)
    if (settingsInDb && letter.testDate2) await setSitting(letterName, student.id, sitting)
    await generate(opts)
  }

  // The Hall Ticket prints the photo and signature, which live in private
  // storage — swap the stored paths for signed URLs before generating.
  async function hallTicketFor(student) {
    await issue(student, 'Hall Ticket', async (opts) =>
      generateHallTicket(await resolveStudentDocUrls(student), opts))
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
    const base = 'id, student_name, status, registration_no, enrollment_no, admission_number, session_id, programme_id, fathers_name, mobile_no, date_of_birth, gender, photo_url, signature_url, academic_year, fee_collected, exam_forwarded_at, doc_verified_at, student_perm_village_town, student_perm_landmark, student_perm_city, student_perm_district, student_perm_state, student_perm_pin_code, programs(program_name, enrollment_code, duration, complete_duration, semester_year, programme_types(programme_type_name)), academic_sessions(session_name, start_date), departments(name), centers(center_name, center_code)'
    const cols = `specialization, ${OPTIONAL_COLS}, ${base}`

    // Everyone the Document Dept forwarded to Research. `doc_verified_at` is
    // accepted too: candidates verified before add_phd_portal_flow.sql existed
    // never got a research_forwarded_at, and they must not be stranded.
    const forwarded = (sel) => supabase.from('students').select(sel)
      .or('research_forwarded_at.not.is.null,doc_verified_at.not.is.null')
      .order('created_at', { ascending: false })

    // hall_ticket_active arrives with add_hall_ticket.sql — retry without it so
    // a database migrated only up to add_phd_portal_flow.sql still works.
    let { data, error } = await forwarded(`hall_ticket_active, ${cols}`)
    if (error) ({ data, error } = await forwarded(cols))

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
      const sqlFile = field === 'hall_ticket_active' ? 'add_hall_ticket.sql' : 'add_phd_portal_flow.sql'
      alert(`Could not update: ${error.message}\n\nRun ${sqlFile} in Supabase first.`)
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
    // The count is a snapshot, so two admins acting at once — or a number
    // issued under an older counting rule — can land on a taken serial.
    // Walk forward until a free one is found.
    let n = (count || 0) + 1
    for (let tries = 0; tries < 50; tries++, n++) {
      const candidate = `${prefix}${String(n).padStart(4, '0')}`
      const { count: taken } = await supabase.from('students')
        .select('*', { count: 'exact', head: true }).eq('enrollment_no', candidate)
      if (!taken) return candidate
    }
    return `${prefix}${String(n).padStart(4, '0')}`
  }

  // All three letters must have an issued reference number before the
  // enrollment number can be generated — that is the Research Dept's rule.
  const lettersDone = (s) =>
    LETTER_NAMES.every(n => assigned[n]?.[s.id] != null)

  // Generate the enrollment number from the Candidates row (once the Hall
  // Ticket, Offer Letter and Entrance Certificate are all issued), and open
  // the candidate's ID card right away — enrollment is what the card needs.
  // Forwarding to the Exam Section stays a separate, fee-gated step.
  async function generateEnrollment(student) {
    if (student.enrollment_no) return
    if (!lettersDone(student)) return
    if (!confirm(`Generate the Enrollment Number for ${student.student_name}?\n\nThe ID card will be generated along with it.`)) return
    setBusy(`${student.id}-enroll`)
    const enrollNo = await generateEnrollmentNumber(student)
    const { error } = await supabase.from('students')
      .update({ enrollment_no: enrollNo }).eq('id', student.id)
    if (error) {
      alert('Could not save the enrollment number: ' + error.message)
      setBusy(null)
      return
    }
    setRows(rs => rs.map(r => r.id === student.id ? { ...r, enrollment_no: enrollNo } : r))
    // Auto-generate the ID card with the fresh number (signed photo/signature URLs).
    generateIDCard(await resolveStudentDocUrls({ ...student, enrollment_no: enrollNo }))
    setBusy(null)
  }

  // Forward to the Exam Section. The enrollment number is normally issued
  // from the Candidates tab once all three letters are out; if it wasn't,
  // it is minted here as a fallback.
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
      {count != null && <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === id ? 'bg-white/25' : 'bg-white/70'}`}>{count}</span>}
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

      {/* The letter setup and the student lists each live in their own tab —
          the master panel is tall, and it buried the candidates below it. */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <TabBtn id="master" icon={Settings2} label="Master Panel" />
          <TabBtn id="letters" icon={FlaskConical} label="Candidates" count={filtered.length} />
          <TabBtn id="exam" icon={GraduationCap} label="Forward to Exam" count={filtered.filter(s => !s.exam_forwarded_at).length} />
        </div>
        {tab !== 'master' && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name / application no / stream..."
                className="pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#933d18]/30 w-72" />
            </div>
            {/* Both tabs list the same candidates; the columns differ. */}
            <ExportButtons
              title={tab === 'exam' ? 'Forward to Exam' : 'Ph.D Candidates'}
              filename={tab === 'exam' ? 'phd-forward-to-exam' : 'phd-candidates'}
              rows={filtered}
              meta={q ? [`Search: ${q}`] : []}
              columns={tab === 'exam' ? [
                { header: 'Student', value: s => s.student_name || '' },
                { header: 'Mobile', value: s => s.mobile_no || '' },
                { header: 'Application No', value: s => s.admission_number || '' },
                { header: 'Stream', value: s => s.stream || '' },
                { header: 'Programme', value: s => s.programs?.program_name || '' },
                { header: 'Fee Status', value: s => (s.status === 'Approved' ? 'Approved' : s.status || 'Pending') },
                { header: 'Enrollment No', value: s => s.enrollment_no || '' },
                { header: 'Forwarded', value: s => (s.exam_forwarded_at ? 'Forwarded' : 'Pending') },
              ] : [
                { header: 'Student', value: s => s.student_name || '' },
                { header: 'Mobile', value: s => s.mobile_no || '' },
                { header: 'Application No', value: s => s.admission_number || '' },
                { header: 'Stream', value: s => s.stream || '' },
                { header: 'Programme', value: s => s.programs?.program_name || '' },
                { header: 'Specialization', value: s => s.specialization || '' },
                { header: 'Session', value: s => s.academic_sessions?.session_name || s.academic_year || '' },
                // The reference numbers the office copies carry.
                ...letterNames.map(name => ({
                  header: `${name} Ref`,
                  value: s => {
                    const num = assigned[name]?.[s.id]
                    if (num == null) return ''
                    return `${entryFor(s.session_id, name)?.prefix || ''}${refSerial(num)}`
                  },
                })),
                { header: 'Hall Ticket', value: s => (s.hall_ticket_active ? 'Active' : 'Inactive') },
                { header: 'Offer Letter', value: s => (s.offer_letter_active ? 'Active' : 'Inactive') },
                { header: 'Entrance Certificate', value: s => (s.entrance_letter_active ? 'Active' : 'Inactive') },
                { header: 'Enrollment No', value: s => s.enrollment_no || '' },
              ]} />
          </div>
        )}
      </div>

      {/* Master panel — per-letter reference series + date */}
      {tab === 'master' && (
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

        {/* Pick a session, then fill in every letter for it in one pass. */}
        <div className="border-t border-gray-100 pt-4 space-y-3">
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1">Search Session</label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={sessionSearch} onChange={e => setSessionSearch(e.target.value)}
                  placeholder="Type a session…"
                  className="pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#933d18]/30 w-44" />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1">Session</label>
              <select value={sessionFilter} onChange={e => setSessionFilter(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#933d18]/30 bg-white w-52">
                <option value="all">All Sessions (fallback)</option>
                {shownSessions.map(s => <option key={s.id} value={s.id}>{s.session_name}</option>)}
              </select>
            </div>
            <Button variant="primary" size="md" onClick={saveCfg}>
              <Save size={14} /> {saved ? 'Saved ✓' : 'Save All Letters'}
            </Button>
            <p className="text-[11px] text-gray-500 pb-2">
              {editingSession
                ? <>Setting up <strong className="text-gray-700">{sessionName(editingSession)}</strong> — fill every letter below, then Save once.</>
                : <>No session picked — you're editing the fallback that any session without its own series will use.</>}
            </p>
          </div>

          {sessionSearch.trim() && shownSessions.length === 0 && (
            <p className="text-[11px] text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              No session matches “{sessionSearch}”.
            </p>
          )}

          {/* One card per letter — all of them for the chosen session at once. */}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {sessionLetters.map(({ name, entry, own }) => {
              const isHall = /hall/i.test(name)
              const hasTestDate = isHall || /entrance/i.test(name)
              const bad = endsInDigit(entry.prefix)
              const set = (patch) => updateLetter(name, patch)
              return (
                <div key={name} className="border border-gray-200 rounded-xl p-3.5 space-y-2.5 bg-gray-50/40">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-gray-900">{name}</p>
                    {editingSession && !own && (
                      <span className="text-[10px] font-semibold text-gray-400 bg-white border border-gray-200 px-1.5 py-0.5 rounded"
                        title="This session has no series of its own yet — showing the “Any session” fallback. Edit any field to give it one.">
                        inherited
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <div className="flex-1 min-w-0">
                      <label className="block text-[10px] font-semibold text-gray-500 mb-1">Reference No. (prefix)</label>
                      <input value={entry.prefix || ''} onChange={e => set({ prefix: e.target.value })}
                        title="Everything before the running serial — end it with a slash, e.g. SIU/DR/AL/26/"
                        className={`w-full px-2.5 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#933d18]/30 ${
                          bad ? 'border-amber-400 bg-amber-50' : 'border-gray-200'}`} placeholder="SIU/DR/AL/26/" />
                    </div>
                    <div className="w-20 shrink-0">
                      <label className="block text-[10px] font-semibold text-gray-500 mb-1">Next No.</label>
                      <input type="number" min="0" value={entry.nextNum ?? 1} onChange={e => set({ nextNum: e.target.value })}
                        title="Serial the next candidate will get. It counts up by 1 automatically after each letter is issued."
                        className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#933d18]/30" />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <div className="flex-1 min-w-0">
                      <label className="block text-[10px] font-semibold text-gray-500 mb-1">Letter Date</label>
                      <input type="date" value={entry.date || ''} onChange={e => set({ date: e.target.value })}
                        title="Date printed on the letter"
                        className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#933d18]/30" />
                    </div>
                    {/* The certificate's "conducted on ____" blank; the Hall
                        Ticket prints the same date as "Date & Time of Exam". */}
                    {hasTestDate && (
                      <div className="flex-1 min-w-0">
                        <label className="block text-[10px] font-semibold text-gray-500 mb-1">{isHall ? 'Exam Date' : 'Test Conducted On'}</label>
                        <input type="date" value={entry.testDate || ''} onChange={e => set({ testDate: e.target.value })}
                          title="Entrance Test date printed on the letter. Leave empty to print a blank rule to fill in by hand."
                          className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#933d18]/30" />
                      </div>
                    )}
                  </div>

                  {/* The Ph.D entrance exam is held twice for one session — the
                      same paper on two dates. Fill the second in and the letter
                      asks which sitting the candidate is being given. */}
                  {hasTestDate && (
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-500 mb-1">
                        2nd Sitting {isHall ? 'Exam Date' : 'Test Date'} <span className="font-normal text-gray-400">— optional</span>
                      </label>
                      <input type="date" value={entry.testDate2 || ''} onChange={e => set({ testDate2: e.target.value })}
                        title="Fill this only when the same exam is held a second time (e.g. August and September). You then pick the sitting when issuing each candidate's letter."
                        className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#933d18]/30" />
                      {entry.testDate2 && (
                        <p className="text-[10px] text-gray-400 mt-1">
                          Two sittings set — issuing a letter will ask which one the candidate gets.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Hall Ticket only — exam time, reporting time, exam centre. */}
                  {isHall && (
                    <>
                      <div className="flex gap-2">
                        <div className="flex-1 min-w-0">
                          <label className="block text-[10px] font-semibold text-gray-500 mb-1">Exam Time</label>
                          <input value={entry.examTime || ''} onChange={e => set({ examTime: e.target.value })}
                            title="Printed after the exam date, e.g. 10.00 a.m. to 01.00 p.m."
                            className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#933d18]/30"
                            placeholder="10.00 a.m. to 01.00 p.m." />
                        </div>
                        <div className="w-28 shrink-0">
                          <label className="block text-[10px] font-semibold text-gray-500 mb-1">Reporting</label>
                          <input value={entry.reportTime || ''} onChange={e => set({ reportTime: e.target.value })}
                            title='Printed as "… (Mandatory)". Leave empty for a blank rule.'
                            className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#933d18]/30"
                            placeholder="09.00 a.m." />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-500 mb-1">Examination Centre</label>
                        <input value={entry.examCentre || ''} onChange={e => set({ examCentre: e.target.value })}
                          title="Full address of the exam centre. Leave empty for a blank rule to fill in by hand."
                          className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#933d18]/30"
                          placeholder="Centre name and full address" />
                      </div>
                    </>
                  )}

                  <p className="text-[10px] text-gray-400">
                    Next → <span className="font-mono font-bold text-[#933d18]">{entry.prefix}{refSerial(entry.nextNum)}</span>
                  </p>

                  {/* A blank prefix is almost always an unfinished setup — the
                      reference then prints as a bare serial with nothing to
                      identify the university, the letter or the year. */}
                  {!String(entry.prefix || '').trim() && (
                    <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
                      No prefix set — this letter's reference will print as just
                      <span className="font-mono font-bold"> {refSerial(entry.nextNum)}</span>.
                    </p>
                  )}

                  {bad && (
                    <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
                      The prefix ends in a number, so the serial is added on top of it.
                      <button type="button" onClick={() => { const f = migratePrefix(entry); set({ prefix: f.prefix, nextNum: f.nextNum }) }}
                        className="ml-1 font-semibold text-[#933d18] underline">
                        Fix → {String(entry.prefix || '').replace(/\d+$/, '')}{refSerial(migratePrefix(entry).nextNum)}
                      </button>
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
        {!settingsInDb && (
          <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2">
            These settings are saved in this browser only. Run <span className="font-mono">add_letter_settings.sql</span> in
            Supabase → SQL Editor to share one reference series across all admins and show the same Ref. No. on the student's own copy.
            <br />
            <strong>Already ran it?</strong> Then your <span className="font-mono">letter_settings</span> table is from an earlier
            version of that script and is missing a column. Re-run it — it now upgrades an existing table instead of skipping it.
            The browser console shows the exact reason.
          </p>
        )}
        {settingsInDb && settingsNeedSeed && (
          <p className="text-[11px] text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mt-2">
            Press <strong>Save</strong> once to publish this reference series to the shared settings.
          </p>
        )}

        {/* Every configured letter at a glance — the cards above only cover the
            session on screen, so without this you can't see the other sessions. */}
        <div className="mt-4">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">All Letters — every session you've set up</p>
          <div className="border border-gray-100 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
                  <th className="text-left font-semibold px-3 py-2">Session</th>
                  <th className="text-left font-semibold px-3 py-2">Letter</th>
                  <th className="text-left font-semibold px-3 py-2">Next Reference No.</th>
                  <th className="text-left font-semibold px-3 py-2">Date</th>
                  <th className="text-left font-semibold px-3 py-2">Test Date</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {letters.length === 0 && (
                  <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-400 text-xs">
                    Nothing set up yet — pick a session above, fill the letters in, then Save.
                  </td></tr>
                )}
                {letters.map((l, i) => {
                  // The cards above already show every letter, so a row only has
                  // to say whether its session is the one currently on screen.
                  const isSel = (l.session || '') === (editingSession || '')
                  return (
                    <tr key={`${l.session || 'any'}-${l.name}-${i}`} className={`border-t border-gray-100 ${isSel ? 'bg-[#933d18]/5' : ''}`}>
                      <td className="px-3 py-2 text-gray-700">{l.session ? sessionName(l.session)
                        : <span className="text-gray-400 italic"
                            title="No session of its own — this entry is the fallback used by every session that has none. To give a session its own series, pick it in the Session dropdown above, then set the reference and Save.">
                            Any session
                          </span>}</td>
                      <td className="px-3 py-2 font-semibold text-gray-800">{l.name}</td>
                      <td className="px-3 py-2 font-mono text-[#933d18]">{l.prefix}{refSerial(l.nextNum)}</td>
                      <td className="px-3 py-2 text-gray-600">{l.date ? formatDate(l.date) : '—'}</td>
                      <td className="px-3 py-2 text-gray-600">{l.testDate ? formatDateLong(l.testDate) : '—'}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <button type="button"
                          onClick={() => setSessionFilter(l.session || 'all')}
                          title="Load this session's letters into the cards above"
                          className={`text-xs font-semibold ${isSel ? 'text-gray-400' : 'text-[#933d18] hover:underline'}`}>
                          {isSel ? 'Editing' : 'Edit'}
                        </button>
                        <button type="button" onClick={() => removeLetter(l)}
                          title={`Remove this ${l.name} entry`}
                          className="ml-3 align-middle text-gray-300 hover:text-red-500 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      )}

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
              <Th>Hall Ticket</Th>
              <Th>Offer Letter</Th>
              <Th>Entrance Certificate</Th>
              <Th>Enrollment / ID Card</Th>
            </Tr>
          </Thead>
          <Tbody>
            {loading ? (
              <Tr><Td colSpan={11} className="text-center text-gray-400 py-8">Loading...</Td></Tr>
            ) : filtered.length === 0 ? (
              <Tr><Td colSpan={11} className="text-center text-gray-400 py-8">No Ph.D candidates forwarded by the Document Dept yet.</Td></Tr>
            ) : filtered.map((s, i) => (
              <Tr key={s.id}>
                <Td>{i + 1}</Td>
                <Td>
                  <div className="font-semibold text-gray-900">{s.student_name}</div>
                  <div className="text-xs text-gray-400 font-mono">{s.mobile_no || '—'}</div>
                </Td>
                <Td className="font-mono text-xs font-bold text-[#933d18]">
                  {s.admission_number || '—'}
                  {/* One chip per letter NAME (not per entry — a name can have
                      per-session entries too), with the prefix of the student's
                      own session and the serial padded exactly as printed. */}
                  {letterNames.map(name => {
                    const num = assigned[name]?.[s.id]
                    if (num == null) return null
                    const letter = entryFor(s.session_id, name)
                    return (
                      <div key={name} className="text-[10px] text-gray-400 font-normal mt-0.5">
                        {name}: {letter?.prefix}{refSerial(num)}
                      </div>
                    )
                  })}
                </Td>
                <Td className="text-sm">{s.stream || '—'}</Td>
                <Td className="text-sm">{s.programs?.program_name || '—'}</Td>
                <Td className="text-sm">{s.specialization || '—'}</Td>
                <Td className="text-sm">{s.academic_sessions?.session_name || s.academic_year || '—'}</Td>
                <LetterCell student={s} field="hall_ticket_active" busy={busy}
                  issued={assigned['Hall Ticket']?.[s.id] != null}
                  refNo={issuedRef(s, 'Hall Ticket')}
                  onWithdraw={() => clearRef(s, 'Hall Ticket', 'hall_ticket_active')}
                  onGenerate={() => hallTicketFor(s)}
                  onToggle={() => toggleLetter(s, 'hall_ticket_active')}
                  icon={Ticket} label="Hall Ticket" />
                <LetterCell student={s} field="offer_letter_active" busy={busy}
                  issued={assigned['Offer Letter']?.[s.id] != null}
                  refNo={issuedRef(s, 'Offer Letter')}
                  onWithdraw={() => clearRef(s, 'Offer Letter', 'offer_letter_active')}
                  onGenerate={() => issue(s, 'Offer Letter', opts => generateOfferLetter(s, opts))}
                  onToggle={() => toggleLetter(s, 'offer_letter_active')}
                  icon={FileCheck2} label="Offer Letter" />
                <LetterCell student={s} field="entrance_letter_active" busy={busy}
                  issued={assigned['Entrance Certificate']?.[s.id] != null}
                  refNo={issuedRef(s, 'Entrance Certificate')}
                  onWithdraw={() => clearRef(s, 'Entrance Certificate', 'entrance_letter_active')}
                  onGenerate={() => issue(s, 'Entrance Certificate', opts => generateEntranceClearance(s, opts))}
                  onToggle={() => toggleLetter(s, 'entrance_letter_active')}
                  icon={ShieldCheck} label="Entrance Letter" />
                <Td>
                  {s.enrollment_no ? (
                    <div className="flex flex-col gap-1.5">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded w-fit font-mono">
                        <BadgeCheck size={12} /> {s.enrollment_no}
                      </span>
                      <Button size="sm" variant="secondary" className="w-fit"
                        title="Open the ID card"
                        onClick={async () => generateIDCard(await resolveStudentDocUrls(s))}>
                        <CreditCard size={13} /> ID Card
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="primary" className="w-fit"
                      disabled={!lettersDone(s) || busy === `${s.id}-enroll`}
                      title={lettersDone(s)
                        ? 'Generate the Enrollment Number — the ID card opens along with it'
                        : 'Generate the Hall Ticket, Offer Letter and Entrance Certificate first'}
                      onClick={() => generateEnrollment(s)}>
                      <Hash size={13} /> {busy === `${s.id}-enroll` ? '…' : 'Enrollment'}
                    </Button>
                  )}
                </Td>
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

      {/* Which of the two exam sittings this candidate is being given. Only
          appears when the letter has a second date set. */}
      {sittingAsk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => { sittingAsk.resolve(null); setSittingAsk(null) }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-900">Which exam sitting?</h3>
            <p className="text-xs text-gray-500 mt-1 mb-4">
              This date prints on the candidate's letter, and on their own copy in the student portal.
            </p>
            <div className="space-y-2">
              {[1, 2].map(n => {
                const d = n === 1 ? sittingAsk.letter.testDate : sittingAsk.letter.testDate2
                return (
                  <button key={n}
                    onClick={() => { sittingAsk.resolve(n); setSittingAsk(null) }}
                    className="w-full text-left border border-gray-200 hover:border-[#933d18] hover:bg-[#933d18]/5 rounded-xl px-4 py-3 transition-colors">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Sitting {n}</p>
                    <p className="text-sm font-bold text-gray-900">{d ? formatDateLong(d) : 'No date set'}</p>
                  </button>
                )
              })}
            </div>
            <div className="flex justify-end mt-4">
              <Button size="md" variant="secondary"
                onClick={() => { sittingAsk.resolve(null); setSittingAsk(null) }}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// One letter column: generate the PDF, and publish it to the Centre / Student
// panels with the Active toggle.
// Before a letter is issued the cell offers Generate. Once it has a reference
// number it is a real document the candidate may already hold, so the cell
// switches to Print (the same number again), Hide/Show, and withdraw.
function LetterCell({ student, field, busy, issued, refNo, onGenerate, onToggle, onWithdraw, icon: Icon, label }) {
  const active = !!student[field]
  if (!issued) {
    return (
      <Td>
        <Button size="sm" variant="secondary" onClick={onGenerate} title={`Generate ${label}`} className="w-fit">
          <Icon size={13} /> Generate
        </Button>
      </Td>
    )
  }
  return (
    <Td>
      <div className="flex flex-col gap-1.5">
        {refNo && <p className="text-[10px] font-mono text-gray-400 leading-none">{refNo}</p>}
        <div className="flex items-center gap-1">
          <Button size="sm" variant="secondary" onClick={onGenerate} title={`Print ${label} again with the same number`} className="w-fit">
            <Icon size={13} /> Print
          </Button>
          <button onClick={onWithdraw} title={`Withdraw this ${label}`}
            className="inline-flex items-center p-1.5 rounded text-red-500 hover:bg-red-50 transition-colors">
            <Trash2 size={13} />
          </button>
        </div>
        <button onClick={onToggle} disabled={busy === `${student.id}-${field}`}
          title={active ? 'Visible — student & center can download' : 'Hidden from student & center'}
          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded w-fit transition-colors ${active ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100' : 'text-gray-500 bg-gray-100 hover:bg-gray-200'}`}>
          {active ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
          {active ? 'Visible' : 'Hidden'}
        </button>
      </div>
    </Td>
  )
}
