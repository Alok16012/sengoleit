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
    let q = supabase
      .from('exam_schedules')
      .select('exam_schedule, admit_card_time')
      .eq('program_id', pid)
    q = sid ? q.eq('session_id', sid) : q.is('session_id', null)
    const { data, error } = await q.maybeSingle()
    if (error || !data) return BLANK
    return {
      examSchedule: fmtDT(data.exam_schedule),
      admitCardTime: fmtDT(data.admit_card_time),
      admitCardAt: data.admit_card_time || '',
    }
  } catch {
    return BLANK
  }
}
