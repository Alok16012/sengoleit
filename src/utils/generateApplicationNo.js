import { supabase } from '../lib/supabase'

// Application numbers look like CA/001/0001, CA/001/0002, …
// "CA" and "001" stay fixed; only the trailing 4-digit serial increments.
// We read the highest existing serial and add one.
export async function generateApplicationNo() {
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
