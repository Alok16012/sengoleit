import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import PageHeader from '../../components/ui/PageHeader'
import { Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui/Table'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import { Eye, CheckCircle, XCircle, Copy, ExternalLink } from 'lucide-react'

const STATUS_LABELS = {
  pending: 'Pending Doc Verify',
  doc_verified: 'Pending Account Dept',
  approved: 'Approved',
  rejected: 'Rejected',
  sc_forwarded: 'Forwarded to University',
}

const STATUS_COLORS = {
  pending: 'bg-amber-50 text-amber-700',
  doc_verified: 'bg-blue-50 text-blue-700',
  approved: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-red-50 text-red-700',
  sc_forwarded: 'bg-indigo-50 text-indigo-700',
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

const TABS = [
  { key: 'direct', label: 'Created by Me' },
  { key: 'link', label: 'Via Registration Link' },
]

export default function CenterApplications() {
  const { user } = useAuth()
  const [myCenter, setMyCenter] = useState(null)
  const [tab, setTab] = useState('direct')

  // Direct centers (SubCenterForm — from `centers` table)
  const [directCenters, setDirectCenters] = useState([])
  const [directLoading, setDirectLoading] = useState(true)
  const [viewDirect, setViewDirect] = useState(null)

  // Link applications (from `center_applications` table)
  const [apps, setApps] = useState([])
  const [linkLoading, setLinkLoading] = useState(false)
  const [viewApp, setViewApp] = useState(null)
  const [forwardModal, setForwardModal] = useState(null)
  const [feeForm, setFeeForm] = useState({ university_fee: '', super_center_fee: '', sc_remarks: '' })
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!user) return
    supabase.from('centers').select('id, center_name, center_code, approval_status')
      .eq('email', user.email).eq('center_type', 'super_center').maybeSingle()
      .then(({ data }) => {
        setMyCenter(data)
        if (data) {
          fetchDirectCenters(data.id)
          fetchApps(data.id)
        } else {
          setDirectLoading(false)
        }
      })
  }, [user])

  async function fetchDirectCenters(superCenterId) {
    setDirectLoading(true)
    const { data } = await supabase
      .from('centers')
      .select('*, states(state_name)')
      .eq('super_center_id', superCenterId)
      .neq('approval_status', 'approved')
      .order('created_at', { ascending: false })
    setDirectCenters(data || [])
    setDirectLoading(false)
  }

  async function fetchApps(centerId) {
    setLinkLoading(true)
    const { data } = await supabase.from('center_applications')
      .select('*').eq('super_center_id', centerId).order('created_at', { ascending: false })
    setApps(data || [])
    setLinkLoading(false)
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

  async function handleRejectApp(appId) {
    if (!confirm('Reject this application?')) return
    await supabase.from('center_applications').update({ status: 'rejected' }).eq('id', appId)
    fetchApps(myCenter.id)
  }

  const registrationLink = myCenter ? `${window.location.origin}/apply/${myCenter.center_code}` : ''

  const pendingDirectCount = directCenters.filter(c => c.approval_status === 'pending').length
  const pendingLinkCount = apps.filter(a => a.status === 'pending').length

  return (
    <div className="p-6">
      <PageHeader title="Center Applications" subtitle="Track and manage center applications" />

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`relative px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === t.key ? 'bg-white text-[#933d18] shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
            {t.key === 'direct' && pendingDirectCount > 0 && (
              <span className="ml-2 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{pendingDirectCount}</span>
            )}
            {t.key === 'link' && pendingLinkCount > 0 && (
              <span className="ml-2 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{pendingLinkCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* PIPELINE INFO */}
      <div className="mb-5 flex items-center gap-2 text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
        <span className="font-semibold text-blue-700">Pipeline:</span>
        <span className="bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full">Pending Doc Verify</span>
        <span className="text-gray-300">→</span>
        <span className="bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full">Pending Account Dept</span>
        <span className="text-gray-300">→</span>
        <span className="bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded-full">Approved (My Centers)</span>
      </div>

      {/* DIRECT CENTERS TAB */}
      {tab === 'direct' && (
        directLoading ? (
          <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Loading...</div>
        ) : (
          <Table>
            <Thead>
              <tr>
                <Th>#</Th>
                <Th>Center Name</Th>
                <Th>Code</Th>
                <Th>Contact Person</Th>
                <Th>State</Th>
                <Th>Phone</Th>
                <Th>Submitted On</Th>
                <Th>Status</Th>
                <Th>Actions</Th>
              </tr>
            </Thead>
            <Tbody>
              {directCenters.length === 0 ? (
                <Tr><Td colSpan={9} className="text-center text-gray-400 py-12">
                  No pending center applications.
                  {myCenter?.approval_status !== 'approved' && (
                    <p className="text-amber-600 text-xs mt-1 font-medium">Your super center must be approved before creating centers.</p>
                  )}
                </Td></Tr>
              ) : directCenters.map((c, i) => (
                <Tr key={c.id}>
                  <Td className="text-gray-400 text-xs w-10">{i + 1}</Td>
                  <Td>
                    <p className="font-semibold text-gray-900">{c.center_name}</p>
                    {c.email && <p className="text-xs text-gray-400 mt-0.5">{c.email}</p>}
                  </Td>
                  <Td className="font-mono text-xs text-gray-500">{c.center_code || '—'}</Td>
                  <Td className="text-gray-500">{c.contact_person || '—'}</Td>
                  <Td className="text-gray-500 text-xs">{c.states?.state_name || '—'}</Td>
                  <Td className="text-gray-500">{c.phone || '—'}</Td>
                  <Td className="text-gray-400 text-xs">{c.created_at ? new Date(c.created_at).toLocaleDateString('en-IN') : '—'}</Td>
                  <Td>
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full capitalize ${STATUS_COLORS[c.approval_status] || 'bg-gray-50 text-gray-600'}`}>
                      {STATUS_LABELS[c.approval_status] || c.approval_status || 'Pending'}
                    </span>
                  </Td>
                  <Td>
                    <Button size="sm" variant="ghost" onClick={() => setViewDirect(c)} title="View Details">
                      <Eye size={13} className="text-[#933d18]" />
                    </Button>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )
      )}

      {/* LINK APPLICATIONS TAB */}
      {tab === 'link' && (
        <>
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

          {linkLoading ? (
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
                      <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${STATUS_COLORS[a.status] || 'bg-gray-50 text-gray-600'}`}>
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
                            <Button size="sm" variant="danger" onClick={() => handleRejectApp(a.id)}>
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
        </>
      )}

      {/* View Direct Center Modal */}
      <Modal isOpen={!!viewDirect} onClose={() => setViewDirect(null)} title="Center Application Details">
        {viewDirect && (
          <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            <div className={`rounded-xl p-4 ${STATUS_COLORS[viewDirect.approval_status] || 'bg-gray-50'} border`}>
              <p className="font-bold text-gray-900 text-base">{viewDirect.center_name}</p>
              <p className="text-xs mt-1 font-semibold">{STATUS_LABELS[viewDirect.approval_status] || viewDirect.approval_status}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Email', viewDirect.email],
                ['Phone', viewDirect.phone],
                ['Contact Person', viewDirect.contact_person],
                ['Center Code', viewDirect.center_code],
                ['City', viewDirect.city],
                ['State', viewDirect.states?.state_name],
                ['Aadhar No', viewDirect.aadhar_no],
                ['PAN No', viewDirect.pan_no],
                ['Organization', viewDirect.organization_name],
                ['Org Type', viewDirect.org_type],
                ['Bank Account', viewDirect.bank_account_number ? `****${viewDirect.bank_account_number.slice(-4)}` : '—'],
                ['IFSC', viewDirect.ifsc_code],
                ['Amount Paid', viewDirect.amount_paid ? `₹${Number(viewDirect.amount_paid).toLocaleString()}` : '—'],
                ['UTR Number', viewDirect.utr_number],
              ].map(([label, val]) => (
                <div key={label} className="bg-gray-50 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
                  <p className="text-sm font-semibold text-gray-900 mt-0.5">{val || '—'}</p>
                </div>
              ))}
            </div>
            <div className="bg-white border border-gray-100 rounded-xl p-4">
              <p className="text-xs font-bold text-[#933d18] uppercase tracking-wider mb-3">Uploaded Documents</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ['Owner Photo', viewDirect.owner_photo_url],
                  ['Signature', viewDirect.owner_signature_url],
                  ['Aadhar Card', viewDirect.owner_aadhar_url],
                  ['PAN Card', viewDirect.owner_pan_url],
                  ['Reg. Cert.', viewDirect.center_reg_url],
                  ['Premises Photo', viewDirect.premises_photo_url],
                  ['GST Cert.', viewDirect.gst_url],
                  ['Agreement', viewDirect.agreement_url],
                  ['Cancel Cheque', viewDirect.cancel_cheque_url],
                  ['Bank Passbook', viewDirect.bank_passbook_url],
                  ['Payment Proof', viewDirect.payment_screenshot_url],
                ].map(([label, url]) => (
                  <div key={label} className={`flex items-center justify-between px-3 py-2 rounded-lg border ${url ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'}`}>
                    <span className="text-xs text-gray-600">{label}</span>
                    <DocLink url={url} label="View" />
                  </div>
                ))}
              </div>
            </div>
            <Button variant="outline" onClick={() => setViewDirect(null)} className="w-full justify-center">Close</Button>
          </div>
        )}
      </Modal>

      {/* View Link Application Modal */}
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
                  ['Photo', viewApp.photo_url], ['Signature', viewApp.signature_url],
                  ['Aadhar', viewApp.aadhar_upload_url], ['PAN', viewApp.pan_upload_url],
                  ['Marksheet', viewApp.marksheet_url], ['Org Reg.', viewApp.organization_registration_no_url],
                  ['Premises', viewApp.premises_pic_url], ['Cheque', viewApp.cancel_cheque_url],
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
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Remarks for University</label>
            <textarea className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-[#933d18] resize-none"
              rows={2} placeholder="Any notes..."
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
