import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import PageHeader from '../../components/ui/PageHeader'
import Input, { Select, Textarea } from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import FormSection from '../../components/ui/FormSection'
import { Building2, User, MapPin, Briefcase, CreditCard, GraduationCap } from 'lucide-react'

const emptyForm = {
  center_name: '', center_code: '', email: '', phone: '',
  contact_person: '', father_mother_name: '', date_of_birth: '', gender: '', nationality: 'Indian',
  aadhar_no: '', pan_no: '',
  address_line1: '', landmark: '', post_office: '', city: '',
  country_id: '', state_id: '', district_id: '', pincode: '',
  organization_name: '', org_type: '', org_address: '', org_post_office: '', org_city: '',
  org_country_id: '', org_state_id: '', org_district_id: '', org_pincode: '',
  registration_number: '', gst_pan: '',
  premises_type: 'Owned', office_area_sqft: '', student_capacity: '', revenue_share_percentage: '50',
  bank_account_holder: '', bank_account_number: '', ifsc_code: '', bank_branch: '',
  edu_10th_institute: '', edu_10th_board: '', edu_10th_year: '',
  edu_12th_institute: '', edu_12th_board: '', edu_12th_year: '',
  edu_ug_institute: '', edu_ug_board: '', edu_ug_year: '',
  edu_pg_institute: '', edu_pg_board: '', edu_pg_year: '',
  edu_diploma_institute: '', edu_diploma_board: '', edu_diploma_year: '',
  kyc_status: 'Pending', status: 'Pending',
  center_type: 'center',
  approval_status: 'pending',
}

