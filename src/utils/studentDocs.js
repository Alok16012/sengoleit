import { supabase } from '../lib/supabase'

// Student documents live in the PRIVATE `student-docs` bucket, so the URLs
// stored on the student row cannot be opened as they are — they have to be
// exchanged for a short-lived signed URL first.
//
// A field that accepts several files (the marksheets) stores them as ONE
// comma-joined string. Anything that opens a document therefore has to split
// first and sign each part: handing the whole string to an <a href> produces a
// request whose token reads "…,https://…", which Supabase Storage rejects with
// "Invalid Compact JWS".

// The individual URLs held in one document field.
export function docUrls(value) {
  return value ? String(value).split(',').map(s => s.trim()).filter(Boolean) : []
}

// One stored URL → a signed URL good for an hour. Returns the input unchanged
// when it is not a student-docs path (or signing fails), so a caller never ends
// up with nothing to open.
export async function signDocUrl(u) {
  try {
    const m = String(u).match(/student-docs\/([^?]+)/)
    const path = m ? decodeURIComponent(m[1]) : null
    if (!path) return u
    const { data } = await supabase.storage.from('student-docs').createSignedUrl(path, 3600)
    return data?.signedUrl || u
  } catch { return u }
}

// Sign, then open in a new tab. Used by every "View Document" control.
export async function openDocUrl(u) {
  const signed = await signDocUrl(u)
  window.open(signed, '_blank', 'noopener')
}
