import { supabase } from '../lib/supabase'

const DOC_FIELDS = [
  'photo_url', 'signature_url', 'aadhar_url', 'aadhar_back_url', 'declaration_url',
  'tc_url', 'migration_url', 'noc_url',
  'tenth_marksheet_url', 'twelfth_marksheet_url', 'ug_marksheet_url',
  'pg_marksheet_url', 'diploma_marksheet_url',
]

function extractPath(url, bucket) {
  if (!url) return null
  const regex = new RegExp(`/${bucket}/(.+?)(?:\\?|$)`)
  const match = url.match(regex)
  return match ? decodeURIComponent(match[1]) : null
}

export async function resolveStudentDocUrls(student, bucket = 'student-docs') {
  if (!student) return student
  const resolved = { ...student }
  await Promise.all(
    DOC_FIELDS.map(async field => {
      const raw = student[field]
      if (!raw) return
      // A field may hold one URL or several comma-joined (multi-file marksheets).
      const parts = String(raw).split(',').map(p => p.trim()).filter(Boolean)
      const out = await Promise.all(parts.map(async url => {
        const path = extractPath(url, bucket)
        if (!path) return url
        const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 7200)
        return data?.signedUrl || url
      }))
      resolved[field] = out.join(',')
    })
  )
  return resolved
}
