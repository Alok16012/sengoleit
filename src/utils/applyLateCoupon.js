import { supabase } from '../lib/supabase'
import { computeSemesterFeeStatus } from './courseFee'
import { nextTerm } from './reRegistration'

// Admin applies an unused Admission / Course Coupon to a student whose centre
// forgot it at entry. See add_admin_apply_coupon.sql.
//
// The preview works out, from the fee structure, what the coupon changes:
//   * dues go down by the coupon's value (every fee screen reads the discount
//     off the student row), and
//   * whatever the centre has ALREADY paid beyond the whole course's new fee
//     is excess and is returned to the centre wallet (`refund`).

const STUDENT_COLS = 'id, student_name, enrollment_no, status, center_id, programme_id, session_id, semester_year, fee_collected, coupon_discount, coupon_code, course_coupon_discount, course_coupon_code, fee_sharing_pct, programs(program_name, duration, semester_year), centers(center_name, center_code)'

const isCourse = c => c?.coupon_type === 'course'

async function dues(st, extra) {
  const { sems } = await computeSemesterFeeStatus({
    programme_id: st.programme_id,
    session_id: st.session_id,
    duration: Number(st.programs?.duration) || 1,
    fee_collected: st.fee_collected,
    coupon_discount: Number(st.coupon_discount || 0) + (extra.admission || 0),
    course_coupon_discount: Number(st.course_coupon_discount || 0) + (extra.course || 0),
    center_id: st.center_id,
    sharing_pct: st.fee_sharing_pct,
  })
  return n => (n <= 0 ? 0 : (sems.find(s => s.sem === n)?.dueFee ?? sems[sems.length - 1]?.dueFee ?? 0))
}

export async function previewLateCoupon(coupon, enrollment) {
  const code = String(enrollment || '').trim().replace(/[^A-Za-z0-9/_-]/g, '')
  if (!code) return { error: 'Enter the enrollment / application number.' }
  let { data: rows, error } = await supabase.from('students').select(STUDENT_COLS)
    .or(`enrollment_no.ilike.${code},admission_number.ilike.${code}`).limit(2)
  if (error) return { error: error.message }
  if (!rows?.length) return { error: `No student found with ${code}.` }
  if (rows.length > 1) return { error: `More than one student matches ${code}.` }
  const st = rows[0]

  const amount = Math.round(Number(coupon.face_value) || 0)
  const course = isCourse(coupon)
  if (coupon.center_id && st.center_id !== coupon.center_id)
    return { error: `${st.student_name} is at ${st.centers?.center_name || 'another centre'}; this coupon belongs to ${coupon.centers?.center_name || 'a different centre'}.` }
  if (course && coupon.program_id && coupon.program_id !== st.programme_id)
    return { error: `This Course Coupon is for a different course than ${st.programs?.program_name || 'the student\'s'}.` }
  if (!course && Number(st.coupon_discount || 0) > 0)
    return { error: `${st.student_name} already has an Admission Coupon (${st.coupon_code || '—'}).` }
  if (course && Number(st.course_coupon_discount || 0) > 0)
    return { error: `${st.student_name} already has a Course Coupon (${st.course_coupon_code || '—'}).` }

  const before = await dues(st, {})
  const after = await dues(st, course ? { course: amount } : { admission: amount })
  const t = nextTerm(st)
  const perYear = t.unit === 'Year' ? 2 : 1
  const lastSem = Number(st.programs?.duration) || 1
  const nextSem = Math.min((t.current + 1) * perYear, lastSem)
  const collected = Number(st.fee_collected) || 0
  // The coupon first comes off what is still to be paid. Only what the centre
  // has paid beyond the WHOLE course's new fee is excess, and goes back.
  const over = due => Math.max(collected - due, 0)
  const refund = Math.min(amount, Math.max(over(after(lastSem)) - over(before(lastSem)), 0))
  const left = collected - refund

  return {
    student: st,
    amount,
    refund,
    collected,
    term: t,
    totalDueBefore: Math.max(before(lastSem) - collected, 0),
    totalDueAfter: Math.max(after(lastSem) - left, 0),
    nextDueBefore: t.atEnd ? null : Math.max(before(nextSem) - collected, 0),
    nextDueAfter: t.atEnd ? null : Math.max(after(nextSem) - left, 0),
  }
}

export async function applyLateCoupon(coupon, preview) {
  const { data, error } = await supabase.rpc('admin_apply_late_coupon', {
    p_student: preview.student.id,
    p_coupon: coupon.id,
    p_refund: preview.refund,
  })
  if (error && /admin_apply_late_coupon/.test(error.message || ''))
    return { error: { message: 'Run add_admin_apply_coupon.sql in Supabase first.' } }
  return { data, error }
}
