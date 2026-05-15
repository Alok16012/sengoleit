import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import PageHeader from '../../components/ui/PageHeader'
import { Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui/Table'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import { CheckCircle, XCircle, ToggleLeft, ToggleRight, IndianRupee, Building2, RefreshCw } from 'lucide-react'

const TABS = [
  { key: 'approvals', label: 'Pending Approvals' },
  { key: 'recharges', label: 'Recharge Requests' },
  { key: 'centers', label: 'Centers Management' },
]

export default function AccountDepartment() {
  const [tab, setTab] = useState('approvals')
  const [approvals, setApprovals] = useState([])
  const [recharges, setRecharges] = useState([])
  const [centers, setCenters] = useState([])
  const [loading, setLoading] = useState(true)
  const [rejectModal, setRejectModal] = useState(null)
  const [rejectNotes, setRejectNotes] = useState('')
  const [approvedModal, setApprovedModal] = useState(null)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    const [appr, rech, ctr] = await Promise.all([
      supabase.from('centers').select('*').eq('approval_status', 'pending').order('created_at', { ascending: false }),
      supabase.from('recharge_requests').select('*').order('created_at', { ascending: false }),
      supabase.from('centers').select('*').not('approval_status', 'eq', 'pending').order('created_at', { ascending: false }),
    ])
    setApprovals(appr.data || [])
    setRecharges(rech.data || [])
    setCenters(ctr.data || [])
    setLoading(false)
  }

  async function handleApprove(center) {
    const centerCode = center.center_code || `${center.center_type === 'super_center' ? 'SC' : 'CTR'}${Date.now().toString().slice(-6)}`
    await supabase.from('centers').update({
      approval_status: 'approved',
      status: 'Active',
      center_code: centerCode,
    }).eq('id', center.id)
    setApprovedModal({ ...center, center_code: centerCode })
    fetchAll()
  }

  async function handleReject(center) {
    setRejectModal(center)
    setRejectNotes('')
  }

  async function confirmReject() {
    await supabase.from('centers').update({
      approval_status: 'rejected',
      status: 'Inactive',
      approval_notes: rejectNotes,
    }).eq('id', rejectModal.id)
    setRejectModal(null)
    fetchAll()
  }

  async function handleVerifyRecharge(req) {
    await supabase.from('recharge_requests').update({ status: 'verified', verified_at: new Date().toISOString() }).eq('id', req.id)
    const { data: centerData } = await supabase.from('centers').select('virtual_balance').eq('id', req.center_id).single()
    const newBalance = (centerData?.virtual_balance || 0) + Number(req.amount)
    await supabase.from('centers').update({ virtual_balance: newBalance }).eq('id', req.center_id)
    fetchAll()
  }

  async function handleRejectRecharge(id) {
    await supabase.from('recharge_requests').update({ status: 'rejected' }).eq('id', id)
    fetchAll()
  }

  async function toggleCenterStatus(center) {
    const newStatus = center.status === 'Active' ? 'Inactive' : 'Active'
    await supabase.from('centers').update({ status: newStatus }).eq('id', center.id)
    fetchAll()
  }

  const pendingCount = approvals.length
  const pendingRecharges = recharges.filter(r => r.status === 'pending').length

  return (
    <div className="p-6">
      <PageHeader title="Account Department" subtitle="Approvals, Recharges & Center Management" />

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`relative px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === t.key ? 'bg-white text-[#933d18] shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
            {t.key === 'approvals' && pendingCount > 0 && (
              <span className="ml-2 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{pendingCount}</span>
            )}
            {t.key === 'recharges' && pendingRecharges > 0 && (
              <span className="ml-2 bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{pendingRecharges}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Loading...</div>
      ) : (
        <>
          {/* APPROVALS TAB */}
          {tab === 'approvals' && (
            <Table>
              <Thead>
                <tr>
                  <Th>#</Th>
                  <Th>Center / Super Center</Th>
                  <Th>Type</Th>
                  <Th>Contact Person</Th>
                  <Th>Phone</Th>
                  <Th>Email</Th>
                  <Th>Bank Account</Th>
                  <Th>Submitted</Th>
                  <Th>Actions</Th>
                </tr>
              </Thead>
              <Tbody>
                {approvals.length === 0 ? (
                  <Tr><Td colSpan={9} className="text-center text-gray-400 py-12">No pending approvals</Td></Tr>
                ) : approvals.map((c, i) => (
                  <Tr key={c.id}>
                    <Td className="text-gray-400 text-xs w-10">{i + 1}</Td>
                    <Td>
                      <p className="font-semibold text-gray-900">{c.center_name}</p>
                      {c.organization_name && <p className="text-xs text-gray-400 mt-0.5">{c.organization_name}</p>}
                    </Td>
                    <Td>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${c.center_type === 'super_center' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>
                        {c.center_type === 'super_center' ? 'Super Center' : 'Center'}
                      </span>
                    </Td>
                    <Td className="text-gray-500">{c.contact_person || '—'}</Td>
                    <Td className="text-gray-500">{c.phone || '—'}</Td>
                    <Td className="text-gray-500 text-xs">{c.email || '—'}</Td>
                    <Td className="text-gray-500 text-xs">
                      {c.bank_account_number ? `****${c.bank_account_number.slice(-4)}` : '—'}
                      {c.ifsc_code && <p className="text-gray-400">{c.ifsc_code}</p>}
                    </Td>
                    <Td className="text-gray-400 text-xs">{c.created_at ? new Date(c.created_at).toLocaleDateString('en-IN') : '—'}</Td>
                    <Td>
                      <div className="flex gap-1">
                        <Button size="sm" variant="success" onClick={() => handleApprove(c)}>
                          <CheckCircle size={13} /> Approve
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => handleReject(c)}>
                          <XCircle size={13} /> Reject
                        </Button>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}

          {/* RECHARGES TAB */}
          {tab === 'recharges' && (
            <Table>
              <Thead>
                <tr>
                  <Th>#</Th>
                  <Th>Center</Th>
                  <Th>Type</Th>
                  <Th>Amount</Th>
                  <Th>UTR Number</Th>
                  <Th>Screenshot</Th>
                  <Th>Notes</Th>
                  <Th>Date</Th>
                  <Th>Status</Th>
                  <Th>Actions</Th>
                </tr>
              </Thead>
              <Tbody>
                {recharges.length === 0 ? (
                  <Tr><Td colSpan={10} className="text-center text-gray-400 py-12">No recharge requests</Td></Tr>
                ) : recharges.map((r, i) => (
                  <Tr key={r.id}>
                    <Td className="text-gray-400 text-xs w-10">{i + 1}</Td>
                    <Td>
                      <p className="font-semibold text-gray-900">{r.centers?.center_name || '—'}</p>
                      {r.centers?.center_code && <p className="text-xs text-gray-400">{r.centers.center_code}</p>}
                    </Td>
                    <Td>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${r.centers?.center_type === 'super_center' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>
                        {r.centers?.center_type === 'super_center' ? 'Super Center' : 'Center'}
                      </span>
                    </Td>
                    <Td>
                      <span className="font-bold text-gray-900">₹{Number(r.amount).toLocaleString()}</span>
                    </Td>
                    <Td className="font-mono text-sm text-gray-700">{r.utr_number || '—'}</Td>
                    <Td>
                      {r.utr_screenshot_url ? (
                        <a href={r.utr_screenshot_url} target="_blank" rel="noreferrer" className="text-[#933d18] text-xs font-semibold underline">View</a>
                      ) : '—'}
                    </Td>
                    <Td className="text-gray-500 text-xs max-w-[120px] truncate">{r.notes || '—'}</Td>
                    <Td className="text-gray-400 text-xs">{r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN') : '—'}</Td>
                    <Td><Badge status={r.status?.toLowerCase()}>{r.status || 'Pending'}</Badge></Td>
                    <Td>
                      {r.status === 'pending' && (
                        <div className="flex gap-1">
                          <Button size="sm" variant="success" onClick={() => handleVerifyRecharge(r)}>
                            <CheckCircle size={13} /> Verify
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => handleRejectRecharge(r.id)}>
                            <XCircle size={13} />
                          </Button>
                        </div>
                      )}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}

          {/* CENTERS MANAGEMENT TAB */}
          {tab === 'centers' && (
            <Table>
              <Thead>
                <tr>
                  <Th>#</Th>
                  <Th>Center Name</Th>
                  <Th>Type</Th>
                  <Th>Code</Th>
                  <Th>State</Th>
                  <Th>Virtual Balance</Th>
                  <Th>KYC</Th>
                  <Th>Approval</Th>
                  <Th>Status</Th>
                  <Th>Activate/Deactivate</Th>
                </tr>
              </Thead>
              <Tbody>
                {centers.length === 0 ? (
                  <Tr><Td colSpan={10} className="text-center text-gray-400 py-12">No centers</Td></Tr>
                ) : centers.map((c, i) => (
                  <Tr key={c.id}>
                    <Td className="text-gray-400 text-xs w-10">{i + 1}</Td>
                    <Td>
                      <p className="font-semibold text-gray-900">{c.center_name}</p>
                      {c.email && <p className="text-xs text-gray-400 mt-0.5">{c.email}</p>}
                    </Td>
                    <Td>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${c.center_type === 'super_center' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>
                        {c.center_type === 'super_center' ? 'Super Center' : 'Center'}
                      </span>
                    </Td>
                    <Td className="text-gray-500 font-mono text-xs">{c.center_code || '—'}</Td>
                    <Td className="text-gray-500 text-xs">{c.states?.state_name || '—'}</Td>
                    <Td>
                      <span className="font-bold text-emerald-700">₹{Number(c.virtual_balance || 0).toLocaleString()}</span>
                    </Td>
                    <Td><Badge status={c.kyc_status?.toLowerCase()}>{c.kyc_status || 'Pending'}</Badge></Td>
                    <Td>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${c.approval_status === 'approved' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                        {c.approval_status || 'pending'}
                      </span>
                    </Td>
                    <Td><Badge status={c.status?.toLowerCase()}>{c.status || 'Inactive'}</Badge></Td>
                    <Td>
                      <button
                        onClick={() => toggleCenterStatus(c)}
                        className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl transition-all ${
                          c.status === 'Active'
                            ? 'bg-red-50 text-red-600 hover:bg-red-100'
                            : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                        }`}
                      >
                        {c.status === 'Active' ? <><ToggleRight size={14} /> Deactivate</> : <><ToggleLeft size={14} /> Activate</>}
                      </button>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
        </>
      )}

      {/* Approval Success Modal */}
      <Modal isOpen={!!approvedModal} onClose={() => setApprovedModal(null)} title="Center Approved Successfully">
        <div className="space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Center Name</span>
              <span className="font-bold text-gray-900">{approvedModal?.center_name}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Center Code (ID)</span>
              <span className="font-mono font-bold text-[#933d18] text-lg tracking-widest">{approvedModal?.center_code}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Type</span>
              <span className="font-medium text-gray-700">{approvedModal?.center_type === 'super_center' ? 'Super Center' : 'Center'}</span>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
            <p className="text-xs font-bold text-blue-700 uppercase tracking-wider">Login Credentials</p>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Login ID (Email)</span>
              <span className="font-mono font-bold text-gray-900">{approvedModal?.email || '—'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Password</span>
              <span className="font-mono font-bold text-gray-900">{approvedModal?.login_password || '(Set by center at registration)'}</span>
            </div>
          </div>

          <p className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3">
            Ye credentials center ko share karo. Woh portal pe login karke apna dashboard access kar sakte hain.
          </p>
          <Button onClick={() => setApprovedModal(null)} className="w-full justify-center">Done</Button>
        </div>
      </Modal>

      {/* Reject Modal */}
      <Modal isOpen={!!rejectModal} onClose={() => setRejectModal(null)} title="Reject Center Application">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Rejecting <strong>{rejectModal?.center_name}</strong>. Add a reason (optional):
          </p>
          <textarea
            className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-[#933d18]"
            rows={3}
            placeholder="Reason for rejection..."
            value={rejectNotes}
            onChange={e => setRejectNotes(e.target.value)}
          />
          <div className="flex gap-3">
            <Button variant="danger" onClick={confirmReject}>Confirm Reject</Button>
            <Button variant="outline" onClick={() => setRejectModal(null)}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
