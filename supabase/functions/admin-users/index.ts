// Supabase Edge Function: admin-users
// Creates and manages STAFF logins for User Management. Creating a login and
// setting someone else's password need the service-role key, which must never
// be in the browser — so the app asks this function, and it checks first that
// the caller is the admin or holds the 'users.manage' permission.
//
// It only ever touches staff logins (profiles.role = 'staff'): never the
// admin, a centre or a student.
//
// Called from the app via supabase.functions.invoke('admin-users', { body: { action, ... } })
//   create        { email, password, full_name, app_role_id }
//   set_password  { user_id, password }
//   set_active    { user_id, active }
//   update        { user_id, email, full_name }
//   delete        { user_id }
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are injected
// automatically by Supabase.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const authHeader = req.headers.get('Authorization') || ''
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Sign in first.' }, 401)

    // Ask the database, AS THE CALLER, whether they may manage users — the
    // same has_perm() every policy uses, so there is one rule, not two.
    const asCaller = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } })
    const { data: me } = await asCaller.auth.getUser()
    if (!me?.user) return json({ error: 'Sign in first.' }, 401)
    const { data: allowed, error: permErr } = await asCaller.rpc('has_perm', { p_perm: 'users.manage' })
    if (permErr) return json({ error: 'Could not check permission: ' + permErr.message }, 500)
    if (allowed !== true) return json({ error: 'You are not allowed to manage users.' }, 403)

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
    const body = await req.json().catch(() => ({}))
    const action = String(body.action || '')

    // Only staff logins may be changed here.
    async function staffOnly(userId: string) {
      const { data: p } = await admin.from('profiles').select('role').eq('id', userId).maybeSingle()
      return p?.role === 'staff'
    }

    if (action === 'create') {
      const email = String(body.email || '').trim().toLowerCase()
      const password = String(body.password || '')
      const fullName = String(body.full_name || '').trim()
      const roleId = String(body.app_role_id || '')
      if (!EMAIL_RE.test(email)) return json({ error: 'Enter a valid e-mail.' }, 400)
      if (password.length < 8) return json({ error: 'The password must be at least 8 characters.' }, 400)
      if (!roleId) return json({ error: 'Choose a role.' }, 400)
      const { data: role } = await admin.from('app_roles').select('id').eq('id', roleId).maybeSingle()
      if (!role) return json({ error: 'That role does not exist.' }, 400)

      // An e-mail already used by a centre or another login cannot become staff.
      const { data: ctr } = await admin.from('centers').select('id').ilike('email', email).maybeSingle()
      if (ctr) return json({ error: 'This e-mail is a centre login. Use a different e-mail.' }, 400)

      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { role: 'staff', full_name: fullName },
      })
      if (cErr || !created?.user) return json({ error: cErr?.message || 'Could not create the login.' }, 400)

      const { error: pErr } = await admin.from('profiles').upsert({
        id: created.user.id, role: 'staff', app_role_id: roleId, full_name: fullName || null, is_active: true,
      })
      if (pErr) {
        await admin.auth.admin.deleteUser(created.user.id)   // no half-made logins
        return json({ error: 'Could not save the login: ' + pErr.message }, 500)
      }
      return json({ ok: true, user_id: created.user.id })
    }

    if (action === 'set_password') {
      const userId = String(body.user_id || '')
      const password = String(body.password || '')
      if (password.length < 8) return json({ error: 'The password must be at least 8 characters.' }, 400)
      if (!(await staffOnly(userId))) return json({ error: 'Only staff logins can be changed here.' }, 403)
      const { error } = await admin.auth.admin.updateUserById(userId, { password })
      if (error) return json({ error: error.message }, 400)
      return json({ ok: true })
    }

    if (action === 'set_active') {
      const userId = String(body.user_id || '')
      const active = body.active === true
      if (userId === me.user.id) return json({ error: 'You cannot switch off your own login.' }, 400)
      if (!(await staffOnly(userId))) return json({ error: 'Only staff logins can be changed here.' }, 403)
      // A switched-off login can no longer sign in, and has_perm() stops
      // granting anything to it straight away.
      const { error: bErr } = await admin.auth.admin.updateUserById(userId, { ban_duration: active ? 'none' : '876000h' })
      if (bErr) return json({ error: bErr.message }, 400)
      const { error: pErr } = await admin.from('profiles').update({ is_active: active }).eq('id', userId)
      if (pErr) return json({ error: pErr.message }, 500)
      return json({ ok: true })
    }

    if (action === 'update') {
      const userId = String(body.user_id || '')
      const email = String(body.email || '').trim().toLowerCase()
      const fullName = String(body.full_name || '').trim()
      if (!EMAIL_RE.test(email)) return json({ error: 'Enter a valid e-mail.' }, 400)
      if (!(await staffOnly(userId))) return json({ error: 'Only staff logins can be changed here.' }, 403)
      const { data: ctr } = await admin.from('centers').select('id').ilike('email', email).maybeSingle()
      if (ctr) return json({ error: 'This e-mail is a centre login. Use a different e-mail.' }, 400)
      // email_confirm: the new address works at once — no confirmation mail.
      const { error: uErr } = await admin.auth.admin.updateUserById(userId, {
        email, email_confirm: true, user_metadata: { role: 'staff', full_name: fullName },
      })
      if (uErr) return json({ error: /already/i.test(uErr.message) ? 'This e-mail is already used by another login.' : uErr.message }, 400)
      const { error: pErr } = await admin.from('profiles').update({ full_name: fullName || null }).eq('id', userId)
      if (pErr) return json({ error: pErr.message }, 500)
      return json({ ok: true })
    }

    if (action === 'delete') {
      const userId = String(body.user_id || '')
      if (userId === me.user.id) return json({ error: 'You cannot delete your own login.' }, 400)
      if (!(await staffOnly(userId))) return json({ error: 'Only staff logins can be deleted here.' }, 403)
      // The profile first (it may not cascade), then the login itself.
      const { error: pErr } = await admin.from('profiles').delete().eq('id', userId)
      if (pErr) return json({ error: pErr.message }, 500)
      const { error: dErr } = await admin.auth.admin.deleteUser(userId)
      if (dErr) return json({ error: dErr.message }, 400)
      return json({ ok: true })
    }

    return json({ error: 'Unknown action.' }, 400)
  } catch (e) {
    return json({ error: (e as Error).message || 'Unexpected error.' }, 500)
  }
})
