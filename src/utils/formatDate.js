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
