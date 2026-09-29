import { formatDate } from './formatDate'
import qrcode from 'qrcode-generator'

// Use the app's own bundled logo. Cards render in a window.open popup whose
// base URL is about:blank, so a root-relative path won't resolve — build an
// absolute URL from the running origin instead.
const LOGO_URL = (typeof window !== 'undefined' ? window.location.origin : '') + '/assets/logo.png'
const LETTERHEAD_URL = (typeof window !== 'undefined' ? window.location.origin : '') + '/assets/letterhead.jpg'
const SIGNATURE_URL = (typeof window !== 'undefined' ? window.location.origin : '') + '/assets/registrar-signature.png'
// The signature printed on the Statement of Grades, taken from the office's
// own print setup — a different hand from the Registrar's letter signature.
const MARKSHEET_SIGNATURE_URL = (typeof window !== 'undefined' ? window.location.origin : '') + '/assets/marksheet-signature.png'

// The Registrar's signature block — used on every letter signed by the Registrar.
function registrarSignBlock(bold) {
  const w = bold ? 700 : 400
  return `
    <img src="${SIGNATURE_URL}" alt="" style="height:42px;width:auto;display:block;margin:0 0 2px;" onerror="this.style.display='none'"/>
    <div style="font-size:13px;color:#000;font-weight:${w};line-height:1.5;">
      <p style="margin:0;">Registrar</p>
      <p style="margin:0;">${UNI_NAME}</p>
    </div>`
}
export const UNI_NAME = 'Sengol International University'
const UNI_SHORT = 'SIU'
export const UNI_ADDRESS = 'Lower Pepthang, PO - Lingmoo, District - Namchi, Sikkim - 737134'
const UNI_PHONE = '+91-9205299887'
const UNI_EMAIL = 'info@sengolinternationaluniversity.edu.in'
const UNI_WEB = 'www.sengolinternationaluniversity.edu.in'
export const UNI_ACT = 'Established under Act No. 14 of 2025, Sikkim State Legislative Assembly'
// The university's establishment line, in the wording it uses officially. One
// constant so the admit card, ID card, registration certificate and marks
// statement all carry it identically — they each used to carry a different
// abbreviation of the same fact.
export const UNI_ESTD = 'Established by state Government of Sikkim by Act 14 of 2025, under Section 2(f) of UGC Act 1956 Government of India.'
export const BRAND = '#933d18'
const GOLD = '#d9a441'

// Every DB-supplied value lands inside an HTML string rendered with
// document.write in the viewer's browser — escape it, or a student-entered
// name / address containing markup would execute there (stored XSS).
function esc(val) {
  return String(val).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ))
}

function v(val) {
  return val && String(val).trim() ? esc(String(val).trim()) : '—'
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

// The university's masthead, as the ID card draws it: logo left, the name
// filling a maroon band, the establishment line beneath. One header now for
// the ID card, admit card, registration certificate and admission form —
// each used to draw its own, with a different logo count and a different
// subtitle, so the four documents did not look like one university's.
// Sized per document: the ID card is 600px, the certificates 680, the form A4.
export function uniBandHeader({ logo = 46, name = 17, estd = 7 } = {}) {
  return `
    <div style="background:${BRAND};border-bottom:2px solid ${GOLD};display:flex;align-items:center;gap:12px;padding:9px 16px;">
      <img src="${LOGO_URL}" width="${logo}" height="${logo}"
        style="object-fit:contain;background:#fff;border-radius:50%;padding:3px;flex-shrink:0;"
        onerror="this.style.display='none'"/>
      <div style="line-height:1.15;">
        <div style="color:#fff;font-size:${name}px;font-weight:900;letter-spacing:0.06em;">${UNI_NAME.toUpperCase()}</div>
        <div style="color:rgba(255,255,255,0.82);font-size:${estd}px;font-weight:600;margin-top:3px;line-height:1.3;">${UNI_ESTD}</div>
      </div>
    </div>`
}

// The hall ticket's header: two logos with the address between them.
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
          <div style="font-size:8px;color:#888;margin-top:2px;">${UNI_ESTD}</div>
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
      /* Less at the top than the sides: the sheet was starting a long way down
         the page. 8mm all round PLUS the wrapper's 24px on-screen margin below
         put the border roughly 14mm in. */
      body { background:#fff; padding:4mm 8mm 3mm; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .no-print { display:none !important; }
      /* The wrapper's breathing room is dead space on paper — top AND bottom.
         Only the top was cleared, so every sheet carried 24px of empty page
         under it. Set inline, so this needs !important to win. */
      body > div { margin-top:0 !important; margin-bottom:0 !important; }
    }
    table { border-collapse:collapse; }
  </style>`

/* ───────────────────────────────────────────────────
   1. STUDENT IDENTITY CARD
─────────────────────────────────────────────────── */
// The years a course runs: admission year → admission year + its length.
// A 2-year B.Ed admitted in 2025 reads "2025-2027". Taken from
// complete_duration when it names years, else from `duration`, which is in
// SEMESTERS for every mode and so is halved. Falls back to the batch name
// when neither the length nor the start year can be worked out.
export function courseValidity(s = {}) {
  const named = String(s.programs?.complete_duration || '').match(/(\d+)\s*year/i)
  const dur = Number(s.programs?.duration) || 0
  const years = named ? parseInt(named[1], 10) : (dur ? Math.max(Math.round(dur / 2), 1) : 0)

  const ay = String(s.academic_year || '').match(/(20\d{2})/)
  let start = ay ? parseInt(ay[1], 10) : null
  if (start == null) {
    const d = s.academic_sessions?.start_date || s.date_of_admission || s.date_of_submission
    const y = d ? new Date(d).getFullYear() : NaN
    start = Number.isFinite(y) ? y : null
  }
  return start && years
    ? `${start}-${start + years}`
    : (s.academic_year || s.academic_sessions?.session_name || s.session_name || '—')
}

export function generateIDCard(s) {
  const prog = s.programs?.program_name || s.program_name || '—'
  // The ID card is an enrolled student's document — without an enrollment
  // number it used to print with a blank "Enrollment No: —" row. A Ph.D
  // candidate only receives one when the Research Dept forwards them to the
  // Exam Section, so until then the card must not generate at all.
  if (!String(s.enrollment_no || '').trim()) {
    alert('Enrollment number has not been issued yet — the ID card can be generated only after enrollment.')
    return
  }
  const regNo = isPhdProgram(prog)
    ? (s.admission_number || s.enrollment_no)
    : (s.registration_no || s.enrollment_no || s.admission_number)
  const contact = s.mobile_no || s.whatsapp_no
  // Shared with the Statement of Marks, so a card and a marksheet can never
  // quote different years for the same course.
  const validity = courseValidity(s)
  // The Ph.D pipeline has no registration number — it identifies a candidate by
  // the application number until the enrollment number is issued.
  const regLabel = isPhdProgram(prog) ? 'Application No.' : 'Registration No.'

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

    <!-- Header: logo left, university name filling the maroon band. The band
         used to run edge-to-edge behind a floating logo box, which left a
         wide empty maroon strip to the right of it. -->
    ${uniBandHeader()}

    <!-- IDENTITY CARD title bar -->
    <div style="background:${BRAND};text-align:center;padding:4px;margin:10px 22px 8px;border-radius:5px;border-top:1.5px solid ${GOLD};border-bottom:1.5px solid ${GOLD};">
      <span style="color:#fff;font-size:12px;font-weight:800;letter-spacing:0.18em;">IDENTITY CARD</span>
    </div>

    <!-- Body: photo/seal/signature | details -->
    <div style="display:flex;gap:16px;padding:4px 22px 14px;">
      <!-- Left column -->
      <div style="width:118px;flex-shrink:0;">
        <!-- photo with a faint seal overlapping its lower area -->
        <div style="position:relative;width:118px;">
          ${s.photo_url
            ? `<img src="${esc(s.photo_url)}" alt="Photo" style="width:118px;height:138px;object-fit:cover;border:1px solid #bbb;border-radius:8px;display:block;"/>`
            : `<div style="width:118px;height:138px;border:1px solid #bbb;border-radius:8px;background:#fafafa;display:flex;align-items:center;justify-content:center;font-size:10px;color:#bbb;">Photo</div>`
          }
          <img src="${LOGO_URL}" style="position:absolute;right:6px;bottom:6px;width:56px;height:56px;object-fit:contain;opacity:0.28;" onerror="this.style.display='none'"/>
        </div>
        <!-- signature below the photo -->
        <div style="text-align:center;margin-top:8px;height:34px;">
          ${s.signature_url
            ? `<img src="${esc(s.signature_url)}" style="height:30px;max-width:112px;object-fit:contain;display:inline-block;"/>`
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

    <!-- Bottom: maroon band with address + website box. The address is sized
         to stay on ONE line so it lines up with the website block beside it. -->
    <div style="background:${BRAND};border-top:2px solid ${GOLD};display:flex;align-items:stretch;justify-content:space-between;">
      <span style="color:#fff;font-size:8.5px;font-weight:700;padding:6px 12px;align-self:center;white-space:nowrap;">${UNI_ADDRESS}</span>
      <span style="background:${GOLD};color:#3a2000;font-size:8.5px;font-weight:800;padding:6px 12px;display:flex;align-items:center;white-space:nowrap;">${UNI_WEB}</span>
    </div>
  </div>
</div>
</body></html>`
  openWindow(html, 'ID Card')
}

/* ───────────────────────────────────────────────────
   2. ADMIT CARD
─────────────────────────────────────────────────── */

// The session printed on an admit card is the EXAMINATION session, not the
// admission batch: a July 2025 admission sits Semester 2's exams in January
// 2026. Sessions are named "<Month> <Year>" and a semester is six months, so
// shift the admission session by six months per completed semester. Anything
// unparseable comes back unchanged. Used only when the Examination Calendar
// has no dates for the term (meta.examSession) — the calendar, when set, is
// the authority on when the exams actually sit.
const MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december']
export function examSessionLabel(sessionName, sem) {
  const n = Number(sem)
  const m = String(sessionName || '').trim().match(/^([A-Za-z]+)[\s,-]+(\d{4})$/)
  if (!n || n <= 1 || !m) return sessionName
  const idx = MONTHS.indexOf(m[1].toLowerCase())
  if (idx < 0) return sessionName
  const total = idx + (n - 1) * 6
  const name = MONTHS[total % 12]
  return `${name[0].toUpperCase()}${name.slice(1)} ${Number(m[2]) + Math.floor(total / 12)}`
}

