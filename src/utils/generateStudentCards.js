import { formatDate } from './formatDate'

// Use the app's own bundled logo. Cards render in a window.open popup whose
// base URL is about:blank, so a root-relative path won't resolve — build an
// absolute URL from the running origin instead.
const LOGO_URL = (typeof window !== 'undefined' ? window.location.origin : '') + '/assets/logo.png'
const LETTERHEAD_URL = (typeof window !== 'undefined' ? window.location.origin : '') + '/assets/letterhead.jpg'
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

// A PhD / doctoral entry — detected from the program name.
export function isPhdProgram(name) {
  return /ph\.?\s*d|doctor of philosophy|doctoral/i.test(String(name || ''))
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
  const regNo = s.registration_no || s.enrollment_no || s.admission_number
  const contact = s.mobile_no || s.whatsapp_no
  // Validity spans the whole course: start year → start year + course years.
  // e.g. a 2-year B.Ed starting 2025 → "2025-2027".
  const courseYears = () => {
    const m = String(s.programs?.complete_duration || '').match(/(\d+)\s*year/i)
    if (m) return parseInt(m[1], 10)
    const dur = Number(s.programs?.duration) || 0
    if (!dur) return 0
    return s.programs?.semester_year === 'Year' ? dur : Math.round(dur / 2)
  }
  const startYear = () => {
    const ay = String(s.academic_year || '').match(/(20\d{2})/)
    if (ay) return parseInt(ay[1], 10)
    const d = s.academic_sessions?.start_date || s.date_of_admission || s.date_of_submission
    const y = d ? new Date(d).getFullYear() : NaN
    return Number.isFinite(y) ? y : null
  }
  const vStart = startYear(), vYears = courseYears()
  const validity = vStart && vYears ? `${vStart}-${vStart + vYears}` : (s.academic_year || s.academic_sessions?.session_name || '—')
  // PhD entries carry a Reference No in place of the Registration No.
  const regLabel = isPhdProgram(prog) ? 'Reference No.' : 'Registration No.'

  // Full single-block address, comma-joined (matches the reference layout).
  const address = [
    s.perm_village_town || s.student_perm_village_town,
    s.perm_landmark || s.student_perm_landmark,
    s.perm_city || s.student_perm_city,
    s.perm_district || s.student_perm_district,
    s.perm_state || s.student_perm_state,
    (s.perm_pin_code || s.student_perm_pin_code) ? '- ' + (s.perm_pin_code || s.student_perm_pin_code) : null,
  ].filter(Boolean).join(', ') || '—'

  // Detail row: fixed-width label, colon, value. `hi` highlights the top row.
  const row = (label, value, hi) => `<tr>
    <td style="font-size:11px;color:${hi ? BRAND : '#222'};font-weight:${hi ? 700 : 600};white-space:nowrap;padding:2.5px 0;vertical-align:top;width:96px;">${label}</td>
    <td style="font-size:11px;color:${hi ? BRAND : '#222'};font-weight:${hi ? 700 : 400};padding:2.5px 0;vertical-align:top;">:&nbsp;${v(value)}</td>
  </tr>`

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
  <title>ID Card — ${v(s.student_name)}</title>${baseStyle}</head>
<body>
<div style="max-width:640px;margin:24px auto;">
  ${printBtn()}

  <!-- CARD (landscape) -->
  <div style="width:600px;margin:0 auto;border:1px solid #ccc;background:#fff;box-shadow:0 6px 24px rgba(0,0,0,0.16);position:relative;overflow:hidden;">

    <!-- Top: maroon stripe with white logo box overlapping -->
    <div style="position:relative;height:92px;">
      <div style="position:absolute;top:26px;left:0;right:0;height:40px;background:${BRAND};border-bottom:2px solid ${GOLD};"></div>
      <div style="position:absolute;top:12px;left:22px;background:#fff;border:1px solid #ddd;border-radius:10px;padding:7px 16px 5px;box-shadow:0 2px 8px rgba(0,0,0,0.18);display:flex;align-items:center;gap:12px;">
        <img src="${LOGO_URL}" width="52" height="52" style="object-fit:contain;" onerror="this.style.display='none'"/>
        <div style="line-height:1;">
          <div style="color:${BRAND};font-size:16px;font-weight:900;letter-spacing:0.02em;">SENGOL</div>
          <div style="color:${BRAND};font-size:13px;font-weight:800;letter-spacing:0.02em;margin-top:2px;">INTERNATIONAL</div>
          <div style="color:${BRAND};font-size:13px;font-weight:800;letter-spacing:0.02em;margin-top:2px;">UNIVERSITY</div>
        </div>
      </div>
    </div>

    <!-- UGC recognition line -->
    <div style="text-align:center;padding:2px 8px 4px;">
      <span style="font-size:8.5px;font-weight:700;color:#333;letter-spacing:0.02em;">${UNI_UGC}</span>
    </div>

    <!-- IDENTITY CARD title bar -->
    <div style="background:${BRAND};text-align:center;padding:4px;margin:0 22px 8px;border-radius:5px;border-top:1.5px solid ${GOLD};border-bottom:1.5px solid ${GOLD};">
      <span style="color:#fff;font-size:12px;font-weight:800;letter-spacing:0.18em;">IDENTITY CARD</span>
    </div>

    <!-- Body: photo/seal/signature | details -->
    <div style="display:flex;gap:16px;padding:4px 22px 14px;">
      <!-- Left column -->
      <div style="width:118px;flex-shrink:0;">
        <!-- photo with a faint seal overlapping its lower area -->
        <div style="position:relative;width:118px;">
          ${s.photo_url
            ? `<img src="${s.photo_url}" alt="Photo" style="width:118px;height:138px;object-fit:cover;border:1px solid #bbb;border-radius:8px;display:block;"/>`
            : `<div style="width:118px;height:138px;border:1px solid #bbb;border-radius:8px;background:#fafafa;display:flex;align-items:center;justify-content:center;font-size:10px;color:#bbb;">Photo</div>`
          }
          <img src="${LOGO_URL}" style="position:absolute;right:6px;bottom:6px;width:56px;height:56px;object-fit:contain;opacity:0.28;" onerror="this.style.display='none'"/>
        </div>
        <!-- signature below the photo -->
        <div style="text-align:center;margin-top:8px;height:34px;">
          ${s.signature_url
            ? `<img src="${s.signature_url}" style="height:30px;max-width:112px;object-fit:contain;display:inline-block;"/>`
            : ''
          }
        </div>
        <div style="border-top:1px solid #999;margin-top:2px;"></div>
        <div style="text-align:center;font-size:8px;color:#555;margin-top:2px;">Student Signature</div>
      </div>

      <!-- Right column: details -->
      <div style="flex:1;padding-top:2px;">
        <table style="width:100%;">
          ${row(regLabel, regNo, true)}
          ${row('Enrollment No', s.enrollment_no)}
          ${row('Name', s.student_name)}
          ${row('F./H. Name', s.fathers_name)}
          ${row('D.O.B.', fmtDate(s.date_of_birth))}
          ${row('Course', prog)}
          ${row('Session', s.academic_sessions?.session_name || s.session_name || s.academic_year)}
          ${row('Contact', contact)}
          ${row('Validity', validity)}
          ${row('Address', address)}
        </table>
      </div>
    </div>

    <!-- Computer-generated note -->
    <div style="text-align:center;padding:0 22px 5px;">
      <span style="font-size:7px;font-style:italic;color:#888;">This is a computer-generated ID Card and does not require any signature or seal.</span>
    </div>

    <!-- Bottom: maroon band with address + website box -->
    <div style="background:${BRAND};border-top:2px solid ${GOLD};display:flex;align-items:stretch;justify-content:space-between;">
      <span style="color:#fff;font-size:11px;font-weight:700;padding:7px 16px;align-self:center;">Address: ${UNI_ADDRESS}</span>
      <span style="background:${GOLD};color:#3a2000;font-size:11px;font-weight:800;padding:7px 18px;display:flex;align-items:center;">${UNI_WEB}</span>
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
  const examDates     = meta.examDates || ''
  const examTerm      = meta.examTerm || ''
  const semester      = meta.semester || ''
  const acadYear      = s.academic_year || ''

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
      <div style="font-size:9px;color:#666;margin-top:2px;">${prog} &nbsp;—&nbsp; ${meta.semester ? `Semester ${meta.semester} ` : ''}Examination &nbsp;·&nbsp; ${sess}</div>
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
              <td style="font-size:9.5px;font-weight:700;color:#333;padding-right:6px;padding-bottom:6px;white-space:nowrap;">Session</td>
              <td style="font-size:9.5px;color:#111;padding-bottom:6px;font-style:italic;">: ${sess}</td>
            </tr>
            ${acadYear ? `<tr>
              <td style="font-size:9.5px;font-weight:700;color:#333;padding-right:6px;padding-bottom:6px;white-space:nowrap;">Academic Year</td>
              <td style="font-size:9.5px;color:#111;padding-bottom:6px;font-style:italic;">: ${acadYear}</td>
            </tr>` : ''}
            ${semester ? `<tr>
              <td style="font-size:9.5px;font-weight:700;color:#333;padding-right:6px;padding-bottom:6px;white-space:nowrap;">Semester</td>
              <td style="font-size:9.5px;color:#111;padding-bottom:6px;font-style:italic;">: Semester ${semester}</td>
            </tr>` : ''}
            ${examDates ? `<tr>
              <td style="font-size:9.5px;font-weight:700;color:#333;padding-right:6px;padding-bottom:6px;white-space:nowrap;">Examination Dates</td>
              <td style="font-size:9.5px;color:#111;padding-bottom:6px;font-style:italic;">: ${examDates}${examTerm ? ` (${examTerm})` : ''}</td>
            </tr>` : ''}
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

          <!-- Student Signature box (auto-filled from the uploaded signature) -->
          <div style="margin-top:18px;">
            <div style="height:40px;width:100px;margin:0 auto;display:flex;align-items:flex-end;justify-content:center;">
              ${s.signature_url ? `<img src="${s.signature_url}" style="max-height:38px;max-width:96px;object-fit:contain;"/>` : ''}
            </div>
            <div style="border-top:1px solid #888;width:100px;margin:0 auto;"></div>
            <p style="font-size:8px;color:#555;margin-top:4px;">Student Signature</p>
          </div>
        </td>
      </tr>
    </table>

    <!-- Computer-generated note -->
    <div style="text-align:center;padding:6px 10px 8px;">
      <span style="font-size:8px;font-style:italic;color:#888;">This is a computer-generated Admit Card and does not require any signature or seal.</span>
    </div>

    <!-- Footer: university address only -->
    <div style="background:${BRAND};color:#fff;text-align:center;padding:5px 10px;border-top:2px solid #333;">
      <span style="font-size:8.5px;font-weight:600;">${UNI_ADDRESS}</span>
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
  const regLabel = isPhdProgram(prog) ? 'Reference No.' : 'Registration No.'

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
        <td class="hd-cell" style="width:33%;border-right:2px solid #333;">${regLabel}</td>
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
        </td>

        <!-- Right: photo + student signature box (no registrar) -->
        <td style="width:140px;vertical-align:top;text-align:center;padding:16px 12px;">
          ${s.photo_url
            ? `<img src="${s.photo_url}" alt="Photo" style="width:108px;height:132px;object-fit:cover;border:2px solid #ccc;display:block;margin:0 auto;"/>`
            : `<div style="width:108px;height:132px;border:1.5px solid #ccc;display:flex;align-items:center;justify-content:center;background:#fafafa;margin:0 auto;"><span style="font-size:8px;color:#bbb;text-align:center;">Photo<br/>Here</span></div>`
          }

          <!-- Student Signature box below the photo -->
          <div style="margin:14px auto 0;width:108px;height:58px;border:1.5px solid #999;position:relative;background:#fff;">
            ${s.signature_url
              ? `<img src="${s.signature_url}" style="max-width:100px;max-height:36px;object-fit:contain;position:absolute;top:5px;left:50%;transform:translateX(-50%);"/>`
              : ''
            }
            <span style="position:absolute;bottom:3px;left:0;right:0;text-align:center;font-size:8px;color:#555;">Student Signature</span>
          </div>
        </td>
      </tr>
    </table>

    <!-- Computer-generated note -->
    <div style="text-align:center;padding:6px 10px 8px;">
      <span style="font-size:8px;font-style:italic;color:#888;">This is a computer-generated Registration Certificate and does not require any signature or seal.</span>
    </div>

    <!-- Footer -->
    <div style="background:${BRAND};color:#fff;text-align:center;padding:5px 10px;border-top:2px solid #333;">
      <span style="font-size:8px;font-weight:600;">${UNI_NAME} &nbsp;·&nbsp; ${UNI_PHONE} &nbsp;|&nbsp; ${UNI_EMAIL} &nbsp;|&nbsp; ${UNI_WEB}</span>
    </div>
  </div>
</div>
</body></html>`
  openWindow(html, 'Registration Certificate')
}

/* ───────────────────────────────────────────────────
   4. PhD OFFER LETTER
─────────────────────────────────────────────────── */
// Render a PhD document on the official Sengol letterhead (A4). The letterhead
// image already carries the header, watermark, footer and the "Ref. No." /
// "Date:" labels — we overlay their values and drop the body in the middle.
function letterheadDoc(docTitle, studentName, refNo, dateStr, bodyHtml) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
  <title>${docTitle} — ${v(studentName)}</title>${baseStyle}
  <style>@media print {
    /* The sheet IS the full A4 page, so drop the baseStyle body padding that
       would otherwise push it onto a second (blank) page. */
    body { padding:0 !important; background:#fff !important; }
    .sheet { box-shadow:none !important; }
  }</style></head>
<body style="background:#e9e9e9;">
  ${printBtn()}
  <div class="sheet" style="position:relative;width:794px;height:1120px;margin:0 auto;background:#fff;box-shadow:0 6px 24px rgba(0,0,0,0.18);overflow:hidden;">
    <img src="${LETTERHEAD_URL}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:fill;z-index:0;" onerror="this.style.display='none'"/>
    <div style="position:absolute;top:17.2%;left:13.8%;z-index:2;font-size:12px;font-weight:700;color:#111;">${v(refNo)}</div>
    <div style="position:absolute;top:17.2%;left:81.5%;z-index:2;font-size:12px;font-weight:700;color:#111;">${v(dateStr)}</div>
    <div style="position:absolute;top:24%;left:9.5%;right:8.5%;bottom:14%;z-index:1;">
      ${bodyHtml}
    </div>
  </div>
</body></html>`
}

