const LOGO_URL = 'https://sengolinternationaluniversity.edu.in/images/logo.png'
const UNI_NAME = 'Sengol International University'
const UNI_TAGLINE = 'Educate, Empower, Excel'
const UNI_ADDRESS = 'Lower Pepthang, PO - Lingmoo, District - Namchi, Sikkim - 737134'
const UNI_PHONE = '+91-9205299887'
const UNI_EMAIL = 'info@sengolinternationaluniversity.edu.in'
const UNI_WEB = 'www.sengolinternationaluniversity.edu.in'
const UNI_ACT = 'Established under Act No. 14 of 2025, Sikkim State Legislative Assembly'

function val(v) {
  return v && String(v).trim() ? String(v).trim() : '—'
}

function fmtDate(d) {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) }
  catch { return d }
}

function row(label, value) {
  return `<tr>
    <td style="padding:5px 10px 5px 0;font-size:11px;color:#555;font-weight:600;width:38%;vertical-align:top;white-space:nowrap;">${label}</td>
    <td style="padding:5px 0;font-size:11px;color:#111;vertical-align:top;">: ${val(value)}</td>
  </tr>`
}

function section(title, content) {
  return `<div style="margin-bottom:18px;">
    <div style="background:#933d18;color:#fff;padding:5px 12px;font-size:11px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;border-radius:3px 3px 0 0;">${title}</div>
    <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 3px 3px;padding:10px 12px;">
      ${content}
    </div>
  </div>`
}

function twoCol(leftRows, rightRows) {
  return `<table style="width:100%;border-collapse:collapse;">
    <tr>
      <td style="width:50%;vertical-align:top;padding-right:16px;">
        <table style="width:100%;border-collapse:collapse;">${leftRows.join('')}</table>
      </td>
      <td style="width:50%;vertical-align:top;">
        <table style="width:100%;border-collapse:collapse;">${rightRows.join('')}</table>
      </td>
    </tr>
  </table>`
}

function eduBlock(label, data, prefix) {
  const inst = data[`${prefix}_institute_name`]
  const board = data[`${prefix}_board_university`]
  const year = data[`${prefix}_passing_year`]
  const obt = data[`${prefix}_obtained_marks`]
  const tot = data[`${prefix}_total_marks`]
  if (!inst && !board && !year) return ''
  const pct = obt && tot ? ((parseFloat(obt) / parseFloat(tot)) * 100).toFixed(2) + '%' : '—'
  return `<tr>
    <td style="padding:5px 8px;font-size:11px;font-weight:700;color:#933d18;border-bottom:1px solid #f3f4f6;">${label}</td>
    <td style="padding:5px 8px;font-size:11px;color:#111;border-bottom:1px solid #f3f4f6;">${val(inst)}</td>
    <td style="padding:5px 8px;font-size:11px;color:#555;border-bottom:1px solid #f3f4f6;">${val(board)}</td>
    <td style="padding:5px 8px;font-size:11px;color:#555;border-bottom:1px solid #f3f4f6;">${val(year)}</td>
    <td style="padding:5px 8px;font-size:11px;color:#555;border-bottom:1px solid #f3f4f6;">${obt && tot ? `${obt}/${tot}` : '—'}</td>
    <td style="padding:5px 8px;font-size:11px;font-weight:700;color:#059669;border-bottom:1px solid #f3f4f6;">${pct}</td>
  </tr>`
}

function addrBlock(data, prefix) {
  const parts = [
    data[`${prefix}_village_town`],
    data[`${prefix}_landmark`],
    data[`${prefix}_post_office`] ? `PO: ${data[`${prefix}_post_office`]}` : null,
    data[`${prefix}_city`],
    data[`${prefix}_district`],
    data[`${prefix}_state`],
    data[`${prefix}_pin_code`] ? `PIN: ${data[`${prefix}_pin_code`]}` : null,
  ].filter(Boolean).join(', ')
  return parts || '—'
}

