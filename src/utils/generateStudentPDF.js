import { formatDate } from './formatDate'

const LOGO_URL = 'https://sengolinternationaluniversity.edu.in/images/logo.png'
const UNI_NAME = 'Sengol International University'
const UNI_TAGLINE = 'Educate, Empower, Excel'
const UNI_ADDRESS = 'Lower Pepthang, PO - Lingmoo, District - Namchi, Sikkim - 737134'
const UNI_PHONE = '+91-9205299887'
const UNI_EMAIL = 'info@sengolinternationaluniversity.edu.in'
const UNI_WEB = 'www.sengolinternationaluniversity.edu.in'
const UNI_ACT = 'Established under Act No. 14 of 2025, Sikkim State Legislative Assembly'

function v(val) {
  return val && String(val).trim() ? String(val).trim() : '—'
}

function fmtDate(d) {
  return formatDate(d)
}

// Compact 2-cell row for info tables
function r(label, value, fullWidth) {
  const lStyle = 'padding:3px 6px 3px 0;font-size:9.5px;color:#666;font-weight:700;white-space:nowrap;vertical-align:top;'
  const vStyle = `padding:3px 0;font-size:9.5px;color:#111;vertical-align:top;${fullWidth ? '' : 'max-width:180px;word-break:break-word;'}`
  return `<tr>
    <td style="${lStyle}">${label}</td>
    <td style="${vStyle}">: ${v(value)}</td>
  </tr>`
}

function sectionTitle(n, title) {
  return `<div style="background:#933d18;color:#fff;padding:4px 10px;font-size:10px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;border-radius:3px 3px 0 0;margin-top:14px;">${n}. ${title}</div>
  <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 3px 3px;padding:8px 10px;">`
}

function addrText(s, prefix) {
  return [
    s[`${prefix}_village_town`],
    s[`${prefix}_landmark`],
    s[`${prefix}_post_office`] ? 'PO: ' + s[`${prefix}_post_office`] : null,
    s[`${prefix}_city`],
    s[`${prefix}_district`],
    s[`${prefix}_state`],
    s[`${prefix}_pin_code`] ? 'PIN: ' + s[`${prefix}_pin_code`] : null,
  ].filter(Boolean).join(', ') || '—'
}

function eduRows(s) {
  const levels = [
    { label: '10th / SSC', p: 'tenth' },
    { label: '12th / HSC', p: 'twelfth' },
    { label: 'Graduation (UG)', p: 'ug' },
    { label: 'Post Grad (PG)', p: 'pg' },
    { label: 'Diploma', p: 'diploma' },
  ]
  return levels.map(({ label, p }) => {
    const inst = s[`${p}_institute_name`]
    if (!inst) return ''
    const board = s[`${p}_board_university`] || '—'
    const year = s[`${p}_passing_year`] || '—'
    const obt = parseFloat(s[`${p}_obtained_marks`]) || 0
    const tot = parseFloat(s[`${p}_total_marks`]) || 0
    const pct = obt > 0 && tot > 0 ? ((obt / tot) * 100).toFixed(1) + '%' : '—'
    const marks = obt && tot ? `${obt}/${tot}` : '—'
    return `<tr style="border-bottom:1px solid #f3f4f6;">
      <td style="padding:4px 6px;font-size:9px;font-weight:700;color:#933d18;">${label}</td>
      <td style="padding:4px 6px;font-size:9px;color:#111;">${inst}</td>
      <td style="padding:4px 6px;font-size:9px;color:#555;">${board}</td>
      <td style="padding:4px 6px;font-size:9px;color:#555;">${year}</td>
      <td style="padding:4px 6px;font-size:9px;color:#555;">${marks}</td>
      <td style="padding:4px 6px;font-size:9px;font-weight:700;color:#059669;">${pct}</td>
    </tr>`
  }).join('')
}

function docCheck(label, url) {
  return `<td style="padding:3px 6px;font-size:9.5px;white-space:nowrap;">
    <span style="color:${url ? '#059669' : '#d1d5db'};font-size:11px;margin-right:3px;">${url ? '☑' : '☐'}</span>
    <span style="color:${url ? '#111' : '#9ca3af'};">${label}</span>
    ${url ? `&nbsp;<a href="${url}" style="color:#933d18;font-size:8.5px;text-decoration:underline;" target="_blank">View</a>` : ''}
  </td>`
}

