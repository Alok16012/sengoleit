import { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase, supabaseAdmin } from '../../lib/supabase'
import PageHeader from '../../components/ui/PageHeader'
import Input, { Select, Textarea } from '../../components/ui/Input'
import DateInput from '../../components/ui/DateInput'
import Button from '../../components/ui/Button'
import FormSection from '../../components/ui/FormSection'
import { formatDate } from '../../utils/formatDate'
import { computeCumulativeCourseFee } from '../../utils/courseFee'
import { resolveStudentDocUrls } from '../../utils/resolveStudentDocs'
import {
  ClipboardList, User, Users, MapPin, BookOpen, FileText, Upload, Eye, EyeOff,
  ChevronDown, CheckCircle2, AlertCircle, Wallet, ArrowRight, ArrowLeft,
  KeyRound, RefreshCw, CreditCard, X
} from 'lucide-react'

// Center-style auto password, e.g. Sg@A1B2C3
const genStudentPassword = () => `Sg@${Math.random().toString(36).slice(-6).toUpperCase()}`

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
    // Show the real coupon_code (same as admin Coupon Management), falling back to
    // the id prefix only for legacy coupons that have no coupon_code.
    code: (c.coupon_code || c.id.slice(0, 8).toUpperCase()).toUpperCase(),
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