// The card itself — the bordered block, with no page around it. The printed
// card and the student portal's preview both render THIS one builder. The
// preview used to be a second copy written by hand in JSX, and had drifted
// from the card it previews: one logo instead of two, the admission session
// where the examination session belongs, and no Semester / Academic Year /
// Exam Schedule rows at all.
export function admitCardHTML(s, subjects = [], meta = {}) {
  const prog = s.programs?.program_name || s.program_name || '—'
  // Two different sessions live on the card and must not be conflated:
  // the "Session" row is the student's ADMISSION batch (July 2025 stays July
  // 2025 on every semester's card), while the title's examination line carries
  // the EXAM sitting — the calendar's "Exam. Held" label when set, else the
  // admission session shifted six months per semester.
  const sess = s.academic_sessions?.session_name || s.session_name || '—'
  const examSess = meta.examSession || examSessionLabel(sess, meta.semester)
  const deptCode = s.centers?.center_code || s.center_code || (s.departments?.name ? s.departments.name.substring(0,6).toUpperCase() : '—')
  const isPhd = isPhdProgram(prog)
  const defaultSubjects = subjects.length ? subjects : []
  const examSchedule  = meta.examSchedule || ''
  const admitCardTime = meta.admitCardTime || ''
  const semester      = meta.semester || ''
  const acadYear      = s.academic_year || ''

  // Inline rather than classes, and the font named on the wrapper: this
  // fragment also renders inside the portal, where the popup's <style> block
  // and its Arial body font do not exist.
  const HD  = `background:${BRAND};color:#fff;text-align:center;font-weight:700;font-size:10px;padding:5px 8px;`
  const VAL = `text-align:center;font-size:11px;font-weight:700;color:#333;padding:6px 8px;`

  return `
  <div style="border:2.5px solid #333;background:#fff;padding:0;box-shadow:0 4px 20px rgba(0,0,0,0.12);font-family:Arial,Helvetica,sans-serif;color:#111;">

    <!-- University header -->
    ${uniBandHeader({ logo: 52, name: 19, estd: 8 })}

    <!-- ADMIT CARD title -->
    <div style="text-align:center;padding:8px;border-bottom:2px solid #333;background:#fafafa;">
      <span style="font-size:20px;font-weight:900;color:${BRAND};letter-spacing:0.12em;">ADMIT CARD</span>
      <div style="font-size:9px;color:#666;margin-top:2px;">${prog} &nbsp;—&nbsp; ${meta.semester ? `Semester ${meta.semester} ` : ''}Examination &nbsp;·&nbsp; ${examSess}</div>
      ${admitCardTime ? `<div style="font-size:8.5px;color:#888;margin-top:2px;">Issued: ${admitCardTime}</div>` : ''}
    </div>

    <!-- Reference header. A Ph.D candidate sits the entrance exam on the
         Application No — no separate reference/registration column, and the
         roll-number slot carries the application number itself. -->
    ${isPhd ? `
    <table style="width:100%;border-collapse:collapse;border-bottom:2px solid #333;">
      <tr>
        <td style="${HD}width:50%;border-right:2px solid #333;">Application No.</td>
        <td style="${HD}width:50%;">University / Dept. Code</td>
      </tr>
      <tr>
        <td style="${VAL}border-right:2px solid #333;">${v(s.admission_number)}</td>
        <td style="${VAL}">${deptCode}</td>
      </tr>
    </table>` : `
    <table style="width:100%;border-collapse:collapse;border-bottom:2px solid #333;">
      <tr>
        <td style="${HD}width:33%;border-right:2px solid #333;">Registration No.</td>
        <td style="${HD}width:33%;border-right:2px solid #333;">Roll No (Enrollment)</td>
        <td style="${HD}width:34%;">University / Dept. Code</td>
      </tr>
      <tr>
        <td style="${VAL}border-right:2px solid #333;">${v(s.registration_no)}</td>
        <td style="${VAL}border-right:2px solid #333;">${v(s.enrollment_no)}</td>
        <td style="${VAL}">${deptCode}</td>
      </tr>
    </table>`}

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
            ${examSchedule ? `<tr>
              <td style="font-size:9.5px;font-weight:700;color:#333;padding-right:6px;padding-bottom:6px;white-space:nowrap;">Exam Schedule</td>
              <td style="font-size:9.5px;color:#111;padding-bottom:6px;font-style:italic;">: ${examSchedule}</td>
            </tr>` : ''}
          </table>

          <!-- Subjects / Papers -->
          <!-- Papers. Each line already reads "Paper 1: CODE Subject — date"
               (see formatSubjectRow), so the old separate "Code :" heading
               was a leftover that labelled nothing. -->
          <div style="margin-top:12px;border-top:1px solid #e5e7eb;padding-top:8px;">
            <div style="font-size:9px;font-weight:700;color:${BRAND};letter-spacing:0.04em;text-transform:uppercase;margin-bottom:5px;">Papers to be appeared</div>
            ${defaultSubjects.length > 0
              ? defaultSubjects.map(sub => `<div style="font-size:9.5px;font-style:italic;color:#111;margin-bottom:3px;">${sub}</div>`).join('')
              : `<div style="font-size:9px;font-style:italic;color:#888;">As per university curriculum schedule</div>`
            }
          </div>
          <div style="margin-top:16px;font-size:8.5px;font-style:italic;color:#555;">
            ✦ Check and Confirm entry before the exam
          </div>
        </td>

        <!-- Right: photo + signature -->
        <td style="width:130px;vertical-align:top;text-align:center;padding:14px 12px;">
          ${s.photo_url
            ? `<img src="${esc(s.photo_url)}" alt="Photo" style="width:100px;height:120px;object-fit:cover;border:2px solid #ccc;display:block;margin:0 auto;"/>`
            : `<div style="width:100px;height:120px;border:1.5px solid #ccc;display:flex;align-items:center;justify-content:center;background:#fafafa;margin:0 auto;"><span style="font-size:8px;color:#bbb;text-align:center;">Photo</span></div>`
          }
          <p style="font-size:8px;color:#555;margin-top:4px;">(Student Photo)</p>

          <!-- Student Signature box (auto-filled from the uploaded signature) -->
          <div style="margin-top:18px;">
            <div style="height:40px;width:100px;margin:0 auto;display:flex;align-items:flex-end;justify-content:center;">
              ${s.signature_url ? `<img src="${esc(s.signature_url)}" style="max-height:38px;max-width:96px;object-fit:contain;"/>` : ''}
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
  </div>`
}

export function generateAdmitCard(s, subjects = [], meta = {}) {
  // Hard gate: admit card cannot be generated before the configured date/time.
  if (meta.admitCardAt) {
    const releaseAt = new Date(meta.admitCardAt)
    if (!isNaN(releaseAt.getTime()) && Date.now() < releaseAt.getTime()) {
      alert(`Admit card will be available from ${meta.admitCardTime || releaseAt.toLocaleString('en-IN')}. It cannot be generated before that.`)
      return
    }
  }
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
  <title>Admit Card — ${v(s.student_name)}</title>${baseStyle}
</head>
<body>
<div style="max-width:680px;margin:24px auto;">
  ${printBtn()}
  ${admitCardHTML(s, subjects, meta)}
</div>
</body></html>`
  openWindow(html, 'Admit Card')
}

/* ───────────────────────────────────────────────────
   3. REGISTRATION CERTIFICATE
─────────────────────────────────────────────────── */
// `opts.year` issues the certificate for one YEAR of the course (a 6-semester
// course has three: Year 1 covers Sem 1-2, Year 2 Sem 3-4, Year 3 Sem 5-6).
// Called without it, the certificate stays as it was.
export function generateRegistrationCertificate(s, opts = {}) {
  const prog = s.programs?.program_name || s.program_name || '—'
  const sess = s.academic_sessions?.session_name || s.session_name || '—'
  const centerCode = s.centers?.center_code || s.center_code || '—'
  const regYear = opts.year
    ? `Year ${opts.year}${s.academic_year ? ` · ${s.academic_year}` : ''}`
    : (s.academic_year || sess || '—')
  const regLabel = isPhdProgram(prog) ? 'Reference No.' : 'Registration No.'

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
  <title>Registration Certificate — ${v(s.student_name)}</title>${baseStyle}
  <style>
    .hd-cell { background:${BRAND};color:#fff;text-align:center;font-weight:700;font-size:10px;padding:5px 8px; }
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
    ${uniBandHeader({ logo: 52, name: 19, estd: 8 })}

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
              <td class="info-label">Session</td>
              <td class="info-val">: &nbsp;${v(sess)}</td>
            </tr>
            ${opts.year ? `<tr>
              <td class="info-label">Registered for</td>
              <td class="info-val">: &nbsp;Year ${opts.year}${opts.fromSem ? ` (Semester ${opts.fromSem}–${opts.toSem})` : ''}</td>
            </tr>` : ''}
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
              <td class="info-label">Mobile No</td>
              <td class="info-val">: &nbsp;${v(s.mobile_no)}</td>
            </tr>
          </table>
        </td>

        <!-- Right: photo + student signature box (no registrar) -->
        <td style="width:140px;vertical-align:top;text-align:center;padding:16px 12px;">
          ${s.photo_url
            ? `<img src="${esc(s.photo_url)}" alt="Photo" style="width:108px;height:132px;object-fit:cover;border:2px solid #ccc;display:block;margin:0 auto;"/>`
            : `<div style="width:108px;height:132px;border:1.5px solid #ccc;display:flex;align-items:center;justify-content:center;background:#fafafa;margin:0 auto;"><span style="font-size:8px;color:#bbb;text-align:center;">Photo<br/>Here</span></div>`
          }

          <!-- Student Signature box below the photo -->
          <div style="margin:14px auto 0;width:108px;height:58px;border:1.5px solid #999;position:relative;background:#fff;">
            ${s.signature_url
              ? `<img src="${esc(s.signature_url)}" style="max-width:100px;max-height:36px;object-fit:contain;position:absolute;top:5px;left:50%;transform:translateX(-50%);"/>`
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
      <span style="font-size:8px;font-weight:600;">${UNI_ADDRESS} &nbsp;|&nbsp; ${UNI_PHONE} &nbsp;|&nbsp; ${UNI_EMAIL} &nbsp;|&nbsp; ${UNI_WEB}</span>
    </div>
  </div>
</div>
</body></html>`
  openWindow(html, 'Registration Certificate')
}

