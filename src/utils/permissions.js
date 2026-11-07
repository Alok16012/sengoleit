// Every permission a custom staff role can be given, grouped by module as the
// admin sees them in User Management → Roles. The keys are also what the
// database checks (has_perm / perm_table_access in add_user_management.sql),
// so a key here and there must match exactly.
//
// Each module has a `.view` key — that one opens the page; the others are the
// things that can be done on it. `path` is the page the module lives on.

export const PERMISSION_GROUPS = [
  { key: 'dashboard', label: 'Dashboard', path: '/dashboard', perms: [
    ['dashboard.view', 'View dashboard'],
  ] },
  { key: 'location', label: 'Location', path: '/admin/location', perms: [
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
  { key: 'students', label: 'Students', path: '/admin/students', perms: [
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
  { key: 'document_dept', label: 'Document Dept.', path: '/admin/document-department', perms: [
    ['document_dept.view', 'View pending / hold / rejected'],
    ['document_dept.view_done', 'View approved / forwarded'],
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
  { key: 'account_dept', label: 'Account Dept.', path: '/admin/account-department', perms: [
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
  { key: 'research_dept', label: 'Research Dept.', path: '/admin/research-department', perms: [
    ['research_dept.view', 'View research department'],
    ['research_dept.manage', 'Issue letters / forward Ph.D students'],
  ] },
  { key: 'wallet_summary', label: 'Wallet Summary', path: '/admin/wallet-summary', perms: [
    ['wallet_summary.view', 'View wallet summary'],
  ] },
  { key: 'coupons', label: 'Coupon Management', path: '/admin/coupons', perms: [
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
  { key: 'exam_section', label: 'Exam Section', path: '/admin/exam-section', perms: [
    ['exam_section.view', 'View exam section'],
    ['exam_section.admit_cards', 'Issue admit cards / hall tickets'],
    ['exam_section.results', 'Enter marks and declare results'],
    ['exam_section.print', 'Print marksheets and certificates'],
    ['exam_section.calendar', 'Examination calendar'],
  ] },
  { key: 'syllabus', label: 'Syllabus', path: '/admin/syllabus', perms: [
    ['syllabus.view', 'View syllabus'],
    ['syllabus.manage', 'Add, edit syllabus'],
  ] },
  { key: 'ebooks', label: 'E-Books', path: '/admin/ebooks', perms: [
    ['ebooks.view', 'View e-books'],
    ['ebooks.manage', 'Upload / delete e-books'],
  ] },
  { key: 'users', label: 'User Management', path: '/admin/users', perms: [
    ['users.manage', 'Manage roles and staff logins'],
  ] },
]

export const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap(g => g.perms.map(([k]) => k))

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
