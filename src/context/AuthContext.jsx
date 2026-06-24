import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, isConfigured } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isConfigured) {
      setLoading(false)
      return
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    }).catch(() => setLoading(false))

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    try {
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
      setProfile(data)
    } catch (_) {}
    setLoading(false)
  }

  async function signIn(email, password) {
    if (!isConfigured) return { error: { message: 'Supabase is not configured. Add the URL and Key to your .env file.' } }
    const result = await supabase.auth.signInWithPassword({ email, password })
    if (result.error) return result

    // Block deactivated centers / super centers. Admins have no centers row,
    // so this check is skipped for them. Only an explicit "Inactive" status
    // blocks login (Pending/null are left alone so newly-set-up centers work).
    try {
      const { data: ctr } = await supabase
        .from('centers')
        .select('status')
        .eq('email', email)
        .maybeSingle()
      if (ctr && ctr.status === 'Inactive') {
        await supabase.auth.signOut().catch(() => {})
        setUser(null)
        setProfile(null)
        return { error: { message: 'This account has been deactivated. Please contact the administrator.' } }
      }
    } catch (_) { /* if the lookup fails, don't block a valid login */ }

    return result
  }

  // Demo/mock login - bypasses Supabase
  function signInMock(mockUser) {
    setUser(mockUser)
    setProfile({ id: mockUser.id, role: mockUser.user_metadata?.role || 'admin' })
  }

  async function signUp(email, password, userData) {
    if (!isConfigured) return { error: { message: 'Supabase is not configured.' } }
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (!error && data.user) {
      await supabase.from('profiles').insert({ id: data.user.id, ...userData })
    }
    return { data, error }
  }

  async function signOut() {
    if (isConfigured) await supabase.auth.signOut().catch(() => {})
    setProfile(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signInMock, signUp, signOut, isConfigured }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