/* ───────────────────────────────────────────────────
   PhD ENTRANCE EXAM HALL TICKET
─────────────────────────────────────────────────── */
// Modeled on a university provisional hall-ticket: header, dashed title rule,
// labelled rows with the photo at the right, exam centre block, then the
// candidate / invigilator / registrar signature strip.
export function generateHallTicket(s, opts = {}) {
  const prog = s.programs?.program_name || s.program_name || '—'
  // The candidate sits the entrance exam on their Application No — that is
  // what the ticket identifies them by (not the letter's reference serial).
  const applicationNo = s.admission_number || opts.refNo || s.enrollment_no || '—'
  // Faculty = the research stream (falls back to the programme name).
  const faculty = s.stream || prog
  const subject = s.specialization || ''

  // Exam details come from the Research Dept's master panel. Anything left
  // unset prints as a blank rule to fill in by hand.
  const blank = (w) => `<span style="display:inline-block;min-width:${w}px;border-bottom:1px dotted #000;">&nbsp;</span>`
  const examWhen = opts.testDate
    ? `${opts.testDate}${opts.examTime ? ` - ${opts.examTime}` : ''}`
    : (opts.examTime || '')
  const reporting = opts.reportTime ? `${opts.reportTime} (Mandatory)` : ''

  // Label + value row; the label column keeps a fixed width like the sample.
  const row = (label, valueHtml) => `<tr>
    <td style="width:190px;font-size:13px;font-weight:700;color:#000;padding:7px 0;vertical-align:top;white-space:nowrap;">${label}</td>
    <td style="font-size:13px;color:#000;padding:7px 0;vertical-align:top;">${valueHtml}</td>
  </tr>`

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
  <title>Hall Ticket — ${v(s.student_name)}</title>${baseStyle}</head>
<body>
<div style="max-width:780px;margin:24px auto;">
  ${printBtn()}

  <div style="border:1.5px solid #555;background:#fff;padding:18px 26px 20px;box-shadow:0 4px 20px rgba(0,0,0,0.12);">

    <div style="text-align:right;font-size:11px;font-weight:800;color:#000;text-decoration:underline;">Candidate Copy</div>

    <!-- University header -->
    <div style="padding:2px 0 10px;border-bottom:2px solid ${BRAND};">${uniHeader()}</div>

    <!-- Title between dashed rules -->
    <div style="border-bottom:2px dashed #444;text-align:center;padding:10px 0 6px;margin-bottom:6px;">
      <span style="font-size:15px;font-weight:900;color:#000;letter-spacing:0.02em;">HALL-TICKET — Ph.D Entrance Exam</span>
    </div>

    <!-- Details + photo -->
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="vertical-align:top;">
          <table style="width:100%;">
            ${row('Application No:', `<span style="font-weight:800;">${v(applicationNo)}</span>${s.gender ? `<span style="display:inline-block;margin-left:70px;font-weight:800;">${String(s.gender).toUpperCase()}</span>` : ''}`)}
            ${row('Candidate Name:', `<span style="font-weight:800;">${v(s.student_name).toUpperCase()}</span>`)}
            ${row('Faculty and Subject:', `<span style="background:#dce9f7;padding:2px 10px;">${v(faculty)}</span>${subject ? `&nbsp;&nbsp;<span style="background:#fbf2e3;padding:2px 10px;">${esc(subject.toUpperCase())}</span>` : ''}`)}
            ${row('Date &amp; Time of Exam:', `<span style="font-weight:800;">${examWhen || blank(220)}</span>`)}
            ${row('Reporting time at the Centre:', `<span style="font-weight:800;">${reporting || blank(160)}</span>`)}
          </table>
        </td>
        <td style="width:130px;vertical-align:top;text-align:right;padding:6px 0 0 10px;">
          ${s.photo_url
            ? `<img src="${esc(s.photo_url)}" alt="Photo" style="width:110px;height:130px;object-fit:cover;border:1px solid #999;"/>`
            : `<div style="width:110px;height:130px;border:1px solid #999;background:#fafafa;display:flex;align-items:center;justify-content:center;font-size:9px;color:#bbb;">Photo</div>`
          }
        </td>
      </tr>
    </table>

    <!-- Examination centre -->
    <table style="width:100%;margin-top:2px;">
      ${row('Examination Centre:', opts.examCentre
        ? `<span style="font-weight:700;">${opts.examCentre}</span>`
        : blank(360))}
    </table>

    <div style="margin-top:6px;">
      <p style="font-size:13px;font-weight:700;color:#000;margin:0 0 2px;">Note:</p>
      <p style="font-size:13px;font-weight:700;color:#000;line-height:1.45;margin:0;">
        The Photo ID Proof along with the Hall-ticket shall be submitted at the time of reporting at the Examination Centre
      </p>
    </div>

    <!-- Signature strip: candidate left, registrar right. -->
    <table style="width:100%;margin-top:34px;">
      <tr>
        <td style="width:50%;vertical-align:bottom;">
          <div style="height:36px;display:flex;align-items:flex-end;">
            ${s.signature_url ? `<img src="${esc(s.signature_url)}" style="max-height:34px;max-width:150px;object-fit:contain;"/>` : ''}
          </div>
          <p style="font-size:13px;font-weight:700;color:#000;margin:4px 0 0;">Signature of Candidate</p>
        </td>
        <td style="width:50%;vertical-align:bottom;text-align:right;">
          <div style="display:inline-block;text-align:left;">${registrarSignBlock(true)}</div>
        </td>
      </tr>
    </table>
  </div>
</div>
</body></html>`
  openWindow(html, 'Hall Ticket')
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
  <style>
    /* Print exactly one full-bleed A4 sheet. */
    @page { size: A4 portrait; margin:0; }
    @media print {
      /* The sheet IS the A4 page, so drop the baseStyle body padding that would
         otherwise push it onto a second (blank) page. */
      html, body { padding:0 !important; margin:0 !important; background:#fff !important; }
      .sheet { width:210mm !important; height:297mm !important; box-shadow:none !important; margin:0 !important; }
    }</style></head>
<body style="background:#e9e9e9;">
  ${printBtn()}
  <div class="sheet" style="position:relative;width:794px;height:1120px;margin:0 auto;background:#fff;box-shadow:0 6px 24px rgba(0,0,0,0.18);overflow:hidden;">
    <img src="${LETTERHEAD_URL}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:fill;z-index:0;" onerror="this.style.display='none'"/>
    <!-- The letterhead's own printed "Ref. No. ......" / "Date: ......" rules
         proved impossible to sit values on reliably across machines. So: cover
         that strip with white (the artwork there is plain — measured from
         letterhead.jpg; the gold leaf ends above it) and print our own labels
         WITH the values, aligned to each other by construction. -->
    <div style="position:absolute;top:15.55%;left:5%;right:5%;height:3.15%;background:#fff;z-index:1;"></div>
    <div style="position:absolute;top:16.35%;left:9.5%;right:8.5%;z-index:2;display:flex;justify-content:space-between;align-items:baseline;font-family:'Times New Roman',Times,serif;font-size:13px;color:#000;">
      <span style="white-space:nowrap;">Ref. No.: <strong>${v(refNo)}</strong></span>
      <span style="white-space:nowrap;">Date: <strong>${v(dateStr)}</strong></span>
    </div>
    <!-- Body sits between the Ref/Date rule and the footer bar (starts ~94.6%). -->
    <div style="position:absolute;top:19.6%;left:9.5%;right:8.5%;bottom:9%;z-index:2;font-family:'Times New Roman',Times,serif;">
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
  const refNo = opts.refNo || s.admission_number || s.enrollment_no
  const dateStr = opts.date || fmtDate(new Date())

  const P = 'font-size:12.5px;color:#000;line-height:1.5;margin:0 0 9px;text-align:justify;'
  const body = `
    <div style="text-align:center;margin-bottom:14px;">
      <span style="font-size:16px;font-weight:700;color:#000;letter-spacing:0.02em;text-decoration:underline;">Ph.D. ADMISSION OFFER LETTER</span>
    </div>
    <p style="font-size:13px;color:#000;margin:0 0 10px;">Name of the Candidate : <strong>${v(s.student_name)}</strong></p>
    <p style="font-size:12.5px;color:#000;font-weight:700;margin:0 0 2px;">Dear Applicant,</p>
    <p style="font-size:12.5px;color:#000;font-weight:700;margin:0 0 9px;">Congratulations!</p>
    <p style="${P}">
      We are pleased to inform you that you have been provisionally selected for admission to the Ph.D. Programme at ${UNI_NAME} based on your performance in the Entrance Test and/or Interview. Your admission is offered subject to the following terms and conditions:
    </p>
    <p style="${P}">
      You are requested to confirm your acceptance of this Admission Offer by depositing the prescribed fee within the stipulated time. Payment of the fee may be made through Online Transfer / Demand Draft in favour of "${UNI_NAME}", payable at Singtam, Sikkim. Candidates paying through Demand Draft must mention their Name and Application/Enrollment Number on the reverse side of the Demand Draft.
    </p>
    <p style="font-size:12.5px;color:#000;line-height:1.5;margin:0 0 5px;">At the time of registration, you are required to produce the following original documents:</p>
    <ol style="font-size:12.5px;color:#000;line-height:1.5;margin:0 0 9px 22px;padding:0;">
      <li style="margin-bottom:4px;">Admission Offer Letter.</li>
      <li style="margin-bottom:4px;">Original and self-attested copies of 10th, 12th, Graduation and Master's Degree mark sheets and certificates (NET/JRF/SET/GATE/M.Phil./SLET Certificate, if applicable).</li>
      <li style="margin-bottom:4px;">Transfer Certificate/Migration Certificate from the last institution attended.</li>
      <li style="margin-bottom:4px;">Migration Certificate (if the qualifying degree is from another University).</li>
      <li style="margin-bottom:4px;">No Objection Certificate (NOC) from the Employer/Department, if applicable.</li>
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
    <div style="font-size:12.5px;color:#000;margin-top:20px;line-height:1.5;">
      <p style="margin:0 0 10px;">Yours faithfully,</p>
      ${registrarSignBlock(false)}
    </div>
    <p style="font-size:11px;color:#000;margin-top:12px;line-height:1.45;">
      <strong>Note:</strong> Candidates are advised to keep sufficient self-attested copies of all original certificates before submitting them for verification. Original documents will be returned after verification.
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
  const refNo = opts.refNo || s.admission_number || s.enrollment_no
  const dateStr = opts.date || fmtDate(new Date())

  // The entrance-test date is not stored on the student — print it when supplied,
  // otherwise leave a rule to fill in by hand (as on the printed certificate).
  const testDate = opts.testDate
    ? `<strong>${v(opts.testDate)}</strong>`
    : '<span style="display:inline-block;min-width:150px;border-bottom:1px solid #000;">&nbsp;</span>'

  const P = 'font-size:13px;color:#000;line-height:1.6;margin:0 0 13px;'
  const body = `
    <div style="text-align:center;margin:54px 0 26px;">
      <span style="font-size:15.5px;font-weight:700;color:#000;text-decoration:underline;">Ph.D. ENTRANCE CLEARANCE CERTIFICATE</span>
    </div>
    <p style="font-size:13px;color:#000;margin:0 0 16px;">Name of the Candidate: <span style="font-weight:700;">${v(s.student_name)}</span></p>
    <p style="font-size:13px;color:#000;font-weight:700;margin:0 0 14px;">Dear Scholar,</p>
    <p style="${P}">
      We are pleased to inform you that, based on your performance in the <strong>Ph.D. Entrance Test</strong>
      conducted on ${testDate}, you have successfully qualified for admission to the
      <strong>Ph.D. Programme</strong> of the University.
    </p>
    <p style="${P}">
      You are hereby provisionally offered admission, subject to the completion of all admission formalities.
      To confirm your admission, kindly submit the duly filled application form along with the prescribed
      documents and applicable fees within <strong>30 days</strong> from the date of issuance of this certificate.
    </p>
    <p style="${P}">
      After successful enrolment, you will be required to attend the prescribed <strong>Coursework</strong> as an
      essential component of the Ph.D. Programme, in accordance with the University regulations.
    </p>
    <p style="${P}margin-top:24px;">
      We congratulate you on your achievement and wish you success in your research journey.
    </p>
    <p style="font-size:13px;color:#000;font-weight:700;margin:36px 0 0;">With best wishes,</p>
    <div style="margin-top:30px;">
      ${registrarSignBlock(true)}
    </div>`
  openWindow(letterheadDoc('Entrance Clearance Certificate', s.student_name, refNo, dateStr, body), 'Entrance Clearance Certificate')
}

