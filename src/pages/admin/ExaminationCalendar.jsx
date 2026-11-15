import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import Button from '../../components/ui/Button'
import DateInput, { isoToDisplay } from '../../components/ui/DateInput'
import { SearchableSelect } from '../../components/ui/SearchSelect'
import { Save, CalendarRange, CalendarDays, Plus, Pencil, Trash2, X } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

// Examination Calendar — pick a session, then one row per semester with its
// examination dates. Rows are added, edited and deleted one at a time. One row
// per (session, semester) in `exam_calendar`.
//
// Ph.D years (stored at 101+) belong to the Research Dept. and are not shown
// or touched here.
const MAX_SEM = 10
const BLANK = { start_date: '', end_date: '', exam_held: '', admit_card_issued_on: '', result_declared_on: '', result_published: '' }
const COLS = 'semester, start_date, end_date, exam_held, admit_card_issued_on, result_declared_on, result_published'

const inputCls = 'w-full bg-white border border-gray-200 rounded-lg py-1.5 px-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#933d18]/20 focus:border-[#933d18]'

export default function ExaminationCalendar() {
  const { may } = useAuth()
  const canEdit = may('exam_section.calendar')
  const [sessions, setSessions] = useState([])
  const [sessionId, setSessionId] = useState('')       // '' = none picked
  const [rows, setRows] = useState({})                 // semester -> saved row
  const [loading, setLoading] = useState(false)
  const [missing, setMissing] = useState('')           // database update needed
  const [edit, setEdit] = useState(null)               // { sem, isNew, ...fields }
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase.from('academic_sessions').select('id, session_name').or('status.eq.Active,status.is.null').order('session_name', { ascending: false })
      .then(({ data }) => setSessions(data || []))
  }, [])

  useEffect(() => {
    if (!sessionId) return undefined
    let alive = true
    supabase.from('exam_calendar').select(COLS).eq('session_id', sessionId).lte('semester', MAX_SEM)
      .then(({ data, error }) => {
        if (!alive) return
        if (error) {
          setMissing(/admit_card_issued_on/.test(error.message || '') ? 'add_exam_calendar_admit_issue.sql' : 'add_exam_calendar.sql')
          setRows({}); setLoading(false); return
        }
        const m = {}
        ;(data || []).forEach(r => { m[r.semester] = Object.fromEntries(Object.keys(BLANK).map(k => [k, r[k] || ''])) })
        setRows(m); setLoading(false)
      })
    return () => { alive = false }
  }, [sessionId])

  const sems = Object.keys(rows).map(Number).sort((a, b) => a - b)
  const freeSems = Array.from({ length: MAX_SEM }, (_, i) => i + 1).filter(n => !rows[n])

  function startAdd() {
    if (!freeSems.length) return
    setEdit({ sem: freeSems[0], isNew: true, ...BLANK })
  }
  const set = (k, v) => setEdit(e => ({ ...e, [k]: v }))

  async function saveRow() {
    const e = edit
    if (e.start_date && e.end_date && e.end_date < e.start_date) return alert("End date can't be before the start date.")
    const row = {
      session_id: sessionId, semester: Number(e.sem),
      start_date: e.start_date || null, end_date: e.end_date || null,
      exam_held: (e.exam_held || '').trim() || null,
      admit_card_issued_on: e.admit_card_issued_on || null,
      result_declared_on: e.result_declared_on || null,
      result_published: e.result_published || null,
    }
    setBusy(true)
    const del = await supabase.from('exam_calendar').delete().eq('session_id', sessionId).eq('semester', row.semester)
    const ins = del.error ? del : await supabase.from('exam_calendar').insert(row)
    setBusy(false)
    if (ins.error) return alert('Could not save: ' + ins.error.message)
    setRows(r => ({ ...r, [row.semester]: Object.fromEntries(Object.keys(BLANK).map(k => [k, row[k] || ''])) }))
    setEdit(null)
  }

  async function removeRow(sem) {
    if (!confirm(`Delete Semester ${sem}'s examination dates for this session?`)) return
    setBusy(true)
    const { error } = await supabase.from('exam_calendar').delete().eq('session_id', sessionId).eq('semester', sem)
    setBusy(false)
    if (error) return alert('Could not delete: ' + error.message)
    setRows(r => { const n = { ...r }; delete n[sem]; return n })
  }

  const sessionName = sessions.find(s => s.id === sessionId)?.session_name || ''
  const editing = sem => edit && !edit.isNew && edit.sem === sem
  const dash = <span className="text-gray-300">—</span>

  const editCells = (
    <>
      <td className="px-3 py-2"><DateInput value={edit?.start_date} onChange={ev => set('start_date', ev.target.value)} bare className={inputCls} /></td>
      <td className="px-3 py-2"><DateInput value={edit?.end_date} onChange={ev => set('end_date', ev.target.value)} bare min={edit?.start_date || undefined} className={inputCls} /></td>
      <td className="px-3 py-2"><input value={edit?.exam_held || ''} onChange={ev => set('exam_held', ev.target.value)} placeholder="e.g. January 2026" maxLength={40} className={inputCls} /></td>
      <td className="px-3 py-2"><DateInput value={edit?.admit_card_issued_on} onChange={ev => set('admit_card_issued_on', ev.target.value)} bare className={inputCls} /></td>
      <td className="px-3 py-2"><DateInput value={edit?.result_declared_on} onChange={ev => set('result_declared_on', ev.target.value)} bare className={inputCls} /></td>
      <td className="px-3 py-2"><DateInput value={edit?.result_published} onChange={ev => set('result_published', ev.target.value)} bare className={inputCls} /></td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Button size="sm" onClick={saveRow} disabled={busy}><Save size={13} /> {busy ? '…' : 'Save'}</Button>
          <button onClick={() => setEdit(null)} title="Cancel" className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X size={15} /></button>
        </div>
      </td>
    </>
  )

  return (
    <div>
      {/* Session picker */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-5 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <SearchableSelect
            label="Session"
            allLabel="Select a session"
            minWidth={240}
            value={sessionId || 'all'}
            onChange={v => {
              const id = v === 'all' ? '' : v
              setSessionId(id); setEdit(null); setMissing(''); setRows({}); setLoading(!!id)
            }}
            options={sessions.map(s => ({ id: s.id, label: s.session_name }))}
          />
          {sessionId && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <CalendarRange size={16} className="text-[#933d18]" />
              Examination dates of <strong className="text-gray-700">{sessionName}</strong>
            </div>
          )}
        </div>
      </div>

      {missing && (
        <div className="mb-4 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
          <CalendarDays size={16} className="mt-0.5 shrink-0" />
          <p>The Examination Calendar needs a database update — run <code className="font-mono">{missing}</code> once in Supabase → SQL Editor.</p>
        </div>
      )}

      {!sessionId ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-300">
          <CalendarRange size={52} className="mb-3" />
          <p className="text-base font-semibold text-gray-400">Select a session to see its examination calendar</p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Loading...</div>
      ) : (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <h3 className="font-bold text-gray-800">Examination Dates — {sessionName}</h3>
            {canEdit && (
              <Button size="sm" onClick={startAdd} disabled={!!edit || !freeSems.length}>
                <Plus size={14} /> Add Semester
              </Button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-left">
                  <th className="font-semibold px-3 py-2.5 whitespace-nowrap">Semester</th>
                  <th className="font-semibold px-3 py-2.5 whitespace-nowrap">Start Date</th>
                  <th className="font-semibold px-3 py-2.5 whitespace-nowrap">End Date</th>
                  <th className="font-semibold px-3 py-2.5 whitespace-nowrap">Exam. Held</th>
                  <th className="font-semibold px-3 py-2.5 whitespace-nowrap">Admit Card Issue Date</th>
                  <th className="font-semibold px-3 py-2.5 whitespace-nowrap">Result Published</th>
                  <th className="font-semibold px-3 py-2.5 whitespace-nowrap">Marksheet Printing</th>
                  {canEdit && <th className="font-semibold px-3 py-2.5 whitespace-nowrap">Action</th>}
                </tr>
              </thead>
              <tbody>
                {sems.map(n => (
                  <tr key={n} className={`border-t border-gray-50 ${editing(n) ? 'bg-[#933d18]/5' : ''}`}>
                    <td className="px-3 py-2.5 font-semibold text-gray-700 whitespace-nowrap">Sem {n}</td>
                    {editing(n) ? editCells : (
                      <>
                        <td className="px-3 py-2.5 text-gray-600">{isoToDisplay(rows[n].start_date) || dash}</td>
                        <td className="px-3 py-2.5 text-gray-600">{isoToDisplay(rows[n].end_date) || dash}</td>
                        <td className="px-3 py-2.5 text-gray-600">{rows[n].exam_held || dash}</td>
                        <td className="px-3 py-2.5 text-gray-600">{isoToDisplay(rows[n].admit_card_issued_on) || dash}</td>
                        <td className="px-3 py-2.5 text-gray-600">{isoToDisplay(rows[n].result_declared_on) || dash}</td>
                        <td className="px-3 py-2.5 text-gray-600">{isoToDisplay(rows[n].result_published) || dash}</td>
                        {canEdit && (
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1">
                              <button onClick={() => setEdit({ sem: n, isNew: false, ...rows[n] })} disabled={!!edit || busy} title="Edit"
                                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 rounded-lg disabled:opacity-40">
                                <Pencil size={12} /> Edit
                              </button>
                              <button onClick={() => removeRow(n)} disabled={!!edit || busy} title="Delete"
                                className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 disabled:opacity-40">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        )}
                      </>
                    )}
                  </tr>
                ))}
                {edit?.isNew && (
                  <tr className="border-t border-gray-50 bg-[#933d18]/5">
                    <td className="px-3 py-2">
                      <select value={edit.sem} onChange={ev => set('sem', Number(ev.target.value))} className={`${inputCls} w-24`}>
                        {freeSems.map(n => <option key={n} value={n}>Sem {n}</option>)}
                      </select>
                    </td>
                    {editCells}
                  </tr>
                )}
                {!sems.length && !edit && (
                  <tr><td colSpan={canEdit ? 8 : 7} className="px-3 py-10 text-center text-gray-400">No semester added yet{canEdit ? ' — click "Add Semester".' : '.'}</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="px-5 py-3 text-[11px] text-gray-400 border-t border-gray-50">
            Exam. Held is printed on the admit card and the marksheet as the examination session · Admit Card Issue Date is printed on the admit card · Marksheet Printing Date is the marksheet's Date of Issue.
          </p>
        </div>
      )}
    </div>
  )
}