function AddressBlock({ prefix, label, form, onChange, onChangeDigits, setForm, countries = [], states, districts, sameAsOptions, readOnly, isLocked = () => false, requireAll = false }) {
  const ro = (suffix) => readOnly || isLocked(`${prefix}_${suffix}`)
  // When requireAll is set (Student Permanent Address), every field is mandatory,
  // so the fields that are otherwise optional get a * too.
  const req = requireAll ? ' *' : ''
  const selectedCountry = countries.find(c => c.country_name === form[`${prefix}_country`])
  // Show states linked to the chosen country PLUS any state with no country
  // assigned (many states have a null country_id), so picking a country never
  // hides unassigned states from the dropdown.
  const countryStates = selectedCountry ? states.filter(s => s.country_id === selectedCountry.id || !s.country_id) : states
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
        <Input label={`Village / Town / Locality${req}`} value={form[`${prefix}_village_town`]} onChange={onChange(`${prefix}_village_town`)} readOnly={ro('village_town')} />
        <Input label={`Landmark${req}`} value={form[`${prefix}_landmark`]} onChange={onChange(`${prefix}_landmark`)} readOnly={ro('landmark')} />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Input label={`Post Office${req}`} value={form[`${prefix}_post_office`]} onChange={onChange(`${prefix}_post_office`)} readOnly={ro('post_office')} />
        <Input label="City *" value={form[`${prefix}_city`]} onChange={onChange(`${prefix}_city`)} readOnly={ro('city')} />
        <Input label="PIN Code *" type="tel" inputMode="numeric" maxLength={6} placeholder="6-digit PIN" value={form[`${prefix}_pin_code`]} onChange={onChangeDigits(`${prefix}_pin_code`, 6)} readOnly={ro('pin_code')} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        {countries.length > 0 ? (
          <Select label="Country *" value={form[`${prefix}_country`] || ''}
            onChange={e => setForm(f => ({ ...f, [`${prefix}_country`]: e.target.value, [`${prefix}_state`]: '', [`${prefix}_district`]: '' }))}
            disabled={ro('country')}>
            <option value="">Select Country</option>
            {countries.map(c => <option key={c.id} value={c.country_name}>{c.country_name}</option>)}
          </Select>
        ) : (
          <Input label="Country *" value={form[`${prefix}_country`]} onChange={onChange(`${prefix}_country`)} readOnly={ro('country')} />
        )}
        {uniqueStates.length > 0 ? (
          <Select label="State *" value={form[`${prefix}_state`] || ''}
            onChange={e => setForm(f => ({ ...f, [`${prefix}_state`]: e.target.value, [`${prefix}_district`]: '' }))}
            disabled={ro('state')}>
            <option value="">Select State</option>
            {uniqueStates.map(s => <option key={s.id} value={s.state_name}>{s.state_name}</option>)}
          </Select>
        ) : (
          <Input label="State *" value={form[`${prefix}_state`]} onChange={onChange(`${prefix}_state`)} readOnly={ro('state')} />
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        {filteredDistricts.length > 0 ? (
          <Select label={`District${req}`} value={form[`${prefix}_district`] || ''} onChange={onChange(`${prefix}_district`)} disabled={ro('district')}>
            <option value="">Select District</option>
            {filteredDistricts.map(d => <option key={d.id} value={d.district_name}>{d.district_name}</option>)}
          </Select>
        ) : (
          <Input label={`District${req}`} value={form[`${prefix}_district`]} onChange={onChange(`${prefix}_district`)} readOnly={ro('district')} />
        )}
      </div>
    </div>
  )
}

function EduRow({ prefix, label, boardType, boards, form, onChange, onUpload, onRemove, uploading, isOpen, onToggle, readOnly, isLocked = () => false }) {
  const ro = (suffix) => readOnly || isLocked(`${prefix}_${suffix}`)
  // UG / PG / Diploma / MPhil / Others: Board / University is free text (no dropdown).
  const freeBoard = ['UG', 'PG', 'Diploma', 'MPhil', 'Others'].includes(boardType)
  const levelBoards = freeBoard ? [] : boards.filter(b => b.type === 'All' || b.type === boardType)
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
            <Input label="Institute Name" value={form[`${prefix}_institute_name`]} onChange={onChange(`${prefix}_institute_name`)} readOnly={ro('institute_name')} />
            {levelBoards.length > 0 ? (
              <Select label="Board / University" value={form[`${prefix}_board_university`]} onChange={onChange(`${prefix}_board_university`)} disabled={ro('board_university')}>
                <option value="">Select Board</option>
                {levelBoards.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
              </Select>
            ) : (
              <Input label="Board / University" placeholder="Type board / university name" value={form[`${prefix}_board_university`]} onChange={onChange(`${prefix}_board_university`)} readOnly={ro('board_university')} />
            )}
            <Input label="Passing Year" type="text" inputMode="numeric" maxLength={4} placeholder="2023" value={form[`${prefix}_passing_year`]} onChange={e => onChange(`${prefix}_passing_year`)({ target: { value: e.target.value.replace(/\D/g, '').slice(0, 4) } })} readOnly={ro('passing_year')} />
          </div>
          <div className="grid grid-cols-4 gap-4">
            <Input label="Obtained Marks" type="number" min="0"
              max={total > 0 ? total : undefined}
              value={form[`${prefix}_obtained_marks`]}
              onChange={onChange(`${prefix}_obtained_marks`)}
              error={marksError}
              readOnly={ro('obtained_marks')} />
            <Input label="Total Marks" type="number" min="0"
              value={form[`${prefix}_total_marks`]}
              onChange={onChange(`${prefix}_total_marks`)}
              readOnly={ro('total_marks')} />
            <Input
              label="Percentage (%)"
              value={percentage ? `${percentage}%` : ''}
              readOnly
              placeholder="Auto-calculated"
              className="bg-[#933d18]/5 text-[#933d18] font-bold cursor-not-allowed"
            />
            <FileField
              label="Marksheet (multiple allowed)"
              fieldKey={marksheetKey}
              accept="image/*,application/pdf"
              isImage={false}
              multiple
              value={form[marksheetKey]}
              onUpload={onUpload}
              onRemove={onRemove}
              isUploading={!!uploading[marksheetKey]}
              readOnly={ro('marksheet_url')}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function FileField({ label, fieldKey, accept, isImage, value, onUpload, onRemove, isUploading, readOnly, multiple }) {
  const urls = value ? String(value).split(',').filter(Boolean) : []
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-gray-600 ml-0.5">{label}</label>
      <div className="flex items-center gap-2 flex-wrap">
        {!readOnly && (
          <label className={`cursor-pointer flex items-center gap-2 px-3 py-2 border rounded-xl text-xs font-semibold transition-all
            ${isUploading ? 'border-gray-200 text-gray-400 cursor-not-allowed bg-gray-50' : 'border-[#933d18]/30 text-[#933d18] hover:bg-[#933d18]/5 bg-white'}`}>
            <Upload size={12} />
            {isUploading ? 'Uploading...' : (urls.length ? (multiple ? 'Add More' : 'Change') : (multiple ? 'Upload Files' : 'Upload'))}
            <input type="file" accept={accept} multiple={multiple} className="hidden" disabled={isUploading}
              onChange={e => {
                if (!e.target.files.length) return
                if (multiple) onUpload(fieldKey, Array.from(e.target.files), true)
                else onUpload(fieldKey, e.target.files[0])
                e.target.value = ''
              }} />
          </label>
        )}
        {urls[0] && isImage && (
          <img src={urls[0]} alt={label} className="h-10 w-10 object-cover rounded-lg border border-gray-200 shadow-sm" />
        )}
        {urls.map((u, i) => (
          <span key={i} className="flex items-center gap-1 pl-2 pr-1 py-1 bg-[#933d18]/5 border border-[#933d18]/15 rounded-lg">
            <a href={u} target="_blank" rel="noreferrer"
              className="flex items-center gap-1 text-xs font-semibold text-[#933d18] hover:underline">
              <Eye size={12} /> View{urls.length > 1 ? ` ${i + 1}` : ''}
            </a>
            {!readOnly && onRemove && (
              <button type="button" onClick={() => onRemove(fieldKey, i)} title="Remove"
                className="flex items-center justify-center w-4 h-4 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50">
                <X size={12} />
              </button>
            )}
          </span>
        ))}
        {!urls.length && <span className="text-xs text-gray-400 italic">{readOnly ? '—' : 'No file'}</span>}
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
  semester_year: '', academic_year: '', specialization: '',
  enrollment_no: '', admission_number: '', registration_no: '',
  login_password: '',
  bank_account_holder: '', bank_account_number: '', ifsc_code: '', bank_branch: '',
  status: 'Pending', remarks: '',
  student_name: '', date_of_birth: '', profession: '', gender: '', email: '',
  mobile_no: '', whatsapp_no: '', nationality: 'Indian',
  caste: '', religion: '', blood_group: '', height: '', mother_tongue: '',
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
  mphil_institute_name: '', mphil_board_university: '', mphil_passing_year: '', mphil_obtained_marks: '', mphil_total_marks: '',
  others_institute_name: '', others_board_university: '', others_passing_year: '', others_obtained_marks: '', others_total_marks: '',
  photo_url: '', aadhar_url: '', aadhar_back_url: '', signature_url: '', declaration_url: '',
  tenth_marksheet_url: '', twelfth_marksheet_url: '', ug_marksheet_url: '', pg_marksheet_url: '', diploma_marksheet_url: '', mphil_marksheet_url: '', others_marksheet_url: '',
  tc_url: '', migration_url: '',
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
  { id: 'sec-bank', label: 'Bank Details', icon: CreditCard },
  { id: 'sec-education', label: 'Education', icon: FileText },
  { id: 'sec-documents', label: 'Documents', icon: Upload },
]

function fmtDate(d) {
  if (!d) return ''
  return formatDate(d + 'T00:00:00')
}

// Maps each Document-Dept verify label (as written into the hold remark, "Label: detail"
// per line) back to the StudentForm field name(s) it refers to. Used as a fallback for
// students that were held before the structured correction_fields column existed, so
// per-field locking still works from the remark text alone.
const STUDENT_LABEL_TO_FORM_FIELDS = {
  // Program information
  'Program': ['department_id', 'programme_id'], 'Academic Session': ['session_id'],
  'Study Mode': ['mode_id'], 'Department': ['department_id', 'programme_id'],
  'Course Code': ['course_code'], 'Semester / Year': ['semester_year'],
  'Academic Year': ['academic_year'], 'Entry Type': ['entry_type'],
  // Personal details
  'Student Name': ['student_name'], 'Date of Birth': ['date_of_birth'], 'Gender': ['gender'],
  'Profession': ['profession'], 'Email': ['email'], 'Mobile No.': ['mobile_no'],
  'WhatsApp No.': ['whatsapp_no'], 'Nationality': ['nationality'], 'Caste': ['caste'],
  'Religion': ['religion'], 'Blood Group': ['blood_group'], 'Mother Tongue': ['mother_tongue'],
  'Physically Handicapped': ['physically_handicapped'], 'Aadhar Linked Mobile': ['aadhar_link_mobile'],
  'Aadhar Number': ['aadhar_no'], 'Identification Marks': ['identification_marks'],
  'Scholarship Applied': ['scholarship_applied'], 'PAN Number': ['pan_no'],
  // Family details
  "Father's Name": ['fathers_name'], "Father's Occupation": ['fathers_occupation'],
  "Mother's Name": ['mothers_name'], "Mother's Occupation": ['mothers_occupation'],
  'Guardian Name': ['guardian_name'], 'Guardian Occupation': ['guardian_occupation'],
  'Guardian Relation': ['guardian_relation'], 'Guardian Email': ['guardian_email'],
  'Guardian Mobile': ['guardian_mobile'],
  // Address labels are shared between Permanent & Present sections, so unlock both
  // (the structured correction_fields column resolves this precisely for new holds).
  'Village / Town': ['student_perm_village_town', 'student_pres_village_town'],
  'Landmark': ['student_perm_landmark', 'student_pres_landmark'],
  'Post Office': ['student_perm_post_office', 'student_pres_post_office'],
  'City': ['student_perm_city', 'student_pres_city'],
  'District': ['student_perm_district', 'student_pres_district'],
  'State': ['student_perm_state', 'student_pres_state'],
  'Pin Code': ['student_perm_pin_code', 'student_pres_pin_code'],
  // Documents
  'Student Photo': ['photo_url'], 'Signature': ['signature_url'], 'Aadhar Card': ['aadhar_url'],
  'Aadhar Front': ['aadhar_url'], 'Aadhar Back': ['aadhar_back_url'],
  'Declaration Form': ['declaration_url'], '10th Marksheet': ['tenth_marksheet_url'],
  '12th Marksheet': ['twelfth_marksheet_url'], 'UG Marksheet': ['ug_marksheet_url'],
  'PG Marksheet': ['pg_marksheet_url'], 'Diploma Marksheet': ['diploma_marksheet_url'],
  'MPhil Marksheet': ['mphil_marksheet_url'], 'Others Marksheet': ['others_marksheet_url'],
  'Transfer Certificate': ['tc_url'], 'Migration Certificate': ['migration_url'],
}

// Education rows are labelled "10th — <Institute>" etc, so map by the leading level token.
const STUDENT_EDU_LEVEL_FIELDS = {
  '10th': ['tenth_institute_name', 'tenth_board_university', 'tenth_passing_year', 'tenth_obtained_marks', 'tenth_total_marks', 'tenth_marksheet_url'],
  '12th': ['twelfth_institute_name', 'twelfth_board_university', 'twelfth_passing_year', 'twelfth_obtained_marks', 'twelfth_total_marks', 'twelfth_marksheet_url'],
  'UG': ['ug_institute_name', 'ug_board_university', 'ug_passing_year', 'ug_obtained_marks', 'ug_total_marks', 'ug_marksheet_url'],
  'PG': ['pg_institute_name', 'pg_board_university', 'pg_passing_year', 'pg_obtained_marks', 'pg_total_marks', 'pg_marksheet_url'],
  'Diploma': ['diploma_institute_name', 'diploma_board_university', 'diploma_passing_year', 'diploma_obtained_marks', 'diploma_total_marks', 'diploma_marksheet_url'],
  'MPhil': ['mphil_institute_name', 'mphil_board_university', 'mphil_passing_year', 'mphil_obtained_marks', 'mphil_total_marks', 'mphil_marksheet_url'],
  'Others': ['others_institute_name', 'others_board_university', 'others_passing_year', 'others_obtained_marks', 'others_total_marks', 'others_marksheet_url'],
}

// Parse a hold remark ("Label: detail" per line) into the set of StudentForm fields it flags.
function fieldsFromStudentRemark(remark) {
  if (!remark) return []
  const out = new Set()
  String(remark).split('\n').forEach(line => {
    const idx = line.indexOf(':')
    if (idx === -1) return
    const label = line.slice(0, idx).trim()
    if (STUDENT_LABEL_TO_FORM_FIELDS[label]) {
      STUDENT_LABEL_TO_FORM_FIELDS[label].forEach(f => out.add(f))
      return
    }
    // Education rows: "10th — <Institute>", "UG — <Institute>", etc.
    const level = Object.keys(STUDENT_EDU_LEVEL_FIELDS).find(lv => label === lv || label.startsWith(lv + ' '))
    if (level) STUDENT_EDU_LEVEL_FIELDS[level].forEach(f => out.add(f))
  })
  return [...out]
}

export default function StudentForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile, user } = useAuth()
  const role = profile?.role || user?.user_metadata?.role || 'admin'
  const isAdmin = role === 'admin'
  const isEdit = Boolean(id)
  const [form, setForm] = useState(emptyForm)
  // A center/super-center may edit their own student only while it is still
  // actionable on their side: freshly Pending, or sent back for correction
  // (Hold but not yet document-verified). Once it's forwarded to Account
  // (doc-verified), approved or rejected, the form is view-only for them.
  const ownerCanEdit = form.status === 'Pending' || (form.status === 'Hold' && !form.doc_verified_at)
  const isReadOnly = isEdit && !isAdmin && !ownerCanEdit
  // When a center resubmits a student sent back for correction (Hold + not yet
  // doc-verified), only the fields the Document Dept flagged may be edited — every
  // other field stays locked. The flagged list is stored on students.correction_fields.
  const correctionMode = isEdit && !isAdmin && form.status === 'Hold' && !form.doc_verified_at
  const correctionArr = correctionMode && Array.isArray(form.correction_fields) ? form.correction_fields : []
  // Fallback for students held before the structured correction_fields column existed:
  // recover the flagged fields from the remark text so locking still applies.
  const correctionFromRemark = correctionMode && correctionArr.length === 0 ? fieldsFromStudentRemark(form.remarks) : []
  const effectiveCorrection = correctionArr.length ? correctionArr : correctionFromRemark
  const correctionSet = effectiveCorrection.length ? new Set(effectiveCorrection) : null
  // A field is locked if we're in correction mode with a specific flagged list and
  // this field isn't on it. With no specific list, the whole form stays editable.
  const isLocked = (name) => !!correctionSet && !correctionSet.has(name)
  // Changing the Session resets Date of Submission/Admission (handleSessionChange),
  // so when Session is unlocked for correction these dates must unlock with it —
  // otherwise the cleared admission date can never be re-entered to pass validation.
  const isDateLocked = (name) => isLocked(name) && isLocked('session_id')
  const backPath = role === 'center' ? '/center/students' : role === 'super_center' ? '/super-center/students' : '/admin/students'

  const [universities, setUniversities] = useState([])
  const [programs, setPrograms] = useState([])
  const [programmeTypes, setProgrammeTypes] = useState([])
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
  const [openEdu, setOpenEdu] = useState({ tenth: true, twelfth: false, ug: false, pg: false, diploma: false, mphil: false, others: false })

  const [step, setStep] = useState(0)
  const activeStepRef = useRef(null)
  const [showPassword, setShowPassword] = useState(false)
  const [stepError, setStepError] = useState('')
  const [walletInfo, setWalletInfo] = useState({ checking: false, balance: 0, courseFee: 0, ok: null, checked: false, dueSem: 1, calendarActive: false })
  // A Staging (draft) center collects no fee at entry — the fee is charged from
  // the destination center only when the student is transferred/forwarded.
  const [isStagingCenter, setIsStagingCenter] = useState(false)
  const [coupon, setCoupon] = useState({ code: '', applying: false, applied: null, error: '', discount: 0 })
  const [availableCoupons, setAvailableCoupons] = useState([])
  // Program IDs that have a fee structure (admin) OR are allotted+approved to
  // this center (center/super-center). The Program Info dropdown only offers
  // these, so a student can't be admitted into a course with no fee set up.
  // null = not yet loaded (don't filter).
  const [feeProgramIds, setFeeProgramIds] = useState(null)

  const toggleEdu = (key) => setOpenEdu(prev => ({ ...prev, [key]: !prev[key] }))

  useEffect(() => {
    const main = document.querySelector('main')
    if (main) main.scrollTop = 0
    // Bring the active step fully into view inside the horizontal stepper
    // (otherwise the last steps get clipped at the right edge).
    activeStepRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [step])

  useEffect(() => {
    Promise.all([
      supabase.from('universities').select('id, university_name').order('university_name'),
      supabase.from('programs').select('id, program_name, course_code, department_id, programme_type_id, semester_year, duration, complete_duration').order('program_name'),
      supabase.from('departments').select('id, name').order('name'),
      supabase.from('centers').select('id, center_name, center_code').order('center_name'),
      supabase.from('academic_sessions').select('id, session_name, start_date, end_date, academic_year, status').order('session_name'),
      supabase.from('study_modes').select('id, mode_name').order('mode_name'),
      supabase.from('boards').select('id, name, type').order('name'),
      supabase.from('countries').select('id, country_name').order('country_name'),
      supabase.from('states').select('id, state_name, country_id').order('state_name'),
      supabase.from('districts').select('id, district_name, state_id').order('district_name'),
    ]).then(([unis, progs, depts, cents, sess, modes, bds, ctrs, sts, dists]) => {
      setUniversities(unis.data || [])
      setPrograms(progs.data || [])
      setDepartments(depts.data || [])
      // Programme types drive the minimum required prior education when a program
      // has no explicit required_education_level set. Loaded resiliently.
      supabase.from('programme_types').select('id, programme_type_name')
        .then(({ data }) => setProgrammeTypes(data || []))
      // Merge in required_education_level separately so a missing column (migration
      // not yet run) never breaks the program list. Silently skipped on error.
      supabase.from('programs').select('id, required_education_level').then(({ data, error }) => {
        if (error || !data) return
        const lvl = Object.fromEntries(data.map(p => [p.id, p.required_education_level]))
        setPrograms(prev => prev.map(p => ({ ...p, required_education_level: lvl[p.id] })))
      })
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
      // New student: auto-generate a login password (center-style). Editable below.
      if (!isEdit) {
        setForm(f => (f.login_password ? f : { ...f, login_password: genStudentPassword() }))
      }
      if (!isAdmin && user?.email && !isEdit) {
        supabase.from('centers').select('id, center_name, is_staging').eq('email', user.email).single()
          .then(({ data: cd }) => {
            if (cd) {
              setForm(f => ({ ...f, center_id: cd.id, center_name: cd.center_name }))
              setIsStagingCenter(!!cd.is_staging)
            }
          })
      }
    })
    if (isEdit) {
      supabase.from('students').select('*').eq('id', id).single()
        .then(async ({ data }) => {
          if (!data) return
          // Docs live in a private bucket; the stored URLs 404 unless converted
          // to short-lived signed URLs — otherwise the View links / previews break.
          const resolved = await resolveStudentDocUrls(data)
          setForm(prev => ({ ...prev, ...resolved }))
        })
    }
  }, [id])

  // Country is NOT a column on `students` (only state/district are stored), so
  // on edit the Country dropdown comes back empty ("Select Country") even
  // though it was picked at entry. Derive it from each address's saved state
  // (states carry a country_id) so the field shows what was chosen and keeps
  // the state list filtered correctly. Only fills an empty country — never
  // overrides a value the user picks in the dropdown.
  useEffect(() => {
    if (!isEdit || !states.length || !countries.length) return
    const countryById = Object.fromEntries(countries.map(c => [c.id, c.country_name]))
    const prefixes = ['student_perm', 'student_pres', 'guardian_pres', 'guardian_perm']
    setForm(f => {
      let changed = false
      const next = { ...f }
      for (const p of prefixes) {
        if (next[`${p}_country`]) continue
        const st = states.find(s => s.state_name === f[`${p}_state`])
        const cName = st?.country_id ? countryById[st.country_id] : ''
        if (cName) { next[`${p}_country`] = cName; changed = true }
      }
      return changed ? next : f
    })
  }, [isEdit, states, countries, form.student_perm_state, form.student_pres_state, form.guardian_pres_state, form.guardian_perm_state])

  // Auto wallet check when on step 1 and program/semester/center changes.
  // Skipped for a Staging center — no fee is collected there (charged on transfer).
  useEffect(() => {
    if (step === 1 && form.programme_id && form.center_id && !isAdmin && !isEdit && !isStagingCenter) {
      runWalletCheck()
    }
  }, [step, form.programme_id, form.session_id, form.date_of_submission, form.semester_year, form.center_id, isStagingCenter])

  // Load this center's unused coupons so they can be picked from a dropdown
  useEffect(() => {
    if (!form.center_id || isEdit) { setAvailableCoupons([]); return }
    supabase.from('coupons')
      .select('id, coupon_code, coupon_type, face_value, is_used, used_at, center_id')
      .eq('center_id', form.center_id)
      .then(({ data }) => {
        // Only unused DISCOUNT coupons — must be strictly coupon_type 'discount'
        // so it matches exactly what admin's Coupon Management shows. Legacy
        // coupons with a null coupon_type are NOT offered (they don't appear in
        // admin either), avoiding phantom codes the center can't reconcile.
        const avail = (data || []).filter(c => !c.is_used && !c.used_at && c.coupon_type === 'discount')
        setAvailableCoupons(avail)
      })
  }, [form.center_id])

  // Resolve which programs can be admitted into.
  //  • center  → courses APPROVED-allotted to this center in Fee Management →
  //    Center Courses, for the SELECTED session. Allotment is per program+session
  //    and admin-approval-gated, so a course approved only for June 2025 must not
  //    appear when admitting into June 2026 (where it may still be pending) or
  //    Jan 2027. Needs the resolved center_id.
  //  • admin / super-center → any program that has a fee structure in Fee
  //    Management (the full "courses added in the fee section").
  useEffect(() => {
    let cancelled = false
    async function loadFeePrograms() {
      if (role === 'center') {
        // center_id is resolved async (from the logged-in center's email); until
        // it's known, don't filter (null) rather than showing an empty list.
        if (!form.center_id) { if (!cancelled) setFeeProgramIds(null); return }
        // Embed program_id + session_id through the fee_structures FK in ONE
        // query. (A second .in('id', [...]) blew past the URL length limit once a
        // center had hundreds of allotted courses, so nothing came back.)
        const { data: cc } = await supabase.from('center_courses')
          .select('fee_structures(program_id, session_id)')
          .eq('center_id', form.center_id)
          .eq('status', 'approved')
        if (!cancelled) {
          let rows = (cc || []).map(r => r.fee_structures).filter(Boolean)
          // Once a session is chosen, only that session's approved courses apply.
          if (form.session_id) rows = rows.filter(r => r.session_id === form.session_id)
          setFeeProgramIds(new Set(rows.map(r => r.program_id).filter(Boolean)))
        }
        return
      }
      const { data } = await supabase.from('fee_structures').select('program_id')
      if (!cancelled) setFeeProgramIds(new Set((data || []).map(r => r.program_id).filter(Boolean)))
    }
    loadFeePrograms()
    return () => { cancelled = true }
  }, [role, form.center_id, form.session_id])

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }))
  // Numeric-only input, capped at `max` digits (strips everything else)
  const setDigits = (key, max) => (e) => setForm(f => ({ ...f, [key]: e.target.value.replace(/\D/g, '').slice(0, max) }))

  const ADDR_KEYS = ['village_town', 'landmark', 'post_office', 'city', 'pin_code', 'country', 'state', 'district']
  const copyAddress = (from, to) => setForm(f => {
    const next = { ...f }
    ADDR_KEYS.forEach(k => { next[`${to}_${k}`] = f[`${from}_${k}`] || '' })
    return next
  })

  // Quick-fill the guardian's name/occupation/relation from the father or the
  // mother. Locked fields (correction mode) are left untouched.
  const fillGuardianFrom = (who) => setForm(f => {
    const next = { ...f }
    if (!isLocked('guardian_name'))       next.guardian_name = who === 'father' ? f.fathers_name : f.mothers_name
    if (!isLocked('guardian_occupation')) next.guardian_occupation = who === 'father' ? f.fathers_occupation : f.mothers_occupation
    if (!isLocked('guardian_relation'))   next.guardian_relation = who === 'father' ? 'Father' : 'Mother'
    return next
  })

  const [pressSameAsPerm, setPressSameAsPerm] = useState(false)
  const [guardianPresSameAsStudent, setGuardianPresSameAsStudent] = useState(false)
  const [guardianPermSameAsPres, setGuardianPermSameAsPres] = useState(false)
  const [guardianPermSameAsStudentPerm, setGuardianPermSameAsStudentPerm] = useState(false)

  const handleDepartmentChange = (e) => {
    setForm(f => ({ ...f, department_id: e.target.value, programme_id: '', course_code: '', semester_year: '' }))
    setWalletInfo({ checking: false, balance: 0, courseFee: 0, ok: null, checked: false })
    setCoupon({ code: '', applying: false, applied: null, error: '', discount: 0 })
  }

  const handleProgramChange = (e) => {
    const prog = programs.find(p => p.id === e.target.value)
    // Default the Semester/Year to the program's entry point (Sem 1, or Sem 3 for
    // a lateral program) — this is what appears on the admission form.
    setForm(f => ({ ...f, programme_id: e.target.value, course_code: prog?.course_code || '', semester_year: prog ? entrySemLabel(prog) : '' }))
  }

  const handleSessionChange = (e) => {
    const sess = sessions.find(s => s.id === e.target.value)
    const today = new Date().toISOString().split('T')[0]
    let submissionDate = today
    if (sess?.start_date && sess?.end_date) {
      if (today < sess.start_date) submissionDate = sess.start_date
      else if (today > sess.end_date) submissionDate = sess.end_date
    }
    const yr = sessionYear(sess)
    setForm(f => ({
      ...f,
      session_id: e.target.value,
      academic_year: sess?.academic_year || sess?.session_name || f.academic_year,
      date_of_submission: submissionDate,
      date_of_admission: '',
      // Keep the admission number's year segment in sync with the session.
      admission_number: f.admission_number
        ? f.admission_number.replace(/^(ADM-)\d{4}(-)/, `$1${yr}$2`)
        : f.admission_number,
    }))
  }

  const selectedSession = sessions.find(s => s.id === form.session_id)
  const sessionMinDate = selectedSession?.start_date || ''
  const sessionMaxDate = selectedSession?.end_date || ''

  // The admission-number year follows the session: prefer the session start
  // year, then the first 4-digit year in the session name, else current year.
  function sessionYear(sess) {
    if (sess?.start_date) {
      const y = new Date(sess.start_date).getFullYear()
      if (y) return y
    }
    const m = (sess?.session_name || sess?.academic_year || '').match(/(\d{4})/)
    return m ? Number(m[1]) : new Date().getFullYear()
  }

  const filteredPrograms = (form.department_id
    ? programs.filter(p => p.department_id === form.department_id)
    : programs
  ).filter(p =>
    // Only courses that exist in the fee section (admin) / are approved for this
    // center. Keep the currently-selected program visible in edit mode even if
    // it later falls out of the set, so the dropdown still shows its value.
    feeProgramIds === null || feeProgramIds.has(p.id) || p.id === form.programme_id
  )

  // Only departments that have at least one allowed program (fee exists / approved
  // for this center). Keep the currently-selected department visible in edit mode.
  const allowedDeptIds = feeProgramIds === null
    ? null
    : new Set(programs.filter(p => feeProgramIds.has(p.id)).map(p => p.department_id))
  const filteredDepartments = departments.filter(d =>
    allowedDeptIds === null || allowedDeptIds.has(d.id) || d.id === form.department_id
  )

  const selectedProgram = programs.find(p => p.id === form.programme_id)
  const progSemYear = selectedProgram?.semester_year
  // PhD (Doctorate) programmes get an extra "Specialization" field on the
  // admission form; nothing else uses it.
  const isPhd = (programmeTypes.find(t => t.id === selectedProgram?.programme_type_id)?.programme_type_name || '')
    .toLowerCase().includes('doctorate')

  // Which prior education levels MUST be filled:
  //   1 = 10th, 2 = +12th, 3 = +UG, 4 = +PG, 5 = +MPhil. 0 = no requirement.
  // It is the MINIMUM ladder — the student may fill extra levels too.
  // Prefer the program's explicit required_education_level; when it isn't set
  // (the column is empty for almost every program), infer it from the programme
  // type so e.g. a Master's (MBA) still requires a UG / graduation.
  const EDU_LADDER = ['tenth', 'twelfth', 'ug', 'pg', 'mphil']
  const eduLevelFromType = (() => {
    const typeName = programmeTypes.find(t => t.id === selectedProgram?.programme_type_id)?.programme_type_name || ''
    const t = typeName.toLowerCase()
    if (t.includes('doctorate')) return 4                 // needs up to PG
    if (t.includes("master") || t.includes('pg diploma')) return 3  // needs up to UG
    if (t.includes("bachelor") || t.includes('integrated')) return 2 // needs up to 12th
    return 0                                              // Certificate/Diploma/etc: no fixed minimum
  })()
  const requiredEduLevels = (() => {
    const explicit = parseInt(selectedProgram?.required_education_level, 10) || 0
    const lvl = explicit > 0 ? explicit : eduLevelFromType
    return lvl > 0 ? EDU_LADDER.slice(0, lvl) : []
  })()
  const EDU_LEVEL_LABEL = { tenth: '10th', twelfth: '12th', ug: 'UG (Graduation)', pg: 'PG (Post Graduation)', mphil: 'MPhil' }
  const isEduComplete = (pfx) => !!(
    String(form[`${pfx}_institute_name`] || '').trim() &&
    String(form[`${pfx}_board_university`] || '').trim() &&
    String(form[`${pfx}_passing_year`] || '').trim() &&
    String(form[`${pfx}_obtained_marks`] || '').trim() &&
    String(form[`${pfx}_total_marks`] || '').trim()
  )

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

  // The admission ENTRY semester (what shows on the form / download): a regular
  // program starts at Sem 1; a lateral-entry program starts at Sem 3.
  const isLateralProgram = (prog) => {
    const typeName = programmeTypes.find(t => t.id === prog?.programme_type_id)?.programme_type_name || ''
    return /lateral/i.test(typeName) || /lateral/i.test(prog?.program_name || '')
  }
  const entrySemLabel = (prog) => {
    const n = isLateralProgram(prog) ? 3 : 1
    return prog?.semester_year === 'Year' ? `${ordinal(Math.ceil(n / 2))} Year` : `${ordinal(n)} Semester`
  }
  // Entry semester is fixed by the program, so lock the field for center entries.
  const semesterLocked = !isAdmin && !isEdit && !!form.programme_id

  // `append` (used by multi-file fields like marksheets) keeps existing uploads
  // and stores all URLs comma-joined in the same column; otherwise it replaces.
  async function handleFileUpload(fieldKey, fileOrFiles, append = false) {
    const files = Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles]
    if (!files.length) return
    setUploading(u => ({ ...u, [fieldKey]: true }))
    try {
      const urls = []
      for (const file of files) {
        const ext = file.name.split('.').pop()
        const path = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${fieldKey}.${ext}`
        const { error } = await supabase.storage.from('student-docs').upload(path, file, { upsert: true })
        if (error) throw error
        const { data: { publicUrl } } = supabase.storage.from('student-docs').getPublicUrl(path)
        urls.push(publicUrl)
      }
      setForm(f => {
        const prev = append && f[fieldKey] ? String(f[fieldKey]).split(',').filter(Boolean) : []
        return { ...f, [fieldKey]: [...prev, ...urls].join(',') }
      })
    } catch (err) {
      alert('Upload failed: ' + err.message)
    }
    setUploading(u => ({ ...u, [fieldKey]: false }))
  }

  // Remove one uploaded file (by index) from a field's comma-joined URL list.
  function removeFileUrl(fieldKey, index) {
    setForm(f => {
      const urls = String(f[fieldKey] || '').split(',').filter(Boolean)
      urls.splice(index, 1)
      return { ...f, [fieldKey]: urls.join(',') }
    })
  }

  async function generateAdmissionNumber() {
    const { count } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true })
      .not('admission_number', 'is', null)
      .neq('admission_number', '')
    const year = sessionYear(sessions.find(s => s.id === form.session_id))
    const num = String((count || 0) + 1).padStart(5, '0')
    return `ADM-${year}-${num}`
  }

  async function runWalletCheck() {
    setWalletInfo(w => ({ ...w, checking: true }))
    try {
      // Shared source of truth so the entry fee here exactly matches the fee held
      // at forward (StudentListReport) and collected at Account Dept.
      const { courseFee, dueSem, calendarActive } = await computeCumulativeCourseFee({
        programme_id: form.programme_id,
        session_id: form.session_id,
        semester_year: form.semester_year,
        semYear: progSemYear,
        duration: progDuration,
      })

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
      setWalletInfo({ checking: false, balance, courseFee, ok, checked: true, dueSem, calendarActive })
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
      // coupon_type distinguishes 'approval' codes from 'discount' coupons.
      // Fall back gracefully if the column hasn't been migrated yet.
      let rows = null
      const withType = await supabase
        .from('coupons')
        .select('id, coupon_code, face_value, is_used, used_at, center_id, coupon_type')
        .eq('center_id', form.center_id)
      if (withType.error) {
        const plain = await supabase
          .from('coupons')
          .select('id, face_value, is_used, used_at, center_id')
          .eq('center_id', form.center_id)
        rows = plain.data
      } else {
        rows = withType.data
      }
      const match = (rows || []).find(
        r => !r.is_used && !r.used_at
          && r.coupon_type === 'discount'
          // Match the code the center actually sees: the real coupon_code (as in
          // admin), falling back to the id prefix only for legacy coupons.
          && (r.coupon_code || r.id?.slice(0, 8).toUpperCase() || '').toUpperCase() === code
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
        if (isPhd && !form.specialization.trim()) return 'Specialization is required for Ph.D'
        return null
      case 2:
        if (!form.student_name.trim()) return 'Student Name is required'
        if (!form.date_of_birth) return 'Date of Birth is required'
        if (!form.profession) return 'Please select Profession'
        if (!form.gender) return 'Please select Gender'
        if (!form.email.trim()) return 'Email is required'
        if (!form.mobile_no.trim()) return 'Mobile Number is required'
        if (form.mobile_no.length !== 10) return 'Mobile Number must be 10 digits'
        if (!form.whatsapp_no.trim()) return 'WhatsApp Number is required'
        if (form.whatsapp_no.length !== 10) return 'WhatsApp Number must be 10 digits'
        if (!String(form.nationality || '').trim()) return 'Please select Nationality'
        if (!form.caste) return 'Please select Caste'
        if (!form.religion.trim()) return 'Religion is required'
        if (!form.mother_tongue.trim()) return 'Mother Tongue is required'
        if (!form.aadhar_link_mobile.trim()) return 'Aadhar Link Mobile is required'
        if (form.aadhar_link_mobile.length !== 10) return 'Aadhar Link Mobile must be 10 digits'
        if (!form.aadhar_no.trim()) return 'Aadhar Number is required'
        if (form.aadhar_no.length !== 12) return 'Aadhar Number must be 12 digits'
        return null
      case 3:
        if (!form.fathers_name.trim()) return "Father's Name is required"
        if (!form.fathers_occupation.trim()) return "Father's Occupation is required"
        if (!form.mothers_name.trim()) return "Mother's Name is required"
        if (!form.mothers_occupation.trim()) return "Mother's Occupation is required"
        if (!form.guardian_name.trim()) return "Guardian's Name is required"
        if (!form.guardian_occupation.trim()) return "Guardian's Occupation is required"
        if (!form.guardian_relation.trim()) return 'Relation is required'
        if (!form.guardian_email.trim()) return 'Guardian Email Id is required'
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.guardian_email.trim())) return 'Guardian Email Id must be a valid email (e.g. name@example.com)'
        if (form.guardian_mobile && form.guardian_mobile.length !== 10) return 'Guardian Mobile No must be 10 digits'
        return null
      case 4: {
        // Student Permanent Address: every field is mandatory.
        const permReq = [
          ['village_town', 'Village / Town / Locality'],
          ['landmark', 'Landmark'],
          ['post_office', 'Post Office'],
          ['city', 'City'],
          ['pin_code', 'PIN Code'],
          ['country', 'Country'],
          ['state', 'State'],
          ['district', 'District'],
        ]
        for (const [suf, lbl] of permReq) {
          if (!String(form[`student_perm_${suf}`] || '').trim()) return `Student Permanent Address: ${lbl} is required`
        }
        for (const p of ['student_perm', 'student_pres', 'guardian_pres', 'guardian_perm']) {
          const pin = form[`${p}_pin_code`]
          if (pin && pin.length !== 6) return 'PIN Code must be 6 digits'
        }
        return null
      }
      // case 5 = Bank Details — all fields optional, no validation needed.
      case 6: {
        // Education: require prior levels based on the program level.
        for (const lv of requiredEduLevels) {
          if (!isEduComplete(lv)) {
            return `Please complete ${EDU_LEVEL_LABEL[lv]} education details (Institute, Board, Passing Year, Obtained & Total Marks) before continuing.`
          }
        }
        // Passing Year: wherever entered, must be a 4-digit year not later than now.
        const thisYear = new Date().getFullYear()
        for (const pfx of ['tenth', 'twelfth', 'ug', 'pg', 'diploma', 'mphil', 'others']) {
          const yr = String(form[`${pfx}_passing_year`] || '').trim()
          if (!yr) continue
          if (!/^\d{4}$/.test(yr) || Number(yr) > thisYear) {
            return `Passing Year must be a valid 4-digit year not later than ${thisYear}`
          }
        }
        return null
      }
      case 7:
        if (!form.photo_url) return 'Student Photo is required'
        if (!form.signature_url) return 'Signature is required'
        if (!form.aadhar_url) return 'Aadhar Front is required'
        if (!form.aadhar_back_url) return 'Aadhar Back is required'
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

    // Staging center collects no fee at entry, so skip the wallet gate entirely.
    if (step === 1 && !isAdmin && !isEdit && !isStagingCenter) {
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

    const eduPrefixes = ['tenth', 'twelfth', 'ug', 'pg', 'diploma', 'mphil', 'others']
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
    // A student that was sent back for correction (Hold + not yet doc-verified)
    // re-enters the Document Dept queue as Pending once it is resubmitted.
    if (isEdit && form.status === 'Hold' && !form.doc_verified_at) payload.status = 'Pending'
    // NOTE: registration_no is intentionally NOT generated at submission.
    // It is assigned later by the Account Dept after account verification, at
    // the same time the student is enrolled (enrollment_no). On submit, only the
    // admission number below is issued.
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

    const saveStudent = (p) => isEdit
      ? supabase.from('students').update(p).eq('id', id).select('id').single()
      : supabase.from('students').insert(p).select('id').single()
    let { data: saved, error } = await saveStudent(payload)
    // Resilient: if a not-yet-migrated column shows up in the error, drop it and
    // retry so saving still works (that field just isn't persisted). Covers
    // aadhar_back_url and specialization (add_student_specialization.sql).
    if (error && /aadhar_back_url|specialization/.test(error.message || '')) {
      const clean = { ...payload }
      if (/aadhar_back_url/.test(error.message || '')) delete clean.aadhar_back_url
      if (/specialization/.test(error.message || '')) delete clean.specialization
      ;({ data: saved, error } = await saveStudent(clean))
    }

    if (!error) {
      // NOTE: The wallet is NOT charged on submission any more. The center
      // only needs 50% of the course fee available (checked above) to submit.
      // The actual fee is deducted in full by the Account Dept after the
      // Document Dept verifies the application. We still reserve the coupon
      // here (mark it used + link it to this application) so the Account Dept
      // can apply its discount when it collects the fee.
      // Mark the coupon used + link it to this application via a SECURITY
      // DEFINER RPC (the center role can't UPDATE the coupons table directly
      // under RLS). reserve_coupon() returns true only if it actually flipped
      // a still-unused coupon — false means someone else (another student
      // submitted moments earlier) already claimed it. Only keep the discount
      // on this student's record when the reservation truly succeeded, so a
      // coupon can never be applied to two students.
      let couponReserveFailed = false
      if (!isEdit && coupon.applied?.id) {
        // Mark the coupon used. The center role can't UPDATE coupons under
        // RLS, so use the service-role admin client. The `is_used=false`
        // guard makes it atomic: only the first student to claim a
        // still-unused coupon flips it — a second claim updates 0 rows and
        // fails, so a coupon can never be applied to two students.
        // NOTE: application_id is intentionally NOT written here —
        // coupons.application_id has a FK to center_applications (not
        // students), so writing a students.id into it fails with 23503 and
        // made every reservation error out (the false "coupon already used"
        // alert). The student linkage lives on the student row itself
        // (coupon_code / coupon_discount below), which is what the Account
        // Dept reads at fee collection.
        const db = supabaseAdmin || supabase
        const { data: reserved, error: reserveErr } = await db.from('coupons')
          .update({ is_used: true, used_at: new Date().toISOString() })
          .eq('id', coupon.applied.id).eq('is_used', false).select('id')
        couponReserveFailed = !!reserveErr || !reserved || reserved.length === 0
      }
      // Persist (or clear) the discount on the student row itself. The center
      // always has write access to its own student records, so this survives
      // even if RLS blocks the center from updating the coupons table —
      // letting the Account Dept apply the discount reliably at fee
      // collection. Best-effort: if the migration (add_student_coupon_discount.sql)
      // hasn't run, the unknown-column error is ignored and the insert above still stands.
      if (!isEdit && saved?.id) {
        await supabase.from('students')
          .update({
            coupon_discount: (coupon.applied && !couponReserveFailed) ? (coupon.discount || 0) : null,
            coupon_code: (coupon.applied && !couponReserveFailed) ? coupon.code.trim().toUpperCase() : null,
          })
          .eq('id', saved.id)
      }
      if (couponReserveFailed) {
        alert('This coupon was already used (by another student submitted just now) and could not be applied. The student has been saved WITHOUT the discount — please collect the full fee.')
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

      {/* Correction-mode banner — only the flagged fields are editable */}
      {correctionMode && correctionSet && (
        <div className="mt-4 mb-2 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Sent back for correction — only the requested fields can be edited.</p>
            {form.remarks && <p className="text-xs text-amber-600 mt-1 whitespace-pre-line">{form.remarks}</p>}
          </div>
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
                    ref={isActive ? activeStepRef : null}
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
              <Select label="Session *" value={form.session_id} onChange={handleSessionChange} disabled={isReadOnly || isLocked('session_id')} required>
                <option value="">Select Session</option>
                {sessions
                  // Inactive sessions are hidden for new entries, but keep the one
                  // already saved on this student so an edited record still shows it.
                  .filter(s => (s.status || 'Active').toLowerCase() !== 'inactive' || s.id === form.session_id)
                  .map(s => <option key={s.id} value={s.id}>{s.session_name}</option>)}
              </Select>
              <Select label="Mode *" value={form.mode_id} onChange={set('mode_id')} disabled={isReadOnly || isLocked('mode_id')} required>
                <option value="">Select Mode</option>
                {studyModes.map(m => <option key={m.id} value={m.id}>{m.mode_name}</option>)}
              </Select>
              <Select label="Entry Type *" value={form.entry_type} onChange={set('entry_type')} disabled={isReadOnly || isLocked('entry_type')}>
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
                readOnly={isReadOnly || isDateLocked('date_of_submission')}
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
                readOnly={isReadOnly || isDateLocked('date_of_admission')}
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
                  disabled={isReadOnly || isLocked('department_id')}
                  options={filteredDepartments.map(d => ({ id: d.id, label: d.name }))}
                />
                <SearchSelect
                  label="Program Name *"
                  placeholder="Select Program"
                  value={form.programme_id}
                  onChange={handleProgramChange}
                  disabled={isReadOnly || isLocked('department_id')}
                  options={filteredPrograms.map(p => ({ id: p.id, label: p.program_name }))}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Input label="Course Code" value={form.course_code} onChange={set('course_code')} readOnly={isReadOnly || isLocked('course_code')} />
                <Select label={semesterLocked ? 'Semester / Year * (entry semester)' : 'Semester / Year *'} value={form.semester_year} onChange={set('semester_year')} disabled={isReadOnly || isLocked('semester_year') || semesterLocked} required>
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
              {/* Specialization — PhD (Doctorate) programmes only. */}
              {isPhd && (
                <div className="grid grid-cols-1 gap-4">
                  <Input label="Specialization (Ph.D) *" placeholder="e.g. Organic Chemistry, Machine Learning"
                    value={form.specialization} onChange={set('specialization')}
                    readOnly={isReadOnly || isLocked('specialization')} />
                </div>
              )}
              {/* Only the Admission Number is issued at the admission step.
                  Enrollment No (and Registration No) are assigned later by the
                  Account Dept after account verification, so they are not shown
                  on the admission form. */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

            {/* Staging center: no fee at entry — charged on transfer. */}
            {!isAdmin && !isEdit && isStagingCenter && (
              <div className="mt-2 flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700">
                <Wallet size={16} className="text-blue-500" />
                <span>Staging center — no fee is charged here. The fee is held from the destination center when this student is transferred &amp; forwarded.</span>
              </div>
            )}

            {/* Wallet check panel */}
            {!isAdmin && !isEdit && !isStagingCenter && (
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
                        <p className="text-sm font-bold text-gray-800">
                          Wallet Balance Check
                          {walletInfo.calendarActive && walletInfo.dueSem > 0 && (
                            <span className="ml-2 text-[11px] font-semibold text-[#933d18]">
                              · Fee for Sem 1–{walletInfo.dueSem} (per exam calendar)
                            </span>
                          )}
                        </p>
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

            {/* Coupon apply — Admin (no wallet gate). Reserves the coupon so the
                Account Dept applies its discount when it collects the fee. */}
            {isAdmin && !isEdit && form.center_id && form.programme_id && (
              <div className="mt-3">
                <label className="text-xs font-semibold text-gray-600 mb-1.5 block">Apply Coupon (optional)</label>
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
                <p className="text-[11px] text-gray-400 mt-1.5 px-1">The coupon discount is deducted from the fee when the Account Dept enrolls this student.</p>
              </div>
            )}
          </>
        )}

        {/* STEP 2: Personal Information */}
        {step === 2 && (
          <FormSection title="Personal Information" icon={<User size={16} />}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Student Name *" value={form.student_name} onChange={set('student_name')} required readOnly={isReadOnly || isLocked('student_name')} />
              <DateInput label="Date of Birth *" value={form.date_of_birth} onChange={set('date_of_birth')} required readOnly={isReadOnly || isLocked('date_of_birth')} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Select label="Profession *" value={form.profession} onChange={set('profession')} disabled={isReadOnly || isLocked('profession')} required>
                <option value="">Select</option>
                {PROFESSION_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </Select>
              <Select label="Gender *" value={form.gender} onChange={set('gender')} disabled={isReadOnly || isLocked('gender')} required>
                <option value="">Select</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Others">Others</option>
              </Select>
              <Input label="Email Id *" type="email" value={form.email} onChange={set('email')} required readOnly={isReadOnly || isLocked('email')} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input label="Mobile No *" type="tel" inputMode="numeric" maxLength={10} placeholder="10-digit mobile" value={form.mobile_no} onChange={setDigits('mobile_no', 10)} required readOnly={isReadOnly || isLocked('mobile_no')} />
              <Input label="WhatsApp No *" type="tel" inputMode="numeric" maxLength={10} placeholder="10-digit number" value={form.whatsapp_no} onChange={setDigits('whatsapp_no', 10)} required readOnly={isReadOnly || isLocked('whatsapp_no')} />
              {countries.length > 0 ? (
                <Select label="Nationality *" value={form.nationality} onChange={set('nationality')} disabled={isReadOnly || isLocked('nationality')} required>
                  <option value="">Select Country</option>
                  {countries.map(c => <option key={c.id} value={c.country_name}>{c.country_name}</option>)}
                </Select>
              ) : (
                <Input label="Nationality *" value={form.nationality} onChange={set('nationality')} required readOnly={isReadOnly || isLocked('nationality')} />
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Select label="Caste *" value={form.caste} onChange={set('caste')} disabled={isReadOnly || isLocked('caste')} required>
                <option value="">Select</option>
                {CASTE_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
              <Input label="Religion *" value={form.religion} onChange={set('religion')} required readOnly={isReadOnly || isLocked('religion')} />
              <Input label="Blood Group" placeholder="A+, B-, O+" value={form.blood_group} onChange={set('blood_group')} readOnly={isReadOnly || isLocked('blood_group')} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input label="Mother Tongue *" value={form.mother_tongue} onChange={set('mother_tongue')} required readOnly={isReadOnly || isLocked('mother_tongue')} />
              <Select label="Physically Handicapped *" value={form.physically_handicapped} onChange={set('physically_handicapped')} disabled={isReadOnly || isLocked('physically_handicapped')}>
                <option value="No">No</option>
                <option value="Yes">Yes</option>
              </Select>
              <Input label="Aadhar Link Mobile *" type="tel" inputMode="numeric" maxLength={10} placeholder="10-digit mobile" value={form.aadhar_link_mobile} onChange={setDigits('aadhar_link_mobile', 10)} required readOnly={isReadOnly || isLocked('aadhar_link_mobile')} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input label="Aadhar No *" inputMode="numeric" maxLength={12} placeholder="12-digit Aadhar" value={form.aadhar_no} onChange={setDigits('aadhar_no', 12)} required readOnly={isReadOnly || isLocked('aadhar_no')} />
              <Input label="PAN No" placeholder="ABCDE1234F" value={form.pan_no} onChange={set('pan_no')} readOnly={isReadOnly || isLocked('pan_no')} />
              <Select label="Scholarship Applied *" value={form.scholarship_applied} onChange={set('scholarship_applied')} disabled={isReadOnly || isLocked('scholarship_applied')}>
                {SCHOLARSHIP_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input label="Height" placeholder="e.g. 5'7&quot; or 170 cm" value={form.height} onChange={set('height')} readOnly={isReadOnly || isLocked('height')} />
              <div className="sm:col-span-2">
                <Input label="Identification Marks" placeholder="Any visible identification marks..." value={form.identification_marks} onChange={set('identification_marks')} readOnly={isReadOnly || isLocked('identification_marks')} />
              </div>
            </div>
          </FormSection>
        )}

        {/* STEP 3: Family Information */}
        {step === 3 && (
          <FormSection title="Family Information" icon={<Users size={16} />}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Father's Name *" value={form.fathers_name} onChange={set('fathers_name')} required readOnly={isReadOnly || isLocked('fathers_name')} />
              <Input label="Father's Occupation *" value={form.fathers_occupation} onChange={set('fathers_occupation')} required readOnly={isReadOnly || isLocked('fathers_occupation')} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Mother's Name *" value={form.mothers_name} onChange={set('mothers_name')} required readOnly={isReadOnly || isLocked('mothers_name')} />
              <Input label="Mother's Occupation *" value={form.mothers_occupation} onChange={set('mothers_occupation')} required readOnly={isReadOnly || isLocked('mothers_occupation')} />
            </div>
            {!isReadOnly && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-gray-400">Quick-fill guardian:</span>
                <button type="button" onClick={() => fillGuardianFrom('father')}
                  className="text-xs font-semibold text-[#933d18] bg-[#933d18]/8 hover:bg-[#933d18]/15 px-3 py-1.5 rounded-lg transition-colors">
                  Same as Father
                </button>
                <button type="button" onClick={() => fillGuardianFrom('mother')}
                  className="text-xs font-semibold text-[#933d18] bg-[#933d18]/8 hover:bg-[#933d18]/15 px-3 py-1.5 rounded-lg transition-colors">
                  Same as Mother
                </button>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input label="Guardian's Name *" value={form.guardian_name} onChange={set('guardian_name')} required readOnly={isReadOnly || isLocked('guardian_name')} />
              <Input label="Guardian's Occupation *" value={form.guardian_occupation} onChange={set('guardian_occupation')} required readOnly={isReadOnly || isLocked('guardian_occupation')} />
              <Input label="Relation *" placeholder="E.g. Uncle, Elder Brother" value={form.guardian_relation} onChange={set('guardian_relation')} required readOnly={isReadOnly || isLocked('guardian_relation')} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Guardian Email Id *" type="email" value={form.guardian_email} onChange={set('guardian_email')} readOnly={isReadOnly || isLocked('guardian_email')} />
              <Input label="Guardian Mobile No" type="tel" inputMode="numeric" maxLength={10} placeholder="10-digit mobile" value={form.guardian_mobile} onChange={setDigits('guardian_mobile', 10)} readOnly={isReadOnly || isLocked('guardian_mobile')} />
            </div>
          </FormSection>
        )}

        {/* STEP 4: Contact Information */}
        {step === 4 && (
          <FormSection title="Contact Information" icon={<MapPin size={16} />}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AddressBlock prefix="student_perm" label="Student Permanent Address" requireAll
                form={form} onChange={set} onChangeDigits={setDigits} setForm={setForm} countries={countries} states={states} districts={districts} readOnly={isReadOnly} isLocked={isLocked} />
              <AddressBlock prefix="student_pres" label="Student Present Address"
                form={form} onChange={set} onChangeDigits={setDigits} setForm={setForm} countries={countries} states={states} districts={districts} readOnly={isReadOnly} isLocked={isLocked}
                sameAsOptions={[{
                  label: 'Same as Permanent Address',
                  checked: pressSameAsPerm,
                  onCopy: () => copyAddress('student_perm', 'student_pres'),
                  onToggle: v => setPressSameAsPerm(v),
                }]} />
              <AddressBlock prefix="guardian_pres" label="Guardian Present Address"
                form={form} onChange={set} onChangeDigits={setDigits} setForm={setForm} countries={countries} states={states} districts={districts} readOnly={isReadOnly} isLocked={isLocked}
                sameAsOptions={[{
                  label: "Same as Student's Present Address",
                  checked: guardianPresSameAsStudent,
                  onCopy: () => copyAddress('student_pres', 'guardian_pres'),
                  onToggle: v => setGuardianPresSameAsStudent(v),
                }]} />
              <AddressBlock prefix="guardian_perm" label="Guardian Permanent Address"
                form={form} onChange={set} onChangeDigits={setDigits} setForm={setForm} countries={countries} states={states} districts={districts} readOnly={isReadOnly} isLocked={isLocked}
                sameAsOptions={[
                  {
                    label: 'Same as Guardian Present Address',
                    checked: guardianPermSameAsPres,
                    onCopy: () => copyAddress('guardian_pres', 'guardian_perm'),
                    onToggle: v => { setGuardianPermSameAsPres(v); if (v) setGuardianPermSameAsStudentPerm(false) },
                  },
                  {
                    label: "Same as Student's Permanent Address",
                    checked: guardianPermSameAsStudentPerm,
                    onCopy: () => copyAddress('student_perm', 'guardian_perm'),
                    onToggle: v => { setGuardianPermSameAsStudentPerm(v); if (v) setGuardianPermSameAsPres(false) },
                  },
                ]} />
            </div>
          </FormSection>
        )}

        {/* STEP 5: Bank Account Details */}
        {step === 5 && (
          <FormSection title="Bank Account Details" icon={<CreditCard size={16} />}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="Account Holder Name" value={form.bank_account_holder || ''} onChange={set('bank_account_holder')} readOnly={isReadOnly || isLocked('bank_account_holder')} />
              <Input label="Account Number" value={form.bank_account_number || ''} onChange={set('bank_account_number')} readOnly={isReadOnly || isLocked('bank_account_number')} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="IFSC Code" value={form.ifsc_code || ''} onChange={set('ifsc_code')} readOnly={isReadOnly || isLocked('ifsc_code')} />
              <Input label="Bank Branch" value={form.bank_branch || ''} onChange={set('bank_branch')} readOnly={isReadOnly || isLocked('bank_branch')} />
            </div>
          </FormSection>
        )}

        {/* STEP 6: Education Qualification */}
        {step === 6 && (
          <FormSection title="Education Qualification" icon={<FileText size={16} />}
            subtitle="Click on each level to expand and fill details">
            <div className="space-y-2">
              <EduRow prefix="tenth" label="10th / SSC / Matric" boardType="10th" boards={boards} form={form} onChange={set} onUpload={handleFileUpload} onRemove={removeFileUrl} uploading={uploading} isOpen={openEdu.tenth} onToggle={() => toggleEdu('tenth')} readOnly={isReadOnly} isLocked={isLocked} />
              <EduRow prefix="twelfth" label="12th / HSC / Intermediate" boardType="12th" boards={boards} form={form} onChange={set} onUpload={handleFileUpload} onRemove={removeFileUrl} uploading={uploading} isOpen={openEdu.twelfth} onToggle={() => toggleEdu('twelfth')} readOnly={isReadOnly} isLocked={isLocked} />
              <EduRow prefix="ug" label="UG (Graduation)" boardType="UG" boards={boards} form={form} onChange={set} onUpload={handleFileUpload} onRemove={removeFileUrl} uploading={uploading} isOpen={openEdu.ug} onToggle={() => toggleEdu('ug')} readOnly={isReadOnly} isLocked={isLocked} />
              <EduRow prefix="pg" label="PG (Post Graduation)" boardType="PG" boards={boards} form={form} onChange={set} onUpload={handleFileUpload} onRemove={removeFileUrl} uploading={uploading} isOpen={openEdu.pg} onToggle={() => toggleEdu('pg')} readOnly={isReadOnly} isLocked={isLocked} />
              <EduRow prefix="diploma" label="Diploma / Polytechnic" boardType="Diploma" boards={boards} form={form} onChange={set} onUpload={handleFileUpload} onRemove={removeFileUrl} uploading={uploading} isOpen={openEdu.diploma} onToggle={() => toggleEdu('diploma')} readOnly={isReadOnly} isLocked={isLocked} />
              <EduRow prefix="mphil" label="MPhil" boardType="MPhil" boards={boards} form={form} onChange={set} onUpload={handleFileUpload} onRemove={removeFileUrl} uploading={uploading} isOpen={openEdu.mphil} onToggle={() => toggleEdu('mphil')} readOnly={isReadOnly} isLocked={isLocked} />
              <EduRow prefix="others" label="Others" boardType="Others" boards={boards} form={form} onChange={set} onUpload={handleFileUpload} onRemove={removeFileUrl} uploading={uploading} isOpen={openEdu.others} onToggle={() => toggleEdu('others')} readOnly={isReadOnly} isLocked={isLocked} />
            </div>
          </FormSection>
        )}

        {/* STEP 7: Documents */}
        {step === 7 && (
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
                <FileField label="Student Photo *" fieldKey="photo_url" accept="image/*" isImage value={form.photo_url} onUpload={handleFileUpload} onRemove={removeFileUrl} isUploading={!!uploading.photo_url} readOnly={isReadOnly || isLocked('photo_url')} />
              </div>
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 flex flex-col gap-3 items-center">
                {form.signature_url
                  ? <img src={form.signature_url} alt="Signature" className="h-24 w-24 object-contain rounded-xl border-2 border-[#933d18]/20 shadow bg-white" />
                  : <div className="h-24 w-24 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center bg-white">
                      <FileText size={28} className="text-gray-300" />
                    </div>
                }
                <FileField label="Signature *" fieldKey="signature_url" accept="image/*" isImage value={form.signature_url} onUpload={handleFileUpload} onRemove={removeFileUrl} isUploading={!!uploading.signature_url} readOnly={isReadOnly || isLocked('signature_url')} />
              </div>
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 flex flex-col gap-3">
                <p className="text-xs font-semibold text-gray-500">Aadhar Front *</p>
                <FileField label="" fieldKey="aadhar_url" accept="image/*,application/pdf" isImage={false} value={form.aadhar_url} onUpload={handleFileUpload} onRemove={removeFileUrl} isUploading={!!uploading.aadhar_url} readOnly={isReadOnly || isLocked('aadhar_url')} />
              </div>
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 flex flex-col gap-3">
                <p className="text-xs font-semibold text-gray-500">Aadhar Back *</p>
                <FileField label="" fieldKey="aadhar_back_url" accept="image/*,application/pdf" isImage={false} value={form.aadhar_back_url} onUpload={handleFileUpload} onRemove={removeFileUrl} isUploading={!!uploading.aadhar_back_url} readOnly={isReadOnly || isLocked('aadhar_back_url')} />
              </div>
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 flex flex-col gap-3">
                <p className="text-xs font-semibold text-gray-500">Declaration Form *</p>
                <FileField label="" fieldKey="declaration_url" accept="image/*,application/pdf" isImage={false} value={form.declaration_url} onUpload={handleFileUpload} onRemove={removeFileUrl} isUploading={!!uploading.declaration_url} readOnly={isReadOnly || isLocked('declaration_url')} />
              </div>
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 flex flex-col gap-3">
                <p className="text-xs font-semibold text-gray-500">Transfer Certificate (TC)</p>
                <FileField label="" fieldKey="tc_url" accept="image/*,application/pdf" isImage={false} value={form.tc_url} onUpload={handleFileUpload} onRemove={removeFileUrl} isUploading={!!uploading.tc_url} readOnly={isReadOnly || isLocked('tc_url')} />
              </div>
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 flex flex-col gap-3">
                <p className="text-xs font-semibold text-gray-500">Migration Certificate</p>
                <FileField label="" fieldKey="migration_url" accept="image/*,application/pdf" isImage={false} value={form.migration_url} onUpload={handleFileUpload} onRemove={removeFileUrl} isUploading={!!uploading.migration_url} readOnly={isReadOnly || isLocked('migration_url')} />
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
