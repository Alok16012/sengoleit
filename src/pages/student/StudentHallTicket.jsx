import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useStudentAuth } from '../../context/StudentAuthContext'
import { fetchStudentSelf } from '../../utils/studentSelf'
import { generateHallTicket, isPhdProgram } from '../../utils/generateStudentCards'
import { resolveStudentDocUrls } from '../../utils/resolveStudentDocs'
import { letterOptsFor } from '../../utils/letterSettings'
import { Ticket, Download, Lock } from 'lucide-react'

export default function StudentHallTicket() {
  const { student } = useStudentAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    if (!student?.id) return
    async function load() {
      const raw = await fetchStudentSelf()
      if (raw) setData(await resolveStudentDocUrls(raw))
      setLoading(false)
    }
    load()
  }, [student?.id])

  async function handleGenerate() {
    if (!data) return
    setGenerating(true)
    // Use the Roll No. / exam details the Research Dept issued, so the
    // student's copy matches the office copy.
    const opts = await letterOptsFor(data.id, 'Hall Ticket', data.session_id)
    generateHallTicket(data, opts)
    setGenerating(false)
  }

  if (loading) return <div className="p-8 text-center text-gray-400">Loading...</div>
  if (!data) return <div className="p-8 text-center text-gray-400">No data found.</div>

  const isPhd = isPhdProgram(data.programs?.program_name)
  // Published by the Research Dept (Active toggle). Until then the student
  // sees a waiting notice instead of the download button.
  const released = !!data.hall_ticket_active

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-gray-900 flex items-center gap-2"><Ticket size={20} className="text-[#933d18]" /> Hall Ticket</h1>
          <p className="text-xs text-gray-400 mt-0.5">Ph.D entrance exam provisional hall ticket</p>
        </div>
        {isPhd && released && (
          <button onClick={handleGenerate} disabled={generating}
            className="flex items-center gap-2 bg-[#933d18] hover:bg-[#7a3215] text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            <Download size={15} /> {generating ? 'Generating...' : 'Download Hall Ticket'}
          </button>
        )}
      </div>

      {!isPhd ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700 font-medium flex items-center gap-2">
          <Lock size={15} /> The hall ticket is available only for Ph.D (Doctoral) programme students.
        </div>
      ) : !released ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700 font-medium flex items-center gap-2">
          <Lock size={15} /> Your hall ticket has not been released yet. It will appear here once the Research Department publishes it.
        </div>
      ) : (
        <div className="bg-white border-2 border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="bg-[#933d18] text-white text-center py-3">
            <span className="font-black text-base tracking-wide">HALL TICKET</span>
          </div>
          <div className="p-6 space-y-2 text-sm text-gray-800">
            <p><span className="font-bold">Application No:</span> {data.admission_number || '—'}</p>
            <p><span className="font-bold">Candidate:</span> {data.student_name}</p>
            <p><span className="font-bold">Programme:</span> {data.programs?.program_name || '—'}</p>
            <p><span className="font-bold">Session:</span> {data.academic_sessions?.session_name || data.academic_year || '—'}</p>
            <p className="text-gray-500 pt-2 text-xs">Click “Download Hall Ticket” for the full printable document. Carry it with a Photo ID Proof to the Examination Centre.</p>
          </div>
        </div>
      )}
    </div>
  )
}
