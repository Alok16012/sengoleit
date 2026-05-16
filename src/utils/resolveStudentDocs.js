import { supabase } from '../lib/supabase'

const DOC_FIELDS = [
  'photo_url', 'signature_url', 'aadhar_url', 'declaration_url',
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
      const path = extractPath(student[field], bucket)
      if (path) {
        const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 7200)
        if (data?.signedUrl) resolved[field] = data.signedUrl
      }
    })
  )
  return resolved
}
