import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useStudentAuth } from '../../context/StudentAuthContext'
import { fetchStudentSelf } from '../../utils/studentSelf'
import { BookMarked, Download, FileText } from 'lucide-react'

// The student sees ONLY the course syllabus PDF (course_syllabus_pdfs,
// uploaded from the admin's Syllabus list). The per-subject table this page
// used to render exposed the university's full internal paper list — every
// alternative of every paper — which the university does not want students
// browsing; the published PDF is the official syllabus. No PDF yet = a
// "not published" notice, nothing else.
export default function StudentSyllabus() {
  const { student } = useStudentAuth()
  const [pdfUrl, setPdfUrl] = useState('')
  const [progName, setProgName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!student?.id) return
    async function load() {
      const s = await fetchStudentSelf()
      if (!s) { setLoading(false); return }
      setProgName(s.programs?.program_name || '')

      // The course syllabus PDF — this session's copy, else the all-sessions one.
      const { data: pdfs } = await supabase
        .from('course_syllabus_pdfs')
        .select('session_id, pdf_url')
        .eq('program_id', s.programme_id)
      const pdf = (pdfs || []).find(p => p.session_id === s.session_id)
        || (pdfs || []).find(p => !p.session_id)
      if (pdf?.pdf_url) setPdfUrl(pdf.pdf_url)
      setLoading(false)
    }
    load()
  }, [student?.id])

  if (loading) return <div className="p-8 text-center text-gray-400">Loading...</div>

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
            <BookMarked size={20} className="text-[#933d18]" /> Syllabus
          </h1>
          {progName && <p className="text-sm text-gray-500 mt-0.5">{progName}</p>}
        </div>
        {pdfUrl && (
          <a href={pdfUrl} target="_blank" rel="noreferrer"
            className="flex items-center gap-2 bg-[#933d18] hover:bg-[#7a3215] text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-colors">
            <Download size={15} /> Download Syllabus PDF
          </a>
        )}
      </div>

      {pdfUrl ? (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <iframe src={pdfUrl} title="Course Syllabus" className="w-full h-[75vh] border-0" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <FileText size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400">The syllabus for your course has not been published yet.</p>
        </div>
      )}
    </div>
  )
}
