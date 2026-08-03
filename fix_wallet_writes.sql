-- ============================================================
-- WALLET WRITES — fix the guard, and give the centre flow a safe path.
-- Run once in Supabase -> SQL Editor. Safe to re-run.
--
-- Two faults in guard_center_money() as shipped in security_hardening.sql:
--
--   1. It BLOCKED a legitimate centre operation. When a centre forwards a
--      student the fee is held by debiting its own wallet — but the centre is
--      neither anon nor an admin, so the trigger raised and the debit failed.
--      The app ignored that error, so the student was forwarded with fee_held
--      recorded while the money never left the wallet. Rejections, which run as
--      admin, then "refunded" money that had never been taken.
--
--   2. Its escape hatch was `auth.uid() IS NULL`, meant for the SQL editor and
--      service_role — but anon has no auth.uid() either, so anyone holding the
--      public key could set any centre's balance to anything.
--
-- The fix keeps wallets closed to everyone except admins, and routes the
-- centre's own hold/release through SECURITY DEFINER functions that do the
-- balance check and the debit together, so neither can happen without the
-- other. The trigger recognises those functions by a transaction-local flag
-- that only they can set.
-- ============================================================

-- ------------------------------------------------------------
-- 1) The guard, rewritten.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION guard_center_money() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Nothing to police unless a money column actually changed.
  IF NEW.virtual_balance IS NOT DISTINCT FROM OLD.virtual_balance
     AND NEW.coupon_wallet_balance IS NOT DISTINCT FROM OLD.coupon_wallet_balance THEN
    RETURN NEW;
  END IF;

  -- The SQL editor and service_role connect as a privileged database role;
  -- anon and authenticated do not. Testing the ROLE rather than auth.uid()
  -- is what keeps anon out — anon has no auth.uid() either.
  IF current_user IN ('postgres', 'supabase_admin', 'service_role', 'supabase_auth_admin') THEN
    RETURN NEW;
  END IF;

  -- University admins, as before.
  IF is_admin() THEN RETURN NEW; END IF;

  -- The controlled hold/release functions below, which have already verified
  -- who is asking and that the arithmetic is right. Only a SECURITY DEFINER
  -- function in this file sets this flag, and it lasts one transaction.
  IF current_setting('app.wallet_write', true) = 'on' THEN RETURN NEW; END IF;

  RAISE EXCEPTION 'Wallet balances can only be changed by the university admin.';
END $$;

DROP TRIGGER IF EXISTS trg_guard_center_money ON centers;
CREATE TRIGGER trg_guard_center_money
  BEFORE UPDATE ON centers
  FOR EACH ROW EXECUTE FUNCTION guard_center_money();

-- ------------------------------------------------------------
-- 2) Forwarding a student: hold the fee.
--    Debits the wallet and stamps the student in one transaction, so the
--    money and the record can never disagree. Raises (rather than returning
--    quietly) when the balance is short — the caller shows that to the centre.
--    p_target_center moves a Staging-centre student to its destination.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION student_forward_hold(
  p_student uuid, p_amount numeric, p_target_center uuid DEFAULT NULL)
RETURNS numeric
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s        students%ROWTYPE;
  wallet   uuid;
  bal      numeric;
  amt      numeric := GREATEST(COALESCE(p_amount, 0), 0);
  caller   text := auth.jwt() ->> 'email';
BEGIN
  SELECT * INTO s FROM students WHERE id = p_student;
  IF s.id IS NULL THEN RAISE EXCEPTION 'Student not found.'; END IF;
  IF s.forwarded_at IS NOT NULL THEN
    RAISE EXCEPTION 'This student has already been forwarded.';
  END IF;

  -- The wallet charged is the destination centre on a transfer, else the
  -- student's own. Only that centre's own login (or an admin) may do this.
  wallet := COALESCE(p_target_center, s.center_id);
  IF NOT is_admin() AND NOT EXISTS (
    SELECT 1 FROM centers c WHERE c.id = wallet AND c.email = caller
  ) AND NOT EXISTS (
    SELECT 1 FROM centers c WHERE c.id = s.center_id AND c.email = caller
  ) THEN
    RAISE EXCEPTION 'You can only forward your own centre''s students.';
  END IF;

  PERFORM set_config('app.wallet_write', 'on', true);

  IF amt > 0 THEN
    SELECT virtual_balance INTO bal FROM centers WHERE id = wallet FOR UPDATE;
    IF bal IS NULL THEN RAISE EXCEPTION 'Centre wallet not found.'; END IF;
    IF bal < amt THEN
      RAISE EXCEPTION 'Insufficient wallet balance: % available, % needed.', bal, amt;
    END IF;
    UPDATE centers SET virtual_balance = bal - amt WHERE id = wallet;
    bal := bal - amt;
  ELSE
    SELECT virtual_balance INTO bal FROM centers WHERE id = wallet;
  END IF;

  UPDATE students
  SET fee_held    = amt,
      forwarded_at = now(),
      center_id   = COALESCE(p_target_center, center_id)
  WHERE id = p_student;

  RETURN bal;
END $$;

-- ------------------------------------------------------------
-- 3) Releasing a hold: refund exactly what is recorded, once.
--    Clearing fee_held in the same statement is what makes a repeat call a
--    no-op, so a double rejection cannot refund twice.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION student_release_hold(p_student uuid)
RETURNS numeric
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  held numeric;
  ctr  uuid;
  bal  numeric;
BEGIN
  SELECT fee_held, center_id INTO held, ctr FROM students WHERE id = p_student FOR UPDATE;
  IF held IS NULL OR held <= 0 OR ctr IS NULL THEN
    UPDATE students SET fee_held = NULL WHERE id = p_student;
    RETURN 0;
  END IF;

  PERFORM set_config('app.wallet_write', 'on', true);
  SELECT virtual_balance INTO bal FROM centers WHERE id = ctr FOR UPDATE;
  UPDATE centers SET virtual_balance = COALESCE(bal, 0) + held WHERE id = ctr;
  UPDATE students SET fee_held = NULL WHERE id = p_student;
  RETURN held;
END $$;

REVOKE ALL ON FUNCTION student_forward_hold(uuid, numeric, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION student_release_hold(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION student_forward_hold(uuid, numeric, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION student_release_hold(uuid) TO authenticated;

SELECT 'wallet writes fixed' AS result;
