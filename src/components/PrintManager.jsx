import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Table, Thead, Tbody, Th, Td, Tr } from './ui/Table'
import Button from './ui/Button'
import { Printer, FileText, FileSpreadsheet, History, RotateCcw, Eye, X, CheckCircle2, AlertTriangle } from 'lucide-react'
import { exportCsv, exportPdf } from '../utils/exportTable'
import {
  DOC, DOC_LABEL, docKey, docTitle, printCountLabel, studentPrintPlan, printedDocsOf,
} from '../utils/printDocs'
import { openPrintJobWindow, fillPrintJob, printConsolidated } from '../utils/printJob'

// The Exam Section's Print tab: every student with a result sent to Print,
// document by document.
//
// A student's documents are the marksheet of each semester sent to Print and,
// once the course is through, the Provisional, Migration and Degree
// certificates. Each is tracked on its own (print_documents): how many times
// it has been printed, when, and by whom. The student's tab follows from that —
// Pending (nothing due printed yet), Partially Printed, Completed.
//
// Printing happens in a separate window, one document or a whole selection at
// a time. That window asks, once the print dialog closes, which documents
// actually printed, and only those are recorded — here, through
// record_document_prints().

const TABS = [
  { key: 'pending',   label: 'Pending',           on: 'bg-amber-500 text-white',   off: 'bg-amber-50 text-amber-700' },
  { key: 'partial',   label: 'Partially Printed', on: 'bg-blue-500 text-white',    off: 'bg-blue-50 text-blue-700' },
  { key: 'completed', label: 'Completed',         on: 'bg-emerald-500 text-white', off: 'bg-emerald-50 text-emerald-700' },
]
const STATUS_TEXT = { pending: 'Pending', partial: 'Partially Printed', completed: 'Completed', none: '—' }
const STATUS_BADGE = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  partial: 'bg-blue-50 text-blue-700 border-blue-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  none: 'bg-gray-50 text-gray-500 border-gray-200',
}

