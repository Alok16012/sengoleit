import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui/Table'
import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import { Plus, Edit, Trash2, Star } from 'lucide-react'

export default function Sessions() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const { data } = await supabase.from('academic_sessions').select('*').order('created_at', { ascending: false })
    setData(data || [])
    setLoading(false)
  }

  async function handleDelete(id) {
    if (!confirm('Delete this session?')) return
    await supabase.from('academic_sessions').delete().eq('id', id)
    fetchData()
  }

  async function setAsCurrent(id) {
    await supabase.from('academic_sessions').update({ is_current: false }).neq('id', id)
    await supabase.from('academic_sessions').update({ is_current: true }).eq('id', id)
    fetchData()
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Academic Sessions"
        subtitle={`${data.length} sessions`}
        action={{ label: <><Plus size={15} /> Add Session</>, onClick: () => navigate('/admin/sessions/new') }}
      />

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Loading...</div>
      ) : (
        <Table>
          <Thead>
            <tr>
              <Th>#</Th>
              <Th>Session Name</Th>
              <Th>Period</Th>
              <Th>Academic Year</Th>
              <Th>Start Date</Th>
              <Th>End Date</Th>
              <Th>Current</Th>
              <Th>Status</Th>
              <Th>Actions</Th>
            </tr>
          </Thead>
          <Tbody>
            {data.length === 0 ? (
              <Tr><Td colSpan={9} className="text-center text-gray-400 py-12">No sessions found</Td></Tr>
            ) : data.map((s, i) => (
              <Tr key={s.id}>
                <Td className="text-gray-400 text-xs w-10">{i + 1}</Td>
                <Td>
                  <p className="font-semibold text-gray-900">{s.session_name}</p>
                </Td>
                <Td className="text-gray-500">{s.session_period || '—'}</Td>
                <Td className="text-gray-500">{s.academic_year || '—'}</Td>
                <Td className="text-gray-500">{s.start_date || '—'}</Td>
                <Td className="text-gray-500">{s.end_date || '—'}</Td>
                <Td>
                  {s.is_current ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#933d18]">
                      <Star size={12} fill="currentColor" /> Current
                    </span>
                  ) : (
                    <button
                      onClick={() => setAsCurrent(s.id)}
                      className="text-xs text-gray-400 hover:text-[#933d18] font-medium transition-colors"
                    >
                      Set current
                    </button>
                  )}
                </Td>
                <Td><Badge status={s.status?.toLowerCase()}>{s.status || 'Active'}</Badge></Td>
                <Td>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => navigate(`/admin/sessions/edit/${s.id}`)}>
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
