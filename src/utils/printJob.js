// One print job from the Exam Section's Print tab: any number of documents —
// semester marksheets and the three final certificates, for one student or a
// whole selection — in a single window, so they go to the printer (or into one
// combined PDF) together.
//
// The window opens at once, on the click itself, and fills in as each
// document's marks are fetched: opened after those fetches, a large job could
// outlast the click's permission to open a window and be blocked as a popup.
//
// Nothing here records a print. After the print dialog closes the window asks
// which documents actually printed, and only those are reported back to the
// Exam Section tab (a 'sog-print-job' message) — a cancelled or failed print
// is never counted.

import { supabase } from '../lib/supabase'
import { fetchPaperMarks, fetchPaperMarksUpto } from './paperMarks'
import { fetchExamDates } from './examSettings'
import {
  BRAND, statementOfGradesHTML, STATEMENT_OF_GRADES_STYLE, sgpaOf, sgpaBySemester, divisionFor,
  provisionalCertificateSvg, migrationCertificateSvg, degreeCertificateSvg, generateConsolidatedMarksheet,
} from './generateStudentCards'
import { DOC, docTitle } from './printDocs'

const esc = (x) => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
// For data written into an inline <script>.
const json = (x) => JSON.stringify(x).replace(/</g, '\\u003c')

// The full student record the documents print from — the same record the
// Print tab has always printed from.
async function fullStudent(s) {
  const { data } = await supabase.from('students')
    .select('*, programs(program_name), academic_sessions(session_name), centers(center_name, center_code), departments(name)')
    .eq('id', s.id).single()
  return data || s
}

// Passing year and division for the final documents, from the semesters sent
// to Print: the year the last of them was declared.
function finalsSummary(results = []) {
  const sems = results.filter(r => r.print_forwarded_at)
  const num = x => Number(String(x ?? '').replace(/[^\d.]/g, '')) || 0
  const obtained = sems.reduce((a, r) => a + num(r.obtained_marks), 0)
  const maximum = sems.reduce((a, r) => a + num(r.total_marks), 0)
  const last = sems.map(r => r.declared_at).filter(Boolean).sort().pop()
  return {
    division: maximum > 0 ? divisionFor((obtained / maximum) * 100) : '',
    passingYear: last ? new Date(last).getFullYear() : '',
  }
}

// One document's sheet: { kind: 'sog' | 'cert', html }.
async function buildSheet(entry, cache) {
  const { student: s, doc, results } = entry
  const full = await (cache[s.id] ||= fullStudent(s))
  if (doc.doc_type === DOC.MARKSHEET) {
    const r = doc.result || results.find(x => Number(x.semester) === Number(doc.semester))
    if (!r) throw new Error('This semester has no result on record.')
    const [rows, dates, upto] = await Promise.all([
      fetchPaperMarks(s, r.semester),
      fetchExamDates(full, r.semester),
      fetchPaperMarksUpto(s, r.semester),
    ])
    return {
      kind: 'sog',
      html: statementOfGradesHTML(full, rows, {
        dmcNo: r.dmc_no ? String(r.dmc_no) : '',
        semSgpas: sgpaBySemester(upto),
        // The calendar's Marksheet Printing Date, so every copy of the semester
        // carries the date the office set; the day it went to Print otherwise.
        issueDate: dates.resultPublishedRaw ? `${dates.resultPublishedRaw}T12:00:00` : (r.print_forwarded_at || null),
        semester: `Semester ${r.semester}`,
        examHeld: dates.examSession || '',
        resultStatus: r.status === 'Fail' ? 'Failed' : 'Passed',
        cgpa: sgpaOf(upto),
      }),
    }
  }
  const { passingYear, division } = finalsSummary(results)
  const svg = doc.doc_type === DOC.PROVISIONAL ? provisionalCertificateSvg(full, { passingYear, division })
    : doc.doc_type === DOC.MIGRATION ? migrationCertificateSvg(full, { passingYear })
      : doc.doc_type === DOC.DEGREE ? degreeCertificateSvg(full, { passingYear, division })
        : null
  if (!svg) throw new Error(`${doc.doc_type} cannot be printed here.`)
  return { kind: 'cert', html: svg }
}

