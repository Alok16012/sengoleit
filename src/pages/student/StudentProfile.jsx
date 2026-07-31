import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useStudentAuth } from '../../context/StudentAuthContext'
import { fetchStudentSelf } from '../../utils/studentSelf'
import { resolveStudentDocUrls } from '../../utils/resolveStudentDocs'
import { ChevronDown } from 'lucide-react'

function Field({ label, value }) {
  return (
    <div>
      <p className="text-[11px] text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-gray-900">{value || '—'}</p>
    </div>
  )
}

function Section({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between group ${open ? 'mb-4' : ''}`}
      >
        <span className="text-[10px] font-black text-[#933d18] uppercase tracking-widest">{title}</span>
        <span className="flex items-center gap-1 text-[11px] font-semibold text-gray-400 group-hover:text-[#933d18] transition-colors">
          {open ? 'Hide' : 'Show'}
          <ChevronDown size={14} className={`transition-transform ${open ? '' : '-rotate-90'}`} />
        </span>
      </button>
      {open && <div className="grid grid-cols-2 md:grid-cols-3 gap-4">{children}</div>}
    </div>
  )
}

export default function StudentProfile() {
  const { student } = useStudentAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!student?.id) return
    fetchStudentSelf()
      .then(async (data) => {
        // Photo/signature live in a private bucket — resolve to signed URLs so
        // they actually load (raw stored URLs 404).
        setData(data ? await resolveStudentDocUrls(data) : data)
        setLoading(false)
      })
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
        <Field label="Village / Town" value={data.student_perm_village_town} />
        <Field label="Landmark" value={data.student_perm_landmark} />
        <Field label="Post Office" value={data.student_perm_post_office} />
        <Field label="City" value={data.student_perm_city} />
        <Field label="State" value={data.student_perm_state} />
        <Field label="District" value={data.student_perm_district} />
        <Field label="PIN Code" value={data.student_perm_pin_code} />
      </Section>

      <Section title="Present Address">
        <Field label="Village / Town" value={data.student_pres_village_town} />
        <Field label="Landmark" value={data.student_pres_landmark} />
        <Field label="Post Office" value={data.student_pres_post_office} />
        <Field label="City" value={data.student_pres_city} />
        <Field label="State" value={data.student_pres_state} />
        <Field label="District" value={data.student_pres_district} />
        <Field label="PIN Code" value={data.student_pres_pin_code} />
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

      <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-wrap items-start gap-10">
        <div className="text-center">
          <p className="text-[10px] font-black text-[#933d18] uppercase tracking-widest mb-2">Student Photo</p>
          {data.photo_url
            ? <img src={data.photo_url} alt="Student" className="w-28 h-32 object-cover rounded-lg border-2 border-gray-200 shadow-sm" />
            : <div className="w-28 h-32 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-xs text-gray-400">No Photo</div>}
        </div>
        <div className="text-center">
          <p className="text-[10px] font-black text-[#933d18] uppercase tracking-widest mb-2">Signature</p>
          {data.signature_url
            ? <img src={data.signature_url} alt="Signature" className="w-44 h-32 object-contain rounded-lg border-2 border-gray-200 bg-white p-2 shadow-sm" />
            : <div className="w-44 h-32 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-xs text-gray-400">No Signature</div>}
        </div>
      </div>
    </div>
  )
}
