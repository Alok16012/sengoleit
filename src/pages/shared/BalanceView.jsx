import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui/Table'
import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'
import DateInput from '../../components/ui/DateInput'
import { Wallet, Plus, Upload, RefreshCw, AlertCircle, CheckCircle2, Pencil, TrendingDown } from 'lucide-react'
import { formatDate } from '../../utils/formatDate'

export default function BalanceView() {
  const { user } = useAuth()
  const [center, setCenter] = useState(null)
  const [centerErr, setCenterErr] = useState('')
  const [requests, setRequests] = useState([])
  const [statusFilter, setStatusFilter] = useState('all')
  // Super center only: list of its sub-centers + a center-wise filter.
  const [subCenters, setSubCenters] = useState([])
  const [centerFilter, setCenterFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [existingScreenshotUrl, setExistingScreenshotUrl] = useState(null)
  const [form, setForm] = useState({ amount: '', utr_number: '', payment_date: '', notes: '' })
  const [screenshot, setScreenshot] = useState(null)
  const [screenshotPreview, setScreenshotPreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const [submitErr, setSubmitErr] = useState('')
  const [success, setSuccess] = useState(false)
  const fileRef = useRef()

  useEffect(() => {
    if (!user) return
    supabase.from('centers').select('id, center_name, center_code, virtual_balance, center_type').eq('email', user.email).maybeSingle()
      .then(async ({ data, error }) => {
        if (error) { setCenterErr(`Center lookup failed: ${error.message}`); setLoading(false); return }
        if (!data) { setCenterErr('No center found linked to your account. Contact admin.'); setLoading(false); return }
        setCenter(data)
        if (data.center_type === 'super_center') {
          // Super center sees the recharge history of all its centers, not its own.
          const { data: subs } = await supabase.from('centers')
            .select('id, center_name, center_code').eq('super_center_id', data.id).order('center_name')
          setSubCenters(subs || [])
          const ids = (subs || []).map(s => s.id)
          if (ids.length) {
            const { data: reqs } = await supabase.from('recharge_requests')
              .select('*, centers(center_name, center_code)').in('center_id', ids).order('created_at', { ascending: false })
            setRequests(reqs || [])
          } else {
            setRequests([])
          }
          setLoading(false)
        } else {
          fetchRequests(data.id)
        }
      })
  }, [user])

  async function fetchRequests(centerId) {
    setLoading(true)
    const { data } = await supabase.from('recharge_requests').select('*').eq('center_id', centerId).order('created_at', { ascending: false })
    setRequests(data || [])
    setLoading(false)
  }

  const isSuperCenter = center?.center_type === 'super_center'

  function openModal() {
    setEditingId(null)
    setExistingScreenshotUrl(null)
    setForm({ amount: '', utr_number: '', payment_date: '', notes: '' })
    setScreenshot(null)
    setScreenshotPreview(null)
    setSubmitErr('')
    setModal(true)
  }

  // Edit a recharge that the Account Dept put On Hold, so the center can
  // correct the details (UTR / receipt etc.) and resubmit for verification.
  function openEditModal(r) {
    setEditingId(r.id)
    setExistingScreenshotUrl(r.utr_screenshot_url || null)
    setForm({
      amount: r.amount != null ? String(r.amount) : '',
      utr_number: r.utr_number || '',
      payment_date: r.payment_date || '',
      notes: r.notes || '',
    })
    setScreenshot(null)
    setScreenshotPreview(r.utr_screenshot_url || null)
    setSubmitErr('')
    setModal(true)
  }

  function handleFileChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setScreenshot(file)
    setScreenshotPreview(URL.createObjectURL(file))
  }

  async function handleSubmit() {
    if (!form.amount || !form.utr_number || !form.payment_date) {
      setSubmitErr('Amount, UTR number, and Payment Date are required.')
      return
    }
    if (Number(form.amount) < 5000) {
      setSubmitErr('Minimum deposit amount is ₹5,000.')
      return
    }
    // When editing a held request the existing receipt can be kept; only a
    // brand-new request strictly requires a freshly uploaded screenshot.
    if (!screenshot && !(editingId && existingScreenshotUrl)) {
      setSubmitErr('Payment screenshot is required. Please upload the payment receipt.')
      return
    }
    if (!center) { setSubmitErr('Center not loaded. Refresh the page and try again.'); return }

    setSaving(true)
    setSubmitErr('')

    try {
      let screenshotUrl = editingId ? existingScreenshotUrl : null

      if (screenshot) {
        const fileName = `recharge/${center.id}/${Date.now()}_${screenshot.name}`
        const { data: uploadData, error: upErr } = await supabase.storage.from('documents').upload(fileName, screenshot)
        if (upErr) { setSubmitErr(`Screenshot upload failed: ${upErr.message}`); setSaving(false); return }
        if (uploadData) {
          const { data: urlData } = supabase.storage.from('documents').getPublicUrl(fileName)
          screenshotUrl = urlData.publicUrl
        }
      }

      if (editingId) {
        // Resubmit a held request: update its details and send it back to
        // pending so the Account Dept reviews it again. Clear the old remark.
        const { error: updErr } = await supabase.from('recharge_requests')
          .update({
            amount: Number(form.amount),
            utr_number: form.utr_number,
            payment_date: form.payment_date || null,
            utr_screenshot_url: screenshotUrl,
            notes: form.notes,
            status: 'pending',
            verified_at: null,
            admin_remarks: null,
          })
          .eq('id', editingId)
          .eq('status', 'hold')
        if (updErr) { setSubmitErr(`Failed to resubmit: ${updErr.message}`); setSaving(false); return }
      } else {
        const { error: insErr } = await supabase.from('recharge_requests').insert({
          center_id: center.id,
          amount: Number(form.amount),
          utr_number: form.utr_number,
          payment_date: form.payment_date || null,
          utr_screenshot_url: screenshotUrl,
          notes: form.notes,
          status: 'pending',
        })
        if (insErr) { setSubmitErr(`Failed to submit: ${insErr.message}`); setSaving(false); return }
      }

      setSaving(false)
      setModal(false)
      setEditingId(null)
      setExistingScreenshotUrl(null)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 4000)
      fetchRequests(center.id)
    } catch (err) {
      setSubmitErr(`Unexpected error: ${err.message}`)
      setSaving(false)
    }
  }

  const totalPending = requests.filter(r => r.status === 'pending').reduce((s, r) => s + r.amount, 0)
  // Total recharged (all verified) vs currently available vs used (spent).
  const totalRecharged = requests.filter(r => r.status === 'verified').reduce((s, r) => s + Number(r.amount || 0), 0)
  const availableBalance = Number(center?.virtual_balance || 0)
  const usedBalance = Math.max(0, totalRecharged - availableBalance)

  // Status sub-filter for the recharge history table.
  const STATUS_MATCH = {
    all:      () => true,
    pending:  r => r.status === 'pending',
    hold:     r => r.status === 'hold',
    verified: r => r.status === 'verified',
    rejected: r => r.status === 'rejected',
  }
  const statusCounts = {
    pending:  requests.filter(STATUS_MATCH.pending).length,
    hold:     requests.filter(STATUS_MATCH.hold).length,
    verified: requests.filter(STATUS_MATCH.verified).length,
    rejected: requests.filter(STATUS_MATCH.rejected).length,
  }
  const filteredRequests = requests
    .filter(STATUS_MATCH[statusFilter] || (() => true))
    .filter(r => !isSuperCenter || centerFilter === 'all' || r.center_id === centerFilter)

  return (
    <div className="p-6">
      <PageHeader
        title="Virtual Balance"
        subtitle={isSuperCenter ? 'Recharge history of your centers' : 'Recharge your account to register students'}
        action={isSuperCenter ? undefined : { label: <><Plus size={15} /> Request Recharge</>, onClick: openModal }}
      />

      {centerErr && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-sm text-red-700">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{centerErr}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4 text-sm text-emerald-700">
          <CheckCircle2 size={16} className="shrink-0" />
          <span>Recharge request submitted successfully! Account department will verify shortly.</span>
        </div>
      )}

      {/* Balance Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <div className="bg-gradient-to-br from-[#933d18] to-[#7d3314] rounded-2xl p-4 text-white">
          <div className="flex items-center gap-2 mb-2">
            <Wallet size={16} className="opacity-80" />
            <p className="text-xs font-semibold opacity-80">Available Balance</p>
          </div>
          <p className="text-2xl font-bold">₹{availableBalance.toLocaleString()}</p>
          <p className="text-[11px] opacity-60 mt-1 truncate">{center?.center_name}</p>
        </div>

        {!isSuperCenter && (
          <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown size={16} className="text-orange-600" />
              <p className="text-xs font-semibold text-orange-700">Used Balance</p>
            </div>
            <p className="text-2xl font-bold text-orange-800">₹{usedBalance.toLocaleString()}</p>
            <p className="text-[11px] text-orange-500 mt-1">Spent so far</p>
          </div>
        )}

        {!isSuperCenter && (
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Wallet size={16} className="text-blue-500" />
              <p className="text-xs font-semibold text-blue-700">Total Balance</p>
            </div>
            <p className="text-2xl font-bold text-blue-800">₹{totalRecharged.toLocaleString()}</p>
            <p className="text-[11px] text-blue-500 mt-1">Total recharged</p>
          </div>
        )}

        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <RefreshCw size={16} className="text-amber-600" />
            <p className="text-xs font-semibold text-amber-700">Pending Recharges</p>
          </div>
          <p className="text-2xl font-bold text-amber-800">₹{Number(totalPending).toLocaleString()}</p>
          <p className="text-[11px] text-amber-500 mt-1">Awaiting verification</p>
        </div>

        <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <RefreshCw size={16} className="text-gray-400" />
            <p className="text-xs font-semibold text-gray-600">Total Requests</p>
          </div>
          <p className="text-2xl font-bold text-gray-800">{requests.length}</p>
          <p className="text-[11px] text-gray-400 mt-1">All time requests</p>
        </div>
      </div>

      {/* Requests Table */}
      <h2 className="text-sm font-bold text-gray-700 mb-3">Recharge History</h2>

      {isSuperCenter && (
        <div className="mb-3">
          <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Center</label>
          <select value={centerFilter} onChange={e => setCenterFilter(e.target.value)}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#933d18]/20">
            <option value="all">All Centers</option>
            {subCenters.map(sc => (
              <option key={sc.id} value={sc.id}>{sc.center_name}{sc.center_code ? ` (${sc.center_code})` : ''}</option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-wrap gap-1 mb-4 bg-gray-100 p-1 rounded-xl w-fit">
        {[
          { key: 'all',      label: 'All',      color: 'bg-gray-500' },
          { key: 'pending',  label: 'Pending',  color: 'bg-amber-500' },
          { key: 'hold',     label: 'Hold',     color: 'bg-indigo-500' },
          { key: 'verified', label: 'Verified', color: 'bg-emerald-500' },
          { key: 'rejected', label: 'Rejected', color: 'bg-red-500' },
        ].map(s => (
          <button
            key={s.key}
            onClick={() => setStatusFilter(s.key)}
            className={`relative px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              statusFilter === s.key ? 'bg-white text-[#933d18] shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {s.label}
            {s.key !== 'all' && statusCounts[s.key] > 0 && (
              <span className={`ml-2 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ${s.color}`}>{statusCounts[s.key]}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Loading...</div>
      ) : (
        <Table>
          <Thead>
            <tr>
              <Th>#</Th>
              {isSuperCenter && <Th>Center</Th>}
              <Th>Amount</Th>
              <Th>UTR Number</Th>
              <Th>Payment Date</Th>
              <Th>Screenshot</Th>
              <Th>Notes</Th>
              <Th>Requested On</Th>
              <Th>Verified On</Th>
              <Th>Status</Th>
              <Th>Admin Remarks</Th>
              <Th>Action</Th>
            </tr>
          </Thead>
          <Tbody>
            {filteredRequests.length === 0 ? (
              <Tr><Td colSpan={isSuperCenter ? 12 : 11} className="text-center text-gray-400 py-12">No {statusFilter === 'all' ? '' : statusFilter + ' '}recharge requests{statusFilter === 'all' ? ' yet' : ''}</Td></Tr>
            ) : filteredRequests.map((r, i) => (
              <Tr key={r.id}>
                <Td className="text-gray-400 text-xs w-10">{i + 1}</Td>
                {isSuperCenter && (
                  <Td>
                    <p className="font-semibold text-gray-900 text-sm">{r.centers?.center_name || '—'}</p>
                    {r.centers?.center_code && <span className="text-[10px] text-gray-400 font-mono">{r.centers.center_code}</span>}
                  </Td>
                )}
                <Td><span className="font-bold text-gray-900">₹{Number(r.amount).toLocaleString()}</span></Td>
                <Td className="font-mono text-sm text-gray-700">{r.utr_number || '—'}</Td>
                <Td className="text-gray-500 text-xs">{formatDate(r.payment_date)}</Td>
                <Td>
                  {r.utr_screenshot_url ? (
                    <a href={r.utr_screenshot_url} target="_blank" rel="noreferrer" className="text-[#933d18] text-xs font-semibold underline">View</a>
                  ) : '—'}
                </Td>
                <Td className="text-gray-500 text-xs">{r.notes || '—'}</Td>
                <Td className="text-gray-400 text-xs">{formatDate(r.created_at)}</Td>
                <Td className="text-gray-400 text-xs">{formatDate(r.verified_at)}</Td>
                <Td><Badge status={r.status?.toLowerCase()}>{r.status || 'Pending'}</Badge></Td>
                <Td className="text-gray-500 text-xs max-w-[200px]">{r.admin_remarks || '—'}</Td>
                <Td>
                  {r.status === 'hold' ? (
                    <button
                      onClick={() => openEditModal(r)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-[#933d18] bg-[#933d18]/8 border border-[#933d18]/20 px-3 py-1.5 rounded-lg hover:bg-[#933d18]/15 transition-colors"
                    >
                      <Pencil size={12} /> Edit & Resubmit
                    </button>
                  ) : (
                    <span className="text-gray-300 text-xs">—</span>
                  )}
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      {/* Recharge Modal */}
      <Modal isOpen={modal} onClose={() => setModal(false)} title={editingId ? 'Edit & Resubmit Recharge' : 'Request Recharge'}>
        <div className="space-y-4">
          <div>
            <Input
              label="Amount (₹) *"
              type="number"
              min="5000"
              placeholder="E.g. 5000"
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
            />
            <p className="text-xs text-gray-400 mt-1">Minimum deposit amount is ₹5,000</p>
          </div>
          <Input
            label="UTR / Transaction Number *"
            placeholder="E.g. UTR123456789"
            value={form.utr_number}
            onChange={e => setForm(f => ({ ...f, utr_number: e.target.value }))}
          />
          <DateInput
            label="Payment Date *"
            value={form.payment_date}
            onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))}
          />
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-1">Payment Screenshot *</p>
            <div
              className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center cursor-pointer hover:border-[#933d18]/40 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              {screenshotPreview ? (
                <img src={screenshotPreview} alt="preview" className="max-h-32 mx-auto rounded-lg object-contain" />
              ) : (
                <div className="py-4">
                  <Upload size={24} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-sm text-gray-400">Click to upload payment screenshot</p>
                  <p className="text-xs text-gray-300 mt-1">PNG, JPG up to 5MB</p>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Notes (optional)</label>
            <textarea
              className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-[#933d18] resize-none"
              rows={2}
              placeholder="Any additional info..."
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700">
            After submitting, the Account Department will verify your payment and credit the balance to your account.
          </div>
          {submitErr && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>{submitErr}</span>
            </div>
          )}
          <div className="flex gap-3 pt-1">
            <Button onClick={handleSubmit} disabled={saving}>{saving ? 'Submitting...' : editingId ? 'Resubmit Request' : 'Submit Request'}</Button>
            <Button variant="outline" onClick={() => setModal(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
