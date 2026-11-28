import { useRef } from 'react'

// Press and drag anywhere on a wide table to scroll it sideways — the cursor
// is an arrow, not the text cursor, and a grabbing hand while dragging.
// A press on a button, link, field or checkbox is left alone, and a plain
// click (no drag) still clicks; text can still be copied with a double-click.
const INTERACTIVE = 'button, a, input, select, textarea, label, [role="button"], [contenteditable="true"]'

export function Table({ children, className = '' }) {
  const box = useRef(null)
  const drag = useRef(null)

  function onMouseDown(e) {
    const el = box.current
    if (e.button !== 0 || !el || e.target.closest(INTERACTIVE)) return
    if (el.scrollWidth <= el.clientWidth) return       // nothing to scroll
    drag.current = { x: e.clientX, left: el.scrollLeft, moved: false }
    const move = (ev) => {
      const d = drag.current
      if (!d) return
      const dx = ev.clientX - d.x
      if (!d.moved && Math.abs(dx) < 4) return          // still a click
      if (!d.moved) { d.moved = true; el.style.cursor = 'grabbing'; document.body.style.userSelect = 'none' }
      el.scrollLeft = d.left - dx
    }
    const up = () => {
      const d = drag.current
      drag.current = null
      el.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      // A drag must not land as a click on the row underneath.
      if (d?.moved) {
        const eat = ev => ev.stopPropagation()
        window.addEventListener('click', eat, { capture: true, once: true })
        // If no click follows the drag, do not swallow the next real one.
        setTimeout(() => window.removeEventListener('click', eat, { capture: true }), 0)
      }
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  return (
    <div ref={box} onMouseDown={onMouseDown}
      className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto cursor-default">
      <table className={`min-w-full ${className}`}>{children}</table>
    </div>
  )
}

export function Thead({ children }) {
  return (
    <thead className="bg-gradient-to-r from-[#933d18]/6 to-[#933d18]/2 border-b border-[#933d18]/10">
      {children}
    </thead>
  )
}

export function Tbody({ children }) {
  return <tbody className="divide-y divide-gray-50">{children}</tbody>
}

export function Th({ children, className = '' }) {
  return (
    <th className={`px-5 py-3.5 text-left text-[11px] font-extrabold text-[#933d18]/80 uppercase tracking-wider whitespace-nowrap ${className}`}>
      {children}
    </th>
  )
}

export function Td({ children, className = '', colSpan }) {
  return (
    <td
      colSpan={colSpan}
      className={`px-5 py-3.5 text-sm text-gray-700 group-hover:bg-gray-50/70 transition-colors ${className}`}
    >
      {children}
    </td>
  )
}

export function Tr({ children, className = '', onClick }) {
  return (
    <tr
      onClick={onClick}
      className={`group transition-colors hover:bg-orange-50/30 ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      {children}
    </tr>
  )
}
