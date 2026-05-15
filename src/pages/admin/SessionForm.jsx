import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import PageHeader from '../../components/ui/PageHeader'
import Input, { Select } from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import FormSection from '../../components/ui/FormSection'
import { CalendarDays } from 'lucide-react'

const emptyForm = {
  session_name: '', session_period: '', academic_year: '',
  start_date: '', end_date: '', is_current: false, status: 'Active'
}

export default function SessionForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isEdit) {
      supabase.from('academic_sessions').select('*').eq('id', id).single()
        .then(({ data }) => { if (data) setForm(prev => ({ ...prev, ...data })) })
    }
  }, [id])

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    const payload = { ...form }
    delete payload.id; delete payload.created_at; delete payload.updated_at
    if (!payload.start_date) delete payload.start_date
    if (!payload.end_date) delete payload.end_date
    Object.keys(payload).forEach(k => { if (payload[k] === '') delete payload[k] })
    const { error: err } = isEdit
      ? await supabase.from('academic_sessions').update(payload).eq('id', id)
      : await supabase.from('academic_sessions').insert(payload)
    if (err) { alert('Error: ' + err.message); setLoading(false); return }
    navigate('/admin/sessions')
  }

  return (
    <div className="p-6 max-w-xl">
      <PageHeader title={isEdit ? 'Edit Session' : 'Add Session'} backTo="/admin/sessions" />

      <form onSubmit={handleSubmit} className="space-y-5">
        <FormSection title="Session Details" icon={<CalendarDays size={16} />}>
          <Input label="Session Name *" placeholder="e.g. January 2025 Session" value={form.session_name} onChange={set('session_name')} required />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Session Period" placeholder="Jan–Jun 2025" value={form.session_period} onChange={set('session_period')} />
            <Input label="Academic Year" placeholder="2024-25" value={form.academic_year} onChange={set('academic_year')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Start Date" type="date" value={form.start_date} onChange={set('start_date')} />
            <Input label="End Date" type="date" value={form.end_date} onChange={set('end_date')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Status" value={form.status} onChange={set('status')}>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </Select>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={form.is_current}
                    onChange={e => setForm(f => ({ ...f, is_current: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-6 bg-gray-200 rounded-full peer peer-checked:bg-[#933d18] transition-colors" />
                  <div className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4 shadow" />
                </div>
                <span className="text-sm font-semibold text-gray-700">Set as Current Session</span>
              </label>
            </div>
          </div>
        </FormSection>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={loading}>{loading ? 'Saving...' : isEdit ? 'Update Session' : 'Add Session'}</Button>
          <Button type="button" variant="outline" onClick={() => navigate('/admin/sessions')}>Cancel</Button>
        </div>
      </form>
    </div>
  )
}
