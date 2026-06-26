import { formatDate } from './formatDate'

const LOGO_URL = 'https://sengolinternationaluniversity.edu.in/images/logo.png'
const UNI_NAME = 'Sengol International University'
const UNI_SHORT = 'SIU'
const UNI_ADDRESS = 'Lower Pepthang, PO - Lingmoo, District - Namchi, Sikkim - 737134'
const UNI_PHONE = '+91-9205299887'
const UNI_EMAIL = 'info@sengolinternationaluniversity.edu.in'
const UNI_WEB = 'www.sengolinternationaluniversity.edu.in'
const UNI_ACT = 'Established under Act No. 14 of 2025, Sikkim State Legislative Assembly'
const BRAND = '#933d18'

function v(val) {
  return val && String(val).trim() ? String(val).trim() : '—'
}

function fmtDate(d) {
  return formatDate(d)
}

function addr(s) {
  return [
    s.perm_village_town || s.student_perm_village_town,
    s.perm_landmark || s.student_perm_landmark,
    s.perm_city || s.student_perm_city,
    s.perm_district || s.student_perm_district,
    s.perm_state || s.student_perm_state,
    (s.perm_pin_code || s.student_perm_pin_code) ? 'PIN: ' + (s.perm_pin_code || s.student_perm_pin_code) : null,
  ].filter(Boolean).join(', ') || '—'
}

function openWindow(html, title) {
  const win = window.open('', '_blank', 'width=860,height=700')
  if (!win) { alert('Popup blocked — please allow popups for this site.'); return }
  win.document.write(html)
  win.document.close()
  win.focus()
}

function uniHeader() {
  return `
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="width:72px;vertical-align:middle;text-align:center;">
          <img src="${LOGO_URL}" width="62" height="62"
            style="border-radius:50%;border:2px solid ${BRAND};padding:2px;object-fit:contain;background:#fff;"
            onerror="this.style.display='none'" />
        </td>
        <td style="text-align:center;vertical-align:middle;padding:0 10px;">
          <div style="font-size:22px;font-weight:900;color:${BRAND};letter-spacing:0.04em;">${UNI_NAME.toUpperCase()}</div>
          <div style="font-size:9px;color:#555;margin-top:3px;font-weight:600;">${UNI_ADDRESS}</div>
          <div style="font-size:8.5px;color:#888;margin-top:2px;font-style:italic;">${UNI_ACT}</div>
        </td>
        <td style="width:72px;vertical-align:middle;text-align:center;">
          <img src="${LOGO_URL}" width="62" height="62"
            style="border-radius:50%;border:2px solid ${BRAND};padding:2px;object-fit:contain;background:#fff;"
            onerror="this.style.display='none'" />
        </td>
      </tr>
    </table>`
}

function printBtn() {
  return `<div class="no-print" style="text-align:center;padding:12px 0 18px;">
    <button onclick="window.print()" style="background:${BRAND};color:#fff;border:none;padding:10px 34px;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer;letter-spacing:0.04em;">⬇ Download / Print</button>
  </div>`
}

const baseStyle = `
  <style>
    * { box-sizing:border-box; margin:0; padding:0; }
    body { font-family:Arial,Helvetica,sans-serif; background:#f5f5f5; }
    @page { margin:10mm; }
    @media print {
      body { background:#fff; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .no-print { display:none !important; }
    }
    table { border-collapse:collapse; }
  </style>`

