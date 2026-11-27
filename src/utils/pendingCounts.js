import { supabase } from '../lib/supabase'

// Work waiting in each department, for the sidebar badges. Counted with the
// same rules the pages' own "Pending" / "To Verify" tabs use, so a badge and
// the tab it points at agree. Only counts are read, never rows, and a login
// sees only what its own access lets it count.
//
// Returns { [path]: { total, parts: [[label, n], …] } } — parts with n > 0.

const count = async (q) => {
  const { count: n, error } = await q
  return error ? 0 : (n || 0)
}
const head = (table) => supabase.from(table).select('id', { count: 'exact', head: true })

export async function fetchPendingCounts(paths) {
  const want = new Set(paths)
  const out = {}
  const put = (path, parts) => {
    const shown = parts.filter(([, n]) => n > 0)
    out[path] = { total: shown.reduce((a, [, n]) => a + n, 0), parts: shown }
  }
  const jobs = []

  if (want.has('/admin/document-department')) {
    jobs.push(Promise.all([
      // Forwarded by the centre, not yet verified.
      count(head('students').eq('status', 'Pending').not('forwarded_at', 'is', null)),
      // Centre / super centre applications not yet verified.
      count(head('centers').or('approval_status.is.null,approval_status.eq.pending')),
    ]).then(([students, centers]) => put('/admin/document-department', [
      ['Students to verify', students], ['Centers to verify', centers],
    ])))
  }

  if (want.has('/admin/account-department')) {
    jobs.push(Promise.all([
      // Verified by the Document Dept, awaiting fee approval.
      count(head('students').eq('status', 'Hold').not('doc_verified_at', 'is', null)),
      count(head('centers').eq('approval_status', 'doc_verified')),
      count(head('recharge_requests').eq('status', 'pending')),
      count(head('re_registrations').eq('status', 'Pending')),
      supabase.from('center_applications').select('status').then(({ data, error }) =>
        error ? 0 : (data || []).filter(a => !/^(approved|rejected)$/i.test(a.status || '')).length),
    ]).then(([students, centers, recharges, reRegs, apps]) => put('/admin/account-department', [
      ['Students to approve', students], ['Centers to approve', centers],
      ['Recharges to verify', recharges], ['Re-registrations', reRegs], ['Center applications', apps],
    ])))
  }

  await Promise.all(jobs)
  return out
}
