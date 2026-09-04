-- ============================================================
-- Commission recipients: a centre's commission can go to more than one
-- super centre
-- ------------------------------------------------------------
-- A centre is CREATED under exactly one super centre, and that does not
-- change — centers.super_center_id still decides whose centre it is, who
-- sees it in My Centers, and whose wallet it draws on.
--
-- Who EARNS on it is a separate question. A centre may have been brought in
-- through two super centres, and the university may want to pay both. So the
-- rate stops being one number on the centre and becomes a list of
-- (super centre, percent) rows.
--
-- centers.commission stays as it is and is seeded across below, so nothing
-- that reads it breaks mid-migration; new code reads center_commissions.
--
-- Run in Supabase -> SQL Editor. Safe to re-run.
-- Depends on: add_commission_wallet.sql, add_fee_sharing_to_centers.sql.
-- ============================================================

-- ── 1. Who earns on a centre, and at what rate ──────────────
CREATE TABLE IF NOT EXISTS center_commissions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id       uuid NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  super_center_id uuid NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  percent         numeric NOT NULL CHECK (percent > 0 AND percent <= 100),
  created_at      timestamptz DEFAULT now(),
  -- One rate per (centre, super centre). Paying the same super centre twice on
  -- one centre is always a mistake, never an intent.
  UNIQUE (center_id, super_center_id)
);

CREATE INDEX IF NOT EXISTS center_commissions_center_idx ON center_commissions(center_id);
CREATE INDEX IF NOT EXISTS center_commissions_super_idx  ON center_commissions(super_center_id);

COMMENT ON TABLE center_commissions IS
  'Which super centres earn commission on a centre, and at what percent. Independent of centers.super_center_id, which is still the single parent.';

-- Carry the existing single rate over: whatever centers.commission holds today
-- becomes a row for that centre''s own parent. ON CONFLICT so re-running is safe.
INSERT INTO center_commissions (center_id, super_center_id, percent)
SELECT c.id, c.super_center_id, c.commission
FROM centers c
WHERE c.super_center_id IS NOT NULL
  AND COALESCE(c.commission, 0) > 0
ON CONFLICT (center_id, super_center_id) DO NOTHING;

ALTER TABLE center_commissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS center_commissions_admin_all ON center_commissions;
CREATE POLICY center_commissions_admin_all ON center_commissions
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- A super centre may read the rates that pay IT, so its own portal can show
-- what it earns. It cannot see another super centre's rates, or change any.
DROP POLICY IF EXISTS center_commissions_super_read ON center_commissions;
CREATE POLICY center_commissions_super_read ON center_commissions
  FOR SELECT TO authenticated USING (super_center_id = my_super_center_id());

-- ── 2. The coupons a recharge paid out ──────────────────────
-- One row per (recharge, earning super centre), so a recharge shared by two
-- super centres mints two coupons and neither can be minted twice.
CREATE TABLE IF NOT EXISTS recharge_commissions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recharge_id     uuid NOT NULL REFERENCES recharge_requests(id) ON DELETE CASCADE,
  super_center_id uuid NOT NULL REFERENCES centers(id),
  coupon_id       uuid REFERENCES coupons(id) ON DELETE SET NULL,
  percent         numeric NOT NULL,
  amount          numeric NOT NULL,
  created_at      timestamptz DEFAULT now(),
  UNIQUE (recharge_id, super_center_id)
);

CREATE INDEX IF NOT EXISTS recharge_commissions_recharge_idx ON recharge_commissions(recharge_id);

ALTER TABLE recharge_commissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS recharge_commissions_admin_all ON recharge_commissions;
CREATE POLICY recharge_commissions_admin_all ON recharge_commissions
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS recharge_commissions_super_read ON recharge_commissions;
CREATE POLICY recharge_commissions_super_read ON recharge_commissions
  FOR SELECT TO authenticated USING (super_center_id = my_super_center_id());

-- ── 3. Mint the commission for one recharge ─────────────────
-- Not a spend, so no wallet is debited: this is what the super centre EARNED,
-- unlike mint_coupon_batch, which takes the money out of coupon_wallet_balance.
--
-- Mints for every super centre that earns on the centre — one coupon each.
-- Recipients already paid stay untouched, so adding a second super centre after
-- the first was paid mints only the new one.
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
  -- SECURITY DEFINER runs as the owner, so it has to police the caller itself.
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only the university admin can generate commission coupons.';
  END IF;

  -- Lock the recharge before reading it, so two clicks cannot both get past the
  -- "already paid?" check.
  --
  -- Every column here is qualified with the table alias on purpose. `amount`
  -- and `percent` are also OUT parameters of this function, and an unqualified
  -- `amount` matches both the column and the variable — Postgres refuses the
  -- whole call with 'column reference "amount" is ambiguous'.
  SELECT rr.id, rr.center_id, rr.amount, rr.status INTO r
    FROM recharge_requests rr WHERE rr.id = p_recharge FOR UPDATE;

  IF r.id IS NULL THEN
    RAISE EXCEPTION 'Recharge not found.';
  END IF;
  -- Commission is earned on money that actually arrived. A pending or rejected
  -- recharge has not.
  IF COALESCE(r.status, '') <> 'verified' THEN
    RAISE EXCEPTION 'Commission can only be generated on a verified recharge (this one is %).',
      COALESCE(NULLIF(r.status, ''), 'pending');
  END IF;

  FOR rec IN
    SELECT cc.super_center_id AS sc_id, cc.percent AS pct, s.center_name AS sc_name
      FROM center_commissions cc
      JOIN centers s ON s.id = cc.super_center_id
     WHERE cc.center_id = r.center_id
       -- Skip the ones already paid for this recharge.
       AND NOT EXISTS (
         SELECT 1 FROM recharge_commissions rc
          WHERE rc.recharge_id = r.id AND rc.super_center_id = cc.super_center_id
       )
     ORDER BY s.center_name
  LOOP
    v_amt := round(COALESCE(r.amount, 0) * rec.pct / 100.0);
    -- A rate so small it rounds to nothing is skipped rather than failing the
    -- whole run — the other recipients still get paid.
    CONTINUE WHEN v_amt < 1;

    v_code := substr(upper(md5(random()::text || clock_timestamp()::text)), 1, 8);

    INSERT INTO coupons (center_id, face_value, coupon_type, coupon_code)
    VALUES (rec.sc_id, v_amt, 'discount', v_code)
    RETURNING id INTO v_id;

    INSERT INTO recharge_commissions (recharge_id, super_center_id, coupon_id, percent, amount)
    VALUES (r.id, rec.sc_id, v_id, rec.pct, v_amt);

    -- base_fee is NOT NULL on the ledger and has no meaning for a recharge, so
    -- it records 0; charged_amount carries the recharge it was taken on.
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

SELECT 'commission recipients ready' AS result,
       (SELECT count(*) FROM center_commissions)   AS recipient_rows_seeded,
       (SELECT count(*) FROM recharge_commissions) AS coupons_already_paid;
