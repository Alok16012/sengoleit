-- ============================================================
-- Recharge Requests: edit every field, and delete a recharge
-- ------------------------------------------------------------
-- The Account Department could correct only a recharge's amount and date. A
-- payment entered against the wrong centre, with the wrong UTR, or entered at
-- all by mistake, could not be put right — and a recharge that was verified
-- and had commission generated on it had money in two places: the centre's
-- wallet and the super centre's commission.
--
--   admin_update_recharge() — every field of a recharge: centre, amount,
--     transaction ID, UTR, payment date, date, notes, remarks, screenshot.
--     On a verified recharge a change of amount or centre moves the wallets
--     with it: the old centre gives back the old amount, the new centre gets
--     the new one.
--
--   admin_delete_recharge() — removes a recharge. If it was verified, its
--     amount comes back off the centre's wallet. Any commission generated on
--     it is undone first (see below). A copy of the row, the commission it
--     carried and the reason are kept in deleted_recharges.
--
-- Commission is worked out from the recharge's amount and centre, so when
-- either changes — or the recharge is deleted — the commission generated on it
-- is undone: an amount already credited to a super centre's wallet comes back
-- off it, its commission_ledger entry is removed, and the recharge_commissions
-- row goes. After an edit it can be generated again from the Commission Wallet
-- on the corrected figure. A legacy commission COUPON that has already been
-- redeemed cannot be undone, and stops the change.
--
-- A wallet is never taken below zero silently. If giving the money back would
-- leave one below zero (the centre has already spent it), the change is
-- refused with a message starting WALLET_BELOW_ZERO; the admin can confirm
-- and repeat it with p_allow_negative, which records the shortfall as a
-- negative balance the centre owes.
--
-- Depends on: fix_wallet_writes.sql, add_commission_payout.sql
-- Run once in Supabase -> SQL Editor. Safe to re-run.
-- ============================================================