// The Consolidated Marksheet — every semester sent to Print on one sheet. Not
// one of the documents the office must issue, so it opens on its own and is
// not counted.
export async function printConsolidated(s, results = []) {
  const sems = results.filter(r => r.print_forwarded_at)
    .sort((a, b) => Number(a.semester) - Number(b.semester))
  if (!sems.length) return
  const full = await fullStudent(s)
  const upto = Math.max(...sems.map(r => Number(r.semester) || 0))
  const cgpa = sgpaOf(await fetchPaperMarksUpto(s, upto))
  generateConsolidatedMarksheet(full, sems.map(r => ({
    sem: r.semester, obtained: r.obtained_marks, total: r.total_marks,
    status: r.status, dmcNo: r.dmc_no,
  })), { cgpa })
}

const PAGE_STYLE = `
  html, body { margin:0; padding:0; background:#e5e7eb; font-family:Arial, Helvetica, sans-serif; }
  ${STATEMENT_OF_GRADES_STYLE.replace(/@page\s*\{[^}]*\}/, '')}
  /* Marksheets are A4 portrait, certificates A4 landscape — each sheet asks
     for its own page, so one job can carry both. */
  @page { margin:0; }
  @page sog  { size:A4 portrait;  margin:0; }
  @page cert { size:A4 landscape; margin:0; }
  .pg-sog  { page:sog; }
  .pg-cert { page:cert; }
  .pg + .pg { break-before:page; }
  .sog-sheet { margin:0 auto 12mm; box-shadow:0 4px 20px rgba(0,0,0,0.18); }
  .cert-page { width:297mm; height:210mm; margin:0 auto 12mm; background:#fff;
               box-shadow:0 4px 20px rgba(0,0,0,0.18); overflow:hidden; }
  .cert-page svg { width:297mm; height:210mm; display:block; }
  .bar { position:sticky; top:0; z-index:5; background:#fff; border-bottom:1px solid #e5e7eb;
         padding:12px 18px; display:flex; flex-wrap:wrap; align-items:center; gap:10px; margin-bottom:14px; }
  .bar h1 { font-size:14px; margin:0; color:#111; flex:1; min-width:220px; }
  .bar h1 small { display:block; font-weight:400; color:#666; font-size:11px; margin-top:3px; }
  .btn { border:none; border-radius:6px; padding:9px 18px; font-size:13px; font-weight:700; cursor:pointer; }
  .btn-main { background:${BRAND}; color:#fff; }
  .btn-alt { background:#fff; color:${BRAND}; border:1px solid ${BRAND}; }
  .btn-ghost { background:#f3f4f6; color:#374151; }
  .btn:disabled { opacity:.5; cursor:default; }
  .warn { flex-basis:100%; font-size:11.5px; color:#b91c1c; background:#fef2f2; border:1px solid #fecaca; border-radius:6px; padding:8px 10px; }
  .note { flex-basis:100%; font-size:11px; color:#555; }
  .veil { position:fixed; inset:0; background:rgba(17,24,39,.45); display:none; align-items:center; justify-content:center; z-index:10; padding:16px; }
  .veil.on { display:flex; }
  .card { background:#fff; border-radius:12px; width:100%; max-width:520px; max-height:88vh; display:flex; flex-direction:column; box-shadow:0 20px 50px rgba(0,0,0,.3); }
  .card h2 { font-size:16px; margin:0; padding:16px 18px 4px; color:#111; }
  .card p { font-size:12px; color:#555; margin:0; padding:0 18px 10px; line-height:1.5; }
  .card ul { list-style:none; margin:0; padding:0 18px; overflow:auto; border-top:1px solid #f3f4f6; border-bottom:1px solid #f3f4f6; }
  .card li label { display:flex; gap:10px; align-items:flex-start; padding:8px 0; font-size:12.5px; color:#111; cursor:pointer; border-bottom:1px solid #f9fafb; }
  .card li small { color:#b45309; font-weight:700; }
  .card .acts { display:flex; justify-content:flex-end; gap:8px; padding:12px 18px; flex-wrap:wrap; }
  .card .msg { font-size:12px; padding:0 18px 10px; }
  .loading { text-align:center; padding:80px 20px; color:#555; font-size:14px; }
  @media print {
    html, body { background:#fff; }
    .no-print { display:none !important; }
    .sog-sheet, .cert-page { margin:0; box-shadow:none; }
    * { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  }
`

