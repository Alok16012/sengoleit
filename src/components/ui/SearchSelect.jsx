import { useEffect, useRef, useState } from 'react'
import { Search, ChevronDown, Check } from 'lucide-react'

/* Searchable single-select dropdown. value 'all' = show everything. */
export function SearchableSelect({ label, allLabel, value, onChange, options, minWidth = 170 }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setQ('') } }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const selected = options.find(o => o.id === value)
  const text = value === 'all' ? allLabel : (selected?.label || allLabel)
  const filtered = options.filter(o => o.label.toLowerCase().includes(q.toLowerCase()))

  function pick(id) { onChange(id); setOpen(false); setQ('') }

  return (
    <div ref={ref} className="relative" style={{ minWidth }}>
      <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">{label}</label>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#933d18]/20">
        <span className="truncate">{text}</span>
        <ChevronDown size={15} className={`shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          <div className="relative p-2 border-b border-gray-100">
            <Search size={13} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search..."
              className="w-full pl-7 pr-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#933d18]" />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            <button type="button" onClick={() => pick('all')}
              className={`w-full flex items-center justify-between text-left px-3 py-2 text-sm hover:bg-gray-50 ${value === 'all' ? 'text-[#933d18] font-semibold' : 'text-gray-700'}`}>
              {allLabel} {value === 'all' && <Check size={14} />}
            </button>
            {filtered.map(o => (
              <button key={o.id} type="button" onClick={() => pick(o.id)}
                className={`w-full flex items-center justify-between text-left px-3 py-2 text-sm hover:bg-gray-50 ${value === o.id ? 'text-[#933d18] font-semibold' : 'text-gray-700'}`}>
                <span className="truncate">{o.label}</span> {value === o.id && <Check size={14} className="shrink-0" />}
              </button>
            ))}
            {filtered.length === 0 && <div className="px-3 py-3 text-xs text-gray-400 text-center">No matches</div>}
          </div>
        </div>
      )}
    </div>
  )
}

/* Searchable multi-select dropdown. Empty array = all. */
export function MultiSearchSelect({ label, allLabel, values, onChange, options, minWidth = 170 }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setQ('') } }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const filtered = options.filter(o => o.label.toLowerCase().includes(q.toLowerCase()))
  const text = values.length === 0
    ? allLabel
    : values.length === 1
      ? (options.find(o => o.id === values[0])?.label || `${values.length} selected`)
      : `${values.length} selected`

  function toggle(id) {
    onChange(values.includes(id) ? values.filter(v => v !== id) : [...values, id])
  }

  return (
    <div ref={ref} className="relative" style={{ minWidth }}>
      <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-1">{label}</label>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#933d18]/20">
        <span className="truncate">{text}</span>
        <ChevronDown size={15} className={`shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          <div className="relative p-2 border-b border-gray-100">
            <Search size={13} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search..."
              className="w-full pl-7 pr-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-[#933d18]" />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            <button type="button" onClick={() => onChange([])}
              className={`w-full flex items-center justify-between text-left px-3 py-2 text-sm hover:bg-gray-50 ${values.length === 0 ? 'text-[#933d18] font-semibold' : 'text-gray-700'}`}>
              {allLabel} {values.length === 0 && <Check size={14} />}
            </button>
            {filtered.map(o => {
              const on = values.includes(o.id)
              return (
                <button key={o.id} type="button" onClick={() => toggle(o.id)}
                  className={`w-full flex items-center gap-2 text-left px-3 py-2 text-sm hover:bg-gray-50 ${on ? 'text-[#933d18] font-semibold' : 'text-gray-700'}`}>
                  <span className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center ${on ? 'bg-[#933d18] border-[#933d18]' : 'border-gray-300'}`}>
                    {on && <Check size={11} className="text-white" />}
                  </span>
                  <span className="truncate">{o.label}</span>
                </button>
              )
            })}
            {filtered.length === 0 && <div className="px-3 py-3 text-xs text-gray-400 text-center">No matches</div>}
          </div>
        </div>
      )}
    </div>
  )
}
