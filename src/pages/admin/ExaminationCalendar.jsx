import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import Button from '../../components/ui/Button'
import DateInput, { isoToDisplay } from '../../components/ui/DateInput'
import { SearchableSelect } from '../../components/ui/SearchSelect'
import { Save, CalendarRange, CalendarDays } from 'lucide-react'

const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

// Examination Calendar — pick a session, then set the exam start & end date for
// each semester (1–10). One row per (session, semester) in `exam_calendar`.
// Mirrors the Syllabus editor's session → semester-tabs → Save layout.
export default function ExaminationCalendar() {
  const [sessions, setSessions] = useState([])
  const [sessionId, setSessionId] = useState('')       // '' = none picked
  const [activeSem, setActiveSem] = useState(1)
  const [cal, setCal] = useState({})                   // semester -> { start_date, end_date }
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [missingTable, setMissingTable] = useState(false)

  useEffect(() => {
    supabase.from('academic_sessions').select('id, session_name').or('status.eq.Active,status.is.null').order('session_name', { ascending: false })
      .then(({ data }) => setSessions(data || []))
  }, [])

  // Load the chosen session's saved calendar.
  useEffect(() => {
    if (!sessionId) { setCal({}); return }
    setLoading(true); setSaved(false); setMissingTable(false)
    supabase.from('exam_calendar')
      .select('semester, start_date, end_date')
      .eq('session_id', sessionId)
      .then(({ data, error }) => {
        if (error) { setMissingTable(true); setCal({}); setLoading(false); return }
        const m = {}
        ;(data || []).forEach(r => { m[r.semester] = { start_date: r.start_date || '', end_date: r.end_date || '' } })
        setCal(m); setLoading(false)
      })
  }, [sessionId])

  const cur = cal[activeSem] || { start_date: '', end_date: '' }
  const setCur = (field, val) => setCal(p => ({
    ...p,
    [activeSem]: { ...(p[activeSem] || { start_date: '', end_date: '' }), [field]: val },
  }))

  const semHasDates = n => cal[n] && (cal[n].start_date || cal[n].end_date)
  const rangeInvalid = cur.start_date && cur.end_date && cur.end_date < cur.start_date

  async function save() {
    if (!sessionId || saving) return
    // Validate every semester that has both dates.
    for (const n of SEMESTERS) {
      const c = cal[n]
      if (c?.start_date && c?.end_date && c.end_date < c.start_date) {
        alert(`Semester ${n}: End date can't be before start date.`)
        setActiveSem(n)
        return
      }
    }
    setSaving(true); setSaved(false)
    const rows = SEMESTERS
      .filter(n => semHasDates(n))
      .map(n => ({
        session_id: sessionId,
        semester: n,
        start_date: cal[n].start_date || null,
        end_date: cal[n].end_date || null,
      }))
    // Replace this session's rows wholesale (matches the Syllabus save flow).
    const del = await supabase.from('exam_calendar').delete().eq('session_id', sessionId)
    if (del.error) { setMissingTable(true); setSaving(false); return }
    if (rows.length) {
      const ins = await supabase.from('exam_calendar').insert(rows)
      if (ins.error) { alert('Could not save: ' + ins.error.message); setSaving(false); return }
    }
    setSaving(false); setSaved(true)
  }

  const sessionName = sessions.find(s => s.id === sessionId)?.session_name || ''

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
            onChange={v => { setSessionId(v === 'all' ? '' : v); setSaved(false); setActiveSem(1) }}
            options={sessions.map(s => ({ id: s.id, label: s.session_name }))}
          />
          {sessionId && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <CalendarRange size={16} className="text-[#933d18]" />
              Set the examination start &amp; end date for each semester of
              <strong className="text-gray-700">{sessionName}</strong>.
            </div>
          )}
        </div>
      </div>

      {missingTable && (
        <div className="mb-4 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
          <CalendarDays size={16} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Examination Calendar table not found.</p>
            <p className="text-xs mt-0.5">Run <code className="font-mono">add_exam_calendar.sql</code> once in Supabase → SQL Editor to enable this feature.</p>
          </div>
        </div>
      )}

      {!sessionId ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-300">
          <CalendarRange size={52} className="mb-3" />
          <p className="text-base font-semibold text-gray-400">Select a session to set its examination calendar</p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm">Loading...</div>
      ) : (
        <>
          {/* Semester selector */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-4 mb-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">Select Semester</p>
            <div className="flex flex-wrap gap-2">
              {SEMESTERS.map(n => (
                <button key={n} onClick={() => setActiveSem(n)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${activeSem === n ? 'bg-[#933d18] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-[#933d18]'}`}>
                  Sem {n}
                  {semHasDates(n) && <span className={`w-1.5 h-1.5 rounded-full ${activeSem === n ? 'bg-white' : 'bg-emerald-500'}`} />}
                </button>
              ))}
            </div>
          </div>

          {/* Active semester's dates */}
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <h3 className="font-bold text-gray-800">Semester {activeSem} — Examination Dates</h3>
              <Button onClick={save} disabled={saving}>
                <Save size={14} /> {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save Calendar'}
              </Button>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-600 ml-0.5">Start Examination Date</label>
                <DateInput value={cur.start_date} onChange={e => setCur('start_date', e.target.value)} bare
                  className="w-full bg-white border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#933d18]/20 focus:border-[#933d18]" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-600 ml-0.5">End Examination Date</label>
                <DateInput value={cur.end_date} onChange={e => setCur('end_date', e.target.value)} bare min={cur.start_date || undefined}
                  className={`w-full bg-white border rounded-xl py-2.5 px-3.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#933d18]/20 focus:border-[#933d18] ${rangeInvalid ? 'border-red-400' : 'border-gray-200'}`} />
                {rangeInvalid && <p className="text-[11px] text-red-500 ml-0.5">End date can’t be before the start date.</p>}
              </div>
            </div>

            {/* Quick overview of all semesters for this session */}
            <div className="px-5 pb-5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">This Session — All Semesters</p>
              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500">
                      <th className="text-left font-semibold px-4 py-2">Semester</th>
                      <th className="text-left font-semibold px-4 py-2">Start Date</th>
                      <th className="text-left font-semibold px-4 py-2">End Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SEMESTERS.map(n => (
                      <tr key={n} className={`border-t border-gray-50 ${activeSem === n ? 'bg-[#933d18]/5' : ''}`}>
                        <td className="px-4 py-2 font-semibold text-gray-700">Sem {n}</td>
                        <td className="px-4 py-2 text-gray-600">{isoToDisplay(cal[n]?.start_date) || <span className="text-gray-300">—</span>}</td>
                        <td className="px-4 py-2 text-gray-600">{isoToDisplay(cal[n]?.end_date) || <span className="text-gray-300">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
