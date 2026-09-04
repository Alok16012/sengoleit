-- ============================================================
-- Commission is paid into the super centre's wallet, not as a coupon
-- ------------------------------------------------------------
-- Generating a commission now records what is OWED. "Send to Super Center"
-- pays it: the amount lands in that super centre's Available Balance
-- (centers.virtual_balance), which is the same wallet its Virtual Balance page
-- shows and the one it spends to register students.
--
-- No coupon is minted any more. Paying by coupon AND crediting the wallet
-- would hand the same commission over twice, so there is exactly one route.
-- The coupons already minted keep their recharge_commissions rows (so the
-- history is intact) and stay switched off, which is what stops them being
-- spent alongside the wallet credit.
--
-- Depends on: add_commission_recipients.sql, add_commission_coupon_actions.sql
-- Run in Supabase -> SQL Editor. Safe to re-run.
-- ============================================================

-- coupon_id stays for the rows that already have one; new rows leave it NULL.
COMMENT ON COLUMN recharge_commissions.coupon_id IS
  'Historical. Commission used to be paid as a coupon; it is now credited to the super centre wallet. NULL on everything generated since.';
COMMENT ON COLUMN recharge_commissions.sent_at IS
  'When the amount was credited to the super centre wallet. NULL = owed, not yet paid.';

-- ── 1. Generating records what is owed ──────────────────────
DROP FUNCTION IF EXISTS generate_commission_coupons(uuid);

CREATE FUNCTION generate_commission_payables(p_recharge uuid)
RETURNS TABLE (super_center_id uuid, super_center_name text, amount numeric, percent numeric)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r      record;
  rec    record;
  v_amt  numeric;
  v_made int := 0;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only the university admin can generate commission.';
  END IF;

  -- Qualified on purpose: `amount` and `percent` are OUT parameters as well as
  -- columns here, and unqualified they would match both.
  SELECT rr.id, rr.center_id, rr.amount, rr.status INTO r
    FROM recharge_requests rr WHERE rr.id = p_recharge FOR UPDATE;

  IF r.id IS NULL THEN RAISE EXCEPTION 'Recharge not found.'; END IF;
  IF COALESCE(r.status, '') <> 'verified' THEN
    RAISE EXCEPTION 'Commission can only be generated on a verified recharge (this one is %).',
      COALESCE(NULLIF(r.status, ''), 'pending');
  END IF;

  FOR rec IN
    SELECT cc.super_center_id AS sc_id, cc.percent AS pct, s.center_name AS sc_name
      FROM center_commissions cc
      JOIN centers s ON s.id = cc.super_center_id
     WHERE cc.center_id = r.center_id
       AND NOT EXISTS (SELECT 1 FROM recharge_commissions rc
                        WHERE rc.recharge_id = r.id AND rc.super_center_id = cc.super_center_id)
     ORDER BY s.center_name
  LOOP
    v_amt := round(COALESCE(r.amount, 0) * rec.pct / 100.0);
    CONTINUE WHEN v_amt < 1;

    INSERT INTO recharge_commissions (recharge_id, super_center_id, percent, amount)
    VALUES (r.id, rec.sc_id, rec.pct, v_amt);

    INSERT INTO commission_ledger (super_center_id, center_id, amount, base_fee, charged_amount, kind, note)
    VALUES (rec.sc_id, r.center_id, v_amt, 0, COALESCE(r.amount, 0), 'recharge',
            format('%s%% commission on recharge', rec.pct));

    v_made := v_made + 1;

    super_center_id   := rec.sc_id;
    super_center_name := rec.sc_name;
    amount            := v_amt;
    percent           := rec.pct;
    RETURN NEXT;
  END LOOP;

  IF v_made = 0 THEN
    RAISE EXCEPTION 'Nothing to generate: this centre has no commission recipients left to pay for this recharge.';
  END IF;
END $$;

REVOKE ALL ON FUNCTION generate_commission_payables(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION generate_commission_payables(uuid) TO authenticated;

-- ── 2. Sending pays it into the wallet ──────────────────────
-- p_sent false reverses a payment made by mistake, taking the money back out.
-- Both directions lock the wallet before reading it, for the same reason
-- mint_coupon_batch does: reading a balance and writing it back later loses
-- whatever else touched it in between.
CREATE OR REPLACE FUNCTION commission_set_sent(p_id uuid, p_sent boolean)
RETURNS TABLE (amount numeric, wallet_before numeric, wallet_after numeric, sent boolean)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  rc    record;
  v_bal numeric;
  v_new numeric;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only the university admin can pay commission.';
  END IF;

  SELECT r.id, r.super_center_id, r.amount, r.sent_at INTO rc
    FROM recharge_commissions r WHERE r.id = p_id FOR UPDATE;
  IF rc.id IS NULL THEN RAISE EXCEPTION 'Commission entry not found.'; END IF;

  IF p_sent AND rc.sent_at IS NOT NULL THEN
    RAISE EXCEPTION 'This commission has already been paid.';
  END IF;
  IF NOT p_sent AND rc.sent_at IS NULL THEN
    RAISE EXCEPTION 'This commission has not been paid yet.';
  END IF;

  SELECT c.virtual_balance INTO v_bal FROM centers c WHERE c.id = rc.super_center_id FOR UPDATE;
  IF v_bal IS NULL THEN RAISE EXCEPTION 'Super centre not found.'; END IF;

  v_new := v_bal + (CASE WHEN p_sent THEN COALESCE(rc.amount, 0) ELSE -COALESCE(rc.amount, 0) END);
  IF v_new < 0 THEN
    RAISE EXCEPTION 'Taking this commission back would leave the wallet at %, below zero. It holds % and the payment was %.',
      v_new, v_bal, COALESCE(rc.amount, 0);
  END IF;

  PERFORM set_config('app.wallet_write', 'on', true);
  UPDATE centers SET virtual_balance = v_new WHERE id = rc.super_center_id;
  UPDATE recharge_commissions SET sent_at = CASE WHEN p_sent THEN now() ELSE NULL END WHERE id = rc.id;

  RETURN QUERY SELECT COALESCE(rc.amount, 0), v_bal, v_new, p_sent;
END $$;

REVOKE ALL ON FUNCTION commission_set_sent(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION commission_set_sent(uuid, boolean) TO authenticated;

-- ── 3. A super centre reads its own recharge rows ───────────
-- Its Commission Wallet tab names the centre and the recharge each amount came
-- from, so it needs to read those recharges. It already may — the policy from
-- add_super_center_read_child_recharges.sql covers its own centres — but a
-- commission can now come from a centre that sits under someone else, so the
-- rows it is PAID on are opened up too.
DROP POLICY IF EXISTS recharge_super_center_earns ON recharge_requests;
CREATE POLICY recharge_super_center_earns ON recharge_requests
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM recharge_commissions rc
     WHERE rc.recharge_id = recharge_requests.id
       AND rc.super_center_id = my_super_center_id()
  ));

SELECT 'commission payout ready' AS result,
       (SELECT count(*) FROM recharge_commissions WHERE sent_at IS NULL) AS owed_not_yet_paid,
       (SELECT count(*) FROM recharge_commissions WHERE coupon_id IS NOT NULL) AS legacy_coupon_rows;
