// Every permission a custom staff role can be given, grouped by module as the
// admin sees them in User Management → Roles. The keys are also what the
// database checks (has_perm / perm_table_access in add_user_management.sql),
// so a key here and there must match exactly.
//
// Each module has a `.view` key — that one opens the page; the others are the
// things that can be done on it. `path` is the page the module lives on, and
// `tabs` the tabs inside that page a role can be given one by one.

export const PERMISSION_GROUPS = [
  { key: 'dashboard', label: 'Dashboard', path: '/dashboard', perms: [
    ['dashboard.view', 'View dashboard'],
  ] },
  { key: 'location', label: 'Location', path: '/admin/location', tabs: [['states','States'],['districts','Districts'],['countries','Countries']], perms: [
    ['location.view', 'View countries / states / districts'],
    ['location.manage', 'Add, edit, delete locations'],
  ] },
  { key: 'universities', label: 'Universities', path: '/admin/universities', perms: [
    ['universities.view', 'View universities'],
    ['universities.manage', 'Add, edit, delete universities'],
  ] },
  { key: 'sessions', label: 'Sessions', path: '/admin/sessions', perms: [
    ['sessions.view', 'View sessions'],
    ['sessions.manage', 'Add, edit, delete sessions'],
  ] },
  { key: 'departments', label: 'Departments', path: '/admin/departments', perms: [
    ['departments.view', 'View departments'],
    ['departments.manage', 'Add, edit, delete departments'],
  ] },
  { key: 'programs', label: 'Programs', path: '/admin/programs', perms: [
    ['programs.view', 'View programs'],
    ['programs.manage', 'Add, edit, delete programs'],
  ] },
  { key: 'boards', label: 'Boards & Univ.', path: '/admin/boards', perms: [
    ['boards.view', 'View boards'],
    ['boards.manage', 'Add, edit, delete boards'],
  ] },
  { key: 'schemes', label: 'Schemes', path: '/admin/schemes', perms: [
    ['schemes.view', 'View schemes'],
    ['schemes.manage', 'Add, edit, delete schemes and papers'],
  ] },
  { key: 'super_centers', label: 'Super Centers', path: '/admin/super-centers', perms: [
    ['super_centers.view', 'View super centers'],
    ['super_centers.add', 'Add super center'],
    ['super_centers.edit', 'Edit super center'],
    ['super_centers.delete', 'Delete super center'],
    ['super_centers.status', 'Activate / deactivate'],
  ] },
  { key: 'centers', label: 'Centers', path: '/admin/centers', perms: [
    ['centers.view', 'View centers'],
    ['centers.add', 'Add center'],
    ['centers.edit', 'Edit center (incl. sharing / commission)'],
    ['centers.delete', 'Delete center'],
    ['centers.status', 'Activate / deactivate'],
  ] },
  { key: 'students', label: 'Students', path: '/admin/students', tabs: [['all','All'],['pending','Pending'],['hold','Hold'],['approved','Approved'],['rejected','Rejected'],['rr','RR (Re-Registration)']], perms: [
    ['students.view', 'View students'],
    ['students.add', 'Add student'],
    ['students.edit', 'Edit student'],
    ['students.delete', 'Delete student'],
    ['students.hide', 'Hide / unhide student'],
    ['students.export', 'Export Excel / PDF'],
    ['students.documents', 'Download forms and documents'],
    ['students.credentials', 'View / change student login'],
    ['students.re_register', 'Raise re-registration'],
  ] },
  { key: 'document_dept', label: 'Document Dept.', path: '/admin/document-department', tabs: [['students','Student Applications'],['centers','Center Applications'],['super_centers','Super Center Applications'],['pending','Pending'],['hold','Hold'],['forwarded','Forwarded (centers)'],['approved','Approved'],['rejected','Rejected']], perms: [
    ['document_dept.view', 'View document department'],
    ['document_dept.verify', 'Verify and forward students'],
    ['document_dept.hold', 'Put on hold / ask for correction'],
    ['document_dept.reject', 'Reject students'],
    ['document_dept.centers', 'Verify center / super center applications'],
  ] },
  { key: 'courier', label: 'Courier Details', path: '/admin/courier-details', perms: [
    ['courier.view', 'View couriers'],
    ['courier.add', 'Add courier'],
    ['courier.edit', 'Edit courier'],
    ['courier.delete', 'Delete courier'],
  ] },
  { key: 'account_dept', label: 'Account Dept.', path: '/admin/account-department', tabs: [
    ['students', 'Student Applications', [['pending', 'To Verify'], ['approved', 'Approved'], ['rejected', 'Rejected']]],
    ['approvals', 'Center Applications', [['pending', 'To Verify'], ['hold', 'Hold'], ['approved', 'Approved'], ['rejected', 'Rejected']]],
    ['center_apps', 'Sub-Center Applications'],
    ['super_approvals', 'Super Center Applications', [['pending', 'To Verify'], ['hold', 'Hold'], ['approved', 'Approved'], ['rejected', 'Rejected']]],
    ['recharges', 'Recharge Requests', [['pending', 'To Verify'], ['hold', 'Hold'], ['approved', 'Approved'], ['rejected', 'Rejected']]],
    ['re_registrations', 'Re-Registrations', [['pending', 'To Verify'], ['decided', 'Decided']]],
    ['approval_codes', 'Approval Code Requests', [['all', 'All'], ['used', 'Used'], ['approved', 'Approved'], ['pending', 'To Verify'], ['rejected', 'Reject'], ['hold', 'Hold']]],
  ], perms: [
    ['account_dept.view', 'View account department'],
    ['account_dept.students', 'Approve / reject student fee'],
    ['account_dept.recharge_verify', 'Verify / reject recharge requests'],
    ['account_dept.recharge_edit', 'Add / edit recharge'],
    ['account_dept.recharge_delete', 'Delete recharge'],
    ['account_dept.re_registration', 'Approve / reject re-registration'],
    ['account_dept.centers', 'Approve center applications (accounts)'],
    ['account_dept.approval_codes', 'Verify approval-code payments'],
  ] },
  { key: 'payment_summary', label: 'Payment Summary', path: '/admin/payment-summary', perms: [
    ['payment_summary.view', 'View payment summary'],
  ] },
  { key: 'research_dept', label: 'Research Dept.', path: '/admin/research-department', tabs: [['master','Master Panel'],['letters','Candidates'],['exam','Forward to Exam']], perms: [
    ['research_dept.view', 'View research department'],
    ['research_dept.manage', 'Issue letters / forward Ph.D students'],
  ] },
  { key: 'wallet_summary', label: 'Wallet Summary', path: '/admin/wallet-summary', tabs: [['balances','Center Balances'],['recharges','Recharge History'],['online','Student Online Payments']], perms: [
    ['wallet_summary.view', 'View wallet summary'],
  ] },
  { key: 'coupons', label: 'Coupon Management', path: '/admin/coupons', tabs: [['all','All Coupons'],['approval','Approval Codes'],['discount','Discounted Coupons'],['course','Course Coupons'],['pending','Pending'],['wallet','Coupon Wallet'],['commission','Commission Wallet']], perms: [
    ['coupons.view', 'View coupons'],
    ['coupons.generate', 'Generate coupons / approval codes'],
    ['coupons.edit', 'Edit coupon amount'],
    ['coupons.delete', 'Delete coupons'],
    ['coupons.toggle', 'Activate / deactivate'],
    ['coupons.commission', 'Commission wallet and payouts'],
  ] },
  { key: 'fee_management', label: 'Fee Management', path: '/admin/fee-management', perms: [
    ['fee_management.view', 'View fees'],
    ['fee_management.manage', 'Add, edit fees and allot courses to centers'],
  ] },
  { key: 'center_pricing', label: 'Center Pricing', path: '/admin/center-pricing', perms: [
    ['center_pricing.view', 'View center pricing'],
    ['center_pricing.manage', 'Change center pricing'],
  ] },
  { key: 'exam_section', label: 'Exam Section', path: '/admin/exam-section', tabs: [['list','Student List'],['schedule','Date Sheet'],['calendar','Examination Calendar'],['result','Result'],['print','Print']], perms: [
    ['exam_section.view', 'View exam section'],
    ['exam_section.admit_cards', 'Issue admit cards / hall tickets'],
    ['exam_section.results', 'Enter marks and declare results'],
    ['exam_section.print', 'Print marksheets and certificates'],
    ['exam_section.calendar', 'Examination calendar'],
  ] },
  { key: 'syllabus', label: 'Syllabus', path: '/admin/syllabus', tabs: [['pending','Pending'],['done','Done'],['all','All']], perms: [
    ['syllabus.view', 'View syllabus'],
    ['syllabus.manage', 'Add, edit syllabus'],
  ] },
  { key: 'ebooks', label: 'E-Books', path: '/admin/ebooks', perms: [
    ['ebooks.view', 'View e-books'],
    ['ebooks.manage', 'Upload / delete e-books'],
  ] },
  { key: 'users', label: 'User Management', path: '/admin/users', tabs: [['roles','Roles'],['users','Users']], perms: [
    ['users.manage', 'Manage roles and staff logins'],
  ] },
]

