import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Table, Thead, Tbody, Th, Td, Tr } from './ui/Table'
import Button from './ui/Button'
import Modal from './ui/Modal'
import { Search, Plus, Trash2, Save, Zap, X } from 'lucide-react'
import { formatDate } from '../utils/formatDate'
import { currentSemOf } from '../utils/reRegistration'
import {
  DEFAULT_RULES, fetchResultRules, fetchFastTrack, submittedOn, daysSince, readyOn,
  slabFor, slabLabel, chargeFor,
} from '../utils/resultConditions'

// Exam Section → Result Condition. The rule (wait N days after the form is
// submitted, or pay a fast-track charge by slab) and, per student, when the
// result may be declared — with the office's "allow early" for those who pay.
const inputCls = 'px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#933d18] w-full'

export default function ResultConditions({ students, canEdit }) {
  const [rules, setRules] = useState(null)        // null while loading
  const [missing, setMissing] = useState(false)   // add_result_conditions.sql not run
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)
  const [fast, setFast] = useState({})
  const [q, setQ] = useState('')
  const [tab, setTab] = useState('waiting')
  const [allow, setAllow] = useState(null)        // { student, sem, amount, note, slab, day, loading }

  useEffect(() => {
    let alive = true
    fetchResultRules().then(r => {
      if (!alive) return
      setMissing(!r)
      const v = r || DEFAULT_RULES
      setRules(v)
      setDraft({ standard_days: v.standard_days, fee_base: v.fee_base, slabs: (v.slabs || []).map(s => ({ ...s })) })
    })
    return () => { alive = false }
  }, [])

  const ids = useMemo(() => students.map(s => s.id), [students])
  useEffect(() => {
    let alive = true
    fetchFastTrack(ids).then(m => { if (alive) setFast(m) })
    return () => { alive = false }
  }, [ids])

  const rowsOf = s => {
    const day = daysSince(submittedOn(s))
    const sem = currentSemOf(s)
    const allowed = fast[`${s.id}__${sem}`]
    const ready = rules ? readyOn(submittedOn(s), rules) : null
    const isReady = day == null || !rules || day >= Number(rules.standard_days)
    const state = isReady ? 'ready' : allowed ? 'allowed' : 'waiting'
    return { s, day, sem, allowed, ready, state, slab: rules && !isReady ? slabFor(rules, day) : null }
  }
  const all = useMemo(() => students.map(rowsOf), [students, rules, fast])   // eslint-disable-line react-hooks/exhaustive-deps
  const counts = { waiting: 0, allowed: 0, ready: 0, all: all.length }
  all.forEach(r => { counts[r.state]++ })
  const term = q.trim().toLowerCase()
  const shown = all
    .filter(r => tab === 'all' || r.state === tab)
    .filter(r => !term || `${r.s.student_name} ${r.s.enrollment_no || ''} ${r.s.programs?.program_name || ''} ${r.s.centers?.center_name || ''}`.toLowerCase().includes(term))

  // ── Rules ────────────────────────────────────────────────────────────────
  const setSlab = (i, k, v) => setDraft(d => ({ ...d, slabs: d.slabs.map((s, j) => j === i ? { ...s, [k]: v } : s) }))
  async function saveRules() {
    const days = Number(draft.standard_days)
    if (!(days >= 0)) return alert('Enter the number of days.')
    const slabs = draft.slabs.map(s => ({
      from: Number(s.from) || 0, to: Number(s.to) || 0,
      multiplier: Number(s.multiplier) || 0, extra: Number(s.extra) || 0,
    })).sort((a, b) => b.from - a.from)
    if (slabs.some(s => s.from > s.to)) return alert('In every slab, "From day" must not be after "To day".')
    if (slabs.some(s => s.to >= days)) return alert(`A slab must end before day ${days} — from day ${days} the result is free.`)
    setSaving(true)
    const row = { id: 1, standard_days: days, fee_base: draft.fee_base, slabs, updated_at: new Date().toISOString() }
    const { error } = await supabase.from('result_rules').upsert(row)
    setSaving(false)
    if (error) return alert('Could not save: ' + error.message)
    setRules(row); setDraft({ ...row, slabs: slabs.map(s => ({ ...s })) })
    alert('Result condition saved.')
  }

  // ── Allow early ──────────────────────────────────────────────────────────
  async function openAllow(r) {
    setAllow({ student: r.s, sem: r.sem, day: r.day, slab: r.slab, amount: '', note: '', loading: true })
    const amount = await chargeFor(r.s, r.sem, rules, r.slab)
    setAllow(a => a && a.student.id === r.s.id ? { ...a, amount: String(amount), loading: false } : a)
  }
  async function saveAllow() {
    const a = allow
    const sem = Number(a.sem)
    if (!(sem >= 1)) return alert('Enter the semester.')
    setSaving(true)
    const { data, error } = await supabase.from('result_fast_track').upsert({
      student_id: a.student.id, semester: sem, allowed_day: a.day,
      amount: Number(a.amount) || 0, note: a.note.trim() || null,
    }, { onConflict: 'student_id,semester' }).select().single()
    setSaving(false)
    if (error) return alert('Could not save: ' + error.message)
    setFast(m => ({ ...m, [`${a.student.id}__${sem}`]: data }))
    setAllow(null)
  }
  async function revoke(r) {
    if (!confirm(`Take back the early result allowed for ${r.s.student_name} (Semester ${r.sem})?`)) return
    const { error } = await supabase.from('result_fast_track').delete().eq('id', r.allowed.id)
    if (error) return alert('Could not remove: ' + error.message)
    setFast(m => { const n = { ...m }; delete n[`${r.s.id}__${r.sem}`]; return n })
  }

  if (!draft) return <p className="text-center text-gray-400 py-12 text-sm">Loading…</p>

  const rupee = n => `₹${Number(n || 0).toLocaleString('en-IN')}`

  return (
    <div className="space-y-5">
      {missing && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Result Condition needs a database update — run <b>add_result_conditions.sql</b> in Supabase → SQL Editor. Until then no condition is applied.
        </div>
      )}

      {/* Rule */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">Result after (days from form submission)</label>
            <input type="number" min="0" value={draft.standard_days} disabled={!canEdit}
              onChange={e => setDraft(d => ({ ...d, standard_days: e.target.value }))} className={`${inputCls} w-28`} />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">Fast-track charge is a multiple of</label>
            <select value={draft.fee_base} disabled={!canEdit} onChange={e => setDraft(d => ({ ...d, fee_base: e.target.value }))} className={`${inputCls} bg-white w-48`}>
              <option value="semester">Semester fee</option>
              <option value="course">Full course fee</option>
            </select>
          </div>
          <p className="text-xs text-gray-500 flex-1 min-w-[220px]">
            From day <b>{draft.standard_days || 0}</b> after the form was submitted the result is declared at no charge. Earlier, it needs the fast-track charge of its slab:
            <b> charge = multiplier × fee + extra</b>.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-gray-400 text-left">
                <th className="py-1.5 pr-3 font-bold">Result wanted on day — from</th>
                <th className="py-1.5 pr-3 font-bold">to</th>
                <th className="py-1.5 pr-3 font-bold">Multiplier (× fee)</th>
                <th className="py-1.5 pr-3 font-bold">Extra (₹)</th>
                <th className="py-1.5 pr-3 font-bold">Charge</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {draft.slabs.map((s, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="py-2 pr-3 w-32"><input type="number" min="0" value={s.from} disabled={!canEdit} onChange={e => setSlab(i, 'from', e.target.value)} className={inputCls} /></td>
                  <td className="py-2 pr-3 w-32"><input type="number" min="0" value={s.to} disabled={!canEdit} onChange={e => setSlab(i, 'to', e.target.value)} className={inputCls} /></td>
                  <td className="py-2 pr-3 w-36"><input type="number" min="0" step="0.5" value={s.multiplier} disabled={!canEdit} onChange={e => setSlab(i, 'multiplier', e.target.value)} className={inputCls} /></td>
                  <td className="py-2 pr-3 w-36"><input type="number" min="0" value={s.extra} disabled={!canEdit} onChange={e => setSlab(i, 'extra', e.target.value)} className={inputCls} /></td>
                  <td className="py-2 pr-3 text-xs text-gray-600">{slabLabel({ multiplier: Number(s.multiplier), extra: Number(s.extra) }, draft)}</td>
                  <td className="py-2 text-right">
                    {canEdit && <button onClick={() => setDraft(d => ({ ...d, slabs: d.slabs.filter((_, j) => j !== i) }))} title="Remove slab" className="text-gray-300 hover:text-red-500"><Trash2 size={15} /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {canEdit && (
          <div className="flex justify-between gap-2">
            <Button variant="secondary" size="sm" onClick={() => setDraft(d => ({ ...d, slabs: [...d.slabs, { from: 0, to: 0, multiplier: 1, extra: 0 }] }))}>
              <Plus size={14} /> Add slab
            </Button>
            <Button size="sm" onClick={saveRules} disabled={saving || missing}><Save size={14} /> {saving ? 'Saving…' : 'Save Condition'}</Button>
          </div>
        )}
      </div>

      {/* Students */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          {[
            ['waiting', 'Waiting', 'bg-amber-500 text-white', 'bg-amber-50 text-amber-700'],
            ['allowed', 'Early Allowed', 'bg-indigo-600 text-white', 'bg-indigo-50 text-indigo-700'],
            ['ready', 'Ready', 'bg-emerald-600 text-white', 'bg-emerald-50 text-emerald-700'],
            ['all', 'All', 'bg-gray-800 text-white', 'bg-gray-100 text-gray-600'],
          ].map(([k, label, on, off]) => (
            <button key={k} onClick={() => setTab(k)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold ${tab === k ? on : off}`}>
              {label} <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/30">{counts[k]}</span>
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-sm min-w-[220px] ml-auto">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name, enrollment, course, center…"
            className="w-full pl-9 pr-8 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#933d18]" />
          {q && <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"><X size={14} /></button>}
        </div>
      </div>

      <Table>
        <Thead>
          <tr>
            <Th>#</Th><Th>Student Name</Th><Th>Program</Th><Th>Center</Th><Th>Form Submitted</Th>
            <Th>Day</Th><Th>Result From</Th><Th>Status</Th><Th>Action</Th>
          </tr>
        </Thead>
        <Tbody>
          {shown.length === 0 ? (
            <Tr><Td colSpan={9} className="text-center text-gray-400 py-12">Nothing to show.</Td></Tr>
          ) : shown.map((r, i) => (
            <Tr key={r.s.id}>
              <Td className="text-gray-400 text-xs w-10">{i + 1}</Td>
              <Td>
                <p className="font-semibold text-gray-900">{r.s.student_name}</p>
                <p className="text-xs text-gray-400 font-mono">{r.s.enrollment_no || '—'}</p>
              </Td>
              <Td className="text-gray-500 text-xs min-w-[160px] whitespace-normal">{r.s.programs?.program_name || '—'} <span className="text-gray-400">· Sem {r.sem}</span></Td>
              <Td className="text-xs text-gray-600">{r.s.centers?.center_name || '—'}</Td>
              <Td className="text-xs text-gray-600">{submittedOn(r.s) ? formatDate(submittedOn(r.s)) : '—'}</Td>
              <Td className="text-xs font-bold text-gray-700">{r.day ?? '—'}</Td>
              <Td className="text-xs text-gray-600">{r.ready ? formatDate(r.ready) : '—'}</Td>
              <Td>
                {r.state === 'ready' ? (
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">Ready</span>
                ) : r.state === 'allowed' ? (
                  <div>
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700">Early allowed · Sem {r.sem}</span>
                    <p className="text-[11px] text-gray-500 mt-1">Charged {rupee(r.allowed.amount)}{r.allowed.note ? ` · ${r.allowed.note}` : ''}</p>
                  </div>
                ) : (
                  <div>
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700">
                      Waits {Number(rules.standard_days) - r.day} day{Number(rules.standard_days) - r.day === 1 ? '' : 's'}
                    </span>
                    <p className="text-[11px] text-gray-500 mt-1">Early today: {r.slab ? slabLabel(r.slab, rules) : 'no slab set'}</p>
                  </div>
                )}
              </Td>
              <Td>
                {canEdit && r.state === 'waiting' && (
                  <Button size="sm" variant="secondary" onClick={() => openAllow(r)} disabled={missing}><Zap size={13} /> Allow Early</Button>
                )}
                {canEdit && r.state === 'allowed' && (
                  <button onClick={() => revoke(r)} className="text-xs font-semibold text-red-500 hover:text-red-700">Take back</button>
                )}
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>

      <Modal isOpen={!!allow} onClose={() => !saving && setAllow(null)} title="Allow Early Result" size="sm" allowMaximize={false}>
        {allow && (
          <div className="space-y-4">
            <div className="rounded-xl bg-gray-50 border border-gray-200 p-3 text-sm space-y-1">
              <p className="font-semibold text-gray-900">{allow.student.student_name}</p>
              <p className="text-xs text-gray-500">Form submitted {formatDate(submittedOn(allow.student))} · today is day {allow.day}</p>
              <p className="text-xs text-gray-500">Slab: <b>{allow.slab ? `day ${allow.slab.from}–${allow.slab.to} · ${slabLabel(allow.slab, rules)}` : 'none set for this day'}</b></p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">Semester</label>
                <input type="number" min="1" value={allow.sem} onChange={e => setAllow(a => ({ ...a, sem: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">Fast-track charge (₹)</label>
                <input type="number" min="0" value={allow.loading ? '' : allow.amount} placeholder={allow.loading ? 'Working out…' : ''}
                  onChange={e => setAllow(a => ({ ...a, amount: e.target.value }))} className={inputCls} />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-500 mb-1">Note (receipt no., mode of payment…)</label>
              <input value={allow.note} onChange={e => setAllow(a => ({ ...a, note: e.target.value }))} className={inputCls} />
            </div>
            <p className="text-[11px] text-gray-400">Record this once the charge is paid. The result for this semester can then be declared straight away.</p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setAllow(null)} disabled={saving}>Cancel</Button>
              <Button onClick={saveAllow} disabled={saving || allow.loading}><Zap size={14} /> {saving ? 'Saving…' : 'Allow Early Result'}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
