// Supabase Edge Function: razorpay-webhook
// Receives Razorpay webhook events and marks the center as paid when its payment link is paid.
//
// Required function secrets:
//   RAZORPAY_WEBHOOK_SECRET   (the secret you set when creating the webhook in Razorpay dashboard)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically by Supabase.
//
// Configure this function's URL as a webhook in the Razorpay dashboard, subscribed to:
//   payment_link.paid   (and optionally payment.captured)
//
// IMPORTANT: deploy with JWT verification OFF for this function (Razorpay can't send a Supabase JWT):
//   supabase functions deploy razorpay-webhook --no-verify-jwt

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

function hmacHex(secret: string, body: string) {
  const enc = new TextEncoder()
  return crypto.subtle
    .importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    .then((key) => crypto.subtle.sign('HMAC', key, enc.encode(body)))
    .then((sig) => [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join(''))
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const WEBHOOK_SECRET = Deno.env.get('RAZORPAY_WEBHOOK_SECRET')
  if (!WEBHOOK_SECRET) return new Response('Webhook secret not configured', { status: 500 })

  const raw = await req.text()
  const signature = req.headers.get('x-razorpay-signature') || ''
  const expected = await hmacHex(WEBHOOK_SECRET, raw)
  if (signature !== expected) return new Response('Invalid signature', { status: 401 })

  let payload: any
  try { payload = JSON.parse(raw) } catch { return new Response('Bad JSON', { status: 400 }) }

  const event = payload?.event
  // We care about a payment link being paid.
  const plink = payload?.payload?.payment_link?.entity
  const payment = payload?.payload?.payment?.entity

  // reference_id is "center_<id>" (set when the link was created); notes.center_id is a backup.
  const refId: string | undefined = plink?.reference_id || payment?.notes?.center_id
  let centerId: string | null = null
  if (refId) centerId = refId.startsWith('center_') ? refId.slice('center_'.length) : refId

  const isPaid =
    event === 'payment_link.paid' ||
    (event === 'payment.captured' && (plink?.status === 'paid' || payment?.status === 'captured'))

  if (centerId && isPaid) {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY)
    await admin.from('centers').update({
      payment_status: 'paid',
      payment_id: payment?.id || plink?.id || null,
      payment_paid_at: new Date().toISOString(),
    }).eq('id', centerId)
  }

  // Always 200 so Razorpay doesn't retry indefinitely on unrelated events.
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
