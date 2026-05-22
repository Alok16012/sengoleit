import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useStudentAuth } from '../../context/StudentAuthContext'
import { generateIDCard } from '../../utils/generateStudentCards'
import { resolveStudentDocUrls } from '../../utils/resolveStudentDocs'
import { CreditCard, Download, User, Droplets, Ruler, Fingerprint, Calendar, Hash } from 'lucide-react'

export default function StudentIDCard() {
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
    generateIDCard(data)
    setGenerating(false)
  }

  if (loading) return <div className="p-8 text-center text-gray-400">Loading...</div>
  if (!data) return <div className="p-8 text-center text-gray-400">No data found.</div>

  const fields = [
    { icon: Hash, label: 'Enrollment No', value: data.enrollment_no, mono: true, highlight: true },
    { icon: Calendar, label: 'Valid Upto', value: data.valid_upto || '—' },
    { icon: Droplets, label: 'Blood Group', value: data.blood_group },
    { icon: Ruler, label: 'Height', value: data.height },
    { icon: Fingerprint, label: 'Identification Marks', value: data.identification_marks },
  ]

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-gray-900 flex items-center gap-2"><CreditCard size={20} className="text-[#933d18]" /> Student Identity Card</h1>
          <p className="text-xs text-gray-400 mt-0.5">Download your official university ID card</p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="flex items-center gap-2 bg-[#933d18] hover:bg-[#7a3215] text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-colors disabled:opacity-60"
        >
          <Download size={15} /> {generating ? 'Generating...' : 'Download ID Card'}
        </button>
      </div>

      {/* Preview card */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        {/* Card header */}
        <div className="bg-[#933d18] px-5 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <span className="text-white font-black text-lg">{data.student_name?.[0]?.toUpperCase()}</span>
          </div>
          <div>
            <p className="text-white font-black text-base">{data.student_name}</p>
            <p className="text-white/70 text-xs font-mono mt-0.5">{data.enrollment_no}</p>
          </div>
          {data.photo_url && (
            <img src={data.photo_url} alt="Photo"
              className="w-14 h-16 object-cover rounded-lg border-2 border-white/30 ml-auto shrink-0" />
          )}
        </div>

        {/* Fields grid */}
        <div className="p-5 grid grid-cols-2 gap-3">
          {fields.map(({ icon: Icon, label, value, mono, highlight }) => (
            <div key={label} className={`rounded-xl p-3 border ${highlight ? 'bg-[#933d18]/5 border-[#933d18]/20' : 'bg-gray-50 border-gray-100'}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <Icon size={11} className={highlight ? 'text-[#933d18]' : 'text-gray-400'} />
                <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">{label}</p>
              </div>
              <p className={`text-sm font-semibold ${mono ? 'font-mono text-[#933d18]' : 'text-gray-900'}`}>{value || '—'}</p>
            </div>
          ))}
          <div className="rounded-xl p-3 border bg-gray-50 border-gray-100">
            <div className="flex items-center gap-1.5 mb-1">
              <User size={11} className="text-gray-400" />
              <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Programme</p>
            </div>
            <p className="text-sm font-semibold text-gray-900">{data.programs?.program_name || '—'}</p>
          </div>
        </div>

        <div className="px-5 pb-4">
          <div className="bg-gray-900 text-white text-center text-xs font-bold py-2 rounded-lg tracking-widest">
            SENGOL INTERNATIONAL UNIVERSITY — STUDENT IDENTITY CARD
          </div>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-700">
        This card is valid for the current academic session only. Carry this card during all university examinations and events.
      </div>
    </div>
  )
}
