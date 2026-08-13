import { useEffect, useState } from 'react'
import { X, ScrollText, Lock } from 'lucide-react'
import Button from './ui/Button'
import { registrationYears } from '../utils/reRegistration'
import { generateRegistrationCertificate } from '../utils/generateStudentCards'
import { resolveStudentDocUrls } from '../utils/resolveStudentDocs'

// The Registration Certificate is issued once per YEAR of the course — a
// 6-semester course has three (Sem 1, Sem 3, Sem 5). A year unlocks once the
// fee up to its opening semester is cleared, matching the admit-card gate.
export default function RegistrationCardModal({ student, onClose }) {
  const [years, setYears] = useState(null)
  const [busy, setBusy] = useState(null)

  useEffect(() => {
    let alive = true
    registrationYears(student)
      .then(y => { if (alive) setYears(y) })
      .catch(() => { if (alive) setYears([]) })
    return () => { alive = false }
  }, [student])

  async function generate(y) {
    setBusy(y.year)
    // The certificate prints the photo and signature, which live in a private
    // bucket — sign them first.
    const resolved = await resolveStudentDocUrls(student)
    generateRegistrationCertificate(resolved, { year: y.year, fromSem: y.fromSem, toSem: y.toSem })
    setBusy(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <ScrollText size={17} className="text-[#933d18]" />
            <div>
              <h3 className="font-bold text-gray-900 leading-tight">Registration Certificate</h3>
              <p className="text-xs text-gray-400">{student.student_name} · pick a year</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
        </div>

        <div className="p-5">
          {years == null ? (
            <p className="text-center text-gray-400 py-8 text-sm">Loading…</p>
          ) : !years.length ? (
            <p className="text-center text-gray-400 py-8 text-sm">
              This programme has no duration set, so its years can't be worked out.
            </p>
          ) : (
            <>
              <p className="text-[11px] text-gray-400 mb-3">
                Fee collected: <span className="font-bold text-gray-700">₹{Number(student.fee_collected || 0).toLocaleString('en-IN')}</span>.
                A year unlocks once the university's share of its first semester's fee is in.
              </p>
              <div className="space-y-2">
                {years.map(y => (
                  <div key={y.year}
                    className={`flex items-center justify-between rounded-xl border px-4 py-2.5 ${y.cleared ? 'border-gray-200' : 'border-gray-100 bg-gray-50'}`}>
                    <div>
                      <p className={`text-sm font-bold ${y.cleared ? 'text-gray-900' : 'text-gray-400'}`}>Year {y.year}</p>
                      <p className="text-[11px] text-gray-400">
                        Semester {y.fromSem}{y.toSem !== y.fromSem ? `–${y.toSem}` : ''} · to collect ₹{Number(y.dueFee).toLocaleString('en-IN')}
                      </p>
                    </div>
                    {y.cleared ? (
                      <Button size="sm" variant="primary" disabled={busy === y.year} onClick={() => generate(y)}>
                        <ScrollText size={13} /> {busy === y.year ? '…' : 'Generate'}
                      </Button>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-gray-400"><Lock size={12} /> Fee pending</span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
