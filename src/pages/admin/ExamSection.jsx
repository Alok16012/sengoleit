import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui/Table'
import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import { Search, ClipboardList, X, Send, Award, FileEdit, BadgeCheck, CalendarClock, Clock, Maximize2, Minimize2, CalendarRange, Users } from 'lucide-react'
import { SearchableSelect, MultiSearchSelect } from '../../components/ui/SearchSelect'
import ExaminationCalendar from './ExaminationCalendar'
import { generateAdmitCard } from '../../utils/generateStudentCards'
import { resolveStudentDocUrls } from '../../utils/resolveStudentDocs'
import { fetchAdmitCardSubjects, fetchSemesterSubjectRows, formatSubjectRow } from '../../utils/fetchSyllabus'
import { fetchExamDates, fetchExamEndDates, examEndDateFor } from '../../utils/examSettings'
import { fetchResultsForMany } from '../../utils/semesterResults'
import MasterMarksEntry from '../../components/MasterMarksEntry'
import { computeSemesterFeeStatus } from '../../utils/courseFee'
import { admitCardsFor, admitCardsForMany, saveAdmitCard, updateAdmitCardSubjects, setAdmitCardVisible, deleteAdmitCard } from '../../utils/semesterAdmitCards'
import { termForSemester } from '../../utils/reRegistration'
import { recordFeeDeduction } from '../../utils/feeLedger'
import { Lock, Eye, EyeOff, Trash2 } from 'lucide-react'
import { formatDate } from '../../utils/formatDate'
import SemesterResultModal from '../../components/SemesterResultModal'

