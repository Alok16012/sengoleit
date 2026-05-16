import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import PageHeader from '../../components/ui/PageHeader'
import Input, { Select, Textarea } from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import FormSection from '../../components/ui/FormSection'
import { ClipboardList, User, Users, MapPin, BookOpen, FileText } from 'lucide-react'

const emptyForm = {
  // Basic Entry
  date_of_submission: new Date().toISOString().split('T')[0],
  date_of_admission: '',
  entry_type: 'Regular',
  session_id: '', mode_id: '', university_id: '',
  center_id: '', center_name: '',
  // Program Information
  department_id: '', programme_id: '', course_code: '',
  semester_year: '', academic_year: '',
  enrollment_no: '', admission_number: '', registration_no: '',
  status: 'Pending', remarks: '',
  // Personal Information
  student_name: '', date_of_birth: '', profession: '', gender: '', email: '',
  mobile_no: '', whatsapp_no: '', nationality: 'Indian',
  caste: '', religion: '', blood_group: '', mother_tongue: '',
  physically_handicapped: 'No', aadhar_link_mobile: '', aadhar_no: '',
  identification_marks: '', scholarship_applied: 'None', pan_no: '',
  // Family Details
  fathers_name: '', fathers_occupation: '',
  mothers_name: '', mothers_occupation: '',
  guardian_name: '', guardian_occupation: '', guardian_relation: '',
  guardian_email: '', guardian_mobile: '',
  // Student Permanent Address
  student_perm_village_town: '', student_perm_landmark: '',
  student_perm_post_office: '', student_perm_city: '',
  student_perm_state: '', student_perm_district: '', student_perm_pin_code: '',
  // Student Present Address
  student_pres_village_town: '', student_pres_landmark: '',
  student_pres_post_office: '', student_pres_city: '',
  student_pres_state: '', student_pres_district: '', student_pres_pin_code: '',
  // Guardian Present Address
  guardian_pres_village_town: '', guardian_pres_landmark: '',
  guardian_pres_post_office: '', guardian_pres_city: '',
  guardian_pres_state: '', guardian_pres_district: '', guardian_pres_pin_code: '',
  // Guardian Permanent Address
  guardian_perm_village_town: '', guardian_perm_landmark: '',
  guardian_perm_post_office: '', guardian_perm_city: '',
  guardian_perm_state: '', guardian_perm_district: '', guardian_perm_pin_code: '',
  // Education
  tenth_institute_name: '', tenth_board_university: '', tenth_passing_year: '', tenth_obtained_marks: '', tenth_total_marks: '',
  twelfth_institute_name: '', twelfth_board_university: '', twelfth_passing_year: '', twelfth_obtained_marks: '', twelfth_total_marks: '',
  ug_institute_name: '', ug_board_university: '', ug_passing_year: '', ug_obtained_marks: '', ug_total_marks: '',
  pg_institute_name: '', pg_board_university: '', pg_passing_year: '', pg_obtained_marks: '', pg_total_marks: '',
  diploma_institute_name: '', diploma_board_university: '', diploma_passing_year: '', diploma_obtained_marks: '', diploma_total_marks: '',
}

const PROFESSION_OPTIONS = ['Student', 'Private Service', 'Govt. Service', 'Self Employed', 'Others']
const CASTE_OPTIONS = ['General', 'OBC', 'SC', 'ST', 'Minorities', 'Others']
const SCHOLARSHIP_OPTIONS = ['None', 'Scholarship-1', 'Scholarship-2', 'Scholarship-3', 'Scholarship-4']
const STATUS_OPTIONS = ['Pending', 'Reviewing', 'Document Verified', 'Account Section', 'Rejected', 'Admitted']

