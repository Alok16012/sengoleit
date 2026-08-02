import { UNI_NAME, UNI_ADDRESS, UNI_ACT, BRAND } from './generateStudentCards'
import { formatDate } from './formatDate'

// Shared table exports for the admin reports.
// columns: [{ header, value: (row) => string, pdfValue?: (row) => string }]
// `value` is what Excel gets — money stays a bare number there so a column can
// still be summed. `pdfValue`, where a column supplies it, is what the printed
// sheet shows instead (e.g. the same figure as ₹1,23,456).

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ))
}

// Excel opens CSV directly. A UTF-8 BOM keeps ₹ and Indian names readable, and
// every field is quoted so commas inside a name/address can't split a column.
export function exportCsv(filename, columns, rows) {
  if (!rows.length) { alert('Nothing to export — the current filters match no rows.'); return }
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const lines = [
    columns.map(c => cell(c.header)).join(','),
    ...rows.map(r => columns.map(c => cell(c.value(r))).join(',')),
  ]
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// A print-ready sheet (landscape A4) that the browser turns into a PDF — same
// approach as the other documents, so no PDF library is needed.
// `meta` lines describe the filters the report was run with.
export function exportPdf(title, columns, rows, meta = []) {
  if (!rows.length) { alert('Nothing to export — the current filters match no rows.'); return }
  const win = window.open('', '_blank', 'width=1100,height=760')
  if (!win) { alert('Popup blocked — please allow popups for this site.'); return }

  const head = columns.map(c => `<th>${esc(c.header)}</th>`).join('')
  const body = rows.map((r, i) => `<tr>
    <td class="num">${i + 1}</td>
    ${columns.map(c => `<td>${esc((c.pdfValue || c.value)(r))}</td>`).join('')}
  </tr>`).join('')

  win.document.write(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
<title>${esc(title)}</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:"Times New Roman",Times,Georgia,serif; color:#111; padding:14px 18px; }
  @page { size: A4 landscape; margin:10mm; }
  @media print { .no-print { display:none !important; } body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }
  table { border-collapse:collapse; width:100%; }
  th { background:${BRAND}; color:#fff; font-size:9.5px; text-align:left; padding:6px 8px; }
  td { font-size:9.5px; padding:5px 8px; border-bottom:1px solid #eee; }
  td.num { color:#999; width:32px; }
  tr:nth-child(even) td { background:#fafafa; }
</style></head><body>
  <div class="no-print" style="text-align:center;padding:0 0 14px;">
    <button onclick="window.print()" style="background:${BRAND};color:#fff;border:none;padding:9px 30px;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer;">⬇ Download / Print PDF</button>
  </div>
  <div style="text-align:center;border-bottom:2px solid ${BRAND};padding-bottom:8px;margin-bottom:10px;">
    <div style="font-size:17px;font-weight:900;color:${BRAND};letter-spacing:0.04em;">${esc(UNI_NAME.toUpperCase())}</div>
    <div style="font-size:8.5px;color:#555;margin-top:2px;">${esc(UNI_ADDRESS)}</div>
    <div style="font-size:8px;color:#888;font-style:italic;margin-top:1px;">${esc(UNI_ACT)}</div>
    <div style="font-size:12.5px;font-weight:800;margin-top:7px;">${esc(title)}</div>
    ${meta.length ? `<div style="font-size:9px;color:#555;margin-top:3px;">${meta.map(esc).join(' &nbsp;·&nbsp; ')}</div>` : ''}
  </div>
  <table><thead><tr><th>#</th>${head}</tr></thead><tbody>${body}</tbody></table>
  <div style="margin-top:10px;font-size:9px;color:#666;display:flex;justify-content:space-between;">
    <span><strong>Total: ${rows.length}</strong></span>
    <span>Generated: ${formatDate(new Date())}</span>
  </div>
</body></html>`)
  win.document.close()
  win.focus()
}
