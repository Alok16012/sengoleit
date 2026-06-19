import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import PageHeader from '../../components/ui/PageHeader'
import { Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui/Table'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import VerifyRow from '../../components/ui/VerifyRow'
import { CheckCircle, XCircle, Download, Eye, ExternalLink, PauseCircle } from 'lucide-react'

import { generateStudentPDF } from '../../utils/generateStudentPDF'
import { resolveStudentDocUrls } from '../../utils/resolveStudentDocs'
import { formatDate } from '../../utils/formatDate'

const STATUS_FILTERS = ['Pending', 'Hold', 'Approved', 'Rejected']
const CENTER_STATUS_FILTERS = ['Pending', 'Hold', 'Forwarded', 'Approved', 'Rejected']
const MAIN_TABS = [
  { key: 'students', label: 'Student Applications' },
  { key: 'centers', label: 'Center Applications' },
  { key: 'super_centers', label: 'Super Center Applications' },
]

// Map a center's approval_status to one of the CENTER_STATUS_FILTERS buckets.
function centerMatchesFilter(c, filter) {
  const st = c.approval_status
  if (filter === 'Pending') return !st || st === 'pending'
  if (filter === 'Hold') return st === 'hold'
  if (filter === 'Forwarded') return st === 'doc_verified'
  if (filter === 'Approved') return st === 'approved'
  if (filter === 'Rejected') return st === 'rejected'
  return true
}

// Maps a verify-modal check key (f_* / doc_*) to the SubCenterForm field name(s) it
// corresponds to. Used when holding a center: the fields the Doc Dept flagged for
// correction are saved so that — on resubmit — only those fields stay editable.
const CHECK_TO_FORM_FIELDS = {
  f_center_name: ['center_name'],
  f_email: ['email'],
  f_phone: ['phone'],
  f_contact_person: ['contact_person'],
  f_father_mother: ['father_mother_name'],
  f_dob: ['date_of_birth'],
  f_gender: ['gender'],
  f_nationality: ['nationality'],
  f_contact_mobile: ['contact_mobile'],
  f_contact_email: ['contact_email'],
  f_occupation: ['current_occupation'],
  f_experience: ['previous_experience_admissions'],
  f_perm_address: ['permanent_address'],
  f_curr_address: ['current_address'],
  f_addr1: ['address_line1'],
  f_landmark: ['landmark'],
  f_po: ['post_office'],
  f_city: ['city'],
  f_state: ['state_id', 'district_id'],
  f_pincode: ['pincode'],
  f_aadhar: ['aadhar_no'],
  f_pan: ['pan_no'],
  f_org_name: ['organization_name'],
  f_org_type: ['org_type'],
  f_reg_number: ['registration_number'],
  f_gst_pan: ['gst_pan'],
  f_premises_type: ['premises_type'],
  f_org_address: ['org_address'],
  f_org_po: ['org_post_office'],
  f_org_city: ['org_city'],
  f_org_pincode: ['org_pincode'],
  f_reception: ['facility_reception_desk'],
  f_waiting: ['facility_waiting_area'],
  f_meeting: ['facility_meeting_room'],
  f_rent_agreement: ['rent_agreement_attached', 'agreement_url'],
  f_photos: ['photos_attached', 'premises_photo_url'],
  f_acct_holder: ['bank_account_holder'],
  f_acct_no: ['bank_account_number'],
  f_ifsc: ['ifsc_code'],
  f_bank_branch: ['bank_branch'],
  f_edu_10th: ['edu_10th_institute', 'edu_10th_board', 'edu_10th_year'],
  f_edu_12th: ['edu_12th_institute', 'edu_12th_board', 'edu_12th_year'],
  f_edu_ug: ['edu_ug_institute', 'edu_ug_board', 'edu_ug_year'],
  f_edu_pg: ['edu_pg_institute', 'edu_pg_board', 'edu_pg_year'],
  f_edu_diploma: ['edu_diploma_institute', 'edu_diploma_board', 'edu_diploma_year'],
  doc_owner_photo: ['owner_photo_url'],
  doc_signature: ['owner_signature_url'],
  doc_aadhar: ['owner_aadhar_url'],
  doc_pan: ['owner_pan_url'],
  doc_reg: ['center_reg_url'],
  doc_premises: ['premises_photo_url'],
  doc_gst: ['gst_url'],
  doc_agreement: ['agreement_url'],
  doc_cheque: ['cancel_cheque_url'],
  doc_passbook: ['bank_passbook_url'],
}

// From the verify-modal fieldChecks, collect the form-field names that were explicitly
// flagged for correction — a box that is NOT verified AND has a remark. These are the
// only fields the super center may edit on resubmit; everything else stays locked.
function flaggedFormFields(fieldChecks) {
  const out = new Set()
  Object.entries(fieldChecks || {}).forEach(([key, v]) => {
    if (!v || v.ok) return
    if (!v.remark || !v.remark.trim()) return
    ;(CHECK_TO_FORM_FIELDS[key] || []).forEach(f => out.add(f))
  })
  return [...out]
}

// A hold remark is written as "Label: detail" per line. This maps each label back to the
// SubCenterForm field name(s) it refers to, so when a held center has no structured
// correction_fields we can still recover which fields were flagged from the remark text.
const LABEL_TO_FORM_FIELDS = {}
;[
  ['Center Name', ['center_name']], ['Email Address', ['email']], ['Phone Number', ['phone']],
  ['Contact Person', ['contact_person']], ['Father / Mother Name', ['father_mother_name']],
  ['Date of Birth', ['date_of_birth']], ['Gender', ['gender']], ['Nationality', ['nationality']],
  ['Contact Mobile', ['contact_mobile']], ['Contact Email', ['contact_email']],
  ['Current Occupation', ['current_occupation']], ['Prev. Experience (Admissions)', ['previous_experience_admissions']],
  ['Permanent Address', ['permanent_address']], ['Current Address', ['current_address']],
  ['Address Line 1', ['address_line1']], ['Landmark', ['landmark']], ['Post Office', ['post_office']],
  ['City', ['city']], ['State', ['state_id', 'district_id']], ['Pincode', ['pincode']],
  ['Aadhar Number', ['aadhar_no']], ['PAN Number', ['pan_no']], ['Organization Name', ['organization_name']],
  ['Org Type', ['org_type']], ['Registration Number', ['registration_number']], ['GST / PAN', ['gst_pan']],
  ['Premises Type', ['premises_type']], ['Org Address', ['org_address']], ['Org Post Office', ['org_post_office']],
  ['Org City', ['org_city']], ['Org Pincode', ['org_pincode']], ['Reception Desk', ['facility_reception_desk']],
  ['Waiting Area', ['facility_waiting_area']], ['Meeting Room', ['facility_meeting_room']],
  ['Rent Agreement', ['rent_agreement_attached', 'agreement_url']], ['Photos Attached', ['photos_attached', 'premises_photo_url']],
  ['Account Holder', ['bank_account_holder']], ['Account Number', ['bank_account_number']],
  ['IFSC Code', ['ifsc_code']], ['Bank Branch', ['bank_branch']],
  ['Owner Photo', ['owner_photo_url']], ['Owner Signature', ['owner_signature_url']],
  ['Aadhar Card', ['owner_aadhar_url']], ['PAN Card', ['owner_pan_url']],
  ['Registration Cert.', ['center_reg_url']], ['Premises Photo', ['premises_photo_url']],
  ['GST Certificate', ['gst_url']], ['Agreement', ['agreement_url']],
  ['Cancel Cheque', ['cancel_cheque_url']], ['Bank Passbook', ['bank_passbook_url']],
].forEach(([label, fields]) => { LABEL_TO_FORM_FIELDS[label] = fields })

// Parse a hold remark ("Label: detail" per line) into the set of form fields it refers to.
function fieldsFromRemark(remark) {
  if (!remark) return []
  const out = new Set()
  String(remark).split('\n').forEach(line => {
    const idx = line.indexOf(':')
    if (idx === -1) return
    const label = line.slice(0, idx).trim()
    const match = LABEL_TO_FORM_FIELDS[label]
      || Object.entries(LABEL_TO_FORM_FIELDS).find(([l]) => l.toLowerCase() === label.toLowerCase())?.[1]
    if (match) match.forEach(f => out.add(f))
  })
  return [...out]
}

// When a previously-held center is resubmitted, only the fields it was sent back to fix
// need re-verification. Everything else was already verified, so pre-mark those boxes as
// verified — the admin only re-checks the corrected fields instead of the whole form.
// Uses the structured correction_fields if present, else falls back to parsing the hold
// remark so it works even for centers held before that column existed.
function preVerifiedChecks(correctionFields, approvalNotes) {
  let fields = Array.isArray(correctionFields) ? correctionFields : []
  if (fields.length === 0) fields = fieldsFromRemark(approvalNotes)
  if (fields.length === 0) return {}
  const flagged = new Set(fields)
  const checks = {}
  Object.entries(CHECK_TO_FORM_FIELDS).forEach(([key, formFields]) => {
    const wasFlagged = formFields.some(f => flagged.has(f))
    // Already-verified fields are pre-marked verified AND locked, so the admin can't
    // accidentally un-verify them — only the flagged fields stay actionable.
    if (!wasFlagged) checks[key] = { ok: true, remark: '', locked: true }
  })
  return checks
}

// Every verify key marked verified AND locked. Used for centers that are already
// forwarded / approved — nothing should be editable, the whole form stays locked.
function allLockedChecks() {
  const checks = {}
  Object.keys(CHECK_TO_FORM_FIELDS).forEach(key => { checks[key] = { ok: true, remark: '', locked: true } })
  return checks
}

// Initial verify-modal state for a center: fully locked once forwarded/approved,
// otherwise pre-verify the already-checked fields and leave the flagged ones actionable.
function initialChecksForCenter(c) {
  const st = c?.approval_status
  if (st === 'doc_verified' || st === 'approved') return allLockedChecks()
  return preVerifiedChecks(c?.correction_fields, c?.approval_notes)
}


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

  // All centers (from centers table)
  const [directCenters, setDirectCenters] = useState([])
  const [centerStatusFilter, setCenterStatusFilter] = useState('Pending')
  const [dcLoading, setDcLoading] = useState(false)
  const [viewDC, setViewDC] = useState(null)
  const [dcVerifyModal, setDCVerifyModal] = useState(null)
  const [dcRemarks, setDCRemarks] = useState('')
  const [dcSaving, setDCSaving] = useState(false)
  const [dcRejectModal, setDCRejectModal] = useState(null)
  const [dcRejectRemarks, setDCRejectRemarks] = useState('')
  const [dcHoldModal, setDCHoldModal] = useState(null)
  const [dcHoldRemarks, setDCHoldRemarks] = useState('')
  const [dcHoldFields, setDCHoldFields] = useState([]) // form-field names flagged for correction
  const [fieldChecks, setFieldChecks] = useState({})

  useEffect(() => { fetchStudents() }, [statusFilter])
  useEffect(() => { fetchDirectCenters() }, [])
  useEffect(() => { if (mainTab === 'centers' || mainTab === 'super_centers') fetchDirectCenters() }, [mainTab])

  async function fetchDirectCenters() {
    setDcLoading(true)
    const { data, error } = await supabase
      .from('centers')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) console.error('fetchDirectCenters error:', error)
    // Show both center AND super center applications — super centers must also pass
    // through Document Dept verification before going to Account Dept. All statuses
    // are kept and bucketed into the Pending / Hold / Forwarded / Approved / Rejected sub-tabs.
    const rows = (data || [])
    // Fetch state names
    const stateIds = [...new Set(rows.map(r => r.state_id).filter(Boolean))]
    let stateMap = {}
    if (stateIds.length) {
      const { data: sts } = await supabase.from('states').select('id, state_name').in('id', stateIds)
      ;(sts || []).forEach(s => { stateMap[s.id] = s.state_name })
    }
    // Fetch super center names
    const scIds = [...new Set(rows.map(r => r.super_center_id).filter(Boolean))]
    let scMap = {}
    if (scIds.length) {
      const { data: scs } = await supabase.from('centers').select('id, center_name').in('id', scIds)
      ;(scs || []).forEach(sc => { scMap[sc.id] = sc.center_name })
    }
    setDirectCenters(rows.map(r => ({
      ...r,
      states: { state_name: stateMap[r.state_id] || null },
      super_center_name: scMap[r.super_center_id] || null,
    })))
    setDcLoading(false)
  }

  async function handleDCVerify() {
    setDCSaving(true)
    const { error } = await supabase.from('centers')
      .update({ approval_status: 'doc_verified', approval_notes: dcRemarks || null, correction_fields: null })
      .eq('id', dcVerifyModal.id)
    if (error) { alert('Verify failed: ' + error.message); setDCSaving(false); return }
    setDCSaving(false)
    setDCVerifyModal(null)
    setDCRemarks('')
    fetchDirectCenters()
  }

  async function confirmDCReject() {
    if (!dcRejectRemarks.trim()) { alert('A reason for rejection is required'); return }
    setDCSaving(true)
    const { error } = await supabase.from('centers')
      .update({ approval_status: 'rejected', status: 'Inactive', approval_notes: dcRejectRemarks, correction_fields: null })
      .eq('id', dcRejectModal.id)
    setDCSaving(false)
    if (error) { alert('Reject failed: ' + error.message); return }
    setDCRejectModal(null)
    setDCRejectRemarks('')
    fetchDirectCenters()
  }

  async function confirmDCHold() {
    if (!dcHoldRemarks.trim()) { alert('A remark is required to put this on hold'); return }
    setDCSaving(true)
    const { error } = await supabase.from('centers')
      .update({
        approval_status: 'hold',
        status: 'Pending',
        approval_notes: dcHoldRemarks.trim(),
        correction_fields: dcHoldFields.length ? dcHoldFields : null,
      })
      .eq('id', dcHoldModal.id)
    setDCSaving(false)
    if (error) { alert('Hold failed: ' + error.message); return }
    setDCHoldModal(null)
    setDCHoldRemarks('')
    setDCHoldFields([])
    setDCVerifyModal(null)
    setFieldChecks({})
    fetchDirectCenters()
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
    if (!remarks.trim()) { alert('Remarks are required for rejection'); return }
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
  // Centers and super centers are shown in separate main tabs.
  const isSuperTab = mainTab === 'super_centers'
  const centerRows = directCenters.filter(c => c.center_type !== 'super_center')
  const superCenterRows = directCenters.filter(c => c.center_type === 'super_center')
  const baseCenters = isSuperTab ? superCenterRows : centerRows
  const isPending = c => !c.approval_status || c.approval_status === 'pending'
  const pendingCenterCount = centerRows.filter(isPending).length
  const pendingSuperCenterCount = superCenterRows.filter(isPending).length
  const pendingBaseCount = baseCenters.filter(isPending).length
  const filteredCenters = baseCenters.filter(c => centerMatchesFilter(c, centerStatusFilter))

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
            {t.key === 'centers' && pendingCenterCount > 0 && (
              <span className="ml-2 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{pendingCenterCount}</span>
            )}
            {t.key === 'super_centers' && pendingSuperCenterCount > 0 && (
              <span className="ml-2 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{pendingSuperCenterCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Center / Super Center Applications Tab (same UI, filtered by type) */}
      {(mainTab === 'centers' || mainTab === 'super_centers') && (
        <div>
          {/* Center status filter tabs */}
          <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit flex-wrap">
            {CENTER_STATUS_FILTERS.map(s => {
              const count = baseCenters.filter(c => centerMatchesFilter(c, s)).length
              return (
                <button
                  key={s}
                  onClick={() => setCenterStatusFilter(s)}
                  className={`relative px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    centerStatusFilter === s ? 'bg-white text-[#933d18] shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {s}
                  {s === 'Pending' && pendingBaseCount > 0 && (
                    <span className="ml-1.5 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{pendingBaseCount}</span>
                  )}
                  {s !== 'Pending' && count > 0 && (
                    <span className="ml-1.5 bg-gray-200 text-gray-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{count}</span>
                  )}
                </button>
              )
            })}
          </div>

          {dcLoading ? (
            <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Loading...</div>
          ) : (
            <Table>
              <Thead>
                <tr>
                  <Th>#</Th>
                  <Th>Center Name</Th>
                  <Th>Contact Person</Th>
                  <Th>Super Center</Th>
                  <Th>City</Th>
                  <Th>State</Th>
                  <Th>Amount Paid</Th>
                  <Th>Submitted</Th>
                  <Th>Status</Th>
                  <Th>Actions</Th>
                </tr>
              </Thead>
              <Tbody>
                {filteredCenters.length === 0 ? (
                  <Tr><Td colSpan={10} className="text-center text-gray-400 py-12">No centers in “{centerStatusFilter}”.</Td></Tr>
                ) : filteredCenters.map((c, i) => (
                  <Tr key={c.id}>
                    <Td className="text-gray-400 text-xs w-10">{i + 1}</Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900">{c.center_name}</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${c.center_type === 'super_center' ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                          {c.center_type === 'super_center' ? 'Super Center' : 'Center'}
                        </span>
                        {c.approval_status === 'hold' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                            <PauseCircle size={10} /> On Hold
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">{c.email}</p>
                      {c.approval_status === 'hold' && c.approval_notes && (
                        <p className="text-[11px] text-amber-600 mt-0.5 max-w-[200px] truncate" title={c.approval_notes}>“{c.approval_notes}”</p>
                      )}
                    </Td>
                    <Td className="text-gray-500">{c.contact_person || '—'}</Td>
                    <Td className="text-gray-500 text-sm">{c.super_center_name || '—'}</Td>
                    <Td className="text-gray-500 text-xs">{c.city || '—'}</Td>
                    <Td className="text-gray-500 text-xs">{c.states?.state_name || '—'}</Td>
                    <Td className="font-bold text-gray-900">{c.amount_paid ? `₹${Number(c.amount_paid).toLocaleString()}` : '—'}</Td>
                    <Td className="text-gray-400 text-xs">{formatDate(c.created_at)}</Td>
                    <Td>
                      {(() => {
                        const st = c.approval_status
                        const map = {
                          hold: ['On Hold', 'bg-amber-100 text-amber-700 border-amber-200'],
                          doc_verified: ['Forwarded', 'bg-blue-100 text-blue-700 border-blue-200'],
                          approved: ['Approved', 'bg-emerald-100 text-emerald-700 border-emerald-200'],
                          rejected: ['Rejected', 'bg-red-100 text-red-700 border-red-200'],
                        }
                        const [label, cls] = map[st] || ['Pending', 'bg-gray-100 text-gray-600 border-gray-200']
                        return <span className={`inline-flex text-[10px] font-bold px-2 py-0.5 rounded-full border ${cls}`}>{label}</span>
                      })()}
                    </Td>
                    <Td>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setViewDC(c)} title="View Details">
                          <Eye size={13} className="text-[#933d18]" />
                        </Button>
                        {/* Verify / Hold / Reject only make sense while the center still needs doc verification */}
                        {(!c.approval_status || c.approval_status === 'pending' || c.approval_status === 'hold') && (
                          <>
                            <Button size="sm" variant="success" onClick={() => { setDCVerifyModal(c); setDCRemarks(''); setFieldChecks(initialChecksForCenter(c)) }}>
                              <CheckCircle size={13} /> Verify
                            </Button>
                            <button
                              onClick={() => { setDCHoldModal(c); setDCHoldRemarks(c.approval_status === 'hold' ? (c.approval_notes || '') : ''); setDCHoldFields(Array.isArray(c.correction_fields) ? c.correction_fields : []) }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-xl bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
                              title="Hold — needs correction, not forwarded to Account Dept.">
                              <PauseCircle size={13} /> Hold
                            </button>
                            <Button size="sm" variant="danger" onClick={() => { setDCRejectModal(c); setDCRejectRemarks('') }}>
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

          {/* View Direct Center Modal */}
          <Modal isOpen={!!viewDC} onClose={() => setViewDC(null)} title="Center Registration Details" size="xl">
            {viewDC && (
              <div className="max-h-[78vh] overflow-y-auto -mx-6 -mt-6 -mb-6">
                {/* Hero Header */}
                <div className="bg-gradient-to-r from-[#933d18] to-[#b84e22] px-6 py-5 flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                    <span className="text-2xl font-black text-white">{viewDC.center_name?.[0]?.toUpperCase() || 'C'}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-black text-white truncate">{viewDC.center_name}</h3>
                    <p className="text-sm text-white/75 mt-0.5">{viewDC.email}</p>
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      {viewDC.phone && <span className="text-xs bg-white/20 text-white px-2.5 py-1 rounded-lg font-medium">{viewDC.phone}</span>}
                      {viewDC.contact_person && <span className="text-xs bg-white/20 text-white px-2.5 py-1 rounded-lg font-medium">{viewDC.contact_person}</span>}
                      {viewDC.city && <span className="text-xs bg-white/20 text-white px-2.5 py-1 rounded-lg font-medium">{viewDC.city}{viewDC.states?.state_name ? `, ${viewDC.states.state_name}` : ''}</span>}
                    </div>
                  </div>
                  {viewDC.amount_paid && (
                    <div className="shrink-0 text-right">
                      <p className="text-xs text-white/60 uppercase tracking-wider font-bold">Amount Paid</p>
                      <p className="text-2xl font-black text-white">₹{Number(viewDC.amount_paid).toLocaleString()}</p>
                    </div>
                  )}
                </div>

                {/* Body: two columns */}
                <div className="grid grid-cols-5 gap-0 divide-x divide-gray-100">
                  {/* Left — Center Info (all fields) */}
                  <div className="col-span-3 p-6 space-y-5 overflow-y-auto">

                    {/* Helper inline component */}
                    {(() => {
                      const InfoGrid = ({ cols = 2, items }) => (
                        <div className={`grid grid-cols-${cols} gap-2`}>
                          {items.map(([label, val, mono]) => (
                            <div key={label} className="bg-gray-50 rounded-xl px-4 py-3">
                              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
                              <p className={`text-sm font-semibold text-gray-900 mt-0.5 ${mono ? 'font-mono' : ''}`}>{val || <span className="text-gray-400 font-normal font-sans">—</span>}</p>
                            </div>
                          ))}
                        </div>
                      )
                      const SectionHead = ({ title }) => (
                        <p className="text-[10px] font-black text-[#933d18] uppercase tracking-widest mb-2">{title}</p>
                      )
                      return (
                        <>
                          {/* Contact Person */}
                          <div>
                            <SectionHead title="Contact Person Details" />
                            <InfoGrid items={[
                              ['Contact Person', viewDC.contact_person],
                              ['Father / Mother Name', viewDC.father_mother_name],
                              ['Date of Birth', viewDC.date_of_birth ? formatDate(viewDC.date_of_birth) : null],
                              ['Gender', viewDC.gender],
                              ['Nationality', viewDC.nationality],
                              ['Contact Mobile', viewDC.contact_mobile],
                              ['Contact Email', viewDC.contact_email],
                              ['Occupation', viewDC.current_occupation],
                              ['Prev. Exp (Admissions)', viewDC.previous_experience_admissions],
                            ]} />
                            {(viewDC.permanent_address || viewDC.current_address) && (
                              <div className="grid grid-cols-1 gap-2 mt-2">
                                {viewDC.permanent_address && (
                                  <div className="bg-gray-50 rounded-xl px-4 py-3">
                                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Permanent Address</p>
                                    <p className="text-sm text-gray-900 mt-0.5">{viewDC.permanent_address}</p>
                                  </div>
                                )}
                                {viewDC.current_address && (
                                  <div className="bg-gray-50 rounded-xl px-4 py-3">
                                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Current Address</p>
                                    <p className="text-sm text-gray-900 mt-0.5">{viewDC.current_address}</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Center Address */}
                          <div>
                            <SectionHead title="Center Address" />
                            <InfoGrid items={[
                              ['Address Line 1', viewDC.address_line1],
                              ['Landmark', viewDC.landmark],
                              ['Post Office', viewDC.post_office],
                              ['City', viewDC.city],
                              ['State', viewDC.states?.state_name],
                              ['Pincode', viewDC.pincode],
                            ]} />
                          </div>

                          {/* Organization */}
                          <div>
                            <SectionHead title="Organization" />
                            <InfoGrid items={[
                              ['Organization Name', viewDC.organization_name],
                              ['Org Type', viewDC.org_type],
                              ['Reg. Number', viewDC.registration_number],
                              ['GST / PAN', viewDC.gst_pan],
                              ['Premises Type', viewDC.premises_type],
                              ['Org City', viewDC.org_city],
                              ['Org Pincode', viewDC.org_pincode],
                            ]} />
                            {viewDC.org_address && (
                              <div className="bg-gray-50 rounded-xl px-4 py-3 mt-2">
                                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Org Address</p>
                                <p className="text-sm text-gray-900 mt-0.5">{viewDC.org_address}</p>
                              </div>
                            )}
                          </div>

                          {/* Facilities */}
                          {(viewDC.facility_reception_desk || viewDC.facility_waiting_area || viewDC.facility_meeting_room) && (
                            <div>
                              <SectionHead title="Facilities & Premises" />
                              <InfoGrid items={[
                                ['Reception Desk', viewDC.facility_reception_desk],
                                ['Waiting Area', viewDC.facility_waiting_area],
                                ['Meeting Room', viewDC.facility_meeting_room],
                                ['Rent Agreement', viewDC.rent_agreement_attached],
                              ]} />
                            </div>
                          )}

                          {/* KYC */}
                          <div>
                            <SectionHead title="KYC Details" />
                            <InfoGrid items={[
                              ['Aadhar Number', viewDC.aadhar_no, true],
                              ['PAN Number', viewDC.pan_no, true],
                            ]} />
                          </div>

                          {/* Banking */}
                          <div>
                            <SectionHead title="Banking Details" />
                            <InfoGrid items={[
                              ['Account Holder', viewDC.bank_account_holder],
                              ['Bank Account No', viewDC.bank_account_number, true],
                              ['IFSC Code', viewDC.ifsc_code, true],
                              ['Bank Branch', viewDC.bank_branch],
                            ]} />
                          </div>

                          {/* Payment */}
                          <div>
                            <SectionHead title="Payment Details" />
                            <InfoGrid items={[
                              ['Amount Paid', viewDC.amount_paid ? `₹${Number(viewDC.amount_paid).toLocaleString()}` : null],
                              ['UTR Number', viewDC.utr_number, true],
                              ['Payment Date', viewDC.payment_date ? formatDate(viewDC.payment_date) : null],
                              ['Payment Remark', viewDC.payment_remark],
                            ]} />
                          </div>

                          {/* Education */}
                          {(viewDC.edu_10th_institute || viewDC.edu_12th_institute || viewDC.edu_ug_institute) && (
                            <div>
                              <SectionHead title="Education" />
                              <div className="border border-gray-200 rounded-xl overflow-hidden">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="bg-gray-100">
                                      <th className="text-left px-3 py-2 font-bold text-gray-500">Level</th>
                                      <th className="text-left px-3 py-2 font-bold text-gray-500">Institute</th>
                                      <th className="text-left px-3 py-2 font-bold text-gray-500">Board</th>
                                      <th className="text-left px-3 py-2 font-bold text-gray-500">Year</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {[
                                      ['10th', viewDC.edu_10th_institute, viewDC.edu_10th_board, viewDC.edu_10th_year],
                                      ['12th', viewDC.edu_12th_institute, viewDC.edu_12th_board, viewDC.edu_12th_year],
                                      ['UG', viewDC.edu_ug_institute, viewDC.edu_ug_board, viewDC.edu_ug_year],
                                      ['PG', viewDC.edu_pg_institute, viewDC.edu_pg_board, viewDC.edu_pg_year],
                                      ['Diploma', viewDC.edu_diploma_institute, viewDC.edu_diploma_board, viewDC.edu_diploma_year],
                                    ].filter(([, inst]) => inst).map(([level, inst, board, year]) => (
                                      <tr key={level} className="border-t border-gray-100">
                                        <td className="px-3 py-2 font-bold text-[#933d18]">{level}</td>
                                        <td className="px-3 py-2 text-gray-800">{inst}</td>
                                        <td className="px-3 py-2 text-gray-500">{board || '—'}</td>
                                        <td className="px-3 py-2 text-gray-500">{year || '—'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </>
                      )
                    })()}
                  </div>

                  {/* Right — Documents */}
                  <div className="col-span-2 p-6">
                    <p className="text-[10px] font-black text-[#933d18] uppercase tracking-widest mb-3">Documents</p>
                    <div className="space-y-1.5">
                      {[
                        ['Owner Photo', viewDC.owner_photo_url],
                        ['Owner Signature', viewDC.owner_signature_url],
                        ['Aadhar Card', viewDC.owner_aadhar_url],
                        ['PAN Card', viewDC.owner_pan_url],
                        ['Reg. Certificate', viewDC.center_reg_url],
                        ['Premises Photo', viewDC.premises_photo_url],
                        ['GST Certificate', viewDC.gst_url],
                        ['Agreement', viewDC.agreement_url],
                        ['Cancel Cheque', viewDC.cancel_cheque_url],
                        ['Bank Passbook', viewDC.bank_passbook_url],
                        ['Payment Proof', viewDC.payment_screenshot_url],
                      ].map(([label, url]) => (
                        <div key={label} className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all ${url ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-100'}`}>
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${url ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                            <span className="text-xs text-gray-700 font-medium truncate">{label}</span>
                          </div>
                          {url
                            ? <a href={url} target="_blank" rel="noreferrer" className="text-xs font-bold text-[#933d18] hover:underline flex items-center gap-1 shrink-0 ml-2">
                                <ExternalLink size={10} /> View
                              </a>
                            : <span className="text-[10px] text-gray-400 shrink-0 ml-2">Missing</span>
                          }
                        </div>
                      ))}
                    </div>
                    {/* Doc summary */}
                    {(() => {
                      const urls = [viewDC.owner_photo_url, viewDC.owner_signature_url, viewDC.owner_aadhar_url, viewDC.owner_pan_url, viewDC.center_reg_url, viewDC.premises_photo_url, viewDC.gst_url, viewDC.agreement_url, viewDC.cancel_cheque_url, viewDC.bank_passbook_url, viewDC.payment_screenshot_url]
                      const uploaded = urls.filter(Boolean).length
                      return (
                        <div className={`mt-3 text-xs font-bold px-3 py-2 rounded-xl text-center ${uploaded === 11 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                          {uploaded}/11 documents uploaded
                        </div>
                      )
                    })()}
                  </div>
                </div>

                {/* Footer CTA — verify only while the center still needs doc verification.
                    Once forwarded / approved / rejected it is view-only. */}
                {(!viewDC.approval_status || viewDC.approval_status === 'pending' || viewDC.approval_status === 'hold') ? (
                  <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex items-center justify-between gap-3">
                    <p className="text-xs text-gray-400">Review all details before proceeding to verification.</p>
                    <Button onClick={() => { setViewDC(null); setDCVerifyModal(viewDC); setDCRemarks(''); setFieldChecks(initialChecksForCenter(viewDC)) }}>
                      <CheckCircle size={14} /> Verify Documents
                    </Button>
                  </div>
                ) : (
                  <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex items-center justify-end gap-3">
                    <p className="text-xs text-gray-400">
                      {viewDC.approval_status === 'doc_verified' ? 'Already forwarded to Account Dept — view only.'
                        : viewDC.approval_status === 'approved' ? 'Already approved — view only.'
                        : 'Rejected — view only.'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </Modal>

          {/* Verify Direct Center Modal — Full Screen */}
          <Modal isOpen={!!dcVerifyModal} onClose={() => { setDCVerifyModal(null); setFieldChecks({}) }} title="Verify Center Documents" size="fullscreen">
            {dcVerifyModal && (() => {
              const c = dcVerifyModal

              const sections = [
                { title: 'Basic Information', icon: '🏢', fields: [
                  { key: 'f_center_name',    label: 'Center Name',       val: c.center_name },
                  { key: 'f_email',          label: 'Email Address',     val: c.email },
                  { key: 'f_phone',          label: 'Phone Number',      val: c.phone },
                  { key: 'f_contact_person', label: 'Contact Person',    val: c.contact_person },
                ]},
                { title: 'Contact Person Details', icon: '👤', fields: [
                  { key: 'f_father_mother',  label: 'Father / Mother Name',         val: c.father_mother_name },
                  { key: 'f_dob',            label: 'Date of Birth',                val: c.date_of_birth ? formatDate(c.date_of_birth) : null },
                  { key: 'f_gender',         label: 'Gender',                       val: c.gender },
                  { key: 'f_nationality',    label: 'Nationality',                  val: c.nationality },
                  { key: 'f_contact_mobile', label: 'Contact Mobile',               val: c.contact_mobile },
                  { key: 'f_contact_email',  label: 'Contact Email',                val: c.contact_email },
                  { key: 'f_occupation',     label: 'Current Occupation',           val: c.current_occupation },
                  { key: 'f_experience',     label: 'Prev. Experience (Admissions)',val: c.previous_experience_admissions },
                  { key: 'f_perm_address',   label: 'Permanent Address',            val: c.permanent_address },
                  { key: 'f_curr_address',   label: 'Current Address',              val: c.current_address },
                ]},
                { title: 'Center Address', icon: '📍', fields: [
                  { key: 'f_addr1',    label: 'Address Line 1', val: c.address_line1 },
                  { key: 'f_landmark', label: 'Landmark',       val: c.landmark },
                  { key: 'f_po',       label: 'Post Office',    val: c.post_office },
                  { key: 'f_city',     label: 'City',           val: c.city },
                  { key: 'f_state',    label: 'State',          val: c.states?.state_name },
                  { key: 'f_pincode',  label: 'Pincode',        val: c.pincode },
                ]},
                { title: 'KYC Details', icon: '🪪', fields: [
                  { key: 'f_aadhar', label: 'Aadhar Number', val: c.aadhar_no },
                  { key: 'f_pan',    label: 'PAN Number',    val: c.pan_no },
                ]},
                { title: 'Organization', icon: '🏛️', fields: [
                  { key: 'f_org_name',      label: 'Organization Name',   val: c.organization_name },
                  { key: 'f_org_type',      label: 'Org Type',            val: c.org_type },
                  { key: 'f_reg_number',    label: 'Registration Number', val: c.registration_number },
                  { key: 'f_gst_pan',       label: 'GST / PAN',           val: c.gst_pan },
                  { key: 'f_premises_type', label: 'Premises Type',       val: c.premises_type },
                  { key: 'f_org_address',   label: 'Org Address',         val: c.org_address },
                  { key: 'f_org_po',        label: 'Org Post Office',     val: c.org_post_office },
                  { key: 'f_org_city',      label: 'Org City',            val: c.org_city },
                  { key: 'f_org_pincode',   label: 'Org Pincode',         val: c.org_pincode },
                ]},
                { title: 'Facilities', icon: '🏗️', fields: [
                  { key: 'f_reception',      label: 'Reception Desk',  val: c.facility_reception_desk },
                  { key: 'f_waiting',        label: 'Waiting Area',    val: c.facility_waiting_area },
                  { key: 'f_meeting',        label: 'Meeting Room',    val: c.facility_meeting_room },
                  { key: 'f_rent_agreement', label: 'Rent Agreement',  val: c.rent_agreement_attached },
                  { key: 'f_photos',         label: 'Photos Attached', val: c.photos_attached },
                ]},
                { title: 'Banking Details', icon: '🏦', fields: [
                  { key: 'f_acct_holder', label: 'Account Holder', val: c.bank_account_holder },
                  { key: 'f_acct_no',     label: 'Account Number', val: c.bank_account_number },
                  { key: 'f_ifsc',        label: 'IFSC Code',      val: c.ifsc_code },
                  { key: 'f_bank_branch', label: 'Bank Branch',    val: c.bank_branch },
                ]},
                ...[
                  ['10th', c.edu_10th_institute, c.edu_10th_board, c.edu_10th_year],
                  ['12th', c.edu_12th_institute, c.edu_12th_board, c.edu_12th_year],
                  ['UG',   c.edu_ug_institute,   c.edu_ug_board,   c.edu_ug_year],
                  ['PG',   c.edu_pg_institute,   c.edu_pg_board,   c.edu_pg_year],
                  ['Diploma', c.edu_diploma_institute, c.edu_diploma_board, c.edu_diploma_year],
                ].filter(([, inst]) => inst).length > 0 ? [{
                  title: 'Education', icon: '🎓',
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
              ]

              const docFields = [
                { key: 'doc_owner_photo', label: 'Owner Photo',         url: c.owner_photo_url },
                { key: 'doc_signature',   label: 'Owner Signature',     url: c.owner_signature_url },
                { key: 'doc_aadhar',      label: 'Aadhar Card',         url: c.owner_aadhar_url },
                { key: 'doc_pan',         label: 'PAN Card',            url: c.owner_pan_url },
                { key: 'doc_reg',         label: 'Registration Cert.',  url: c.center_reg_url },
                { key: 'doc_premises',    label: 'Premises Photo',      url: c.premises_photo_url },
                { key: 'doc_gst',         label: 'GST Certificate',     url: c.gst_url },
                { key: 'doc_agreement',   label: 'Agreement',           url: c.agreement_url },
                { key: 'doc_cheque',      label: 'Cancel Cheque',       url: c.cancel_cheque_url },
                { key: 'doc_passbook',    label: 'Bank Passbook',       url: c.bank_passbook_url },
              ]

              const allFieldKeys = sections.flatMap(s => s.fields.map(f => f.key))
              const allDocKeys = docFields.map(d => d.key)
              const allKeys = [...allFieldKeys, ...allDocKeys]
              const totalItems = allKeys.length
              const verifiedCount = Object.values(fieldChecks).filter(v => v.ok).length
              const pct = totalItems ? Math.round((verifiedCount / totalItems) * 100) : 0

              const labelMap = {}
              sections.forEach(s => s.fields.forEach(f => { labelMap[f.key] = f.label }))
              docFields.forEach(d => { labelMap[d.key] = d.label })
              const issueLines = Object.entries(fieldChecks)
                .filter(([, v]) => !v.ok && v.remark && v.remark.trim())
                .map(([k, v]) => `${labelMap[k] || k}: ${v.remark.trim()}`)
              const composedHoldNote = [dcRemarks.trim(), ...issueLines].filter(Boolean).join('\n')

              // Forward to Account Dept ONLY if every item is verified and no remark is noted.
              // Any unverified box or any remark => must Hold instead.
              const hasAnyRemark = Object.values(fieldChecks).some(v => v?.remark && v.remark.trim())
              const allVerified = totalItems > 0 && allKeys.every(k => fieldChecks[k]?.ok)
              const canForward = allVerified && !hasAnyRemark
              const blockReason = !allVerified
                ? `${totalItems - verifiedCount} field(s) not yet verified`
                : hasAnyRemark ? 'Some fields have a remark noted' : ''

              // Hold is only allowed after the WHOLE form is reviewed — every visible field and
              // every document must be either Verified or have a Remark. This forces a complete
              // one-pass review so nothing is held back without being looked at.
              const reviewableKeys = [
                ...sections.flatMap(s => s.fields.filter(f => f.val).map(f => f.key)),
                ...allDocKeys,
              ]
              const unreviewedKeys = reviewableKeys.filter(
                k => !(fieldChecks[k]?.ok || (fieldChecks[k]?.remark && fieldChecks[k].remark.trim()))
              )
              const allReviewed = unreviewedKeys.length === 0
              const hasIssueForHold = issueLines.length > 0

              function verifyAll() {
                const next = {}
                // Verify All marks every field verified but keeps them editable — the admin can
                // still change anything until "Verify & Forward to Account Dept" is clicked.
                // Pre-verified (resubmit) fields keep their existing locked flag.
                allKeys.forEach(k => { next[k] = { ok: true, remark: fieldChecks[k]?.remark || '', locked: fieldChecks[k]?.locked || false } })
                setFieldChecks(next)
              }

              function unverifyAll() {
                const next = {}
                // Undo Verify All — reset everything to unverified, but locked
                // (pre-verified resubmit) fields stay verified & locked.
                allKeys.forEach(k => {
                  next[k] = fieldChecks[k]?.locked
                    ? { ok: true, remark: '', locked: true }
                    : { ok: false, remark: fieldChecks[k]?.remark || '' }
                })
                setFieldChecks(next)
              }

              return (
                <div className="flex flex-col h-full bg-gray-50">

                  {/* Top header bar */}
                  <div className="shrink-0 bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
                    <div className="flex items-center gap-4">
                      {/* Avatar */}
                      <div className="w-11 h-11 rounded-xl bg-[#933d18]/10 flex items-center justify-center shrink-0 border border-[#933d18]/20">
                        <span className="text-lg font-black text-[#933d18]">{c.center_name?.[0]?.toUpperCase() || 'C'}</span>
                      </div>
                      {/* Name + meta */}
                      <div className="flex-1 min-w-0">
                        <h2 className="text-base font-black text-gray-900 truncate">{c.center_name}</h2>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">
                          {[c.contact_person, c.email, c.phone].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      {/* Progress */}
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-right">
                          <div className="flex items-baseline gap-1 justify-end">
                            <span className="text-xl font-black text-gray-900">{verifiedCount}</span>
                            <span className="text-sm text-gray-400 font-semibold">/ {totalItems}</span>
                            <span className={`ml-1 text-xs font-bold ${pct === 100 ? 'text-emerald-600' : 'text-gray-400'}`}>
                              {pct === 100 ? '✓ Complete' : `${pct}%`}
                            </span>
                          </div>
                          <div className="w-40 h-1.5 bg-gray-100 rounded-full mt-1.5">
                            <div
                              className={`h-1.5 rounded-full transition-all duration-300 ${pct === 100 ? 'bg-emerald-500' : 'bg-[#933d18]'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                        <button
                          onClick={verifyAll}
                          className="flex items-center gap-2 bg-[#933d18] hover:bg-[#7a3215] text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-colors shadow-sm"
                        >
                          <CheckCircle size={15} /> Verify All
                        </button>
                        <button
                          onClick={unverifyAll}
                          className="flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-600 border border-gray-300 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors shadow-sm"
                          title="Undo Verify All — mark everything as unverified"
                        >
                          <XCircle size={15} /> Unverify All
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
                        const secVerified = visible.filter(f => fieldChecks[f.key]?.ok).length
                        return (
                          <div key={sec.title} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                            {/* Section header */}
                            <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-100">
                              <div className="flex items-center gap-2">
                                <span className="text-sm">{sec.icon}</span>
                                <p className="text-xs font-black text-gray-700 uppercase tracking-widest">{sec.title}</p>
                              </div>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                secVerified === visible.length
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-gray-100 text-gray-500'
                              }`}>
                                {secVerified}/{visible.length} verified
                              </span>
                            </div>
                            {/* Fields grid */}
                            <div className="p-4 grid grid-cols-2 gap-3">
                              {visible.map(f => <VerifyRow key={f.key} fkey={f.key} label={f.label} val={f.val} checks={fieldChecks} setChecks={setFieldChecks} />)}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Right — Documents panel */}
                    <div className="w-80 shrink-0 overflow-y-auto border-l border-gray-200 bg-white">
                      <div className="p-5">
                        {/* Panel header */}
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">📄</span>
                            <p className="text-xs font-black text-gray-700 uppercase tracking-widest">Documents</p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              docFields.filter(d => d.url).length === docFields.length
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                              {docFields.filter(d => d.url).length}/{docFields.length} uploaded
                            </span>
                          </div>
                        </div>
                        {/* Doc cards */}
                        <div className="space-y-2">
                          {docFields.map(d => <VerifyRow key={d.key} fkey={d.key} label={d.label} url={d.url} checks={fieldChecks} setChecks={setFieldChecks} />)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="shrink-0 bg-white border-t border-gray-200 px-6 py-4 flex items-center gap-3 shadow-sm">
                    {!allReviewed ? (
                      <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg whitespace-nowrap">
                        {unreviewedKeys.length} field(s) not yet reviewed — Verify / add a Remark for the whole form first
                      </span>
                    ) : !canForward && blockReason && (
                      <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg whitespace-nowrap">
                        {blockReason} — cannot be forwarded to Account Dept., please Hold instead
                      </span>
                    )}
                    <input
                      type="text"
                      placeholder="Overall remarks (optional)..."
                      className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#933d18] focus:ring-2 focus:ring-[#933d18]/10 bg-gray-50 transition-all"
                      value={dcRemarks}
                      onChange={e => setDCRemarks(e.target.value)}
                    />
                    <button
                      onClick={() => {
                        if (!canForward) {
                          alert(`Cannot forward to Account Dept. — ${blockReason}.\n\nVerify all fields and leave no remarks, or put the center on Hold.`)
                          return
                        }
                        handleDCVerify()
                      }}
                      disabled={dcSaving || !canForward}
                      title={canForward ? '' : `${blockReason} — please Hold`}
                      className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-colors shadow-sm whitespace-nowrap"
                    >
                      <CheckCircle size={15} />
                      {dcSaving ? 'Saving...' : 'Verify & Forward to Account Dept.'}
                    </button>
                    <button
                      onClick={() => {
                        if (!allReviewed) {
                          alert(`Review the whole form first — ${unreviewedKeys.length} field(s)/document(s) are neither verified nor have a remark.\n\nEither Verify each field, or add a Remark on the ones with issues. Only then can you Hold.`)
                          return
                        }
                        if (!hasIssueForHold) {
                          alert('To put this on hold, you must add a remark on at least one field that needs correction. If everything is correct, forward it to Account Dept.')
                          return
                        }
                        setDCHoldModal(c); setDCHoldRemarks(composedHoldNote); setDCHoldFields(flaggedFormFields(fieldChecks))
                      }}
                      disabled={dcSaving}
                      className="flex items-center gap-2 bg-amber-100 hover:bg-amber-200 disabled:opacity-50 disabled:cursor-not-allowed text-amber-700 px-5 py-2.5 rounded-xl text-sm font-bold transition-colors whitespace-nowrap"
                      title={!allReviewed ? `${unreviewedKeys.length} field(s) not yet reviewed — verify or remark all of them` : 'Fields with a remark will be sent back for correction'}
                    >
                      <PauseCircle size={15} /> Hold{!allReviewed ? ` (${unreviewedKeys.length} left)` : ''}
                    </button>
                    <button
                      onClick={() => { setDCVerifyModal(null); setDCRejectModal(c); setDCRejectRemarks('') }}
                      disabled={dcSaving}
                      className="flex items-center gap-2 bg-red-100 hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed text-red-700 px-5 py-2.5 rounded-xl text-sm font-bold transition-colors whitespace-nowrap"
                      title="Reject this center registration"
                    >
                      <XCircle size={15} /> Reject
                    </button>
                    <button
                      onClick={() => { setDCVerifyModal(null); setFieldChecks({}) }}
                      className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors whitespace-nowrap"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )
            })()}
          </Modal>

          {/* Hold Center Modal — requires remarks, NOT forwarded to Account Dept. */}
          <Modal isOpen={!!dcHoldModal} onClose={() => setDCHoldModal(null)} title="Hold Center — Send Back for Correction">
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
                <strong>{dcHoldModal?.center_name}</strong> will be put on hold. It will <strong>not</strong> be forwarded to Account Dept.
                The Center / Super Center will see this remark so they can make corrections.
              </div>
              {dcHoldFields.length > 0 ? (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
                  On resubmit, only the <strong>{dcHoldFields.length}</strong> flagged field(s) will stay editable — everything else will be treated as verified and locked.
                </div>
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs text-gray-500">
                  No specific field was flagged — the entire form will stay editable on resubmit. (To lock a field, uncheck its box in the verify modal and add a remark on it.)
                </div>
              )}
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Hold Remark <span className="text-red-500">*</span></label>
                <textarea
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-amber-400 resize-none"
                  rows={4}
                  placeholder="Describe which documents/fields have issues (required)..."
                  value={dcHoldRemarks}
                  onChange={e => setDCHoldRemarks(e.target.value)}
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={confirmDCHold}
                  disabled={dcSaving}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-xl bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 transition-colors"
                >
                  <PauseCircle size={15} /> {dcSaving ? 'Saving...' : 'Confirm Hold'}
                </button>
                <Button variant="outline" onClick={() => setDCHoldModal(null)}>Cancel</Button>
              </div>
            </div>
          </Modal>

          {/* Reject Center Modal — requires remarks */}
          <Modal isOpen={!!dcRejectModal} onClose={() => setDCRejectModal(null)} title="Reject Center Registration">
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Are you sure you want to reject the registration for <strong>{dcRejectModal?.center_name}</strong>? The center will see the reason.
              </p>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Rejection Reason <span className="text-red-500">*</span></label>
                <textarea
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-red-400 resize-none"
                  rows={3}
                  placeholder="Describe what is wrong with the document (required)..."
                  value={dcRejectRemarks}
                  onChange={e => setDCRejectRemarks(e.target.value)}
                />
              </div>
              <div className="flex gap-3">
                <Button variant="danger" onClick={confirmDCReject} disabled={dcSaving}>{dcSaving ? 'Saving...' : 'Confirm Reject'}</Button>
                <Button variant="outline" onClick={() => setDCRejectModal(null)}>Cancel</Button>
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
                <Td className="text-gray-400 text-xs">{formatDate(s.created_at)}</Td>
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
            On verifying, an <strong>Admission Number will be auto-generated</strong> and the student will move to <strong>Hold</strong> status for the Account Dept.
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
            Are you sure you want to reject the application for <strong>{rejectModal?.student_name}</strong>?
          </p>
          <div>
            <label className="text-xs font-semibold text-gray-600 mb-1 block">Rejection Reason <span className="text-red-500">*</span></label>
            <textarea
              className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-red-400 resize-none"
              rows={3}
              placeholder="Enter the reason for rejection (required)..."
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
