import { useEffect, useState } from 'react'
import { X, Award, Lock, Send, BadgeCheck, FileText, Trash2, Maximize2, Minimize2 } from 'lucide-react'
import Button from './ui/Button'
import { supabase } from '../lib/supabase'
import { semesterResults, saveSemesterResult, releaseSemesterResult, deleteSemesterResult } from '../utils/semesterResults'
import { fetchPaperMarks, savePaperMarks } from '../utils/paperMarks'
import { generateMarksStatement, gradeFor } from '../utils/generateStudentCards'
import { resolveStudentDocUrls } from '../utils/resolveStudentDocs'
import { fetchExamDates } from '../utils/examSettings'

// Internal marks follow the university's own convention rather than the flat
// percentage: 20 out of 30 at 65%, 25 at 70%, 28 at 90% — expressed as a
// fraction so it scales to a paper whose internal is out of 50 or 20.
const INTERNAL_SHARE = (pct) => {
  const p = Math.max(Number(pct) || 0, 65)
  return p <= 70
    ? (20 + (p - 65)) / 30           // 65% → 20/30 … 70% → 25/30
    : (25 + (p - 70) * 0.15) / 30    // 70% → 25/30 … 90% → 28/30
}

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

  const setPaper = (key, field, val) => setPapers(prev =>
    (prev || []).map(p => (p.paper_key === key ? { ...p, [field]: val } : p)))

  // Fill every paper at one percentage — the marks a result of that standing
  // works out to. Theory and internal are each taken to that share of their own
  // maximum, so a paper out of 70+30 and one out of 50+50 both land on it.
  // A paper whose scheme has no maximum is skipped: there is nothing to take a
  // percentage OF, and writing 0 there would read as a fail.
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
    setPapers(prev => (prev || []).map(p => {
      const maxT = Number(p.theory_marks) || 0
      const maxI = Number(p.internal_marks) || 0
      if (!maxT && !maxI) return p
      // The paper lands on the percentage asked for; internal and theory split
      // it by the university's convention rather than each taking a flat share
      // (rounding them separately also drifted the paper past the figure —
      // 85% of 70+30 rounded to 60+26, i.e. 86%).
      const target = Math.round((Number(p.total_marks) || maxT + maxI) * pct / 100)
      // Internal is marked generously: 20 of 30 at 65%, rising to 25 at 70%
      // and on to 28 at 90% — scaled to whatever this paper's own internal
      // maximum is, and never more than the paper's target.
      let i = maxI ? Math.min(Math.round(maxI * INTERNAL_SHARE(pct)), maxI, target) : 0
      let t = Math.min(Math.max(target - i, 0), maxT)
      // Where theory cannot cover the rest, internal makes it up.
      if (t + i < target) i = Math.min(i + (target - t - i), maxI)
      return {
        ...p,
        theory_obtained: maxT ? String(t) : '',
        internal_obtained: maxI ? String(i) : '',
      }
    }))
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
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Total</label>
                  {papers?.length ? (
                    <div className={`${input} bg-gray-50 font-bold text-gray-700`}>{summary.any ? summary.max : '—'}</div>
                  ) : (
                    <input value={form.total_marks} onChange={e => setForm(f => ({ ...f, total_marks: e.target.value }))} className={input} />
                  )}
                </div>
              </div>
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
                                <input type="number" min="0" step="any" value={p[f]}
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
