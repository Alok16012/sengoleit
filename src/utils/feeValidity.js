// A fee structure's validity window — "this fee applies from this date to that
// date". Set in Fee Management; read wherever a CENTRE is shown what it may
// offer or admit into.
//
// The window gates OFFERING, not billing. A student admitted under last year's
// fee is still billed under it after it lapses, so nothing here is used by
// courseFee.js or the student's fee page — only by the centre-facing lists.
//
// Dates are Postgres `date` columns, which arrive as 'YYYY-MM-DD'. Comparing
// them as strings keeps this free of timezone drift: parsing '2026-04-01' into
// a Date makes it midnight UTC, which is still 31 March in India, and a fee
// would have expired a day early for everyone using the system.

// Today in the browser's own timezone, as 'YYYY-MM-DD'.
export function todayISO() {
  const d = new Date()
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// Normalise whatever the row carries to 'YYYY-MM-DD', or '' when unset.
// A timestamp ('2026-04-01T00:00:00+00:00') truncates to its date part.
const day = (v) => (v ? String(v).slice(0, 10) : '')

// 'open'      — no window set; offered until someone sets one (every fee today)
// 'active'    — inside its window
// 'scheduled' — window has not started yet
// 'expired'   — window has passed
export function validityState(struct, today = todayISO()) {
  const from = day(struct?.valid_from)
  const to   = day(struct?.valid_to)
  if (!from && !to) return 'open'
  if (from && today < from) return 'scheduled'
  if (to && today > to) return 'expired'
  return 'active'
}

// May this fee be offered to a centre today?
export function isOfferable(struct, today = todayISO()) {
  const s = validityState(struct, today)
  return s === 'open' || s === 'active'
}

// How the window reads on screen. '—' when there is none, so a fee with no
// window does not pretend to have one.
export function validityLabel(struct) {
  const from = day(struct?.valid_from)
  const to   = day(struct?.valid_to)
  if (!from && !to) return '—'
  const d = (iso) => {
    const [y, m, dd] = iso.split('-')
    return `${dd}/${m}/${y}`
  }
  if (from && to) return `${d(from)} – ${d(to)}`
  if (from) return `From ${d(from)}`
  return `Till ${d(to)}`
}
