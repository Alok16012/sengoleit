import Modal from './ui/Modal'
import { semText, docLabel, studentHits, docTypeCounts } from '../utils/courierSems'

// The students a courier carried, as the admin Courier Details page and the
// centre / super centre Courier page both show them. Each student can carry
// its own document type(s) — Marksheet, Provisional, Migration, Degree,
// Other — and, for a Marksheet, which semesters.

// One student's line: name, enrollment no, documents, and semesters when a
// Marksheet is among them.
function StudentLine({ st, highlight }) {
  return (
    <div>
      <span className={`font-semibold ${highlight ? 'text-[#933d18]' : 'text-gray-900'}`}>{st.name}</span>
      {st.enrollment_no && <span className="text-xs text-gray-500"> ({st.enrollment_no})</span>}
      <div className="text-xs text-[#933d18]">{[docLabel(st), semText(st.semesters)].filter(Boolean).join(' · ')}</div>
    </div>
  )
}

// The Student column: the one student, or "N Students" with a summary, and a
// View button for the full list. A search shows the students it matched.
export function CourierStudentsCell({ courier, q, onView }) {
  const students = courier.students || []
  if (!students.length) return courier.student_name || '—'
  const hits = studentHits(courier, q)
  const shown = hits.length ? hits : students
  const summary = [...new Set(shown.map(st => [docLabel(st), semText(st.semesters)].filter(Boolean).join(' · ')))]
  const counts = docTypeCounts(shown)
  return (
    <div className="flex items-center gap-2">
      <div className="space-y-1">
        {shown.length === 1 || (hits.length > 0 && hits.length <= 3) ? shown.map(st => (
          <StudentLine key={st.id} st={st} highlight={!!hits.length} />
        )) : <span className="font-semibold text-gray-900">{shown.length} Students</span>}
        {!(shown.length === 1 || (hits.length > 0 && hits.length <= 3)) && (
          <div className="text-xs text-[#933d18]">
            {summary.length === 1 ? summary[0] : counts.map(([t, n]) => `${t}: ${n}`).join(', ')}
          </div>
        )}
        {hits.length > 0 && hits.length < students.length && (
          <div className="text-[11px] text-gray-400">of {students.length} students in this courier</div>
        )}
      </div>
      <button onClick={() => onView(courier)}
        className="ml-auto shrink-0 px-2 py-1 rounded-md text-xs font-semibold text-[#933d18] border border-[#933d18]/30 hover:bg-[#933d18]/5 whitespace-nowrap">
        View
      </button>
    </div>
  )
}

// Popup with every student of a courier; search matches highlighted.
export function CourierStudentsModal({ courier, centerName, q, onClose }) {
  const hitIds = new Set(courier ? studentHits(courier, q).map(h => h.id) : [])
  return (
    <Modal isOpen={!!courier} onClose={onClose} size="xl"
      title={courier ? `Students — ${centerName || ''}${courier.tracking_no ? ` · Tracking ${courier.tracking_no}` : ''}` : ''}>
      {courier && (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase tracking-wider">
              <tr><th className="text-left px-3 py-2">#</th><th className="text-left px-3 py-2">Student Name</th>
                <th className="text-left px-3 py-2">Enrollment No</th><th className="text-left px-3 py-2">Programme</th>
                <th className="text-left px-3 py-2">Documents</th><th className="text-left px-3 py-2">Semesters Sent</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(courier.students || []).map((st, k) => (
                <tr key={st.id} className={hitIds.has(st.id) ? 'bg-amber-50' : ''}>
                  <td className="px-3 py-2 text-gray-400">{k + 1}</td>
                  <td className="px-3 py-2 font-semibold text-gray-900">{st.name}</td>
                  <td className="px-3 py-2 font-mono text-xs">{st.enrollment_no || '—'}</td>
                  <td className="px-3 py-2 text-xs text-gray-600">{st.program || '—'}</td>
                  <td className="px-3 py-2 text-xs text-gray-600">{docLabel(st) || '—'}</td>
                  <td className="px-3 py-2 text-xs font-semibold text-[#933d18]">{semText(st.semesters) || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  )
}
