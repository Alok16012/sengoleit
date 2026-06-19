import { useEffect, useState } from 'react'

// A date field where the user TYPES in dd/mm/yyyy (Indian style), but the
// value handed back to the form stays as an ISO yyyy-mm-dd string so the
// database, validation and existing logic keep working unchanged.
//
// Drop-in for <Input type="date" value={iso} onChange={set('field')} />:
// onChange is called event-style with { target: { value: iso } }.
// Pass `bare` to render just the <input> (no label wrapper) for forms that
// supply their own label/field markup.

export function isoToDisplay(iso) {
  if (!iso) return ''
  const s = String(iso).slice(0, 10)
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : ''
}

export function parseDisplayToIso(text) {
  const m = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return null
  const dd = +m[1], mm = +m[2], yyyy = +m[3]
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null
  const d = new Date(yyyy, mm - 1, dd)
  if (d.getFullYear() !== yyyy || d.getMonth() !== mm - 1 || d.getDate() !== dd) return null
  return `${m[3]}-${m[2]}-${m[1]}`
}

function autoFormat(raw) {
  const dg = raw.replace(/\D/g, '').slice(0, 8)
  let out = dg.slice(0, 2)
  if (dg.length >= 3) out += '/' + dg.slice(2, 4)
  if (dg.length >= 5) out += '/' + dg.slice(4, 8)
  return out
}

const baseClass =
  `w-full bg-white border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm text-gray-900 placeholder-gray-400
   focus:outline-none focus:ring-2 focus:ring-[#933d18]/20 focus:border-[#933d18] transition-all
   disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed`

export default function DateInput({
  label, error, hint, className = '', value, onChange,
  min, max, type, bare, ...props
}) {
  const [text, setText] = useState(() => isoToDisplay(value))

  // Keep the visible text in sync when the form value changes from outside
  // (edit-mode load, reset, programmatic set).
  useEffect(() => {
    setText(isoToDisplay(value))
  }, [value])

  function handleChange(e) {
    const raw = e.target.value
    // Allow free deletion; only auto-insert slashes while typing forward.
    const formatted =
      raw.length < text.length ? raw.replace(/[^\d/]/g, '').slice(0, 10) : autoFormat(raw)
    setText(formatted)

    const iso = parseDisplayToIso(formatted)
    if (iso) {
      if ((min && iso < min) || (max && iso > max)) return // outside allowed range
      onChange?.({ target: { value: iso } })
    } else if (formatted === '') {
      onChange?.({ target: { value: '' } })
    }
  }

  function handleBlur() {
    // If the user left an incomplete/invalid value, restore the last good one.
    if (text !== '' && !parseDisplayToIso(text)) setText(isoToDisplay(value))
  }

  const inputEl = (
    <input
      type="text"
      inputMode="numeric"
      placeholder="DD/MM/YYYY"
      maxLength={10}
      value={text}
      onChange={handleChange}
      onBlur={handleBlur}
      className={
        bare
          ? className
          : `${baseClass} ${error ? 'border-red-400 focus:border-red-500 focus:ring-red-100 bg-red-50/30' : ''} ${className}`
      }
      {...props}
    />
  )

  if (bare) return inputEl

  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-semibold text-gray-600 ml-0.5">{label}</label>}
      {inputEl}
      {hint && !error && <p className="text-[11px] text-gray-400 ml-0.5">{hint}</p>}
      {error && <p className="text-[11px] text-red-500 ml-0.5 flex items-center gap-1">⚠ {error}</p>}
    </div>
  )
}
