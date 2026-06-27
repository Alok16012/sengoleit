-- Account Dept review of approval-code coupons (To Verify / Approved / Rejected).
-- Approved = is_activated true (existing). Rejected needs its own flag.
-- Run in Supabase -> SQL Editor.

ALTER TABLE coupons ADD COLUMN IF NOT EXISTS is_rejected boolean NOT NULL DEFAULT false;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS rejected_at timestamptz;

SELECT 'coupons review columns ready' AS result;