/* ───────────────────────────────────────────────────
   1. STUDENT IDENTITY CARD
─────────────────────────────────────────────────── */
export function generateIDCard(s) {
  const prog = s.programs?.program_name || s.program_name || '—'
  const validUpto = s.valid_upto
    ? formatDate(s.valid_upto)
    : '—'

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
  <title>ID Card — ${v(s.student_name)}</title>${baseStyle}</head>
<body>
<div style="max-width:380px;margin:24px auto;">
  ${printBtn()}

  <!-- CARD -->
  <div style="border:2.5px solid ${BRAND};border-radius:8px;overflow:hidden;background:#fff;box-shadow:0 4px 20px rgba(0,0,0,0.12);">

    <!-- Top header -->
    <div style="background:${BRAND};padding:12px 14px;">
      <table style="width:100%;">
        <tr>
          <td style="width:52px;vertical-align:middle;">
            <img src="${LOGO_URL}" width="46" height="46"
              style="border-radius:50%;background:#fff;padding:2px;object-fit:contain;"
              onerror="this.style.display='none'" />
          </td>
          <td style="text-align:center;vertical-align:middle;padding:0 8px;">
            <div style="color:#fff;font-size:14px;font-weight:900;letter-spacing:0.05em;">${UNI_NAME.toUpperCase()}</div>
            <div style="color:rgba(255,255,255,0.75);font-size:7.5px;margin-top:2px;">${UNI_ADDRESS}</div>
            <div style="color:rgba(255,255,255,0.6);font-size:7px;margin-top:1px;font-style:italic;">${UNI_ACT}</div>
          </td>
        </tr>
      </table>
    </div>

    <!-- STUDENT IDENTITY CARD label -->
    <div style="background:#222;text-align:center;padding:5px;">
      <span style="color:#fff;font-size:13px;font-weight:900;letter-spacing:0.12em;">STUDENT &nbsp; IDENTITY &nbsp; CARD</span>
    </div>

    <!-- Body -->
    <div style="padding:14px;background:#fff;">
      <table style="width:100%;">
        <tr>
          <!-- Left info -->
          <td style="vertical-align:top;padding-right:12px;">
            <table>
              <tr>
                <td style="font-size:8.5px;font-weight:700;color:#555;white-space:nowrap;padding-right:5px;padding-bottom:5px;">ENROLLMENT NO</td>
                <td style="font-size:8.5px;font-weight:900;color:${BRAND};padding-bottom:5px;">: ${v(s.enrollment_no)}</td>
              </tr>
              <tr>
                <td style="font-size:8.5px;font-weight:700;color:#555;white-space:nowrap;padding-right:5px;padding-bottom:5px;">Valid Upto</td>
                <td style="font-size:8.5px;color:#111;padding-bottom:5px;">: ${validUpto}</td>
              </tr>
              <tr>
                <td style="font-size:8.5px;font-weight:700;color:#555;white-space:nowrap;padding-right:5px;padding-bottom:5px;">Blood Group</td>
                <td style="font-size:8.5px;color:#111;padding-bottom:5px;">: ${v(s.blood_group)}</td>
              </tr>
              <tr>
                <td style="font-size:8.5px;font-weight:700;color:#555;white-space:nowrap;padding-right:5px;padding-bottom:5px;">Height</td>
                <td style="font-size:8.5px;color:#111;padding-bottom:5px;">: ${v(s.height)}</td>
              </tr>
              <tr>
                <td style="font-size:8.5px;font-weight:700;color:#555;white-space:nowrap;padding-right:5px;vertical-align:top;">ID Marks</td>
                <td style="font-size:8.5px;color:#111;max-width:140px;word-break:break-word;vertical-align:top;">: ${v(s.identification_marks)}</td>
              </tr>
            </table>
          </td>
          <!-- Right: photo -->
          <td style="width:82px;vertical-align:top;text-align:center;">
            ${s.photo_url
              ? `<img src="${s.photo_url}" alt="Photo" style="width:76px;height:94px;object-fit:cover;border:2px solid #e5e7eb;border-radius:4px;display:block;"/>`
              : `<div style="width:76px;height:94px;border:1.5px dashed #ccc;border-radius:4px;display:flex;align-items:center;justify-content:center;background:#fafafa;"><span style="font-size:8px;color:#bbb;text-align:center;line-height:1.4;">Photo<br/>Here</span></div>`
            }
          </td>
        </tr>
      </table>

      <!-- Name band -->
      <div style="background:${BRAND};color:#fff;text-align:center;padding:6px 10px;margin-top:10px;border-radius:3px;">
        <span style="font-size:14px;font-weight:900;letter-spacing:0.05em;text-transform:uppercase;">${v(s.student_name)}</span>
      </div>

      <!-- Programme / Father / Address -->
      <table style="margin-top:8px;width:100%;">
        <tr>
          <td style="font-size:8.5px;font-weight:700;color:#555;white-space:nowrap;padding-right:5px;padding-bottom:4px;vertical-align:top;">Programme</td>
          <td style="font-size:8.5px;color:#111;padding-bottom:4px;font-style:italic;">: ${prog}</td>
        </tr>
        <tr>
          <td style="font-size:8.5px;font-weight:700;color:#555;white-space:nowrap;padding-right:5px;padding-bottom:4px;vertical-align:top;">Father Name</td>
          <td style="font-size:8.5px;color:#111;padding-bottom:4px;font-style:italic;">: ${v(s.fathers_name)}</td>
        </tr>
        <tr>
          <td style="font-size:8.5px;font-weight:700;color:#555;white-space:nowrap;padding-right:5px;padding-bottom:4px;vertical-align:top;">Address</td>
          <td style="font-size:8.5px;color:#111;padding-bottom:4px;font-style:italic;max-width:220px;word-break:break-word;">: ${addr(s)}</td>
        </tr>
        <tr>
          <td style="font-size:8.5px;font-weight:700;color:#555;white-space:nowrap;padding-right:5px;">Contact No</td>
          <td style="font-size:8.5px;color:#111;font-style:italic;">: ${v(s.mobile_no)}</td>
        </tr>
      </table>

      <!-- Signature row -->
      <table style="width:100%;margin-top:12px;">
        <tr>
          <td style="width:50%;text-align:center;">
            ${s.signature_url
              ? `<img src="${s.signature_url}" style="height:34px;max-width:120px;object-fit:contain;border-bottom:1px solid #aaa;display:block;margin:0 auto;"/>`
              : `<div style="height:34px;border-bottom:1px solid #aaa;width:120px;margin:0 auto;"></div>`
            }
            <p style="font-size:7.5px;color:#666;margin-top:3px;">(Student Signature)</p>
          </td>
          <td style="width:50%;text-align:center;">
            <div style="height:34px;width:90px;margin:0 auto;border:1px dashed #ccc;border-radius:4px;"></div>
            <p style="font-size:7.5px;color:#666;margin-top:3px;">Controller of Examinations</p>
          </td>
        </tr>
      </table>
    </div>

    <!-- Footer band -->
    <div style="background:${BRAND};color:#fff;text-align:center;padding:5px 10px;">
      <span style="font-size:7.5px;font-weight:600;letter-spacing:0.04em;">This card is not transferable and it's the property of the university.</span>
    </div>
  </div>
</div>
</body></html>`
  openWindow(html, 'ID Card')
}

/* ───────────────────────────────────────────────────
   2. ADMIT CARD
─────────────────────────────────────────────────── */
export function generateAdmitCard(s, subjects = [], meta = {}) {
  // Hard gate: admit card cannot be generated before the configured date/time.
  if (meta.admitCardAt) {
    const releaseAt = new Date(meta.admitCardAt)
    if (!isNaN(releaseAt.getTime()) && Date.now() < releaseAt.getTime()) {
      alert(`Admit card will be available from ${meta.admitCardTime || releaseAt.toLocaleString('en-IN')}. It cannot be generated before that.`)
      return
    }
  }
  const prog = s.programs?.program_name || s.program_name || '—'
  const sess = s.academic_sessions?.session_name || s.session_name || '—'
  const deptCode = s.centers?.center_code || s.center_code || (s.departments?.name ? s.departments.name.substring(0,6).toUpperCase() : '—')
  const defaultSubjects = subjects.length ? subjects : []
  const examSchedule  = meta.examSchedule || ''
  const admitCardTime = meta.admitCardTime || ''

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
  <title>Admit Card — ${v(s.student_name)}</title>${baseStyle}
  <style>
    .bordered { border:2px solid #333; }
    .cell-hd { background:#111;color:#fff;text-align:center;font-weight:700;font-size:10px;padding:5px 8px; }
    .cell-val { text-align:center;font-size:11px;font-weight:700;color:#333;padding:6px 8px; }
  </style>
</head>
<body>
<div style="max-width:680px;margin:24px auto;">
  ${printBtn()}

  <!-- CARD -->
  <div style="border:2.5px solid #333;background:#fff;padding:0;box-shadow:0 4px 20px rgba(0,0,0,0.12);">

    <!-- University header -->
    <div style="padding:14px 18px 10px;border-bottom:2px solid #333;">
      ${uniHeader()}
    </div>

    <!-- ADMIT CARD title -->
    <div style="text-align:center;padding:8px;border-bottom:2px solid #333;background:#fafafa;">
      <span style="font-size:20px;font-weight:900;color:${BRAND};letter-spacing:0.12em;">ADMIT CARD</span>
      <div style="font-size:9px;color:#666;margin-top:2px;">${prog} &nbsp;—&nbsp; Semester Examination &nbsp;·&nbsp; ${sess}</div>
      ${admitCardTime ? `<div style="font-size:8.5px;color:#888;margin-top:2px;">Issued: ${admitCardTime}</div>` : ''}
    </div>

    <!-- 3-col reference header -->
    <table style="width:100%;border-collapse:collapse;border-bottom:2px solid #333;">
      <tr>
        <td class="cell-hd" style="width:33%;border-right:2px solid #333;">Registration No.</td>
        <td class="cell-hd" style="width:33%;border-right:2px solid #333;">Roll No (Enrollment)</td>
        <td class="cell-hd" style="width:34%;">University / Dept. Code</td>
      </tr>
      <tr>
        <td class="cell-val" style="border-right:2px solid #333;">${v(s.registration_no)}</td>
        <td class="cell-val" style="border-right:2px solid #333;">${v(s.enrollment_no)}</td>
        <td class="cell-val">${deptCode}</td>
      </tr>
    </table>

    <!-- Body -->
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <!-- Left: student info + subjects -->
        <td style="vertical-align:top;padding:14px 16px;border-right:2px solid #333;">
          <table>
            <tr>
              <td style="font-size:9.5px;font-weight:700;color:#333;padding-right:6px;padding-bottom:6px;white-space:nowrap;">Course Name</td>
              <td style="font-size:9.5px;color:#111;padding-bottom:6px;font-style:italic;">: ${prog}</td>
            </tr>
            <tr>
              <td style="font-size:9.5px;font-weight:700;color:#333;padding-right:6px;padding-bottom:6px;white-space:nowrap;">Student Name</td>
              <td style="font-size:10px;font-weight:700;color:#111;padding-bottom:6px;font-style:italic;">: ${v(s.student_name)}</td>
            </tr>
            <tr>
              <td style="font-size:9.5px;font-weight:700;color:#333;padding-right:6px;padding-bottom:6px;white-space:nowrap;">Date of Birth</td>
              <td style="font-size:9.5px;color:#111;padding-bottom:6px;font-style:italic;">: ${fmtDate(s.date_of_birth)}</td>
            </tr>
            <tr>
              <td style="font-size:9.5px;font-weight:700;color:#333;padding-right:6px;padding-bottom:6px;white-space:nowrap;">Center</td>
              <td style="font-size:9.5px;color:#111;padding-bottom:6px;font-style:italic;">: ${v(s.centers?.center_name)}</td>
            </tr>
            ${examSchedule ? `<tr>
              <td style="font-size:9.5px;font-weight:700;color:#333;padding-right:6px;padding-bottom:6px;white-space:nowrap;">Exam Schedule</td>
              <td style="font-size:9.5px;color:#111;padding-bottom:6px;font-style:italic;">: ${examSchedule}</td>
            </tr>` : ''}
          </table>

          <!-- Subjects / Papers -->
          <div style="margin-top:10px;">
            <div style="font-size:9px;font-weight:700;color:#333;font-style:italic;margin-bottom:5px;">Paper to be appeared</div>
            <div style="font-size:9px;font-weight:700;color:#555;margin-bottom:3px;font-style:italic;">Code :</div>
            ${defaultSubjects.length > 0
              ? defaultSubjects.map(sub => `<div style="font-size:9.5px;font-style:italic;color:#111;margin-left:10px;margin-bottom:2px;">${sub}</div>`).join('')
              : `<div style="font-size:9px;font-style:italic;color:#888;margin-left:10px;">As per university curriculum schedule</div>`
            }
          </div>
          <div style="margin-top:16px;font-size:8.5px;font-style:italic;color:#555;">
            ✦ Check and Confirm entry before the exam
          </div>
        </td>

        <!-- Right: photo + signature -->
        <td style="width:130px;vertical-align:top;text-align:center;padding:14px 12px;">
          ${s.photo_url
            ? `<img src="${s.photo_url}" alt="Photo" style="width:100px;height:120px;object-fit:cover;border:2px solid #ccc;display:block;margin:0 auto;"/>`
            : `<div style="width:100px;height:120px;border:1.5px solid #ccc;display:flex;align-items:center;justify-content:center;background:#fafafa;margin:0 auto;"><span style="font-size:8px;color:#bbb;text-align:center;">Photo</span></div>`
          }
          <p style="font-size:8px;color:#555;margin-top:4px;">(Student Photo)</p>

          <div style="margin-top:20px;">
            <div style="height:40px;width:100px;border-bottom:1px solid #888;margin:0 auto;"></div>
            <p style="font-size:8px;color:#555;margin-top:4px;">Controller of Examination</p>
          </div>
        </td>
      </tr>
    </table>

    <!-- Footer -->
    <div style="background:${BRAND};color:#fff;text-align:center;padding:5px 10px;border-top:2px solid #333;">
      <span style="font-size:8px;font-weight:600;">${UNI_NAME} &nbsp;·&nbsp; ${UNI_PHONE} &nbsp;|&nbsp; ${UNI_EMAIL} &nbsp;|&nbsp; ${UNI_WEB}</span>
    </div>
  </div>
</div>
</body></html>`
  openWindow(html, 'Admit Card')
}

