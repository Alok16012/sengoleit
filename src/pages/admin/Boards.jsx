import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui/Table'
import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import { Edit, Trash2, Plus, Check, X } from 'lucide-react'

const BOARD_TYPES = ['All', '10th', '12th', 'UG', 'PG', 'Diploma']

const emptyForm = { name: '', type: 'All' }

export default function Boards() {
  const [boards, setBoards] = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(emptyForm)

  useEffect(() => { fetchBoards() }, [])

  async function fetchBoards() {
    setLoading(true)
    const { data } = await supabase.from('boards').select('*').order('name')
    setBoards(data || [])
    setLoading(false)
  }

  async function handleSave() {
    if (!form.name.trim()) return
    if (editId) {
      await supabase.from('boards').update({ name: form.name.trim(), type: form.type }).eq('id', editId)
      setEditId(null)
    } else {
      await supabase.from('boards').insert({ name: form.name.trim(), type: form.type })
      setAdding(false)
    }
    setForm(emptyForm)
    fetchBoards()
  }

  async function handleDelete(id) {
    if (!confirm('Delete this board?')) return
    await supabase.from('boards').delete().eq('id', id)
    fetchBoards()
  }

  const InlineInput = ({ value, onChange, onKeyDown, autoFocus }) => (
    <input
      autoFocus={autoFocus}
      className="w-full border border-[#933d18]/40 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#933d18] focus:ring-2 focus:ring-[#933d18]/10"
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
    />
  )

  const InlineSelect = ({ value, onChange }) => (
    <select
      className="border border-[#933d18]/40 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#933d18]"
      value={value}
      onChange={onChange}
    >
      {BOARD_TYPES.map(t => <option key={t} value={t}>{t === 'All' ? 'All Levels' : t}</option>)}
    </select>
  )

  const SaveCancel = ({ onCancel }) => (
    <div className="flex gap-1">
      <Button size="sm" onClick={handleSave}><Check size={14} /></Button>
      <Button size="sm" variant="ghost" onClick={onCancel}><X size={14} /></Button>
    </div>
  )

  return (
    <div className="p-6">
      <PageHeader
        title="Boards & Universities"
        subtitle={`${boards.length} entries`}
        action={{
          label: <><Plus size={15} /> Add Board</>,
          onClick: () => { setAdding(true); setForm(emptyForm); setEditId(null) }
        }}
      />

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Loading...</div>
      ) : (
        <Table>
          <Thead>
            <tr>
              <Th>#</Th>
              <Th>Board / University Name</Th>
              <Th>Applies To</Th>
              <Th>Actions</Th>
            </tr>
          </Thead>
          <Tbody>
            {adding && (
              <Tr>
                <Td className="text-gray-400 text-xs">—</Td>
                <Td>
                  <InlineInput
                    autoFocus
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && handleSave()}
                  />
                </Td>
                <Td>
                  <InlineSelect value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} />
                </Td>
                <Td><SaveCancel onCancel={() => setAdding(false)} /></Td>
              </Tr>
            )}
            {boards.length === 0 && !adding ? (
              <Tr><Td colSpan={4} className="text-center text-gray-400 py-12">No boards added yet</Td></Tr>
            ) : boards.map((b, i) => (
              <Tr key={b.id}>
                <Td className="text-gray-400 text-xs w-10">{i + 1}</Td>
                <Td>
                  {editId === b.id ? (
                    <InlineInput
                      autoFocus
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && handleSave()}
                    />
                  ) : (
                    <span className="font-medium text-gray-900">{b.name}</span>
                  )}
                </Td>
                <Td>
                  {editId === b.id ? (
                    <InlineSelect value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} />
                  ) : (
                    <span className="text-xs px-2 py-1 rounded-full bg-[#933d18]/8 text-[#933d18] font-semibold">
                      {b.type === 'All' ? 'All Levels' : b.type}
                    </span>
                  )}
                </Td>
                <Td>
                  {editId === b.id ? (
                    <SaveCancel onCancel={() => setEditId(null)} />
                  ) : (
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => { setEditId(b.id); setForm({ name: b.name, type: b.type }); setAdding(false) }}>
                        <Edit size={14} />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(b.id)}>
                        <Trash2 size={14} className="text-red-500" />
                      </Button>
                    </div>
                  )}
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </div>
  )
}
