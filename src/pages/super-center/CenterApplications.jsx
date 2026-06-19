import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import PageHeader from '../../components/ui/PageHeader'
import { Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui/Table'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import { Eye, Copy, ExternalLink, RefreshCw, Check, PauseCircle, X, Pencil } from 'lucide-react'
import { formatDate } from '../../utils/formatDate'

const STAGES = ['Submitted', 'Document Verification', 'Account Department', 'Approved']

const STATUS_TABS = ['Pending', 'Hold', 'Forwarded', 'Approved', 'Rejected']

// Map a center's approval_status to one of the STATUS_TABS buckets.
function matchesTab(c, tab) {
  const st = c.approval_status
  if (tab === 'Pending')   return !st || st === 'pending'
  if (tab === 'Hold')      return st === 'hold' || st === 'account_hold'
  if (tab === 'Forwarded') return st === 'doc_verified'
  if (tab === 'Approved')  return st === 'approved'
  if (tab === 'Rejected')  return st === 'rejected'
  return true
}

function stageState(status) {
  if (status === 'approved')     return { activeIndex: 3, mode: 'done' }
  if (status === 'rejected')     return { activeIndex: 1, mode: 'rejected' }
  if (status === 'hold')         return { activeIndex: 1, mode: 'hold' }
  if (status === 'account_hold') return { activeIndex: 2, mode: 'hold' }
  if (status === 'doc_verified') return { activeIndex: 2, mode: 'progress' }
  return { activeIndex: 1, mode: 'progress' } // pending
}

function ProgressTracker({ status, full = false }) {
  const { activeIndex, mode } = stageState(status)
  return (
    <div className="flex items-start w-full">
      {STAGES.map((label, i) => {
        const done = mode === 'done' || i < activeIndex
        const isCurrent = i === activeIndex && mode !== 'done'
        let node = 'bg-gray-200 text-gray-400 border-gray-200'
        let icon = <span className="text-[10px] font-bold">{i + 1}</span>
        if (done) { node = 'bg-emerald-500 text-white border-emerald-500'; icon = <Check size={full ? 14 : 11} /> }
        if (isCurrent && mode === 'progress') { node = 'bg-[#933d18] text-white border-[#933d18] animate-pulse' }
        if (isCurrent && mode === 'hold')     { node = 'bg-orange-500 text-white border-orange-500'; icon = <PauseCircle size={full ? 14 : 11} /> }
        if (isCurrent && mode === 'rejected') { node = 'bg-red-500 text-white border-red-500'; icon = <X size={full ? 14 : 11} /> }
        const connectorDone = mode === 'done' || i < activeIndex
        return (
          <div key={label} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center shrink-0">
              <div className={`flex items-center justify-center rounded-full border ${full ? 'w-7 h-7' : 'w-5 h-5'} ${node}`}>
                {icon}
              </div>
              {full && (
                <span className={`mt-1.5 text-[10px] font-semibold text-center leading-tight max-w-[80px] ${
                  isCurrent && mode === 'hold' ? 'text-orange-600' :
                  isCurrent && mode === 'rejected' ? 'text-red-600' :
                  isCurrent ? 'text-[#933d18]' : done ? 'text-emerald-600' : 'text-gray-400'
                }`}>{label}</span>
              )}
            </div>
            {i < STAGES.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 ${full ? 'mb-4' : ''} ${connectorDone ? 'bg-emerald-400' : 'bg-gray-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

const STATUS_LABELS = {
  pending:      'Pending Doc Verify',
  hold:         'On Hold — Action Needed',
  account_hold: 'Payment Hold — Action Needed',
  doc_verified: 'Pending Account Dept',
  approved:     'Approved',
  rejected:     'Rejected',
}

const STATUS_COLORS = {
  pending:      'bg-amber-50 text-amber-700 border-amber-200',
  hold:         'bg-orange-50 text-orange-700 border-orange-200',
  account_hold: 'bg-amber-50 text-amber-700 border-amber-200',
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
  const navigate = useNavigate()
  const [myCenter, setMyCenter] = useState(null)
  const [centers, setCenters] = useState([])
  const [loading, setLoading] = useState(true)
  const [viewCenter, setViewCenter] = useState(null)
  const [copied, setCopied] = useState(false)
  const [tab, setTab] = useState('Pending')

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
      .select('*, states!state_id(state_name)')
      .eq('super_center_id', superCenterId)
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

  const pendingCount = centers.filter(c => matchesTab(c, 'Pending')).length
  const filteredCenters = centers.filter(c => matchesTab(c, tab))

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
        <span className="text-gray-300">·</span>
        <span className="bg-orange-100 text-orange-700 font-bold px-2 py-0.5 rounded-full">On Hold = correction needed</span>
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

      {/* Status filter tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-xl w-fit flex-wrap">
        {STATUS_TABS.map(s => {
          const count = centers.filter(c => matchesTab(c, s)).length
          return (
            <button
              key={s}
              onClick={() => setTab(s)}
              className={`relative px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                tab === s ? 'bg-white text-[#933d18] shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {s}
              {s === 'Pending' && pendingCount > 0 && (
                <span className="ml-1.5 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{pendingCount}</span>
              )}
              {s !== 'Pending' && count > 0 && (
                <span className="ml-1.5 bg-gray-200 text-gray-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{count}</span>
              )}
            </button>
          )
        })}
      </div>

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
            {filteredCenters.length === 0 ? (
              <Tr>
                <Td colSpan={9} className="text-center text-gray-400 py-12">
                  No applications in “{tab}”.
                  {myCenter?.approval_status !== 'approved' && (
                    <p className="text-amber-600 text-xs mt-1 font-medium">Your super center must be approved before creating centers.</p>
                  )}
                </Td>
              </Tr>
            ) : filteredCenters.map((c, i) => (
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
                <Td className="text-gray-400 text-xs">{formatDate(c.created_at)}</Td>
                <Td className="min-w-[200px]">
                  <div className="w-[180px] mb-1.5"><ProgressTracker status={c.approval_status} /></div>
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${STATUS_COLORS[c.approval_status] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                    {STATUS_LABELS[c.approval_status] || c.approval_status || 'Pending'}
                  </span>
                  {(c.approval_status === 'hold' || c.approval_status === 'account_hold' || c.approval_status === 'rejected') && c.approval_notes && (
                    <p className={`text-[11px] mt-1 max-w-[180px] ${c.approval_status === 'rejected' ? 'text-red-600' : c.approval_status === 'account_hold' ? 'text-amber-600' : 'text-orange-600'}`} title={c.approval_notes}>
                      “{c.approval_notes}”
                    </p>
                  )}
                  {(c.approval_status === 'hold' || c.approval_status === 'account_hold' || c.approval_status === 'rejected') && (
                    <button onClick={() => navigate(`/super-center/centers/edit/${c.id}`)}
                      title="Edit & Resubmit"
                      className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-white bg-orange-500 hover:bg-orange-600 px-2.5 py-1.5 rounded-lg transition-all whitespace-nowrap">
                      <Pencil size={12} /> Edit & Resubmit
                    </button>
                  )}
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
              {(viewCenter.approval_status === 'hold' || viewCenter.approval_status === 'account_hold' || viewCenter.approval_status === 'rejected') && viewCenter.approval_notes && (
                <div className="mt-2 pt-2 border-t border-current/10">
                  <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">
                    {viewCenter.approval_status === 'rejected' ? 'Rejection Reason' : viewCenter.approval_status === 'account_hold' ? 'Payment Hold — Please Correct' : 'Hold Remark — Please Correct'}
                  </p>
                  <p className="text-sm font-medium mt-0.5 whitespace-pre-line">{viewCenter.approval_notes}</p>
                </div>
              )}
            </div>

            {/* Full progress tracker */}
            <div className="bg-white border border-gray-100 rounded-xl p-4">
              <p className="text-[10px] font-bold text-[#933d18] uppercase tracking-widest mb-4">Application Progress</p>
              <ProgressTracker status={viewCenter.approval_status} full />
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
            <div className="flex gap-3">
              {(viewCenter.approval_status === 'hold' || viewCenter.approval_status === 'account_hold' || viewCenter.approval_status === 'rejected') && (
                <button onClick={() => navigate(`/super-center/centers/edit/${viewCenter.id}`)}
                  className="flex-1 inline-flex items-center justify-center gap-2 font-bold text-sm text-white bg-orange-500 hover:bg-orange-600 rounded-xl px-4 py-2.5 transition-all">
                  <Pencil size={14} /> Edit & Resubmit
                </button>
              )}
              <Button variant="outline" onClick={() => setViewCenter(null)} className="flex-1 justify-center">Close</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
