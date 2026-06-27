-- Approval-code activation: a super center activates an approval code against
-- an email, and can later activate/deactivate it.
-- Run in Supabase -> SQL Editor.

ALTER TABLE coupons ADD COLUMN IF NOT EXISTS activation_email text;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS is_activated boolean NOT NULL DEFAULT false;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS activated_at timestamptz;

SELECT 'coupons activation columns ready' AS result;
