import { supabase } from '../lib/supabase'
import { computeSemesterFeeStatus } from './courseFee'

// Result Condition — a result is declared only once `standard_days` have
// passed since the student's form was submitted. Wanting it sooner falls in a
// slab, and the slab sets the fast-track charge:
//   charge = multiplier x fee + extra
// where fee is the semester's fee or the whole course fee (rules.fee_base).
// An early result the office allowed is a result_fast_track row.

export const DEFAULT_RULES = {
  standard_days: 20,
  fee_base: 'semester',
  slabs: [
    { from: 15, to: 19, multiplier: 2, extra: 0 },
    { from: 6, to: 14, multiplier: 3, extra: 0 },
    { from: 0, to: 5, multiplier: 3, extra: 15000 },
  ],
}

// null when add_result_conditions.sql has not been run — callers then apply
// no condition at all rather than blocking every result.
export async function fetchResultRules() {
  const { data, error } = await supabase.from('result_rules').select('*').eq('id', 1).maybeSingle()
  if (error) return null
  return data || DEFAULT_RULES
}

export async function fetchFastTrack(studentIds) {
  if (!studentIds?.length) return {}
  const { data, error } = await supabase.from('result_fast_track').select('*').in('student_id', studentIds)
  if (error) return {}
  return Object.fromEntries((data || []).map(r => [`${r.student_id}__${r.semester}`, r]))
}

// The form's submission date; a student entered without one counts from the
// day the record was made.
export const submittedOn = s => s?.date_of_submission || s?.created_at || null

const DAY = 24 * 60 * 60 * 1000
const dayStart = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }

// Whole days from submission to today (submission day = day 0).
export function daysSince(date) {
  if (!date) return null
  return Math.floor((dayStart(new Date()) - dayStart(String(date).slice(0, 10) + 'T00:00:00')) / DAY)
}

export function readyOn(date, rules) {
  if (!date) return null
  const d = dayStart(String(date).slice(0, 10) + 'T00:00:00')
  d.setDate(d.getDate() + (Number(rules?.standard_days) || 0))
  return d
}

export function slabFor(rules, day) {
  if (!rules || day == null || day >= (Number(rules.standard_days) || 0)) return null
  return (rules.slabs || []).find(s => day >= Number(s.from) && day <= Number(s.to)) || null
}

export function slabLabel(slab, rules) {
  if (!slab) return 'No charge'
  const base = rules?.fee_base === 'course' ? 'course fee' : 'semester fee'
  const parts = []
  if (Number(slab.multiplier)) parts.push(`${slab.multiplier}× ${base}`)
  if (Number(slab.extra)) parts.push(`₹${Number(slab.extra).toLocaleString('en-IN')}`)
  return parts.join(' + ') || 'No charge'
}

// The fee the multiplier applies to: the university's full fee for that
// semester, or for the whole course.
export async function baseFeeFor(student, sem, rules) {
  const { sems } = await computeSemesterFeeStatus({
    programme_id: student.programme_id,
    session_id: student.session_id,
    duration: student.programs?.duration,
    fee_collected: 0,
    coupon_discount: 0,
    course_coupon_discount: 0,
    center_id: student.center_id || student.centers?.id,
    sharing_pct: student.fee_sharing_pct,
  })
  const gross = n => sems.find(x => x.sem === n)?.grossFee || 0
  if (rules?.fee_base === 'course') return gross(sems.length)
  return Math.max(gross(sem) - gross(sem - 1), 0)
}

export async function chargeFor(student, sem, rules, slab) {
  if (!slab) return 0
  const fee = Number(slab.multiplier) ? await baseFeeFor(student, sem, rules) : 0
  return Math.round(Number(slab.multiplier || 0) * fee + Number(slab.extra || 0))
}

// May this semester's result be declared today? { ok, message }.
export async function checkResultAllowed(student, sem) {
  const rules = await fetchResultRules()
  if (!rules) return { ok: true }
  const day = daysSince(submittedOn(student))
  if (day == null || day >= (Number(rules.standard_days) || 0)) return { ok: true }
  const ft = await fetchFastTrack([student.id])
  if (ft[`${student.id}__${sem}`]) return { ok: true }
  const ready = readyOn(submittedOn(student), rules)
  return {
    ok: false,
    message:
      `${student.student_name}'s result can be declared from ${ready.toLocaleDateString('en-GB')} ` +
      `(${rules.standard_days} days after the form was submitted; today is day ${day}).\n\n` +
      `For an earlier result, allow it from Exam Section → Result Condition — ` +
      `today's charge: ${slabLabel(slabFor(rules, day), rules)}.`,
  }
}
