import { supabase } from '../lib/supabase'

// Application numbers look like CA/001/0001, CA/001/0002, …
// "CA" and "001" stay fixed; only the trailing 4-digit serial increments.
// We read the highest existing serial and add one.
export async function generateApplicationNo() {
  // Worked out in the database, over every centre: a super centre only sees
  // its own centres, so reading the highest number here would repeat one
  // (security_step2_rls.sql). The direct read below is the fallback.
  const rpc = await supabase.rpc('next_center_application_no')
  if (!rpc.error && rpc.data) return rpc.data

  const { data } = await supabase
    .from('centers')
    .select('application_no')
    .like('application_no', 'CA/001/%')
    .order('application_no', { ascending: false })
    .limit(1)

  let next = 1
  const last = data?.[0]?.application_no
  if (last) {
    const m = String(last).match(/^CA\/001\/(\d+)$/)
    if (m) next = parseInt(m[1], 10) + 1
  }
  return `CA/001/${String(next).padStart(4, '0')}`
}
