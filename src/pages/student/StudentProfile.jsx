import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useStudentAuth } from '../../context/StudentAuthContext'
import { fetchStudentSelf } from '../../utils/studentSelf'
import { resolveStudentDocUrls } from '../../utils/resolveStudentDocs'
import { isPhdProgram } from '../../utils/generateStudentCards'
import { ChevronDown } from 'lucide-react'

function Field({ label, value }) {
  return (
    <div>
      <p className="text-[11px] text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-gray-900">{value || '—'}</p>
    </div>
  )
}

// Sections start collapsed — the page opens as a short list of headings the
// student expands as needed, instead of one very long scroll.
// `plain` renders the children as-is (for the marks table) instead of laying
// them out on the Field grid.
function Section({ title, children, plain = false, defaultOpen = false }) {
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
      {open && (plain ? children : <div className="grid grid-cols-2 md:grid-cols-3 gap-4">{children}</div>)}
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

      {/* Only what the student needs to see of themselves: identity and
          contact. Family, addresses, qualifications and bank details stay on
          the admission record for the office, not on the student's profile. */}
      <Section title="Personal Information">
        <Field label="Enrollment Number" value={data.enrollment_no} />
        <Field label="Candidate Name" value={data.student_name} />
        <Field label="Father Name" value={data.fathers_name} />
        <Field label="Mother Name" value={data.mothers_name} />
        <Field label="Date of Birth" value={data.date_of_birth} />
        <Field label="Gender" value={data.gender} />
        <Field label="Mobile" value={data.mobile_no} />
        <Field label="Email" value={data.email} />
      </Section>

      <Section title="Photo & Signature" plain>
        <div className="flex flex-wrap items-start gap-10">
          <div className="text-center">
            <p className="text-[11px] text-gray-400 mb-2">Student Photo</p>
            {data.photo_url
              ? <img src={data.photo_url} alt="Student" className="w-28 h-32 object-cover rounded-lg border-2 border-gray-200 shadow-sm" />
              : <div className="w-28 h-32 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-xs text-gray-400">No Photo</div>}
          </div>
          <div className="text-center">
            <p className="text-[11px] text-gray-400 mb-2">Signature</p>
            {data.signature_url
              ? <img src={data.signature_url} alt="Signature" className="w-44 h-32 object-contain rounded-lg border-2 border-gray-200 bg-white p-2 shadow-sm" />
              : <div className="w-44 h-32 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-xs text-gray-400">No Signature</div>}
          </div>
        </div>
      </Section>
    </div>
  )
}
