# Center Letter-Fee Payment (Razorpay) — Setup

This wires up the "pay link at Account Dept verification" flow:

1. Super center creates a center and picks **With Letter / Without Letter**. The fee for
   that type (set per super center on the **Center Pricing** admin page) is stored on the center.
2. At **Account Department → Pending Approvals → Verify**, the admin clicks
   **Generate & Send Pay Link**. A Razorpay payment link is created for that amount and
   sent to the super center (email/SMS) — the link is also shown in the panel to copy.
3. The super center pays the link. Razorpay calls our webhook, which marks the center
   `payment_status = 'paid'` and records the payment id + time.
4. Only after payment does **Verify & Approve** unlock.

---

## 1. Run the SQL migration

In Supabase → SQL Editor, run `add_center_pricing.sql` (adds the pricing + payment columns).

## 2. Create a Razorpay account & get API keys

- Sign up / log in at https://dashboard.razorpay.com
- Settings → **API Keys** → Generate. Note **Key Id** and **Key Secret**.
- Use **Test Mode** keys first to verify the flow end-to-end, then switch to Live.

> Do NOT put the Key Secret in the React app or `.env` — it must only live in the
> edge function secrets below. The frontend never sees it.

## 3. Deploy the edge functions

Install the Supabase CLI and link the project (one-time):

```bash
npm i -g supabase
supabase login
supabase link --project-ref <YOUR_PROJECT_REF>
```

Set the secrets:

```bash
supabase secrets set RAZORPAY_KEY_ID=rzp_test_xxxxx RAZORPAY_KEY_SECRET=xxxxx
# (webhook secret is set after step 4)
```

Deploy:

```bash
supabase functions deploy create-payment-link
supabase functions deploy razorpay-webhook --no-verify-jwt
```

`--no-verify-jwt` is required for the webhook because Razorpay cannot send a Supabase JWT;
the webhook instead verifies Razorpay's own signature.

> No CLI? You can also paste each `supabase/functions/*/index.ts` into the Supabase
> Dashboard → Edge Functions editor, and set the secrets under Edge Functions → Secrets.
> For the webhook, turn **Verify JWT** OFF in its settings.

## 4. Create the Razorpay webhook

- Razorpay Dashboard → Settings → **Webhooks** → Add New Webhook.
- URL: `https://<YOUR_PROJECT_REF>.functions.supabase.co/razorpay-webhook`
- Secret: choose any strong string — you'll reuse it in the next command.
- Active events: **`payment_link.paid`** (optionally also `payment.captured`).

Then set that same secret on the function:

```bash
supabase secrets set RAZORPAY_WEBHOOK_SECRET=<the-secret-you-just-chose>
```

## 5. Test

1. Set a With/Without price for a super center on **Admin → Center Pricing**.
2. As that super center, create a center and pick a letter type.
3. As admin, open **Account Dept → Pending Approvals → Verify** for that center,
   click **Generate & Send Pay Link**, open the link, and pay (test card in test mode).
4. Back in the modal, click **↻ Refresh payment status** — it should flip to **Paid**,
   and **Verify & Approve** unlocks.

---

### Razorpay test card (Test Mode)
- Card: `4111 1111 1111 1111`, any future expiry, any CVV, any name. Use OTP `1111` if prompted.
