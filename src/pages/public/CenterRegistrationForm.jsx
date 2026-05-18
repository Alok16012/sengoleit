import { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Upload, CheckCircle, AlertCircle, Building2, User, CreditCard, FileText, Wallet } from 'lucide-react'

const SECTIONS = ['Personal Info', 'Organization', 'Bank Details', 'Payment', 'Documents']

function FileUpload({ label, fileKey, files, previews, onChange, accept = 'image/*,.pdf' }) {
  const ref = useRef()
  const file = files[fileKey]
  const preview = previews[fileKey]
  return (
    <div>
      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5">{label}</p>
      <div
        onClick={() => ref.current?.click()}
        className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${file ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200 hover:border-[#933d18]/40 bg-gray-50'}`}
      >
        {preview && file?.type?.startsWith('image') ? (
          <img src={preview} alt="preview" className="max-h-24 mx-auto rounded-lg object-contain" />
        ) : file ? (
          <div className="flex items-center justify-center gap-2 text-emerald-700 text-sm font-semibold">
            <CheckCircle size={16} /> {file.name}
          </div>
        ) : (
          <div>
            <Upload size={20} className="mx-auto text-gray-300 mb-1" />
            <p className="text-xs text-gray-400">Click to upload</p>
          </div>
        )}
      </div>
      <input ref={ref} type="file" accept={accept} className="hidden"
        onChange={e => { const f = e.target.files[0]; if (f) onChange(fileKey, f) }} />
    </div>
  )
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

const inp = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#933d18] bg-white"

export default function CenterRegistrationForm() {
  const { superCenterCode } = useParams()
  const [superCenter, setSuperCenter] = useState(null)
  const [loadingSC, setLoadingSC] = useState(true)
  const [section, setSection] = useState(0)
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    full_name: '', fathers_mothers_name: '', date_of_birth: '', gender: '', nationality: 'Indian',
    aadhar_no: '', pan_no: '', email: '', phone: '',
    organization_name: '', type_of_organization: '', organization_address: '',
    org_city: '', org_state: '', org_pin_code: '', organization_registration_no: '',
    gst_pan_of_organization: '', premises_type: '', office_area_sq_ft: '',
    account_holder_name: '', account_no: '', ifc_code: '', branch: '',
    amount_paid: '', utr_number: '', payment_date: '',
  })

  const [files, setFiles] = useState({
    photo: null, aadhar: null, pan: null, marksheet: null,
    signature: null, org_reg: null, premises_pic: null, cancel_cheque: null, payment_screenshot: null,
  })
  const [previews, setPreviews] = useState({})

  useEffect(() => {
    supabase.from('centers')
      .select('id, center_name, center_code')
      .eq('center_code', superCenterCode)
      .eq('center_type', 'super_center')
      .maybeSingle()
      .then(({ data }) => { setSuperCenter(data); setLoadingSC(false) })
  }, [superCenterCode])

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function handleFile(key, file) {
    setFiles(f => ({ ...f, [key]: file }))
    if (file.type.startsWith('image')) setPreviews(p => ({ ...p, [key]: URL.createObjectURL(file) }))
    else setPreviews(p => ({ ...p, [key]: null }))
  }

  async function uploadFile(key, file) {
    if (!file) return null
    const path = `center-applications/${superCenterCode}/${Date.now()}_${key}_${file.name}`
    const { error } = await supabase.storage.from('documents').upload(path, file)
    if (error) return null
    return supabase.storage.from('documents').getPublicUrl(path).data.publicUrl
  }

  async function handleSubmit() {
    if (!form.full_name || !form.email || !form.phone || !form.organization_name) {
      setError('Please fill all required fields (Name, Email, Phone, Organization Name).')
      return
    }
    setSaving(true)
    setError('')

    const [photoUrl, aadharUrl, panUrl, marksheetUrl, signatureUrl, orgRegUrl, premisesUrl, chequeUrl, screenshotUrl] =
      await Promise.all([
        uploadFile('photo', files.photo),
        uploadFile('aadhar', files.aadhar),
        uploadFile('pan', files.pan),
        uploadFile('marksheet', files.marksheet),
        uploadFile('signature', files.signature),
        uploadFile('org_reg', files.org_reg),
        uploadFile('premises_pic', files.premises_pic),
        uploadFile('cancel_cheque', files.cancel_cheque),
        uploadFile('payment_screenshot', files.payment_screenshot),
      ])

    const { error: insErr } = await supabase.from('center_applications').insert({
      super_center_id: superCenter.id,
      super_center: superCenter.center_code,
      full_name: form.full_name,
      fathers_mothers_name: form.fathers_mothers_name,
      date_of_birth: form.date_of_birth || null,
      gender: form.gender,
      nationality: form.nationality,
      aadhar_no: form.aadhar_no,
      pan_no: form.pan_no,
      email: form.email,
      phone: form.phone,
      organization_name: form.organization_name,
      type_of_organization: form.type_of_organization,
      organization_address: form.organization_address,
      org_city: form.org_city,
      org_pin_code: form.org_pin_code,
      organization_registration_no: form.organization_registration_no,
      gst_pan_of_organization: form.gst_pan_of_organization,
      premises_type: form.premises_type,
      office_area_sq_ft: form.office_area_sq_ft ? parseFloat(form.office_area_sq_ft) : null,
      account_holder_name: form.account_holder_name,
      account_no: form.account_no,
      ifc_code: form.ifc_code,
      branch: form.branch,
      amount_paid: parseFloat(form.amount_paid) || 0,
      utr_number: form.utr_number,
      payment_date: form.payment_date || null,
      photo_url: photoUrl,
      aadhar_upload_url: aadharUrl,
      pan_upload_url: panUrl,
      marksheet_url: marksheetUrl,
      signature_url: signatureUrl,
      organization_registration_no_url: orgRegUrl,
      premises_pic_url: premisesUrl,
      cancel_cheque_url: chequeUrl,
      payment_screenshot_url: screenshotUrl,
      status: 'pending',
      date_of_submission: new Date().toISOString().split('T')[0],
    })

    if (insErr) { setError('Submission failed: ' + insErr.message); setSaving(false); return }
    setSaving(false)
    setSubmitted(true)
  }

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
        <p className="text-gray-500 text-sm mb-4">Your center registration application has been submitted to <strong>{superCenter.center_name}</strong> for review.</p>
        <p className="text-xs text-gray-400 bg-gray-50 rounded-xl p-3">You will be contacted on your registered email/phone once your application is verified.</p>
      </div>
    </div>
  )

  const sectionIcons = [User, Building2, CreditCard, Wallet, FileText]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#933d18] text-white py-8 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <p className="text-orange-200 text-xs font-bold uppercase tracking-widest mb-1">Center Registration</p>
          <h1 className="text-2xl font-black">Apply via {superCenter.center_name}</h1>
          <p className="text-orange-100/70 text-sm mt-1">Fill all details carefully. All fields marked * are required.</p>
        </div>
      </div>

      {/* Progress */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex gap-1 overflow-x-auto">
          {SECTIONS.map((s, i) => {
            const Icon = sectionIcons[i]
            return (
              <button key={s} onClick={() => setSection(i)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                  i === section ? 'bg-[#933d18] text-white' : i < section ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                }`}>
                <Icon size={12} />
                {i < section ? '✓' : `${i + 1}.`} {s}
              </button>
            )
          })}
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-6 space-y-4">
        {/* Section 1: Personal Info */}
        {section === 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
            <h2 className="font-black text-gray-900 flex items-center gap-2"><User size={16} className="text-[#933d18]" /> Personal Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Full Name" required><input className={inp} value={form.full_name} onChange={e => set('full_name', e.target.value)} placeholder="As per Aadhar card" /></Field>
              <Field label="Father's / Mother's Name"><input className={inp} value={form.fathers_mothers_name} onChange={e => set('fathers_mothers_name', e.target.value)} /></Field>
              <Field label="Date of Birth"><input className={inp} type="date" value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)} /></Field>
              <Field label="Gender">
                <select className={inp} value={form.gender} onChange={e => set('gender', e.target.value)}>
                  <option value="">Select</option>
                  <option>Male</option><option>Female</option><option>Other</option>
                </select>
              </Field>
              <Field label="Nationality"><input className={inp} value={form.nationality} onChange={e => set('nationality', e.target.value)} /></Field>
              <Field label="Aadhar Number"><input className={inp} value={form.aadhar_no} onChange={e => set('aadhar_no', e.target.value)} placeholder="12-digit Aadhar" maxLength={12} /></Field>
              <Field label="PAN Number"><input className={inp} value={form.pan_no} onChange={e => set('pan_no', e.target.value)} placeholder="ABCDE1234F" /></Field>
              <Field label="Email Address" required><input className={inp} type="email" value={form.email} onChange={e => set('email', e.target.value)} /></Field>
              <Field label="Phone Number" required><input className={inp} value={form.phone} onChange={e => set('phone', e.target.value)} /></Field>
            </div>
          </div>
        )}

        {/* Section 2: Organization */}
        {section === 1 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
            <h2 className="font-black text-gray-900 flex items-center gap-2"><Building2 size={16} className="text-[#933d18]" /> Organization Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Organization / Center Name" required><input className={inp} value={form.organization_name} onChange={e => set('organization_name', e.target.value)} /></Field>
              <Field label="Type of Organization">
                <select className={inp} value={form.type_of_organization} onChange={e => set('type_of_organization', e.target.value)}>
                  <option value="">Select</option>
                  <option>Proprietorship</option><option>Partnership</option><option>Pvt. Ltd.</option><option>Trust</option><option>Society</option><option>Other</option>
                </select>
              </Field>
              <div className="sm:col-span-2">
                <Field label="Organization Address"><textarea className={inp} rows={2} value={form.organization_address} onChange={e => set('organization_address', e.target.value)} /></Field>
              </div>
              <Field label="City"><input className={inp} value={form.org_city} onChange={e => set('org_city', e.target.value)} /></Field>
              <Field label="State"><input className={inp} value={form.org_state} onChange={e => set('org_state', e.target.value)} /></Field>
              <Field label="PIN Code"><input className={inp} value={form.org_pin_code} onChange={e => set('org_pin_code', e.target.value)} maxLength={6} /></Field>
              <Field label="Org. Registration No."><input className={inp} value={form.organization_registration_no} onChange={e => set('organization_registration_no', e.target.value)} /></Field>
              <Field label="GST / PAN of Organization"><input className={inp} value={form.gst_pan_of_organization} onChange={e => set('gst_pan_of_organization', e.target.value)} /></Field>
              <Field label="Premises Type">
                <select className={inp} value={form.premises_type} onChange={e => set('premises_type', e.target.value)}>
                  <option value="">Select</option>
                  <option>Owned</option><option>Rented</option><option>Leased</option>
                </select>
              </Field>
              <Field label="Office Area (sq ft)"><input className={inp} type="number" value={form.office_area_sq_ft} onChange={e => set('office_area_sq_ft', e.target.value)} /></Field>
            </div>
          </div>
        )}

        {/* Section 3: Bank Details */}
        {section === 2 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
            <h2 className="font-black text-gray-900 flex items-center gap-2"><CreditCard size={16} className="text-[#933d18]" /> Bank Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Account Holder Name"><input className={inp} value={form.account_holder_name} onChange={e => set('account_holder_name', e.target.value)} /></Field>
              <Field label="Account Number"><input className={inp} value={form.account_no} onChange={e => set('account_no', e.target.value)} /></Field>
              <Field label="IFSC Code"><input className={inp} value={form.ifc_code} onChange={e => set('ifc_code', e.target.value)} placeholder="e.g. SBIN0001234" /></Field>
              <Field label="Branch Name"><input className={inp} value={form.branch} onChange={e => set('branch', e.target.value)} /></Field>
            </div>
          </div>
        )}

        {/* Section 4: Payment */}
        {section === 3 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
            <h2 className="font-black text-gray-900 flex items-center gap-2"><Wallet size={16} className="text-[#933d18]" /> Payment Details</h2>
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700">
              Transfer the registration fee to the account provided by <strong>{superCenter.center_name}</strong> and fill the payment details below.
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Amount Paid (₹)"><input className={inp} type="number" value={form.amount_paid} onChange={e => set('amount_paid', e.target.value)} placeholder="e.g. 5000" /></Field>
              <Field label="UTR / Transaction Number"><input className={inp} value={form.utr_number} onChange={e => set('utr_number', e.target.value)} /></Field>
              <Field label="Payment Date"><input className={inp} type="date" value={form.payment_date} onChange={e => set('payment_date', e.target.value)} /></Field>
            </div>
            <FileUpload label="Payment Screenshot" fileKey="payment_screenshot" files={files} previews={previews} onChange={handleFile} accept="image/*" />
          </div>
        )}

        {/* Section 5: Documents */}
        {section === 4 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
            <h2 className="font-black text-gray-900 flex items-center gap-2"><FileText size={16} className="text-[#933d18]" /> Document Uploads</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FileUpload label="Applicant Photo" fileKey="photo" files={files} previews={previews} onChange={handleFile} accept="image/*" />
              <FileUpload label="Signature" fileKey="signature" files={files} previews={previews} onChange={handleFile} accept="image/*" />
              <FileUpload label="Aadhar Card" fileKey="aadhar" files={files} previews={previews} onChange={handleFile} />
              <FileUpload label="PAN Card" fileKey="pan" files={files} previews={previews} onChange={handleFile} />
              <FileUpload label="Marksheet (Highest)" fileKey="marksheet" files={files} previews={previews} onChange={handleFile} />
              <FileUpload label="Org. Registration Certificate" fileKey="org_reg" files={files} previews={previews} onChange={handleFile} />
              <FileUpload label="Premises Photo" fileKey="premises_pic" files={files} previews={previews} onChange={handleFile} accept="image/*" />
              <FileUpload label="Cancelled Cheque" fileKey="cancel_cheque" files={files} previews={previews} onChange={handleFile} />
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

        {/* Navigation */}
        <div className="flex justify-between gap-3">
          <button
            onClick={() => setSection(s => s - 1)}
            disabled={section === 0}
            className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-30 transition-all"
          >
            ← Previous
          </button>

          {section < SECTIONS.length - 1 ? (
            <button
              onClick={() => setSection(s => s + 1)}
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