const docDetailRow = (label, value) => `<tr>
  <td style="width:150px;font-size:11px;color:#333;font-weight:700;padding:3px 0;vertical-align:top;">${label}</td>
  <td style="font-size:11px;color:#111;padding:3px 0;vertical-align:top;">: &nbsp;${v(value)}</td>
</tr>`

export function generateOfferLetter(s, opts = {}) {
  const refNo = opts.refNo || s.registration_no || s.enrollment_no || s.admission_number
  const dateStr = opts.date || fmtDate(new Date())

  const P = 'font-size:12px;color:#222;line-height:1.55;margin:0 0 9px;text-align:justify;'
  const body = `
    <div style="text-align:center;margin-bottom:12px;">
      <span style="font-size:16px;font-weight:900;color:${BRAND};letter-spacing:0.03em;text-decoration:underline;">Ph.D. ADMISSION OFFER LETTER</span>
    </div>
    <p style="font-size:12.5px;color:#111;margin:0 0 9px;">Name of the Candidate : <strong>${v(s.student_name)}</strong></p>
    <p style="font-size:12px;color:#111;margin:0 0 2px;">Dear Applicant,</p>
    <p style="font-size:12px;color:#111;font-weight:700;margin:0 0 8px;">Congratulations!</p>
    <p style="${P}">
      We are pleased to inform you that you have been provisionally selected for admission to the Ph.D. Programme at ${UNI_NAME} based on your performance in the Entrance Test and/or Interview. Your admission is offered subject to the following terms and conditions:
    </p>
    <p style="${P}">
      You are requested to confirm your acceptance of this Admission Offer by depositing the prescribed fee within the stipulated time. Payment of the fee may be made through Online Transfer / Demand Draft in favour of "${UNI_NAME}", payable at Namchi, Sikkim. Candidates paying through Demand Draft must mention their Name and Application/Enrollment Number on the reverse side of the Demand Draft.
    </p>
    <p style="font-size:12px;color:#222;line-height:1.5;margin:0 0 4px;">At the time of registration, you are required to produce the following original documents:</p>
    <ol style="font-size:12px;color:#222;line-height:1.5;margin:0 0 9px 18px;padding:0;">
      <li style="margin-bottom:3px;">Admission Offer Letter.</li>
      <li style="margin-bottom:3px;">Original and self-attested copies of 10th, 12th, Graduation and Master's Degree mark sheets and certificates (NET/JRF/SET/GATE/M.Phil./SLET Certificate, if applicable).</li>
      <li style="margin-bottom:3px;">Transfer Certificate/Migration Certificate from the last institution attended.</li>
      <li style="margin-bottom:3px;">Migration Certificate (if the qualifying degree is from another University).</li>
      <li style="margin-bottom:3px;">No Objection Certificate (NOC) from the Employer/Department, if applicable.</li>
    </ol>
    <p style="${P}">
      Please note that this admission is purely provisional and is subject to verification of all original documents and fulfilment of the University's eligibility criteria and Ph.D. Regulations.
    </p>
    <p style="${P}">
      The University reserves the right to cancel the admission at any stage if any information or document submitted by the candidate is found to be false or misleading.
    </p>
    <p style="${P}">
      Your acceptance of this offer shall be deemed as your agreement to abide by the Statutes, Ordinances, Rules, Regulations and decisions of ${UNI_NAME}. If you have any queries, please feel free to contact us.
    </p>
    <div style="font-size:12px;color:#111;margin-top:12px;">
      <p style="margin:0 0 20px;">Yours faithfully,</p>
      <p style="font-weight:700;margin:0;">Director (Research)</p>
      <p style="margin:0;">${UNI_NAME}</p>
    </div>
    <p style="font-size:10px;color:#555;font-style:italic;margin-top:10px;line-height:1.4;">
      Note: Candidates are advised to keep sufficient self-attested copies of all original certificates before submitting them for verification. Original documents will be returned after verification.
    </p>`
  openWindow(letterheadDoc('Offer Letter', s.student_name, refNo, dateStr, body), 'Offer Letter')
}

