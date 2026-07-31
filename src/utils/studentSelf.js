import { supabase } from '../lib/supabase'

// The student portal's ONLY way to read the signed-in student's row.
//
// After student_auth.sql, the anon role has no direct access to the students
// table — data comes from the student_self(token) SECURITY DEFINER function,
// which returns the row (minus password columns) with programs /
// academic_sessions / centers / departments / study_modes embedded under the
// same keys the old PostgREST joins used, so every page reads it unchanged.
//
// Until that migration has been run, the function doesn't exist yet — fall
// back to the old direct query so the portal keeps working either way.

export function studentSession() {
  try { return JSON.parse(localStorage.getItem('student_session') || 'null') } catch { return null }
}

export async function fetchStudentSelf() {
  const sess = studentSession()
  if (!sess) return null

  if (sess.token) {
    const { data, error } = await supabase.rpc('student_self', { p_token: sess.token })
    if (!error) return data || null            // null = session expired server-side
  }

  // Legacy path: pre-migration database (or an old pre-token session).
  if (!sess.id) return null
  const { data } = await supabase
    .from('students')
    .select('*, programs(*), academic_sessions(*), centers(*), departments(*), study_modes(*)')
    .eq('id', sess.id)
    .maybeSingle()
  return data || null
}
