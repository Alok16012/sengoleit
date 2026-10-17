import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import DateInput from '../../components/ui/DateInput'
import { Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui/Table'
import { SearchableSelect } from '../../components/ui/SearchSelect'
import { Truck, Plus, Pencil, Trash2, Search, Paperclip, X, Users } from 'lucide-react'
import { formatDate } from '../../utils/formatDate'
import { fetchAllRows } from '../../utils/fetchAllRows'
import { currentSemOf } from '../../utils/reRegistration'

// Admin courier log — every document courier sent to a super centre / centre,
// with tracking number, address, sender and any number of receipt scans.
// Receipts live in the `documents` bucket under courier-receipts/.
// Needs add_courier_details.sql and add_courier_students.sql.
//
// The students a courier carried are ticked in a popup, each with the
// semesters whose documents went — so the log answers "which semesters of
// this student's documents have been sent".

const DOC_TYPES = ['Marksheet', 'Provisional', 'Migration', 'Degree', 'Other']

// Semesters on offer for a student: the course length, or (if the course has
// none recorded) up to the term the student is in.
const semCountOf = st => Number(st?.programs?.duration) || currentSemOf(st) || 1

// "Sem 1, 2, 3"
const semText = sems => (sems || []).length ? `Sem ${[...sems].sort((a, b) => a - b).join(', ')}` : ''

const today = () => new Date().toISOString().slice(0, 10)

const emptyForm = () => ({
  super_center_id: '', center_id: '', document_types: [], other_document: '',
  courier_date: today(), student_name: '', tracking_no: '', sent_to_address: '',
  sent_from: '', sender_by: '', receipts: [], students: [],
})

export default function CourierDetails() {
  const [rows, setRows] = useState([])
  const [centers, setCenters] = useState([])
  const [loading, setLoading] = useState(true)
  const [needsSql, setNeedsSql] = useState(false)
  const [q, setQ] = useState('')
  const [superFilter, setSuperFilter] = useState('all')
  const [centerFilter, setCenterFilter] = useState('all')

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm())
  const [newFiles, setNewFiles] = useState([])
  const [studentsByCenter, setStudentsByCenter] = useState({})
  const [busy, setBusy] = useState(false)
  // Student picker popup — draft is { studentId: [semesters] } until Done.
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerQ, setPickerQ] = useState('')
  const [draft, setDraft] = useState({})
  // Courier whose student list is open in the "View" popup.
  const [viewing, setViewing] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [cd, ce] = await Promise.all([
      supabase.from('courier_details').select('*').order('courier_date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('centers').select('id, center_name, center_code, center_type, super_center_id').order('center_name'),
    ])
    if (cd.error) setNeedsSql(true)
    setRows(cd.data || [])
    setCenters(ce.data || [])
    setLoading(false)
  }

  const superCenters = useMemo(() => centers.filter(c => c.center_type === 'super_center'), [centers])
  const centerById = useMemo(() => Object.fromEntries(centers.map(c => [c.id, c])), [centers])
  const centerLabel = c => c ? `${c.center_name}${c.center_code ? ` (${c.center_code})` : ''}` : ''

  // Centres offered for a chosen super centre: its own sub-centres, plus the
  // super centre itself (it takes admissions too).
  const centersUnder = (superId) => centers.filter(c =>
    !superId || superId === 'all' ? true : (c.super_center_id === superId || c.id === superId))

  // Students of the chosen centre, for the picker (cached per centre).
  useEffect(() => {
    const id = form.center_id
    if (!open || !id || studentsByCenter[id]) return
    fetchAllRows(() => supabase.from('students')
      .select('id, student_name, enrollment_no, registration_no, semester_year, programs(program_name, duration, semester_year)')
      .eq('center_id', id).order('student_name').order('id'))
      .then(({ data }) => setStudentsByCenter(m => ({ ...m, [id]: data || [] })))
  }, [open, form.center_id, studentsByCenter])
  const students = studentsByCenter[form.center_id]

  function openNew() {
    setEditing(null); setForm(emptyForm()); setNewFiles([]); setOpen(true)
  }

  function openEdit(r) {
    setEditing(r)
    setForm({
      super_center_id: r.super_center_id || '', center_id: r.center_id || '',
      document_types: r.document_types || [], other_document: r.other_document || '',
      courier_date: r.courier_date || '', student_name: r.student_name || '',
      tracking_no: r.tracking_no || '', sent_to_address: r.sent_to_address || '',
      sent_from: r.sent_from || '', sender_by: r.sender_by || '',
      receipts: Array.isArray(r.receipts) ? r.receipts : [],
      students: Array.isArray(r.students) ? r.students : [],
    })
    setNewFiles([])
    setOpen(true)
  }

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  function pickSuper(id) {
    setForm(f => {
      const keep = f.center_id && (centerById[f.center_id]?.super_center_id === id || f.center_id === id)
      return keep ? { ...f, super_center_id: id } : { ...f, super_center_id: id, center_id: '', students: [] }
    })
  }

  function pickCenter(id) {
    const c = centerById[id]
    setForm(f => ({
      ...f, center_id: id,
      students: id === f.center_id ? f.students : [],
      super_center_id: f.super_center_id || (c?.center_type === 'super_center' ? c.id : c?.super_center_id) || '',
    }))
  }

  function toggleDoc(t) {
    setForm(f => ({
      ...f,
      document_types: f.document_types.includes(t) ? f.document_types.filter(x => x !== t) : [...f.document_types, t],
    }))
  }

  function addFiles(e) {
    const files = Array.from(e.target.files || [])
    setNewFiles(prev => [...prev, ...files])
    e.target.value = ''
  }

  function openPicker() {
    if (!form.center_id) return alert('Choose a center first.')
    setDraft(Object.fromEntries(form.students.map(st => [st.id, st.semesters || []])))
    setPickerQ('')
    setPickerOpen(true)
  }

  function toggleStudent(st) {
    setDraft(d => {
      if (d[st.id]) { const n = { ...d }; delete n[st.id]; return n }
      return { ...d, [st.id]: [Math.min(currentSemOf(st), semCountOf(st))] }
    })
  }

  function toggleSem(st, n) {
    setDraft(d => {
      const cur = d[st.id] || []
      return { ...d, [st.id]: cur.includes(n) ? cur.filter(x => x !== n) : [...cur, n].sort((a, b) => a - b) }
    })
  }

  function allSems(st) {
    const all = Array.from({ length: semCountOf(st) }, (_, k) => k + 1)
    setDraft(d => ({ ...d, [st.id]: (d[st.id] || []).length === all.length ? [] : all }))
  }

  function confirmPicker() {
    const list = students || []
    const empty = list.filter(st => draft[st.id] && draft[st.id].length === 0)
    if (empty.length) return alert(`Tick at least one semester for: ${empty.map(st => st.student_name).join(', ')}`)
    // Keep ticked students in the order they appear; ones no longer in the
    // centre's list (e.g. moved) stay as they were saved.
    const picked = list.filter(st => draft[st.id]).map(st => ({
      id: st.id, name: st.student_name, enrollment_no: st.enrollment_no || st.registration_no || '',
      program: st.programs?.program_name || '', semesters: draft[st.id],
    }))
    const kept = form.students.filter(st => draft[st.id] && !list.some(x => x.id === st.id))
    setForm(f => ({ ...f, students: [...picked, ...kept] }))
    setPickerOpen(false)
  }

  async function handleSave() {
    if (!form.center_id && !form.super_center_id) return alert('Choose a super center or center.')
    if (form.document_types.length === 0) return alert('Tick at least one document type.')
    if (form.document_types.includes('Other') && !form.other_document.trim()) return alert('Write what the "Other" document is.')
    setBusy(true)

    const uploaded = []
    for (const file of newFiles) {
      const ext = (file.name.split('.').pop() || 'bin').toLowerCase()
      const path = `courier-receipts/${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`
      const up = await supabase.storage.from('documents').upload(path, file, { upsert: true })
      if (up.error) { alert(`Upload of ${file.name} failed: ${up.error.message}`); setBusy(false); return }
      const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path)
      uploaded.push({ name: file.name, url: publicUrl })
    }

    const payload = {
      super_center_id: form.super_center_id || null,
      center_id: form.center_id || null,
      document_types: form.document_types,
      other_document: form.document_types.includes('Other') ? form.other_document.trim() : null,
      courier_date: form.courier_date || null,
      students: form.students,
      student_name: form.students.length ? form.students.map(st => st.name).join(', ') : (form.student_name.trim() || null),
      tracking_no: form.tracking_no.trim() || null,
      sent_to_address: form.sent_to_address.trim() || null,
      sent_from: form.sent_from.trim() || null,
      sender_by: form.sender_by.trim() || null,
      receipts: [...form.receipts, ...uploaded],
      updated_at: new Date().toISOString(),
    }

    const { error } = editing
      ? await supabase.from('courier_details').update(payload).eq('id', editing.id)
      : await supabase.from('courier_details').insert(payload)
    setBusy(false)
    if (error) return alert('Save failed (run add_courier_details.sql and add_courier_students.sql in Supabase first): ' + error.message)
    setOpen(false)
    load()
  }

  async function handleDelete(r) {
    if (!confirm(`Delete this courier entry${r.tracking_no ? ` (Tracking ${r.tracking_no})` : ''}?`)) return
    const { error } = await supabase.from('courier_details').delete().eq('id', r.id)
    if (error) return alert('Delete failed: ' + error.message)
    setRows(rs => rs.filter(x => x.id !== r.id))
  }

  // Students of a courier matching the search box (name / enrollment no).
  const studentHits = r => {
    const t = q.trim().toLowerCase()
    if (!t) return []
    return (r.students || []).filter(st => `${st.name || ''} ${st.enrollment_no || ''}`.toLowerCase().includes(t))
  }

  const docText = r => (r.document_types || []).map(t => t === 'Other' && r.other_document ? `Other: ${r.other_document}` : t).join(', ')

  const filtered = rows.filter(r => {
    if (superFilter !== 'all' && r.super_center_id !== superFilter) return false
    if (centerFilter !== 'all' && r.center_id !== centerFilter) return false
    if (!q.trim()) return true
    const hay = [
      centerLabel(centerById[r.super_center_id]), centerLabel(centerById[r.center_id]), docText(r),
      r.student_name, (r.students || []).map(st => st.enrollment_no).join(' '), r.tracking_no, r.sent_to_address, r.sent_from, r.sender_by,
    ].join(' ').toLowerCase()
    return hay.includes(q.toLowerCase())
  })

  const inputCls = 'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#933d18]/20 focus:border-[#933d18]'
  const labelCls = 'block text-[11px] font-semibold text-gray-500 mb-1'

  return (
    <div className="p-6 space-y-5">
      <PageHeader title="Courier Details" subtitle="Documents couriered to super centers and centers"
        actions={<Button variant="primary" size="md" onClick={openNew}><Plus size={15} /> Add Courier</Button>} />

      {needsSql && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <strong>Migration pending.</strong> Run <code className="font-mono text-xs bg-white px-1.5 py-0.5 rounded">add_courier_details.sql</code> in
          the Supabase SQL Editor to enable courier details.
        </div>
      )}

      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div className="flex items-end gap-3 flex-wrap">
          <SearchableSelect label="Super Center" allLabel="All Super Centers" value={superFilter}
            onChange={v => { setSuperFilter(v); setCenterFilter('all') }}
            options={superCenters.map(c => ({ id: c.id, label: centerLabel(c) }))} minWidth={220} />
          <SearchableSelect label="Center" allLabel="All Centers" value={centerFilter} onChange={setCenterFilter}
            options={centersUnder(superFilter).map(c => ({ id: c.id, label: centerLabel(c) }))} minWidth={220} />
        </div>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search student / tracking no…"
            className="pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#933d18]/30 w-72" />
        </div>
      </div>

      <p className="text-sm font-bold text-gray-700 flex items-center gap-2">
        <Truck size={16} className="text-[#933d18]" /> Couriers ({filtered.length})
      </p>

      <Table>
        <Thead>
          <Tr>
            <Th>#</Th><Th>Super Center</Th><Th>Center</Th><Th>Documents</Th><Th>Date</Th><Th>Student Name</Th>
            <Th>Tracking No</Th><Th>Sent To Address</Th><Th>From</Th><Th>Sender By</Th><Th>Receipts</Th><Th>Action</Th>
          </Tr>
        </Thead>
        <Tbody>
          {loading ? (
            <Tr><Td colSpan={12} className="text-center text-gray-400 py-8">Loading...</Td></Tr>
          ) : filtered.length === 0 ? (
            <Tr><Td colSpan={12} className="text-center text-gray-400 py-8">No courier entries yet.</Td></Tr>
          ) : filtered.map((r, i) => (
            <Tr key={r.id}>
              <Td>{i + 1}</Td>
              <Td className="text-sm">{centerById[r.super_center_id]?.center_name || '—'}</Td>
              <Td className="text-sm">{centerById[r.center_id]?.center_name || '—'}</Td>
              <Td className="text-sm">{docText(r) || '—'}</Td>
              <Td className="text-sm whitespace-nowrap">{formatDate(r.courier_date)}</Td>
              <Td className="text-sm min-w-[200px]">
                {(r.students || []).length ? (() => {
                  // One student: show them. Several: a count and the semesters,
                  // with the full list in a popup — twelve names made one row a page tall.
                  // A search for a name / enrollment no shows the students it
                  // matched, not just the courier's head-count.
                  const hits = studentHits(r)
                  const shown = hits.length ? hits : r.students
                  const sems = [...new Set(shown.map(st => semText(st.semesters)))]
                  return (
                    <div className="flex items-center gap-2">
                      <div className="space-y-1">
                        {shown.length <= 3 ? shown.map(st => (
                          <div key={st.id}>
                            <span className={`font-semibold ${hits.length ? 'text-[#933d18]' : 'text-gray-900'}`}>{st.name}</span>
                            {st.enrollment_no && <span className="text-xs text-gray-500"> ({st.enrollment_no})</span>}
                            {shown.length > 1 && <div className="text-xs text-[#933d18]">{semText(st.semesters)}</div>}
                          </div>
                        )) : <span className="font-semibold text-gray-900">{shown.length} Students</span>}
                        {(shown.length === 1 || shown.length > 3) && (
                          <div className="text-xs text-[#933d18]">{sems.length === 1 ? sems[0] : 'Mixed semesters'}</div>
                        )}
                        {hits.length > 0 && hits.length < r.students.length && (
                          <div className="text-[11px] text-gray-400">of {r.students.length} students in this courier</div>
                        )}
                      </div>
                      <button onClick={() => setViewing(r)}
                        className="ml-auto px-2 py-1 rounded-md text-xs font-semibold text-[#933d18] border border-[#933d18]/30 hover:bg-[#933d18]/5 whitespace-nowrap">
                        View
                      </button>
                    </div>
                  )
                })() : (r.student_name || '—')}
              </Td>
              <Td className="text-sm font-mono">{r.tracking_no || '—'}</Td>
              <Td className="text-sm max-w-[220px] whitespace-pre-line">{r.sent_to_address || '—'}</Td>
              <Td className="text-sm">{r.sent_from || '—'}</Td>
              <Td className="text-sm">{r.sender_by || '—'}</Td>
              <Td>
                <div className="flex flex-col gap-1">
                  {(r.receipts || []).length === 0 ? <span className="text-gray-400 text-sm">—</span> :
                    r.receipts.map((f, k) => (
                      <a key={k} href={f.url} target="_blank" rel="noreferrer"
                        className="text-xs text-[#933d18] hover:underline flex items-center gap-1 whitespace-nowrap">
                        <Paperclip size={12} /> Receipt {k + 1}
                      </a>
                    ))}
                </div>
              </Td>
              <Td>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(r)} title="Edit"
                    className="p-1.5 rounded-lg hover:bg-[#933d18]/10 text-gray-400 hover:text-[#933d18] transition-colors">
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => handleDelete(r)} title="Delete"
                    className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors">
                    <Trash2 size={15} />
                  </button>
                </div>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>

      <Modal isOpen={open} onClose={() => !busy && setOpen(false)} title={editing ? 'Edit Courier' : 'Add Courier'} size="lg">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Super Center</label>
            <select value={form.super_center_id} onChange={e => pickSuper(e.target.value)} className={`${inputCls} bg-white`}>
              <option value="">— Select —</option>
              {superCenters.map(c => <option key={c.id} value={c.id}>{centerLabel(c)}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Center</label>
            <select value={form.center_id} onChange={e => pickCenter(e.target.value)} className={`${inputCls} bg-white`}>
              <option value="">— Select —</option>
              {centersUnder(form.super_center_id).map(c => <option key={c.id} value={c.id}>{centerLabel(c)}</option>)}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className={labelCls}>Documents Type</label>
            <div className="flex flex-wrap gap-2">
              {DOC_TYPES.map(t => {
                const on = form.document_types.includes(t)
                return (
                  <button key={t} type="button" onClick={() => toggleDoc(t)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
                      on ? 'bg-[#933d18] text-white border-[#933d18]' : 'bg-white text-gray-600 border-gray-200 hover:border-[#933d18]/50'}`}>
                    {t}
                  </button>
                )
              })}
            </div>
            {form.document_types.includes('Other') && (
              <input value={form.other_document} onChange={set('other_document')} placeholder="Write the other document…"
                className={`${inputCls} mt-2`} />
            )}
          </div>

          <div>
            <label className={labelCls}>Date</label>
            <DateInput bare value={form.courier_date} onChange={set('courier_date')} />
          </div>
          <div className="sm:col-span-2">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold text-gray-500">Students & Semesters</label>
              <Button variant="outline" size="sm" onClick={openPicker}>
                <Users size={13} /> {form.students.length ? 'Change Students' : 'Select Students'}
              </Button>
            </div>
            <div className="border border-gray-200 rounded-xl min-h-[96px] max-h-64 overflow-y-auto">
              {form.students.length === 0 ? (
                <div className="px-4 py-6 text-sm text-gray-400 text-center">
                  {form.student_name
                    ? <>Earlier entry: <span className="text-gray-700">{form.student_name}</span></>
                    : form.center_id ? 'No students selected — click "Select Students".' : 'Choose a center, then select students.'}
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase tracking-wider">
                    <tr><th className="text-left px-3 py-2">#</th><th className="text-left px-3 py-2">Student Name</th>
                      <th className="text-left px-3 py-2">Enrollment No</th><th className="text-left px-3 py-2">Programme</th>
                      <th className="text-left px-3 py-2">Semesters Sent</th><th /></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {form.students.map((st, k) => (
                      <tr key={st.id}>
                        <td className="px-3 py-2 text-gray-400">{k + 1}</td>
                        <td className="px-3 py-2 font-semibold text-gray-900">{st.name}</td>
                        <td className="px-3 py-2 font-mono text-xs">{st.enrollment_no || '—'}</td>
                        <td className="px-3 py-2 text-xs text-gray-600">{st.program || '—'}</td>
                        <td className="px-3 py-2 text-xs font-semibold text-[#933d18]">{semText(st.semesters)}</td>
                        <td className="px-3 py-2 text-right">
                          <button type="button" title="Remove"
                            onClick={() => setForm(f => ({ ...f, students: f.students.filter(x => x.id !== st.id) }))}
                            className="text-gray-400 hover:text-red-500"><X size={14} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
          <div>
            <label className={labelCls}>Tracking No</label>
            <input value={form.tracking_no} onChange={set('tracking_no')} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>From</label>
            <input value={form.sent_from} onChange={set('sent_from')} className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Sent To Address</label>
            <textarea value={form.sent_to_address} onChange={set('sent_to_address')} rows={2} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Sender By</label>
            <input value={form.sender_by} onChange={set('sender_by')} className={inputCls} />
          </div>

          <div className="sm:col-span-2">
            <label className={labelCls}>Upload Receipt (multiple allowed)</label>
            <input type="file" multiple accept="image/*,.pdf,application/pdf" onChange={addFiles}
              className="text-sm text-gray-600 file:mr-3 file:px-3 file:py-2 file:border-0 file:rounded-lg file:bg-[#933d18]/10 file:text-[#933d18] file:text-xs file:font-bold file:cursor-pointer" />
            {(form.receipts.length > 0 || newFiles.length > 0) && (
              <div className="mt-2 space-y-1">
                {form.receipts.map((f, k) => (
                  <div key={`old-${k}`} className="flex items-center justify-between gap-2 text-xs bg-gray-50 rounded-lg px-3 py-1.5">
                    <a href={f.url} target="_blank" rel="noreferrer" className="text-[#933d18] hover:underline truncate flex items-center gap-1">
                      <Paperclip size={12} /> {f.name || `Receipt ${k + 1}`}
                    </a>
                    <button type="button" title="Remove"
                      onClick={() => setForm(fm => ({ ...fm, receipts: fm.receipts.filter((_, j) => j !== k) }))}
                      className="text-gray-400 hover:text-red-500"><X size={14} /></button>
                  </div>
                ))}
                {newFiles.map((f, k) => (
                  <div key={`new-${k}`} className="flex items-center justify-between gap-2 text-xs bg-amber-50 rounded-lg px-3 py-1.5">
                    <span className="truncate text-gray-700 flex items-center gap-1"><Paperclip size={12} /> {f.name} <span className="text-amber-600">(new)</span></span>
                    <button type="button" title="Remove" onClick={() => setNewFiles(fs => fs.filter((_, j) => j !== k))}
                      className="text-gray-400 hover:text-red-500"><X size={14} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} disabled={busy}>{busy ? 'Saving…' : editing ? 'Update' : 'Save'}</Button>
        </div>
      </Modal>

      <Modal isOpen={!!viewing} onClose={() => setViewing(null)} size="xl"
        title={viewing ? `Students — ${centerById[viewing.center_id]?.center_name || ''}${viewing.tracking_no ? ` · Tracking ${viewing.tracking_no}` : ''}` : ''}>
        {viewing && (
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase tracking-wider">
                <tr><th className="text-left px-3 py-2">#</th><th className="text-left px-3 py-2">Student Name</th>
                  <th className="text-left px-3 py-2">Enrollment No</th><th className="text-left px-3 py-2">Programme</th>
                  <th className="text-left px-3 py-2">Semesters Sent</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(viewing.students || []).map((st, k) => (
                  <tr key={st.id} className={studentHits(viewing).some(h => h.id === st.id) ? 'bg-amber-50' : ''}>
                    <td className="px-3 py-2 text-gray-400">{k + 1}</td>
                    <td className="px-3 py-2 font-semibold text-gray-900">{st.name}</td>
                    <td className="px-3 py-2 font-mono text-xs">{st.enrollment_no || '—'}</td>
                    <td className="px-3 py-2 text-xs text-gray-600">{st.program || '—'}</td>
                    <td className="px-3 py-2 text-xs font-semibold text-[#933d18]">{semText(st.semesters)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      <Modal isOpen={pickerOpen} onClose={() => setPickerOpen(false)} size="xl"
        title={`Select Students — ${centerLabel(centerById[form.center_id])}`}>
        {(() => {
          const list = (students || []).filter(st => !pickerQ.trim() ||
            `${st.student_name} ${st.enrollment_no || ''} ${st.registration_no || ''} ${st.programs?.program_name || ''}`
              .toLowerCase().includes(pickerQ.toLowerCase()))
          const tickedCount = Object.keys(draft).length
          return (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input autoFocus value={pickerQ} onChange={e => setPickerQ(e.target.value)} placeholder="Search name / enrollment no…"
                    className="pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#933d18]/30 w-80" />
                </div>
                <span className="text-sm text-gray-500">{tickedCount} selected</span>
              </div>

              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase tracking-wider">
                    <tr><th className="w-10 px-3 py-2" /><th className="text-left px-3 py-2">Student Name</th>
                      <th className="text-left px-3 py-2">Enrollment No</th><th className="text-left px-3 py-2">Programme</th>
                      <th className="text-left px-3 py-2">Semesters Sent</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {!students ? (
                      <tr><td colSpan={5} className="text-center text-gray-400 py-8">Loading students…</td></tr>
                    ) : list.length === 0 ? (
                      <tr><td colSpan={5} className="text-center text-gray-400 py-8">No students found.</td></tr>
                    ) : list.map(st => {
                      const on = !!draft[st.id]
                      const total = semCountOf(st)
                      return (
                        <tr key={st.id} className={on ? 'bg-[#933d18]/5' : 'hover:bg-gray-50'}>
                          <td className="px-3 py-2 align-top">
                            <input type="checkbox" checked={on} onChange={() => toggleStudent(st)}
                              className="w-4 h-4 accent-[#933d18] cursor-pointer mt-0.5" />
                          </td>
                          <td className="px-3 py-2 align-top font-semibold text-gray-900 cursor-pointer" onClick={() => toggleStudent(st)}>
                            {st.student_name}
                            <div className="text-[11px] font-normal text-gray-400">Now in {st.semester_year || '—'}</div>
                          </td>
                          <td className="px-3 py-2 align-top font-mono text-xs">{st.enrollment_no || st.registration_no || '—'}</td>
                          <td className="px-3 py-2 align-top text-xs text-gray-600">{st.programs?.program_name || '—'}</td>
                          <td className="px-3 py-2 align-top">
                            {on ? (
                              <div className="flex flex-wrap gap-1">
                                {Array.from({ length: total }, (_, k) => k + 1).map(n => {
                                  const sel = draft[st.id].includes(n)
                                  return (
                                    <button key={n} type="button" onClick={() => toggleSem(st, n)}
                                      className={`px-2 py-1 rounded-md text-xs font-semibold border transition-colors ${
                                        sel ? 'bg-[#933d18] text-white border-[#933d18]' : 'bg-white text-gray-600 border-gray-200 hover:border-[#933d18]/50'}`}>
                                      Sem {n}
                                    </button>
                                  )
                                })}
                                <button type="button" onClick={() => allSems(st)}
                                  className="px-2 py-1 rounded-md text-xs font-semibold text-[#933d18] hover:bg-[#933d18]/10">
                                  {draft[st.id].length === total ? 'None' : 'All'}
                                </button>
                              </div>
                            ) : <span className="text-xs text-gray-300">Tick the student first</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" onClick={() => setPickerOpen(false)}>Cancel</Button>
                <Button variant="primary" onClick={confirmPicker}>Done ({tickedCount})</Button>
              </div>
            </div>
          )
        })()}
      </Modal>
    </div>
  )
}
