import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui/Table'
import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import { Plus, Edit, Trash2, Search } from 'lucide-react'

export default function Schemes() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const navigate = useNavigate()

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const { data } = await supabase
      .from('schemes')
      .select('*, universities(university_name)')
      .order('created_at', { ascending: false })
    setData(data || [])
    setLoading(false)
  }

  async function handleDelete(id) {
    if (!confirm('Delete this scheme?')) return
    await supabase.from('schemes').delete().eq('id', id)
    fetchData()
  }

  const filtered = data.filter(s =>
    `${s.scheme_name}`.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6">
      <PageHeader
        title="Schemes"
        subtitle={`${data.length} schemes`}
        action={{ label: <><Plus size={15} /> Add Scheme</>, onClick: () => navigate('/admin/schemes/new') }}
      />

      <div className="mb-4 relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#933d18] focus:ring-2 focus:ring-[#933d18]/15 bg-white"
          placeholder="Search schemes..."
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
              <Th>Scheme Name</Th>
              <Th>University</Th>
              <Th>Amount Type</Th>
              <Th>Value</Th>
              <Th>Scholarship</Th>
              <Th>Status</Th>
              <Th>Actions</Th>
            </tr>
          </Thead>
          <Tbody>
            {filtered.length === 0 ? (
              <Tr><Td colSpan={8} className="text-center text-gray-400 py-12">No schemes found</Td></Tr>
            ) : filtered.map((s, i) => (
              <Tr key={s.id}>
                <Td className="text-gray-400 text-xs w-10">{i + 1}</Td>
                <Td>
                  <p className="font-semibold text-gray-900">{s.scheme_name}</p>
                  {s.description && <p className="text-xs text-gray-400 mt-0.5 max-w-[200px] truncate">{s.description}</p>}
                </Td>
                <Td className="text-gray-500 text-xs">{s.universities?.university_name || '—'}</Td>
                <Td className="text-gray-500">{s.amount_type || '—'}</Td>
                <Td className="text-gray-500 font-medium">
                  {s.amount_value
                    ? s.amount_type === 'Percentage' ? `${s.amount_value}%` : `₹${Number(s.amount_value).toLocaleString()}`
                    : '—'}
                </Td>
                <Td>
                  <span className={`text-xs font-semibold ${s.scholarship === 'Yes' ? 'text-emerald-600' : 'text-gray-400'}`}>
                    {s.scholarship || 'No'}
                  </span>
                </Td>
                <Td><Badge status={s.status?.toLowerCase()}>{s.status || 'Active'}</Badge></Td>
                <Td>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => navigate(`/admin/schemes/edit/${s.id}`)}>
                      <Edit size={14} />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(s.id)}>
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
