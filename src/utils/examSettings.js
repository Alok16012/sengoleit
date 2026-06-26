import { supabase } from '../lib/supabase'

function fmtDT(val) {
  if (!val) return ''
  const d = new Date(val)
  if (isNaN(d.getTime())) return val
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// Section-wide exam settings (set in the Exam Section header) that are printed
// on every Admit Card, wherever it is downloaded from. Returns display-ready
// strings; never throws (returns blanks if the table/columns are missing).
export async function fetchExamSettingsMeta() {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['exam_schedule', 'admit_card_time'])
    if (error || !data) return { examSchedule: '', admitCardTime: '', admitCardAt: '' }
    const map = Object.fromEntries(data.map(r => [r.key, r.value]))
    return {
      examSchedule: fmtDT(map.exam_schedule),
      admitCardTime: fmtDT(map.admit_card_time),
      admitCardAt: map.admit_card_time || '',   // raw value for the date gate
    }
  } catch {
    return { examSchedule: '', admitCardTime: '', admitCardAt: '' }
  }
}
