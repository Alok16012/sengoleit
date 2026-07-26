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
// Picks the current/nearest-upcoming exam period for the student's session.
export async function fetchExamDates(student) {
  try {
    const sid = student?.session_id || null
    if (!sid) return { examDates: '', examTerm: '' }
    const progName = student?.programs?.program_name || student?.program_name || ''
    const typeName = student?.programs?.programme_types?.programme_type_name || ''
    const isPhd = /ph\.?\s*d|doctor of philosophy|doctoral/i.test(progName) || /doctorate|ph\.?\s*d|doctoral/i.test(typeName)
    const lo = isPhd ? 101 : 1, hi = isPhd ? 106 : 12
    const { data } = await supabase
      .from('exam_calendar')
      .select('semester, start_date, end_date')
      .eq('session_id', sid).gte('semester', lo).lte('semester', hi)
    const rows = (data || []).filter(r => r.start_date || r.end_date)
    if (!rows.length) return { examDates: '', examTerm: '' }
    const key = r => new Date(r.start_date || r.end_date).getTime()
    const today = Date.now()
    const upcoming = rows.filter(r => r.end_date && new Date(r.end_date).getTime() >= today).sort((a, b) => key(a) - key(b))
    const row = upcoming[0] || [...rows].sort((a, b) => key(b) - key(a))[0]
    const fmt = d => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
    return {
      examDates: `${fmt(row.start_date)} to ${fmt(row.end_date)}`,
      examTerm: isPhd ? `Semester ${row.semester - 100}` : `Semester ${row.semester}`,
    }
  } catch {
    return { examDates: '', examTerm: '' }
  }
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
