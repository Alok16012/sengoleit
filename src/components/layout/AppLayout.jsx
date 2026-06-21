import { Outlet, Navigate, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import Sidebar from './Sidebar'
import { Search, Bell, User, LogOut, ChevronDown } from 'lucide-react'

function TopBar() {
  const { profile, user, signOut } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const role = profile?.role || user?.user_metadata?.role || 'admin'
  const name = profile?.full_name ||
    (role === 'admin' ? 'Admin User' :
     role === 'super_center' ? 'Super Center' :
     role === 'center' ? 'Center User' :
     user?.email || 'User')

  // Where the "Profile" item navigates, per role
  const profilePath =
    role === 'center' ? '/center/settings' :
    role === 'student' ? '/student/profile' :
    role === 'super_center' ? '/super-center/dashboard' :
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
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search..."
            className="w-full bg-white border border-gray-100 rounded-2xl py-2.5 pl-11 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#933d18]/20 focus:border-[#933d18] transition-all shadow-sm"
          />
        </div>
      </div>
      <div className="flex items-center space-x-6">
        <button className="p-2.5 bg-white border border-gray-100 rounded-xl text-gray-500 hover:text-[#933d18] hover:border-[#933d18]/20 transition-all shadow-sm relative">
          <Bell size={18} />
          <span className="absolute top-2.5 right-2.5 h-2 w-2 bg-red-500 border-2 border-white rounded-full" />
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
                {role === 'super_center' ? 'Super Center' : role === 'admin' ? 'Admin' : role}
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
                onClick={() => { setMenuOpen(false); handleSignOut() }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-all"
              >
                <LogOut size={15} className="text-red-400" /> Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AppLayout() {
  const { user, loading } = useAuth()

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#933d18] border-t-transparent shadow-lg" />
    </div>
  )

  if (!user) return <Navigate to="/login" replace />

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
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
