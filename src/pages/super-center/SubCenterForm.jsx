import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import PageHeader from '../../components/ui/PageHeader'
import Input, { Select, Textarea } from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import FormSection from '../../components/ui/FormSection'
import {
  Building2, User, Briefcase, CreditCard, GraduationCap,
  Upload, Eye, CheckCircle2, AlertCircle, ArrowRight, ArrowLeft, Wallet, Lock
} from 'lucide-react'

const STEPS = [
  { label: 'Center Identity',  icon: Building2 },
  { label: 'Contact Person',   icon: User },
  { label: 'Organization',     icon: Briefcase },
  { label: 'Bank Details',     icon: CreditCard },
  { label: 'Education',        icon: GraduationCap },
  { label: 'Payment',          icon: Wallet },
  { label: 'Documents',        icon: Upload },
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
  // Payment
  amount_paid: '', utr_number: '', payment_date: '', payment_screenshot_url: '', payment_remark: '',
  letter_type: '', base_fee: '',
  center_type: 'center',
  approval_status: 'pending',
}

// Maps the labels the Document Dept uses in its hold remark (e.g. "Aadhar Card: ...")
// back to the form field name(s). Used as a fallback to derive which fields to keep
// editable when the center's correction_fields column isn't populated (e.g. it was held
// before that feature existed). Keep in sync with DocumentDepartment's labels.
const LABEL_TO_FORM_FIELDS = {
  'Center Name': ['center_name'],
  'Email Address': ['email'],
  'Phone Number': ['phone'],
  'Contact Person': ['contact_person'],
  'Father / Mother Name': ['father_mother_name'],
  'Date of Birth': ['date_of_birth'],
  'Gender': ['gender'],
  'Nationality': ['nationality'],
  'Contact Mobile': ['contact_mobile'],
  'Contact Email': ['contact_email'],
  'Current Occupation': ['current_occupation'],
  'Prev. Experience (Admissions)': ['previous_experience_admissions'],
  'Permanent Address': ['permanent_address'],
  'Current Address': ['current_address'],
  'Address Line 1': ['address_line1'],
  'Landmark': ['landmark'],
  'Post Office': ['post_office'],
  'City': ['city'],
  'State': ['state_id', 'district_id'],
  'Pincode': ['pincode'],
  'Aadhar Number': ['aadhar_no'],
  'PAN Number': ['pan_no'],
  'Organization Name': ['organization_name'],
  'Org Type': ['org_type'],
  'Registration Number': ['registration_number'],
  'GST / PAN': ['gst_pan'],
  'Premises Type': ['premises_type'],
  'Org Address': ['org_address'],
  'Org Post Office': ['org_post_office'],
  'Org City': ['org_city'],
  'Org Pincode': ['org_pincode'],
  'Reception Desk': ['facility_reception_desk'],
  'Waiting Area': ['facility_waiting_area'],
  'Meeting Room': ['facility_meeting_room'],
  'Rent Agreement': ['rent_agreement_attached', 'agreement_url'],
  'Photos Attached': ['photos_attached', 'premises_photo_url'],
  'Account Holder': ['bank_account_holder'],
  'Account Number': ['bank_account_number'],
  'IFSC Code': ['ifsc_code'],
  'Bank Branch': ['bank_branch'],
  'Owner Photo': ['owner_photo_url'],
  'Owner Signature': ['owner_signature_url'],
  'Aadhar Card': ['owner_aadhar_url'],
  'PAN Card': ['owner_pan_url'],
  'Registration Cert.': ['center_reg_url'],
  'Premises Photo': ['premises_photo_url'],
  'GST Certificate': ['gst_url'],
  'Agreement': ['agreement_url'],
  'Cancel Cheque': ['cancel_cheque_url'],
  'Bank Passbook': ['bank_passbook_url'],
}

// Parse a hold remark ("Label: detail" per line) into the set of form fields it refers to.
function fieldsFromRemark(remark) {
  if (!remark) return []
  const out = new Set()
  String(remark).split('\n').forEach(line => {
    const idx = line.indexOf(':')
    if (idx === -1) return
    const label = line.slice(0, idx).trim()
    const match = LABEL_TO_FORM_FIELDS[label]
      || Object.entries(LABEL_TO_FORM_FIELDS).find(([l]) => l.toLowerCase() === label.toLowerCase())?.[1]
    if (match) match.forEach(f => out.add(f))
  })
  return [...out]
}

