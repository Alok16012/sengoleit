import { useEffect, useState } from 'react'
import { X, RefreshCw, Wallet, CheckCircle2, AlertTriangle } from 'lucide-react'
import Button from './ui/Button'
import { formatDate } from '../utils/formatDate'
import {
  nextTerm, reRegistrationFee, requestReRegistration,
  approveReRegistration, rejectReRegistration,
} from '../utils/reRegistration'

// Re-Registration for one student.
//   mode="request" — the centre raises it
//   mode="review"  — the admin approves or rejects it
export default function ReRegistrationModal({ student, request, mode, onClose, onDone }) {
  const [info, setInfo] = useState(null)
  const [remarks, setRemarks] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const term = nextTerm(student)

  useEffect(() => {
    let alive = true
    reRegistrationFee(student)
      .then(r => { if (alive) setInfo(r) })
      .catch(() => { if (alive) setInfo({ fee: 0, hold: 0 }) })
    return () => { alive = false }
  }, [student])

  // A pending request carries the amount agreed when it was raised — capped at
  // what the target term still lacks TODAY, mirroring the approval: the Exam
  // Section may have collected the term's fee since (its admit-card Collect
  // flow), and the admin should see the ₹0 that will actually be taken, not
  // the stale figure.
  const holdAmount = request
    ? Math.min(Number(request.fee_amount || 0), info?.outstanding ?? Number(request.fee_amount || 0))
    : (info?.hold ?? 0)

  async function submit() {
    setBusy(true); setErr('')
    let res
    if (mode === 'request') res = await requestReRegistration({ student, feeAmount: info?.hold || 0, remarks })
    else res = await approveReRegistration(request)
    setBusy(false)
    if (res?.error) { setErr(res.error.message || 'Could not complete this.'); return }
    onDone?.()
  }

  async function reject() {
    if (!confirm('Reject this re-registration request?')) return
    setBusy(true); setErr('')
    const { error } = await rejectReRegistration(request, remarks)
    setBusy(false)
    if (error) { setErr(error.message); return }
    onDone?.()
  }

  const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <RefreshCw size={17} className="text-[#933d18]" />
            <div>
              <h3 className="font-bold text-gray-900 leading-tight">Re-Registration</h3>
              <p className="text-xs text-gray-400">{student.student_name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          {term.atEnd && !request ? (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              <span>This student is already in the final {term.unit.toLowerCase()} ({term.currentLabel}) of the programme — there is nothing to re-register into.</span>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-[11px] text-gray-400">Current</p>
                  <p className="text-sm font-bold text-gray-800">{request?.from_term || term.currentLabel}</p>
                </div>
                <div className="bg-[#933d18]/5 rounded-xl p-3">
                  <p className="text-[11px] text-gray-400">Re-registering into</p>
                  <p className="text-sm font-bold text-[#933d18]">{request?.to_term || term.nextLabel}</p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-wide">
                  <Wallet size={12} /> Fee
                </div>
                {info == null && !request ? (
                  <p className="text-sm text-gray-400">Calculating…</p>
                ) : (
                  <>
                    {!request && (
                      <p className="text-xs text-gray-500">
                        {term.nextLabel} fee: <span className="font-semibold text-gray-700">{money(info?.fee)}</span>
                      </p>
                    )}
                    <p className="text-sm">
                      <span className="text-gray-500">Held from the centre's wallet: </span>
                      <span className="font-black text-[#933d18]">{money(holdAmount)}</span>
                    </p>
                  </>
                )}
              </div>

              {request && (
                <p className="text-xs text-gray-500">
                  Requested on {formatDate(request.requested_at)}
                  {request.remarks ? ` · "${request.remarks}"` : ''}
                </p>
              )}

              {mode === 'request' && !request && (
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Remarks (optional)</label>
                  <input value={remarks} onChange={e => setRemarks(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#933d18]/30"
                    placeholder="Anything the university should know" />
                </div>
              )}

              {mode === 'request' && !request && (
                <p className="text-[11px] text-gray-400">
                  The university reviews this request. The fee is held only once it is approved.
                </p>
              )}
            </>
          )}

          {err && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" /><span>{err}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <Button variant="secondary" size="md" onClick={onClose}>Cancel</Button>
          {mode === 'review' && request && (
            <Button variant="secondary" size="md" onClick={reject} disabled={busy}>Reject</Button>
          )}
          {!(term.atEnd && !request) && (
            <Button variant="primary" size="md" onClick={submit} disabled={busy || (mode === 'request' && info == null)}>
              <CheckCircle2 size={14} />
              {busy ? 'Working…' : mode === 'review' ? 'Approve & Hold Fee' : 'Send Request'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
