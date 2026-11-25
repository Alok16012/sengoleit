-- Ph.D fee, the Research Dept way.
--
-- 1) Centres may READ the Payment Condition, so the admission form can ask for
--    the first document's amount in the wallet instead of 50% of the fee.
-- 2) "Registration / ID Card" and "Forward to Exam" are no longer separate
--    conditions — the Registration Certificate's row covers the ID card.
-- 3) research_collect_fee(): the Research Dept takes an amount from the
--    centre's wallet while issuing a document, and it is added to the
--    candidate's fee paid — balance check, debit and record in one step.
--
-- Run once in Supabase -> SQL Editor. Safe to re-run.

DROP POLICY IF EXISTS research_payment_rules_read ON research_payment_rules;
CREATE POLICY research_payment_rules_read ON research_payment_rules
  FOR SELECT TO authenticated USING (true);

DELETE FROM research_payment_rules WHERE doc IN ('Enrollment / ID Card', 'Forward to Exam');

CREATE OR REPLACE FUNCTION research_collect_fee(p_student uuid, p_amount numeric, p_doc text DEFAULT NULL)
RETURNS TABLE (fee_collected numeric, wallet_balance numeric)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s    students%ROWTYPE;
  bal  numeric;
  amt  numeric := round(COALESCE(p_amount, 0));
BEGIN
  IF NOT (is_admin() OR has_perm('research_dept.manage')) THEN
    RAISE EXCEPTION 'Not allowed to collect a Ph.D fee.';
  END IF;
  IF amt <= 0 THEN RAISE EXCEPTION 'Enter an amount to deduct.'; END IF;

  SELECT * INTO s FROM students WHERE id = p_student FOR UPDATE;
  IF s.id IS NULL THEN RAISE EXCEPTION 'Student not found.'; END IF;
  IF s.center_id IS NULL THEN RAISE EXCEPTION 'This candidate has no centre wallet to deduct from.'; END IF;

  SELECT virtual_balance INTO bal FROM centers WHERE id = s.center_id FOR UPDATE;
  IF bal IS NULL THEN RAISE EXCEPTION 'Centre wallet not found.'; END IF;
  IF bal < amt THEN
    RAISE EXCEPTION 'Insufficient wallet balance: % available, % needed.', bal, amt;
  END IF;

  PERFORM set_config('app.wallet_write', 'on', true);
  UPDATE centers SET virtual_balance = bal - amt WHERE id = s.center_id;
  UPDATE students SET fee_collected = COALESCE(students.fee_collected, 0) + amt WHERE id = p_student;

  INSERT INTO student_fee_ledger (student_id, center_id, amount, kind, term, note)
  VALUES (p_student, s.center_id, amt, 'research_document', NULLIF(btrim(COALESCE(p_doc, '')), ''),
          'Collected by the Research Dept from the centre wallet');

  fee_collected := COALESCE(s.fee_collected, 0) + amt;
  wallet_balance := bal - amt;
  RETURN NEXT;
END $$;

REVOKE ALL ON FUNCTION research_collect_fee(uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION research_collect_fee(uuid, numeric, text) TO authenticated;

NOTIFY pgrst, 'reload schema';

SELECT 'research wallet collection ready' AS result;
