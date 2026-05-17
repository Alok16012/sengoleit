import { NavLink, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import {
  University, BookOpen, Building2, Users, FolderOpen,
  Award, CalendarDays, MapPin, LogOut,
  LayoutDashboard, Wallet, Star, Settings,
  UserPlus, FileText, Truck, FileCheck, UserCheck,
  Clock, CheckCircle, XCircle, ClipboardList, CreditCard,
  GraduationCap, ScrollText, BadgeCheck, TrendingUp, Ticket, Tag,
  ChevronDown, ChevronRight, ShieldCheck, IndianRupee
} from 'lucide-react'

const adminLinks = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/location', icon: MapPin, label: 'Location' },
  { to: '/admin/universities', icon: University, label: 'Universities' },
  { to: '/admin/sessions', icon: CalendarDays, label: 'Sessions' },
  { to: '/admin/departments', icon: FolderOpen, label: 'Departments' },
  { to: '/admin/programs', icon: BookOpen, label: 'Programs' },
  { to: '/admin/boards', icon: ScrollText, label: 'Boards & Univ.' },
  { to: '/admin/schemes', icon: Award, label: 'Schemes' },
  { to: '/admin/super-centers', icon: Star, label: 'Super Centers' },
  { to: '/admin/centers', icon: Building2, label: 'Centers' },
  { to: '/admin/students', icon: Users, label: 'Students' },
  { to: '/admin/document-department', icon: ShieldCheck, label: 'Document Dept.' },
  { to: '/admin/account-department', icon: Wallet, label: 'Account Dept.' },
  { to: '/admin/fee-management', icon: IndianRupee, label: 'Fee Management' },
]

const reportItems = (base) => [
  { to: `${base}/reports/pending`, icon: Clock, label: 'Pending Student List' },
  { to: `${base}/reports/hold`, icon: ClipboardList, label: 'Hold Student List' },
  { to: `${base}/reports/approved`, icon: CheckCircle, label: 'Approved Student List' },
  { to: `${base}/reports/rejected`, icon: XCircle, label: 'Rejected Student List' },
  { to: `${base}/reports/document-summary`, icon: FileText, label: 'Document Summary' },
  { to: `${base}/reports/payment-summary`, icon: CreditCard, label: 'Payment Summary' },
  { to: `${base}/balance`, icon: Wallet, label: 'Wallet Summary' },
  { to: `${base}/reports/courier-summary`, icon: Truck, label: 'Center Courier Summary' },
  { to: `${base}/reports/university-courier`, icon: Truck, label: 'University Courier' },
  { to: `${base}/reports/course-fee`, icon: GraduationCap, label: 'Center Course Fee' },
  { to: `${base}/reports/syllabus`, icon: ScrollText, label: 'Syllabus' },
  { to: `${base}/reports/credentials`, icon: BadgeCheck, label: 'Credentials' },
  { to: `${base}/reports/progress`, icon: TrendingUp, label: 'Student Progress' },
  { to: `${base}/reports/wallet-coupon`, icon: Ticket, label: 'Wallet Coupon' },
  { to: `${base}/reports/admission-coupon`, icon: Tag, label: 'Admission Coupon' },
]

const superCenterNavGroups = [
  { items: [{ to: '/super-center/dashboard', icon: LayoutDashboard, label: 'Dashboard' }] },
  {
    group: 'Entry',
    items: [
      { to: '/super-center/students/new', icon: UserPlus, label: 'Student Entry', end: true },
      { to: '/super-center/students', icon: Users, label: 'Registered Student List', end: true },
      { to: '/super-center/balance', icon: Wallet, label: 'Payment Deposit' },
      { to: '/super-center/documents', icon: FileText, label: 'Student Documents' },
      { to: '/super-center/courier', icon: Truck, label: 'Courier Entry' },
      { to: '/super-center/answersheet', icon: FileCheck, label: 'Student Answersheet' },
      { to: '/super-center/supplementary', icon: UserCheck, label: 'Supplementary Student' },
    ],
  },
  {
    group: 'Reports',
    items: reportItems('/super-center'),
  },
]

const centerNavGroups = [
  { items: [{ to: '/center/dashboard', icon: LayoutDashboard, label: 'Dashboard' }] },
  {
    group: 'Entry',
    items: [
      { to: '/center/students/new', icon: UserPlus, label: 'Student Entry', end: true },
      { to: '/center/students', icon: Users, label: 'Registered Student List', end: true },
      { to: '/center/balance', icon: Wallet, label: 'Payment Deposit' },
      { to: '/center/documents', icon: FileText, label: 'Student Documents' },
      { to: '/center/courier', icon: Truck, label: 'Courier Entry' },
      { to: '/center/answersheet', icon: FileCheck, label: 'Student Answersheet' },
      { to: '/center/supplementary', icon: UserCheck, label: 'Supplementary Student' },
    ],
  },
  {
    group: 'Reports',
    items: reportItems('/center'),
  },
  { items: [{ to: '/center/settings', icon: Settings, label: 'Settings' }] },
]

const studentNavGroups = [
  { items: [{ to: '/student/dashboard', icon: LayoutDashboard, label: 'Dashboard' }] },
]

export default function Sidebar() {
  const { profile, user, signOut } = useAuth()
  const navigate = useNavigate()
  const [centerName, setCenterName] = useState('')

  const role = profile?.role || user?.user_metadata?.role || 'admin'
  const [collapsed, setCollapsed] = useState({})

  const toggleGroup = (group) =>
    setCollapsed(prev => ({ ...prev, [group]: !prev[group] }))

  useEffect(() => {
    if ((role === 'super_center' || role === 'center') && user?.email) {
      supabase.from('centers').select('center_name').eq('email', user.email).single()
        .then(({ data }) => { if (data) setCenterName(data.center_name) })
    }
  }, [role, user?.email])

  const navGroups =
    role === 'admin' ? [{ items: adminLinks }] :
    role === 'super_center' ? superCenterNavGroups :
    role === 'center' ? centerNavGroups :
    studentNavGroups

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
        <nav>
          {navGroups.map((section, idx) => {
            const isCollapsed = section.group ? !!collapsed[section.group] : false
            return (
              <div key={idx}>
                {section.group && (
                  <button
                    onClick={() => toggleGroup(section.group)}
                    className="w-full flex items-center justify-between px-3 pt-4 pb-1.5 group"
                  >
                    <span className="text-[9px] font-extrabold text-[#933d18]/60 uppercase tracking-[0.18em] group-hover:text-[#933d18]/90 transition-colors">
                      {section.group}
                    </span>
                    {isCollapsed
                      ? <ChevronRight size={12} className="text-[#933d18]/40 group-hover:text-[#933d18]/80 transition-colors" />
                      : <ChevronDown size={12} className="text-[#933d18]/40 group-hover:text-[#933d18]/80 transition-colors" />
                    }
                  </button>
                )}
                {!isCollapsed && (
                  <div className="space-y-0.5">
                    {section.items.map(({ to, icon: Icon, label, end }) => (
                      <NavLink
                        key={to}
                        to={to}
                        end={end}
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
                  </div>
                )}
              </div>
            )
          })}
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