/* ───────────────────────────────────────────────────
   5. PhD ENTRANCE CLEARANCE CERTIFICATE
─────────────────────────────────────────────────── */
export function generateEntranceClearance(s, opts = {}) {
  const prog = s.programs?.program_name || s.program_name || '—'
  const sess = s.academic_sessions?.session_name || s.session_name || s.academic_year || '—'
  const dept = s.departments?.name || '—'
  const refNo = opts.refNo || s.registration_no || s.enrollment_no || s.admission_number
  const dateStr = opts.date || fmtDate(new Date())

  const body = `
    <div style="text-align:center;margin-bottom:18px;">
      <span style="font-size:16px;font-weight:900;color:${BRAND};letter-spacing:0.04em;border-bottom:2px solid ${GOLD};padding-bottom:2px;">Ph.D. ENTRANCE CLEARANCE CERTIFICATE</span>
    </div>
    <p style="font-size:12.5px;color:#222;line-height:1.85;margin-bottom:16px;text-align:justify;">
      This is to certify that <strong>${v(s.student_name)}</strong>, son / daughter of
      <strong>${v(s.fathers_name)}</strong>, bearing Reference No <strong>${v(refNo)}</strong>, has appeared in and
      <strong>successfully cleared</strong> the Ph.D Entrance Test / Eligibility requirements for admission to the
      <strong>Doctor of Philosophy (Ph.D) programme in ${prog}</strong> under the ${dept} for the academic session
      <strong>${sess}</strong>.
    </p>
    <p style="font-size:12.5px;color:#222;line-height:1.85;margin-bottom:20px;text-align:justify;">
      The candidate is hereby <strong>cleared to proceed</strong> with the admission and registration process as per the
      rules and regulations of ${UNI_NAME}.
    </p>
    <table style="width:100%;margin:6px 0 18px;">
      ${docDetailRow('Reference No', refNo)}
      ${docDetailRow('Candidate Name', s.student_name)}
      ${docDetailRow("Father's / Husband's Name", s.fathers_name)}
      ${docDetailRow('Programme', prog)}
      ${docDetailRow('Department', dept)}
      ${docDetailRow('Session', sess)}
    </table>
    <table style="width:100%;margin-top:34px;">
      <tr>
        <td style="font-size:11px;color:#444;vertical-align:bottom;">Place: Sikkim</td>
        <td style="text-align:right;vertical-align:bottom;">
          <div style="height:30px;"></div>
          <div style="font-size:11px;font-weight:800;color:${BRAND};">Controller of Examinations / Director (Research)</div>
          <div style="font-size:10px;color:#666;">${UNI_NAME}</div>
        </td>
      </tr>
    </table>`
  openWindow(letterheadDoc('Entrance Clearance Certificate', s.student_name, refNo, dateStr, body), 'Entrance Clearance Certificate')
}
