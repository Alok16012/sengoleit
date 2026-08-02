import { supabase } from '../lib/supabase'

// How many semesters' fee is due, driven by the Examination Calendar.
// A semester counts once ITS OWN exam window has ended (plus 5 days' grace) —
// i.e. the fee due tracks the semesters the student has actually completed.
// So with Sem 1's exam over and Sem 2's still running, only Sem 1 is due
// (half of a 2-semester year); Sem 2 joins 5 days after Sem 2's exam ends.
// Always at least 1 (the entry semester), never more than the programme's
// total. A semester with no end date stops the count there.
// calMap: { [semesterNumber]: 'YYYY-MM-DD' end_date }.
export function dueSemesterFromCalendar(calMap, totalSems) {
  const now = new Date()
  let completed = 0
  for (let k = 1; k <= totalSems; k++) {
    const end = calMap[k]
    if (!end) break
    const threshold = new Date(end)
    threshold.setDate(threshold.getDate() + 5)
    if (now > threshold) completed = k
    else break
  }
  return Math.min(Math.max(completed, 1), totalSems)
}

// The single source of truth for a student's course fee. Cumulative for Sem
// 1..due (the exam calendar decides `due`; falls back to the admission semester
// when no calendar is set). Fee item categories:
//   entry     → once (Sem 1)          divide → split evenly across all semesters
//   multiply  → every semester        multiply2 → from Sem 2 onward
// Returns { courseFee, dueSem, totalSems, calendarActive }.
export async function computeCumulativeCourseFee({ programme_id, session_id, semester_year, semYear, duration, programName }) {
  const { data: structures } = await supabase
    .from('fee_structures')
    .select('id, session_id, total_semesters')
    .eq('program_id', programme_id)
  const fs = (structures || []).find(s => s.session_id === session_id) || (structures || [])[0]

  // `duration` is stored in semesters for every programme (per the program form)
  // — a 3-year (Year-based) Ph.D is duration 6 — so it IS the total semester
  // count. No ×2.
  const totalSems = (Number(duration) || 1)

  let entryT = 0, divideT = 0, mulT = 0, mul2T = 0
  if (fs) {
    const { data: items } = await supabase
      .from('fee_items')
      .select('amount, category')
      .eq('fee_structure_id', fs.id)
    ;(items || []).forEach(it => {
      const a = Number(it.amount) || 0
      if (it.category === 'entry') entryT += a
      else if (it.category === 'divide') divideT += a
      else if (it.category === 'multiply') mulT += a
      else if (it.category === 'multiply2') mul2T += a
    })
  }

  // Year-based (Ph.D) programmes keep their calendar at a 100+ semester offset
  // (101 = Sem 1, 102 = Sem 2 …) so it stays independent of regular semesters —
  // map it back to 1-based terms here.
  const offset = semYear === 'Year' ? 100 : 0
  let calMap = {}
  try {
    const { data: cal, error } = await supabase
      .from('exam_calendar')
      .select('semester, end_date')
      .eq('session_id', session_id)
    if (!error) (cal || []).forEach(r => {
      if (r.end_date && r.semester > offset && r.semester <= offset + 12) calMap[r.semester - offset] = r.end_date
    })
  } catch { /* exam_calendar table not created yet */ }
  const calendarActive = Object.keys(calMap).length > 0

  // The entry semester is the FLOOR — a lateral entry at Sem 3 owes three
  // semesters from day one — and the exam calendar carries it forward from
  // there as each semester completes. (It used to cap the calendar AT the
  // entry semester, which froze every fresh Sem-1 entrant at one semester
  // forever; the calendar could then only ever reduce the fee, never advance
  // it. Over-charging a back-dated entry is no longer a risk either, because
  // the calendar now counts completed semesters rather than the next one.)
  // Year-based NON-Ph.D programmes (e.g. a 1-year, 2-semester diploma) are billed
  // per YEAR: entering "1st Year" charges that whole year's semesters up front
  // (1 Year = 2 semesters), so the fee matches the full year's amount. Ph.D stays
  // per-semester even though it is Year-based, and regular Semester programmes are
  // unchanged.
  const isPhd = /ph\.?\s*d|doctor of philosophy|doctoral|doctorate/i.test(String(programName || ''))
  const yearlyBilling = semYear === 'Year' && !isPhd
  const entryUnit = Math.max(parseInt(semester_year, 10) || 1, 1)
  const entrySem = yearlyBilling
    ? Math.min(entryUnit * 2, totalSems)                 // full year = 2 semesters
    : Math.min(entryUnit, totalSems)
  const dueSem = yearlyBilling
    ? entrySem                                            // whole entry year charged up front
    : (calendarActive
      ? Math.min(Math.max(dueSemesterFromCalendar(calMap, totalSems), entrySem), totalSems)
      : entrySem)

  const cumulative = fs
    ? entryT + (totalSems > 0 ? divideT / totalSems : 0) * dueSem + mulT * dueSem + mul2T * Math.max(dueSem - 1, 0)
    : 0

  return { courseFee: Math.round(cumulative), dueSem, totalSems, calendarActive }
}

// Per-semester cumulative course fee + which semesters are "cleared" — i.e. the
// student's fee_collected covers that semester's cumulative fee. Drives the
// per-semester admit-card gate in the Exam Section.
// Returns { totalSems, collected, sems: [{ sem, cumFee, cleared }] }.
export async function computeSemesterFeeStatus({ programme_id, session_id, duration, fee_collected }) {
  const totalSems = Number(duration) || 1
  const { data: structures } = await supabase
    .from('fee_structures').select('id, session_id').eq('program_id', programme_id)
  const fs = (structures || []).find(s => s.session_id === session_id) || (structures || [])[0]

  let entryT = 0, divideT = 0, mulT = 0, mul2T = 0
  if (fs) {
    const { data: items } = await supabase.from('fee_items').select('amount, category').eq('fee_structure_id', fs.id)
    ;(items || []).forEach(it => {
      const a = Number(it.amount) || 0
      if (it.category === 'entry') entryT += a
      else if (it.category === 'divide') divideT += a
      else if (it.category === 'multiply') mulT += a
      else if (it.category === 'multiply2') mul2T += a
    })
  }
  const cumFee = n => entryT + (totalSems > 0 ? divideT / totalSems : 0) * n + mulT * n + mul2T * Math.max(n - 1, 0)
  const collected = Number(fee_collected) || 0

  const sems = []
  for (let n = 1; n <= totalSems; n++) {
    const fee = cumFee(n)
    sems.push({ sem: n, cumFee: Math.round(fee), cleared: collected + 1 >= fee })   // +1 = rounding tolerance
  }
  return { totalSems, collected: Math.round(collected), sems }
}
