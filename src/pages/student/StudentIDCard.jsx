import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useStudentAuth } from '../../context/StudentAuthContext'
import { fetchStudentSelf } from '../../utils/studentSelf'
import { generateIDCard, isPhdProgram } from '../../utils/generateStudentCards'
import { resolveStudentDocUrls } from '../../utils/resolveStudentDocs'
import { formatDate } from '../../utils/formatDate'
import { CreditCard, Download, Lock } from 'lucide-react'

export default function StudentIDCard() {
  const { student } = useStudentAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    if (!student?.id) return
    async function load() {
      const raw = await fetchStudentSelf()
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

  const isPhd = isPhdProgram(data.programs?.program_name)
  const regNo = isPhd
    ? (data.admission_number || data.enrollment_no)
    : (data.registration_no || data.enrollment_no || data.admission_number)
  // The ID card is issued only once the student has an enrollment number — for
  // Ph.D that happens when Research forwards them to the Exam Section.
  const enrolled = !!data.enrollment_no
  const contact = data.mobile_no || data.whatsapp_no
  const address = [
    data.student_perm_village_town, data.student_perm_landmark, data.student_perm_city,
    data.student_perm_district, data.student_perm_state,
    data.student_perm_pin_code ? '- ' + data.student_perm_pin_code : null,
  ].filter(Boolean).join(', ') || '—'

  // Validity spans the whole course: start year → start year + course years.
  const courseYears = (() => {
    const m = String(data.programs?.complete_duration || '').match(/(\d+)\s*year/i)
    if (m) return parseInt(m[1], 10)
    const dur = Number(data.programs?.duration) || 0
    if (!dur) return 0
    // duration is in semesters for every mode — halve it for years.
    return Math.max(Math.round(dur / 2), 1)
  })()
  const startYear = (() => {
    const ay = String(data.academic_year || '').match(/(20\d{2})/)
    if (ay) return parseInt(ay[1], 10)
    const d = data.academic_sessions?.start_date || data.date_of_admission
    const y = d ? new Date(d).getFullYear() : NaN
    return Number.isFinite(y) ? y : null
  })()
  const validity = startYear && courseYears ? `${startYear}-${startYear + courseYears}` : (data.academic_year || data.academic_sessions?.session_name || '—')
  const dob = data.date_of_birth ? formatDate(data.date_of_birth) : '—'
  const rows = [
    [isPhd ? 'Application No.' : 'Registration No.', regNo, true],
    ['Enrollment No', data.enrollment_no],
    ['Name', data.student_name],
    ['F./H. Name', data.fathers_name],
    ['D.O.B.', dob],
    ['Course', data.programs?.program_name],
    ['Session', data.academic_sessions?.session_name || data.academic_year],
    ['Contact', contact],
    ['Validity', validity],
    ['Address', address],
  ]

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-gray-900 flex items-center gap-2"><CreditCard size={20} className="text-[#933d18]" /> Student Identity Card</h1>
          <p className="text-xs text-gray-400 mt-0.5">Download your official university ID card</p>
        </div>
        {enrolled && (
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 bg-[#933d18] hover:bg-[#7a3215] text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-colors disabled:opacity-60"
          >
            <Download size={15} /> {generating ? 'Generating...' : 'Download ID Card'}
          </button>
        )}
      </div>

      {!enrolled && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700 font-medium flex items-center gap-2">
          <Lock size={15} /> Your ID card will be available once your Enrollment Number has been generated.
        </div>
      )}

      {/* Preview — matches the downloaded landscape ID card */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm max-w-xl">
        {/* Top maroon band with white logo box */}
        <div className="relative h-24">
          <div className="absolute left-0 right-0 top-7 h-11 bg-[#933d18] border-b-2 border-[#d9a441]" />
          <div className="absolute top-3 left-5 bg-white border border-gray-200 rounded-xl px-4 py-2 shadow-md flex items-center gap-3">
            <img src="/assets/logo.png" alt="Logo" className="w-12 h-12 object-contain" />
            <div className="leading-none">
              <div className="text-[#933d18] font-black text-base">SENGOL</div>
              <div className="text-[#933d18] font-extrabold text-xs mt-0.5">INTERNATIONAL</div>
              <div className="text-[#933d18] font-extrabold text-xs mt-0.5">UNIVERSITY</div>
            </div>
          </div>
        </div>

        {/* UGC line */}
        <p className="text-center text-[9px] font-bold text-gray-600 px-2 pb-1">
          Estb. by the Act of State Govt. &amp; Under Section 2(f) of UGC Act 1956. Govt. of India
        </p>

        {/* IDENTITY CARD title bar */}
        <div className="bg-[#933d18] text-center py-1 mx-5 mb-2 rounded border-y border-[#d9a441]">
          <span className="text-white text-xs font-extrabold tracking-[0.18em]">IDENTITY CARD</span>
        </div>

        {/* Body: photo + seal | details */}
        <div className="flex gap-4 px-5 pb-4">
          <div className="w-28 shrink-0">
            <div className="relative w-28">
              {data.photo_url
                ? <img src={data.photo_url} alt="Photo" className="w-28 h-32 object-cover rounded-lg border border-gray-300" />
                : <div className="w-28 h-32 rounded-lg border border-gray-300 bg-gray-50 flex items-center justify-center text-xs text-gray-400">Photo</div>}
              <img src="/assets/logo.png" alt="" className="absolute right-1.5 bottom-1.5 w-14 h-14 object-contain opacity-25" />
            </div>
            <div className="h-8 mt-2 flex items-center justify-center">
              {data.signature_url && <img src={data.signature_url} alt="Signature" className="max-h-7 max-w-full object-contain" />}
            </div>
            <div className="border-t border-gray-400 mt-0.5" />
            <p className="text-center text-[8px] text-gray-500 mt-0.5">Student Signature</p>
          </div>
          <table className="flex-1">
            <tbody>
              {rows.map(([label, value, hi]) => (
                <tr key={label}>
                  <td className={`align-top py-0.5 pr-1 whitespace-nowrap w-28 text-[13px] font-semibold ${hi ? 'text-[#933d18]' : 'text-gray-700'}`}>{label}</td>
                  <td className={`align-top py-0.5 text-[13px] ${hi ? 'text-[#933d18] font-bold' : 'text-gray-800'}`}>: {value || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Bottom band: address + website */}
        <div className="bg-[#933d18] border-t-2 border-[#d9a441] flex items-stretch justify-between">
          <span className="text-white text-[11px] font-bold px-4 py-1.5 self-center">Address: Lower Pepthang, PO - Lingmoo, District - Namchi, Sikkim - 737134</span>
          <span className="bg-[#d9a441] text-[#3a2000] text-[11px] font-extrabold px-4 flex items-center">www.sengolinternationaluniversity.edu.in</span>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-700">
        This card is valid for the current academic session only. Carry this card during all university examinations and events.
      </div>
    </div>
  )
}
