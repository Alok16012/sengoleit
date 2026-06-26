import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import { Plus, Trash2, Save, ScrollText, Search, X, ChevronLeft, ChevronRight, BookOpen, Upload, FileText, Eye, ChevronDown, Check } from 'lucide-react'

let _k = 0
const uid = () => ++_k

/* Semester count derived from the program (matches Programs page SEM/YEAR). */
const calcSemesters = (p) => {
  if (!p) return 0
  if (!p.duration) return 0
  if (p.semester_year === 'Year') return p.duration * 2
  return p.duration   // 'Semester' or default
}

/* Searchable single-select dropdown. value 'all' = show everything. */
function SearchableSelect({ label, allLabel, value, onChange, options, minWidth = 170 }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setQ('') } }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const selected = options.find(o => o.id === value)
  const text = value === 'all' ? allLabel : (selected?.label || allLabel)
  const filtered = options.filter(o => o.label.toLowerCase().includes(q.toLowerCase()))

  function pick(id) { onChange(id); setOpen(false); setQ('') }

  return (
    <div ref={ref} className="relative" style={{ minWidth }}>
      <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">{label}</label>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#933d18]/20">
        <span className="truncate">{text}</span>
        <ChevronDown size={15} className={`shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          <div className="relative p-2 border-b border-gray-100">
            <Search size={13} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search..."
              className="w-full pl-7 pr-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#933d18]" />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            <button type="button" onClick={() => pick('all')}
              className={`w-full flex items-center justify-between text-left px-3 py-2 text-sm hover:bg-gray-50 ${value === 'all' ? 'text-[#933d18] font-semibold' : 'text-gray-700'}`}>
              {allLabel} {value === 'all' && <Check size={14} />}
            </button>
            {filtered.map(o => (
              <button key={o.id} type="button" onClick={() => pick(o.id)}
                className={`w-full flex items-center justify-between text-left px-3 py-2 text-sm hover:bg-gray-50 ${value === o.id ? 'text-[#933d18] font-semibold' : 'text-gray-700'}`}>
                <span className="truncate">{o.label}</span> {value === o.id && <Check size={14} className="shrink-0" />}
              </button>
            ))}
            {filtered.length === 0 && <div className="px-3 py-3 text-xs text-gray-400 text-center">No matches</div>}
          </div>
        </div>
      )}
    </div>
  )
}

/* Searchable multi-select dropdown. Empty array = all. */
function MultiSearchSelect({ label, allLabel, values, onChange, options, minWidth = 170 }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setQ('') } }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const filtered = options.filter(o => o.label.toLowerCase().includes(q.toLowerCase()))
  const text = values.length === 0
    ? allLabel
    : values.length === 1
      ? (options.find(o => o.id === values[0])?.label || `${values.length} selected`)
      : `${values.length} selected`

  function toggle(id) {
    onChange(values.includes(id) ? values.filter(v => v !== id) : [...values, id])
  }

  return (
    <div ref={ref} className="relative" style={{ minWidth }}>
      <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">{label}</label>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#933d18]/20">
        <span className="truncate">{text}</span>
        <ChevronDown size={15} className={`shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          <div className="relative p-2 border-b border-gray-100">
            <Search size={13} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search..."
              className="w-full pl-7 pr-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#933d18]" />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            <button type="button" onClick={() => onChange([])}
              className={`w-full flex items-center justify-between text-left px-3 py-2 text-sm hover:bg-gray-50 ${values.length === 0 ? 'text-[#933d18] font-semibold' : 'text-gray-700'}`}>
              {allLabel} {values.length === 0 && <Check size={14} />}
            </button>
            {filtered.map(o => {
              const on = values.includes(o.id)
              return (
                <button key={o.id} type="button" onClick={() => toggle(o.id)}
                  className={`w-full flex items-center gap-2 text-left px-3 py-2 text-sm hover:bg-gray-50 ${on ? 'text-[#933d18] font-semibold' : 'text-gray-700'}`}>
                  <span className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center ${on ? 'bg-[#933d18] border-[#933d18]' : 'border-gray-300'}`}>
                    {on && <Check size={11} className="text-white" />}
                  </span>
                  <span className="truncate">{o.label}</span>
                </button>
              )
            })}
            {filtered.length === 0 && <div className="px-3 py-3 text-xs text-gray-400 text-center">No matches</div>}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Syllabus() {
  const [structs, setStructs]         = useState([])   // fee_structures master
  const [programs, setPrograms]       = useState([])
  const [departments, setDepartments] = useState([])
  const [progTypes, setProgTypes]     = useState([])
  const [sessions, setSessions]       = useState([])
  const [approvedIds, setApprovedIds] = useState(new Set()) // fee_structure_ids approved for ≥1 center
  const [counts, setCounts]           = useState({})   // fee_structure_id -> subject count
  const [loading, setLoading]         = useState(true)

  // filters
  const [search, setSearch] = useState('')
  const [fDept, setFDept]   = useState('all')
  const [fType, setFType]   = useState('all')
  const [fSession, setFSession] = useState([])   // multi-select; [] = all

  // add-course picker modal
  const [picker, setPicker]   = useState(false)
  const [pickQ, setPickQ]     = useState('')
  const [mDept, setMDept]     = useState('all')
  const [mType, setMType]     = useState('all')
  const [mSession, setMSession] = useState('all')

  // editor
  const [active, setActive]   = useState(null)   // selected fee_structure (course)
  const [rows, setRows]       = useState([])
  const [editorLoading, setEditorLoading] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [uploadingKey, setUploadingKey] = useState(null)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [fs, pr, dp, pt, se, cc, sy] = await Promise.all([
      supabase.from('fee_structures').select('id, total_semesters, program_id, session_id, programs(program_name), academic_sessions(session_name)').order('created_at', { ascending: false }),
      supabase.from('programs').select('id, department_id, programme_type_id, duration, semester_year'),
      supabase.from('departments').select('id, name').order('name'),
      supabase.from('programme_types').select('id, programme_type_name').order('programme_type_name'),
      supabase.from('academic_sessions').select('id, session_name').order('session_name', { ascending: false }),
      supabase.from('center_courses').select('fee_structure_id, status').eq('status', 'approved'),
      supabase.from('syllabus_subjects').select('program_id, session_id'),
    ])
    setStructs(fs.data || [])
    setPrograms(pr.data || [])
    setDepartments(dp.data || [])
    setProgTypes(pt.data || [])
    setSessions(se.data || [])
    setApprovedIds(new Set((cc.data || []).map(r => r.fee_structure_id)))
    // count subjects per program+session key
    const m = {}
    ;(sy.data || []).forEach(r => {
      const key = `${r.program_id}__${r.session_id || 'null'}`
      m[key] = (m[key] || 0) + 1
    })
    setCounts(m)
    setLoading(false)
  }

  const progMap = Object.fromEntries(programs.map(p => [p.id, p]))
  const keyOf = s => `${s.program_id}__${s.session_id || 'null'}`

  // Only approved courses appear in the syllabus list.
  const approvedCourses = structs.filter(s => approvedIds.has(s.id))

  const filtered = approvedCourses.filter(s => {
    const prog = progMap[s.program_id]
    if (fDept !== 'all' && prog?.department_id !== fDept) return false
    if (fType !== 'all' && prog?.programme_type_id !== fType) return false
    // session_id === null means the course applies to ALL sessions, so always show it
    if (fSession.length > 0 && s.session_id && !fSession.includes(s.session_id)) return false
    const q = search.toLowerCase()
    if (q && !(
      (s.programs?.program_name || '').toLowerCase().includes(q) ||
      (s.academic_sessions?.session_name || '').toLowerCase().includes(q)
    )) return false
    return true
  })

  const filterActive = !!search || fDept !== 'all' || fType !== 'all' || fSession.length > 0
  const clearFilters = () => { setSearch(''); setFDept('all'); setFType('all'); setFSession([]) }

  async function openCourse(s) {
    setActive(s); setSaved(false); setEditorLoading(true)
    let q = supabase.from('syllabus_subjects')
      .select('id, semester, paper_no, subject_code, subject_name, pdf_url, sort_order')
      .eq('program_id', s.program_id)
    q = s.session_id ? q.eq('session_id', s.session_id) : q.is('session_id', null)
    const { data } = await q.order('sort_order', { ascending: true })
    const loaded = (data || []).map(r => ({ ...r, _key: uid() }))
    setRows(loaded.length ? loaded : [blankRow()])
    setEditorLoading(false)
  }

  function blankRow() {
    return { _key: uid(), semester: 1, paper_no: '', subject_code: '', subject_name: '', pdf_url: '' }
  }

  const addRow = () => setRows(p => [...p, blankRow()])
  const updRow = (key, field, val) => setRows(p => p.map(r => r._key === key ? { ...r, [field]: val } : r))
  const delRow = (key) => setRows(p => p.filter(r => r._key !== key))

  async function uploadPdf(key, file) {
    if (!file) return
    setUploadingKey(key)
    const ext = (file.name.split('.').pop() || 'pdf').toLowerCase()
    const path = `syllabus/${active.program_id}_${active.session_id || 'all'}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`
    const { error } = await supabase.storage.from('documents').upload(path, file, { upsert: true })
    if (error) { alert('Upload failed: ' + error.message); setUploadingKey(null); return }
    const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path)
    updRow(key, 'pdf_url', publicUrl)
    setUploadingKey(null)
  }

  async function handleSave() {
    if (!active) return
    setSaving(true); setSaved(false)
    const pid = active.program_id
    const sid = active.session_id || null

    // Wipe existing rows for this course, then re-insert the current set.
    let dq = supabase.from('syllabus_subjects').delete().eq('program_id', pid)
    dq = sid ? dq.eq('session_id', sid) : dq.is('session_id', null)
    await dq

    const valid = rows.filter(r => (r.subject_name || '').trim() || (r.subject_code || '').trim() || (r.paper_no || '').trim())
    if (valid.length) {
      const { error } = await supabase.from('syllabus_subjects').insert(
        valid.map((r, idx) => ({
          program_id: pid,
          session_id: sid,
          semester: parseInt(r.semester, 10) || null,
          paper_no: (r.paper_no || '').trim() || null,
          subject_code: (r.subject_code || '').trim() || null,
          subject_name: (r.subject_name || '').trim() || null,
          pdf_url: (r.pdf_url || '').trim() || null,
          sort_order: idx,
        }))
      )
      if (error) { alert('Save failed: ' + error.message); setSaving(false); return }
    }
    // refresh count for this course
    setCounts(prev => ({ ...prev, [keyOf(active)]: valid.length }))
    setSaving(false); setSaved(true)
  }

  const totalSems = (active ? calcSemesters(progMap[active.program_id]) : 0) || active?.total_semesters || 8

  /* ═══════════════ EDITOR VIEW ═══════════════ */
  if (active) {
    return (
      <div className="p-6">
        <button onClick={() => setActive(null)}
          className="inline-flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-[#933d18] mb-3 transition-colors">
          <ChevronLeft size={16} /> Back to courses
        </button>

        <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
            <div className="flex items-center gap-2 text-gray-800 font-bold text-base">
              <BookOpen size={17} className="text-[#933d18]" /> {active.programs?.program_name || '—'}
            </div>
            <span className="text-gray-500 text-xs">{active.academic_sessions?.session_name || 'All Sessions'}</span>
            <span className="bg-gray-100 text-gray-700 font-bold text-xs px-2.5 py-1 rounded-full">{totalSems} Sem</span>
          </div>
        </div>

        {editorLoading ? (
          <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Loading...</div>
        ) : (
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <h3 className="font-bold text-gray-800">Subjects / Papers</h3>
              <Button onClick={handleSave} disabled={saving}>
                <Save size={14} /> {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save Syllabus'}
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#933d18]">
                    <th className="text-left text-white font-semibold px-4 py-3 w-12">S.No</th>
                    <th className="text-left text-white font-semibold px-4 py-3 w-32">Sem</th>
                    <th className="text-left text-white font-semibold px-4 py-3 w-32">Paper No</th>
                    <th className="text-left text-white font-semibold px-4 py-3 w-40">Subject Code</th>
                    <th className="text-left text-white font-semibold px-4 py-3">Subject Name</th>
                    <th className="text-center text-white font-semibold px-4 py-3 w-44">Detail PDF</th>
                    <th className="text-center text-white font-semibold px-4 py-3 w-20">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r._key} className={`border-b border-gray-50 ${i % 2 ? 'bg-gray-50/50' : ''}`}>
                      <td className="px-4 py-2 text-gray-400 text-xs">{i + 1}</td>
                      <td className="px-4 py-2">
                        <select value={r.semester || ''} onChange={e => updRow(r._key, 'semester', e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-[#933d18] bg-white">
                          {Array.from({ length: totalSems }, (_, n) => (
                            <option key={n + 1} value={n + 1}>Sem {n + 1}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <input value={r.paper_no || ''} onChange={e => updRow(r._key, 'paper_no', e.target.value)}
                          placeholder="e.g. I"
                          className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-[#933d18]" />
                      </td>
                      <td className="px-4 py-2">
                        <input value={r.subject_code || ''} onChange={e => updRow(r._key, 'subject_code', e.target.value)}
                          placeholder="e.g. ANI-101"
                          className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-[#933d18]" />
                      </td>
                      <td className="px-4 py-2">
                        <input value={r.subject_name || ''} onChange={e => updRow(r._key, 'subject_name', e.target.value)}
                          placeholder="Subject name"
                          className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-[#933d18]" />
                      </td>
                      <td className="px-4 py-2">
                        {r.pdf_url ? (
                          <div className="flex items-center gap-1.5">
                            <a href={r.pdf_url} target="_blank" rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-1.5 rounded-lg transition-colors">
                              <Eye size={12} /> View
                            </a>
                            <label className="inline-flex items-center gap-1 text-xs font-semibold text-[#933d18] bg-[#933d18]/8 hover:bg-[#933d18]/15 px-2 py-1.5 rounded-lg cursor-pointer transition-colors">
                              <Upload size={12} /> {uploadingKey === r._key ? '...' : 'Replace'}
                              <input type="file" accept="application/pdf,image/*" className="hidden"
                                onChange={e => { uploadPdf(r._key, e.target.files?.[0]); e.target.value = '' }} />
                            </label>
                            <button onClick={() => updRow(r._key, 'pdf_url', '')} title="Remove PDF"
                              className="text-red-300 hover:text-red-500"><X size={14} /></button>
                          </div>
                        ) : (
                          <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 border border-dashed border-gray-300 hover:border-[#933d18] hover:text-[#933d18] px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors">
                            <FileText size={13} /> {uploadingKey === r._key ? 'Uploading...' : 'Upload PDF'}
                            <input type="file" accept="application/pdf,image/*" className="hidden"
                              onChange={e => { uploadPdf(r._key, e.target.files?.[0]); e.target.value = '' }} />
                          </label>
                        )}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <button onClick={() => delRow(r._key)} title="Delete subject"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg transition-colors">
                          <Trash2 size={13} /> Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-3 border-t border-gray-100">
              <button onClick={addRow}
                className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold border border-dashed border-[#933d18]/30 text-[#933d18] rounded-lg hover:bg-[#933d18]/5 transition-colors">
                <Plus size={13} /> Add Subject
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  /* ═══════════════ COURSE LIST VIEW ═══════════════ */
  return (
    <div className="p-6">
      <PageHeader title="Syllabus" subtitle="Add subjects/papers for approved courses — used in the Admit Card" />

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <div className="relative flex-1 max-w-sm min-w-[200px]">
          <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">Search</label>
          <Search size={14} className="absolute left-3 top-[34px] -translate-y-1/2 text-gray-400" />
          <input
            className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:border-[#933d18] focus:ring-2 focus:ring-[#933d18]/10"
            placeholder="Search by program or session..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <SearchableSelect
          label="Department" allLabel="All Departments" minWidth={180}
          value={fDept} onChange={setFDept}
          options={departments.map(d => ({ id: d.id, label: d.name }))} />
        <SearchableSelect
          label="Program Type" allLabel="All Types" minWidth={160}
          value={fType} onChange={setFType}
          options={progTypes.map(t => ({ id: t.id, label: t.programme_type_name }))} />
        <MultiSearchSelect
          label="Session" allLabel="All Sessions" minWidth={160}
          values={fSession} onChange={setFSession}
          options={sessions.map(s => ({ id: s.id, label: s.session_name }))} />
        {filterActive && (
          <button onClick={clearFilters}
            className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-semibold text-[#933d18] bg-[#933d18]/8 hover:bg-[#933d18]/15 rounded-xl transition-colors">
            <X size={14} /> Clear
          </button>
        )}
        <button onClick={() => { setPicker(true); setPickQ(''); setMDept('all'); setMType('all'); setMSession('all') }}
          className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold text-white bg-[#933d18] hover:bg-[#7a3215] rounded-xl transition-colors ml-auto">
          <Plus size={15} /> Add
        </button>
      </div>

      {picker && (
        <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/40 p-4 pt-20" onClick={() => setPicker(false)}>
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
              <h3 className="font-bold text-gray-800 flex items-center gap-2"><Plus size={16} className="text-[#933d18]" /> Add Syllabus — pick a course</h3>
              <button onClick={() => setPicker(false)} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
            </div>
            <div className="p-4 border-b border-gray-100 bg-gray-50/60">
              <div className="relative mb-3">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input autoFocus value={pickQ} onChange={e => setPickQ(e.target.value)} placeholder="Search by program or session..."
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:border-[#933d18]" />
              </div>
              <div className="flex flex-wrap gap-3">
                <SearchableSelect label="Department" allLabel="All Departments" minWidth={180}
                  value={mDept} onChange={setMDept}
                  options={departments.map(d => ({ id: d.id, label: d.name }))} />
                <SearchableSelect label="Program Type" allLabel="All Types" minWidth={150}
                  value={mType} onChange={setMType}
                  options={progTypes.map(t => ({ id: t.id, label: t.programme_type_name }))} />
                <SearchableSelect label="Session" allLabel="All Sessions" minWidth={150}
                  value={mSession} onChange={setMSession}
                  options={sessions.map(s => ({ id: s.id, label: s.session_name }))} />
              </div>
            </div>
            <div className="max-h-72 overflow-y-auto p-2">
              {(() => {
                const q = pickQ.toLowerCase()
                const list = approvedCourses.filter(s => {
                  const prog = progMap[s.program_id]
                  if (mDept !== 'all' && prog?.department_id !== mDept) return false
                  if (mType !== 'all' && prog?.programme_type_id !== mType) return false
                  if (mSession !== 'all' && s.session_id && s.session_id !== mSession) return false
                  if (q && !(
                    (s.programs?.program_name || '').toLowerCase().includes(q) ||
                    (s.academic_sessions?.session_name || '').toLowerCase().includes(q)
                  )) return false
                  return true
                })
                if (approvedCourses.length === 0) return <div className="px-3 py-8 text-center text-sm text-gray-400">No approved courses yet. Approve courses in Fee Management → Center Courses first.</div>
                if (list.length === 0) return <div className="px-3 py-8 text-center text-sm text-gray-400">No courses match.</div>
                return list.map(s => {
                  const cnt = counts[keyOf(s)] || 0
                  return (
                    <button key={s.id} onClick={() => { setPicker(false); openCourse(s) }}
                      className="w-full flex items-center justify-between gap-3 text-left px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 text-sm truncate">{s.programs?.program_name || '—'}</p>
                        <p className="text-xs text-gray-400">{s.academic_sessions?.session_name || 'All Sessions'} · {s.total_semesters} Sem</p>
                      </div>
                      <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${cnt > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                        {cnt > 0 ? `${cnt} subjects` : 'New'}
                      </span>
                    </button>
                  )
                })
              })()}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Loading...</div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#933d18]">
                <th className="text-left text-white font-semibold px-4 py-3">#</th>
                <th className="text-left text-white font-semibold px-4 py-3">Program</th>
                <th className="text-left text-white font-semibold px-4 py-3">Session</th>
                <th className="text-center text-white font-semibold px-4 py-3">Semesters</th>
                <th className="text-center text-white font-semibold px-4 py-3">Subjects</th>
                <th className="text-center text-white font-semibold px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center text-gray-400 py-12">
                  {approvedCourses.length === 0
                    ? 'No approved courses yet. Approve courses in Fee Management → Center Courses first.'
                    : 'No courses match these filters.'}
                </td></tr>
              ) : filtered.map((s, i) => {
                const cnt = counts[keyOf(s)] || 0
                return (
                  <tr key={s.id} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${i % 2 ? 'bg-gray-50/50' : ''}`}>
                    <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{s.programs?.program_name || '—'}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{s.academic_sessions?.session_name || 'All Sessions'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="bg-gray-100 text-gray-700 font-bold text-xs px-2.5 py-1 rounded-full">{s.total_semesters} Sem</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {cnt > 0
                        ? <span className="bg-emerald-50 text-emerald-700 font-bold text-xs px-2.5 py-1 rounded-full">{cnt}</span>
                        : <span className="text-gray-300 text-xs">0</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => openCourse(s)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#933d18] bg-[#933d18]/8 hover:bg-[#933d18]/15 px-3 py-1.5 rounded-lg transition-colors">
                        {cnt > 0 ? 'Edit Syllabus' : 'Add Syllabus'} <ChevronRight size={13} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
