-- ============================================================
-- SECURITY DEFINER RPCs for single-coupon admin operations.
--
-- WHY
--   CouponManagement.jsx uses the anon Supabase client for three
--   admin-only operations on the `coupons` table:
--     • generateDirectCode()  → INSERT  (RLS blocks anon INSERT)
--     • saveEditCode()        → UPDATE  (RLS silently no-ops anon UPDATE)
--
--   These functions run as the DB owner (SECURITY DEFINER) and
--   enforce the admin check themselves, so the service-role key
--   never needs to be shipped to the browser.
--
-- Run once in Supabase → SQL Editor. Safe to re-run.
-- ============================================================

-- 1. Create a single coupon (used by the "Generate Code" button)
CREATE OR REPLACE FUNCTION admin_create_single_coupon(
  p_center_id uuid,
  p_face_value numeric,
  p_coupon_type text DEFAULT 'discount'
)
RETURNS TABLE (id uuid, coupon_code text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_code text;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only the university admin can create coupons.';
  END IF;

  IF p_center_id IS NULL THEN
    RAISE EXCEPTION 'Center is required.';
  END IF;
  IF p_face_value IS NULL OR p_face_value < 1 THEN
    RAISE EXCEPTION 'Face value must be at least ₹1.';
  END IF;
  IF p_coupon_type NOT IN ('discount', 'approval') THEN
    RAISE EXCEPTION 'Unknown coupon type %.', p_coupon_type;
  END IF;

  -- Generate a unique code (uppercase, 8-char hex)
  v_code := substr(upper(md5(random()::text || clock_timestamp()::text)), 1, 8);

  INSERT INTO coupons (center_id, face_value, coupon_type, coupon_code)
  VALUES (p_center_id, p_face_value, p_coupon_type, v_code)
  RETURNING coupons.id, coupons.coupon_code INTO id, coupon_code;

  RETURN NEXT;
END;
$$;

-- 2. Update a coupon's face_value (used by the "Edit" button)
CREATE OR REPLACE FUNCTION admin_update_coupon(
  p_id uuid,
  p_face_value numeric
)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only the university admin can update coupons.';
  END IF;

  IF p_id IS NULL THEN
    RAISE EXCEPTION 'Coupon ID is required.';
  END IF;
  IF p_face_value IS NULL OR p_face_value < 1 THEN
    RAISE EXCEPTION 'Face value must be at least ₹1.';
  END IF;

  UPDATE coupons SET face_value = p_face_value WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Coupon not found.';
  END IF;
END;
$$;

-- 3. Toggle coupon active/inactive (used by toggleActivate)
CREATE OR REPLACE FUNCTION admin_toggle_coupon(
  p_id uuid,
  p_is_activated boolean,
  p_activated_at timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only the university admin can toggle coupons.';
  END IF;

  IF p_id IS NULL THEN
    RAISE EXCEPTION 'Coupon ID is required.';
  END IF;

  UPDATE coupons
  SET is_activated = p_is_activated,
      activated_at = p_activated_at
  WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Coupon not found.';
  END IF;
END;
$$;

-- 4. Admin delete coupon (used by deleteCode)
CREATE OR REPLACE FUNCTION admin_delete_coupon(
  p_id uuid
)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only the university admin can delete coupons.';
  END IF;

  IF p_id IS NULL THEN
    RAISE EXCEPTION 'Coupon ID is required.';
  END IF;

  DELETE FROM coupons WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Coupon not found.';
  END IF;
END;
$$;
