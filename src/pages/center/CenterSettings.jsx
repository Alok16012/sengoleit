import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import PageHeader from '../../components/ui/PageHeader'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'

export default function CenterSettings() {
  const { user } = useAuth()
  const [center, setCenter] = useState(null)
  const [form, setForm] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (!user) return
    supabase.from('centers').select('*').eq('email', user.email).single()
      .then(({ data }) => { setCenter(data); setForm(data || {}); setLoading(false) })
  }, [user])

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }))

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    const payload = { ...form }
    delete payload.id; delete payload.created_at
    await supabase.from('centers').update(payload).eq('id', center.id)
    setSaving(false); setSuccess(true)
    setTimeout(() => setSuccess(false), 3000)
  }

  if (loading) return <div className="p-8 text-center text-gray-400">Loading...</div>
  if (!center) return <div className="p-8 text-center text-gray-400">Center not found for this account</div>

  return (
    <div className="p-8 max-w-2xl">
      <PageHeader title="Center Settings" />
      {success && <div className="mb-4 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">Settings saved successfully!</div>}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Center Name" value={form.center_name || ''} onChange={set('center_name')} />
            <Input label="Center Code" value={form.center_code || ''} disabled className="bg-gray-50" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Phone" type="tel" value={form.phone || ''} onChange={set('phone')} />
            <Input label="Email" type="email" value={form.email || ''} disabled className="bg-gray-50" />
          </div>
          <Input label="Address" value={form.address || ''} onChange={set('address')} />
          <p className="font-semibold text-sm text-gray-700 border-b pb-1 pt-2">Bank Details</p>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Account Holder" value={form.bank_account_holder || ''} onChange={set('bank_account_holder')} />
            <Input label="Account Number" value={form.bank_account_number || ''} onChange={set('bank_account_number')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="IFSC Code" value={form.ifsc_code || ''} onChange={set('ifsc_code')} />
            <Input label="Bank Branch" value={form.bank_branch || ''} onChange={set('bank_branch')} />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Settings'}</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
