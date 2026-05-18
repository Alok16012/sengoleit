import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useStudentAuth } from '../../context/StudentAuthContext'

function Field({ label, value }) {
  return (
    <div>
      <p className="text-[11px] text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-gray-900">{value || '—'}</p>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <p className="text-[10px] font-black text-[#933d18] uppercase tracking-widest mb-4">{title}</p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">{children}</div>
    </div>
  )
}

export default function StudentProfile() {
  const { student } = useStudentAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!student?.id) return
    supabase.from('students').select('*').eq('id', student.id).single()
      .then(({ data }) => { setData(data); setLoading(false) })
  }, [student?.id])

  if (loading) return <div className="p-8 text-center text-gray-400">Loading...</div>
  if (!data) return <div className="p-8 text-center text-gray-400">No profile data found.</div>

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-black text-gray-900">My Profile</h1>

      <Section title="Personal Information">
        <Field label="Full Name" value={data.student_name} />
        <Field label="Date of Birth" value={data.date_of_birth} />
        <Field label="Gender" value={data.gender} />
        <Field label="Blood Group" value={data.blood_group} />
        <Field label="Mobile" value={data.mobile_no} />
        <Field label="Alternate Mobile" value={data.alternate_mobile} />
        <Field label="Email" value={data.email} />
        <Field label="Category" value={data.category} />
        <Field label="Nationality" value={data.nationality} />
        <Field label="Religion" value={data.religion} />
        <Field label="Aadhar No" value={data.aadhar_no} />
        <Field label="ABC ID" value={data.abc_id} />
      </Section>

      <Section title="Family Details">
        <Field label="Father's Name" value={data.fathers_name} />
        <Field label="Father's Occupation" value={data.fathers_occupation} />
        <Field label="Father's Mobile" value={data.fathers_mobile} />
        <Field label="Mother's Name" value={data.mothers_name} />
        <Field label="Mother's Occupation" value={data.mothers_occupation} />
        <Field label="Mother's Mobile" value={data.mothers_mobile} />
        <Field label="Guardian Name" value={data.guardian_name} />
        <Field label="Guardian Mobile" value={data.guardian_mobile} />
        <Field label="Annual Income" value={data.annual_income ? `₹${Number(data.annual_income).toLocaleString('en-IN')}` : null} />
      </Section>

      <Section title="Permanent Address">
        <Field label="Village / Town" value={data.perm_village_town} />
        <Field label="Landmark" value={data.perm_landmark} />
        <Field label="Post Office" value={data.perm_post_office} />
        <Field label="City" value={data.perm_city} />
        <Field label="State" value={data.perm_state} />
        <Field label="District" value={data.perm_district} />
        <Field label="PIN Code" value={data.perm_pin_code} />
      </Section>

      <Section title="Present Address">
        <Field label="Village / Town" value={data.pres_village_town} />
        <Field label="Landmark" value={data.pres_landmark} />
        <Field label="Post Office" value={data.pres_post_office} />
        <Field label="City" value={data.pres_city} />
        <Field label="State" value={data.pres_state} />
        <Field label="District" value={data.pres_district} />
        <Field label="PIN Code" value={data.pres_pin_code} />
      </Section>

      <Section title="Guardian Permanent Address">
        <Field label="Village / Town" value={data.guardian_perm_village_town} />
        <Field label="Landmark" value={data.guardian_perm_landmark} />
        <Field label="Post Office" value={data.guardian_perm_post_office} />
        <Field label="City" value={data.guardian_perm_city} />
        <Field label="State" value={data.guardian_perm_state} />
        <Field label="District" value={data.guardian_perm_district} />
        <Field label="PIN Code" value={data.guardian_perm_pin_code} />
      </Section>
    </div>
  )
}
