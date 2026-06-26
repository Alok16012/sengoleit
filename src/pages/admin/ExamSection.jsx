import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui/Table'
import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import { Search, ClipboardList, X, Send, Award, FileEdit, BadgeCheck, CalendarClock, Clock } from 'lucide-react'
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
  // Section-wide settings printed on every Admit Card.
  const [examSchedule, setExamSchedule] = useState('')
  const [admitCardTime, setAdmitCardTime] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => { fetchData(); loadSettings() }, [])

  async function loadSettings() {
    const { data, error } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['exam_schedule', 'admit_card_time'])
    if (error) { console.error('app_settings load error:', error); return }
    const map = Object.fromEntries((data || []).map(r => [r.key, r.value]))
    setExamSchedule(map.exam_schedule || '')
    setAdmitCardTime(map.admit_card_time || '')
  }

  async function saveSettings(sched, admit) {
    const now = new Date().toISOString()
    const { error } = await supabase.from('app_settings').upsert([
      { key: 'exam_schedule',   value: sched || null, updated_at: now },
      { key: 'admit_card_time', value: admit || null, updated_at: now },
    ], { onConflict: 'key' })
    if (error) { alert('Could not save settings: ' + error.message); return false }
    setExamSchedule(sched)
    setAdmitCardTime(admit)
    return true
  }

  async function fetchData() {
    setLoading(true)
    // Only students the Account Dept. forwarded to the Exam Section appear here.
    const FULL = 'id, student_name, mobile_no, gender, enrollment_no, registration_no, semester_year, exam_forwarded_at, admit_card_released_at, exam_result_status, exam_result_obtained_marks, exam_result_total_marks, exam_result_marksheet_url, exam_result_declared_at, exam_result_remarks, programs(program_name), academic_sessions(session_name), centers(center_name, center_code)'
    // Minimal fallback used when the exam-result / admit-card columns have not
    // been created yet (run_all_migrations.sql not applied). The forwarded
    // students still appear; only the result/release features stay inactive.
    const MIN = 'id, student_name, mobile_no, gender, enrollment_no, registration_no, semester_year, exam_forwarded_at, programs(program_name), academic_sessions(session_name), centers(center_name, center_code)'

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
  async function handleAdmitCard(studentId) {
    setBusy(studentId)
    const { data: s } = await supabase
      .from('students')
      .select('*, programs(program_name), academic_sessions(session_name), centers(center_name, center_code), departments(name), study_modes(mode_name)')
      .eq('id', studentId)
      .single()
    if (s) {
      const resolved = await resolveStudentDocUrls(s)
      const subjects = await fetchAdmitCardSubjects(s)
      generateAdmitCard(resolved, subjects, {
        examSchedule: fmtDT(examSchedule),
        admitCardTime: fmtDT(admitCardTime),
        admitCardAt: admitCardTime,   // raw value drives the date gate
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

  // Admit card generation is locked until the configured Admit Card Time.
  const admitLockedUntil = admitCardTime ? new Date(admitCardTime) : null
  const admitLocked = !!(admitLockedUntil && !isNaN(admitLockedUntil.getTime()) && Date.now() < admitLockedUntil.getTime())

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
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSettingsOpen(true)}
              title="Set Exam Schedule (printed on Admit Card)"
              className="flex flex-col items-start px-3 py-1.5 rounded-xl border border-gray-200 hover:border-[#933d18]/40 hover:bg-[#933d18]/5 transition-colors"
            >
              <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#933d18]"><CalendarClock size={13} /> Exam Schedule</span>
              <span className="text-[11px] text-gray-500 leading-tight">{examSchedule ? fmtDT(examSchedule) : 'Not set — click to add'}</span>
            </button>
            <button
              onClick={() => setSettingsOpen(true)}
              title="Set Admit Card date/time (printed on Admit Card)"
              className="flex flex-col items-start px-3 py-1.5 rounded-xl border border-gray-200 hover:border-[#933d18]/40 hover:bg-[#933d18]/5 transition-colors"
            >
              <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#933d18]"><Clock size={13} /> Admit Card Time</span>
              <span className="text-[11px] text-gray-500 leading-tight">{admitCardTime ? fmtDT(admitCardTime) : 'Not set — click to add'}</span>
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
        {search && (
          <button onClick={() => setSearch('')}
            className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-semibold text-[#933d18] bg-[#933d18]/8 hover:bg-[#933d18]/15 rounded-xl transition-colors">
            <X size={14} /> Clear
          </button>
        )}
      </div>

      {admitLocked && (
        <div className="mb-4 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          <Clock size={15} className="shrink-0" />
          Admit card generation is locked until <strong>{fmtDT(admitCardTime)}</strong>. Change it from the “Admit Card Time” button above.
        </div>
      )}

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
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleAdmitCard(s.id)}
                      disabled={busy === s.id || admitLocked}
                      title={admitLocked ? `Locked until ${fmtDT(admitCardTime)}` : 'Generate PDF Admit Card'}
                      className="w-fit"
                    >
                      <ClipboardList size={14} className={busy === s.id ? 'animate-pulse text-amber-600' : admitLocked ? 'text-gray-400' : 'text-amber-600'} />
                      <span className={`text-xs ml-1 ${admitLocked ? 'text-gray-400' : 'text-amber-600'}`}>{busy === s.id ? '...' : admitLocked ? 'Locked' : 'Generate'}</span>
                    </Button>
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
        <ExamSettingsModal
          examSchedule={examSchedule}
          admitCardTime={admitCardTime}
          onSave={saveSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  )
}

function ExamSettingsModal({ examSchedule, admitCardTime, onSave, onClose }) {
  const [sched, setSched] = useState(examSchedule || '')
  const [admit, setAdmit] = useState(admitCardTime || '')
  const [saving, setSaving] = useState(false)

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    const ok = await onSave(sched, admit)
    setSaving(false)
    if (ok) onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <CalendarClock size={18} className="text-[#933d18]" />
            <h3 className="font-bold text-gray-900">Exam Settings</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
        </div>
        <form onSubmit={handleSave} className="p-5 space-y-4">
          <p className="text-xs text-gray-400">These apply to the whole Exam Section and are printed on every Admit Card.</p>
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1 flex items-center gap-1.5"><CalendarClock size={13} className="text-[#933d18]" /> Exam Schedule (date & time)</label>
            <input type="datetime-local" value={sched} onChange={e => setSched(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#933d18] focus:ring-2 focus:ring-[#933d18]/15" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1 flex items-center gap-1.5"><Clock size={13} className="text-[#933d18]" /> Admit Card Time (date & time)</label>
            <input type="datetime-local" value={admit} onChange={e => setAdmit(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#933d18] focus:ring-2 focus:ring-[#933d18]/15" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
