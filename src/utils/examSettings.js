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
