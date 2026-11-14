import { useState } from 'react'
import { CreditCard } from 'lucide-react'

// Pay Now from the student's own login: the student types an amount and pays
// it through the university website's PayU checkout. The website checks the
// student and the amount on its server and hands back the signed PayU form;
// the PayU callback credits the payment to the student. The keys never reach
// the browser.
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
  const [amount, setAmount] = useState('')
  const [paying, setPaying] = useState(false)

  // Student types the amount and pays — the 'fee' kind takes any amount from
  // Rs 1 to Rs 5,00,000, credited to the student's fee once PayU confirms it.
  async function pay(e) {
    e.preventDefault()
    const value = Math.round(Number(amount) * 100) / 100
    if (!(value >= 1)) return alert('Enter the amount to pay.')
    if (value > 500000) return alert('The most you can pay at once is ₹5,00,000.')
    setPaying(true)
    try {
      const r = await post('/api/student-fee/initiate', {
        reference, mobile, kind: 'fee', amount: value,
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
    } catch (err) {
      alert(err.message)
      setPaying(false)
    }
  }

  if (!reference || !mobile) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 text-sm text-gray-500">
        Online payment needs your registered mobile number on record. Please contact your centre.
      </div>
    )
  }

  return (
    <form onSubmit={pay} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4 max-w-md">
      <div>
        <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Amount (₹)</label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₹</span>
          <input type="number" inputMode="decimal" min="1" max="500000" step="0.01" autoFocus
            value={amount} onChange={e => setAmount(e.target.value)} placeholder="0"
            className="w-full pl-9 pr-4 py-3.5 border border-gray-200 rounded-xl text-2xl font-black text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
        </div>
      </div>
      <button type="submit" disabled={paying}
        className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-xl text-base font-bold disabled:opacity-50 transition-colors">
        <CreditCard size={18} /> {paying ? 'Opening PayU…' : `Pay${Number(amount) >= 1 ? ` ${fmt(amount)}` : ''}`}
      </button>
      <p className="text-[11px] text-gray-400 text-center">Secure payment by PayU — UPI, card or net banking.</p>
    </form>
  )
}
