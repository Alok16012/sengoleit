import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useStudentAuth } from '../../context/StudentAuthContext'
import { generateAdmitCard } from '../../utils/generateStudentCards'
import { resolveStudentDocUrls } from '../../utils/resolveStudentDocs'
import { BadgeCheck, Download, BookOpen, Hash, MapPin } from 'lucide-react'
import { formatDate } from '../../utils/formatDate'

export default function StudentAdmitCard() {
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
    generateAdmitCard(data)
    setGenerating(false)
  }

  if (loading) return <div className="p-8 text-center text-gray-400">Loading...</div>
  if (!data) return <div className="p-8 text-center text-gray-400">No data found.</div>

  // The admit card is released only after the Exam Section releases it explicitly.
  const isApproved = !!data.admit_card_released_at

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-gray-900 flex items-center gap-2"><BadgeCheck size={20} className="text-[#933d18]" /> Admit Card</h1>
          <p className="text-xs text-gray-400 mt-0.5">Download your exam admit card</p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating || !isApproved}
          className="flex items-center gap-2 bg-[#933d18] hover:bg-[#7a3215] text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download size={15} /> {generating ? 'Generating...' : 'Download Admit Card'}
        </button>
      </div>

      {!isApproved && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700 font-medium">
          Admit card will be available once the Exam Section releases it for your examination.
        </div>
      )}

      {/* Preview */}
      <div className="bg-white border-2 border-gray-300 rounded-2xl overflow-hidden shadow-sm">
        {/* Header band */}
        <div className="bg-gray-900 text-white text-center py-2.5">
          <span className="font-black text-base tracking-widest">ADMIT CARD</span>
        </div>

        {/* 3-col reference */}
        <div className="grid grid-cols-3 border-b-2 border-gray-300 divide-x-2 divide-gray-300">
          {[
            { label: 'Registration No.', value: data.registration_no },
            { label: 'Roll No (Enrollment)', value: data.enrollment_no },
            { label: 'Center Code', value: data.centers?.center_code },
          ].map(({ label, value }) => (
            <div key={label} className="text-center">
              <div className="bg-gray-800 text-white text-[10px] font-bold py-1.5 tracking-wide">{label}</div>
              <div className="py-2.5 text-sm font-black text-gray-800 font-mono">{value || '—'}</div>
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex gap-0">
          <div className="flex-1 p-5 space-y-2.5 border-r-2 border-gray-200">
            {[
              { icon: BookOpen, label: 'Course Name', value: data.programs?.program_name },
              { icon: Hash, label: 'Student Name', value: data.student_name },
              { icon: Hash, label: 'Date of Birth', value: formatDate(data.date_of_birth) },
              { icon: MapPin, label: 'Exam Center', value: data.centers?.center_name },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-start gap-2">
                <p className="text-xs font-bold text-gray-500 w-28 shrink-0 pt-0.5">{label}</p>
                <p className="text-sm font-semibold text-gray-900 italic">: {value || '—'}</p>
              </div>
            ))}

            <div className="pt-2 border-t border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Papers to be Appeared</p>
              <p className="text-xs text-gray-500 italic">As per university curriculum — subjects will be notified separately</p>
            </div>

            <p className="text-[10px] text-gray-400 italic pt-1">✦ Check and confirm entry before the exam</p>
          </div>

          {/* Photo box */}
          <div className="w-36 shrink-0 p-4 text-center border-l border-gray-100">
            {data.photo_url
              ? <img src={data.photo_url} alt="Photo" className="w-24 h-28 object-cover border-2 border-gray-200 rounded mx-auto" />
              : <div className="w-24 h-28 border-2 border-dashed border-gray-300 rounded flex items-center justify-center mx-auto bg-gray-50 text-xs text-gray-400 text-center">Photo</div>
            }
            <div className="mt-8 h-8 w-24 mx-auto border-b border-gray-400" />
            <p className="text-[9px] text-gray-400 mt-1">Controller of Exam</p>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-700">
        This admit card is required for all university examinations. Present it along with your valid photo ID at the exam hall.
      </div>
    </div>
  )
}