/* ───────────────────────────────────────────────────
   7. STATEMENT OF MARKS (DMC)
─────────────────────────────────────────────────── */

// Ten-point grade for a paper, from the percentage it scored. Kept in one
// place so the letter, the point and the SGPA all agree.
// Semesters are written in Roman on a grade card — I, II, III … — so the
// number the rest of the app works in is converted only for printing.
// The subject rows are rendered only for subjects that carry marks — no
// padding to a fixed row count. The table closes after the last real row.

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']
export const romanSemester = (label) => {
  const n = parseInt(String(label || '').match(/\d+/)?.[0] || '', 10)
  return n && ROMAN[n] ? ROMAN[n] : (label || '')
}

// The university's grading scale. Bands are on the PERCENTAGE a paper scored,
// not its marks, so a paper out of 150 grades the same as one out of 100.
export const GRADE_SCALE = [
  { from: 90, letter: 'A+', point: 10, description: 'Outstanding',   pass: true  },
  { from: 80, letter: 'A',  point: 9,  description: 'Excellent',     pass: true  },
  { from: 70, letter: 'B+', point: 8,  description: 'Very Good',     pass: true  },
  { from: 60, letter: 'B',  point: 7,  description: 'Good',          pass: true  },
  { from: 50, letter: 'C',  point: 6,  description: 'Above Average', pass: true  },
  { from: 40, letter: 'D',  point: 5,  description: 'Pass',          pass: true  },
  { from: 0,  letter: 'F',  point: 0,  description: 'Fail',          pass: false },
]

export function gradeFor(pct) {
  if (pct == null || isNaN(pct)) return { letter: '—', point: 0, description: '', pass: false }
  return GRADE_SCALE.find(g => pct >= g.from) || GRADE_SCALE[GRADE_SCALE.length - 1]
}

// SGPA = Σ(grade point × credit) ÷ Σ(credit), over papers that carry credit.
// Returns null when no paper does, so the sheet prints a dash rather than 0.00.
export function sgpaOf(rows) {
  let pts = 0, creds = 0
  for (const r of rows) {
    const credit = Number(r.credits) || 0
    const max = Number(r.total_marks) || 0
    if (!credit || !max) continue

    // A paper whose marks have not been ENTERED is not a paper scored zero.
    // Both used to read as 0 here, so every not-yet-marked paper counted as an
    // F and brought its credits into the average. Across a whole course that
    // is most of the papers, which is how a CGPA of 2.76 sat under an SGPA of
    // 7.25. An entered 0 still counts — that is a real fail.
    const t = r.theory_obtained, i = r.internal_obtained
    const hasT = t !== '' && t != null
    const hasI = i !== '' && i != null
    if (!hasT && !hasI) continue

    const got = (hasT ? Number(t) || 0 : 0) + (hasI ? Number(i) || 0 : 0)
    pts += gradeFor((got / max) * 100).point * credit
    creds += credit
  }
  return creds ? pts / creds : null
}

// The division the sheet awards, from the percentage scored across the whole
// semester. Below the 40% floor there is no division — the same floor gradeFor()
// grades F at, so a paper that fails and a semester that fails agree.
const DIVISIONS = [
  { from: 60, label: 'First Division' },
  { from: 50, label: 'Second Division' },
  { from: 40, label: 'Third Division' },
]
export function divisionFor(pct) {
  if (pct == null || isNaN(pct)) return '—'
  return (DIVISIONS.find(d => pct >= d.from) || { label: 'Fail' }).label
}

// The sheet is ruled the way the university's printed marksheet is: a solid
// dark frame with the header and the totals bar in the same colour, and a
// dashed grid inside it.
const SHEET_LINE = '#12514e'
const SHEET_DASH = '#9fb3b3'

// Statement of Marks — the university's own DMC layout.
//
// `rows` are the semester's papers, each carrying its scheme (credits,
// internal_marks, theory_marks, total_marks) and what the student obtained
// (internal_obtained, theory_obtained). Grade and earned credit are derived
// per paper; a paper that fails earns none.
//
// meta: { dmcNo, semester, examHeld, resultStatus, cgpa }.
//
// This returns the SHEET only — the bordered page, with no document around it
// and no print buttons. generateMarksStatement wraps it for the Exam Section;
// the centre and the student portal render it straight into the page, inside a
// .student-copy wrapper. One markup, so what a student reads on screen and
// what the university prints cannot drift apart.
// Paper rows as a marksheet prints them: maxima, marks obtained, the grade
// and the credit earned. A statement lists the papers the student SAT — a
// semester offers alternatives (MS-ACCESS or MS-SQL) and the ones not taken
// have no marks — unless nothing at all is entered, when the full list stands
// so a blank pro-forma still prints. Shared by both sheets so they can never
// grade the same paper differently.
export function markRowsOf(rows = []) {
  const num = (x) => (x == null || x === '' ? '' : Number(x))
  const entered = rows.filter(r => r.theory_obtained !== '' && r.theory_obtained != null
    || r.internal_obtained !== '' && r.internal_obtained != null)
  return (entered.length ? entered : rows).map(r => {
    const maxT = num(r.theory_marks) || 0
    const maxI = num(r.internal_marks) || 0
    const maxTot = num(r.total_marks) || (maxT + maxI)
    const gotT = num(r.theory_obtained)
    const gotI = num(r.internal_obtained)
    const gotTot = (gotT === '' ? 0 : gotT) + (gotI === '' ? 0 : gotI)
    const entered = gotT !== '' || gotI !== ''
    const credit = num(r.credits) || 0
    const g = entered && maxTot ? gradeFor((gotTot / maxTot) * 100) : { letter: '—', point: 0 }
    return { ...r, maxT, maxI, maxTot, gotT, gotI, gotTot, entered, credit, g,
             earned: g.point > 0 ? credit : 0 }
  })
}

