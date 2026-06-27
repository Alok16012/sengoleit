import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import PageHeader from '../../components/ui/PageHeader'
import { Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui/Table'
import { Ticket, CheckCircle2, Clock, Eye, EyeOff, Power, Mail, X, Hash, IndianRupee } from 'lucide-react'
import { formatDate } from '../../utils/formatDate'

// Toggle the Email ID step on the Activate Approval Code modal.
// Hidden for now — flip to true later to bring the email field back.
const SHOW_EMAIL = false

export default function CouponView({ type = 'wallet' }) {
  const { user } = useAuth()
  const [center, setCenter] = useState(null)
  const [coupons, setCoupons] = useState([])
  // Approval-code payment requests made from the public website (paid online / UTR).
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('All')
  const [hideTotal, setHideTotal] = useState(false)
  // Approval-code activation modal
  const [actModal, setActModal] = useState(null)   // the coupon being activated
  const [actEmail, setActEmail] = useState('')
  const [actSaving, setActSaving] = useState(false)

  useEffect(() => {
    if (!user?.email) return
    supabase.from('centers').select('id, center_name, center_code, virtual_balance').eq('email', user.email).maybeSingle()
      .then(({ data, error: err }) => {
        if (err || !data) { setError('Center not found. Contact admin.'); setLoading(false); return }
        setCenter(data)
        // Approval-code payment requests (created when the center pays on the
        // public website). Shows Amount / Transaction ID / Status here so the
        // center can track a payment after it's done. Best-effort: the table /
        // some columns may not exist yet, so it must never blank the page.
        if (type === 'approval') {
          supabase.from('approval_code_requests').select('*').eq('center_id', data.id).order('created_at', { ascending: false })
            .then(({ data: reqs, error: rErr }) => {
              if (!rErr) setRequests(reqs || [])
            })
        }
        // Order by created_at if it exists, otherwise fall back to an
        // unordered fetch so a missing column doesn't blank the list.
        supabase.from('coupons').select('*').eq('center_id', data.id).order('created_at', { ascending: false })
          .then(async ({ data: cpns, error: cpErr }) => {
            if (cpErr) {
              const plain = await supabase.from('coupons').select('*').eq('center_id', data.id)
              setCoupons(plain.data || [])
            } else {
              setCoupons(cpns || [])
            }
            setLoading(false)
          })
      })
  }, [user?.email])

  function openActivate(c) {
    setActModal(c)
    setActEmail(c.activation_email || '')
  }

  async function submitActivate(e) {
    e.preventDefault()
    const email = actEmail.trim()
    // Email is only validated/saved while the email step is shown (see SHOW_EMAIL).
    if (SHOW_EMAIL && (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      alert('Please enter a valid email ID.')
      return
    }
    setActSaving(true)
    const payload = { is_activated: true, activated_at: new Date().toISOString() }
    if (SHOW_EMAIL && email) payload.activation_email = email
    const { error: err } = await supabase.from('coupons')
      .update(payload)
      .eq('id', actModal.id)
    setActSaving(false)
    if (err) { alert('Could not activate: ' + err.message); return }
    setCoupons(prev => prev.map(c => c.id === actModal.id ? { ...c, ...(SHOW_EMAIL && email ? { activation_email: email } : {}), is_activated: true } : c))
    setActModal(null)
    setActEmail('')
  }

  async function deactivate(c) {
    if (!confirm('Deactivate this approval code?')) return
    const { error: err } = await supabase.from('coupons').update({ is_activated: false }).eq('id', c.id)
    if (err) { alert('Could not deactivate: ' + err.message); return }
    setCoupons(prev => prev.map(x => x.id === c.id ? { ...x, is_activated: false } : x))
  }

  const isApproval = type === 'approval'
  // Approval Code view only lists approval-type coupons; other views show all.
  const scoped = isApproval
    ? coupons.filter(c => (c.coupon_type || '').toLowerCase() === 'approval')
    : coupons

  const filtered = scoped.filter(c => {
    const isUsed = !!(c.is_used || c.used_at)
    if (filter === 'Used') return isUsed
    if (filter === 'Unused') return !isUsed
    return true
  })

  const total = scoped.length
  const used = scoped.filter(c => !!(c.is_used || c.used_at)).length
  const unused = total - used

  const isWallet = type === 'wallet'
  const title = isApproval ? 'Approval Codes' : isWallet ? 'Wallet Coupons' : 'Admission Coupons'
  const subtitle = isApproval
    ? 'Approval codes allocated to your center'
    : isWallet
      ? 'Coupons allocated to your center for wallet recharge'
      : 'Admission coupons allocated to your center'

  if (loading) return (
    <div className="p-6 flex items-center justify-center py-20">
      <div className="w-6 h-6 border-2 border-[#933d18] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (error) return (
    <div className="p-6">
      <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">{error}</div>
    </div>
  )

  return (
    <div className="p-6">
      <PageHeader title={title} subtitle={subtitle} />

      {center && (
        <div className="mt-4 mb-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-bold uppercase tracking-widest text-blue-500">Total Coupons</p>
              <button
                type="button"
                onClick={() => setHideTotal(h => !h)}
                title={hideTotal ? 'Show total' : 'Hide total'}
                className="text-blue-400 hover:text-blue-600 transition-colors"
              >
                {hideTotal ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <p className="text-2xl font-black text-blue-700">{hideTotal ? '••••' : total}</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-500 mb-1">Available</p>
            <p className="text-2xl font-black text-emerald-700">{unused}</p>
          </div>
          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Used</p>
            <p className="text-2xl font-black text-gray-600">{used}</p>
          </div>
          <div className="bg-[#933d18]/5 border border-[#933d18]/10 rounded-2xl p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-[#933d18]/60 mb-1">Wallet Balance</p>
            <p className="text-2xl font-black text-[#933d18]">₹{Number(center.virtual_balance || 0).toLocaleString('en-IN')}</p>
          </div>
        </div>
      )}

      {/* Approval-code payment requests made online — track Amount / Transaction
          ID / Status here. Account Dept verifies these and mints the codes. */}
      {isApproval && requests.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
            <IndianRupee size={15} className="text-[#933d18]" /> Approval Code Payment Requests
          </h2>
          <Table>
            <Thead>
              <tr>
                <Th>#</Th>
                <Th>Amount</Th>
                <Th>Transaction ID</Th>
                <Th>Requested On</Th>
                <Th>Verified On</Th>
                <Th>Status</Th>
                <Th>Remarks</Th>
              </tr>
            </Thead>
            <Tbody>
              {requests.map((r, i) => {
                const st = (r.status || 'pending').toLowerCase()
                const badge = st === 'verified'
                  ? { cls: 'bg-emerald-50 text-emerald-700', label: 'Approved', Icon: CheckCircle2 }
                  : st === 'rejected'
                    ? { cls: 'bg-red-50 text-red-700', label: 'Rejected', Icon: X }
                    : { cls: 'bg-amber-50 text-amber-700', label: 'To Verify', Icon: Clock }
                return (
                  <Tr key={r.id}>
                    <Td className="text-gray-400 text-xs w-10">{i + 1}</Td>
                    <Td className="font-bold text-gray-900">₹{Number(r.amount || 0).toLocaleString('en-IN')}</Td>
                    <Td className="font-mono text-xs text-gray-700">{r.payment_txn_id || '—'}</Td>
                    <Td className="text-gray-400 text-xs">{formatDate(r.created_at)}</Td>
                    <Td className="text-gray-400 text-xs">{formatDate(r.verified_at)}</Td>
                    <Td>
                      <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${badge.cls}`}>
                        <badge.Icon size={10} /> {badge.label}
                      </span>
                    </Td>
                    <Td className="text-gray-500 text-xs max-w-[200px]">{r.admin_remarks || '—'}</Td>
                  </Tr>
                )
              })}
            </Tbody>
          </Table>
        </div>
      )}

      <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-xl w-fit">
        {['All', 'Unused', 'Used'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              filter === s ? 'bg-white text-[#933d18] shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {s}
          </button>
        ))}
      </div>

      <Table>
        <Thead>
          <tr>
            <Th>#</Th>
            <Th>Coupon ID</Th>
            <Th>Face Value</Th>
            <Th>Generated On</Th>
            <Th>Used On</Th>
            <Th>Status</Th>
            {isApproval && <Th className="text-center">Activation</Th>}
          </tr>
        </Thead>
        <Tbody>
          {filtered.length === 0 ? (
            <Tr>
              <Td colSpan={isApproval ? 7 : 6} className="text-center text-gray-400 py-16">
                <Ticket size={28} className="mx-auto mb-2 opacity-30" />
                <p>No coupons found</p>
              </Td>
            </Tr>
          ) : filtered.map((c, i) => {
            const isUsed = !!(c.is_used || c.used_at)
            return (
              <Tr key={c.id}>
                <Td className="text-gray-400 text-xs w-10">{i + 1}</Td>
                <Td className="font-mono text-xs font-bold text-gray-800">{c.id?.slice(0, 8).toUpperCase() || '—'}</Td>
                <Td className="font-bold text-gray-900">₹{Number(c.face_value || 0).toLocaleString('en-IN')}</Td>
                <Td className="text-gray-400 text-xs">{formatDate(c.created_at)}</Td>
                <Td className="text-gray-400 text-xs">{formatDate(c.used_at)}</Td>
                <Td>
                  {isUsed ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                      <CheckCircle2 size={10} /> Used
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                      <Clock size={10} /> Available
                    </span>
                  )}
                  {isApproval && c.is_activated && c.activation_email && (
                    <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1"><Mail size={9} /> {c.activation_email}</p>
                  )}
                </Td>
                {isApproval && (
                  <Td className="text-center">
                    {/* Read-only on the center side — admin controls activation now. */}
                    {c.is_activated ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700">
                        <Power size={10} /> Activated
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-gray-50 text-gray-400">
                        Not activated
                      </span>
                    )}
                  </Td>
                )}
              </Tr>
            )
          })}
        </Tbody>
      </Table>

      {actModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setActModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Power size={18} className="text-emerald-600" />
                <h3 className="font-bold text-gray-900">Activate Approval Code</h3>
              </div>
              <button onClick={() => setActModal(null)} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
            </div>
            <form onSubmit={submitActivate} className="p-5 space-y-4">
              <div>
                <p className="text-xs text-gray-400 mb-2">Code <span className="font-mono font-bold text-gray-700">{actModal.id?.slice(0, 8).toUpperCase()}</span> · ₹{Number(actModal.face_value || 0).toLocaleString('en-IN')}</p>
                {/* Email step hidden for now — flip SHOW_EMAIL to true to bring it back. */}
                {SHOW_EMAIL && (
                  <>
                    <label className="block text-xs font-bold text-gray-600 mb-1 flex items-center gap-1.5"><Mail size={13} className="text-[#933d18]" /> Email ID</label>
                    <input type="email" autoFocus value={actEmail} onChange={e => setActEmail(e.target.value)} placeholder="name@example.com"
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#933d18] focus:ring-2 focus:ring-[#933d18]/15" />
                  </>
                )}
                {!SHOW_EMAIL && (
                  <p className="text-sm text-gray-600">Activate this approval code for your center?</p>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setActModal(null)} disabled={actSaving}
                  className="px-4 py-2 text-sm font-semibold text-gray-500 hover:text-gray-700">Cancel</button>
                <button type="submit" disabled={actSaving}
                  className="px-4 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl disabled:opacity-50">
                  {actSaving ? 'Activating...' : 'Submit & Activate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
