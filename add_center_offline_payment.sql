-- Lets a super center record an OFFLINE payment at the time of creating a center
-- (instead of waiting for the Razorpay pay link at Account Dept verification).
-- The super center enters the amount + UTR/reference number and uploads the receipt.
--
-- Run this once in Supabase → SQL Editor.

ALTER TABLE centers ADD COLUMN IF NOT EXISTS utr_number TEXT;             -- bank/UPI transaction reference
ALTER TABLE centers ADD COLUMN IF NOT EXISTS payment_date DATE;          -- date money was paid
ALTER TABLE centers ADD COLUMN IF NOT EXISTS payment_screenshot_url TEXT; -- uploaded receipt / screenshot
ALTER TABLE centers ADD COLUMN IF NOT EXISTS payment_remark TEXT;        -- optional note from the payer

-- amount_paid and payment_status already exist (from add_center_pricing.sql).
-- When an offline payment is submitted, payment_status is set to 'offline_review'
-- so the Account Department knows to verify the UTR + receipt before approving.
