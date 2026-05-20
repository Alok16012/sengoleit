// NOTE: For this form to submit successfully, add this policy in Supabase Dashboard → SQL Editor:
//
// CREATE POLICY "allow_public_center_registration"
// ON public.centers FOR INSERT
// WITH CHECK (center_type = 'center' AND approval_status = 'pending');

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import {
  Upload, CheckCircle, AlertCircle, Building2, User, MapPin,
  Briefcase, CreditCard, GraduationCap, Wallet, FileText, Eye, CheckCircle2
} from 'lucide-react'

const STEPS = [
  { label: 'Center Identity', icon: Building2 },
  { label: 'Contact Person',  icon: User },
  { label: 'Center Address',  icon: MapPin },
  { label: 'Organization',    icon: Briefcase },
  { label: 'Bank Details',    icon: CreditCard },
  { label: 'Education',       icon: GraduationCap },
  { label: 'Payment',         icon: Wallet },
  { label: 'Documents',       icon: FileText },
]

const emptyForm = {
  center_name: '', center_code: '', email: '', phone: '',
  contact_person: '', father_mother_name: '', date_of_birth: '', gender: '', nationality: 'Indian',
  aadhar_no: '', pan_no: '',
  permanent_address: '', current_address: '', contact_mobile: '', contact_email: '',
  current_occupation: '', previous_experience_admissions: '',
  address_line1: '', landmark: '', post_office: '', city: '',
  country_id: '', state_id: '', district_id: '', pincode: '',
  organization_name: '', org_type: '', org_address: '', org_post_office: '', org_city: '',
  org_state_id: '', org_district_id: '', org_pincode: '',
  registration_number: '', gst_pan: '',
  facility_reception_desk: false, facility_waiting_area: false, facility_meeting_room: false,
  photos_attached: false, rent_agreement_attached: '',
  premises_type: 'Owned', office_area_sqft: '', student_capacity: '',
  bank_account_holder: '', bank_account_number: '', ifsc_code: '', bank_branch: '',
  edu_10th_institute: '', edu_10th_board: '', edu_10th_year: '',
  edu_12th_institute: '', edu_12th_board: '', edu_12th_year: '',
  edu_ug_institute: '',   edu_ug_board: '',   edu_ug_year: '',
  edu_pg_institute: '',   edu_pg_board: '',   edu_pg_year: '',
  edu_diploma_institute: '', edu_diploma_board: '', edu_diploma_year: '',
  amount_paid: '', utr_number: '', payment_date: '', payment_remark: '',
}

const inp = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#933d18] focus:ring-2 focus:ring-[#933d18]/10 bg-white'

