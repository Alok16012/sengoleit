import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import PageHeader from '../../components/ui/PageHeader'
import Input, { Select, Textarea } from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import FormSection from '../../components/ui/FormSection'
import { BookOpen, Settings, IndianRupee, FileText } from 'lucide-react'

const emptyForm = {
  program_name: '', course_code: '', short_name: '',
  university_id: '', department_id: '', programme_type_id: '', mode_id: '', mode_of_study_id: '',
  stream: '', duration: '', complete_duration: '', semester_year: '',
  seats_limit: '', fees_per_year: '', fees_per_semester: '',
  eligibility: '', description: '', status: 'Active',
}

export default function ProgramForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [form, setForm] = useState(emptyForm)
  const [universities, setUniversities] = useState([])
  const [departments, setDepartments] = useState([])
  const [programmeTypes, setProgrammeTypes] = useState([])
  const [studyModes, setStudyModes] = useState([])
  const [modesOfStudy, setModesOfStudy] = useState([])
  const [loading, setLoading] = useState(false)
  const isEdit = Boolean(id)

  useEffect(() => {
    Promise.all([
      supabase.from('universities').select('id, university_name').order('university_name'),
      supabase.from('departments').select('id, name').order('name'),
      supabase.from('programme_types').select('id, programme_type_name').order('programme_type_name'),
      supabase.from('study_modes').select('id, mode_name').order('mode_name'),
      supabase.from('modes_of_study').select('id, mode_name').order('mode_name'),
    ]).then(([unis, depts, types, modes, mods]) => {
      setUniversities(unis.data || [])
      setDepartments(depts.data || [])
      setProgrammeTypes(types.data || [])
      setStudyModes(modes.data || [])
      setModesOfStudy(mods.data || [])
    })
    if (isEdit) {
      supabase.from('programs').select('*').eq('id', id).single()
        .then(({ data }) => { if (data) setForm(prev => ({ ...prev, ...data })) })
    }
  }, [id])

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    const payload = { ...form }
    delete payload.id; delete payload.created_at; delete payload.updated_at
    const nullFields = ['university_id', 'department_id', 'programme_type_id', 'mode_id', 'mode_of_study_id']
    nullFields.forEach(f => { if (!payload[f]) delete payload[f] })
    if (isEdit) await supabase.from('programs').update(payload).eq('id', id)
    else await supabase.from('programs').insert(payload)
    navigate('/admin/programs')
  }

  return (
    <div className="p-6 max-w-3xl">
      <PageHeader title={isEdit ? 'Edit Program' : 'Add Program'} backTo="/admin/programs" />

      <form onSubmit={handleSubmit} className="space-y-5">

        <FormSection title="Program Identity" icon={<BookOpen size={16} />}>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Program Name *" placeholder="e.g. B.Tech in Computer Science" value={form.program_name} onChange={set('program_name')} required />
            <Input label="Short Name" placeholder="e.g. B.Tech" value={form.short_name} onChange={set('short_name')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Course Code" placeholder="e.g. SET 101" value={form.course_code} onChange={set('course_code')} />
            <Input label="Specialisation" placeholder="e.g. Computer Science, Agriculture" value={form.stream} onChange={set('stream')} />
          </div>
        </FormSection>

        <FormSection title="Classification" icon={<Settings size={16} />}>
          <div className="grid grid-cols-2 gap-4">
            <Select label="University" value={form.university_id} onChange={set('university_id')}>
              <option value="">Select University</option>
              {universities.map(u => <option key={u.id} value={u.id}>{u.university_name}</option>)}
            </Select>
            <Select label="Department" value={form.department_id} onChange={set('department_id')}>
              <option value="">Select Department</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Program Type" value={form.programme_type_id} onChange={set('programme_type_id')}>
              <option value="">Select Program Type</option>
              {programmeTypes.map(t => <option key={t.id} value={t.id}>{t.programme_type_name}</option>)}
            </Select>
            <Select label="Mode" value={form.mode_id} onChange={set('mode_id')}>
              <option value="">Select Mode</option>
              {studyModes.map(m => <option key={m.id} value={m.id}>{m.mode_name}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Mode of Study" value={form.mode_of_study_id} onChange={set('mode_of_study_id')}>
              <option value="">Select Mode of Study</option>
              {modesOfStudy.map(m => <option key={m.id} value={m.id}>{m.mode_name}</option>)}
            </Select>
            <Select label="Status" value={form.status} onChange={set('status')}>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </Select>
          </div>
        </FormSection>

        <FormSection title="Duration & Capacity" icon={<Settings size={16} />}>
          <div className="grid grid-cols-3 gap-4">
            <Input label="Duration (Semesters)" type="number" placeholder="8" value={form.duration} onChange={set('duration')} />
            <Input label="Complete Duration" placeholder="4 Years" value={form.complete_duration} onChange={set('complete_duration')} />
            <Select label="Semester / Year" value={form.semester_year} onChange={set('semester_year')}>
              <option value="">Select</option>
              <option value="Semester">Semester</option>
              <option value="Year">Year</option>
            </Select>
          </div>
          <Input label="Admission Intake (Seats)" type="number" placeholder="1000" value={form.seats_limit} onChange={set('seats_limit')} />
        </FormSection>

        <FormSection title="Fee Structure" icon={<IndianRupee size={16} />}>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Fees Per Year (₹)" type="number" placeholder="50000" value={form.fees_per_year} onChange={set('fees_per_year')} />
            <Input label="Fees Per Semester (₹)" type="number" placeholder="25000" value={form.fees_per_semester} onChange={set('fees_per_semester')} />
          </div>
        </FormSection>

        <FormSection title="Eligibility & Description" icon={<FileText size={16} />}>
          <Input label="Eligibility" placeholder="e.g. 12th (PCM), 10+2 in any stream" value={form.eligibility} onChange={set('eligibility')} />
          <Textarea label="Program Description" placeholder="Brief description about this program..." value={form.description} onChange={set('description')} />
        </FormSection>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={loading}>{loading ? 'Saving...' : isEdit ? 'Update Program' : 'Add Program'}</Button>
          <Button type="button" variant="outline" onClick={() => navigate('/admin/programs')}>Cancel</Button>
        </div>
      </form>
    </div>
  )
}
