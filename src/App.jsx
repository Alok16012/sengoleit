import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { StudentAuthProvider } from './context/StudentAuthContext'
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
import DocumentDepartment from './pages/admin/DocumentDepartment'
import FeeManagement from './pages/admin/FeeManagement'
import Boards from './pages/admin/Boards'

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
import StudentListReport from './pages/shared/StudentListReport'
import ComingSoon from './pages/shared/ComingSoon'

// Student
import StudentLogin from './pages/student/StudentLogin'
import StudentLayout from './pages/student/StudentLayout'
import StudentDashboard from './pages/student/StudentDashboard'
import StudentProfile from './pages/student/StudentProfile'
import StudentFees from './pages/student/StudentFees'
import StudentDocuments from './pages/student/StudentDocuments'
import StudentResults from './pages/student/StudentResults'

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
      <StudentAuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Student portal — separate auth (enrollment no + password) */}
          <Route path="/student/login" element={<StudentLogin />} />
          <Route element={<StudentLayout />}>
            <Route path="/student/dashboard" element={<StudentDashboard />} />
            <Route path="/student/profile" element={<StudentProfile />} />
            <Route path="/student/fees" element={<StudentFees />} />
            <Route path="/student/documents" element={<StudentDocuments />} />
            <Route path="/student/results" element={<StudentResults />} />
          </Route>

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
            <Route path="/admin/document-department" element={<DocumentDepartment />} />
            <Route path="/admin/fee-management" element={<FeeManagement />} />
            <Route path="/admin/boards" element={<Boards />} />

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

            {/* Super Center new entry routes */}
            <Route path="/super-center/documents" element={<ComingSoon title="Student Documents" description="Student document upload and management" />} />
            <Route path="/super-center/courier" element={<ComingSoon title="Courier Entry" description="Log courier dispatch entries" />} />
            <Route path="/super-center/answersheet" element={<ComingSoon title="Student Answersheet" description="Answersheet submission and tracking" />} />
            <Route path="/super-center/supplementary" element={<ComingSoon title="Supplementary Student" description="Supplementary exam registration" />} />

            {/* Super Center report routes */}
            <Route path="/super-center/reports/pending" element={<StudentListReport status="Pending" />} />
            <Route path="/super-center/reports/hold" element={<StudentListReport status="Hold" />} />
            <Route path="/super-center/reports/approved" element={<StudentListReport status="Approved" />} />
            <Route path="/super-center/reports/rejected" element={<StudentListReport status="Rejected" />} />
            <Route path="/super-center/reports/document-summary" element={<ComingSoon title="Document Summary" description="Summary of submitted student documents" />} />
            <Route path="/super-center/reports/payment-summary" element={<ComingSoon title="Payment Summary" description="Summary of student fee payments" />} />
            <Route path="/super-center/reports/courier-summary" element={<ComingSoon title="Center Courier Summary" description="Courier dispatch summary for centers" />} />
            <Route path="/super-center/reports/university-courier" element={<ComingSoon title="University Courier" description="Courier dispatches to university" />} />
            <Route path="/super-center/reports/course-fee" element={<ComingSoon title="Center Course Fee" description="Course fee structure per center" />} />
            <Route path="/super-center/reports/syllabus" element={<ComingSoon title="Syllabus" description="Program syllabus and curriculum" />} />
            <Route path="/super-center/reports/credentials" element={<ComingSoon title="Credentials" description="Student credentials and certificates" />} />
            <Route path="/super-center/reports/progress" element={<ComingSoon title="Student Progress" description="Academic progress tracking" />} />
            <Route path="/super-center/reports/wallet-coupon" element={<ComingSoon title="Wallet Coupon" description="Wallet coupon management" />} />
            <Route path="/super-center/reports/admission-coupon" element={<ComingSoon title="Admission Coupon" description="Admission coupon management" />} />

            {/* Center portal */}
            <Route path="/center/dashboard" element={<CenterDashboard />} />
            <Route path="/center/students" element={<CenterStudents />} />
            <Route path="/center/students/new" element={<StudentForm />} />
            <Route path="/center/students/edit/:id" element={<StudentForm />} />
            <Route path="/center/programs" element={<ProgramsView />} />
            <Route path="/center/balance" element={<BalanceView />} />
            <Route path="/center/settings" element={<CenterSettings />} />
            <Route path="/center/documents" element={<ComingSoon title="Student Documents" description="Student document upload and management" />} />
            <Route path="/center/courier" element={<ComingSoon title="Courier Entry" description="Log courier dispatch entries" />} />
            <Route path="/center/answersheet" element={<ComingSoon title="Student Answersheet" description="Answersheet submission and tracking" />} />
            <Route path="/center/supplementary" element={<ComingSoon title="Supplementary Student" description="Supplementary exam registration" />} />

            {/* Center report routes */}
            <Route path="/center/reports/pending" element={<StudentListReport status="Pending" />} />
            <Route path="/center/reports/hold" element={<StudentListReport status="Hold" />} />
            <Route path="/center/reports/approved" element={<StudentListReport status="Approved" />} />
            <Route path="/center/reports/rejected" element={<StudentListReport status="Rejected" />} />
            <Route path="/center/reports/document-summary" element={<ComingSoon title="Document Summary" description="Summary of submitted student documents" />} />
            <Route path="/center/reports/payment-summary" element={<ComingSoon title="Payment Summary" description="Summary of student fee payments" />} />
            <Route path="/center/reports/courier-summary" element={<ComingSoon title="Center Courier Summary" description="Courier dispatch summary for centers" />} />
            <Route path="/center/reports/university-courier" element={<ComingSoon title="University Courier" description="Courier dispatches to university" />} />
            <Route path="/center/reports/course-fee" element={<ComingSoon title="Center Course Fee" description="Course fee structure per center" />} />
            <Route path="/center/reports/syllabus" element={<ComingSoon title="Syllabus" description="Program syllabus and curriculum" />} />
            <Route path="/center/reports/credentials" element={<ComingSoon title="Credentials" description="Student credentials and certificates" />} />
            <Route path="/center/reports/progress" element={<ComingSoon title="Student Progress" description="Academic progress tracking" />} />
            <Route path="/center/reports/wallet-coupon" element={<ComingSoon title="Wallet Coupon" description="Wallet coupon management" />} />
            <Route path="/center/reports/admission-coupon" element={<ComingSoon title="Admission Coupon" description="Admission coupon management" />} />

          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      </StudentAuthProvider>
    </AuthProvider>
  )
}
