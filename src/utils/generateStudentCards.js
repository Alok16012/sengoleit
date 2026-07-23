import { formatDate } from './formatDate'

// Use the app's own bundled logo. Cards render in a window.open popup whose
// base URL is about:blank, so a root-relative path won't resolve — build an
// absolute URL from the running origin instead.
const LOGO_URL = (typeof window !== 'undefined' ? window.location.origin : '') + '/assets/logo.png'
const UNI_NAME = 'Sengol International University'
const UNI_SHORT = 'SIU'
const UNI_ADDRESS = 'Lower Pepthang, PO - Lingmoo, District - Namchi, Sikkim - 737134'
const UNI_PHONE = '+91-9205299887'
const UNI_EMAIL = 'info@sengolinternationaluniversity.edu.in'
const UNI_WEB = 'www.sengolinternationaluniversity.edu.in'
const UNI_ACT = 'Established under Act No. 14 of 2025, Sikkim State Legislative Assembly'
const UNI_UGC = 'Estb. by the Act of State Govt. & Under Section 2(f) of UGC Act 1956. Govt. of India'
const BRAND = '#933d18'
const GOLD = '#d9a441'

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
    /* margin:0 so the browser omits its own header/footer (page title + URL) */
    @page { margin:0; }
    @media print {
      body { background:#fff; padding:8mm; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .no-print { display:none !important; }
    }
    table { border-collapse:collapse; }
  </style>`

/* ───────────────────────────────────────────────────
   1. STUDENT IDENTITY CARD
─────────────────────────────────────────────────── */
export function generateIDCard(s) {
  const prog = s.programs?.program_name || s.program_name || '—'

  // Course length in years, from complete_duration ("3 years") or duration+unit.
  const courseYears = () => {
    const cd = String(s.programs?.complete_duration || '')
    const m = cd.match(/(\d+)\s*year/i)
    if (m) return parseInt(m[1], 10)
    const dur = Number(s.programs?.duration) || 0
    if (!dur) return 0
    return s.programs?.semester_year === 'Year' ? dur : Math.round(dur / 2)
  }

  // "Valid upto" — a single end date: admission date + course years. Falls back
  // to the session end date, then to an academic-year range if no dates exist.
  const validUpto = () => {
    const yrs = courseYears()
    const base = s.date_of_admission || s.date_of_submission || s.academic_sessions?.start_date
    if (base && yrs) {
      const d = new Date(base)
      if (!isNaN(d.getTime())) { d.setFullYear(d.getFullYear() + yrs); return fmtDate(d) }
    }
    if (s.academic_sessions?.end_date) return fmtDate(s.academic_sessions.end_date)
    const ay = String(s.academic_year || '').match(/(20\d{2})/)
    if (ay && yrs) return `${parseInt(ay[1], 10) + yrs}`
    return s.academic_year || s.academic_sessions?.session_name || '—'
  }

  // Address collapsed into the reference's two-line "line / State :.. , PIN Code :.." shape.
  const line1 = [
    s.perm_village_town || s.student_perm_village_town,
    s.perm_landmark || s.student_perm_landmark,
    s.perm_city || s.student_perm_city,
    s.perm_district || s.student_perm_district,
  ].filter(Boolean).join(' ')
  const stt = s.perm_state || s.student_perm_state
  const pin = s.perm_pin_code || s.student_perm_pin_code
  const line2 = [stt ? `State :${stt}` : null, pin ? `PIN Code :${pin}` : null].filter(Boolean).join(', ')
  const addressHtml = [line1, line2].filter(Boolean).join('<br/>') || '—'

  const contact = s.mobile_no || s.whatsapp_no

  // Top block: right-hand label : value rows (Enrollment, Valid upto, ...).
  const detRow = (label, value) => `<tr>
    <td style="font-size:9.5px;color:#222;white-space:nowrap;padding:3px 6px 3px 0;vertical-align:top;letter-spacing:0.02em;">${label}</td>
    <td style="font-size:9.5px;color:#111;padding:3px 0;vertical-align:top;">: &nbsp;<span style="font-weight:700;">${v(value)}</span></td>
  </tr>`

  // Lower block: Programme / Father Name / Address / Contact.
  const infoRow = (label, valueHtml, top) => `<tr>
    <td style="font-size:10px;color:#222;white-space:nowrap;padding:6px 8px 6px 0;vertical-align:top;">${label}</td>
    <td style="font-size:10px;color:#111;padding:6px 0;vertical-align:${top ? 'top' : 'middle'};">: &nbsp;<span style="font-weight:600;">${valueHtml}</span></td>
  </tr>`

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
  <title>ID Card — ${v(s.student_name)}</title>${baseStyle}</head>
<body>
<div style="max-width:400px;margin:24px auto;">
  ${printBtn()}

  <!-- CARD -->
  <div style="width:380px;margin:0 auto;border:1.5px solid #999;background:#fff;box-shadow:0 6px 24px rgba(0,0,0,0.16);position:relative;overflow:hidden;">

    <!-- Watermark layer: diagonal repeated university name + emblem + brand waves -->
    <div style="position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden;">
      <!-- brand decorative wave shapes -->
      <div style="position:absolute;top:120px;left:-90px;width:220px;height:220px;border-radius:50%;background:${BRAND};opacity:0.07;"></div>
      <div style="position:absolute;top:300px;left:-70px;width:180px;height:180px;border-radius:50%;background:${GOLD};opacity:0.10;"></div>
      <div style="position:absolute;bottom:70px;right:-80px;width:200px;height:200px;border-radius:50%;background:${BRAND};opacity:0.05;"></div>
      <!-- diagonal repeated text watermark -->
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-32deg);width:640px;text-align:center;line-height:2.6;opacity:0.06;color:${BRAND};font-weight:900;font-size:15px;letter-spacing:1px;">
        ${(UNI_NAME.toUpperCase() + '&nbsp;&nbsp;&nbsp; ').repeat(9)}
      </div>
      <!-- faint centre emblem -->
      <img src="${LOGO_URL}" style="position:absolute;top:46%;left:50%;width:150px;height:150px;object-fit:contain;transform:translate(-50%,-50%);opacity:0.06;" onerror="this.style.display='none'"/>
    </div>

    <!-- CONTENT -->
    <div style="position:relative;z-index:1;padding:14px 20px 0;">

      <!-- Header: emblem + university name + address + recognition -->
      <table style="width:100%;">
        <tr>
          <td style="width:52px;vertical-align:top;">
            <img src="${LOGO_URL}" width="48" height="48" style="border-radius:50%;object-fit:contain;background:#fff;" onerror="this.style.display='none'"/>
          </td>
          <td style="vertical-align:top;padding-left:8px;">
            <div style="color:${BRAND};font-size:15px;font-weight:900;line-height:1.15;">${UNI_NAME}, Sikkim</div>
            <div style="color:#333;font-size:8px;margin-top:3px;line-height:1.3;">${UNI_ADDRESS}</div>
            <div style="color:#333;font-size:7.5px;margin-top:2px;line-height:1.3;">${UNI_UGC}</div>
          </td>
        </tr>
      </table>

      <!-- STUDENT -->
      <div style="text-align:center;margin-top:12px;">
        <span style="color:${BRAND};font-size:15px;font-weight:900;letter-spacing:0.08em;">STUDENT</span>
      </div>

      <!-- IDENTITY CARD bar -->
      <div style="background:${BRAND};text-align:center;padding:6px;margin-top:6px;border-top:2px solid ${GOLD};border-bottom:2px solid ${GOLD};">
        <span style="color:#fff;font-size:14px;font-weight:800;letter-spacing:0.14em;">IDENTITY CARD</span>
      </div>

      <!-- Top detail block (indented) -->
      <table style="margin:14px 0 6px 20px;">
        ${detRow('ENROLLMENT NO', s.enrollment_no || s.registration_no)}
        ${detRow('Valid upto', validUpto())}
        ${detRow('Blood Group', s.blood_group)}
        ${detRow('Height', s.height)}
        ${detRow('Identification Marks', s.identification_marks)}
      </table>

      <!-- Student name band -->
      <div style="text-align:center;margin:12px 0;padding:7px 4px;border-top:1.5px solid ${GOLD};border-bottom:1.5px solid ${GOLD};background:rgba(147,61,24,0.06);">
        <span style="font-size:17px;font-weight:900;color:${BRAND};letter-spacing:0.03em;">${v(s.student_name).toUpperCase()}</span>
      </div>

      <!-- Lower detail block -->
      <table style="width:100%;margin-top:6px;">
        ${infoRow('Programme', prog)}
        ${infoRow('Father Name', v(s.fathers_name))}
        ${infoRow('Address', addressHtml, true)}
        ${infoRow('Contact No', v(contact))}
      </table>

      <!-- Signature -->
      <div style="margin:26px 0 10px;">
        ${s.signature_url
          ? `<img src="${s.signature_url}" style="height:30px;max-width:150px;object-fit:contain;display:block;"/>`
          : ''
        }
        <div style="border-top:1.5px dashed #333;width:180px;margin-top:${s.signature_url ? '2px' : '30px'};"></div>
        <div style="font-size:9px;color:#333;margin-top:3px;">(Student Signature)</div>
      </div>
    </div>

    <!-- Footer -->
    <div style="background:${BRAND};text-align:center;padding:6px 10px;border-top:2px solid ${GOLD};position:relative;z-index:1;">
      <span style="color:#fff;font-size:9px;font-weight:600;">This card is not transferable and it's the property of university.</span>
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
