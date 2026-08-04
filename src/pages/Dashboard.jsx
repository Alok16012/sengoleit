import { useEffect, useState } from 'react'
import { supabase, isConfigured } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { University, BookOpen, Building2, Users, Star } from 'lucide-react'

const statCards = [
  { key: 'universities', label: 'Universities', icon: University, bg: 'bg-blue-100', color: 'text-blue-600' },
  { key: 'programs', label: 'Programs', icon: BookOpen, bg: 'bg-purple-100', color: 'text-purple-600' },
  // Counted apart, because they are separate things with separate pages —
  // one "Centers: 13" was the two added together and matched neither list.
  { key: 'superCenters', label: 'Super Centers', icon: Star, bg: 'bg-indigo-100', color: 'text-indigo-600' },
  { key: 'centers', label: 'Centers', icon: Building2, bg: 'bg-green-100', color: 'text-green-600' },
  { key: 'students', label: 'Students', icon: Users, bg: 'bg-orange-100', color: 'text-orange-600' },
]

export default function Dashboard() {
  const { profile } = useAuth()
  const [stats, setStats] = useState({})

  useEffect(() => {
    if (!isConfigured) return
    Promise.all([
      supabase.from('universities').select('id', { count: 'exact', head: true }),
      supabase.from('programs').select('id', { count: 'exact', head: true }),
      // Same filters the Centers and Super Centers pages use, so the cards and
      // those lists always report the same number.
      supabase.from('centers').select('id', { count: 'exact', head: true }).eq('center_type', 'center'),
      supabase.from('centers').select('id', { count: 'exact', head: true }).eq('center_type', 'super_center'),
      supabase.from('students').select('id', { count: 'exact', head: true }),
    ]).then(([u, p, c, sc, s]) => {
      setStats({
        universities: u.count ?? 0, programs: p.count ?? 0,
        centers: c.count ?? 0, superCenters: sc.count ?? 0,
        students: s.count ?? 0,
      })
    })
  }, [])

  return (
    <div className="space-y-8 p-8">

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        {statCards.map(({ key, label, icon: Icon, bg, color }) => (
          <div key={key} className="group hover:scale-[1.02] transition-all duration-300 bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-6">
              <div className="flex items-center space-x-4 mb-3">
                <div className={`h-10 w-10 ${bg} p-2.5 rounded-xl flex items-center justify-center ${color} transition-transform group-hover:rotate-6`}>
                  <Icon size={18} />
                </div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</span>
              </div>
              <p className="text-2xl font-extrabold text-gray-900 group-hover:text-[#933d18] transition-colors">
                {isConfigured ? (stats[key] ?? '—') : '—'}
              </p>
              <p className="text-sm font-bold text-gray-900 mt-1">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {!isConfigured && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
          <p className="font-bold text-amber-800">Supabase Setup Required</p>
          <p className="text-amber-700 text-sm mt-1">
            Add the Supabase URL and Anon Key to your <code className="bg-amber-100 px-1 rounded">.env</code> file, then restart the server.
          </p>
          <pre className="bg-amber-100 text-amber-900 text-xs mt-3 p-3 rounded-xl overflow-x-auto">{`VITE_SUPABASE_URL=https://xxxx.supabase.co\nVITE_SUPABASE_ANON_KEY=eyJxxx...`}</pre>
        </div>
      )}
    </div>
  )
}
