import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import AppLayout from './components/layout/AppLayout'

import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import Dashboard from './pages/Dashboard'

// Admin
import Universities from './pages/admin/Universities'
import UniversityForm from './pages/admin/UniversityForm'
import Programs from './pages/admin/Programs'
import ProgramForm from './pages/admin/ProgramForm'
import SuperCenters from './pages/admin/SuperCenters'
import Centers from './pages/admin/Centers'
import CenterForm from './pages/admin/CenterForm'
import Students from './pages/admin/Students'
import StudentForm from './pages/admin/StudentForm'
import Departments from './pages/admin/Departments'
import Schemes from './pages/admin/Schemes'
import SchemeForm from './pages/admin/SchemeForm'
import Sessions from './pages/admin/Sessions'
import SessionForm from './pages/admin/SessionForm'
import Location from './pages/admin/Location'
import AccountDepartment from './pages/admin/AccountDepartment'

// Super Center portal
import SuperCenterDashboard from './pages/super-center/SuperCenterDashboard'
import MyCenters from './pages/super-center/MyCenters'
import SubCenterForm from './pages/super-center/SubCenterForm'
import SuperCenterStudents from './pages/super-center/SuperCenterStudents'

// Center portal
import CenterDashboard from './pages/center/CenterDashboard'
import CenterStudents from './pages/center/CenterStudents'
import CenterSettings from './pages/center/CenterSettings'

// Shared
import ProgramsView from './pages/shared/ProgramsView'
import BalanceView from './pages/shared/BalanceView'

// Student
import StudentDashboard from './pages/student/StudentDashboard'

function RoleRedirect() {
  const { profile, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-8 h-8 border-4 border-[#933d18] border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (profile?.role === 'super_center') return <Navigate to="/super-center/dashboard" replace />
  if (profile?.role === 'center') return <Navigate to="/center/dashboard" replace />
  if (profile?.role === 'student') return <Navigate to="/student/dashboard" replace />
  return <Navigate to="/dashboard" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route element={<AppLayout />}>
            <Route path="/" element={<RoleRedirect />} />
            <Route path="/dashboard" element={<Dashboard />} />

            {/* Admin routes */}
            <Route path="/admin/universities" element={<Universities />} />
            <Route path="/admin/universities/new" element={<UniversityForm />} />
            <Route path="/admin/universities/edit/:id" element={<UniversityForm />} />

            <Route path="/admin/programs" element={<Programs />} />
            <Route path="/admin/programs/new" element={<ProgramForm />} />
            <Route path="/admin/programs/edit/:id" element={<ProgramForm />} />

            <Route path="/admin/super-centers" element={<SuperCenters />} />
            <Route path="/admin/super-centers/new" element={<CenterForm />} />
            <Route path="/admin/super-centers/edit/:id" element={<CenterForm />} />

            <Route path="/admin/centers" element={<Centers />} />
            <Route path="/admin/centers/new" element={<CenterForm />} />
            <Route path="/admin/centers/edit/:id" element={<CenterForm />} />

            <Route path="/admin/students" element={<Students />} />
            <Route path="/admin/students/new" element={<StudentForm />} />
            <Route path="/admin/students/edit/:id" element={<StudentForm />} />

            <Route path="/admin/departments" element={<Departments />} />

            <Route path="/admin/schemes" element={<Schemes />} />
            <Route path="/admin/schemes/new" element={<SchemeForm />} />
            <Route path="/admin/schemes/edit/:id" element={<SchemeForm />} />

            <Route path="/admin/sessions" element={<Sessions />} />
            <Route path="/admin/sessions/new" element={<SessionForm />} />
            <Route path="/admin/sessions/edit/:id" element={<SessionForm />} />

            <Route path="/admin/location" element={<Location />} />
            <Route path="/admin/account-department" element={<AccountDepartment />} />

            {/* Super Center portal */}
            <Route path="/super-center/dashboard" element={<SuperCenterDashboard />} />
            <Route path="/super-center/centers" element={<MyCenters />} />
            <Route path="/super-center/centers/new" element={<SubCenterForm />} />
            <Route path="/super-center/centers/edit/:id" element={<SubCenterForm />} />
            <Route path="/super-center/students" element={<SuperCenterStudents />} />
            <Route path="/super-center/students/new" element={<StudentForm />} />
            <Route path="/super-center/students/edit/:id" element={<StudentForm />} />
            <Route path="/super-center/programs" element={<ProgramsView />} />
            <Route path="/super-center/balance" element={<BalanceView />} />

            {/* Center portal */}
            <Route path="/center/dashboard" element={<CenterDashboard />} />
            <Route path="/center/students" element={<CenterStudents />} />
            <Route path="/center/students/new" element={<StudentForm />} />
            <Route path="/center/students/edit/:id" element={<StudentForm />} />
            <Route path="/center/programs" element={<ProgramsView />} />
            <Route path="/center/balance" element={<BalanceView />} />
            <Route path="/center/settings" element={<CenterSettings />} />

            {/* Student portal */}
            <Route path="/student/dashboard" element={<StudentDashboard />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
