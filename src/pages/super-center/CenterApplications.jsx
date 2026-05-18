import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import PageHeader from '../../components/ui/PageHeader'
import { Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui/Table'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import { Eye, CheckCircle, XCircle, Copy, ExternalLink } from 'lucide-react'

const STATUS_LABELS = {
  pending: 'Pending Review',
  sc_forwarded: 'Forwarded to University',
  doc_verified: 'Docs Verified',
  approved: 'Approved',
  rejected: 'Rejected',
}

function DocLink({ url, label }) {
  if (!url) return <span className="text-gray-300 text-xs">Not uploaded</span>
  return (
    <a href={url} target="_blank" rel="noreferrer"
      className="text-[#933d18] text-xs font-semibold underline flex items-center gap-1">
      <ExternalLink size={11} /> {label}
    </a>
  )
}

export default function CenterApplications() {
  const { user } = useAuth()
  const [myCenter, setMyCenter] = useState(null)
  const [apps, setApps] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewApp, setViewApp] = useState(null)
  const [forwardModal, setForwardModal] = useState(null)
  const [feeForm, setFeeForm] = useState({ university_fee: '', super_center_fee: '', sc_remarks: '' })
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!user) return
    supabase.from('centers').select('id, center_name, center_code')
      .eq('email', user.email).eq('center_type', 'super_center').maybeSingle()
      .then(({ data }) => {
        setMyCenter(data)
        if (data) fetchApps(data.id)
        else setLoading(false)
      })
  }, [user])

  async function fetchApps(centerId) {
    setLoading(true)
    const { data } = await supabase.from('center_applications')
      .select('*').eq('super_center_id', centerId).order('created_at', { ascending: false })
    setApps(data || [])
    setLoading(false)
  }

  function copyLink() {
    const link = `${window.location.origin}/apply/${myCenter?.center_code}`
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function openForward(app) {
    setForwardModal(app)
    setFeeForm({
      university_fee: app.university_fee || '',
      super_center_fee: app.super_center_fee || '',
      sc_remarks: app.sc_remarks || '',
    })
  }

  async function handleForward() {
    if (!feeForm.university_fee || !feeForm.super_center_fee) {
      alert('Both University Fee and Your Fee are required.')
      return
    }
    setSaving(true)
    await supabase.from('center_applications').update({
      university_fee: parseFloat(feeForm.university_fee),
      super_center_fee: parseFloat(feeForm.super_center_fee),
      sc_remarks: feeForm.sc_remarks,
      sc_verified_at: new Date().toISOString(),
      status: 'sc_forwarded',
    }).eq('id', forwardModal.id)
    setSaving(false)
    setForwardModal(null)
    fetchApps(myCenter.id)
  }

  async function handleReject(appId) {
    if (!confirm('Reject this application?')) return
    await supabase.from('center_applications').update({ status: 'rejected' }).eq('id', appId)
    fetchApps(myCenter.id)
  }

  const registrationLink = myCenter ? `${window.location.origin}/apply/${myCenter.center_code}` : ''

  return (
    <div className="p-6">
      <PageHeader title="Center Applications" subtitle="Applications submitted via your registration link" />

      {/* Registration Link Card */}
      {myCenter && (
        <div className="bg-[#933d18]/5 border border-[#933d18]/20 rounded-2xl p-5 mb-6">
          <p className="text-xs font-bold text-[#933d18] uppercase tracking-widest mb-2">Your Registration Link</p>
          <p className="text-sm text-gray-500 mb-3">Share this link with prospective centers to apply under you.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono text-gray-800 truncate">
              {registrationLink}
            </code>
            <button onClick={copyLink}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${copied ? 'bg-emerald-500 text-white' : 'bg-[#933d18] text-white hover:bg-[#b05a30]'}`}>
              <Copy size={14} />
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Loading...</div>
      ) : (
        <Table>
          <Thead>
            <tr>
              <Th>#</Th>
              <Th>Applicant / Organization</Th>
              <Th>Contact</Th>
              <Th>Amount Paid</Th>
              <Th>Submitted On</Th>
              <Th>Status</Th>
              <Th>Actions</Th>
            </tr>
          </Thead>
          <Tbody>
            {apps.length === 0 ? (
              <Tr><Td colSpan={7} className="text-center text-gray-400 py-12">No applications yet. Share your registration link.</Td></Tr>
            ) : apps.map((a, i) => (
              <Tr key={a.id}>
                <Td className="text-gray-400 text-xs w-10">{i + 1}</Td>
                <Td>
                  <p className="font-semibold text-gray-900">{a.organization_name || '—'}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{a.full_name}</p>
                </Td>
                <Td>
                  <p className="text-sm text-gray-700">{a.phone || '—'}</p>
                  <p className="text-xs text-gray-400">{a.email || '—'}</p>
                </Td>
                <Td className="font-bold text-gray-900">₹{Number(a.amount_paid || 0).toLocaleString()}</Td>
                <Td className="text-gray-400 text-xs">{a.created_at ? new Date(a.created_at).toLocaleDateString('en-IN') : '—'}</Td>
                <Td>
                  <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${
                    a.status === 'approved' ? 'bg-emerald-50 text-emerald-700' :
                    a.status === 'rejected' ? 'bg-red-50 text-red-700' :
                    a.status === 'sc_forwarded' ? 'bg-blue-50 text-blue-700' :
                    'bg-amber-50 text-amber-700'
                  }`}>
                    {STATUS_LABELS[a.status] || a.status}
                  </span>
                </Td>
                <Td>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setViewApp(a)} title="View Details">
                      <Eye size={13} className="text-[#933d18]" />
                    </Button>
                    {a.status === 'pending' && (
                      <>
                        <Button size="sm" variant="success" onClick={() => openForward(a)}>
                          <CheckCircle size={13} /> Verify & Forward
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => handleReject(a.id)}>
                          <XCircle size={13} />
                        </Button>
                      </>
                    )}
                  </div>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      {/* View Application Modal */}
      <Modal isOpen={!!viewApp} onClose={() => setViewApp(null)} title="Application Details">
        {viewApp && (
          <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Full Name', viewApp.full_name],
                ['Organization', viewApp.organization_name],
                ['Email', viewApp.email],
                ['Phone', viewApp.phone],
                ['City', viewApp.org_city],
                ['State', viewApp.org_state],
                ['Aadhar No', viewApp.aadhar_no],
                ['PAN No', viewApp.pan_no],
                ['Amount Paid', `₹${Number(viewApp.amount_paid || 0).toLocaleString()}`],
                ['UTR Number', viewApp.utr_number],
                ['Payment Date', viewApp.payment_date],
                ['Account No', viewApp.account_no],
                ['IFSC', viewApp.ifc_code],
                ['Bank Branch', viewApp.branch],
              ].map(([label, val]) => (
                <div key={label} className="bg-gray-50 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
                  <p className="text-sm font-semibold text-gray-900 mt-0.5">{val || '—'}</p>
                </div>
              ))}
            </div>

            <div className="bg-white border border-gray-100 rounded-xl p-4">
              <p className="text-xs font-bold text-[#933d18] uppercase tracking-wider mb-3">Documents</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ['Photo', viewApp.photo_url],
                  ['Signature', viewApp.signature_url],
                  ['Aadhar', viewApp.aadhar_upload_url],
                  ['PAN', viewApp.pan_upload_url],
                  ['Marksheet', viewApp.marksheet_url],
                  ['Org Reg.', viewApp.organization_registration_no_url],
                  ['Premises', viewApp.premises_pic_url],
                  ['Cheque', viewApp.cancel_cheque_url],
                  ['Payment SS', viewApp.payment_screenshot_url],
                ].map(([label, url]) => (
                  <div key={label} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                    <span className="text-xs text-gray-600">{label}</span>
                    <DocLink url={url} label="View" />
                  </div>
                ))}
              </div>
            </div>

            {viewApp.status === 'pending' && (
              <Button onClick={() => { setViewApp(null); openForward(viewApp) }} className="w-full justify-center">
                <CheckCircle size={14} /> Verify & Forward to University
              </Button>
            )}
          </div>
        )}
      </Modal>

      {/* Forward Modal */}
      <Modal isOpen={!!forwardModal} onClose={() => setForwardModal(null)} title="Verify & Forward to University">
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="font-semibold text-gray-900">{forwardModal?.organization_name}</p>
            <p className="text-xs text-gray-500 mt-0.5">{forwardModal?.full_name} · ₹{Number(forwardModal?.amount_paid || 0).toLocaleString()} paid</p>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
            Enter how the received amount should be split between University and yourself. The university will generate coupons accordingly.
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">University Fee (₹) *</label>
              <input className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#933d18]"
                type="number" placeholder="e.g. 25"
                value={feeForm.university_fee} onChange={e => setFeeForm(f => ({ ...f, university_fee: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Your Fee (₹) *</label>
              <input className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#933d18]"
                type="number" placeholder="e.g. 75"
                value={feeForm.super_center_fee} onChange={e => setFeeForm(f => ({ ...f, super_center_fee: e.target.value }))} />
            </div>
          </div>
          {feeForm.university_fee && feeForm.super_center_fee && (
            <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2">
              Total: ₹{(parseFloat(feeForm.university_fee || 0) + parseFloat(feeForm.super_center_fee || 0)).toLocaleString()}
              {' '}· New center gets <strong>{feeForm.university_fee} coupons</strong> · You get <strong>{feeForm.super_center_fee} coupons</strong>
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Remarks for University</label>
            <textarea className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-[#933d18] resize-none"
              rows={2} placeholder="Any notes for document/account department..."
              value={feeForm.sc_remarks} onChange={e => setFeeForm(f => ({ ...f, sc_remarks: e.target.value }))} />
          </div>

          <div className="flex gap-3">
            <Button onClick={handleForward} disabled={saving}>{saving ? 'Forwarding...' : 'Forward to University'}</Button>
            <Button variant="outline" onClick={() => setForwardModal(null)}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
