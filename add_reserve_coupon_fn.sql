-- Reserve (mark used) a coupon when a center applies it to a student.
--
-- Why: centers can READ their coupons but the coupons table's RLS does not let
-- the center role UPDATE them. So the "mark used" write at form submission
-- silently failed — the coupon kept showing as Available even after it was
-- applied to an admission.
--
-- This SECURITY DEFINER function runs with the owner's rights (bypassing RLS)
-- but only flips a coupon that (a) is still unused and (b) belongs to the
-- caller's own center — or the caller is an admin. The app calls it via
-- supabase.rpc('reserve_coupon', ...) at submission.
--
-- Run this once in Supabase -> SQL Editor.

CREATE OR REPLACE FUNCTION reserve_coupon(p_coupon_id uuid, p_application_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
END;
$$;

GRANT EXECUTE ON FUNCTION reserve_coupon(uuid, uuid) TO authenticated;

SELECT 'reserve_coupon() ready' AS result;
