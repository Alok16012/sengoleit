import { useEffect, useState } from 'react'
import { X, ClipboardList } from 'lucide-react'
import Button from './ui/Button'
import { supabase } from '../lib/supabase'
import { admitCardsFor, issuedAdmitCard } from '../utils/semesterAdmitCards'
import { generateAdmitCard } from '../utils/generateStudentCards'
import { resolveStudentDocUrls } from '../utils/resolveStudentDocs'
import { fetchExamSettingsMeta, fetchExamDates } from '../utils/examSettings'
import { formatDate } from '../utils/formatDate'

// Every semester the Exam Section has issued a card for, so it can be
// downloaded from the main Students list without going to the Exam Section —
// the list's own admit-card action used to print only the latest semester.
export default function AdmitCardListModal({ student, onClose }) {
  const [cards, setCards] = useState(null)   // null = loading, [] = none issued
  const [busy, setBusy] = useState(null)

  useEffect(() => {
    let alive = true
    admitCardsFor(student.id).then(bySem => {
      if (!alive) return
      setCards(Object.values(bySem || {}).sort((a, b) => a.semester - b.semester))
    })
    return () => { alive = false }
  }, [student.id])

  async function download(card) {
    setBusy(card.semester)
    const { data: s } = await supabase
      .from('students')
      .select('*, programs(program_name), academic_sessions(session_name), centers(center_name, center_code), departments(name), study_modes(mode_name)')
      .eq('id', student.id)
      .single()
    if (s) {
      const resolved = await resolveStudentDocUrls(s)
      const issued = await issuedAdmitCard(resolved, card.semester)
      const meta = await fetchExamSettingsMeta(resolved)
      const dates = await fetchExamDates(resolved, card.semester)
      generateAdmitCard(resolved, issued?.subjects || [], { ...meta, ...dates, semester: card.semester })
    }
    setBusy(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <ClipboardList size={17} className="text-[#933d18]" />
            <div>
              <h3 className="font-bold text-gray-900 leading-tight">Admit Card</h3>
              <p className="text-xs text-gray-400">{student.student_name} · issued semesters</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
        </div>

        <div className="p-5">
          {cards == null ? (
            <p className="text-center text-gray-400 py-8 text-sm">Loading…</p>
          ) : !cards.length ? (
            <p className="text-center text-gray-400 py-8 text-sm">
              No admit card has been issued yet — these are issued per semester from the Exam Section.
            </p>
          ) : (
            <div className="space-y-2">
              {cards.map(card => (
                <div key={card.semester} className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-2.5">
                  <div>
                    <p className="text-sm font-bold text-gray-900">Semester {card.semester}</p>
                    <p className="text-[11px] text-gray-400">
                      Issued {formatDate(card.generated_at)} ·{' '}
                      <span className={card.released_at ? 'text-emerald-600 font-semibold' : 'text-gray-400 font-semibold'}>
                        {card.released_at ? 'active — student can see it' : 'deactive — student cannot see it'}
                      </span>
                    </p>
                  </div>
                  <Button size="sm" variant="primary" disabled={busy === card.semester} onClick={() => download(card)}>
                    <ClipboardList size={13} /> {busy === card.semester ? '…' : 'Download'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
