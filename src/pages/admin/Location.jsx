import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui/Table'
import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Input, { Select } from '../../components/ui/Input'
import { Plus, Trash2, Edit, Search } from 'lucide-react'

const TABS = [
  { key: 'states', label: 'States' },
  { key: 'districts', label: 'Districts' },
  { key: 'countries', label: 'Countries' },
]

export default function Location() {
  const [tab, setTab] = useState('states')
  const [states, setStates] = useState([])
  const [districts, setDistricts] = useState([])
  const [countries, setCountries] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [editId, setEditId] = useState(null)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [c, s, d] = await Promise.all([
      supabase.from('countries').select('*').order('country_name'),
      supabase.from('states').select('*, countries(country_name)').order('state_name'),
      supabase.from('districts').select('*, states(state_name)').order('district_name'),
    ])
    setCountries(c.data || [])
    setStates(s.data || [])
    setDistricts(d.data || [])
    setLoading(false)
  }

  function openAdd() {
    setEditId(null)
    if (tab === 'states') setForm({ state_name: '', state_code: '', country_id: '', status: 'Active' })
    else if (tab === 'districts') setForm({ district_name: '', state_id: '', status: 'Active' })
    else setForm({ country_name: '', country_code: '', status: 'Active' })
    setModal(true)
  }

  function openEdit(row) {
    setEditId(row.id)
    if (tab === 'states') setForm({ state_name: row.state_name || '', state_code: row.state_code || '', country_id: row.country_id || '', status: row.status || 'Active' })
    else if (tab === 'districts') setForm({ district_name: row.district_name || '', state_id: row.state_id || '', status: row.status || 'Active' })
    else setForm({ country_name: row.country_name || '', country_code: row.country_code || '', status: row.status || 'Active' })
    setModal(true)
  }

  async function handleSave() {
    // A state must belong to a country — don't allow a state with no country.
    if (tab === 'states' && !form.country_id) { alert('Please select a Country for this state.'); return }
    setSaving(true)
    const table = tab === 'states' ? 'states' : tab === 'districts' ? 'districts' : 'countries'
    const payload = { ...form }
    if (!payload.country_id) payload.country_id = null
    if (!payload.state_id) payload.state_id = null
    if (table === 'countries') { delete payload.country_id; delete payload.state_id }
    if (table === 'states') delete payload.state_id
    if (table === 'districts') delete payload.country_id
    if (editId) await supabase.from(table).update(payload).eq('id', editId)
    else await supabase.from(table).insert(payload)
    setModal(false); setSaving(false); fetchAll()
  }

  async function handleDelete(table, id) {
    if (!confirm('Delete this record?')) return
    await supabase.from(table).delete().eq('id', id)
    fetchAll()
  }

  const currentLabel = TABS.find(t => t.key === tab)?.label || ''
  const q = search.trim().toLowerCase()
  const filteredStates = states.filter(s => !q || `${s.state_name} ${s.state_code || ''} ${s.countries?.country_name || ''}`.toLowerCase().includes(q))
  const filteredDistricts = districts.filter(d => !q || `${d.district_name} ${d.states?.state_name || ''}`.toLowerCase().includes(q))
  const filteredCountries = countries.filter(c => !q || `${c.country_name} ${c.country_code || ''}`.toLowerCase().includes(q))

  return (
    <div className="p-6">
      <PageHeader
        title="Location Management"
        subtitle={`Manage states, districts, and countries`}
        action={{ label: <><Plus size={15} /> Add {currentLabel.slice(0, -1)}</>, onClick: openAdd }}
      />

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setSearch('') }}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === t.key ? 'bg-white text-[#933d18] shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'
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
            placeholder={`Search ${currentLabel.toLowerCase()}...`}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Loading...</div>
      ) : (
        <>
          {tab === 'states' && (
            <Table>
              <Thead><tr><Th>#</Th><Th>State Name</Th><Th>Code</Th><Th>Country</Th><Th>Status</Th><Th>Actions</Th></tr></Thead>
              <Tbody>
                {filteredStates.length === 0 ? (
                  <Tr><Td colSpan={6} className="text-center text-gray-400 py-12">No states found</Td></Tr>
                ) : filteredStates.map((s, i) => (
                  <Tr key={s.id}>
                    <Td className="text-gray-400 text-xs w-10">{i + 1}</Td>
                    <Td><p className="font-semibold text-gray-900">{s.state_name}</p></Td>
                    <Td className="text-gray-500">{s.state_code || '—'}</Td>
                    <Td className="text-gray-500 text-xs">{s.countries?.country_name || '—'}</Td>
                    <Td className="text-gray-500">{s.status}</Td>
                    <Td>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(s)}><Edit size={14} className="text-gray-500" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete('states', s.id)}><Trash2 size={14} className="text-red-500" /></Button>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
          {tab === 'districts' && (
            <Table>
              <Thead><tr><Th>#</Th><Th>District Name</Th><Th>State</Th><Th>Status</Th><Th>Actions</Th></tr></Thead>
              <Tbody>
                {filteredDistricts.length === 0 ? (
                  <Tr><Td colSpan={5} className="text-center text-gray-400 py-12">No districts found</Td></Tr>
                ) : filteredDistricts.map((d, i) => (
                  <Tr key={d.id}>
                    <Td className="text-gray-400 text-xs w-10">{i + 1}</Td>
                    <Td><p className="font-semibold text-gray-900">{d.district_name}</p></Td>
                    <Td className="text-gray-500 text-xs">{d.states?.state_name || '—'}</Td>
                    <Td className="text-gray-500">{d.status}</Td>
                    <Td>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(d)}><Edit size={14} className="text-gray-500" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete('districts', d.id)}><Trash2 size={14} className="text-red-500" /></Button>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
          {tab === 'countries' && (
            <Table>
              <Thead><tr><Th>#</Th><Th>Country Name</Th><Th>Code</Th><Th>Status</Th><Th>Actions</Th></tr></Thead>
              <Tbody>
                {filteredCountries.length === 0 ? (
                  <Tr><Td colSpan={5} className="text-center text-gray-400 py-12">No countries found</Td></Tr>
                ) : filteredCountries.map((c, i) => (
                  <Tr key={c.id}>
                    <Td className="text-gray-400 text-xs w-10">{i + 1}</Td>
                    <Td><p className="font-semibold text-gray-900">{c.country_name}</p></Td>
                    <Td className="text-gray-500">{c.country_code || '—'}</Td>
                    <Td className="text-gray-500">{c.status}</Td>
                    <Td>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(c)}><Edit size={14} className="text-gray-500" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete('countries', c.id)}><Trash2 size={14} className="text-red-500" /></Button>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
        </>
      )}

      <Modal isOpen={modal} onClose={() => setModal(false)} title={`${editId ? 'Edit' : 'Add'} ${currentLabel.slice(0, -1)}`}>
        <div className="space-y-4">
          {tab === 'countries' && <>
            <Input label="Country Name *" value={form.country_name || ''} onChange={e => setForm(f => ({ ...f, country_name: e.target.value }))} required />
            <Input label="Country Code" placeholder="IN" value={form.country_code || ''} onChange={e => setForm(f => ({ ...f, country_code: e.target.value }))} />
          </>}
          {tab === 'states' && <>
            <Input label="State Name *" value={form.state_name || ''} onChange={e => setForm(f => ({ ...f, state_name: e.target.value }))} required />
            <Input label="State Code" placeholder="UP" value={form.state_code || ''} onChange={e => setForm(f => ({ ...f, state_code: e.target.value }))} />
            <Select label="Country *" value={form.country_id || ''} onChange={e => setForm(f => ({ ...f, country_id: e.target.value }))} required>
              <option value="">Select Country</option>
              {countries.map(c => <option key={c.id} value={c.id}>{c.country_name}</option>)}
            </Select>
          </>}
          {tab === 'districts' && <>
            <Input label="District Name *" value={form.district_name || ''} onChange={e => setForm(f => ({ ...f, district_name: e.target.value }))} required />
            <Select label="State" value={form.state_id || ''} onChange={e => setForm(f => ({ ...f, state_id: e.target.value }))}>
              <option value="">Select State</option>
              {states.map(s => <option key={s.id} value={s.id}>{s.state_name}</option>)}
            </Select>
          </>}
          <Select label="Status" value={form.status || 'Active'} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </Select>
          <div className="flex gap-3 pt-2">
            <Button onClick={handleSave} disabled={saving || (tab === 'states' && !form.country_id)}>{saving ? 'Saving...' : editId ? 'Update' : 'Add'}</Button>
            <Button variant="outline" onClick={() => setModal(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
