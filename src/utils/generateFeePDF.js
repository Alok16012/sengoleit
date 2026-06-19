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

function calcTotals(feeItems, totalSems) {
  const sems = totalSems || 1
  let entryTotal = 0, divideTotal = 0, multiplyPerSem = 0, multiply2PerSem = 0
  ;(feeItems || []).forEach(i => {
    const a = parseFloat(i.amount) || 0
    if (i.category === 'entry')     entryTotal      += a
    if (i.category === 'divide')    divideTotal     += a
    if (i.category === 'multiply')  multiplyPerSem  += a
    if (i.category === 'multiply2') multiply2PerSem += a
  })
  const dividePerSem = divideTotal / sems
  const perSem1      = dividePerSem + multiplyPerSem
  const perSem       = dividePerSem + multiplyPerSem + multiply2PerSem
  const grandTotal   = entryTotal + divideTotal + multiplyPerSem * sems + multiply2PerSem * Math.max(sems - 1, 0)
  return { entryTotal, divideTotal, dividePerSem, multiplyPerSem, multiply2PerSem, perSem1, perSem, grandTotal }
}

export function generateFeePDF(struct) {
  const { programs, academic_sessions, fee_items, total_semesters } = struct
  const sems      = total_semesters || 4
  const progName  = programs?.program_name || '—'
  const sessName  = academic_sessions?.session_name || 'All Sessions'
  const { entryTotal, divideTotal, dividePerSem, multiplyPerSem, multiply2PerSem, perSem1, perSem, grandTotal } = calcTotals(fee_items, sems)

  const entryItems    = (fee_items || []).filter(i => i.category === 'entry')
  const divideItems   = (fee_items || []).filter(i => i.category === 'divide')
  const multiplyItems = (fee_items || []).filter(i => i.category === 'multiply')
  const multiply2Items = (fee_items || []).filter(i => i.category === 'multiply2')

  /* ── semester header cells ── */
  const semHeaders = Array.from({ length: sems }, (_, i) =>
    `<th style="padding:5px 8px;text-align:right;font-size:9px;color:white;font-weight:700;white-space:nowrap;border-right:1px solid rgba(255,255,255,0.15);">Sem ${i + 1}</th>`
  ).join('')

  /* ── fee row renderer ── */
  function feeRow(item, idx, bgLight) {
    const a = parseFloat(item.amount) || 0
    let entryCell = '<td style="padding:5px 8px;text-align:right;color:#9ca3af;font-size:9px;">—</td>'
    let semCells  = ''
    let totalCell = ''

    if (item.category === 'entry') {
      entryCell = `<td style="padding:5px 8px;text-align:right;font-weight:700;color:#d97706;font-size:9px;">₹${fmt(a)}</td>`
      semCells  = Array.from({ length: sems }, () =>
        `<td style="padding:5px 8px;text-align:right;color:#d1d5db;font-size:9px;">—</td>`).join('')
      totalCell = `<td style="padding:5px 8px;text-align:right;font-weight:700;color:#111;font-size:9px;">₹${fmt(a)}</td>`
    } else if (item.category === 'divide') {
      const ps = sems > 0 ? a / sems : 0
      semCells  = Array.from({ length: sems }, () =>
        `<td style="padding:5px 8px;text-align:right;font-weight:600;color:#933d18;font-size:9px;">${ps > 0 ? '₹' + fmt(ps) : '—'}</td>`).join('')
      totalCell = `<td style="padding:5px 8px;text-align:right;font-weight:700;color:#111;font-size:9px;">₹${fmt(a)}</td>`
    } else if (item.category === 'multiply2') {
      semCells = `<td style="padding:5px 8px;text-align:right;color:#d1d5db;font-size:9px;">—</td>`
        + Array.from({ length: sems - 1 }, () =>
          `<td style="padding:5px 8px;text-align:right;font-weight:600;color:#7c3aed;font-size:9px;">${a > 0 ? '₹' + fmt(a) : '—'}</td>`).join('')
      totalCell = `<td style="padding:5px 8px;text-align:right;font-weight:700;color:#111;font-size:9px;">${a > 0 ? '₹' + fmt(a * Math.max(sems - 1, 0)) : '—'}</td>`
    } else {
      semCells  = Array.from({ length: sems }, () =>
        `<td style="padding:5px 8px;text-align:right;font-weight:600;color:#4338ca;font-size:9px;">${a > 0 ? '₹' + fmt(a) : '—'}</td>`).join('')
      totalCell = `<td style="padding:5px 8px;text-align:right;font-weight:700;color:#111;font-size:9px;">${a > 0 ? '₹' + fmt(a * sems) : '—'}</td>`
    }

    const badge = item.category === 'entry'
      ? `<span style="background:#fef3c7;color:#92400e;font-size:8px;font-weight:700;padding:1px 5px;border-radius:3px;">One-time</span>`
      : item.category === 'divide'
        ? `<span style="background:#fef9f6;color:#933d18;font-size:8px;font-weight:700;padding:1px 5px;border-radius:3px;">÷${sems}</span>`
        : item.category === 'multiply2'
          ? `<span style="background:#f3e8ff;color:#7c3aed;font-size:8px;font-weight:700;padding:1px 5px;border-radius:3px;">Sem 2+</span>`
          : `<span style="background:#eef2ff;color:#4338ca;font-size:8px;font-weight:700;padding:1px 5px;border-radius:3px;">×${sems}</span>`

    const rowBg = bgLight ? 'background:#f9fafb;' : 'background:#ffffff;'
    return `<tr style="${rowBg}border-bottom:1px solid #f3f4f6;">
      <td style="padding:5px 10px;font-size:9.5px;font-weight:600;color:#111;">${item.label}</td>
      <td style="padding:5px 8px;text-align:center;">${badge}</td>
      ${entryCell}
      ${semCells}
      ${totalCell}
    </tr>`
  }

  /* ── semester totals row ── */
  const semTotalCells = Array.from({ length: sems }, (_, i) => {
    const amt = i === 0 ? entryTotal + perSem1 : perSem
    return `<td style="padding:6px 8px;text-align:right;font-weight:900;color:white;font-size:9.5px;white-space:nowrap;">₹${fmt(amt)}</td>`
  }).join('')

  /* ── summary row (sem-wise cumulative) ── */
  const cumulRows = Array.from({ length: sems }, (_, i) => {
    const semPay  = i === 0 ? entryTotal + perSem1 : perSem
    const cumul   = entryTotal + perSem1 + perSem * i
    const isFirst = i === 0
    return `<tr style="${isFirst ? 'background:#fef9f6;' : ''}border-bottom:1px solid #f3f4f6;">
      <td style="padding:5px 10px;font-size:9.5px;font-weight:700;color:#111;">Semester ${i + 1}${isFirst ? ' *' : ''}</td>
      <td style="padding:5px 10px;text-align:right;font-size:9.5px;color:#555;">₹${fmt(semPay)}</td>
      <td style="padding:5px 10px;text-align:right;font-size:9.5px;font-weight:700;color:#933d18;">₹${fmt(cumul)}</td>
    </tr>`
  }).join('')

  const allRows = [
    ...entryItems.map((item, i) => feeRow(item, i, i % 2 === 0)),
    ...divideItems.map((item, i) => feeRow(item, i, i % 2 !== 0)),
    ...multiplyItems.map((item, i) => feeRow(item, i, i % 2 === 0)),
    ...multiply2Items.map((item, i) => feeRow(item, i, i % 2 !== 0)),
  ].join('')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Fee Structure — ${progName}</title>
  <style>
    * { box-sizing:border-box; margin:0; padding:0; }
    body { font-family: Arial, Helvetica, sans-serif; background:#fff; color:#111; font-size:10px; }
    @page { size:A4 landscape; margin:10mm; }
    @media print {
      body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .no-print { display:none !important; }
    }
    .page { max-width:1050px; margin:0 auto; }
    table { border-collapse:collapse; width:100%; }
  </style>
</head>
<body>
<div class="page">

  <!-- Print button -->
  <div class="no-print" style="text-align:center;padding:12px 0 18px;">
    <button onclick="window.print()" style="background:#933d18;color:#fff;border:none;padding:10px 32px;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer;">⬇ Download / Print PDF</button>
  </div>

  <!-- HEADER -->
  <div style="border:2px solid #933d18;border-radius:6px;overflow:hidden;margin-bottom:14px;">
    <div style="background:#933d18;padding:10px 16px;">
      <table>
        <tr>
          <td style="width:65px;vertical-align:middle;">
            <img src="${LOGO_URL}" width="56" height="56" style="border-radius:50%;background:#fff;padding:3px;object-fit:contain;" onerror="this.style.display='none'"/>
          </td>
          <td style="text-align:center;vertical-align:middle;padding:0 12px;">
            <div style="color:#fff;font-size:20px;font-weight:900;letter-spacing:0.03em;">${UNI_NAME.toUpperCase()}</div>
            <div style="color:rgba(255,255,255,0.85);font-size:10.5px;margin-top:2px;font-style:italic;">${UNI_TAGLINE}</div>
            <div style="color:rgba(255,255,255,0.6);font-size:8px;margin-top:3px;">${UNI_ACT}</div>
          </td>
          <td style="width:65px;vertical-align:middle;text-align:right;">
            <img src="${LOGO_URL}" width="56" height="56" style="border-radius:50%;background:#fff;padding:3px;object-fit:contain;" onerror="this.style.display='none'"/>
          </td>
        </tr>
      </table>
    </div>
    <div style="background:#fef9f6;padding:4px 16px;text-align:center;border-top:1px solid #f0ebe7;">
      <span style="font-size:8.5px;color:#666;">${UNI_ADDRESS} &nbsp;|&nbsp; ${UNI_PHONE} &nbsp;|&nbsp; ${UNI_EMAIL} &nbsp;|&nbsp; ${UNI_WEB}</span>
    </div>
  </div>

  <!-- TITLE BANNER -->
  <div style="text-align:center;margin-bottom:12px;">
    <div style="display:inline-block;background:#933d18;color:#fff;padding:5px 32px;border-radius:4px;">
      <span style="font-size:13px;font-weight:900;letter-spacing:0.1em;">FEE STRUCTURE</span>
    </div>
  </div>

  <!-- COURSE INFO BOX -->
  <div style="border:1px solid #e5e7eb;border-radius:5px;padding:10px 14px;margin-bottom:14px;background:#f9fafb;">
    <table>
      <tr>
        <td style="width:50%;font-size:10px;color:#555;">
          <strong style="color:#933d18;">Program:</strong>&nbsp;
          <strong style="color:#111;font-size:11px;">${progName}</strong>
        </td>
        <td style="width:25%;font-size:10px;color:#555;text-align:center;">
          <strong style="color:#933d18;">Session:</strong>&nbsp;${sessName}
        </td>
        <td style="width:25%;font-size:10px;color:#555;text-align:right;">
          <strong style="color:#933d18;">Duration:</strong>&nbsp;${sems} Semesters
        </td>
      </tr>
    </table>
  </div>

  <!-- FEE STRUCTURE TABLE -->
  <div style="margin-bottom:16px;border-radius:5px;overflow:hidden;border:1px solid #e5e7eb;">
    <table>
      <thead>
        <tr style="background:#933d18;">
          <th style="padding:7px 10px;text-align:left;font-size:9.5px;color:white;font-weight:700;border-right:1px solid rgba(255,255,255,0.15);">Fee Component</th>
          <th style="padding:7px 8px;text-align:center;font-size:9px;color:white;font-weight:700;border-right:1px solid rgba(255,255,255,0.15);">Type</th>
          <th style="padding:7px 8px;text-align:right;font-size:9px;color:white;font-weight:700;border-right:1px solid rgba(255,255,255,0.15);white-space:nowrap;">Entry (One-time)</th>
          ${semHeaders}
          <th style="padding:7px 8px;text-align:right;font-size:9px;color:white;font-weight:700;white-space:nowrap;">Course Total</th>
        </tr>
      </thead>
      <tbody>
        ${allRows || '<tr><td colspan="20" style="padding:12px;text-align:center;color:#9ca3af;font-size:9px;">No fee components added</td></tr>'}
      </tbody>
      <tfoot>
        <tr style="background:#1f2937;border-top:2px solid #374151;">
          <td style="padding:7px 10px;font-weight:900;color:white;font-size:10px;">TOTAL</td>
          <td style="padding:7px 8px;"></td>
          <td style="padding:7px 8px;text-align:right;font-weight:900;color:#fbbf24;font-size:10px;">${entryTotal > 0 ? '₹' + fmt(entryTotal) : '—'}</td>
          ${semTotalCells}
          <td style="padding:7px 8px;text-align:right;font-weight:900;color:#34d399;font-size:10.5px;">₹${fmt(grandTotal)}</td>
        </tr>
      </tfoot>
    </table>
  </div>

  <!-- TWO COLUMN: summary + legend -->
  <table style="margin-bottom:16px;">
    <tr>
      <!-- Semester-wise payment schedule -->
      <td style="width:50%;vertical-align:top;padding-right:10px;">
        <div style="border:1px solid #e5e7eb;border-radius:5px;overflow:hidden;">
          <div style="background:#f3f4f6;padding:6px 12px;border-bottom:1px solid #e5e7eb;">
            <span style="font-size:10px;font-weight:700;color:#374151;">Semester-wise Payment Schedule</span>
          </div>
          <table>
            <thead>
              <tr style="background:#f9fafb;border-bottom:1px solid #e5e7eb;">
                <th style="padding:5px 10px;text-align:left;font-size:8.5px;color:#6b7280;font-weight:600;">Semester</th>
                <th style="padding:5px 10px;text-align:right;font-size:8.5px;color:#6b7280;font-weight:600;">Amount Due</th>
                <th style="padding:5px 10px;text-align:right;font-size:8.5px;color:#6b7280;font-weight:600;">Cumulative</th>
              </tr>
            </thead>
            <tbody>${cumulRows}</tbody>
            <tfoot>
              <tr style="background:#f3f4f6;border-top:1.5px solid #d1d5db;">
                <td style="padding:5px 10px;font-weight:700;font-size:9px;color:#111;">Grand Total</td>
                <td style="padding:5px 10px;"></td>
                <td style="padding:5px 10px;text-align:right;font-weight:900;color:#933d18;font-size:10px;">₹${fmt(grandTotal)}</td>
              </tr>
            </tfoot>
          </table>
          <p style="font-size:7.5px;color:#9ca3af;padding:4px 10px;">* Semester 1 includes one-time entry fees</p>
        </div>
      </td>

      <!-- Fee summary breakdown -->
      <td style="width:50%;vertical-align:top;padding-left:10px;">
        <div style="border:1px solid #e5e7eb;border-radius:5px;overflow:hidden;">
          <div style="background:#f3f4f6;padding:6px 12px;border-bottom:1px solid #e5e7eb;">
            <span style="font-size:10px;font-weight:700;color:#374151;">Fee Summary</span>
          </div>
          <div style="padding:10px 12px;">
            <table style="width:100%;">
              <tr><td style="font-size:9px;color:#555;padding:3px 0;">One-time Entry Fees</td><td style="font-size:9px;font-weight:700;color:#d97706;text-align:right;padding:3px 0;">₹${fmt(entryTotal)}</td></tr>
              <tr><td style="font-size:9px;color:#555;padding:3px 0;">University Fee (Total Course)</td><td style="font-size:9px;font-weight:700;color:#933d18;text-align:right;padding:3px 0;">₹${fmt(divideTotal)}</td></tr>
              <tr><td style="font-size:9px;color:#555;padding:3px 0;">Per Sem Fees (×${sems} sems)</td><td style="font-size:9px;font-weight:700;color:#4338ca;text-align:right;padding:3px 0;">₹${fmt(multiplyPerSem * sems)}</td></tr>
              <tr><td style="font-size:9px;color:#555;padding:3px 0;">Reg. Fee from Sem 2 (×${Math.max(sems-1,0)} sems)</td><td style="font-size:9px;font-weight:700;color:#7c3aed;text-align:right;padding:3px 0;">₹${fmt(multiply2PerSem * Math.max(sems-1,0))}</td></tr>
              <tr style="border-top:1.5px solid #e5e7eb;"><td style="font-size:10px;font-weight:700;color:#111;padding:5px 0 0;">Sem 1 Amount</td><td style="font-size:10px;font-weight:900;color:#059669;text-align:right;padding:5px 0 0;">₹${fmt(entryTotal + perSem1)}</td></tr>
              <tr><td style="font-size:10px;font-weight:700;color:#111;padding:2px 0 0;">Sem 2+ Amount</td><td style="font-size:10px;font-weight:900;color:#7c3aed;text-align:right;padding:2px 0 0;">₹${fmt(perSem)}</td></tr>
              <tr style="border-top:1.5px solid #e5e7eb;"><td style="font-size:11px;font-weight:900;color:#111;padding:5px 0 0;">Grand Total</td><td style="font-size:13px;font-weight:900;color:#933d18;text-align:right;padding:5px 0 0;">₹${fmt(grandTotal)}</td></tr>
            </table>
          </div>
        </div>

        <!-- Legend -->
        <div style="border:1px solid #e5e7eb;border-radius:5px;padding:8px 12px;margin-top:10px;">
          <p style="font-size:8.5px;font-weight:700;color:#374151;margin-bottom:5px;">Legend</p>
          <table style="width:100%;">
            <tr>
              <td style="padding:2px 0;"><span style="background:#fef3c7;color:#92400e;font-size:7.5px;font-weight:700;padding:1px 5px;border-radius:3px;">One-time</span>&nbsp;<span style="font-size:8px;color:#555;">Paid once at admission</span></td>
            </tr>
            <tr>
              <td style="padding:2px 0;"><span style="background:#fef9f6;color:#933d18;font-size:7.5px;font-weight:700;padding:1px 5px;border-radius:3px;">÷${sems}</span>&nbsp;<span style="font-size:8px;color:#555;">Total divided equally per semester</span></td>
            </tr>
            <tr>
              <td style="padding:2px 0;"><span style="background:#eef2ff;color:#4338ca;font-size:7.5px;font-weight:700;padding:1px 5px;border-radius:3px;">×${sems}</span>&nbsp;<span style="font-size:8px;color:#555;">Fixed amount charged each semester</span></td>
            </tr>
          </table>
        </div>
      </td>
    </tr>
  </table>

  <!-- DECLARATION -->
  <div style="border:1px solid #e5e7eb;border-radius:4px;padding:8px 12px;margin-bottom:12px;background:#fffdf9;">
    <p style="font-size:8.5px;color:#555;line-height:1.6;">
      This fee structure is issued by <strong>${UNI_NAME}</strong> and is subject to revision. All fees are non-refundable once paid unless stated otherwise. For queries, contact the accounts department.
    </p>
  </div>

  <!-- SIGNATURES -->
  <table style="width:100%;margin-top:10px;">
    <tr>
      <td style="width:33%;text-align:center;padding:0 10px;">
        <div style="height:38px;border-bottom:1px solid #aaa;margin-bottom:3px;"></div>
        <p style="font-size:8.5px;color:#555;">Prepared By</p>
      </td>
      <td style="width:34%;text-align:center;padding:0 10px;">
        <div style="height:38px;border-bottom:1px solid #aaa;margin-bottom:3px;"></div>
        <p style="font-size:8.5px;color:#555;">Accounts Department</p>
      </td>
      <td style="width:33%;text-align:center;padding:0 10px;">
        <div style="height:38px;border-bottom:1px solid #aaa;margin-bottom:3px;"></div>
        <p style="font-size:8.5px;color:#555;">Authorized Signatory</p>
        <p style="font-size:8.5px;font-weight:700;color:#111;margin-top:1px;">${UNI_NAME}</p>
      </td>
    </tr>
  </table>

  <!-- FOOTER -->
  <div style="border-top:2px solid #933d18;margin-top:12px;padding-top:5px;text-align:center;">
    <p style="font-size:8px;color:#555;">${UNI_NAME} &nbsp;•&nbsp; ${UNI_ADDRESS}</p>
    <p style="font-size:8px;color:#933d18;margin-top:1px;font-weight:600;">${UNI_PHONE} &nbsp;|&nbsp; ${UNI_EMAIL} &nbsp;|&nbsp; ${UNI_WEB}</p>
    <p style="font-size:7px;color:#bbb;margin-top:2px;">${UNI_ACT} &nbsp;•&nbsp; Generated: ${formatDate(new Date())}</p>
  </div>

</div>
</body>
</html>`

  const win = window.open('', '_blank', 'width=1100,height=760')
  if (!win) { alert('Popup blocked. Please allow popups.'); return }
  win.document.write(html)
  win.document.close()
  win.focus()
}
