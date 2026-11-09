import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import PageHeader from '../../components/ui/PageHeader'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import { Table, Thead, Tbody, Th, Td, Tr } from '../../components/ui/Table'
import { Plus, Pencil, Trash2, KeyRound, Power, PowerOff, Shield, Users, Search, Eye, EyeOff, Copy, RefreshCw, CheckCircle } from 'lucide-react'
import { PERMISSION_GROUPS, ALL_PERMISSIONS, tabPerm, subTabPerms, groupTabPerms } from '../../utils/permissions'
import { formatDateTime } from '../../utils/formatDate'

// User Management — custom roles (a name and a ticked list of permissions)
// and the staff logins that hold them. Permissions are enforced by the
// database too (add_user_management.sql); logins are created and changed
// through the admin-users Edge Function, since that needs the service key.

const inputCls = 'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#933d18]/20 focus:border-[#933d18]'
const labelCls = 'block text-[11px] font-semibold text-gray-500 mb-1'

// A readable random password (no 0/O, 1/l/I) for the admin to hand over.
function makePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const a = new Uint32Array(10)
  crypto.getRandomValues(a)
  return Array.from(a, n => chars[n % chars.length]).join('')
}

// The Edge Function's own error message, not supabase-js's generic one.
async function callUsersFn(body) {
  const { data, error } = await supabase.functions.invoke('admin-users', { body })
  if (error) {
    let msg = error.message
    try { const j = await error.context?.json?.(); if (j?.error) msg = j.error } catch { /* not JSON */ }
    if (/Failed to send|not found|404/i.test(msg)) msg = 'The admin-users function is not deployed yet.'
    throw new Error(msg)
  }
  if (data?.error) throw new Error(data.error)
  return data
}

