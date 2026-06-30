// Single source of truth for date display across the app.
// Every date is shown as dd/mm/yyyy (day first, Indian style).

export function formatDate(value, fallback = '—') {
  if (!value) return fallback
  const d = new Date(value)
  if (isNaN(d.getTime())) return fallback
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
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
