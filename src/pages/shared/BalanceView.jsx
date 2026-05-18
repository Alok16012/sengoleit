import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import { Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui/Table'
import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'
import { Wallet, Plus, Upload, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react'

export default function BalanceView() {
  const { user } = useAuth()
  const [center, setCenter] = useState(null)
  const [centerErr, setCenterErr] = useState('')
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
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
      .then(({ data, error }) => {
        if (error) { setCenterErr(`Center lookup failed: ${error.message}`); setLoading(false); return }
        if (!data) { setCenterErr('No center found linked to your account. Contact admin.'); setLoading(false); return }
        setCenter(data)
        fetchRequests(data.id)
      })
  }, [user])

  async function fetchRequests(centerId) {
    setLoading(true)
    const { data } = await supabase.from('recharge_requests').select('*').eq('center_id', centerId).order('created_at', { ascending: false })
    setRequests(data || [])
    setLoading(false)
  }

  function openModal() {
    setForm({ amount: '', utr_number: '', payment_date: '', notes: '' })
    setScreenshot(null)
    setScreenshotPreview(null)
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
    if (!center) { setSubmitErr('Center not loaded. Refresh the page and try again.'); return }

    setSaving(true)
    setSubmitErr('')

    try {
      let screenshotUrl = null

      if (screenshot) {
        const fileName = `recharge/${center.id}/${Date.now()}_${screenshot.name}`
        const { data: uploadData, error: upErr } = await supabase.storage.from('documents').upload(fileName, screenshot)
        if (upErr) console.warn('Screenshot upload failed:', upErr.message)
        else if (uploadData) {
          const { data: urlData } = supabase.storage.from('documents').getPublicUrl(fileName)
          screenshotUrl = urlData.publicUrl
        }
      }

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

      setSaving(false)
      setModal(false)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 4000)
      fetchRequests(center.id)
    } catch (err) {
      setSubmitErr(`Unexpected error: ${err.message}`)
      setSaving(false)
    }
  }

  const totalPending = requests.filter(r => r.status === 'pending').reduce((s, r) => s + r.amount, 0)

  return (
    <div className="p-6">
      <PageHeader
        title="Virtual Balance"
        subtitle="Recharge your account to register students"
        action={{ label: <><Plus size={15} /> Request Recharge</>, onClick: openModal }}
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

      {/* Balance Card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-[#933d18] to-[#7d3314] rounded-2xl p-6 text-white">
          <div className="flex items-center gap-3 mb-3">
            <Wallet size={20} className="opacity-80" />
            <p className="text-sm font-semibold opacity-80">Available Balance</p>
          </div>
          <p className="text-3xl font-bold">₹{Number(center?.virtual_balance || 0).toLocaleString()}</p>
          <p className="text-xs opacity-60 mt-1">{center?.center_name}</p>
        </div>

        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <RefreshCw size={20} className="text-amber-600" />
            <p className="text-sm font-semibold text-amber-700">Pending Recharges</p>
          </div>
          <p className="text-3xl font-bold text-amber-800">₹{Number(totalPending).toLocaleString()}</p>
          <p className="text-xs text-amber-500 mt-1">Awaiting Account Dept verification</p>
        </div>

        <div className="bg-gray-50 border border-gray-100 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <RefreshCw size={20} className="text-gray-400" />
            <p className="text-sm font-semibold text-gray-600">Total Requests</p>
          </div>
          <p className="text-3xl font-bold text-gray-800">{requests.length}</p>
          <p className="text-xs text-gray-400 mt-1">All time recharge requests</p>
        </div>
      </div>

      {/* Requests Table */}
      <h2 className="text-sm font-bold text-gray-700 mb-3">Recharge History</h2>
      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Loading...</div>
      ) : (
        <Table>
          <Thead>
            <tr>
              <Th>#</Th>
              <Th>Amount</Th>
              <Th>UTR Number</Th>
              <Th>Payment Date</Th>
              <Th>Screenshot</Th>
              <Th>Notes</Th>
              <Th>Requested On</Th>
              <Th>Verified On</Th>
              <Th>Status</Th>
            </tr>
          </Thead>
          <Tbody>
            {requests.length === 0 ? (
              <Tr><Td colSpan={9} className="text-center text-gray-400 py-12">No recharge requests yet</Td></Tr>
            ) : requests.map((r, i) => (
              <Tr key={r.id}>
                <Td className="text-gray-400 text-xs w-10">{i + 1}</Td>
                <Td><span className="font-bold text-gray-900">₹{Number(r.amount).toLocaleString()}</span></Td>
                <Td className="font-mono text-sm text-gray-700">{r.utr_number || '—'}</Td>
                <Td className="text-gray-500 text-xs">{r.payment_date ? new Date(r.payment_date).toLocaleDateString('en-IN') : '—'}</Td>
                <Td>
                  {r.utr_screenshot_url ? (
                    <a href={r.utr_screenshot_url} target="_blank" rel="noreferrer" className="text-[#933d18] text-xs font-semibold underline">View</a>
                  ) : '—'}
                </Td>
                <Td className="text-gray-500 text-xs">{r.notes || '—'}</Td>
                <Td className="text-gray-400 text-xs">{r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN') : '—'}</Td>
                <Td className="text-gray-400 text-xs">{r.verified_at ? new Date(r.verified_at).toLocaleDateString('en-IN') : '—'}</Td>
                <Td><Badge status={r.status?.toLowerCase()}>{r.status || 'Pending'}</Badge></Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      {/* Recharge Modal */}
      <Modal isOpen={modal} onClose={() => setModal(false)} title="Request Recharge">
        <div className="space-y-4">
          <Input
            label="Amount (₹) *"
            type="number"
            placeholder="e.g. 5000"
            value={form.amount}
            onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
          />
          <Input
            label="UTR / Transaction Number *"
            placeholder="e.g. UTR123456789"
            value={form.utr_number}
            onChange={e => setForm(f => ({ ...f, utr_number: e.target.value }))}
          />
          <Input
            label="Payment Date *"
            type="date"
            value={form.payment_date}
            onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))}
          />
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-1">Payment Screenshot</p>
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
            <Button onClick={handleSubmit} disabled={saving}>{saving ? 'Submitting...' : 'Submit Request'}</Button>
            <Button variant="outline" onClick={() => setModal(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