export function marksStatementHTML(s, rows = [], meta = {}) {
  const prog = s.programs?.program_name || s.program_name || '—'
  const show = (x) => (x == null || x === '' ? '—' : String(x))

  // A statement of marks lists the papers the student SAT. A semester offers
  // alternatives — MS-ACCESS or MS-SQL — and the ones not taken have no marks,
  // so they do not belong on the sheet. If nothing at all has been entered the
  // full list stands, so a blank pro-forma still prints something.
  const marked = markRowsOf(rows)

  // A CGPA is a running average, so there is nothing to average in the first
  // semester — its SGPA IS the whole record, and the university's own grade
  // card leaves the CGPA off that sheet entirely.
  const semNo = parseInt(String(meta.semester || '').match(/\d+/)?.[0] || '', 10)
  const sum = (k) => marked.reduce((a, r) => a + (Number(r[k]) || 0), 0)
  const sgpa = sgpaOf(marked.map(r => ({ ...r, theory_obtained: r.gotT, internal_obtained: r.gotI })))
  const totMax = sum('maxTot')
  const totGot = sum('gotTot')

  // The division stands on the whole semester's percentage, but one paper below
  // the pass mark fails the semester however well the rest went — and a result
  // the Exam Section has already declared a fail overrides the arithmetic.
  const anyMarks = marked.some(r => r.entered)
  const failedPaper = marked.some(r => r.entered && r.maxTot && (r.gotTot / r.maxTot) * 100 < 40)
  const division = !anyMarks ? '—'
    : (failedPaper || /fail/i.test(String(meta.resultStatus || ''))) ? 'Fail'
    : divisionFor(totMax ? (totGot / totMax) * 100 : null)

  // The sheet quotes a Min alongside each Maximum — the 16 in "16/40". No
  // minimum is stored per paper (an early scheme_papers draft had one and it
  // was dropped), so it is the university's 40% pass mark applied to that
  // component's maximum, which is exactly what 16/40 and 24/60 are.
  const PASS_PCT = 40
  const minOf = (max) => (Number(max) ? Math.round((Number(max) * PASS_PCT) / 100) : 0)
  const sumMin = (k) => marked.reduce((a, r) => a + minOf(r[k]), 0)
  const pair = (min, max) => (max ? `${min}/${max}` : '\u2014')


  const cell = `border:1px dashed ${SHEET_DASH};padding:6px 9px;font-size:10px;color:#111;`
  // Plain strings, not builders: every use site is `style="${mc}extra;"`, and a
  // function interpolated there stringifies to its own source — which is how
  // the marks grid lost its rules and grew its header text.
  const mc = `border:1px dashed ${SHEET_DASH};padding:5px 6px;font-size:9.5px;color:#111;text-align:center;`
  const mh = `${mc}font-size:9px;font-weight:700;background:#f7faf9;`
  const bar = `background:${SHEET_LINE};color:#fff;padding:8px 9px;font-size:10.5px;font-weight:700;`

  const marksCols = 10

  // The one column ruling the particulars block and the totals bar both follow,
  // so label edges and value edges line up straight down the sheet.
  const INFO_W = ['22%', '30%', '20%', '28%']


  return `
  <div style="border:2px solid ${SHEET_LINE};background:#fff;box-shadow:0 4px 20px rgba(0,0,0,0.12);position:relative;">

    <div style="text-align:center;padding:12px 14px 13px;border-bottom:2px solid ${SHEET_LINE};">
      <img src="${LOGO_URL}" width="60" height="60" style="object-fit:contain;display:block;margin:0 auto 5px;"
        onerror="this.style.display='none'"/>
      <div style="font-size:22px;font-weight:900;color:${BRAND};letter-spacing:0.04em;">${UNI_NAME.toUpperCase()}</div>
      <div style="font-size:8.5px;color:#555;margin-top:4px;">
        ${UNI_ESTD}
      </div>
    </div>

    <div class="office-only" style="text-align:right;font-size:9.5px;font-weight:700;padding:4px 10px 0;">
      Dmc No. : ${v(meta.dmcNo)}
    </div>

    <!-- The particulars read as a grid, two label/value pairs to a row: the
         student's own details down the left, the numbers that identify the
         sheet down the right. Same four columns the totals bar uses, so every
         vertical rule on the sheet lines up. -->
    <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
      <colgroup>
        <col style="width:${INFO_W[0]}"/><col style="width:${INFO_W[1]}"/>
        <col style="width:${INFO_W[2]}"/><col style="width:${INFO_W[3]}"/>
      </colgroup>
      <tr>
        <td style="${cell}white-space:nowrap;">Name Of Student:</td>
        <td style="${cell}font-weight:600;">${v(s.student_name)}</td>
        <td style="${cell}white-space:nowrap;">Enrollment No:</td>
        <td style="${cell}font-weight:600;">${v(s.enrollment_no)}</td>
      </tr>
      <tr>
        <td style="${cell}white-space:nowrap;">Father's Name :</td>
        <td style="${cell}font-weight:600;">${v(s.fathers_name)}</td>
        <td style="${cell}white-space:nowrap;">Reg no:</td>
        <td style="${cell}font-weight:600;">${v(s.registration_no)}</td>
      </tr>
      <tr>
        <td style="${cell}white-space:nowrap;">Mother's Name:</td>
        <td style="${cell}font-weight:600;">${v(s.mothers_name)}</td>
        <td style="${cell}white-space:nowrap;">Semester:</td>
        <td style="${cell}font-weight:600;">${romanSemester(meta.semester)}</td>
      </tr>
      <tr>
        <td style="${cell}white-space:nowrap;">Session :</td>
        <td style="${cell}font-weight:600;">${v(courseValidity(s))}</td>
        <td style="${cell}white-space:nowrap;">Examination held:</td>
        <td style="${cell}font-weight:600;">${v(meta.examHeld)}</td>
      </tr>
      <tr>
        <td style="${cell}white-space:nowrap;">Program :</td>
        <td colspan="3" style="${cell}font-weight:600;">${v(prog)}</td>
      </tr>
    </table>

    <div style="padding:11px 12px 12px;">
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <!-- Internal and External each head two columns — Min/Max and Marks
               Obtained — so the pair reads as one component rather than four
               separate columns repeating the word. -->
          <tr>
            <th rowspan="2" style="${mh}white-space:nowrap;">Subject Code</th>
            <th rowspan="2" style="${mh}text-align:left;">Subject Name</th>
            <th rowspan="2" style="${mh}">Credit</th>
            <th colspan="2" style="${mh}">Internal</th>
            <th colspan="2" style="${mh}">External</th>
            <th rowspan="2" style="${mh}">Total Marks</th>
            <th rowspan="2" style="${mh}">Grade Point<br/>(GP)<br/><span style="font-weight:400;">(out of 10)</span></th>
            <th rowspan="2" style="${mh}">Earned Credit<br/>(EC)</th>
          </tr>
          <tr>
            <th style="${mh}">Min/Max</th>
            <th style="${mh}">Marks<br/>Obtained</th>
            <th style="${mh}">Min/Max</th>
            <th style="${mh}">Marks<br/>Obtained</th>
          </tr>
        </thead>
        <tbody>
          ${marked.map(r => {
            let h = '<tr>'
            h += `<td style="${mc}white-space:nowrap;">${v(r.subject_code)}</td>`
            h += `<td style="${mc}text-align:left;">${v(r.subject_name)}</td>`
            h += `<td style="${mc}">${r.credit || '\u2014'}</td>`
            h += `<td style="${mc}">${pair(minOf(r.maxI), r.maxI)}</td>`
            h += `<td style="${mc}">${r.gotI === '' || r.gotI == null ? '\u2014' : r.gotI}</td>`
            h += `<td style="${mc}">${pair(minOf(r.maxT), r.maxT)}</td>`
            h += `<td style="${mc}">${r.gotT === '' || r.gotT == null ? '\u2014' : r.gotT}</td>`
            h += `<td style="${mc}">${r.entered ? (r.gotTot || '\u2014') : '\u2014'}</td>`
            // The paper's own grade point, the figure the SGPA is the
            // credit-weighted average of.
            h += `<td style="${mc}">${r.entered ? r.g.point : '\u2014'}</td>`
            h += `<td style="${mc}">${r.earned || '\u2014'}</td>`
            h += '</tr>'
            return h
          }).join('')}
          <tr>${(() => {
            let h = ''
            h += `<td style="${mc}"></td>`
            h += `<td style="${mc}text-align:left;font-weight:700;">Total</td>`
            h += `<td style="${mc}font-weight:700;">${sum('credit') || '\u2014'}</td>`
            h += `<td style="${mc}font-weight:700;">${pair(sumMin('maxI'), sum('maxI'))}</td>`
            h += `<td style="${mc}font-weight:700;">${sum('gotI') || '\u2014'}</td>`
            h += `<td style="${mc}font-weight:700;">${pair(sumMin('maxT'), sum('maxT'))}</td>`
            h += `<td style="${mc}font-weight:700;">${sum('gotT') || '\u2014'}</td>`
            h += `<td style="${mc}font-weight:700;">${totGot || '\u2014'}</td>`
            // Grade points are averaged, not added — the average is the SGPA
            // on the line below, so nothing is totalled in this column.
            h += `<td style="${mc}"></td>`
            h += `<td style="${mc}font-weight:700;">${sum('earned') || '\u2014'}</td>`
            return h
          })()}</tr>
          <tr>
            <td colspan="${marksCols}" style="${mc}font-weight:700;padding:6px;">
              SGPA - ${sgpa == null ? '\u2014' : sgpa.toFixed(2)}
              <span style="display:inline-block;width:1px;height:14px;background:${SHEET_LINE};vertical-align:middle;margin:0 8px;"></span>
              CGPA - ${semNo === 1 ? '\u2014' : (meta.cgpa ? Number(meta.cgpa).toFixed(2) : (sgpa == null ? '\u2014' : sgpa.toFixed(2)))}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <table style="width:100%;border-collapse:collapse;table-layout:fixed;margin-top:2px;">
      <colgroup>
        <col style="width:${INFO_W[0]}"/><col style="width:${INFO_W[1]}"/>
        <col style="width:${INFO_W[2]}"/><col style="width:${INFO_W[3]}"/>
      </colgroup>
      <tr>
        <td style="${bar}">Total Marks:</td>
        <td style="${bar}border-left:1px solid rgba(255,255,255,0.3);">${anyMarks ? totGot : '\u2014'}</td>
        <td style="${bar}border-left:1px solid rgba(255,255,255,0.3);">Division:</td>
        <td style="${bar}border-left:1px solid rgba(255,255,255,0.3);">${division}</td>
      </tr>
    </table>

    <div class="office-only" style="border-bottom:1px solid ${SHEET_DASH};padding:8px 12px;font-size:10px;font-weight:700;">
      Result:
    </div>
    <div style="border-bottom:1px solid ${SHEET_DASH};padding:8px 12px;font-size:10px;font-weight:700;">
      ${v(meta.resultStatus || 'Passed')}
    </div>

    <div style="margin:10px 12px 12px;border:1px solid ${SHEET_LINE};padding:7px 9px;">
      <div style="font-size:9px;font-weight:900;letter-spacing:0.06em;">IMPORTANT NOTE</div>
      <div style="font-size:8.5px;color:#333;margin-top:2px;">
        Marks May be changed at the printing of marksheet. If you need any correction please inform university within 20 days.
      </div>
    </div>

    <div class="office-only" style="padding:26px 12px 14px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="text-align:center;font-size:9.5px;font-weight:700;border-top:1px solid #000;padding-top:4px;">CHECKED BY</td>
          <td style="width:8%;"></td>
          <td style="text-align:center;font-size:9.5px;font-weight:700;border-top:1px solid #000;padding-top:4px;">PREPARED BY</td>
          <td style="width:8%;"></td>
          <td style="text-align:center;font-size:9.5px;font-weight:700;border-top:1px solid #000;padding-top:4px;">REGISTRAR/CONTROLLER OF EXAMINATION</td>
        </tr>
      </table>
    </div>

  </div>`
}



// The student's copy simply hides what only the office copy carries, so both
// are the same sheet and cannot drift apart. The selectors are class-only
// rather than `body.student-copy`, so the rule works just as well when the
// class sits on a wrapping div — which is how the portal renders the sheet
// inside a page rather than as a document of its own.
export const MARKS_STATEMENT_STYLE = `
  .student-copy .office-only { display:none !important; }
  .student-only { display:none !important; }
  .student-copy .student-only { display:block !important; }
`

