import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import { Trash2, Plus, Check } from 'lucide-react'

// Who earns commission on one centre, and at what rate.
//
// A centre is created under exactly ONE super centre and that never changes —
// it decides whose centre it is, who sees it in My Centers, whose wallet it
// draws on. Who gets PAID on it is a different question: a centre may have come
// in through two super centres and the university may want to pay both. So this
// edits a list, not a number.
//
// Each action writes straight away rather than collecting a form and saving at
// the end: there is no draft worth losing here, and a half-saved list of
// percentages is worse than none.
export default function CommissionRecipients({ center, superCenters, rows, onClose, onSaved }) {
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const [addSC, setAddSC] = useState('')
  const [addPct, setAddPct] = useState('')
  const [edits, setEdits] = useState({})     // row id -> typed percent

  const taken = new Set(rows.map(r => r.super_center_id))
  const available = superCenters.filter(s => !taken.has(s.id) && s.id !== center.id)
  const nameOf = id => superCenters.find(s => s.id === id)?.center_name || '—'

  async function run(key, fn) {
    setBusy(key); setErr('')
    const { error } = await fn()
    setBusy('')
    if (error) {
      // The table arrives with add_commission_recipients.sql; say so rather
      // than reporting a bare Postgres error.
      setErr(/center_commissions|relation|does not exist/i.test(error.message || '')
        ? 'This needs a database update — run add_commission_recipients.sql in Supabase.'
        : error.message)
      return
    }
    await onSaved()
  }

  const addRow = () => {
    const pct = Number(addPct)
    if (!addSC) { setErr('Pick a super center.'); return }
    if (!(pct > 0 && pct <= 100)) { setErr('Percent must be between 0 and 100.'); return }
    run('add', () => supabase.from('center_commissions')
      .insert({ center_id: center.id, super_center_id: addSC, percent: pct }))
      .then(() => { setAddSC(''); setAddPct('') })
  }

  const saveRow = (row) => {
    const pct = Number(edits[row.id])
    if (!(pct > 0 && pct <= 100)) { setErr('Percent must be between 0 and 100.'); return }
    run(row.id, () => supabase.from('center_commissions').update({ percent: pct }).eq('id', row.id))
      .then(() => setEdits(p => { const n = { ...p }; delete n[row.id]; return n }))
  }

  const removeRow = (row) => {
    if (!confirm(`Stop paying ${nameOf(row.super_center_id)} commission on ${center.center_name}?`)) return
    run(row.id, () => supabase.from('center_commissions').delete().eq('id', row.id))
  }

  return (
    <Modal isOpen onClose={onClose} title={`Commission — ${center.center_name}`} size="lg">
      <div className="space-y-4">
        <p className="text-xs text-gray-500">
          This center belongs to <strong className="text-gray-700">{center.super_center_id ? nameOf(center.super_center_id) : 'no super center'}</strong>.
          Commission can go to any number of super centers — each at its own rate.
        </p>

        {err && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-3 py-2 text-sm">{err}</div>
        )}

        <div className="border border-gray-100 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-gray-400">Super Center</th>
                <th className="text-left px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-gray-400 w-32">Percent</th>
                <th className="w-20"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={3} className="text-center text-gray-400 py-6 text-sm">No one earns commission on this center yet.</td></tr>
              ) : rows.map(row => (
                <tr key={row.id} className="border-t border-gray-100">
                  <td className="px-3 py-2">
                    <span className="font-semibold text-gray-800">{nameOf(row.super_center_id)}</span>
                    {row.super_center_id === center.super_center_id && (
                      <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700">parent</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <input type="number" min="0" max="100"
                        value={edits[row.id] ?? row.percent}
                        onChange={e => setEdits(p => ({ ...p, [row.id]: e.target.value }))}
                        className="border border-gray-200 rounded-lg px-2 py-1 text-sm w-20 text-right focus:outline-none focus:border-[#933d18]" />
                      <span className="text-gray-400 text-xs">%</span>
                      {edits[row.id] !== undefined && Number(edits[row.id]) !== Number(row.percent) && (
                        <button onClick={() => saveRow(row)} disabled={busy === row.id}
                          title="Save" className="text-emerald-600 hover:text-emerald-700 disabled:opacity-40">
                          <Check size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => removeRow(row)} disabled={busy === row.id}
                      title="Remove" className="text-red-500 hover:text-red-700 disabled:opacity-40">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add another earner */}
        <div className="flex flex-wrap items-end gap-2 bg-gray-50 border border-gray-100 rounded-xl p-3">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">Add Super Center</label>
            <select value={addSC} onChange={e => setAddSC(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#933d18]">
              <option value="">— choose —</option>
              {available.map(s => (
                <option key={s.id} value={s.id}>{s.center_name}{s.center_code ? ` (${s.center_code})` : ''}</option>
              ))}
            </select>
          </div>
          <div className="w-28">
            <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">Percent</label>
            <input type="number" min="0" max="100" value={addPct} onChange={e => setAddPct(e.target.value)}
              placeholder="e.g. 10"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white text-right focus:outline-none focus:border-[#933d18]" />
          </div>
          <Button size="md" onClick={addRow} disabled={busy === 'add' || available.length === 0}>
            <Plus size={14} /> {busy === 'add' ? 'Adding…' : 'Add'}
          </Button>
        </div>
        {available.length === 0 && rows.length > 0 && (
          <p className="text-xs text-gray-400">Every super center already earns on this center.</p>
        )}
      </div>
    </Modal>
  )
}
