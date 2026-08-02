import { UNI_NAME, UNI_ADDRESS, UNI_ACT, BRAND, isPhdProgram } from './generateStudentCards'
import { esc } from './generateStudentPDF'
import { formatDate } from './formatDate'

// Every uploaded document, in the order an office file is assembled.
// Fields that accept several files hold them comma-joined.
const DOCS = [
  ['photo_url', 'Passport Photo'],
  ['signature_url', 'Signature'],
  ['aadhar_url', 'Aadhar Card (Front)'],
  ['aadhar_back_url', 'Aadhar Card (Back)'],
  ['tenth_marksheet_url', '10th Marksheet'],
  ['twelfth_marksheet_url', '12th Marksheet'],
  ['diploma_marksheet_url', 'Diploma Marksheet'],
  ['ug_marksheet_url', 'UG Marksheet'],
  ['pg_marksheet_url', 'PG Marksheet'],
  ['mphil_marksheet_url', 'M.Phil Marksheet'],
  ['others_marksheet_url', 'Other Marksheet'],
  ['tc_url', 'Transfer Certificate'],
  ['migration_url', 'Migration Certificate'],
  ['noc_url', 'No Objection Certificate'],
  ['declaration_url', 'Declaration Form'],
]

const isPdf = (url) => /\.pdf(\?|$)/i.test(String(url))

// One printable sheet per uploaded document, so the whole set can be printed
// in a single go and filed. Images are placed inline; PDF uploads can't be
// merged in the browser without a PDF library, so they are listed at the end
// with links to open and print separately (rather than silently printing a
// blank page).
export function generateAllDocumentsPDF(s) {
  // The student must already have signed URLs — pass the row through
  // resolveStudentDocUrls first, otherwise the private-bucket links 404.
  const items = []
  for (const [field, label] of DOCS) {
    const raw = s[field]
    if (!raw) continue
    const parts = String(raw).split(',').map(p => p.trim()).filter(Boolean)
    parts.forEach((url, i) => {
      items.push({ url, label: parts.length > 1 ? `${label} (${i + 1}/${parts.length})` : label })
    })
  }

  if (!items.length) {
    alert('This student has no uploaded documents yet.')
    return
  }

  const prog = s.programs?.program_name || s.program_name || '—'
  // A Ph.D candidate is identified by the application number until enrolment.
  const idLabel = isPhdProgram(prog) ? 'Application No' : 'Registration No'
  const idValue = isPhdProgram(prog)
    ? (s.admission_number || s.enrollment_no)
    : (s.registration_no || s.enrollment_no || s.admission_number)

  const images = items.filter(it => !isPdf(it.url))
  const pdfs = items.filter(it => isPdf(it.url))

  const runningHead = (label) => `
    <div class="head">
      <div>
        <span class="uni">${esc(UNI_NAME.toUpperCase())}</span>
        <span class="sub">${esc(s.student_name)} &nbsp;·&nbsp; ${esc(idValue || '—')} &nbsp;·&nbsp; ${esc(prog)}</span>
      </div>
      <span class="doc">${esc(label)}</span>
    </div>`

  const imagePages = images.map(it => `
    <section class="page">
      ${runningHead(it.label)}
      <div class="frame"><img src="${esc(it.url)}" alt="${esc(it.label)}"/></div>
    </section>`).join('')

  const pdfPage = pdfs.length ? `
    <section class="page">
      ${runningHead('PDF attachments')}
      <div style="padding:18px 4px;">
        <p style="font-size:12px;color:#333;margin-bottom:10px;">
          These documents were uploaded as PDF files. Open each one and print it separately —
          they cannot be merged into this sheet.
        </p>
        <ol style="font-size:12px;color:#111;margin-left:18px;line-height:1.9;">
          ${pdfs.map(it => `<li><strong>${esc(it.label)}</strong> — <a href="${esc(it.url)}" target="_blank" rel="noreferrer">open</a></li>`).join('')}
        </ol>
      </div>
    </section>` : ''

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
<title>Documents — ${esc(s.student_name)}</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:"Times New Roman",Times,Georgia,serif; background:#e9e9e9; color:#111; }
  @page { size:A4 portrait; margin:10mm; }
  .page {
    width:190mm; min-height:272mm; margin:14px auto; background:#fff; padding:10mm;
    box-shadow:0 4px 18px rgba(0,0,0,0.15); display:flex; flex-direction:column;
  }
  .head { display:flex; align-items:flex-end; justify-content:space-between;
          border-bottom:2px solid ${BRAND}; padding-bottom:6px; margin-bottom:10px; gap:12px; }
  .uni { display:block; font-size:13px; font-weight:900; color:${BRAND}; letter-spacing:0.03em; }
  .sub { display:block; font-size:9px; color:#555; margin-top:2px; }
  .doc { font-size:11px; font-weight:800; color:#111; white-space:nowrap; }
  .frame { flex:1; display:flex; align-items:center; justify-content:center; overflow:hidden; }
  .frame img { max-width:100%; max-height:245mm; object-fit:contain; }
  @media print {
    body { background:#fff; }
    .no-print { display:none !important; }
    .page { margin:0; box-shadow:none; width:auto; min-height:auto; padding:0;
            page-break-after:always; break-after:page; }
    .page:last-child { page-break-after:auto; break-after:auto; }
  }
</style></head>
<body>
  <div class="no-print" style="text-align:center;padding:14px 0 4px;">
    <button onclick="window.print()" style="background:${BRAND};color:#fff;border:none;padding:10px 32px;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer;">
      ⬇ Download / Print All Documents
    </button>
    <p style="font-size:11px;color:#555;margin-top:6px;">
      ${images.length} document${images.length === 1 ? '' : 's'} — one per page${pdfs.length ? ` · ${pdfs.length} PDF attachment${pdfs.length === 1 ? '' : 's'} listed at the end` : ''}
      &nbsp;·&nbsp; Generated ${formatDate(new Date())}
    </p>
  </div>
  ${imagePages}
  ${pdfPage}
</body></html>`

  const win = window.open('', '_blank', 'width=900,height=760')
  if (!win) { alert('Popup blocked — please allow popups for this site.'); return }
  win.document.write(html)
  win.document.close()
  win.focus()
}
