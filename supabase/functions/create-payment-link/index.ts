// Supabase Edge Function: create-payment-link
// Creates a Razorpay Payment Link for a center's letter-type fee and stores it on the center.
//
// Required function secrets (set with `supabase secrets set ...` or in the dashboard):
//   RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically by Supabase.
//
// Called from the admin app via supabase.functions.invoke('create-payment-link', { body: { center_id } })

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const KEY_ID = Deno.env.get('RAZORPAY_KEY_ID')
    const KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET')
    if (!KEY_ID || !KEY_SECRET) return json({ error: 'Razorpay keys not configured' }, 500)

    const authHeader = req.headers.get('Authorization') || ''
    const jwt = authHeader.replace('Bearer ', '')
    if (!jwt) return json({ error: 'Unauthorized' }, 401)

    const admin = createClient(SUPABASE_URL, SERVICE_KEY)

    // Verify the caller is an authenticated admin.
    const { data: userData, error: userErr } = await admin.auth.getUser(jwt)
    if (userErr || !userData?.user) return json({ error: 'Unauthorized' }, 401)
    const { data: profile } = await admin.from('profiles').select('role').eq('id', userData.user.id).single()
    if (profile?.role !== 'admin') return json({ error: 'Forbidden — admin only' }, 403)

    const { center_id } = await req.json()
    if (!center_id) return json({ error: 'center_id is required' }, 400)

    const { data: center, error: cErr } = await admin.from('centers')
      .select('id, center_name, contact_person, email, phone, contact_mobile, payment_amount, base_fee, payment_status')
      .eq('id', center_id).single()
    if (cErr || !center) return json({ error: 'Center not found' }, 404)
    if (center.payment_status === 'paid') return json({ error: 'This center is already paid' }, 400)

    const amount = Number(center.payment_amount || center.base_fee || 0)
    if (!amount || amount <= 0) return json({ error: 'No fee amount set for this center' }, 400)

    // Create the Razorpay payment link.
    const rzpBody = {
      amount: Math.round(amount * 100), // paise
      currency: 'INR',
      accept_partial: false,
      description: `Center activation fee — ${center.center_name}`,
      reference_id: `center_${center.id}`,
      customer: {
        name: center.contact_person || center.center_name || 'Center',
        email: center.email || undefined,
        contact: center.phone || center.contact_mobile || undefined,
      },
      notify: { email: !!center.email, sms: !!(center.phone || center.contact_mobile) },
      reminder_enable: true,
      notes: { center_id: String(center.id) },
    }

    const rzpResp = await fetch('https://api.razorpay.com/v1/payment_links', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${KEY_ID}:${KEY_SECRET}`),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(rzpBody),
    })
    const rzp = await rzpResp.json()
    if (!rzpResp.ok) {
      return json({ error: rzp?.error?.description || 'Razorpay error', detail: rzp }, 502)
    }

    await admin.from('centers').update({
      payment_status: 'link_sent',
      payment_amount: amount,
      payment_link_id: rzp.id,
      payment_link_url: rzp.short_url,
    }).eq('id', center.id)

    return json({ short_url: rzp.short_url, payment_link_id: rzp.id, amount })
  } catch (err) {
    return json({ error: (err as Error).message || 'Unexpected error' }, 500)
  }
})
