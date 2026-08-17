import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui/Table'
import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import { SearchableSelect } from '../../components/ui/SearchSelect'
import { Search, X, Plus, Pencil, Save, ArrowLeft, Award, Layers, Eye, Download } from 'lucide-react'
import { paperKeyOf } from '../../utils/fetchSyllabus'
import { generateSchemePDF } from '../../utils/generateSyllabusPDF'

// Examination Scheme — what each paper of a course is worth.
//
// The Syllabus page decides WHICH papers a course has; this decides their
// marks. So only courses whose syllabus is done appear here at all, and their
// papers are read from the syllabus instead of being typed again.
//
// Marks are stored in scheme_papers keyed by the paper's own identity
// (paperKeyOf), not by its syllabus row id: saving the syllabus deletes and
// re-inserts every row, so anything keyed to an id would be wiped whenever a
// subject name was corrected.
const calcSemesters = (p) => (p ? Number(p.duration) || 0 : 0)
// Credit stands on its own; the other three sit under a "Maximum Marks"
// heading, the way the university writes its scheme. Total is not typed — it
// IS internal + theory, so it is computed and shown read-only. It used to be
// an ordinary field filled only when blank, which left it stale at whatever
// the first of the two entries made it.
const ENTRY_FIELDS = [
  { key: 'credits',        label: 'Credit' },
  { key: 'internal_marks', label: 'Internal' },
  { key: 'theory_marks',   label: 'Theory' },
]
const totalOf = (r) => {
  const i = Number(r.internal_marks), t = Number(r.theory_marks)
  const has = r.internal_marks !== '' || r.theory_marks !== ''
  return has ? (i || 0) + (t || 0) : ''
}

