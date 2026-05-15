import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import PageHeader from '../../components/ui/PageHeader'
import Input, { Select, Textarea } from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import FormSection from '../../components/ui/FormSection'
import { Tag, IndianRupee } from 'lucide-react'

const emptyForm = {
  scheme_name: '', university_id: '', description: '',
  amount_type: 'Percentage', amount_value: '', scholarship: 'No', status: 'Active'
}

export default function SchemeForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const [form, setForm] = useState(emptyForm)
  const [universities, setUniversities] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.from('universities').select('id, university_name').order('university_name')
      .then(({ data }) => setUniversities(data || []))
    if (isEdit) {
      supabase.from('schemes').select('*').eq('id', id).single()
        .then(({ data }) => { if (data) setForm(prev => ({ ...prev, ...data })) })
    }
  }, [id])

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    const payload = { ...form }
    delete payload.id; delete payload.created_at; delete payload.updated_at
    if (!payload.university_id) delete payload.university_id
    Object.keys(payload).forEach(k => { if (payload[k] === '') delete payload[k] })
    const { error: err } = isEdit
      ? await supabase.from('schemes').update(payload).eq('id', id)
      : await supabase.from('schemes').insert(payload)
    if (err) { alert('Error: ' + err.message); setLoading(false); return }
    navigate('/admin/schemes')
  }

  return (
    <div className="p-6 max-w-xl">
      <PageHeader title={isEdit ? 'Edit Scheme' : 'Add Scheme'} backTo="/admin/schemes" />

      <form onSubmit={handleSubmit} className="space-y-5">
        <FormSection title="Scheme Details" icon={<Tag size={16} />}>
          <Input label="Scheme Name *" value={form.scheme_name} onChange={set('scheme_name')} required />
          <Select label="University" value={form.university_id} onChange={set('university_id')}>
            <option value="">Select University</option>
            {universities.map(u => <option key={u.id} value={u.id}>{u.university_name}</option>)}
          </Select>
          <Textarea label="Description" placeholder="Brief description of this scheme..." value={form.description} onChange={set('description')} />
          <div className="grid grid-cols-2 gap-4">
            <Select label="Scholarship" value={form.scholarship} onChange={set('scholarship')}>
              <option value="No">No</option>
              <option value="Yes">Yes</option>
            </Select>
            <Select label="Status" value={form.status} onChange={set('status')}>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </Select>
          </div>
        </FormSection>

        <FormSection title="Amount Configuration" icon={<IndianRupee size={16} />}>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Amount Type" value={form.amount_type} onChange={set('amount_type')}>
              <option value="Percentage">Percentage (%)</option>
              <option value="Fixed">Fixed Amount (₹)</option>
              <option value="Amount">Amount</option>
            </Select>
            <Input
              label={form.amount_type === 'Percentage' ? 'Percentage Value (%)' : 'Amount Value (₹)'}
              type="number"
              placeholder={form.amount_type === 'Percentage' ? 'e.g. 50' : 'e.g. 5000'}
              value={form.amount_value}
              onChange={set('amount_value')}
            />
          </div>
        </FormSection>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={loading}>{loading ? 'Saving...' : isEdit ? 'Update Scheme' : 'Add Scheme'}</Button>
          <Button type="button" variant="outline" onClick={() => navigate('/admin/schemes')}>Cancel</Button>
        </div>
      </form>
    </div>
  )
}
