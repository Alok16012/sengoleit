import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui/Table'
import PageHeader from '../../components/ui/PageHeader'
import ExportButtons from '../../components/ExportButtons'
import Button from '../../components/ui/Button'
import { Search, FlaskConical, FileCheck2, ShieldCheck, Settings2, Save, ToggleLeft, ToggleRight, Send, GraduationCap, BadgeCheck, Ticket, Trash2, Hash, CreditCard, IndianRupee, FileText, Wallet } from 'lucide-react'
import { generateOfferLetter, generateEntranceClearance, generateHallTicket, generateIDCard, generatePhdDocument, LATER_PHD_DOCS, PHD_DOC_EXTRAS, phdDocLabel } from '../../utils/generateStudentCards'
import { resolveStudentDocUrls } from '../../utils/resolveStudentDocs'
import { isPhdStudent } from '../../utils/isPhdStudent'
import { formatDate, formatDateLong } from '../../utils/formatDate'
import { useAuth } from '../../context/AuthContext'
import ResearchPaymentConditions from '../../components/ResearchPaymentConditions'
import ResearchFeeEntry from '../../components/ResearchFeeEntry'
import { loadLetterSettings, saveLetterSettings, loadAssignedRefs, assignRef, unassignRef, deleteLetterSetting, setSitting } from '../../utils/letterSettings'

const SETTINGS_KEY = 'phd_doc_settings'
// Guide's name, thesis title, viva date… typed when a later document is issued,
// kept per candidate so a re-print offers the same answers again.
const EXTRAS_KEY = 'phd_doc_extras'
// The second series (S.no) of a document is claimed under its own name.
const ref2Key = name => `${name} — S.no`

// Optional columns that only exist after add_phd_portal_flow.sql has been run.
// Every query and update degrades gracefully when they are still missing.
const OPTIONAL_COLS = 'stream, offer_letter_active, entrance_letter_active, research_forwarded_at'

// The Ph.D documents, in the order they are issued, and what the Master Panel
// asks for each. ref = the reference series (prefix + next number) under the
// label the document uses; ref2 a second series; date the date of issue.
// noNextRef hides the Next Reference preview for that document.
const PHD_DOCS = [
  { name: 'Hall Ticket', fields: [
    { k: 'testDate', label: 'Entrance (Exam) Date' },
    { k: 'testDate2', label: '2nd Sitting Date', optional: true },
    { k: 'examTime', label: 'Exam Time', placeholder: '10.00 a.m. to 01.00 p.m.' },
    { k: 'reportTime', label: 'Reporting Time', placeholder: '09.00 a.m.' },
    { k: 'examCentre', label: 'Examination Centre', placeholder: 'Centre name and full address' },
  ] },
  { name: 'Entrance Certificate', fields: [{ k: 'ref' }, { k: 'date', label: 'Date of Issue' },
    { k: 'testDate', label: 'Entrance Test' }, { k: 'testDate2', label: '2nd Sitting Test Date', optional: true }] },
  { name: 'Offer Letter', fields: [{ k: 'ref' }, { k: 'date', label: 'Date of Issue' }] },
  { name: 'Enrollment Certificate', refLabel: 'Provisional Registration No', noNextRef: true, fields: [{ k: 'ref' }, { k: 'date', label: 'Date of Issue' }] },
  { name: 'Admission Confirmation and Research Proposal', fields: [{ k: 'ref' }, { k: 'date', label: 'Date of Issue' }] },
  { name: 'Course Work Completion Marksheet', refLabel: 'S.no', fields: [{ k: 'ref' }, { k: 'date', label: 'Date of Issue' }] },
  { name: 'Allocation of Guide / Supervisor', fields: [{ k: 'ref' }, { k: 'date', label: 'Date of Issue' }] },
  { name: 'Thesis Submission Letter', fields: [{ k: 'date', label: 'Date of Issue' }] },
  { name: 'Final Viva - Voce Intimation Letter', fields: [{ k: 'ref' }, { k: 'date', label: 'Date of Issue' }] },
  { name: 'Notification', fields: [{ k: 'ref' }, { k: 'date', label: 'Date of Issue' }] },
  { name: 'Provisional Certificate', refLabel: 'Registration No', ref2Label: 'S.no', fields: [{ k: 'ref' }, { k: 'ref2' }] },
  { name: 'Title of Thesis', refLabel: 'Provisional Registration No', ref2Label: 'S.no', fields: [{ k: 'ref' }, { k: 'ref2' }] },
  { name: 'Compliance Certificate', fields: [{ k: 'ref' }, { k: 'date', label: 'Date of Issue' }] },
]
// A letter added by name only gets the common pair.
const docSpec = name => PHD_DOCS.find(d => d.name.toLowerCase() === String(name).toLowerCase())
  || { name, fields: [{ k: 'ref' }, { k: 'date', label: 'Date of Issue' }] }

