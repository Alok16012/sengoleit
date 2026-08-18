// Single source of truth for date display across the app.
// Every date is shown as dd/mm/yyyy (day first, Indian style).

// A date-only value — a DB `date` column, 'YYYY-MM-DD' — carries no time and no
// zone. Passing it through `new Date()` reads it as UTC midnight and then
// converts to the viewer's zone, so anywhere west of UTC it lands on the
// previous day: a result published on the 17th printed as the 16th. These
// helpers read the parts as written; timestamps still convert, as they should.
const dateOnlyParts = (value) => String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/)

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'June',
  'July', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

// "17 Aug 2026" — for dates printed on a document.
export function formatDayMonthYear(value, fallback = '') {
  if (!value) return fallback
  const p = dateOnlyParts(value)
  if (p) return `${p[3]} ${MONTHS_SHORT[+p[2] - 1]} ${p[1]}`
  const d = new Date(value)
  return isNaN(d.getTime()) ? fallback
    : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

// "January 2026" — the examination session a semester's exams sit in.
export function formatMonthYear(value, fallback = '') {
  if (!value) return fallback
  const p = dateOnlyParts(value)
  if (p) return `${MONTHS_LONG[+p[2] - 1]} ${p[1]}`
  const d = new Date(value)
  return isNaN(d.getTime()) ? fallback
    : d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

export function formatDate(value, fallback = '—') {
  if (!value) return fallback
  const p = dateOnlyParts(value)
  if (p) return `${p[3]}/${p[2]}/${p[1]}`
  const d = new Date(value)
  if (isNaN(d.getTime())) return fallback
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

// A timestamp's calendar day in the viewer's timezone, as YYYY-MM-DD — the form
// a <input type="date"> uses. Date-range filters compare against this so an
// evening entry counts on the day it was actually made, not the UTC day.
export function localDay(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  if (isNaN(d.getTime())) return ''
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// "15-June-2026" — month names for dates that read inside a sentence on a
// printed letter (e.g. "Entrance Test conducted on 15-June-2026"). Long names
// abbreviate (August → Aug); already-short ones print in full (June, July).

export function formatDateLong(value, fallback = '—') {
  if (!value) return fallback
  const d = new Date(value)
  if (isNaN(d.getTime())) return fallback
  return `${String(d.getDate()).padStart(2, '0')}-${MONTHS_SHORT[d.getMonth()]}-${d.getFullYear()}`
}

// The website's PayU integration builds the transaction id as
//   <8-char approval code><base36 Date.now()><4-char random>
// (see newTxnId in sengolewebsite). So the moment a code was paid online can be
// recovered from its payment_txn_id without storing a separate timestamp.
export function paymentDateFromTxn(txnId) {
  if (!txnId || typeof txnId !== 'string' || txnId.length < 13) return null
  const ms = parseInt(txnId.slice(8, -4), 36)
  // Sanity-bound to a plausible epoch-ms range so a non-standard id can't
  // produce a garbage date.
  if (!Number.isFinite(ms) || ms < 1700000000000 || ms > 2000000000000) return null
  return new Date(ms)
}

// The payment date shown for an approval code: prefer the online-payment time
// decoded from the PayU txn id, else the center's registration payment date.
export function approvalPaymentDate(coupon) {
  const fromTxn = paymentDateFromTxn(coupon?.payment_txn_id)
  if (fromTxn) return formatDate(fromTxn)
  return coupon?.centers?.payment_date ? formatDate(coupon.centers.payment_date) : '—'
}

// Same dd/mm/yyyy date but with a HH:MM time appended — use where a
// timestamp (e.g. payment paid-at) needs the time of day too.
export function formatDateTime(value, fallback = '—') {
  if (!value) return fallback
  const d = new Date(value)
  if (isNaN(d.getTime())) return fallback
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${formatDate(value)} ${hh}:${min}`
}