// Open the job's window now, while the click still allows a window to open.
export function openPrintJobWindow(title = 'Print') {
  const win = window.open('', '_blank', 'width=980,height=760')
  if (!win) { alert('Popup blocked — please allow popups for this site, then try again.'); return null }
  win.document.write(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><title>${esc(title)}</title>
    <style>body{margin:0;font-family:Arial,sans-serif;background:#f3f4f6}</style></head>
    <body><div id="p" style="text-align:center;padding:80px 20px;color:#555;font-size:14px;">Preparing documents…</div></body></html>`)
  win.document.close()
  return win
}

/**
 * Fetch every document's data and write the finished job into `win`.
 *
 * entries: [{ student, doc, results }] — doc as studentPrintPlan returns it,
 *          results the student's student_results rows.
 * opts:    { jobId, title, autoPrint: false | 'print' | 'pdf' }
 *
 * Resolves to { built, failed } — failed: [{ entry, message }].
 */
export async function fillPrintJob(win, entries, { jobId, title = 'Print', autoPrint = false } = {}) {
  const cache = {}
  const built = [], failed = []
  let done = 0
  const progress = () => {
    try {
      const p = win.document.getElementById('p')
      if (p) p.textContent = `Preparing documents… ${done} of ${entries.length}`
    } catch { /* the window was closed */ }
  }
  // A few at a time: each marksheet is several queries, and a selection of a
  // hundred students should not fire them all at once.
  const queue = entries.map((e, i) => ({ e, i }))
  const out = new Array(entries.length)
  async function worker() {
    for (let job = queue.shift(); job; job = queue.shift()) {
      try { out[job.i] = { entry: job.e, sheet: await buildSheet(job.e, cache) } }
      catch (err) { out[job.i] = { entry: job.e, error: err?.message || String(err) } }
      done++; progress()
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, entries.length) }, worker))
  for (const o of out) (o.sheet ? built : failed).push(o.error ? { entry: o.entry, message: o.error } : o)

  if (win.closed) return { built, failed, closed: true }

  win.document.open()
  win.document.write(printJobHTML({
    title, jobId, autoPrint,
    docs: built.map(({ entry }) => ({
      student_id: entry.student.id,
      doc_type: entry.doc.doc_type,
      semester: entry.doc.semester,
      label: `${entry.student.student_name || ''} — ${docTitle(entry.doc)}`,
      // How many times it had been printed when the job was made.
      before: entry.doc.count || 0,
    })),
    sheets: built.map(b => b.sheet),
    failed: failed.map(f => ({ label: `${f.entry.student.student_name || ''} — ${docTitle(f.entry.doc)}`, message: f.message })),
  }))
  win.document.close()
  return { built, failed }
}

/**
 * The job page itself. Pure, so it can be rendered and checked on its own.
 *   docs:   [{ student_id, doc_type, semester, label, before }] — one per sheet
 *   sheets: [{ kind: 'sog' | 'cert', html }]
 *   failed: [{ label, message }] — documents that could not be prepared
 */
export function printJobHTML({ title = 'Print', jobId = '', docs = [], sheets = [], failed = [], autoPrint = false }) {
  const students = new Set(docs.map(d => d.student_id)).size
  const pages = sheets.map(sheet => sheet.kind === 'cert'
    ? `<div class="pg pg-cert"><div class="cert-page">${sheet.html}</div></div>`
    : `<div class="pg pg-sog">${sheet.html}</div>`).join('')
  const failNote = failed.length
    ? `<div class="warn"><b>${failed.length} document${failed.length === 1 ? '' : 's'} could not be prepared and ${failed.length === 1 ? 'is' : 'are'} not in this job:</b><br/>${
      failed.map(f => `${esc(f.label)}: ${esc(f.message)}`).join('<br/>')}</div>`
    : ''

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
<title>${esc(title)}</title>
<style>${PAGE_STYLE}</style></head>
<body>
  <div class="bar no-print">
    <h1>${esc(title)}
      <small>${docs.length} document${docs.length === 1 ? '' : 's'} · ${students} student${students === 1 ? '' : 's'}</small></h1>
    <button class="btn btn-main" onclick="go('print')" ${docs.length ? '' : 'disabled'}>🖨 Print</button>
    <button class="btn btn-alt" onclick="go('pdf')" ${docs.length ? '' : 'disabled'}>⬇ Download PDF</button>
    <button class="btn btn-ghost" onclick="ask()" ${docs.length ? '' : 'disabled'}>Mark as printed…</button>
    <div class="note" id="hint">A4 at 100% scale, margins None, headers and footers off. For a PDF, choose <b>Save as PDF</b> as the destination.</div>
    ${failNote}
  </div>
  ${pages || '<div class="loading">Nothing to print.</div>'}

  <div class="veil no-print" id="veil"><div class="card">
    <h2 id="q-title">Did these documents print correctly?</h2>
    <p id="q-text">Tick only what actually printed (or was saved as PDF). Anything left unticked stays pending and can be printed again.</p>
    <ul id="q-list"></ul>
    <div class="msg" id="q-msg"></div>
    <div class="acts" id="q-acts"></div>
  </div></div>

<script>
  var JOB = ${json(jobId || '')}
  var DOCS = ${json(docs)}
  // d.done: how many times this window has recorded the document. A document
  // recorded once and printed again from here is a reprint; one left unticked
  // the first time is still a first print.
  DOCS.forEach(function (d) { d.done = 0 })
  var sent = []             // indexes of the documents awaiting the Exam Section's answer
  var busy = false

  // Squeeze any filled-in certificate value that would run past its line.
  function fit() {
    document.querySelectorAll('text[data-max]').forEach(function (t) {
      t.removeAttribute('textLength'); t.removeAttribute('lengthAdjust')
      var max = parseFloat(t.getAttribute('data-max'))
      if (t.getComputedTextLength() > max) {
        t.setAttribute('textLength', max); t.setAttribute('lengthAdjust', 'spacingAndGlyphs')
      }
    })
  }
  function ready(cb) {
    var run = function () { (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(function () { fit(); cb && cb() }) }
    if (document.readyState === 'complete') run(); else window.addEventListener('load', run)
  }
  ready()

  function go(mode) {
    document.getElementById('hint').innerHTML = mode === 'pdf'
      ? 'In the dialog, set Destination to <b>Save as PDF</b>, margins None, scale 100%.'
      : 'A4 at 100% scale, margins None, headers and footers off. For a PDF, choose <b>Save as PDF</b> as the destination.'
    ready(function () { window.print() })
  }
  // Every time the print dialog closes — printed or cancelled, the browser
  // cannot tell which — ask.
  window.addEventListener('afterprint', function () { setTimeout(ask, 50) })

  var ACTS = '<button class="btn btn-ghost" onclick="closeAsk()">Not printed</button>'
    + '<button class="btn btn-main" id="q-ok" onclick="record()">Mark as printed</button>'
  function ask() {
    if (!DOCS.length || busy) return
    var again = DOCS.some(function (d) { return d.done > 0 })
    // After a record the buttons become Back / Close; put them back.
    document.getElementById('q-acts').innerHTML = ACTS
    document.getElementById('q-title').textContent = again
      ? 'Record another print?'
      : 'Did these documents print correctly?'
    document.getElementById('q-text').textContent = again
      ? 'Some of these are already recorded as printed from this window. Tick only what you have just printed — anything printed before is counted as a reprint.'
      : 'Tick only what actually printed (or was saved as PDF). Anything left unticked stays pending and can be printed again.'
    var list = document.getElementById('q-list')
    list.innerHTML = ''
    DOCS.forEach(function (d, i) {
      var times = d.before + d.done
      var li = document.createElement('li')
      li.innerHTML = '<label><input type="checkbox" ' + (d.done ? '' : 'checked') + ' data-i="' + i + '"/><span></span></label>'
      li.querySelector('span').textContent = d.label
      if (times > 0) {
        var sm = document.createElement('small')
        sm.textContent = '  · already printed ' + times + ' time' + (times === 1 ? '' : 's') + ' — this will be a reprint'
        li.querySelector('span').appendChild(sm)
      }
      list.appendChild(li)
    })
    document.getElementById('q-ok').textContent = DOCS.some(function (d) { return d.before + d.done > 0 })
      ? 'Confirm Reprint' : 'Mark as printed'
    document.getElementById('q-ok').disabled = false
    document.getElementById('q-msg').textContent = ''
    document.getElementById('veil').classList.add('on')
  }
  function closeAsk() { if (!busy) document.getElementById('veil').classList.remove('on') }

  function openerOrigin() {
    try { return window.opener && !window.opener.closed ? window.opener.location.origin : null } catch (e) { return null }
  }
  var timer = null
  function record() {
    var items = []
    sent = []
    document.querySelectorAll('#q-list input:checked').forEach(function (c) {
      var i = Number(c.getAttribute('data-i')), d = DOCS[i]
      sent.push(i)
      items.push({ student_id: d.student_id, doc_type: d.doc_type, semester: d.semester })
    })
    var msg = document.getElementById('q-msg')
    if (!items.length) { msg.style.color = '#b45309'; msg.textContent = 'Nothing ticked — nothing will be recorded.'; return }
    var origin = openerOrigin()
    if (!origin) {
      msg.style.color = '#b91c1c'
      msg.textContent = 'The Exam Section tab that opened this window is closed, so the print cannot be recorded. Open the Print tab again and print from there.'
      return
    }
    busy = true
    document.getElementById('q-ok').disabled = true
    msg.style.color = '#555'; msg.textContent = 'Recording…'
    window.opener.postMessage({ type: 'sog-print-job', jobId: JOB, items: items }, origin)
    clearTimeout(timer)
    timer = setTimeout(function () {
      if (!busy) return
      busy = false
      document.getElementById('q-ok').disabled = false
      msg.style.color = '#b91c1c'
      msg.textContent = 'No answer from the Exam Section tab. Check that it is still open and signed in, then try again.'
    }, 20000)
  }
  window.addEventListener('message', function (e) {
    if (e.source !== window.opener) return
    var d = e.data
    if (!d || d.type !== 'sog-print-job-recorded' || d.jobId !== JOB) return
    clearTimeout(timer)
    busy = false
    var msg = document.getElementById('q-msg')
    if (d.ok) {
      sent.forEach(function (i) { DOCS[i].done++ })
      sent = []
      msg.style.color = '#047857'
      msg.textContent = '✓ ' + (d.message || 'Recorded.') + ' You can close this window.'
      document.getElementById('q-acts').innerHTML = '<button class="btn btn-ghost" onclick="closeAsk()">Back</button><button class="btn btn-main" onclick="window.close()">Close window</button>'
    } else {
      msg.style.color = '#b91c1c'
      msg.textContent = d.message || 'Not recorded.'
      document.getElementById('q-ok').disabled = false
    }
  })
  ${autoPrint ? `ready(function () { go(${json(autoPrint)}) })` : ''}
</script>
</body></html>`
}