-- ── 1. Record of deleted recharges ──────────────────────────
CREATE TABLE IF NOT EXISTS deleted_recharges (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recharge_id   uuid NOT NULL,
  center_id     uuid,
  amount        numeric,
  status        text,
  recharge      jsonb NOT NULL,          -- the row as it was
  commissions   jsonb,                   -- the commission undone with it
  wallet_before numeric,
  wallet_after  numeric,
  reason        text,
  deleted_by    text,
  deleted_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE deleted_recharges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS deleted_recharges_admin_read ON deleted_recharges;
CREATE POLICY deleted_recharges_admin_read ON deleted_recharges FOR SELECT USING (is_admin());

-- ── 2. Move a wallet by a delta ─────────────────────────────
-- Locks the wallet before reading it. Internal: called only from the two
-- functions below, which have already checked the caller is an admin.
CREATE OR REPLACE FUNCTION _recharge_wallet_move(p_center uuid, p_delta numeric, p_allow_negative boolean)
RETURNS numeric
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_bal  numeric;
  v_name text;
  v_new  numeric;
BEGIN
  SELECT COALESCE(c.virtual_balance, 0), c.center_name INTO v_bal, v_name
    FROM centers c WHERE c.id = p_center FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Centre not found.'; END IF;

  v_new := v_bal + COALESCE(p_delta, 0);
  IF v_new < 0 AND v_new < v_bal AND NOT COALESCE(p_allow_negative, false) THEN
    RAISE EXCEPTION 'WALLET_BELOW_ZERO: % has ₹% in its wallet. Taking back ₹% would leave it at ₹%.',
      v_name, v_bal, -p_delta, v_new;
  END IF;

  PERFORM set_config('app.wallet_write', 'on', true);
  UPDATE centers SET virtual_balance = v_new WHERE id = p_center;
  RETURN v_new;
END $$;

REVOKE ALL ON FUNCTION _recharge_wallet_move(uuid, numeric, boolean) FROM PUBLIC, anon, authenticated;

-- ── 3. Undo the commission generated on a recharge ──────────
-- Returns what was undone, as JSON, for the deleted_recharges record.
CREATE OR REPLACE FUNCTION _undo_recharge_commission(p_recharge uuid, p_center uuid, p_allow_negative boolean)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  rc     record;
  v_used boolean;
  v_code text;
  v_out  jsonb := '[]'::jsonb;
BEGIN
  FOR rc IN
    SELECT * FROM recharge_commissions WHERE recharge_id = p_recharge ORDER BY created_at FOR UPDATE
  LOOP
    -- Commission once paid as a coupon: only one never redeemed can be undone.
    IF rc.coupon_id IS NOT NULL THEN
      SELECT COALESCE(cp.is_used, false), cp.coupon_code INTO v_used, v_code
        FROM coupons cp WHERE cp.id = rc.coupon_id FOR UPDATE;
      IF v_used THEN
        RAISE EXCEPTION 'The commission on this recharge was paid as coupon %, which has already been used. It cannot be undone.', v_code;
      END IF;
    END IF;

    -- Paid into the super centre's wallet: take it back out.
    IF rc.sent_at IS NOT NULL THEN
      PERFORM _recharge_wallet_move(rc.super_center_id, -COALESCE(rc.amount, 0), p_allow_negative);
    END IF;

    -- Its ledger entry — the one written when it was generated.
    DELETE FROM commission_ledger
     WHERE id = (SELECT l.id FROM commission_ledger l
                  WHERE l.super_center_id = rc.super_center_id
                    AND l.center_id = p_center
                    AND l.kind = 'recharge'
                    AND l.amount = rc.amount
                  ORDER BY abs(extract(epoch FROM l.created_at - rc.created_at))
                  LIMIT 1);

    DELETE FROM recharge_commissions WHERE id = rc.id;
    IF rc.coupon_id IS NOT NULL THEN
      DELETE FROM coupons WHERE id = rc.coupon_id;
    END IF;

    v_out := v_out || jsonb_build_array(to_jsonb(rc));
  END LOOP;
  RETURN v_out;
END $$;

REVOKE ALL ON FUNCTION _undo_recharge_commission(uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;

-- ── 4. Edit a recharge ──────────────────────────────────────
DROP FUNCTION IF EXISTS admin_update_recharge(uuid, uuid, numeric, text, text, date, timestamptz, text, text, text, boolean);

CREATE FUNCTION admin_update_recharge(
  p_recharge       uuid,
  p_center         uuid,
  p_amount         numeric,
  p_txn            text,
  p_utr            text,
  p_payment_date   date,
  p_created_at     timestamptz,
  p_notes          text,
  p_remarks        text,
  p_screenshot_url text,
  p_allow_negative boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r        recharge_requests%ROWTYPE;
  v_amt    numeric := round(COALESCE(p_amount, 0));
  v_txn    text := NULLIF(trim(COALESCE(p_txn, '')), '');
  v_utr    text := NULLIF(trim(COALESCE(p_utr, '')), '');
  v_money  boolean;
  v_undone jsonb := '[]'::jsonb;
  v_old_after numeric;
  v_new_after numeric;
  ref      text;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only the university admin can edit a recharge.';
  END IF;

  SELECT * INTO r FROM recharge_requests WHERE id = p_recharge FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Recharge not found.'; END IF;

  IF p_center IS NULL OR NOT EXISTS (SELECT 1 FROM centers WHERE id = p_center) THEN
    RAISE EXCEPTION 'Choose the centre.';
  END IF;
  IF v_amt <= 0 THEN RAISE EXCEPTION 'Enter an amount above zero.'; END IF;
  IF p_created_at IS NOT NULL AND p_created_at > now() + interval '1 minute' THEN
    RAISE EXCEPTION 'The date cannot be in the future.';
  END IF;

  -- A UTR / transaction ID belongs to one recharge, whichever column it is in.
  FOREACH ref IN ARRAY ARRAY[v_txn, v_utr] LOOP
    CONTINUE WHEN ref IS NULL OR ref IN (COALESCE(r.payment_txn_id, ''), COALESCE(r.utr_number, ''));
    PERFORM pg_advisory_xact_lock(hashtext('recharge_ref:' || ref));
    IF EXISTS (SELECT 1 FROM recharge_requests x
                WHERE x.id <> r.id
                  AND (x.utr_number = ref OR x.payment_txn_id = ref)
                  AND COALESCE(x.status, '') <> 'rejected') THEN
      RAISE EXCEPTION 'UTR / transaction ID % is already recorded against another recharge.', ref;
    END IF;
  END LOOP;

  v_money := p_center IS DISTINCT FROM r.center_id OR v_amt IS DISTINCT FROM r.amount;

  IF v_money THEN
    -- Commission was worked out from the old figure; undo it.
    v_undone := _undo_recharge_commission(r.id, r.center_id, p_allow_negative);

    -- Only a verified recharge ever reached a wallet.
    IF COALESCE(r.status, '') = 'verified' THEN
      IF p_center = r.center_id THEN
        v_new_after := _recharge_wallet_move(r.center_id, v_amt - COALESCE(r.amount, 0), p_allow_negative);
        v_old_after := v_new_after;
      ELSE
        v_old_after := _recharge_wallet_move(r.center_id, -COALESCE(r.amount, 0), p_allow_negative);
        v_new_after := _recharge_wallet_move(p_center, v_amt, p_allow_negative);
      END IF;
    END IF;
  END IF;

  UPDATE recharge_requests SET
    center_id          = p_center,
    amount             = v_amt,
    payment_txn_id     = v_txn,
    utr_number         = v_utr,
    payment_date       = p_payment_date,
    created_at         = COALESCE(p_created_at, created_at),
    notes              = NULLIF(trim(COALESCE(p_notes, '')), ''),
    admin_remarks      = NULLIF(trim(COALESCE(p_remarks, '')), ''),
    utr_screenshot_url = NULLIF(trim(COALESCE(p_screenshot_url, '')), '')
  WHERE id = r.id;

  RETURN jsonb_build_object(
    'money_moved', v_money AND COALESCE(r.status, '') = 'verified',
    'old_center_wallet', v_old_after,
    'new_center_wallet', v_new_after,
    'commission_undone', jsonb_array_length(v_undone));
END $$;

REVOKE ALL ON FUNCTION admin_update_recharge(uuid, uuid, numeric, text, text, date, timestamptz, text, text, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_update_recharge(uuid, uuid, numeric, text, text, date, timestamptz, text, text, text, boolean) TO authenticated;

-- ── 5. Delete a recharge ────────────────────────────────────
DROP FUNCTION IF EXISTS admin_delete_recharge(uuid, text, boolean);

CREATE FUNCTION admin_delete_recharge(p_recharge uuid, p_reason text DEFAULT NULL, p_allow_negative boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r        recharge_requests%ROWTYPE;
  v_by     text := COALESCE(NULLIF(auth.jwt() ->> 'email', ''), auth.uid()::text, 'admin');
  v_undone jsonb;
  v_before numeric;
  v_after  numeric;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only the university admin can delete a recharge.';
  END IF;

  SELECT * INTO r FROM recharge_requests WHERE id = p_recharge FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'Recharge not found.'; END IF;

  v_undone := _undo_recharge_commission(r.id, r.center_id, p_allow_negative);

  SELECT COALESCE(virtual_balance, 0) INTO v_before FROM centers WHERE id = r.center_id;
  v_after := v_before;
  IF COALESCE(r.status, '') = 'verified' THEN
    v_after := _recharge_wallet_move(r.center_id, -COALESCE(r.amount, 0), p_allow_negative);
  END IF;

  INSERT INTO deleted_recharges (recharge_id, center_id, amount, status, recharge, commissions,
                                 wallet_before, wallet_after, reason, deleted_by)
  VALUES (r.id, r.center_id, r.amount, r.status, to_jsonb(r), v_undone,
          v_before, v_after, NULLIF(trim(COALESCE(p_reason, '')), ''), v_by);

  DELETE FROM recharge_requests WHERE id = r.id;

  RETURN jsonb_build_object(
    'amount', r.amount,
    'was_verified', COALESCE(r.status, '') = 'verified',
    'wallet_before', v_before,
    'wallet_after', v_after,
    'commission_undone', jsonb_array_length(v_undone));
END $$;

REVOKE ALL ON FUNCTION admin_delete_recharge(uuid, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_delete_recharge(uuid, text, boolean) TO authenticated;

SELECT 'recharge edit / delete ready' AS result;
