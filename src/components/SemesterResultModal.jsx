import { useEffect, useState } from 'react'
import { X, Award, Lock, Send, BadgeCheck, FileText } from 'lucide-react'
import Button from './ui/Button'
import { supabase } from '../lib/supabase'
import { semesterResults, saveSemesterResult, releaseSemesterResult } from '../utils/semesterResults'
import { fetchPaperMarks, savePaperMarks } from '../utils/paperMarks'
import { generateMarksStatement } from '../utils/generateStudentCards'
import { resolveStudentDocUrls } from '../utils/resolveStudentDocs'
import { fetchExamDates } from '../utils/examSettings'

const pct = (o, t) => {
  const a = parseFloat(o), b = parseFloat(t)
  return a && b ? `${((a / b) * 100).toFixed(1)}%` : '—'
}

// Results are entered per SEMESTER, for the same semesters the admit card is
// issued for — a semester whose fee isn't cleared has no exam, so no result.
export default function SemesterResultModal({ student, onClose, onSaved }) {
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
      dateOfIssue: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
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
    const { error } = await saveSemesterResult(student.id, pick.sem, {
      status: form.status,
      obtained_marks: form.obtained_marks || null,
      total_marks: form.total_marks || null,
      remarks: form.remarks || null,
      marksheet_url: form.marksheet_url || null,
      declared_at: form.declared_at ? new Date(form.declared_at).toISOString() : null,
    })
    setBusy(false)
    if (error) { alert('Could not save: ' + error.message); return }
    setPick(null); await load(); onSaved?.()
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white">
          <div className="flex items-center gap-2">
            <Award size={17} className="text-[#933d18]" />
            <div>
              <h3 className="font-bold text-gray-900 leading-tight">Results</h3>
              <p className="text-xs text-gray-400">
                {student.student_name} · {pick ? `Semester ${pick.sem}` : 'pick a semester'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
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
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Obtained</label>
                  <input value={form.obtained_marks} onChange={e => setForm(f => ({ ...f, obtained_marks: e.target.value }))} className={input} />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Total</label>
                  <input value={form.total_marks} onChange={e => setForm(f => ({ ...f, total_marks: e.target.value }))} className={input} />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">Declared On</label>
                <input type="datetime-local" value={form.declared_at} onChange={e => setForm(f => ({ ...f, declared_at: e.target.value }))} className={input} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">Marksheet URL (optional)</label>
                <input value={form.marksheet_url} onChange={e => setForm(f => ({ ...f, marksheet_url: e.target.value }))} className={input} placeholder="https://…" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">Remarks (optional)</label>
                <input value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} className={input} />
              </div>
              {/* Paper-wise marks — what the Statement of Marks prints. The
                  maximums and credits beside each paper come from the course's
                  scheme and are shown only for reference. */}
              <div className="pt-2 border-t border-gray-100">
                <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">Paper-wise Marks</p>
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
                          <th className="text-left font-semibold px-3 py-2">Subject</th>
                          <th className="text-center font-semibold px-2 py-2 w-20">Max<br/>Th / Int</th>
                          <th className="text-center font-semibold px-2 py-2 w-20">Theory</th>
                          <th className="text-center font-semibold px-2 py-2 w-20">Internal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {papers.map(p => (
                          <tr key={p.paper_key} className="border-t border-gray-50">
                            <td className="px-3 py-1.5">
                              <p className="font-semibold text-gray-800">{p.subject_name || '—'}</p>
                              <p className="text-[10px] text-gray-400 font-mono">{p.subject_code || p.paper_no || ''}</p>
                            </td>
                            <td className="px-2 py-1.5 text-center text-gray-400">
                              {p.theory_marks || '—'} / {p.internal_marks || '—'}
                            </td>
                            {['theory_obtained', 'internal_obtained'].map(f => (
                              <td key={f} className="px-2 py-1.5">
                                <input type="number" min="0" step="any" value={p[f]}
                                  onChange={e => setPaper(p.paper_key, f, e.target.value)}
                                  className="w-16 px-2 py-1 border border-gray-200 rounded-lg text-xs text-center focus:outline-none focus:border-[#933d18]" />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
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
