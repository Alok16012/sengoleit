import { useState } from 'react'
import { supabase } from '../lib/supabase'
import Button from './ui/Button'
import { Save } from 'lucide-react'

// Research Dept → Payment Condition. For each document the candidate is
// issued, the least fee they must have paid first. 0 = no condition.
export default function ResearchPaymentConditions({ docs, rules, missing, canEdit, onSaved }) {
  const [draft, setDraft] = useState(() => Object.fromEntries(docs.map(d => [d, rules[d] != null ? String(rules[d]) : '0'])))
  const [saving, setSaving] = useState(false)

  async function save() {
    const rows = docs.map(d => ({ doc: d, min_fee: Math.max(Number(draft[d]) || 0, 0), updated_at: new Date().toISOString() }))
    setSaving(true)
    const { error } = await supabase.from('research_payment_rules').upsert(rows, { onConflict: 'doc' })
    setSaving(false)
    if (error) return alert('Could not save: ' + error.message)
    onSaved(Object.fromEntries(rows.map(r => [r.doc, r.min_fee])))
    alert('Payment condition saved.')
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4 max-w-2xl">
      {missing && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Payment Condition needs a database update — run <b>add_research_payment_rules.sql</b> in Supabase → SQL Editor. Until then no condition is applied.
        </div>
      )}
      <div>
        <p className="text-sm font-bold text-gray-900">Payment Condition</p>
        <p className="text-xs text-gray-500 mt-0.5">The least fee a candidate must have paid before each document is issued. 0 means no condition. A document already issued can always be printed again.</p>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[11px] uppercase tracking-wide text-gray-400 text-left">
            <th className="py-1.5 font-bold">Document</th>
            <th className="py-1.5 font-bold w-56">Minimum fee paid (₹)</th>
          </tr>
        </thead>
        <tbody>
          {docs.map(d => (
            <tr key={d} className="border-t border-gray-100">
              <td className="py-2.5 font-semibold text-gray-800">{d}</td>
              <td className="py-2">
                <input type="number" min="0" value={draft[d]} disabled={!canEdit}
                  onChange={e => setDraft(x => ({ ...x, [d]: e.target.value }))}
                  className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#933d18]" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {canEdit && (
        <div className="flex justify-end">
          <Button size="sm" onClick={save} disabled={saving || missing}><Save size={14} /> {saving ? 'Saving…' : 'Save Condition'}</Button>
        </div>
      )}
    </div>
  )
}
