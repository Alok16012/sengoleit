import { useState } from 'react'
import { FileSpreadsheet, FileText } from 'lucide-react'
import { supabase } from '../lib/supabase'
import Modal from './ui/Modal'
import Button from './ui/Button'
import { exportCsv, exportPdf } from '../utils/exportTable'
import { formatDate } from '../utils/formatDate'

// Students → Export: tick the details wanted, then Excel or PDF. The rows are
// the students the list is showing (search, filters and tab applied), read
// again in full so details the list does not carry — parents, address, caste,
// Aadhaar — are there.

const address = (s, p) => [
  s[`${p}_village_town`], s[`${p}_landmark`], s[`${p}_post_office`], s[`${p}_city`],
  s[`${p}_district`], s[`${p}_state`], s[`${p}_pin_code`] ? `- ${s[`${p}_pin_code`]}` : null,
].filter(Boolean).join(', ')

// A long number kept as text, so Excel does not turn it into 1.23E+11.
const asText = v => (v ? `\t${v}` : '')
const num = key => ({ value: s => asText(s[key]), pdfValue: s => s[key] || '' })
const txt = key => ({ value: s => s[key] ?? '' })

// group, key, header, how to read it.
const FIELDS = [
  ['Student', 'student_name', 'Student Name', txt('student_name')],
  ['Student', 'fathers_name', "Father's Name", txt('fathers_name')],
  ['Student', 'mothers_name', "Mother's Name", txt('mothers_name')],
  ['Student', 'date_of_birth', 'Date of Birth', { value: s => (s.date_of_birth ? formatDate(s.date_of_birth) : '') }],
  ['Student', 'gender', 'Gender', txt('gender')],
  ['Student', 'caste', 'Caste', txt('caste')],
  ['Student', 'religion', 'Religion', txt('religion')],
  ['Student', 'nationality', 'Nationality', txt('nationality')],
  ['Student', 'blood_group', 'Blood Group', txt('blood_group')],
  ['Student', 'aadhar_no', 'Aadhaar No.', num('aadhar_no')],
  ['Student', 'pan_no', 'PAN No.', txt('pan_no')],
  ['Contact', 'mobile_no', 'Mobile No.', num('mobile_no')],
  ['Contact', 'whatsapp_no', 'WhatsApp No.', num('whatsapp_no')],
  ['Contact', 'email', 'Email', txt('email')],
  ['Contact', 'perm_address', 'Address (Permanent)', { value: s => address(s, 'student_perm') }],
  ['Contact', 'pres_address', 'Address (Present)', { value: s => address(s, 'student_pres') }],
  ['Contact', 'guardian_name', 'Guardian Name', txt('guardian_name')],
  ['Contact', 'guardian_mobile', 'Guardian Mobile', num('guardian_mobile')],
  ['Admission', 'admission_number', 'Application No.', txt('admission_number')],
  ['Admission', 'enrollment_no', 'Enrollment No.', txt('enrollment_no')],
  ['Admission', 'registration_no', 'Registration No.', txt('registration_no')],
  ['Admission', 'program', 'Program', { value: s => s.programs?.program_name || '' }],
  ['Admission', 'specialization', 'Specialization', txt('specialization')],
  ['Admission', 'semester_year', 'Semester / Year', txt('semester_year')],
  ['Admission', 'session', 'Session', { value: s => s.academic_sessions?.session_name || '' }],
  ['Admission', 'center', 'Center', { value: s => s.centers?.center_name || '' }],
  ['Admission', 'center_code', 'Center Code', { value: s => s.centers?.center_code || '' }],
  ['Admission', 'entry_type', 'Entry', txt('entry_type')],
  ['Admission', 'status', 'Status', txt('status')],
  ['Admission', 'created_at', 'Entered On', { value: s => (s.created_at ? formatDate(s.created_at) : '') }],
].map(([group, key, header, read]) => ({ group, key, header, ...read }))

const DEFAULT = ['student_name', 'fathers_name', 'mothers_name', 'perm_address', 'caste', 'date_of_birth', 'aadhar_no', 'mobile_no']
const STORE = 'students_export_fields'

function savedPick() {
  try {
    const v = JSON.parse(localStorage.getItem(STORE) || 'null')
    if (Array.isArray(v) && v.length) return new Set(v.filter(k => FIELDS.some(f => f.key === k)))
  } catch { /* ignore */ }
  return new Set(DEFAULT)
}

export default function StudentExportModal({ isOpen, onClose, students, meta = [] }) {
  const [picked, setPicked] = useState(savedPick)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const toggle = key => setPicked(prev => {
    const next = new Set(prev)
    if (next.has(key)) next.delete(key); else next.add(key)
    return next
  })
  const groups = [...new Set(FIELDS.map(f => f.group))]

  async function run(kind) {
    const columns = FIELDS.filter(f => picked.has(f.key))
    if (!columns.length) return setError('Tick at least one detail.')
    if (!students.length) return setError('No students to export — the list is empty.')
    setBusy(kind); setError('')
    try { localStorage.setItem(STORE, JSON.stringify([...picked])) } catch { /* ignore */ }
    // The full record of each listed student, in the order the list shows them.
    const full = {}
    const ids = students.map(s => s.id)
    for (let i = 0; i < ids.length; i += 150) {
      const { data, error: e } = await supabase.from('students').select('*').in('id', ids.slice(i, i + 150))
      if (e) { setBusy(''); return setError('Could not read the students: ' + e.message) }
      ;(data || []).forEach(r => { full[r.id] = r })
    }
    const rows = students.map((s, i) => ({ ...s, ...(full[s.id] || {}), _sno: i + 1 }))
    const withSno = [{ header: 'S.No.', value: r => r._sno }, ...columns]
    if (kind === 'excel') exportCsv('students', withSno, rows)
    else exportPdf('Students', withSno, rows, meta)
    setBusy('')
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={() => !busy && onClose()} title="Export Students">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-gray-600">
            <span className="font-bold text-gray-900">{students.length}</span> student{students.length === 1 ? '' : 's'} in the list.
            Tick the details you want.
          </p>
          <div className="flex gap-3 text-xs font-bold text-[#933d18]">
            <button onClick={() => setPicked(new Set(FIELDS.map(f => f.key)))} className="hover:underline">Select all</button>
            <button onClick={() => setPicked(new Set())} className="hover:underline">Clear</button>
          </div>
        </div>

        <div className="space-y-3 max-h-[52vh] overflow-y-auto pr-1">
          {groups.map(g => (
            <div key={g}>
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-gray-400 mb-1.5">{g}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1.5">
                {FIELDS.filter(f => f.group === g).map(f => (
                  <label key={f.key} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                    <input type="checkbox" checked={picked.has(f.key)} onChange={() => toggle(f.key)}
                      className="h-4 w-4 rounded border-gray-300 accent-[#933d18]" />
                    {f.header}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        {error && <p className="text-xs font-semibold text-red-600">{error}</p>}

        <div className="flex items-center justify-between gap-2 pt-1">
          <p className="text-xs text-gray-400">{picked.size} selected</p>
          <div className="flex gap-2">
            <Button variant="ghost" size="md" disabled={!!busy} onClick={onClose}>Cancel</Button>
            <Button variant="secondary" size="md" disabled={!!busy} onClick={() => run('pdf')}>
              <FileText size={14} /> {busy === 'pdf' ? 'Preparing…' : 'PDF'}
            </Button>
            <Button variant="primary" size="md" disabled={!!busy} onClick={() => run('excel')}>
              <FileSpreadsheet size={14} /> {busy === 'excel' ? 'Preparing…' : 'Excel'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