export default function ResearchDepartment() {
  const { may, mayTab } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState(() => ['letters', 'exam', 'master', 'payment', 'fee'].find(k => mayTab('research_dept', k)) || 'letters')      // 'letters' | 'exam'
  const [q, setQ] = useState('')
  const [sessions, setSessions] = useState([])
  const [sessionFilter, setSessionFilter] = useState('all')
  const [busy, setBusy] = useState(null)
  // Payment Condition — least fee paid before each document; null = loading.
  const [payRules, setPayRules] = useState(null)
  const [payMissing, setPayMissing] = useState(false)
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
  // Every Ph.D document from the Master Panel, plus the ID card and the forward.
  const PAY_DOCS = [...new Set([...PHD_DOCS.map(d => d.name), 'Enrollment / ID Card', 'Forward to Exam'])]
  const [letters, setLetters] = useState(DEFAULT_LETTERS)
  // Open while asking which exam sitting a candidate's letter is for.
  const [sittingAsk, setSittingAsk] = useState(null)   // { letter, resolve }
  // Master Panel: Entry (one document at a time) or Complete.
  const [masterTab, setMasterTab] = useState('entry')
  const [completeSession, setCompleteSession] = useState('all')
  const [docSel, setDocSel] = useState('Hall Ticket')
  // Types down the session list — sessions pile up year on year, so picking one
  // out of a plain dropdown gets slow.
  const [sessionSearch, setSessionSearch] = useState('')
  const [assigned, setAssigned] = useState({}) // { [letterName]: { [studentId]: num } }
  // Which exam sitting each issued letter was given, so a re-print reuses it.
  const [sittings, setSittings] = useState({}) // { [letterName]: { [studentId]: 1|2 } }
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
      if (dbAssigned) { setAssigned(dbAssigned.refs); setSittings(dbAssigned.sittings || {}) }
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
    ({ name, session, prefix: '', nextNum: 1, prefix2: '', nextNum2: 1, date: today, testDate: '', examTime: '', reportTime: '', examCentre: '' })
  // Only sessions matching the search box, plus whichever one is selected so it
  // never vanishes from under the user mid-edit.
  const shownSessions = sessions.filter(s =>
    s.id === sessionFilter || s.session_name.toLowerCase().includes(sessionSearch.trim().toLowerCase()))

  // The documents in the Master Panel's dropdown: the Ph.D set in its order,
  // then any other letter that was added by name.
  const docNames = [...new Set([...PHD_DOCS.map(d => d.name), ...letterNames])]
  const docComplete = (name, entry) => {
    if (!entry) return false
    const has = v => String(v ?? '').trim() !== ''
    return docSpec(name).fields.filter(f => !f.optional).every(f =>
      f.k === 'ref' ? has(entry.prefix) : f.k === 'ref2' ? has(entry.prefix2) : has(entry[f.k]))
  }
  // Every entry, any session, that has everything its document needs.
  const completeRows = letters.filter(l => docComplete(l.name, l))
  const completeSessions = [...new Set(completeRows.map(l => l.session || ''))]
  const shownCompleteRows = completeSession === 'all' ? completeRows : completeRows.filter(l => (l.session || '') === completeSession)
    .sort((x, y) => (sessionName(x.session) || '').localeCompare(sessionName(y.session) || '') || docNames.indexOf(x.name) - docNames.indexOf(y.name))

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
  // `second` claims from the document's second series (prefix2 / nextNum2 —
  // the S.no on the Provisional Certificate and Title of Thesis).
  function refFor(student, letterName, second = false) {
    const letter = entryFor(student.session_id, letterName)
    const key = second ? ref2Key(letterName) : letterName
    const pf = second ? 'prefix2' : 'prefix', nf = second ? 'nextNum2' : 'nextNum'
    const map = assigned[key] || {}
    let num = map[student.id]
    // An already-issued number is shown with whatever series exists — even a
    // missing one — so the admin can still see (and ×-clear) a stale claim.
    if (num != null) return `${letter?.[pf] || ''}${refSerial(num)}`
    // Never mint a number without a configured series. This used to fall back
    // to a blank letter and quietly issue "001" with no prefix — e.g. when
    // Generate was pressed before the shared settings finished loading, or for
    // a session that was never set up. Fail loudly instead of numbering junk.
    // The Hall Ticket prints the application number, not this one — it needs
    // no series, but the number is still claimed so the ticket counts as
    // issued (Print, not Generate) for every admin.
    // A document with no reference series of its own (the Thesis Submission
    // Letter) is the same: claimed only so it counts as issued.
    const needsSeries = second || (letterName !== 'Hall Ticket' && docSpec(letterName).fields.some(f => f.k === 'ref'))
    const noSeries = !letter || !String(letter[pf] || '').trim()
    if (noSeries && needsSeries) {
      alert(`No ${second ? `${letterName} ${docSpec(letterName).ref2Label || 'S.no'}` : letterName} reference series is set up for ${student.academic_sessions?.session_name || 'this student’s session'} yet.\n\nSet its prefix in the Master Panel and press Save, then Generate again. This copy prints with the application number instead.`)
      return null
    }
    // Never hand out a serial another candidate already holds — the panel's
    // Next No. can drift backwards (an edit, or a stale browser overwriting
    // the shared copy), and that once re-issued 010 to a second student.
    // Walk forward past every taken number; persisting num+1 also heals the
    // drifted series.
    const taken = new Set(Object.values(map).map(Number))
    num = Number(letter?.[nf]) || 1
    while (taken.has(num)) num++
    const nextAssigned = { ...assigned, [key]: { ...map, [student.id]: num } }
    const nextLetters = letter ? letters.map(l => l === letter ? { ...l, [nf]: num + 1 } : l) : letters
    setAssigned(nextAssigned); setLetters(nextLetters); persist(nextLetters, nextAssigned)
    // Record the claim so every admin — and the student's own copy — reuses it.
    if (settingsInDb) assignRef(key, student.id, num)
    return `${letter?.[pf] || ''}${refSerial(num)}`
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
    // The Registration Certificate's number is the candidate's Enrollment No.;
    // releasing it would hand the same number to the next candidate.
    if (letterName === 'Enrollment Certificate' && student.enrollment_no) {
      alert(`${student.student_name}'s Registration No. (${student.enrollment_no}) is this certificate's number, so it cannot be withdrawn.`)
      return
    }
    const letter = entryFor(student.session_id, letterName)
    const cur = `${letter?.prefix || ''}${refSerial(assigned[letterName]?.[student.id])}`
    if (!confirm(`Withdraw ${student.student_name}'s ${letterName} (${cur})?\n\nIt disappears from the student portal, and pressing Generate again issues the NEXT number of the current series — not this one.`)) return
    // Always write, never trust the on-screen copy. `rows` is loaded once and
    // never refetched, so a letter another admin published after this page
    // opened still reads as inactive here — gating on that would skip the
    // update, drop the number anyway, and leave the letter live with no record.
    // A missing column means the portal columns were never migrated, so there is
    // nothing published to take down and the withdrawal can go ahead.
    if (field) {
      const { error } = await supabase.from('students').update({ [field]: false }).eq('id', student.id)
      const notMigrated = error && /column|schema cache|PGRST204|42703/i.test(error.message || '')
      if (error && !notMigrated) {
        alert('Could not hide it from the student portal, so nothing was withdrawn:\n\n' + error.message)
        return
      }
      if (!error) setRows(rs => rs.map(r => r.id === student.id ? { ...r, [field]: false } : r))
    }
    const map = { ...(assigned[letterName] || {}) }
    delete map[student.id]
    const nextAssigned = { ...assigned, [letterName]: map }
    // The S.no goes with it, so a fresh issue takes a fresh pair.
    const had2 = assigned[ref2Key(letterName)]?.[student.id] != null
    if (had2) {
      const map2 = { ...assigned[ref2Key(letterName)] }
      delete map2[student.id]
      nextAssigned[ref2Key(letterName)] = map2
    }
    setAssigned(nextAssigned)
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ letters, assigned: nextAssigned }))
    if (settingsInDb) {
      const { error } = await unassignRef(letterName, student.id)
      if (had2) await unassignRef(ref2Key(letterName), student.id)
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
  //
  // A RE-print reuses the sitting already on record rather than asking again.
  // Asking again would let a second, different answer rewrite letter_refs.sitting
  // — moving the exam date on a letter the candidate is already holding, while
  // the button promises the same document back.
  async function issue(student, letterName, generate) {
    const letter = entryFor(student.session_id, letterName) || blankLetter(letterName)
    const alreadyIssued = hasLetter(student, letterName)
    if (!alreadyIssued && payBlocked(student, letterName)) return
    const recorded = sittings[letterName]?.[student.id]
    const sitting = alreadyIssued ? (recorded || 1) : await askSitting(letter)
    if (!sitting) return                       // cancelled
    const opts = docOptsFor(student, letterName, sitting)
    // Only record on a first issue; a re-print must not rewrite what is stored.
    if (!alreadyIssued && settingsInDb && letter.testDate2) {
      await setSitting(letterName, student.id, sitting)
      setSittings(prev => ({ ...prev, [letterName]: { ...(prev[letterName] || {}), [student.id]: sitting } }))
    }
    await generate(opts)
  }

  // The Hall Ticket prints the photo and signature, which live in private
  // storage — swap the stored paths for signed URLs before generating.
  async function hallTicketFor(student) {
    await issue(student, 'Hall Ticket', async (opts) =>
      generateHallTicket(await resolveStudentDocUrls(student), opts))
  }

  // The documents after enrolment (Enrollment Certificate … Compliance
  // Certificate). Same rules as the first three: Payment Condition on a first
  // issue, the number claimed from the student's session series and reused on
  // every re-print. They follow the Enrollment Number, which several print.
  async function issueLater(student, name) {
    if (!student.enrollment_no) return alert(`Generate ${student.student_name}'s Registration Number first — the ${phdDocLabel(name)} follows it.`)
    const alreadyIssued = assigned[name]?.[student.id] != null
    if (!alreadyIssued && payBlocked(student, name)) return
    // Ask for the facts the database does not hold, offering the last answers.
    let saved = {}
    try { saved = JSON.parse(localStorage.getItem(EXTRAS_KEY) || '{}') } catch { /* ignore */ }
    const extra = { ...(saved[student.id] || {}) }
    for (const [k, label] of PHD_DOC_EXTRAS[name] || []) {
      const ans = prompt(`${phdDocLabel(name)} — ${student.student_name}\n\n${label} (leave blank to fill in by hand):`, extra[k] || '')
      if (ans === null) return                 // cancelled
      extra[k] = ans.trim()
    }
    try { localStorage.setItem(EXTRAS_KEY, JSON.stringify({ ...saved, [student.id]: extra })) } catch { /* ignore */ }
    const spec = docSpec(name)
    const opts = docOptsFor(student, name)
    if (!opts.refNo && spec.fields.some(f => f.k === 'ref')) return
    // No series of its own: the letterhead's Ref. No. shows the Enrollment No.
    if (!spec.fields.some(f => f.k === 'ref')) opts.refNo = student.enrollment_no
    if (spec.fields.some(f => f.k === 'ref2')) {
      opts.ref2 = refFor(student, name, true)
      if (!opts.ref2) return
    }
    generatePhdDocument(student, name, { ...opts, extra })
  }

  useEffect(() => { load() }, [])
  useEffect(() => {
    supabase.from('research_payment_rules').select('doc, min_fee').then(({ data, error }) => {
      setPayMissing(!!error)
      setPayRules(Object.fromEntries((data || []).map(r => [r.doc, Number(r.min_fee) || 0])))
    })
  }, [])
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

  // A Ph.D candidate's Enrollment No. IS the Registration (Enrollment)
  // Certificate's Provisional Registration No. — the series set in the Master
  // Panel for the student's session (e.g. SIUPHDPE + 25001), not the
  // programme's enrollment code. Claiming it here also records it against the
  // certificate, so the certificate prints the same number. null (with an
  // alert) when no series is set up for the session.
  const ENROLL_DOC = 'Enrollment Certificate'
  function generateEnrollmentNumber(student) {
    return refFor(student, ENROLL_DOC)
  }

  // All three letters must have an issued reference number before the
  // enrollment number can be generated — that is the Research Dept's rule.
  // Issued = a number is on record. Hall Tickets printed before they were
  // numbered have none, but one that is Visible was plainly issued.
  function hasLetter(s, name) {
    return assigned[name]?.[s.id] != null || (name === 'Hall Ticket' && !!s.hall_ticket_active)
  }
  const lettersDone = (s) => LETTER_NAMES.every(n => hasLetter(s, n))

  // Payment Condition: true (with a message) when the candidate has not yet
  // paid the least fee set for this document.
  function payBlocked(student, doc) {
    const min = Number(payRules?.[doc]) || 0
    const paid = Number(student.fee_collected) || 0
    if (paid >= min) return false
    alert(`${student.student_name} has paid ₹${paid.toLocaleString('en-IN')}.\n\nThe ${phdDocLabel(doc)} needs at least ₹${min.toLocaleString('en-IN')} paid first (Research Dept → Payment Condition).`)
    return true
  }

  // Generate the enrollment number from the Candidates row (once the Hall
  // Ticket, Offer Letter and Entrance Certificate are all issued), and open
  // the candidate's ID card right away — enrollment is what the card needs.
  // Forwarding to the Exam Section stays a separate, fee-gated step.
  async function generateEnrollment(student) {
    if (student.enrollment_no) return
    if (!lettersDone(student)) return
    if (payBlocked(student, 'Enrollment / ID Card')) return
    // The number IS the Registration Certificate's, so its condition applies too.
    if (payBlocked(student, ENROLL_DOC)) return
    if (!confirm(`Generate the Registration Number for ${student.student_name}?\n\nThe ID card will be generated along with it.`)) return
    const enrollNo = generateEnrollmentNumber(student)
    if (!enrollNo) return
    setBusy(`${student.id}-enroll`)
    const { error } = await supabase.from('students')
      .update({ enrollment_no: enrollNo }).eq('id', student.id)
    if (error) {
      alert('Could not save the registration number: ' + error.message)
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
    if (payBlocked(student, 'Forward to Exam')) return
    if (!student.enrollment_no && payBlocked(student, ENROLL_DOC)) return
    if (!confirm(`Forward ${student.student_name} to the Exam Section?\n\nA Registration Number will be generated now.`)) return
    const enrollNo = student.enrollment_no || generateEnrollmentNumber(student)
    if (!enrollNo) return
    setBusy(`${student.id}-exam`)
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
          {mayTab('research_dept', 'master') && <TabBtn id="master" icon={Settings2} label="Master Panel" />}
          {mayTab('research_dept', 'letters') && <TabBtn id="letters" icon={FlaskConical} label="Candidates" count={filtered.length} />}
          {mayTab('research_dept', 'exam') && <TabBtn id="exam" icon={GraduationCap} label="Forward to Exam" count={filtered.filter(s => !s.exam_forwarded_at).length} />}
          {mayTab('research_dept', 'payment') && <TabBtn id="payment" icon={IndianRupee} label="Payment Condition" />}
          {mayTab('research_dept', 'fee') && <TabBtn id="fee" icon={Wallet} label="Fee Entry" />}
        </div>
        {tab !== 'master' && tab !== 'payment' && tab !== 'fee' && (
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
                { header: 'Registration No', value: s => s.enrollment_no || '' },
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
                  header: `${phdDocLabel(name)} Ref`,
                  value: s => {
                    const num = assigned[name]?.[s.id]
                    if (num == null) return ''
                    return `${entryFor(s.session_id, name)?.prefix || ''}${refSerial(num)}`
                  },
                })),
                { header: 'Hall Ticket', value: s => (s.hall_ticket_active ? 'Visible' : 'Hidden') },
                { header: 'Offer Letter', value: s => (s.offer_letter_active ? 'Visible' : 'Hidden') },
                { header: 'Entrance Certificate', value: s => (s.entrance_letter_active ? 'Visible' : 'Hidden') },
                { header: 'Registration No', value: s => s.enrollment_no || '' },
              ]} />
          </div>
        )}
      </div>

      {/* Master panel — per-letter reference series + date */}
      {tab === 'payment' && (payRules == null
        ? <p className="text-center text-gray-400 py-12 text-sm">Loading…</p>
        : <ResearchPaymentConditions docs={PAY_DOCS} rules={payRules} missing={payMissing}
            canEdit={may('research_dept.manage')} onSaved={setPayRules} />)}

      {tab === 'fee' && (payRules == null
        ? <p className="text-center text-gray-400 py-12 text-sm">Loading…</p>
        : <ResearchFeeEntry sessions={sessions} canEdit={may('research_dept.manage')}
            minFee={Math.max(0, ...Object.values(payRules).map(Number).filter(Number.isFinite))} />)}

      {tab === 'master' && (
      <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Settings2 size={16} className="text-[#933d18]" />
            <p className="text-sm font-bold text-gray-900">Master Panel — Ph.D Documents</p>
          </div>
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
            {[['entry', 'Entry'], ['done', `Complete (${completeRows.length})`]].map(([k, label]) => (
              <button key={k} type="button" onClick={() => setMasterTab(k)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${masterTab === k ? 'bg-white text-[#933d18] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {masterTab === 'entry' ? (
          <div className="space-y-4">
            {/* Session and document, then only that document's fields. */}
            <div className="flex items-end gap-3 flex-wrap">
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">Search Session</label>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={sessionSearch} onChange={e => setSessionSearch(e.target.value)} placeholder="Type a session…"
                    className="pl-8 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#933d18]/30 w-40" />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">Session</label>
                <select value={sessionFilter} onChange={e => setSessionFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#933d18]/30 bg-white w-52">
                  <option value="all">All Sessions (fallback)</option>
                  {shownSessions.map(x => <option key={x.id} value={x.id}>{x.session_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">Name of Document</label>
                <select value={docSel} onChange={e => setDocSel(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#933d18]/30 bg-white w-80">
                  {docNames.map(n => <option key={n} value={n}>{phdDocLabel(n)}{docComplete(n, entryFor(editingSession, n)) ? ' ✓' : ''}</option>)}
                </select>
              </div>
              {may('research_dept.manage') && (
                <Button variant="primary" size="md" onClick={saveCfg}>
                  <Save size={14} /> {saved ? 'Saved ✓' : 'Save'}
                </Button>
              )}
            </div>
            <p className="text-[11px] text-gray-500 -mt-2">
              {editingSession
                ? <>Setting up <strong className="text-gray-700">{sessionName(editingSession)}</strong> — <strong className="text-gray-700">{phdDocLabel(docSel)}</strong>.</>
                : <>No session picked — this is the fallback for any session without its own entry.</>}
            </p>

            {(() => {
              const entry = entryFor(editingSession, docSel) || blankLetter(docSel, editingSession)
              const set = patch => updateLetter(docSel, patch)
              const inp = 'w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#933d18]/30 bg-white'
              const req = <span className="text-red-500">*</span>
              const opt = <span className="font-normal text-gray-400"> — optional</span>
              const series = (label, pk, nk, optional) => {
                const bad = endsInDigit(entry[pk])
                return [
                    <div key={pk}>
                      <label className="block text-[11px] font-semibold text-gray-600 mb-1">{label} (prefix) {optional ? opt : req}</label>
                      <input value={entry[pk] || ''} onChange={e => set({ [pk]: e.target.value })} placeholder="SIU/DR/AL/26/"
                        className={`${inp} ${bad || !String(entry[pk] || '').trim() ? 'border-amber-400 bg-amber-50' : ''}`} />
                      {!String(entry[pk] || '').trim() && <p className="text-[10px] text-amber-700 mt-1">No prefix — prints a bare serial</p>}
                      {bad && may('research_dept.manage') && pk === 'prefix' && (
                        <button type="button" onClick={() => { const f = migratePrefix(entry); set({ prefix: f.prefix, nextNum: f.nextNum }) }}
                          className="text-[10px] font-semibold text-[#933d18] underline">
                          Fix → {String(entry.prefix || '').replace(/\d+$/, '')}{refSerial(migratePrefix(entry).nextNum)}
                        </button>
                      )}
                    </div>,
                    <div key={`${nk}-n`}>
                      <label className="block text-[11px] font-semibold text-gray-600 mb-1">Next No.</label>
                      <input type="number" min="0" value={entry[nk] ?? 1} onChange={e => set({ [nk]: e.target.value })} className={inp} />
                    </div>,
                    !docSpec(docSel).noNextRef && <div key={`${nk}-r`}>
                      <label className="block text-[11px] font-semibold text-gray-600 mb-1">Next Reference</label>
                      <p className="px-3 py-2 rounded-xl bg-white border border-dashed border-gray-200 font-mono text-sm font-bold text-[#933d18] truncate">
                        {entry[pk] || ''}{refSerial(entry[nk] ?? 1)}
                      </p>
                    </div>,
                ]
              }
              const spec = docSpec(docSel)
              return (
                <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/40">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-3">Required for {phdDocLabel(docSel)}</p>
                  <div className="grid sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {spec.fields.flatMap(f => {
                      if (f.k === 'ref') return series(spec.refLabel || 'Ref No', 'prefix', 'nextNum', f.optional)
                      if (f.k === 'ref2') return series(spec.ref2Label || 'S.no', 'prefix2', 'nextNum2', f.optional)
                      const isDate = ['date', 'testDate', 'testDate2'].includes(f.k)
                      return (
                        <div key={f.k} className={f.k === 'examCentre' ? 'sm:col-span-2' : ''}>
                          <label className="block text-[11px] font-semibold text-gray-600 mb-1">{f.label} {f.optional ? opt : req}</label>
                          <input type={isDate ? 'date' : 'text'} value={entry[f.k] || ''} onChange={e => set({ [f.k]: e.target.value })}
                            placeholder={f.placeholder || ''} className={inp} />
                        </div>
                      )
                    })}
                  </div>
                  {entry.testDate2 && /hall|entrance/i.test(docSel) && (
                    <p className="text-[11px] text-gray-500 mt-3">Two sittings set — issuing this letter will ask which sitting the candidate gets.</p>
                  )}
                </div>
              )
            })()}

            {/* Finished documents of this session, below the form. */}
            <div>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Completed for {editingSession ? sessionName(editingSession) : 'the fallback'} — {docNames.filter(n => docComplete(n, entryFor(editingSession, n))).length} of {docNames.length}
              </p>
              <div className="flex flex-wrap gap-2">
                {docNames.map(n => {
                  const done = docComplete(n, entryFor(editingSession, n))
                  return (
                    <button key={n} type="button" onClick={() => setDocSel(n)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                        n === docSel ? 'border-[#933d18] text-[#933d18] bg-[#933d18]/5'
                          : done ? 'border-emerald-200 text-emerald-700 bg-emerald-50' : 'border-gray-200 text-gray-500 bg-white hover:border-gray-300'}`}>
                      {done ? '✓ ' : ''}{phdDocLabel(n)}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1">Session</label>
              <select value={completeSession} onChange={e => setCompleteSession(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#933d18]/30 min-w-40">
                <option value="all">All sessions</option>
                {completeSessions.map(s => <option key={s || 'any'} value={s}>{s ? sessionName(s) : 'Any session'}</option>)}
              </select>
            </div>
            <p className="text-xs text-gray-400 pb-2">{shownCompleteRows.length} of {completeRows.length}</p>
          </div>
          <div className="border border-gray-100 rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500 text-left">
                  <th className="font-semibold px-3 py-2">Session</th>
                  <th className="font-semibold px-3 py-2">Document</th>
                  <th className="font-semibold px-3 py-2">Next Number</th>
                  <th className="font-semibold px-3 py-2">Date of Issue</th>
                  <th className="font-semibold px-3 py-2">Details</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {shownCompleteRows.length === 0 && (
                  <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400 text-sm">{completeRows.length === 0 ? 'Nothing complete yet — set documents up in the Entry tab.' : 'Nothing complete for this session.'}</td></tr>
                )}
                {shownCompleteRows.map((l, i) => {
                  const spec = docSpec(l.name)
                  const has = k => spec.fields.some(f => f.k === k)
                  return (
                    <tr key={`${l.session || 'any'}-${l.name}-${i}`} className="border-t border-gray-100">
                      <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{l.session ? sessionName(l.session) : <span className="text-gray-400 italic">Any session</span>}</td>
                      <td className="px-3 py-2 font-semibold text-gray-800">{l.name}</td>
                      <td className="px-3 py-2 font-mono text-xs text-[#933d18] whitespace-nowrap">
                        {has('ref') && <p>{spec.refLabel || 'Ref No'}: {l.prefix}{refSerial(l.nextNum)}</p>}
                        {has('ref2') && <p>{spec.ref2Label || 'S.no'}: {l.prefix2}{refSerial(l.nextNum2 ?? 1)}</p>}
                        {!has('ref') && !has('ref2') && <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{has('date') && l.date ? formatDate(l.date) : '—'}</td>
                      <td className="px-3 py-2 text-xs text-gray-500">
                        {[l.testDate && `Exam/Test: ${formatDate(l.testDate)}`, l.testDate2 && `2nd: ${formatDate(l.testDate2)}`, l.examTime, l.reportTime && `Reporting ${l.reportTime}`, l.examCentre].filter(Boolean).join(' · ') || '—'}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <button type="button" onClick={() => { setSessionFilter(l.session || 'all'); setDocSel(l.name); setMasterTab('entry') }}
                          className="text-xs font-semibold text-[#933d18] hover:underline">Edit</button>
                        {may('research_dept.manage') && (
                          <button type="button" onClick={() => removeLetter(l)} title={`Remove this ${l.name} entry`}
                            className="ml-3 align-middle text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={13} /></button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          </div>
        )}

        {!settingsInDb && (
          <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            These settings are saved in this browser only. Run <span className="font-mono">add_letter_settings.sql</span> in
            Supabase → SQL Editor to share them across all admins.
          </p>
        )}
        {settingsInDb && settingsNeedSeed && (
          <p className="text-[11px] text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
            Press <strong>Save</strong> once to publish these settings to the shared copy.
          </p>
        )}
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
              <Th>Registration / ID Card</Th>
              <Th>Further Documents</Th>
            </Tr>
          </Thead>
          <Tbody>
            {loading ? (
              <Tr><Td colSpan={12} className="text-center text-gray-400 py-8">Loading...</Td></Tr>
            ) : filtered.length === 0 ? (
              <Tr><Td colSpan={12} className="text-center text-gray-400 py-8">No Ph.D candidates forwarded by the Document Dept yet.</Td></Tr>
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
                        {phdDocLabel(name)}: {letter?.prefix}{refSerial(num)}
                      </div>
                    )
                  })}
                </Td>
                <Td className="text-sm">{s.stream || '—'}</Td>
                <Td className="text-sm">{s.programs?.program_name || '—'}</Td>
                <Td className="text-sm">{s.specialization || '—'}</Td>
                <Td className="text-sm">{s.academic_sessions?.session_name || s.academic_year || '—'}</Td>
                <LetterCell student={s} field="hall_ticket_active" busy={busy}
                  issued={hasLetter(s, 'Hall Ticket')}
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
                  ) : may('research_dept.manage') && (
                    <Button size="sm" variant="primary" className="w-fit"
                      disabled={!lettersDone(s) || busy === `${s.id}-enroll`}
                      title={lettersDone(s)
                        ? 'Generate the Registration Number — the ID card opens along with it'
                        : 'Generate the Hall Ticket, Offer Letter and Entrance Certificate first'}
                      onClick={() => generateEnrollment(s)}>
                      <Hash size={13} /> {busy === `${s.id}-enroll` ? '…' : 'Registration'}
                    </Button>
                  )}
                </Td>
                <LaterDocsCell student={s} issuedRef={name => issuedRef(s, name)}
                  onIssue={name => issueLater(s, name)} onWithdraw={name => clearRef(s, name, null)} />
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
              <Th>Registration No</Th>
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
                    ) : may('research_dept.manage') && (
                      <Button size="sm" variant="primary" disabled={!feeCleared || busy === `${s.id}-exam`}
                        title={feeCleared ? 'Forward to Exam Section & generate Registration No' : 'Waiting for Account Dept approval'}
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
  const { may } = useAuth()
  const active = !!student[field]
  const working = busy === `${student.id}-${field}`
  // Only the top row swaps. The Hide/Show toggle stays in BOTH states: it is
  // the only control over `students.*_active`, and that column lives in a
  // different place from the reference number — a letter can be visible to the
  // student with no number against it (no series prefix set yet, or letter_refs
  // not migrated on this machine). Hiding the toggle there left such a letter
  // published with no way to take it down.
  return (
    <Td>
      <div className="flex flex-col gap-1.5">
        {issued ? (
          <>
            {refNo && <p className="text-[10px] font-mono text-gray-400 leading-none">{refNo}</p>}
            <div className="flex items-center gap-1">
              <Button size="sm" variant="secondary" disabled={working} onClick={onGenerate}
                title={`Print ${label} again with the same number`} className="w-fit">
                <Icon size={13} /> Print
              </Button>
              {may('research_dept.manage') && (
              <button onClick={onWithdraw} disabled={working} title={`Withdraw this ${label}`}
                className="inline-flex items-center p-1.5 rounded text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40">
                <Trash2 size={13} />
              </button>
              )}
            </div>
          </>
        ) : may('research_dept.manage') && (
          <Button size="sm" variant="secondary" onClick={onGenerate} title={`Generate ${label}`} className="w-fit">
            <Icon size={13} /> Generate
          </Button>
        )}
        {may('research_dept.manage') && (
        <button onClick={onToggle} disabled={working}
          title={active ? 'Visible — student & center can download' : 'Hidden from student & center'}
          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded w-fit transition-colors ${active ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100' : 'text-gray-500 bg-gray-100 hover:bg-gray-200'}`}>
          {active ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
          {active ? 'Visible' : 'Hidden'}
        </button>
        )}
      </div>
    </Td>
  )
}

// The documents after enrolment, one dropdown per candidate: pick a document,
// then Generate (first issue) or Print (same number again). A tick in the list
// marks the ones already issued.
function LaterDocsCell({ student, issuedRef, onIssue, onWithdraw }) {
  const { may } = useAuth()
  const [doc, setDoc] = useState(LATER_PHD_DOCS[0])
  const ref = issuedRef(doc)
  const issuedCount = LATER_PHD_DOCS.filter(n => issuedRef(n)).length
  if (!student.enrollment_no) {
    return <Td><span className="text-[11px] text-gray-400">After Registration</span></Td>
  }
  return (
    <Td>
      <div className="flex flex-col gap-1.5 min-w-52">
        <select value={doc} onChange={e => setDoc(e.target.value)}
          className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:border-[#933d18]">
          {LATER_PHD_DOCS.map(n => <option key={n} value={n}>{issuedRef(n) ? '✓ ' : ''}{phdDocLabel(n)}</option>)}
        </select>
        {ref && <p className="text-[10px] font-mono text-gray-400 leading-none">{ref}</p>}
        <div className="flex items-center gap-1">
          {(ref || may('research_dept.manage')) && (
            <Button size="sm" variant="secondary" className="w-fit" onClick={() => onIssue(doc)}
              title={ref ? `Print ${doc} again with the same number` : `Generate ${doc}`}>
              <FileText size={13} /> {ref ? 'Print' : 'Generate'}
            </Button>
          )}
          {ref && may('research_dept.manage') && (
            <button onClick={() => onWithdraw(doc)} title={`Withdraw this ${doc}`}
              className="inline-flex items-center p-1.5 rounded text-red-500 hover:bg-red-50 transition-colors">
              <Trash2 size={13} />
            </button>
          )}
        </div>
        <p className="text-[10px] text-gray-400">{issuedCount} of {LATER_PHD_DOCS.length} issued</p>
      </div>
    </Td>
  )
}
