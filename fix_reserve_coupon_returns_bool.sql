-- Fix: reserve_coupon() previously RETURNED void, so the app had no way to
-- tell whether the UPDATE actually matched a row. When a coupon was already
-- used (e.g. reserved a moment earlier for a different student), the guarded
-- UPDATE inside the function correctly matched 0 rows and changed nothing —
-- but the RPC call still came back with no error, so the app treated it as
-- "reserved successfully" and let a second student go through with the same
-- discount while the coupon kept showing as Available for a third student too.
--
-- This changes the function to RETURN boolean: true only if it actually
-- flipped a still-unused coupon to used. The app must check this and refuse
-- to save the discount (and warn the user) when it comes back false.
--
-- Run this once in Supabase -> SQL Editor. It replaces the function from
-- add_reserve_coupon_fn.sql (Postgres requires DROP + CREATE to change the
-- return type; CREATE OR REPLACE alone is not enough here).

DROP FUNCTION IF EXISTS reserve_coupon(uuid, uuid);

CREATE FUNCTION reserve_coupon(p_coupon_id uuid, p_application_id uuid)
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
     AND (
       center_id IN (SELECT id FROM centers WHERE email = (auth.jwt() ->> 'email'))
       OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
     );

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION reserve_coupon(uuid, uuid) TO authenticated;

SELECT 'reserve_coupon() now returns boolean success' AS result;
