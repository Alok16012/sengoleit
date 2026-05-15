import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Input, { Select, Textarea } from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import PageHeader from '../../components/ui/PageHeader'

const STEPS = ['Basic Entry', 'Personal', 'Address', 'Organisation', 'Bank & Education', 'Documents']

const emptyForm = {
  date_of_submission: new Date().toISOString().split('T')[0],
  date_of_creation: new Date().toISOString().split('T')[0],
  university_id: '', super_center: '',
  full_name: '', fathers_mothers_name: '', date_of_birth: '', gender: '', nationality: 'Indian',
  aadhar_no: '', pan_no: '', email: '', phone: '',
  permanent_address: '', permanent_post_office: '', permanent_city: '',
  permanent_state_id: '', permanent_district_id: '', permanent_pin_code: '',
  organization_name: '', type_of_organization: '', organization_address: '',
  org_post_office: '', org_city: '', org_state_id: '', org_district_id: '', org_pin_code: '',
  organization_registration_no: '', gst_pan_of_organization: '', premises_type: 'Owned', office_area_sq_ft: '',
  account_holder_name: '', account_no: '', ifc_code: '', branch: '',
  tenth_institute_name: '', tenth_board_university: '', tenth_passing_year: '',
  twelfth_institute_name: '', twelfth_board_university: '', twelfth_passing_year: '',
  ug_institute_name: '', ug_board_university: '', ug_passing_year: '',
  pg_institute_name: '', pg_board_university: '', pg_passing_year: '',
  diploma_institute_name: '', diploma_board_university: '', diploma_passing_year: '',
  photo_url: '', aadhar_upload_url: '', pan_upload_url: '', marksheet_url: '',
  signature_url: '', organization_registration_no_url: '', premises_pic_url: '', cancel_cheque_url: '',
}

