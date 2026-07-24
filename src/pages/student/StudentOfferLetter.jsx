import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useStudentAuth } from '../../context/StudentAuthContext'
import { generateOfferLetter, isPhdProgram } from '../../utils/generateStudentCards'
import { resolveStudentDocUrls } from '../../utils/resolveStudentDocs'
import { FileCheck2, Download, Lock } from 'lucide-react'

export default function StudentOfferLetter() {
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
      if (raw) setData(await resolveStudentDocUrls(raw))
      setLoading(false)
    }
    load()
  }, [student?.id])

  async function handleGenerate() {
    if (!data) return
    setGenerating(true)
    generateOfferLetter(data)
    setGenerating(false)
  }

  if (loading) return <div className="p-8 text-center text-gray-400">Loading...</div>
  if (!data) return <div className="p-8 text-center text-gray-400">No data found.</div>

  const isPhd = isPhdProgram(data.programs?.program_name)
  const refNo = data.registration_no || data.enrollment_no || data.admission_number

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-gray-900 flex items-center gap-2"><FileCheck2 size={20} className="text-[#933d18]" /> Offer Letter</h1>
          <p className="text-xs text-gray-400 mt-0.5">Ph.D provisional admission offer letter</p>
        </div>
        {isPhd && (
          <button onClick={handleGenerate} disabled={generating}
            className="flex items-center gap-2 bg-[#933d18] hover:bg-[#7a3215] text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            <Download size={15} /> {generating ? 'Generating...' : 'Download Offer Letter'}
          </button>
        )}
      </div>

      {!isPhd ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700 font-medium flex items-center gap-2">
          <Lock size={15} /> The offer letter is available only for Ph.D (Doctoral) programme students.
        </div>
      ) : (
        <div className="bg-white border-2 border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="bg-[#933d18] text-white text-center py-3">
            <span className="font-black text-base tracking-wide">OFFER OF ADMISSION — Ph.D</span>
          </div>
          <div className="p-6 space-y-2 text-sm text-gray-800">
            <p><span className="font-bold">Reference No:</span> {refNo || '—'}</p>
            <p><span className="font-bold">Candidate:</span> {data.student_name}</p>
            <p><span className="font-bold">Programme:</span> {data.programs?.program_name || '—'}</p>
            <p><span className="font-bold">Session:</span> {data.academic_sessions?.session_name || data.academic_year || '—'}</p>
            <p className="text-gray-500 pt-2 text-xs">Click “Download Offer Letter” for the full printable document.</p>
          </div>
        </div>
      )}
    </div>
  )
}
