import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import PageHeader from '../../components/ui/PageHeader'
import { Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui/Table'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import { Eye, Copy, ExternalLink, RefreshCw } from 'lucide-react'

const STATUS_LABELS = {
  pending:      'Pending Doc Verify',
  doc_verified: 'Pending Account Dept',
  approved:     'Approved',
  rejected:     'Rejected',
}

const STATUS_COLORS = {
  pending:      'bg-amber-50 text-amber-700 border-amber-200',
  doc_verified: 'bg-blue-50 text-blue-700 border-blue-200',
  approved:     'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected:     'bg-red-50 text-red-700 border-red-200',
}

function DocLink({ url, label }) {
  if (!url) return <span className="text-gray-300 text-xs">—</span>
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
  const [centers, setCenters] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewCenter, setViewCenter] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!user) return
    supabase.from('centers')
      .select('id, center_name, center_code, approval_status')
      .eq('email', user.email)
      .eq('center_type', 'super_center')
      .maybeSingle()
      .then(({ data }) => {
        setMyCenter(data)
        if (data?.id) fetchCenters(data.id)
        else setLoading(false)
      })
  }, [user])

  async function fetchCenters(superCenterId) {
    setLoading(true)
    const { data } = await supabase
      .from('centers')
      .select('*, states(state_name)')
      .eq('super_center_id', superCenterId)
      .neq('approval_status', 'approved')
      .order('created_at', { ascending: false })
    setCenters(data || [])
    setLoading(false)
  }

  function copyLink() {
    const link = `${window.location.origin}/apply/${myCenter?.center_code}`
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const pendingCount = centers.filter(c => c.approval_status === 'pending').length

  return (
    <div className="p-6">
      <PageHeader
        title="Center Applications"
        subtitle={`${centers.length} applications in progress`}
        action={{
          label: <><RefreshCw size={14} /> Refresh</>,
          onClick: () => myCenter?.id && fetchCenters(myCenter.id),
        }}
      />

      {/* Pipeline info */}
      <div className="mb-5 flex flex-wrap items-center gap-2 text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
        <span className="font-semibold text-blue-700">Pipeline:</span>
        <span className="bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full">Pending Doc Verify</span>
        <span className="text-gray-300">→</span>
        <span className="bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full">Pending Account Dept</span>
        <span className="text-gray-300">→</span>
        <span className="bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded-full">Approved → My Centers</span>
      </div>

      {/* Registration link */}
      {myCenter && (
        <div className="bg-[#933d18]/5 border border-[#933d18]/20 rounded-2xl p-5 mb-6">
          <p className="text-xs font-bold text-[#933d18] uppercase tracking-widest mb-1">Registration Link</p>
          <p className="text-xs text-gray-500 mb-3">Share this link — centers applying via this link will appear in this list automatically.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono text-gray-800 truncate">
              {window.location.origin}/apply/{myCenter.center_code}
            </code>
            <button onClick={copyLink}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${copied ? 'bg-emerald-500 text-white' : 'bg-[#933d18] text-white hover:bg-[#b05a30]'}`}>
              <Copy size={14} />
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      {/* Centers table */}
      {loading ? (
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
              <Th></Th>
            </tr>
          </Thead>
          <Tbody>
            {centers.length === 0 ? (
              <Tr>
                <Td colSpan={9} className="text-center text-gray-400 py-12">
                  No pending applications.
                  {myCenter?.approval_status !== 'approved' && (
                    <p className="text-amber-600 text-xs mt-1 font-medium">Your super center must be approved before creating centers.</p>
                  )}
                </Td>
              </Tr>
            ) : centers.map((c, i) => (
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
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${STATUS_COLORS[c.approval_status] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                    {STATUS_LABELS[c.approval_status] || c.approval_status || 'Pending'}
                  </span>
                </Td>
                <Td>
                  <Button size="sm" variant="ghost" onClick={() => setViewCenter(c)} title="View Details">
                    <Eye size={13} className="text-[#933d18]" />
                  </Button>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      {/* View Modal */}
      <Modal isOpen={!!viewCenter} onClose={() => setViewCenter(null)} title="Center Application Details">
        {viewCenter && (
          <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            <div className={`rounded-xl p-4 border ${STATUS_COLORS[viewCenter.approval_status] || 'bg-gray-50 border-gray-200'}`}>
              <p className="font-bold text-gray-900 text-base">{viewCenter.center_name}</p>
              <p className="text-xs mt-1 font-semibold">{STATUS_LABELS[viewCenter.approval_status] || viewCenter.approval_status}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Email',        viewCenter.email],
                ['Phone',        viewCenter.phone],
                ['Contact Person', viewCenter.contact_person],
                ['Center Code',  viewCenter.center_code],
                ['City',         viewCenter.city],
                ['State',        viewCenter.states?.state_name],
                ['Aadhar No',    viewCenter.aadhar_no],
                ['PAN No',       viewCenter.pan_no],
                ['Organization', viewCenter.organization_name],
                ['Org Type',     viewCenter.org_type],
                ['Bank Account', viewCenter.bank_account_number ? `****${viewCenter.bank_account_number.slice(-4)}` : '—'],
                ['IFSC',         viewCenter.ifsc_code],
                ['Amount Paid',  viewCenter.amount_paid ? `₹${Number(viewCenter.amount_paid).toLocaleString()}` : '—'],
                ['UTR Number',   viewCenter.utr_number],
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
                  ['Owner Photo',    viewCenter.owner_photo_url],
                  ['Signature',      viewCenter.owner_signature_url],
                  ['Aadhar Card',    viewCenter.owner_aadhar_url],
                  ['PAN Card',       viewCenter.owner_pan_url],
                  ['Reg. Cert.',     viewCenter.center_reg_url],
                  ['Premises Photo', viewCenter.premises_photo_url],
                  ['GST Cert.',      viewCenter.gst_url],
                  ['Agreement',      viewCenter.agreement_url],
                  ['Cancel Cheque',  viewCenter.cancel_cheque_url],
                  ['Bank Passbook',  viewCenter.bank_passbook_url],
                  ['Payment Proof',  viewCenter.payment_screenshot_url],
                ].map(([label, url]) => (
                  <div key={label} className={`flex items-center justify-between px-3 py-2 rounded-lg border ${url ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'}`}>
                    <span className="text-xs text-gray-600">{label}</span>
                    <DocLink url={url} label="View" />
                  </div>
                ))}
              </div>
            </div>
            <Button variant="outline" onClick={() => setViewCenter(null)} className="w-full justify-center">Close</Button>
          </div>
        )}
      </Modal>
    </div>
  )
}
