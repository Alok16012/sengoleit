import { Outlet, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import Sidebar from './Sidebar'
import { Search, Bell, User, LogOut, ChevronDown, KeyRound } from 'lucide-react'
import ChangePasswordModal from '../ChangePasswordModal'
import IdleWarning from '../IdleWarning'
import { useIdleLogout } from '../../utils/useIdleLogout'
import { moduleForPath, firstAllowedPath, PERMISSION_GROUPS } from '../../utils/permissions'

// What a staff login needs to open this path: the module's View, and for the
// add / edit forms its Add / Edit (or Manage) permission.
function staffMayOpen(pathname, can) {
  const m = moduleForPath(pathname)
  if (!m) return false
  if (m.key === 'users') return can('users.manage')
  if (!can(`${m.key}.view`)) return false
  const keys = PERMISSION_GROUPS.find(g => g.key === m.key).perms.map(([k]) => k)
  const need = (verb) => keys.includes(`${m.key}.${verb}`) ? `${m.key}.${verb}` : `${m.key}.manage`
  if (/\/new$/.test(pathname)) return can(need('add'))
  if (/\/edit\//.test(pathname)) return can(need('edit'))
  return true
}

// The one page a Document Dept login works on.
const DOC_DEPT_HOME = '/admin/document-department'

function TopBar() {
  const { profile, user, signOut, can } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [q, setQ] = useState('')
  const [pwOpen, setPwOpen] = useState(false)
  const role = profile?.role || user?.user_metadata?.role || 'admin'

  // Enter in the header search jumps to this role's student list, which picks
  // the term up from ?q= — the input used to be a dead control.
  const searchTarget =
    role === 'center' ? '/center/students' :
    role === 'super_center' ? '/super-center/students' :
    '/admin/students'
  const runSearch = () => {
    const term = q.trim()
    if (!term) return
    navigate(`${searchTarget}?q=${encodeURIComponent(term)}`)
    setQ('')
  }
  const name = profile?.full_name ||
    (role === 'admin' ? 'Admin User' :
     role === 'super_center' ? 'Super Center' :
     role === 'center' ? 'Center User' :
     role === 'document_dept' ? 'Document Dept' :
     role === 'staff' ? 'Staff User' :
     user?.email || 'User')

  // Where the "Profile" item navigates, per role
  const profilePath =
    role === 'center' ? '/center/profile' :
    role === 'student' ? '/student/profile' :
    role === 'super_center' ? '/super-center/profile' :
    role === 'document_dept' ? DOC_DEPT_HOME :
    role === 'staff' ? (firstAllowedPath(can) || '/dashboard') :
    '/dashboard'

  // Close the dropdown when clicking outside of it
  useEffect(() => {
    if (!menuOpen) return
    const close = (e) => { if (!e.target.closest('[data-settings-menu]')) setMenuOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [menuOpen])

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="h-20 flex items-center justify-between px-8 border-b border-gray-100 bg-white">
      <div className="flex-1 max-w-xl">
        {/* The header search opens the Students list — not part of the
            Document Dept login's view. */}
        {role !== 'document_dept' && (role !== 'staff' || can('students.view')) && (
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && runSearch()}
            placeholder="Search students — name / application no / enrollment…"
            className="w-full bg-white border border-gray-100 rounded-2xl py-2.5 pl-11 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#933d18]/20 focus:border-[#933d18] transition-all shadow-sm"
          />
        </div>
        )}
      </div>
      <div className="flex items-center space-x-6">
        {/* No notifications system exists yet — a permanent red "unread" dot
            here promised alerts that could never be opened. */}
        <button className="p-2.5 bg-white border border-gray-100 rounded-xl text-gray-500 hover:text-[#933d18] hover:border-[#933d18]/20 transition-all shadow-sm relative">
          <Bell size={18} />
        </button>

        {/* Account / Settings dropdown */}
        <div className="relative pl-4 border-l border-gray-200" data-settings-menu>
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="flex items-center space-x-3 group"
          >
            <div className="flex flex-col items-end mr-1">
              <span className="text-sm font-bold text-gray-900">{name}</span>
              <span className="text-[10px] font-medium text-gray-400 capitalize">
                {role === 'super_center' ? 'Super Center' : role === 'admin' ? 'Admin' : role === 'document_dept' ? 'Document Verification' : role === 'staff' ? 'Staff' : role}
              </span>
            </div>
            <div className="h-10 w-10 bg-[#933d18] rounded-xl flex items-center justify-center border border-[#933d18]/20 shadow-sm">
              <span className="text-white font-bold text-sm">{name[0]?.toUpperCase()}</span>
            </div>
            <ChevronDown size={16} className={`text-gray-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-[60px] z-30 w-60 bg-white border border-gray-100 rounded-xl shadow-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50">
                <p className="text-sm font-semibold text-gray-900 truncate">{name}</p>
                <p className="text-[11px] text-gray-400 truncate">{user?.email}</p>
              </div>
              <button
                onClick={() => { setMenuOpen(false); navigate(profilePath) }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all"
              >
                <User size={15} className="text-gray-400" /> Profile
              </button>
              <button
                onClick={() => { setMenuOpen(false); setPwOpen(true) }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all"
              >
                <KeyRound size={15} className="text-gray-400" /> Change Password
              </button>
              <button
                onClick={() => { setMenuOpen(false); handleSignOut() }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-all"
              >
                <LogOut size={15} className="text-red-400" /> Logout
              </button>
            </div>
          )}
        </div>
      </div>
      <ChangePasswordModal isOpen={pwOpen} onClose={() => setPwOpen(false)} email={user?.email} />
    </div>
  )
}

export default function AppLayout() {
  const { user, profile, loading, can, signOut } = useAuth()
  const location = useLocation()
  // Signed out after 15 minutes with no use — every portal login.
  const idle = useIdleLogout({
    enabled: !!user,
    storageKey: 'idle:portal',
    onTimeout: () => signOut(),
  })

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#933d18] border-t-transparent shadow-lg" />
    </div>
  )

  if (!user) return <Navigate to="/login" replace />

  // A Document Dept login is kept on its own page — the database already
  // refuses it anything else, but the other admin screens would just open
  // empty or broken.
  if (profile?.role === 'document_dept' && location.pathname !== DOC_DEPT_HOME) {
    return <Navigate to={DOC_DEPT_HOME} replace />
  }

  // A staff login only goes where its role allows; anywhere else sends it to
  // the first page it may open. The database refuses the rest regardless.
  if (profile?.role === 'staff' && !staffMayOpen(location.pathname, can)) {
    const home = firstAllowedPath(can)
    if (home && home !== location.pathname) return <Navigate to={home} replace />
    if (!home) return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="max-w-sm text-center space-y-2">
          <p className="text-lg font-bold text-gray-900">No access yet</p>
          <p className="text-sm text-gray-500">Your login has no permissions. Ask the admin to give your role access in User Management.</p>
          <button onClick={() => signOut()} className="mt-3 text-sm font-semibold text-[#933d18] underline">Sign out</button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <IdleWarning secondsLeft={idle.secondsLeft} onStay={idle.stay} />
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
