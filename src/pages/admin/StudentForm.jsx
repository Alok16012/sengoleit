import { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import PageHeader from '../../components/ui/PageHeader'
import Input, { Select, Textarea } from '../../components/ui/Input'
import DateInput from '../../components/ui/DateInput'
import Button from '../../components/ui/Button'
import FormSection from '../../components/ui/FormSection'
import { formatDate } from '../../utils/formatDate'
import {
  ClipboardList, User, Users, MapPin, BookOpen, FileText, Upload, Eye,
  ChevronDown, CheckCircle2, AlertCircle, Wallet, ArrowRight, ArrowLeft
} from 'lucide-react'

// Searchable dropdown for picking one of the center's available coupons.
function CouponSearchSelect({ coupons, value, onSelect }) {
  const [open, setOpen] = useState(false)
  const [dropUp, setDropUp] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    function handle(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  function toggleOpen() {
    setOpen(v => {
      const next = !v
      if (next && ref.current) {
        // If there isn't enough room below the control (it sits near the
        // bottom of the page), flip the menu so it opens upward instead of
        // being clipped by the viewport.
        const rect = ref.current.getBoundingClientRect()
        const spaceBelow = window.innerHeight - rect.bottom
        setDropUp(spaceBelow < 280)
      }
      return next
    })
  }

  const opts = coupons.map(c => ({
    code: c.id.slice(0, 8).toUpperCase(),
    face: Number(c.face_value || 0),
  }))
  const filtered = query
    ? opts.filter(o => o.code.includes(query.toUpperCase()))
    : opts

  return (
    <div className="relative flex-1" ref={ref}>
      <button
        type="button"
        onClick={toggleOpen}
        className={`w-full flex items-center justify-between border rounded-xl px-3 py-2 text-sm bg-white transition-all ${
          open ? 'border-[#933d18] ring-2 ring-[#933d18]/10' : 'border-gray-200 hover:border-gray-300'
        }`}
      >
        <span className={value ? 'text-gray-900 font-mono font-medium' : 'text-gray-400'}>
          {value || 'Have a coupon code? (optional)'}
        </span>
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className={`absolute z-50 w-full bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden ${
          dropUp ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
        }`}>
          <div className="p-2 border-b border-gray-100">
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search coupon code..."
              className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-[#933d18] uppercase font-mono"
            />
          </div>
          <ul className="max-h-44 overflow-y-auto">
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-xs text-gray-400 text-center">No matching coupons</li>
            ) : filtered.map(o => (
              <li key={o.code}
                onClick={() => { onSelect(o.code); setOpen(false); setQuery('') }}
                className={`flex items-center justify-between px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 ${
                  value === o.code ? 'bg-[#933d18]/5' : ''
                }`}>
                <span className="font-mono text-gray-700">{o.code}</span>
                <span className="text-xs font-semibold text-[#933d18]">₹{o.face.toLocaleString('en-IN')} off</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// Generic searchable single-select. `onChange` is called event-style
// ({ target: { value } }) so it can drop in for a native <Select>.
function SearchSelect({ label, options, value, onChange, placeholder = 'Select', disabled, required }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    function handle(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const selected = options.find(o => o.id === value)
  const filtered = query
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options

  function pick(id) { onChange({ target: { value: id } }); setOpen(false); setQuery('') }

  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-semibold text-gray-600 ml-0.5">{label}</label>}
      <div className="relative" ref={ref}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(v => !v)}
          className={`w-full flex items-center justify-between border rounded-xl py-2.5 px-3.5 text-sm bg-white transition-all
            disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed
            ${open ? 'border-[#933d18] ring-2 ring-[#933d18]/20' : 'border-gray-200 hover:border-gray-300'}`}
        >
          <span className={`truncate ${selected ? 'text-gray-900' : 'text-gray-400'}`}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronDown size={14} className={`text-gray-400 shrink-0 ml-2 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && !disabled && (
          <div className="absolute z-50 mt-1.5 w-full bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
            <div className="p-2 border-b border-gray-100">
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search..."
                className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-[#933d18]"
              />
            </div>
            <ul className="max-h-56 overflow-y-auto">
              <li onClick={() => pick('')}
                className={`px-3.5 py-2 text-sm cursor-pointer hover:bg-gray-50 ${!value ? 'text-[#933d18] font-semibold bg-[#933d18]/5' : 'text-gray-500'}`}>
                {placeholder}
              </li>
              {filtered.length === 0 ? (
                <li className="px-3.5 py-3 text-xs text-gray-400 text-center">No results</li>
              ) : filtered.map(o => (
                <li key={o.id} onClick={() => pick(o.id)}
                  className={`px-3.5 py-2 text-sm cursor-pointer hover:bg-gray-50 ${value === o.id ? 'text-[#933d18] font-semibold bg-[#933d18]/5' : 'text-gray-700'}`}>
                  {o.label}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

function AddressBlock({ prefix, label, form, onChange, onChangeDigits, setForm, countries = [], states, districts, sameAsOptions, readOnly }) {
  const selectedCountry = countries.find(c => c.country_name === form[`${prefix}_country`])
  const countryStates = selectedCountry ? states.filter(s => s.country_id === selectedCountry.id) : states
  const uniqueStates = countryStates.filter((s, i, arr) => arr.findIndex(x => x.state_name === s.state_name) === i)
  const selectedStateIds = countryStates.filter(s => s.state_name === form[`${prefix}_state`]).map(s => s.id)
  const filteredDistricts = selectedStateIds.length > 0
    ? districts.filter(d => selectedStateIds.includes(d.state_id))
    : districts

  return (
    <div className="bg-gray-50/60 rounded-xl p-4 space-y-4 border border-gray-100">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-black text-[#933d18] uppercase tracking-widest">{label}</p>
        {!readOnly && sameAsOptions && sameAsOptions.map(opt => (
          <label key={opt.label} className="flex items-center gap-1.5 cursor-pointer group select-none">
            <input type="checkbox" checked={opt.checked}
              onChange={e => { if (e.target.checked) opt.onCopy(); opt.onToggle(e.target.checked) }}
              className="w-3.5 h-3.5 accent-[#933d18] cursor-pointer rounded" />
            <span className="text-[11px] font-semibold text-[#933d18] group-hover:underline">{opt.label}</span>
          </label>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Village / Town / Locality" value={form[`${prefix}_village_town`]} onChange={onChange(`${prefix}_village_town`)} readOnly={readOnly} />
        <Input label="Landmark" value={form[`${prefix}_landmark`]} onChange={onChange(`${prefix}_landmark`)} readOnly={readOnly} />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Input label="Post Office" value={form[`${prefix}_post_office`]} onChange={onChange(`${prefix}_post_office`)} readOnly={readOnly} />
        <Input label="City *" value={form[`${prefix}_city`]} onChange={onChange(`${prefix}_city`)} readOnly={readOnly} />
        <Input label="PIN Code *" type="tel" inputMode="numeric" maxLength={6} placeholder="6-digit PIN" value={form[`${prefix}_pin_code`]} onChange={onChangeDigits(`${prefix}_pin_code`, 6)} readOnly={readOnly} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        {countries.length > 0 ? (
          <Select label="Country *" value={form[`${prefix}_country`] || ''}
            onChange={e => setForm(f => ({ ...f, [`${prefix}_country`]: e.target.value, [`${prefix}_state`]: '', [`${prefix}_district`]: '' }))}
            disabled={readOnly}>
            <option value="">Select Country</option>
            {countries.map(c => <option key={c.id} value={c.country_name}>{c.country_name}</option>)}
          </Select>
        ) : (
          <Input label="Country *" value={form[`${prefix}_country`]} onChange={onChange(`${prefix}_country`)} readOnly={readOnly} />
        )}
        {uniqueStates.length > 0 ? (
          <Select label="State *" value={form[`${prefix}_state`] || ''}
            onChange={e => setForm(f => ({ ...f, [`${prefix}_state`]: e.target.value, [`${prefix}_district`]: '' }))}
            disabled={readOnly}>
            <option value="">Select State</option>
            {uniqueStates.map(s => <option key={s.id} value={s.state_name}>{s.state_name}</option>)}
          </Select>
        ) : (
          <Input label="State *" value={form[`${prefix}_state`]} onChange={onChange(`${prefix}_state`)} readOnly={readOnly} />
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        {filteredDistricts.length > 0 ? (
          <Select label="District" value={form[`${prefix}_district`] || ''} onChange={onChange(`${prefix}_district`)} disabled={readOnly}>
            <option value="">Select District</option>
            {filteredDistricts.map(d => <option key={d.id} value={d.district_name}>{d.district_name}</option>)}
          </Select>
        ) : (
          <Input label="District" value={form[`${prefix}_district`]} onChange={onChange(`${prefix}_district`)} readOnly={readOnly} />
        )}
      </div>
    </div>
  )
}

function EduRow({ prefix, label, boardType, boards, form, onChange, onUpload, uploading, isOpen, onToggle, readOnly }) {
  const levelBoards = boards.filter(b => b.type === 'All' || b.type === boardType)
  const obtained = parseFloat(form[`${prefix}_obtained_marks`]) || 0
  const total = parseFloat(form[`${prefix}_total_marks`]) || 0
  const percentage = obtained > 0 && total > 0 ? ((obtained / total) * 100).toFixed(2) : ''
  const marksError = obtained > 0 && total > 0 && obtained > total ? `Cannot exceed Total Marks (${total})` : ''
  const marksheetKey = `${prefix}_marksheet_url`
  const isFilled = !!(form[`${prefix}_institute_name`] || form[`${prefix}_board_university`] || form[`${prefix}_passing_year`])

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${isOpen ? 'border-[#933d18]/30 shadow-sm' : 'border-gray-200'}`}>
      <button
        type="button"
        onClick={onToggle}
        className={`w-full flex items-center justify-between px-5 py-3.5 transition-colors ${isOpen ? 'bg-[#933d18]/5' : 'bg-gray-50 hover:bg-gray-100'}`}
      >
        <div className="flex items-center gap-3">
          {isFilled
            ? <CheckCircle2 size={15} className="text-green-500 shrink-0" />
            : <div className="w-[15px] h-[15px] rounded-full border-2 border-gray-300 shrink-0" />
          }
          <span className={`text-sm font-bold ${isOpen ? 'text-[#933d18]' : 'text-gray-700'}`}>{label}</span>
          {isFilled && !isOpen && (
            <span className="text-[10px] px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-bold tracking-wide">FILLED</span>
          )}
        </div>
        <ChevronDown size={15} className={`shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#933d18]' : 'text-gray-400'}`} />
      </button>

      {isOpen && (
        <div className="p-5 space-y-4 border-t border-[#933d18]/10">
          <div className="grid grid-cols-3 gap-4">
            <Input label="Institute Name" value={form[`${prefix}_institute_name`]} onChange={onChange(`${prefix}_institute_name`)} readOnly={readOnly} />
            {levelBoards.length > 0 ? (
              <Select label="Board / University" value={form[`${prefix}_board_university`]} onChange={onChange(`${prefix}_board_university`)} disabled={readOnly}>
                <option value="">Select Board</option>
                {levelBoards.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
              </Select>
            ) : (
              <Input label="Board / University" value={form[`${prefix}_board_university`]} onChange={onChange(`${prefix}_board_university`)} readOnly={readOnly} />
            )}
            <Input label="Passing Year" type="number" placeholder="2023" value={form[`${prefix}_passing_year`]} onChange={onChange(`${prefix}_passing_year`)} readOnly={readOnly} />
          </div>
          <div className="grid grid-cols-4 gap-4">
            <Input label="Obtained Marks" type="number" min="0"
              max={total > 0 ? total : undefined}
              value={form[`${prefix}_obtained_marks`]}
              onChange={onChange(`${prefix}_obtained_marks`)}
              error={marksError}
              readOnly={readOnly} />
            <Input label="Total Marks" type="number" min="0"
              value={form[`${prefix}_total_marks`]}
              onChange={onChange(`${prefix}_total_marks`)}
              readOnly={readOnly} />
            <Input
              label="Percentage (%)"
              value={percentage ? `${percentage}%` : ''}
              readOnly
              placeholder="Auto-calculated"
              className="bg-[#933d18]/5 text-[#933d18] font-bold cursor-not-allowed"
            />
            <FileField
              label="Marksheet"
              fieldKey={marksheetKey}
              accept="image/*,application/pdf"
              isImage={false}
              value={form[marksheetKey]}
              onUpload={onUpload}
              isUploading={!!uploading[marksheetKey]}
              readOnly={readOnly}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function FileField({ label, fieldKey, accept, isImage, value, onUpload, isUploading, readOnly }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-gray-600 ml-0.5">{label}</label>
      <div className="flex items-center gap-2 flex-wrap">
        {!readOnly && (
          <label className={`cursor-pointer flex items-center gap-2 px-3 py-2 border rounded-xl text-xs font-semibold transition-all
            ${isUploading ? 'border-gray-200 text-gray-400 cursor-not-allowed bg-gray-50' : 'border-[#933d18]/30 text-[#933d18] hover:bg-[#933d18]/5 bg-white'}`}>
            <Upload size={12} />
            {isUploading ? 'Uploading...' : value ? 'Change' : 'Upload'}
            <input type="file" accept={accept} className="hidden" disabled={isUploading}
              onChange={e => e.target.files[0] && onUpload(fieldKey, e.target.files[0])} />
          </label>
        )}
        {value && isImage && (
          <img src={value} alt={label} className="h-10 w-10 object-cover rounded-lg border border-gray-200 shadow-sm" />
        )}
        {value && (
          <a href={value} target="_blank" rel="noreferrer"
            className="flex items-center gap-1 text-xs font-semibold text-[#933d18] hover:underline">
            <Eye size={12} /> View
          </a>
        )}
        {!value && <span className="text-xs text-gray-400 italic">{readOnly ? '—' : 'No file'}</span>}
      </div>
    </div>
  )
}

const emptyForm = {
  date_of_submission: new Date().toISOString().split('T')[0],
  date_of_admission: '', entry_type: 'Regular',
  session_id: '', mode_id: '', university_id: '',
  center_id: '', center_name: '',
  department_id: '', programme_id: '', course_code: '',
  semester_year: '', academic_year: '',
  enrollment_no: '', admission_number: '', registration_no: '',
  status: 'Pending', remarks: '',
  student_name: '', date_of_birth: '', profession: '', gender: '', email: '',
  mobile_no: '', whatsapp_no: '', nationality: 'Indian',
  caste: '', religion: '', blood_group: '', mother_tongue: '',
  physically_handicapped: 'No', aadhar_link_mobile: '', aadhar_no: '',
  identification_marks: '', scholarship_applied: 'None', pan_no: '',
  fathers_name: '', fathers_occupation: '',
  mothers_name: '', mothers_occupation: '',
  guardian_name: '', guardian_occupation: '', guardian_relation: '',
  guardian_email: '', guardian_mobile: '',
  student_perm_village_town: '', student_perm_landmark: '',
  student_perm_post_office: '', student_perm_city: '',
  student_perm_state: '', student_perm_district: '', student_perm_pin_code: '',
  student_pres_village_town: '', student_pres_landmark: '',
  student_pres_post_office: '', student_pres_city: '',
  student_pres_state: '', student_pres_district: '', student_pres_pin_code: '',
  guardian_pres_village_town: '', guardian_pres_landmark: '',
  guardian_pres_post_office: '', guardian_pres_city: '',
  guardian_pres_state: '', guardian_pres_district: '', guardian_pres_pin_code: '',
  guardian_perm_village_town: '', guardian_perm_landmark: '',
  guardian_perm_post_office: '', guardian_perm_city: '',
  guardian_perm_state: '', guardian_perm_district: '', guardian_perm_pin_code: '',
  tenth_institute_name: '', tenth_board_university: '', tenth_passing_year: '', tenth_obtained_marks: '', tenth_total_marks: '',
  twelfth_institute_name: '', twelfth_board_university: '', twelfth_passing_year: '', twelfth_obtained_marks: '', twelfth_total_marks: '',
  ug_institute_name: '', ug_board_university: '', ug_passing_year: '', ug_obtained_marks: '', ug_total_marks: '',
  pg_institute_name: '', pg_board_university: '', pg_passing_year: '', pg_obtained_marks: '', pg_total_marks: '',
  diploma_institute_name: '', diploma_board_university: '', diploma_passing_year: '', diploma_obtained_marks: '', diploma_total_marks: '',
  photo_url: '', aadhar_url: '', signature_url: '', declaration_url: '',
  tenth_marksheet_url: '', twelfth_marksheet_url: '', ug_marksheet_url: '', pg_marksheet_url: '', diploma_marksheet_url: '',
}

const PROFESSION_OPTIONS = ['Student', 'Private Service', 'Govt. Service', 'Self Employed', 'Others']
const CASTE_OPTIONS = ['General', 'OBC', 'SC', 'ST', 'Minorities', 'Others']
const SCHOLARSHIP_OPTIONS = ['None', 'Scholarship-1', 'Scholarship-2', 'Scholarship-3', 'Scholarship-4']
const STATUS_OPTIONS = ['Pending', 'Reviewing', 'Document Verified', 'Account Section', 'Rejected', 'Admitted']

const STEPS = [
  { id: 'sec-basic', label: 'Basic Entry', icon: ClipboardList },
  { id: 'sec-program', label: 'Program Info', icon: BookOpen },
  { id: 'sec-personal', label: 'Personal Info', icon: User },
  { id: 'sec-family', label: 'Family Info', icon: Users },
  { id: 'sec-contact', label: 'Contact', icon: MapPin },
  { id: 'sec-education', label: 'Education', icon: FileText },
  { id: 'sec-documents', label: 'Documents', icon: Upload },
]

function fmtDate(d) {
  if (!d) return ''
  return formatDate(d + 'T00:00:00')
}

export default function StudentForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile, user } = useAuth()
  const role = profile?.role || user?.user_metadata?.role || 'admin'
  const isAdmin = role === 'admin'
  const isEdit = Boolean(id)
  const isReadOnly = isEdit && !isAdmin
  const backPath = role === 'center' ? '/center/students' : role === 'super_center' ? '/super-center/students' : '/admin/students'

  const [form, setForm] = useState(emptyForm)
  const [universities, setUniversities] = useState([])
  const [programs, setPrograms] = useState([])
  const [departments, setDepartments] = useState([])
  const [centers, setCenters] = useState([])
  const [sessions, setSessions] = useState([])
  const [studyModes, setStudyModes] = useState([])
  const [boards, setBoards] = useState([])
  const [countries, setCountries] = useState([])
  const [states, setStates] = useState([])
  const [districts, setDistricts] = useState([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState({})
  const [openEdu, setOpenEdu] = useState({ tenth: true, twelfth: false, ug: false, pg: false, diploma: false })

  const [step, setStep] = useState(0)
  const [stepError, setStepError] = useState('')
  const [walletInfo, setWalletInfo] = useState({ checking: false, balance: 0, courseFee: 0, ok: null, checked: false })
  const [coupon, setCoupon] = useState({ code: '', applying: false, applied: null, error: '', discount: 0 })
  const [availableCoupons, setAvailableCoupons] = useState([])

  const toggleEdu = (key) => setOpenEdu(prev => ({ ...prev, [key]: !prev[key] }))

  useEffect(() => {
    const main = document.querySelector('main')
    if (main) main.scrollTop = 0
  }, [step])

  useEffect(() => {
    Promise.all([
      supabase.from('universities').select('id, university_name').order('university_name'),
      supabase.from('programs').select('id, program_name, course_code, department_id, semester_year, duration, complete_duration').order('program_name'),
      supabase.from('departments').select('id, name').order('name'),
      supabase.from('centers').select('id, center_name, center_code').order('center_name'),
      supabase.from('academic_sessions').select('id, session_name, start_date, end_date, academic_year').order('session_name'),
      supabase.from('study_modes').select('id, mode_name').order('mode_name'),
      supabase.from('boards').select('id, name, type').order('name'),
      supabase.from('countries').select('id, country_name').order('country_name'),
      supabase.from('states').select('id, state_name, country_id').order('state_name'),
      supabase.from('districts').select('id, district_name, state_id').order('district_name'),
    ]).then(([unis, progs, depts, cents, sess, modes, bds, ctrs, sts, dists]) => {
      setUniversities(unis.data || [])
      setPrograms(progs.data || [])
      setDepartments(depts.data || [])
      setCenters(cents.data || [])
      setSessions(sess.data || [])
      setStudyModes(modes.data || [])
      setBoards(bds.data || [])
      setCountries(ctrs.data || [])
      setStates(sts.data || [])
      setDistricts(dists.data || [])

      if (!isEdit && unis.data?.length === 1) {
        setForm(f => ({ ...f, university_id: unis.data[0].id }))
      }
      if (!isAdmin && user?.email && !isEdit) {
        supabase.from('centers').select('id, center_name').eq('email', user.email).single()
          .then(({ data: cd }) => {
            if (cd) setForm(f => ({ ...f, center_id: cd.id, center_name: cd.center_name }))
          })
      }
    })
    if (isEdit) {
      supabase.from('students').select('*').eq('id', id).single()
        .then(({ data }) => { if (data) setForm(prev => ({ ...prev, ...data })) })
    }
  }, [id])

  // Auto wallet check when on step 1 and program/semester/center changes
  useEffect(() => {
    if (step === 1 && form.programme_id && form.center_id && !isAdmin && !isEdit) {
      runWalletCheck()
    }
  }, [step, form.programme_id, form.semester_year, form.center_id])

  // Load this center's unused coupons so they can be picked from a dropdown
  useEffect(() => {
    if (!form.center_id || isAdmin || isEdit) { setAvailableCoupons([]); return }
    supabase.from('coupons')
      .select('id, face_value, is_used, used_at, center_id')
      .eq('center_id', form.center_id)
      .then(({ data }) => {
        const avail = (data || []).filter(c => !c.is_used && !c.used_at)
        setAvailableCoupons(avail)
      })
  }, [form.center_id])

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }))
  // Numeric-only input, capped at `max` digits (strips everything else)
  const setDigits = (key, max) => (e) => setForm(f => ({ ...f, [key]: e.target.value.replace(/\D/g, '').slice(0, max) }))

  const ADDR_KEYS = ['village_town', 'landmark', 'post_office', 'city', 'pin_code', 'state', 'district']
  const copyAddress = (from, to) => setForm(f => {
    const next = { ...f }
    ADDR_KEYS.forEach(k => { next[`${to}_${k}`] = f[`${from}_${k}`] || '' })
    return next
  })

  const [pressSameAsPerm, setPressSameAsPerm] = useState(false)
  const [guardianPresSameAsStudent, setGuardianPresSameAsStudent] = useState(false)
  const [guardianPermSameAsPres, setGuardianPermSameAsPres] = useState(false)

  const handleDepartmentChange = (e) => {
    setForm(f => ({ ...f, department_id: e.target.value, programme_id: '', course_code: '', semester_year: '' }))
    setWalletInfo({ checking: false, balance: 0, courseFee: 0, ok: null, checked: false })
    setCoupon({ code: '', applying: false, applied: null, error: '', discount: 0 })
  }

  const handleProgramChange = (e) => {
    const prog = programs.find(p => p.id === e.target.value)
    setForm(f => ({ ...f, programme_id: e.target.value, course_code: prog?.course_code || '', semester_year: '' }))
  }

  const handleSessionChange = (e) => {
    const sess = sessions.find(s => s.id === e.target.value)
    const today = new Date().toISOString().split('T')[0]
    let submissionDate = today
    if (sess?.start_date && sess?.end_date) {
      if (today < sess.start_date) submissionDate = sess.start_date
      else if (today > sess.end_date) submissionDate = sess.end_date
    }
    setForm(f => ({
      ...f,
      session_id: e.target.value,
      academic_year: sess?.academic_year || sess?.session_name || f.academic_year,
      date_of_submission: submissionDate,
      date_of_admission: '',
    }))
  }

  const selectedSession = sessions.find(s => s.id === form.session_id)
  const sessionMinDate = selectedSession?.start_date || ''
  const sessionMaxDate = selectedSession?.end_date || ''

  const filteredPrograms = form.department_id
    ? programs.filter(p => p.department_id === form.department_id)
    : programs

  const selectedProgram = programs.find(p => p.id === form.programme_id)
  const progSemYear = selectedProgram?.semester_year

  const parseDuration = (prog) => {
    if (!prog) return 0
    if (prog.duration) return Number(prog.duration)
    if (prog.complete_duration) {
      const match = prog.complete_duration.match(/\d+/)
      return match ? Number(match[0]) : 0
    }
    return 0
  }
  const progDuration = parseDuration(selectedProgram)

  const ordinal = (n) => {
    const s = ['th', 'st', 'nd', 'rd']
    const v = n % 100
    return n + (s[(v - 20) % 10] || s[v] || s[0])
  }

  const semesterOptions = progDuration > 0
    ? progSemYear === 'Year'
      ? Array.from({ length: progDuration }, (_, i) => `${ordinal(i + 1)} Year`)
      : Array.from({ length: progSemYear === 'Semester' ? progDuration : progDuration * 2 }, (_, i) => `${ordinal(i + 1)} Semester`)
    : null

  async function handleFileUpload(fieldKey, file) {
    setUploading(u => ({ ...u, [fieldKey]: true }))
    try {
      const ext = file.name.split('.').pop()
      const path = `${Date.now()}_${fieldKey}.${ext}`
      const { error } = await supabase.storage.from('student-docs').upload(path, file, { upsert: true })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('student-docs').getPublicUrl(path)
      setForm(f => ({ ...f, [fieldKey]: publicUrl }))
    } catch (err) {
      alert('Upload failed: ' + err.message)
    }
    setUploading(u => ({ ...u, [fieldKey]: false }))
  }

  async function generateRegistrationNumber() {
    const yy = String(new Date().getFullYear()).slice(-2)
    const prefix = `SIU${yy}R`
    const { count } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true })
      .like('registration_no', `${prefix}%`)
    return `${prefix}${1001 + (count || 0)}`
  }

  async function generateAdmissionNumber() {
    const { count } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true })
      .not('admission_number', 'is', null)
      .neq('admission_number', '')
    const year = new Date().getFullYear()
    const num = String((count || 0) + 1).padStart(5, '0')
    return `ADM-${year}-${num}`
  }

  async function runWalletCheck() {
    setWalletInfo(w => ({ ...w, checking: true }))
    try {
      // A program can have multiple fee structures (one per session), so
      // maybeSingle() fails. Fetch all and prefer the one for this session.
      const { data: structures } = await supabase
        .from('fee_structures')
        .select('id, session_id, total_semesters')
        .eq('program_id', form.programme_id)

      const fs = (structures || []).find(s => s.session_id === form.session_id)
        || (structures || [])[0]

      let courseFee = 0
      if (fs) {
        const { data: items } = await supabase
          .from('fee_items')
          .select('amount, category')
          .eq('fee_structure_id', fs.id)

        // Charge only the fee for the semester/year being admitted into.
        const totalSems = fs.total_semesters
          || (progSemYear === 'Year' ? (progDuration || 1) * 2 : (progDuration || 1))
          || 1
        const semIndex = Math.max((parseInt(form.semester_year, 10) || 1) - 1, 0)
        let fee = 0
        ;(items || []).forEach(it => {
          const a = Number(it.amount) || 0
          if (it.category === 'entry'     && semIndex === 0) fee += a
          if (it.category === 'divide')                      fee += totalSems > 0 ? a / totalSems : 0
          if (it.category === 'multiply')                    fee += a
          if (it.category === 'multiply2' && semIndex > 0)   fee += a
        })
        courseFee = Math.round(fee)
      }

      const { data: ctr } = await supabase
        .from('centers')
        .select('virtual_balance')
        .eq('id', form.center_id)
        .maybeSingle()

      const balance = Number(ctr?.virtual_balance || 0)
      // Required = 50% of the full course fee, then minus any coupon discount.
      const half = Math.ceil(courseFee * 0.5)
      const minRequired = Math.max(half - (coupon.discount || 0), 0)
      const ok = courseFee === 0 || balance >= minRequired
      setWalletInfo({ checking: false, balance, courseFee, ok, checked: true })
      return ok
    } catch {
      setWalletInfo(w => ({ ...w, checking: false, checked: true, ok: true }))
      return true
    }
  }

  async function applyCoupon() {
    const code = coupon.code.trim().toUpperCase()
    if (!code) { setCoupon(c => ({ ...c, error: 'Enter a coupon code' })); return }
    if (!form.center_id) { setCoupon(c => ({ ...c, error: 'Select a center first' })); return }
    setCoupon(c => ({ ...c, applying: true, error: '' }))
    try {
      const { data: rows } = await supabase
        .from('coupons')
        .select('id, face_value, is_used, used_at, center_id')
        .eq('center_id', form.center_id)
      const match = (rows || []).find(
        r => !r.is_used && !r.used_at && r.id?.slice(0, 8).toUpperCase() === code
      )
      if (!match) {
        setCoupon(c => ({ ...c, applying: false, applied: null, discount: 0, error: 'Invalid or already-used coupon code for this center' }))
        return
      }
      const discount = Number(match.face_value || 0)
      setCoupon(c => ({ ...c, applying: false, applied: match, discount, error: '' }))
      // Re-evaluate: required = 50% of course fee, then minus coupon discount.
      const half = Math.ceil((walletInfo.courseFee || 0) * 0.5)
      const minRequired = Math.max(half - discount, 0)
      setWalletInfo(w => ({ ...w, ok: w.courseFee === 0 || w.balance >= minRequired }))
    } catch (err) {
      setCoupon(c => ({ ...c, applying: false, error: 'Could not validate coupon. Try again.' }))
    }
  }

  function removeCoupon() {
    setCoupon({ code: '', applying: false, applied: null, error: '', discount: 0 })
    setWalletInfo(w => ({ ...w, ok: w.courseFee === 0 || w.balance >= Math.ceil(w.courseFee * 0.5) }))
  }

  function validateStep(s) {
    switch (s) {
      case 0:
        if (!form.session_id) return 'Please select a Session'
        if (!form.mode_id) return 'Please select a Mode'
        if (!form.entry_type) return 'Please select an Entry Type'
        if (!form.date_of_submission) return 'Date of Submission is required'
        if (!form.date_of_admission) return 'Date of Admission is required'
        if (isAdmin && !form.center_id) return 'Please select a Center'
        if (!isAdmin && !form.center_name) return 'Center Name is required'
        return null
      case 1:
        if (!form.department_id) return 'Please select a Department'
        if (!form.programme_id) return 'Please select a Program'
        if (!form.semester_year) return 'Please select Semester / Year'
        return null
      case 2:
        if (!form.student_name.trim()) return 'Student Name is required'
        if (!form.date_of_birth) return 'Date of Birth is required'
        if (!form.gender) return 'Please select Gender'
        if (!form.mobile_no.trim()) return 'Mobile Number is required'
        if (form.mobile_no.length !== 10) return 'Mobile Number must be 10 digits'
        if (form.whatsapp_no && form.whatsapp_no.length !== 10) return 'WhatsApp Number must be 10 digits'
        if (!form.email.trim()) return 'Email is required'
        if (!form.caste) return 'Please select Caste'
        if (!form.religion.trim()) return 'Religion is required'
        if (form.aadhar_link_mobile && form.aadhar_link_mobile.length !== 10) return 'Aadhar Link Mobile must be 10 digits'
        if (!form.aadhar_no.trim()) return 'Aadhar Number is required'
        if (form.aadhar_no.length !== 12) return 'Aadhar Number must be 12 digits'
        return null
      case 3:
        if (!form.fathers_name.trim()) return "Father's Name is required"
        if (!form.mothers_name.trim()) return "Mother's Name is required"
        if (form.guardian_mobile && form.guardian_mobile.length !== 10) return 'Guardian Mobile No must be 10 digits'
        return null
      case 4:
        if (!form.student_perm_city.trim() || !form.student_perm_state || !form.student_perm_pin_code.trim())
          return 'Please fill Student Permanent Address (City, State and PIN Code are required)'
        for (const p of ['student_perm', 'student_pres', 'guardian_pres', 'guardian_perm']) {
          const pin = form[`${p}_pin_code`]
          if (pin && pin.length !== 6) return 'PIN Code must be 6 digits'
        }
        return null
      case 6:
        if (!form.photo_url) return 'Student Photo is required'
        if (!form.signature_url) return 'Signature is required'
        if (!form.aadhar_url) return 'Aadhar Card is required'
        if (!form.declaration_url) return 'Declaration Form is required'
        return null
      default:
        return null
    }
  }

  async function handleNext() {
    const err = validateStep(step)
    if (err) { setStepError(err); return }
    setStepError('')

    if (step === 1 && !isAdmin && !isEdit) {
      const ok = walletInfo.checked ? walletInfo.ok : await runWalletCheck()
      if (!ok) {
        setStepError('Insufficient wallet balance. Please recharge your wallet before proceeding.')
        return
      }
    }

    setStep(s => s + 1)
  }

  function handlePrev() {
    setStepError('')
    setStep(s => s - 1)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    // Guard: only the final (Documents) step may actually submit. If the form
    // is submitted from any earlier step — e.g. pressing Enter inside a field
    // on the Education step — treat it as "Next" so we never skip the
    // remaining steps (especially Documents).
    if (step < STEPS.length - 1) { handleNext(); return }
    const err = validateStep(step)
    if (err) { setStepError(err); return }

    const eduPrefixes = ['tenth', 'twelfth', 'ug', 'pg', 'diploma']
    for (const pfx of eduPrefixes) {
      const obt = parseFloat(form[`${pfx}_obtained_marks`]) || 0
      const tot = parseFloat(form[`${pfx}_total_marks`]) || 0
      if (obt > 0 && tot > 0 && obt > tot) {
        alert(`Obtained marks cannot exceed Total marks. Please check the marks for ${pfx.toUpperCase()} qualification.`)
        return
      }
    }

    setLoading(true)
    const payload = { ...form }
    if (!isEdit) payload.status = 'Pending'
    if (!isEdit && !payload.registration_no) {
      payload.registration_no = await generateRegistrationNumber()
    }
    // Assign the admission number right at submission so it is visible from the
    // start (Pending list). The Document Dept keeps whatever is assigned here.
    if (!isEdit && !payload.admission_number) {
      payload.admission_number = await generateAdmissionNumber()
    }
    delete payload.id; delete payload.created_at; delete payload.updated_at
    // The address blocks add transient keys (e.g. student_perm_country) that
    // aren't columns on `students`. Keep only the canonical form columns so
    // the insert/update doesn't fail on unknown columns.
    const allowedKeys = new Set(Object.keys(emptyForm))
    Object.keys(payload).forEach(k => { if (!allowedKeys.has(k)) delete payload[k] })
    const fkFields = ['university_id', 'session_id', 'programme_id', 'department_id', 'mode_id', 'center_id']
    fkFields.forEach(k => { if (!payload[k]) delete payload[k] })

    const { data: saved, error } = isEdit
      ? await supabase.from('students').update(payload).eq('id', id).select('id').single()
      : await supabase.from('students').insert(payload).select('id').single()

    if (!error) {
      // NOTE: The wallet is NOT charged on submission any more. The center
      // only needs 50% of the course fee available (checked above) to submit.
      // The actual fee is deducted in full by the Account Dept after the
      // Document Dept verifies the application. We still reserve the coupon
      // here (mark it used + link it to this application) so the Account Dept
      // can apply its discount when it collects the fee.
      if (!isEdit && !isAdmin && coupon.applied?.id) {
        await supabase.from('coupons')
          .update({ is_used: true, used_at: new Date().toISOString(), application_id: saved?.id || null })
          .eq('id', coupon.applied.id)
      }
      navigate(backPath)
    } else {
      alert('Error: ' + error.message)
      setLoading(false)
    }
  }

  return (
    <div className="p-4 lg:p-6 pb-20">
      <PageHeader title={isEdit ? (isReadOnly ? 'View Student' : 'Edit Student') : 'Add Student'} backTo={backPath} />

      {/* Read-only banner */}
      {isReadOnly && (
        <div className="mt-4 mb-2 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
          <AlertCircle size={15} />
          This application has been submitted. Contact the university for any changes.
        </div>
      )}

      {/* Step header */}
      <div className="sticky top-0 z-20 mt-4 mb-5 bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
        <div className="overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <div className="flex items-stretch min-w-max">
            {STEPS.map((s, i) => {
              const isActive = step === i
              const isPast = i < step
              const Icon = s.icon
              return (
                <div key={s.id} className="flex items-center">
                  <button
                    type="button"
                    onClick={() => { setStepError(''); setStep(i) }}
                    className={`relative flex items-center gap-2.5 px-5 py-3.5 transition-all group cursor-pointer
                      ${isActive
                        ? 'bg-[#933d18] text-white'
                        : isPast
                          ? 'bg-[#933d18]/8 text-[#933d18]/70 hover:bg-[#933d18]/12'
                          : 'text-gray-400 hover:bg-gray-50'
                      }`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 transition-all
                      ${isActive
                        ? 'bg-white/20 text-white'
                        : isPast
                          ? 'bg-[#933d18]/20 text-[#933d18]'
                          : 'bg-gray-100 text-gray-400'
                      }`}>
                      {isPast ? <CheckCircle2 size={13} /> : i + 1}
                    </div>
                    <div className="flex flex-col items-start">
                      <div className="flex items-center gap-1.5">
                        <Icon size={13} className={isActive ? 'text-white/80' : isPast ? 'text-[#933d18]/60' : 'text-gray-300'} />
                        <span className={`text-xs font-bold whitespace-nowrap leading-tight
                          ${isActive ? 'text-white' : isPast ? 'text-[#933d18]/80' : 'text-gray-500'}`}>
                          {s.label}
                        </span>
                      </div>
                    </div>
                    {isActive && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/40 rounded-full" />}
                  </button>
                  {i < STEPS.length - 1 && (
                    <div className={`w-px self-stretch my-2 transition-colors ${isPast ? 'bg-[#933d18]/20' : 'bg-gray-200'}`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Step error */}
      {stepError && (
        <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          <AlertCircle size={15} className="shrink-0" /> {stepError}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        onKeyDown={(e) => {
          // Enter should never implicitly submit the form from an input field
          // (that used to submit the application early, before Documents).
          // Instead, on every step except the last, Enter behaves like the
          // "Next" button and advances the wizard. Textareas keep newlines,
          // and on the final (Documents) step Enter is left alone so the
          // normal submit can happen.
          if (e.key !== 'Enter' || e.target.tagName === 'TEXTAREA') return
          if (step < STEPS.length - 1) {
            e.preventDefault()
            handleNext()
          }
        }}
        className="flex flex-col gap-5"
      >

        {/* STEP 0: Basic Entry */}
        {step === 0 && (
          <FormSection title="Basic Entry" icon={<ClipboardList size={16} />}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Select label="Session *" value={form.session_id} onChange={handleSessionChange} disabled={isReadOnly} required>
                <option value="">Select Session</option>
                {sessions.map(s => <option key={s.id} value={s.id}>{s.session_name}</option>)}
              </Select>
              <Select label="Mode *" value={form.mode_id} onChange={set('mode_id')} disabled={isReadOnly} required>
                <option value="">Select Mode</option>
                {studyModes.map(m => <option key={m.id} value={m.id}>{m.mode_name}</option>)}
              </Select>
              <Select label="Entry Type *" value={form.entry_type} onChange={set('entry_type')} disabled={isReadOnly}>
                <option value="Regular">Regular</option>
                <option value="Lateral">Lateral</option>
                <option value="External">External</option>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <DateInput
                label="Date of Submission *"
                value={form.date_of_submission}
                onChange={set('date_of_submission')}
                min={sessionMinDate || undefined}
                max={sessionMaxDate || undefined}
                readOnly={isReadOnly}
                hint={
                  sessionMinDate && sessionMaxDate
                    ? `Between ${fmtDate(sessionMinDate)} and ${fmtDate(sessionMaxDate)}`
                    : 'Select a session first'
                }
              />
              <DateInput
                label="Date of Admission *"
                value={form.date_of_admission}
                onChange={set('date_of_admission')}
                min={sessionMinDate || undefined}
                max={sessionMaxDate || undefined}
                readOnly={isReadOnly}
                hint={
                  sessionMinDate && sessionMaxDate
                    ? `Between ${fmtDate(sessionMinDate)} and ${fmtDate(sessionMaxDate)}`
                    : 'Select a session first'
                }
              />
              <Input
                label="University"
                value={universities.find(u => u.id === form.university_id)?.university_name || ''}
                readOnly
                className="bg-gray-50 text-gray-700 font-medium cursor-not-allowed"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {isAdmin ? (
                <>
                  <Select label="Center Name *" value={form.center_id} onChange={set('center_id')} disabled={isReadOnly}>
                    <option value="">Select Center</option>
                    {centers.map(c => <option key={c.id} value={c.id}>{c.center_name}{c.center_code ? ` (${c.center_code})` : ''}</option>)}
                  </Select>
                  <Input label="Center Name (manual)" placeholder="Auto-filled or type" value={form.center_name} onChange={set('center_name')} readOnly={isReadOnly} />
                </>
              ) : (
                <Input label="Center Name" value={form.center_name || ''} readOnly className="bg-gray-50 text-gray-500 cursor-not-allowed" />
              )}
            </div>
          </FormSection>
        )}

        {/* STEP 1: Program Information */}
        {step === 1 && (
          <>
            <FormSection title="Program Information" icon={<BookOpen size={16} />}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SearchSelect
                  label="Department *"
                  placeholder="Select Department"
                  value={form.department_id}
                  onChange={handleDepartmentChange}
                  disabled={isReadOnly}
                  options={departments.map(d => ({ id: d.id, label: d.name }))}
                />
                <SearchSelect
                  label="Program Name *"
                  placeholder="Select Program"
                  value={form.programme_id}
                  onChange={handleProgramChange}
                  disabled={isReadOnly}
                  options={filteredPrograms.map(p => ({ id: p.id, label: p.program_name }))}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Input label="Course Code" value={form.course_code} onChange={set('course_code')} readOnly={isReadOnly} />
                <Select label="Semester / Year *" value={form.semester_year} onChange={set('semester_year')} disabled={isReadOnly} required>
                  <option value="">Select</option>
                  {semesterOptions
                    ? semesterOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)
                    : <>
                        {['1st','2nd','3rd','4th','5th','6th','7th','8th'].map(s => (
                          <option key={s} value={s + ' Semester'}>{s} Semester</option>
                        ))}
                        {['1st Year','2nd Year','3rd Year','4th Year'].map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </>
                  }
                </Select>
                <Input label="Academic Year" placeholder="2024-25" value={form.academic_year} readOnly className="bg-gray-50 text-gray-700 font-medium cursor-not-allowed" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Enrollment No"
                  placeholder={isAdmin ? 'Auto-generate if blank' : '—'}
                  value={form.enrollment_no}
                  onChange={set('enrollment_no')}
                  readOnly={!isAdmin || isReadOnly}
                  className={!isAdmin ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : ''}
                />
                <Input
                  label="Admission Number"
                  placeholder={isAdmin ? '' : '—'}
                  value={form.admission_number}
                  onChange={set('admission_number')}
                  readOnly={!isAdmin || isReadOnly}
                  className={!isAdmin ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : ''}
                />
              </div>
              {isAdmin && isEdit && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Select
                    label="Status"
                    value={form.status}
                    onChange={set('status')}
                  >
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </Select>
                  <Textarea label="Remarks" value={form.remarks} onChange={set('remarks')} />
                </div>
              )}
              {isAdmin && !isEdit && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <p className="text-xs font-bold text-gray-500">Status</p>
                    <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl">
                      <span className="text-xs font-bold text-amber-700">Pending</span>
                      <span className="text-xs text-amber-600">— will go to Document Dept. first</span>
                    </div>
                  </div>
                  <Textarea label="Remarks" value={form.remarks} onChange={set('remarks')} />
                </div>
              )}
              {!isAdmin && isReadOnly && form.remarks && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <p className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-1">Remarks</p>
                  <p className="text-sm text-gray-700">{form.remarks}</p>
                </div>
              )}
            </FormSection>

            {/* Wallet check panel */}
            {!isAdmin && !isEdit && (
              <div className="mt-2">
                {walletInfo.checking ? (
                  <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-600">
                    <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                    Checking wallet balance...
                  </div>
                ) : walletInfo.checked && form.programme_id ? (
                  <>
                  <div className={`flex items-center justify-between rounded-xl px-4 py-3 ${walletInfo.ok ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
                    <div className="flex items-center gap-3">
                      <Wallet size={16} className={walletInfo.ok ? 'text-emerald-600' : 'text-red-600'} />
                      <div>
                        <p className="text-sm font-bold text-gray-800">Wallet Balance Check</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Course Fee: ₹{walletInfo.courseFee.toLocaleString('en-IN')}
                          &nbsp;·&nbsp;50%: ₹{Math.ceil(walletInfo.courseFee * 0.5).toLocaleString('en-IN')}
                          {coupon.discount > 0 && (
                            <>&nbsp;·&nbsp;Coupon: −₹{coupon.discount.toLocaleString('en-IN')}</>
                          )}
                          &nbsp;·&nbsp;Required: ₹{Math.max(Math.ceil(walletInfo.courseFee * 0.5) - (coupon.discount || 0), 0).toLocaleString('en-IN')}
                          &nbsp;·&nbsp;Your Balance: ₹{walletInfo.balance.toLocaleString('en-IN')}
                        </p>
                      </div>
                    </div>
                    <span className={`text-xs font-black px-3 py-1 rounded-full ${walletInfo.ok ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
                      {walletInfo.ok ? '✓ Sufficient' : '✗ Insufficient'}
                    </span>
                  </div>

                  {/* Coupon code apply */}
                  {walletInfo.courseFee > 0 && (
                    <div className="mt-2">
                      {coupon.applied ? (
                        <div className="flex items-center justify-between bg-[#933d18]/5 border border-[#933d18]/20 rounded-xl px-4 py-2.5">
                          <p className="text-xs font-semibold text-[#933d18]">
                            Coupon <span className="font-mono">{coupon.code.toUpperCase()}</span> applied · ₹{coupon.discount.toLocaleString('en-IN')} off
                          </p>
                          <button type="button" onClick={removeCoupon} className="text-xs font-semibold text-gray-400 hover:text-red-500 underline">Remove</button>
                        </div>
                      ) : availableCoupons.length === 0 ? (
                        <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs text-gray-400">
                          No coupons available for this center.
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <CouponSearchSelect
                            coupons={availableCoupons}
                            value={coupon.code}
                            onSelect={code => setCoupon(c => ({ ...c, code, error: '' }))}
                          />
                          <button
                            type="button"
                            onClick={applyCoupon}
                            disabled={coupon.applying || !coupon.code}
                            className="px-4 py-2 text-sm font-bold rounded-xl bg-[#933d18] text-white hover:bg-[#7a3213] disabled:opacity-60 transition-colors"
                          >
                            {coupon.applying ? 'Applying...' : 'Apply'}
                          </button>
                        </div>
                      )}
                      {coupon.error && <p className="text-xs text-red-500 mt-1.5 px-1">{coupon.error}</p>}
                    </div>
                  )}
                  </>
                ) : form.programme_id ? (
                  <p className="text-xs text-gray-400 italic">Balance check will run automatically...</p>
                ) : null}
                {walletInfo.checked && !walletInfo.ok && (
                  <p className="text-xs text-red-600 mt-2 px-1">
                    Please recharge your wallet to proceed.{' '}
                    <a href={role === 'center' ? '/center/balance' : '/super-center/balance'}
                      className="underline font-semibold">Recharge Now →</a>
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {/* STEP 2: Personal Information */}
        {step === 2 && (
          <FormSection title="Personal Information" icon={<User size={16} />}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Student Name *" value={form.student_name} onChange={set('student_name')} required readOnly={isReadOnly} />
              <DateInput label="Date of Birth *" value={form.date_of_birth} onChange={set('date_of_birth')} required readOnly={isReadOnly} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Select label="Profession *" value={form.profession} onChange={set('profession')} disabled={isReadOnly} required>
                <option value="">Select</option>
                {PROFESSION_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </Select>
              <Select label="Gender *" value={form.gender} onChange={set('gender')} disabled={isReadOnly} required>
                <option value="">Select</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Others">Others</option>
              </Select>
              <Input label="Email Id *" type="email" value={form.email} onChange={set('email')} required readOnly={isReadOnly} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input label="Mobile No *" type="tel" inputMode="numeric" maxLength={10} placeholder="10-digit mobile" value={form.mobile_no} onChange={setDigits('mobile_no', 10)} required readOnly={isReadOnly} />
              <Input label="WhatsApp No *" type="tel" inputMode="numeric" maxLength={10} placeholder="10-digit number" value={form.whatsapp_no} onChange={setDigits('whatsapp_no', 10)} required readOnly={isReadOnly} />
              {countries.length > 0 ? (
                <Select label="Nationality *" value={form.nationality} onChange={set('nationality')} disabled={isReadOnly} required>
                  <option value="">Select Country</option>
                  {countries.map(c => <option key={c.id} value={c.country_name}>{c.country_name}</option>)}
                </Select>
              ) : (
                <Input label="Nationality *" value={form.nationality} onChange={set('nationality')} required readOnly={isReadOnly} />
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Select label="Caste *" value={form.caste} onChange={set('caste')} disabled={isReadOnly} required>
                <option value="">Select</option>
                {CASTE_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
              <Input label="Religion *" value={form.religion} onChange={set('religion')} required readOnly={isReadOnly} />
              <Input label="Blood Group" placeholder="A+, B-, O+" value={form.blood_group} onChange={set('blood_group')} readOnly={isReadOnly} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input label="Mother Tongue *" value={form.mother_tongue} onChange={set('mother_tongue')} required readOnly={isReadOnly} />
              <Select label="Physically Handicapped *" value={form.physically_handicapped} onChange={set('physically_handicapped')} disabled={isReadOnly}>
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </Select>
              <Input label="Aadhar Link Mobile *" type="tel" inputMode="numeric" maxLength={10} placeholder="10-digit mobile" value={form.aadhar_link_mobile} onChange={setDigits('aadhar_link_mobile', 10)} required readOnly={isReadOnly} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input label="Aadhar No *" inputMode="numeric" maxLength={12} placeholder="12-digit Aadhar" value={form.aadhar_no} onChange={setDigits('aadhar_no', 12)} required readOnly={isReadOnly} />
              <Input label="PAN No" placeholder="ABCDE1234F" value={form.pan_no} onChange={set('pan_no')} readOnly={isReadOnly} />
              <Select label="Scholarship Applied *" value={form.scholarship_applied} onChange={set('scholarship_applied')} disabled={isReadOnly}>
                {SCHOLARSHIP_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>
            <Input label="Identification Marks" placeholder="Any visible identification marks..." value={form.identification_marks} onChange={set('identification_marks')} readOnly={isReadOnly} />
          </FormSection>
        )}

        {/* STEP 3: Family Information */}
        {step === 3 && (
          <FormSection title="Family Information" icon={<Users size={16} />}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Father's Name *" value={form.fathers_name} onChange={set('fathers_name')} required readOnly={isReadOnly} />
              <Input label="Father's Occupation *" value={form.fathers_occupation} onChange={set('fathers_occupation')} required readOnly={isReadOnly} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Mother's Name *" value={form.mothers_name} onChange={set('mothers_name')} required readOnly={isReadOnly} />
              <Input label="Mother's Occupation *" value={form.mothers_occupation} onChange={set('mothers_occupation')} required readOnly={isReadOnly} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input label="Guardian's Name" value={form.guardian_name} onChange={set('guardian_name')} readOnly={isReadOnly} />
              <Input label="Guardian's Occupation" value={form.guardian_occupation} onChange={set('guardian_occupation')} readOnly={isReadOnly} />
              <Input label="Relation" placeholder="E.g. Uncle, Elder Brother" value={form.guardian_relation} onChange={set('guardian_relation')} readOnly={isReadOnly} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Guardian Email Id" type="email" value={form.guardian_email} onChange={set('guardian_email')} readOnly={isReadOnly} />
              <Input label="Guardian Mobile No" type="tel" inputMode="numeric" maxLength={10} placeholder="10-digit mobile" value={form.guardian_mobile} onChange={setDigits('guardian_mobile', 10)} readOnly={isReadOnly} />
            </div>
          </FormSection>
        )}

        {/* STEP 4: Contact Information */}
        {step === 4 && (
          <FormSection title="Contact Information" icon={<MapPin size={16} />}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AddressBlock prefix="student_perm" label="Student Permanent Address"
                form={form} onChange={set} onChangeDigits={setDigits} setForm={setForm} countries={countries} states={states} districts={districts} readOnly={isReadOnly} />
              <AddressBlock prefix="student_pres" label="Student Present Address"
                form={form} onChange={set} onChangeDigits={setDigits} setForm={setForm} countries={countries} states={states} districts={districts} readOnly={isReadOnly}
                sameAsOptions={[{
                  label: 'Same as Permanent Address',
                  checked: pressSameAsPerm,
                  onCopy: () => copyAddress('student_perm', 'student_pres'),
                  onToggle: v => setPressSameAsPerm(v),
                }]} />
              <AddressBlock prefix="guardian_pres" label="Guardian Present Address"
                form={form} onChange={set} onChangeDigits={setDigits} setForm={setForm} countries={countries} states={states} districts={districts} readOnly={isReadOnly}
                sameAsOptions={[{
                  label: "Same as Student's Present Address",
                  checked: guardianPresSameAsStudent,
                  onCopy: () => copyAddress('student_pres', 'guardian_pres'),
                  onToggle: v => setGuardianPresSameAsStudent(v),
                }]} />
              <AddressBlock prefix="guardian_perm" label="Guardian Permanent Address"
                form={form} onChange={set} onChangeDigits={setDigits} setForm={setForm} countries={countries} states={states} districts={districts} readOnly={isReadOnly}
                sameAsOptions={[
                  {
                    label: 'Same as Guardian Present Address',
                    checked: guardianPermSameAsPres,
                    onCopy: () => copyAddress('guardian_pres', 'guardian_perm'),
                    onToggle: v => setGuardianPermSameAsPres(v),
                  },
                  {
                    label: "Same as Student's Permanent Address",
                    checked: false,
                    onCopy: () => copyAddress('student_perm', 'guardian_perm'),
                    onToggle: () => {},
                  },
                ]} />
            </div>
          </FormSection>
        )}

        {/* STEP 5: Education Qualification */}
        {step === 5 && (
          <FormSection title="Education Qualification" icon={<FileText size={16} />}
            subtitle="Click on each level to expand and fill details">
            <div className="space-y-2">
              <EduRow prefix="tenth" label="10th / SSC / Matric" boardType="10th" boards={boards} form={form} onChange={set} onUpload={handleFileUpload} uploading={uploading} isOpen={openEdu.tenth} onToggle={() => toggleEdu('tenth')} readOnly={isReadOnly} />
              <EduRow prefix="twelfth" label="12th / HSC / Intermediate" boardType="12th" boards={boards} form={form} onChange={set} onUpload={handleFileUpload} uploading={uploading} isOpen={openEdu.twelfth} onToggle={() => toggleEdu('twelfth')} readOnly={isReadOnly} />
              <EduRow prefix="ug" label="UG (Graduation)" boardType="UG" boards={boards} form={form} onChange={set} onUpload={handleFileUpload} uploading={uploading} isOpen={openEdu.ug} onToggle={() => toggleEdu('ug')} readOnly={isReadOnly} />
              <EduRow prefix="pg" label="PG (Post Graduation)" boardType="PG" boards={boards} form={form} onChange={set} onUpload={handleFileUpload} uploading={uploading} isOpen={openEdu.pg} onToggle={() => toggleEdu('pg')} readOnly={isReadOnly} />
              <EduRow prefix="diploma" label="Diploma / Polytechnic" boardType="Diploma" boards={boards} form={form} onChange={set} onUpload={handleFileUpload} uploading={uploading} isOpen={openEdu.diploma} onToggle={() => toggleEdu('diploma')} readOnly={isReadOnly} />
            </div>
          </FormSection>
        )}

        {/* STEP 6: Documents */}
        {step === 6 && (
          <FormSection title="Documents" icon={<Upload size={16} />}
            subtitle="Upload student photo, Aadhar, signature and declaration">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 flex flex-col gap-3 items-center">
                {form.photo_url
                  ? <img src={form.photo_url} alt="Photo" className="h-24 w-24 object-cover rounded-xl border-2 border-[#933d18]/20 shadow" />
                  : <div className="h-24 w-24 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center bg-white">
                      <User size={28} className="text-gray-300" />
                    </div>
                }
                <FileField label="Student Photo *" fieldKey="photo_url" accept="image/*" isImage value={form.photo_url} onUpload={handleFileUpload} isUploading={!!uploading.photo_url} readOnly={isReadOnly} />
              </div>
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 flex flex-col gap-3 items-center">
                {form.signature_url
                  ? <img src={form.signature_url} alt="Signature" className="h-24 w-24 object-contain rounded-xl border-2 border-[#933d18]/20 shadow bg-white" />
                  : <div className="h-24 w-24 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center bg-white">
                      <FileText size={28} className="text-gray-300" />
                    </div>
                }
                <FileField label="Signature *" fieldKey="signature_url" accept="image/*" isImage value={form.signature_url} onUpload={handleFileUpload} isUploading={!!uploading.signature_url} readOnly={isReadOnly} />
              </div>
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 flex flex-col gap-3">
                <p className="text-xs font-semibold text-gray-500">Aadhar Card *</p>
                <FileField label="" fieldKey="aadhar_url" accept="image/*,application/pdf" isImage={false} value={form.aadhar_url} onUpload={handleFileUpload} isUploading={!!uploading.aadhar_url} readOnly={isReadOnly} />
              </div>
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 flex flex-col gap-3">
                <p className="text-xs font-semibold text-gray-500">Declaration Form *</p>
                <FileField label="" fieldKey="declaration_url" accept="image/*,application/pdf" isImage={false} value={form.declaration_url} onUpload={handleFileUpload} isUploading={!!uploading.declaration_url} readOnly={isReadOnly} />
              </div>
            </div>
          </FormSection>
        )}

        {/* Navigation buttons */}
        <div className="flex items-center justify-between pt-2 pb-8">
          <div>
            {step > 0 && (
              <Button type="button" variant="outline" onClick={handlePrev}>
                <ArrowLeft size={14} /> Back
              </Button>
            )}
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={() => navigate(backPath)}>Cancel</Button>
            {step < STEPS.length - 1 ? (
              <Button type="button" onClick={handleNext} disabled={walletInfo.checking}>
                {walletInfo.checking ? 'Checking...' : 'Next'} <ArrowRight size={14} />
              </Button>
            ) : (
              !isReadOnly && (
                <Button type="submit" disabled={loading}>
                  {loading ? 'Saving...' : isEdit ? 'Update Student' : 'Submit Application'}
                </Button>
              )
            )}
          </div>
        </div>

      </form>
    </div>
  )
}
