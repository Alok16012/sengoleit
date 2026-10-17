import { useEffect, useLayoutEffect, useRef, useState } from 'react'

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

// Where the caret lands after the n-th digit of `str` (0 = before the first).
function posAfterDigits(str, n) {
  if (n <= 0) return 0
  let seen = 0
  for (let i = 0; i < str.length; i++) {
    if (/\d/.test(str[i]) && ++seen === n) return i + 1
  }
  return str.length
}

const SEG_MAX = [2, 2, 4]

// An edit inside a date that already has both slashes: each part (dd / mm /
// yyyy) is edited where it is, so changing the day does not reflow the month
// and year or throw the caret to the end. A part that would grow past its
// length gives up the digit after the caret — typing over it — or, at the
// part's end, the keystroke is dropped.
function editSegments(raw, caret) {
  const parts = raw.split('/')
  let start = 0
  for (let i = 0; i < 3; i++) {
    const end = start + parts[i].length
    const digits = parts[i].replace(/\D/g, '')
    if (caret >= start && caret <= end && digits.length > SEG_MAX[i]) {
      const off = caret - start
      if (off < parts[i].length) {
        parts[i] = parts[i].slice(0, off) + parts[i].slice(off + 1)
      } else {
        parts[i] = parts[i].slice(0, off - 1)
        caret -= 1
      }
    }
    parts[i] = parts[i].replace(/\D/g, '').slice(0, SEG_MAX[i])
    start = end + 1
  }
  const text = parts.join('/')
  // A day or month just filled steps over its slash, ready for the next part.
  let seg = 0, segStart = 0
  for (let i = 0; i < 2; i++) {
    if (caret > segStart + parts[i].length) { segStart += parts[i].length + 1; seg = i + 1 }
  }
  if (seg < 2 && caret === segStart + parts[seg].length && parts[seg].length === SEG_MAX[seg]) caret += 1
  return { text, caret: Math.min(caret, text.length) }
}

const baseClass =
  `w-full bg-white border border-gray-200 rounded-xl py-2.5 px-3.5 text-sm text-gray-900 placeholder-gray-400
   focus:outline-none focus:ring-2 focus:ring-[#933d18]/20 focus:border-[#933d18] transition-all
   disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed
   read-only:bg-gray-50 read-only:text-gray-400 read-only:cursor-not-allowed read-only:focus:ring-0 read-only:focus:border-gray-200`

export default function DateInput({
  label, error, hint, className = '', value, onChange,
  min, max, type, bare, ...props
}) {
  const [text, setText] = useState(() => isoToDisplay(value))
  const inputRef = useRef(null)
  const caretRef = useRef(null)

  // Put the caret back where the edit left it — re-rendering a controlled
  // input whose text was changed by code sends it to the end.
  useLayoutEffect(() => {
    if (caretRef.current != null && inputRef.current && document.activeElement === inputRef.current) {
      inputRef.current.setSelectionRange(caretRef.current, caretRef.current)
    }
    caretRef.current = null
  })

  // Keep the visible text in sync when the form value changes from outside
  // (edit-mode load, reset, programmatic set).
  useEffect(() => {
    setText(isoToDisplay(value))
  }, [value])

  function handleChange(e) {
    const raw = e.target.value
    const caret = e.target.selectionStart ?? raw.length
    let formatted, nextCaret
    if (raw.length < text.length) {
      // Free deletion — the rest stays where it is.
      formatted = raw.replace(/[^\d/]/g, '').slice(0, 10)
      nextCaret = Math.min(caret, formatted.length)
    } else if ((raw.match(/\//g) || []).length === 2 && caret < raw.length) {
      // Typing inside a date that has its slashes: edit that part in place.
      ;({ text: formatted, caret: nextCaret } = editSegments(raw, caret))
    } else {
      // Typing a fresh date: slashes go in automatically.
      formatted = autoFormat(raw)
      nextCaret = posAfterDigits(formatted, raw.slice(0, caret).replace(/\D/g, '').length)
    }
    caretRef.current = nextCaret
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
      ref={inputRef}
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
