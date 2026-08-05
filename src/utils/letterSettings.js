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

// The Hall Ticket's exam columns only exist after add_hall_ticket.sql has been
// run — every read/write retries without them so an older schema keeps working.
const EXAM_COLS = 'exam_time, reporting_time, exam_centre, test_date_2'

// Load every letter's settings. Returns null when the table is missing.
export async function loadLetterSettings() {
  let { data, error } = await supabase
    .from('letter_settings')
    .select(`session_key, name, prefix, next_num, letter_date, test_date, ${EXAM_COLS}`)
  if (error) {
    ;({ data, error } = await supabase
      .from('letter_settings')
      .select('session_key, name, prefix, next_num, letter_date, test_date'))
  }
  if (error) {
    // Falling back to browser-only storage from here, and the panel can only say
    // so in general terms — log why, because "table missing" and "table exists
    // but predates session_key" need very different fixes.
    console.warn('[letterSettings] shared settings unavailable, using this browser only:', error.message)
    return null
  }
  return (data || []).map(r => ({
    session: r.session_key || '',
    name: r.name,
    prefix: r.prefix || '',
    nextNum: r.next_num ?? 1,
    date: r.letter_date || '',
    testDate: r.test_date || '',
    examTime: r.exam_time || '',
    reportTime: r.reporting_time || '',
    examCentre: r.exam_centre || '',
    testDate2: r.test_date_2 || '',
  }))
}

export async function saveLetterSettings(letters) {
  const rows = (letters || []).filter(l => l?.name).map(l => ({
    session_key: l.session || '',
    name: l.name,
    prefix: l.prefix || '',
    next_num: Number(l.nextNum) || 0,
    letter_date: l.date || null,
    test_date: l.testDate || null,
    exam_time: l.examTime || null,
    reporting_time: l.reportTime || null,
    exam_centre: l.examCentre || null,
    test_date_2: l.testDate2 || null,
    updated_at: new Date().toISOString(),
  }))
  if (!rows.length) return { error: null }
  let { error } = await supabase.from('letter_settings').upsert(rows, { onConflict: 'session_key,name' })
  if (error) {
    // Exam columns missing (add_hall_ticket.sql not run) — save the rest.
    const legacy = rows.map(({ exam_time, reporting_time, exam_centre, test_date_2, ...r }) => r)
    ;({ error } = await supabase.from('letter_settings').upsert(legacy, { onConflict: 'session_key,name' }))
  }
  return { error }
}

// Drop one letter's settings. saveLetterSettings only upserts, so a row removed
// in the panel would otherwise survive in the shared table and come back on the
// next load.
export async function deleteLetterSetting(sessionKey, name) {
  const { error } = await supabase.from('letter_settings')
    .delete().eq('session_key', sessionKey || '').eq('name', name)
  return { error }
}

// Returns { refs, sittings }, each keyed [letterName][studentId] — the assigned
// reference number, and the sitting it was issued under.
// The sittings ride along so a RE-print can reuse the recorded date instead of
// asking again — asking again lets a second choice silently move the exam date
// on a letter the candidate already holds.
export async function loadAssignedRefs() {
  // `sitting` arrives with add_second_sitting.sql — retry without it so an
  // older database still returns the numbers.
  let { data, error } = await supabase.from('letter_refs').select('letter_name, student_id, num, sitting')
  if (error) ({ data, error } = await supabase.from('letter_refs').select('letter_name, student_id, num'))
  if (error) return null
  const refs = {}
  const sittings = {}
  for (const r of data || []) {
    if (!refs[r.letter_name]) refs[r.letter_name] = {}
    refs[r.letter_name][r.student_id] = r.num
    if (r.sitting) {
      if (!sittings[r.letter_name]) sittings[r.letter_name] = {}
      sittings[r.letter_name][r.student_id] = r.sitting
    }
  }
  return { refs, sittings }
}

// Claim a number for a candidate. ignoreDuplicates keeps the first assignment,
// so a second admin opening the same letter can't renumber it.
export async function assignRef(letterName, studentId, num, sitting) {
  const row = { letter_name: letterName, student_id: studentId, num }
  if (sitting) row.sitting = sitting
  const opts = { onConflict: 'letter_name,student_id', ignoreDuplicates: true }
  const { error } = await supabase.from('letter_refs').upsert(row, opts)
  // `sitting` needs add_second_sitting.sql — without it, still claim the number.
  if (error && sitting) {
    await supabase.from('letter_refs')
      .upsert({ letter_name: letterName, student_id: studentId, num }, opts)
  }
}

// Record which exam sitting a candidate was given, after the number is claimed.
// Separate from assignRef because ignoreDuplicates means a re-issue never
// rewrites the row — the sitting still has to be settable on a second attempt.
export async function setSitting(letterName, studentId, sitting) {
  if (!sitting) return { error: null }
  const { error } = await supabase.from('letter_refs')
    .update({ sitting }).eq('letter_name', letterName).eq('student_id', studentId)
  return { error }
}

// Release a candidate's claimed number. Numbers lock on first issue so reopening
// a letter can't renumber it — but that also locks in a number claimed under an
// old series, so the admin needs a way to let go of one and re-issue it.
export async function unassignRef(letterName, studentId) {
  const { error } = await supabase.from('letter_refs')
    .delete().eq('letter_name', letterName).eq('student_id', studentId)
  return { error }
}

// The Ref. No. / dates for one student's letter — used by the student portal and
// the shared student lists, which have no access to the admin panel's state.
// Returns {} when the tables are missing or no number was ever assigned, so the
// letter simply falls back to its built-in defaults.
export async function letterOptsFor(studentId, letterName, sessionId = '') {
  const settingsQ = (cols) => supabase.from('letter_settings')
    .select(cols)
    .eq('name', letterName)
    .in('session_key', [sessionId || '', ''])
  const refQ = (cols) => supabase.from('letter_refs')
    .select(cols).eq('letter_name', letterName).eq('student_id', studentId).maybeSingle()
  let [{ data: settings, error: settingsErr }, { data: ref, error: refErr }] = await Promise.all([
    settingsQ(`session_key, prefix, letter_date, test_date, ${EXAM_COLS}`),
    refQ('num, sitting'),
  ])
  if (settingsErr) ({ data: settings } = await settingsQ('session_key, prefix, letter_date, test_date'))
  // `sitting` arrives with add_second_sitting.sql — retry without it so an
  // older database still returns the reference number.
  if (refErr) ({ data: ref } = await refQ('num'))

  // Prefer the student's own session; fall back to the any-session entry.
  const rows = settings || []
  const setting = rows.find(r => r.session_key === (sessionId || '')) || rows.find(r => !r.session_key)

  const opts = {}
  if (ref?.num != null) opts.refNo = buildRef(setting?.prefix, ref.num)
  if (setting?.letter_date) opts.date = formatDate(setting.letter_date)
  // The Ph.D entrance exam runs twice for one session. Which sitting a
  // candidate was given is recorded against their reference number, so the
  // student's own copy and the centre's copy print the same date as the office
  // copy — the choice must not live only in the admin's browser.
  const sittingDate = ref?.sitting === 2 ? setting?.test_date_2 : setting?.test_date
  if (sittingDate) opts.testDate = formatDateLong(sittingDate)
  if (setting?.exam_time) opts.examTime = setting.exam_time
  if (setting?.reporting_time) opts.reportTime = setting.reporting_time
  if (setting?.exam_centre) opts.examCentre = setting.exam_centre
  return opts
}
