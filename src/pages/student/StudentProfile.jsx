import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useStudentAuth } from '../../context/StudentAuthContext'
import { fetchStudentSelf } from '../../utils/studentSelf'
import { resolveStudentDocUrls } from '../../utils/resolveStudentDocs'
import { isPhdProgram } from '../../utils/generateStudentCards'
import { ChevronDown } from 'lucide-react'

// Education levels as stored on students (<key>_board_university, …).
const EDU_LEVELS = [
  ['tenth', '10th (Matriculation)'],
  ['twelfth', '12th (Intermediate)'],
  ['diploma', 'Diploma'],
  ['ug', 'Graduation (UG)'],
  ['pg', 'Post Graduation (PG)'],
  ['mphil', 'M.Phil'],
  ['others', 'Others'],
]

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

  const isPhd = isPhdProgram(data.programs?.program_name)
  // Only the education levels the student actually filled in.
  const eduRows = EDU_LEVELS.filter(([k]) =>
    data[`${k}_board_university`] || data[`${k}_institute_name`] || data[`${k}_obtained_marks`])
  const pct = (o, t) => {
    const a = parseFloat(o), b = parseFloat(t)
    return a && b ? ((a / b) * 100).toFixed(1) + '%' : '—'
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-black text-gray-900">My Profile</h1>

      <Section title="Course / Programme">
        <Field label="Programme" value={data.programs?.program_name} />
        <Field label="Department" value={data.departments?.name} />
        <Field label="Session" value={data.academic_sessions?.session_name} />
        <Field label="Study Mode" value={data.study_modes?.mode_name} />
        <Field label="Application No" value={data.admission_number} />
        <Field label="Enrollment No" value={data.enrollment_no} />
        {isPhd ? (
          <>
            <Field label="Stream / Faculty" value={data.stream} />
            <Field label="Specialization" value={data.specialization} />
          </>
        ) : (
          <Field label="Registration No" value={data.registration_no} />
        )}
        <Field label="Entry Type" value={data.entry_type} />
        <Field label="Date of Admission" value={data.date_of_admission} />
        <Field label="Center" value={data.centers?.center_name} />
      </Section>

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

      {eduRows.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-[10px] font-black text-[#933d18] uppercase tracking-widest mb-4">Educational Qualifications</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-gray-400 border-b border-gray-100">
                  <th className="text-left font-semibold py-2 pr-4">Level</th>
                  <th className="text-left font-semibold py-2 pr-4">Board / University</th>
                  <th className="text-left font-semibold py-2 pr-4">Institution</th>
                  <th className="text-left font-semibold py-2 pr-4">Year</th>
                  <th className="text-left font-semibold py-2 pr-4">Marks</th>
                  <th className="text-left font-semibold py-2">%</th>
                </tr>
              </thead>
              <tbody>
                {eduRows.map(([k, label]) => (
                  <tr key={k} className="border-b border-gray-50 last:border-0">
                    <td className="py-2.5 pr-4 font-semibold text-gray-800 whitespace-nowrap">{label}</td>
                    <td className="py-2.5 pr-4 text-gray-700">{data[`${k}_board_university`] || '—'}</td>
                    <td className="py-2.5 pr-4 text-gray-700">{data[`${k}_institute_name`] || '—'}</td>
                    <td className="py-2.5 pr-4 text-gray-700">{data[`${k}_passing_year`] || '—'}</td>
                    <td className="py-2.5 pr-4 text-gray-700 whitespace-nowrap">
                      {data[`${k}_obtained_marks`] ? `${data[`${k}_obtained_marks`]} / ${data[`${k}_total_marks`] || '—'}` : '—'}
                    </td>
                    <td className="py-2.5 font-bold text-[#933d18]">{pct(data[`${k}_obtained_marks`], data[`${k}_total_marks`])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(data.bank_account_holder || data.bank_account_number || data.ifsc_code) && (
        <Section title="Bank Details">
          <Field label="Account Holder" value={data.bank_account_holder} />
          <Field label="Account Number" value={data.bank_account_number} />
          <Field label="IFSC Code" value={data.ifsc_code} />
          <Field label="Branch" value={data.bank_branch} />
        </Section>
      )}

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
