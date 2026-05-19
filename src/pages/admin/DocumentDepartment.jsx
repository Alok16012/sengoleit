import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import PageHeader from '../../components/ui/PageHeader'
import { Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui/Table'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import { CheckCircle, XCircle, Download, Eye, ExternalLink } from 'lucide-react'
import { generateStudentPDF } from '../../utils/generateStudentPDF'
import { resolveStudentDocUrls } from '../../utils/resolveStudentDocs'

const STATUS_FILTERS = ['Pending', 'Hold', 'Approved', 'Rejected']
const MAIN_TABS = [
  { key: 'students', label: 'Student Applications' },
  { key: 'centers', label: 'Center Applications' },
]

export default function DocumentDepartment() {
  const [mainTab, setMainTab] = useState('students')
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('Pending')
  const [verifyModal, setVerifyModal] = useState(null)
  const [rejectModal, setRejectModal] = useState(null)
  const [remarks, setRemarks] = useState('')
  const [saving, setSaving] = useState(false)
  const [downloading, setDownloading] = useState(null)
  const [viewStudent, setViewStudent] = useState(null)
  const [viewLoading, setViewLoading] = useState(false)

  // Center applications state (from center_applications table — via public link)
  const [centerApps, setCenterApps] = useState([])
  const [caLoading, setCaLoading] = useState(false)
  const [viewCA, setViewCA] = useState(null)
  const [caVerifyModal, setCAVerifyModal] = useState(null)
  const [caRemarks, setCARemarks] = useState('')
  const [caSaving, setCASaving] = useState(false)

  // Direct center registrations (from centers table — via SubCenterForm)
  const [directCenters, setDirectCenters] = useState([])
  const [dcLoading, setDcLoading] = useState(false)
  const [viewDC, setViewDC] = useState(null)
  const [dcVerifyModal, setDCVerifyModal] = useState(null)
  const [dcRemarks, setDCRemarks] = useState('')
  const [dcSaving, setDCSaving] = useState(false)

  // Centers sub-tab: 'direct' | 'link'
  const [centersSubTab, setCentersSubTab] = useState('direct')

  useEffect(() => { fetchStudents() }, [statusFilter])
  useEffect(() => {
    // pre-load centers data so badge count shows immediately
    fetchCenterApps()
    fetchDirectCenters()
  }, [])
  useEffect(() => {
    if (mainTab === 'centers') {
      fetchCenterApps()
      fetchDirectCenters()
    }
  }, [mainTab])

  async function fetchDirectCenters() {
    setDcLoading(true)
    const { data } = await supabase
      .from('centers')
      .select('*, states(state_name)')
      .eq('center_type', 'center')
      .eq('approval_status', 'pending')
      .order('created_at', { ascending: false })
    setDirectCenters(data || [])
    setDcLoading(false)
  }

  async function handleDCVerify() {
    setDCSaving(true)
    const { error } = await supabase.from('centers')
      .update({ approval_status: 'doc_verified' })
      .eq('id', dcVerifyModal.id)
    if (error) { alert('Verify failed: ' + error.message); setDCSaving(false); return }
    setDCSaving(false)
    setDCVerifyModal(null)
    setDCRemarks('')
    fetchDirectCenters()
  }

  async function handleDCReject(centerId) {
    if (!confirm('Reject this center registration?')) return
    await supabase.from('centers').update({ approval_status: 'rejected', status: 'Inactive' }).eq('id', centerId)
    fetchDirectCenters()
  }

  async function fetchCenterApps() {
    setCaLoading(true)
    const { data } = await supabase.from('center_applications')
      .select('*').eq('status', 'sc_forwarded').order('created_at', { ascending: false })
    setCenterApps(data || [])
    setCaLoading(false)
  }

  async function handleCAVerify() {
    setCASaving(true)
    await supabase.from('center_applications').update({
      status: 'doc_verified',
      doc_remarks: caRemarks || null,
      doc_verified_at: new Date().toISOString(),
    }).eq('id', caVerifyModal.id)
    setCASaving(false)
    setCAVerifyModal(null)
    setCARemarks('')
    fetchCenterApps()
  }

  async function handleCAReject(appId) {
    if (!confirm('Reject this center application?')) return
    await supabase.from('center_applications').update({ status: 'rejected' }).eq('id', appId)
    fetchCenterApps()
  }

  async function handleViewStudent(studentId) {
    setViewLoading(true)
    const { data } = await supabase
      .from('students')
      .select('*, programs(program_name), academic_sessions(session_name), centers(center_name, center_code), departments(name), study_modes(mode_name)')
      .eq('id', studentId)
      .single()
    const resolved = await resolveStudentDocUrls(data)
    setViewStudent(resolved)
    setViewLoading(false)
  }

  async function handleDownload(studentId) {
    setDownloading(studentId)
    const { data: s } = await supabase
      .from('students')
      .select('*, programs(program_name), academic_sessions(session_name), centers(center_name, center_code), departments(name), study_modes(mode_name)')
      .eq('id', studentId)
      .single()
    if (s) {
      const resolved = await resolveStudentDocUrls(s)
      generateStudentPDF(resolved, resolved.programs?.program_name, resolved.academic_sessions?.session_name, resolved.centers?.center_name)
    }
    setDownloading(null)
  }

  async function fetchStudents() {
    setLoading(true)
    const query = supabase
      .from('students')
      .select('id, student_name, mobile_no, gender, status, remarks, admission_number, enrollment_no, submitted_by, created_at, programs(program_name), academic_sessions(session_name), centers(center_name, center_code)')
      .order('created_at', { ascending: false })

    const { data } = statusFilter === 'All'
      ? await query
      : await query.eq('status', statusFilter)

    setStudents(data || [])
    setLoading(false)
  }

  async function generateAdmissionNumber() {
    const { count } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true })
      .not('admission_number', 'is', null)
      .neq('admission_number', '')
    const year = new Date().getFullYear()
    const num = String((count || 0) + 1).padStart(5, '0')
    return `ADM-${year}-${num}`
  }

  async function handleVerify() {
    setSaving(true)
    const admNo = await generateAdmissionNumber()
    await supabase.from('students').update({
      status: 'Hold',
      admission_number: admNo,
      remarks: remarks || null,
      doc_verified_at: new Date().toISOString(),
    }).eq('id', verifyModal.id)
    setSaving(false)
    setVerifyModal(null)
    setRemarks('')
    fetchStudents()
  }

  async function handleReject() {
    if (!remarks.trim()) { alert('Remarks likhna zaroori hai rejection ke liye'); return }
    setSaving(true)
    await supabase.from('students').update({
      status: 'Rejected',
      remarks: remarks,
    }).eq('id', rejectModal.id)
    setSaving(false)
    setRejectModal(null)
    setRemarks('')
    fetchStudents()
  }

  const pendingCount = students.filter(s => s.status === 'Pending').length

  return (
    <div className="p-6">
      <PageHeader title="Document Verification Department" subtitle="Verify student documents and forward to Account Department" />

      {/* Main tab switcher */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-xl w-fit">
        {MAIN_TABS.map(t => (
          <button key={t.key} onClick={() => setMainTab(t.key)}
            className={`relative px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              mainTab === t.key ? 'bg-white text-[#933d18] shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
            {t.key === 'centers' && (centerApps.length + directCenters.length) > 0 && (
              <span className="ml-2 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{centerApps.length + directCenters.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Center Applications Tab */}
      {mainTab === 'centers' && (
        <div>
          {/* Sub-tabs */}
          <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-xl w-fit">
            <button onClick={() => setCentersSubTab('direct')}
              className={`relative px-4 py-2 rounded-lg text-sm font-semibold transition-all ${centersSubTab === 'direct' ? 'bg-white text-[#933d18] shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}>
              Direct Registrations
              {directCenters.length > 0 && <span className="ml-2 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{directCenters.length}</span>}
            </button>
            <button onClick={() => setCentersSubTab('link')}
              className={`relative px-4 py-2 rounded-lg text-sm font-semibold transition-all ${centersSubTab === 'link' ? 'bg-white text-[#933d18] shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}>
              Via Registration Link
              {centerApps.length > 0 && <span className="ml-2 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{centerApps.length}</span>}
            </button>
          </div>

          {/* Direct Centers (from centers table) */}
          {centersSubTab === 'direct' && (
            dcLoading ? (
              <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Loading...</div>
            ) : (
              <Table>
                <Thead>
                  <tr>
                    <Th>#</Th>
                    <Th>Center Name</Th>
                    <Th>Contact Person</Th>
                    <Th>Super Center</Th>
                    <Th>State</Th>
                    <Th>Amount Paid</Th>
                    <Th>Submitted</Th>
                    <Th>Actions</Th>
                  </tr>
                </Thead>
                <Tbody>
                  {directCenters.length === 0 ? (
                    <Tr><Td colSpan={8} className="text-center text-gray-400 py-12">No direct center registrations pending document verification.</Td></Tr>
                  ) : directCenters.map((c, i) => (
                    <Tr key={c.id}>
                      <Td className="text-gray-400 text-xs w-10">{i + 1}</Td>
                      <Td>
                        <p className="font-semibold text-gray-900">{c.center_name}</p>
                        <p className="text-xs text-gray-400">{c.email}</p>
                      </Td>
                      <Td className="text-gray-500">{c.contact_person || '—'}</Td>
                      <Td className="text-gray-500 text-xs">{c.super_center_id ? <span className="font-mono text-[10px]">{c.super_center_id.slice(0, 8)}…</span> : '—'}</Td>
                      <Td className="text-gray-500 text-xs">{c.states?.state_name || '—'}</Td>
                      <Td className="font-bold text-gray-900">{c.amount_paid ? `₹${Number(c.amount_paid).toLocaleString()}` : '—'}</Td>
                      <Td className="text-gray-400 text-xs">{c.created_at ? new Date(c.created_at).toLocaleDateString('en-IN') : '—'}</Td>
                      <Td>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setViewDC(c)} title="View Details">
                            <Eye size={13} className="text-[#933d18]" />
                          </Button>
                          <Button size="sm" variant="success" onClick={() => { setDCVerifyModal(c); setDCRemarks('') }}>
                            <CheckCircle size={13} /> Verify
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => handleDCReject(c.id)}>
                            <XCircle size={13} />
                          </Button>
                        </div>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            )
          )}

          {/* View Direct Center Modal */}
          <Modal isOpen={!!viewDC} onClose={() => setViewDC(null)} title="Center Registration Details">
            {viewDC && (
              <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ['Center Name', viewDC.center_name],
                    ['Email', viewDC.email],
                    ['Phone', viewDC.phone],
                    ['Contact Person', viewDC.contact_person],
                    ['Aadhar No', viewDC.aadhar_no],
                    ['PAN No', viewDC.pan_no],
                    ['Organization', viewDC.organization_name],
                    ['Org Type', viewDC.org_type],
                    ['City', viewDC.city],
                    ['State', viewDC.states?.state_name],
                    ['Bank Account', viewDC.bank_account_number ? `****${viewDC.bank_account_number.slice(-4)}` : '—'],
                    ['IFSC', viewDC.ifsc_code],
                    ['Amount Paid', viewDC.amount_paid ? `₹${Number(viewDC.amount_paid).toLocaleString()}` : '—'],
                    ['UTR Number', viewDC.utr_number],
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
                      ['Owner Photo', viewDC.owner_photo_url],
                      ['Signature', viewDC.owner_signature_url],
                      ['Aadhar Card', viewDC.owner_aadhar_url],
                      ['PAN Card', viewDC.owner_pan_url],
                      ['Reg. Cert.', viewDC.center_reg_url],
                      ['Premises Photo', viewDC.premises_photo_url],
                      ['GST Cert.', viewDC.gst_url],
                      ['Agreement', viewDC.agreement_url],
                      ['Cancel Cheque', viewDC.cancel_cheque_url],
                      ['Bank Passbook', viewDC.bank_passbook_url],
                      ['Payment Proof', viewDC.payment_screenshot_url],
                    ].map(([label, url]) => (
                      <div key={label} className={`flex items-center justify-between px-3 py-2 rounded-lg border ${url ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'}`}>
                        <span className="text-xs text-gray-600">{label}</span>
                        {url ? <a href={url} target="_blank" rel="noreferrer" className="text-xs font-bold text-[#933d18] underline flex items-center gap-1"><ExternalLink size={11} /> View</a>
                          : <span className="text-xs text-gray-400">—</span>}
                      </div>
                    ))}
                  </div>
                </div>
                <Button onClick={() => { setViewDC(null); setDCVerifyModal(viewDC); setDCRemarks('') }} className="w-full justify-center">
                  <CheckCircle size={14} /> Verify Documents
                </Button>
              </div>
            )}
          </Modal>

          {/* Verify Direct Center Modal */}
          <Modal isOpen={!!dcVerifyModal} onClose={() => setDCVerifyModal(null)} title="Verify Center Documents">
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <p className="font-semibold text-gray-900">{dcVerifyModal?.center_name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{dcVerifyModal?.contact_person} · {dcVerifyModal?.email}</p>
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
                Verifying will forward this center to the <strong>Account Department</strong> for final approval and credential generation.
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Remarks (optional)</label>
                <textarea className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-[#933d18] resize-none"
                  rows={2} placeholder="Any document verification notes..."
                  value={dcRemarks} onChange={e => setDCRemarks(e.target.value)} />
              </div>
              <div className="flex gap-3">
                <Button variant="success" onClick={handleDCVerify} disabled={dcSaving}>{dcSaving ? 'Saving...' : 'Verify & Forward to Account Dept.'}</Button>
                <Button variant="outline" onClick={() => setDCVerifyModal(null)}>Cancel</Button>
              </div>
            </div>
          </Modal>

          {/* Link Applications (from center_applications table) */}
          {centersSubTab === 'link' && (
            caLoading ? (
              <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Loading...</div>
            ) : (
              <Table>
                <Thead>
                  <tr>
                    <Th>#</Th>
                    <Th>Organization / Applicant</Th>
                    <Th>Contact</Th>
                    <Th>Amount Paid</Th>
                    <Th>SC Remarks</Th>
                    <Th>Univ. Fee</Th>
                    <Th>SC Fee</Th>
                    <Th>Submitted</Th>
                    <Th>Actions</Th>
                  </tr>
                </Thead>
                <Tbody>
                  {centerApps.length === 0 ? (
                    <Tr><Td colSpan={9} className="text-center text-gray-400 py-12">No center applications pending document verification.</Td></Tr>
                  ) : centerApps.map((a, i) => (
                    <Tr key={a.id}>
                      <Td className="text-gray-400 text-xs w-10">{i + 1}</Td>
                      <Td>
                        <p className="font-semibold text-gray-900">{a.organization_name || '—'}</p>
                        <p className="text-xs text-gray-400">{a.full_name}</p>
                      </Td>
                      <Td>
                        <p className="text-sm text-gray-700">{a.phone}</p>
                        <p className="text-xs text-gray-400">{a.email}</p>
                      </Td>
                      <Td className="font-bold text-gray-900">₹{Number(a.amount_paid || 0).toLocaleString()}</Td>
                      <Td className="text-gray-500 text-xs max-w-[120px] truncate">{a.sc_remarks || '—'}</Td>
                      <Td className="font-semibold text-emerald-700">₹{Number(a.university_fee || 0).toLocaleString()}</Td>
                      <Td className="font-semibold text-blue-700">₹{Number(a.super_center_fee || 0).toLocaleString()}</Td>
                      <Td className="text-gray-400 text-xs">{a.created_at ? new Date(a.created_at).toLocaleDateString('en-IN') : '—'}</Td>
                      <Td>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setViewCA(a)} title="View Details">
                            <Eye size={13} className="text-[#933d18]" />
                          </Button>
                          <Button size="sm" variant="success" onClick={() => { setCAVerifyModal(a); setCARemarks('') }}>
                            <CheckCircle size={13} /> Verify
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => handleCAReject(a.id)}>
                            <XCircle size={13} />
                          </Button>
                        </div>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            )
          )}

          {/* View Center Application Modal */}
          <Modal isOpen={!!viewCA} onClose={() => setViewCA(null)} title="Center Application Details">
            {viewCA && (
              <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ['Organization', viewCA.organization_name],
                    ['Applicant', viewCA.full_name],
                    ['Email', viewCA.email],
                    ['Phone', viewCA.phone],
                    ['City', viewCA.org_city],
                    ['Aadhar No', viewCA.aadhar_no],
                    ['PAN No', viewCA.pan_no],
                    ['Amount Paid', `₹${Number(viewCA.amount_paid || 0).toLocaleString()}`],
                    ['UTR Number', viewCA.utr_number],
                    ['University Fee', `₹${Number(viewCA.university_fee || 0).toLocaleString()}`],
                    ['SC Fee', `₹${Number(viewCA.super_center_fee || 0).toLocaleString()}`],
                    ['SC Remarks', viewCA.sc_remarks],
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
                      ['Photo', viewCA.photo_url], ['Aadhar', viewCA.aadhar_upload_url],
                      ['PAN', viewCA.pan_upload_url], ['Marksheet', viewCA.marksheet_url],
                      ['Org Reg.', viewCA.organization_registration_no_url],
                      ['Premises', viewCA.premises_pic_url], ['Cheque', viewCA.cancel_cheque_url],
                      ['Payment SS', viewCA.payment_screenshot_url],
                    ].map(([label, url]) => (
                      <div key={label} className={`flex items-center justify-between px-3 py-2 rounded-lg border ${url ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'}`}>
                        <span className="text-xs text-gray-600">{label}</span>
                        {url ? <a href={url} target="_blank" rel="noreferrer" className="text-xs font-bold text-[#933d18] underline flex items-center gap-1"><ExternalLink size={11} /> View</a>
                          : <span className="text-xs text-gray-400">—</span>}
                      </div>
                    ))}
                  </div>
                </div>
                <Button onClick={() => { setViewCA(null); setCAVerifyModal(viewCA); setCARemarks('') }} className="w-full justify-center">
                  <CheckCircle size={14} /> Verify Documents
                </Button>
              </div>
            )}
          </Modal>

          {/* Verify Center App Modal */}
          <Modal isOpen={!!caVerifyModal} onClose={() => setCAVerifyModal(null)} title="Verify Center Application Documents">
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <p className="font-semibold text-gray-900">{caVerifyModal?.organization_name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{caVerifyModal?.full_name} · ₹{Number(caVerifyModal?.amount_paid || 0).toLocaleString()} paid</p>
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
                Verifying will forward this application to the <strong>Account Department</strong> for final approval and credential generation.
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Remarks (optional)</label>
                <textarea className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-[#933d18] resize-none"
                  rows={2} placeholder="Any document verification notes..."
                  value={caRemarks} onChange={e => setCARemarks(e.target.value)} />
              </div>
              <div className="flex gap-3">
                <Button variant="success" onClick={handleCAVerify} disabled={caSaving}>{caSaving ? 'Saving...' : 'Verify & Forward to Account Dept.'}</Button>
                <Button variant="outline" onClick={() => setCAVerifyModal(null)}>Cancel</Button>
              </div>
            </div>
          </Modal>
        </div>
      )}

      {/* Student Applications Tab */}
      {mainTab === 'students' && (
      <div>
      {/* Status filter tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit flex-wrap">
        {STATUS_FILTERS.map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`relative px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              statusFilter === s ? 'bg-white text-[#933d18] shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {s}
            {s === 'Pending' && pendingCount > 0 && (
              <span className="ml-1.5 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{pendingCount}</span>
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
              <Th>Student Name</Th>
              <Th>Program</Th>
              <Th>Session</Th>
              <Th>Center</Th>
              <Th>Submitted By</Th>
              <Th>Submitted On</Th>
              <Th>Admission No</Th>
              <Th>Remarks</Th>
              <Th>Status</Th>
              <Th>View</Th>
              <Th>Actions</Th>
            </tr>
          </Thead>
          <Tbody>
            {students.length === 0 ? (
              <Tr><Td colSpan={11} className="text-center text-gray-400 py-12">No students found</Td></Tr>
            ) : students.map((s, i) => (
              <Tr key={s.id}>
                <Td className="text-gray-400 text-xs w-10">{i + 1}</Td>
                <Td>
                  <p className="font-semibold text-gray-900">{s.student_name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{s.gender} • {s.mobile_no || '—'}</p>
                </Td>
                <Td className="text-gray-500 text-xs max-w-[140px] truncate">{s.programs?.program_name || '—'}</Td>
                <Td className="text-gray-500 text-xs">{s.academic_sessions?.session_name || '—'}</Td>
                <Td>
                  <p className="text-sm font-medium text-gray-700">{s.centers?.center_name || '—'}</p>
                  {s.centers?.center_code && <p className="text-xs text-gray-400">{s.centers.center_code}</p>}
                </Td>
                <Td>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    s.submitted_by === 'super_center' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'
                  }`}>
                    {s.submitted_by === 'super_center' ? 'Super Center' : s.submitted_by === 'center' ? 'Center' : 'Admin'}
                  </span>
                </Td>
                <Td className="text-gray-400 text-xs">{s.created_at ? new Date(s.created_at).toLocaleDateString('en-IN') : '—'}</Td>
                <Td className="font-mono text-xs text-gray-700">{s.admission_number || '—'}</Td>
                <Td className="text-gray-500 text-xs max-w-[120px] truncate" title={s.remarks}>{s.remarks || '—'}</Td>
                <Td><Badge status={s.status?.toLowerCase()}>{s.status || 'Pending'}</Badge></Td>
                <Td>
                  <Button size="sm" variant="ghost" onClick={() => handleViewStudent(s.id)} title="View full form & documents">
                    <Eye size={13} className="text-[#933d18]" />
                  </Button>
                </Td>
                <Td>
                  <div className="flex gap-1 flex-wrap">
                    {s.status === 'Pending' && (
                      <>
                        <Button size="sm" variant="success" onClick={() => { setVerifyModal(s); setRemarks('') }}>
                          <CheckCircle size={13} /> Verify
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => { setRejectModal(s); setRemarks('') }}>
                          <XCircle size={13} />
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => handleDownload(s.id)} disabled={downloading === s.id} title="Download PDF">
                      <Download size={13} className={downloading === s.id ? 'animate-pulse text-[#933d18]' : 'text-gray-500'} />
                    </Button>
                  </div>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      {/* View Student Modal */}
      <Modal isOpen={!!viewStudent || viewLoading} onClose={() => setViewStudent(null)} title="Student Full Details & Documents">
        {viewLoading ? (
          <div className="flex items-center justify-center py-12 text-gray-400">Loading...</div>
        ) : viewStudent ? (
          <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            <div className="flex gap-4 items-start bg-gray-50 rounded-xl p-4 border border-gray-100">
              {viewStudent.photo_url
                ? <img src={viewStudent.photo_url} alt="Photo" className="w-20 h-24 object-cover rounded-xl border-2 border-[#933d18]/20 shrink-0" />
                : <div className="w-20 h-24 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center bg-white shrink-0 text-xs text-gray-400 text-center px-1">No Photo</div>
              }
              <div>
                <p className="text-lg font-black text-gray-900">{viewStudent.student_name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{viewStudent.gender} • {viewStudent.mobile_no} • {viewStudent.email}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="text-xs bg-[#933d18]/10 text-[#933d18] font-bold px-2 py-1 rounded-lg">{viewStudent.programs?.program_name || '—'}</span>
                  <span className="text-xs bg-gray-100 text-gray-600 font-semibold px-2 py-1 rounded-lg">{viewStudent.academic_sessions?.session_name || '—'}</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">Dept: {viewStudent.departments?.name || '—'} • Mode: {viewStudent.study_modes?.mode_name || '—'}</p>
                <p className="text-xs text-gray-400 mt-0.5">Center: {viewStudent.centers?.center_name || '—'}</p>
              </div>
            </div>

            {/* Documents */}
            <div className="bg-white border border-gray-100 rounded-xl p-3">
              <p className="text-xs font-bold text-[#933d18] uppercase tracking-wider mb-3">Uploaded Documents</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Student Photo', url: viewStudent.photo_url, isImg: true },
                  { label: 'Signature', url: viewStudent.signature_url, isImg: true },
                  { label: 'Aadhar Card', url: viewStudent.aadhar_url },
                  { label: 'Declaration Form', url: viewStudent.declaration_url },
                  { label: '10th Marksheet', url: viewStudent.tenth_marksheet_url },
                  { label: '12th Marksheet', url: viewStudent.twelfth_marksheet_url },
                  { label: 'UG Marksheet', url: viewStudent.ug_marksheet_url },
                  { label: 'PG Marksheet', url: viewStudent.pg_marksheet_url },
                  { label: 'Diploma Marksheet', url: viewStudent.diploma_marksheet_url },
                ].map(doc => (
                  <div key={doc.label} className={`flex items-center justify-between px-3 py-2 rounded-lg border ${doc.url ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'}`}>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${doc.url ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                      <span className="text-xs font-medium text-gray-700">{doc.label}</span>
                    </div>
                    {doc.url
                      ? <a href={doc.url} target="_blank" rel="noreferrer" className="text-xs font-bold text-[#933d18] hover:underline flex items-center gap-1"><Eye size={11} /> View</a>
                      : <span className="text-xs text-gray-400">Not uploaded</span>
                    }
                  </div>
                ))}
              </div>
            </div>

            {/* Education */}
            <div className="bg-white border border-gray-100 rounded-xl p-3">
              <p className="text-xs font-bold text-[#933d18] uppercase tracking-wider mb-2">Education</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-1 text-gray-400 font-semibold">Level</th>
                    <th className="text-left py-1 text-gray-400 font-semibold">Institute</th>
                    <th className="text-left py-1 text-gray-400 font-semibold">Board</th>
                    <th className="text-left py-1 text-gray-400 font-semibold">Year</th>
                    <th className="text-left py-1 text-gray-400 font-semibold">%</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { level: '10th', inst: viewStudent.tenth_institute_name, board: viewStudent.tenth_board_university, year: viewStudent.tenth_passing_year, obt: viewStudent.tenth_obtained_marks, tot: viewStudent.tenth_total_marks },
                    { level: '12th', inst: viewStudent.twelfth_institute_name, board: viewStudent.twelfth_board_university, year: viewStudent.twelfth_passing_year, obt: viewStudent.twelfth_obtained_marks, tot: viewStudent.twelfth_total_marks },
                    { level: 'UG', inst: viewStudent.ug_institute_name, board: viewStudent.ug_board_university, year: viewStudent.ug_passing_year, obt: viewStudent.ug_obtained_marks, tot: viewStudent.ug_total_marks },
                    { level: 'PG', inst: viewStudent.pg_institute_name, board: viewStudent.pg_board_university, year: viewStudent.pg_passing_year, obt: viewStudent.pg_obtained_marks, tot: viewStudent.pg_total_marks },
                    { level: 'Diploma', inst: viewStudent.diploma_institute_name, board: viewStudent.diploma_board_university, year: viewStudent.diploma_passing_year, obt: viewStudent.diploma_obtained_marks, tot: viewStudent.diploma_total_marks },
                  ].filter(e => e.inst).map(e => (
                    <tr key={e.level} className="border-b border-gray-50">
                      <td className="py-1.5 font-bold text-[#933d18]">{e.level}</td>
                      <td className="py-1.5 text-gray-700">{e.inst}</td>
                      <td className="py-1.5 text-gray-500">{e.board || '—'}</td>
                      <td className="py-1.5 text-gray-500">{e.year || '—'}</td>
                      <td className="py-1.5 font-bold text-emerald-700">
                        {e.obt && e.tot ? ((parseFloat(e.obt) / parseFloat(e.tot)) * 100).toFixed(1) + '%' : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-3 pt-1 border-t border-gray-100 sticky bottom-0 bg-white pb-1">
              {viewStudent.status === 'Pending' && (
                <>
                  <Button variant="success" onClick={() => { setVerifyModal(viewStudent); setViewStudent(null); setRemarks('') }}>
                    <CheckCircle size={14} /> Verify & Forward
                  </Button>
                  <Button variant="danger" onClick={() => { setRejectModal(viewStudent); setViewStudent(null); setRemarks('') }}>
                    <XCircle size={14} /> Reject
                  </Button>
                </>
              )}
              <Button variant="outline" onClick={() => setViewStudent(null)}>Close</Button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Verify Modal */}
      <Modal isOpen={!!verifyModal} onClose={() => setVerifyModal(null)} title="Verify Student Documents">
        <div className="space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <p className="font-semibold text-gray-900">{verifyModal?.student_name}</p>
            <p className="text-xs text-gray-500 mt-1">{verifyModal?.programs?.program_name}</p>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
            Verify karne par ek <strong>Admission Number auto-generate</strong> hoga aur student <strong>Hold</strong> status mein Account Dept. ko jayega.
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Remarks (optional)</label>
            <textarea
              className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-[#933d18] resize-none"
              rows={2}
              placeholder="Any notes..."
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
            />
          </div>
          <div className="flex gap-3">
            <Button variant="success" onClick={handleVerify} disabled={saving}>{saving ? 'Saving...' : 'Verify & Forward to Account Dept.'}</Button>
            <Button variant="outline" onClick={() => setVerifyModal(null)}>Cancel</Button>
          </div>
        </div>
      </Modal>

      {/* Reject Modal */}
      <Modal isOpen={!!rejectModal} onClose={() => setRejectModal(null)} title="Reject Student Application">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            <strong>{rejectModal?.student_name}</strong> ka application reject karna chahte ho?
          </p>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Rejection Reason <span className="text-red-500">*</span></label>
            <textarea
              className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-red-400 resize-none"
              rows={3}
              placeholder="Rejection ka karan likhein (required)..."
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
            />
          </div>
          <div className="flex gap-3">
            <Button variant="danger" onClick={handleReject} disabled={saving}>{saving ? 'Saving...' : 'Confirm Reject'}</Button>
            <Button variant="outline" onClick={() => setRejectModal(null)}>Cancel</Button>
          </div>
        </div>
      </Modal>
      </div>
      )}
    </div>
  )
}