export default function UserManagement() {
  const { user, mayTab } = useAuth()
  const [tab, setTab] = useState(() => mayTab('users', 'roles') ? 'roles' : 'users')
  const [roles, setRoles] = useState([])
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  // Role editor
  const [roleModal, setRoleModal] = useState(null)   // null | { id?, name, description, permissions: Set }
  const [roleQ, setRoleQ] = useState('')
  const [savingRole, setSavingRole] = useState(false)

  // User editor
  const [userModal, setUserModal] = useState(null)   // null | { full_name, email, password, app_role_id }
  const [pwModal, setPwModal] = useState(null)       // null | { user, password, done? }
  const [editModal, setEditModal] = useState(null)   // null | { user, full_name, email }
  const [copied, setCopied] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true); setLoadError('')
    const [r, u] = await Promise.all([
      supabase.from('app_roles').select('*').order('name'),
      supabase.rpc('list_staff_users'),
    ])
    if (r.error || u.error) {
      const e = r.error || u.error
      setLoadError(/app_roles|list_staff_users|schema cache|PGRST20/i.test(e.message)
        ? 'User Management needs a database update — run add_user_management.sql in Supabase.'
        : e.message)
    }
    setRoles(r.data || [])
    setStaff(u.data || [])
    setLoading(false)
  }

  const roleById = useMemo(() => Object.fromEntries(roles.map(r => [r.id, r])), [roles])
  const usersPerRole = useMemo(() => {
    const m = {}
    staff.forEach(s => { if (s.app_role_id) m[s.app_role_id] = (m[s.app_role_id] || 0) + 1 })
    return m
  }, [staff])

  // ── Roles ──────────────────────────────────────────────────────────────────
  function openRole(r) {
    setRoleQ('')
    setRoleModal(r
      ? { id: r.id, name: r.name, description: r.description || '', permissions: new Set(r.permissions || []) }
      : { name: '', description: '', permissions: new Set() })
  }

  // Everything a module can be given: its permissions and its tabs.
  const groupKeys = g => [...g.perms.map(([k]) => k), ...groupTabPerms(g)]

  // Ticking anything in a module ticks its View too — every other permission
  // in a module is useless without the page. Ticking View (on its own) ticks
  // all the page's tabs, so the page opens whole; untick the ones not wanted.
  function togglePerm(group, key) {
    setRoleModal(m => {
      const next = new Set(m.permissions)
      const view = `${group.key}.view`
      const hasView = group.perms.some(([k]) => k === view)
      // The tab an inner tab belongs to ('…tab.students' for '…tab.students.pending').
      const tabPrefix = `${group.key}.tab.`
      const rest = key.startsWith(tabPrefix) ? key.slice(tabPrefix.length) : ''
      const parentTab = rest.includes('.') ? tabPrefix + rest.split('.')[0] : null
      if (next.has(key)) {
        next.delete(key)
        // Unticking View unticks the whole module; unticking a tab its inner tabs.
        if (key === view) groupKeys(group).forEach(k => next.delete(k))
        else if (rest && !parentTab) [...next].forEach(k => { if (k.startsWith(key + '.')) next.delete(k) })
      } else {
        if (hasView && !next.has(view)) groupTabPerms(group).forEach(k => next.add(k))
        next.add(key)
        if (parentTab) next.add(parentTab)
        // A tab ticked on its own opens with all its inner tabs.
        if (rest && !parentTab) {
          const entry = (group.tabs || []).find(t => t[0] === rest)
          if (entry) subTabPerms(group.key, entry).forEach(k => next.add(k))
        }
        if (hasView) next.add(view)
      }
      return { ...m, permissions: next }
    })
  }

  function toggleGroup(group) {
    setRoleModal(m => {
      const next = new Set(m.permissions)
      const keys = groupKeys(group)
      const all = keys.every(k => next.has(k))
      keys.forEach(k => all ? next.delete(k) : next.add(k))
      return { ...m, permissions: next }
    })
  }

  function toggleEverything() {
    setRoleModal(m => ({
      ...m,
      permissions: m.permissions.size === ALL_PERMISSIONS.length ? new Set() : new Set(ALL_PERMISSIONS),
    }))
  }

  async function saveRole() {
    const name = roleModal.name.trim()
    if (!name) return alert('Give the role a name.')
    if (roleModal.permissions.size === 0) return alert('Tick at least one permission.')
    setSavingRole(true)
    const row = {
      name, description: roleModal.description.trim() || null,
      permissions: ALL_PERMISSIONS.filter(k => roleModal.permissions.has(k)),
      updated_at: new Date().toISOString(),
    }
    const { error } = roleModal.id
      ? await supabase.from('app_roles').update(row).eq('id', roleModal.id)
      : await supabase.from('app_roles').insert(row)
    setSavingRole(false)
    if (error) return alert(/duplicate|unique/i.test(error.message) ? 'A role with this name already exists.' : 'Could not save: ' + error.message)
    setRoleModal(null)
    load()
  }

  async function deleteRole(r) {
    // A role still held by logins can be deleted too — they are left with no
    // role (app_role_id goes to null), which signs them into "No access" until
    // they are given another one. Say who that is before doing it.
    const holders = staff.filter(s => s.app_role_id === r.id)
    const msg = holders.length
      ? `Delete the role "${r.name}"?\n\n${holders.length} login(s) have this role and will have NO access until you give them another role:\n` +
        holders.map(s => `• ${s.full_name ? s.full_name + ' — ' : ''}${s.email}`).join('\n')
      : `Delete the role "${r.name}"?`
    if (!confirm(msg)) return
    const { error } = await supabase.from('app_roles').delete().eq('id', r.id)
    if (error) return alert('Could not delete: ' + error.message)
    load()
  }

  // ── Users ──────────────────────────────────────────────────────────────────
  async function createUser() {
    const f = userModal
    if (!f.full_name.trim()) return alert('Enter the name.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return alert('Enter a valid e-mail.')
    if (f.password.length < 8) return alert('The password must be at least 8 characters.')
    if (!f.app_role_id) return alert('Choose a role.')
    setBusy(true)
    try {
      await callUsersFn({ action: 'create', email: f.email.trim(), password: f.password, full_name: f.full_name.trim(), app_role_id: f.app_role_id })
      setUserModal(null); setShowPw(false)
      load()
    } catch (e) { alert('Could not create the login: ' + e.message) }
    setBusy(false)
  }

  async function changeRole(s, roleId) {
    const { error } = await supabase.from('profiles').update({ app_role_id: roleId || null }).eq('id', s.id)
    if (error) return alert('Could not change the role: ' + error.message)
    setStaff(list => list.map(x => x.id === s.id ? { ...x, app_role_id: roleId || null } : x))
  }

  async function setPassword() {
    if (pwModal.password.length < 8) return alert('The password must be at least 8 characters.')
    setBusy(true)
    try {
      await callUsersFn({ action: 'set_password', user_id: pwModal.user.id, password: pwModal.password })
      setPwModal(m => ({ ...m, done: true }))
    } catch (e) { alert('Could not change the password: ' + e.message) }
    setBusy(false)
  }

  async function copyPassword() {
    try { await navigator.clipboard.writeText(pwModal.password); setCopied(true); setTimeout(() => setCopied(false), 1500) }
    catch { alert('Could not copy — select the password and copy it.') }
  }

  async function saveUser() {
    const f = editModal
    if (!f.full_name.trim()) return alert('Enter the name.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return alert('Enter a valid e-mail.')
    setBusy(true)
    try {
      await callUsersFn({ action: 'update', user_id: f.user.id, email: f.email.trim(), full_name: f.full_name.trim() })
      setStaff(list => list.map(x => x.id === f.user.id ? { ...x, email: f.email.trim().toLowerCase(), full_name: f.full_name.trim() } : x))
      setEditModal(null)
    } catch (e) { alert('Could not save the login: ' + e.message) }
    setBusy(false)
  }

  async function deleteUser(s) {
    if (!confirm(`Delete the login ${s.email}${s.full_name ? ` (${s.full_name})` : ''}?\n\nThey will not be able to sign in again. This cannot be undone.`)) return
    setBusy(true)
    try {
      await callUsersFn({ action: 'delete', user_id: s.id })
      setStaff(list => list.filter(x => x.id !== s.id))
    } catch (e) { alert('Could not delete the login: ' + e.message) }
    setBusy(false)
  }

  async function toggleActive(s) {
    const next = !s.is_active
    if (!confirm(next ? `Switch ${s.email} back on?` : `Switch off ${s.email}? They will not be able to sign in.`)) return
    setBusy(true)
    try {
      await callUsersFn({ action: 'set_active', user_id: s.id, active: next })
      setStaff(list => list.map(x => x.id === s.id ? { ...x, is_active: next } : x))
    } catch (e) { alert('Could not change the login: ' + e.message) }
    setBusy(false)
  }

  const groupsShown = PERMISSION_GROUPS.filter(g => !roleQ.trim()
    || `${g.label} ${g.perms.map(([, l]) => l).join(' ')}`.toLowerCase().includes(roleQ.toLowerCase()))

  return (
    <div className="p-6 space-y-5">
      <PageHeader title="User Management" subtitle="Roles with ticked permissions, and the staff logins that hold them"
        actions={tab === 'roles'
          ? <Button onClick={() => openRole(null)}><Plus size={15} /> New Role</Button>
          : <Button onClick={() => { setShowPw(false); setUserModal({ full_name: '', email: '', password: '', app_role_id: roles[0]?.id || '' }) }} disabled={!roles.length}><Plus size={15} /> New User</Button>} />

      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</div>
      )}

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {[['roles', 'Roles', Shield], ['users', 'Users', Users]].filter(([k]) => mayTab('users', k)).map(([k, label, Icon]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === k ? 'bg-white text-[#933d18] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <Icon size={15} /> {label}
            <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-600">{k === 'roles' ? roles.length : staff.length}</span>
          </button>
        ))}
      </div>

      {tab === 'roles' ? (
        <Table>
          <Thead><Tr><Th>#</Th><Th>Role</Th><Th>Permissions</Th><Th>Users</Th><Th>Actions</Th></Tr></Thead>
          <Tbody>
            {loading ? <Tr><Td colSpan={5} className="text-center text-gray-400 py-8">Loading…</Td></Tr>
            : roles.length === 0 ? <Tr><Td colSpan={5} className="text-center text-gray-400 py-8">No roles yet — click "New Role".</Td></Tr>
            : roles.map((r, i) => {
              const mods = PERMISSION_GROUPS.filter(g => g.perms.some(([k]) => (r.permissions || []).includes(k)))
              return (
                <Tr key={r.id}>
                  <Td className="text-gray-400 text-xs">{i + 1}</Td>
                  <Td>
                    <p className="font-semibold text-gray-900">{r.name}</p>
                    {r.description && <p className="text-xs text-gray-400">{r.description}</p>}
                  </Td>
                  <Td className="text-xs text-gray-600 max-w-md">
                    <span className="font-semibold text-gray-800">{(r.permissions || []).length}</span> permissions ·{' '}
                    {mods.map(g => g.label).join(', ') || '—'}
                  </Td>
                  <Td className="text-sm">{usersPerRole[r.id] || 0}</Td>
                  <Td>
                    <div className="flex gap-1">
                      <button onClick={() => openRole(r)} title="Edit" className="p-1.5 rounded-lg hover:bg-[#933d18]/10 text-gray-400 hover:text-[#933d18]"><Pencil size={15} /></button>
                      <button onClick={() => deleteRole(r)} title="Delete" className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500"><Trash2 size={15} /></button>
                    </div>
                  </Td>
                </Tr>
              )
            })}
          </Tbody>
        </Table>
      ) : (
        <Table>
          <Thead><Tr><Th>#</Th><Th>Name</Th><Th>E-mail</Th><Th>Role</Th><Th>Status</Th><Th>Last Sign-in</Th><Th>Actions</Th></Tr></Thead>
          <Tbody>
            {loading ? <Tr><Td colSpan={7} className="text-center text-gray-400 py-8">Loading…</Td></Tr>
            : staff.length === 0 ? <Tr><Td colSpan={7} className="text-center text-gray-400 py-8">No staff logins yet — click "New User".</Td></Tr>
            : staff.map((s, i) => (
              <Tr key={s.id}>
                <Td className="text-gray-400 text-xs">{i + 1}</Td>
                <Td className="font-semibold text-gray-900">{s.full_name || '—'}</Td>
                <Td className="text-sm text-gray-600">{s.email}</Td>
                <Td>
                  <select value={s.app_role_id || ''} onChange={e => changeRole(s, e.target.value)}
                    className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-[#933d18]">
                    <option value="">— No role —</option>
                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </Td>
                <Td>
                  {s.is_active
                    ? <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">● Active</span>
                    : <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-gray-100 text-gray-500">● Off</span>}
                </Td>
                <Td className="text-xs text-gray-500">{s.last_sign_in_at ? formatDateTime(s.last_sign_in_at) : 'Never'}</Td>
                <Td>
                  <div className="flex gap-1">
                    <button onClick={() => setEditModal({ user: s, full_name: s.full_name || '', email: s.email || '' })} title="Edit name / e-mail" disabled={busy}
                      className="p-1.5 rounded-lg hover:bg-[#933d18]/10 text-gray-400 hover:text-[#933d18]"><Pencil size={15} /></button>
                    <button onClick={() => { setShowPw(true); setCopied(false); setPwModal({ user: s, password: makePassword() }) }} title="Set new password" disabled={busy}
                      className="p-1.5 rounded-lg hover:bg-[#933d18]/10 text-gray-400 hover:text-[#933d18]"><KeyRound size={15} /></button>
                    {s.id !== user?.id && (
                      <button onClick={() => toggleActive(s)} title={s.is_active ? 'Switch off' : 'Switch on'} disabled={busy}
                        className={`p-1.5 rounded-lg ${s.is_active ? 'hover:bg-red-50 text-gray-300 hover:text-red-500' : 'hover:bg-emerald-50 text-gray-300 hover:text-emerald-600'}`}>
                        {s.is_active ? <PowerOff size={15} /> : <Power size={15} />}
                      </button>
                    )}
                    {s.id !== user?.id && (
                      <button onClick={() => deleteUser(s)} title="Delete login" disabled={busy}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      {/* Role editor */}
      <Modal isOpen={!!roleModal} onClose={() => !savingRole && setRoleModal(null)} title={roleModal?.id ? 'Edit Role' : 'New Role'} size="xl">
        {roleModal && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Role Name</label>
                <input value={roleModal.name} onChange={e => setRoleModal(m => ({ ...m, name: e.target.value }))} className={inputCls} placeholder="e.g. Accounts Staff" />
              </div>
              <div>
                <label className={labelCls}>Description (optional)</label>
                <input value={roleModal.description} onChange={e => setRoleModal(m => ({ ...m, description: e.target.value }))} className={inputCls} placeholder="What this role is for" />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={roleQ} onChange={e => setRoleQ(e.target.value)} placeholder="Find a module or permission…"
                  className="pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm w-72 focus:outline-none focus:border-[#933d18]" />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">{roleModal.permissions.size} of {ALL_PERMISSIONS.length} ticked</span>
                <Button variant="outline" size="sm" onClick={toggleEverything}>
                  {roleModal.permissions.size === ALL_PERMISSIONS.length ? 'Clear all' : 'Select all'}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[55vh] overflow-y-auto pr-1">
              {groupsShown.map(g => {
                const keys = groupKeys(g)
                const ticked = keys.filter(k => roleModal.permissions.has(k)).length
                const all = ticked === keys.length
                return (
                  <div key={g.key} className={`border rounded-xl p-3 ${ticked ? 'border-[#933d18]/30 bg-[#933d18]/[0.03]' : 'border-gray-200'}`}>
                    <label className="flex items-center justify-between gap-2 cursor-pointer select-none mb-2">
                      <span className="flex items-center gap-2 font-bold text-sm text-gray-900">
                        <input type="checkbox" checked={all} ref={el => { if (el) el.indeterminate = ticked > 0 && !all }}
                          onChange={() => toggleGroup(g)} className="w-4 h-4 accent-[#933d18]" />
                        {g.label}
                      </span>
                      <span className="text-[11px] text-gray-400">{ticked}/{keys.length}</span>
                    </label>
                    <div className="space-y-1.5 pl-6">
                      {g.perms.map(([k, label]) => (
                        <label key={k} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                          <input type="checkbox" checked={roleModal.permissions.has(k)} onChange={() => togglePerm(g, k)}
                            className="w-3.5 h-3.5 accent-[#933d18]" />
                          {label}
                        </label>
                      ))}
                    </div>
                    {g.tabs?.length > 0 && (
                      <div className="mt-2.5 pt-2 border-t border-gray-100 pl-6">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Tabs on this page</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                          {g.tabs.map(([t, label, subs]) => {
                            const k = tabPerm(g.key, t)
                            return (
                              <div key={k} className={subs?.length ? 'basis-full' : ''}>
                                <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
                                  <input type="checkbox" checked={roleModal.permissions.has(k)} onChange={() => togglePerm(g, k)}
                                    className="w-3.5 h-3.5 accent-[#933d18]" />
                                  <span className={subs?.length ? 'font-semibold text-gray-700' : ''}>{label}</span>
                                </label>
                                {subs?.length > 0 && (
                                  <div className="flex flex-wrap gap-x-3 gap-y-1 pl-5 mt-1">
                                    {subs.map(([sk, sl]) => {
                                      const kk = tabPerm(g.key, t, sk)
                                      return (
                                        <label key={kk} className="flex items-center gap-1 text-[11px] text-gray-500 cursor-pointer select-none">
                                          <input type="checkbox" checked={roleModal.permissions.has(kk)} onChange={() => togglePerm(g, kk)}
                                            className="w-3 h-3 accent-[#933d18]" />
                                          {sl}
                                        </label>
                                      )
                                    })}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <p className="text-[11px] text-gray-400">
              Ticking anything in a module also ticks its "View", and ticking "View" ticks all of that page's tabs — untick the tabs not wanted.
              If no tab of a page is ticked, every tab of it shows.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setRoleModal(null)} disabled={savingRole}>Cancel</Button>
              <Button onClick={saveRole} disabled={savingRole}>{savingRole ? 'Saving…' : 'Save Role'}</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* New user */}
      <Modal isOpen={!!userModal} onClose={() => !busy && setUserModal(null)} title="New Staff Login" size="md">
        {userModal && (
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Name</label>
              <input value={userModal.full_name} onChange={e => setUserModal(m => ({ ...m, full_name: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>E-mail (used to sign in)</label>
              <input type="email" value={userModal.email} onChange={e => setUserModal(m => ({ ...m, email: e.target.value }))} className={inputCls} autoComplete="off" />
            </div>
            <div>
              <label className={labelCls}>Password (at least 8 characters)</label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} value={userModal.password} onChange={e => setUserModal(m => ({ ...m, password: e.target.value }))}
                  className={`${inputCls} pr-10`} autoComplete="new-password" />
                <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700">
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <div>
              <label className={labelCls}>Role</label>
              <select value={userModal.app_role_id} onChange={e => setUserModal(m => ({ ...m, app_role_id: e.target.value }))} className={`${inputCls} bg-white`}>
                <option value="">— Choose —</option>
                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              {userModal.app_role_id && roleById[userModal.app_role_id] && (
                <p className="text-[11px] text-gray-400 mt-1">{(roleById[userModal.app_role_id].permissions || []).length} permissions</p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setUserModal(null)} disabled={busy}>Cancel</Button>
              <Button onClick={createUser} disabled={busy}>{busy ? 'Creating…' : 'Create Login'}</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit name / e-mail */}
      <Modal isOpen={!!editModal} onClose={() => !busy && setEditModal(null)} title="Edit Staff Login" size="sm" allowMaximize={false}>
        {editModal && (
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Name</label>
              <input value={editModal.full_name} onChange={e => setEditModal(m => ({ ...m, full_name: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>E-mail (used to sign in)</label>
              <input type="email" value={editModal.email} onChange={e => setEditModal(m => ({ ...m, email: e.target.value }))} className={inputCls} autoComplete="off" />
              <p className="text-[11px] text-gray-400 mt-1">The new e-mail works at once; the password stays the same.</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setEditModal(null)} disabled={busy}>Cancel</Button>
              <Button onClick={saveUser} disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Set password */}
      <Modal isOpen={!!pwModal} onClose={() => !busy && setPwModal(null)} title={pwModal?.done ? 'Password Set' : 'Set New Password'} size="sm" allowMaximize={false}>
        {pwModal && (pwModal.done ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-emerald-700 text-sm font-semibold"><CheckCircle size={18} /> Password changed</div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-1 text-sm">
              <p className="break-all"><span className="text-gray-500">E-mail:</span> <span className="font-semibold">{pwModal.user.email}</span></p>
              <p className="break-all"><span className="text-gray-500">Password:</span> <span className="font-mono font-semibold select-all">{pwModal.password}</span></p>
            </div>
            <p className="text-[11px] text-gray-400">Note it down now — passwords are stored scrambled, so it cannot be shown again later. If it is lost, set a new one.</p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={copyPassword}><Copy size={14} /> {copied ? 'Copied' : 'Copy'}</Button>
              <Button onClick={() => setPwModal(null)}>Done</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 break-all">For <span className="font-semibold">{pwModal.user.email}</span></p>
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} value={pwModal.password} onChange={e => setPwModal(m => ({ ...m, password: e.target.value }))}
                className={`${inputCls} pr-16 font-mono`} placeholder="At least 8 characters" autoComplete="new-password" />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-2">
                <button type="button" onClick={() => setPwModal(m => ({ ...m, password: makePassword() }))} title="Generate" className="text-gray-400 hover:text-gray-700"><RefreshCw size={15} /></button>
                <button type="button" onClick={() => setShowPw(v => !v)} title={showPw ? 'Hide' : 'Show'} className="text-gray-400 hover:text-gray-700">
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setPwModal(null)} disabled={busy}>Cancel</Button>
              <Button onClick={setPassword} disabled={busy}>{busy ? 'Saving…' : 'Set Password'}</Button>
            </div>
          </div>
        ))}
      </Modal>
    </div>
  )
}
