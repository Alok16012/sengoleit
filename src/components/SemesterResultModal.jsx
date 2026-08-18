import { useEffect, useState } from 'react'
import { X, Award, Lock, Send, BadgeCheck, FileText, Trash2, Maximize2, Minimize2 } from 'lucide-react'
import Button from './ui/Button'
import { supabase } from '../lib/supabase'
import { semesterResults, saveSemesterResult, releaseSemesterResult, deleteSemesterResult } from '../utils/semesterResults'
import { fetchPaperMarks, savePaperMarks } from '../utils/paperMarks'
import { generateMarksStatement, gradeFor } from '../utils/generateStudentCards'
import { resolveStudentDocUrls } from '../utils/resolveStudentDocs'
import { fetchExamDates } from '../utils/examSettings'

// Internal is marked within its own band, not as a flat share of the paper:
// 20 to 25 out of 30, as a fraction so a paper marked out of 50 or 20 scales.
const INTERNAL_BAND = { lo: 20 / 30, hi: 25 / 30 }
// How far a single paper may sit either side of the percentage asked for.
const PAPER_SPREAD = 4

const pct = (o, t) => {
  const a = parseFloat(o), b = parseFloat(t)
  return a && b ? `${((a / b) * 100).toFixed(1)}%` : '—'
}

