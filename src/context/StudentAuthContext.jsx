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

  async function studentLogin(enrollmentNo, password) {
    const { data, error } = await supabase
      .from('students')
      .select('id, student_name, enrollment_no, login_password, status')
      .eq('enrollment_no', enrollmentNo)
      .maybeSingle()

    if (error) return { error: 'Login failed. Please try again.' }
    if (!data) return { error: 'Invalid enrollment number or password.' }
    if (data.login_password !== password) return { error: 'Invalid enrollment number or password.' }
    if (data.status !== 'Approved') return { error: 'Your account is not yet approved. Please contact your center.' }

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