export default function SubCenterForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isEdit = Boolean(id)
  const [form, setForm] = useState(emptyForm)
  const [superCenterId, setSuperCenterId] = useState(null)
  const [states, setStates] = useState([])
  const [districts, setDistricts] = useState([])
  const [orgDistricts, setOrgDistricts] = useState([])
  const [countries, setCountries] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('countries').select('id, country_name').order('country_name'),
      supabase.from('states').select('id, state_name').order('state_name'),
    ]).then(([c, s]) => {
      setCountries(c.data || [])
      setStates(s.data || [])
    })
    if (user) {
      supabase.from('centers').select('id').eq('email', user.email).eq('center_type', 'super_center').single()
        .then(({ data }) => setSuperCenterId(data?.id))
    }
    if (isEdit) {
      supabase.from('centers').select('*').eq('id', id).single()
        .then(({ data }) => { if (data) setForm(prev => ({ ...prev, ...data })) })
    }
  }, [id, user])

  useEffect(() => {
    if (form.state_id) {
      supabase.from('districts').select('id, district_name').eq('state_id', form.state_id).order('district_name')
        .then(({ data }) => setDistricts(data || []))
    }
  }, [form.state_id])

  useEffect(() => {
    if (form.org_state_id) {
      supabase.from('districts').select('id, district_name').eq('state_id', form.org_state_id).order('district_name')
        .then(({ data }) => setOrgDistricts(data || []))
    }
  }, [form.org_state_id])

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    const payload = { ...form, center_type: 'center', super_center_id: superCenterId, approval_status: 'pending' }
    delete payload.id; delete payload.created_at; delete payload.updated_at
    const fkFields = ['country_id', 'state_id', 'district_id', 'org_country_id', 'org_state_id', 'org_district_id']
    fkFields.forEach(k => { if (!payload[k]) delete payload[k] })
    if (isEdit) await supabase.from('centers').update(payload).eq('id', id)
    else await supabase.from('centers').insert(payload)
    navigate('/super-center/centers')
  }

  return (
    <div className="p-6 max-w-4xl">
      <PageHeader title={isEdit ? 'Edit Center' : 'Create Center'} backTo="/super-center/centers" />

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-5 text-sm text-blue-700">
        This center will be created under your Super Center and sent to Account Department for approval.
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <FormSection title="Center Identity" icon={<Building2 size={16} />}>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Center Name *" value={form.center_name} onChange={set('center_name')} required />
            <Input label="Center Code" placeholder="CTR001" value={form.center_code} onChange={set('center_code')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Email" type="email" value={form.email} onChange={set('email')} />
            <Input label="Phone" value={form.phone} onChange={set('phone')} />
          </div>
        </FormSection>

        <FormSection title="Contact Person Details" icon={<User size={16} />}>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Contact Person Name *" value={form.contact_person} onChange={set('contact_person')} required />
            <Input label="Father / Mother Name" value={form.father_mother_name} onChange={set('father_mother_name')} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input label="Date of Birth" type="date" value={form.date_of_birth} onChange={set('date_of_birth')} />
            <Select label="Gender" value={form.gender} onChange={set('gender')}>
              <option value="">Select Gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </Select>
            <Input label="Nationality" value={form.nationality} onChange={set('nationality')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Aadhar No" value={form.aadhar_no} onChange={set('aadhar_no')} />
            <Input label="PAN No" value={form.pan_no} onChange={set('pan_no')} />
          </div>
        </FormSection>

        <FormSection title="Center Address" icon={<MapPin size={16} />}>
          <Input label="Address Line 1" value={form.address_line1} onChange={set('address_line1')} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Landmark" value={form.landmark} onChange={set('landmark')} />
            <Input label="Post Office" value={form.post_office} onChange={set('post_office')} />
          </div>
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
          <div className="grid grid-cols-3 gap-4">
            <Select label="District" value={form.district_id} onChange={set('district_id')}>
              <option value="">Select District</option>
              {districts.map(d => <option key={d.id} value={d.id}>{d.district_name}</option>)}
            </Select>
            <Input label="City" value={form.city} onChange={set('city')} />
            <Input label="Pincode" value={form.pincode} onChange={set('pincode')} />
          </div>
        </FormSection>

        <FormSection title="Organization Details" icon={<Briefcase size={16} />}>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Organization Name" value={form.organization_name} onChange={set('organization_name')} />
            <Input label="Org Type" placeholder="Trust / Society / Pvt Ltd" value={form.org_type} onChange={set('org_type')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Registration Number" value={form.registration_number} onChange={set('registration_number')} />
            <Input label="GST / PAN (Org)" value={form.gst_pan} onChange={set('gst_pan')} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Select label="Premises Type" value={form.premises_type} onChange={set('premises_type')}>
              <option value="Owned">Owned</option>
              <option value="Rented">Rented</option>
              <option value="Leased">Leased</option>
            </Select>
            <Input label="Office Area (sqft)" type="number" value={form.office_area_sqft} onChange={set('office_area_sqft')} />
            <Input label="Student Capacity" type="number" value={form.student_capacity} onChange={set('student_capacity')} />
          </div>
        </FormSection>

        <FormSection title="Bank Details" icon={<CreditCard size={16} />}>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Account Holder Name" value={form.bank_account_holder} onChange={set('bank_account_holder')} />
            <Input label="Account Number" value={form.bank_account_number} onChange={set('bank_account_number')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="IFSC Code" value={form.ifsc_code} onChange={set('ifsc_code')} />
            <Input label="Bank Branch" value={form.bank_branch} onChange={set('bank_branch')} />
          </div>
        </FormSection>

        <FormSection title="Education Qualification" icon={<GraduationCap size={16} />}>
          {[
            { level: '10th', fields: ['edu_10th_institute', 'edu_10th_board', 'edu_10th_year'] },
            { level: '12th', fields: ['edu_12th_institute', 'edu_12th_board', 'edu_12th_year'] },
            { level: 'UG', fields: ['edu_ug_institute', 'edu_ug_board', 'edu_ug_year'] },
            { level: 'PG', fields: ['edu_pg_institute', 'edu_pg_board', 'edu_pg_year'] },
            { level: 'Diploma', fields: ['edu_diploma_institute', 'edu_diploma_board', 'edu_diploma_year'] },
          ].map(({ level, fields }) => (
            <div key={level} className="grid grid-cols-4 gap-3 items-center">
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wide">{level}</div>
              <Input placeholder="Institute" value={form[fields[0]]} onChange={set(fields[0])} />
              <Input placeholder="Board / University" value={form[fields[1]]} onChange={set(fields[1])} />
              <Input placeholder="Year" value={form[fields[2]]} onChange={set(fields[2])} />
            </div>
          ))}
        </FormSection>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={loading}>{loading ? 'Saving...' : isEdit ? 'Update Center' : 'Create Center'}</Button>
          <Button type="button" variant="outline" onClick={() => navigate('/super-center/centers')}>Cancel</Button>
        </div>
      </form>
    </div>
  )
}