// The Exam Section's printable Statement of Marks: the same sheet, wrapped in
// a document with the buttons that choose which copy is printed.
// The Result section's Statement of Marks — the on-screen sheet with the
// university letterhead, opened to check or print a result. The Print tab
// prints the Statement of Grades below instead, on the office stationery.
export function generateMarksStatement(s, rows = [], meta = {}) {
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
  <title>Statement of Marks — ${v(s.student_name)}</title>${baseStyle}</head>
<body class="${meta.studentCopy ? 'student-copy' : ''}">
<div style="max-width:760px;margin:24px auto;">
  <!-- Two copies of one sheet. The office copy carries the DMC number and the
       signature blocks; the student's copy does not, so publishing cannot hand
       out a signed-looking statement. The office-only class is what separates
       them — both print through the same page, the buttons set the mode. -->
  ${meta.studentCopy ? `
  <div class="no-print" style="text-align:center;padding:12px 0 18px;">
    <button onclick="window.print()" style="background:${BRAND};color:#fff;border:none;padding:10px 34px;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer;letter-spacing:0.04em;">⬇ Download / Print</button>
  </div>` : `
  <div class="no-print" style="text-align:center;padding:12px 0 18px;display:flex;gap:10px;justify-content:center;">
    <button onclick="setMode(false)" style="background:${BRAND};color:#fff;border:none;padding:10px 30px;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer;letter-spacing:0.03em;">🖨 Print (Office Copy)</button>
    <button onclick="setMode(true)" style="background:#fff;color:${BRAND};border:2px solid ${BRAND};padding:8px 30px;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer;letter-spacing:0.03em;">📤 Publish (Student Copy)</button>
  </div>
  <div class="no-print" id="modeNote" style="text-align:center;font-size:11px;color:#666;margin:-10px 0 14px;"></div>`}

  ${marksStatementHTML(s, rows, meta)}
</div>
<style>${MARKS_STATEMENT_STYLE}</style>
<script>
  function setMode(student) {
    document.body.classList.toggle('student-copy', student)
    document.getElementById('modeNote').textContent = student
      ? 'Student copy — no DMC number and no signature blocks.'
      : 'Office copy — with DMC number and signature blocks.'
    window.print()
  }
</script>
</body></html>`
  openWindow(html, 'Statement of Marks')
}

// ============================================================
//  STATEMENT OF GRADES — the printed marksheet
//  Printed from the Exam Section's Print tab only — the Result section keeps
//  its Statement of Marks. Laid out on A4 in millimetres to land on the
//  university's pre-printed
//  stationery: the top 60mm is left blank for the printed letterhead, and
//  every block sits where the office's own print setup puts it.
// ============================================================

// Code 128 — the symbol widths for values 0-106 (106 is the stop pattern).
const CODE128 = `212222 222122 222221 121223 121322 131222 122213 122312 132212 221213
221312 231212 112232 122132 122231 113222 123122 123221 223211 221132
221231 213212 223112 312131 311222 321122 321221 312212 322112 322211
212123 212321 232121 111323 131123 131321 112313 132113 132311 211313
231113 231311 112133 112331 132131 113123 113321 133121 313121 211331
231131 213113 213311 213131 311123 311321 331121 312113 312311 332111
314111 221411 431111 111224 111422 121124 121421 141122 141221 112214
112412 122114 122411 142112 142211 241211 221114 413111 241112 134111
111242 121142 121241 114212 124112 124211 411212 421112 421211 212141
214121 412121 111143 111341 131141 114113 114311 411113 411311 113141
114131 311141 411131 211412 211214 211232 2331112`.split(/\s+/)

// Text to Code 128 values: set B for text, switching to set C for runs of
// four or more digits, which packs two digits into one symbol. Verified to
// reproduce the office sample's barcode symbol for symbol.
function code128Values(text) {
  const s = String(text ?? '').replace(/[^\x20-\x7e]/g, ' ')
  const isD = c => c >= '0' && c <= '9'
  const run = k => { let n = 0; while (k + n < s.length && isD(s[k + n])) n++; return n }
  const out = []
  const r0 = run(0)
  let set = (r0 >= 4 && r0 % 2 === 0) || (r0 === s.length && r0 >= 2 && r0 % 2 === 0) ? 'C' : 'B'
  out.push(set === 'C' ? 105 : 104)
  let i = 0
  while (i < s.length) {
    const r = run(i)
    if (set === 'C') {
      if (r >= 2) { out.push(parseInt(s.substr(i, 2), 10)); i += 2 } else { out.push(100); set = 'B' }
      continue
    }
    if (r >= 4) {
      // An odd run takes its first digit in set B so the rest pairs up.
      if (r % 2) { out.push(s.charCodeAt(i) - 32); i += 1 } else { out.push(99); set = 'C' }
      continue
    }
    out.push(s.charCodeAt(i) - 32); i += 1
  }
  out.push((out[0] + out.slice(1).reduce((acc, x, k) => acc + x * (k + 1), 0)) % 103, 106)
  return out
}

function code128Svg(text) {
  const widths = code128Values(text).map(x => CODE128[x]).join('')
  const quiet = 6, height = 40
  let x = quiet, bars = ''
  for (let k = 0; k < widths.length; k++) {
    const w = Number(widths[k])
    if (k % 2 === 0) bars += `<rect x="${x}" y="0" width="${w}" height="${height}"/>`
    x += w
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${x + quiet} ${height}" preserveAspectRatio="none" shape-rendering="crispEdges" style="width:100%;height:100%;display:block;">${bars}</svg>`
}

// The QR library reads each character as one byte (Latin-1), which would
// garble a name in any other script. Hand it the UTF-8 bytes instead.
function qrSvg(text) {
  const bytes = new TextEncoder().encode(String(text ?? ''))
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  const qr = qrcode(0, 'M')
  qr.addData(bin)
  qr.make()
  return qr.createSvgTag({ cellSize: 2, margin: 0, scalable: true })
}

// SGPA for each semester present in a set of paper rows (each row carrying
// its `semester`), as { 1: 7.5, 2: 7.25 }.
export function sgpaBySemester(rows = []) {
  const bySem = {}
  for (const r of rows) (bySem[r.semester] ||= []).push(r)
  const out = {}
  for (const [sem, list] of Object.entries(bySem)) {
    const g = sgpaOf(list)
    if (g != null) out[sem] = g
  }
  return out
}

const ddmmyyyy = (d) => {
  const x = d ? new Date(d) : new Date()
  const t = Number.isNaN(x.getTime()) ? new Date() : x
  return `${String(t.getDate()).padStart(2, '0')}/${String(t.getMonth() + 1).padStart(2, '0')}/${t.getFullYear()}`
}