export default function Schemes() {
  const [programs, setPrograms]       = useState([])
  const [departments, setDepartments] = useState([])
  const [progTypes, setProgTypes]     = useState([])
  const [syllabusCount, setSyllabusCount] = useState({})   // program_id -> paper count
  const [schemeCount, setSchemeCount]     = useState({})   // program_id -> scheme rows
  const [loading, setLoading]         = useState(true)
  const [missingTable, setMissingTable] = useState(false)

  const [tab, setTab]       = useState('pending')   // 'all' | 'pending' | 'done'
  const [search, setSearch] = useState('')
  const [fDept, setFDept]   = useState('all')
  const [fType, setFType]   = useState('all')

  // editor
  const [active, setActive]   = useState(null)      // the program being edited
  const [activeSem, setActiveSem] = useState(1)
  const [papers, setPapers]   = useState([])        // syllabus rows + their marks
  const [editorLoading, setEditorLoading] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)

  // Per-semester View / Download modal, mirroring the Syllabus page's.
  const [semModal, setSemModal]     = useState(null)   // the course being viewed
  const [semPapers, setSemPapers]   = useState([])
  const [semLoading, setSemLoading] = useState(false)
  const [openSemView, setOpenSemView] = useState(null)

  // Runs once on mount, and `loading` already starts true — so there is
  // nothing to set before the fetch.
  async function loadAll() {
    const [pr, dp, pt, sy] = await Promise.all([
      supabase.from('programs').select('id, program_name, department_id, programme_type_id, duration, semester_year'),
      supabase.from('departments').select('id, name').order('name'),
      supabase.from('programme_types').select('id, programme_type_name').order('programme_type_name'),
      supabase.from('syllabus_subjects').select('program_id'),
    ])
    setPrograms(pr.data || [])
    setDepartments(dp.data || [])
    setProgTypes(pt.data || [])

    const sc = {}
    ;(sy.data || []).forEach(r => { sc[r.program_id] = (sc[r.program_id] || 0) + 1 })
    setSyllabusCount(sc)

    // error = add_scheme_papers.sql hasn't been run; the list still shows so
    // the admin can see which courses are waiting, with a hint at the top.
    const sp = await supabase.from('scheme_papers').select('program_id')
    if (sp.error) { setMissingTable(true); setSchemeCount({}) }
    else {
      const m = {}
      ;(sp.data || []).forEach(r => { m[r.program_id] = (m[r.program_id] || 0) + 1 })
      setSchemeCount(m)
    }
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [])

  const progMap = Object.fromEntries(programs.map(p => [p.id, p]))

  // Only courses whose SYLLABUS is done — a scheme has nothing to hang off
  // until the papers exist.
  const courses = programs.filter(p => (syllabusCount[p.id] || 0) > 0)
  const isDone = p => (schemeCount[p.id] || 0) > 0

  const base = courses.filter(p => {
    if (fDept !== 'all' && p.department_id !== fDept) return false
    if (fType !== 'all' && p.programme_type_id !== fType) return false
    const q = search.toLowerCase()
    if (q && !(p.program_name || '').toLowerCase().includes(q)) return false
    return true
  })
  const doneCount = base.filter(isDone).length
  const filtered = base.filter(p => tab === 'done' ? isDone(p) : tab === 'pending' ? !isDone(p) : true)

  const filterActive = !!search || fDept !== 'all' || fType !== 'all'
  const clearFilters = () => { setSearch(''); setFDept('all'); setFType('all') }

  async function openCourse(p) {
    setActive(p); setActiveSem(1); setSaved(false); setEditorLoading(true)
    // The syllabus is stored per course (session_id null), same as the Syllabus
    // page writes it.
    const { data: subs } = await supabase.from('syllabus_subjects')
      .select('id, semester, paper_no, subject_code, subject_name, criteria, sort_order')
      .eq('program_id', p.id).is('session_id', null)
      .order('sort_order', { ascending: true })

    const { data: marks } = await supabase.from('scheme_papers')
      .select('semester, paper_key, internal_marks, theory_marks, total_marks, credits')
      .eq('program_id', p.id).is('session_id', null)

    const byKey = {}
    ;(marks || []).forEach(m => { byKey[`${m.semester}__${m.paper_key}`] = m })

    setPapers((subs || []).map(s => {
      const m = byKey[`${s.semester}__${paperKeyOf(s)}`] || {}
      return {
        ...s,
        credits:        m.credits ?? '',
        internal_marks: m.internal_marks ?? '',
        theory_marks:   m.theory_marks ?? '',
      }
    }))
    setEditorLoading(false)
  }

  const setMark = (id, field, val) => setPapers(prev =>
    prev.map(r => (r.id === id ? { ...r, [field]: val } : r)))

  // Open the per-semester View / Download modal: the syllabus papers joined to
  // whatever the scheme says about each, so a semester with no marks set still
  // lists its papers instead of looking empty.
  async function openSemesters(p) {
    setSemModal(p); setOpenSemView(null); setSemLoading(true); setSemPapers([])
    const [subs, marks] = await Promise.all([
      supabase.from('syllabus_subjects')
        .select('semester, paper_no, subject_code, subject_name, criteria, sort_order')
        .eq('program_id', p.id).is('session_id', null)
        .order('sort_order', { ascending: true }),
      supabase.from('scheme_papers')
        .select('semester, paper_key, internal_marks, theory_marks, total_marks, credits')
        .eq('program_id', p.id).is('session_id', null),
    ])
    const byKey = Object.fromEntries((marks.data || []).map(m => [`${m.semester}__${m.paper_key}`, m]))
    setSemPapers((subs.data || []).map(s => ({ ...s, ...(byKey[`${s.semester}__${paperKeyOf(s)}`] || {}) })))
    setSemLoading(false)
  }

  const downloadSemester = (p, semNo, rows) => generateSchemePDF(
    { programName: p.program_name, session: 'All Sessions', semester: `Semester ${semNo}` },
    rows,
  )

  async function save() {
    if (!active || saving) return
    setSaving(true); setSaved(false)
    const num = v => (v === '' || v == null ? null : Number(v))
    const rows = papers
      .filter(r => ENTRY_FIELDS.some(f => r[f.key] !== '' && r[f.key] != null))
      .map(r => ({
        program_id: active.id,
        session_id: null,
        semester: Number(r.semester) || null,
        paper_key: paperKeyOf(r),
        credits:        num(r.credits),
        internal_marks: num(r.internal_marks),
        theory_marks:   num(r.theory_marks),
        total_marks:    num(totalOf(r)),
        updated_at: new Date().toISOString(),
      }))

    // Replace this course's scheme wholesale — a paper cleared in the editor
    // must lose its marks, not keep a stale row.
    const del = await supabase.from('scheme_papers').delete()
      .eq('program_id', active.id).is('session_id', null)
    if (del.error) {
      alert('Save failed (run add_scheme_papers.sql in Supabase):\n\n' + del.error.message)
      setSaving(false); return
    }
    if (rows.length) {
      const { error } = await supabase.from('scheme_papers').insert(rows)
      if (error) { alert('Save failed: ' + error.message); setSaving(false); return }
    }
    setSchemeCount(prev => ({ ...prev, [active.id]: rows.length }))
    setSaving(false); setSaved(true)
    setActive(null)
    setTab(rows.length > 0 ? 'done' : 'pending')
  }

  /* ═══════════════ EDITOR ═══════════════ */
  if (active) {
    const totalSems = calcSemesters(active) || 8
    const semsWithPapers = [...new Set(papers.map(p => Number(p.semester) || 1))].sort((a, b) => a - b)
    const semList = semsWithPapers.length ? semsWithPapers : [1]
    const visible = papers.filter(p => (Number(p.semester) || 1) === activeSem)
    const filledIn = n => papers.filter(p => (Number(p.semester) || 1) === n
      && ENTRY_FIELDS.some(f => p[f.key] !== '' && p[f.key] != null)).length

    return (
      <div className="p-6">
        <button onClick={() => setActive(null)}
          className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-[#933d18] mb-3">
          <ArrowLeft size={15} /> Back to courses
        </button>
        <PageHeader title={active.program_name}
          subtitle={`Examination scheme · ${papers.length} paper${papers.length === 1 ? '' : 's'} in the syllabus`} />

        <div className="flex items-center justify-between gap-3 flex-wrap mb-4 mt-4">
          <div className="flex flex-wrap gap-2">
            {semList.map(n => (
              <button key={n} onClick={() => setActiveSem(n)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
                  activeSem === n ? 'bg-[#933d18] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-[#933d18]'
                }`}>
                Sem {n}
                {filledIn(n) > 0 && <span className={`w-1.5 h-1.5 rounded-full ${activeSem === n ? 'bg-white' : 'bg-emerald-500'}`} />}
              </button>
            ))}
            {semList.length < totalSems && (
              <span className="px-3 py-2 text-[11px] text-gray-400">
                Only semesters with papers in the syllabus are shown
              </span>
            )}
          </div>
          <Button onClick={save} disabled={saving}>
            <Save size={14} /> {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save Scheme'}
          </Button>
        </div>

        {editorLoading ? (
          <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Loading...</div>
        ) : !visible.length ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center text-gray-400 text-sm">
            No papers in the syllabus for Semester {activeSem}.
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              {/* Internal / Theory / Total sit under one "Maximum Marks"
                  heading, the way the university writes its scheme; the
                  syllabus columns beside them span both header rows. */}
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-[11px] uppercase tracking-wider">
                  <th rowSpan={2} className="text-left font-semibold px-4 py-2.5 w-12 border-r border-gray-100">S.No</th>
                  <th rowSpan={2} className="text-left font-semibold px-4 py-2.5 w-28 border-r border-gray-100">Paper No</th>
                  <th rowSpan={2} className="text-left font-semibold px-4 py-2.5 w-32 border-r border-gray-100">Subject Code</th>
                  <th rowSpan={2} className="text-left font-semibold px-4 py-2.5 border-r border-gray-100">Subject Name</th>
                  <th rowSpan={2} className="text-left font-semibold px-4 py-2.5 w-40 border-r border-gray-100">Criteria</th>
                  <th rowSpan={2} className="text-left font-semibold px-3 py-2.5 w-24 border-r border-gray-100">Credit</th>
                  <th colSpan={3} className="text-center font-semibold px-3 py-2 border-b border-gray-100">Maximum Marks</th>
                </tr>
                <tr className="bg-gray-50 text-gray-500 text-[11px] uppercase tracking-wider">
                  <th className="text-left font-semibold px-3 py-2 w-24">Internal</th>
                  <th className="text-left font-semibold px-3 py-2 w-24">Theory</th>
                  <th className="text-left font-semibold px-3 py-2 w-24">Total</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r, i) => (
                  <tr key={r.id} className="border-t border-gray-50">
                    <td className="px-4 py-2 text-gray-400 text-xs">{i + 1}</td>
                    <td className="px-4 py-2 text-gray-600 text-xs whitespace-nowrap">{r.paper_no || '—'}</td>
                    <td className="px-4 py-2 font-mono text-xs text-gray-600">{r.subject_code || '—'}</td>
                    <td className="px-4 py-2 font-semibold text-gray-800 text-xs min-w-[200px]">{r.subject_name || '—'}</td>
                    <td className="px-4 py-2 text-gray-500 text-xs">{r.criteria || '—'}</td>
                    {ENTRY_FIELDS.map(f => (
                      <td key={f.key} className="px-3 py-2">
                        <input type="number" min="0" step="any"
                          value={r[f.key]}
                          onChange={e => setMark(r.id, f.key, e.target.value)}
                          className="w-20 px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-[#933d18] focus:ring-1 focus:ring-[#933d18]/20" />
                      </td>
                    ))}
                    {/* Internal + Theory — computed, so it can never drift. */}
                    <td className="px-3 py-2">
                      <span className="inline-block w-20 px-2 py-1.5 rounded-lg text-xs font-bold text-gray-700 bg-gray-50 border border-gray-100">
                        {totalOf(r) === '' ? '—' : totalOf(r)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[11px] text-gray-400 mt-3">
          Paper No, Subject Code, Subject Name and Criteria come from this course's syllabus and can't be edited here — change them on the Syllabus page. Total is Internal + Theory and is worked out for you.
        </p>
      </div>
    )
  }

  /* ═══════════════ LIST ═══════════════ */
  return (
    <div className="p-6">
      <PageHeader title="Schemes" subtitle="Marks for each paper — only courses whose syllabus is done" />

      {missingTable && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
          Run <code className="font-mono">add_scheme_papers.sql</code> once in Supabase → SQL Editor to start saving schemes.
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-4 items-end">
        <div className="relative max-w-sm flex-1 min-w-[220px]">
          <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">Search</label>
          <Search size={15} className="absolute left-3 top-[34px] -translate-y-1/2 text-gray-400" />
          <input
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#933d18] focus:ring-2 focus:ring-[#933d18]/15 bg-white"
            placeholder="Search by course..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <SearchableSelect label="Department" allLabel="All Departments" minWidth={180}
          value={fDept} onChange={setFDept} options={departments.map(d => ({ id: d.id, label: d.name }))} />
        <SearchableSelect label="Program Type" allLabel="All Types" minWidth={150}
          value={fType} onChange={setFType} options={progTypes.map(t => ({ id: t.id, label: t.programme_type_name }))} />
        {/* No Session filter: a scheme belongs to the COURSE (session_id null),
            exactly as its syllabus does, so filtering by session would be a
            control that never changes the list. */}
        {filterActive && (
          <button onClick={clearFilters}
            className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-semibold text-[#933d18] bg-[#933d18]/8 hover:bg-[#933d18]/15 rounded-xl transition-colors">
            <X size={14} /> Clear
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-4">
        {[
          { key: 'pending', label: 'Pending', count: base.length - doneCount, on: 'bg-amber-500 text-white', off: 'bg-amber-50 text-amber-700' },
          { key: 'done',    label: 'Done',    count: doneCount,               on: 'bg-emerald-500 text-white', off: 'bg-emerald-50 text-emerald-700' },
          { key: 'all',     label: 'All',     count: base.length,             on: 'bg-gray-700 text-white',    off: 'bg-gray-100 text-gray-600' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${tab === t.key ? t.on : t.off}`}>
            {t.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === t.key ? 'bg-white/25' : 'bg-white/70'}`}>{t.count}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Loading...</div>
      ) : !courses.length ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-300">
          <Award size={52} className="mb-3" />
          <p className="text-base font-semibold text-gray-400">No course has its syllabus done yet</p>
          <p className="text-xs text-gray-400 mt-1">Add papers on the Syllabus page first — a scheme sets the marks for those papers.</p>
        </div>
      ) : (
        <Table>
          <Thead>
            <tr>
              <Th>#</Th>
              <Th>Program</Th>
              <Th>Papers</Th>
              <Th>Scheme</Th>
              <Th>Action</Th>
            </tr>
          </Thead>
          <Tbody>
            {filtered.length === 0 ? (
              <Tr><Td colSpan={5} className="text-center text-gray-400 py-12">
                {tab === 'pending' ? 'Every course here has its scheme set. 🎉' : 'Nothing to show'}
              </Td></Tr>
            ) : filtered.map((p, i) => (
              <Tr key={p.id}>
                <Td className="text-gray-400 text-xs w-10">{i + 1}</Td>
                <Td>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900">{p.program_name}</p>
                    {!isDone(p) && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700">Pending</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{progMap[p.id]?.duration ? `${progMap[p.id].duration} Sem` : ''}</p>
                </Td>
                <Td className="text-gray-500 text-xs">{syllabusCount[p.id] || 0}</Td>
                <Td className="text-gray-500 text-xs">{schemeCount[p.id] || 0}</Td>
                <Td>
                  <div className="flex items-center gap-1.5">
                    {/* Icon follows the label, same as the Syllabus list. */}
                    <Button size="sm" variant={isDone(p) ? 'secondary' : 'primary'} onClick={() => openCourse(p)}>
                      {isDone(p) ? <><Pencil size={13} /> Edit Scheme</> : <><Plus size={13} /> Add Scheme</>}
                    </Button>
                    <button onClick={() => openSemesters(p)} title="View / download each semester"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors">
                      <Layers size={13} /> Semesters
                    </button>
                  </div>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      {/* ── Per-semester View / Download modal ── */}
      {semModal && (
        <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/40 p-4 pt-10" onClick={() => setSemModal(null)}>
          <div className="w-full max-w-5xl bg-white rounded-2xl shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
              <div className="min-w-0">
                <h3 className="font-bold text-gray-800 flex items-center gap-2 truncate">
                  <Layers size={16} className="text-[#933d18] shrink-0" /> {semModal.program_name}
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">Examination scheme · {calcSemesters(semModal) || 0} Semesters</p>
              </div>
              <button onClick={() => setSemModal(null)} className="text-gray-400 hover:text-gray-700 shrink-0"><X size={18} /></button>
            </div>
            <div className="max-h-[82vh] overflow-y-auto p-4">
              {semLoading ? (
                <div className="py-12 text-center text-sm text-gray-400">Loading...</div>
              ) : (
                Array.from({ length: calcSemesters(semModal) || 0 }, (_, n) => n + 1).map(semNo => {
                  const rows = semPapers.filter(r => Number(r.semester) === semNo)
                  const withMarks = rows.filter(r => r.total_marks != null && r.total_marks !== '').length
                  const expanded = openSemView === semNo
                  return (
                    <div key={semNo} className="mb-2 border border-gray-100 rounded-xl overflow-hidden">
                      <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-gray-50/70">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-800 text-sm">Semester {semNo}</span>
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${withMarks ? 'bg-emerald-50 text-emerald-700' : rows.length ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-400'}`}>
                            {!rows.length ? 'No papers' : withMarks ? `${withMarks} of ${rows.length} set` : 'Scheme not set'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => setOpenSemView(expanded ? null : semNo)} disabled={!rows.length}
                            title="View this semester's scheme"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                            <Eye size={12} /> View
                          </button>
                          <button onClick={() => downloadSemester(semModal, semNo, rows)} disabled={!rows.length}
                            title="Download this semester's scheme as a PDF"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#933d18] bg-[#933d18]/8 hover:bg-[#933d18]/15 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                            <Download size={12} /> Download
                          </button>
                        </div>
                      </div>
                      {expanded && rows.length > 0 && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-white border-b border-gray-100 text-gray-400">
                                <th rowSpan={2} className="text-left font-semibold px-4 py-2 w-10">#</th>
                                <th rowSpan={2} className="text-left font-semibold px-3 py-2">Paper</th>
                                <th rowSpan={2} className="text-left font-semibold px-3 py-2">Code</th>
                                <th rowSpan={2} className="text-left font-semibold px-3 py-2">Subject Name</th>
                                <th rowSpan={2} className="text-left font-semibold px-3 py-2">Criteria</th>
                                <th rowSpan={2} className="text-center font-semibold px-3 py-2">Credit</th>
                                <th colSpan={3} className="text-center font-semibold px-3 py-1.5 border-b border-gray-100">Maximum Marks</th>
                              </tr>
                              <tr className="bg-white border-b border-gray-100 text-gray-400">
                                <th className="text-center font-semibold px-3 py-1.5">Internal</th>
                                <th className="text-center font-semibold px-3 py-1.5">Theory</th>
                                <th className="text-center font-semibold px-3 py-1.5">Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map((r, i) => (
                                <tr key={i} className={`border-b border-gray-50 ${i % 2 ? 'bg-gray-50/40' : ''}`}>
                                  <td className="px-4 py-2 text-gray-400">{i + 1}</td>
                                  <td className="px-3 py-2 text-gray-700">{r.paper_no || '—'}</td>
                                  <td className="px-3 py-2 text-gray-500 font-mono">{r.subject_code || '—'}</td>
                                  <td className="px-3 py-2 font-semibold text-gray-900">{r.subject_name || '—'}</td>
                                  <td className="px-3 py-2 text-gray-500">{r.criteria || '—'}</td>
                                  <td className="px-3 py-2 text-center text-gray-700">{r.credits ?? '—'}</td>
                                  <td className="px-3 py-2 text-center text-gray-700">{r.internal_marks ?? '—'}</td>
                                  <td className="px-3 py-2 text-center text-gray-700">{r.theory_marks ?? '—'}</td>
                                  <td className="px-3 py-2 text-center font-bold text-gray-800">{r.total_marks ?? '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