// Results are entered per SEMESTER, for the same semesters the admit card is
// issued for — a semester whose fee isn't cleared has no exam, so no result.
// `special` widens the band the auto-fill accepts: an ordinary result is
// filled between 65% and 70%, a special one between 70% and 90%.
export default function SemesterResultModal({ student, special = false, onClose, onSaved }) {
  const BAND = special ? { min: 70, max: 90 } : { min: 65, max: 70 }
  const [rows, setRows] = useState(null)     // null = loading, [] = none
  const [missing, setMissing] = useState(false)
  const [pick, setPick] = useState(null)     // the semester being edited
  const [form, setForm] = useState({ status: 'Pending', obtained_marks: '', total_marks: '', remarks: '', marksheet_url: '', declared_at: '' })
  const [busy, setBusy] = useState(false)
  // Paper-wise marks for the semester being edited — what the Statement of
  // Marks prints. null while loading, [] when the course has no syllabus for
  // that semester.
  const [papers, setPapers] = useState(null)
  const [printing, setPrinting] = useState(null)
  // Full-page view — a semester with a dozen papers does not fit a sheet, and
  // the same toggle the app's shared Modal offers is what people expect.
  const [maximized, setMaximized] = useState(false)
  const [fillPct, setFillPct] = useState('')

  async function load() {
    const r = await semesterResults(student)
    if (r == null) { setMissing(true); setRows([]) } else setRows(r)
  }
  useEffect(() => { load() }, [student])

  function edit(row) {
    setPick(row)
    setPapers(null)
    fetchPaperMarks(student, row.sem).then(setPapers).catch(() => setPapers([]))
    const r = row.result
    setForm({
      status: r?.status || 'Pending',
      obtained_marks: r?.obtained_marks || '',
      total_marks: r?.total_marks || '',
      remarks: r?.remarks || '',
      marksheet_url: r?.marksheet_url || '',
      declared_at: r?.declared_at ? new Date(r.declared_at).toISOString().slice(0, 16)
        : new Date().toISOString().slice(0, 16),
    })
  }

  // A paper cannot be scored above what it is out of. Typing 80 into a theory
  // marked out of 70 produced a 110/100 paper graded O; the cell is held to
  // its own maximum instead.
  const setPaper = (key, field, val) => setPapers(prev => (prev || []).map(p => {
    if (p.paper_key !== key) return p
    const max = Number(field === 'theory_obtained' ? p.theory_marks : p.internal_marks) || 0
    const v = (val === '' || !max) ? val
      : String(Math.min(Math.max(Number(val) || 0, 0), max))
    return { ...p, [field]: v }
  }))

  // Fill the whole semester at one percentage. A paper whose scheme sets no
  // maximum is skipped: there is nothing to take a percentage OF, and a 0
  // there would read as a fail.
  function applyFill() {
    const pct = Number(fillPct)
    if (!fillPct || isNaN(pct)) { alert('Enter a percentage first.'); return }
    if (pct < BAND.min || pct > BAND.max) {
      alert(`This tab fills between ${BAND.min}% and ${BAND.max}%.\n\n` +
        (special
          ? 'For a lower result, use Student Entry.'
          : 'For anything above 70%, use the Special Result tab.'))
      return
    }
    setPapers(prev => {
      const list = prev || []
      // Marks must not come out identical on every paper — a marksheet where
      // each subject scores exactly alike is obviously machine-made. Each
      // paper is drawn around the percentage asked for, then the set is
      // corrected so the SEMESTER still totals it exactly.
      const sized = list.map(p => ({
        p,
        maxT: Number(p.theory_marks) || 0,
        maxI: Number(p.internal_marks) || 0,
        max: (Number(p.total_marks) || (Number(p.theory_marks) || 0) + (Number(p.internal_marks) || 0)),
      }))
      const fillable = sized.filter(x => x.maxT || x.maxI)
      if (!fillable.length) return list

      const rand = (lo, hi) => lo + Math.random() * (hi - lo)
      const draw = fillable.map(x => {
        // A few points either side of the figure asked for, so papers differ.
        const want = Math.round(x.max * (pct + rand(-PAPER_SPREAD, PAPER_SPREAD)) / 100)
        // A paper with no theory (a project marked wholly internally) has
        // nothing to split: its internal IS the paper, so it takes the target
        // rather than the internal band, which would float it well above the
        // percentage asked for.
        if (!x.maxT) return { ...x, t: 0, i: Math.min(Math.max(want, 0), x.maxI) }
        // Otherwise internal keeps to the university's band — 20 to 25 out of
        // 30 — as a fraction, so an internal out of 50 or 20 scales with it.
        const i = x.maxI
          ? Math.min(Math.round(x.maxI * rand(INTERNAL_BAND.lo, INTERNAL_BAND.hi)), x.maxI)
          : 0
        return { ...x, t: Math.min(Math.max(want - i, 0), x.maxT), i: Math.min(i, x.max) }
      })

      // Nudge a mark at a time until the semester lands on the target. Papers
      // that have theory are corrected THERE, which is what keeps internal
      // inside its band; a theory-less paper is corrected on its internal,
      // where no band applies.
      const canStep = (x, step) => (x.maxT
        ? (step > 0 ? x.t < x.maxT : x.t > 0)
        : (step > 0 ? x.i < x.maxI : x.i > 0))
      const target = Math.round(draw.reduce((a, x) => a + x.max, 0) * pct / 100)
      let diff = target - draw.reduce((a, x) => a + x.t + x.i, 0)
      for (let guard = 0; diff !== 0 && guard < 2000; guard++) {
        const step = diff > 0 ? 1 : -1
        const room = draw.filter(x => canStep(x, step))
        if (!room.length) break
        const x = room[guard % room.length]
        if (x.maxT) x.t += step; else x.i += step
        diff -= step
      }

      const byKey = Object.fromEntries(draw.map(x => [x.p.paper_key, x]))
      return list.map(p => {
        const d = byKey[p.paper_key]
        if (!d) return p
        return {
          ...p,
          theory_obtained: d.maxT ? String(d.t) : '',
          internal_obtained: d.maxI ? String(d.i) : '',
        }
      })
    })
  }

  // What one paper is worth once its marks are in: the obtained total, the
  // grade off its percentage, and the credit it earns (none if it fails).
  const paperRow = (p) => {
    const entered = p.theory_obtained !== '' || p.internal_obtained !== ''
    const got = entered ? (Number(p.theory_obtained) || 0) + (Number(p.internal_obtained) || 0) : ''
    const max = Number(p.total_marks) || 0
    const g = entered && max ? gradeFor((got / max) * 100) : { letter: '—', point: 0 }
    return { entered, got, max, g, earned: g.point > 0 ? (Number(p.credits) || 0) : 0 }
  }

  // The semester's obtained / total, added up from the papers that have marks
  // — so the figures at the top always agree with the sheet below them.
  const summary = (papers || []).reduce((acc, p) => {
    const r = paperRow(p)
    return r.entered
      ? { got: acc.got + r.got, max: acc.max + r.max, any: true }
      : acc
  }, { got: 0, max: 0, any: false })
  const summaryPct = summary.any && summary.max ? (summary.got / summary.max) * 100 : null
  // The tab states a ceiling; marks typed by hand must respect it too, or the
  // auto-fill's band means nothing the moment anyone edits a cell.
  const overBand = summaryPct != null && summaryPct > BAND.max + 0.05

  // Print the university's Statement of Marks for one semester. Reads the
  // paper marks fresh so a card printed from the list is never a stale copy of
  // what is on screen.
  async function printStatement(row) {
    setPrinting(row.sem)
    const { data: full } = await supabase.from('students')
      .select('*, programs(program_name), academic_sessions(session_name), centers(center_name, center_code), departments(name)')
      .eq('id', student.id).single()
    const resolved = full ? await resolveStudentDocUrls(full) : student
    const rowsForSem = await fetchPaperMarks(student, row.sem)
    const dates = await fetchExamDates(resolved, row.sem)
    generateMarksStatement(resolved, rowsForSem, {
      dmcNo: resolved.enrollment_no ? `${resolved.enrollment_no}/S${row.sem}` : '',
      semester: `Semester ${row.sem}`,
      examHeld: dates.examSession || '',
      resultStatus: row.result?.status === 'Fail' ? 'Failed' : 'Passed',
      // The semester's published date from the Examination Calendar, so a
      // reprint reads the same as the first copy. Falls back to today only
      // when the calendar has none.
      dateOfIssue: dates.resultPublished
        || new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    })
    setPrinting(null)
  }

  async function save() {
    if (overBand) {
      alert(
        `This result works out to ${summaryPct.toFixed(1)}%, above the ${BAND.max}% this tab allows.\n\n` +
        (special
          ? 'Lower the marks to bring it within 90%.'
          : 'Lower the marks to bring it within 70%, or declare it from the Special Result tab.')
      )
      return
    }
    setBusy(true)
    // Paper marks first: the semester row is what the list reflects, so it
    // should not claim saved while the detail behind it failed.
    if (papers?.length) {
      const { error: pErr } = await savePaperMarks(student.id, pick.sem, papers)
      if (pErr) {
        setBusy(false)
        alert('Could not save the paper-wise marks (run add_student_paper_marks.sql in Supabase):\n\n' + pErr.message)
        return
      }
    }
    // With papers on the sheet the totals come from them; without any (a course
    // with no syllabus) whatever was typed still stands. `declared_at` is
    // stamped here rather than asked for — it is when the result was declared.
    const { error } = await saveSemesterResult(student.id, pick.sem, {
      status: form.status,
      obtained_marks: papers?.length ? (summary.any ? summary.got : null) : (form.obtained_marks || null),
      total_marks:    papers?.length ? (summary.any ? summary.max : null) : (form.total_marks || null),
      declared_at: new Date().toISOString(),
    })
    setBusy(false)
    if (error) { alert('Could not save: ' + error.message); return }
    setPick(null); await load(); onSaved?.()
  }

  // Withdraw a declared result. The paper-wise marks stay, so a result deleted
  // by mistake — or one being re-declared — does not mean keying every paper
  // again; the confirm says so rather than leaving it a surprise.
  async function removeResult(row) {
    if (!confirm(
      `Delete Semester ${row.sem}'s result for ${student.student_name}?\n\n` +
      `It disappears from the student portal and the semester goes back to "Not entered yet".\n\n` +
      `The paper-wise marks you entered are kept, so it can be declared again without retyping them.`
    )) return
    setBusy(true)
    const { error } = await deleteSemesterResult(student.id, row.sem)
    setBusy(false)
    if (error) { alert('Could not delete: ' + error.message); return }
    await load(); onSaved?.()
  }

  async function release(row) {
    if (!confirm(`Send the Semester ${row.sem} result to the student?`)) return
    setBusy(true)
    const { error } = await releaseSemesterResult(student.id, row.sem)
    setBusy(false)
    if (error) { alert('Could not release: ' + error.message); return }
    await load(); onSaved?.()
  }

  const input = 'w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#933d18]/30'

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm ${maximized ? 'p-0' : 'p-4'}`} onClick={onClose}>
      {/* The semester list is a short column; entering marks is a wide table,
          so the sheet grows for it rather than making every paper wrap — and
          maximise gives a long semester the whole page. */}
      <div className={`bg-white shadow-2xl transition-all duration-200 overflow-auto ${
        maximized
          ? 'w-screen h-screen max-w-none max-h-none rounded-none'
          : `w-full ${pick ? 'max-w-4xl' : 'max-w-lg'} max-h-[92vh] rounded-2xl`
      }`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-2">
            <Award size={17} className="text-[#933d18]" />
            <div>
              <h3 className="font-bold text-gray-900 leading-tight">Results</h3>
              <p className="text-xs text-gray-400">
                {student.student_name} · {pick ? `Semester ${pick.sem}` : 'pick a semester'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setMaximized(m => !m)}
              title={maximized ? 'Minimize' : 'Maximize — full page view'}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
              {maximized ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"><X size={18} /></button>
          </div>
        </div>

        <div className="p-5">
          {missing && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-800 mb-3">
              Run <span className="font-mono">add_semester_results.sql</span> in Supabase to store results semester-wise.
            </div>
          )}

          {rows == null ? (
            <p className="text-center text-gray-400 py-8 text-sm">Loading…</p>
          ) : pick ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={`${input} bg-white`}>
                    <option>Pending</option><option>Pass</option><option>Fail</option>
                  </select>
                </div>
                {/* Obtained and Total are the paper marks added up — typed
                    figures could disagree with the sheet below them. A course
                    with no papers in its syllabus keeps them editable, since
                    there is nothing to add up. */}
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Obtained</label>
                  {papers?.length ? (
                    <div className={`${input} bg-gray-50 font-bold text-gray-700`}>{summary.any ? summary.got : '—'}</div>
                  ) : (
                    <input value={form.obtained_marks} onChange={e => setForm(f => ({ ...f, obtained_marks: e.target.value }))} className={input} />
                  )}
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                    Total
                    {summaryPct != null && (
                      <span className={`ml-2 font-bold ${overBand ? 'text-red-600' : 'text-gray-600'}`}>
                        {summaryPct.toFixed(1)}%
                      </span>
                    )}
                  </label>
                  {papers?.length ? (
                    <div className={`${input} bg-gray-50 font-bold text-gray-700`}>{summary.any ? summary.max : '—'}</div>
                  ) : (
                    <input value={form.total_marks} onChange={e => setForm(f => ({ ...f, total_marks: e.target.value }))} className={input} />
                  )}
                </div>
              </div>
              {overBand && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-700">
                  This result works out to <strong>{summaryPct.toFixed(1)}%</strong>, above the {BAND.max}% this tab allows.{' '}
                  {special ? 'Lower the marks to save it.' : 'Lower the marks, or declare it from the Special Result tab.'}
                </div>
              )}
              {/* Paper-wise marks — what the Statement of Marks prints. The
                  maximums and credits beside each paper come from the course's
                  scheme and are shown only for reference. */}
              <div className="pt-2 border-t border-gray-100">
                <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
                    Paper-wise Marks{special && <span className="ml-2 text-[#933d18]">· Special Result</span>}
                  </p>
                  {/* Fill the whole semester at one percentage, then correct any
                      paper by hand. The band is what the tab allows. */}
                  {papers?.length > 0 && (
                    <div className="flex items-center gap-2">
                      <label className="text-[11px] font-semibold text-gray-500">Auto-fill at</label>
                      <input type="number" min={BAND.min} max={BAND.max} step="0.5"
                        value={fillPct} onChange={e => setFillPct(e.target.value)}
                        placeholder={`${BAND.min}–${BAND.max}`}
                        className="w-20 px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-center focus:outline-none focus:border-[#933d18]" />
                      <span className="text-[11px] text-gray-400">%</span>
                      <Button size="sm" variant="secondary" onClick={applyFill}>Fill</Button>
                    </div>
                  )}
                </div>
                {papers == null ? (
                  <p className="text-xs text-gray-400 py-3">Loading papers…</p>
                ) : !papers.length ? (
                  <p className="text-xs text-gray-400 py-3">
                    No papers in the syllabus for Semester {pick.sem}. Add them on the Syllabus page, then set the marks on the Schemes page.
                  </p>
                ) : (
                  <div className="border border-gray-100 rounded-xl overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 text-gray-500 text-[10px] uppercase tracking-wider">
                          <th rowSpan={2} className="text-left font-semibold px-3 py-2">Subject</th>
                          <th rowSpan={2} className="text-center font-semibold px-2 py-2 w-24">Credit</th>
                          <th colSpan={3} className="text-center font-semibold px-2 py-1.5 border-b border-gray-100">Maximum</th>
                          <th colSpan={3} className="text-center font-semibold px-2 py-1.5 border-b border-gray-100">Obtained</th>
                          <th rowSpan={2} className="text-center font-semibold px-2 py-2 w-16">Grade</th>
                          <th rowSpan={2} className="text-center font-semibold px-2 py-2 w-20">Earned<br/>Credit</th>
                        </tr>
                        <tr className="bg-gray-50 text-gray-500 text-[10px] uppercase tracking-wider">
                          <th className="text-center font-semibold px-2 py-1.5 w-16">Theory</th>
                          <th className="text-center font-semibold px-2 py-1.5 w-16">Internal</th>
                          <th className="text-center font-semibold px-2 py-1.5 w-16">Total</th>
                          <th className="text-center font-semibold px-2 py-1.5 w-20">Theory</th>
                          <th className="text-center font-semibold px-2 py-1.5 w-20">Internal</th>
                          <th className="text-center font-semibold px-2 py-1.5 w-16">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {papers.map(p => {
                          // Same rule as the scheme: a total is never typed, it
                          // is the two beside it added up — and the grade and
                          // earned credit follow from it.
                          const { entered, got, g, earned } = paperRow(p)
                          return (
                          <tr key={p.paper_key} className="border-t border-gray-50">
                            <td className="px-3 py-1.5">
                              <p className="font-semibold text-gray-800">{p.subject_name || '—'}</p>
                              <p className="text-[10px] text-gray-400 font-mono">{p.subject_code || p.paper_no || ''}</p>
                            </td>
                            <td className="px-2 py-1.5 text-center text-gray-500">{p.credits || '—'}</td>
                            <td className="px-2 py-1.5 text-center text-gray-400">{p.theory_marks || '—'}</td>
                            <td className="px-2 py-1.5 text-center text-gray-400">{p.internal_marks || '—'}</td>
                            <td className="px-2 py-1.5 text-center font-semibold text-gray-600">{p.total_marks || '—'}</td>
                            {['theory_obtained', 'internal_obtained'].map(f => (
                              <td key={f} className="px-2 py-1.5">
                                <input type="number" min="0" step="any"
                                  max={Number(f === 'theory_obtained' ? p.theory_marks : p.internal_marks) || undefined}
                                  value={p[f]}
                                  onChange={e => setPaper(p.paper_key, f, e.target.value)}
                                  className="w-16 px-2 py-1 border border-gray-200 rounded-lg text-xs text-center focus:outline-none focus:border-[#933d18]" />
                              </td>
                            ))}
                            <td className="px-2 py-1.5 text-center font-bold text-gray-700">{entered ? got : '—'}</td>
                            <td className={`px-2 py-1.5 text-center font-bold ${g.letter === 'F' ? 'text-red-600' : 'text-gray-700'}`}>{g.letter}</td>
                            <td className="px-2 py-1.5 text-center text-gray-600">{entered ? earned : '—'}</td>
                          </tr>
                        )})}
                      </tbody>
                    </table>
                  </div>
                )}
                {papers?.length > 0 && (
                  <p className="text-[11px] text-gray-400 mt-2">
                    Auto-fill accepts {BAND.min}%–{BAND.max}% in this tab
                    {special ? '.' : ' — use the Special Result tab for anything above 70%.'} Every paper is set to that share of its own maximum; correct any of them by hand afterwards.
                  </p>
                )}
                {papers?.length > 0 && !papers.some(p => p.total_marks) && (
                  <p className="text-[11px] text-amber-700 mt-2">
                    This course has no examination scheme yet, so the statement will print without maximum marks or credits. Set it on the Schemes page.
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button variant="secondary" size="md" onClick={() => setPick(null)}>Back</Button>
                <Button variant="primary" size="md" onClick={save} disabled={busy}>
                  {busy ? 'Saving…' : `Save Semester ${pick.sem}`}
                </Button>
              </div>
            </div>
          ) : !rows.length ? (
            <p className="text-center text-gray-400 py-8 text-sm">No fee structure found for this course.</p>
          ) : (
            <>
              <p className="text-[11px] text-gray-400 mb-3">
                A semester opens once its fee is cleared — the same semesters the admit card is issued for.
              </p>
              <div className="space-y-2">
                {rows.map(row => {
                  const r = row.result
                  return (
                    <div key={row.sem}
                      className={`flex items-center justify-between rounded-xl border px-4 py-2.5 gap-3 ${row.cleared ? 'border-gray-200' : 'border-gray-100 bg-gray-50'}`}>
                      <div className="min-w-0">
                        <p className={`text-sm font-bold ${row.cleared ? 'text-gray-900' : 'text-gray-400'}`}>Semester {row.sem}</p>
                        {r && r.status !== 'Pending' ? (
                          <p className="text-[11px] text-gray-500">
                            <span className={r.status === 'Pass' ? 'text-emerald-700 font-bold' : 'text-red-700 font-bold'}>{r.status}</span>
                            {' · '}{r.obtained_marks || '—'}/{r.total_marks || '—'} · {pct(r.obtained_marks, r.total_marks)}
                            {r.released_at ? ' · sent to student' : ''}
                          </p>
                        ) : (
                          <p className="text-[11px] text-gray-400">{row.cleared ? 'Not entered yet' : `To collect ₹${Number(row.dueFee).toLocaleString('en-IN')}`}</p>
                        )}
                      </div>
                      {!row.cleared ? (
                        <span className="flex items-center gap-1 text-[11px] font-semibold text-gray-400 shrink-0"><Lock size={12} /> Fee pending</span>
                      ) : (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button size="sm" variant="secondary" onClick={() => edit(row)}>
                            {r && r.status !== 'Pending' ? 'Edit' : 'Enter'}
                          </Button>
                          {r && r.status !== 'Pending' && (
                            <Button size="sm" variant="secondary" disabled={printing === row.sem}
                              title="Print the Statement of Marks for this semester"
                              onClick={() => printStatement(row)}>
                              <FileText size={12} /> {printing === row.sem ? '…' : 'Marks Statement'}
                            </Button>
                          )}
                          {r && r.status !== 'Pending' && (
                            r.released_at ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                                <BadgeCheck size={12} /> Released
                              </span>
                            ) : (
                              <Button size="sm" variant="primary" disabled={busy} onClick={() => release(row)}>
                                <Send size={12} /> Send
                              </Button>
                            )
                          )}
                          {r && r.status !== 'Pending' && (
                            <Button size="sm" variant="danger" disabled={busy}
                              title="Delete this semester's result" onClick={() => removeResult(row)}>
                              <Trash2 size={12} />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