// meta: { dmcNo, semester, resultStatus, cgpa, semSgpas: { 1: 7.5 }, issueDate }
export function statementOfGradesHTML(s, rows = [], meta = {}) {
  const prog = s.programs?.program_name || s.program_name || '—'
  const marked = markRowsOf(rows)
  const semNo = parseInt(String(meta.semester || '').match(/\d+/)?.[0] || '', 10)
  const sum = (k) => marked.reduce((a, r) => a + (Number(r[k]) || 0), 0)
  const PASS_PCT = 40
  const minOf = (max) => (Number(max) ? Math.round((Number(max) * PASS_PCT) / 100) : 0)
  const sumMin = (k) => marked.reduce((a, r) => a + minOf(r[k]), 0)
  const pair = (min, max) => (max ? `${min}/${max}` : '')
  const cell = (x) => (x === '' || x == null ? '' : esc(String(x)))

  const semSgpas = { ...(meta.semSgpas || {}) }
  // Without the per-semester figures, at least this semester's own.
  if (semNo && semSgpas[semNo] == null) {
    const own = sgpaOf(marked.map(r => ({ ...r, theory_obtained: r.gotT, internal_obtained: r.gotI })))
    if (own != null) semSgpas[semNo] = own
  }
  // A CGPA is a running average — nothing to average in the first semester.
  const cgpa = semNo === 1 ? '—' : (meta.cgpa != null && meta.cgpa !== '' ? Number(meta.cgpa).toFixed(2) : '—')
  const failed = /fail/i.test(String(meta.resultStatus || ''))
    || marked.some(r => r.entered && r.maxTot && (r.gotTot / r.maxTot) * 100 < PASS_PCT)
  const result = marked.some(r => r.entered) ? (failed ? 'Fail' : 'Pass') : ''
  const issued = ddmmyyyy(meta.issueDate)

  const ROMAN_10 = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']

  // One compact line, so the code stays as open as the office sample's and
  // scans easily at 25mm: who, which sheet, what it says, and when.
  const idLines = (withDmc) => [
    s.student_name, s.enrollment_no,
    `Sem ${romanSemester(meta.semester)}`,
    withDmc && meta.dmcNo ? `DMC ${meta.dmcNo}` : null,
    semSgpas[semNo] != null ? `SGPA ${Number(semSgpas[semNo]).toFixed(2)}` : null,
    result || null,
    issued,
  ].filter(Boolean).join(' | ')
  const barcodeText = (withDmc) =>
    [s.enrollment_no, withDmc ? meta.dmcNo : null, issued].filter(Boolean).join(' ')

  const info = (label, value, extra = '') =>
    `<tr${extra}><td class="k">${label}</td><td class="c">:</td><td class="val">${v(value)}</td></tr>`

  return `
  <div class="sog-sheet">
    <div class="sog-barcode office-only">${code128Svg(barcodeText(true))}</div>
    <div class="sog-barcode student-only">${code128Svg(barcodeText(false))}</div>

    <div class="sog-title">STATEMENT OF GRADES</div>

    <table class="sog-info sog-left">
      ${info('Name of Student', s.student_name)}
      ${info("Father's Name", s.fathers_name)}
      ${info("Mother's Name", s.mothers_name)}
      ${info('Session', courseValidity(s))}
      ${info('Programme', prog)}
    </table>
    <table class="sog-info sog-right">
      ${info('Enrollment No.', s.enrollment_no)}
      ${info('Registration No.', s.registration_no)}
      ${info('Semester', romanSemester(meta.semester))}
      ${info('DMC No.', meta.dmcNo, ' class="office-only"')}
    </table>

    <div class="sog-body">
      <table class="sog-marks">
        <colgroup>
          <col style="width:14mm"/><col/><col style="width:12mm"/>
          <col style="width:12.7mm"/><col style="width:14.7mm"/>
          <col style="width:14mm"/><col style="width:14.5mm"/>
          <col style="width:10.2mm"/><col style="width:15.2mm"/><col style="width:10.9mm"/>
        </colgroup>
        <thead>
          <tr class="h1">
            <th rowspan="2">Subject<br/>Code</th>
            <th rowspan="2">Subject Name</th>
            <th rowspan="2">Credit</th>
            <th colspan="2">Internal</th>
            <th colspan="2">External</th>
            <th rowspan="2">Total<br/>Marks</th>
            <th rowspan="2">Grade<br/>Point<br/>(GP)<br/><span class="sm">(out of 10)</span></th>
            <th rowspan="2">Earned<br/>Credit<br/>(EC)</th>
          </tr>
          <tr class="h2">
            <th>Min/Max</th><th>Marks<br/>Obtained</th>
            <th>Min/Max</th><th>Marks<br/>Obtained</th>
          </tr>
        </thead>
        <tbody>
          ${marked.map(r => `<tr>
            <td>${cell(r.subject_code)}</td>
            <td class="name">${cell(r.subject_name)}</td>
            <td>${cell(r.credit || '')}</td>
            <td>${pair(minOf(r.maxI), r.maxI)}</td>
            <td>${cell(r.gotI)}</td>
            <td>${pair(minOf(r.maxT), r.maxT)}</td>
            <td>${cell(r.gotT)}</td>
            <td>${r.entered ? cell(r.gotTot) : ''}</td>
            <td>${r.entered ? cell(r.g.point) : ''}</td>
            <td>${r.entered ? cell(r.earned) : ''}</td>
          </tr>`).join('')}
          <!-- One row per paper, then a single merged spacer before the
               total — the grid is as long as the semester, no longer. -->
          <tr class="blank"><td colspan="10"></td></tr>
          <tr class="total">
            <td colspan="2">Total</td>
            <td>${sum('credit') || ''}</td>
            <td>${pair(sumMin('maxI'), sum('maxI'))}</td>
            <td>${sum('gotI') || ''}</td>
            <td>${pair(sumMin('maxT'), sum('maxT'))}</td>
            <td>${sum('gotT') || ''}</td>
            <td>${sum('gotTot') || ''}</td>
            <td></td>
            <td>${sum('earned') || ''}</td>
          </tr>
        </tbody>
      </table>

      <div class="sog-strip">
        <table class="sog-sem">
          <tr><th class="lbl">Semester</th>${ROMAN_10.map(r => `<th>${r}</th>`).join('')}</tr>
          <tr><th class="lbl">SGPA</th>${ROMAN_10.map((_, k) =>
            `<td>${semSgpas[k + 1] != null ? Number(semSgpas[k + 1]).toFixed(2) : ''}</td>`).join('')}</tr>
        </table>
        <table class="sog-res">
          <tr><th>Result</th><th>CGPA</th></tr>
          <tr><td>${result}</td><td>${cgpa}</td></tr>
        </table>
      </div>
    </div>

    <div class="sog-qr office-only">${qrSvg(idLines(true))}</div>
    <div class="sog-qr student-only">${qrSvg(idLines(false))}</div>
    <div class="sog-issue">Date of issue: ${issued}</div>
    <img class="sog-sign office-only" src="${MARKSHEET_SIGNATURE_URL}" alt="" onerror="this.style.display='none'"/>
    <div class="sog-signlabel">Registrar/Exam Of Controller</div>
  </div>`
}

// Positions are the office print setup's, measured off its A4 page.
export const STATEMENT_OF_GRADES_STYLE = `
  @page { size: A4; margin: 0; }
  .sog-sheet { position:relative; width:210mm; height:297mm; background:#fff; color:#000;
               font-family: Arial, Helvetica, sans-serif; box-sizing:border-box; overflow:hidden; }
  .sog-sheet * { box-sizing:border-box; }
  .sog-barcode { position:absolute; left:155.4mm; top:11.9mm; width:40.9mm; height:10.2mm; }
  .sog-title { position:absolute; left:0; right:0; top:64.5mm; text-align:center;
               font-family:"Times New Roman", Times, serif; font-weight:700; font-size:16.5pt; line-height:1; }
  .sog-info { position:absolute; top:80.6mm; border-collapse:collapse; font-size:10pt; }
  .sog-info td { padding:0; height:6.1mm; vertical-align:middle; white-space:nowrap; }
  .sog-info td.k { font-weight:700; }
  .sog-info td.c { font-weight:700; padding:0 1.2mm 0 0; }
  .sog-left  { left:11.4mm; }  .sog-left td.k  { width:30mm; }
  .sog-right { left:135.6mm; } .sog-right td.k { width:29mm; }
  .sog-right td.val { font-size:9pt; }
  .sog-left td.val { white-space:normal; max-width:82mm; }
  .sog-body { position:absolute; left:11.4mm; top:111mm; width:187.3mm;
               min-height:110mm; display:flex; flex-direction:column; }
  .sog-marks { margin-bottom:4.3mm; }
  .sog-marks { width:100%; border-collapse:collapse; table-layout:fixed; font-size:7.6pt; font-weight:700; }
  .sog-marks th, .sog-marks td { border:0.3mm solid #000; text-align:center; vertical-align:middle; padding:0.4mm 0.6mm; line-height:1.15; }
  .sog-marks thead tr.h1 th { height:5.3mm; }
  .sog-marks thead tr.h2 th { height:8.1mm; }
  .sog-marks thead .sm { font-size:6.4pt; }
  .sog-marks tbody tr { height:6.35mm; }
  .sog-marks td.name { text-align:left; padding-left:1mm; white-space:normal; overflow-wrap:anywhere; }
  .sog-marks tr.total td { font-size:8.6pt; }
  .sog-strip { display:flex; justify-content:space-between; align-items:flex-start; margin-top:auto; }
  .sog-sem, .sog-res { border-collapse:collapse; font-size:7.6pt; font-weight:700; table-layout:fixed; }
  .sog-sem { width:150.6mm; } .sog-res { width:31.5mm; }
  .sog-sem th, .sog-sem td, .sog-res th, .sog-res td { border:0.3mm solid #000; height:5.1mm; text-align:center; padding:0 0.5mm; }
  .sog-sem th.lbl { width:25.6mm; text-align:left; padding-left:1mm; }
  .sog-qr { position:absolute; left:16.5mm; top:233.1mm; width:25.6mm; height:25.6mm; }
  .sog-qr svg { width:100%; height:100%; display:block; }
  .sog-issue { position:absolute; left:13mm; top:262.5mm; font-size:8.6pt; font-weight:700; }
  .sog-sign { position:absolute; left:149.8mm; top:253.2mm; width:38mm; height:auto; }
  .sog-signlabel { position:absolute; left:145.8mm; top:267.1mm; font-size:8.6pt; font-weight:700; }
  .student-only { display:none; }
  body.student-copy .student-only { display:block; }
  body.student-copy .office-only { display:none !important; }
`

