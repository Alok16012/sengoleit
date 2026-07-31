import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useStudentAuth } from '../../context/StudentAuthContext'
import { fetchStudentSelf } from '../../utils/studentSelf'
import { fetchSemesterSubjectRows } from '../../utils/fetchSyllabus'
import { BookMarked, Download, FileText } from 'lucide-react'
import { formatDate } from '../../utils/formatDate'

// The syllabus already exists on the admin side (subjects in syllabus_subjects,
// the course PDF in course_syllabus_pdfs) — this page finally shows it to the
// student, replacing the old "Coming Soon" shell.
export default function StudentSyllabus() {
  const { student } = useStudentAuth()
  const [rows, setRows] = useState([])
  const [pdfUrl, setPdfUrl] = useState('')
  const [progName, setProgName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!student?.id) return
    async function load() {
      const s = await fetchStudentSelf()
      if (!s) { setLoading(false); return }
      setProgName(s.programs?.program_name || '')

      // All subjects for the course (no semester narrowing — show everything).
      const subjects = await fetchSemesterSubjectRows({ ...s, semester_year: null })
      setRows(subjects)

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

  // Group by semester for display; rows with no semester go under "Course".
  const bySem = rows.reduce((acc, r) => {
    const k = r.semester ? `Semester ${r.semester}` : 'Course'
    ;(acc[k] = acc[k] || []).push(r)
    return acc
  }, {})

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

      {rows.length === 0 && !pdfUrl ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <FileText size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400">The syllabus for your course has not been published yet.</p>
        </div>
      ) : (
        Object.entries(bySem).map(([sem, subs]) => (
          <div key={sem} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="bg-[#933d18]/5 px-5 py-2.5 border-b border-gray-100">
              <p className="text-sm font-bold text-[#933d18]">{sem}</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-gray-400 border-b border-gray-100">
                  <th className="text-left font-semibold px-5 py-2">Paper</th>
                  <th className="text-left font-semibold px-5 py-2">Code</th>
                  <th className="text-left font-semibold px-5 py-2">Subject</th>
                  <th className="text-left font-semibold px-5 py-2">Exam Date</th>
                </tr>
              </thead>
              <tbody>
                {subs.map(r => (
                  <tr key={r.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-5 py-2.5 text-gray-600">{r.paper_no || '—'}</td>
                    <td className="px-5 py-2.5 font-mono text-xs text-gray-600">{r.subject_code || '—'}</td>
                    <td className="px-5 py-2.5 font-semibold text-gray-800">{r.subject_name || '—'}</td>
                    <td className="px-5 py-2.5 text-gray-600">{r.exam_date ? formatDate(r.exam_date) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </div>
  )
}
