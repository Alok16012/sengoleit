import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui/Table'
import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import { Edit, Trash2, Plus, Search } from 'lucide-react'

export default function Universities() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const navigate = useNavigate()

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const { data } = await supabase
      .from('universities')
      .select('*, states(state_name)')
      .order('created_at', { ascending: false })
    setData(data || [])
    setLoading(false)
  }

  async function handleDelete(id) {
    if (!confirm('Delete this university? This cannot be undone.')) return
    await supabase.from('universities').delete().eq('id', id)
    fetchData()
  }

  const filtered = data.filter(u =>
    `${u.university_name} ${u.registration_number} ${u.email}`.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6">
      <PageHeader
        title="Universities"
        subtitle={`${data.length} universities`}
        action={{ label: <><Plus size={15} /> Add University</>, onClick: () => navigate('/admin/universities/new') }}
      />

      <div className="mb-4 relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#933d18] focus:ring-2 focus:ring-[#933d18]/15 bg-white"
          placeholder="Search universities..."
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
              <Th>University Name</Th>
              <Th>Reg. No</Th>
              <Th>Type</Th>
              <Th>State</Th>
              <Th>Phone</Th>
              <Th>Status</Th>
              <Th>Actions</Th>
            </tr>
          </Thead>
          <Tbody>
            {filtered.length === 0 ? (
              <Tr><Td colSpan={8} className="text-center text-gray-400 py-12">No universities found</Td></Tr>
            ) : filtered.map((u, i) => (
              <Tr key={u.id}>
                <Td className="text-gray-400 text-xs w-10">{i + 1}</Td>
                <Td>
                  <p className="font-semibold text-gray-900">{u.university_name}</p>
                  {u.email && <p className="text-xs text-gray-400 mt-0.5">{u.email}</p>}
                </Td>
                <Td className="text-gray-500">{u.registration_number || '—'}</Td>
                <Td className="text-gray-500">{u.university_type || '—'}</Td>
                <Td className="text-gray-500">{u.states?.state_name || '—'}</Td>
                <Td className="text-gray-500">{u.phone || '—'}</Td>
                <Td><Badge status={u.status?.toLowerCase()}>{u.status || 'Active'}</Badge></Td>
                <Td>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => navigate(`/admin/universities/edit/${u.id}`)}>
                      <Edit size={14} />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(u.id)}>
                      <Trash2 size={14} className="text-red-500" />
                    </Button>
                  </div>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </div>
  )
}
