import { useEffect, useState } from 'react'
import { supabase, supabaseAdmin } from '../../lib/supabase'
import PageHeader from '../../components/ui/PageHeader'
import { Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui/Table'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import { CheckCircle, XCircle, ToggleLeft, ToggleRight, Eye, EyeOff, Pencil, Save, FileText, Download } from 'lucide-react'
import { generateStudentPDF } from '../../utils/generateStudentPDF'
import { resolveStudentDocUrls } from '../../utils/resolveStudentDocs'

const TABS = [
  { key: 'students', label: 'Student Applications' },
  { key: 'approvals', label: 'Pending Approvals' },
  { key: 'recharges', label: 'Recharge Requests' },
  { key: 'center_apps', label: 'Center Applications' },
  { key: 'centers', label: 'Centers Management' },
]

export default function AccountDepartment() {
  const [tab, setTab] = useState('students')
  const [approvals, setApprovals] = useState([])
  const [recharges, setRecharges] = useState([])
  const [centers, setCenters] = useState([])
  const [holdStudents, setHoldStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [rejectModal, setRejectModal] = useState(null)
  const [rejectNotes, setRejectNotes] = useState('')
  const [approvedModal, setApprovedModal] = useState(null)
  const [studentActionModal, setStudentActionModal] = useState(null)
  const [studentRemarks, setStudentRemarks] = useState('')
  const [viewStudent, setViewStudent] = useState(null)
  const [viewLoading, setViewLoading] = useState(false)
  const [downloading, setDownloading] = useState(null)
  const [visiblePasswords, setVisiblePasswords] = useState({})
  const [editingPassword, setEditingPassword] = useState({})
  const [centerApps, setCenterApps] = useState([])
  const [caApproveModal, setCAApproveModal] = useState(null)
  const [caAccRemarks, setCAAccRemarks] = useState('')
  const [caSaving, setCASaving] = useState(false)
  const [caSuccess, setCASuccess] = useState(null)

  useEffect(() => { fetchAll() }, [])
  useEffect(() => { if (tab === 'center_apps') fetchCenterApps() }, [tab])

  async function fetchCenterApps() {
    const { data } = await supabase.from('center_applications')
      .select('*').eq('status', 'doc_verified').order('created_at', { ascending: false })
    setCenterApps(data || [])
  }

  async function handleCAApprove() {
    if (!caApproveModal) return
    setCASaving(true)
    const app = caApproveModal

    const centerCode = await generateNextCenterCode()
    const newPassword = `Sg@${Math.random().toString(36).slice(-6).toUpperCase()}`

    const { data: newCenter, error: cErr } = await supabase.from('centers').insert({
      center_name: app.organization_name || app.full_name,
      contact_person: app.full_name,
      email: app.email,
      phone: app.phone,
      center_code: centerCode,
      center_type: 'center',
      approval_status: 'approved',
      status: 'Active',
      virtual_balance: 0,
      generated_password: newPassword,
      super_center_id: app.super_center_id,
    }).select().single()

    if (cErr) { alert('Failed to create center: ' + cErr.message); setCASaving(false); return }

    const adminSession = (await supabase.auth.getSession()).data.session
    const { data: authUser } = await supabase.auth.signUp({
      email: app.email,
      password: newPassword,
      options: { data: { role: 'center' } },
    })
    if (authUser?.user) {
      await supabase.from('profiles').upsert({ id: authUser.user.id, role: 'center' })
    }
    if (adminSession?.access_token) {
      await supabase.auth.setSession({ access_token: adminSession.access_token, refresh_token: adminSession.refresh_token })
    }

    const univFee = Math.round(parseFloat(app.university_fee) || 0)
    const scFee   = Math.round(parseFloat(app.super_center_fee) || 0)

    const newCenterCoupons = Array.from({ length: univFee }, () => ({
      center_id: newCenter.id,
      face_value: 1,
      application_id: app.id,
    }))
    const scCoupons = Array.from({ length: scFee }, () => ({
      center_id: app.super_center_id,
      face_value: 1,
      application_id: app.id,
    }))
    if (newCenterCoupons.length) await supabase.from('coupons').insert(newCenterCoupons)
    if (scCoupons.length)        await supabase.from('coupons').insert(scCoupons)

    await supabase.from('center_applications').update({
      status: 'approved',
      generated_center_id: newCenter.id,
      acc_remarks: caAccRemarks || null,
      acc_verified_at: new Date().toISOString(),
    }).eq('id', app.id)

    setCASaving(false)
    setCAApproveModal(null)
    setCAAccRemarks('')
    setCASuccess({ center: newCenter, password: newPassword, univCoupons: univFee, scCoupons: scFee })
    fetchCenterApps()
  }

  async function handleCAReject(appId) {
    if (!confirm('Reject this center application?')) return
    await supabase.from('center_applications').update({ status: 'rejected' }).eq('id', appId)
    fetchCenterApps()
  }

  async function fetchAll() {
    setLoading(true)
    // Pending Approvals:
    //   - super_centers with approval_status = 'pending' (direct admin approval, no doc dept step)
    //   - centers (center_type = 'center') with approval_status = 'doc_verified' (passed through doc dept)
    const [superCenterPending, centerDocVerified, rech, ctr, holdStu] = await Promise.all([
      supabase.from('centers').select('*').eq('center_type', 'super_center').eq('approval_status', 'pending').order('created_at', { ascending: false }),
      supabase.from('centers').select('*').eq('center_type', 'center').eq('approval_status', 'doc_verified').order('created_at', { ascending: false }),
      supabase.from('recharge_requests').select('*').order('created_at', { ascending: false }),
      supabase.from('centers').select('*').not('approval_status', 'in', '("pending","doc_verified")').order('created_at', { ascending: false }),
      supabase.from('students').select('id, student_name, mobile_no, gender, status, remarks, admission_number, enrollment_no, doc_verified_at, created_at, programme_id, session_id, programs(program_name, enrollment_code), academic_sessions(session_name), centers(center_name, center_code)').eq('status', 'Hold').not('doc_verified_at', 'is', null).order('created_at', { ascending: false }),
    ])
    setApprovals([...(superCenterPending.data || []), ...(centerDocVerified.data || [])])
    setRecharges(rech.data || [])
    setCenters(ctr.data || [])
    setHoldStudents(holdStu.data || [])
    setLoading(false)
  }

  async function savePassword(centerId) {
    const newPass = editingPassword[centerId]?.trim()
    if (!newPass) return
    const center = centers.find(c => c.id === centerId)
    if (!center?.email) { alert('Center ka email nahi hai.'); return }

    // 1. Save password to DB for display
    await supabase.from('centers').update({ generated_password: newPass }).eq('id', centerId)

    // 2. Save admin session before any auth changes
    const { data: { session: adminSession } } = await supabase.auth.getSession()

    // 3. Create/update Supabase Auth user via signUp
    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
      email: center.email,
      password: newPass,
      options: { data: { role: center.center_type === 'super_center' ? 'super_center' : 'center' } }
    })

    if (!signUpErr && signUpData?.user) {
      await supabase.from('profiles').upsert({
        id: signUpData.user.id,
        role: center.center_type === 'super_center' ? 'super_center' : 'center'
      })
    }

    // 4. Always restore admin session
    if (adminSession?.access_token) {
      await supabase.auth.setSession({
        access_token: adminSession.access_token,
        refresh_token: adminSession.refresh_token,
      })
    }

    if (signUpErr && signUpErr.message.toLowerCase().includes('already registered')) {
      alert(`Yeh email already registered hai. Password change ke liye Supabase Dashboard → Authentication → Users mein jaake manually reset karo.`)
    } else if (signUpErr) {
      alert('Error: ' + signUpErr.message)
    } else {
      alert(`✓ Password set! Ab ${center.email} + password se login hoga.`)
    }

    setEditingPassword(prev => { const n = { ...prev }; delete n[centerId]; return n })
    fetchAll()
  }

  async function generateNextCenterCode() {
    const { data } = await supabase.from('centers').select('center_code').not('center_code', 'is', null)
    const nums = (data || [])
      .map(c => c.center_code?.match(/^SIU(\d+)$/)?.[1])
      .filter(Boolean)
      .map(Number)
    const next = nums.length > 0 ? Math.max(...nums) + 1 : 1
    return `SIU${String(next).padStart(3, '0')}`
  }

  async function handleApprove(center) {
    const centerCode = center.center_code || await generateNextCenterCode()
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

  async function handleDownloadPDF(studentId) {
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

  async function handleStudentApprove(student) {
    setStudentActionModal({ student, type: 'approve' })
    setStudentRemarks('')
  }

  async function handleStudentReject(student) {
    setStudentActionModal({ student, type: 'reject' })
    setStudentRemarks('')
  }

  async function generateEnrollmentNumber(student) {
    const enrollCode = student.programs?.enrollment_code || 'GEN'
    const sessName   = student.academic_sessions?.session_name || ''
    const yearMatch  = sessName.match(/(\d{4})/)
    const yy         = yearMatch ? yearMatch[1].slice(-2) : String(new Date().getFullYear()).slice(-2)
    const prefix     = `EN${yy}${enrollCode}`

    // Count enrollments for same program + session to keep sequence per-program
    let q = supabase.from('students')
      .select('*', { count: 'exact', head: true })
      .not('enrollment_no', 'is', null)
      .neq('enrollment_no', '')
    if (student.programme_id) q = q.eq('programme_id', student.programme_id)
    if (student.session_id)   q = q.eq('session_id', student.session_id)
    const { count } = await q

    return `${prefix}${String((count || 0) + 1).padStart(4, '0')}`
  }

  async function confirmStudentAction() {
    const { student, type } = studentActionModal
    if (type === 'reject' && !studentRemarks.trim()) {
      alert('Rejection ka reason likhna zaroori hai')
      return
    }
    if (type === 'approve') {
      const enrollNo = await generateEnrollmentNumber(student)
      await supabase.from('students').update({
        status: 'Approved',
        enrollment_no: enrollNo,
        remarks: studentRemarks || null,
      }).eq('id', student.id)
    } else {
      await supabase.from('students').update({
        status: 'Rejected',
        remarks: studentRemarks,
      }).eq('id', student.id)
    }
    setStudentActionModal(null)
    setStudentRemarks('')
    fetchAll()
  }

  async function toggleCenterStatus(center) {
    const newStatus = center.status === 'Active' ? 'Inactive' : 'Active'
    await supabase.from('centers').update({ status: newStatus }).eq('id', center.id)
    fetchAll()
  }

  async function handleDeleteCenter(id, name) {
    if (!confirm(`"${name}" ko permanently delete karna chahte ho?`)) return
    const { error } = await supabase.from('centers').delete().eq('id', id)
    if (error) { alert('Delete failed: ' + error.message); return }
    fetchAll()
  }

  const pendingCount = approvals.length
  const pendingRecharges = recharges.filter(r => r.status === 'pending').length
  const holdCount = holdStudents.length
  const pendingCenterApps = centerApps.length

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
            {t.key === 'students' && holdCount > 0 && (
              <span className="ml-2 bg-indigo-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{holdCount}</span>
            )}
            {t.key === 'approvals' && pendingCount > 0 && (
              <span className="ml-2 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{pendingCount}</span>
            )}
            {t.key === 'recharges' && pendingRecharges > 0 && (
              <span className="ml-2 bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{pendingRecharges}</span>
            )}
            {t.key === 'center_apps' && pendingCenterApps > 0 && (
              <span className="ml-2 bg-purple-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{pendingCenterApps}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Loading...</div>
      ) : (
        <>
          {/* STUDENT APPLICATIONS TAB */}
          {tab === 'students' && (
            <Table>
              <Thead>
                <tr>
                  <Th>#</Th>
                  <Th>Student Name</Th>
                  <Th>Program</Th>
                  <Th>Session</Th>
                  <Th>Center</Th>
                  <Th>Admission No</Th>
                  <Th>Doc Verified On</Th>
                  <Th>Remarks</Th>
                  <Th>View</Th>
                  <Th>Actions</Th>
                </tr>
              </Thead>
              <Tbody>
                {holdStudents.length === 0 ? (
                  <Tr><Td colSpan={9} className="text-center text-gray-400 py-12">No student applications pending in Account Dept.</Td></Tr>
                ) : holdStudents.map((s, i) => (
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
                    <Td className="font-mono text-xs text-[#933d18] font-bold">{s.admission_number || '—'}</Td>
                    <Td className="text-gray-400 text-xs">{s.doc_verified_at ? new Date(s.doc_verified_at).toLocaleDateString('en-IN') : '—'}</Td>
                    <Td className="text-gray-500 text-xs max-w-[120px] truncate" title={s.remarks}>{s.remarks || '—'}</Td>
                    <Td>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => handleViewStudent(s.id)} title="View full form & documents">
                          <Eye size={13} className="text-[#933d18]" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDownloadPDF(s.id)} disabled={downloading === s.id} title="Download PDF">
                          <Download size={13} className={downloading === s.id ? 'animate-pulse text-[#933d18]' : 'text-gray-400'} />
                        </Button>
                      </div>
                    </Td>
                    <Td>
                      <div className="flex gap-1">
                        <Button size="sm" variant="success" onClick={() => handleStudentApprove(s)}>
                          <CheckCircle size={13} /> Approve
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => handleStudentReject(s)}>
                          <XCircle size={13} /> Reject
                        </Button>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}

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

          {/* CENTER APPLICATIONS TAB */}
          {tab === 'center_apps' && (
            <Table>
              <Thead>
                <tr>
                  <Th>#</Th>
                  <Th>Organization / Applicant</Th>
                  <Th>Contact</Th>
                  <Th>Amount Paid</Th>
                  <Th>Univ. Fee</Th>
                  <Th>SC Fee</Th>
                  <Th>SC Remarks</Th>
                  <Th>Doc Remarks</Th>
                  <Th>Submitted</Th>
                  <Th>Actions</Th>
                </tr>
              </Thead>
              <Tbody>
                {centerApps.length === 0 ? (
                  <Tr><Td colSpan={10} className="text-center text-gray-400 py-12">No center applications pending account verification.</Td></Tr>
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
                    <Td className="font-semibold text-emerald-700">₹{Number(a.university_fee || 0).toLocaleString()}</Td>
                    <Td className="font-semibold text-blue-700">₹{Number(a.super_center_fee || 0).toLocaleString()}</Td>
                    <Td className="text-gray-500 text-xs max-w-[100px] truncate">{a.sc_remarks || '—'}</Td>
                    <Td className="text-gray-500 text-xs max-w-[100px] truncate">{a.doc_remarks || '—'}</Td>
                    <Td className="text-gray-400 text-xs">{a.created_at ? new Date(a.created_at).toLocaleDateString('en-IN') : '—'}</Td>
                    <Td>
                      <div className="flex gap-1">
                        <Button size="sm" variant="success" onClick={() => { setCAApproveModal(a); setCAAccRemarks('') }}>
                          <CheckCircle size={13} /> Approve
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
                  <Th>Password</Th>
                  <Th>State</Th>
                  <Th>Virtual Balance</Th>
                  <Th>KYC</Th>
                  <Th>Approval</Th>
                  <Th>Status</Th>
                  <Th>Activate/Deactivate</Th>
                  <Th>Delete</Th>
                </tr>
              </Thead>
              <Tbody>
                {centers.length === 0 ? (
                  <Tr><Td colSpan={12} className="text-center text-gray-400 py-12">No centers</Td></Tr>
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
                    <Td>
                      {editingPassword.hasOwnProperty(c.id) ? (
                        <div className="flex items-center gap-1">
                          <input
                            autoFocus
                            type="text"
                            value={editingPassword[c.id]}
                            onChange={e => setEditingPassword(prev => ({ ...prev, [c.id]: e.target.value }))}
                            onKeyDown={e => { if (e.key === 'Enter') savePassword(c.id); if (e.key === 'Escape') setEditingPassword(prev => { const n = { ...prev }; delete n[c.id]; return n }) }}
                            className="border border-[#933d18]/40 rounded-lg px-2 py-1 text-xs w-28 focus:outline-none focus:border-[#933d18]"
                            placeholder="New password"
                          />
                          <button onClick={() => savePassword(c.id)} className="text-emerald-600 hover:text-emerald-700">
                            <Save size={13} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs text-gray-800">
                            {c.generated_password
                              ? (visiblePasswords[c.id] ? c.generated_password : '••••••••')
                              : <span className="text-gray-300 text-xs">not set</span>}
                          </span>
                          {c.generated_password && (
                            <button onClick={() => setVisiblePasswords(prev => ({ ...prev, [c.id]: !prev[c.id] }))} className="text-gray-400 hover:text-[#933d18] transition-colors">
                              {visiblePasswords[c.id] ? <EyeOff size={12} /> : <Eye size={12} />}
                            </button>
                          )}
                          <button
                            onClick={() => setEditingPassword(prev => ({ ...prev, [c.id]: c.generated_password || '' }))}
                            className="text-gray-300 hover:text-[#933d18] transition-colors"
                            title="Set / Edit password"
                          >
                            <Pencil size={12} />
                          </button>
                        </div>
                      )}
                    </Td>
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
                    <Td>
                      <button
                        onClick={() => handleDeleteCenter(c.id, c.center_name)}
                        className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 transition-all"
                      >
                        <XCircle size={14} /> Delete
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
              <span className="font-mono font-bold text-gray-900">{approvedModal?.generated_password || '(Set by center at registration)'}</span>
            </div>
          </div>

          <p className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3">
            Ye credentials center ko share karo. Woh portal pe login karke apna dashboard access kar sakte hain.
          </p>
          <Button onClick={() => setApprovedModal(null)} className="w-full justify-center">Done</Button>
        </div>
      </Modal>

      {/* View Student Modal */}
      <Modal isOpen={!!viewStudent || viewLoading} onClose={() => setViewStudent(null)} title="Student Full Details">
        {viewLoading ? (
          <div className="flex items-center justify-center py-12 text-gray-400">Loading...</div>
        ) : viewStudent ? (
          <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            {/* Header */}
            <div className="flex gap-4 items-start bg-gray-50 rounded-xl p-4 border border-gray-100">
              {viewStudent.photo_url
                ? <img src={viewStudent.photo_url} alt="Photo" className="w-20 h-24 object-cover rounded-xl border-2 border-[#933d18]/20 shrink-0" />
                : <div className="w-20 h-24 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center bg-white shrink-0 text-xs text-gray-400 text-center px-1">No Photo</div>
              }
              <div>
                <p className="text-lg font-black text-gray-900">{viewStudent.student_name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{viewStudent.gender} • {viewStudent.mobile_no}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="text-xs bg-[#933d18]/10 text-[#933d18] font-bold px-2 py-1 rounded-lg">{viewStudent.programs?.program_name || '—'}</span>
                  <span className="text-xs bg-gray-100 text-gray-600 font-semibold px-2 py-1 rounded-lg">{viewStudent.academic_sessions?.session_name || '—'}</span>
                  <span className="text-xs bg-indigo-50 text-indigo-700 font-bold px-2 py-1 rounded-lg">Admission: {viewStudent.admission_number || '—'}</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">Center: {viewStudent.centers?.center_name || '—'} {viewStudent.centers?.center_code ? `(${viewStudent.centers.center_code})` : ''}</p>
              </div>
            </div>

            {/* Program Details */}
            <div className="bg-white border border-gray-100 rounded-xl p-3">
              <p className="text-xs font-bold text-[#933d18] uppercase tracking-wider mb-2">Program Details</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                {[
                  ['Department', viewStudent.departments?.name || viewStudent.department_id],
                  ['Program', viewStudent.programs?.program_name],
                  ['Course Code', viewStudent.course_code],
                  ['Semester/Year', viewStudent.semester_year],
                  ['Mode', viewStudent.study_modes?.mode_name || viewStudent.mode_id],
                  ['Entry Type', viewStudent.entry_type],
                  ['Academic Year', viewStudent.academic_year],
                  ['Submission Date', viewStudent.date_of_submission],
                ].map(([label, val]) => (
                  <div key={label} className="flex gap-2 text-xs py-0.5">
                    <span className="text-gray-400 w-28 shrink-0">{label}</span>
                    <span className="font-medium text-gray-800">: {val || '—'}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Personal Info */}
            <div className="bg-white border border-gray-100 rounded-xl p-3">
              <p className="text-xs font-bold text-[#933d18] uppercase tracking-wider mb-2">Personal Information</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                {[
                  ['Date of Birth', viewStudent.date_of_birth],
                  ['Aadhar No', viewStudent.aadhar_no],
                  ['Email', viewStudent.email],
                  ['WhatsApp', viewStudent.whatsapp_no],
                  ['Caste', viewStudent.caste],
                  ['Religion', viewStudent.religion],
                  ['Father\'s Name', viewStudent.fathers_name],
                  ['Mother\'s Name', viewStudent.mothers_name],
                ].map(([label, val]) => (
                  <div key={label} className="flex gap-2 text-xs py-0.5">
                    <span className="text-gray-400 w-28 shrink-0">{label}</span>
                    <span className="font-medium text-gray-800">: {val || '—'}</span>
                  </div>
                ))}
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
                    {doc.url ? (
                      <a href={doc.url} target="_blank" rel="noreferrer" className="text-xs font-bold text-[#933d18] hover:underline flex items-center gap-1">
                        <Eye size={11} /> View
                      </a>
                    ) : (
                      <span className="text-xs text-gray-400">Not uploaded</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Education */}
            {(viewStudent.tenth_institute_name || viewStudent.twelfth_institute_name || viewStudent.ug_institute_name) && (
              <div className="bg-white border border-gray-100 rounded-xl p-3">
                <p className="text-xs font-bold text-[#933d18] uppercase tracking-wider mb-2">Education</p>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-1 text-gray-400 font-semibold">Level</th>
                      <th className="text-left py-1 text-gray-400 font-semibold">Institute</th>
                      <th className="text-left py-1 text-gray-400 font-semibold">Year</th>
                      <th className="text-left py-1 text-gray-400 font-semibold">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { level: '10th', inst: viewStudent.tenth_institute_name, year: viewStudent.tenth_passing_year, obt: viewStudent.tenth_obtained_marks, tot: viewStudent.tenth_total_marks },
                      { level: '12th', inst: viewStudent.twelfth_institute_name, year: viewStudent.twelfth_passing_year, obt: viewStudent.twelfth_obtained_marks, tot: viewStudent.twelfth_total_marks },
                      { level: 'UG', inst: viewStudent.ug_institute_name, year: viewStudent.ug_passing_year, obt: viewStudent.ug_obtained_marks, tot: viewStudent.ug_total_marks },
                      { level: 'PG', inst: viewStudent.pg_institute_name, year: viewStudent.pg_passing_year, obt: viewStudent.pg_obtained_marks, tot: viewStudent.pg_total_marks },
                    ].filter(e => e.inst).map(e => (
                      <tr key={e.level} className="border-b border-gray-50">
                        <td className="py-1.5 font-bold text-[#933d18]">{e.level}</td>
                        <td className="py-1.5 text-gray-700">{e.inst}</td>
                        <td className="py-1.5 text-gray-500">{e.year || '—'}</td>
                        <td className="py-1.5 font-bold text-emerald-700">
                          {e.obt && e.tot ? ((parseFloat(e.obt) / parseFloat(e.tot)) * 100).toFixed(1) + '%' : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex gap-3 pt-1 border-t border-gray-100 sticky bottom-0 bg-white pb-1">
              <Button variant="success" onClick={() => { setViewStudent(null); handleStudentApprove(viewStudent) }}>
                <CheckCircle size={14} /> Approve
              </Button>
              <Button variant="danger" onClick={() => { setViewStudent(null); handleStudentReject(viewStudent) }}>
                <XCircle size={14} /> Reject
              </Button>
              <Button variant="ghost" onClick={() => handleDownloadPDF(viewStudent.id)} disabled={downloading === viewStudent.id}>
                <Download size={14} /> PDF
              </Button>
              <Button variant="outline" onClick={() => setViewStudent(null)}>Close</Button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Student Action Modal */}
      <Modal
        isOpen={!!studentActionModal}
        onClose={() => setStudentActionModal(null)}
        title={studentActionModal?.type === 'approve' ? 'Approve Student Application' : 'Reject Student Application'}
      >
        <div className="space-y-4">
          <div className={`border rounded-xl p-4 ${studentActionModal?.type === 'approve' ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
            <p className="font-semibold text-gray-900">{studentActionModal?.student?.student_name}</p>
            <p className="text-xs text-gray-500 mt-1">{studentActionModal?.student?.programs?.program_name}</p>
            <p className="text-xs font-mono text-[#933d18] mt-1">Admission No: {studentActionModal?.student?.admission_number || '—'}</p>
          </div>
          {studentActionModal?.type === 'approve' && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
              Approve karne par student ka <strong>Enrollment Number</strong> aur <strong>Admission Number</strong> center/super center ko visible ho jayega.
            </div>
          )}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">
              Remarks {studentActionModal?.type === 'reject' && <span className="text-red-500">*</span>}
            </label>
            <textarea
              className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-[#933d18] resize-none"
              rows={3}
              placeholder={studentActionModal?.type === 'reject' ? 'Rejection ka karan likhein (required)...' : 'Any additional notes (optional)...'}
              value={studentRemarks}
              onChange={e => setStudentRemarks(e.target.value)}
            />
          </div>
          <div className="flex gap-3">
            <Button
              variant={studentActionModal?.type === 'approve' ? 'success' : 'danger'}
              onClick={confirmStudentAction}
            >
              {studentActionModal?.type === 'approve' ? 'Confirm Approve' : 'Confirm Reject'}
            </Button>
            <Button variant="outline" onClick={() => setStudentActionModal(null)}>Cancel</Button>
          </div>
        </div>
      </Modal>

      {/* Center App Approve Modal */}
      <Modal isOpen={!!caApproveModal} onClose={() => setCAApproveModal(null)} title="Approve Center Application">
        <div className="space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <p className="font-semibold text-gray-900">{caApproveModal?.organization_name}</p>
            <p className="text-xs text-gray-500 mt-1">{caApproveModal?.full_name} · {caApproveModal?.email}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400">Amount Paid</p>
              <p className="font-bold text-gray-900">₹{Number(caApproveModal?.amount_paid || 0).toLocaleString()}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400">Fee Split</p>
              <p className="font-bold text-emerald-700">Univ: ₹{caApproveModal?.university_fee} · SC: ₹{caApproveModal?.super_center_fee}</p>
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
            Approving will: <strong>create center account</strong> → generate <strong>{caApproveModal?.university_fee} coupons</strong> for new center + <strong>{caApproveModal?.super_center_fee} coupons</strong> for super center.
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">Account Dept. Remarks</label>
            <textarea className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-[#933d18] resize-none"
              rows={2} placeholder="Optional remarks..."
              value={caAccRemarks} onChange={e => setCAAccRemarks(e.target.value)} />
          </div>
          <div className="flex gap-3">
            <Button variant="success" onClick={handleCAApprove} disabled={caSaving}>{caSaving ? 'Processing...' : 'Approve & Generate Credentials'}</Button>
            <Button variant="outline" onClick={() => setCAApproveModal(null)}>Cancel</Button>
          </div>
        </div>
      </Modal>

      {/* Center App Success Modal */}
      <Modal isOpen={!!caSuccess} onClose={() => setCASuccess(null)} title="Center Created Successfully!">
        {caSuccess && (
          <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2">
              <div className="flex justify-between"><span className="text-sm text-gray-500">Center Name</span><span className="font-bold text-gray-900">{caSuccess.center?.center_name}</span></div>
              <div className="flex justify-between"><span className="text-sm text-gray-500">Center Code</span><span className="font-mono font-black text-[#933d18] text-lg">{caSuccess.center?.center_code}</span></div>
              <div className="flex justify-between"><span className="text-sm text-gray-500">Login Email</span><span className="font-mono text-gray-800">{caSuccess.center?.email}</span></div>
              <div className="flex justify-between"><span className="text-sm text-gray-500">Password</span><span className="font-mono font-bold text-gray-800">{caSuccess.password}</span></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
                <p className="text-2xl font-black text-blue-700">{caSuccess.univCoupons}</p>
                <p className="text-xs text-blue-500 font-semibold mt-0.5">Coupons → New Center</p>
              </div>
              <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 text-center">
                <p className="text-2xl font-black text-purple-700">{caSuccess.scCoupons}</p>
                <p className="text-xs text-purple-500 font-semibold mt-0.5">Coupons → Super Center</p>
              </div>
            </div>
            <p className="text-xs text-gray-400 bg-gray-50 rounded-xl p-3">Share these credentials with the center. They can login at <span className="font-bold text-[#933d18]">/login</span></p>
            <Button onClick={() => setCASuccess(null)} className="w-full justify-center">Done</Button>
          </div>
        )}
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
