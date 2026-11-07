import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, isConfigured } from '../lib/supabase'
import { markActive } from '../utils/useIdleLogout'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  // A staff login's permissions (User Management → Roles). The admin has
  // every permission; other logins have none of these.
  const [permissions, setPermissions] = useState([])
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
      else { setProfile(null); setPermissions([]); setLoading(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId) {
    try {
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
      setProfile(data)
      if (data?.role === 'staff') {
        const { data: perms } = await supabase.rpc('my_permissions')
        setPermissions(Array.isArray(perms) ? perms : [])
      } else {
        setPermissions([])
      }
    } catch (_) {}
    setLoading(false)
  }

  async function signIn(email, password) {
    if (!isConfigured) return { error: { message: 'Supabase is not configured. Add the URL and Key to your .env file.' } }
    const result = await supabase.auth.signInWithPassword({ email, password })
    if (result.error) return result
    // A fresh sign-in starts the inactivity clock again (see useIdleLogout).
    markActive('idle:portal')

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
    setPermissions([])
    setUser(null)
  }

  // can('students.edit') — the admin can do everything; a staff login what
  // its role was given. The database checks the same thing (has_perm).
  const can = (perm) => profile?.role === 'admin' || (profile?.role === 'staff' && permissions.includes(perm))
  // may('students.edit') — for showing a button. Only a staff login is held to
  // its role; the admin, centres and super centres see their screens as they
  // always have (and the database still decides what each may do). Use this
  // on any screen, including ones a centre shares with the admin.
  const may = (perm) => profile?.role !== 'staff' || permissions.includes(perm)
  // mayTab('students', 'pending') — whether a tab inside a page shows. A role
  // with none of that page's tabs ticked sees every tab (roles made before
  // tabs could be chosen); otherwise only the ticked ones.
  // mayTab('account_dept', 'students', 'pending') checks a tab's inner tab.
  const mayTab = (moduleKey, tab, sub) => {
    if (profile?.role !== 'staff') return true
    const prefix = sub ? `${moduleKey}.tab.${tab}.` : `${moduleKey}.tab.`
    const key = sub ? prefix + sub : prefix + tab
    // Only this level counts: inner-tab keys must not make every outer tab
    // look "chosen".
    const chosen = permissions.some(p => p.startsWith(prefix) && !p.slice(prefix.length).includes('.'))
    return !chosen || permissions.includes(key)
  }

  return (
    <AuthContext.Provider value={{ user, profile, permissions, can, may, mayTab, loading, signIn, signInMock, signUp, signOut, isConfigured }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
