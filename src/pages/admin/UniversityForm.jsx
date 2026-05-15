import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import PageHeader from '../../components/ui/PageHeader'
import Input, { Select, Textarea } from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import FormSection from '../../components/ui/FormSection'
import { Building2, Phone, MapPin, Info } from 'lucide-react'

const emptyForm = {
  university_name: '', registration_number: '', establishment_year: '',
  university_type: 'Private', email: '', phone: '', alternate_phone: '',
  website_url: '', affiliation_details: '', accreditation_details: '',
  address_line1: '', address_line2: '', country_id: '', state_id: '',
  district_id: '', pincode: '', status: 'Active'
}

export default function UniversityForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [form, setForm] = useState(emptyForm)
  const [states, setStates] = useState([])
  const [districts, setDistricts] = useState([])
  const [countries, setCountries] = useState([])
  const [loading, setLoading] = useState(false)
  const isEdit = Boolean(id)

  useEffect(() => {
    supabase.from('countries').select('id, country_name').order('country_name').then(({ data }) => setCountries(data || []))
    supabase.from('states').select('id, state_name').order('state_name').then(({ data }) => setStates(data || []))
    if (isEdit) {
      supabase.from('universities').select('*').eq('id', id).single()
        .then(({ data }) => { if (data) setForm(prev => ({ ...prev, ...data })) })
    }
  }, [id])

  useEffect(() => {
    if (form.state_id) {
      supabase.from('districts').select('id, district_name').eq('state_id', form.state_id).order('district_name')
        .then(({ data }) => setDistricts(data || []))
    }
  }, [form.state_id])

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    const payload = { ...form }
    delete payload.id; delete payload.created_at; delete payload.updated_at
    const empties = ['country_id', 'state_id', 'district_id']
    empties.forEach(k => { if (!payload[k]) delete payload[k] })
    if (isEdit) await supabase.from('universities').update(payload).eq('id', id)
    else await supabase.from('universities').insert(payload)
    navigate('/admin/universities')
  }

  return (
    <div className="p-6 max-w-3xl">
      <PageHeader title={isEdit ? 'Edit University' : 'Add University'} backTo="/admin/universities" />

      <form onSubmit={handleSubmit} className="space-y-5">

        <FormSection title="Basic Information" icon={<Building2 size={16} />}>
          <div className="grid grid-cols-2 gap-4">
            <Input label="University Name *" value={form.university_name} onChange={set('university_name')} required />
            <Input label="Registration Number" value={form.registration_number} onChange={set('registration_number')} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input label="Establishment Year" type="number" placeholder="1990" value={form.establishment_year} onChange={set('establishment_year')} />
            <Select label="University Type" value={form.university_type} onChange={set('university_type')}>
              <option value="Private">Private</option>
              <option value="State">State</option>
              <option value="Deemed">Deemed</option>
            </Select>
            <Select label="Status" value={form.status} onChange={set('status')}>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Pending">Pending</option>
            </Select>
          </div>
        </FormSection>

        <FormSection title="Contact Details" icon={<Phone size={16} />}>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Email" type="email" value={form.email} onChange={set('email')} />
            <Input label="Phone" type="tel" value={form.phone} onChange={set('phone')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Alternate Phone" type="tel" value={form.alternate_phone} onChange={set('alternate_phone')} />
            <Input label="Website URL" placeholder="https://..." value={form.website_url} onChange={set('website_url')} />
          </div>
        </FormSection>

        <FormSection title="Address" icon={<MapPin size={16} />}>
          <Input label="Address Line 1" value={form.address_line1} onChange={set('address_line1')} />
          <Input label="Address Line 2" value={form.address_line2} onChange={set('address_line2')} />
          <div className="grid grid-cols-2 gap-4">
            <Select label="Country" value={form.country_id} onChange={set('country_id')}>
              <option value="">Select Country</option>
              {countries.map(c => <option key={c.id} value={c.id}>{c.country_name}</option>)}
            </Select>
            <Select label="State" value={form.state_id} onChange={set('state_id')}>
              <option value="">Select State</option>
              {states.map(s => <option key={s.id} value={s.id}>{s.state_name}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="District" value={form.district_id} onChange={set('district_id')}>
              <option value="">Select District</option>
              {districts.map(d => <option key={d.id} value={d.id}>{d.district_name}</option>)}
            </Select>
            <Input label="Pincode" value={form.pincode} onChange={set('pincode')} />
          </div>
        </FormSection>

        <FormSection title="Accreditation & Affiliation" icon={<Info size={16} />}>
          <Textarea label="Affiliation Details" value={form.affiliation_details} onChange={set('affiliation_details')} />
          <Textarea label="Accreditation Details" value={form.accreditation_details} onChange={set('accreditation_details')} />
        </FormSection>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={loading}>{loading ? 'Saving...' : isEdit ? 'Update University' : 'Add University'}</Button>
          <Button type="button" variant="outline" onClick={() => navigate('/admin/universities')}>Cancel</Button>
        </div>
      </form>
    </div>
  )
}