function FileCard({ label, fieldKey, accept, isImage, value, onUpload, isUploading, hint, locked }) {
  return (
    <div className={`rounded-xl border ${locked ? 'bg-gray-100/70 border-gray-200' : 'bg-gray-50/60 border-gray-100'}`}>
      <div className="px-4 pt-3 pb-1 flex items-center justify-between">
        <p className="text-xs font-bold text-gray-700">{label}</p>
        {locked ? (
          <span className="text-[10px] font-bold text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full flex items-center gap-1">
            <Lock size={10} /> Verified
          </span>
        ) : value && (
          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
            <CheckCircle2 size={10} /> Uploaded
          </span>
        )}
      </div>
      {hint && <p className="text-[10px] text-gray-400 px-4 pb-1">{hint}</p>}
      <div className="flex flex-col px-4 py-4 gap-3">
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
          {!locked && (
            <label className={`cursor-pointer flex items-center gap-1.5 px-3 py-2 border rounded-xl text-xs font-semibold transition-all
              ${isUploading ? 'border-gray-200 text-gray-400 cursor-not-allowed bg-gray-50' : 'border-[#933d18]/30 text-[#933d18] hover:bg-[#933d18]/5 bg-white'}`}>
              <Upload size={11} />
              {isUploading ? 'Uploading...' : value ? 'Replace' : 'Upload'}
              <input type="file" accept={accept} className="hidden" disabled={isUploading}
                onChange={e => e.target.files[0] && onUpload(fieldKey, e.target.files[0])} />
            </label>
          )}
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
  const [uploading, setUploading] = useState({})
  const [error, setError] = useState(null)
  const [step, setStep] = useState(0)
  const [stepError, setStepError] = useState('')
  const [sameAddress, setSameAddress] = useState(false)
  const [fe, setFe] = useState({}) // field errors
  const [loadedStatus, setLoadedStatus] = useState(null) // original approval_status when editing
  const [holdRemark, setHoldRemark] = useState('')        // doc dept remark to show on resubmit
  const [pricing, setPricing] = useState(null)            // admin-set { with_letter_price, without_letter_price }
  const [correctionFields, setCorrectionFields] = useState([]) // fields Doc Dept flagged for edit
  const [payNow, setPayNow] = useState(false)             // super center is paying offline at creation time
  const isResubmit = isEdit && ['hold', 'account_hold', 'rejected', 'pending'].includes(loadedStatus)
  const backDest = isResubmit ? '/super-center/center-applications' : '/super-center/centers'

  // Account Dept hold ('account_hold'): the Document Dept already verified everything, so ONLY
  // the payment section stays editable — all other fields are locked.
  const isAccountHold = loadedStatus === 'account_hold'
  const PAYMENT_FIELDS = ['amount_paid', 'utr_number', 'payment_date', 'payment_screenshot_url', 'payment_remark']

  // When a held center is sent back with specific flagged fields, ONLY those fields are
  // editable on resubmit — every verified field stays locked. Prefer the structured
  // correction_fields column; fall back to parsing the hold remark for older holds.
  const effectiveCorrection = (correctionFields && correctionFields.length)
    ? correctionFields
    : fieldsFromRemark(holdRemark)
  const correctionSet = new Set(effectiveCorrection)
  const docLockMode = loadedStatus === 'hold' && correctionSet.size > 0
  const lockMode = docLockMode || isAccountHold
  const isLocked = (name) =>
    isAccountHold ? !PAYMENT_FIELDS.includes(name)
    : docLockMode ? !correctionSet.has(name)
    : false

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
    ]).then(([c, s]) => {
      setCountries(c.data || [])
      setStates(s.data || [])
    })
    if (user) {
      // Load this super center's own id AND its admin-set pricing in one go
      supabase.from('centers')
        .select('id, with_letter_price, without_letter_price')
        .eq('email', user.email).eq('center_type', 'super_center').single()
        .then(({ data }) => {
          setSuperCenterId(data?.id)
          setPricing({
            with_letter_price: data?.with_letter_price || 0,
            without_letter_price: data?.without_letter_price || 0,
          })
        })
    }
    if (isEdit) {
      supabase.from('centers').select('*').eq('id', id).single()
        .then(({ data }) => {
          if (!data) return
          setLoadedStatus(data.approval_status || null)
          if (data.approval_status === 'hold' || data.approval_status === 'account_hold' || data.approval_status === 'rejected') setHoldRemark(data.approval_notes || '')
          setCorrectionFields(Array.isArray(data.correction_fields) ? data.correction_fields : [])
          if (data.utr_number || data.payment_screenshot_url) setPayNow(true)
          // Account Dept hold = only payment needs fixing → force the payment section open and
          // land the user straight on the Payment step.
          if (data.approval_status === 'account_hold') { setPayNow(true); setStep(5) }
          const clean = { ...data }
          Object.keys(clean).forEach(k => { if (clean[k] === null) clean[k] = '' })
          if (clean.date_of_birth) clean.date_of_birth = String(clean.date_of_birth).slice(0, 10)
          setForm(prev => ({ ...prev, ...clean }))
        })
    }
  }, [id, user])

  useEffect(() => {
    const main = document.querySelector('main')
    if (main) main.scrollTop = 0
  }, [step])

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

  // Fee for the chosen letter type (set by admin on this super center).
  // This amount is collected at Account Dept verification via a payment link.
  const basePrice = form.letter_type === 'with'
    ? Number(pricing?.with_letter_price || 0)
    : form.letter_type === 'without'
      ? Number(pricing?.without_letter_price || 0)
      : 0

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
      case 'contact_mobile':
        if (val && val.length < 10) return 'Must be 10 digits'
        return ''
      case 'aadhar_no':
        if (!val) return 'Aadhar number is required'
        if (val.length < 12) return 'Must be 12 digits'
        return ''
      case 'pincode':
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
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Enter a valid email address'
        if (!form.phone.trim()) return 'Phone is required'
        if (form.phone.length < 10) return 'Phone must be 10 digits'
        return null
      case 1:
        if (!form.contact_person.trim()) return 'Contact Person Name is required'
        if (form.date_of_birth) {
          const y = Number(String(form.date_of_birth).slice(0, 4))
          if (String(form.date_of_birth).slice(0, 4).length !== 4 || y < 1900) return 'Date of Birth ka year 4 digit ka hona chahiye'
          if (y >= new Date().getFullYear()) return 'Date of Birth ka year current year se kam hona chahiye'
        }
        if (!form.aadhar_no.trim()) return 'Aadhar Number is required'
        if (form.aadhar_no.length < 12) return 'Aadhar must be 12 digits'
        if (!form.state_id) return 'State is required'
        if (!form.district_id) return 'District is required'
        if (!form.pincode.trim()) return 'Pincode is required'
        if (form.pincode.length < 6) return 'Pincode must be 6 digits'
        return null
      case 5:
        if (!form.letter_type) return 'Please select a letter type (With Letter / Without Letter)'
        if (payNow) {
          if (!String(form.amount_paid).trim() || Number(form.amount_paid) <= 0) return 'Enter the amount you paid'
          if (!form.utr_number.trim()) return 'Enter the UTR / transaction reference number'
          if (!form.payment_screenshot_url) return 'Upload the payment receipt / screenshot'
        }
        return null
      default:
        return null
    }
  }

  async function handleNext() {
    const err = validateStep(step)
    if (err) { setStepError(err); return }
    setStepError('')
    setStep(s => s + 1)
  }

  function handlePrev() {
    setStepError('')
    setStep(s => s - 1)
  }

  async function handleSubmit() {
    if (step !== STEPS.length - 1) return
    setLoading(true)
    setError(null)
    try {
      // Re-fetch super center ID if not yet loaded
      let scId = superCenterId
      if (!scId && user?.email) {
        const { data: sc } = await supabase.from('centers').select('id').eq('email', user.email).eq('center_type', 'super_center').single()
        scId = sc?.id || null
        if (scId) setSuperCenterId(scId)
      }
      if (!scId) throw new Error('Super center account not found. Please contact admin.')

      // A fresh create, or editing a held/rejected/pending center, goes (back) to Doc Dept as a
      // pending application — and any old hold remark is cleared so it is verified again from scratch.
      // Editing an already-approved / doc-verified center must NOT silently demote it to pending.
      const resubmit = !isEdit || ['hold', 'account_hold', 'rejected', 'pending'].includes(loadedStatus) || !loadedStatus
      const payload = { ...form, center_type: 'center', super_center_id: scId, base_fee: basePrice, payment_amount: basePrice }
      delete payload.id; delete payload.created_at; delete payload.updated_at
      // Offline payment recorded at creation: keep the amount/UTR/receipt and flag it for the
      // Account Dept to verify. If not paying now, drop those fields so the pay-link flow runs.
      if (payNow) {
        payload.amount_paid = Number(form.amount_paid) || basePrice
        payload.payment_status = 'offline_review'
      } else {
        // Not paying now — don't send the offline-payment columns at all, so center
        // creation keeps working even before add_center_offline_payment.sql is run.
        delete payload.utr_number
        delete payload.payment_date
        delete payload.payment_screenshot_url
        delete payload.payment_remark
      }
      if (resubmit) {
        // Account Dept hold → only payment was fixed, docs already verified, so send it straight
        // BACK to the Account Dept ('doc_verified'), not back to Doc Dept ('pending').
        payload.approval_status = isAccountHold ? 'doc_verified' : 'pending'
        payload.approval_notes = null
        // Persist which fields were flagged so the Document Dept only re-verifies those on
        // resubmit (the rest stay auto-verified). Use the stored correction_fields if present,
        // otherwise derive them from the hold remark text — this way it works even for centers
        // held before the correction_fields column existed. Cleared once finally verified.
        payload.correction_fields = loadedStatus === 'hold' && effectiveCorrection.length
          ? effectiveCorrection
          : null
      } else {
        payload.approval_status = loadedStatus
      }
      const fkFields = ['country_id', 'state_id', 'district_id', 'org_country_id', 'org_state_id', 'org_district_id']
      fkFields.forEach(k => {
        if (!payload[k]) { if (isEdit) payload[k] = null; else delete payload[k] }
      })
      const numericFields = ['office_area_sqft', 'student_capacity', 'revenue_share_percentage', 'amount_paid', 'base_fee', 'payment_amount',
        'num_classrooms', 'num_computers', 'num_faculty']
      numericFields.forEach(k => {
        if (payload[k] === '' || payload[k] === null) { if (isEdit) payload[k] = null; else delete payload[k] }
        else if (payload[k] !== undefined) payload[k] = Number(payload[k])
      })
      // On edit the form was loaded with select('*'), so it carries EVERY column — including
      // date / timestamp / uuid columns whose null values became "". Postgres rejects "" for
      // those types, so convert every empty string to null. On create, just drop empties.
      if (isEdit) {
        Object.keys(payload).forEach(k => { if (payload[k] === '') payload[k] = null })
      } else {
        Object.keys(payload).forEach(k => { if (payload[k] === '') delete payload[k] })
      }

      if (isEdit) {
        const { error: err } = await supabase.from('centers').update(payload).eq('id', id)
        if (err) throw err
      } else {
        const { error: err } = await supabase.from('centers').insert(payload)
        if (err) throw err
      }
      navigate(resubmit ? '/super-center/center-applications' : '/super-center/centers')
    } catch (err) {
      const msg = err.message || ''
      if (msg.includes('centers_center_code_key') || msg.includes('center_code')) {
        setError('Center Code already exists. Please go back to Step 1 and use a unique Center Code.')
        setStep(0)
      } else if (msg.includes('centers_email_key') || (msg.includes('unique') && msg.includes('email'))) {
        setError('This email is already registered. Please go back to Step 1 and use a different email.')
        setStep(0)
      } else {
        setError(msg || 'Something went wrong. Please try again.')
      }
      setLoading(false)
    }
  }

  const docFields = [
    ['owner_photo_url', 'Owner Photo'],
    ['owner_signature_url', 'Signature'],
    ['owner_aadhar_url', 'Aadhar Card'],
    ['owner_pan_url', 'PAN Card'],
    ['center_reg_url', 'Reg. Cert.'],
    ['premises_photo_url', 'Premises'],
    ['gst_url', 'GST Cert.'],
    ['agreement_url', 'Agreement'],
    ['cancel_cheque_url', 'Cancel Cheque'],
    ['bank_passbook_url', 'Bank Passbook'],
    ['payment_screenshot_url', 'Payment Proof'],
  ]
  const docsUploaded = docFields.filter(([k]) => !!form[k]).length

  return (
    <div className="p-4 lg:p-6 pb-20">
      <PageHeader title={isResubmit ? 'Resubmit Application' : isEdit ? 'Edit Center' : 'Create Center'} backTo={backDest} />

      {isAccountHold ? (
        <div className="mt-3 mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-bold text-amber-700">
            <AlertCircle size={15} className="shrink-0" />
            Account Department ne payment verify ke liye hold kiya hai
          </div>
          {holdRemark && (
            <p className="mt-1.5 text-sm text-amber-800 whitespace-pre-line">
              <span className="font-semibold">Remark:</span> {holdRemark}
            </p>
          )}
          <div className="mt-2.5 flex items-start gap-2 bg-white/70 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
            <Lock size={13} className="shrink-0 mt-0.5" />
            <span>
              Documents Document Department ne already verify kar diye hain — woh sab <strong>lock</strong> hain.
              Sirf <strong>Payment</strong> section editable hai. Sahi amount, UTR aur receipt daal kar resubmit karein.
            </span>
          </div>
        </div>
      ) : (loadedStatus === 'hold' || loadedStatus === 'rejected') ? (
        <div className="mt-3 mb-4 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-bold text-orange-700">
            <AlertCircle size={15} className="shrink-0" />
            {loadedStatus === 'hold'
              ? 'Document Department ne is application ko hold kiya hai'
              : 'Document Department ne is application ko reject kiya hai'}
          </div>
          {holdRemark && (
            <p className="mt-1.5 text-sm text-orange-800 whitespace-pre-line">
              <span className="font-semibold">Remark:</span> {holdRemark}
            </p>
          )}
          <p className="mt-1.5 text-xs text-orange-600">
            Zaroori fields theek karein / documents dobara upload karein aur submit karein. Resubmit karne par application
            wapas Document Department ke paas verification ke liye jayegi.
          </p>
          {docLockMode && (
            <div className="mt-2.5 flex items-start gap-2 bg-white/70 border border-orange-200 rounded-lg px-3 py-2 text-xs text-orange-700">
              <Lock size={13} className="shrink-0 mt-0.5" />
              <span>
                Verified fields <strong>lock</strong> kar diye gaye hain. Sirf wahi {correctionSet.size} field(s) editable hain
                jinhe Document Department ne correction ke liye flag kiya hai.
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-3 mb-4 flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700">
          This center will be created under your Super Center and sent for university approval.
        </div>
      )}

      {/* Step header */}
      <div className="sticky top-0 z-20 mb-5 bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
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

      <div className="flex flex-col gap-5">

        {/* STEP 0: Center Identity */}
        {step === 0 && (
          <FormSection title="Center Identity" icon={<Building2 size={16} />}>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Center Name *" value={form.center_name} onChange={set('center_name')} disabled={isLocked('center_name')} required />
              <Input label="Center Code (Auto-generated on approval)" placeholder="Will be assigned after approval" value={form.center_code} readOnly className="bg-gray-50 cursor-not-allowed text-gray-400" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Email *" type="email" value={form.email}
                error={fe.email}
                onChange={e => setField('email', e.target.value)}
                disabled={isLocked('email')}
                placeholder="name@example.com" required />
              <Input label="Phone *" type="tel" value={form.phone}
                error={fe.phone}
                inputMode="numeric"
                onChange={e => setField('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                disabled={isLocked('phone')}
                placeholder="10-digit number" maxLength={10} required />
            </div>
          </FormSection>
        )}

        {/* STEP 1: Contact Person */}
        {step === 1 && (
          <FormSection title="Contact Person Details" icon={<User size={16} />}>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Contact Person Name *" value={form.contact_person} onChange={set('contact_person')} disabled={isLocked('contact_person')} required />
              <Input label="Father / Mother Name *" value={form.father_mother_name} onChange={set('father_mother_name')} disabled={isLocked('father_mother_name')} required />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Input label="Date of Birth *" type="date" min="1900-01-01" max={`${new Date().getFullYear() - 1}-12-31`} value={form.date_of_birth} onChange={set('date_of_birth')} disabled={isLocked('date_of_birth')} required />
              <Select label="Gender *" value={form.gender} onChange={set('gender')} disabled={isLocked('gender')} required>
                <option value="">Select</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </Select>
              <Input label="Nationality *" value={form.nationality} onChange={set('nationality')} disabled={isLocked('nationality')} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Aadhar No *" placeholder="XXXX XXXX XXXX" value={form.aadhar_no}
                error={fe.aadhar_no}
                inputMode="numeric"
                onChange={e => setField('aadhar_no', e.target.value.replace(/\D/g, '').slice(0, 12))}
                disabled={isLocked('aadhar_no')}
                maxLength={12} required />
              <Input label="PAN No *" placeholder="ABCDE1234F" value={form.pan_no} onChange={set('pan_no')} disabled={isLocked('pan_no')} required />
            </div>

            {/* Contact Details */}
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-2">Contact Details</p>
            <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-end">
              <Input label="Current Address *" value={form.current_address} onChange={handleCurrentAddress} disabled={isLocked('current_address')} />
              <div className="pb-2.5 flex flex-col items-center gap-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">Same</span>
                <input type="checkbox" checked={sameAddress} onChange={e => handleSameAddress(e.target.checked)}
                  disabled={isLocked('permanent_address') && isLocked('current_address')}
                  className="w-4 h-4 accent-[#933d18] cursor-pointer" />
              </div>
              <Input label="Permanent Address *" value={form.permanent_address} onChange={set('permanent_address')}
                disabled={sameAddress || isLocked('permanent_address')} placeholder={sameAddress ? 'Same as current address' : ''} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Mobile Number *" inputMode="numeric" maxLength={10} value={form.contact_mobile}
                onChange={e => setField('contact_mobile', e.target.value.replace(/\D/g, '').slice(0, 10))}
                disabled={isLocked('contact_mobile')}
                error={fe.contact_mobile} placeholder="10-digit mobile" required />
              <Input label="Email Address" type="email" value={form.contact_email} onChange={set('contact_email')} disabled={isLocked('contact_email')} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Select label="State *" value={form.state_id} onChange={set('state_id')} disabled={isLocked('state_id')} required>
                <option value="">Select State</option>
                {states.map(s => <option key={s.id} value={s.id}>{s.state_name}</option>)}
              </Select>
              <Select label="District *" value={form.district_id} onChange={set('district_id')} disabled={isLocked('district_id')} required>
                <option value="">Select District</option>
                {districts.map(d => <option key={d.id} value={d.id}>{d.district_name}</option>)}
              </Select>
              <Input label="Pincode *" inputMode="numeric" maxLength={6} value={form.pincode}
                onChange={e => setField('pincode', e.target.value.replace(/\D/g, '').slice(0, 6))}
                disabled={isLocked('pincode')}
                error={fe.pincode} placeholder="6-digit pincode" required />
            </div>

            {/* Professional Details */}
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-2">Professional Details</p>
            <Input label="Current Occupation" value={form.current_occupation} onChange={set('current_occupation')} disabled={isLocked('current_occupation')} />
            <Input label="Previous Experience in Admissions (if any)" value={form.previous_experience_admissions} onChange={set('previous_experience_admissions')} disabled={isLocked('previous_experience_admissions')} />
          </FormSection>
        )}

        {/* STEP 2: Organization */}
        {step === 2 && (
          <FormSection title="Organization Details" icon={<Briefcase size={16} />}>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Organization Name *" value={form.organization_name} onChange={set('organization_name')} disabled={isLocked('organization_name')} required />
              <Select label="Organization Type *" value={form.org_type} onChange={set('org_type')} disabled={isLocked('org_type')} required>
                <option value="">Select</option>
                <option value="Education Consultancy">Education Consultancy</option>
                <option value="Institute">Institute</option>
                <option value="NGO">NGO</option>
                <option value="Pvt. Ltd">Pvt. Ltd</option>
                <option value="Others">Others</option>
              </Select>
            </div>
            <Textarea label="Organization Address" value={form.org_address} onChange={set('org_address')} disabled={isLocked('org_address')} />
            <div className="grid grid-cols-2 gap-4">
              <Input label="Org Post Office" value={form.org_post_office} onChange={set('org_post_office')} disabled={isLocked('org_post_office')} />
              <Input label="Org City" value={form.org_city} onChange={set('org_city')} disabled={isLocked('org_city')} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Select label="Org State" value={form.org_state_id} onChange={set('org_state_id')} disabled={isLocked('org_state_id')}>
                <option value="">Select State</option>
                {states.map(s => <option key={s.id} value={s.id}>{s.state_name}</option>)}
              </Select>
              <Select label="Org District" value={form.org_district_id} onChange={set('org_district_id')} disabled={isLocked('org_district_id')}>
                <option value="">Select District</option>
                {orgDistricts.map(d => <option key={d.id} value={d.id}>{d.district_name}</option>)}
              </Select>
              <Input label="Org Pincode" value={form.org_pincode} onChange={set('org_pincode')} disabled={isLocked('org_pincode')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Registration Number *" value={form.registration_number} onChange={set('registration_number')} disabled={isLocked('registration_number')} required />
              <Input label="GST / PAN (Org)" value={form.gst_pan} onChange={set('gst_pan')} disabled={isLocked('gst_pan')} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Select label="Premises Type" value={form.premises_type} onChange={set('premises_type')} disabled={isLocked('premises_type')}>
                <option value="Owned">Owned</option>
                <option value="Rented">Rented</option>
                <option value="Leased">Leased</option>
              </Select>
              <Input label="Office Area (sqft)" type="number" value={form.office_area_sqft} onChange={set('office_area_sqft')} disabled={isLocked('office_area_sqft')} />
              <Input label="Student Capacity" type="number" value={form.student_capacity} onChange={set('student_capacity')} disabled={isLocked('student_capacity')} />
            </div>

            {/* Infrastructure */}
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-2">Infrastructure</p>
            <div className="grid grid-cols-3 gap-4">
              <Input label="No. of Class Rooms" type="number" min="0" value={form.num_classrooms} onChange={set('num_classrooms')} disabled={isLocked('num_classrooms')} />
              <Input label="No. of Faculty" type="number" min="0" value={form.num_faculty} onChange={set('num_faculty')} disabled={isLocked('num_faculty')} />
              <Input label="Internet Speed" placeholder="e.g. 100 Mbps" value={form.internet_speed} onChange={set('internet_speed')} disabled={isLocked('internet_speed')} />
            </div>
            <div className="grid grid-cols-3 gap-4 items-end">
              <Select label="Computer Lab" value={form.has_computer_lab ? 'yes' : 'no'} disabled={isLocked('has_computer_lab')}
                onChange={e => setForm(f => ({ ...f, has_computer_lab: e.target.value === 'yes', ...(e.target.value === 'no' ? { num_computers: '' } : {}) }))}>
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </Select>
              {form.has_computer_lab && (
                <Input label="No. of Computers" type="number" min="0" value={form.num_computers} onChange={set('num_computers')} disabled={isLocked('num_computers')} />
              )}
              <Select label="CCTV Camera" value={form.has_cctv ? 'yes' : 'no'} disabled={isLocked('has_cctv')}
                onChange={e => setForm(f => ({ ...f, has_cctv: e.target.value === 'yes' }))}>
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </Select>
            </div>
            <Textarea label="Current Courses Offered" placeholder="List the courses currently offered at this centre" value={form.current_courses_offered} onChange={set('current_courses_offered')} disabled={isLocked('current_courses_offered')} />

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
                    <input type="checkbox" checked={!!form[key]} disabled={isLocked(key)}
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
                      <input type="radio" name="photos_attached_sc" value={val}
                        checked={String(!!form.photos_attached) === val} disabled={isLocked('photos_attached')}
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
                      locked={isLocked('premises_photo_url')}
                      hint="Upload center building / office photo" />
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 mb-2">Rent Agreement / Ownership Proof</p>
                <div className="flex items-center gap-5">
                  {['Attached', 'Not Attached'].map(v => (
                    <label key={v} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="rent_agreement_sc" value={v}
                        checked={form.rent_agreement_attached === v} disabled={isLocked('rent_agreement_attached')}
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
                      locked={isLocked('agreement_url')}
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
              <Input label="Account Holder Name *" value={form.bank_account_holder} onChange={set('bank_account_holder')} disabled={isLocked('bank_account_holder')} required />
              <Input label="Account Number *" value={form.bank_account_number} onChange={set('bank_account_number')} disabled={isLocked('bank_account_number')} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="IFSC Code *" value={form.ifsc_code} onChange={set('ifsc_code')} disabled={isLocked('ifsc_code')} required />
              <Input label="Bank Branch *" value={form.bank_branch} onChange={set('bank_branch')} disabled={isLocked('bank_branch')} required />
            </div>
          </FormSection>
        )}

        {/* STEP 4: Education */}
        {step === 4 && (
          <FormSection title="Education Qualification" icon={<GraduationCap size={16} />}>
            {[
              { level: '10th',    f: ['edu_10th_institute',    'edu_10th_board',    'edu_10th_year'] },
              { level: '12th',    f: ['edu_12th_institute',    'edu_12th_board',    'edu_12th_year'] },
              { level: 'UG',      f: ['edu_ug_institute',      'edu_ug_board',      'edu_ug_year'] },
              { level: 'PG',      f: ['edu_pg_institute',      'edu_pg_board',      'edu_pg_year'] },
              { level: 'Diploma', f: ['edu_diploma_institute', 'edu_diploma_board', 'edu_diploma_year'] },
            ].map(({ level, f }) => (
              <div key={level}>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{level}</p>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <Input label="Institute Name" value={form[f[0]]} onChange={set(f[0])} disabled={isLocked(f[0])} />
                  <Input label="Board / University" value={form[f[1]]} onChange={set(f[1])} disabled={isLocked(f[1])} />
                  <Input label="Passing Year" type="number" value={form[f[2]]} onChange={set(f[2])} disabled={isLocked(f[2])} />
                </div>
              </div>
            ))}
          </FormSection>
        )}

        {/* STEP 5: Letter Type & Fee */}
        {step === 5 && (
          <FormSection title="Letter Type & Fee" icon={<Wallet size={16} />}
            subtitle="Choose the letter type — the fee is collected at Account Department verification">

            {/* Letter type selector */}
            <div>
              <p className="text-xs font-bold text-gray-500 mb-2">Letter Type *</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'with', label: 'With Letter', price: Number(pricing?.with_letter_price || 0) },
                  { key: 'without', label: 'Without Letter', price: Number(pricing?.without_letter_price || 0) },
                ].map(opt => {
                  const active = form.letter_type === opt.key
                  const ltLocked = isLocked('letter_type')
                  return (
                    <button key={opt.key} type="button" disabled={ltLocked}
                      onClick={() => { if (!ltLocked) setForm(f => ({ ...f, letter_type: opt.key })) }}
                      className={`text-left rounded-xl border-2 px-4 py-3 transition-all ${
                        active ? 'border-[#933d18] bg-[#933d18]/5' : 'border-gray-200 hover:border-gray-300 bg-white'
                      } ${ltLocked ? 'opacity-60 cursor-not-allowed' : ''}`}>
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-bold ${active ? 'text-[#933d18]' : 'text-gray-700'}`}>{opt.label}</span>
                        {active && <CheckCircle2 size={15} className="text-[#933d18]" />}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Fee: <span className="font-bold text-gray-800">₹{opt.price.toLocaleString()}</span></p>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Auto-filled amount (read-only) */}
            {form.letter_type && (
              <div className="bg-[#933d18]/5 border border-[#933d18]/15 rounded-xl p-4">
                <p className="text-[11px] font-bold text-[#933d18] uppercase tracking-wide">Amount Payable</p>
                <p className="text-2xl font-black text-[#933d18] mt-1">₹{basePrice.toLocaleString()}</p>
                <p className="text-[11px] text-[#933d18]/70 mt-1">
                  {form.letter_type === 'with' ? 'With Letter' : 'Without Letter'} fee, set by admin for your super center.
                </p>
              </div>
            )}

            {/* Pay now toggle */}
            {form.letter_type && (
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={payNow}
                    onChange={e => setPayNow(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-[#933d18]" />
                  <span>
                    <span className="text-sm font-bold text-gray-800">Abhi payment kar rahe ho? (Pay now)</span>
                    <span className="block text-[11px] text-gray-500 mt-0.5">
                      Agar abhi offline (bank/UPI) pay kar diya hai, to amount, UTR number aur receipt yahan daalein.
                    </span>
                  </span>
                </label>
              </div>
            )}

            {/* Offline payment fields */}
            {form.letter_type && payNow && (
              <div className="rounded-xl border border-[#933d18]/15 bg-[#933d18]/5 p-4 flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Amount Paid (₹) *" type="number" min="0"
                    value={form.amount_paid} onChange={set('amount_paid')}
                    placeholder={String(basePrice)} />
                  <Input label="Payment Date" type="date"
                    value={form.payment_date} onChange={set('payment_date')} />
                </div>
                <Input label="UTR / Transaction Reference Number *"
                  value={form.utr_number} onChange={set('utr_number')}
                  placeholder="e.g. 1234567890 / UPI ref" />
                <div>
                  <p className="text-xs font-semibold text-gray-600 ml-0.5 mb-1">Payment Receipt / Screenshot *</p>
                  <FileCard label="Receipt / Screenshot" fieldKey="payment_screenshot_url"
                    accept="image/*,application/pdf" isImage value={form.payment_screenshot_url}
                    onUpload={handleFileUpload} isUploading={!!uploading.payment_screenshot_url}
                    hint="Bank/UPI receipt ya screenshot" />
                </div>
                <Textarea label="Remark (optional)" value={form.payment_remark}
                  onChange={set('payment_remark')} placeholder="Koi note (optional)" rows={2} />
                <p className="text-[11px] text-[#933d18]/80 leading-relaxed">
                  Account Department aapke UTR + receipt ko verify karega, phir center activate hoga.
                </p>
              </div>
            )}

            {/* Pay-later note */}
            {form.letter_type && !payNow && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700 leading-relaxed">
                Abhi pay nahi kar rahe — koi baat nahi. Account Department jab is center ko verify karega tab upar wale
                amount ka ek secure payment link ban jayega. Pay karte hi receipt automatically record ho jayega aur center
                activate ho jayega.
              </div>
            )}
          </FormSection>
        )}

        {/* STEP 6: Documents */}
        {step === 6 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Identity */}
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '16px' }}>
              <div style={{ padding: '16px 24px', background: '#f9fafb', borderBottom: '1px solid #f3f4f6', borderRadius: '16px 16px 0 0' }}>
                <p style={{ fontWeight: 700, fontSize: '14px', color: '#1f2937', margin: 0 }}>Identity Documents</p>
                <p style={{ fontSize: '12px', color: '#9ca3af', margin: '2px 0 0' }}>Owner's personal identity documents</p>
              </div>
              <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                <FileCard label="Owner Photo *" fieldKey="owner_photo_url" accept="image/*" isImage value={form.owner_photo_url} onUpload={handleFileUpload} isUploading={!!uploading.owner_photo_url} locked={isLocked('owner_photo_url')} hint="Passport-size photo" />
                <FileCard label="Owner Signature *" fieldKey="owner_signature_url" accept="image/*" isImage value={form.owner_signature_url} onUpload={handleFileUpload} isUploading={!!uploading.owner_signature_url} locked={isLocked('owner_signature_url')} hint="On white paper" />
                <FileCard label="Aadhar Card *" fieldKey="owner_aadhar_url" accept="image/*,application/pdf" isImage={false} value={form.owner_aadhar_url} onUpload={handleFileUpload} isUploading={!!uploading.owner_aadhar_url} locked={isLocked('owner_aadhar_url')} hint="Front & back" />
                <FileCard label="PAN Card *" fieldKey="owner_pan_url" accept="image/*,application/pdf" isImage={false} value={form.owner_pan_url} onUpload={handleFileUpload} isUploading={!!uploading.owner_pan_url} locked={isLocked('owner_pan_url')} hint="Owner's PAN card" />
              </div>
            </div>

            {/* Center */}
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '16px' }}>
              <div style={{ padding: '16px 24px', background: '#f9fafb', borderBottom: '1px solid #f3f4f6', borderRadius: '16px 16px 0 0' }}>
                <p style={{ fontWeight: 700, fontSize: '14px', color: '#1f2937', margin: 0 }}>Center Documents</p>
                <p style={{ fontSize: '12px', color: '#9ca3af', margin: '2px 0 0' }}>Organization and premises documents</p>
              </div>
              <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                <FileCard label="Registration Cert. *" fieldKey="center_reg_url" accept="image/*,application/pdf" isImage={false} value={form.center_reg_url} onUpload={handleFileUpload} isUploading={!!uploading.center_reg_url} locked={isLocked('center_reg_url')} hint="Society / company reg." />
                <FileCard label="Premises Photo *" fieldKey="premises_photo_url" accept="image/*" isImage value={form.premises_photo_url} onUpload={handleFileUpload} isUploading={!!uploading.premises_photo_url} locked={isLocked('premises_photo_url')} hint="Center building/office" />
                <FileCard label="GST Certificate" fieldKey="gst_url" accept="image/*,application/pdf" isImage={false} value={form.gst_url} onUpload={handleFileUpload} isUploading={!!uploading.gst_url} locked={isLocked('gst_url')} hint="If applicable" />
                <FileCard label="Agreement Doc *" fieldKey="agreement_url" accept="image/*,application/pdf" isImage={false} value={form.agreement_url} onUpload={handleFileUpload} isUploading={!!uploading.agreement_url} locked={isLocked('agreement_url')} hint="Signed MOU" />
              </div>
            </div>

            {/* Bank */}
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '16px' }}>
              <div style={{ padding: '16px 24px', background: '#f9fafb', borderBottom: '1px solid #f3f4f6', borderRadius: '16px 16px 0 0' }}>
                <p style={{ fontWeight: 700, fontSize: '14px', color: '#1f2937', margin: 0 }}>Bank Documents</p>
                <p style={{ fontSize: '12px', color: '#9ca3af', margin: '2px 0 0' }}>Bank verification documents</p>
              </div>
              <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                <FileCard label="Cancel Cheque *" fieldKey="cancel_cheque_url" accept="image/*,application/pdf" isImage={false} value={form.cancel_cheque_url} onUpload={handleFileUpload} isUploading={!!uploading.cancel_cheque_url} locked={isLocked('cancel_cheque_url')} hint="Cancelled cheque" />
                <FileCard label="Bank Passbook *" fieldKey="bank_passbook_url" accept="image/*,application/pdf" isImage={false} value={form.bank_passbook_url} onUpload={handleFileUpload} isUploading={!!uploading.bank_passbook_url} locked={isLocked('bank_passbook_url')} hint="First page / statement" />
              </div>
            </div>

            {/* Summary */}
            <div style={{ background: '#f9fafb', border: '1px solid #f3f4f6', borderRadius: '12px', padding: '16px' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px' }}>
                Upload Summary — {docsUploaded}/11 documents uploaded
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {docFields.map(([k, label]) => (
                  <div key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', borderRadius: '8px', padding: '8px 12px', border: '1px solid #f3f4f6' }}>
                    <span style={{ fontSize: '11px', color: '#4b5563' }}>{label}</span>
                    {form[k]
                      ? <CheckCircle2 size={13} className="text-emerald-500" />
                      : <div style={{ width: '12px', height: '12px', borderRadius: '50%', border: '2px solid #d1d5db' }} />
                    }
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
            <AlertCircle size={15} /> {error}
          </div>
        )}

        {/* Step validation error — shown near Next button */}
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
            <Button type="button" variant="outline" onClick={() => navigate(backDest)}>Cancel</Button>
            {step < STEPS.length - 1 ? (
              <Button type="button" onClick={handleNext}>
                Next <ArrowRight size={14} />
              </Button>
            ) : (
              <Button type="button" onClick={handleSubmit} disabled={loading}>
                {loading ? 'Saving...' : isResubmit ? 'Resubmit Application' : isEdit ? 'Update Center' : 'Create Center'}
              </Button>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
