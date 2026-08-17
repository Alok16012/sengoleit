import { useEffect, useState, Fragment } from 'react'
import { supabase } from '../lib/supabase'
import Button from './ui/Button'
import { SearchableSelect } from './ui/SearchSelect'
import { Save, Users, Search } from 'lucide-react'
import { paperKeyOf } from '../utils/fetchSyllabus'
import { savePaperMarks } from '../utils/paperMarks'

// Master entry — one course, one semester, every student's marks on one sheet.
//
// Entering marks student by student means opening a modal per student; a
// semester's papers are the same for all of them, so they belong in one grid:
// students down, papers across, theory and internal under each.
//
// Maximums and credits come from the course's scheme, so a paper the scheme
// has not set yet still accepts marks — it just prints without a maximum.
export default function MasterMarksEntry({ students, programs }) {
  const [programId, setProgramId] = useState('')
  const [semester, setSemester]   = useState(1)
  const [papers, setPapers]       = useState([])
  const [marks, setMarks]         = useState({})    // `${studentId}__${paperKey}` -> { theory, internal }
  const [loading, setLoading]     = useState(false)
  const [saving, setSaving]       = useState(false)
  const [savedAt, setSavedAt]     = useState(null)
  const [search, setSearch]       = useState('')

  // Only courses that actually have students forwarded for examination — the
  // rest would open onto an empty sheet.
  const courseIds = [...new Set(students.map(s => s.programme_id).filter(Boolean))]
  const courses = programs.filter(p => courseIds.includes(p.id))
  const program = programs.find(p => p.id === programId)
  const totalSems = Number(program?.duration) || 0

  const roll = students
    .filter(s => s.programme_id === programId)
    .filter(s => {
      const q = search.trim().toLowerCase()
      if (!q) return true
      return `${s.student_name} ${s.enrollment_no} ${s.registration_no}`.toLowerCase().includes(q)
    })

  useEffect(() => {
    if (!programId || !semester) { setPapers([]); setMarks({}); return }
    let alive = true
    setLoading(true); setSavedAt(null)
    async function load() {
      const ids = students.filter(s => s.programme_id === programId).map(s => s.id)
      const [subs, scheme, got] = await Promise.all([
        supabase.from('syllabus_subjects')
          .select('paper_no, subject_code, subject_name, sort_order')
          .eq('program_id', programId).is('session_id', null).eq('semester', semester)
          .order('sort_order', { ascending: true }),
        supabase.from('scheme_papers')
          .select('paper_key, internal_marks, theory_marks, total_marks')
          .eq('program_id', programId).is('session_id', null).eq('semester', semester),
        ids.length
          ? supabase.from('student_paper_marks')
              .select('student_id, paper_key, theory_obtained, internal_obtained')
              .in('student_id', ids).eq('semester', semester)
          : Promise.resolve({ data: [] }),
      ])
      if (!alive) return
      const bySchemeKey = Object.fromEntries((scheme.data || []).map(r => [r.paper_key, r]))
      setPapers((subs.data || []).map(s => {
        const key = paperKeyOf(s)
        return { ...s, paper_key: key, ...(bySchemeKey[key] || {}) }
      }))
      const m = {}
      ;(got.data || []).forEach(r => {
        m[`${r.student_id}__${r.paper_key}`] = {
          theory: r.theory_obtained ?? '',
          internal: r.internal_obtained ?? '',
        }
      })
      setMarks(m)
      setLoading(false)
    }
    load()
    return () => { alive = false }
  }, [programId, semester, students])

  const cellOf = (sid, key) => marks[`${sid}__${key}`] || { theory: '', internal: '' }
  const setCell = (sid, key, field, val) => setMarks(prev => ({
    ...prev,
    [`${sid}__${key}`]: { ...(prev[`${sid}__${key}`] || { theory: '', internal: '' }), [field]: val },
  }))

  // Total for one student across the semester's papers — the figure that goes
  // on their semester result row.
  const totalsFor = (sid) => papers.reduce((acc, p) => {
    const c = cellOf(sid, p.paper_key)
    const entered = c.theory !== '' || c.internal !== ''
    return {
      got: acc.got + (entered ? (Number(c.theory) || 0) + (Number(c.internal) || 0) : 0),
      max: acc.max + (entered ? (Number(p.total_marks) || 0) : 0),
      any: acc.any || entered,
    }
  }, { got: 0, max: 0, any: false })

  async function saveAll() {
    if (!programId || saving) return
    setSaving(true)
    const targets = students.filter(s => s.programme_id === programId)
    for (const s of targets) {
      const rows = papers.map(p => ({
        paper_key: p.paper_key,
        theory_obtained: cellOf(s.id, p.paper_key).theory,
        internal_obtained: cellOf(s.id, p.paper_key).internal,
      }))
      // Save every student on the sheet, including one whose marks were
      // cleared — savePaperMarks removes blanks, so clearing works too.
      const { error } = await savePaperMarks(s.id, semester, rows)
      if (error) {
        setSaving(false)
        alert(`Could not save ${s.student_name}'s marks (run add_student_paper_marks.sql in Supabase):\n\n${error.message}`)
        return
      }
    }
    setSaving(false)
    setSavedAt(new Date())
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-4 items-end">
        <SearchableSelect label="Course" allLabel="Select a course" minWidth={260}
          value={programId || 'all'}
          onChange={v => { setProgramId(v === 'all' ? '' : v); setSemester(1) }}
          options={courses.map(p => ({ id: p.id, label: p.program_name }))} />
        {programId && totalSems > 0 && (
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">Semester</label>
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: totalSems }, (_, i) => i + 1).map(n => (
                <button key={n} onClick={() => setSemester(n)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                    semester === n ? 'bg-[#933d18] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-[#933d18]'
                  }`}>Sem {n}</button>
              ))}
            </div>
          </div>
        )}
        {programId && (
          <div className="relative">
            <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">Search</label>
            <Search size={15} className="absolute left-3 top-[34px] -translate-y-1/2 text-gray-400" />
            <input className="pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm w-56 focus:outline-none focus:border-[#933d18] bg-white"
              placeholder="Student name / enrollment" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        )}
        <div className="ml-auto flex items-center gap-3">
          {savedAt && <span className="text-xs font-semibold text-emerald-600">✓ Saved</span>}
          {programId && papers.length > 0 && (
            <Button onClick={saveAll} disabled={saving}>
              <Save size={14} /> {saving ? 'Saving…' : 'Save All Marks'}
            </Button>
          )}
        </div>
      </div>

      {!programId ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-300">
          <Users size={52} className="mb-3" />
          <p className="text-base font-semibold text-gray-400">Pick a course to enter its marks</p>
          <p className="text-xs text-gray-400 mt-1">Every student of that course appears on one sheet, semester by semester.</p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Loading…</div>
      ) : !papers.length ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center text-gray-400 text-sm">
          No papers in the syllabus for Semester {semester} of this course.
        </div>
      ) : !roll.length ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center text-gray-400 text-sm">
          No students of this course are forwarded for examination{search ? ' matching that search' : ''}.
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="text-xs">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-[10px] uppercase tracking-wider">
                  <th rowSpan={2} className="text-left font-semibold px-3 py-2 sticky left-0 bg-gray-50 min-w-[190px] border-r border-gray-200">Student</th>
                  {papers.map(p => (
                    <th key={p.paper_key} colSpan={2}
                      className="text-center font-semibold px-2 py-1.5 border-l border-gray-200 min-w-[120px]">
                      <span className="block truncate max-w-[150px] mx-auto" title={p.subject_name}>
                        {p.subject_code || p.paper_no || p.subject_name}
                      </span>
                      <span className="block text-[9px] font-normal text-gray-400">
                        max {p.theory_marks ?? '—'} / {p.internal_marks ?? '—'}
                      </span>
                    </th>
                  ))}
                  <th rowSpan={2} className="text-center font-semibold px-3 py-2 border-l border-gray-200 min-w-[80px]">Total</th>
                </tr>
                <tr className="bg-gray-50 text-gray-400 text-[10px] uppercase tracking-wider">
                  {papers.map(p => (
                    <Fragment key={p.paper_key}>
                      <th className="font-semibold px-2 py-1.5 border-l border-gray-200 w-14">Th</th>
                      <th className="font-semibold px-2 py-1.5 w-14">Int</th>
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {roll.map((s, i) => {
                  const t = totalsFor(s.id)
                  return (
                    <tr key={s.id} className={`border-t border-gray-50 ${i % 2 ? 'bg-gray-50/40' : ''}`}>
                      <td className={`px-3 py-1.5 sticky left-0 border-r border-gray-200 ${i % 2 ? 'bg-gray-50' : 'bg-white'}`}>
                        <p className="font-semibold text-gray-800 truncate max-w-[180px]">{s.student_name}</p>
                        <p className="text-[10px] text-gray-400 font-mono">{s.enrollment_no || s.registration_no || ''}</p>
                      </td>
                      {papers.map(p => {
                        const c = cellOf(s.id, p.paper_key)
                        return ['theory', 'internal'].map(f => (
                          <td key={`${p.paper_key}-${f}`} className={`px-1.5 py-1.5 ${f === 'theory' ? 'border-l border-gray-200' : ''}`}>
                            <input type="number" min="0" step="any" value={c[f]}
                              onChange={e => setCell(s.id, p.paper_key, f, e.target.value)}
                              className="w-12 px-1.5 py-1 border border-gray-200 rounded-lg text-xs text-center focus:outline-none focus:border-[#933d18]" />
                          </td>
                        ))
                      })}
                      <td className="px-3 py-1.5 text-center border-l border-gray-200 font-bold text-gray-700">
                        {t.any ? `${t.got}${t.max ? ` / ${t.max}` : ''}` : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-gray-400 px-4 py-2.5 border-t border-gray-50">
            {roll.length} student{roll.length === 1 ? '' : 's'} · {papers.length} paper{papers.length === 1 ? '' : 's'}. Save All Marks writes every student on this sheet; a blank pair simply records nothing for that paper.
          </p>
        </div>
      )}
    </div>
  )
}