export function generateStudentPDF(student, programName, sessionName, centerName) {
  const s = student

  const statusColor = s.status === 'Approved' ? '#059669'
    : s.status === 'Rejected' ? '#dc2626'
    : s.status === 'Hold' ? '#4f46e5'
    : '#d97706'

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Admission Form - ${s.student_name || 'Student'}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Times New Roman', Times, serif; background: #fff; color: #111; }
    @page {
      size: A4;
      margin: 14mm 12mm 14mm 12mm;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
      .page-break { page-break-before: always; }
    }
    .page { max-width: 780px; margin: 0 auto; padding: 10px 0; }
    table { border-collapse: collapse; }
  </style>
</head>
<body>
<div class="page">

  <!-- PRINT BUTTON -->
  <div class="no-print" style="text-align:center;padding:12px 0 18px;">
    <button onclick="window.print()" style="background:#933d18;color:#fff;border:none;padding:10px 32px;border-radius:6px;font-size:14px;font-weight:700;cursor:pointer;letter-spacing:0.05em;">
      ⬇ Download / Print PDF
    </button>
  </div>

  <!-- HEADER -->
  <div style="border:2.5px solid #933d18;border-radius:6px;overflow:hidden;margin-bottom:16px;">
    <div style="background:#933d18;padding:12px 18px;">
      <table style="width:100%;">
        <tr>
          <td style="width:80px;vertical-align:middle;">
            <img src="${LOGO_URL}" alt="Logo" style="width:70px;height:70px;object-fit:contain;background:#fff;border-radius:50%;padding:4px;" onerror="this.style.display='none'" />
          </td>
          <td style="text-align:center;vertical-align:middle;padding:0 12px;">
            <div style="color:#fff;font-size:22px;font-weight:900;letter-spacing:0.03em;text-transform:uppercase;">${UNI_NAME}</div>
            <div style="color:rgba(255,255,255,0.85);font-size:12px;margin-top:3px;font-style:italic;">${UNI_TAGLINE}</div>
            <div style="color:rgba(255,255,255,0.7);font-size:9.5px;margin-top:4px;">${UNI_ACT}</div>
          </td>
          <td style="width:80px;vertical-align:middle;text-align:right;">
            <img src="${LOGO_URL}" alt="Logo" style="width:70px;height:70px;object-fit:contain;background:#fff;border-radius:50%;padding:4px;" onerror="this.style.display='none'" />
          </td>
        </tr>
      </table>
    </div>
    <div style="background:#fdf6f2;padding:7px 18px;text-align:center;border-top:1px solid #e5e0db;">
      <span style="font-size:10px;color:#555;">${UNI_ADDRESS} &nbsp;|&nbsp; ${UNI_PHONE} &nbsp;|&nbsp; ${UNI_EMAIL} &nbsp;|&nbsp; ${UNI_WEB}</span>
    </div>
  </div>

  <!-- FORM TITLE -->
  <div style="text-align:center;margin-bottom:16px;">
    <div style="display:inline-block;border:2px solid #933d18;border-radius:4px;padding:6px 32px;background:#933d18;">
      <span style="color:#fff;font-size:14px;font-weight:900;letter-spacing:0.12em;text-transform:uppercase;">Student Admission Form</span>
    </div>
  </div>

  <!-- APPLICATION REFERENCE -->
  <div style="border:1px solid #e5e7eb;border-radius:4px;padding:10px 16px;margin-bottom:16px;background:#f9fafb;">
    <table style="width:100%;">
      <tr>
        <td style="font-size:11px;color:#555;">Application Status:
          <span style="font-weight:800;color:${statusColor};margin-left:6px;">${val(s.status)}</span>
        </td>
        <td style="font-size:11px;color:#555;text-align:center;">Form No: <strong style="color:#933d18;">${s.id ? s.id.split('-')[0].toUpperCase() : '—'}</strong></td>
        <td style="font-size:11px;color:#555;text-align:right;">Date of Submission: <strong>${fmtDate(s.date_of_submission)}</strong></td>
      </tr>
      ${s.admission_number ? `<tr><td colspan="3" style="font-size:11px;color:#555;padding-top:5px;">
        Admission Number: <strong style="color:#933d18;font-size:13px;">${s.admission_number}</strong>
        ${s.enrollment_no ? `&nbsp;&nbsp;&nbsp; Enrollment No: <strong style="color:#059669;font-size:13px;">${s.enrollment_no}</strong>` : ''}
      </td></tr>` : ''}
      ${s.remarks ? `<tr><td colspan="3" style="font-size:11px;padding-top:5px;color:${s.status === 'Rejected' ? '#dc2626' : '#555'};">Remarks: <strong>${s.remarks}</strong></td></tr>` : ''}
    </table>
  </div>

  <!-- SECTION 1: COURSE DETAILS -->
  ${section('1. Course / Program Details', twoCol([
    row('University', 'Sengol International University'),
    row('Program Name', programName || s.programme_name),
    row('Department', s.department_name || s.department_id),
    row('Course Code', s.course_code),
    row('Semester / Year', s.semester_year),
  ], [
    row('Session', sessionName || s.session_name),
    row('Academic Year', s.academic_year),
    row('Mode of Study', s.mode_name || s.mode_id),
    row('Entry Type', s.entry_type),
    row('Date of Admission', fmtDate(s.date_of_admission)),
  ]))}

  <!-- SECTION 2: CENTER -->
  ${section('2. Center Information', twoCol([
    row('Center Name', centerName || s.center_name),
    row('Submitted By', s.submitted_by === 'super_center' ? 'Super Center' : s.submitted_by === 'center' ? 'Center' : 'Admin'),
  ], [
    row('Registration No', s.registration_no),
    row('Enrollment No', s.enrollment_no),
  ]))}

  <!-- SECTION 3: PERSONAL INFORMATION -->
  <div style="margin-bottom:18px;">
    <div style="background:#933d18;color:#fff;padding:5px 12px;font-size:11px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;border-radius:3px 3px 0 0;">3. Personal Information</div>
    <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 3px 3px;padding:10px 12px;">
      <table style="width:100%;">
        <tr>
          <td style="width:calc(100% - 110px);vertical-align:top;">
            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="width:50%;vertical-align:top;padding-right:16px;">
                  <table style="width:100%;border-collapse:collapse;">
                    ${row('Full Name', s.student_name)}
                    ${row('Date of Birth', fmtDate(s.date_of_birth))}
                    ${row('Gender', s.gender)}
                    ${row('Profession', s.profession)}
                    ${row('Nationality', s.nationality)}
                    ${row('Mother Tongue', s.mother_tongue)}
                    ${row('Religion', s.religion)}
                    ${row('Caste', s.caste)}
                  </table>
                </td>
                <td style="width:50%;vertical-align:top;">
                  <table style="width:100%;border-collapse:collapse;">
                    ${row('Mobile No', s.mobile_no)}
                    ${row('WhatsApp No', s.whatsapp_no)}
                    ${row('Email Id', s.email)}
                    ${row('Blood Group', s.blood_group)}
                    ${row('Aadhar No', s.aadhar_no)}
                    ${row('PAN No', s.pan_no)}
                    ${row('Physically Handicapped', s.physically_handicapped)}
                    ${row('Scholarship', s.scholarship_applied)}
                  </table>
                </td>
              </tr>
            </table>
            ${row('Identification Marks', s.identification_marks)}
          </td>
          <!-- Photo Box -->
          <td style="width:100px;vertical-align:top;padding-left:12px;">
            ${s.photo_url
              ? `<img src="${s.photo_url}" alt="Photo" style="width:90px;height:110px;object-fit:cover;border:2px solid #e5e7eb;border-radius:4px;" />`
              : `<div style="width:90px;height:110px;border:2px dashed #d1d5db;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:9px;color:#9ca3af;text-align:center;">Paste<br/>Photo<br/>Here</div>`
            }
          </td>
        </tr>
      </table>
    </div>
  </div>

  <!-- SECTION 4: FAMILY INFORMATION -->
  ${section('4. Family Information', twoCol([
    row("Father's Name", s.fathers_name),
    row("Father's Occupation", s.fathers_occupation),
    row("Mother's Name", s.mothers_name),
    row("Mother's Occupation", s.mothers_occupation),
  ], [
    row("Guardian's Name", s.guardian_name),
    row("Guardian's Relation", s.guardian_relation),
    row("Guardian's Occupation", s.guardian_occupation),
    row("Guardian's Mobile", s.guardian_mobile),
  ]))}

  <!-- SECTION 5: ADDRESS -->
  ${section('5. Address Details', `
    <table style="width:100%;border-collapse:collapse;">
      ${row('Permanent Address', addrBlock(s, 'student_perm'))}
      ${row('Present Address', addrBlock(s, 'student_pres'))}
      ${row("Guardian's Address", addrBlock(s, 'guardian_pres'))}
    </table>
  `)}

  <!-- SECTION 6: EDUCATION -->
  ${section('6. Academic / Education Qualification', `
    <table style="width:100%;border-collapse:collapse;font-size:11px;">
      <thead>
        <tr style="background:#fdf6f2;">
          <th style="padding:6px 8px;text-align:left;font-size:10.5px;color:#933d18;border-bottom:2px solid #933d18;">Qualification</th>
          <th style="padding:6px 8px;text-align:left;font-size:10.5px;color:#933d18;border-bottom:2px solid #933d18;">Institute Name</th>
          <th style="padding:6px 8px;text-align:left;font-size:10.5px;color:#933d18;border-bottom:2px solid #933d18;">Board / University</th>
          <th style="padding:6px 8px;text-align:left;font-size:10.5px;color:#933d18;border-bottom:2px solid #933d18;">Passing Year</th>
          <th style="padding:6px 8px;text-align:left;font-size:10.5px;color:#933d18;border-bottom:2px solid #933d18;">Marks (Obt/Total)</th>
          <th style="padding:6px 8px;text-align:left;font-size:10.5px;color:#933d18;border-bottom:2px solid #933d18;">Percentage</th>
        </tr>
      </thead>
      <tbody>
        ${eduBlock('10th / SSC', s, 'tenth')}
        ${eduBlock('12th / HSC', s, 'twelfth')}
        ${eduBlock('Graduation (UG)', s, 'ug')}
        ${eduBlock('Post Graduation (PG)', s, 'pg')}
        ${eduBlock('Diploma', s, 'diploma')}
      </tbody>
    </table>
  `)}

  <!-- SECTION 7: DOCUMENTS CHECKLIST -->
  ${section('7. Documents Submitted', `
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="width:25%;padding:5px 8px;font-size:11px;">
          ${s.photo_url ? '☑' : '☐'} <span style="color:#555;">Student Photo</span>
        </td>
        <td style="width:25%;padding:5px 8px;font-size:11px;">
          ${s.signature_url ? '☑' : '☐'} <span style="color:#555;">Signature</span>
        </td>
        <td style="width:25%;padding:5px 8px;font-size:11px;">
          ${s.aadhar_url ? '☑' : '☐'} <span style="color:#555;">Aadhar Card</span>
        </td>
        <td style="width:25%;padding:5px 8px;font-size:11px;">
          ${s.declaration_url ? '☑' : '☐'} <span style="color:#555;">Declaration Form</span>
        </td>
      </tr>
      <tr>
        <td style="padding:5px 8px;font-size:11px;">
          ${s.tenth_marksheet_url ? '☑' : '☐'} <span style="color:#555;">10th Marksheet</span>
        </td>
        <td style="padding:5px 8px;font-size:11px;">
          ${s.twelfth_marksheet_url ? '☑' : '☐'} <span style="color:#555;">12th Marksheet</span>
        </td>
        <td style="padding:5px 8px;font-size:11px;">
          ${s.ug_marksheet_url ? '☑' : '☐'} <span style="color:#555;">UG Marksheet</span>
        </td>
        <td style="padding:5px 8px;font-size:11px;">
          ${s.pg_marksheet_url ? '☑' : '☐'} <span style="color:#555;">PG Marksheet</span>
        </td>
      </tr>
    </table>
  `)}

  <!-- DECLARATION -->
  <div style="border:1px solid #e5e7eb;border-radius:4px;padding:10px 16px;margin-bottom:18px;background:#fffdf9;">
    <p style="font-size:10.5px;color:#555;line-height:1.6;font-style:italic;">
      I, <strong>${val(s.student_name)}</strong>, hereby declare that the information provided in this form is true, complete and correct to the best of my knowledge and belief. I understand that any misrepresentation or omission of facts may result in rejection of my application or cancellation of my admission. I agree to abide by all rules and regulations of <strong>${UNI_NAME}</strong>.
    </p>
  </div>

  <!-- SIGNATURES -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:18px;">
    <tr>
      <td style="width:30%;text-align:center;padding:0 10px;">
        ${s.signature_url
          ? `<img src="${s.signature_url}" alt="Signature" style="height:50px;max-width:120px;object-fit:contain;margin-bottom:4px;" />`
          : `<div style="height:50px;border-bottom:1px solid #999;margin-bottom:4px;"></div>`
        }
        <p style="font-size:10px;color:#555;">Signature of Applicant</p>
        <p style="font-size:10px;color:#111;font-weight:700;">${val(s.student_name)}</p>
      </td>
      <td style="width:30%;text-align:center;padding:0 10px;">
        <div style="height:50px;border-bottom:1px solid #999;margin-bottom:4px;"></div>
        <p style="font-size:10px;color:#555;">Signature of Guardian</p>
        <p style="font-size:10px;color:#111;font-weight:700;">${val(s.guardian_name)}</p>
      </td>
      <td style="width:40%;text-align:center;padding:0 10px;">
        <div style="height:50px;border-bottom:1px solid #999;margin-bottom:4px;"></div>
        <p style="font-size:10px;color:#555;">Authorized Signatory / Center Stamp</p>
        <p style="font-size:10px;color:#111;font-weight:700;">${centerName || '—'}</p>
      </td>
    </tr>
  </table>

  <!-- OFFICE USE ONLY -->
  <div style="border:1.5px dashed #d1d5db;border-radius:4px;padding:10px 16px;margin-bottom:18px;">
    <p style="font-size:10px;font-weight:700;color:#933d18;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;">For Office Use Only</p>
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="padding:4px 8px;font-size:10.5px;color:#555;width:33%;">Admission No: <strong>${val(s.admission_number)}</strong></td>
        <td style="padding:4px 8px;font-size:10.5px;color:#555;width:33%;">Enrollment No: <strong>${val(s.enrollment_no)}</strong></td>
        <td style="padding:4px 8px;font-size:10.5px;color:#555;width:34%;">Registration No: <strong>${val(s.registration_no)}</strong></td>
      </tr>
      <tr>
        <td colspan="3" style="padding:4px 8px;font-size:10.5px;color:#555;">
          Status: <strong style="color:${statusColor}">${val(s.status)}</strong>
          &nbsp;&nbsp;&nbsp; Doc Verified On: <strong>${fmtDate(s.doc_verified_at)}</strong>
          &nbsp;&nbsp;&nbsp; Account Approved On: <strong>${fmtDate(s.account_approved_at)}</strong>
        </td>
      </tr>
    </table>
  </div>

  <!-- FOOTER -->
  <div style="border-top:2px solid #933d18;padding-top:8px;text-align:center;">
    <p style="font-size:9.5px;color:#555;">${UNI_NAME} &nbsp;•&nbsp; ${UNI_ADDRESS}</p>
    <p style="font-size:9.5px;color:#933d18;margin-top:2px;font-weight:600;">${UNI_PHONE} &nbsp;|&nbsp; ${UNI_EMAIL} &nbsp;|&nbsp; ${UNI_WEB}</p>
    <p style="font-size:8.5px;color:#aaa;margin-top:3px;">${UNI_ACT} &nbsp;•&nbsp; Generated on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
  </div>

</div>
</body>
</html>`

  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) { alert('Popup blocked. Please allow popups for this site.'); return }
  win.document.write(html)
  win.document.close()
  win.focus()
}
