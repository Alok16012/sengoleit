import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui/Table'
import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import { Plus, Search, Edit } from 'lucide-react'

export default function MyCenters() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [mySuperCenter, setMySuperCenter] = useState(null)
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!user) return
    supabase.from('centers').select('id, center_name, center_code, approval_status').eq('email', user.email).eq('center_type', 'super_center').single()
      .then(({ data }) => {
        setMySuperCenter(data)
        if (data) fetchCenters(data.id)
      })
  }, [user])

  async function fetchCenters(superCenterId) {
    setLoading(true)
    const { data } = await supabase
      .from('centers')
      .select('*, states(state_name)')
      .eq('super_center_id', superCenterId)
      .order('created_at', { ascending: false })
    setData(data || [])
    setLoading(false)
  }

  const filtered = data.filter(c =>
    `${c.center_name} ${c.center_code} ${c.contact_person}`.toLowerCase().includes(search.toLowerCase())
  )

  const canCreate = mySuperCenter?.approval_status === 'approved'

  return (
    <div className="p-6">
      <PageHeader
        title="My Centers"
        subtitle={`${data.length} centers under ${mySuperCenter?.center_name || 'you'}`}
        action={canCreate ? { label: <><Plus size={15} /> Create Center</>, onClick: () => navigate('/super-center/centers/new') } : undefined}
      />

      {!canCreate && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 text-sm text-amber-700">
          Your super center needs to be approved by Account Department before you can create centers.
        </div>
      )}

      <div className="mb-4 relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#933d18] focus:ring-2 focus:ring-[#933d18]/15 bg-white"
          placeholder="Search centers..."
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
              <Th>Center Name</Th>
              <Th>Code</Th>
              <Th>Contact Person</Th>
              <Th>State</Th>
              <Th>Phone</Th>
              <Th>Virtual Balance</Th>
              <Th>Approval</Th>
              <Th>Status</Th>
              <Th>Actions</Th>
            </tr>
          </Thead>
          <Tbody>
            {filtered.length === 0 ? (
              <Tr><Td colSpan={10} className="text-center text-gray-400 py-12">No centers created yet</Td></Tr>
            ) : filtered.map((c, i) => (
              <Tr key={c.id}>
                <Td className="text-gray-400 text-xs w-10">{i + 1}</Td>
                <Td>
                  <p className="font-semibold text-gray-900">{c.center_name}</p>
                  {c.email && <p className="text-xs text-gray-400 mt-0.5">{c.email}</p>}
                </Td>
                <Td className="text-gray-500 font-mono text-xs">{c.center_code || '—'}</Td>
                <Td className="text-gray-500">{c.contact_person || '—'}</Td>
                <Td className="text-gray-500 text-xs">{c.states?.state_name || '—'}</Td>
                <Td className="text-gray-500">{c.phone || '—'}</Td>
                <Td><span className="font-semibold text-emerald-700">₹{Number(c.virtual_balance || 0).toLocaleString()}</span></Td>
                <Td>
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full capitalize ${
                    c.approval_status === 'approved' ? 'bg-emerald-50 text-emerald-700' :
                    c.approval_status === 'rejected' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                  }`}>
                    {c.approval_status || 'Pending'}
                  </span>
                </Td>
                <Td><Badge status={c.status?.toLowerCase()}>{c.status || 'Pending'}</Badge></Td>
                <Td>
                  <Button size="sm" variant="ghost" onClick={() => navigate(`/super-center/centers/edit/${c.id}`)}>
                    <Edit size={14} />
                  </Button>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </div>
  )
}
