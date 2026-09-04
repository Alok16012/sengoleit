-- ============================================================
-- Commission coupons: Active / Deactive, and "sent to super centre"
-- ------------------------------------------------------------
-- A generated commission coupon now starts DEACTIVE. The admin hands it over
-- ("Sent to Super Center"), then activates it. Nothing is redeemable until
-- that last step, so a coupon minted by mistake cannot be spent.
--
-- The important half is that Deactive has to be REAL. A discount coupon was
-- only ever gated on is_used: reserve_coupon() checked nothing else, and the
-- centre's available-coupon list checked nothing else. A flag on its own would
-- have made the button a lie — the coupon would still redeem. So the gate goes
-- into reserve_coupon() itself, which is the one chokepoint every redemption
-- passes through.
--
-- is_activated is NOT reused for this: it already means "the Account Dept
-- verified the payment behind an APPROVAL code", and overloading it would tie
-- two unrelated flows together.
--
-- Depends on: add_commission_recipients.sql, fix_reserve_coupon_returns_bool.sql
-- Run in Supabase -> SQL Editor. Safe to re-run.
-- ============================================================

-- ── 1. The switch ───────────────────────────────────────────
-- Default false, so every coupon that already exists stays exactly as usable
-- as it is today. Only the commission mint below opts into starting disabled.
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS is_disabled boolean NOT NULL DEFAULT false;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS disabled_at timestamptz;

COMMENT ON COLUMN coupons.is_disabled IS
  'Blocks redemption. Enforced in reserve_coupon(), not just in the UI. Commission coupons are minted disabled and switched on by the admin.';

-- ── 2. The handover marker ──────────────────────────────────
ALTER TABLE recharge_commissions ADD COLUMN IF NOT EXISTS sent_at timestamptz;

COMMENT ON COLUMN recharge_commissions.sent_at IS
  'When the coupon was handed to the super centre. A record only — it does not make the coupon usable; activating does.';

-- ── 3. reserve_coupon() ─────────────────────────────────────
-- NOTE: this is NOT where Deactive is enforced. The app does not call
-- reserve_coupon() — it flips is_used with a guarded UPDATE of its own, and
-- that statement carries the is_disabled guard. This function is brought in
-- line anyway so the two cannot disagree if it is ever wired back up.
--
-- Wrapped in a transaction: the live function returns void (the boolean fix
-- was never applied here), and Postgres will not let CREATE OR REPLACE change
-- a return type — it has to be dropped first. Doing both inside BEGIN/COMMIT
-- means there is no instant where the function is missing.
BEGIN;

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
     AND COALESCE(is_disabled, false) = false
     AND (
       center_id IN (SELECT id FROM centers WHERE email = (auth.jwt() ->> 'email'))
       OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
     );

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION reserve_coupon(uuid, uuid) TO authenticated;

COMMIT;

-- ── 4. Mint commission coupons switched off ─────────────────
-- Only the INSERT INTO coupons changes; everything else is as it was.
CREATE OR REPLACE FUNCTION generate_commission_coupons(p_recharge uuid)
RETURNS TABLE (super_center_id uuid, super_center_name text, coupon_code text, amount numeric, percent numeric)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r       record;
  rec     record;
  v_amt   numeric;
  v_code  text;
  v_id    uuid;
  v_made  int := 0;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only the university admin can generate commission coupons.';
  END IF;

  -- Every column qualified: `amount` and `percent` are OUT parameters of this
  -- function as well as columns here, and an unqualified `amount` matches both.
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

    v_code := substr(upper(md5(random()::text || clock_timestamp()::text)), 1, 8);

    -- Minted switched OFF: it is handed over and activated deliberately.
    INSERT INTO coupons (center_id, face_value, coupon_type, coupon_code, is_disabled, disabled_at)
    VALUES (rec.sc_id, v_amt, 'discount', v_code, true, now()) RETURNING id INTO v_id;

    INSERT INTO recharge_commissions (recharge_id, super_center_id, coupon_id, percent, amount)
    VALUES (r.id, rec.sc_id, v_id, rec.pct, v_amt);

    INSERT INTO commission_ledger (super_center_id, center_id, amount, base_fee, charged_amount, kind, note)
    VALUES (rec.sc_id, r.center_id, v_amt, 0, COALESCE(r.amount, 0), 'recharge',
            format('%s%% commission on recharge, coupon %s', rec.pct, v_code));

    v_made := v_made + 1;

    super_center_id   := rec.sc_id;
    super_center_name := rec.sc_name;
    coupon_code       := v_code;
    amount            := v_amt;
    percent           := rec.pct;
    RETURN NEXT;
  END LOOP;

  IF v_made = 0 THEN
    RAISE EXCEPTION 'Nothing to generate: this centre has no commission recipients left to pay for this recharge.';
  END IF;
END $$;

REVOKE ALL ON FUNCTION generate_commission_coupons(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION generate_commission_coupons(uuid) TO authenticated;

-- ── 5. Bring the ones already generated into the new rule ───
-- They were minted before this existed and none has been used, so they follow
-- the same "off until switched on" rule as the ones minted from now on.
UPDATE coupons c
   SET is_disabled = true, disabled_at = COALESCE(c.disabled_at, now())
 WHERE COALESCE(c.is_used, false) = false
   AND NOT COALESCE(c.is_disabled, false)
   AND EXISTS (SELECT 1 FROM recharge_commissions rc WHERE rc.coupon_id = c.id);

SELECT 'commission coupon actions ready' AS result,
       (SELECT count(*) FROM coupons c
         WHERE c.is_disabled AND EXISTS (SELECT 1 FROM recharge_commissions rc WHERE rc.coupon_id = c.id))
         AS commission_coupons_switched_off,
       (SELECT count(*) FROM recharge_commissions WHERE sent_at IS NOT NULL) AS already_marked_sent;
