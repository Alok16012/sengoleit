import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useStudentAuth } from '../../context/StudentAuthContext'
import { generateRegistrationCertificate } from '../../utils/generateStudentCards'
import { resolveStudentDocUrls } from '../../utils/resolveStudentDocs'
import { Receipt, Download, Hash, BookOpen, User, MapPin } from 'lucide-react'

export default function StudentRegistrationSlip() {
  const { student } = useStudentAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    if (!student?.id) return
    async function load() {
      const { data: raw } = await supabase
        .from('students')
        .select('*, programs(program_name, short_name), academic_sessions(session_name), centers(center_name, center_code), departments(name)')
        .eq('id', student.id)
        .single()
      if (raw) {
        const resolved = await resolveStudentDocUrls(raw)
        setData(resolved)
      }
      setLoading(false)
    }
    load()
  }, [student?.id])

  async function handleGenerate() {
    if (!data) return
    setGenerating(true)
    generateRegistrationCertificate(data)
    setGenerating(false)
  }

  if (loading) return <div className="p-8 text-center text-gray-400">Loading...</div>
  if (!data) return <div className="p-8 text-center text-gray-400">No data found.</div>

  const addr = [
    data.perm_village_town || data.student_perm_village_town,
    data.perm_city || data.student_perm_city,
    data.perm_district || data.student_perm_district,
    data.perm_state || data.student_perm_state,
  ].filter(Boolean).join(', ') || '—'

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-gray-900 flex items-center gap-2"><Receipt size={20} className="text-[#933d18]" /> Registration Certificate</h1>
          <p className="text-xs text-gray-400 mt-0.5">Download your official registration certificate</p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating || !data.registration_no}
          className="flex items-center gap-2 bg-[#933d18] hover:bg-[#7a3215] text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download size={15} /> {generating ? 'Generating...' : 'Download Certificate'}
        </button>
      </div>

      {!data.registration_no && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700 font-medium">
          Registration certificate will be available once your Registration Number is assigned by the university.
        </div>
      )}

      {/* Preview */}
      <div className="bg-white border-2 border-gray-300 rounded-2xl overflow-hidden shadow-sm">
        {/* Title bar */}
        <div className="bg-[#933d18] text-white text-center py-3">
          <span className="font-black text-base tracking-widest">REGISTRATION CERTIFICATE</span>
        </div>

        {/* 3-col reference */}
        <div className="grid grid-cols-3 border-b-2 border-gray-300 divide-x-2 divide-gray-300">
          {[
            { label: 'Registration No.', value: data.registration_no },
            { label: 'Registration Year', value: data.academic_year || data.academic_sessions?.session_name },
            { label: 'Branch / Center Code', value: data.centers?.center_code },
          ].map(({ label, value }) => (
            <div key={label} className="text-center">
              <div className="bg-gray-800 text-white text-[10px] font-bold py-1.5 tracking-wide">{label}</div>
              <div className="py-2.5 text-sm font-black text-gray-800 font-mono">{value || '—'}</div>
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex gap-0">
          <div className="flex-1 p-5 space-y-2.5">
            {[
              { icon: BookOpen, label: 'University', value: 'Sengol International University' },
              { icon: BookOpen, label: 'Course Name', value: data.programs?.program_name },
              { icon: User, label: 'Student Name', value: data.student_name },
              { icon: Hash, label: 'Date of Birth', value: data.date_of_birth ? new Date(data.date_of_birth).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : '—' },
              { icon: User, label: 'S/o D/o', value: data.fathers_name || data.mothers_name },
              { icon: MapPin, label: 'Address', value: addr },
              { icon: Hash, label: 'PIN No', value: data.perm_pin_code || data.student_perm_pin_code },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-start gap-2">
                <p className="text-xs font-bold text-gray-500 w-28 shrink-0 pt-0.5 italic">{label}</p>
                <p className="text-sm text-gray-900 italic font-medium">: {value || '—'}</p>
              </div>
            ))}

            {/* Signature */}
            <div className="pt-3 mt-2 border-t border-gray-100">
              <div className="h-8 w-32 border-b border-gray-400" />
              <p className="text-[10px] text-gray-400 mt-1">Student Signature</p>
            </div>
          </div>

          {/* Photo + registrar sig */}
          <div className="w-36 shrink-0 p-4 text-center border-l border-gray-100">
            {data.photo_url
              ? <img src={data.photo_url} alt="Photo" className="w-24 h-28 object-cover border-2 border-gray-200 rounded mx-auto" />
              : <div className="w-24 h-28 border-2 border-dashed border-gray-300 rounded flex items-center justify-center mx-auto bg-gray-50 text-xs text-gray-400 text-center">Photo<br/>Here</div>
            }
            <div className="mt-10 h-8 w-24 mx-auto border-b border-gray-400" />
            <p className="text-[9px] text-gray-400 mt-1">Registrar / Controller</p>
          </div>
        </div>
      </div>

      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs text-emerald-700">
        This is your official registration certificate from Sengol International University. Keep it safe for future reference.
      </div>
    </div>
  )
}
