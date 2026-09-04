import { useState } from 'react'
import { Calculator, ChevronDown, X } from 'lucide-react'

const fmt = n => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

// A scratch pad on the fee editor: put a percentage in, read the semester-wise
// answer out.
//
// It is DELIBERATELY not wired to anything. Nothing here is saved, nothing
// reaches a centre or a student, and nothing appears in the PDF — it exists so
// the numbers can be worked out on the same screen they came from, instead of
// on a phone calculator beside it.
//
// Three readings of "a percentage of the fee" all come up in practice, so the
// mode is asked rather than guessed:
//   share    — what X% of the fee comes to (a centre's share, a commission)
//   increase — the fee after adding X% (next year's revision)
//   discount — the fee after taking X% off (a concession)
// The fourth column has to change with the mode. A share of ₹2,300 at 10% is
// ₹230, and calling the gap to the full fee a "difference" of −₹2,070 reads as
// a loss; what is actually wanted there is what is LEFT after the share.
const MODES = [
  { key: 'share',    label: 'Share',    hint: 'X% of the fee', lastCol: 'Remaining',
    calc: (b, p) => b * p / 100,        last: (b, out) => b - out, signed: false },
  { key: 'increase', label: 'Increase', hint: 'fee + X%',      lastCol: 'Difference',
    calc: (b, p) => b * (1 + p / 100),  last: (b, out) => out - b, signed: true },
  { key: 'discount', label: 'Discount', hint: 'fee − X%',      lastCol: 'Difference',
    calc: (b, p) => b * (1 - p / 100),  last: (b, out) => out - b, signed: true },
]

export default function FeeCalculator({ semAmounts = [], grandTotal = 0 }) {
  const [open, setOpen] = useState(false)
  const [pct, setPct] = useState('')
  const [mode, setMode] = useState('share')

  const p = parseFloat(pct)
  const valid = !isNaN(p)
  const m = MODES.find(x => x.key === mode) || MODES[0]
  const run = (base) => m.calc(Number(base) || 0, p)
  const total = semAmounts.reduce((s, a) => s + (Number(a) || 0), 0)

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm mb-6 overflow-hidden">
      <button type="button" onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-5 py-3 group">
        <Calculator size={15} className="text-[#933d18]" />
        <span className="font-bold text-gray-800 text-sm">Fee Calculator</span>
        <span className="text-[11px] text-gray-400 font-medium">— only you see this, nothing is saved</span>
        <ChevronDown size={15}
          className={`ml-auto text-gray-400 group-hover:text-[#933d18] transition-transform ${open ? '' : '-rotate-90'}`} />
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-gray-100 pt-4">
          <div className="flex flex-wrap items-end gap-3 mb-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">Percentage</label>
              <div className="flex items-center gap-1">
                <input type="number" value={pct} onChange={e => setPct(e.target.value)}
                  placeholder="e.g. 10" autoFocus
                  className="w-28 border border-gray-200 rounded-xl px-3 py-2 text-sm text-right focus:outline-none focus:border-[#933d18] focus:ring-2 focus:ring-[#933d18]/10" />
                <span className="text-gray-400 text-sm">%</span>
                {pct !== '' && (
                  <button onClick={() => setPct('')} title="Clear"
                    className="text-gray-300 hover:text-red-500 ml-1"><X size={14} /></button>
                )}
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">Calculate</label>
              <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
                {MODES.map(x => (
                  <button key={x.key} onClick={() => setMode(x.key)} title={x.hint}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      mode === x.key ? 'bg-white text-[#933d18] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                    {x.label}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-gray-400 pb-2">{m.hint}</p>
          </div>

          {!valid ? (
            <p className="text-sm text-gray-400 py-6 text-center bg-gray-50 rounded-xl">
              Enter a percentage to see it worked out semester by semester.
            </p>
          ) : (
            <div className="overflow-x-auto border border-gray-100 rounded-xl">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-800">
                    <th className="text-left text-white font-semibold px-4 py-2.5">Semester</th>
                    <th className="text-right text-white font-semibold px-4 py-2.5">Current Fee</th>
                    <th className="text-right text-white font-semibold px-4 py-2.5 whitespace-nowrap">
                      {m.label} @ {p}%
                    </th>
                    <th className="text-right text-white font-semibold px-4 py-2.5 whitespace-nowrap">{m.lastCol}</th>
                  </tr>
                </thead>
                <tbody>
                  {semAmounts.map((base, i) => {
                    const out = run(base)
                    const diff = m.last(Number(base) || 0, out)
                    return (
                      <tr key={i} className={i % 2 === 0 ? 'bg-gray-50/60' : 'bg-white'}>
                        <td className="px-4 py-2 font-medium text-gray-700">Sem {i + 1}</td>
                        <td className="px-4 py-2 text-right text-gray-600">₹{fmt(base)}</td>
                        <td className="px-4 py-2 text-right font-bold text-[#933d18]">₹{fmt(out)}</td>
                        <td className={`px-4 py-2 text-right font-semibold ${
                          !m.signed ? 'text-gray-600' : diff < 0 ? 'text-red-600' : diff > 0 ? 'text-emerald-700' : 'text-gray-300'}`}>
                          {diff === 0 ? '—'
                            : m.signed ? `${diff > 0 ? '+' : '−'}₹${fmt(Math.abs(diff))}`
                            : `₹${fmt(diff)}`}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-800 border-t-2 border-gray-700">
                    <td className="px-4 py-2.5 font-black text-white">Course Total</td>
                    <td className="px-4 py-2.5 text-right font-black text-white">₹{fmt(total)}</td>
                    <td className="px-4 py-2.5 text-right font-black text-emerald-400">₹{fmt(run(total))}</td>
                    <td className="px-4 py-2.5 text-right font-black text-gray-300">
                      {(() => {
                        const d = m.last(total, run(total))
                        if (d === 0) return '—'
                        return m.signed ? `${d > 0 ? '+' : '−'}₹${fmt(Math.abs(d))}` : `₹${fmt(d)}`
                      })()}
                    </td>
                  </tr>
                </tfoot>
              </table>
              {Math.abs(total - grandTotal) > 0.5 && (
                // The semester column and the sheet's own Grand Total are built
                // by different sums; if they ever drift, say so rather than
                // quietly showing two different numbers on one screen.
                <p className="text-[11px] text-amber-700 bg-amber-50 px-4 py-2">
                  Heads up: these semesters add to ₹{fmt(total)}, but the sheet&apos;s Grand Total is ₹{fmt(grandTotal)}.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
