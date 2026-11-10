import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import Button from './ui/Button'
import { Plus, Trash2, Save } from 'lucide-react'
import { DEFAULT_RULES, fetchResultRules, slabLabel } from '../utils/resultConditions'

// Exam Section → Result Condition. Only the rule: wait N days after the form
// is entered, or pay the fast-track charge of a slab. The Result tab follows
// it — a result is not declared before then, and an early one asks for the
// charge at the moment it is saved.
const inputCls = 'px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#933d18] w-full'

export default function ResultConditions({ canEdit }) {
  const [missing, setMissing] = useState(false)   // add_result_conditions.sql not run
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    fetchResultRules().then(r => {
      if (!alive) return
      setMissing(!r)
      const v = r || DEFAULT_RULES
      setDraft({ standard_days: v.standard_days, fee_base: v.fee_base, slabs: (v.slabs || []).map(s => ({ ...s })) })
    })
    return () => { alive = false }
  }, [])

  // ── Rules ────────────────────────────────────────────────────────────────
  const setSlab = (i, k, v) => setDraft(d => ({ ...d, slabs: d.slabs.map((s, j) => j === i ? { ...s, [k]: v } : s) }))
  async function saveRules() {
    const days = Number(draft.standard_days)
    if (!(days >= 0)) return alert('Enter the number of days.')
    const slabs = draft.slabs.map(s => ({
      from: Number(s.from) || 0, to: Number(s.to) || 0,
      multiplier: Number(s.multiplier) || 0, extra: Number(s.extra) || 0,
    }))
      // A row with no charge at all would make an early result free.
      .filter(s => s.multiplier || s.extra)
      .sort((a, b) => b.from - a.from)
    if (slabs.some(s => s.from > s.to)) return alert('In every slab, "From day" must not be after "To day".')
    if (slabs.some(s => s.to >= days)) return alert(`A slab must end before day ${days} — from day ${days} the result is free.`)
    setSaving(true)
    const row = { id: 1, standard_days: days, fee_base: draft.fee_base, slabs, updated_at: new Date().toISOString() }
    const { error } = await supabase.from('result_rules').upsert(row)
    setSaving(false)
    if (error) return alert('Could not save: ' + error.message)
    setDraft({ ...row, slabs: slabs.map(s => ({ ...s })) })
    alert('Result condition saved.')
  }

  if (!draft) return <p className="text-center text-gray-400 py-12 text-sm">Loading…</p>

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

    </div>
  )
}