export default function AddCenter() {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(emptyForm)
  const [universities, setUniversities] = useState([])
  const [superCenters, setSuperCenters] = useState([])
  const [states, setStates] = useState([])
  const [permDistricts, setPermDistricts] = useState([])
  const [orgDistricts, setOrgDistricts] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('universities').select('id, university_name').order('university_name'),
      supabase.from('states').select('id, state_name').order('state_name'),
      supabase.from('centers').select('id, center_name, center_code').order('center_name'),
    ]).then(([unis, sts, cents]) => {
      setUniversities(unis.data || [])
      setStates(sts.data || [])
      setSuperCenters(cents.data || [])
    })
  }, [])

  useEffect(() => {
    if (form.permanent_state_id) {
      supabase.from('districts').select('id, district_name').eq('state_id', form.permanent_state_id).order('district_name')
        .then(({ data }) => setPermDistricts(data || []))
    }
  }, [form.permanent_state_id])

  useEffect(() => {
    if (form.org_state_id) {
      supabase.from('districts').select('id, district_name').eq('state_id', form.org_state_id).order('district_name')
        .then(({ data }) => setOrgDistricts(data || []))
    }
  }, [form.org_state_id])

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }))

  async function handleSubmit() {
    setSubmitting(true)
    const payload = { ...form }
    const fkFields = ['university_id', 'permanent_state_id', 'permanent_district_id', 'org_state_id', 'org_district_id']
    fkFields.forEach(k => { if (!payload[k]) delete payload[k] })
    const { error } = await supabase.from('center_applications').insert(payload)
    setSubmitting(false)
    if (!error) setSubmitted(true)
    else alert('Submission failed: ' + error.message)
  }

  if (submitted) {
    return (
      <div className="p-8 flex items-center justify-center min-h-96">
        <div className="text-center max-w-sm">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-black text-gray-900 mb-2">Application Submitted!</h2>
          <p className="text-gray-500">Your center application is under review. You will be notified once approved.</p>
        </div>
      </div>
    )
  }

  const Section = ({ title, children }) => (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-[3px] h-5 bg-[#933d18] rounded-full" />
        <h3 className="text-xs font-black text-gray-600 uppercase tracking-widest">{title}</h3>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  )

  const EduRow = ({ prefix, label }) => (
    <div>
      <p className="text-xs font-black text-[#933d18]/60 uppercase tracking-widest mb-2">{label}</p>
      <div className="grid grid-cols-3 gap-4">
        <Input label="Institute Name" value={form[`${prefix}_institute_name`]} onChange={set(`${prefix}_institute_name`)} />
        <Input label="Board / University" value={form[`${prefix}_board_university`]} onChange={set(`${prefix}_board_university`)} />
        <Input label="Passing Year" type="number" value={form[`${prefix}_passing_year`]} onChange={set(`${prefix}_passing_year`)} />
      </div>
    </div>
  )

  return (
    <div className="p-6 max-w-3xl">
      <PageHeader title="Application Form for Information Center" />

      {/* Step Indicator */}
      <div className="flex items-center gap-1 mb-8 overflow-x-auto pb-1">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center gap-1 shrink-0">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors
              ${i < step ? 'bg-green-500 text-white' : i === step ? 'bg-[#933d18] text-white' : 'bg-gray-200 text-gray-500'}`}>
              {i < step ? '✓' : i + 1}
            </div>
            <span className={`text-xs font-semibold whitespace-nowrap ${i === step ? 'text-[#933d18]' : i < step ? 'text-green-600' : 'text-gray-400'}`}>{s}</span>
            {i < STEPS.length - 1 && <div className={`h-px w-4 mx-1 ${i < step ? 'bg-green-400' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">

        {/* STEP 0: Basic Entry */}
        {step === 0 && (
          <Section title="Basic Entry">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Date of Submission" type="date" value={form.date_of_submission} onChange={set('date_of_submission')} />
              <Input label="Date of Creation" type="date" value={form.date_of_creation} onChange={set('date_of_creation')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Select label="University *" value={form.university_id} onChange={set('university_id')}>
                <option value="">Select University</option>
                {universities.map(u => <option key={u.id} value={u.id}>{u.university_name}</option>)}
              </Select>
              <Select label="Super Center" value={form.super_center} onChange={set('super_center')}>
                <option value="">— None —</option>
                {superCenters.map(c => <option key={c.id} value={c.center_name}>{c.center_name}{c.center_code ? ` (${c.center_code})` : ''}</option>)}
              </Select>
            </div>
          </Section>
        )}

        {/* STEP 1: Personal Details */}
        {step === 1 && (
          <Section title="Personal Details">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Full Name *" value={form.full_name} onChange={set('full_name')} required />
              <Input label="Father's / Mother's Name" value={form.fathers_mothers_name} onChange={set('fathers_mothers_name')} />
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
              <Input label="Aadhaar No" placeholder="XXXX XXXX XXXX" value={form.aadhar_no} onChange={set('aadhar_no')} />
              <Input label="PAN No" placeholder="ABCDE1234F" value={form.pan_no} onChange={set('pan_no')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Email *" type="email" value={form.email} onChange={set('email')} required />
              <Input label="Phone *" type="tel" value={form.phone} onChange={set('phone')} required />
            </div>
          </Section>
        )}

        {/* STEP 2: Address */}
        {step === 2 && (
          <Section title="Contact Details — Permanent Address">
            <Textarea label="Address *" value={form.permanent_address} onChange={set('permanent_address')} required />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Post Office" value={form.permanent_post_office} onChange={set('permanent_post_office')} />
              <Input label="City" value={form.permanent_city} onChange={set('permanent_city')} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Select label="State" value={form.permanent_state_id} onChange={set('permanent_state_id')}>
                <option value="">Select State</option>
                {states.map(s => <option key={s.id} value={s.id}>{s.state_name}</option>)}
              </Select>
              <Select label="District" value={form.permanent_district_id} onChange={set('permanent_district_id')}>
                <option value="">Select District</option>
                {permDistricts.map(d => <option key={d.id} value={d.id}>{d.district_name}</option>)}
              </Select>
              <Input label="Pin Code" value={form.permanent_pin_code} onChange={set('permanent_pin_code')} />
            </div>
          </Section>
        )}

        {/* STEP 3: Organisation */}
        {step === 3 && (
          <Section title="Organisation Details">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Organisation Name *" value={form.organization_name} onChange={set('organization_name')} required />
              <Select label="Type of Organisation" value={form.type_of_organization} onChange={set('type_of_organization')}>
                <option value="">Select</option>
                <option value="Education Consultancy">Education Consultancy</option>
                <option value="Institute">Institute</option>
                <option value="NGO">NGO</option>
                <option value="Other">Other</option>
              </Select>
            </div>
            <Textarea label="Organisation Address" value={form.organization_address} onChange={set('organization_address')} />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Post Office" value={form.org_post_office} onChange={set('org_post_office')} />
              <Input label="City" value={form.org_city} onChange={set('org_city')} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Select label="State" value={form.org_state_id} onChange={set('org_state_id')}>
                <option value="">Select State</option>
                {states.map(s => <option key={s.id} value={s.id}>{s.state_name}</option>)}
              </Select>
              <Select label="District" value={form.org_district_id} onChange={set('org_district_id')}>
                <option value="">Select District</option>
                {orgDistricts.map(d => <option key={d.id} value={d.id}>{d.district_name}</option>)}
              </Select>
              <Input label="Pin Code" value={form.org_pin_code} onChange={set('org_pin_code')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Organisation Registration No." value={form.organization_registration_no} onChange={set('organization_registration_no')} />
              <Input label="GST / PAN of Organisation" value={form.gst_pan_of_organization} onChange={set('gst_pan_of_organization')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Select label="Premises Type" value={form.premises_type} onChange={set('premises_type')}>
                <option value="Owned">Owned</option>
                <option value="Rented">Rented</option>
                <option value="Leased">Leased</option>
              </Select>
              <Input label="Office Area (sq. ft.)" type="number" value={form.office_area_sq_ft} onChange={set('office_area_sq_ft')} />
            </div>
          </Section>
        )}

        {/* STEP 4: Bank & Education */}
        {step === 4 && (
          <>
            <Section title="Bank Detail">
              <div className="grid grid-cols-2 gap-4">
                <Input label="Account Holder Name" value={form.account_holder_name} onChange={set('account_holder_name')} />
                <Input label="Account No" value={form.account_no} onChange={set('account_no')} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="IFSC Code" value={form.ifc_code} onChange={set('ifc_code')} />
                <Input label="Branch" value={form.branch} onChange={set('branch')} />
              </div>
            </Section>
            <Section title="Educational Qualification">
              <EduRow prefix="tenth" label="10th" />
              <EduRow prefix="twelfth" label="12th" />
              <EduRow prefix="ug" label="UG (Graduation)" />
              <EduRow prefix="pg" label="PG (Post Graduation)" />
              <EduRow prefix="diploma" label="Diploma / Polytechnic" />
            </Section>
          </>
        )}

        {/* STEP 5: Documents */}
        {step === 5 && (
          <>
            <Section title="Personal Documents">
              <div className="grid grid-cols-2 gap-4">
                <Input label="Photo URL" placeholder="Upload URL" value={form.photo_url} onChange={set('photo_url')} />
                <Input label="Aadhaar Upload URL" placeholder="Upload URL" value={form.aadhar_upload_url} onChange={set('aadhar_upload_url')} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Signature URL" placeholder="Upload URL" value={form.signature_url} onChange={set('signature_url')} />
                <Input label="Marksheet URL" placeholder="Upload URL" value={form.marksheet_url} onChange={set('marksheet_url')} />
              </div>
              <Input label="PAN Upload URL" placeholder="Upload URL" value={form.pan_upload_url} onChange={set('pan_upload_url')} />
            </Section>
            <Section title="Organisation Documents">
              <div className="grid grid-cols-2 gap-4">
                <Input label="Registration No. URL" placeholder="Upload URL" value={form.organization_registration_no_url} onChange={set('organization_registration_no_url')} />
                <Input label="Premises Picture URL" placeholder="Upload URL" value={form.premises_pic_url} onChange={set('premises_pic_url')} />
              </div>
              <Input label="Cancel Cheque URL" placeholder="Upload URL" value={form.cancel_cheque_url} onChange={set('cancel_cheque_url')} />
            </Section>
            <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-100 text-sm text-gray-500">
              By submitting this application, I declare that all the information provided is true and correct to the best of my knowledge.
            </div>
          </>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-8 pt-5 border-t border-gray-100">
          <Button type="button" variant="outline" onClick={() => setStep(s => s - 1)} disabled={step === 0}>
            ← Previous
          </Button>
          {step < STEPS.length - 1
            ? <Button type="button" onClick={() => setStep(s => s + 1)}>Next →</Button>
            : <Button type="button" onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit Application'}
              </Button>
          }
        </div>
      </div>
    </div>
  )
}
