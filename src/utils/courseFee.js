import { supabase } from '../lib/supabase'

// How many semesters' fee is due, driven by the Examination Calendar.
// The student owes Sem 1 up to Sem 1's exam end date; 5 days past that end
// date (as of TODAY) Sem 2 is added, 5 days past Sem 2's end adds Sem 3, and
// so on, capped at the programme's total semesters. A semester with no end
// date stops the advance there.
// So for a July-2025 student today — Sem 1's exams long finished, Sem 2's
// still running — both semesters of the year are due; the wallet then holds
// 50% of that year's fee at forward time.
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

// Fallback for sessions with no Examination Calendar rows: work the due semester
// out from how long the session has been running. A semester is six months, and
// its fee falls due a fortnight after that semester's exams would have ended —
// the same "once the exam is over" rule the calendar encodes, just without the
// dates having been entered.
// Without this a July-2025 student was still billed for Sem 1 alone a year
// later, because an empty calendar fell straight back to the entry semester.
export function dueSemesterFromElapsed(sessionStart, totalSems) {
  if (!sessionStart) return 1
  const start = new Date(sessionStart)
  if (isNaN(start.getTime())) return 1
  const now = new Date()
  const months = (now.getFullYear() - start.getFullYear()) * 12
    + (now.getMonth() - start.getMonth())
    + (now.getDate() - start.getDate()) / 30
  if (months <= 0) return 1
  return Math.min(Math.max(Math.floor((months - 0.5) / 6) + 1, 1), totalSems)
}

// The single source of truth for a student's course fee. Cumulative for Sem
// 1..due (the exam calendar decides `due`; falls back to the admission semester
// when no calendar is set). Fee item categories:
//   entry     → once (Sem 1)          divide → split evenly across all semesters
//   multiply  → every semester        multiply2 → from Sem 2 onward
// Returns { courseFee, dueSem, totalSems, calendarActive }.
// What a centre KEEPS out of the course fee, as a percentage — the "Center
// Sharing %" in the Centers list, stored as centers.fee_sharing.
//
// Deliberately NOT centers.commission: that is the cut a SUPER centre earns on
// this centre's recharges, a different agreement with a different counterparty.
// The two were conflated once and produced a fee reduced by the wrong number.
//
// Capped at 0..100 so a mis-typed rate can never drive a fee negative, and 0
// for an unknown centre — which is what keeps the fee whole for every caller
// that does not know (or care) which centre is asking.
export async function centerSharingPct(center_id) {
  if (!center_id) return 0
  const { data: c } = await supabase
    .from('centers').select('fee_sharing').eq('id', center_id).maybeSingle()
  return Math.min(Math.max(Number(c?.fee_sharing) || 0, 0), 100)
}

export async function computeCumulativeCourseFee({ programme_id, session_id, semester_year, semYear, duration, programName, center_id, sharing_pct }) {
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

  // No calendar for this session — fall back to its elapsed running time.
  let sessionStart = null
  if (!calendarActive && session_id) {
    const { data: ses } = await supabase
      .from('academic_sessions').select('start_date').eq('id', session_id).maybeSingle()
    sessionStart = ses?.start_date || null
  }

  // The entry semester is the FLOOR — a lateral entry at Sem 3 owes three
  // semesters from day one — and the exam calendar carries it forward from
  // there as the session progresses. (It used to CAP the calendar at the entry
  // semester, which froze every fresh Sem-1 entrant at one semester forever:
  // a July-2025 PGDCA student whose Sem 1 exams were long over still owed a
  // single semester, so the wallet held half of half the year's fee.)
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
    : Math.min(Math.max(
      calendarActive
        ? dueSemesterFromCalendar(calMap, totalSems)
        : dueSemesterFromElapsed(sessionStart, totalSems),
      entrySem), totalSems)

  const cumulative = fs
    ? entryT + (totalSems > 0 ? divideT / totalSems : 0) * dueSem + mulT * dueSem + mul2T * Math.max(dueSem - 1, 0)
    : 0

  // The centre keeps its share and owes the university the rest:
  //   fee due  ×  (100 − Center Sharing %)  ÷  100
  // Rounded once, at the end, so the wallet check, the Account Dept's
  // collection and the reports all quote the same rupee figure.
  //
  // `sharing_pct` is the rate FROZEN on an existing admission. It wins over the
  // centre's current rate, so re-pricing a centre never re-prices students it
  // already admitted. Pass nothing for a new admission and the centre's rate
  // today is used.
  //
  // Without a center_id nothing is deducted, so a caller that does not name a
  // centre still gets the whole fee — what the university is owed in total,
  // which is what the admin-side screens want.
  const sharingPct = sharing_pct != null && sharing_pct !== ''
    ? Math.min(Math.max(Number(sharing_pct) || 0, 0), 100)
    : await centerSharingPct(center_id)
  const payable = cumulative * (100 - sharingPct) / 100

  return {
    courseFee: Math.round(payable),      // what the CENTRE owes the university
    grossFee: Math.round(cumulative),    // the university's own full fee
    centerShare: Math.round(cumulative) - Math.round(payable),
    sharingPct,
    dueSem, totalSems, calendarActive,
  }
}

// The wallet hold taken when a center forwards a student: half the fee due so
// far, less any coupon. Shared so the forward, the approval and the reports all
// quote the same number instead of each re-deriving it.
export function holdAmount(courseFee, discount) {
  return Math.max(Math.ceil(Number(courseFee || 0) * 0.5) - Number(discount || 0), 0)
}

// Per-semester cumulative course fee + which semesters are "cleared".
//
// A semester is cleared only once its fee has been collected IN FULL —
// `dueFee`, the cumulative course fee less any coupon.
//
// Nothing collects that much on its own: admission (holdAmount) and each
// re-registration take half the fee apiece, so a semester sits short by
// design. The Exam Section collects the remainder from the centre's wallet at
// the moment the admit card is issued, which is what finally clears it.
//
// Drives the per-semester admit-card gate in the Exam Section.
// Returns { totalSems, collected, sems: [{ sem, cumFee, dueFee, cleared }] },
// where cumFee is the course fee and dueFee is that fee less the coupon.
export async function computeSemesterFeeStatus({ programme_id, session_id, duration, fee_collected, coupon_discount }) {
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
    // The coupon is a discount on the fee itself, so it is never collected.
    const due = Math.max(Math.round(fee) - (Number(coupon_discount) || 0), 0)
    sems.push({ sem: n, cumFee: Math.round(fee), dueFee: due, cleared: collected + 1 >= due })   // +1 = rounding tolerance
  }
  return { totalSems, collected: Math.round(collected), sems }
}
