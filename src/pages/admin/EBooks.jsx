import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import { Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui/Table'
import { BookOpenCheck, Upload, Trash2, Download, Search } from 'lucide-react'
import { formatDate } from '../../utils/formatDate'

// Admin e-book library — upload a PDF, pick which programme (and optionally
// which session) it belongs to, and students of that programme see it on
// their E-Book page. Files live in the same `documents` bucket the syllabus
// PDFs use. Needs add_ebooks.sql.
export default function EBooks() {
  const [rows, setRows] = useState([])
  const [programs, setPrograms] = useState([])
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [needsSql, setNeedsSql] = useState(false)
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  // Upload form
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [programId, setProgramId] = useState('')
  const [sessionId, setSessionId] = useState('')
  const [file, setFile] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [eb, pr, se] = await Promise.all([
      supabase.from('ebooks').select('*, programs(program_name), academic_sessions(session_name)').order('created_at', { ascending: false }),
      supabase.from('programs').select('id, program_name').order('program_name'),
      supabase.from('academic_sessions').select('id, session_name, status').order('session_name', { ascending: false }),
    ])
    if (eb.error) setNeedsSql(true)
    setRows(eb.data || [])
    setPrograms(pr.data || [])
    setSessions((se.data || []).filter(s => (s.status || 'Active').toLowerCase() !== 'inactive'))
    setLoading(false)
  }

  async function handleUpload() {
    if (!title.trim()) return alert('Enter a title for the e-book.')
    if (!file) return alert('Choose a PDF file to upload.')
    setBusy(true)
    const ext = (file.name.split('.').pop() || 'pdf').toLowerCase()
    const path = `ebooks/${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`
    const up = await supabase.storage.from('documents').upload(path, file, { upsert: true })
    if (up.error) { alert('Upload failed: ' + up.error.message); setBusy(false); return }
    const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path)
    const { error } = await supabase.from('ebooks').insert({
      title: title.trim(),
      description: desc.trim() || null,
      program_id: programId || null,
      session_id: sessionId || null,
      file_url: publicUrl,
    })
    if (error) { alert('Save failed (run add_ebooks.sql in Supabase first): ' + error.message); setBusy(false); return }
    setTitle(''); setDesc(''); setProgramId(''); setSessionId(''); setFile(null)
    document.getElementById('ebook-file-input').value = ''
    await load()
    setBusy(false)
  }

  async function handleDelete(row) {
    if (!confirm(`Delete "${row.title}"?\n\nStudents will no longer see it.`)) return
    const { error } = await supabase.from('ebooks').delete().eq('id', row.id)
    if (error) return alert('Delete failed: ' + error.message)
    setRows(rs => rs.filter(r => r.id !== row.id))
  }

  const filtered = rows.filter(r =>
    !q.trim() || `${r.title} ${r.description} ${r.programs?.program_name}`.toLowerCase().includes(q.toLowerCase()))

  const inputCls = 'px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#933d18]/30'

  return (
    <div className="p-6 space-y-5">
      <PageHeader title="E-Books" subtitle="Upload study material — students of the chosen programme can download it" />

      {needsSql && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <strong>Migration pending.</strong> Run <code className="font-mono text-xs bg-white px-1.5 py-0.5 rounded">add_ebooks.sql</code> in
          the Supabase SQL Editor to enable the e-book library.
        </div>
      )}

      {/* Upload panel */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Upload size={16} className="text-[#933d18]" />
          <p className="text-sm font-bold text-gray-900">Add E-Book</p>
        </div>
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} className={`${inputCls} w-64`} placeholder="e.g. Research Methodology Notes" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Description (optional)</label>
            <input value={desc} onChange={e => setDesc(e.target.value)} className={`${inputCls} w-72`} placeholder="Short description" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Programme</label>
            <select value={programId} onChange={e => setProgramId(e.target.value)} className={`${inputCls} bg-white w-56`}>
              <option value="">All Programmes</option>
              {programs.map(p => <option key={p.id} value={p.id}>{p.program_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">Session</label>
            <select value={sessionId} onChange={e => setSessionId(e.target.value)} className={`${inputCls} bg-white w-40`}>
              <option value="">All Sessions</option>
              {sessions.map(s => <option key={s.id} value={s.id}>{s.session_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 mb-1">PDF File</label>
            <input id="ebook-file-input" type="file" accept=".pdf,application/pdf" onChange={e => setFile(e.target.files?.[0] || null)}
              className="text-sm text-gray-600 file:mr-3 file:px-3 file:py-2 file:border-0 file:rounded-lg file:bg-[#933d18]/10 file:text-[#933d18] file:text-xs file:font-bold file:cursor-pointer" />
          </div>
          <Button variant="primary" size="md" onClick={handleUpload} disabled={busy}>
            <Upload size={14} /> {busy ? 'Uploading…' : 'Upload'}
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm font-bold text-gray-700 flex items-center gap-2">
          <BookOpenCheck size={16} className="text-[#933d18]" /> Library ({filtered.length})
        </p>
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search title / programme…"
            className="pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#933d18]/30 w-72" />
        </div>
      </div>

      <Table>
        <Thead>
          <Tr>
            <Th>#</Th><Th>Title</Th><Th>Programme</Th><Th>Session</Th><Th>Added</Th><Th>Actions</Th>
          </Tr>
        </Thead>
        <Tbody>
          {loading ? (
            <Tr><Td colSpan={6} className="text-center text-gray-400 py-8">Loading...</Td></Tr>
          ) : filtered.length === 0 ? (
            <Tr><Td colSpan={6} className="text-center text-gray-400 py-8">No e-books uploaded yet.</Td></Tr>
          ) : filtered.map((r, i) => (
            <Tr key={r.id}>
              <Td>{i + 1}</Td>
              <Td>
                <div className="font-semibold text-gray-900">{r.title}</div>
                {r.description && <div className="text-xs text-gray-400">{r.description}</div>}
              </Td>
              <Td className="text-sm">{r.programs?.program_name || <span className="text-gray-400 italic">All programmes</span>}</Td>
              <Td className="text-sm">{r.academic_sessions?.session_name || <span className="text-gray-400 italic">All sessions</span>}</Td>
              <Td className="text-xs text-gray-500">{formatDate(r.created_at)}</Td>
              <Td>
                <div className="flex gap-2">
                  <a href={r.file_url} target="_blank" rel="noreferrer"
                    className="p-1.5 rounded-lg hover:bg-[#933d18]/10 text-[#933d18]" title="Download / view">
                    <Download size={15} />
                  </a>
                  <button onClick={() => handleDelete(r)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors" title="Delete">
                    <Trash2 size={15} />
                  </button>
                </div>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </div>
  )
}
