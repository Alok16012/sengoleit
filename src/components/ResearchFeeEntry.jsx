import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Button from './ui/Button'
import { Save } from 'lucide-react'
import { isPhdStudent } from '../utils/isPhdStudent'

// Research Dept → Fee Entry. The Ph.D fee a centre pays the university, set
// here instead of Fee Management × Center Sharing %. Per programme, for every
// session (the fallback) or for one session. Never less than `minFee` — the
// highest Payment Condition amount, i.e. what all the documents need paid.
export default function ResearchFeeEntry({ sessions, minFee, canEdit }) {
  const [programs, setPrograms] = useState([])
  const [rows, setRows] = useState(null)        // [{ id, program_id, session_id, fee }]
  const [missing, setMissing] = useState(false)
  const [sessionId, setSessionId] = useState('all')
  const [draft, setDraft] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from('programs').select('id, program_name, programme_types(programme_type_name)').order('program_name')
      .then(({ data }) => setPrograms((data || []).filter(p => isPhdStudent({ programs: p }))))
    supabase.from('research_fees').select('id, program_id, session_id, fee').then(({ data, error }) => {
      setMissing(!!error)
      setRows(data || [])
    })
  }, [])

  const keyOf = (pid, sid) => `${pid}:${sid === 'all' ? 'all' : sid}`
  const stored = (pid, sid) => (rows || []).find(r => r.id === keyOf(pid, sid))
  const fallback = pid => stored(pid, 'all')

  // Typed values per session; an untouched box shows what is saved.
  const valueOf = pid => {
    const typed = draft[sessionId]?.[pid]
    if (typed != null) return typed
    const r = stored(pid, sessionId)
    return r ? String(Math.round(Number(r.fee))) : ''
  }
  const setValue = (pid, v) => setDraft(d => ({ ...d, [sessionId]: { ...(d[sessionId] || {}), [pid]: v } }))

  async function save() {
    const upserts = [], removes = []
    for (const p of programs) {
      const raw = String(valueOf(p.id)).trim()
      if (raw === '') { if (stored(p.id, sessionId)) removes.push(keyOf(p.id, sessionId)); continue }
      const fee = Math.round(Number(raw))
      if (!Number.isFinite(fee) || fee < 0) return alert(`Enter a valid fee for ${p.program_name}.`)
      if (fee < minFee) {
        return alert(`${p.program_name}: ₹${fee.toLocaleString('en-IN')} is less than ₹${minFee.toLocaleString('en-IN')} — the highest amount in Payment Condition, which every document needs paid.\n\nSet a fee of at least ₹${minFee.toLocaleString('en-IN')}.`)
      }
      upserts.push({ id: keyOf(p.id, sessionId), program_id: p.id, session_id: sessionId === 'all' ? null : sessionId, fee, updated_at: new Date().toISOString() })
    }
    setSaving(true)
    if (upserts.length) {
      const { error } = await supabase.from('research_fees').upsert(upserts, { onConflict: 'id' })
      if (error) { setSaving(false); return alert('Could not save: ' + error.message) }
    }
    if (removes.length) {
      const { error } = await supabase.from('research_fees').delete().in('id', removes)
      if (error) { setSaving(false); return alert('Could not clear: ' + error.message) }
    }
    setSaving(false)
    setDraft(d => ({ ...d, [sessionId]: {} }))
    setRows(prev => [...(prev || []).filter(r => !removes.includes(r.id) && !upserts.some(u => u.id === r.id)), ...upserts])
    alert('Ph.D fee saved.')
  }

  if (rows == null) return <p className="text-center text-gray-400 py-12 text-sm">Loading…</p>

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4 max-w-3xl">
      {missing && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Fee Entry needs a database update — run <b>add_research_fees.sql</b> in Supabase → SQL Editor. Until then the Ph.D fee comes from Fee Management.
        </div>
      )}
      <div>
        <p className="text-sm font-bold text-gray-900">Fee Entry — Ph.D</p>
        <p className="text-xs text-gray-500 mt-0.5">
          The whole Ph.D fee the centre pays the university. It replaces Fee Management and the centre's sharing for these
          programmes. It cannot be less than <b>₹{minFee.toLocaleString('en-IN')}</b>, the highest amount in Payment Condition.
          Leave a box empty to use the all-sessions fee (or Fee Management if none).
        </p>
      </div>
      <div>
        <label className="block text-[11px] font-semibold text-gray-500 mb-1">Session</label>
        <select value={sessionId} onChange={e => setSessionId(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white w-72 focus:outline-none focus:border-[#933d18]">
          <option value="all">All Sessions (fallback)</option>
          {sessions.map(s => <option key={s.id} value={s.id}>{s.session_name}</option>)}
        </select>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[11px] uppercase tracking-wide text-gray-400 text-left">
            <th className="py-1.5 font-bold">Programme</th>
            <th className="py-1.5 font-bold w-56">Fee (₹)</th>
          </tr>
        </thead>
        <tbody>
          {programs.length === 0 && (
            <tr><td colSpan={2} className="py-6 text-center text-gray-400">No Ph.D programme found.</td></tr>
          )}
          {programs.map(p => {
            const fb = sessionId !== 'all' ? fallback(p.id) : null
            const val = Number(valueOf(p.id))
            const low = String(valueOf(p.id)).trim() !== '' && val < minFee
            return (
              <tr key={p.id} className="border-t border-gray-100">
                <td className="py-2.5 font-semibold text-gray-800">{p.program_name}</td>
                <td className="py-2">
                  <input type="number" min={minFee} value={valueOf(p.id)} disabled={!canEdit}
                    placeholder={fb ? `All sessions: ${Math.round(fb.fee)}` : 'Fee Management'}
                    onChange={e => setValue(p.id, e.target.value)}
                    className={`w-full px-2.5 py-1.5 border rounded-lg text-sm focus:outline-none focus:border-[#933d18] ${low ? 'border-red-300 bg-red-50' : 'border-gray-200'}`} />
                  {low && <p className="text-[10px] text-red-600 mt-0.5">At least ₹{minFee.toLocaleString('en-IN')}</p>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {canEdit && (
        <div className="flex justify-end">
          <Button size="sm" onClick={save} disabled={saving || missing}><Save size={14} /> {saving ? 'Saving…' : 'Save Fee'}</Button>
        </div>
      )}
    </div>
  )
}
