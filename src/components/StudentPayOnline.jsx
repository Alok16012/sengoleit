import { useEffect, useState } from 'react'
import { CreditCard, RefreshCw } from 'lucide-react'

// Pay Online from the student's own login, through the university website's
// PayU checkout — the same one the website's Student Fee page uses. The
// website looks up what is due (re-registration fee, the admit-card
// shortfall), re-checks the amount on its server and hands back the signed
// PayU form; the PayU callback records the payment against the student. The
// keys never reach the browser.
//
// Served on the website's own address this is same-origin; on the portal
// subdomain the website answers with CORS. The body goes as text/plain so the
// browser sends no preflight.
const SITE = 'https://www.sengolinternationaluniversity.edu.in'
const api = path => (window.location.hostname.endsWith('sengolinternationaluniversity.edu.in') && window.location.hostname.startsWith('www.')
  ? path : `${SITE}${path}`)

async function post(path, body) {
  const res = await fetch(api(path), { method: 'POST', body: JSON.stringify(body) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Could not reach the payment service. Please try again.')
  return data
}

const fmt = n => `₹${Number(n || 0).toLocaleString('en-IN')}`

export default function StudentPayOnline({ student }) {
  const reference = student?.enrollment_no || student?.admission_number || student?.registration_no || ''
  const mobile = student?.mobile_no || ''
  const [due, setDue] = useState(null)       // lookup result
  const [error, setError] = useState('')
  const [paying, setPaying] = useState(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!reference || !mobile) return undefined
    let alive = true
    post('/api/student-fee/lookup', { reference, mobile })
      .then(d => { if (alive) { setDue(d); setError('') } })
      .catch(e => { if (alive) setError(e.message) })
    return () => { alive = false }
  }, [reference, mobile, tick])

  async function pay(kind, amount) {
    setPaying(kind)
    try {
      const r = await post('/api/student-fee/initiate', {
        reference, mobile, kind, amount,
        firstname: student.student_name, email: student.email,
      })
      // Hand over to PayU with the signed form the website built.
      const form = document.createElement('form')
      form.method = 'POST'
      form.action = r.paymentUrl
      Object.entries(r.params).forEach(([k, v]) => {
        const i = document.createElement('input')
        i.type = 'hidden'; i.name = k; i.value = v
        form.appendChild(i)
      })
      document.body.appendChild(form)
      form.submit()
    } catch (e) {
      alert(e.message)
      setPaying(null)
    }
  }

  if (!reference || !mobile) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 text-sm text-gray-500">
        Online payment needs your registered mobile number on record. Please contact your centre.
      </div>
    )
  }

  const items = due ? [
    { kind: 're_registration', label: `Re-Registration Fee${due.nextTerm ? ` — ${due.nextTerm}` : ''}`, amount: Number(due.reRegistrationFee) || 0, note: due.reRegistrationNote },
    { kind: 'admit_card', label: `Admit Card Fee${due.admitCardSemester ? ` — Semester ${due.admitCardSemester}` : ''}`, amount: Number(due.admitCardFee) || 0 },
  ] : []
  const payable = items.filter(i => i.amount > 0)

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CreditCard size={17} className="text-[#933d18]" />
          <h3 className="font-bold text-gray-800">Pay Online</h3>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">PayU · secure</span>
        </div>
        <button onClick={() => { setDue(null); setTick(t => t + 1) }} title="Check again" className="text-gray-400 hover:text-gray-700"><RefreshCw size={15} /></button>
      </div>
      <div className="p-4">
        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : !due ? (
          <p className="text-sm text-gray-400">Checking what is due…</p>
        ) : !payable.length ? (
          <p className="text-sm text-emerald-700 font-semibold">Nothing is due right now.</p>
        ) : (
          <div className="space-y-3">
            {payable.map(i => (
              <div key={i.kind} className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900">{i.label}</p>
                  {i.note && <p className="text-[11px] text-gray-500 mt-0.5">{i.note}</p>}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-black text-[#933d18]">{fmt(i.amount)}</span>
                  <button onClick={() => pay(i.kind, i.amount)} disabled={!!paying}
                    className="bg-[#933d18] hover:bg-[#7a3215] text-white px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50">
                    {paying === i.kind ? 'Opening PayU…' : 'Pay Now'}
                  </button>
                </div>
              </div>
            ))}
            <p className="text-[11px] text-gray-400">You will be taken to PayU to pay by UPI, card or net banking. Once paid, the fee is credited to your record automatically.</p>
          </div>
        )}
      </div>
    </div>
  )
}