export default function StudentForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile, user } = useAuth()
  const role = profile?.role || user?.user_metadata?.role || 'admin'
  const isAdmin = role === 'admin'
  const isEdit = Boolean(id)
  const [form, setForm] = useState(emptyForm)
  const [universities, setUniversities] = useState([])
  const [programs, setPrograms] = useState([])
  const [departments, setDepartments] = useState([])
  const [centers, setCenters] = useState([])
  const [sessions, setSessions] = useState([])
  const [studyModes, setStudyModes] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('universities').select('id, university_name').order('university_name'),
      supabase.from('programs').select('id, program_name, course_code, department_id, semester_year').order('program_name'),
      supabase.from('departments').select('id, name').order('name'),
      supabase.from('centers').select('id, center_name, center_code').order('center_name'),
      supabase.from('academic_sessions').select('id, session_name').order('session_name'),
      supabase.from('study_modes').select('id, mode_name').order('mode_name'),
    ]).then(([unis, progs, depts, cents, sess, modes]) => {
      setUniversities(unis.data || [])
      setPrograms(progs.data || [])
      setDepartments(depts.data || [])
      setCenters(cents.data || [])
      setSessions(sess.data || [])
      setStudyModes(modes.data || [])
    })
    if (isEdit) {
      supabase.from('students').select('*').eq('id', id).single()
        .then(({ data }) => { if (data) setForm(prev => ({ ...prev, ...data })) })
    }
  }, [id])

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }))

  // When department changes, reset programme and course_code
  const handleDepartmentChange = (e) => {
    setForm(f => ({ ...f, department_id: e.target.value, programme_id: '', course_code: '', semester_year: '' }))
  }

  // When program is selected, auto-fill course_code and reset semester_year
  const handleProgramChange = (e) => {
    const prog = programs.find(p => p.id === e.target.value)
    setForm(f => ({ ...f, programme_id: e.target.value, course_code: prog?.course_code || '', semester_year: '' }))
  }

  const filteredPrograms = form.department_id
    ? programs.filter(p => p.department_id === form.department_id)
    : programs

  const selectedProgram = programs.find(p => p.id === form.programme_id)
  const progSemYear = selectedProgram?.semester_year // 'Semester' | 'Year' | ''

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    const payload = { ...form }
    delete payload.id; delete payload.created_at; delete payload.updated_at
    const fkFields = ['university_id', 'session_id', 'programme_id', 'department_id', 'mode_id', 'center_id']
    fkFields.forEach(k => { if (!payload[k]) delete payload[k] })
    const { error } = isEdit
      ? await supabase.from('students').update(payload).eq('id', id)
      : await supabase.from('students').insert(payload)
    if (!error) navigate('/admin/students')
    else { alert('Error: ' + error.message); setLoading(false) }
  }

  const AddressBlock = ({ prefix, label }) => (
    <>
      <p className="text-xs font-black text-[#933d18]/70 uppercase tracking-widest mt-3 -mb-1">{label}</p>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Village / Town / Locality" value={form[`${prefix}_village_town`]} onChange={set(`${prefix}_village_town`)} />
        <Input label="Landmark" value={form[`${prefix}_landmark`]} onChange={set(`${prefix}_landmark`)} />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Input label="Post Office" value={form[`${prefix}_post_office`]} onChange={set(`${prefix}_post_office`)} />
        <Input label="City" value={form[`${prefix}_city`]} onChange={set(`${prefix}_city`)} />
        <Input label="PIN Code" value={form[`${prefix}_pin_code`]} onChange={set(`${prefix}_pin_code`)} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input label="State" value={form[`${prefix}_state`]} onChange={set(`${prefix}_state`)} />
        <Input label="District" value={form[`${prefix}_district`]} onChange={set(`${prefix}_district`)} />
      </div>
    </>
  )

  const EduRow = ({ prefix, label }) => (
    <>
      <p className="text-xs font-black text-[#933d18]/70 uppercase tracking-widest mt-3 -mb-1">{label}</p>
      <div className="grid grid-cols-3 gap-4">
        <Input label="Institute Name" value={form[`${prefix}_institute_name`]} onChange={set(`${prefix}_institute_name`)} />
        <Input label="Board / University" value={form[`${prefix}_board_university`]} onChange={set(`${prefix}_board_university`)} />
        <Input label="Passing Year" type="number" value={form[`${prefix}_passing_year`]} onChange={set(`${prefix}_passing_year`)} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Obtained Marks" type="number" value={form[`${prefix}_obtained_marks`]} onChange={set(`${prefix}_obtained_marks`)} />
        <Input label="Total Marks" type="number" value={form[`${prefix}_total_marks`]} onChange={set(`${prefix}_total_marks`)} />
      </div>
    </>
  )

  return (
    <div className="p-6 max-w-4xl pb-20">
      <PageHeader title={isEdit ? 'Edit Student' : 'Add Student'} backTo="/admin/students" />

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* 1. Basic Entry */}
        <FormSection title="Basic Entry" icon={<ClipboardList size={16} />}>
          <div className="grid grid-cols-3 gap-4">
            <Input label="Date of Submission" type="date" value={form.date_of_submission} onChange={set('date_of_submission')} />
            <Input label="Date of Admission" type="date" value={form.date_of_admission} onChange={set('date_of_admission')} />
            <Select label="Entry Type" value={form.entry_type} onChange={set('entry_type')}>
              <option value="Regular">Regular</option>
              <option value="Lateral">Lateral</option>
              <option value="External">External</option>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Select label="Session" value={form.session_id} onChange={set('session_id')}>
              <option value="">Select Session</option>
              {sessions.map(s => <option key={s.id} value={s.id}>{s.session_name}</option>)}
            </Select>
            <Select label="Mode" value={form.mode_id} onChange={set('mode_id')}>
              <option value="">Select Mode</option>
              {studyModes.map(m => <option key={m.id} value={m.id}>{m.mode_name}</option>)}
            </Select>
            <Select label="University" value={form.university_id} onChange={set('university_id')}>
              <option value="">Select University</option>
              {universities.map(u => <option key={u.id} value={u.id}>{u.university_name}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Center Name" value={form.center_id} onChange={set('center_id')}>
              <option value="">Select Center</option>
              {centers.map(c => <option key={c.id} value={c.id}>{c.center_name}{c.center_code ? ` (${c.center_code})` : ''}</option>)}
            </Select>
            <Input label="Center Name (manual)" placeholder="Auto-filled or type" value={form.center_name} onChange={set('center_name')} />
          </div>
        </FormSection>

        {/* 2. Program Information */}
        <FormSection title="Program Information" icon={<BookOpen size={16} />}>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Department" value={form.department_id} onChange={handleDepartmentChange}>
              <option value="">Select Department</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
            <Select label="Program Name" value={form.programme_id} onChange={handleProgramChange}>
              <option value="">Select Program</option>
              {filteredPrograms.map(p => <option key={p.id} value={p.id}>{p.program_name}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input label="Course Code" value={form.course_code} onChange={set('course_code')} />
            <Select label="Semester / Year" value={form.semester_year} onChange={set('semester_year')}>
              <option value="">Select</option>
              {(!progSemYear || progSemYear === 'Semester') && (
                ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'].map(s => (
                  <option key={s} value={s + ' Semester'}>{s} Semester</option>
                ))
              )}
              {(!progSemYear || progSemYear === 'Year') && (
                ['1st Year', '2nd Year', '3rd Year', '4th Year'].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))
              )}
            </Select>
            <Input label="Academic Year" placeholder="2024-25" value={form.academic_year} onChange={set('academic_year')} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Enrollment No"
              placeholder={isAdmin ? 'Auto-generate if blank' : '—'}
              value={form.enrollment_no}
              onChange={set('enrollment_no')}
              readOnly={!isAdmin}
              className={!isAdmin ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : ''}
            />
            <Input
              label="Admission Number"
              placeholder={isAdmin ? '' : '—'}
              value={form.admission_number}
              onChange={set('admission_number')}
              readOnly={!isAdmin}
              className={!isAdmin ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : ''}
            />
            <Input
              label="Registration No"
              placeholder={isAdmin ? '' : '—'}
              value={form.registration_no}
              onChange={set('registration_no')}
              readOnly={!isAdmin}
              className={!isAdmin ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : ''}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Status"
              value={form.status}
              onChange={set('status')}
              disabled={!isAdmin}
              className={!isAdmin ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : ''}
            >
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
            <Textarea label="Remarks" value={form.remarks} onChange={set('remarks')} />
          </div>
        </FormSection>

        {/* 3. Personal Information */}
        <FormSection title="Personal Information" icon={<User size={16} />}>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Student Name *" value={form.student_name} onChange={set('student_name')} required />
            <Input label="Date of Birth" type="date" value={form.date_of_birth} onChange={set('date_of_birth')} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Select label="Profession" value={form.profession} onChange={set('profession')}>
              <option value="">Select</option>
              {PROFESSION_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </Select>
            <Select label="Gender / Sex" value={form.gender} onChange={set('gender')}>
              <option value="">Select</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Others">Others</option>
            </Select>
            <Input label="Email Id" type="email" value={form.email} onChange={set('email')} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input label="Mobile No" type="tel" value={form.mobile_no} onChange={set('mobile_no')} />
            <Input label="WhatsApp No" type="tel" value={form.whatsapp_no} onChange={set('whatsapp_no')} />
            <Input label="Nationality" value={form.nationality} onChange={set('nationality')} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Select label="Caste" value={form.caste} onChange={set('caste')}>
              <option value="">Select</option>
              {CASTE_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
            <Input label="Religion" value={form.religion} onChange={set('religion')} />
            <Input label="Blood Group" placeholder="A+, B-, O+" value={form.blood_group} onChange={set('blood_group')} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input label="Mother Tongue" value={form.mother_tongue} onChange={set('mother_tongue')} />
            <Select label="Physically Handicapped" value={form.physically_handicapped} onChange={set('physically_handicapped')}>
              <option value="No">No</option>
              <option value="Yes">Yes</option>
            </Select>
            <Input label="Aadhar Link Mobile" type="tel" value={form.aadhar_link_mobile} onChange={set('aadhar_link_mobile')} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input label="Aadhar No" placeholder="XXXX XXXX XXXX" value={form.aadhar_no} onChange={set('aadhar_no')} />
            <Input label="PAN No" placeholder="ABCDE1234F" value={form.pan_no} onChange={set('pan_no')} />
            <Select label="Scholarship Applied" value={form.scholarship_applied} onChange={set('scholarship_applied')}>
              {SCHOLARSHIP_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
          </div>
          <Input label="Identification Marks" placeholder="Any visible identification marks..." value={form.identification_marks} onChange={set('identification_marks')} />
        </FormSection>

        {/* 4. Additional / Family Information */}
        <FormSection title="Additional Information" icon={<Users size={16} />}>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Father's Name" value={form.fathers_name} onChange={set('fathers_name')} />
            <Input label="Father's Occupation" value={form.fathers_occupation} onChange={set('fathers_occupation')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Mother's Name" value={form.mothers_name} onChange={set('mothers_name')} />
            <Input label="Mother's Occupation" value={form.mothers_occupation} onChange={set('mothers_occupation')} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input label="Guardian's Name" value={form.guardian_name} onChange={set('guardian_name')} />
            <Input label="Guardian's Occupation" value={form.guardian_occupation} onChange={set('guardian_occupation')} />
            <Input label="Relation" placeholder="e.g. Uncle, Elder Brother" value={form.guardian_relation} onChange={set('guardian_relation')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Guardian Email Id" type="email" value={form.guardian_email} onChange={set('guardian_email')} />
            <Input label="Guardian Mobile No" type="tel" value={form.guardian_mobile} onChange={set('guardian_mobile')} />
          </div>
        </FormSection>

        {/* 5. Contact Information */}
        <FormSection title="Contact Information" icon={<MapPin size={16} />}>
          <AddressBlock prefix="student_perm" label="Student Permanent Address" />
          <AddressBlock prefix="student_pres" label="Student Present Address" />
          <AddressBlock prefix="guardian_pres" label="Guardian Present Address" />
          <AddressBlock prefix="guardian_perm" label="Guardian Permanent Address" />
        </FormSection>

        {/* 6. Education Qualification */}
        <FormSection title="Education Qualification" icon={<BookOpen size={16} />}>
          <EduRow prefix="tenth" label="10th" />
          <EduRow prefix="twelfth" label="12th" />
          <EduRow prefix="ug" label="UG (Graduation)" />
          <EduRow prefix="pg" label="PG (Post Graduation)" />
          <EduRow prefix="diploma" label="Diploma / Polytechnic" />
        </FormSection>

        <div className="flex gap-3 pt-2 pb-8">
          <Button type="submit" disabled={loading}>{loading ? 'Saving...' : isEdit ? 'Update Student' : 'Submit'}</Button>
          <Button type="button" variant="outline" onClick={() => navigate('/admin/students')}>Cancel</Button>
        </div>
      </form>
    </div>
  )
}
