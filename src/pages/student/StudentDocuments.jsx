import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useStudentAuth } from '../../context/StudentAuthContext'
import { resolveStudentDocUrls } from '../../utils/resolveStudentDocs'
import { FileText, Eye, CheckCircle, XCircle } from 'lucide-react'

const DOC_FIELDS = [
  { key: 'photo_url', label: 'Passport Photo' },
  { key: 'signature_url', label: 'Signature' },
  { key: 'aadhar_url', label: 'Aadhar Card' },
  { key: 'tenth_marksheet_url', label: '10th Marksheet' },
  { key: 'twelfth_marksheet_url', label: '12th Marksheet' },
  { key: 'ug_marksheet_url', label: 'UG Marksheet' },
  { key: 'pg_marksheet_url', label: 'PG Marksheet' },
  { key: 'diploma_marksheet_url', label: 'Diploma Marksheet' },
  { key: 'declaration_url', label: 'Declaration Form' },
]

function isImage(url) {
  return /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(url)
}

export default function StudentDocuments() {
  const { student } = useStudentAuth()
  const [docs, setDocs] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!student?.id) return
    async function load() {
      const { data } = await supabase.from('students').select('*').eq('id', student.id).single()
      if (data) {
        const resolved = await resolveStudentDocUrls(data)
        setDocs(resolved)
      }
      setLoading(false)
    }
    load()
  }, [student?.id])

  if (loading) return <div className="p-8 text-center text-gray-400">Loading...</div>

  const available = DOC_FIELDS.filter(d => docs[d.key])
  const missing = DOC_FIELDS.filter(d => !docs[d.key])

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-black text-gray-900">My Documents</h1>
        <div className="flex items-center gap-3 text-xs font-semibold">
          <span className="flex items-center gap-1 text-emerald-600">
            <CheckCircle size={13} /> {available.length} uploaded
          </span>
          <span className="flex items-center gap-1 text-gray-400">
            <XCircle size={13} /> {missing.length} pending
          </span>
        </div>
      </div>

      {available.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <FileText size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400">No documents uploaded yet.</p>
          <p className="text-gray-300 text-xs mt-1">Contact your center to upload required documents.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {available.map(({ key, label }) => {
            const url = docs[key]
            const img = isImage(url)
            return (
              <div key={key} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="h-40 bg-gray-50 flex items-center justify-center overflow-hidden">
                  {img
                    ? <img src={url} alt={label} className="w-full h-full object-cover" />
                    : <FileText size={40} className="text-gray-300" />
                  }
                </div>
                <div className="p-3 flex items-center justify-between border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-700 truncate pr-2">{label}</p>
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 rounded-lg hover:bg-[#933d18]/10 text-[#933d18] transition-colors shrink-0"
                    title="View"
                  >
                    <Eye size={14} />
                  </a>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {missing.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Not Yet Uploaded</p>
          <div className="flex flex-wrap gap-2">
            {missing.map(({ label }) => (
              <span key={label} className="text-xs bg-gray-100 text-gray-400 px-3 py-1.5 rounded-lg">
                {label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
