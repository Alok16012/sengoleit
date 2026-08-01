import { useState, useRef, useEffect } from 'react'
import { Outlet, Navigate, NavLink, useNavigate } from 'react-router-dom'
import { useStudentAuth } from '../../context/StudentAuthContext'
import { fetchStudentSelf } from '../../utils/studentSelf'
import { supabase } from '../../lib/supabase'
import { isPhdProgram } from '../../utils/generateStudentCards'
import { LayoutDashboard, User, IndianRupee, GraduationCap, LogOut, Bell, ClipboardList, Receipt, CreditCard, BadgeCheck, MonitorPlay, BookMarked, BookOpenCheck, Settings, Menu, FileCheck2, ShieldCheck, Ticket } from 'lucide-react'

const baseNavItems = [
  { to: '/student/dashboard',        icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/student/profile',          icon: User,            label: 'My Profile' },
  // Fee Details is hidden from students by university policy — fees are
  // handled through the center. (Route still exists if it ever comes back.)
  { to: '/student/admission-form',   icon: ClipboardList,   label: 'Admission Form' },
  { to: '/student/registration-slip',icon: Receipt,         label: 'Registration Slip' },
  { to: '/student/id-card',          icon: CreditCard,      label: 'I Card' },
  { to: '/student/admit-card',       icon: BadgeCheck,      label: 'Admit Card' },
  { to: '/student/results',          icon: GraduationCap,   label: 'Results' },
  // Online Exam is an unbuilt "Coming Soon" shell — hidden from the menu
  // until it exists (its route remains for when it's ready).
  { to: '/student/syllabus',         icon: BookMarked,      label: 'Syllabus' },
  { to: '/student/ebook',            icon: BookOpenCheck,   label: 'E-Book' },
]

// Ph.D-only documents, inserted after the I Card entry. The Hall Ticket comes
// first — it is issued before the entrance exam, ahead of the other letters.
const phdNavItems = [
  { to: '/student/hall-ticket',         icon: Ticket,      label: 'Hall Ticket' },
  { to: '/student/offer-letter',        icon: FileCheck2,  label: 'Offer Letter' },
  { to: '/student/entrance-clearance',  icon: ShieldCheck, label: 'Entrance Clearance' },
]

export default function StudentLayout() {
  const { student, loading, studentLogout } = useStudentAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isPhd, setIsPhd] = useState(false)
  // Until the row loads, assume enrolled so an enrolled student's menu doesn't flicker.
  const [hasEnrollment, setHasEnrollment] = useState(true)
  const menuRef = useRef(null)

  useEffect(() => {
    const onClick = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  // Ph.D students get extra document menu items (Offer Letter, Entrance Clearance).
  useEffect(() => {
    if (!student?.id) return
    fetchStudentSelf()
      .then((data) => {
        setIsPhd(isPhdProgram(data?.programs?.program_name))
        setHasEnrollment(!!String(data?.enrollment_no || '').trim())
      })
  }, [student?.id])

  // Ph.D research pipeline: no registration slip (that document was dropped),
  // plus the offer letter / entrance clearance entries after the I Card.
  // The I Card itself is an enrolled student's document — the menu entry only
  // appears once the enrollment number has been issued.
  const navItems = (() => {
    let items = baseNavItems
    if (isPhd) {
      items = items.filter(n => n.to !== '/student/registration-slip')
      const at = items.findIndex(n => n.to === '/student/id-card') + 1
      items = [...items.slice(0, at), ...phdNavItems, ...items.slice(at)]
    }
    if (!hasEnrollment) items = items.filter(n => n.to !== '/student/id-card')
    return items
  })()

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-8 h-8 border-4 border-[#933d18] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!student) return <Navigate to="/student/login" replace />

  const handleLogout = () => {
    studentLogout()
    navigate('/student/login')
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <div className={`flex flex-col h-full bg-white border-r border-gray-100 shrink-0 overflow-hidden transition-all duration-200 ${sidebarOpen ? 'w-64' : 'w-0 border-r-0'}`}>
        <div className="p-5 flex items-center space-x-3 border-b border-gray-50">
          <div className="h-10 w-10 bg-[#933d18] rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
            <img src="/assets/logo.png" alt="Logo" className="w-7 h-7 object-contain"
              onError={e => { e.target.style.display = 'none'; e.target.parentNode.innerHTML = '<span style="color:white;font-weight:900;font-size:1.1rem">S</span>' }} />
          </div>
          <div>
            <h1 className="text-base font-black text-gray-900 leading-tight">Sengol</h1>
            <span className="text-[10px] font-bold text-[#933d18] uppercase tracking-[0.2em]">Student Portal</span>
          </div>
        </div>

        <div className="flex-1 px-3 py-4 overflow-y-auto">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-3 mb-2">Menu</p>
          <nav className="space-y-0.5">
            {navItems.map(({ to, icon: Icon, label }) => (
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

        <div className="p-3 border-t border-gray-50">
          <div className="px-3 py-2 mb-1">
            <p className="text-sm font-semibold text-gray-900 truncate">{student.student_name}</p>
            <p className="text-[10px] font-medium text-gray-400 mt-0.5 font-mono">{student.enrollment_no}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all"
          >
            <LogOut size={16} className="text-gray-400" />
            Sign Out
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="h-16 flex items-center justify-between px-8 border-b border-gray-100 bg-white shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(o => !o)}
              title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
              className="p-2 -ml-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-[#933d18] transition-all"
            >
              <Menu size={20} />
            </button>
            <div>
              <p className="text-sm font-bold text-gray-900">{student.student_name}</p>
              <p className="text-xs text-gray-400 font-mono">{student.enrollment_no}</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <button className="p-2.5 bg-white border border-gray-100 rounded-xl text-gray-500 hover:text-[#933d18] hover:border-[#933d18]/20 transition-all shadow-sm">
              <Bell size={18} />
            </button>
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(o => !o)}
                className="h-9 w-9 bg-[#933d18] rounded-xl flex items-center justify-center shadow-sm hover:opacity-90 transition-opacity"
              >
                <span className="text-white font-bold text-sm">{student.student_name[0]?.toUpperCase()}</span>
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl border border-gray-100 shadow-lg py-1.5 z-50">
                  <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-50">
                    <User size={15} className="text-gray-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{student.student_name}</p>
                      <p className="text-[10px] font-medium text-gray-400 font-mono">{student.enrollment_no}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setMenuOpen(false); navigate('/student/settings') }}
                    className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    <Settings size={15} className="text-gray-400" /> Settings
                  </button>
                  <button
                    onClick={() => { setMenuOpen(false); handleLogout() }}
                    className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut size={15} className="text-red-400" /> Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
