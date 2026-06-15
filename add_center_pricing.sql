-- Per-super-center pricing + center payment (via Razorpay pay link) columns
-- Run manually in Supabase SQL Editor.

-- 1. Pricing columns set by admin ON EACH super center row.
--    A center created under a super center is charged based on ITS super center's prices.
ALTER TABLE centers ADD COLUMN IF NOT EXISTS with_letter_price NUMERIC DEFAULT 0;
ALTER TABLE centers ADD COLUMN IF NOT EXISTS without_letter_price NUMERIC DEFAULT 0;

-- 2. Letter type chosen for the created center + the snapshot of its price.
ALTER TABLE centers ADD COLUMN IF NOT EXISTS letter_type TEXT;     -- 'with' | 'without'
ALTER TABLE centers ADD COLUMN IF NOT EXISTS base_fee NUMERIC;     -- price of the chosen letter type (snapshot)

-- 3. Payment (collected at Account Dept verification via Razorpay payment link).
ALTER TABLE centers ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid';  -- 'unpaid' | 'link_sent' | 'paid'
ALTER TABLE centers ADD COLUMN IF NOT EXISTS payment_amount NUMERIC;                -- amount of the active pay link (= base_fee)
ALTER TABLE centers ADD COLUMN IF NOT EXISTS payment_link_id TEXT;                  -- Razorpay payment link id (plink_xxx)
ALTER TABLE centers ADD COLUMN IF NOT EXISTS payment_link_url TEXT;                 -- Razorpay short_url to share / pay
ALTER TABLE centers ADD COLUMN IF NOT EXISTS payment_id TEXT;                       -- Razorpay payment id once paid (pay_xxx)
ALTER TABLE centers ADD COLUMN IF NOT EXISTS payment_paid_at TIMESTAMPTZ;

-- 4. Cleanup of the earlier commission experiment (no longer used).
--    NOTE: amount_paid is intentionally kept — it is the separate applicant
--    registration payment used across Doc Dept / Account Dept / public form.
ALTER TABLE centers DROP COLUMN IF EXISTS commission_credited;
DROP TABLE IF EXISTS center_pricing;