export function generateStudentPDF(s, programName, sessionName, centerName) {
  const deptName = s.departments?.name || ''
  const modeName = s.study_modes?.mode_name || ''
  const progName = programName || s.programs?.program_name || ''
  const sessName = sessionName || s.academic_sessions?.session_name || ''
  const ctrName = centerName || s.centers?.center_name || ''

  const statusColor = { Approved: '#059669', Rejected: '#dc2626', Hold: '#4f46e5' }[s.status] || '#d97706'

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Admission Form — ${v(s.student_name)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: "Times New Roman", Times, Georgia, serif; background: #fff; color: #111; font-size: 10px; }
    @page { size: A4; margin: 12mm 10mm 12mm 10mm; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
    }
    .page { max-width: 780px; margin: 0 auto; }
    table { border-collapse: collapse; width: 100%; }
    a { color: #933d18; }
  </style>
</head>
<body>
<div class="page">

  <div class="no-print" style="text-align:center;padding:10px 0 16px;">
    <button onclick="window.print()" style="background:#933d18;color:#fff;border:none;padding:10px 32px;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer;letter-spacing:0.04em;">⬇ Download / Print PDF</button>
  </div>

  <!-- HEADER -->
  <div style="border:2px solid #933d18;border-radius:5px;overflow:hidden;margin-bottom:12px;">
    <div style="background:#933d18;padding:10px 16px;">
      <table>
        <tr>
          <td style="width:68px;vertical-align:middle;">
            <img src="${LOGO_URL}" alt="Logo" width="60" height="60" style="border-radius:50%;background:#fff;padding:3px;object-fit:contain;" onerror="this.style.display='none'"/>
          </td>
          <td style="text-align:center;vertical-align:middle;padding:0 10px;">
            <div style="color:#fff;font-size:20px;font-weight:900;letter-spacing:0.03em;">${UNI_NAME.toUpperCase()}</div>
            <div style="color:rgba(255,255,255,0.88);font-size:11px;margin-top:2px;font-style:italic;">${UNI_TAGLINE}</div>
            <div style="color:rgba(255,255,255,0.65);font-size:8.5px;margin-top:3px;">${UNI_ACT}</div>
          </td>
          <td style="width:68px;vertical-align:middle;text-align:right;">
            <img src="${LOGO_URL}" alt="Logo" width="60" height="60" style="border-radius:50%;background:#fff;padding:3px;object-fit:contain;" onerror="this.style.display='none'"/>
          </td>
        </tr>
      </table>
    </div>
    <div style="background:#fef9f6;padding:5px 16px;text-align:center;border-top:1px solid #f0ebe7;">
      <span style="font-size:9px;color:#666;">${UNI_ADDRESS} &nbsp;|&nbsp; ${UNI_PHONE} &nbsp;|&nbsp; ${UNI_EMAIL} &nbsp;|&nbsp; ${UNI_WEB}</span>
    </div>
  </div>

  <!-- TITLE -->
  <div style="text-align:center;margin-bottom:12px;">
    <div style="display:inline-block;background:#933d18;color:#fff;padding:5px 30px;border-radius:3px;">
      <span style="font-size:13px;font-weight:900;letter-spacing:0.1em;">STUDENT ADMISSION FORM</span>
    </div>
  </div>

  <!-- REFERENCE BOX -->
  <div style="border:1px solid #e5e7eb;border-radius:4px;padding:8px 12px;margin-bottom:12px;background:#f9fafb;">
    <table>
      <tr>
        <td style="font-size:9.5px;color:#555;width:50%;">Status: <strong style="color:${statusColor};">${v(s.status)}</strong></td>
        <td style="font-size:9.5px;color:#555;width:50%;text-align:right;">Submitted: <strong>${fmtDate(s.date_of_submission)}</strong></td>
      </tr>
      ${s.admission_number ? `<tr><td colspan="3" style="font-size:9.5px;padding-top:4px;">
        Admission No: <strong style="color:#933d18;font-size:11px;">${s.admission_number}</strong>
        ${s.enrollment_no ? `&nbsp;&nbsp;&nbsp; Enrollment No: <strong style="color:#059669;font-size:11px;">${s.enrollment_no}</strong>` : ''}
        ${s.registration_no && s.enrollment_no ? `&nbsp;&nbsp;&nbsp; Reg No: <strong>${s.registration_no}</strong>` : ''}
      </td></tr>` : ''}
      ${s.remarks ? `<tr><td colspan="3" style="font-size:9.5px;padding-top:4px;color:${s.status === 'Rejected' ? '#dc2626' : '#555'};">Remarks: <strong>${s.remarks}</strong></td></tr>` : ''}
    </table>
  </div>

  <!-- 1. COURSE DETAILS -->
  ${sectionTitle(1, 'Course / Program Details')}
    <table>
      <tr>
        <td style="width:50%;vertical-align:top;padding-right:12px;">
          <table>${[
            r('University', 'Sengol International University'),
            r('Department', deptName),
            r('Program Name', progName),
            r('Course Code', s.course_code),
          ].join('')}</table>
        </td>
        <td style="width:50%;vertical-align:top;">
          <table>${[
            r('Session', sessName),
            r('Semester / Year', s.semester_year),
            r('Academic Year', s.academic_year),
            r('Mode of Study', modeName),
          ].join('')}</table>
        </td>
      </tr>
      <tr>
        <td style="padding-right:12px;"><table>${r('Entry Type', s.entry_type)}</table></td>
        <td><table>${r('Date of Admission', fmtDate(s.date_of_admission))}</table></td>
      </tr>
    </table>
  </div>

  <!-- 2. CENTER INFO -->
  ${sectionTitle(2, 'Center Information')}
    <table>
      <tr>
        <td style="width:50%;vertical-align:top;padding-right:12px;">
          <table>${r('Center Name', ctrName)}</table>
        </td>
        <td style="width:50%;vertical-align:top;">
          <table>${r('Center Code', s.centers?.center_code)}</table>
        </td>
      </tr>
    </table>
  </div>

  <!-- 3. PERSONAL INFORMATION -->
  ${sectionTitle(3, 'Personal Information')}
    <table style="width:100%;">
      <tr>
        <!-- LEFT: 2-column info grid -->
        <td style="vertical-align:top;padding-right:10px;">
          <table style="width:100%;">
            <tr>
              <td style="width:50%;vertical-align:top;padding-right:8px;">
                <table>${[
                  r('Full Name', s.student_name),
                  r('Date of Birth', fmtDate(s.date_of_birth)),
                  r('Gender', s.gender),
                  r('Nationality', s.nationality),
                  r('Religion', s.religion),
                  r('Caste', s.caste),
                  r('Blood Group', s.blood_group),
                  r('Mother Tongue', s.mother_tongue),
                ].join('')}</table>
              </td>
              <td style="width:50%;vertical-align:top;">
                <table>${[
                  r('Mobile No', s.mobile_no),
                  r('WhatsApp No', s.whatsapp_no),
                  r('Email Id', s.email),
                  r('Aadhar No', s.aadhar_no),
                  r('PAN No', s.pan_no),
                  r('Profession', s.profession),
                  r('Handicapped', s.physically_handicapped),
                  r('Scholarship', s.scholarship_applied),
                ].join('')}</table>
              </td>
            </tr>
          </table>
          <!-- Identification Marks — full width below grid -->
          ${s.identification_marks ? `<table style="width:100%;margin-top:2px;"><tr>
            <td style="font-size:9.5px;font-weight:700;color:#666;white-space:nowrap;padding-right:6px;vertical-align:top;">Identification Marks</td>
            <td style="font-size:9.5px;color:#111;">: ${v(s.identification_marks)}</td>
          </tr></table>` : ''}
        </td>
        <!-- RIGHT: Photo box -->
        <td style="width:92px;vertical-align:top;text-align:center;padding-left:6px;">
          ${s.photo_url
            ? `<img src="${s.photo_url}" alt="Photo" style="width:84px;height:104px;object-fit:cover;border:2px solid #e5e7eb;border-radius:4px;display:block;"/>`
            : `<div style="width:84px;height:104px;border:1.5px dashed #d1d5db;border-radius:4px;display:flex;align-items:center;justify-content:center;background:#f9fafb;"><span style="font-size:8px;color:#aaa;text-align:center;line-height:1.4;">Paste<br/>Photo<br/>Here</span></div>`
          }
          <p style="font-size:8px;color:#666;margin-top:3px;font-weight:600;">Student Photo</p>
          ${s.signature_url
            ? `<img src="${s.signature_url}" alt="Sig" style="width:84px;height:36px;object-fit:contain;border:1px solid #e5e7eb;border-radius:3px;margin-top:4px;display:block;background:#fff;"/><p style="font-size:8px;color:#666;margin-top:2px;font-weight:600;">Signature</p>`
            : `<div style="width:84px;height:36px;border:1px dashed #d1d5db;border-radius:3px;margin-top:4px;background:#f9fafb;"></div><p style="font-size:8px;color:#666;margin-top:2px;font-weight:600;">Signature</p>`
          }
        </td>
      </tr>
    </table>
  </div>

  <!-- 4. FAMILY INFORMATION -->
  ${sectionTitle(4, 'Family Information')}
    <table>
      <tr>
        <td style="width:50%;vertical-align:top;padding-right:12px;">
          <table>${[
            r("Father's Name", s.fathers_name),
            r("Father's Occupation", s.fathers_occupation),
            r("Mother's Name", s.mothers_name),
            r("Mother's Occupation", s.mothers_occupation),
          ].join('')}</table>
        </td>
        <td style="width:50%;vertical-align:top;">
          <table>${[
            r("Guardian's Name", s.guardian_name),
            r("Relation", s.guardian_relation),
            r("Guardian's Occupation", s.guardian_occupation),
            r("Guardian's Mobile", s.guardian_mobile),
          ].join('')}</table>
        </td>
      </tr>
    </table>
  </div>

  <!-- 5. ADDRESS -->
  ${sectionTitle(5, 'Address Details')}
    <table>
      <tr>
        <td style="width:50%;vertical-align:top;padding-right:12px;"><table>
          ${r('Permanent Address', addrText(s, 'student_perm'))}
          ${r('Present Address', addrText(s, 'student_pres'))}
        </table></td>
        <td style="width:50%;vertical-align:top;"><table>
          ${r("Guardian's Address", addrText(s, 'guardian_pres'))}
        </table></td>
      </tr>
    </table>
  </div>

  <!-- 6. EDUCATION -->
  ${sectionTitle(6, 'Academic / Education Qualification')}
    <table style="width:100%;">
      <thead>
        <tr style="background:#fef9f6;">
          <th style="padding:4px 6px;text-align:left;font-size:9px;color:#933d18;border-bottom:1.5px solid #933d18;white-space:nowrap;">Qualification</th>
          <th style="padding:4px 6px;text-align:left;font-size:9px;color:#933d18;border-bottom:1.5px solid #933d18;">Institute</th>
          <th style="padding:4px 6px;text-align:left;font-size:9px;color:#933d18;border-bottom:1.5px solid #933d18;">Board / University</th>
          <th style="padding:4px 6px;text-align:left;font-size:9px;color:#933d18;border-bottom:1.5px solid #933d18;white-space:nowrap;">Pass Year</th>
          <th style="padding:4px 6px;text-align:left;font-size:9px;color:#933d18;border-bottom:1.5px solid #933d18;white-space:nowrap;">Obt/Total</th>
          <th style="padding:4px 6px;text-align:left;font-size:9px;color:#933d18;border-bottom:1.5px solid #933d18;">%</th>
        </tr>
      </thead>
      <tbody>${eduRows(s) || `<tr><td colspan="6" style="padding:8px 6px;font-size:9px;color:#aaa;">No education details filled</td></tr>`}</tbody>
    </table>
  </div>

  <!-- 7. DOCUMENTS CHECKLIST -->
  ${sectionTitle(7, 'Documents Submitted')}
    <table>
      <tr>
        ${docCheck('Student Photo', s.photo_url)}
        ${docCheck('Signature', s.signature_url)}
        ${docCheck('Aadhar Card', s.aadhar_url)}
        ${docCheck('Declaration Form', s.declaration_url)}
      </tr>
      <tr>
        ${docCheck('10th Marksheet', s.tenth_marksheet_url)}
        ${docCheck('12th Marksheet', s.twelfth_marksheet_url)}
        ${docCheck('UG Marksheet', s.ug_marksheet_url)}
        ${docCheck('PG Marksheet', s.pg_marksheet_url)}
      </tr>
    </table>
  </div>

  <!-- DECLARATION -->
  <div style="border:1px solid #e5e7eb;border-radius:4px;padding:8px 12px;margin-top:12px;background:#fffdf9;">
    <p style="font-size:9px;color:#555;line-height:1.6;font-style:italic;">
      I, <strong>${v(s.student_name)}</strong>, hereby declare that all information provided is true and correct to the best of my knowledge. I understand that misrepresentation may result in cancellation of my admission. I agree to abide by all rules and regulations of <strong>${UNI_NAME}</strong>.
    </p>
  </div>

  <!-- SIGNATURES -->
  <table style="width:100%;margin-top:14px;">
    <tr>
      <td style="width:33%;text-align:center;padding:0 8px;">
        <div style="height:40px;border-bottom:1px solid #aaa;margin-bottom:3px;"></div>
        <p style="font-size:9px;color:#555;">Signature of Applicant</p>
        <p style="font-size:9px;color:#111;font-weight:700;margin-top:1px;">${v(s.student_name)}</p>
      </td>
      <td style="width:33%;text-align:center;padding:0 8px;">
        <div style="height:40px;border-bottom:1px solid #aaa;margin-bottom:3px;"></div>
        <p style="font-size:9px;color:#555;">Signature of Guardian</p>
        <p style="font-size:9px;color:#111;font-weight:700;margin-top:1px;">${v(s.guardian_name)}</p>
      </td>
      <td style="width:34%;text-align:center;padding:0 8px;">
        <div style="height:40px;border-bottom:1px solid #aaa;margin-bottom:3px;"></div>
        <p style="font-size:9px;color:#555;">Authorized Signatory / Center Stamp</p>
        <p style="font-size:9px;color:#111;font-weight:700;margin-top:1px;">${ctrName}</p>
      </td>
    </tr>
  </table>

  <!-- OFFICE USE ONLY -->
  <div style="border:1.5px dashed #d1d5db;border-radius:4px;padding:8px 12px;margin-top:12px;">
    <p style="font-size:9px;font-weight:700;color:#933d18;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:5px;">For Office Use Only</p>
    <table>
      <tr>
        <td style="padding:3px 8px;font-size:9.5px;color:#555;width:33%;">Admission No: <strong style="color:#933d18;">${v(s.admission_number)}</strong></td>
        <td style="padding:3px 8px;font-size:9.5px;color:#555;width:33%;">Enrollment No: <strong style="color:#059669;">${v(s.enrollment_no)}</strong></td>
        <td style="padding:3px 8px;font-size:9.5px;color:#555;width:34%;">Reg No: <strong>${v(s.enrollment_no ? s.registration_no : '')}</strong></td>
      </tr>
      <tr>
        <td colspan="3" style="padding:3px 8px;font-size:9.5px;color:#555;">
          Status: <strong style="color:${statusColor};">${v(s.status)}</strong>
        </td>
      </tr>
    </table>
  </div>

  <!-- FOOTER -->
  <div style="border-top:2px solid #933d18;margin-top:12px;padding-top:6px;text-align:center;">
    <p style="font-size:8.5px;color:#555;">${UNI_NAME} &nbsp;•&nbsp; ${UNI_ADDRESS}</p>
    <p style="font-size:8.5px;color:#933d18;margin-top:1px;font-weight:600;">${UNI_PHONE} &nbsp;|&nbsp; ${UNI_EMAIL} &nbsp;|&nbsp; ${UNI_WEB}</p>
    <p style="font-size:7.5px;color:#bbb;margin-top:2px;">${UNI_ACT} &nbsp;•&nbsp; Generated: ${formatDate(new Date())}</p>
  </div>

</div>
</body>
</html>`

  const win = window.open('', '_blank', 'width=900,height=720')
  if (!win) { alert('Popup blocked. Please allow popups for this site.'); return }
  win.document.write(html)
  win.document.close()
  win.focus()
}
