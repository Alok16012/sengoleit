import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui/Table'
import PageHeader from '../../components/ui/PageHeader'
import ExportButtons from '../../components/ExportButtons'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import Input, { Select } from '../../components/ui/Input'
import { Plus, Edit, Trash2, Search } from 'lucide-react'

const TABS = [
  { key: 'programme_types', label: 'Programme Types', table: 'programme_types', nameField: 'programme_type_name', addLabel: 'Add Programme Type' },
  { key: 'departments', label: 'Departments', table: 'departments', nameField: 'name', addLabel: 'Add Department', hasUniversity: true },
  { key: 'study_modes', label: 'Mode', table: 'study_modes', nameField: 'mode_name', addLabel: 'Add Mode' },
  { key: 'modes_of_study', label: 'Mode of Study', table: 'modes_of_study', nameField: 'mode_name', addLabel: 'Add Mode of Study' },
]

export default function Departments() {
  const [tab, setTab] = useState('programme_types')
  const [data, setData] = useState({})
  const [universities, setUniversities] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', status: 'Active', university_id: '' })
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  const currentTab = TABS.find(t => t.key === tab)

  useEffect(() => {
    supabase.from('universities').select('id, university_name').order('university_name')
      .then(({ data }) => setUniversities(data || []))
    fetchAll()
  }, [])

  async function fetchAll() {
    setLoading(true)
    const results = await Promise.all(
      TABS.map(t =>
        t.hasUniversity
          ? supabase.from(t.table).select(`*, universities(university_name)`).order(t.nameField)
          : supabase.from(t.table).select('*').order(t.nameField)
      )
    )
    const newData = {}
    TABS.forEach((t, i) => { newData[t.key] = results[i].data || [] })
    setData(newData)
    setLoading(false)
  }

  function openAdd() {
    setEditing(null)
    setForm({ name: '', status: 'Active', university_id: '' })
    setModal(true)
  }

  function openEdit(row) {
    setEditing(row.id)
    setForm({
      name: row[currentTab.nameField] || '',
      status: row.status || 'Active',
      university_id: row.university_id || '',
    })
    setModal(true)
  }

  async function handleSave() {
    setSaving(true)
    const payload = { [currentTab.nameField]: form.name, status: form.status }
    if (currentTab.hasUniversity && form.university_id) payload.university_id = form.university_id
    if (editing) await supabase.from(currentTab.table).update(payload).eq('id', editing)
    else await supabase.from(currentTab.table).insert(payload)
    setModal(false); setSaving(false); fetchAll()
  }

  async function handleDelete(id) {
    if (!confirm(`Delete this ${currentTab.label.slice(0, -1)}?`)) return
    await supabase.from(currentTab.table).delete().eq('id', id)
    fetchAll()
  }

  const allRows = data[tab] || []
  const q = search.trim().toLowerCase()
  const rows = allRows.filter(row => !q || `${row[currentTab.nameField] || ''} ${row.universities?.university_name || ''} ${row.status || ''}`.toLowerCase().includes(q))

  return (
    <div className="p-6">
      <PageHeader
        title="Departments & Configuration"
        subtitle={`${allRows.length} ${currentTab?.label?.toLowerCase()}`}
        action={{ label: <><Plus size={16} /> {currentTab?.addLabel}</>, onClick: openAdd }}
      />

      {/* Tabs + Search */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setSearch('') }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                tab === t.key
                  ? 'bg-white text-[#933d18] shadow-sm border border-gray-200'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative w-64">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#933d18] focus:ring-2 focus:ring-[#933d18]/15 bg-white"
            placeholder={`Search ${currentTab?.label?.toLowerCase()}...`}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {/* The column set follows the tab: only Departments carry a university. */}
        <ExportButtons className="ml-auto" title={currentTab?.label || 'List'} rows={rows}
          filename={`${(currentTab?.label || 'list').toLowerCase().replace(/\W+/g, '-')}${search ? '_' + search.replace(/\W+/g, '-') : ''}`}
          meta={search ? [`Search: ${search}`] : []}
          columns={[
            { header: 'Name', value: r => r[currentTab.nameField] || '' },
            ...(currentTab?.hasUniversity
              ? [{ header: 'University', value: r => r.universities?.university_name || '' }] : []),
            { header: 'Status', value: r => r.status || 'Active' },
          ]} />
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading...</div>
      ) : (
        <Table>
          <Thead>
            <tr>
              <Th>#</Th>
              <Th>Name</Th>
              {currentTab?.hasUniversity && <Th>University</Th>}
              <Th>Status</Th>
              <Th>Actions</Th>
            </tr>
          </Thead>
          <Tbody>
            {rows.length === 0 ? (
              <Tr><Td colSpan={5} className="text-center text-gray-400 py-12">No records found</Td></Tr>
            ) : rows.map((row, i) => (
              <Tr key={row.id}>
                <Td className="text-gray-400 text-xs w-10">{i + 1}</Td>
                <Td><p className="font-semibold text-gray-900">{row[currentTab.nameField]}</p></Td>
                {currentTab?.hasUniversity && <Td className="text-gray-500 text-xs">{row.universities?.university_name || '—'}</Td>}
                <Td><Badge status={row.status?.toLowerCase()}>{row.status || 'Active'}</Badge></Td>
                <Td>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(row)}><Edit size={14} /></Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(row.id)}><Trash2 size={14} className="text-red-500" /></Button>
                  </div>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      <Modal isOpen={modal} onClose={() => setModal(false)} title={editing ? `Edit ${currentTab?.label.slice(0, -1)}` : currentTab?.addLabel}>
        <div className="space-y-4">
          <Input
            label={`${currentTab?.label.slice(0, -1)} Name *`}
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            required
          />
          {currentTab?.hasUniversity && (
            <Select label="University" value={form.university_id} onChange={e => setForm(f => ({ ...f, university_id: e.target.value }))}>
              <option value="">Select University</option>
              {universities.map(u => <option key={u.id} value={u.id}>{u.university_name}</option>)}
            </Select>
          )}
          <Select label="Status" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </Select>
          <div className="flex gap-3 pt-2">
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : editing ? 'Update' : 'Add'}</Button>
            <Button variant="outline" onClick={() => setModal(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
