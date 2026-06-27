import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui/Table'
import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import { Search, ClipboardList, X, Send, Award, FileEdit, BadgeCheck, CalendarClock, Clock } from 'lucide-react'
import { SearchableSelect, MultiSearchSelect } from '../../components/ui/SearchSelect'
import { generateAdmitCard } from '../../utils/generateStudentCards'
import { resolveStudentDocUrls } from '../../utils/resolveStudentDocs'
import { fetchAdmitCardSubjects } from '../../utils/fetchSyllabus'
import { formatDate } from '../../utils/formatDate'

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

// Format a datetime-local / ISO value for display on screen & the admit card.
function fmtDT(val) {
  if (!val) return ''
  const d = new Date(val)
  if (isNaN(d.getTime())) return val
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function ExamSection() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(null)
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
  // Courses that have a syllabus added — the source for the Exam Schedules list.
  const [syllabusCourses, setSyllabusCourses] = useState([])

  useEffect(() => { fetchData(); loadCourseSettings(); loadFilterOptions(); loadSyllabusCourses() }, [])

  const courseKey = (programId, sessionId) => `${programId || ''}__${sessionId || ''}`

  async function loadFilterOptions() {
    const [dp, pt, se] = await Promise.all([
      supabase.from('departments').select('id, name').order('name'),
      supabase.from('programme_types').select('id, programme_type_name').order('programme_type_name'),
      supabase.from('academic_sessions').select('id, session_name').order('session_name', { ascending: false }),
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
    const FULL = 'id, student_name, mobile_no, gender, enrollment_no, registration_no, semester_year, programme_id, session_id, exam_forwarded_at, admit_card_released_at, exam_result_status, exam_result_obtained_marks, exam_result_total_marks, exam_result_marksheet_url, exam_result_declared_at, exam_result_remarks, programs(program_name, department_id, programme_type_id), academic_sessions(session_name), centers(center_name, center_code)'
    // Minimal fallback used when the exam-result / admit-card columns have not
    // been created yet (run_all_migrations.sql not applied). The forwarded
    // students still appear; only the result/release features stay inactive.
    const MIN = 'id, student_name, mobile_no, gender, enrollment_no, registration_no, semester_year, programme_id, session_id, exam_forwarded_at, programs(program_name, department_id, programme_type_id), academic_sessions(session_name), centers(center_name, center_code)'

    let { data, error } = await supabase
      .from('students')
      .select(FULL)
      .not('exam_forwarded_at', 'is', null)
      .order('exam_forwarded_at', { ascending: false })

    if (error) {
      console.error('ExamSection fetch error (full select), retrying minimal:', error)
      ;({ data, error } = await supabase
        .from('students')
        .select(MIN)
        .not('exam_forwarded_at', 'is', null)
        .order('exam_forwarded_at', { ascending: false }))
      if (error) console.error('ExamSection fetch error (minimal select):', error)
    }
    setData(data || [])
    setLoading(false)
  }

  const [releasing, setReleasing] = useState(null)
  const [resultModalStudent, setResultModalStudent] = useState(null)

  // Admit card is generated ONLY here — the single point in the workflow.
  async function handleAdmitCard(student) {
    setBusy(student.id)
    const { data: s } = await supabase
      .from('students')
      .select('*, programs(program_name), academic_sessions(session_name), centers(center_name, center_code), departments(name), study_modes(mode_name)')
      .eq('id', student.id)
      .single()
    if (s) {
      const resolved = await resolveStudentDocUrls(s)
      const subjects = await fetchAdmitCardSubjects(s)
      const cs = settingsOf(student)
      generateAdmitCard(resolved, subjects, {
        examSchedule: fmtDT(cs.exam_schedule),
        admitCardTime: fmtDT(cs.admit_card_time),
        admitCardAt: cs.admit_card_time || '',   // raw value drives the date gate
      })
    }
    setBusy(null)
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

  const filtered = data.filter(s => {
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

  const filterActive = !!search || fDept !== 'all' || fType !== 'all' || fSession.length > 0
  const clearFilters = () => { setSearch(''); setFDept('all'); setFType('all'); setFSession([]) }

  return (
    <div className="p-6">
      <PageHeader
        title="Exam Section"
        subtitle={`${data.length} student${data.length === 1 ? '' : 's'} forwarded for examination`}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSettingsOpen(true)}
              title="Set per-course Exam Schedule"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-sm transition-colors"
            >
              <CalendarClock size={16} /> Exam Schedule
            </button>
            <button
              onClick={() => setSettingsOpen(true)}
              title="Set per-course Admit Card Time"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#933d18]/30 bg-[#933d18]/10 hover:bg-[#933d18]/20 text-[#933d18] font-bold text-sm transition-colors"
            >
              <Clock size={16} /> Admit Card Time
            </button>
          </div>
        }
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
              <Th>Result</Th>
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
                      return (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleAdmitCard(s)}
                          disabled={busy === s.id || locked}
                          title={locked ? `Locked until ${fmtDT(admitCardTimeOf(s))}` : 'Generate PDF Admit Card'}
                          className="w-fit"
                        >
                          <ClipboardList size={14} className={busy === s.id ? 'animate-pulse text-amber-600' : locked ? 'text-gray-400' : 'text-amber-600'} />
                          <span className={`text-xs ml-1 ${locked ? 'text-gray-400' : 'text-amber-600'}`}>{busy === s.id ? '...' : locked ? 'Locked' : 'Generate'}</span>
                        </Button>
                      )
                    })()}
                  </div>
                </Td>
                <Td>
                  {s.exam_result_status && s.exam_result_status !== 'Pending' ? (
                    <div className="flex flex-col gap-2">
                      <div className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded w-fit ${s.exam_result_status === 'Pass' ? 'text-emerald-700 bg-emerald-50' : 'text-red-700 bg-red-50'}`}>
                        <Award size={12} /> {s.exam_result_status} ({s.exam_result_obtained_marks}/{s.exam_result_total_marks})
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => setResultModalStudent(s)} className="w-fit">
                        <FileEdit size={14} className="text-blue-600" />
                        <span className="text-xs ml-1 text-blue-600">Edit</span>
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setResultModalStudent(s)}>
                      Enter Result
                    </Button>
                  )}
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
      
      <ResultModal
        isOpen={!!resultModalStudent}
        onClose={() => setResultModalStudent(null)}
        student={resultModalStudent}
        onSaved={(updatedStudent) => {
          setData(prev => prev.map(s => s.id === updatedStudent.id ? updatedStudent : s))
        }}
      />

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
  const [saving, setSaving] = useState(false)

  const [q, setQ] = useState('')
  const [fDept, setFDept] = useState('all')
  const [fType, setFType] = useState('all')
  const [fSession, setFSession] = useState([])
  const filterActive = !!q || fDept !== 'all' || fType !== 'all' || fSession.length > 0
  const clearFilters = () => { setQ(''); setFDept('all'); setFType('all'); setFSession([]) }
  const visible = courses.filter(c => {
    if (fDept !== 'all' && c.department_id !== fDept) return false
    if (fType !== 'all' && c.programme_type_id !== fType) return false
    if (fSession.length > 0 && (!c.session_id || !fSession.includes(c.session_id))) return false
    return `${c.programName} ${c.sessionName}`.toLowerCase().includes(q.toLowerCase())
  })

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

  // Group a course's subjects by semester for the date sheet.
  const groupBySem = (subs) => {
    const m = {}
    for (const s of subs || []) { const k = s.semester || '—'; (m[k] ||= []).push(s) }
    return Object.entries(m).sort((a, b) => (Number(a[0]) || 0) - (Number(b[0]) || 0))
  }
  // Within a semester, group subjects by Paper No (one exam date per paper —
  // all subjects of a paper, e.g. electives, share the same slot).
  const groupByPaper = (subs) => {
    const m = new Map()
    for (const s of subs || []) {
      const k = s.paper_no || '—'
      if (!m.has(k)) m.set(k, [])
      m.get(k).push(s)
    }
    return [...m.entries()]
  }
  // Set one date across every subject of a paper.
  const setPaperDate = (paperSubs, value) =>
    setDateForm(f => { const next = { ...f }; for (const s of paperSubs) next[s.id] = value; return next })

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm p-4 sm:p-6 pt-6 sm:pt-10 overflow-y-auto" onClick={onClose}>
      <div className="bg-gray-50 rounded-3xl shadow-2xl w-full max-w-6xl overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-7 py-5 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#933d18]/10 flex items-center justify-center shrink-0">
              <CalendarClock size={20} className="text-[#933d18]" />
            </div>
            <div>
              <h3 className="text-lg font-black text-gray-900 leading-tight">Exam Schedules</h3>
              <p className="text-xs text-gray-400 mt-0.5 max-w-2xl">Set a fixed exam date per subject (semester-wise date sheet, from the syllabus) and the Admit Card Time per course. Both print on the Admit Card.</p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0"><X size={18} /></button>
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
          {/* List */}
          <div className="max-h-[72vh] overflow-y-auto px-7 py-6 space-y-4">
            {courses.length === 0 ? (
              <p className="py-14 text-center text-sm text-gray-400">No courses with a syllabus yet. Add a syllabus first (Syllabus page) — only courses that have a syllabus appear here.</p>
            ) : visible.length === 0 ? (
              <p className="py-14 text-center text-sm text-gray-400">No courses match your search.</p>
            ) : visible.map(c => {
              const open = expanded === c.key
              return (
                <div key={c.key} className={`bg-white rounded-2xl border transition-all ${open ? 'border-[#933d18]/30 shadow-md' : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'}`}>
                  <div className="flex flex-wrap items-center justify-between gap-4 p-5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-[#933d18]/8 flex items-center justify-center shrink-0">
                        <span className="text-base font-black text-[#933d18]">{c.programName?.[0]?.toUpperCase() || 'C'}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 text-[15px] truncate">{c.programName}</p>
                        <span className="inline-block mt-0.5 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#933d18]/8 text-[#933d18]">{c.sessionName}</span>
                      </div>
                    </div>
                    <div className="w-full sm:w-64">
                      <label className="text-[11px] font-bold text-gray-500 mb-1.5 flex items-center gap-1.5"><Clock size={12} className="text-[#933d18]" /> Admit Card Time</label>
                      <input type="datetime-local" value={admitForm[c.key] || ''} onChange={e => setAdmitForm(f => ({ ...f, [c.key]: e.target.value }))}
                        className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:border-[#933d18] focus:ring-2 focus:ring-[#933d18]/15 transition-colors" />
                    </div>
                  </div>

                  <div className="px-5 pb-5">
                    <button type="button" onClick={() => setExpanded(open ? null : c.key)}
                      className={`inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl transition-colors ${open ? 'text-white bg-[#933d18] hover:bg-[#7a3215]' : 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100'}`}>
                      <CalendarClock size={14} /> Date Sheet ({(c.subjects || []).length} subjects) {open ? '▲' : '▼'}
                    </button>

                    {open && (
                      <div className="mt-4 space-y-4">
                        {groupBySem(c.subjects).map(([sem, subs]) => (
                          <div key={sem} className="border border-gray-200 rounded-2xl overflow-hidden">
                            <div className="px-5 py-3 bg-[#933d18]/5 border-b border-gray-100 flex items-center gap-2">
                              <span className="text-sm font-black text-[#933d18]">Semester {sem}</span>
                              <span className="text-[11px] font-semibold text-gray-400">· {groupByPaper(subs).length} papers</span>
                            </div>
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
                          </div>
                        ))}
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