/* ───────────────────────────────────────────────────
   3. REGISTRATION CERTIFICATE
─────────────────────────────────────────────────── */
export function generateRegistrationCertificate(s) {
  const prog = s.programs?.program_name || s.program_name || '—'
  const sess = s.academic_sessions?.session_name || s.session_name || '—'
  const centerCode = s.centers?.center_code || s.center_code || '—'
  const regYear = s.academic_year || sess || '—'

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
  <title>Registration Certificate — ${v(s.student_name)}</title>${baseStyle}
  <style>
    .hd-cell { background:#111;color:#fff;text-align:center;font-weight:700;font-size:10px;padding:5px 8px; }
    .val-cell { text-align:center;font-size:11px;font-weight:700;color:#333;padding:6px 8px; }
    .info-label { font-size:9.5px;font-weight:700;color:#111;padding-right:6px;padding-bottom:6px;white-space:nowrap;vertical-align:top;font-style:italic; }
    .info-val { font-size:9.5px;color:#111;padding-bottom:6px;font-style:italic; }
  </style>
</head>
<body>
<div style="max-width:680px;margin:24px auto;">
  ${printBtn()}

  <!-- CARD -->
  <div style="border:2.5px solid #333;background:#fff;box-shadow:0 4px 20px rgba(0,0,0,0.12);">

    <!-- University header -->
    <div style="padding:14px 18px 10px;border-bottom:2px solid #333;">
      ${uniHeader()}
    </div>

    <!-- REGISTRATION CERTIFICATE title -->
    <div style="text-align:center;padding:8px;border-bottom:2px solid #333;background:#fafafa;">
      <span style="font-size:18px;font-weight:900;color:${BRAND};letter-spacing:0.1em;">REGISTRATION CERTIFICATE</span>
    </div>

    <!-- 3-col reference header -->
    <table style="width:100%;border-collapse:collapse;border-bottom:2px solid #333;">
      <tr>
        <td class="hd-cell" style="width:33%;border-right:2px solid #333;">Registration No.</td>
        <td class="hd-cell" style="width:33%;border-right:2px solid #333;">Registration Year</td>
        <td class="hd-cell" style="width:34%;">Branch / Center Code</td>
      </tr>
      <tr>
        <td class="val-cell" style="border-right:2px solid #333;">${v(s.registration_no)}</td>
        <td class="val-cell" style="border-right:2px solid #333;">${regYear}</td>
        <td class="val-cell">${v(centerCode)}</td>
      </tr>
    </table>

    <!-- Body -->
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <!-- Left: student details -->
        <td style="vertical-align:top;padding:16px;border-right:2px solid #333;">
          <table style="width:100%;">
            <tr>
              <td class="info-label">University/Deptt.</td>
              <td class="info-val">: &nbsp;${UNI_NAME}</td>
            </tr>
            <tr>
              <td class="info-label">Course Name</td>
              <td class="info-val">: &nbsp;${prog}</td>
            </tr>
            <tr>
              <td class="info-label" style="padding-top:6px;padding-bottom:6px;">&nbsp;</td>
              <td></td>
            </tr>
            <tr>
              <td class="info-label">Student Name</td>
              <td style="font-size:10px;font-weight:900;color:#111;padding-bottom:6px;font-style:italic;">: &nbsp;${v(s.student_name)}</td>
            </tr>
            <tr>
              <td class="info-label">Date of Birth</td>
              <td class="info-val">: &nbsp;${fmtDate(s.date_of_birth)}</td>
            </tr>
            <tr>
              <td class="info-label">S/o D/o</td>
              <td class="info-val">: &nbsp;${v(s.fathers_name || s.mothers_name)}</td>
            </tr>
            <tr>
              <td class="info-label" style="vertical-align:top;">Address</td>
              <td style="font-size:9.5px;color:#111;padding-bottom:6px;font-style:italic;max-width:300px;word-break:break-word;vertical-align:top;">: &nbsp;${addr(s)}</td>
            </tr>
            <tr>
              <td class="info-label">PIN No</td>
              <td class="info-val">: &nbsp;${v(s.perm_pin_code || s.student_perm_pin_code)}</td>
            </tr>
          </table>

          <!-- Student signature line -->
          <div style="margin-top:24px;text-align:left;">
            ${s.signature_url
              ? `<img src="${s.signature_url}" style="height:38px;max-width:140px;object-fit:contain;display:block;border-bottom:1px solid #888;padding-bottom:2px;"/>`
              : `<div style="height:38px;width:140px;border-bottom:1px solid #888;"></div>`
            }
            <p style="font-size:8.5px;color:#555;margin-top:3px;font-style:italic;">Student Signature</p>
          </div>
        </td>

        <!-- Right: photo -->
        <td style="width:140px;vertical-align:top;text-align:center;padding:16px 12px;">
          ${s.photo_url
            ? `<img src="${s.photo_url}" alt="Photo" style="width:108px;height:132px;object-fit:cover;border:2px solid #ccc;display:block;margin:0 auto;"/>`
            : `<div style="width:108px;height:132px;border:1.5px solid #ccc;display:flex;align-items:center;justify-content:center;background:#fafafa;margin:0 auto;"><span style="font-size:8px;color:#bbb;text-align:center;">Photo<br/>Here</span></div>`
          }
          <p style="font-size:8px;color:#555;margin-top:4px;">(Affixed by student)</p>

          <div style="margin-top:32px;">
            <div style="height:40px;width:108px;border-bottom:1px solid #888;margin:0 auto;"></div>
            <p style="font-size:8px;color:#555;margin-top:4px;">Registrar / Controller</p>
          </div>
        </td>
      </tr>
    </table>

    <!-- Footer -->
    <div style="background:${BRAND};color:#fff;text-align:center;padding:5px 10px;border-top:2px solid #333;">
      <span style="font-size:8px;font-weight:600;">${UNI_NAME} &nbsp;·&nbsp; ${UNI_PHONE} &nbsp;|&nbsp; ${UNI_EMAIL} &nbsp;|&nbsp; ${UNI_WEB}</span>
    </div>
  </div>
</div>
</body></html>`
  openWindow(html, 'Registration Certificate')
}