const onlyNums = (e, maxLen) => {
  const val = e.target.value.replace(/\D/g, '')
  e.target.value = maxLen ? val.slice(0, maxLen) : val
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function Field({ label, required, children }) {
  return (
    <div>
      <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

function FileCard({ label, fileKey, accept = 'image/*,application/pdf', isImage, files, previews, onChange, uploadedUrl, hint }) {
  const ref = useRef()
  const file = files[fileKey]
  const preview = previews[fileKey]
  return (
    <div className="bg-gray-50 rounded-xl border border-gray-100">
      <div className="px-4 pt-3 pb-1 flex items-center justify-between">
        <p className="text-xs font-bold text-gray-700">{label}</p>
        {(file || uploadedUrl) && (
          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
            <CheckCircle2 size={10} /> Ready
          </span>
        )}
      </div>
      {hint && <p className="text-[10px] text-gray-400 px-4 pb-1">{hint}</p>}
      <div className="px-4 pb-4 pt-2 flex flex-col gap-2">
        {preview && isImage ? (
          <img src={preview} alt={label} className="h-24 w-full object-contain rounded-lg border border-gray-200 bg-white" />
        ) : file ? (
          <div className="h-16 w-full rounded-lg border-2 border-[#933d18]/20 bg-[#933d18]/5 flex items-center justify-center gap-2">
            <Upload size={14} className="text-[#933d18]/60" />
            <span className="text-xs font-semibold text-[#933d18]/80 truncate max-w-[140px]">{file.name}</span>
          </div>
        ) : (
          <div className="h-16 w-full rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center bg-white cursor-pointer"
            onClick={() => ref.current?.click()}>
            <p className="text-xs text-gray-300 font-medium">Click to upload</p>
          </div>
        )}
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => ref.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-[#933d18]/30 text-[#933d18] rounded-lg text-xs font-semibold hover:bg-[#933d18]/5 transition-all">
            <Upload size={11} /> {file ? 'Replace' : 'Upload'}
          </button>
          {uploadedUrl && (
            <a href={uploadedUrl} target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-all">
              <Eye size={11} /> View
            </a>
          )}
        </div>
        <input ref={ref} type="file" accept={accept} className="hidden"
          onChange={e => { const f = e.target.files[0]; if (f) onChange(fileKey, f) }} />
      </div>
    </div>
  )
}

export default function CenterRegistrationForm() {
  const { superCenterCode } = useParams()
  const [superCenter, setSuperCenter] = useState(null)
  const [loadingSC, setLoadingSC] = useState(true)
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(emptyForm)
  const [files, setFiles] = useState({})
  const [previews, setPreviews] = useState({})
  const [sameAddress, setSameAddress] = useState(false)
  const [countries, setCountries] = useState([])
  const [states, setStates] = useState([])
  const [districts, setDistricts] = useState([])
  const [orgDistricts, setOrgDistricts] = useState([])
  const [stepError, setStepError] = useState('')
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('centers')
      .select('id, center_name, center_code')
      .eq('center_code', superCenterCode)
      .eq('center_type', 'super_center')
      .maybeSingle()
      .then(({ data }) => { setSuperCenter(data); setLoadingSC(false) })

    Promise.all([
      supabase.from('countries').select('id, country_name').order('country_name'),
      supabase.from('states').select('id, state_name').order('state_name'),
    ]).then(([c, s]) => {
      setCountries(c.data || [])
      setStates(s.data || [])
    })
  }, [superCenterCode])

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

  useEffect(() => { window.scrollTo(0, 0) }, [step])

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function handleFile(key, file) {
    setFiles(f => ({ ...f, [key]: file }))
    if (file.type.startsWith('image')) setPreviews(p => ({ ...p, [key]: URL.createObjectURL(file) }))
    else setPreviews(p => ({ ...p, [key]: null }))
  }

  function handleSameAddress(checked) {
    setSameAddress(checked)
    if (checked) setForm(f => ({ ...f, permanent_address: f.current_address }))
  }

  function validateStep(s) {
    switch (s) {
      case 0:
        if (!form.center_name.trim()) return 'Center Name is required'
        if (!form.email.trim()) return 'Email is required'
        if (!isValidEmail(form.email)) return 'Valid email address required (e.g. name@example.com)'
        if (!form.phone.trim()) return 'Phone is required'
        if (form.phone.length < 10) return 'Phone number must be 10 digits'
        return null
      case 1:
        if (!form.contact_person.trim()) return 'Contact Person Name is required'
        if (!form.aadhar_no.trim()) return 'Aadhar Number is required'
        if (form.aadhar_no.length !== 12) return 'Aadhar Number must be exactly 12 digits'
        if (form.contact_email && !isValidEmail(form.contact_email)) return 'Valid contact email required'
        if (form.contact_mobile && form.contact_mobile.length < 10) return 'Contact mobile must be 10 digits'
        return null
      case 2:
        if (!form.city.trim()) return 'City is required'
        if (!form.pincode.trim()) return 'Pincode is required'
        if (form.pincode.length !== 6) return 'Pincode must be 6 digits'
        return null
      default:
        return null
    }
  }

  function handleNext() {
    const err = validateStep(step)
    if (err) {
      setStepError(err)
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
      return
    }
    setStepError('')
    setStep(s => s + 1)
  }

  async function uploadFile(key, file) {
    if (!file) return null
    const ext = file.name.split('.').pop()
    const path = `center-registrations/${superCenterCode}/${Date.now()}_${key}.${ext}`
    const { error } = await supabase.storage.from('documents').upload(path, file)
    if (error) return null
    return supabase.storage.from('documents').getPublicUrl(path).data.publicUrl
  }

  async function handleSubmit() {
    setSaving(true)
    setError('')
    try {
      const docKeys = [
        'owner_photo_url', 'owner_signature_url', 'owner_aadhar_url', 'owner_pan_url',
        'center_reg_url', 'premises_photo_url', 'gst_url', 'agreement_url',
        'cancel_cheque_url', 'bank_passbook_url', 'payment_screenshot_url',
      ]
      const uploadResults = await Promise.all(docKeys.map(k => uploadFile(k, files[k])))
      const docUrls = Object.fromEntries(docKeys.map((k, i) => [k, uploadResults[i]]))

      const payload = {
        center_type: 'center',
        super_center_id: superCenter.id,
        approval_status: 'pending',
        center_name: form.center_name,
        center_code: form.center_code || null,
        email: form.email,
        phone: form.phone,
        contact_person: form.contact_person,
        father_mother_name: form.father_mother_name,
        date_of_birth: form.date_of_birth || null,
        gender: form.gender,
        nationality: form.nationality,
        aadhar_no: form.aadhar_no,
        pan_no: form.pan_no,
        permanent_address: form.permanent_address,
        current_address: form.current_address,
        contact_mobile: form.contact_mobile,
        contact_email: form.contact_email,
        current_occupation: form.current_occupation,
        previous_experience_admissions: form.previous_experience_admissions,
        address_line1: form.address_line1,
        landmark: form.landmark,
        post_office: form.post_office,
        city: form.city,
        pincode: form.pincode,
        organization_name: form.organization_name,
        org_type: form.org_type,
        org_address: form.org_address,
        org_post_office: form.org_post_office,
        org_city: form.org_city,
        org_pincode: form.org_pincode,
        registration_number: form.registration_number,
        gst_pan: form.gst_pan,
        facility_reception_desk: form.facility_reception_desk,
        facility_waiting_area: form.facility_waiting_area,
        facility_meeting_room: form.facility_meeting_room,
        photos_attached: form.photos_attached,
        rent_agreement_attached: form.rent_agreement_attached,
        premises_type: form.premises_type,
        bank_account_holder: form.bank_account_holder,
        bank_account_number: form.bank_account_number,
        ifsc_code: form.ifsc_code,
        bank_branch: form.bank_branch,
        edu_10th_institute: form.edu_10th_institute,  edu_10th_board: form.edu_10th_board,  edu_10th_year: form.edu_10th_year,
        edu_12th_institute: form.edu_12th_institute,  edu_12th_board: form.edu_12th_board,  edu_12th_year: form.edu_12th_year,
        edu_ug_institute: form.edu_ug_institute,      edu_ug_board: form.edu_ug_board,      edu_ug_year: form.edu_ug_year,
        edu_pg_institute: form.edu_pg_institute,      edu_pg_board: form.edu_pg_board,      edu_pg_year: form.edu_pg_year,
        edu_diploma_institute: form.edu_diploma_institute, edu_diploma_board: form.edu_diploma_board, edu_diploma_year: form.edu_diploma_year,
        utr_number: form.utr_number,
        payment_date: form.payment_date || null,
        payment_remark: form.payment_remark,
        ...docUrls,
      }

      // FK fields — omit if empty
      if (form.country_id) payload.country_id = form.country_id
      if (form.state_id) payload.state_id = form.state_id
      if (form.district_id) payload.district_id = form.district_id
      if (form.org_state_id) payload.org_state_id = form.org_state_id
      if (form.org_district_id) payload.org_district_id = form.org_district_id

      // Numeric fields
      if (form.office_area_sqft) payload.office_area_sqft = Number(form.office_area_sqft)
      if (form.student_capacity) payload.student_capacity = Number(form.student_capacity)
      if (form.amount_paid) payload.amount_paid = Number(form.amount_paid)

      // Remove null/empty strings
      Object.keys(payload).forEach(k => {
        if (payload[k] === '' || payload[k] === undefined) delete payload[k]
      })

      const { error: insErr } = await supabase.from('centers').insert(payload)
      if (insErr) throw insErr
      setSubmitted(true)
    } catch (err) {
      setError(err.message || 'Submission failed. Please try again.')
    }
    setSaving(false)
  }

  // --- Loading / invalid / success screens ---

  if (loadingSC) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-8 h-8 border-4 border-[#933d18] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!superCenter) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="bg-white rounded-2xl border border-red-200 p-8 max-w-md text-center">
        <AlertCircle size={40} className="mx-auto text-red-400 mb-3" />
        <h2 className="text-xl font-black text-gray-900 mb-2">Invalid Link</h2>
        <p className="text-gray-500 text-sm">This registration link is invalid or expired. Please contact the center that shared this link.</p>
      </div>
    </div>
  )

  if (submitted) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="bg-white rounded-2xl border border-emerald-200 p-10 max-w-md text-center shadow-xl">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={32} className="text-emerald-600" />
        </div>
        <h2 className="text-2xl font-black text-gray-900 mb-2">Application Submitted!</h2>
        <p className="text-gray-500 text-sm mb-4">Your center registration has been submitted to <strong>{superCenter.center_name}</strong> for review.</p>
        <p className="text-xs text-gray-400 bg-gray-50 rounded-xl p-3">You will be contacted on your registered email/phone once your application is verified.</p>
      </div>
    </div>
  )

  const card = 'bg-white rounded-2xl border border-gray-200 p-6'
  const sectionTitle = (icon, label) => (
    <h2 className="font-black text-gray-900 flex items-center gap-2 mb-4">
      <span className="text-[#933d18]">{icon}</span> {label}
    </h2>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#933d18] text-white py-8 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <p className="text-orange-200 text-xs font-bold uppercase tracking-widest mb-1">Center Registration</p>
          <h1 className="text-2xl font-black">Apply via {superCenter.center_name}</h1>
          <p className="text-orange-100/70 text-sm mt-1">Fill all details carefully. Fields marked * are required.</p>
        </div>
      </div>

      {/* Step Progress */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex gap-1 overflow-x-auto [&::-webkit-scrollbar]:hidden">
          {STEPS.map((s, i) => {
            const Icon = s.icon
            const isActive = i === step
            const isPast = i < step
            return (
              <button key={i} onClick={() => { if (isPast) { setStepError(''); setStep(i) } }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                  isActive ? 'bg-[#933d18] text-white' :
                  isPast ? 'bg-emerald-100 text-emerald-700 cursor-pointer' :
                  'bg-gray-100 text-gray-400 cursor-default'
                }`}>
                <Icon size={12} />
                {isPast ? '✓' : `${i + 1}.`} {s.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-5 space-y-4">

        {/* STEP 0: Center Identity */}
        {step === 0 && (
          <div className={card}>
            {sectionTitle(<Building2 size={16} />, 'Center Identity')}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Center Name" required>
                <input className={inp} value={form.center_name} onChange={e => set('center_name', e.target.value)} placeholder="Name of the center" />
              </Field>
              <Field label="Center Code">
                <input className={inp} value={form.center_code} onChange={e => set('center_code', e.target.value)} placeholder="e.g. CTR001 (optional)" />
              </Field>
              <Field label="Email" required>
                <input className={inp} type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="name@example.com" />
              </Field>
              <Field label="Phone" required>
                <input className={inp} type="tel" value={form.phone} inputMode="numeric"
                  onChange={e => set('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="10-digit mobile number" maxLength={10} />
              </Field>
            </div>
          </div>
        )}

        {/* STEP 1: Contact Person */}
        {step === 1 && (
          <div className={card}>
            {sectionTitle(<User size={16} />, 'Contact Person Details')}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Contact Person Name" required>
                <input className={inp} value={form.contact_person} onChange={e => set('contact_person', e.target.value)} />
              </Field>
              <Field label="Father / Mother Name">
                <input className={inp} value={form.father_mother_name} onChange={e => set('father_mother_name', e.target.value)} />
              </Field>
              <Field label="Date of Birth">
                <input className={inp} type="date" value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)} />
              </Field>
              <Field label="Gender">
                <select className={inp} value={form.gender} onChange={e => set('gender', e.target.value)}>
                  <option value="">Select</option>
                  <option>Male</option><option>Female</option><option>Other</option>
                </select>
              </Field>
              <Field label="Nationality">
                <input className={inp} value={form.nationality} onChange={e => set('nationality', e.target.value)} />
              </Field>
              <Field label="Aadhar Number" required>
                <input className={inp} value={form.aadhar_no} inputMode="numeric"
                  onChange={e => set('aadhar_no', e.target.value.replace(/\D/g, '').slice(0, 12))}
                  placeholder="12-digit Aadhar" maxLength={12} />
              </Field>
              <Field label="PAN Number">
                <input className={inp} value={form.pan_no} onChange={e => set('pan_no', e.target.value)} placeholder="ABCDE1234F" />
              </Field>
            </div>

            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-5 mb-3">Contact Details</p>
            <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-end mb-4">
              <Field label="Current Address">
                <input className={inp} value={form.current_address}
                  onChange={e => { setSameAddress(false); set('current_address', e.target.value) }} />
              </Field>
              <div className="pb-2.5 flex flex-col items-center gap-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">Same</span>
                <input type="checkbox" checked={sameAddress} onChange={e => handleSameAddress(e.target.checked)}
                  className="w-4 h-4 accent-[#933d18] cursor-pointer" />
              </div>
              <Field label="Permanent Address">
                <input className={inp} value={form.permanent_address} onChange={e => set('permanent_address', e.target.value)} />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Mobile Number">
                <input className={inp} type="tel" value={form.contact_mobile} inputMode="numeric"
                  onChange={e => set('contact_mobile', e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="10-digit mobile" maxLength={10} />
              </Field>
              <Field label="Contact Email">
                <input className={inp} type="email" value={form.contact_email} onChange={e => set('contact_email', e.target.value)} placeholder="name@example.com" />
              </Field>
            </div>

            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-5 mb-3">Professional Details</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Current Occupation">
                <input className={inp} value={form.current_occupation} onChange={e => set('current_occupation', e.target.value)} />
              </Field>
              <Field label="Previous Experience in Admissions">
                <input className={inp} value={form.previous_experience_admissions} onChange={e => set('previous_experience_admissions', e.target.value)} />
              </Field>
            </div>
          </div>
        )}

        {/* STEP 2: Center Address */}
        {step === 2 && (
          <div className={card}>
            {sectionTitle(<MapPin size={16} />, 'Center Address')}
            <div className="space-y-4">
              <Field label="Address Line 1" required>
                <input className={inp} value={form.address_line1} onChange={e => set('address_line1', e.target.value)} />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Landmark">
                  <input className={inp} value={form.landmark} onChange={e => set('landmark', e.target.value)} />
                </Field>
                <Field label="Post Office">
                  <input className={inp} value={form.post_office} onChange={e => set('post_office', e.target.value)} />
                </Field>
                <Field label="City" required>
                  <input className={inp} value={form.city} onChange={e => set('city', e.target.value)} />
                </Field>
                <Field label="Pincode" required>
                  <input className={inp} value={form.pincode} inputMode="numeric"
                    onChange={e => set('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="6-digit pincode" maxLength={6} />
                </Field>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field label="Country">
                  <select className={inp} value={form.country_id} onChange={e => set('country_id', e.target.value)}>
                    <option value="">Select Country</option>
                    {countries.map(c => <option key={c.id} value={c.id}>{c.country_name}</option>)}
                  </select>
                </Field>
                <Field label="State">
                  <select className={inp} value={form.state_id} onChange={e => set('state_id', e.target.value)}>
                    <option value="">Select State</option>
                    {states.map(s => <option key={s.id} value={s.id}>{s.state_name}</option>)}
                  </select>
                </Field>
                <Field label="District">
                  <select className={inp} value={form.district_id} onChange={e => set('district_id', e.target.value)}>
                    <option value="">Select District</option>
                    {districts.map(d => <option key={d.id} value={d.id}>{d.district_name}</option>)}
                  </select>
                </Field>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Organization */}
        {step === 3 && (
          <div className={card}>
            {sectionTitle(<Briefcase size={16} />, 'Organization Details')}
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Organization Name">
                  <input className={inp} value={form.organization_name} onChange={e => set('organization_name', e.target.value)} />
                </Field>
                <Field label="Organization Type">
                  <select className={inp} value={form.org_type} onChange={e => set('org_type', e.target.value)}>
                    <option value="">Select</option>
                    <option>Education Consultancy</option>
                    <option>Institute</option>
                    <option>NGO</option>
                    <option>Pvt. Ltd</option>
                    <option>Others</option>
                  </select>
                </Field>
              </div>
              <Field label="Organization Address">
                <textarea className={inp} rows={2} value={form.org_address} onChange={e => set('org_address', e.target.value)} />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Org Post Office">
                  <input className={inp} value={form.org_post_office} onChange={e => set('org_post_office', e.target.value)} />
                </Field>
                <Field label="Org City">
                  <input className={inp} value={form.org_city} onChange={e => set('org_city', e.target.value)} />
                </Field>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field label="Org State">
                  <select className={inp} value={form.org_state_id} onChange={e => set('org_state_id', e.target.value)}>
                    <option value="">Select State</option>
                    {states.map(s => <option key={s.id} value={s.id}>{s.state_name}</option>)}
                  </select>
                </Field>
                <Field label="Org District">
                  <select className={inp} value={form.org_district_id} onChange={e => set('org_district_id', e.target.value)}>
                    <option value="">Select District</option>
                    {orgDistricts.map(d => <option key={d.id} value={d.id}>{d.district_name}</option>)}
                  </select>
                </Field>
                <Field label="Org Pincode">
                  <input className={inp} value={form.org_pincode} inputMode="numeric"
                    onChange={e => set('org_pincode', e.target.value.replace(/\D/g, '').slice(0, 6))}
                    maxLength={6} />
                </Field>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Registration Number">
                  <input className={inp} value={form.registration_number} onChange={e => set('registration_number', e.target.value)} />
                </Field>
                <Field label="GST / PAN (Organization)">
                  <input className={inp} value={form.gst_pan} onChange={e => set('gst_pan', e.target.value)} />
                </Field>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field label="Premises Type">
                  <select className={inp} value={form.premises_type} onChange={e => set('premises_type', e.target.value)}>
                    <option>Owned</option><option>Rented</option><option>Leased</option>
                  </select>
                </Field>
                <Field label="Office Area (sqft)">
                  <input className={inp} type="number" value={form.office_area_sqft} onChange={e => set('office_area_sqft', e.target.value)} />
                </Field>
                <Field label="Student Capacity">
                  <input className={inp} type="number" value={form.student_capacity} onChange={e => set('student_capacity', e.target.value)} />
                </Field>
              </div>

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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-bold text-gray-500 mb-2">Photographs Attached</p>
                  <div className="flex items-center gap-5">
                    {[['true', 'Yes'], ['false', 'No']].map(([val, label]) => (
                      <label key={val} className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="photos_attached_pub" value={val}
                          checked={String(!!form.photos_attached) === val}
                          onChange={() => setForm(f => ({ ...f, photos_attached: val === 'true' }))}
                          className="accent-[#933d18]" />
                        <span className="text-sm text-gray-700">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-500 mb-2">Rent Agreement / Ownership Proof</p>
                  <div className="flex items-center gap-5">
                    {['Attached', 'Not Attached'].map(v => (
                      <label key={v} className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="rent_agreement_pub" value={v}
                          checked={form.rent_agreement_attached === v}
                          onChange={() => setForm(f => ({ ...f, rent_agreement_attached: v }))}
                          className="accent-[#933d18]" />
                        <span className="text-sm text-gray-700">{v}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: Bank Details */}
        {step === 4 && (
          <div className={card}>
            {sectionTitle(<CreditCard size={16} />, 'Bank Details')}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Account Holder Name">
                <input className={inp} value={form.bank_account_holder} onChange={e => set('bank_account_holder', e.target.value)} />
              </Field>
              <Field label="Account Number">
                <input className={inp} value={form.bank_account_number} onChange={e => set('bank_account_number', e.target.value)} />
              </Field>
              <Field label="IFSC Code">
                <input className={inp} value={form.ifsc_code} onChange={e => set('ifsc_code', e.target.value)} placeholder="e.g. SBIN0001234" />
              </Field>
              <Field label="Bank Branch">
                <input className={inp} value={form.bank_branch} onChange={e => set('bank_branch', e.target.value)} />
              </Field>
            </div>
          </div>
        )}

        {/* STEP 5: Education */}
        {step === 5 && (
          <div className={card}>
            {sectionTitle(<GraduationCap size={16} />, 'Education Qualification')}
            {[
              { level: '10th',    f: ['edu_10th_institute',    'edu_10th_board',    'edu_10th_year'] },
              { level: '12th',    f: ['edu_12th_institute',    'edu_12th_board',    'edu_12th_year'] },
              { level: 'UG',      f: ['edu_ug_institute',      'edu_ug_board',      'edu_ug_year'] },
              { level: 'PG',      f: ['edu_pg_institute',      'edu_pg_board',      'edu_pg_year'] },
              { level: 'Diploma', f: ['edu_diploma_institute', 'edu_diploma_board', 'edu_diploma_year'] },
            ].map(({ level, f }) => (
              <div key={level} className="mb-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{level}</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Field label="Institute Name">
                    <input className={inp} value={form[f[0]]} onChange={e => set(f[0], e.target.value)} />
                  </Field>
                  <Field label="Board / University">
                    <input className={inp} value={form[f[1]]} onChange={e => set(f[1], e.target.value)} />
                  </Field>
                  <Field label="Passing Year">
                    <input className={inp} type="number" value={form[f[2]]} onChange={e => set(f[2], e.target.value)} placeholder="e.g. 2020" />
                  </Field>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* STEP 6: Payment */}
        {step === 6 && (
          <div className={card}>
            {sectionTitle(<Wallet size={16} />, 'Payment Details')}
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700 mb-4">
              Transfer the registration fee to the account provided by <strong>{superCenter.center_name}</strong> and fill the details below.
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Amount Paid (₹)">
                <input className={inp} type="number" value={form.amount_paid} onChange={e => set('amount_paid', e.target.value)} placeholder="e.g. 5000" />
              </Field>
              <Field label="UTR / Transaction Number">
                <input className={inp} value={form.utr_number} onChange={e => set('utr_number', e.target.value)} />
              </Field>
              <Field label="Payment Date">
                <input className={inp} type="date" value={form.payment_date} onChange={e => set('payment_date', e.target.value)} />
              </Field>
            </div>
            <div className="mt-4">
              <Field label="Remark">
                <textarea className={inp} rows={3} value={form.payment_remark} onChange={e => set('payment_remark', e.target.value)}
                  placeholder="e.g. Registration fee paid, partial payment, etc." />
              </Field>
            </div>
            <div className="mt-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Payment Screenshot</p>
              <div className="max-w-xs">
                <FileCard label="Payment Screenshot" fileKey="payment_screenshot_url"
                  accept="image/*" isImage files={files} previews={previews} onChange={handleFile}
                  hint="Screenshot of bank transfer / UPI" />
              </div>
            </div>
          </div>
        )}

        {/* STEP 7: Documents */}
        {step === 7 && (
          <div className="space-y-4">
            <div className={card}>
              <h3 className="font-bold text-gray-900 mb-4 text-sm">Identity Documents</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FileCard label="Owner Photo *" fileKey="owner_photo_url" accept="image/*" isImage files={files} previews={previews} onChange={handleFile} hint="Passport-size photo" />
                <FileCard label="Owner Signature *" fileKey="owner_signature_url" accept="image/*" isImage files={files} previews={previews} onChange={handleFile} hint="On white paper" />
                <FileCard label="Aadhar Card *" fileKey="owner_aadhar_url" isImage={false} files={files} previews={previews} onChange={handleFile} hint="Front & back" />
                <FileCard label="PAN Card *" fileKey="owner_pan_url" isImage={false} files={files} previews={previews} onChange={handleFile} hint="Owner's PAN card" />
              </div>
            </div>

            <div className={card}>
              <h3 className="font-bold text-gray-900 mb-4 text-sm">Center Documents</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FileCard label="Registration Cert. *" fileKey="center_reg_url" isImage={false} files={files} previews={previews} onChange={handleFile} hint="Society / company reg." />
                <FileCard label="Premises Photo *" fileKey="premises_photo_url" accept="image/*" isImage files={files} previews={previews} onChange={handleFile} hint="Center building/office" />
                <FileCard label="GST Certificate" fileKey="gst_url" isImage={false} files={files} previews={previews} onChange={handleFile} hint="If applicable" />
                <FileCard label="Agreement Doc *" fileKey="agreement_url" isImage={false} files={files} previews={previews} onChange={handleFile} hint="Signed MOU" />
              </div>
            </div>

            <div className={card}>
              <h3 className="font-bold text-gray-900 mb-4 text-sm">Bank Documents</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FileCard label="Cancelled Cheque *" fileKey="cancel_cheque_url" isImage={false} files={files} previews={previews} onChange={handleFile} hint="Cancelled cheque" />
                <FileCard label="Bank Passbook *" fileKey="bank_passbook_url" isImage={false} files={files} previews={previews} onChange={handleFile} hint="First page / statement" />
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Step validation error — shown near Next button so user sees it */}
        {stepError && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            <AlertCircle size={15} className="shrink-0" /> {stepError}
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between gap-3 pb-10">
          <button
            onClick={() => { setStepError(''); setStep(s => s - 1) }}
            disabled={step === 0}
            className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-30 transition-all"
          >
            ← Previous
          </button>

          {step < STEPS.length - 1 ? (
            <button
              onClick={handleNext}
              className="px-6 py-2.5 rounded-xl bg-[#933d18] text-white text-sm font-bold hover:bg-[#b05a30] transition-all"
            >
              Next →
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="px-8 py-2.5 rounded-xl bg-[#933d18] text-white text-sm font-bold hover:bg-[#b05a30] disabled:opacity-60 transition-all"
            >
              {saving ? 'Submitting...' : 'Submit Application'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
