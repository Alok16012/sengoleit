import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import PageHeader from '../../components/ui/PageHeader'
import { BookMarked, Download, FileText } from 'lucide-react'
import { formatDate } from '../../utils/formatDate'

// Read-only syllabus viewer for centers / super centers: pick a programme
// (and optionally a session) and see the semester-wise papers the admin set
// up on the Syllabus page, plus the course PDF if one was uploaded.
export default function SyllabusReport() {
  const [programs, setPrograms] = useState([])
  const [sessions, setSessions] = useState([])
  const [programId, setProgramId] = useState('')
  const [sessionId, setSessionId] = useState('')
  const [rows, setRows] = useState([])
  const [pdfUrl, setPdfUrl] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.from('programs').select('id, program_name').order('program_name')
      .then(({ data }) => setPrograms(data || []))
    supabase.from('academic_sessions').select('id, session_name, status').order('session_name', { ascending: false })
      .then(({ data }) => setSessions((data || []).filter(s => (s.status || 'Active').toLowerCase() !== 'inactive')))
  }, [])

  useEffect(() => {
    if (!programId) { setRows([]); setPdfUrl(''); return }
    async function load() {
      setLoading(true)
      let q = supabase.from('syllabus_subjects')
        .select('id, semester, paper_no, subject_code, subject_name, exam_date, sort_order, session_id')
        .eq('program_id', programId)
        .order('sort_order', { ascending: true })
      const { data } = await q
      // Session-specific rows only for the chosen session; session-less rows always.
      const all = data || []
      setRows(sessionId ? all.filter(r => !r.session_id || r.session_id === sessionId) : all)

      const { data: pdfs } = await supabase
        .from('course_syllabus_pdfs')
        .select('session_id, pdf_url')
        .eq('program_id', programId)
      const pdf = (sessionId && (pdfs || []).find(p => p.session_id === sessionId))
        || (pdfs || []).find(p => !p.session_id)
        || (pdfs || [])[0]
      setPdfUrl(pdf?.pdf_url || '')
      setLoading(false)
    }
    load()
  }, [programId, sessionId])

  const bySem = rows.reduce((acc, r) => {
    const k = r.semester ? `Semester ${r.semester}` : 'Course'
    ;(acc[k] = acc[k] || []).push(r)
    return acc
  }, {})

  const selCls = 'px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#933d18]/30 bg-white'

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      <PageHeader title="Syllabus" subtitle="Programme syllabus and curriculum — as published by the university" />

      <div className="flex items-end gap-3 flex-wrap">
        <div>
          <label className="block text-[11px] font-semibold text-gray-500 mb-1">Programme</label>
          <select value={programId} onChange={e => setProgramId(e.target.value)} className={`${selCls} w-72`}>
            <option value="">Select a programme…</option>
            {programs.map(p => <option key={p.id} value={p.id}>{p.program_name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-gray-500 mb-1">Session</label>
          <select value={sessionId} onChange={e => setSessionId(e.target.value)} className={`${selCls} w-44`}>
            <option value="">All Sessions</option>
            {sessions.map(s => <option key={s.id} value={s.id}>{s.session_name}</option>)}
          </select>
        </div>
        {pdfUrl && (
          <a href={pdfUrl} target="_blank" rel="noreferrer"
            className="flex items-center gap-2 bg-[#933d18] hover:bg-[#7a3215] text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-colors">
            <Download size={14} /> Syllabus PDF
          </a>
        )}
      </div>

      {!programId ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <BookMarked size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400">Pick a programme to see its syllabus.</p>
        </div>
      ) : loading ? (
        <div className="p-8 text-center text-gray-400">Loading...</div>
      ) : rows.length === 0 && !pdfUrl ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <FileText size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400">No syllabus has been published for this programme yet.</p>
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
