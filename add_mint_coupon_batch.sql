-- ============================================================
-- Minting coupons in one transaction.
-- Run once in Supabase -> SQL Editor. Safe to re-run.
--
-- WHY
--   generateCoupons() inserted the coupon rows, then wrote the centre's
--   coupon_wallet_balance as a SECOND statement — from a balance that had been
--   read when the page last loaded. Two problems:
--     * If the balance write failed (a trigger, RLS, a dropped connection) the
--       coupons existed and the wallet was untouched, so the same money could
--       be minted again.
--     * The balance written was absolute, not a delta, so anything that
--       changed the wallet between page load and mint was silently overwritten.
--   Doing both together, against a row locked FOR UPDATE, removes both.
--
--   It also caps the ROW COUNT. The form checks rupees, which lets ₹1 × 25,000
--   through — a slip that would insert twenty-five thousand rows.
--
-- Mirrors student_forward_hold in fix_wallet_writes.sql, including the
-- app.wallet_write flag that lets guard_center_money() recognise a controlled
-- write. Run fix_wallet_writes.sql first.
-- ============================================================

-- Which batch a coupon came from, so a mis-mint can be undone by reference
-- instead of by guessing at value + date. Nullable: rows minted before this
-- simply have none.
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS mint_batch_id uuid;
CREATE INDEX IF NOT EXISTS idx_coupons_mint_batch ON coupons(mint_batch_id);

CREATE OR REPLACE FUNCTION mint_coupon_batch(
  p_center uuid,
  p_count  int,
  p_value  numeric,
  p_type   text DEFAULT 'discount'
)
RETURNS TABLE (batch_id uuid, minted int, wallet_after numeric)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  bal   numeric;
  total numeric;
  bid   uuid := gen_random_uuid();
  MAX_ROWS constant int := 2000;
BEGIN
  -- SECURITY DEFINER means this runs as the owner, so it must police the
  -- caller itself — otherwise any centre login could mint its own coupons.
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only the university admin can mint coupons.';
  END IF;

  IF p_count IS NULL OR p_count < 1 THEN
    RAISE EXCEPTION 'Enter how many coupons to create.';
  END IF;
  IF p_value IS NULL OR p_value < 1 THEN
    RAISE EXCEPTION 'Enter the value of each coupon.';
  END IF;
  -- A rupee cap alone does not bound this: 25000 coupons of Rs 1 costs the same
  -- as 25 of Rs 1000.
  IF p_count > MAX_ROWS THEN
    RAISE EXCEPTION 'A batch is limited to % coupons; % were asked for.', MAX_ROWS, p_count;
  END IF;
  IF p_type NOT IN ('discount', 'approval') THEN
    RAISE EXCEPTION 'Unknown coupon type %.', p_type;
  END IF;

  total := p_count * p_value;

  -- Lock the wallet before reading it, so two admins minting at once cannot
  -- both spend the same balance.
  SELECT coupon_wallet_balance INTO bal FROM centers WHERE id = p_center FOR UPDATE;
  IF bal IS NULL THEN
    RAISE EXCEPTION 'Centre not found.';
  END IF;
  IF bal < total THEN
    RAISE EXCEPTION 'The coupon wallet holds % but % is needed.', bal, total;
  END IF;

  PERFORM set_config('app.wallet_write', 'on', true);
  UPDATE centers SET coupon_wallet_balance = bal - total WHERE id = p_center;

  INSERT INTO coupons (center_id, face_value, coupon_type, mint_batch_id)
  SELECT p_center, p_value, p_type, bid FROM generate_series(1, p_count);

  RETURN QUERY SELECT bid, p_count, bal - total;
END $$;

REVOKE ALL ON FUNCTION mint_coupon_batch(uuid, int, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mint_coupon_batch(uuid, int, numeric, text) TO authenticated;

SELECT 'mint_coupon_batch ready' AS result;
