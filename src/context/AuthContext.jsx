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
    if (!isConfigured) return { error: { message: 'Supabase configure nahi hai. .env file mein URL aur Key daalo.' } }
    return supabase.auth.signInWithPassword({ email, password })
  }

  // Demo/mock login - bypasses Supabase
  function signInMock(mockUser) {
    setUser(mockUser)
    setProfile({ id: mockUser.id, role: mockUser.user_metadata?.role || 'admin' })
  }

  async function signUp(email, password, userData) {
    if (!isConfigured) return { error: { message: 'Supabase configure nahi hai.' } }
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
