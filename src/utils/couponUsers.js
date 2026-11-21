import { supabase } from '../lib/supabase'
import { fetchAllRows } from './fetchAllRows'

// Which student a coupon went to. The link lives on the student row —
// students.coupon_code (Admission Coupon) and students.course_coupon_code —
// not on the coupon, so look it up from there. Returns
// { [CODE]: { name, enrollment } }; {} when it cannot be read.
export async function fetchCouponUsers(centerId) {
  const { data, error } = await fetchAllRows(() => {
    let q = supabase.from('students')
      .select('id, student_name, enrollment_no, admission_number, coupon_code, course_coupon_code')
      .or('coupon_code.not.is.null,course_coupon_code.not.is.null')
      .order('id')
    if (centerId) q = q.eq('center_id', centerId)
    return q
  })
  if (error) return {}
  const map = {}
  for (const s of data || []) {
    const who = { name: s.student_name, enrollment: s.enrollment_no || s.admission_number || '' }
    if (s.coupon_code) map[String(s.coupon_code).toUpperCase()] = who
    if (s.course_coupon_code) map[String(s.course_coupon_code).toUpperCase()] = who
  }
  return map
}

export const couponKey = c => String(c?.coupon_code || c?.id?.slice(0, 8) || '').toUpperCase()
