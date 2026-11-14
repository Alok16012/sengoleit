-- Student portal "Pay Now": the student types an amount and pays it.
--
-- A new payment kind 'fee' takes any amount from Rs 1 to Rs 5,00,000 — it is
-- not matched against a computed due, unlike 're_registration' and
-- 'admit_card'. student_payment_confirm() already credits every kind to
-- students.fee_collected and records it in student_online_payments, so a 'fee'
-- payment lands on the student's record the same way.
--
-- Run once in Supabase -> SQL Editor. Safe to re-run.

CREATE OR REPLACE FUNCTION public.student_payment_intent(p_ref text, p_mobile text, p_kind text, p_amount numeric, p_txn text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  f   record;
  sid uuid;
BEGIN
  IF btrim(COALESCE(p_txn, '')) = '' OR COALESCE(p_amount, 0) <= 0
     OR p_kind NOT IN ('re_registration', 'admit_card', 'fee') THEN
    RETURN false;
  END IF;

  SELECT * INTO f FROM student_fee_lookup(p_ref, p_mobile);
  IF NOT COALESCE(f.found, false) THEN RETURN false; END IF;

  -- A due-based payment must match what the database says is owed; an
  -- open 'fee' payment only has to be a sane amount.
  IF (p_kind = 're_registration' AND p_amount <> COALESCE(f.re_registration_fee, 0))
     OR (p_kind = 'admit_card'  AND p_amount <> COALESCE(f.admit_card_fee, 0))
     OR (p_kind = 'fee' AND (p_amount < 1 OR p_amount > 500000 OR p_amount <> round(p_amount, 2))) THEN
    RETURN false;
  END IF;

  SELECT st.id INTO sid FROM students st
  WHERE regexp_replace(COALESCE(st.mobile_no, ''), '\D', '', 'g')
        = regexp_replace(COALESCE(p_mobile, ''), '\D', '', 'g')
    AND (upper(COALESCE(st.admission_number, '')) = upper(btrim(p_ref))
      OR upper(COALESCE(st.enrollment_no, ''))    = upper(btrim(p_ref))
      OR upper(COALESCE(st.registration_no, ''))  = upper(btrim(p_ref)))
  LIMIT 1;
  IF sid IS NULL THEN RETURN false; END IF;

  INSERT INTO student_payment_intents (txn_id, student_id, kind, amount)
  VALUES (p_txn, sid, p_kind, p_amount)
  ON CONFLICT (txn_id) DO NOTHING;
  RETURN true;
END $function$;

SELECT 'open-amount student payment ready' AS result;
