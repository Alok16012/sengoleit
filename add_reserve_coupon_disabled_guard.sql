-- reserve_coupon() must refuse a switched-off coupon.
--
-- The app used to redeem a coupon with a direct UPDATE that carried an
-- `is_disabled = false` guard in its own WHERE clause. That update could never
-- work from a centre login — centres cannot UPDATE coupons under RLS — so it
-- has been replaced by this SECURITY DEFINER function, which is the only route
-- that actually redeems a coupon now. The guard has to live here with it,
-- otherwise switching a coupon off would merely hide it from the dropdown
-- while leaving it perfectly redeemable by anyone who still had the code.
--
-- Everything else is unchanged from fix_reserve_coupon_returns_bool.sql: it
-- still returns true only when it flipped a still-unused coupon, so two
-- students can never claim the same one.
--
-- Run once in Supabase -> SQL Editor. Safe to re-run.

CREATE OR REPLACE FUNCTION reserve_coupon(p_coupon_id uuid, p_application_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated int;
BEGIN
  UPDATE coupons
     SET is_used        = true,
         used_at        = COALESCE(used_at, now()),
         application_id = p_application_id
   WHERE id = p_coupon_id
     AND COALESCE(is_used, false) = false
     AND COALESCE(is_disabled, false) = false      -- <<< the guard that moved here
     AND (
       center_id IN (SELECT id FROM centers WHERE email = (auth.jwt() ->> 'email'))
       OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
     );

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION reserve_coupon(uuid, uuid) TO authenticated;

SELECT 'reserve_coupon() now refuses disabled coupons' AS result;
