import { NavLink, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import {
  University, BookOpen, Building2, Users, FolderOpen,
  Award, CalendarDays, MapPin, LogOut,
  LayoutDashboard, Wallet, Star, ClipboardCheck, Settings, PlusCircle
} from 'lucide-react'

const adminLinks = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/location', icon: MapPin, label: 'Location' },
  { to: '/admin/universities', icon: University, label: 'Universities' },
  { to: '/admin/sessions', icon: CalendarDays, label: 'Sessions' },
  { to: '/admin/departments', icon: FolderOpen, label: 'Departments' },
  { to: '/admin/programs', icon: BookOpen, label: 'Programs' },
  { to: '/admin/schemes', icon: Award, label: 'Schemes' },
  { to: '/admin/super-centers', icon: Star, label: 'Super Centers' },
  { to: '/admin/centers', icon: Building2, label: 'Centers' },
  { to: '/admin/students', icon: Users, label: 'Students' },
  { to: '/admin/account-department', icon: Wallet, label: 'Account Dept.' },
]

const superCenterLinks = [
  { to: '/super-center/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/super-center/centers', icon: Building2, label: 'My Centers' },
  { to: '/super-center/students', icon: Users, label: 'Students' },
  { to: '/super-center/programs', icon: BookOpen, label: 'Programs' },
  { to: '/super-center/balance', icon: Wallet, label: 'Virtual Balance' },
]

const centerLinks = [
  { to: '/center/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/center/students', icon: Users, label: 'Students' },
  { to: '/center/programs', icon: BookOpen, label: 'Programs' },
  { to: '/center/balance', icon: Wallet, label: 'Virtual Balance' },
  { to: '/center/settings', icon: Settings, label: 'Settings' },
]

const studentLinks = [
  { to: '/student/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
]

export default function Sidebar() {
  const { profile, user, signOut } = useAuth()
  const navigate = useNavigate()
  const [centerName, setCenterName] = useState('')

  const role = profile?.role || user?.user_metadata?.role || 'admin'

  useEffect(() => {
    if ((role === 'super_center' || role === 'center') && user?.email) {
      supabase.from('centers').select('center_name').eq('email', user.email).single()
        .then(({ data }) => { if (data) setCenterName(data.center_name) })
    }
  }, [role, user?.email])
  const links =
    role === 'admin' ? adminLinks :
    role === 'super_center' ? superCenterLinks :
    role === 'center' ? centerLinks :
    studentLinks

  const roleLabel =
    role === 'admin' ? 'Administration' :
    role === 'super_center' ? 'Super Center Portal' :
    role === 'center' ? 'Center Portal' :
    'Student Portal'

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-100 w-64 shrink-0">

      {/* Brand */}
      <div className="p-5 flex items-center space-x-3 border-b border-gray-50">
        <div className="h-10 w-10 bg-[#933d18] rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
          <img src="/assets/logo.png" alt="Logo" className="w-7 h-7 object-contain"
            onError={e => { e.target.style.display = 'none'; e.target.parentNode.innerHTML = '<span style="color:white;font-weight:900;font-size:1.1rem">S</span>' }} />
        </div>
        <div>
          <h1 className="text-base font-black text-gray-900 leading-tight truncate max-w-[160px]">
            {role === 'super_center' || role === 'center' ? (centerName || 'My Portal') : 'Sengol'}
          </h1>
          <span className="text-[10px] font-bold text-[#933d18] uppercase tracking-[0.2em]">
            {role === 'super_center' ? 'Super Center' : role === 'center' ? 'Center' : 'University'}
          </span>
        </div>
      </div>

      {/* Nav */}
      <div className="flex-1 px-3 py-4 overflow-y-auto">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 mb-2">{roleLabel}</p>
        <nav className="space-y-0.5">
          {links.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-150 gap-3 ${
                  isActive
                    ? 'bg-[#933d18] text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={16} className={isActive ? 'text-white/80' : 'text-gray-400'} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Bottom */}
      <div className="p-3 border-t border-gray-50">
        <div className="px-3 py-2 mb-1">
          <p className="text-sm font-semibold text-gray-900 truncate">
            {profile?.full_name || (role === 'admin' ? 'Admin User' : role === 'super_center' ? 'Super Center' : 'Center User')}
          </p>
          <p className="text-[10px] font-medium text-gray-400 capitalize mt-0.5">
            {role === 'super_center' ? 'Super Center' : role}
          </p>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 w-full px-3 py-2.5 text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all"
        >
          <LogOut size={16} className="text-gray-400" />
          Sign Out
        </button>
      </div>
    </div>
  )
}
