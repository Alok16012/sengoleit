import { useState } from 'react'
import { createPortal } from 'react-dom'

// Text cut short in a table cell, shown in full in a box the moment the
// pointer rests on it. The box is drawn on the page body at a fixed position,
// so a table that scrolls or clips its cells cannot cut it off. A tap does the
// same on a phone.
export default function HoverText({ text, className = '', empty = '—' }) {
  const [at, setAt] = useState(null)   // { x, y, below } while shown
  const value = String(text ?? '').trim()
  if (!value) return <span className={className}>{empty}</span>

  const show = e => {
    const r = e.currentTarget.getBoundingClientRect()
    const below = r.top < 160
    setAt({ x: Math.min(Math.max(r.left, 12), window.innerWidth - 332), y: below ? r.bottom + 6 : r.top - 6, below })
  }

  return (
    <>
      <span className={`block truncate cursor-help ${className}`}
        onMouseEnter={show} onMouseLeave={() => setAt(null)}
        onClick={e => (at ? setAt(null) : show(e))}>
        {value}
      </span>
      {at && createPortal(
        <div style={{ left: at.x, top: at.y, transform: at.below ? 'none' : 'translateY(-100%)' }}
          className="fixed z-[100] max-w-[320px] rounded-xl bg-gray-900 text-white text-xs leading-relaxed px-3 py-2 shadow-xl whitespace-pre-wrap break-words pointer-events-none">
          {value}
        </div>,
        document.body,
      )}
    </>
  )
}