export function generateStatementOfGrades(s, rows = [], meta = {}) {
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
  <title>Statement of Grades — ${v(s.student_name)}</title>
  <style>
    html, body { margin:0; padding:0; background:#e5e7eb; }
    ${STATEMENT_OF_GRADES_STYLE}
    .sog-sheet { margin:0 auto 12mm; box-shadow:0 4px 20px rgba(0,0,0,0.18); }
    @media print {
      html, body { background:#fff; }
      .no-print { display:none !important; }
      .sog-sheet { margin:0; box-shadow:none; }
      * { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    }
  </style></head>
<body>
  <!-- Two copies of one sheet. The office copy carries the DMC number and the
       signature; the student's copy does not, so publishing cannot hand out a
       signed-looking statement. Both print through the same page. -->
  <div class="no-print" style="text-align:center;padding:14px 0 6px;display:flex;gap:10px;justify-content:center;font-family:Arial,sans-serif;">
    <button onclick="setMode(false)" style="background:${BRAND};color:#fff;border:none;padding:10px 30px;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer;">🖨 Print (Office Copy)</button>
    <button onclick="setMode(true)" style="background:#fff;color:${BRAND};border:2px solid ${BRAND};padding:8px 30px;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer;">📤 Publish (Student Copy)</button>
  </div>
  <div class="no-print" id="modeNote" style="text-align:center;font-size:11px;color:#555;margin:0 0 12px;font-family:Arial,sans-serif;">
    Print on A4 marksheet stationery at 100% scale, margins None, headers and footers off.
  </div>
  ${statementOfGradesHTML(s, rows, meta)}
<script>
  function setMode(student) {
    document.body.classList.toggle('student-copy', student)
    document.getElementById('modeNote').textContent = student
      ? 'Student copy — no DMC number and no signature.'
      : 'Office copy — with DMC number and signature.'
    window.print()
  }
</script>
</body></html>`
  openWindow(html, 'Statement of Grades')
}

// ============================================================
//  8. PRINT-TAB CERTIFICATES
//  Provisional, Migration, Degree and the Consolidated Marksheet. All four
//  print from the Exam Section's Print tab, once a result has been forwarded
//  from the Result section. They share the university band, the print button
//  and the base style with every other card here, so a set printed together
//  reads as one set.
// ============================================================

// The shell every one-page certificate below sits in: bordered card, band
// header, a title, then whatever body is passed in.
function certificateShell({ title, subtitle = '', body, footer = '', width = 680 }) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
  <title>${v(title)}</title>${baseStyle}
  <style>
    .cert-body { font-size:12.5px; line-height:2.1; color:#111; padding:26px 34px; text-align:justify; }
    .cert-body b { color:#000; }
    .fill { display:inline-block; border-bottom:1px dotted #555; min-width:170px; padding:0 6px;
            font-weight:700; text-align:center; }
    .sign-row { display:flex; justify-content:space-between; padding:38px 34px 26px; }
    .sign { text-align:center; font-size:10px; font-weight:700; color:#222; }
    .sign span { display:block; border-top:1.2px solid #333; padding-top:5px; min-width:150px; }
    .serial { font-size:10px; font-weight:700; color:${BRAND}; }
  </style>
</head>
<body>
<div style="max-width:${width}px;margin:24px auto;">
  ${printBtn()}
  <div style="border:2.5px solid #333;background:#fff;box-shadow:0 4px 20px rgba(0,0,0,0.12);">
    ${uniBandHeader({ logo: 52, name: 19, estd: 8 })}
    <div style="text-align:center;padding:9px;border-bottom:2px solid #333;background:#fafafa;">
      <span style="font-size:18px;font-weight:900;color:${BRAND};letter-spacing:0.1em;">${v(title).toUpperCase()}</span>
      ${subtitle ? `<div style="font-size:9.5px;color:#666;margin-top:3px;font-style:italic;">${v(subtitle)}</div>` : ''}
    </div>
    ${body}
    <div class="sign-row">
      <div class="sign"><span>Registrar</span></div>
      <div class="sign"><span>Controller of Examinations</span></div>
    </div>
    ${footer}
  </div>
</div>
</body></html>`
}

// The line every certificate opens with — who the student is.
function certHeadRow(s, rightLabel, rightValue) {
  const prog = s.programs?.program_name || s.program_name || '—'
  return `
    <table style="width:100%;border-collapse:collapse;border-bottom:2px solid #333;">
      <tr>
        <td style="font-size:9.5px;font-weight:700;color:#fff;background:${BRAND};padding:5px 8px;width:50%;border-right:2px solid #333;text-align:center;">Enrollment No.</td>
        <td style="font-size:9.5px;font-weight:700;color:#fff;background:${BRAND};padding:5px 8px;text-align:center;">${v(rightLabel)}</td>
      </tr>
      <tr>
        <td style="font-size:11px;font-weight:700;text-align:center;padding:6px 8px;border-right:2px solid #333;">${v(s.enrollment_no)}</td>
        <td style="font-size:11px;font-weight:700;text-align:center;padding:6px 8px;">${v(rightValue)}</td>
      </tr>
    </table>
    <div style="font-size:10px;color:#444;padding:10px 34px 0;font-style:italic;">Programme: <b>${v(prog)}</b></div>`
}

// ---- Provisional Certificate -------------------------------------------
// Issued while the degree itself is being prepared; it says the student has
// completed the programme and is qualified for the award.
// opts: { serialNo, passingYear, division, cgpa }
export function generateProvisionalCertificate(s, opts = {}) {
  const prog = s.programs?.program_name || s.program_name || '—'
  const body = `
    ${certHeadRow(s, 'Serial No.', opts.serialNo || '—')}
    <div class="cert-body">
      This is to certify that <b>${v(s.student_name)}</b>,
      ${s.father_name ? `son / daughter of <b>${v(s.father_name)}</b>, ` : ''}
      bearing Enrollment No. <b>${v(s.enrollment_no)}</b>, has completed the
      programme <b>${v(prog)}</b> of this University
      ${opts.passingYear ? `in the year <b>${v(opts.passingYear)}</b>` : ''}
      and has been declared <b>PASSED</b>
      ${opts.division ? `in <b>${v(opts.division)}</b>` : ''}
      ${opts.cgpa ? `with a CGPA of <b>${v(opts.cgpa)}</b>` : ''}.
      <br/><br/>
      This provisional certificate is issued on the candidate's request pending
      the formal award of the degree, and remains valid until the degree
      certificate is issued.
    </div>`
  openWindow(certificateShell({
    title: 'Provisional Certificate',
    subtitle: 'Valid until the degree certificate is issued',
    body,
  }), 'Provisional Certificate')
}

// ---- Migration Certificate ---------------------------------------------
// The university's no-objection to the student joining another university.
// opts: { serialNo, passingYear }
export function generateMigrationCertificate(s, opts = {}) {
  const prog = s.programs?.program_name || s.program_name || '—'
  const sess = s.academic_sessions?.session_name || s.session_name || '—'
  const body = `
    ${certHeadRow(s, 'Migration No.', opts.serialNo || '—')}
    <div class="cert-body">
      This is to certify that <b>${v(s.student_name)}</b>,
      ${s.father_name ? `son / daughter of <b>${v(s.father_name)}</b>, ` : ''}
      bearing Enrollment No. <b>${v(s.enrollment_no)}</b>, was a bona fide
      student of this University in the session <b>${v(sess)}</b> and has
      completed <b>${v(prog)}</b>
      ${opts.passingYear ? `in the year <b>${v(opts.passingYear)}</b>` : ''}.
      <br/><br/>
      The University has <b>no objection</b> to the candidate migrating to any
      other University or Board of examination. This certificate is issued on
      the candidate's own request and does not by itself confer any right of
      admission elsewhere.
    </div>`
  openWindow(certificateShell({
    title: 'Migration Certificate',
    subtitle: 'No objection to migration to another University or Board',
    body,
  }), 'Migration Certificate')
}

// ---- Degree Certificate -------------------------------------------------
// The award itself. Landscape-ish proportions and a wider card, so it does
// not read like the one-page office certificates above.
// opts: { serialNo, passingYear, division, convocationDate }
export function generateDegreeCertificate(s, opts = {}) {
  const prog = s.programs?.program_name || s.program_name || '—'
  const body = `
    ${certHeadRow(s, 'Degree No.', opts.serialNo || '—')}
    <div class="cert-body" style="text-align:center;line-height:2.4;">
      The Board of Management of this University, on the recommendation of the
      Academic Council, hereby confers upon
      <br/>
      <span style="display:block;font-size:20px;font-weight:900;color:${BRAND};letter-spacing:0.04em;margin:14px 0 4px;">
        ${v(s.student_name)}
      </span>
      ${s.father_name ? `<span style="font-size:11px;color:#444;">son / daughter of ${v(s.father_name)}</span><br/>` : ''}
      the degree of
      <span style="display:block;font-size:16px;font-weight:900;margin:12px 0 4px;">${v(prog)}</span>
      ${opts.division ? `having been placed in <b>${v(opts.division)}</b>` : ''}
      ${opts.passingYear ? `in the year <b>${v(opts.passingYear)}</b>` : ''},
      with all the rights, privileges and responsibilities pertaining thereto.
    </div>
    ${opts.convocationDate ? `<div style="text-align:center;font-size:10px;color:#555;padding-bottom:6px;font-style:italic;">Awarded at the convocation held on ${v(opts.convocationDate)}</div>` : ''}`
  openWindow(certificateShell({
    title: 'Degree Certificate',
    body,
    width: 760,
  }), 'Degree Certificate')
}

// ---- Consolidated Marksheet --------------------------------------------
// Every semester on one sheet, with the overall total and division. The
// per-semester Statement of Marks stays the authority for a single semester;
// this is the summary across all of them.
// sems: [{ sem, obtained, total, status, dmcNo }]
// opts: { serialNo, cgpa }
export function generateConsolidatedMarksheet(s, sems = [], opts = {}) {
  const num = x => Number(String(x ?? '').replace(/[^\d.]/g, '')) || 0
  const totObt = sems.reduce((a, r) => a + num(r.obtained), 0)
  const totMax = sems.reduce((a, r) => a + num(r.total), 0)
  const pct = totMax > 0 ? (totObt / totMax) * 100 : 0
  const failed = sems.some(r => String(r.status || '').toLowerCase() === 'fail')

  const rows = sems.map(r => {
    const o = num(r.obtained), t = num(r.total)
    const p = t > 0 ? (o / t) * 100 : 0
    return `<tr>
      <td style="text-align:center;">Semester ${v(r.sem)}</td>
      <td style="text-align:center;font-family:monospace;">${r.dmcNo ? v(r.dmcNo) : '—'}</td>
      <td style="text-align:center;">${t ? o : '—'}</td>
      <td style="text-align:center;">${t || '—'}</td>
      <td style="text-align:center;">${t ? p.toFixed(2) + '%' : '—'}</td>
      <td style="text-align:center;">${t ? gradeFor(p) : '—'}</td>
      <td style="text-align:center;font-weight:700;color:${String(r.status).toLowerCase() === 'fail' ? '#b91c1c' : '#047857'};">${v(r.status || '—')}</td>
    </tr>`
  }).join('')

  const body = `
    ${certHeadRow(s, 'Serial No.', opts.serialNo || '—')}
    <div style="padding:16px 22px 4px;">
      <table style="width:100%;border-collapse:collapse;font-size:10.5px;" border="0">
        <thead>
          <tr style="background:${BRAND};color:#fff;">
            <th style="padding:6px;">Semester</th>
            <th style="padding:6px;">DMC No.</th>
            <th style="padding:6px;">Obtained</th>
            <th style="padding:6px;">Maximum</th>
            <th style="padding:6px;">Percentage</th>
            <th style="padding:6px;">Grade</th>
            <th style="padding:6px;">Result</th>
          </tr>
        </thead>
        <tbody>
          ${rows || `<tr><td colspan="7" style="text-align:center;padding:16px;color:#888;">No semester has been forwarded for printing yet.</td></tr>`}
        </tbody>
        <tfoot>
          <tr style="background:#fafafa;font-weight:800;">
            <td style="padding:7px;text-align:center;" colspan="2">Total</td>
            <td style="padding:7px;text-align:center;">${totObt || '—'}</td>
            <td style="padding:7px;text-align:center;">${totMax || '—'}</td>
            <td style="padding:7px;text-align:center;">${totMax ? pct.toFixed(2) + '%' : '—'}</td>
            <td style="padding:7px;text-align:center;">${totMax ? gradeFor(pct) : '—'}</td>
            <td style="padding:7px;text-align:center;color:${failed ? '#b91c1c' : '#047857'};">${failed ? 'FAIL' : (totMax ? 'PASS' : '—')}</td>
          </tr>
        </tfoot>
      </table>
      <div style="font-size:10.5px;color:#222;padding:12px 4px 0;">
        ${totMax ? `Division: <b>${v(divisionFor(pct))}</b>` : ''}
        ${opts.cgpa ? ` &nbsp;·&nbsp; CGPA: <b>${v(opts.cgpa)}</b>` : ''}
      </div>
      <p style="font-size:9px;color:#777;font-style:italic;padding:8px 4px 0;">
        This sheet consolidates the semesters forwarded for printing. The
        Statement of Marks issued for a semester remains the authority for it.
      </p>
    </div>`
  openWindow(certificateShell({
    title: 'Consolidated Marksheet',
    body,
    width: 820,
  }), 'Consolidated Marksheet')
}
