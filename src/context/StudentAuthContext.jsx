import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const StudentAuthContext = createContext(null)

export function StudentAuthProvider({ children }) {
  const [student, setStudent] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem('student_session')
    if (saved) {
      try { setStudent(JSON.parse(saved)) } catch {}
    }
    setLoading(false)
  }, [])

  function storeSession(session) {
    localStorage.setItem('student_session', JSON.stringify(session))
    setStudent(session)
    return { data: session }
  }

  async function studentLogin(identifier, password) {
    // Server-verified login (student_auth.sql): the password is checked
    // against its hash in the database and a 30-day session token comes
    // back — the browser never sees the students table directly.
    const { data, error } = await supabase.rpc('student_login_v2', {
      p_identifier: identifier,
      p_pwd: password,
    })

    if (!error) {
      if (data?.error === 'not_approved') return { error: 'Account not approved yet. Please contact your center.' }
      if (data?.error || !data?.token) return { error: 'Invalid login details or password.' }
      return storeSession({ token: data.token, ...data.student })
    }

    // ---- Legacy fallback (student_auth.sql not run yet) ----------------
    // PhD students have no enrollment_no until they're forwarded to the
    // Exam Section, so they log in with their Email ID instead.
    const isEmail = identifier.includes('@')

    if (isEmail) {
      const { data: row, error: qErr } = await supabase
        .from('students')
        .select('id, student_name, enrollment_no, email, login_password, status')
        .ilike('email', identifier)
        .maybeSingle()

      if (qErr || !row) return { error: 'Invalid email or password.' }
      if (row.login_password !== password) return { error: 'Invalid email or password.' }
      if (row.status !== 'Approved') return { error: 'Account not approved yet. Please contact your center.' }
      return storeSession({ id: row.id, student_name: row.student_name, enrollment_no: row.enrollment_no })
    }

    const { data: legacy, error: rpcErr } = await supabase.rpc('student_login', {
      p_enrollment: identifier,
      p_pwd: password,
    })

    if (rpcErr) {
      const { data: row, error: qErr } = await supabase
        .from('students')
        .select('id, student_name, enrollment_no, login_password, status')
        .eq('enrollment_no', identifier)
        .maybeSingle()

      if (qErr || !row) return { error: 'Invalid enrollment number or password.' }
      if (row.login_password !== password) return { error: 'Invalid enrollment number or password.' }
      if (row.status !== 'Approved') return { error: 'Account not approved yet. Please contact your center.' }
      return storeSession({ id: row.id, student_name: row.student_name, enrollment_no: row.enrollment_no })
    }

    if (legacy?.error === 'invalid_credentials') return { error: 'Invalid enrollment number or password.' }
    if (legacy?.error === 'not_approved') return { error: 'Account not approved yet. Please contact your center.' }
    if (!legacy?.id) return { error: 'Invalid enrollment number or password.' }
    return storeSession({ id: legacy.id, student_name: legacy.student_name, enrollment_no: legacy.enrollment_no })
  }

  function studentLogout() {
    // Drop the session server-side too (best-effort).
    try {
      const saved = JSON.parse(localStorage.getItem('student_session') || 'null')
      if (saved?.token) supabase.rpc('student_logout', { p_token: saved.token })
    } catch { /* ignore */ }
    localStorage.removeItem('student_session')
    setStudent(null)
  }

  return (
    <StudentAuthContext.Provider value={{ student, loading, studentLogin, studentLogout }}>
      {children}
    </StudentAuthContext.Provider>
  )
}

export function useStudentAuth() {
  return useContext(StudentAuthContext)
}
