import { supabase } from '../lib/supabase'

// Serial numbers issued to students — application, registration, enrollment.
//
// Each of these used to be built as "count the existing ones, add one", which
// hands out a number that is already taken whenever the count does not match
// the highest serial: two submissions racing each other read the same count,
// and a deleted student makes the count drop back onto a live number. That is
// how three students ended up sharing an application number.
//
// Counting still gives the starting point, but the candidate is now probed
// against the table and stepped past anything taken. A unique index (see
// fix_duplicate_student_numbers.sql) is what finally makes it airtight — this
// keeps the app from walking into a collision in the first place.
export async function findFreeNumber(column, build, startSerial, tries = 200) {
  let n = startSerial
  for (let i = 0; i < tries; i++, n++) {
    const candidate = build(n)
    const { count, error } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true })
      .eq(column, candidate)
    // A failed lookup must not hand back a number that might be taken; step on
    // rather than claiming this one.
    if (error) continue
    if (!count) return candidate
  }
  return build(n)
}

// How many students already hold a number in this column — the starting point
// for the next serial.
export async function countIssued(column) {
  const { count } = await supabase
    .from('students')
    .select('*', { count: 'exact', head: true })
    .not(column, 'is', null)
    .neq(column, '')
  return count || 0
}