const fmtDT = (x) => {
  if (!x) return '—'
  const d = new Date(x)
  return Number.isNaN(d.getTime()) ? '—'
    : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
const fmtD = (x) => {
  if (!x) return '—'
  const d = new Date(x)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}
const newJobId = () => (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : null)
const isMissing = (err) => /PGRST20[25]|42P01|42883|record_document_prints|print_documents|print_history|schema cache/i
  .test(`${err?.code || ''} ${err?.message || ''}`)

// One document's state in a line: Printed Once · 02 Oct 2026, Reprint (3) · last 05 Oct 2026.
function countLine(d) {
  const r = d.record
  if (!d.count) return 'Not Printed'
  if (d.count === 1) return `Printed Once · ${fmtD(r?.first_printed_at)}`
  return `${printCountLabel(d.count)} · last ${fmtD(r?.last_reprinted_at || r?.last_printed_at)}`
}

export default function PrintManager({ students, results, setResults, filterActive, exportMeta }) {
  // print_documents by docKey. `mode` is 'loading', 'ok', or 'missing' (the
  // tables are not there yet — add_print_documents.sql not run).
  const [records, setRecords] = useState({})
  const [mode, setMode] = useState('loading')
  const [loadError, setLoadError] = useState('')
  const [tab, setTab] = useState('pending')
  const [selected, setSelected] = useState(() => new Set())
  const [preview, setPreview] = useState(null)       // { title, entries }
  const [historyFor, setHistoryFor] = useState(null) // student
  const [history, setHistory] = useState(null)       // print_history rows, null while loading
  const [confirm, setConfirm] = useState(null)       // { student, doc } awaiting Confirm Reprint
  const [notice, setNotice] = useState(null)         // { tone, text }
  const [consolidating, setConsolidating] = useState(null)

  async function loadRecords() {
    const all = []
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from('print_documents').select('*')
        .order('created_at', { ascending: true }).range(from, from + 999)
      if (error) {
        setMode('missing')
        setLoadError(isMissing(error) ? '' : error.message || 'Could not read print records.')
        return
      }
      all.push(...(data || []))
      if (!data || data.length < 1000) break
    }
    setRecords(Object.fromEntries(all.map(r => [docKey(r.student_id, r.doc_type, r.semester), r])))
    setMode('ok')
  }
  useEffect(() => { loadRecords() }, [])

  // The student's result rows, by student.
  const resultsBySid = useMemo(() => {
    const out = {}
    for (const [k, r] of Object.entries(results || {})) {
      const sid = k.split('__')[0]
      if (r && r.semester != null) (out[sid] ||= []).push(r)
    }
    return out
  }, [results])

  // Without the tables, a marksheet stamped printed_at still counts as printed
  // once, so the tab keeps the picture it had before.
  const printed = useMemo(() => {
    if (mode !== 'missing') return records
    const out = {}
    for (const [sid, rows] of Object.entries(resultsBySid)) {
      for (const r of rows) {
        if (r.printed_at) {
          out[docKey(sid, DOC.MARKSHEET, r.semester)] = {
            print_count: 1, first_printed_at: r.printed_at, last_printed_at: r.printed_at,
          }
        }
      }
    }
    return out
  }, [mode, records, resultsBySid])

  const plans = useMemo(() => Object.fromEntries(students.map(s =>
    [s.id, studentPrintPlan(s, resultsBySid[s.id] || [], printed)])), [students, resultsBySid, printed])

  const counts = useMemo(() => {
    const c = { pending: 0, partial: 0, completed: 0 }
    for (const s of students) { const st = plans[s.id]?.status; if (c[st] != null) c[st]++ }
    return c
  }, [students, plans])
  const list = students.filter(s => plans[s.id]?.status === tab)

  // Selection is per tab; switching clears it so a count never includes
  // students that are not on screen.
  const switchTab = (key) => { setTab(key); setSelected(new Set()) }
  const selectedHere = list.filter(s => selected.has(s.id))
  const selectedPending = selectedHere.reduce((a, s) => a + plans[s.id].pending.length, 0)
  const allChecked = list.length > 0 && selectedHere.length === list.length
  const toggle = (id) => setSelected(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })
  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(list.map(s => s.id)))

  // ── Recording what the print window reports back ──────────────────────────
  async function record(items, jobId) {
    const { data, error } = await supabase.rpc('record_document_prints', { p_items: items, p_job: jobId || null })
    if (!error) {
      const rows = Array.isArray(data) ? data : []
      setRecords(prev => {
        const next = { ...prev }
        for (const r of rows) {
          const k = docKey(r.student_id, r.doc_type, r.semester)
          next[k] = { ...(next[k] || {}), ...r }
        }
        return next
      })
      stampPrintedAt(rows.filter(r => r.doc_type === DOC.MARKSHEET))
      const reprints = rows.filter(r => r.print_count > 1).length
      const text = `${rows.length} document${rows.length === 1 ? '' : 's'} recorded as printed`
        + (reprints ? ` (${reprints} as reprint${reprints === 1 ? '' : 's'}).` : '.')
      setNotice({ tone: 'ok', text })
      if (historyFor) loadHistory(historyFor)
      return { ok: true, message: text }
    }
    if (!isMissing(error)) {
      const text = `Not recorded: ${error.message}`
      setNotice({ tone: 'error', text })
      return { ok: false, message: text }
    }
    // The tables are not there yet. Marksheets can still be stamped printed the
    // way they always were; nothing else can be recorded.
    setMode('missing')
    const sheets = items.filter(it => it.doc_type === DOC.MARKSHEET)
    const at = new Date().toISOString()
    let done = 0
    for (const it of sheets) {
      const r = (resultsBySid[it.student_id] || []).find(x => Number(x.semester) === it.semester)
      if (!r?.id) continue
      const { error: e2 } = await supabase.from('student_results')
        .update({ printed_at: at }).eq('id', r.id).is('printed_at', null)
      if (!e2) done++
    }
    if (!done) {
      const text = 'Not recorded — run add_print_documents.sql in Supabase → SQL Editor first.'
      setNotice({ tone: 'error', text })
      return { ok: false, message: text }
    }
    stampPrintedAt(sheets.map(it => ({ student_id: it.student_id, semester: it.semester })), at)
    const text = `${done} marksheet${done === 1 ? '' : 's'} recorded as printed. Certificates and reprint counts are recorded once add_print_documents.sql has been run.`
    setNotice({ tone: 'warn', text })
    return { ok: true, message: text }
  }

  // Keep the Result section's printed_at in step without a reload.
  function stampPrintedAt(rows, at = new Date().toISOString()) {
    if (!rows.length || !setResults) return
    setResults(prev => {
      const next = { ...(prev || {}) }
      for (const r of rows) {
        const k = `${r.student_id}__${r.semester}`
        if (next[k] && !next[k].printed_at) next[k] = { ...next[k], printed_at: at }
      }
      return next
    })
  }

  // Only windows this tab opened are listened to; the window's own address
  // (about:blank) says nothing reliable about where it came from, the window
  // object does.
  const windows = useRef(new Set())
  // The listener is set up once; it reaches the latest record() through this.
  const recordRef = useRef(null)
  useEffect(() => { recordRef.current = record })
  useEffect(() => {
    async function onMessage(e) {
      if (!e.source || !windows.current.has(e.source)) return
      const d = e.data
      if (!d || d.type !== 'sog-print-job' || !Array.isArray(d.items) || !d.items.length || d.items.length > 2000) return
      const items = d.items
        .filter(it => it && typeof it.student_id === 'string' && typeof it.doc_type === 'string')
        .map(it => ({ student_id: it.student_id, doc_type: it.doc_type, semester: Number(it.semester) || 0 }))
      const res = await recordRef.current(items, d.jobId)
      // Only whether it worked goes back — nothing about the student.
      try { e.source.postMessage({ type: 'sog-print-job-recorded', jobId: d.jobId, ...res }, '*') } catch { /* closed */ }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  // ── Printing ───────────────────────────────────────────────────────────────
  // The window is opened first, synchronously, inside the click.
  function runJob(entries, { autoPrint = false, title } = {}) {
    if (!entries.length) return
    const name = title || (entries.length === 1
      ? `${docTitle(entries[0].doc)} — ${entries[0].student.student_name || ''}`
      : `Print Job — ${entries.length} documents`)
    const win = openPrintJobWindow(name)
    if (!win) return
    windows.current.add(win)
    fillPrintJob(win, entries, { jobId: newJobId(), title: name, autoPrint })
      .catch(err => { try { win.document.body.textContent = 'Could not prepare the documents: ' + (err?.message || err) } catch { /* closed */ } })
  }
  const entryOf = (s, doc) => ({ student: s, doc, results: resultsBySid[s.id] || [] })

  // A document printed before goes through Confirm Reprint first.
  function printOne(s, doc) {
    if (doc.count >= 1) { setConfirm({ student: s, doc }); return }
    runJob([entryOf(s, doc)])
  }

  const pendingEntries = (ss) => ss.flatMap(s => plans[s.id].pending.map(d => entryOf(s, d)))

  function openPreview(ss, title) {
    const entries = pendingEntries(ss)
    if (!entries.length) { setNotice({ tone: 'warn', text: 'Nothing pending to print for the selection.' }); return }
    setPreview({ title, entries })
  }

  // ── History ────────────────────────────────────────────────────────────────
  async function loadHistory(s) {
    setHistory(null)
    if (mode === 'missing') { setHistory([]); return }
    const { data, error } = await supabase.from('print_history').select('*')
      .eq('student_id', s.id).order('printed_at', { ascending: false })
    setHistory(error ? [] : (data || []))
  }
  function openHistory(s) { setHistoryFor(s); loadHistory(s) }

  async function consolidated(s) {
    setConsolidating(s.id)
    try { await printConsolidated(s, resultsBySid[s.id] || []) } finally { setConsolidating(null) }
  }

  // ── Export ────────────────────────────────────────────────────────────────
  const EXPORT_COLUMNS = [
    { header: 'Student Name', value: s => s.student_name || '' },
    { header: 'Gender', value: s => s.gender || '' },
    { header: 'Mobile', value: s => s.mobile_no || '' },
    { header: 'Programme', value: s => s.programs?.program_name || '' },
    { header: 'Center', value: s => s.centers?.center_name || '' },
    { header: 'Center Code', value: s => s.centers?.center_code || '' },
    { header: 'Enrollment No', value: s => s.enrollment_no || '' },
    { header: 'Pending Documents', value: s => plans[s.id].pending.map(docTitle).join(', ') },
    { header: 'Final Documents', value: s => {
      const p = plans[s.id]
      if (!p.finalsDue) return `Not Eligible (${p.finalsReason})`
      return p.finals.map(d => `${docTitle(d)}: ${printCountLabel(d.count)}`).join('; ')
    } },
    { header: 'Status', value: s => STATUS_TEXT[plans[s.id].status] },
    { header: 'Printed', value: s => `${plans[s.id].printedDue.length} of ${plans[s.id].due.length}` },
    { header: 'Print Count', value: s => printedDocsOf(plans[s.id]).map(d => `${docTitle(d)}: ${d.count}`).join('; ') },
  ]
  const tabLabel = TABS.find(t => t.key === tab)?.label || tab

  const histPlan = historyFor ? plans[historyFor.id] : null
  const histDocs = histPlan ? printedDocsOf(histPlan) : []

  return (
    <>
      {/* Status tabs + export */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {TABS.map(t => (
          <button key={t.key} onClick={() => switchTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${tab === t.key ? t.on : t.off}`}>
            {t.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === t.key ? 'bg-white/25' : 'bg-white/70'}`}>{counts[t.key]}</span>
          </button>
        ))}
        <div className="flex gap-2 ml-auto">
          <Button size="sm" variant="outline" disabled={!list.length}
            onClick={() => exportCsv(`print-${tab}`, EXPORT_COLUMNS, list)}>
            <FileSpreadsheet size={14} /> Export Excel
          </Button>
          <Button size="sm" variant="outline" disabled={!list.length}
            onClick={() => exportPdf('Print List', EXPORT_COLUMNS, list, [`Print · ${tabLabel}`, ...(exportMeta ? exportMeta() : [])])}>
            <FileText size={14} /> Export PDF
          </Button>
        </div>
      </div>

      {mode === 'missing' && (
        <p className="mb-4 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
          {loadError
            ? <>Print records could not be read: {loadError}</>
            : <>Document-wise print tracking needs a database update — run <code className="font-mono">add_print_documents.sql</code> once in Supabase → SQL Editor. Until then only marksheets are tracked, and reprints are not counted.</>}
        </p>
      )}
      {notice && (
        <div className={`mb-4 flex items-start gap-2 text-xs rounded-xl px-4 py-2.5 border ${
          notice.tone === 'ok' ? 'text-emerald-800 bg-emerald-50 border-emerald-200'
            : notice.tone === 'error' ? 'text-red-700 bg-red-50 border-red-200'
              : 'text-amber-800 bg-amber-50 border-amber-200'}`}>
          {notice.tone === 'ok' ? <CheckCircle2 size={14} className="mt-px shrink-0" /> : <AlertTriangle size={14} className="mt-px shrink-0" />}
          <span className="flex-1">{notice.text}</span>
          <button onClick={() => setNotice(null)} className="opacity-60 hover:opacity-100"><X size={13} /></button>
        </div>
      )}

      {/* Bulk bar */}
      <div className="flex flex-wrap items-center gap-3 mb-3 bg-white border border-gray-100 rounded-2xl px-4 py-2.5 shadow-sm">
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 cursor-pointer select-none">
          <input type="checkbox" className="w-4 h-4 accent-[#933d18]" checked={allChecked} onChange={toggleAll} disabled={!list.length} />
          Select All
        </label>
        <span className="text-xs text-gray-500">
          Selected Students: <b className="text-gray-800">{selectedHere.length}</b>
          <span className="mx-2 text-gray-300">|</span>
          Pending Documents: <b className="text-gray-800">{selectedPending}</b>
        </span>
        <div className="flex gap-2 ml-auto">
          {selectedHere.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
          )}
          <Button size="sm" variant="outline" disabled={!selectedPending}
            onClick={() => openPreview(selectedHere, `Print Preview — ${selectedHere.length} student${selectedHere.length === 1 ? '' : 's'}`)}>
            <Eye size={13} /> Preview Selected
          </Button>
          <Button size="sm" disabled={!selectedPending}
            onClick={() => runJob(pendingEntries(selectedHere), { autoPrint: 'print' })}>
            <Printer size={13} /> Print All Pending
          </Button>
        </div>
      </div>

      <Table>
        <Thead>
          <tr>
            <Th className="w-10"><span className="sr-only">Select</span></Th>
            <Th>Student</Th>
            <Th>Programme</Th>
            <Th>Center</Th>
            <Th>Enrollment No.</Th>
            <Th>Pending Documents</Th>
            <Th>Final Documents</Th>
            <Th>Status</Th>
            <Th>Print Count / Summary</Th>
            <Th>Actions</Th>
          </tr>
        </Thead>
        <Tbody>
          {mode === 'loading' ? (
            <Tr><Td colSpan={10} className="text-center text-gray-400 py-12">Loading print records…</Td></Tr>
          ) : list.length === 0 ? (
            <Tr><Td colSpan={10} className="text-center text-gray-400 py-12">
              {filterActive ? 'No students match these filters.'
                : !students.length ? 'Nothing sent to Print yet — send a declared result from the Result tab.'
                  : tab === 'pending' ? 'No student is waiting for a first print.'
                    : tab === 'partial' ? 'No student is partly printed.'
                      : 'No student has every due document printed yet.'}
            </Td></Tr>
          ) : list.map(s => {
            const p = plans[s.id]
            const sheetsPending = p.pending.filter(d => d.doc_type === DOC.MARKSHEET)
            const done = printedDocsOf(p)
            const lastAt = done.map(d => d.record?.last_printed_at || d.record?.first_printed_at).filter(Boolean).sort().pop()
            return (
              <Tr key={s.id} className={selected.has(s.id) ? 'bg-[#933d18]/[0.03]' : ''}>
                <Td className="w-10">
                  <input type="checkbox" className="w-4 h-4 accent-[#933d18] cursor-pointer"
                    checked={selected.has(s.id)} onChange={() => toggle(s.id)} />
                </Td>
                <Td>
                  <p className="font-semibold text-gray-900">{s.student_name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{s.gender} • {s.mobile_no || '—'}</p>
                </Td>
                <Td className="text-gray-500 text-xs min-w-[130px] whitespace-normal break-words">{s.programs?.program_name || '—'}</Td>
                <Td className="text-gray-700 text-xs min-w-[120px] whitespace-normal break-words">
                  {s.centers?.center_name || '—'}
                  {s.centers?.center_code && <p className="text-[10px] text-gray-400 font-mono mt-0.5">{s.centers.center_code}</p>}
                </Td>
                <Td className="font-mono text-xs font-bold text-emerald-700">{s.enrollment_no || '—'}</Td>
                <Td>
                  {/* Only what has never been printed. A printed marksheet is
                      reached through History, where it can be reprinted. */}
                  {sheetsPending.length ? (
                    <div className="flex flex-col items-start gap-1">
                      {sheetsPending.map(d => (
                        <Button key={d.key} size="xs" variant="secondary" title={`Print the Semester ${d.semester} marksheet (DMC ${d.result?.dmc_no ?? '—'})`}
                          onClick={() => printOne(s, d)}>
                          <Printer size={11} /> {docTitle(d)}
                        </Button>
                      ))}
                    </div>
                  ) : <span className="block text-xs text-emerald-700 font-semibold max-w-[110px] whitespace-normal">All marksheets printed</span>}
                </Td>
                <Td>
                  {p.finalsDue ? (
                    <div className="flex flex-col items-start gap-1">
                      {p.finals.map(d => d.count >= 1 ? (
                        <span key={d.key} title={countLine(d)}
                          className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded bg-emerald-50 text-emerald-700 whitespace-nowrap">
                          <CheckCircle2 size={10} /> {docTitle(d)}
                        </span>
                      ) : (
                        <Button key={d.key} size="xs" variant="outline" onClick={() => printOne(s, d)}>
                          <Printer size={11} /> {docTitle(d)}
                        </Button>
                      ))}
                    </div>
                  ) : (
                    <div>
                      <span className="text-[10px] font-bold px-2 py-1 rounded bg-gray-100 text-gray-500 whitespace-nowrap">Not Eligible</span>
                      <p className="text-[10px] text-gray-400 mt-1 max-w-[130px] whitespace-normal">{p.finalsReason}</p>
                    </div>
                  )}
                </Td>
                <Td>
                  <span className={`text-[11px] font-bold px-2 py-1 rounded-lg border whitespace-nowrap ${STATUS_BADGE[p.status]}`}>
                    {STATUS_TEXT[p.status]}
                  </span>
                </Td>
                <Td className="text-xs whitespace-nowrap">
                  <p className="font-semibold text-gray-800">{p.printedDue.length} of {p.due.length} printed</p>
                  {p.reprints > 0 && <p className="text-amber-700 font-semibold mt-0.5">Reprints: {p.reprints}</p>}
                  {lastAt && <p className="text-gray-400 mt-0.5">Last: {fmtD(lastAt)}</p>}
                </Td>
                <Td>
                  <div className="flex flex-col items-stretch gap-1 w-[92px]">
                    <Button size="xs" disabled={!p.pending.length}
                      title={p.pending.length ? 'Preview and print this student’s pending documents' : 'Nothing pending'}
                      onClick={() => openPreview([s], `Print Documents — ${s.student_name}`)}>
                      <Printer size={11} /> Print
                    </Button>
                    <Button size="xs" variant="secondary" onClick={() => openHistory(s)}>
                      <History size={11} /> History
                    </Button>
                    <Button size="xs" variant="outline" disabled={!done.length}
                      title={done.length ? 'Reprint a document already printed' : 'Nothing printed yet'}
                      onClick={() => openHistory(s)}>
                      <RotateCcw size={11} /> Reprint
                    </Button>
                  </div>
                </Td>
              </Tr>
            )
          })}
        </Tbody>
      </Table>

      {/* ── Preview: the documents a job will carry ───────────────────────── */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setPreview(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[88vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{preview.title}</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {preview.entries.length} document{preview.entries.length === 1 ? '' : 's'} · {new Set(preview.entries.map(e => e.student.id)).size} student{new Set(preview.entries.map(e => e.student.id)).size === 1 ? '' : 's'} — all print as one job
                </p>
              </div>
              <button onClick={() => setPreview(null)} className="p-2 hover:bg-gray-200 rounded-full text-gray-500"><X size={18} /></button>
            </div>
            <div className="overflow-y-auto flex-1">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr className="text-left text-[11px] uppercase tracking-wider text-gray-500">
                    <th className="px-4 py-2.5">#</th>
                    <th className="px-4 py-2.5">Student</th>
                    <th className="px-4 py-2.5">Document</th>
                    <th className="px-4 py-2.5">Semester</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {preview.entries.map((e, i) => (
                    <tr key={e.doc.key}>
                      <td className="px-4 py-2 text-xs text-gray-400">{i + 1}</td>
                      <td className="px-4 py-2">
                        <p className="font-semibold text-gray-900">{e.student.student_name}</p>
                        <p className="text-[11px] text-gray-400 font-mono">{e.student.enrollment_no || '—'}</p>
                      </td>
                      <td className="px-4 py-2 text-gray-700">{DOC_LABEL[e.doc.doc_type]}</td>
                      <td className="px-4 py-2 text-gray-700">{e.doc.doc_type === DOC.MARKSHEET ? `Sem ${e.doc.semester}` : 'Final'}</td>
                      <td className="px-4 py-2 text-xs text-gray-500">{printCountLabel(e.doc.count)}</td>
                      <td className="px-4 py-2 text-right">
                        <Button size="xs" variant="secondary" onClick={() => printOne(e.student, e.doc)}>
                          <Printer size={11} /> Print
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex flex-wrap items-center justify-end gap-2">
              <span className="text-xs text-gray-500 mr-auto">Total documents: <b className="text-gray-800">{preview.entries.length}</b></span>
              <Button variant="ghost" onClick={() => setPreview(null)}>Cancel</Button>
              <Button variant="outline" onClick={() => { runJob(preview.entries, { autoPrint: 'pdf' }); setPreview(null) }}>
                <FileText size={14} /> Download Combined PDF
              </Button>
              <Button onClick={() => { runJob(preview.entries, { autoPrint: 'print' }); setPreview(null) }}>
                <Printer size={14} /> Print All Documents
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── History: every document printed, and every print ──────────────── */}
      {historyFor && histPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setHistoryFor(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Print History — {historyFor.student_name}</h3>
                <p className="text-xs text-gray-500 font-mono mt-0.5">{historyFor.enrollment_no || '—'} · {historyFor.programs?.program_name || ''}</p>
              </div>
              <button onClick={() => setHistoryFor(null)} className="p-2 hover:bg-gray-200 rounded-full text-gray-500"><X size={18} /></button>
            </div>
            <div className="overflow-y-auto flex-1 p-6 space-y-6">
              <div>
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#933d18]/80 mb-2">Printed Documents</h4>
                {histDocs.length === 0 ? (
                  <p className="text-sm text-gray-400 py-4">Nothing printed yet.</p>
                ) : (
                  <div className="overflow-x-auto border border-gray-100 rounded-xl">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr className="text-left text-[11px] uppercase tracking-wider text-gray-500">
                          <th className="px-3 py-2.5">Document</th>
                          <th className="px-3 py-2.5">Semester / Type</th>
                          <th className="px-3 py-2.5">First Printed On</th>
                          <th className="px-3 py-2.5">Printed By</th>
                          <th className="px-3 py-2.5">Print Count</th>
                          <th className="px-3 py-2.5">Last Reprint</th>
                          <th className="px-3 py-2.5">Reprinted By</th>
                          <th className="px-3 py-2.5"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {histDocs.map(d => (
                          <tr key={d.key}>
                            <td className="px-3 py-2 font-semibold text-gray-900 whitespace-nowrap">{DOC_LABEL[d.doc_type]}</td>
                            <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{d.doc_type === DOC.MARKSHEET ? `Sem ${d.semester}` : 'Final Document'}</td>
                            <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{fmtDT(d.record?.first_printed_at)}</td>
                            <td className="px-3 py-2 text-gray-600">{d.record?.first_printed_by || '—'}</td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${d.count > 1 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                                {printCountLabel(d.count)}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{d.count > 1 ? fmtDT(d.record?.last_reprinted_at) : '—'}</td>
                            <td className="px-3 py-2 text-gray-600">{d.count > 1 ? (d.record?.last_reprinted_by || '—') : '—'}</td>
                            <td className="px-3 py-2 text-right">
                              <Button size="xs" variant="outline" onClick={() => setConfirm({ student: historyFor, doc: d })}>
                                <RotateCcw size={11} /> Reprint
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#933d18]/80 mb-2">Print Log</h4>
                {mode === 'missing' ? (
                  <p className="text-sm text-gray-400 py-2">The print log starts once add_print_documents.sql has been run.</p>
                ) : history === null ? (
                  <p className="text-sm text-gray-400 py-2">Loading…</p>
                ) : history.length === 0 ? (
                  <p className="text-sm text-gray-400 py-2">No prints recorded.</p>
                ) : (
                  <div className="overflow-x-auto border border-gray-100 rounded-xl">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr className="text-left text-[11px] uppercase tracking-wider text-gray-500">
                          <th className="px-3 py-2.5">Printed On</th>
                          <th className="px-3 py-2.5">Document</th>
                          <th className="px-3 py-2.5">Action</th>
                          <th className="px-3 py-2.5">Print No.</th>
                          <th className="px-3 py-2.5">By</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {history.map(h => (
                          <tr key={h.id}>
                            <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{fmtDT(h.printed_at)}</td>
                            <td className="px-3 py-2 text-gray-800">{docTitle(h)}</td>
                            <td className="px-3 py-2">
                              <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${h.action === 'REPRINT' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                                {h.action === 'REPRINT' ? 'Reprint' : 'First Print'}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-gray-600">{h.print_number}</td>
                            <td className="px-3 py-2 text-gray-600">{h.printed_by || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex flex-wrap items-center justify-end gap-2">
              <span className="text-xs text-gray-400 mr-auto">The Consolidated Marksheet is not one of the tracked documents — it opens on its own.</span>
              <Button variant="outline" size="sm" disabled={consolidating === historyFor.id || !histPlan.marksheets.length}
                onClick={() => consolidated(historyFor)}>
                <FileText size={13} /> {consolidating === historyFor.id ? 'Opening…' : 'Consolidated Marksheet'}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setHistoryFor(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reprint safety ─────────────────────────────────────────────────── */}
      {confirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={() => setConfirm(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-full bg-amber-50 text-amber-600"><AlertTriangle size={20} /></div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Reprint {docTitle(confirm.doc)}?</h3>
                  <p className="text-sm text-gray-600 mt-2">
                    This document has already been printed {confirm.doc.count} time{confirm.doc.count === 1 ? '' : 's'}.
                    Do you want to reprint it?
                  </p>
                  <p className="text-xs text-gray-400 mt-2">
                    {confirm.student.student_name} · {DOC_LABEL[confirm.doc.doc_type]}{confirm.doc.doc_type === DOC.MARKSHEET ? ` · Sem ${confirm.doc.semester}` : ''}
                    <br />{countLine(confirm.doc)}
                  </p>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirm(null)}>Cancel</Button>
              <Button onClick={() => {
                const { student, doc } = confirm
                setConfirm(null)
                runJob([entryOf(student, doc)], { title: `Reprint — ${docTitle(doc)} — ${student.student_name || ''}` })
              }}>
                <RotateCcw size={14} /> Confirm Reprint
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
