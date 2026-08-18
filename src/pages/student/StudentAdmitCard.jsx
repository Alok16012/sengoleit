import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useStudentAuth } from '../../context/StudentAuthContext'
import { fetchStudentSelf } from '../../utils/studentSelf'
import { generateAdmitCard, isPhdProgram, UNI_NAME, UNI_ADDRESS, UNI_ESTD, BRAND } from '../../utils/generateStudentCards'
import { resolveStudentDocUrls } from '../../utils/resolveStudentDocs'
import { fetchAdmitCardSubjects, fetchSemesterSubjectRows, formatSubjectRow } from '../../utils/fetchSyllabus'
import { fetchMyAdmitCards, pickCardRows } from '../../utils/semesterAdmitCards'
import { studentSession } from '../../utils/studentSelf'
import { fetchExamSettingsMeta, fetchExamDates } from '../../utils/examSettings'
import { BadgeCheck, Download } from 'lucide-react'
import { formatDate } from '../../utils/formatDate'

export default function StudentAdmitCard() {
  const { student } = useStudentAuth()
  const [data, setData] = useState(null)
  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  // Admit cards the Exam Section has issued and left visible, one per semester.
  // Empty means either none were issued or the migration hasn't been run — the
  // page then falls back to the single card it showed before.
  const [cards, setCards] = useState([])
  const [sem, setSem] = useState(null)

  useEffect(() => {
    if (!student?.id) return
    async function load() {
      const [raw, mine] = await Promise.all([
        fetchStudentSelf(),
        fetchMyAdmitCards(studentSession()?.token),
      ])
      setCards(mine)
      if (raw) {
        const resolved = await resolveStudentDocUrls(raw)
        setData(resolved)
        // Show the most recent semester first — that is the exam coming up.
        const latest = mine.length ? mine[mine.length - 1] : null
        setSem(latest?.semester ?? null)
        if (latest) setSubjects(await subjectsForCard(resolved, latest))
        else if (resolved.admit_card_released_at) setSubjects(await fetchAdmitCardSubjects(resolved))
      }
      setLoading(false)
    }
    load()
  }, [student?.id])

  // Exactly the papers the Exam Section ticked for that semester. An empty
  // subject_ids list means the card was issued without a syllabus, and prints
  // "as per university curriculum".
  async function subjectsForCard(s, card) {
    const rows = await fetchSemesterSubjectRows(s, card.semester)
    return pickCardRows(rows, card).map(formatSubjectRow).filter(Boolean)
  }

  async function pickSemester(card) {
    setSem(card.semester)
    setSubjects(await subjectsForCard(data, card))
  }

  async function handleGenerate(card) {
    if (!data) return
    setGenerating(true)
    const subs = card ? await subjectsForCard(data, card)
      : (subjects.length ? subjects : await fetchAdmitCardSubjects(data))
    // Same meta shape the shared student lists pass: fetchExamSettingsMeta
    // carries examSchedule / semester / the admitCardAt release gate, and
    // fetchExamDates the exam-date list. Passing only the dates left the
    // student's own download without a schedule and skipped the date gate.
    const meta = await fetchExamSettingsMeta(data)
    const dates = await fetchExamDates(data, card?.semester)
    generateAdmitCard(data, subs, { ...meta, ...dates, ...(card ? { semester: card.semester } : {}) })
    setGenerating(false)
  }

  if (loading) return <div className="p-8 text-center text-gray-400">Loading...</div>
  if (!data) return <div className="p-8 text-center text-gray-400">No data found.</div>

  // Released either per semester (student_admit_cards) or, for records issued
  // before semester-wise cards existed, by the single flag on the student.
  const isApproved = cards.length > 0 || !!data.admit_card_released_at
  const selected = cards.find(c => c.semester === sem) || null
  const deptCode = data.centers?.center_code || (data.departments?.name ? data.departments.name.substring(0, 6).toUpperCase() : '—')
  // Ph.D has no registration number; the application number takes that slot.
  const isPhd = isPhdProgram(data.programs?.program_name)

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-gray-900 flex items-center gap-2"><BadgeCheck size={20} className="text-[#933d18]" /> Admit Card</h1>
          <p className="text-xs text-gray-400 mt-0.5">Download your exam admit card</p>
        </div>
        {cards.length === 0 && (
          <button
            onClick={() => handleGenerate(null)}
            disabled={generating || !isApproved}
            className="flex items-center gap-2 bg-[#933d18] hover:bg-[#7a3215] text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={15} /> {generating ? 'Generating...' : 'Download Admit Card'}
          </button>
        )}
      </div>

      {/* One row per semester the Exam Section has issued a card for. */}
      {cards.length > 0 && (
        <div className="space-y-2">
          {cards.map(c => (
            <div key={c.semester}
              className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 cursor-pointer transition-colors ${
                c.semester === sem ? 'border-[#933d18] bg-[#933d18]/5' : 'border-gray-200 hover:border-gray-300'}`}
              onClick={() => pickSemester(c)}>
              <div>
                <p className="text-sm font-bold text-gray-900">Semester {c.semester}</p>
                <p className="text-[11px] text-gray-400">Issued {formatDate(c.generated_at)}</p>
              </div>
              <button
                onClick={e => { e.stopPropagation(); handleGenerate(c) }}
                disabled={generating}
                className="flex items-center gap-2 bg-[#933d18] hover:bg-[#7a3215] text-white px-4 py-2 rounded-xl font-bold text-xs transition-colors disabled:opacity-50">
                <Download size={14} /> {generating ? '…' : 'Download'}
              </button>
            </div>
          ))}
        </div>
      )}

      {!isApproved && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700 font-medium">
          Admit card will be available once the Exam Section releases it for your examination.
        </div>
      )}

      {/* Preview — only visible once the Exam Section has released the admit card */}
      {isApproved && (<>
      <div className="bg-white rounded-2xl overflow-hidden shadow-lg" style={{ border: `2px solid ${BRAND}` }}>

        {/* University header */}
        <div className="flex items-center justify-center gap-3 px-5 py-4 border-b-2" style={{ borderColor: BRAND }}>
          <img src="/assets/logo.png" alt="Logo" className="w-14 h-14 rounded-full object-contain bg-white p-0.5"
            style={{ border: `2px solid ${BRAND}` }} onError={e => { e.currentTarget.style.display = 'none' }} />
          <div className="text-center">
            <p className="text-lg font-black tracking-wide" style={{ color: BRAND }}>{UNI_NAME.toUpperCase()}</p>
            <p className="text-[10px] font-semibold text-gray-500 mt-0.5">{UNI_ADDRESS}</p>
            <p className="text-[9px] text-gray-400 mt-0.5">{UNI_ESTD}</p>
          </div>
        </div>

        {/* ADMIT CARD title */}
        <div className="text-center py-2.5 border-b-2 bg-gray-50" style={{ borderColor: BRAND }}>
          <span className="font-black text-lg tracking-[0.15em]" style={{ color: BRAND }}>ADMIT CARD</span>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {data.programs?.program_name || '—'} Examination
            {selected ? ` · Semester ${selected.semester}` : ''}
            &nbsp;·&nbsp; {data.academic_sessions?.session_name || '—'}
          </p>
        </div>

        {/* 3-col reference */}
        <div className="grid grid-cols-3 border-b-2 divide-x-2 divide-[#933d18]/25" style={{ borderColor: BRAND }}>
          {[
            isPhd
              ? { label: 'Application No.', value: data.admission_number }
              : { label: 'Registration No.', value: data.registration_no },
            { label: 'Roll No (Enrollment)', value: data.enrollment_no },
            { label: 'University / Dept. Code', value: deptCode },
          ].map(({ label, value }) => (
            <div key={label} className="text-center">
              <div className="text-white text-[10px] font-bold py-1.5 tracking-wide" style={{ background: BRAND }}>{label}</div>
              <div className="py-2.5 text-sm font-black text-gray-800 font-mono">{value || '—'}</div>
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex gap-0">
          <div className="flex-1 p-5 space-y-2 border-r-2 border-gray-100">
            {[
              { label: 'Course Name', value: data.programs?.program_name },
              { label: 'Student Name', value: data.student_name },
              { label: 'Date of Birth', value: formatDate(data.date_of_birth) },
              { label: 'Session', value: data.academic_sessions?.session_name },
              { label: 'Exam Center', value: data.centers?.center_name },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-start gap-2">
                <p className="text-xs font-bold text-gray-500 w-28 shrink-0 pt-0.5">{label}</p>
                <p className="text-sm font-semibold text-gray-900 italic">: {value || '—'}</p>
              </div>
            ))}

            <div className="pt-2 border-t border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Papers to be Appeared</p>
              {subjects.length > 0 ? (
                <div className="space-y-1">
                  {subjects.map((sub, idx) => (
                    <p key={idx} className="text-xs text-gray-700 italic ml-2">{sub}</p>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500 italic">As per university curriculum — subjects will be notified separately</p>
              )}
            </div>

            <p className="text-[10px] text-gray-400 italic pt-1">✦ Check and confirm entry before the exam</p>
          </div>

          {/* Photo + signature */}
          <div className="w-36 shrink-0 p-4 text-center">
            {data.photo_url
              ? <img src={data.photo_url} alt="Photo" className="w-24 h-28 object-cover border-2 border-gray-200 rounded mx-auto" />
              : <div className="w-24 h-28 border-2 border-dashed border-gray-300 rounded flex items-center justify-center mx-auto bg-gray-50 text-xs text-gray-400 text-center">Photo</div>
            }
            <p className="text-[9px] text-gray-400 mt-1">(Student Photo)</p>

            <div className="mt-6">
              <div className="h-8 w-24 mx-auto flex items-end justify-center">
                {data.signature_url && <img src={data.signature_url} alt="Signature" className="max-h-8 max-w-[96px] object-contain" />}
              </div>
              <div className="w-24 mx-auto border-t border-gray-400" />
              <p className="text-[9px] text-gray-400 mt-1">Student Signature</p>
            </div>
          </div>
        </div>

        <div className="text-center px-4 pb-3">
          <p className="text-[9px] italic text-gray-400">This is a computer-generated Admit Card and does not require any signature or seal.</p>
        </div>

        {/* Footer band */}
        <div className="text-center py-1.5 px-4 border-t-2" style={{ background: BRAND, borderColor: BRAND }}>
          <span className="text-[10px] font-semibold text-white">{UNI_ADDRESS}</span>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-700">
        This admit card is required for all university examinations. Present it along with your valid photo ID at the exam hall.
      </div>
      </>)}
    </div>
  )
}
