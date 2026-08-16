import { supabase } from '../lib/supabase'

function fmtDT(val) {
  if (!val) return ''
  const d = new Date(val)
  if (isNaN(d.getTime())) return val
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const BLANK = { examSchedule: '', admitCardTime: '', admitCardAt: '' }

// Per-course (program + session) exam settings printed on a student's Admit
// Card, wherever it is downloaded from. Returns display-ready strings plus the
// raw admit_card_time (`admitCardAt`) used for the date gate. Never throws.
// Examination start–end dates for the student's term, read from exam_calendar.
// Regular programmes use semesters 1–10; Ph.D uses the 101–106 (Year 1–6) offset.
// When `sem` (1-based term) is given, returns THAT term's dates (used by the
// per-semester admit card); otherwise picks the current/nearest-upcoming period.
export async function fetchExamDates(student, sem) {
  try {
    const sid = student?.session_id || null
    if (!sid) return { examDates: '', examTerm: '' }
    const progName = student?.programs?.program_name || student?.program_name || ''
    const typeName = student?.programs?.programme_types?.programme_type_name || ''
    const isPhd = /ph\.?\s*d|doctor of philosophy|doctoral/i.test(progName) || /doctorate|ph\.?\s*d|doctoral/i.test(typeName)
    const offset = isPhd ? 100 : 0
    // exam_held needs add_exam_calendar_held.sql — retry without it so cards
    // keep printing on an unmigrated database.
    const build = (cols) => supabase.from('exam_calendar').select(cols)
      .eq('session_id', sid).gt('semester', offset).lte('semester', offset + 12)
    let { data, error } = await build('semester, start_date, end_date, exam_held')
    if (error) ({ data } = await build('semester, start_date, end_date'))
    // A row may carry only the typed "Exam. Held" label, with no dates yet.
    const rows = (data || []).filter(r => r.start_date || r.end_date || r.exam_held)
    if (!rows.length) return { examDates: '', examTerm: '' }
    const key = r => new Date(r.start_date || r.end_date).getTime()
    const today = Date.now()
    // Prefer the requested term; else the current/nearest-upcoming DATED period
    // (an undated label can't be ranked against today).
    let row = sem ? rows.find(r => r.semester === offset + Number(sem)) : null
    if (!row) {
      const dated = rows.filter(r => r.start_date || r.end_date)
      const upcoming = dated.filter(r => r.end_date && new Date(r.end_date).getTime() >= today).sort((a, b) => key(a) - key(b))
      row = upcoming[0] || [...dated].sort((a, b) => key(b) - key(a))[0]
    }
    if (!row) return { examDates: '', examTerm: '' }
    const fmt = d => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
    // The examination session printed on the card ("January 2026"), so Semester
    // 2's card stops carrying the ADMISSION session. The admin's typed
    // "Exam. Held" label wins; the exam start date's month is the fallback.
    // Only trustworthy when the row is the requested term's own; the
    // nearest-upcoming fallback may belong to a different semester.
    const semMatch = !sem || row.semester === offset + Number(sem)
    return {
      examDates: (row.start_date || row.end_date) ? `${fmt(row.start_date)} to ${fmt(row.end_date)}` : '',
      examTerm: `${isPhd ? 'Year' : 'Semester'} ${row.semester - offset}`,
      examSession: !semMatch ? ''
        : (String(row.exam_held || '').trim()
          || (row.start_date ? new Date(row.start_date).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : '')),
    }
  } catch {
    return { examDates: '', examTerm: '' }
  }
}

// Examination END dates for a set of sessions, keyed `${session_id}:${semester}`
// (Ph.D years keep their 101+ offset, as stored). The centre may raise a
// student's next re-registration only once their current term's exams are
// over, so this is what decides when a student turns up in that queue.
// Returns {} on any error — an unreadable calendar must not freeze the queue.
export async function fetchExamEndDates(sessionIds) {
  const ids = [...new Set((sessionIds || []).filter(Boolean))]
  if (!ids.length) return {}
  const { data, error } = await supabase
    .from('exam_calendar')
    .select('session_id, semester, end_date')
    .in('session_id', ids)
  if (error) return {}
  const map = {}
  for (const r of data || []) if (r.end_date) map[`${r.session_id}:${r.semester}`] = r.end_date
  return map
}

// The exam end date for the term a student is currently in, or null when the
// calendar has none. Ph.D terms are years, stored at the 100+ offset.
export function examEndDateFor(student, endDates) {
  const sid = student?.session_id
  if (!sid || !endDates) return null
  const term = Math.max(parseInt(String(student.semester_year || ''), 10) || 1, 1)
  const progName = student?.programs?.program_name || ''
  const isPhd = /ph\.?\s*d|doctor of philosophy|doctoral/i.test(progName)
  return endDates[`${sid}:${isPhd ? 100 + term : term}`] || null
}

export async function fetchExamSettingsMeta(student) {
  try {
    const pid = student?.programme_id || student?.program_id
    const sid = student?.session_id || null
    if (!pid) return BLANK
    // Fetch all rows for this program, then prefer the session-specific one,
    // falling back to the program-wide ("All Sessions" / null) row.
    const { data, error } = await supabase
      .from('exam_schedules')
      .select('session_id, exam_schedule, admit_card_time')
      .eq('program_id', pid)
    if (error || !data || data.length === 0) return BLANK
    const row =
      (sid && data.find(r => r.session_id === sid)) ||
      data.find(r => !r.session_id) ||
      null
    if (!row) return BLANK
    return {
      examSchedule: fmtDT(row.exam_schedule),
      admitCardTime: fmtDT(row.admit_card_time),
      admitCardAt: row.admit_card_time || '',
    }
  } catch {
    return BLANK
  }
}
