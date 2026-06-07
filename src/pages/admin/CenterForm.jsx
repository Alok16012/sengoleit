import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import PageHeader from '../../components/ui/PageHeader'
import Input, { Select, Textarea } from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import FormSection from '../../components/ui/FormSection'
import {
  Building2, User, Briefcase, CreditCard, GraduationCap, ShieldCheck,
  Upload, Eye, CheckCircle2, AlertCircle, ArrowRight, ArrowLeft
} from 'lucide-react'

const STEPS = [
  { label: 'Center Identity',    icon: Building2 },
  { label: 'Contact Person',     icon: User },
  { label: 'Organization',       icon: Briefcase },
  { label: 'Bank Details',       icon: CreditCard },
  { label: 'Education',          icon: GraduationCap },
  { label: 'Documents',          icon: Upload },
  { label: 'KYC & Status',       icon: ShieldCheck },
]

const emptyForm = {
  center_type: 'super_center',
  center_name: '', center_code: '', email: '', phone: '', generated_password: '',
  super_center_id: '',
  contact_person: '', father_mother_name: '', date_of_birth: '', gender: '', nationality: 'Indian',
  aadhar_no: '', pan_no: '',
  permanent_address: '', current_address: '', contact_mobile: '', contact_email: '',
  current_occupation: '', previous_experience_admissions: '',
  address_line1: '', landmark: '', post_office: '', city: '',
  country_id: '', state_id: '', district_id: '', pincode: '',
  organization_name: '', org_type: '', org_address: '', org_post_office: '', org_city: '',
  org_country_id: '', org_state_id: '', org_district_id: '', org_pincode: '',
  registration_number: '', gst_pan: '',
  centre_address: '',
  num_classrooms: '', has_computer_lab: false, num_computers: '', internet_speed: '',
  has_cctv: false, current_courses_offered: '', num_faculty: '',
  facility_reception_desk: false, facility_waiting_area: false, facility_meeting_room: false,
  photos_attached: false, rent_agreement_attached: '',
  premises_type: 'Owned', office_area_sqft: '', student_capacity: '', revenue_share_percentage: '50',
  bank_account_holder: '', bank_account_number: '', ifsc_code: '', bank_branch: '',
  edu_10th_institute: '', edu_10th_board: '', edu_10th_year: '',
  edu_12th_institute: '', edu_12th_board: '', edu_12th_year: '',
  edu_ug_institute: '', edu_ug_board: '', edu_ug_year: '',
  edu_pg_institute: '', edu_pg_board: '', edu_pg_year: '',
  edu_diploma_institute: '', edu_diploma_board: '', edu_diploma_year: '',
  // Documents
  owner_photo_url: '', owner_signature_url: '', owner_aadhar_url: '', owner_pan_url: '',
  center_reg_url: '', premises_photo_url: '', gst_url: '', agreement_url: '',
  cancel_cheque_url: '', bank_passbook_url: '',
  kyc_status: 'Pending', status: 'Pending',
}