function ResultModal({ isOpen, onClose, student, onSaved }) {
  const [status, setStatus] = useState('Pending')
  const [obtainedMarks, setObtainedMarks] = useState('')
  const [totalMarks, setTotalMarks] = useState('')
  const [marksheetUrl, setMarksheetUrl] = useState('')
  const [remarks, setRemarks] = useState('')
  const [declaredAt, setDeclaredAt] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen && student) {
      setStatus(student.exam_result_status || 'Pending')
      setObtainedMarks(student.exam_result_obtained_marks || '')
      setTotalMarks(student.exam_result_total_marks || '')
      setMarksheetUrl(student.exam_result_marksheet_url || '')
      setRemarks(student.exam_result_remarks || '')
      setDeclaredAt(
        student.exam_result_declared_at
          ? new Date(student.exam_result_declared_at).toISOString().slice(0, 16)
          : new Date().toISOString().slice(0, 16)
      )
    }
  }, [isOpen, student])

  if (!isOpen) return null

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    const updates = {
      exam_result_status: status,
      exam_result_obtained_marks: obtainedMarks || null,
      exam_result_total_marks: totalMarks || null,
      exam_result_marksheet_url: marksheetUrl || null,
      exam_result_remarks: remarks || null,
      exam_result_declared_at: declaredAt ? new Date(declaredAt).toISOString() : null,
    }
    const { error } = await supabase.from('students').update(updates).eq('id', student.id)
    if (error) {
      alert('Error saving result: ' + error.message)
    } else {
      onSaved({ ...student, ...updates })
      onClose()
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50 shrink-0">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Manage Result</h3>
            <p className="text-xs text-gray-500 font-mono mt-1">{student.student_name} ({student.enrollment_no})</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full text-gray-500 transition-colors">
            <X size={18} />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1">
          <form id="result-form" onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Result Status</label>
              <select 
                value={status} onChange={e => setStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#933d18] focus:ring-1 focus:ring-[#933d18] outline-none"
              >
                <option value="Pending">Pending</option>
                <option value="Pass">Pass</option>
                <option value="Fail">Fail</option>
              </select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Obtained Marks</label>
                <input 
                  type="number" step="0.01" value={obtainedMarks} onChange={e => setObtainedMarks(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#933d18] focus:ring-1 focus:ring-[#933d18] outline-none"
                  placeholder="e.g. 450"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Total Marks</label>
                <input 
                  type="number" step="0.01" value={totalMarks} onChange={e => setTotalMarks(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#933d18] focus:ring-1 focus:ring-[#933d18] outline-none"
                  placeholder="e.g. 600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Marksheet File URL</label>
              <input 
                type="url" value={marksheetUrl} onChange={e => setMarksheetUrl(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#933d18] focus:ring-1 focus:ring-[#933d18] outline-none"
                placeholder="https://..."
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Declared At</label>
              <input 
                type="datetime-local" value={declaredAt} onChange={e => setDeclaredAt(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#933d18] focus:ring-1 focus:ring-[#933d18] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Remarks (Optional)</label>
              <textarea 
                rows="2" value={remarks} onChange={e => setRemarks(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#933d18] focus:ring-1 focus:ring-[#933d18] outline-none"
                placeholder="Any additional notes..."
              />
            </div>
          </form>
        </div>
        
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 shrink-0 flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" form="result-form" disabled={saving}>
            {saving ? 'Saving...' : 'Save Result'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// The syllabus lists ALTERNATIVES under one paper number (Paper 2: MS-ACCESS
// or MS-SQL, or B.Ed's Teaching of English / Kannada / Hindi) — a student sits
// one subject per paper, so the picker offers each paper as a group and lets
// exactly one of its subjects be ticked.
//
// Distinct from paperKeyOf in fetchSyllabus.js, which identifies a single
// paper: this deliberately gives every alternative of a paper the SAME key so
// they group together.
const paperGroupKey = (r) => {
  const pno = String(r.paper_no || '').trim().replace(/^paper\s*/i, '')
  return pno || `solo-${r.id}`   // no paper number → a group of its own
}
function paperGroups(rows) {
  const map = new Map()
  for (const r of rows) {
    const key = paperGroupKey(r)
    if (!map.has(key)) map.set(key, { key, label: key.startsWith('solo-') ? '' : `Paper ${key}`, rows: [] })
    map.get(key).rows.push(r)
  }
  return [...map.values()]
}
// First subject of every paper — or, given preferIds (an edit), the first
// SAVED subject of every paper, leaving papers the card never had unticked.
function onePerPaper(rows, preferIds) {
  const selected = new Set(), seen = new Set()
  for (const r of rows) {
    const key = paperGroupKey(r)
    if (seen.has(key)) continue
    if (!preferIds || preferIds.has(r.id)) { selected.add(r.id); seen.add(key) }
  }
  return selected
}

// Format a datetime-local / ISO value for display on screen & the admit card.
function fmtDT(val) {
  if (!val) return ''
  const d = new Date(val)
  if (isNaN(d.getTime())) return val
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function ExamSection() {
  const [view, setView] = useState('list')   // 'list' | 'calendar' | 'result'
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(null)
  const [admitModal, setAdmitModal] = useState(null)   // { student, loading, totalSems, sems }
  // Per-course (program + session) exam settings, keyed `${program_id}__${session_id}`.
  const [courseSettings, setCourseSettings] = useState({})
  const [settingsOpen, setSettingsOpen] = useState(false)
  // Course filters (same as Syllabus): Department / Program Type / Session.
  const [departments, setDepartments] = useState([])
  const [progTypes, setProgTypes] = useState([])
  const [sessions, setSessions] = useState([])
  const [fDept, setFDept] = useState('all')
  const [fType, setFType] = useState('all')
  const [fSession, setFSession] = useState([])   // multi-select; [] = all
  // Which students still need THIS semester's admit card. After a
  // re-registration is verified the student moves into a new term with no card
  // yet, and the list gave no way to tell who was waiting.
  const [admitTab, setAdmitTab] = useState('pending')
  // Issued cards for every listed student, keyed by student id.
  const [admitCards, setAdmitCards] = useState({})
  // Result view: master sheet vs one student at a time, and which students
  // still owe a result.
  const [resultTab, setResultTab] = useState('student')   // 'student' | 'master'
  const [resTab, setResTab] = useState('pending')         // 'awaiting' | 'pending' | 'done' | 'all'
  const [results, setResults] = useState({})              // `${id}__${sem}` -> row
  const [examEnds, setExamEnds] = useState({})            // `${session}:${sem}` -> end date
  const [allPrograms, setAllPrograms] = useState([])
  // Courses that have a syllabus added — the source for the Exam Schedules list.
  const [syllabusCourses, setSyllabusCourses] = useState([])

  useEffect(() => { fetchData(); loadCourseSettings(); loadFilterOptions(); loadSyllabusCourses() }, [])

  const courseKey = (programId, sessionId) => `${programId || ''}__${sessionId || ''}`

  async function loadFilterOptions() {
    const [dp, pt, se] = await Promise.all([
      supabase.from('departments').select('id, name').order('name'),
      supabase.from('programme_types').select('id, programme_type_name').order('programme_type_name'),
      supabase.from('academic_sessions').select('id, session_name').or('status.eq.Active,status.is.null').order('session_name', { ascending: false }),
    ])
    setDepartments(dp.data || [])
    setProgTypes(pt.data || [])
    setSessions(se.data || [])
  }

  // Distinct (program + session) combos that have a syllabus added, each with
  // its subjects (the date sheet is built from these). Resilient to the
  // exam_date column not existing yet.
  async function loadSyllabusCourses() {
    const FULL = 'id, program_id, session_id, semester, paper_no, subject_code, subject_name, exam_date, sort_order'
    const MIN  = 'id, program_id, session_id, semester, paper_no, subject_code, subject_name, sort_order'
    let { data: subjects, error } = await supabase.from('syllabus_subjects').select(FULL)
    if (error) ({ data: subjects } = await supabase.from('syllabus_subjects').select(MIN))
    const [pr, se] = await Promise.all([
      supabase.from('programs').select('id, program_name, department_id, programme_type_id'),
      supabase.from('academic_sessions').select('id, session_name'),
    ])
    const progById = Object.fromEntries((pr.data || []).map(p => [p.id, p]))
    const sessName = Object.fromEntries((se.data || []).map(s => [s.id, s.session_name]))
    const map = new Map()
    for (const r of subjects || []) {
      const key = courseKey(r.program_id, r.session_id)
      if (!map.has(key)) {
        const p = progById[r.program_id] || {}
        map.set(key, {
          key,
          program_id: r.program_id,
          session_id: r.session_id || null,
          department_id: p.department_id || null,
          programme_type_id: p.programme_type_id || null,
          programName: p.program_name || '—',
          sessionName: r.session_id ? (sessName[r.session_id] || '—') : 'All Sessions',
          subjects: [],
        })
      }
      map.get(key).subjects.push(r)
    }
    for (const c of map.values()) {
      c.subjects.sort((a, b) => (Number(a.semester) || 0) - (Number(b.semester) || 0) || (a.sort_order || 0) - (b.sort_order || 0))
    }
    setSyllabusCourses([...map.values()].sort((a, b) => a.programName.localeCompare(b.programName)))
  }

  async function loadCourseSettings() {
    const { data, error } = await supabase
      .from('exam_schedules')
      .select('program_id, session_id, exam_schedule, admit_card_time')
    if (error) { console.error('exam_schedules load error:', error); return }
    const map = {}
    for (const r of data || []) {
      map[courseKey(r.program_id, r.session_id)] = { exam_schedule: r.exam_schedule || '', admit_card_time: r.admit_card_time || '' }
    }
    setCourseSettings(map)
  }

  // Upsert one or more per-course rows: [{ program_id, session_id, exam_schedule, admit_card_time }]
  async function saveCourseSettings(rows) {
    const now = new Date().toISOString()
    const payload = rows.map(r => ({
      program_id: r.program_id,
      session_id: r.session_id || null,
      exam_schedule: r.exam_schedule || null,
      admit_card_time: r.admit_card_time || null,
      updated_at: now,
    }))
    const { error } = await supabase.from('exam_schedules').upsert(payload, { onConflict: 'program_id,session_id' })
    if (error) { alert('Could not save exam schedules: ' + error.message); return false }
    await loadCourseSettings()
    return true
  }

  async function fetchData() {
    setLoading(true)
    // Only students the Account Dept. forwarded to the Exam Section appear here.
    const FULL = 'id, student_name, mobile_no, gender, enrollment_no, registration_no, admission_number, semester_year, specialization, fee_collected, coupon_discount, programme_id, session_id, exam_forwarded_at, admit_card_released_at, exam_result_status, exam_result_obtained_marks, exam_result_total_marks, exam_result_marksheet_url, exam_result_declared_at, exam_result_remarks, result_released_at, programs(program_name, department_id, programme_type_id, duration, semester_year), academic_sessions(session_name), centers(id, center_name, center_code)'
    // Middle tier: everything except result_released_at, which needs
    // add_phd_portal_flow.sql. Without this tier a missing release column would
    // knock the whole result block down to MIN and hide declared results.
    const NO_RELEASE = FULL.replace(', result_released_at', '')
    // Minimal fallback used when the exam-result / admit-card columns have not
    // been created yet (run_all_migrations.sql not applied). The forwarded
    // students still appear; only the result/release features stay inactive.
    const MIN = 'id, student_name, mobile_no, gender, enrollment_no, registration_no, admission_number, semester_year, specialization, fee_collected, coupon_discount, programme_id, session_id, exam_forwarded_at, programs(program_name, department_id, programme_type_id, duration, semester_year), academic_sessions(session_name), centers(id, center_name, center_code)'

    let { data, error } = await supabase
      .from('students')
      .select(FULL)
      .not('exam_forwarded_at', 'is', null)
      .order('exam_forwarded_at', { ascending: false })

    if (error) {
      console.error('ExamSection fetch error (full select), retrying without result_released_at:', error)
      ;({ data, error } = await supabase
        .from('students')
        .select(NO_RELEASE)
        .not('exam_forwarded_at', 'is', null)
        .order('exam_forwarded_at', { ascending: false }))
      if (error) {
        console.error('ExamSection fetch error, retrying minimal:', error)
        ;({ data, error } = await supabase
          .from('students')
          .select(MIN)
          .not('exam_forwarded_at', 'is', null)
          .order('exam_forwarded_at', { ascending: false }))
        if (error) console.error('ExamSection fetch error (minimal select):', error)
      }
    }
    setData(data || [])
    // null = add_semester_admit_cards.sql not run; every student then counts as
    // pending, which is the safer way round for a queue.
    setAdmitCards(await admitCardsForMany((data || []).map(s => s.id)) || {})
    setResults(await fetchResultsForMany((data || []).map(s => s.id)) || {})
    setExamEnds(await fetchExamEndDates((data || []).map(s => s.session_id)))
    const { data: progs } = await supabase.from('programs').select('id, program_name, duration, semester_year')
    setAllPrograms(progs || [])
    setLoading(false)
  }

  const [releasing, setReleasing] = useState(null)
  const [resultModalStudent, setResultModalStudent] = useState(null)

  // Open the per-semester admit-card picker — computes which semesters' fee is
  // cleared (fee_collected covers the cumulative fee up to that semester).
  async function openAdmitModal(student) {
    setAdmitModal({ student, loading: true, sems: [] })
    const [status, issued] = await Promise.all([
      computeSemesterFeeStatus({
        programme_id: student.programme_id,
        session_id: student.session_id,
        duration: student.programs?.duration,
        fee_collected: student.fee_collected,
        coupon_discount: student.coupon_discount,
      }),
      admitCardsFor(student.id),
    ])
    // issued === null means add_semester_admit_cards.sql hasn't been run — the
    // picker then behaves exactly as it did before.
    setAdmitModal({ student, loading: false, ...status, issued: issued || {}, issuedMissing: issued === null })
  }

  // Take the part of a semester's fee that is still outstanding out of the
  // centre's wallet. Admission and re-registration each collect only half the
  // fee, so a semester is always short when its admit card comes due; this is
  // where the rest is finally collected. The money moves BEFORE the student row
  // is credited — a failed wallet write must not look like a payment.
  async function collectShortfall(student, sem, shortfall) {
    const centerId = student.centers?.id
    if (!centerId) return { error: { message: 'No centre is on record for this student, so the fee cannot be collected.' } }

    const { data: ctr, error: cErr } = await supabase
      .from('centers').select('virtual_balance').eq('id', centerId).maybeSingle()
    if (cErr) return { error: cErr }
    const balance = Number(ctr?.virtual_balance || 0)
    if (balance < shortfall) {
      return { error: { message:
        `The centre's wallet has ₹${balance.toLocaleString('en-IN')} — ₹${shortfall.toLocaleString('en-IN')} is needed.\n\n` +
        `Ask the centre to recharge before issuing this admit card.` } }
    }
    const { error: wErr } = await supabase.from('centers')
      .update({ virtual_balance: balance - shortfall }).eq('id', centerId)
    if (wErr) return { error: wErr }

    // Re-read rather than trusting the list row, which may be minutes stale.
    const { data: st } = await supabase
      .from('students').select('fee_collected').eq('id', student.id).maybeSingle()
    const collected = Number(st?.fee_collected || 0) + shortfall
    const { error: sErr } = await supabase.from('students')
      .update({ fee_collected: collected }).eq('id', student.id)
    if (sErr) {
      return { error: { message:
        `₹${shortfall.toLocaleString('en-IN')} was taken from the centre's wallet but could not be recorded against the student:\n\n` +
        sErr.message + '\n\nPlease correct this before issuing the card.' } }
    }
    // Itemise it — this collection used to leave no trace anywhere but the
    // student's running total, so the Payment Summary could not explain it.
    await recordFeeDeduction({
      studentId: student.id,
      centerId,
      amount: shortfall,
      kind: 'exam_balance',
      term: `Semester ${sem}`,
      note: 'Semester balance collected by the Exam Section',
    })
    return { collected }
  }

  // Collect a semester's outstanding fee, then reopen the picker so the
  // semester shows as cleared and its papers can be selected.
  async function collectAndReopen(student, sem, shortfall) {
    if (!confirm(
      `Collect ₹${shortfall.toLocaleString('en-IN')} for Semester ${sem} from ${student.centers?.center_name || 'the centre'}'s wallet?\n\n` +
      `This is the part of the semester's fee that has not been paid yet. The admit card can be issued once it is collected.`
    )) return
    setBusy(`${student.id}-collect-${sem}`)
    const { error, collected } = await collectShortfall(student, sem, shortfall)
    setBusy(null)
    if (error) { alert(error.message); return }
    // Keep the list in step so reopening the picker doesn't re-read a stale fee.
    setData(rows => rows.map(r => (r.id === student.id ? { ...r, fee_collected: collected } : r)))
    await openAdmitModal({ ...student, fee_collected: collected })
  }

  // Re-read the issued cards after any change, keeping the modal open so the
  // admin sees the semester's new state instead of being thrown out.
  async function refreshIssued(student) {
    const issued = await admitCardsFor(student.id)
    setAdmitModal(m => m && { ...m, issued: issued || {}, pick: undefined })
    // Keep the row behind the modal in step, so issuing a card moves the
    // student out of the Pending tab without a page reload.
    setAdmitCards(prev => ({
      ...prev,
      [student.id]: Object.values(issued || {}).sort((a, b) => a.semester - b.semester),
    }))
  }

  // Step 2: after picking a fee-cleared semester, load its papers so the admin
  // can choose which ones appear on the admit card — one subject per paper,
  // the first of each pre-ticked.
  async function chooseSem(student, sem) {
    setAdmitModal(m => m && { ...m, pick: { sem, loading: true, rows: [], selected: new Set() } })
    const rows = await fetchSemesterSubjectRows(student, sem)
    setAdmitModal(m => m && { ...m, pick: { sem, loading: false, rows, selected: onePerPaper(rows) } })
  }

  // Edit an issued card: the same paper picker, but pre-ticked with the papers
  // the card was issued with, and saving keeps the card's visibility as it is.
  // A card issued with no saved papers ("as per curriculum") starts all-ticked,
  // since there is no saved selection to restore.
  async function editAdmitCard(student, sem, savedIds) {
    setAdmitModal(m => m && { ...m, pick: { sem, editing: true, loading: true, rows: [], selected: new Set() } })
    const rows = await fetchSemesterSubjectRows(student, sem)
    const saved = new Set(savedIds || [])
    // Cards issued before the one-per-paper rule may carry several subjects of
    // the same paper — keep the first saved one of each, same rule as a click.
    const selected = saved.size ? onePerPaper(rows, saved) : onePerPaper(rows)
    setAdmitModal(m => m && { ...m, pick: { sem, editing: true, loading: false, rows, selected } })
  }
  // Radio-like within a paper: ticking a subject unticks its alternatives.
  // Ticking the already-ticked one clears the paper (it stays off the card).
  const toggleSubject = (id) => setAdmitModal(m => {
    if (!m?.pick) return m
    const selected = new Set(m.pick.selected)
    if (selected.has(id)) {
      selected.delete(id)
    } else {
      const row = m.pick.rows.find(r => r.id === id)
      const key = row ? paperGroupKey(row) : null
      m.pick.rows.forEach(r => { if (paperGroupKey(r) === key) selected.delete(r.id) })
      selected.add(id)
    }
    return { ...m, pick: { ...m.pick, selected } }
  })

  // Admit card is generated ONLY here — for a specific semester, using the
  // papers the admin selected. `edit` re-issues an existing card with new
  // papers, which must not touch its visibility the way a fresh issue does.
  async function handleAdmitCard(student, sem, rows, selected, { record = true, edit = false } = {}) {
    setBusy(`${student.id}-${sem}`)
    const { data: s } = await supabase
      .from('students')
      .select('*, programs(program_name), academic_sessions(session_name), centers(id, center_name, center_code), departments(name), study_modes(mode_name)')
      .eq('id', student.id)
      .single()
    if (s) {
      const resolved = await resolveStudentDocUrls(s)
      const subjects = (rows && selected)
        ? rows.filter(r => selected.has(r.id)).map(formatSubjectRow).filter(Boolean)
        : await fetchAdmitCardSubjects(s, sem)
      const cs = settingsOf(student)
      const dates = await fetchExamDates(resolved, sem)
      generateAdmitCard(resolved, subjects, {
        examSchedule: fmtDT(cs.exam_schedule),
        admitCardTime: fmtDT(cs.admit_card_time),
        admitCardAt: cs.admit_card_time || '',   // raw value drives the date gate
        semester: sem,
        ...dates,
      })
    }
    // Remember that this semester's card was issued, and which papers were on
    // it, so it can be re-printed, hidden or withdrawn later. A re-print passes
    // record:false so it does not reset when the card was first issued.
    if (record) {
      const ids = (rows && selected) ? rows.filter(r => selected.has(r.id)).map(r => r.id) : []
      const { error } = edit
        ? await updateAdmitCardSubjects(student.id, sem, ids)
        : await saveAdmitCard(student.id, sem, ids)
      if (error) {
        alert('The admit card printed, but it could not be recorded:\n\n' + error.message +
              '\n\nRun add_semester_admit_cards.sql in Supabase.')
      } else if (!edit) {
        // Issuing Semester N's card means the student IS in term N — its fee
        // was collected in full to get here. Recording that keeps the centre's
        // Re-Registration flow honest: without it the student's term stayed
        // behind, the centre was still offered a re-registration into a term
        // whose fee the Exam Section had already collected, and approving it
        // would have looked like the term was still unpaid. Only ever forward.
        const t = termForSemester(student, sem)
        const cur = parseInt(String(student.semester_year || ''), 10) || 1
        if (t.n > cur) {
          const { error: tErr } = await supabase.from('students')
            .update({ semester_year: t.label }).eq('id', student.id)
          if (!tErr) {
            setData(rowsPrev => rowsPrev.map(r => (r.id === student.id ? { ...r, semester_year: t.label } : r)))
            setAdmitModal(m => m && { ...m, student: { ...m.student, semester_year: t.label } })
          }
        }
      }
    }
    setBusy(null)
    await refreshIssued(student)
  }

  // Re-print an issued card with exactly the papers it carried.
  async function reprintAdmitCard(student, sem, savedIds) {
    setBusy(`${student.id}-${sem}`)
    const rows = await fetchSemesterSubjectRows(student, sem)
    await handleAdmitCard(student, sem, rows, new Set(savedIds || []), { record: false })
  }

  async function toggleAdmitVisible(student, sem, visible) {
    const { error } = await setAdmitCardVisible(student.id, sem, visible)
    if (error) { alert('Could not change visibility: ' + error.message); return }
    await refreshIssued(student)
  }

  async function withdrawAdmitCard(student, sem) {
    if (!confirm(`Withdraw Semester ${sem}'s admit card for ${student.student_name}?\n\nIt disappears from the student portal and the semester goes back to "Select Papers".`)) return
    const { error } = await deleteAdmitCard(student.id, sem)
    if (error) { alert('Could not withdraw: ' + error.message); return }
    await refreshIssued(student)
  }

  // Send Result — publishes a declared result to the student portal. Until this
  // is pressed the result stays internal, mirroring the admit-card release.
  async function handleSendResult(student) {
    if (!confirm(`Send ${student.student_name}'s result to the student portal?`)) return
    setReleasing(student.id)
    const now = new Date().toISOString()
    const { error } = await supabase.from('students')
      .update({ result_released_at: now }).eq('id', student.id)
    if (error) {
      alert('Could not send result: ' + error.message + '\n\nRun add_phd_portal_flow.sql in Supabase first.')
    } else {
      setData(prev => prev.map(s => s.id === student.id ? { ...s, result_released_at: now } : s))
    }
    setReleasing(null)
  }

  async function handleReleaseAdmitCard(studentId) {
    if (!confirm('Are you sure you want to release the admit card to the student portal?')) return
    
    setReleasing(studentId)
    const { error } = await supabase
      .from('students')
      .update({ admit_card_released_at: new Date().toISOString() })
      .eq('id', studentId)
      
    if (error) {
      alert('Error releasing admit card: ' + error.message)
    } else {
      setData(prev => prev.map(s => s.id === studentId ? { ...s, admit_card_released_at: new Date().toISOString() } : s))
    }
    setReleasing(null)
  }

  // Resolve a student's course settings: prefer the session-specific row, else
  // fall back to the program-wide ("All Sessions") row — mirrors how syllabus
  // is keyed (session_id can be null = all sessions).
  const settingsOf = s =>
    courseSettings[courseKey(s.programme_id, s.session_id)] ||
    courseSettings[courseKey(s.programme_id, null)] || {}

  // Per-student admit-card lock, driven by that student's course Admit Card Time.
  const admitCardTimeOf = s => settingsOf(s).admit_card_time || ''
  const isAdmitLocked = s => {
    const t = admitCardTimeOf(s)
    if (!t) return false
    const d = new Date(t)
    return !isNaN(d.getTime()) && Date.now() < d.getTime()
  }

  // The semester a student is IN — what the Exam Section owes them a card for.
  // A Year-based term covers two semesters, so its closing one is the current.
  const currentSemOf = (s) => {
    const n = Math.max(parseInt(String(s.semester_year || ''), 10) || 1, 1)
    const isYear = /year/i.test(String(s.semester_year || s.programs?.semester_year || ''))
    const total = Number(s.programs?.duration) || 0
    return total ? Math.min(isYear ? n * 2 : n, total) : (isYear ? n * 2 : n)
  }
  // Has THIS semester's card been issued? Cards for earlier semesters do not
  // count — the whole point is to spot who is waiting after a re-registration.
  const currentCardDone = (s) =>
    (admitCards?.[s.id] || []).some(c => Number(c.semester) === currentSemOf(s))

  // Department / type / session / search, but NOT the admit-card tab — the tab
  // counts are taken from this, so they stay put as the tab is switched.
  const byFilters = data.filter(s => {
    if (fDept !== 'all' && s.programs?.department_id !== fDept) return false
    if (fType !== 'all' && s.programs?.programme_type_id !== fType) return false
    if (fSession.length > 0 && (!s.session_id || !fSession.includes(s.session_id))) return false
    const haystack = [
      s.student_name, s.enrollment_no, s.registration_no, s.mobile_no,
      s.programs?.program_name, s.academic_sessions?.session_name,
      s.centers?.center_name, s.centers?.center_code,
    ].filter(Boolean).join(' ').toLowerCase()
    return haystack.includes(search.toLowerCase())
  })

  const filtered = byFilters.filter(s =>
    admitTab === 'pending' ? !currentCardDone(s)
      : admitTab === 'done' ? currentCardDone(s)
        : true)

  // Where a student stands on THIS semester's result:
  //   done     — declared (Pass / Fail)
  //   awaiting — the semester's exams have not finished yet, so nothing is due
  //   pending  — exams over (or no date set) and no result entered
  const resultStateOf = (s) => {
    const r = results[`${s.id}__${currentSemOf(s)}`]
    if (r && r.status && r.status !== 'Pending') return 'done'
    const end = examEndDateFor(s, examEnds)
    if (end && new Date(end) > new Date()) return 'awaiting'
    return 'pending'
  }
  const resultList = byFilters.filter(s => resTab === 'all' || resultStateOf(s) === resTab)

  const filterActive = !!search || fDept !== 'all' || fType !== 'all' || fSession.length > 0
  const clearFilters = () => { setSearch(''); setFDept('all'); setFType('all'); setFSession([]) }

  return (
    <div className="p-6">
      <PageHeader
        title="Exam Section"
        subtitle={
          view === 'calendar' ? 'Set examination start & end dates per session and semester' :
          view === 'result' ? `${filtered.length} student${filtered.length === 1 ? '' : 's'} — declare or edit results` :
          `${data.length} student${data.length === 1 ? '' : 's'} forwarded for examination`
        }
      />

      {/* Sections of the Exam Section, so it's clear what exists and where you
          are — these used to be buttons that navigated away from the list. */}
      <div className="flex items-center gap-1 flex-wrap bg-gray-100 p-1 rounded-xl w-fit mb-5">
        {[
          { key: 'list', label: 'Student List', icon: Users },
          { key: 'schedule', label: 'Date Sheet', icon: CalendarClock },
          { key: 'calendar', label: 'Examination Calendar', icon: CalendarRange },
          { key: 'result', label: 'Result', icon: Award },
        ].map(t => {
          const Icon = t.icon
          const active = t.key === 'schedule' ? settingsOpen : (!settingsOpen && view === t.key)
          return (
            <button key={t.key} type="button"
              onClick={() => { if (t.key === 'schedule') { setSettingsOpen(true) } else { setSettingsOpen(false); setView(t.key) } }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                active ? 'bg-white text-[#933d18] shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'
              }`}>
              <Icon size={14} /> {t.label}
            </button>
          )
        })}
      </div>

      {view === 'calendar' && <ExaminationCalendar />}

      {view === 'list' && (<>
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
        <SearchableSelect label="Department" allLabel="All Departments" minWidth={180}
          value={fDept} onChange={setFDept}
          options={departments.map(d => ({ id: d.id, label: d.name }))} />
        <SearchableSelect label="Program Type" allLabel="All Types" minWidth={150}
          value={fType} onChange={setFType}
          options={progTypes.map(t => ({ id: t.id, label: t.programme_type_name }))} />
        <MultiSearchSelect label="Session" allLabel="All Sessions" minWidth={160}
          values={fSession} onChange={setFSession}
          options={sessions.map(se => ({ id: se.id, label: se.session_name }))} />
        {filterActive && (
          <button onClick={clearFilters}
            className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-semibold text-[#933d18] bg-[#933d18]/8 hover:bg-[#933d18]/15 rounded-xl transition-colors">
            <X size={14} /> Clear
          </button>
        )}
      </div>

      {/* Whose CURRENT semester still has no admit card — the queue a verified
          re-registration lands a student in. Counts come from byFilters, so
          switching tabs never changes what they say. */}
      <div className="flex gap-2 mb-4">
        {[
          { key: 'pending', label: 'Admit Card Pending', on: 'bg-amber-500 text-white',   off: 'bg-amber-50 text-amber-700' },
          { key: 'done',    label: 'Issued',             on: 'bg-emerald-500 text-white', off: 'bg-emerald-50 text-emerald-700' },
          { key: 'all',     label: 'All',                on: 'bg-gray-700 text-white',    off: 'bg-gray-100 text-gray-600' },
        ].map(t => {
          const count = t.key === 'all' ? byFilters.length
            : byFilters.filter(s => (t.key === 'done' ? currentCardDone(s) : !currentCardDone(s))).length
          return (
            <button key={t.key} onClick={() => setAdmitTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${admitTab === t.key ? t.on : t.off}`}>
              {t.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${admitTab === t.key ? 'bg-white/25' : 'bg-white/70'}`}>{count}</span>
            </button>
          )
        })}
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
              <Th>Registration / Application No</Th>
              <Th>Forwarded On</Th>
              <Th>Admit Card</Th>
              <Th>Result</Th>
            </tr>
          </Thead>
          <Tbody>
            {filtered.length === 0 ? (
              <Tr><Td colSpan={10} className="text-center text-gray-400 py-12">
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
                <Td className="font-mono text-xs text-[#933d18] font-bold">{s.registration_no || s.admission_number || '—'}</Td>
                <Td className="text-gray-400 text-xs">{formatDate(s.exam_forwarded_at)}</Td>
                <Td>
                  <div className="flex flex-col gap-2">
                    {s.admit_card_released_at ? (
                      <div className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded w-fit">
                        <BadgeCheck size={12} /> Released
                      </div>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => handleReleaseAdmitCard(s.id)} disabled={releasing === s.id} title="Release to Student Portal" className="w-fit text-[#933d18] bg-[#933d18]/5 hover:bg-[#933d18]/10">
                        <Send size={14} className={releasing === s.id ? 'animate-pulse' : ''} />
                        <span className="text-xs ml-1">Send to Student</span>
                      </Button>
                    )}
                    {(() => {
                      const locked = isAdmitLocked(s)
                      const sem = currentSemOf(s)
                      const done = currentCardDone(s)
                      return (
                        <>
                          {/* Which semester is owed, and whether it is done —
                              without this the button says "Generate" whether
                              the student needs a card or already has one. */}
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded w-fit ${
                            done ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                          }`}>
                            Sem {sem} · {done ? 'issued' : 'pending'}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openAdmitModal(s)}
                            disabled={locked}
                            title={locked ? `Locked until ${fmtDT(admitCardTimeOf(s))}` : `Generate the Semester ${sem} admit card`}
                            className="w-fit"
                          >
                            <ClipboardList size={14} className={locked ? 'text-gray-400' : 'text-amber-600'} />
                            <span className={`text-xs ml-1 ${locked ? 'text-gray-400' : 'text-amber-600'}`}>{locked ? 'Locked' : 'Generate'}</span>
                          </Button>
                        </>
                      )
                    })()}
                  </div>
                </Td>
                {/* Results are entered per semester — the same semesters the
                    admit card is issued for. */}
                <Td>
                  <Button size="sm" variant="outline" onClick={() => setResultModalStudent(s)}>
                    <Award size={13} /> Results
                  </Button>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
      </>)}

      {view === 'result' && (<>
      {/* Master sheet for a whole course, or one student at a time. */}
      <div className="flex items-center gap-1 flex-wrap bg-gray-100 p-1 rounded-xl w-fit mb-4">
        {[
          { key: 'student', label: 'Student Entry',  icon: Users },
          { key: 'master',  label: 'Master Entry',   icon: ClipboardList },
          // Same list; what changes is the band the marks auto-fill within.
          { key: 'special', label: 'Special Result', icon: Award },
        ].map(t => {
          const Icon = t.icon
          return (
            <button key={t.key} type="button" onClick={() => setResultTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                resultTab === t.key ? 'bg-white text-[#933d18] shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'
              }`}>
              <Icon size={14} /> {t.label}
            </button>
          )
        })}
      </div>

      {resultTab === 'master' ? (
        <MasterMarksEntry students={data} programs={allPrograms} />
      ) : (<>
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
        <SearchableSelect label="Department" allLabel="All Departments" minWidth={180}
          value={fDept} onChange={setFDept}
          options={departments.map(d => ({ id: d.id, label: d.name }))} />
        <SearchableSelect label="Program Type" allLabel="All Types" minWidth={150}
          value={fType} onChange={setFType}
          options={progTypes.map(t => ({ id: t.id, label: t.programme_type_name }))} />
        <MultiSearchSelect label="Session" allLabel="All Sessions" minWidth={160}
          values={fSession} onChange={setFSession}
          options={sessions.map(se => ({ id: se.id, label: se.session_name }))} />
        {filterActive && (
          <button onClick={clearFilters}
            className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-semibold text-[#933d18] bg-[#933d18]/8 hover:bg-[#933d18]/15 rounded-xl transition-colors">
            <X size={14} /> Clear
          </button>
        )}
      </div>

      {/* Awaiting = the semester's exams are not over, so no result is due yet;
          Pending = they are over and none is entered; Done = declared. */}
      <div className="flex gap-2 mb-4">
        {[
          { key: 'pending',  label: 'Pending',  on: 'bg-amber-500 text-white',   off: 'bg-amber-50 text-amber-700' },
          { key: 'awaiting', label: 'Awaiting', on: 'bg-blue-500 text-white',    off: 'bg-blue-50 text-blue-700' },
          { key: 'done',     label: 'Done',     on: 'bg-emerald-500 text-white', off: 'bg-emerald-50 text-emerald-700' },
          { key: 'all',      label: 'All',      on: 'bg-gray-700 text-white',    off: 'bg-gray-100 text-gray-600' },
        ].map(t => {
          const count = t.key === 'all' ? byFilters.length : byFilters.filter(s => resultStateOf(s) === t.key).length
          return (
            <button key={t.key} onClick={() => setResTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${resTab === t.key ? t.on : t.off}`}>
              {t.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${resTab === t.key ? 'bg-white/25' : 'bg-white/70'}`}>{count}</span>
            </button>
          )
        })}
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
              <Th>Enrollment No</Th>
              <Th>Registration / Application No</Th>
              <Th>Status</Th>
              <Th>Result</Th>
            </tr>
          </Thead>
          <Tbody>
            {resultList.length === 0 ? (
              <Tr><Td colSpan={8} className="text-center text-gray-400 py-12">
                {search ? 'No students match your search.' : 'No students here.'}
              </Td></Tr>
            ) : resultList.map((s, i) => (
              <Tr key={s.id}>
                <Td className="text-gray-400 text-xs w-10">{i + 1}</Td>
                <Td>
                  <p className="font-semibold text-gray-900">{s.student_name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{s.gender} • {s.mobile_no || '—'}</p>
                </Td>
                <Td className="text-gray-500 text-xs min-w-[160px] whitespace-normal break-words">{s.programs?.program_name || '—'}</Td>
                <Td className="text-gray-500 text-xs">{s.academic_sessions?.session_name || '—'}</Td>
                <Td className="font-mono text-xs font-bold text-emerald-700">{s.enrollment_no || '—'}</Td>
                <Td className="font-mono text-xs text-[#933d18] font-bold">{s.registration_no || s.admission_number || '—'}</Td>
                {/* Which semester the result is owed for, and where it stands. */}
                <Td>
                  {(() => {
                    const st = resultStateOf(s)
                    const style = st === 'done' ? 'bg-emerald-50 text-emerald-700'
                      : st === 'awaiting' ? 'bg-blue-50 text-blue-700'
                        : 'bg-amber-50 text-amber-700'
                    const end = examEndDateFor(s, examEnds)
                    return (
                      <span className={`text-[10px] font-bold px-2 py-1 rounded whitespace-nowrap ${style}`}
                        title={st === 'awaiting' && end ? `Examinations end ${formatDate(end)}` : ''}>
                        Sem {currentSemOf(s)} · {st === 'done' ? 'declared' : st}
                      </span>
                    )
                  })()}
                </Td>
                {/* Results are entered per semester — the same semesters the
                    admit card is issued for. */}
                <Td>
                  <Button size="sm" variant="outline" onClick={() => setResultModalStudent(s)}>
                    <Award size={13} /> Results
                  </Button>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
      </>)}
      </>)}

      {resultModalStudent && (
        <SemesterResultModal
          student={resultModalStudent}
          special={resultTab === 'special'}
          onClose={() => setResultModalStudent(null)}
        />
      )}

      {admitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setAdmitModal(null)}>
          <div className={`bg-white rounded-2xl shadow-xl w-full ${admitModal.pick ? 'max-w-6xl max-h-[96vh]' : 'max-w-md max-h-[85vh]'} overflow-hidden flex flex-col`} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="font-black text-gray-900">Generate Admit Card</h3>
                <p className="text-xs text-gray-400 mt-0.5">{admitModal.student.student_name} · {admitModal.pick ? `Semester ${admitModal.pick.sem} — ${admitModal.pick.editing ? 'edit papers' : 'select papers'}` : 'pick a semester'}</p>
              </div>
              <button onClick={() => setAdmitModal(null)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="p-5 overflow-y-auto">
              {admitModal.loading ? (
                <p className="text-center text-gray-400 py-8 text-sm">Loading…</p>
              ) : admitModal.pick ? (
                /* Step 2 — choose papers for the selected semester */
                admitModal.pick.loading ? (
                  <p className="text-center text-gray-400 py-8 text-sm">Loading papers…</p>
                ) : (
                  <>
                    <button onClick={() => setAdmitModal(m => m && { ...m, pick: null })} className="text-xs font-semibold text-gray-500 hover:text-[#933d18] mb-3">← Back to semesters</button>
                    {/* Who this card is for — saves cross-checking the row behind the modal. */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-gray-50 rounded-xl px-5 py-4 mb-4">
                      <div>
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Student</p>
                        <p className="text-sm font-bold text-gray-800 truncate" title={admitModal.student.student_name}>{admitModal.student.student_name}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Course</p>
                        <p className="text-sm font-bold text-gray-800 truncate">{admitModal.student.programs?.program_name || '—'}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Specialization</p>
                        <p className="text-sm font-bold text-gray-800 truncate">{admitModal.student.specialization || '—'}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Session</p>
                        <p className="text-sm font-bold text-gray-800 truncate">{admitModal.student.academic_sessions?.session_name || '—'}</p>
                      </div>
                    </div>
                    {!admitModal.pick.rows.length ? (
                      <p className="text-[12px] text-gray-500 mb-4">No papers found in the syllabus for Semester {admitModal.pick.sem}. The admit card will print “as per university curriculum”.</p>
                    ) : (
                      <div className="mb-4">
                        <div className="flex items-center justify-between text-[11px] text-gray-400 mb-2">
                          <span>One subject per paper goes on the card</span>
                          <span>{admitModal.pick.selected.size}/{paperGroups(admitModal.pick.rows).length} papers selected</span>
                        </div>
                        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-[68vh] overflow-y-auto pr-1">
                          {paperGroups(admitModal.pick.rows).map(g => (
                            <div key={g.key} className="rounded-xl border border-gray-100 p-3">
                              {g.label && <p className="text-[11px] font-black text-[#933d18] uppercase tracking-wide px-1 pb-1.5">{g.label}</p>}
                              <div className="space-y-1.5">
                                {g.rows.map(r => (
                                  <label key={r.id} className={`flex items-start gap-2 rounded-lg px-2.5 py-2 cursor-pointer ${admitModal.pick.selected.has(r.id) ? 'bg-[#933d18]/5' : 'hover:bg-gray-50'}`}>
                                    <input type="checkbox" checked={admitModal.pick.selected.has(r.id)} onChange={() => toggleSubject(r.id)} className="mt-0.5 accent-[#933d18]" />
                                    <span className="text-[13px] text-gray-800">
                                      {g.label
                                        ? `${r.subject_code ? r.subject_code + ' ' : ''}${r.subject_name || 'Untitled paper'}`
                                        : (formatSubjectRow(r) || 'Untitled paper')}
                                    </span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <Button variant="primary" className="w-full justify-center"
                      disabled={busy === `${admitModal.student.id}-${admitModal.pick.sem}` || (admitModal.pick.rows.length > 0 && admitModal.pick.selected.size === 0)}
                      onClick={() => handleAdmitCard(admitModal.student, admitModal.pick.sem, admitModal.pick.rows, admitModal.pick.selected, { edit: !!admitModal.pick.editing })}>
                      <ClipboardList size={14} /> {busy === `${admitModal.student.id}-${admitModal.pick.sem}` ? '…' : admitModal.pick.editing ? 'Save & Print Admit Card' : 'Generate Admit Card'}
                    </Button>
                  </>
                )
              ) : !admitModal.sems?.length ? (
                <p className="text-center text-gray-400 py-8 text-sm">No fee structure found for this course.</p>
              ) : (
                <>
                  {admitModal.issuedMissing && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-800 mb-3">
                      Run <span className="font-mono">add_semester_admit_cards.sql</span> in Supabase to keep a record of each semester's admit card.
                    </div>
                  )}
                  <p className="text-[11px] text-gray-400 mb-3">Fee collected: <span className="font-bold text-gray-700">₹{Number(admitModal.collected).toLocaleString('en-IN')}</span>. A semester's card needs its Re-Registration done and its fee collected in full.</p>
                  <div className="space-y-2">
                    {admitModal.sems.map(({ sem, dueFee, cleared }) => {
                      const card = admitModal.issued?.[sem]
                      const visible = !!card?.released_at
                      const shortfall = Math.max(Number(dueFee) - Number(admitModal.collected), 0)
                      // The student's term decides how far the Exam Section may
                      // go: a semester beyond it needs its Re-Registration
                      // (centre raises → university approves) BEFORE anything
                      // here — Collect must not become a way to skip that. The
                      // recorded term covers two semesters for a Year course.
                      const curTermN = parseInt(String(admitModal.student.semester_year || ''), 10) || 1
                      const registeredUpTo = /year/i.test(String(admitModal.student.semester_year || admitModal.student.programs?.semester_year || '')) ? curTermN * 2 : curTermN
                      const needsReReg = sem > registeredUpTo && !card
                      return (
                      <div key={sem} className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5 ${cleared ? 'border-gray-200' : 'border-gray-100 bg-gray-50'}`}>
                        <div className="min-w-0">
                          <p className={`text-sm font-bold ${cleared ? 'text-gray-900' : 'text-gray-400'}`}>Semester {sem}</p>
                          {card ? (
                            <p className="text-[11px] text-gray-400">
                              Issued {formatDate(card.generated_at)} ·{' '}
                              <span className={visible ? 'text-emerald-600 font-semibold' : 'text-gray-400 font-semibold'}>
                                {visible ? 'active — student can see it' : 'deactive — student cannot see it'}
                              </span>
                              {/* Cards issued before the fee gate was corrected
                                  carry a debt — say so instead of hiding it. */}
                              {shortfall > 0 && <> · <span className="font-semibold text-amber-700">₹{shortfall.toLocaleString('en-IN')} still due</span></>}
                            </p>
                          ) : (
                            // Naming the shortfall answers the centre's "but we
                            // already paid ₹X" without opening Fee Management.
                            <p className="text-[11px] text-gray-400">
                              Fee upto: ₹{Number(dueFee).toLocaleString('en-IN')}
                              {shortfall > 0 && <> · <span className="font-semibold text-amber-700">₹{shortfall.toLocaleString('en-IN')} still due</span></>}
                            </p>
                          )}
                        </div>
                        {card ? (
                          // Already issued — re-print it, deactivate it so the
                          // student stops seeing it, or withdraw it. These stay
                          // available even while the fee is short: the card is
                          // already with the student, and locking the controls
                          // would leave no way to pull it back.
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Button size="sm" variant="secondary" disabled={busy === `${admitModal.student.id}-${sem}`}
                              title="Print this card again with the same papers"
                              onClick={() => reprintAdmitCard(admitModal.student, sem, card.subject_ids)}>
                              <ClipboardList size={13} /> {busy === `${admitModal.student.id}-${sem}` ? '…' : 'Print'}
                            </Button>
                            <Button size="sm" variant="secondary"
                              title="Change the papers on this card and re-issue it"
                              onClick={() => editAdmitCard(admitModal.student, sem, card.subject_ids)}>
                              <FileEdit size={13} /> Edit
                            </Button>
                            <Button size="sm" variant="secondary"
                              title={visible
                                ? 'Deactivate — the student stops seeing this card'
                                : 'Activate — the student sees this card'}
                              className={visible ? 'text-emerald-700' : 'text-gray-500'}
                              onClick={() => toggleAdmitVisible(admitModal.student, sem, !visible)}>
                              {visible ? <><Eye size={13} /> Active</> : <><EyeOff size={13} /> Deactive</>}
                            </Button>
                            <Button size="sm" variant="danger" title="Withdraw this admit card"
                              onClick={() => withdrawAdmitCard(admitModal.student, sem)}>
                              <Trash2 size={13} />
                            </Button>
                          </div>
                        ) : needsReReg ? (
                          // Not registered this far yet — the centre must raise
                          // the Re-Registration and the university approve it
                          // first. No Collect here: money for an unregistered
                          // term belongs to that flow, not this one.
                          <span className="flex items-center gap-1 text-[11px] font-semibold text-gray-400 shrink-0"
                            title="The centre raises the Re-Registration and the university approves it; this semester unlocks here after that.">
                            <Lock size={12} /> Re-Registration required
                          </span>
                        ) : !cleared ? (
                          // The rest of a REGISTERED semester's fee is collected
                          // here rather than leaving it locked with nowhere to
                          // pay. Deliberately a separate step from issuing the
                          // card, so money never moves on an unrelated click.
                          <Button size="sm" variant="secondary" className="shrink-0"
                            disabled={busy === `${admitModal.student.id}-collect-${sem}`}
                            title={`Take the outstanding ₹${shortfall.toLocaleString('en-IN')} from the centre's wallet`}
                            onClick={() => collectAndReopen(admitModal.student, sem, shortfall)}>
                            <Lock size={13} />
                            {busy === `${admitModal.student.id}-collect-${sem}` ? '…' : `Collect ₹${shortfall.toLocaleString('en-IN')}`}
                          </Button>
                        ) : (
                          <Button size="sm" variant="primary" onClick={() => chooseSem(admitModal.student, sem)}>
                            <ClipboardList size={13} /> Select Papers
                          </Button>
                        )}
                      </div>
                    )})}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {settingsOpen && (
        <ExamSchedulesModal
          courses={syllabusCourses}
          settings={courseSettings}
          departments={departments}
          progTypes={progTypes}
          sessions={sessions}
          onSave={saveCourseSettings}
          reloadCourses={loadSyllabusCourses}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  )
}

function ExamSchedulesModal({ courses, settings, departments = [], progTypes = [], sessions = [], onSave, reloadCourses, onClose }) {
  // Admit Card Time per course (keyed by course key).
  const [admitForm, setAdmitForm] = useState(() => {
    const init = {}
    for (const c of courses) init[c.key] = settings[c.key]?.admit_card_time || ''
    return init
  })
  // Per-subject exam date (the date sheet), keyed by subject id.
  const [dateForm, setDateForm] = useState(() => {
    const init = {}
    for (const c of courses) for (const s of (c.subjects || [])) init[s.id] = s.exam_date || ''
    return init
  })
  const [expanded, setExpanded] = useState(null)   // expanded course key
  const [openSems, setOpenSems] = useState({})     // { `${ckey}__${sem}`: bool } — which semester accordions are open
  const toggleSem = (k) => setOpenSems(p => ({ ...p, [k]: !p[k] }))
  const [maximized, setMaximized] = useState(false)
  const [saving, setSaving] = useState(false)

  const [q, setQ] = useState('')
  const [fDept, setFDept] = useState('all')
  const [fType, setFType] = useState('all')
  const [fSession, setFSession] = useState([])
  const [tab, setTab] = useState('all')            // 'all' | 'pending' | 'done'
  const filterActive = !!q || fDept !== 'all' || fType !== 'all' || fSession.length > 0
  const clearFilters = () => { setQ(''); setFDept('all'); setFType('all'); setFSession([]) }

  // Group a course's subjects by semester for the date sheet.
  const groupBySem = (subs) => {
    const m = {}
    for (const s of subs || []) { const k = s.semester || '—'; (m[k] ||= []).push(s) }
    return Object.entries(m).sort((a, b) => (Number(a[0]) || 0) - (Number(b[0]) || 0))
  }
  // Within a semester, group subjects by Paper No (one exam date per paper).
  const groupByPaper = (subs) => {
    const m = new Map()
    for (const s of subs || []) {
      const k = s.paper_no || '—'
      if (!m.has(k)) m.set(k, [])
      m.get(k).push(s)
    }
    return [...m.entries()]
  }

  // A course is "Done" when its Admit Card Time is set AND every paper has an exam date.
  const isDone = (c) => {
    if (!admitForm[c.key]) return false
    const papers = groupBySem(c.subjects).flatMap(([, subs]) => groupByPaper(subs))
    if (papers.length === 0) return false
    return papers.every(([, ps]) => !!dateForm[ps[0].id])
  }

  // Dept / Type / Session / search filters (status tab applied after).
  const base = courses.filter(c => {
    if (fDept !== 'all' && c.department_id !== fDept) return false
    if (fType !== 'all' && c.programme_type_id !== fType) return false
    if (fSession.length > 0 && (!c.session_id || !fSession.includes(c.session_id))) return false
    return `${c.programName} ${c.sessionName}`.toLowerCase().includes(q.toLowerCase())
  })
  const pendingCount = base.filter(c => !isDone(c)).length
  const doneCount = base.filter(isDone).length
  const visible = base.filter(c => tab === 'all' ? true : tab === 'done' ? isDone(c) : !isDone(c))

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    // 1) Admit Card Time per course (exam_schedules).
    const rows = courses.map(c => ({
      program_id: c.program_id,
      session_id: c.session_id,
      exam_schedule: '',
      admit_card_time: admitForm[c.key] || '',
    }))
    const ok = await onSave(rows)
    if (!ok) { setSaving(false); return }
    // 2) Per-subject exam dates (only changed ones).
    const updates = []
    for (const c of courses) for (const s of (c.subjects || [])) {
      const v = dateForm[s.id] || ''
      if ((s.exam_date || '') !== v) updates.push({ id: s.id, exam_date: v || null })
    }
    for (const u of updates) {
      await supabase.from('syllabus_subjects').update({ exam_date: u.exam_date }).eq('id', u.id)
    }
    if (reloadCourses) await reloadCourses()
    setSaving(false)
    onClose()
  }

  // Set one date across every subject of a paper.
  const setPaperDate = (paperSubs, value) =>
    setDateForm(f => { const next = { ...f }; for (const s of paperSubs) next[s.id] = value; return next })

  return (
    <div className={`fixed inset-0 z-50 flex bg-black/50 backdrop-blur-sm overflow-y-auto ${maximized ? 'p-0' : 'items-start justify-center p-4 sm:p-6 pt-6 sm:pt-10'}`} onClick={onClose}>
      <div className={`bg-gray-50 shadow-2xl w-full overflow-hidden ${maximized ? 'min-h-screen rounded-none max-w-none' : 'rounded-3xl max-w-6xl'}`} onClick={e => e.stopPropagation()}>
        {/* Header — brand gradient band */}
        <div className="relative px-8 py-6 bg-gradient-to-br from-[#933d18] via-[#a8451c] to-[#7a3215] sticky top-0 z-10">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center shrink-0 ring-1 ring-white/25">
                <CalendarClock size={26} className="text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-white leading-tight tracking-tight">Exam Schedules</h3>
                <p className="text-[13px] text-white/75 mt-1 max-w-2xl leading-snug">Set a fixed exam date per subject (semester-wise date sheet) and the Admit Card Time per course. Both print on the Admit Card.</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button type="button" onClick={() => setMaximized(m => !m)} title={maximized ? 'Exit full screen' : 'Full screen'}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white/70 hover:text-white hover:bg-white/15 transition-colors">
                {maximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              </button>
              <button onClick={onClose} className="w-10 h-10 rounded-xl flex items-center justify-center text-white/70 hover:text-white hover:bg-white/15 transition-colors"><X size={20} /></button>
            </div>
          </div>
        </div>
        <form onSubmit={handleSave}>
          {/* Filter bar */}
          {courses.length > 0 && (
            <div className="px-7 pt-5 pb-1 flex flex-wrap gap-3 items-end bg-white">
              <div className="relative flex-1 min-w-[220px]">
                <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1.5">Search</label>
                <Search size={15} className="absolute left-3.5 top-[38px] -translate-y-1/2 text-gray-400" />
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by program or session..."
                  className="w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:border-[#933d18] focus:ring-2 focus:ring-[#933d18]/15 transition-colors" />
              </div>
              <SearchableSelect label="Department" allLabel="All Departments" minWidth={170}
                value={fDept} onChange={setFDept}
                options={departments.map(d => ({ id: d.id, label: d.name }))} />
              <SearchableSelect label="Program Type" allLabel="All Types" minWidth={140}
                value={fType} onChange={setFType}
                options={progTypes.map(t => ({ id: t.id, label: t.programme_type_name }))} />
              <MultiSearchSelect label="Session" allLabel="All Sessions" minWidth={150}
                values={fSession} onChange={setFSession}
                options={sessions.map(se => ({ id: se.id, label: se.session_name }))} />
              {filterActive && (
                <button type="button" onClick={clearFilters}
                  className="flex items-center gap-1.5 px-3.5 py-3 text-sm font-semibold text-[#933d18] bg-[#933d18]/8 hover:bg-[#933d18]/15 rounded-xl transition-colors">
                  <X size={14} /> Clear
                </button>
              )}
            </div>
          )}
          {/* Status tabs */}
          {courses.length > 0 && (
            <div className="px-7 pt-4 flex items-center gap-2 bg-white">
              {[
                { key: 'pending', label: 'Pending', count: pendingCount, on: 'bg-amber-500 text-white', off: 'bg-amber-50 text-amber-700 hover:bg-amber-100' },
                { key: 'done',    label: 'Done',    count: doneCount,    on: 'bg-emerald-600 text-white', off: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
                { key: 'all',     label: 'All',     count: base.length,  on: 'bg-gray-800 text-white', off: 'bg-gray-100 text-gray-600 hover:bg-gray-200' },
              ].map(t => (
                <button key={t.key} type="button" onClick={() => setTab(t.key)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${tab === t.key ? t.on : t.off}`}>
                  {t.label}
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === t.key ? 'bg-white/25' : 'bg-white/70'}`}>{t.count}</span>
                </button>
              ))}
            </div>
          )}
          {/* List */}
          <div className={`overflow-y-auto px-7 py-6 space-y-4 ${maximized ? 'max-h-[calc(100vh-280px)]' : 'max-h-[72vh]'}`}>
            {courses.length === 0 ? (
              <p className="py-14 text-center text-sm text-gray-400">No courses with a syllabus yet. Add a syllabus first (Syllabus page) — only courses that have a syllabus appear here.</p>
            ) : visible.length === 0 ? (
              <p className="py-14 text-center text-sm text-gray-400">
                {tab === 'pending' ? 'No pending courses — every course has its date sheet set. 🎉'
                  : tab === 'done' ? 'No course is fully set yet. Add admit time + exam dates.'
                  : 'No courses match your search.'}
              </p>
            ) : visible.map(c => {
              const open = expanded === c.key
              return (
                <div key={c.key} className={`bg-white rounded-2xl border-2 transition-all ${open ? 'border-[#933d18]/30 shadow-lg' : 'border-gray-100 hover:border-gray-200 hover:shadow-md'}`}>
                  <div className="flex flex-wrap items-center justify-between gap-5 p-6">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#933d18] to-[#a8451c] flex items-center justify-center shrink-0 shadow-sm">
                        <span className="text-lg font-black text-white">{c.programName?.[0]?.toUpperCase() || 'C'}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-black text-gray-900 text-base truncate">{c.programName}</p>
                          {isDone(c)
                            ? <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Done</span>
                            : <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">Pending</span>}
                        </div>
                        <span className="inline-block mt-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#933d18]/8 text-[#933d18]">{c.sessionName}</span>
                      </div>
                    </div>
                    <div className="w-full sm:w-72 bg-gray-50 rounded-2xl p-3.5 border border-gray-100">
                      <label className="text-[11px] font-bold uppercase tracking-wide text-gray-500 mb-1.5 flex items-center gap-1.5"><Clock size={12} className="text-[#933d18]" /> Admit Card Time</label>
                      <input type="datetime-local" value={admitForm[c.key] || ''} onChange={e => setAdmitForm(f => ({ ...f, [c.key]: e.target.value }))}
                        className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:border-[#933d18] focus:ring-2 focus:ring-[#933d18]/15 transition-colors" />
                    </div>
                  </div>

                  <div className="px-5 pb-5">
                    <button type="button" onClick={() => setExpanded(open ? null : c.key)}
                      className={`inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl transition-colors ${open ? 'text-white bg-[#933d18] hover:bg-[#7a3215]' : 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100'}`}>
                      <CalendarClock size={14} /> Date Sheet ({(c.subjects || []).length} subjects) {open ? '▲' : '▼'}
                    </button>

                    {open && (
                      <div className="mt-4 space-y-4">
                        {groupBySem(c.subjects).map(([sem, subs]) => {
                          const semKey = `${c.key}__${sem}`
                          const semOpen = !!openSems[semKey]
                          const filled = groupByPaper(subs).filter(([, ps]) => !!dateForm[ps[0].id]).length
                          const totalPapers = groupByPaper(subs).length
                          return (
                          <div key={sem} className="border border-gray-200 rounded-2xl overflow-hidden">
                            <button type="button" onClick={() => toggleSem(semKey)}
                              className="w-full px-5 py-3 bg-[#933d18]/5 hover:bg-[#933d18]/10 border-b border-gray-100 flex items-center gap-2 transition-colors text-left">
                              <span className="text-sm font-black text-[#933d18]">Semester {sem}</span>
                              <span className="text-[11px] font-semibold text-gray-400">· {totalPapers} papers</span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${filled === totalPapers && totalPapers > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{filled}/{totalPapers} dated</span>
                              <span className="ml-auto text-[#933d18] text-xs">{semOpen ? '▲' : '▼'}</span>
                            </button>
                            {semOpen && (
                            <div className="divide-y divide-gray-100">
                              {groupByPaper(subs).map(([paper, paperSubs]) => (
                                <div key={paper} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50/80 transition-colors">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-[#933d18]">{/^paper/i.test(String(paper)) ? paper : `Paper ${paper}`}{paperSubs.length > 1 ? ` · ${paperSubs.length} options (any one)` : ''}</p>
                                    {paperSubs.map(s => (
                                      <p key={s.id} className="text-xs text-gray-600 truncate mt-0.5">
                                        {s.subject_code ? <span className="font-mono text-gray-400">{s.subject_code}</span> : null} {s.subject_name || '—'}
                                      </p>
                                    ))}
                                  </div>
                                  <div className="shrink-0">
                                    <label className="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Exam Date</label>
                                    <input type="date" value={dateForm[paperSubs[0].id] || ''} onChange={e => setPaperDate(paperSubs, e.target.value)}
                                      className="w-44 px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:border-[#933d18] focus:ring-2 focus:ring-[#933d18]/15 transition-colors" />
                                  </div>
                                </div>
                              ))}
                            </div>
                            )}
                          </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          {/* Footer */}
          <div className="flex justify-end gap-2.5 px-7 py-4 border-t border-gray-100 bg-white">
            <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving || courses.length === 0}>{saving ? 'Saving...' : 'Save All'}</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
