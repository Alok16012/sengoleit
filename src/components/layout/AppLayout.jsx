import { Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Sidebar from './Sidebar'
import { Search, Bell } from 'lucide-react'

function TopBar() {
  const { profile } = useAuth()
  const role = profile?.role || 'admin'
  const name = profile?.full_name || (role === 'admin' ? 'Admin User' : 'Center User')

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
        <div className="flex items-center space-x-3 pl-4 border-l border-gray-200">
          <div className="flex flex-col items-end mr-1">
            <span className="text-sm font-bold text-gray-900">{name}</span>
            <span className="text-[10px] font-medium text-gray-400 capitalize">{role}</span>
          </div>
          <div className="h-10 w-10 bg-[#933d18] rounded-xl flex items-center justify-center border border-[#933d18]/20 shadow-sm">
            <span className="text-white font-bold text-sm">{name[0]?.toUpperCase()}</span>
          </div>
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
