import { useEffect, useState } from 'react'
import { supabase, supabaseAdmin } from '../../lib/supabase'
import PageHeader from '../../components/ui/PageHeader'
import { Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui/Table'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import VerifyRow from '../../components/ui/VerifyRow'
import { CheckCircle, XCircle, ToggleLeft, ToggleRight, Eye, EyeOff, Pencil, Save, FileText, Download, PauseCircle, ExternalLink, ChevronDown, ChevronRight, Hash, Copy } from 'lucide-react'
import { generateStudentPDF } from '../../utils/generateStudentPDF'
import { resolveStudentDocUrls } from '../../utils/resolveStudentDocs'
import { formatDate, formatDateTime } from '../../utils/formatDate'

const TABS = [
  { key: 'students', label: 'Student Applications' },
  { key: 'approvals', label: 'Center Applications' },
  { key: 'super_approvals', label: 'Super Center Applications' },
  { key: 'recharges', label: 'Recharge Requests' },
]

export default function AccountDepartment() {
  const [tab, setTab] = useState('students')
  const [appStatusFilter, setAppStatusFilter] = useState('pending')
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
  // Account Dept payment verification (Pending Approvals)
  const [accVerifyModal, setAccVerifyModal] = useState(null)
  const [accChecks, setAccChecks] = useState({})
  const [accRemarks, setAccRemarks] = useState('')
  const [couponRate, setCouponRate] = useState('')
  const [openLockedSecs, setOpenLockedSecs] = useState({})
  const [accSaving, setAccSaving] = useState(false)
  const [accHoldModal, setAccHoldModal] = useState(null)
  const [accHoldRemarks, setAccHoldRemarks] = useState('')
  const [payLinkLoading, setPayLinkLoading] = useState(false)
  const [payLinkError, setPayLinkError] = useState(null)
  const [payRefreshing, setPayRefreshing] = useState(false)
  // Payment method flow: '' (not chosen) | 'manual' (offline/UTR) | 'link' (Razorpay)
  const [receiptVerified, setReceiptVerified] = useState(false)
  const [manualUtr, setManualUtr] = useState('')
  const [refNoSaving, setRefNoSaving] = useState(false)

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

    const centerCode = await generateNextCode('SIU') // sub-center created from application
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
    // Pending Approvals: centers forwarded by doc dept ('doc_verified') OR held by THIS dept ('account_hold').
    // 'account_hold' is distinct from doc dept's 'hold' so held centers stay inside Account Dept, not Doc Dept.
    const [docVerified, rech, ctr, holdStu] = await Promise.all([
      supabase.from('centers').select('*, super_center:super_center_id(center_name, center_code), states:state_id(state_name)').in('approval_status', ['doc_verified', 'account_hold']).order('created_at', { ascending: false }),
      supabase.from('recharge_requests').select('*').order('created_at', { ascending: false }),
      supabase.from('centers').select('*, super_center:super_center_id(center_name, center_code), states:state_id(state_name)').not('approval_status', 'in', '(pending,doc_verified,hold,account_hold)').order('created_at', { ascending: false }),
      supabase.from('students').select('id, student_name, mobile_no, gender, status, remarks, admission_number, enrollment_no, doc_verified_at, created_at, programme_id, session_id, programs(program_name, enrollment_code), academic_sessions(session_name), centers(center_name, center_code)').eq('status', 'Hold').not('doc_verified_at', 'is', null).order('created_at', { ascending: false }),
    ])
    setApprovals(docVerified.data || [])
    setRecharges(rech.data || [])
    setCenters(ctr.data || [])
    setHoldStudents(holdStu.data || [])
    setLoading(false)
  }

  async function savePassword(centerId) {
    const newPass = editingPassword[centerId]?.trim()
    if (!newPass) return
    const center = centers.find(c => c.id === centerId)
    if (!center?.email) { alert('This center has no email address.'); return }

    const role = center.center_type === 'super_center' ? 'super_center' : 'center'

    // Save password to DB for display
    await supabase.from('centers').update({ generated_password: newPass }).eq('id', centerId)

    // Preferred path — service-role admin API can change an EXISTING user's password
    // (signUp cannot; it only creates new users).
    if (supabaseAdmin) {
      let userId = null
      try {
        const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
        userId = list?.users?.find(u => u.email?.toLowerCase() === center.email.toLowerCase())?.id || null
      } catch (_) { /* fall through to create */ }

      if (userId) {
        const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          password: newPass,
          user_metadata: { role },
        })
        if (updErr) { alert('Password update failed: ' + updErr.message); return }
        await supabase.from('profiles').upsert({ id: userId, role })
        alert(`✓ Password updated! ${center.email} can now log in with the new password.`)
      } else {
        const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
          email: center.email,
          password: newPass,
          email_confirm: true,
          user_metadata: { role },
        })
        if (cErr) { alert('User create failed: ' + cErr.message); return }
        if (created?.user) await supabase.from('profiles').upsert({ id: created.user.id, role })
        alert(`✓ Account created! ${center.email} can now log in with the password.`)
      }
      setEditingPassword(prev => { const n = { ...prev }; delete n[centerId]; return n })
      fetchAll()
      return
    }

    // Fallback (no service key) — signUp can only create NEW users, not change existing passwords.
    const { data: { session: adminSession } } = await supabase.auth.getSession()
    const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
      email: center.email,
      password: newPass,
      options: { data: { role } }
    })
    if (!signUpErr && signUpData?.user) {
      await supabase.from('profiles').upsert({ id: signUpData.user.id, role })
    }
    if (adminSession?.access_token) {
      await supabase.auth.setSession({
        access_token: adminSession.access_token,
        refresh_token: adminSession.refresh_token,
      })
    }

    if (signUpErr && signUpErr.message.toLowerCase().includes('already registered')) {
      alert(`The password was NOT actually changed — this email is already registered, and an existing user's password can only be changed using the service key.\n\nFor now: Supabase Dashboard → Authentication → Users → "${center.email}" → Reset/Update password.\n\nPermanent fix: add the real VITE_SUPABASE_SERVICE_KEY to your .env file.`)
    } else if (signUpErr) {
      alert('Error: ' + signUpErr.message)
    } else {
      alert(`✓ Password set! ${center.email} can now log in with the password.`)
    }

    setEditingPassword(prev => { const n = { ...prev }; delete n[centerId]; return n })
    fetchAll()
  }

  // Code structure: Super Center => CTR001, CTR002...  Center => SIU001, SIU002...
  async function generateNextCode(prefix) {
    const { data } = await supabase.from('centers').select('center_code').not('center_code', 'is', null)
    const re = new RegExp(`^${prefix}(\\d+)$`)
    const nums = (data || [])
      .map(c => c.center_code?.match(re)?.[1])
      .filter(Boolean)
      .map(Number)
    const next = nums.length > 0 ? Math.max(...nums) + 1 : 1
    return `${prefix}${String(next).padStart(3, '0')}`
  }

  async function handleApprove(center, notes, walletAmount) {
    setAccSaving(true)
    const prefix = center.center_type === 'super_center' ? 'CTR' : 'SIU'
    const centerCode = center.center_code || await generateNextCode(prefix)

    // Deposit the paid amount into the center's coupon wallet. Minting the actual
    // coupons (amount ÷ per-coupon rate) happens later in Coupon Management.
    // The deposit can never exceed what the center actually paid.
    const paidCap = Math.round(Number(center.amount_paid || center.payment_amount || 0))
    const depositNum = Math.min(paidCap, Math.round(Number(walletAmount) || 0))
    const newBalance = Math.round(Number(center.coupon_wallet_balance || 0)) + depositNum

    const { error: approveErr } = await supabase.from('centers').update({
      approval_status: 'approved',
      status: 'Active',
      center_code: centerCode,
      coupon_wallet_balance: newBalance,
      ...(notes && notes.trim() ? { approval_notes: notes.trim() } : {}),
    }).eq('id', center.id)

    if (approveErr) {
      setAccSaving(false)
      alert(
        'Approval failed: ' + approveErr.message +
        (/coupon_wallet_balance/.test(approveErr.message)
          ? '\n\nIt looks like the `coupon_wallet_balance` column does not exist in the DB. Run add_coupon_wallet_balance.sql in the Supabase SQL Editor.'
          : '')
      )
      return
    }

    setAccSaving(false)
    setAccVerifyModal(null)
    setAccChecks({})
    setCouponRate('')
    setApprovedModal({ ...center, center_code: centerCode, walletDeposit: depositNum, couponWalletBalance: newBalance })
    fetchAll()
  }

  // The application number is generated when the center submits the application.
  // For older applications created before that column existed, this builds one
  // on demand so the link/lookup flow keeps working.
  function makeApplicationNo() {
    return `APP-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
  }

  // Generate a payment link for the center's letter-type fee. We first try the
  // create-payment-link edge function (real Razorpay link). If that isn't
  // deployed/reachable, we fall back to a locally-generated link that is
  // persisted to the DB, so the flow keeps working and the application can be
  // looked up later by email + application number.
  async function generatePayLink(center) {
    setPayLinkError(null)
    setPayLinkLoading(true)
    const amount = Number(center.payment_amount || center.base_fee || 0)
    const appNo = center.application_no || makeApplicationNo()
    try {
      const { data, error } = await supabase.functions.invoke('create-payment-link', {
        body: { center_id: center.id },
      })
      if (error) throw new Error(error.message || 'Failed to create payment link')
      if (data?.error) throw new Error(data.error)
      const patch = {
        payment_status: 'link_sent',
        payment_method: 'link',
        payment_link_url: data.short_url || data.payment_link_url,
        payment_link_id: data.payment_link_id,
        payment_amount: data.amount ?? center.payment_amount,
        application_no: appNo,
      }
      // Persist so the public site can resolve the application + link.
      await supabase.from('centers').update({ payment_link_url: patch.payment_link_url, payment_link_id: patch.payment_link_id, payment_status: 'link_sent', payment_method: 'link', application_no: appNo }).eq('id', center.id)
      setAccVerifyModal({ ...center, ...patch })
      fetchAll()
    } catch (err) {
      // Edge function not available — generate a dummy link locally and save it
      // (with the application number) so the rest of the flow / lookup works.
      const dummyLink = `https://sengoleit.in/pay?app=${appNo}`
      const patch = {
        payment_status: 'link_sent',
        payment_method: 'link',
        payment_link_url: dummyLink,
        payment_amount: amount,
        application_no: appNo,
      }
      const { error: saveErr } = await supabase.from('centers').update(patch).eq('id', center.id)
      if (saveErr) {
        setPayLinkError('Could not save payment link: ' + saveErr.message +
          (/application_no|payment_link_url|payment_method/.test(saveErr.message)
            ? '\n\nIt looks like the payment columns are missing. Run add_payment_method_fields.sql in the Supabase SQL Editor.'
            : ''))
        setPayLinkLoading(false)
        return
      }
      setPayLinkError('Razorpay edge function unavailable — generated a test link instead. Deploy create-payment-link for real links.')
      setAccVerifyModal({ ...center, ...patch })
      fetchAll()
    }
    setPayLinkLoading(false)
  }

  // Method 1 — Manual payment. Money was collected offline (UTR / super center
  // wallet); the admin records the UTR, verifies the receipt, and marks it paid.
  // The caller must already have receiptVerified === true (the button is gated).
  async function markPaidManually(center, utr) {
    const amount = Number(center.payment_amount || center.base_fee || 0)
    if (!confirm(`Mark the ₹${amount.toLocaleString('en-IN')} payment as manually received? (offline / UTR)`)) return
    setPayLinkError(null)
    setPayLinkLoading(true)
    const paidAt = new Date().toISOString()
    const patch = {
      payment_status: 'paid',
      payment_amount: amount,
      payment_paid_at: paidAt,
      payment_method: 'manual',
      ...(utr && utr.trim() ? { utr_number: utr.trim() } : {}),
    }
    const { error } = await supabase.from('centers').update(patch).eq('id', center.id)
    setPayLinkLoading(false)
    if (error) { setPayLinkError('Manual mark-paid failed: ' + error.message); return }
    setAccVerifyModal({ ...center, ...patch })
    fetchAll()
  }

  // Fallback — assign an application number to an older application that doesn't
  // have one yet (new applications get it at submit time). The center enters
  // their email + this number on the university website to track their
  // application and pay via the stored link.
  async function generateRefNo(center) {
    setRefNoSaving(true)
    setPayLinkError(null)
    const appNo = center.application_no || makeApplicationNo()
    const patch = { application_no: appNo, payment_method: 'link' }
    const { error } = await supabase.from('centers').update(patch).eq('id', center.id)
    setRefNoSaving(false)
    if (error) { setPayLinkError('Application number save failed: ' + error.message); return }
    setAccVerifyModal({ ...center, ...patch })
    fetchAll()
  }

  // Re-fetch this center's payment fields (webhook updates them asynchronously after paying).
  async function refreshPayStatus(center) {
    setPayRefreshing(true)
    const { data } = await supabase.from('centers')
      .select('payment_status, payment_amount, payment_link_url, payment_link_id, payment_id, payment_paid_at')
      .eq('id', center.id).single()
    if (data) setAccVerifyModal({ ...center, ...data })
    setPayRefreshing(false)
  }

  async function confirmAccHold() {
    if (!accHoldRemarks.trim()) { alert('A remark is required to put this on hold'); return }
    setAccSaving(true)
    const { error } = await supabase.from('centers')
      .update({ approval_status: 'account_hold', status: 'Pending', approval_notes: accHoldRemarks.trim() })
      .eq('id', accHoldModal.id)
    setAccSaving(false)
    if (error) { alert('Hold failed: ' + error.message); return }
    setAccHoldModal(null); setAccHoldRemarks(''); setAccVerifyModal(null); setAccChecks({})
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
      alert('A reason for rejection is required')
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
    if (!confirm(`Are you sure you want to permanently delete "${name}"?`)) return
    const { error } = await supabase.from('centers').delete().eq('id', id)
    if (error) { alert('Delete failed: ' + error.message); return }
    fetchAll()
  }

  // Every center-type application the Account Dept handles, across all statuses:
  // approvals = doc_verified (to verify) + account_hold (held); centers = approved + rejected.
  const allCenterApps = [...approvals, ...centers]
  const APP_STATUS_MATCH = {
    pending:  c => c.approval_status === 'doc_verified',
    hold:     c => c.approval_status === 'account_hold',
    approved: c => c.approval_status === 'approved',
    rejected: c => c.approval_status === 'rejected',
  }
  const typeFiltered = allCenterApps.filter(c =>
    tab === 'super_approvals' ? c.center_type === 'super_center' : c.center_type !== 'super_center'
  )
  const appStatusCounts = {
    pending:  typeFiltered.filter(APP_STATUS_MATCH.pending).length,
    hold:     typeFiltered.filter(APP_STATUS_MATCH.hold).length,
    approved: typeFiltered.filter(APP_STATUS_MATCH.approved).length,
    rejected: typeFiltered.filter(APP_STATUS_MATCH.rejected).length,
  }
  const approvalsList = typeFiltered.filter(APP_STATUS_MATCH[appStatusFilter] || (() => true))
  const pendingCount = approvals.filter(c => c.center_type !== 'super_center' && c.approval_status === 'doc_verified').length
  const pendingSuperApprovals = approvals.filter(c => c.center_type === 'super_center' && c.approval_status === 'doc_verified').length
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
            {t.key === 'super_approvals' && pendingSuperApprovals > 0 && (
              <span className="ml-2 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{pendingSuperApprovals}</span>
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
                    <Td className="text-gray-400 text-xs">{formatDate(s.doc_verified_at)}</Td>
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

          {/* APPROVALS TAB (Center + Super Center) */}
          {(tab === 'approvals' || tab === 'super_approvals') && (
            <>
            <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-xl w-fit">
              {[
                { key: 'pending',  label: 'To Verify', color: 'bg-amber-500' },
                { key: 'hold',     label: 'Hold',      color: 'bg-orange-500' },
                { key: 'approved', label: 'Approved',  color: 'bg-emerald-500' },
                { key: 'rejected', label: 'Rejected',  color: 'bg-red-500' },
              ].map(s => (
                <button
                  key={s.key}
                  onClick={() => setAppStatusFilter(s.key)}
                  className={`relative px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    appStatusFilter === s.key ? 'bg-white text-[#933d18] shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {s.label}
                  {appStatusCounts[s.key] > 0 && (
                    <span className={`ml-2 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ${s.color}`}>{appStatusCounts[s.key]}</span>
                  )}
                </button>
              ))}
            </div>
            <Table>
              <Thead>
                <tr>
                  <Th>#</Th>
                  <Th>{tab === 'super_approvals' ? 'Super Center' : 'Center'}</Th>
                  <Th>Type</Th>
                  <Th>Super Center Name</Th>
                  <Th>Contact Person</Th>
                  <Th>Phone</Th>
                  <Th>Email</Th>
                  <Th>Bank Account</Th>
                  <Th>Payment</Th>
                  <Th>Doc Remarks</Th>
                  <Th>Submitted</Th>
                  <Th>Actions</Th>
                </tr>
              </Thead>
              <Tbody>
                {approvalsList.length === 0 ? (
                  <Tr><Td colSpan={12} className="text-center text-gray-400 py-12">No {appStatusFilter} {tab === 'super_approvals' ? 'super center' : 'center'} applications</Td></Tr>
                ) : approvalsList.map((c, i) => (
                  <Tr key={c.id}>
                    <Td className="text-gray-400 text-xs w-10">{i + 1}</Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900">{c.center_name}</p>
                        {c.approval_status === 'account_hold' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                            <PauseCircle size={10} /> On Hold
                          </span>
                        )}
                      </div>
                      {c.organization_name && <p className="text-xs text-gray-400 mt-0.5">{c.organization_name}</p>}
                    </Td>
                    <Td>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${c.center_type === 'super_center' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>
                        {c.center_type === 'super_center' ? 'Super Center' : 'Center'}
                      </span>
                    </Td>
                    <Td className="text-xs">
                      {c.super_center ? (
                        <>
                          <p className="font-semibold text-purple-700">{c.super_center.center_name}</p>
                          {c.super_center.center_code && <p className="text-gray-400 font-mono">{c.super_center.center_code}</p>}
                        </>
                      ) : (
                        <span className="text-gray-400">Direct (Admin)</span>
                      )}
                    </Td>
                    <Td className="text-gray-500">{c.contact_person || '—'}</Td>
                    <Td className="text-gray-500">{c.phone || '—'}</Td>
                    <Td className="text-gray-500 text-xs">{c.email || '—'}</Td>
                    <Td className="text-gray-500 text-xs">
                      {c.bank_account_number ? `****${c.bank_account_number.slice(-4)}` : '—'}
                      {c.ifsc_code && <p className="text-gray-400">{c.ifsc_code}</p>}
                    </Td>
                    <Td className="text-xs">
                      <p className="font-bold text-gray-900">{c.amount_paid ? `₹${Number(c.amount_paid).toLocaleString()}` : '—'}</p>
                      {c.utr_number && <p className="text-gray-400 font-mono">UTR: {c.utr_number}</p>}
                      {c.payment_date && <p className="text-gray-400">{formatDate(c.payment_date)}</p>}
                      {c.payment_screenshot_url ? (
                        <a href={c.payment_screenshot_url} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 mt-1 text-[11px] font-bold text-[#933d18] bg-[#933d18]/8 border border-[#933d18]/20 px-2 py-0.5 rounded-lg hover:bg-[#933d18]/15 transition-colors">
                          <Eye size={11} /> View Receipt
                        </a>
                      ) : (
                        <span className="inline-block mt-1 text-[11px] font-semibold text-amber-600">No receipt uploaded</span>
                      )}
                    </Td>
                    <Td className="text-gray-500 text-xs max-w-[120px] truncate" title={c.approval_notes}>{c.approval_notes || '—'}</Td>
                    <Td className="text-gray-400 text-xs">{formatDate(c.created_at)}</Td>
                    <Td>
                      {c.approval_status === 'approved' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle size={12} /> Approved
                        </span>
                      ) : c.approval_status === 'rejected' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-red-50 text-red-700 border border-red-200">
                          <XCircle size={12} /> Rejected
                        </span>
                      ) : (
                        <div className="flex gap-1">
                          <Button size="sm" onClick={() => { setAccVerifyModal(c); setAccChecks({}); setAccRemarks(''); setCouponRate(''); setOpenLockedSecs({}); setReceiptVerified(false); setManualUtr(c.utr_number || ''); setPayLinkError(null) }}>
                            <CheckCircle size={13} /> {c.approval_status === 'account_hold' ? 'Re-Verify' : 'Verify'}
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => handleReject(c)}>
                            <XCircle size={13} /> Reject
                          </Button>
                        </div>
                      )}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
            </>
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
                    <Td className="text-gray-400 text-xs">{formatDate(r.created_at)}</Td>
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
                    <Td className="text-gray-400 text-xs">{formatDate(a.created_at)}</Td>
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

          {approvedModal?.walletDeposit > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Coupon Wallet</p>
                <p className="text-xs text-emerald-600/80 mt-0.5">Balance: ₹{Number(approvedModal.couponWalletBalance || 0).toLocaleString('en-IN')} · mint coupons in Coupon Management</p>
              </div>
              <span className="text-2xl font-black text-emerald-700">+₹{Number(approvedModal.walletDeposit).toLocaleString('en-IN')}</span>
            </div>
          )}

          <p className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3">
            Share these credentials with the center. They can log in to the portal and access their dashboard.
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
              On approval, the student's <strong>Enrollment Number</strong> and <strong>Admission Number</strong> will become visible to the center / super center.
            </div>
          )}
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">
              Remarks {studentActionModal?.type === 'reject' && <span className="text-red-500">*</span>}
            </label>
            <textarea
              className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-[#933d18] resize-none"
              rows={3}
              placeholder={studentActionModal?.type === 'reject' ? 'Enter the reason for rejection (required)...' : 'Any additional notes (optional)...'}
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

      {/* Verify Payment Modal (Account Dept) — Full Screen */}
      <Modal isOpen={!!accVerifyModal} onClose={() => { setAccVerifyModal(null); setAccChecks({}); setCouponRate('') }} title="Verify Payment & Approve Center" size="fullscreen">
        {accVerifyModal && (() => {
          const c = accVerifyModal
          // Account Dept only verifies PAYMENT. Center & Bank details are already
          // verified by the Document Dept, so they stay locked (read-only) here.
          const sections = [
            // Only verifiable section for the Account Dept.
            { title: 'Payment Details', icon: '💳', verify: true, fields: [
              { key: 'f_amount',     label: 'Amount Paid',     val: c.amount_paid ? `₹${Number(c.amount_paid).toLocaleString()}` : null },
              { key: 'f_utr',        label: 'UTR / Ref Number', val: c.utr_number },
              { key: 'f_pay_date',   label: 'Payment Date',    val: c.payment_date ? formatDate(c.payment_date) : null },
              { key: 'f_pay_remark', label: 'Payment Remark',  val: c.payment_remark },
            ]},
            // Everything below is the FULL detail already verified by the Document
            // Dept — shown locked/read-only so the Account Dept has full context.
            { title: 'Basic Information', icon: '🏢', verify: false, fields: [
              { key: 'f_center_name',    label: 'Center Name',    val: c.center_name },
              { key: 'f_center_code',    label: 'Center Code',    val: c.center_code },
              { key: 'f_email',          label: 'Email Address',  val: c.email },
              { key: 'f_phone',          label: 'Phone Number',   val: c.phone },
              { key: 'f_contact_person', label: 'Contact Person', val: c.contact_person },
            ]},
            { title: 'Contact Person Details', icon: '👤', verify: false, fields: [
              { key: 'f_father_mother',  label: 'Father / Mother Name',          val: c.father_mother_name },
              { key: 'f_dob',            label: 'Date of Birth',                 val: c.date_of_birth ? formatDate(c.date_of_birth) : null },
              { key: 'f_gender',         label: 'Gender',                        val: c.gender },
              { key: 'f_nationality',    label: 'Nationality',                   val: c.nationality },
              { key: 'f_contact_mobile', label: 'Contact Mobile',                val: c.contact_mobile },
              { key: 'f_contact_email',  label: 'Contact Email',                 val: c.contact_email },
              { key: 'f_occupation',     label: 'Current Occupation',            val: c.current_occupation },
              { key: 'f_experience',     label: 'Prev. Experience (Admissions)', val: c.previous_experience_admissions },
              { key: 'f_perm_address',   label: 'Permanent Address',             val: c.permanent_address },
              { key: 'f_curr_address',   label: 'Current Address',               val: c.current_address },
            ]},
            { title: 'Center Address', icon: '📍', verify: false, fields: [
              { key: 'f_addr1',    label: 'Address Line 1', val: c.address_line1 },
              { key: 'f_landmark', label: 'Landmark',       val: c.landmark },
              { key: 'f_po',       label: 'Post Office',    val: c.post_office },
              { key: 'f_city',     label: 'City',           val: c.city },
              { key: 'f_state',    label: 'State',          val: c.states?.state_name },
              { key: 'f_pincode',  label: 'Pincode',        val: c.pincode },
            ]},
            { title: 'KYC Details', icon: '🪪', verify: false, fields: [
              { key: 'f_aadhar', label: 'Aadhar Number', val: c.aadhar_no },
              { key: 'f_pan',    label: 'PAN Number',    val: c.pan_no },
            ]},
            { title: 'Organization', icon: '🏛️', verify: false, fields: [
              { key: 'f_org_name',      label: 'Organization Name',   val: c.organization_name },
              { key: 'f_org_type',      label: 'Org Type',            val: c.org_type },
              { key: 'f_reg_number',    label: 'Registration Number', val: c.registration_number },
              { key: 'f_gst_pan',       label: 'GST / PAN',           val: c.gst_pan },
              { key: 'f_premises_type', label: 'Premises Type',       val: c.premises_type },
              { key: 'f_org_address',   label: 'Org Address',         val: c.org_address },
              { key: 'f_org_po',        label: 'Org Post Office',      val: c.org_post_office },
              { key: 'f_org_city',      label: 'Org City',            val: c.org_city },
              { key: 'f_org_pincode',   label: 'Org Pincode',         val: c.org_pincode },
            ]},
            { title: 'Facilities', icon: '🏗️', verify: false, fields: [
              { key: 'f_reception',      label: 'Reception Desk',  val: c.facility_reception_desk },
              { key: 'f_waiting',        label: 'Waiting Area',    val: c.facility_waiting_area },
              { key: 'f_meeting',        label: 'Meeting Room',    val: c.facility_meeting_room },
              { key: 'f_rent_agreement', label: 'Rent Agreement',  val: c.rent_agreement_attached },
              { key: 'f_photos',         label: 'Photos Attached', val: c.photos_attached },
            ]},
            ...[
              ['10th', c.edu_10th_institute, c.edu_10th_board, c.edu_10th_year],
              ['12th', c.edu_12th_institute, c.edu_12th_board, c.edu_12th_year],
              ['UG',   c.edu_ug_institute,   c.edu_ug_board,   c.edu_ug_year],
              ['PG',   c.edu_pg_institute,   c.edu_pg_board,   c.edu_pg_year],
              ['Diploma', c.edu_diploma_institute, c.edu_diploma_board, c.edu_diploma_year],
            ].filter(([, inst]) => inst).length > 0 ? [{
              title: 'Education', icon: '🎓', verify: false,
              fields: [
                ['10th', c.edu_10th_institute, c.edu_10th_board, c.edu_10th_year],
                ['12th', c.edu_12th_institute, c.edu_12th_board, c.edu_12th_year],
                ['UG',   c.edu_ug_institute,   c.edu_ug_board,   c.edu_ug_year],
                ['PG',   c.edu_pg_institute,   c.edu_pg_board,   c.edu_pg_year],
                ['Diploma', c.edu_diploma_institute, c.edu_diploma_board, c.edu_diploma_year],
              ].filter(([, inst]) => inst).map(([level, inst, board, year]) => ({
                key: `f_edu_${level.toLowerCase()}`,
                label: `${level} — ${inst}`,
                val: [board, year].filter(Boolean).join(' · ') || inst,
              })),
            }] : [],
            { title: 'Banking Details', icon: '🏦', verify: false, fields: [
              { key: 'f_acct_holder', label: 'Account Holder', val: c.bank_account_holder },
              { key: 'f_acct_no',     label: 'Account Number', val: c.bank_account_number },
              { key: 'f_ifsc',        label: 'IFSC Code',      val: c.ifsc_code },
              { key: 'f_branch',      label: 'Bank Branch',    val: c.bank_branch },
            ]},
            { title: 'Documents', icon: '📎', verify: false, fields: [
              { key: 'doc_owner_photo', label: 'Owner Photo',        val: c.owner_photo_url,   isDoc: true },
              { key: 'doc_signature',   label: 'Owner Signature',    val: c.owner_signature_url, isDoc: true },
              { key: 'doc_aadhar',      label: 'Aadhar Card',        val: c.owner_aadhar_url,  isDoc: true },
              { key: 'doc_pan',         label: 'PAN Card',           val: c.owner_pan_url,     isDoc: true },
              { key: 'doc_reg',         label: 'Registration Cert.', val: c.center_reg_url,    isDoc: true },
              { key: 'doc_premises',    label: 'Premises Photo',     val: c.premises_photo_url, isDoc: true },
              { key: 'doc_gst',         label: 'GST Certificate',    val: c.gst_url,           isDoc: true },
              { key: 'doc_agreement',   label: 'Agreement',          val: c.agreement_url,     isDoc: true },
              { key: 'doc_cheque',      label: 'Cancel Cheque',      val: c.cancel_cheque_url, isDoc: true },
              { key: 'doc_passbook',    label: 'Bank Passbook',      val: c.bank_passbook_url, isDoc: true },
            ]},
          ]
          // Only the payment section counts toward verification progress.
          const allKeys = sections.filter(s => s.verify).flatMap(s => s.fields.filter(f => f.val).map(f => f.key))
          const totalItems = allKeys.length
          const verifiedCount = allKeys.filter(k => accChecks[k]?.ok).length
          const pct = totalItems ? Math.round((verifiedCount / totalItems) * 100) : 0

          // Coupon wallet: on approval the paid amount is DEPOSITED into the
          // center's coupon wallet. The admin decides how many coupons to mint
          // later, in Coupon Management. `couponRate` here just holds an optional
          // override of the deposit amount (defaults to the paid amount).
          // The deposit can never EXCEED the paid amount — you cannot put more
          // money into the wallet than the center actually paid.
          const couponBase = Math.round(Number(c.amount_paid || c.payment_amount || 0))
          const walletDeposit = Math.min(
            couponBase,
            couponRate === '' ? couponBase : Math.round(Number(couponRate) || 0)
          )
          const couponOverCap = couponRate !== '' && Math.round(Number(couponRate) || 0) > couponBase

          // Payment route is decided by what the super center did at application time:
          //  - "pay now" → payment_status 'offline_review' with amount/UTR/receipt → Account
          //    Dept just VERIFIES the receipt (manual). No pay link.
          //  - "pay later" → no receipt/UTR → Account Dept generates a pay link + reference
          //    number. No receipt/verify UI.
          const payStatus = c.payment_status || 'unpaid'
          const isPaidNow = payStatus === 'paid'
          const paidOffline = !isPaidNow && (payStatus === 'offline_review' || !!(c.payment_screenshot_url || c.utr_number || Number(c.amount_paid) > 0))
          const noPayment = !isPaidNow && !paidOffline

          const labelMap = {}
          sections.forEach(s => s.fields.forEach(f => { labelMap[f.key] = f.label }))
          const issueLines = Object.entries(accChecks)
            .filter(([, v]) => !v.ok && v.remark && v.remark.trim())
            .map(([k, v]) => `${labelMap[k] || k}: ${v.remark.trim()}`)
          const composedHoldNote = [accRemarks.trim(), ...issueLines].filter(Boolean).join('\n')

          function verifyAll() {
            const next = {}
            allKeys.forEach(k => { next[k] = { ok: true, remark: accChecks[k]?.remark || '' } })
            setAccChecks(next)
          }

          return (
            <div className="flex flex-col h-full bg-gray-50">
              {/* Header */}
              <div className="shrink-0 bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-[#933d18]/10 flex items-center justify-center shrink-0 border border-[#933d18]/20">
                    <span className="text-lg font-black text-[#933d18]">{c.center_name?.[0]?.toUpperCase() || 'C'}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-base font-black text-gray-900 truncate">{c.center_name}</h2>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{[c.contact_person, c.email, c.phone].filter(Boolean).join(' · ')}</p>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <div className="flex items-baseline gap-1 justify-end">
                        <span className="text-xl font-black text-gray-900">{verifiedCount}</span>
                        <span className="text-sm text-gray-400 font-semibold">/ {totalItems}</span>
                        <span className={`ml-1 text-xs font-bold ${pct === 100 ? 'text-emerald-600' : 'text-gray-400'}`}>{pct === 100 ? '✓ Complete' : `${pct}%`}</span>
                      </div>
                      <div className="w-40 h-1.5 bg-gray-100 rounded-full mt-1.5">
                        <div className={`h-1.5 rounded-full transition-all duration-300 ${pct === 100 ? 'bg-emerald-500' : 'bg-[#933d18]'}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <button onClick={verifyAll}
                      className="flex items-center gap-2 bg-[#933d18] hover:bg-[#7a3215] text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-colors shadow-sm">
                      <CheckCircle size={15} /> Verify All
                    </button>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-hidden flex">
                {/* Left — Field sections */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {sections.map(sec => {
                    const visible = sec.fields.filter(f => f.val)
                    if (!visible.length) return null
                    const secVerified = visible.filter(f => accChecks[f.key]?.ok).length
                    const isLocked = !sec.verify
                    const isOpen = sec.verify || !!openLockedSecs[sec.title]
                    return (
                      <div key={sec.title} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                        <button
                          type="button"
                          disabled={!isLocked}
                          onClick={() => isLocked && setOpenLockedSecs(prev => ({ ...prev, [sec.title]: !prev[sec.title] }))}
                          className={`w-full flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-100 text-left ${isLocked ? 'cursor-pointer hover:bg-gray-100 transition-colors' : 'cursor-default'}`}
                        >
                          <div className="flex items-center gap-2">
                            {isLocked && (isOpen
                              ? <ChevronDown size={14} className="text-gray-400" />
                              : <ChevronRight size={14} className="text-gray-400" />)}
                            <span className="text-sm">{sec.icon}</span>
                            <p className="text-xs font-black text-gray-700 uppercase tracking-widest">{sec.title}</p>
                          </div>
                          {sec.verify ? (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${secVerified === visible.length ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                              {secVerified}/{visible.length} verified
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">
                              <EyeOff size={10} /> {isOpen ? 'Locked (Doc Dept verified)' : 'Hidden — tap to view'}
                            </span>
                          )}
                        </button>
                        {isOpen && (
                          <div className="p-4 grid grid-cols-2 gap-3">
                            {sec.verify
                              ? visible.map(f => <VerifyRow key={f.key} fkey={f.key} label={f.label} val={f.val} checks={accChecks} setChecks={setAccChecks} />)
                              : visible.map(f => (
                                  <div key={f.key} className="rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-2">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{f.label}</p>
                                    {f.isDoc ? (
                                      <a href={f.val} target="_blank" rel="noopener noreferrer"
                                        className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-[#933d18] hover:underline">
                                        <ExternalLink size={11} /> View
                                      </a>
                                    ) : (
                                      <p className="text-sm font-semibold text-gray-700 mt-0.5 break-words">{f.val}</p>
                                    )}
                                  </div>
                                ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Right — Letter fee payment + receipt */}
                <div className="w-96 shrink-0 overflow-y-auto border-l border-gray-200 bg-white">
                  {/* Letter fee payment (Razorpay pay link) */}
                  <div className="p-5 border-b border-gray-100">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-sm">💸</span>
                      <p className="text-xs font-black text-gray-700 uppercase tracking-widest">Letter Fee Payment</p>
                    </div>
                    {(() => {
                      const amount = Number(c.payment_amount || c.base_fee || 0)
                      return (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                            <div>
                              <p className="text-[11px] text-gray-400 font-semibold uppercase">Amount</p>
                              <p className="text-lg font-black text-gray-900">₹{amount.toLocaleString()}</p>
                              {c.letter_type && <p className="text-[11px] text-gray-400 capitalize">{c.letter_type} letter</p>}
                            </div>
                            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full capitalize ${
                              isPaidNow ? 'bg-emerald-50 text-emerald-700'
                              : paidOffline ? 'bg-amber-50 text-amber-700'
                              : payStatus === 'link_sent' ? 'bg-blue-50 text-blue-700'
                              : 'bg-gray-100 text-gray-500'
                            }`}>{isPaidNow ? 'Paid' : paidOffline ? 'Receipt review' : payStatus === 'link_sent' ? 'Link Sent' : 'Unpaid'}</span>
                          </div>

                          {payLinkError && <p className="text-xs text-red-600">{payLinkError}</p>}

                          {isPaidNow ? (
                            <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 space-y-1">
                              <p className="text-xs font-bold text-emerald-700 flex items-center gap-1.5"><CheckCircle size={13} /> Payment received & verified</p>
                              {c.payment_method && <p className="text-[11px] text-emerald-700/90 capitalize">Method: {c.payment_method === 'manual' ? 'Manual / UTR' : 'Payment Link'}</p>}
                              {c.utr_number && <p className="text-[11px] text-emerald-600/80 font-mono">UTR: {c.utr_number}</p>}
                              {c.payment_id && <p className="text-[11px] text-emerald-600/80 font-mono">{c.payment_id}</p>}
                              {c.application_no && <p className="text-[11px] text-emerald-600/80 font-mono">Application No: {c.application_no}</p>}
                              {c.payment_paid_at && <p className="text-[11px] text-emerald-600/80">{formatDateTime(c.payment_paid_at)}</p>}
                            </div>
                          ) : amount <= 0 ? (
                            <p className="text-xs text-amber-600">No fee set for this center's letter type. Set pricing in Center Pricing.</p>
                          ) : paidOffline ? (
                            /* The super center already paid (offline) at application time.
                               The Account Dept only VERIFIES the receipt — no pay link. */
                            <div className="space-y-3">
                              <div className="rounded-xl border border-amber-100 bg-amber-50 p-3">
                                <p className="text-[11px] font-bold text-amber-700 uppercase">Offline payment — verify the receipt</p>
                                {Number(c.amount_paid) > 0 && <p className="text-[11px] text-amber-700/90 mt-1">Amount paid: ₹{Number(c.amount_paid).toLocaleString('en-IN')}</p>}
                                {c.payment_date && <p className="text-[11px] text-amber-700/90">Date: {c.payment_date}</p>}
                              </div>
                              <div>
                                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">UTR / Transaction No.</label>
                                <input
                                  type="text"
                                  value={manualUtr}
                                  onChange={e => setManualUtr(e.target.value)}
                                  placeholder="e.g. 4032198765432"
                                  className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#933d18] focus:ring-2 focus:ring-[#933d18]/10 bg-white"
                                />
                              </div>
                              <label className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 cursor-pointer transition-colors ${receiptVerified ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200 bg-gray-50'}`}>
                                <input type="checkbox" checked={receiptVerified} onChange={e => setReceiptVerified(e.target.checked)} className="mt-0.5 accent-emerald-600" />
                                <span className="text-xs text-gray-700">
                                  I have verified the payment receipt{!c.payment_screenshot_url && <span className="text-amber-600"> (note: no receipt has been uploaded)</span>}
                                </span>
                              </label>
                              <button onClick={() => markPaidManually(c, manualUtr)} disabled={payLinkLoading || !receiptVerified}
                                title={!receiptVerified ? 'Verify the receipt first' : undefined}
                                className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-colors">
                                <CheckCircle size={14} /> {payLinkLoading ? 'Saving...' : 'Verify Receipt & Confirm Payment'}
                              </button>
                              {!receiptVerified && <p className="text-[10px] text-gray-400 text-center">Forwarding is blocked until the receipt is verified.</p>}
                            </div>
                          ) : (
                            /* No payment received — only a pay link. The application
                               number (generated at submit) lets the center track it. */
                            <div className="space-y-3">
                              {/* Application number — generated when the center submitted
                                  the application. They enter it + their email on the
                                  university website to track status and pay. */}
                              {c.application_no ? (
                                <div className="rounded-xl border border-[#933d18]/20 bg-[#933d18]/5 p-3">
                                  <p className="text-[11px] font-bold text-[#933d18] uppercase flex items-center gap-1.5"><Hash size={12} /> Application Number</p>
                                  <div className="flex items-center justify-between gap-2 mt-1">
                                    <span className="text-sm font-black font-mono text-gray-900">{c.application_no}</span>
                                    <button onClick={() => navigator.clipboard?.writeText(c.application_no)}
                                      className="text-gray-400 hover:text-[#933d18] transition-colors" title="Copy">
                                      <Copy size={13} />
                                    </button>
                                  </div>
                                  <p className="text-[10px] text-gray-500 mt-1.5">The center can track status and pay by entering this number and their email on the university website.</p>
                                </div>
                              ) : (
                                <button onClick={() => generateRefNo(c)} disabled={refNoSaving}
                                  className="w-full flex items-center justify-center gap-2 border border-[#933d18]/30 bg-[#933d18]/5 hover:bg-[#933d18]/10 disabled:opacity-50 text-[#933d18] px-4 py-2 rounded-xl text-xs font-bold transition-colors">
                                  <Hash size={13} /> {refNoSaving ? 'Generating...' : 'Generate Application Number'}
                                </button>
                              )}

                              <button onClick={() => generatePayLink(c)} disabled={payLinkLoading}
                                className="w-full flex items-center justify-center gap-2 bg-[#933d18] hover:bg-[#7a3215] disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-colors">
                                <ExternalLink size={14} /> {payLinkLoading ? 'Generating...' : c.payment_link_url ? 'Regenerate Pay Link' : 'Generate & Send Pay Link'}
                              </button>
                              {c.payment_link_url && (
                                <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 space-y-1.5">
                                  <p className="text-[11px] font-bold text-blue-700">Payment link (share with super center)</p>
                                  <a href={c.payment_link_url} target="_blank" rel="noreferrer"
                                    className="block text-xs text-blue-700 underline break-all">{c.payment_link_url}</a>
                                </div>
                              )}
                              <button onClick={() => refreshPayStatus(c)} disabled={payRefreshing}
                                className="w-full text-xs font-semibold text-gray-500 hover:text-[#933d18] py-1.5 transition-colors">
                                {payRefreshing ? 'Checking...' : '↻ Refresh payment status'}
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })()}
                  </div>

                  {/* Coupon wallet — deposit the paid amount. How many coupons to
                      mint is decided later in Coupon Management. Only show this once
                      payment has been received (paid online or via offline receipt). */}
                  {!noPayment && (
                  <div className="p-5 border-b border-gray-100">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-sm">🎟️</span>
                      <p className="text-xs font-black text-gray-700 uppercase tracking-widest">Coupon Wallet Deposit</p>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                        <p className="text-[11px] text-gray-400 font-semibold uppercase">Paid Amount</p>
                        <p className="text-lg font-black text-gray-900">₹{couponBase.toLocaleString('en-IN')}</p>
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Amount to Add (₹)</label>
                        <input
                          type="number"
                          min="0"
                          max={couponBase}
                          placeholder={`${couponBase}`}
                          value={couponRate}
                          onChange={e => setCouponRate(e.target.value)}
                          className={`mt-1 w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 bg-white ${couponOverCap ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : 'border-gray-200 focus:border-[#933d18] focus:ring-[#933d18]/10'}`}
                        />
                        {couponOverCap ? (
                          <p className="text-[11px] text-red-600 mt-1 font-semibold">Cannot exceed the paid amount (₹{couponBase.toLocaleString('en-IN')}). It will be capped.</p>
                        ) : (
                          <p className="text-[11px] text-gray-400 mt-1">Leave blank to add the full paid amount (₹{couponBase.toLocaleString('en-IN')}). Cannot be more than this.</p>
                        )}
                      </div>
                      <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                        <p className="text-[11px] font-bold text-emerald-700 uppercase">Will Add to Wallet</p>
                        <p className="text-sm text-emerald-800 mt-0.5">
                          <span className="text-xl font-black">₹{walletDeposit.toLocaleString('en-IN')}</span>
                        </p>
                        <p className="text-[11px] text-emerald-600/80 mt-1">How many coupons to mint is decided in Coupon Management.</p>
                      </div>
                    </div>
                  </div>
                  )}

                  {/* Only show the receipt when an offline payment was received. If
                      no payment was received, the receipt section is not needed. */}
                  {!noPayment && (
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-sm">🧾</span>
                      <p className="text-xs font-black text-gray-700 uppercase tracking-widest">Payment Receipt</p>
                    </div>
                    {c.payment_screenshot_url ? (
                      <div className="space-y-3">
                        <a href={c.payment_screenshot_url} target="_blank" rel="noreferrer"
                          className="block rounded-xl border border-gray-200 overflow-hidden bg-gray-50 hover:border-[#933d18]/40 transition-colors">
                          <img src={c.payment_screenshot_url} alt="Payment receipt"
                            className="w-full max-h-[60vh] object-contain bg-white"
                            onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex' }} />
                          <div style={{ display: 'none' }} className="h-40 items-center justify-center text-xs text-gray-500 flex-col gap-2">
                            <FileText size={22} className="text-[#933d18]/60" />
                            <span>Receipt file (PDF / doc)</span>
                          </div>
                        </a>
                        <a href={c.payment_screenshot_url} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#933d18] hover:underline">
                          <ExternalLink size={12} /> Open full receipt
                        </a>
                      </div>
                    ) : (
                      <div className="rounded-xl border-2 border-dashed border-amber-200 bg-amber-50/60 p-6 text-center">
                        <p className="text-sm font-bold text-amber-700">No receipt uploaded</p>
                        <p className="text-xs text-amber-600/80 mt-1">The center did not attach payment proof. Put it on hold and add a remark.</p>
                      </div>
                    )}
                  </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="shrink-0 bg-white border-t border-gray-200 px-6 py-4 flex items-center gap-3 shadow-sm">
                <input
                  type="text"
                  placeholder="Overall remarks (optional)..."
                  className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#933d18] focus:ring-2 focus:ring-[#933d18]/10 bg-gray-50 transition-all"
                  value={accRemarks}
                  onChange={e => setAccRemarks(e.target.value)}
                />
                {(() => {
                  const feeAmount = Number(c.payment_amount || c.base_fee || 0)
                  const needsPayment = feeAmount > 0 && !isPaidNow
                  const blocked = accSaving || needsPayment
                  const title = !needsPayment ? undefined
                    : paidOffline ? 'Verify the receipt and click "Verify Receipt & Confirm Payment" — forwarding is blocked until then'
                    : 'Generate a pay link and wait for the payment to arrive'
                  return (
                    <button
                      onClick={() => handleApprove(c, accRemarks, walletDeposit)}
                      disabled={blocked}
                      title={title}
                      className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-colors shadow-sm whitespace-nowrap"
                    >
                      <CheckCircle size={15} /> {accSaving ? 'Saving...' : needsPayment ? 'Payment Pending' : `Verify & Approve${walletDeposit > 0 ? ` (+₹${walletDeposit.toLocaleString('en-IN')})` : ''}`}
                    </button>
                  )
                })()}
                <button
                  onClick={() => { setAccHoldModal(c); setAccHoldRemarks(composedHoldNote) }}
                  disabled={accSaving}
                  className="flex items-center gap-2 bg-amber-100 hover:bg-amber-200 disabled:opacity-50 text-amber-700 px-5 py-2.5 rounded-xl text-sm font-bold transition-colors whitespace-nowrap"
                  title="Payment is incorrect — put the center on hold"
                >
                  <PauseCircle size={15} /> Hold
                </button>
                <button
                  onClick={() => { setAccVerifyModal(null); setAccChecks({}); handleReject(c) }}
                  disabled={accSaving}
                  className="flex items-center gap-2 bg-red-50 hover:bg-red-100 disabled:opacity-50 text-red-600 px-5 py-2.5 rounded-xl text-sm font-bold transition-colors whitespace-nowrap"
                >
                  <XCircle size={15} /> Reject
                </button>
                <button
                  onClick={() => { setAccVerifyModal(null); setAccChecks({}) }}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors whitespace-nowrap"
                >
                  Cancel
                </button>
              </div>
            </div>
          )
        })()}
      </Modal>

      {/* Hold Center Modal (Account Dept) — requires remarks */}
      <Modal isOpen={!!accHoldModal} onClose={() => setAccHoldModal(null)} title="Hold Center — Send Back for Correction">
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
            <strong>{accHoldModal?.center_name}</strong> will be put on hold. The Center / Super Center will see this remark so they can correct the payment / details.
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Hold Remark <span className="text-red-500">*</span></label>
            <textarea
              className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-amber-400 resize-none"
              rows={4}
              placeholder="Describe the issue with the payment or which field needs fixing (required)..."
              value={accHoldRemarks}
              onChange={e => setAccHoldRemarks(e.target.value)}
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={confirmAccHold}
              disabled={accSaving}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 transition-colors"
            >
              <PauseCircle size={15} /> {accSaving ? 'Saving...' : 'Confirm Hold'}
            </button>
            <Button variant="outline" onClick={() => setAccHoldModal(null)}>Cancel</Button>
          </div>
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
