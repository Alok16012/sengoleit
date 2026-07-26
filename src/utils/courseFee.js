import { supabase } from '../lib/supabase'

// How many semesters' fee is due, driven by the Examination Calendar.
// A student pays for Sem 1 up to Sem 1's exam end date; once that end date is
// 5+ days past (as of TODAY), Sem 2 is added; 5+ days past Sem 2's end adds Sem
// 3; and so on, capped at the program's total semesters. If a semester has no
// end date set, we stop there (don't advance).
// calMap: { [semesterNumber]: 'YYYY-MM-DD' end_date }.
export function dueSemesterFromCalendar(calMap, totalSems) {
  const now = new Date()
  let due = 1
  for (let k = 1; k <= totalSems - 1; k++) {
    const end = calMap[k]
    if (!end) break
    const threshold = new Date(end)
    threshold.setDate(threshold.getDate() + 5)
    if (now > threshold) due = k + 1
    else break
  }
  return Math.min(due, totalSems)
}

// The single source of truth for a student's course fee. Cumulative for Sem
// 1..due (the exam calendar decides `due`; falls back to the admission semester
// when no calendar is set). Fee item categories:
//   entry     → once (Sem 1)          divide → split evenly across all semesters
//   multiply  → every semester        multiply2 → from Sem 2 onward
// Returns { courseFee, dueSem, totalSems, calendarActive }.
export async function computeCumulativeCourseFee({ programme_id, session_id, semester_year, semYear, duration }) {
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

  const dueSem = calendarActive
    ? dueSemesterFromCalendar(calMap, totalSems)
    : Math.min(Math.max(parseInt(semester_year, 10) || 1, 1), totalSems)

  const cumulative = fs
    ? entryT + (totalSems > 0 ? divideT / totalSems : 0) * dueSem + mulT * dueSem + mul2T * Math.max(dueSem - 1, 0)
    : 0

  return { courseFee: Math.round(cumulative), dueSem, totalSems, calendarActive }
}
