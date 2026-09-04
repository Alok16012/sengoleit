-- ============================================================
-- Correct a recharge amount, and move the wallet with it
-- ------------------------------------------------------------
-- A recharge entered as 26,250 when 26,000 arrived has to be corrected in two
-- places at once: the request, and the centre's wallet that was credited from
-- it. Editing only the request leaves the wallet 250 too high for good.
--
-- Both writes live in one locked transaction, for the same reason
-- mint_coupon_batch does: reading the balance in the browser and writing it
-- back a moment later loses whatever else touched the wallet in between, and
-- writes an absolute figure rather than a delta.
--
-- Only the DIFFERENCE is applied. A verified recharge already credited the old
-- amount, so the wallet moves by (new - old). A pending or held one never
-- credited anything, so only the request changes.
--
-- Run in Supabase -> SQL Editor. Safe to re-run.
-- ============================================================

CREATE OR REPLACE FUNCTION admin_edit_recharge_amount(p_recharge uuid, p_amount numeric)
RETURNS TABLE (old_amount numeric, new_amount numeric, wallet_before numeric, wallet_after numeric)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r     record;
  v_bal numeric;
  v_new numeric;
  v_paid int;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only the university admin can change a recharge amount.';
  END IF;
  IF p_amount IS NULL OR p_amount < 0 THEN
    RAISE EXCEPTION 'Enter the corrected amount.';
  END IF;

  -- Qualified on purpose: `old_amount`/`new_amount` are OUT parameters, and an
  -- unqualified `amount` would match both a column and a variable.
  SELECT rr.id, rr.center_id, rr.amount, rr.status INTO r
    FROM recharge_requests rr WHERE rr.id = p_recharge FOR UPDATE;
  IF r.id IS NULL THEN
    RAISE EXCEPTION 'Recharge not found.';
  END IF;

  -- Commission already paid out on this recharge was worked out from the OLD
  -- figure, and those coupons may already be in a super centre's hands. Let
  -- the admin undo that first rather than silently leaving the two disagreeing.
  SELECT count(*) INTO v_paid FROM recharge_commissions rc WHERE rc.recharge_id = r.id;
  IF v_paid > 0 THEN
    RAISE EXCEPTION 'Commission has already been generated on this recharge (% coupon(s)). Cancel that first, then edit the amount.', v_paid;
  END IF;

  IF r.amount IS NOT DISTINCT FROM p_amount THEN
    RAISE EXCEPTION 'That is the amount it already has.';
  END IF;

  -- Lock the wallet before reading it, so two edits cannot both start from the
  -- same balance.
  SELECT c.virtual_balance INTO v_bal FROM centers c WHERE c.id = r.center_id FOR UPDATE;
  IF v_bal IS NULL THEN
    RAISE EXCEPTION 'Centre not found.';
  END IF;

  -- Only a verified recharge ever reached the wallet.
  IF COALESCE(r.status, '') = 'verified' THEN
    v_new := v_bal + (p_amount - COALESCE(r.amount, 0));
    IF v_new < 0 THEN
      RAISE EXCEPTION 'That correction would take the wallet to %, below zero. It holds % and the reduction is %.',
        v_new, v_bal, COALESCE(r.amount, 0) - p_amount;
    END IF;
    PERFORM set_config('app.wallet_write', 'on', true);
    UPDATE centers SET virtual_balance = v_new WHERE id = r.center_id;
  ELSE
    v_new := v_bal;
  END IF;

  UPDATE recharge_requests SET amount = p_amount WHERE id = r.id;

  RETURN QUERY SELECT COALESCE(r.amount, 0), p_amount, v_bal, v_new;
END $$;

REVOKE ALL ON FUNCTION admin_edit_recharge_amount(uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_edit_recharge_amount(uuid, numeric) TO authenticated;

SELECT 'admin_edit_recharge_amount ready' AS result;
