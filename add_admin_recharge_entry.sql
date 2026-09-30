-- Let the university admin record a centre's payment as a recharge.
--
-- A centre raises its own recharge request, but that form will not take less
-- than Rs 5,000. A payment below that — Rs 1,200 paid by UPI, say — had no
-- way into the wallet at all. This records it from the admin side instead:
-- a verified recharge in the centre's Recharge History and the same amount
-- on its wallet, in one transaction.
--
-- The payment's UTR or transaction ID is required, and one already recorded
-- is refused, so the same payment can never be credited twice — not even by
-- two admins pressing Save at the same moment (the advisory lock serialises
-- them on that UTR).
--
-- Run once in Supabase -> SQL Editor. Safe to re-run.

CREATE OR REPLACE FUNCTION admin_add_recharge(
  p_center uuid,
  p_amount numeric,
  p_utr text DEFAULT NULL,
  p_txn text DEFAULT NULL,
  p_payment_date date DEFAULT NULL,
  p_notes text DEFAULT NULL)
RETURNS numeric
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  amt numeric := round(COALESCE(p_amount, 0));
  utr text := NULLIF(trim(COALESCE(p_utr, '')), '');
  txn text := NULLIF(trim(COALESCE(p_txn, '')), '');
  bal numeric;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only the university admin can add a recharge.';
  END IF;
  IF amt <= 0 THEN
    RAISE EXCEPTION 'Enter an amount above zero.';
  END IF;
  IF utr IS NULL AND txn IS NULL THEN
    RAISE EXCEPTION 'Enter the UTR number or the transaction ID of the payment.';
  END IF;

  -- One payment, one credit.
  IF utr IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('recharge_utr:' || utr));
    IF EXISTS (SELECT 1 FROM recharge_requests
               WHERE utr_number = utr AND COALESCE(status, '') <> 'rejected') THEN
      RAISE EXCEPTION 'UTR % is already recorded against a recharge.', utr;
    END IF;
  END IF;
  IF txn IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('recharge_txn:' || txn));
    IF EXISTS (SELECT 1 FROM recharge_requests
               WHERE payment_txn_id = txn AND COALESCE(status, '') <> 'rejected') THEN
      RAISE EXCEPTION 'Transaction % is already recorded against a recharge.', txn;
    END IF;
  END IF;

  PERFORM set_config('app.wallet_write', 'on', true);
  SELECT virtual_balance INTO bal FROM centers WHERE id = p_center FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Centre not found.';
  END IF;

  INSERT INTO recharge_requests
    (center_id, amount, status, verified_at, utr_number, payment_txn_id, payment_date, notes)
  VALUES
    (p_center, amt, 'verified', now(), utr, txn, p_payment_date,
     COALESCE(NULLIF(trim(COALESCE(p_notes, '')), ''), 'Recorded by the university admin'));

  UPDATE centers SET virtual_balance = COALESCE(bal, 0) + amt WHERE id = p_center;
  RETURN COALESCE(bal, 0) + amt;
END $$;

REVOKE ALL ON FUNCTION admin_add_recharge(uuid, numeric, text, text, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_add_recharge(uuid, numeric, text, text, date, text) TO authenticated;

SELECT 'admin_add_recharge() ready' AS result;