function FileCard({ label, fieldKey, accept, isImage, value, onUpload, isUploading, hint }) {
  return (
    <div className="bg-gray-50/60 rounded-xl border border-gray-100 overflow-hidden">
      <div className="px-4 pt-3 pb-1 flex items-center justify-between">
        <p className="text-xs font-bold text-gray-700">{label}</p>
        {value && (
          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
            <CheckCircle2 size={10} /> Uploaded
          </span>
        )}
      </div>
      {hint && <p className="text-[10px] text-gray-400 px-4 pb-1">{hint}</p>}
      <div className="flex flex-col items-center px-4 py-4 gap-3">
        {value && isImage ? (
          <img src={value} alt={label} className="h-28 w-full object-contain rounded-lg border border-gray-200 bg-white shadow-sm" />
        ) : value && !isImage ? (
          <div className="h-20 w-full rounded-lg border-2 border-[#933d18]/20 bg-[#933d18]/5 flex items-center justify-center gap-2">
            <Upload size={18} className="text-[#933d18]/60" />
            <span className="text-xs font-semibold text-[#933d18]/80">Document uploaded</span>
          </div>
        ) : (
          <div className="h-20 w-full rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center bg-white">
            <p className="text-xs text-gray-300 font-medium">No file yet</p>
          </div>
        )}
        <div className="flex items-center gap-2">
          <label className={`cursor-pointer flex items-center gap-1.5 px-3 py-2 border rounded-xl text-xs font-semibold transition-all
            ${isUploading ? 'border-gray-200 text-gray-400 cursor-not-allowed bg-gray-50' : 'border-[#933d18]/30 text-[#933d18] hover:bg-[#933d18]/5 bg-white'}`}>
            <Upload size={11} />
            {isUploading ? 'Uploading...' : value ? 'Replace' : 'Upload'}
            <input type="file" accept={accept} className="hidden" disabled={isUploading}
              onChange={e => e.target.files[0] && onUpload(fieldKey, e.target.files[0])} />
          </label>
          {value && (
            <a href={value} target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-all">
              <Eye size={11} /> View
            </a>
          )}
        </div>
      </div>
    </div>
  )
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
  const [uploading, setUploading] = useState({})
  const [error, setError] = useState(null)
  const [step, setStep] = useState(0)
  const [stepError, setStepError] = useState('')
  const [fe, setFe] = useState({})
  const [sameAddress, setSameAddress] = useState(false)

  const handleSameAddress = (checked) => {
    setSameAddress(checked)
    if (checked) setForm(f => ({ ...f, permanent_address: f.current_address }))
  }

  const handleCurrentAddress = (e) => {
    const val = e.target.value
    setForm(f => ({ ...f, current_address: val, ...(sameAddress ? { permanent_address: val } : {}) }))
  }

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

  function validateField(key, val) {
    switch (key) {
      case 'email':
        if (!val) return 'Email is required'
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return 'Enter a valid email (e.g. name@example.com)'
        return ''
      case 'phone':
        if (!val) return 'Phone is required'
        if (val.length < 10) return 'Must be 10 digits'
        return ''
      case 'aadhar_no':
        if (!val) return 'Aadhar number is required'
        if (val.length < 12) return 'Must be 12 digits'
        return ''
      case 'contact_mobile':
        if (!val) return 'Mobile number is required'
        if (val.length < 10) return 'Must be 10 digits'
        return ''
      case 'contact_email':
        if (val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return 'Enter a valid email'
        return ''
      case 'pincode':
        if (val && val.length < 6) return 'Must be 6 digits'
        return ''
      case 'org_pincode':
        if (val && val.length < 6) return 'Must be 6 digits'
        return ''
      default:
        return ''
    }
  }

  function setField(key, val) {
    setForm(f => ({ ...f, [key]: val }))
    setFe(f => ({ ...f, [key]: validateField(key, val) }))
  }

  async function handleFileUpload(fieldKey, file) {
    setUploading(u => ({ ...u, [fieldKey]: true }))
    setError(null)
    try {
      const ext = file.name.split('.').pop()
      const centerId = id || `new_${Date.now()}`
      const path = `centers/${centerId}/${fieldKey}_${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('documents').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path)
      setForm(f => ({ ...f, [fieldKey]: publicUrl }))
    } catch (err) {
      setError('Upload failed: ' + err.message)
    }
    setUploading(u => ({ ...u, [fieldKey]: false }))
  }

  function validateStep(s) {
    switch (s) {
      case 0:
        if (!form.center_name.trim()) return 'Center Name is required'
        if (!form.email.trim()) return 'Email is required'
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Enter a valid email'
        if (!form.phone.trim()) return 'Phone is required'
        if (form.phone.length < 10) return 'Phone must be 10 digits'
        if (!isEdit && !form.generated_password.trim()) return 'Login Password is required'
        return null
      case 1:
        if (!form.contact_person.trim()) return 'Contact Person Name is required'
        if (!form.aadhar_no.trim()) return 'Aadhar Number is required'
        if (form.aadhar_no.length < 12) return 'Aadhar must be 12 digits'
        if (!form.contact_mobile.trim()) return 'Mobile number is required'
        if (form.contact_mobile.length < 10) return 'Mobile must be 10 digits'
        return null
      default:
        return null
    }
  }

  function handleNext() {
    const err = validateStep(step)
    if (err) { setStepError(err); return }
    setStepError('')
    setStep(s => s + 1)
  }

  function handlePrev() {
    setStepError('')
    setStep(s => s - 1)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const payload = { ...form }
      if (!isEdit) payload.approval_status = 'pending'
      const plainPassword = payload.generated_password
      delete payload.id; delete payload.created_at; delete payload.updated_at
      const fkFields = ['country_id', 'state_id', 'district_id', 'org_country_id', 'org_state_id', 'org_district_id', 'super_center_id']
      fkFields.forEach(k => { if (!payload[k]) delete payload[k] })
      const numericFields = ['office_area_sqft', 'student_capacity', 'revenue_share_percentage', 'virtual_balance',
        'num_classrooms', 'num_computers', 'num_faculty']
      numericFields.forEach(k => {
        if (payload[k] === '' || payload[k] === null) delete payload[k]
        else if (payload[k] !== undefined) payload[k] = Number(payload[k])
      })
      Object.keys(payload).forEach(k => { if (payload[k] === '') delete payload[k] })

      if (!isEdit && payload.email && plainPassword) {
        const { data: { session: adminSession } } = await supabase.auth.getSession()
        const { data: authData, error: authErr } = await supabase.auth.signUp({
          email: payload.email,
          password: plainPassword,
          options: { data: { role: payload.center_type === 'super_center' ? 'super_center' : 'center' } }
        })
        if (authErr && !authErr.message.includes('already registered')) throw authErr
        if (authData?.user) {
          await supabase.from('profiles').upsert({
            id: authData.user.id,
            role: payload.center_type === 'super_center' ? 'super_center' : 'center'
          })
        }
        if (adminSession?.access_token) {
          await supabase.auth.setSession({
            access_token: adminSession.access_token,
            refresh_token: adminSession.refresh_token,
          })
        }
      }

      const { error: err } = isEdit
        ? await supabase.from('centers').update(payload).eq('id', id)
        : await supabase.from('centers').insert(payload)
      if (err) throw err
      navigate(form.center_type === 'super_center' ? '/admin/super-centers' : '/admin/centers')
    } catch (err) {
      setError(err.message || 'Something went wrong.')
      setLoading(false)
    }
  }

  const availableSuperCenters = allCenters.filter(c => c.id !== id && c.center_type === 'super_center')
  const backTo = form.center_type === 'super_center' ? '/admin/super-centers' : '/admin/centers'

  const docFields = [
    ['owner_photo_url', 'Owner Photo'],
    ['owner_signature_url', 'Owner Signature'],
    ['owner_aadhar_url', 'Aadhar Card'],
    ['owner_pan_url', 'PAN Card'],
    ['center_reg_url', 'Registration Cert.'],
    ['premises_photo_url', 'Premises Photo'],
    ['gst_url', 'GST Certificate'],
    ['agreement_url', 'Agreement Doc'],
    ['cancel_cheque_url', 'Cancel Cheque'],
    ['bank_passbook_url', 'Bank Passbook'],
  ]
  const docsUploaded = docFields.filter(([k]) => !!form[k]).length

  return (
    <div className="p-4 lg:p-6 pb-20">
      <PageHeader title={isEdit ? 'Edit Center' : 'Add Center'} backTo={backTo} />

      {/* Step header */}
      <div className="sticky top-0 z-20 mt-4 mb-5 bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
        <div className="overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="flex items-stretch min-w-max">
            {STEPS.map((s, i) => {
              const isActive = step === i
              const isPast = i < step
              const Icon = s.icon
              return (
                <div key={i} className="flex items-center">
                  <button
                    type="button"
                    onClick={() => { if (isPast) { setStepError(''); setStep(i) } }}
                    className={`relative flex items-center gap-2.5 px-5 py-3.5 transition-all
                      ${isActive
                        ? 'bg-[#933d18] text-white'
                        : isPast
                          ? 'bg-[#933d18]/8 text-[#933d18]/70 hover:bg-[#933d18]/12 cursor-pointer'
                          : 'text-gray-400 cursor-default'
                      }`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0
                      ${isActive ? 'bg-white/20 text-white' : isPast ? 'bg-[#933d18]/20 text-[#933d18]' : 'bg-gray-100 text-gray-400'}`}>
                      {isPast ? <CheckCircle2 size={13} /> : i + 1}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Icon size={13} className={isActive ? 'text-white/80' : isPast ? 'text-[#933d18]/60' : 'text-gray-300'} />
                      <span className={`text-xs font-bold whitespace-nowrap ${isActive ? 'text-white' : isPast ? 'text-[#933d18]/80' : 'text-gray-500'}`}>
                        {s.label}
                      </span>
                    </div>
                    {isActive && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/40 rounded-full" />}
                  </button>
                  {i < STEPS.length - 1 && (
                    <div className={`w-px self-stretch my-2 ${isPast ? 'bg-[#933d18]/20' : 'bg-gray-200'}`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">

        {/* STEP 0: Center Identity */}
        {step === 0 && (
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
              <Input label="Center Code (Auto-generated on approval)" placeholder="Will be assigned by Account Dept" value={form.center_code} readOnly className="bg-gray-50 cursor-not-allowed text-gray-400" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Email (Login ID) *" type="email" value={form.email}
                onChange={e => setField('email', e.target.value)} error={fe.email} required />
              <Input label="Phone *" inputMode="numeric" value={form.phone}
                onChange={e => setField('phone', e.target.value.replace(/\D/g, '').slice(0, 10))} error={fe.phone} />
            </div>
            {!isEdit && (
              <Input label="Login Password *" type="text" placeholder="Set password for center portal login" value={form.generated_password} onChange={set('generated_password')} />
            )}
            {form.center_type !== 'super_center' && (
              <Select label="Super Center (Parent)" value={form.super_center_id} onChange={set('super_center_id')}>
                <option value="">— None —</option>
                {availableSuperCenters.map(c => (
                  <option key={c.id} value={c.id}>{c.center_name}{c.center_code ? ` (${c.center_code})` : ''}</option>
                ))}
              </Select>
            )}
          </FormSection>
        )}

        {/* STEP 1: Contact Person */}
        {step === 1 && (
          <FormSection title="Contact Person Details" icon={<User size={16} />}>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Contact Person Name *" value={form.contact_person} onChange={set('contact_person')} required />
              <Input label="Father / Mother Name *" value={form.father_mother_name} onChange={set('father_mother_name')} required />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Input label="Date of Birth *" type="date" value={form.date_of_birth} onChange={set('date_of_birth')} required />
              <Select label="Gender *" value={form.gender} onChange={set('gender')} required>
                <option value="">Select</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </Select>
              <Input label="Nationality *" value={form.nationality} onChange={set('nationality')} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Aadhar No *" placeholder="XXXX XXXX XXXX" inputMode="numeric" value={form.aadhar_no}
                onChange={e => setField('aadhar_no', e.target.value.replace(/\D/g, '').slice(0, 12))} error={fe.aadhar_no} required />
              <Input label="PAN No *" placeholder="ABCDE1234F" value={form.pan_no} onChange={set('pan_no')} required />
            </div>

            {/* Contact Details */}
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-2">Contact Details</p>
            <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-end">
              <Input label="Current Address *" value={form.current_address} onChange={handleCurrentAddress} />
              <div className="pb-2.5 flex flex-col items-center gap-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">Same</span>
                <input type="checkbox" checked={sameAddress} onChange={e => handleSameAddress(e.target.checked)}
                  className="w-4 h-4 accent-[#933d18] cursor-pointer" />
              </div>
              <Input label="Permanent Address *" value={form.permanent_address} onChange={set('permanent_address')}
                disabled={sameAddress} placeholder={sameAddress ? 'Same as current address' : ''} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Mobile Number *" inputMode="numeric" maxLength={10} value={form.contact_mobile}
                onChange={e => setField('contact_mobile', e.target.value.replace(/\D/g, '').slice(0, 10))} error={fe.contact_mobile} required />
              <Input label="Email Address" type="email" value={form.contact_email}
                onChange={e => setField('contact_email', e.target.value)} error={fe.contact_email} />
            </div>

            {/* Professional Details */}
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-2">Professional Details</p>
            <Input label="Current Occupation" value={form.current_occupation} onChange={set('current_occupation')} />
            <Input label="Previous Experience in Admissions (if any)" value={form.previous_experience_admissions} onChange={set('previous_experience_admissions')} />
          </FormSection>
        )}

        {/* STEP 2: Organization Details */}
        {step === 2 && (
          <FormSection title="Organization Details" icon={<Briefcase size={16} />}>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Organization Name *" value={form.organization_name} onChange={set('organization_name')} required />
              <Select label="Organization Type *" value={form.org_type} onChange={set('org_type')} required>
                <option value="">Select</option>
                <option value="Education Consultancy">Education Consultancy</option>
                <option value="Institute">Institute</option>
                <option value="NGO">NGO</option>
                <option value="Pvt. Ltd">Pvt. Ltd</option>
                <option value="Others">Others</option>
              </Select>
            </div>
            <Textarea label="Organization Address *" value={form.org_address} onChange={set('org_address')} required />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Org Post Office" value={form.org_post_office} onChange={set('org_post_office')} />
              <Input label="Org City *" value={form.org_city} onChange={set('org_city')} required />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Select label="Org State *" value={form.org_state_id} onChange={set('org_state_id')}>
                <option value="">Select State</option>
                {states.map(s => <option key={s.id} value={s.id}>{s.state_name}</option>)}
              </Select>
              <Select label="Org District" value={form.org_district_id} onChange={set('org_district_id')}>
                <option value="">Select District</option>
                {orgDistricts.map(d => <option key={d.id} value={d.id}>{d.district_name}</option>)}
              </Select>
              <Input label="Org Pincode *" inputMode="numeric" value={form.org_pincode}
                onChange={e => setField('org_pincode', e.target.value.replace(/\D/g, '').slice(0, 6))} error={fe.org_pincode} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Registration Number *" value={form.registration_number} onChange={set('registration_number')} required />
              <Input label="GST / PAN" value={form.gst_pan} onChange={set('gst_pan')} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Select label="Premises Type *" value={form.premises_type} onChange={set('premises_type')}>
                <option value="Owned">Owned</option>
                <option value="Rented">Rented</option>
                <option value="Leased">Leased</option>
              </Select>
              <Input label="Office Area (sq ft)" type="number" value={form.office_area_sqft} onChange={set('office_area_sqft')} />
              <Input label="Student Capacity" type="number" value={form.student_capacity} onChange={set('student_capacity')} />
            </div>
            <Input label="Revenue Share %" type="number" placeholder="50" value={form.revenue_share_percentage} onChange={set('revenue_share_percentage')} />

            {/* Infrastructure */}
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-2">Infrastructure</p>
            <div className="grid grid-cols-3 gap-4">
              <Input label="No. of Class Rooms" type="number" min="0" value={form.num_classrooms} onChange={set('num_classrooms')} />
              <Input label="No. of Faculty" type="number" min="0" value={form.num_faculty} onChange={set('num_faculty')} />
              <Input label="Internet Speed" placeholder="e.g. 100 Mbps" value={form.internet_speed} onChange={set('internet_speed')} />
            </div>
            <div className="grid grid-cols-3 gap-4 items-end">
              <Select label="Computer Lab" value={form.has_computer_lab ? 'yes' : 'no'}
                onChange={e => setForm(f => ({ ...f, has_computer_lab: e.target.value === 'yes', ...(e.target.value === 'no' ? { num_computers: '' } : {}) }))}>
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </Select>
              {form.has_computer_lab && (
                <Input label="No. of Computers" type="number" min="0" value={form.num_computers} onChange={set('num_computers')} />
              )}
              <Select label="CCTV Camera" value={form.has_cctv ? 'yes' : 'no'}
                onChange={e => setForm(f => ({ ...f, has_cctv: e.target.value === 'yes' }))}>
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </Select>
            </div>
            <Textarea label="Current Courses Offered" placeholder="List the courses currently offered at this centre" value={form.current_courses_offered} onChange={set('current_courses_offered')} />

            {/* Facilities Available */}
            <div>
              <p className="text-xs font-bold text-gray-500 mb-2">Facilities Available</p>
              <div className="flex flex-wrap gap-5">
                {[
                  ['facility_reception_desk', 'Reception Desk'],
                  ['facility_waiting_area', 'Waiting Area'],
                  ['facility_meeting_room', 'Meeting Room'],
                ].map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={!!form[key]}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))}
                      className="w-4 h-4 accent-[#933d18]" />
                    <span className="text-sm text-gray-700">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Photographs + Rent Agreement */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-bold text-gray-500 mb-2">Photographs Attached</p>
                <div className="flex items-center gap-5">
                  {[['true', 'Yes'], ['false', 'No']].map(([val, label]) => (
                    <label key={val} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="photos_attached_cf" value={val}
                        checked={String(!!form.photos_attached) === val}
                        onChange={() => setForm(f => ({ ...f, photos_attached: val === 'true' }))}
                        className="accent-[#933d18]" />
                      <span className="text-sm text-gray-700">{label}</span>
                    </label>
                  ))}
                </div>
                {form.photos_attached && (
                  <div className="mt-3 max-w-xs">
                    <FileCard label="Premises Photo" fieldKey="premises_photo_url" accept="image/*" isImage
                      value={form.premises_photo_url} onUpload={handleFileUpload} isUploading={!!uploading.premises_photo_url}
                      hint="Upload center building / office photo" />
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 mb-2">Rent Agreement / Ownership Proof</p>
                <div className="flex items-center gap-5">
                  {['Attached', 'Not Attached'].map(v => (
                    <label key={v} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="rent_agreement_cf" value={v}
                        checked={form.rent_agreement_attached === v}
                        onChange={() => setForm(f => ({ ...f, rent_agreement_attached: v }))}
                        className="accent-[#933d18]" />
                      <span className="text-sm text-gray-700">{v}</span>
                    </label>
                  ))}
                </div>
                {form.rent_agreement_attached === 'Attached' && (
                  <div className="mt-3 max-w-xs">
                    <FileCard label="Rent Agreement / Ownership Proof" fieldKey="agreement_url" accept="image/*,application/pdf" isImage={false}
                      value={form.agreement_url} onUpload={handleFileUpload} isUploading={!!uploading.agreement_url}
                      hint="Upload rent agreement / ownership document (PDF or image)" />
                  </div>
                )}
              </div>
            </div>
          </FormSection>
        )}

        {/* STEP 3: Bank Details */}
        {step === 3 && (
          <FormSection title="Bank Details" icon={<CreditCard size={16} />}>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Account Holder Name *" value={form.bank_account_holder} onChange={set('bank_account_holder')} required />
              <Input label="Account Number *" value={form.bank_account_number} onChange={set('bank_account_number')} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="IFSC Code *" value={form.ifsc_code} onChange={set('ifsc_code')} required />
              <Input label="Bank Branch *" value={form.bank_branch} onChange={set('bank_branch')} required />
            </div>
          </FormSection>
        )}

        {/* STEP 4: Education Details */}
        {step === 4 && (
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
        )}

        {/* STEP 5: Documents – Identity */}
        {step === 5 && (
          <FormSection title="Identity Documents" icon={<User size={16} />}
            subtitle="Owner's personal identity documents">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <FileCard label="Owner Photo *" fieldKey="owner_photo_url" accept="image/*" isImage
                value={form.owner_photo_url} onUpload={handleFileUpload} isUploading={!!uploading.owner_photo_url}
                hint="Passport-size photo" />
              <FileCard label="Owner Signature *" fieldKey="owner_signature_url" accept="image/*" isImage
                value={form.owner_signature_url} onUpload={handleFileUpload} isUploading={!!uploading.owner_signature_url}
                hint="Signature on white paper" />
              <FileCard label="Aadhar Card *" fieldKey="owner_aadhar_url" accept="image/*,application/pdf" isImage={false}
                value={form.owner_aadhar_url} onUpload={handleFileUpload} isUploading={!!uploading.owner_aadhar_url}
                hint="Front & back (PDF or image)" />
              <FileCard label="PAN Card *" fieldKey="owner_pan_url" accept="image/*,application/pdf" isImage={false}
                value={form.owner_pan_url} onUpload={handleFileUpload} isUploading={!!uploading.owner_pan_url}
                hint="Owner's PAN card" />
            </div>
          </FormSection>
        )}

        {/* STEP 5: Documents – Center */}
        {step === 5 && (
          <FormSection title="Center Documents" icon={<Building2 size={16} />}
            subtitle="Organization and premises documents">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <FileCard label="Registration Cert. *" fieldKey="center_reg_url" accept="image/*,application/pdf" isImage={false}
                value={form.center_reg_url} onUpload={handleFileUpload} isUploading={!!uploading.center_reg_url}
                hint="Society / trust / company reg." />
              <FileCard label="Premises Photo *" fieldKey="premises_photo_url" accept="image/*" isImage
                value={form.premises_photo_url} onUpload={handleFileUpload} isUploading={!!uploading.premises_photo_url}
                hint="Center building / office" />
              <FileCard label="GST Certificate" fieldKey="gst_url" accept="image/*,application/pdf" isImage={false}
                value={form.gst_url} onUpload={handleFileUpload} isUploading={!!uploading.gst_url}
                hint="If applicable" />
              <FileCard label="Agreement Document *" fieldKey="agreement_url" accept="image/*,application/pdf" isImage={false}
                value={form.agreement_url} onUpload={handleFileUpload} isUploading={!!uploading.agreement_url}
                hint="Signed MOU with university" />
            </div>
          </FormSection>
        )}

        {/* STEP 5: Documents – Bank */}
        {step === 5 && (
          <FormSection title="Bank Documents" icon={<CreditCard size={16} />}
            subtitle="Bank verification documents">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <FileCard label="Cancel Cheque *" fieldKey="cancel_cheque_url" accept="image/*,application/pdf" isImage={false}
                value={form.cancel_cheque_url} onUpload={handleFileUpload} isUploading={!!uploading.cancel_cheque_url}
                hint="Cancelled cheque of bank account" />
              <FileCard label="Bank Passbook *" fieldKey="bank_passbook_url" accept="image/*,application/pdf" isImage={false}
                value={form.bank_passbook_url} onUpload={handleFileUpload} isUploading={!!uploading.bank_passbook_url}
                hint="First page or recent statement" />
            </div>
          </FormSection>
        )}

        {/* STEP 5: Documents – Upload Summary */}
        {step === 5 && (
          <div className="bg-gray-50 rounded-xl border border-gray-100 p-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Upload Summary — {docsUploaded}/10 documents uploaded</p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {docFields.map(([k, label]) => (
                <div key={k} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-gray-100">
                  <span className="text-[11px] text-gray-600 truncate">{label}</span>
                  {form[k]
                    ? <CheckCircle2 size={13} className="text-emerald-500 shrink-0 ml-1" />
                    : <div className="w-3 h-3 rounded-full border-2 border-gray-300 shrink-0 ml-1" />
                  }
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 6: KYC & Status */}
        {step === 6 && (
          <FormSection title="KYC & Status" icon={<ShieldCheck size={16} />}>
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

            {/* Final summary */}
            <div className="bg-[#933d18]/5 border border-[#933d18]/20 rounded-xl p-4 mt-2">
              <p className="text-xs font-bold text-[#933d18] uppercase tracking-widest mb-3">Form Summary</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {[
                  ['Center Name', form.center_name],
                  ['Center Type', form.center_type === 'super_center' ? 'Super Center' : 'Center'],
                  ['Email', form.email],
                  ['Phone', form.phone],
                  ['Contact Person', form.contact_person],
                  ['City', form.city],
                  ['Organization', form.organization_name],
                  ['Documents', `${docsUploaded}/10 uploaded`],
                ].map(([label, val]) => (
                  <div key={label} className="flex gap-2">
                    <span className="text-gray-400 text-xs">{label}:</span>
                    <span className="text-gray-800 text-xs font-semibold truncate">{val || '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          </FormSection>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
            <AlertCircle size={15} /> {error}
          </div>
        )}

        {/* Step error */}
        {stepError && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            <AlertCircle size={15} className="shrink-0" /> {stepError}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2 pb-8">
          <div>
            {step > 0 && (
              <Button type="button" variant="outline" onClick={handlePrev}>
                <ArrowLeft size={14} /> Back
              </Button>
            )}
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={() => navigate(backTo)}>Cancel</Button>
            {step < STEPS.length - 1 ? (
              <Button type="button" onClick={handleNext}>
                Next <ArrowRight size={14} />
              </Button>
            ) : (
              <Button type="submit" disabled={loading}>
                {loading ? 'Saving...' : isEdit ? 'Update Center' : 'Add Center'}
              </Button>
            )}
          </div>
        </div>

      </form>
    </div>
  )
}