// A module's tabs are permissions too: '<module>.tab.<tab>', and a tab's own
// inner tabs '<module>.tab.<tab>.<sub>' (Account Dept → Student Applications
// → To Verify). Ticking one shows it; a role with none of a set ticked sees
// that whole set (so roles made before tabs could be chosen keep working).
// A tab entry is [key, label] or [key, label, [[subKey, subLabel], …]].
export const tabPerm = (moduleKey, tab, sub) => `${moduleKey}.tab.${tab}${sub ? `.${sub}` : ''}`
export const subTabPerms = (moduleKey, tabEntry) => (tabEntry[2] || []).map(([s]) => tabPerm(moduleKey, tabEntry[0], s))
export const groupTabPerms = g => (g.tabs || []).flatMap(t => [tabPerm(g.key, t[0]), ...subTabPerms(g.key, t)])

export const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap(g => [...g.perms.map(([k]) => k), ...groupTabPerms(g)])

// The module a path belongs to — for sending a staff login only where it may go.
export function moduleForPath(pathname) {
  const p = String(pathname || '')
  // Longest match first, so /admin/centers does not also claim /admin/center-pricing.
  const sorted = [...PERMISSION_GROUPS].sort((a, b) => b.path.length - a.path.length)
  return sorted.find(g => p === g.path || p.startsWith(g.path + '/')) || null
}

// The first page a staff login may open.
export function firstAllowedPath(can) {
  const g = PERMISSION_GROUPS.find(m => can(`${m.key}.view`) || (m.key === 'users' && can('users.manage')))
  return g ? g.path : null
}
