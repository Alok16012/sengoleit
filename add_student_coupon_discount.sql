-- Persist the applied coupon discount directly on the student.
--
-- Why: at submission the center applies a coupon and we reserve it in the
-- `coupons` table (is_used + application_id). The Account Dept then re-reads the
-- discount from coupons.face_value WHERE application_id = student.id when it
-- collects the fee. If the center role can't UPDATE the coupons row (RLS), that
-- linkage never gets written, so the discount is lost and the FULL course fee is
-- charged at approval (e.g. ₹5,000 instead of ₹4,000 after a ₹1,000 coupon).
--
-- Storing the discount on the student row — which the center always writes when
-- it creates the application — makes the discount reliable end-to-end (forward
-- hold + Account Dept collection), independent of coupons-table permissions.
--
-- Run this once in Supabase -> SQL Editor.

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS coupon_discount numeric, -- ₹ off applied at submission
  ADD COLUMN IF NOT EXISTS coupon_code text;        -- the coupon code used (for reference)

SELECT 'students.coupon_discount / coupon_code ready' AS result;
