import { formatDate } from './formatDate'

const LOGO_URL = 'https://sengolinternationaluniversity.edu.in/images/logo.png'
const UNI_NAME    = 'Sengol International University'
const UNI_TAGLINE = 'Educate, Empower, Excel'
const UNI_ADDRESS = 'Lower Pepthang, PO - Lingmoo, District - Namchi, Sikkim - 737134'
const UNI_PHONE   = '+91-9205299887'
const UNI_EMAIL   = 'info@sengolinternationaluniversity.edu.in'
const UNI_WEB     = 'www.sengolinternationaluniversity.edu.in'
const UNI_ACT     = 'Established under Act No. 14 of 2025, Sikkim State Legislative Assembly'

const fmt = n => {
  const num = parseFloat(n) || 0
  return num % 1 === 0 ? num.toLocaleString('en-IN') : num.toFixed(2)
}

// rows: [{ session, department, progType, mode, programName, semester, fee }]
// filters: { session, department, progType, mode, program } (display labels, optional)
export function generateCourseFeeListPDF(rows = [], filters = {}) {
  if (!rows.length) { alert('No fee rows to export. Run a search first.'); return }

  const grandTotal = rows.reduce((s, r) => s + (Number(r.fee) || 0), 0)

  // A meta box built only from filters that are actually set.
  const metaPairs = [
    ['Session',      filters.session],
    ['Department',   filters.department],
    ['Program Type', filters.progType],
    ['Mode',         filters.mode],
    ['Program',      filters.program],
  ].filter(([, v]) => v)

  const metaCells = metaPairs.map(([k, v]) =>
    `<td style="font-size:10px;color:#555;padding:2px 14px 2px 0;">
       <strong style="color:#933d18;">${k}:</strong>&nbsp;<strong style="color:#111;">${v}</strong>
     </td>`).join('')

  const bodyRows = rows.map((r, i) => `
    <tr style="${i % 2 ? 'background:#f9fafb;' : 'background:#ffffff;'}border-bottom:1px solid #f3f4f6;">
      <td style="padding:6px 10px;font-size:9.5px;color:#9ca3af;">${i + 1}</td>
      <td style="padding:6px 10px;font-size:10px;font-weight:700;color:#111;">${r.programName || '—'}</td>
      <td style="padding:6px 10px;font-size:9.5px;color:#555;">${r.semester || '—'}</td>
      <td style="padding:6px 12px;font-size:10px;font-weight:700;color:#933d18;text-align:right;white-space:nowrap;">₹${fmt(r.fee)}</td>
    </tr>`).join('')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Center Course Fee${filters.program ? ' — ' + filters.program : ''}</title>
  <style>
    * { box-sizing:border-box; margin:0; padding:0; }
    body { font-family:"Times New Roman", Times, Georgia, serif; background:#fff; color:#111; font-size:10px; }
    @page { size:A4 portrait; margin:12mm; }
    @media print {
      body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .no-print { display:none !important; }
    }
    .page { max-width:760px; margin:0 auto; }
    table { border-collapse:collapse; width:100%; }
  </style>
</head>
<body>
<div class="page">

  <div class="no-print" style="text-align:center;padding:12px 0 18px;">
    <button onclick="window.print()" style="background:#933d18;color:#fff;border:none;padding:10px 32px;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer;">⬇ Download / Print PDF</button>
  </div>

  <!-- HEADER -->
  <div style="border:2px solid #933d18;border-radius:6px;overflow:hidden;margin-bottom:14px;">
    <div style="background:#933d18;padding:10px 16px;">
      <table>
        <tr>
          <td style="width:62px;vertical-align:middle;">
            <img src="${LOGO_URL}" width="54" height="54" style="border-radius:50%;background:#fff;padding:3px;object-fit:contain;" onerror="this.style.display='none'"/>
          </td>
          <td style="text-align:center;vertical-align:middle;padding:0 12px;">
            <div style="color:#fff;font-size:19px;font-weight:900;letter-spacing:0.03em;">${UNI_NAME.toUpperCase()}</div>
            <div style="color:rgba(255,255,255,0.85);font-size:10px;margin-top:2px;font-style:italic;">${UNI_TAGLINE}</div>
            <div style="color:rgba(255,255,255,0.6);font-size:7.5px;margin-top:3px;">${UNI_ACT}</div>
          </td>
          <td style="width:62px;vertical-align:middle;text-align:right;">
            <img src="${LOGO_URL}" width="54" height="54" style="border-radius:50%;background:#fff;padding:3px;object-fit:contain;" onerror="this.style.display='none'"/>
          </td>
        </tr>
      </table>
    </div>
    <div style="background:#fef9f6;padding:4px 16px;text-align:center;border-top:1px solid #f0ebe7;">
      <span style="font-size:8px;color:#666;">${UNI_ADDRESS} &nbsp;|&nbsp; ${UNI_PHONE} &nbsp;|&nbsp; ${UNI_EMAIL}</span>
    </div>
  </div>

  <!-- TITLE -->
  <div style="text-align:center;margin-bottom:12px;">
    <div style="display:inline-block;background:#933d18;color:#fff;padding:5px 30px;border-radius:4px;">
      <span style="font-size:13px;font-weight:900;letter-spacing:0.1em;">CENTER COURSE FEE</span>
    </div>
  </div>

  ${metaPairs.length ? `
  <!-- FILTERS -->
  <div style="border:1px solid #e5e7eb;border-radius:5px;padding:8px 14px;margin-bottom:14px;background:#f9fafb;">
    <table><tr>${metaCells}</tr></table>
  </div>` : ''}

  <!-- FEE TABLE -->
  <div style="margin-bottom:14px;border-radius:5px;overflow:hidden;border:1px solid #e5e7eb;">
    <table>
      <thead>
        <tr style="background:#933d18;">
          <th style="padding:7px 10px;text-align:left;font-size:9.5px;color:#fff;font-weight:700;">S.No</th>
          <th style="padding:7px 10px;text-align:left;font-size:9.5px;color:#fff;font-weight:700;">Program Name</th>
          <th style="padding:7px 10px;text-align:left;font-size:9.5px;color:#fff;font-weight:700;">Semester</th>
          <th style="padding:7px 12px;text-align:right;font-size:9.5px;color:#fff;font-weight:700;">Fee</th>
        </tr>
      </thead>
      <tbody>${bodyRows}</tbody>
      <tfoot>
        <tr style="background:#1f2937;border-top:2px solid #374151;">
          <td colspan="3" style="padding:8px 10px;font-weight:900;color:#fff;font-size:10.5px;">GRAND TOTAL</td>
          <td style="padding:8px 12px;text-align:right;font-weight:900;color:#34d399;font-size:11px;white-space:nowrap;">₹${fmt(grandTotal)}</td>
        </tr>
      </tfoot>
    </table>
  </div>

  <!-- FOOTER -->
  <div style="border-top:2px solid #933d18;margin-top:14px;padding-top:5px;text-align:center;">
    <p style="font-size:8px;color:#555;">${UNI_NAME} &nbsp;•&nbsp; ${UNI_WEB}</p>
    <p style="font-size:7px;color:#bbb;margin-top:2px;">${UNI_ACT} &nbsp;•&nbsp; Generated: ${formatDate(new Date())}</p>
  </div>

</div>
</body>
</html>`

  const win = window.open('', '_blank', 'width=900,height=760')
  if (!win) { alert('Popup blocked. Please allow popups.'); return }
  win.document.write(html)
  win.document.close()
  win.focus()
}
