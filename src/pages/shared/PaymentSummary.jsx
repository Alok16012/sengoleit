import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui/Table'
import PageHeader from '../../components/ui/PageHeader'
import { Search, Wallet, IndianRupee, Users } from 'lucide-react'
import { formatDate } from '../../utils/formatDate'

function StatCard({ label, value, sub, color = 'gray', icon: Icon }) {
  const colors = {
    green: 'bg-emerald-50 border-emerald-100 text-emerald-700',
    amber: 'bg-amber-50 border-amber-100 text-amber-700',
    blue: 'bg-blue-50 border-blue-100 text-blue-700',
    gray: 'bg-gray-50 border-gray-100 text-gray-700',
  }
  return (
    <div className={`rounded-2xl border p-5 ${colors[color]}`}>
      <div className="flex items-center gap-2 mb-1">
        {Icon && <Icon size={14} className="opacity-60" />}
        <p className="text-xs font-bold uppercase tracking-widest opacity-60">{label}</p>
      </div>
      <p className="text-2xl font-black">{value}</p>
      {sub && <p className="text-xs opacity-70 mt-1">{sub}</p>}
    </div>
  )
}

export default function PaymentSummary() {
  const { user, profile } = useAuth()
  const role = profile?.role || user?.user_metadata?.role || 'center'
  const [data, setData] = useState([])
  const [balance, setBalance] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [myCenterId, setMyCenterId] = useState(null)

  useEffect(() => {
    if (!user) return
    supabase.from('centers').select('id, virtual_balance').eq('email', user.email).single()
      .then(({ data: cd }) => {
        if (!cd) { setLoading(false); return }
        setMyCenterId(cd.id)
        setBalance(Number(cd.virtual_balance || 0))
        fetchPayments(cd.id)
      })
  }, [user])

  async function fetchPayments(centerId) {
    setLoading(true)
    let centerIds = [centerId]
    if (role === 'super_center') {
      const { data: subCenters } = await supabase
        .from('centers').select('id').eq('super_center_id', centerId)
      centerIds = [centerId, ...(subCenters || []).map(c => c.id)]
    }
    const { data: students } = await supabase
      .from('students')
      .select('id, student_name, admission_number, enrollment_no, fee_collected, status, created_at, programs(program_name), academic_sessions(session_name), centers(id, center_name, center_code)')
      .in('center_id', centerIds)
      .eq('status', 'Approved')
      .order('created_at', { ascending: false })
    setData(students || [])
    setLoading(false)
  }

  const filtered = data.filter(s =>
    `${s.student_name} ${s.enrollment_no} ${s.admission_number} ${s.programs?.program_name || ''}`.toLowerCase().includes(search.toLowerCase())
  )

  const totalCollected = data.reduce((sum, s) => sum + Number(s.fee_collected || 0), 0)
  const fmt = n => `₹${Number(n || 0).toLocaleString('en-IN')}`

  return (
    <div className="p-6">
      <PageHeader title="Payment Summary" subtitle="Fee deducted from your wallet for each enrolled student" />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mt-4 mb-6">
        <StatCard label="Total Fee Deducted" value={fmt(totalCollected)} sub={`${data.length} enrolled student${data.length === 1 ? '' : 's'}`} color="green" icon={IndianRupee} />
        <StatCard label="Enrolled Students" value={data.length} sub="fee collected" color="blue" icon={Users} />
        <StatCard label="Current Wallet Balance" value={fmt(balance)} sub="available to register more" color="gray" icon={Wallet} />
      </div>

      <div className="mb-4 relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#933d18] focus:ring-2 focus:ring-[#933d18]/15 bg-white"
          placeholder="Search by name, admission no, enrollment no..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Loading...</div>
      ) : (
        <Table>
          <Thead>
            <tr>
              <Th>#</Th>
              <Th>Student Name</Th>
              <Th>Admission No</Th>
              <Th>Enrollment No</Th>
              <Th>Program</Th>
              <Th>Session</Th>
              {role === 'super_center' && <Th>Center</Th>}
              <Th>Enrolled On</Th>
              <Th>Fee Deducted</Th>
            </tr>
          </Thead>
          <Tbody>
            {filtered.length === 0 ? (
              <Tr><Td colSpan={role === 'super_center' ? 9 : 8} className="text-center text-gray-400 py-12">{search ? 'No results found' : 'No enrolled students yet — no fee has been deducted.'}</Td></Tr>
            ) : (
              <>
                {filtered.map((s, i) => (
                  <Tr key={s.id}>
                    <Td className="text-gray-400 text-xs w-10">{i + 1}</Td>
                    <Td><p className="font-semibold text-gray-900">{s.student_name}</p></Td>
                    <Td>
                      {s.admission_number
                        ? <span className="font-mono text-xs font-bold text-[#933d18]">{s.admission_number}</span>
                        : <span className="text-xs text-gray-300">—</span>}
                    </Td>
                    <Td>
                      {s.enrollment_no
                        ? <span className="font-mono text-xs font-bold text-emerald-700">{s.enrollment_no}</span>
                        : <span className="text-xs text-gray-300">—</span>}
                    </Td>
                    <Td className="text-gray-500 text-xs min-w-[160px] whitespace-normal break-words">{s.programs?.program_name || '—'}</Td>
                    <Td className="text-gray-500 text-xs">{s.academic_sessions?.session_name || '—'}</Td>
                    {role === 'super_center' && (
                      <Td>
                        <p className="text-xs font-medium text-gray-700">{s.centers?.center_name || '—'}</p>
                        {s.centers?.id === myCenterId && (
                          <span className="text-[10px] bg-purple-50 text-purple-600 font-bold px-1.5 py-0.5 rounded-full">Mine</span>
                        )}
                      </Td>
                    )}
                    <Td className="text-gray-400 text-xs">{formatDate(s.created_at)}</Td>
                    <Td>
                      {s.fee_collected != null
                        ? <span className="text-sm font-black text-red-600">− {fmt(s.fee_collected)}</span>
                        : <span className="text-xs text-gray-300">—</span>}
                    </Td>
                  </Tr>
                ))}
                <Tr>
                  <Td colSpan={role === 'super_center' ? 8 : 7} className="text-right font-bold text-gray-700">Total Deducted</Td>
                  <Td><span className="text-sm font-black text-red-700">− {fmt(totalCollected)}</span></Td>
                </Tr>
              </>
            )}
          </Tbody>
        </Table>
      )}
    </div>
  )
}
