import { supabase } from '../lib/supabase'
import { formatDate, formatDateLong } from './formatDate'

// Research Dept letter settings (reference series + dates) and the reference
// number assigned to each candidate. Stored in the DB so every admin shares one
// series and a student's own copy of a letter carries the same Ref. No.
//
// Everything here degrades quietly if add_letter_settings.sql hasn't been run —
// callers fall back to their previous local behaviour rather than breaking.

// Serials print zero-padded to 3 digits: 010, 011 … 099, 100.
export const refSerial = (n) => String(Math.max(Number(n) || 0, 0)).padStart(3, '0')

export function buildRef(prefix, num) {
  return `${prefix || ''}${refSerial(num)}`
}

// Load every letter's settings. Returns null when the table is missing.
export async function loadLetterSettings() {
  const { data, error } = await supabase
    .from('letter_settings')
    .select('name, prefix, next_num, letter_date, test_date')
  if (error) return null
  return (data || []).map(r => ({
    name: r.name,
    prefix: r.prefix || '',
    nextNum: r.next_num ?? 1,
    date: r.letter_date || '',
    testDate: r.test_date || '',
  }))
}

export async function saveLetterSettings(letters) {
  const rows = (letters || []).filter(l => l?.name).map(l => ({
    name: l.name,
    prefix: l.prefix || '',
    next_num: Number(l.nextNum) || 0,
    letter_date: l.date || null,
    test_date: l.testDate || null,
    updated_at: new Date().toISOString(),
  }))
  if (!rows.length) return { error: null }
  const { error } = await supabase.from('letter_settings').upsert(rows, { onConflict: 'name' })
  return { error }
}

// All assigned reference numbers, as { [letterName]: { [studentId]: num } }.
export async function loadAssignedRefs() {
  const { data, error } = await supabase.from('letter_refs').select('letter_name, student_id, num')
  if (error) return null
  const map = {}
  for (const r of data || []) {
    if (!map[r.letter_name]) map[r.letter_name] = {}
    map[r.letter_name][r.student_id] = r.num
  }
  return map
}

// Claim a number for a candidate. ignoreDuplicates keeps the first assignment,
// so a second admin opening the same letter can't renumber it.
export async function assignRef(letterName, studentId, num) {
  await supabase
    .from('letter_refs')
    .upsert({ letter_name: letterName, student_id: studentId, num }, { onConflict: 'letter_name,student_id', ignoreDuplicates: true })
}

// The Ref. No. / dates for one student's letter — used by the student portal and
// the shared student lists, which have no access to the admin panel's state.
// Returns {} when the tables are missing or no number was ever assigned, so the
// letter simply falls back to its built-in defaults.
export async function letterOptsFor(studentId, letterName) {
  const [{ data: setting }, { data: ref }] = await Promise.all([
    supabase.from('letter_settings').select('prefix, letter_date, test_date').eq('name', letterName).maybeSingle(),
    supabase.from('letter_refs').select('num').eq('letter_name', letterName).eq('student_id', studentId).maybeSingle(),
  ]).catch(() => [{ data: null }, { data: null }])

  const opts = {}
  if (ref?.num != null) opts.refNo = buildRef(setting?.prefix, ref.num)
  if (setting?.letter_date) opts.date = formatDate(setting.letter_date)
  if (setting?.test_date) opts.testDate = formatDateLong(setting.test_date)
  return opts
}
