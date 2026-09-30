-- Let the university admin record a centre's payment as a recharge.
--
-- A centre raises its own recharge request, but that form will not take less
-- than Rs 5,000. A payment below that — Rs 1,200 paid by UPI, say — had no
-- way into the wallet at all. This records it from the admin side instead:
-- a verified recharge in the centre's Recharge History, with its receipt,
-- and the same amount on its wallet, in one transaction.
--
-- The payment's reference — UTR or transaction ID, one box — is required,
-- and one already on record in either column is refused, so the same payment
-- can never be credited twice; an advisory lock on the reference keeps two
-- admins saving it at once from both getting through.
--
-- Run once in Supabase -> SQL Editor. Safe to re-run. Replaces the earlier
-- version of this function, which took the UTR and transaction ID separately
-- and had no receipt.

DROP FUNCTION IF EXISTS admin_add_recharge(uuid, numeric, text, text, date, text);

CREATE OR REPLACE FUNCTION admin_add_recharge(
  p_center uuid,
  p_amount numeric,
  p_reference text,
  p_payment_date date DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_receipt_url text DEFAULT NULL)
RETURNS numeric
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  amt numeric := round(COALESCE(p_amount, 0));
  ref text := NULLIF(trim(COALESCE(p_reference, '')), '');
  bal numeric;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only the university admin can add a recharge.';
  END IF;
  IF amt <= 0 THEN
    RAISE EXCEPTION 'Enter an amount above zero.';
  END IF;
  IF ref IS NULL THEN
    RAISE EXCEPTION 'Enter the UTR or transaction ID of the payment.';
  END IF;

  -- One payment, one credit — whichever column the reference was kept in.
  PERFORM pg_advisory_xact_lock(hashtext('recharge_ref:' || ref));
  IF EXISTS (SELECT 1 FROM recharge_requests
             WHERE (utr_number = ref OR payment_txn_id = ref)
               AND COALESCE(status, '') <> 'rejected') THEN
    RAISE EXCEPTION 'UTR / transaction ID % is already recorded against a recharge.', ref;
  END IF;

  PERFORM set_config('app.wallet_write', 'on', true);
  SELECT virtual_balance INTO bal FROM centers WHERE id = p_center FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Centre not found.';
  END IF;

  INSERT INTO recharge_requests
    (center_id, amount, status, verified_at, utr_number, payment_date, utr_screenshot_url, notes)
  VALUES
    (p_center, amt, 'verified', now(), ref, p_payment_date,
     NULLIF(trim(COALESCE(p_receipt_url, '')), ''),
     COALESCE(NULLIF(trim(COALESCE(p_notes, '')), ''), 'Recorded by the university admin'));

  UPDATE centers SET virtual_balance = COALESCE(bal, 0) + amt WHERE id = p_center;
  RETURN COALESCE(bal, 0) + amt;
END $$;

REVOKE ALL ON FUNCTION admin_add_recharge(uuid, numeric, text, date, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_add_recharge(uuid, numeric, text, date, text, text) TO authenticated;

SELECT 'admin_add_recharge() ready — one reference box, with receipt' AS result;
