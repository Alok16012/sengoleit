import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui/Table'
import PageHeader from '../../components/ui/PageHeader'
import { Search, Wallet, IndianRupee, Users } from 'lucide-react'
import { formatDate } from '../../utils/formatDate'
import { fetchFeeLedger, LEDGER_KIND_LABEL } from '../../utils/feeLedger'

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
  // Deductions keyed by student id ({} = none, null = migration not run).
  const [ledger, setLedger] = useState({})

  useEffect(() => {
    if (!user) return
    if (role === 'admin') {
      // Admin has no center — fetch all students directly.
      fetchPayments(null)
      return
    }
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
    if (role === 'super_center' || role === 'admin') {
      const { data: subCenters } = await supabase
        .from('centers').select('id').eq('super_center_id', centerId)
      centerIds = [centerId, ...(subCenters || []).map(c => c.id)]
    }
    if (role === 'admin') {
      // Admin sees every enrolled student — no center filter.
      centerIds = null
    }
    const query = supabase
      .from('students')
      .select('id, student_name, admission_number, enrollment_no, fee_collected, status, created_at, programs(program_name), academic_sessions(session_name), centers(id, center_name, center_code)')
    if (centerIds) query.in('center_id', centerIds)
    const { data: students } = await supabase
      .from('students')
      .select('id, student_name, admission_number, enrollment_no, fee_collected, status, created_at, programs(program_name), academic_sessions(session_name), centers(id, center_name, center_code)')
      .in('center_id', centerIds)
      .eq('status', 'Approved')
      .order('created_at', { ascending: false })
    setData(students || [])
    // null = add_student_fee_ledger.sql not run — the page then falls back to
    // the old one-total-per-student view instead of an empty statement.
    setLedger(await fetchFeeLedger((students || []).map(s => s.id)))
    setLoading(false)
  }

  const filtered = data.filter(s =>
    `${s.student_name} ${s.enrollment_no} ${s.admission_number} ${s.programs?.program_name || ''}`.toLowerCase().includes(search.toLowerCase())
  )

  const totalCollected = data.reduce((sum, s) => sum + Number(s.fee_collected || 0), 0)
  const fmt = n => `₹${Number(n || 0).toLocaleString('en-IN')}`

  // One line per deduction, newest first — admission, each re-registration and
  // each exam balance stand on their own instead of being merged into one
  // figure. `itemised` is false when the ledger migration hasn't been run, and
  // the table falls back to the running total it always showed.
  const itemised = ledger !== null
  const byId = Object.fromEntries(filtered.map(s => [s.id, s]))
  const entries = itemised
    ? filtered
      .flatMap(s => (ledger[s.id] || []).map(e => ({ ...e, student: byId[e.student_id] || s })))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    : []
  // Anything collected before the ledger existed is backfilled as one
  // 'opening' line, so this still reconciles with fee_collected.
  const entriesTotal = entries.reduce((sum, e) => sum + Number(e.amount || 0), 0)

  return (
    <div className="p-6">
      <PageHeader title="Payment Summary" subtitle={role === 'admin'
        ? 'Fee deductions across all centers, itemised by kind'
        : itemised
          ? 'Every fee deduction from your wallet, itemised'
          : 'Fee deducted from your wallet for each enrolled student'} />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mt-4 mb-6">
        <StatCard label="Total Fee Deducted" value={fmt(totalCollected)} sub={`${data.length} enrolled student${data.length === 1 ? '' : 's'}`} color="green" icon={IndianRupee} />
        {role !== 'admin' && (
          <>
            <StatCard label="Enrolled Students" value={data.length} sub="fee collected" color="blue" icon={Users} />
            <StatCard label="Current Wallet Balance" value={fmt(balance)} sub="available to register more" color="gray" icon={Wallet} />
          </>
        )}
        {role === 'admin' && (
          <StatCard label="Centres" value={`${new Set(data.map(s => s.centers?.id).filter(Boolean)).size}`} sub={`${data.length} total students`} color="blue" icon={Users} />
        )}
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
      ) : itemised ? (
        <Table>
          <Thead>
            <tr>
              <Th>#</Th>
              <Th>Date</Th>
              <Th>Student Name</Th>
              <Th>Enrollment No</Th>
              <Th>Program</Th>
              {role === 'super_center' && <Th>Center</Th>}
              <Th>Deducted For</Th>
              <Th>Amount</Th>
            </tr>
          </Thead>
          <Tbody>
            {entries.length === 0 ? (
              <Tr><Td colSpan={role === 'super_center' ? 8 : 7} className="text-center text-gray-400 py-12">
                {search ? 'No results found' : 'No fee has been deducted yet.'}
              </Td></Tr>
            ) : (
              <>
                {entries.map((e, i) => (
                  <Tr key={e.id}>
                    <Td className="text-gray-400 text-xs w-10">{i + 1}</Td>
                    <Td className="text-gray-500 text-xs whitespace-nowrap">{formatDate(e.created_at)}</Td>
                    <Td>
                      <p className="font-semibold text-gray-900">{e.student?.student_name || '—'}</p>
                      {e.student?.admission_number && (
                        <p className="font-mono text-[10px] text-[#933d18] mt-0.5">{e.student.admission_number}</p>
                      )}
                    </Td>
                    <Td>
                      {e.student?.enrollment_no
                        ? <span className="font-mono text-xs font-bold text-emerald-700">{e.student.enrollment_no}</span>
                        : <span className="text-xs text-gray-300">—</span>}
                    </Td>
                    <Td className="text-gray-500 text-xs min-w-[150px] whitespace-normal break-words">{e.student?.programs?.program_name || '—'}</Td>
                    {role === 'super_center' && (
                      <Td className="text-xs font-medium text-gray-700">{e.student?.centers?.center_name || '—'}</Td>
                    )}
                    <Td>
                      <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-gray-100 text-gray-700 whitespace-nowrap">
                        {LEDGER_KIND_LABEL[e.kind] || e.kind}
                      </span>
                      {e.term && <span className="text-[11px] text-gray-500 ml-1.5">{e.term}</span>}
                    </Td>
                    <Td><span className="text-sm font-black text-red-600">− {fmt(e.amount)}</span></Td>
                  </Tr>
                ))}
                <Tr>
                  <Td colSpan={role === 'super_center' ? 7 : 6} className="text-right font-bold text-gray-700">Total Deducted</Td>
                  <Td><span className="text-sm font-black text-red-700">− {fmt(entriesTotal)}</span></Td>
                </Tr>
              </>
            )}
          </Tbody>
        </Table>
      ) : (
        <Table>
          <Thead>
            <tr>
              <Th>#</Th>
              <Th>Student Name</Th>
              <Th>Application No</Th>
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
