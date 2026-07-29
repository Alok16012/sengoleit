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

  async function studentLogin(identifier, password) {
    // PhD students have no enrollment_no until they're forwarded to the Exam
    // Section, so they log in with their Email ID instead. Detect which one
    // was entered and query accordingly.
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

      const session = { id: row.id, student_name: row.student_name, enrollment_no: row.enrollment_no }
      localStorage.setItem('student_session', JSON.stringify(session))
      setStudent(session)
      return { data: session }
    }

    // Use RPC to bypass RLS (runs with SECURITY DEFINER on server side)
    const { data, error } = await supabase.rpc('student_login', {
      p_enrollment: identifier,
      p_pwd: password,
    })

    if (error) {
      // RPC not set up yet — fallback to direct query (works only if RLS allows anon reads)
      const { data: row, error: qErr } = await supabase
        .from('students')
        .select('id, student_name, enrollment_no, login_password, status')
        .eq('enrollment_no', identifier)
        .maybeSingle()

      if (qErr || !row) return { error: 'Invalid enrollment number or password.' }
      if (row.login_password !== password) return { error: 'Invalid enrollment number or password.' }
      if (row.status !== 'Approved') return { error: 'Account not approved yet. Please contact your center.' }

      const session = { id: row.id, student_name: row.student_name, enrollment_no: row.enrollment_no }
      localStorage.setItem('student_session', JSON.stringify(session))
      setStudent(session)
      return { data: session }
    }

    if (data?.error === 'invalid_credentials') return { error: 'Invalid enrollment number or password.' }
    if (data?.error === 'not_approved') return { error: 'Account not approved yet. Please contact your center.' }
    if (!data?.id) return { error: 'Invalid enrollment number or password.' }

    const session = { id: data.id, student_name: data.student_name, enrollment_no: data.enrollment_no }
    localStorage.setItem('student_session', JSON.stringify(session))
    setStudent(session)
    return { data: session }
  }

  function studentLogout() {
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
