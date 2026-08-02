// One student against a search box.

// Punctuation and spacing stripped, so "phd" / "ph d" / "Ph.D." all reduce to
// the same thing — a programme called "Ph.D." should be findable however the
// person at the desk happens to type it.
const squash = v => String(v ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')

// A punctuation-insensitive match, but only where a word starts. Squashing a
// field outright is too loose: "Ralph Dsouza" collapses to "ralphdsouza", which
// contains "phd", so every Ralph in the university would answer a search for
// Ph.D students. Anchoring to a word start keeps "ph d" → "Ph.D." working while
// refusing matches that only exist because the spaces were removed.
function squashedHit(field, qs) {
  const words = String(field ?? '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
  for (let i = 0; i < words.length; i++) {
    if (words.slice(i).join('').startsWith(qs)) return true
  }
  return false
}

// The searchable fields, tested one at a time so a match can never straddle two
// of them (a name ending in "ph" followed by an enrollment starting with "d" is
// not a Ph.D). An empty query matches everything.
export function matchesSearch(s, query) {
  const q = String(query ?? '').trim().toLowerCase()
  if (!q) return true
  const qs = squash(q)
  return [
    s.student_name, s.enrollment_no, s.mobile_no,
    s.admission_number, s.registration_no,
    s.programs?.program_name, s.centers?.center_name, s.centers?.center_code,
    s.academic_sessions?.session_name,
  ].some(f => {
    const v = String(f ?? '').toLowerCase()
    if (!v) return false
    // Plain substring first — it is what people expect, and it still finds a
    // mobile number by its middle digits.
    return v.includes(q) || (!!qs && squashedHit(v, qs))
  })
}
