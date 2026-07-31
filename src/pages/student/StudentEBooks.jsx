import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useStudentAuth } from '../../context/StudentAuthContext'
import { fetchStudentSelf } from '../../utils/studentSelf'
import { BookOpenCheck, Download, FileText } from 'lucide-react'
import { formatDate } from '../../utils/formatDate'

// Study material uploaded by the university — the student sees the books for
// their own programme plus the ones marked for every programme.
export default function StudentEBooks() {
  const { student } = useStudentAuth()
  const [rows, setRows] = useState([])
  const [progName, setProgName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!student?.id) return
    async function load() {
      const s = await fetchStudentSelf()
      if (!s) { setLoading(false); return }
      setProgName(s.programs?.program_name || '')
      const { data } = await supabase
        .from('ebooks')
        .select('id, title, description, file_url, created_at, program_id, session_id')
        .or(`program_id.is.null,program_id.eq.${s.programme_id}`)
        .order('created_at', { ascending: false })
      // Session-specific books only for the student's own session.
      setRows((data || []).filter(b => !b.session_id || b.session_id === s.session_id))
      setLoading(false)
    }
    load()
  }, [student?.id])

  if (loading) return <div className="p-8 text-center text-gray-400">Loading...</div>

  return (
    <div className="p-6 space-y-4 max-w-4xl">
      <div>
        <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
          <BookOpenCheck size={20} className="text-[#933d18]" /> E-Books
        </h1>
        {progName && <p className="text-sm text-gray-500 mt-0.5">{progName}</p>}
      </div>

      {rows.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <FileText size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400">No study material has been published for your course yet.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map(b => (
            <div key={b.id} className="bg-white border border-gray-200 rounded-2xl p-5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold text-gray-900 truncate">{b.title}</p>
                {b.description && <p className="text-xs text-gray-500 mt-0.5">{b.description}</p>}
                <p className="text-[11px] text-gray-400 mt-1.5">Added {formatDate(b.created_at)}</p>
              </div>
              <a href={b.file_url} target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 shrink-0 bg-[#933d18] hover:bg-[#7a3215] text-white px-3.5 py-2 rounded-xl font-bold text-xs transition-colors">
                <Download size={13} /> Download
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
