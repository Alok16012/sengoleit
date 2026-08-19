import { useEffect, useRef, useState } from 'react'
import { useStudentAuth } from '../../context/StudentAuthContext'
import { fetchStudentSelf } from '../../utils/studentSelf'
import { admitCardHTML, generateAdmitCard } from '../../utils/generateStudentCards'
import { resolveStudentDocUrls } from '../../utils/resolveStudentDocs'
import { fetchAdmitCardSubjects, fetchSemesterSubjectRows, formatSubjectRow } from '../../utils/fetchSyllabus'
import { fetchMyAdmitCards, pickCardRows } from '../../utils/semesterAdmitCards'
import { studentSession } from '../../utils/studentSelf'
import { fetchExamSettingsMeta, fetchExamDates } from '../../utils/examSettings'
import { BadgeCheck, Download } from 'lucide-react'
import { formatDate } from '../../utils/formatDate'

// The card is built at a fixed 680px, the width it prints at.
const CARD_WIDTH = 680

// Show the printed card itself, scaled to whatever width the page has — larger
// on a desktop, smaller on a phone. Scaling, not re-styling: what the student
// sees here is the file that downloads, down to the last row.
function CardPreview({ html }) {
  const box = useRef(null)
  const card = useRef(null)
  const [scale, setScale] = useState(1)
  const [height, setHeight] = useState(0)

  useEffect(() => {
    const b = box.current, c = card.current
    if (!b || !c) return
    const fit = () => {
      const s = Math.min(b.clientWidth / CARD_WIDTH, 1.3)
      setScale(s)
      setHeight(c.offsetHeight * s)
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(b)
    // The photo and logos arrive after the markup and change the card's height.
    const imgs = [...c.querySelectorAll('img')]
    imgs.forEach(i => i.addEventListener('load', fit))
    return () => { ro.disconnect(); imgs.forEach(i => i.removeEventListener('load', fit)) }
  }, [html])

  return (
    <div ref={box} style={{ height: height || undefined }} className="overflow-hidden">
      <div ref={card} style={{ width: CARD_WIDTH, transform: `scale(${scale})`, transformOrigin: 'top left' }}
        dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}

// Exactly the papers the Exam Section ticked for that semester. An empty
// subject list means the card was issued without a syllabus, and prints
// "as per university curriculum".
async function subjectsForCard(s, card) {
  const rows = await fetchSemesterSubjectRows(s, card.semester)
  return pickCardRows(rows, card).map(formatSubjectRow).filter(Boolean)
}

// Same meta shape the shared student lists pass: fetchExamSettingsMeta carries
// examSchedule / the admitCardAt release gate, and fetchExamDates the
// examination dates for that term. Passing only the dates left the student's
// own download without a schedule and skipped the date gate.
async function cardMeta(s, card) {
  const [settings, dates] = await Promise.all([
    fetchExamSettingsMeta(s),
    fetchExamDates(s, card?.semester),
  ])
  return { ...settings, ...dates, ...(card ? { semester: card.semester } : {}) }
}

// The papers and the rendered card for one semester.
async function buildCard(s, card) {
  const subs = card ? await subjectsForCard(s, card) : await fetchAdmitCardSubjects(s)
  return { subs, html: admitCardHTML(s, subs, await cardMeta(s, card)) }
}

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
  const [preview, setPreview] = useState('')

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
        if (latest || resolved.admit_card_released_at) {
          const built = await buildCard(resolved, latest)
          setSubjects(built.subs)
          setPreview(built.html)
        }
      }
      setLoading(false)
    }
    load()
  }, [student?.id])

  async function pickSemester(card) {
    setSem(card.semester)
    const built = await buildCard(data, card)
    setSubjects(built.subs)
    setPreview(built.html)
  }

  async function handleGenerate(card) {
    if (!data) return
    setGenerating(true)
    const subs = card ? await subjectsForCard(data, card)
      : (subjects.length ? subjects : await fetchAdmitCardSubjects(data))
    generateAdmitCard(data, subs, await cardMeta(data, card))
    setGenerating(false)
  }

  if (loading) return <div className="p-8 text-center text-gray-400">Loading...</div>
  if (!data) return <div className="p-8 text-center text-gray-400">No data found.</div>

  // Released either per semester (student_admit_cards) or, for records issued
  // before semester-wise cards existed, by the single flag on the student.
  const isApproved = cards.length > 0 || !!data.admit_card_released_at

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

      {/* Preview — the card that downloads, not a second copy of it. */}
      {isApproved && (<>
      <div className="bg-white rounded-2xl overflow-hidden shadow-lg p-3">
        <CardPreview html={preview} />
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-700">
        This admit card is required for all university examinations. Present it along with your valid photo ID at the exam hall.
      </div>
      </>)}
    </div>
  )
}
