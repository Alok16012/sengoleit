import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import PageHeader from '../../components/ui/PageHeader'
import Input, { Select, Textarea } from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import FormSection from '../../components/ui/FormSection'
import { Building2, User, MapPin, Briefcase, CreditCard, GraduationCap, ShieldCheck } from 'lucide-react'

const emptyForm = {
  center_type: 'super_center',
  center_name: '', center_code: '', email: '', phone: '',
  super_center_id: '',
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
}

export default function CenterForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const [form, setForm] = useState(emptyForm)
  const [allCenters, setAllCenters] = useState([])
  const [states, setStates] = useState([])
  const [districts, setDistricts] = useState([])
  const [orgDistricts, setOrgDistricts] = useState([])
  const [countries, setCountries] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([
      supabase.from('countries').select('id, country_name').order('country_name'),
      supabase.from('states').select('id, state_name').order('state_name'),
      supabase.from('centers').select('id, center_name, center_code, center_type').order('center_name'),
    ]).then(([c, s, centers]) => {
      setCountries(c.data || [])
      setStates(s.data || [])
      setAllCenters(centers.data || [])
    })
    if (isEdit) {
      supabase.from('centers').select('*').eq('id', id).single()
        .then(({ data }) => { if (data) setForm(prev => ({ ...prev, ...data })) })
    }
  }, [id])

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
    setError(null)
    try {
      const payload = { ...form }
      delete payload.id; delete payload.created_at; delete payload.updated_at
      const fkFields = ['country_id', 'state_id', 'district_id', 'org_country_id', 'org_state_id', 'org_district_id', 'super_center_id']
      fkFields.forEach(k => { if (!payload[k]) delete payload[k] })
      const numericFields = ['office_area_sqft', 'student_capacity', 'revenue_share_percentage', 'virtual_balance']
      numericFields.forEach(k => { if (payload[k] === '' || payload[k] === null) delete payload[k]; else if (payload[k] !== undefined) payload[k] = Number(payload[k]) })
      Object.keys(payload).forEach(k => { if (payload[k] === '') delete payload[k] })
      const { error: err } = isEdit
        ? await supabase.from('centers').update(payload).eq('id', id)
        : await supabase.from('centers').insert(payload)
      if (err) throw err
      navigate(form.center_type === 'super_center' ? '/admin/super-centers' : '/admin/centers')
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  const availableSuperCenters = allCenters.filter(c => c.id !== id && c.center_type === 'super_center')
  const backTo = form.center_type === 'super_center' ? '/admin/super-centers' : '/admin/centers'

  return (
    <div className="p-6 max-w-4xl pb-20">
      <PageHeader title={isEdit ? 'Edit Center' : 'Add Center'} backTo={backTo} />

      <form onSubmit={handleSubmit} className="space-y-5">

        <FormSection title="Center Identity" icon={<Building2 size={16} />}>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Center Type *" value={form.center_type} onChange={set('center_type')}>
              <option value="super_center">Super Center</option>
              <option value="center">Center (Under Super Center)</option>
            </Select>
            {form.center_type === 'center' && (
              <Select label="Super Center *" value={form.super_center_id} onChange={set('super_center_id')}>
                <option value="">Select Super Center</option>
                {availableSuperCenters.map(c => (
                  <option key={c.id} value={c.id}>{c.center_name}{c.center_code ? ` (${c.center_code})` : ''}</option>
                ))}
              </Select>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Center Name *" value={form.center_name} onChange={set('center_name')} required />
            <Input label="Center Code" placeholder="CTR001" value={form.center_code} onChange={set('center_code')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Email" type="email" value={form.email} onChange={set('email')} />
            <Input label="Phone" type="tel" value={form.phone} onChange={set('phone')} />
          </div>
          <Select label="Super Center (Parent Center)" value={form.super_center_id} onChange={set('super_center_id')}>
            <option value="">— None (Independent Center) —</option>
            {availableSuperCenters.map(c => (
              <option key={c.id} value={c.id}>
                {c.center_name}{c.center_code ? ` (${c.center_code})` : ''}
              </option>
            ))}
          </Select>
        </FormSection>

        <FormSection title="Contact Person Details" icon={<User size={16} />}>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Contact Person Name" value={form.contact_person} onChange={set('contact_person')} />
            <Input label="Father / Mother Name" value={form.father_mother_name} onChange={set('father_mother_name')} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input label="Date of Birth" type="date" value={form.date_of_birth} onChange={set('date_of_birth')} />
            <Select label="Gender" value={form.gender} onChange={set('gender')}>
              <option value="">Select</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </Select>
            <Input label="Nationality" value={form.nationality} onChange={set('nationality')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Aadhar No" placeholder="XXXX XXXX XXXX" value={form.aadhar_no} onChange={set('aadhar_no')} />
            <Input label="PAN No" placeholder="ABCDE1234F" value={form.pan_no} onChange={set('pan_no')} />
          </div>
        </FormSection>

        <FormSection title="Center Address" icon={<MapPin size={16} />}>
          <Input label="Address Line 1" value={form.address_line1} onChange={set('address_line1')} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Landmark" value={form.landmark} onChange={set('landmark')} />
            <Input label="Post Office" value={form.post_office} onChange={set('post_office')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="City" value={form.city} onChange={set('city')} />
            <Input label="Pincode" value={form.pincode} onChange={set('pincode')} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Select label="Country" value={form.country_id} onChange={set('country_id')}>
              <option value="">Select Country</option>
              {countries.map(c => <option key={c.id} value={c.id}>{c.country_name}</option>)}
            </Select>
            <Select label="State" value={form.state_id} onChange={set('state_id')}>
              <option value="">Select State</option>
              {states.map(s => <option key={s.id} value={s.id}>{s.state_name}</option>)}
            </Select>
            <Select label="District" value={form.district_id} onChange={set('district_id')}>
              <option value="">Select District</option>
              {districts.map(d => <option key={d.id} value={d.id}>{d.district_name}</option>)}
            </Select>
          </div>
        </FormSection>

        <FormSection title="Organization Details" icon={<Briefcase size={16} />}>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Organization Name" value={form.organization_name} onChange={set('organization_name')} />
            <Select label="Organization Type" value={form.org_type} onChange={set('org_type')}>
              <option value="">Select</option>
              <option value="Education Consultancy">Education Consultancy</option>
              <option value="Institute">Institute</option>
              <option value="NGO">NGO</option>
              <option value="Other">Other</option>
            </Select>
          </div>
          <Textarea label="Organization Address" value={form.org_address} onChange={set('org_address')} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Org Post Office" value={form.org_post_office} onChange={set('org_post_office')} />
            <Input label="Org City" value={form.org_city} onChange={set('org_city')} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Select label="Org State" value={form.org_state_id} onChange={set('org_state_id')}>
              <option value="">Select State</option>
              {states.map(s => <option key={s.id} value={s.id}>{s.state_name}</option>)}
            </Select>
            <Select label="Org District" value={form.org_district_id} onChange={set('org_district_id')}>
              <option value="">Select District</option>
              {orgDistricts.map(d => <option key={d.id} value={d.id}>{d.district_name}</option>)}
            </Select>
            <Input label="Org Pincode" value={form.org_pincode} onChange={set('org_pincode')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Registration Number" value={form.registration_number} onChange={set('registration_number')} />
            <Input label="GST / PAN" value={form.gst_pan} onChange={set('gst_pan')} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Select label="Premises Type" value={form.premises_type} onChange={set('premises_type')}>
              <option value="Owned">Owned</option>
              <option value="Rented">Rented</option>
              <option value="Leased">Leased</option>
            </Select>
            <Input label="Office Area (sq ft)" type="number" value={form.office_area_sqft} onChange={set('office_area_sqft')} />
            <Input label="Student Capacity" type="number" value={form.student_capacity} onChange={set('student_capacity')} />
          </div>
          <Input label="Revenue Share %" type="number" placeholder="50" value={form.revenue_share_percentage} onChange={set('revenue_share_percentage')} />
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

        <FormSection title="Education Details" icon={<GraduationCap size={16} />}>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider -mb-1">10th</p>
          <div className="grid grid-cols-3 gap-4">
            <Input label="Institute Name" value={form.edu_10th_institute} onChange={set('edu_10th_institute')} />
            <Input label="Board / University" value={form.edu_10th_board} onChange={set('edu_10th_board')} />
            <Input label="Passing Year" type="number" placeholder="2010" value={form.edu_10th_year} onChange={set('edu_10th_year')} />
          </div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-2 -mb-1">12th</p>
          <div className="grid grid-cols-3 gap-4">
            <Input label="Institute Name" value={form.edu_12th_institute} onChange={set('edu_12th_institute')} />
            <Input label="Board / University" value={form.edu_12th_board} onChange={set('edu_12th_board')} />
            <Input label="Passing Year" type="number" placeholder="2012" value={form.edu_12th_year} onChange={set('edu_12th_year')} />
          </div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-2 -mb-1">UG (if applicable)</p>
          <div className="grid grid-cols-3 gap-4">
            <Input label="Institute Name" value={form.edu_ug_institute} onChange={set('edu_ug_institute')} />
            <Input label="Board / University" value={form.edu_ug_board} onChange={set('edu_ug_board')} />
            <Input label="Passing Year" type="number" value={form.edu_ug_year} onChange={set('edu_ug_year')} />
          </div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-2 -mb-1">PG (if applicable)</p>
          <div className="grid grid-cols-3 gap-4">
            <Input label="Institute Name" value={form.edu_pg_institute} onChange={set('edu_pg_institute')} />
            <Input label="Board / University" value={form.edu_pg_board} onChange={set('edu_pg_board')} />
            <Input label="Passing Year" type="number" value={form.edu_pg_year} onChange={set('edu_pg_year')} />
          </div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-2 -mb-1">Diploma (if applicable)</p>
          <div className="grid grid-cols-3 gap-4">
            <Input label="Institute Name" value={form.edu_diploma_institute} onChange={set('edu_diploma_institute')} />
            <Input label="Board / University" value={form.edu_diploma_board} onChange={set('edu_diploma_board')} />
            <Input label="Passing Year" type="number" value={form.edu_diploma_year} onChange={set('edu_diploma_year')} />
          </div>
        </FormSection>

        <FormSection title="Status & KYC" icon={<ShieldCheck size={16} />}>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Center Status" value={form.status} onChange={set('status')}>
              <option value="Pending">Pending</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </Select>
            <Select label="KYC Status" value={form.kyc_status} onChange={set('kyc_status')}>
              <option value="Pending">Pending</option>
              <option value="Verified">Verified</option>
            </Select>
          </div>
        </FormSection>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
            {error}
          </div>
        )}
        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={loading}>{loading ? 'Saving...' : isEdit ? 'Update Center' : 'Add Center'}</Button>
          <Button type="button" variant="outline" onClick={() => navigate(backTo)}>Cancel</Button>
        </div>
      </form>
    </div>
  )
}
