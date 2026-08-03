-- ============================================================
-- PUBLIC API FOR THE WEBSITE (sengolewebsite)
-- Run once in Supabase -> SQL Editor. Safe to re-run.
--
-- WHY THIS EXISTS
--   security_hardening.sql locked `coupons` down to authenticated users, and
--   student_auth.sql revoked `students` from anon. The public website talks to
--   PostgREST with the ANON key, so both of its database features stopped
--   working: an approval code could no longer be looked up or paid for, and the
--   student status page could not read anything.
--
--   Re-opening the tables to anon is not an option — that is exactly the hole
--   the hardening closed (anyone with the anon key could mint coupons or read
--   every student's record). Instead the website gets these SECURITY DEFINER
--   functions: each returns precisely the fields one page needs and nothing
--   more, and each write is narrow enough that it cannot be abused.
--
--   Student lookups require the mobile number as well as the application
--   number, so the anon key alone cannot walk the student list.
-- ============================================================

-- ------------------------------------------------------------
-- "1st" / "2nd" / "3rd" / "4th" — term labels read the same on the website as
-- they do in the admin panel (src/utils/reRegistration.js ORD).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION ordinal(n int) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT n::text || CASE
    WHEN n % 100 BETWEEN 11 AND 13 THEN 'th'
    WHEN n % 10 = 1 THEN 'st'
    WHEN n % 10 = 2 THEN 'nd'
    WHEN n % 10 = 3 THEN 'rd'
    ELSE 'th' END
$$;

-- ------------------------------------------------------------
-- Shared: the cumulative course fee up to semester n, using the same
-- entry / divide / multiply / multiply2 rules as src/utils/courseFee.js.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION course_fee_upto(p_programme uuid, p_session uuid, p_sem int)
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH t AS (
    SELECT
      COALESCE(SUM(fi.amount) FILTER (WHERE fi.category = 'entry'),     0) AS entry_t,
      COALESCE(SUM(fi.amount) FILTER (WHERE fi.category = 'divide'),    0) AS divide_t,
      COALESCE(SUM(fi.amount) FILTER (WHERE fi.category = 'multiply'),  0) AS mul_t,
      COALESCE(SUM(fi.amount) FILTER (WHERE fi.category = 'multiply2'), 0) AS mul2_t
    FROM fee_structures fs
    LEFT JOIN fee_items fi ON fi.fee_structure_id = fs.id
    WHERE fs.program_id = p_programme AND fs.session_id = p_session
  ), d AS (
    SELECT GREATEST(COALESCE(duration, 1), 1) AS total FROM programs WHERE id = p_programme
  )
  SELECT CASE WHEN p_sem <= 0 THEN 0 ELSE
    ROUND(t.entry_t + (t.divide_t / d.total) * p_sem
          + t.mul_t * p_sem + t.mul2_t * GREATEST(p_sem - 1, 0))
  END
  FROM t, d
$$;

-- ============================================================
-- 1) APPROVAL CODES — the Admission Partner fee page
-- ============================================================

-- Look up an approval code by its printed code (CPNB8F953A330) or by the 8-char
-- prefix of its id. Returns only what the payment page displays.
CREATE OR REPLACE FUNCTION approval_code_lookup(p_code text)
RETURNS TABLE (
  approval_code text,
  amount        numeric,
  is_paid       boolean,
  is_reviewing  boolean,
  center_name   text,
  center_email  text,
  center_phone  text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    left(c.id::text, 8),
    c.face_value,
    (COALESCE(c.is_activated, false) OR COALESCE(c.is_used, false)),
    (c.payment_txn_id IS NOT NULL
       AND NOT COALESCE(c.is_activated, false)
       AND NOT COALESCE(c.is_used, false)),
    ctr.center_name,
    ctr.email,
    COALESCE(ctr.phone, ctr.contact_mobile)
  FROM coupons c
  LEFT JOIN centers ctr ON ctr.id = c.center_id
  WHERE c.coupon_type = 'approval'
    AND (upper(COALESCE(c.coupon_code, '')) = upper(btrim(p_code))
         OR left(c.id::text, 8) = lower(btrim(p_code)))
  LIMIT 1
$$;

-- Record a verified PayU payment against an approval code. Writes the txn id
-- and nothing else — activation stays the Account Dept's decision, exactly as
-- before. Only fills an empty txn id, so the PayU callback and the webhook can
-- both fire without the second overwriting the first.
CREATE OR REPLACE FUNCTION approval_code_mark_paid(p_code text, p_txn text)
RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  IF btrim(COALESCE(p_code, '')) = '' OR btrim(COALESCE(p_txn, '')) = '' THEN
    RETURN false;
  END IF;
  UPDATE coupons SET payment_txn_id = p_txn
  WHERE coupon_type = 'approval'
    AND payment_txn_id IS NULL
    AND (upper(COALESCE(coupon_code, '')) = upper(btrim(p_code))
         OR left(id::text, 8) = lower(btrim(p_code)));
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;
END $$;

-- ============================================================
-- 2) STUDENTS — status page, and the re-registration / admit-card fees
-- ============================================================

-- Money a student paid on the website. One row per PayU transaction; the unique
-- txn id makes recording idempotent when the callback and webhook both arrive.
CREATE TABLE IF NOT EXISTS student_online_payments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  kind       text NOT NULL,                    -- re_registration | admit_card
  amount     numeric NOT NULL,
  txn_id     text NOT NULL UNIQUE,
  paid_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sop_student ON student_online_payments(student_id);

ALTER TABLE student_online_payments ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'student_online_payments' LOOP
    EXECUTE format('DROP POLICY %I ON student_online_payments', p.policyname);
  END LOOP;
END $$;

-- Admins see everything; a center sees its own students' payments. The website
-- never reads this table directly — it writes through the function below.
CREATE POLICY sop_admin_all ON student_online_payments
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY sop_center_read_own ON student_online_payments
  FOR SELECT TO authenticated USING (
    student_id IN (
      SELECT s.id FROM students s
      WHERE s.center_id IN (SELECT id FROM centers WHERE email = (auth.jwt() ->> 'email'))
    )
  );

-- What a student can pay for right now.
--   re_registration_fee : the step from this term to the next (0 at the end of
--                         the course, or while a request is already pending)
--   admit_card_fee      : the shortfall that unlocks the next semester's admit
--                         card (0 when the fee due so far is already cleared)
-- Requires the mobile number as well as the reference, so the list cannot be
-- walked with the anon key alone.
CREATE OR REPLACE FUNCTION student_fee_lookup(p_ref text, p_mobile text)
RETURNS TABLE (
  found               boolean,
  student_name        text,
  application_no      text,
  enrollment_no       text,
  email               text,
  mobile              text,
  program_name        text,
  session_name        text,
  center_name         text,
  status              text,
  current_term        text,
  next_term           text,
  fee_collected       numeric,
  re_registration_fee numeric,
  re_registration_note text,
  admit_card_sem      int,
  admit_card_fee      numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s          students%ROWTYPE;
  total_sems int;
  is_year    boolean;
  cur        int;
  per_year   int;
  total_term int;
  collected  numeric;
  n          int;
  cum        numeric;
  ac_sem     int := NULL;
  ac_fee     numeric := 0;
  rr_fee     numeric := 0;
  rr_note    text := NULL;
  pending    boolean;
BEGIN
  SELECT * INTO s FROM students st
  WHERE regexp_replace(COALESCE(st.mobile_no, ''), '\D', '', 'g')
        = regexp_replace(COALESCE(p_mobile, ''), '\D', '', 'g')
    AND (upper(COALESCE(st.admission_number, '')) = upper(btrim(p_ref))
      OR upper(COALESCE(st.enrollment_no, ''))    = upper(btrim(p_ref))
      OR upper(COALESCE(st.registration_no, ''))  = upper(btrim(p_ref)))
  LIMIT 1;

  IF s.id IS NULL THEN
    RETURN QUERY SELECT false, NULL::text, NULL::text, NULL::text, NULL::text,
      NULL::text, NULL::text, NULL::text, NULL::text, NULL::text, NULL::text,
      NULL::text, NULL::numeric, NULL::numeric, NULL::text, NULL::int, NULL::numeric;
    RETURN;
  END IF;

  SELECT GREATEST(COALESCE(p.duration, 1), 1) INTO total_sems FROM programs p WHERE p.id = s.programme_id;
  collected := COALESCE(s.fee_collected, 0);
  is_year   := COALESCE(s.semester_year, '') ~* 'year';
  cur       := GREATEST(COALESCE(NULLIF(regexp_replace(COALESCE(s.semester_year,''), '\D', '', 'g'), '')::int, 1), 1);
  per_year  := CASE WHEN is_year THEN 2 ELSE 1 END;
  total_term := CASE WHEN is_year THEN GREATEST(ROUND(total_sems / 2.0), 1) ELSE total_sems END;

  -- Re-registration: the difference between the two terms' cumulative fees.
  SELECT EXISTS (SELECT 1 FROM re_registrations r
                 WHERE r.student_id = s.id AND r.status = 'Pending') INTO pending;
  IF s.status <> 'Approved' THEN
    rr_note := 'Re-registration opens once the admission is approved.';
  ELSIF cur >= total_term THEN
    rr_note := 'This is the final term of the course.';
  ELSIF pending THEN
    rr_note := 'A re-registration request is already awaiting approval.';
  ELSE
    rr_fee := GREATEST(
      course_fee_upto(s.programme_id, s.session_id, (cur + 1) * per_year)
      - course_fee_upto(s.programme_id, s.session_id, cur * per_year), 0);
  END IF;

  -- Admit card: the first semester whose cumulative fee is not yet covered.
  FOR n IN 1..total_sems LOOP
    cum := course_fee_upto(s.programme_id, s.session_id, n);
    IF collected + 1 < cum THEN
      ac_sem := n;
      ac_fee := cum - collected;
      EXIT;
    END IF;
  END LOOP;

  RETURN QUERY
  SELECT true, s.student_name, s.admission_number, s.enrollment_no, s.email, s.mobile_no,
    p.program_name, ses.session_name, c.center_name, s.status,
    COALESCE(s.semester_year, ''),
    CASE WHEN cur >= total_term THEN NULL
         ELSE ordinal(cur + 1) || CASE WHEN is_year THEN ' Year' ELSE ' Semester' END END,
    collected, rr_fee, rr_note, ac_sem, ac_fee
  FROM programs p
  LEFT JOIN academic_sessions ses ON ses.id = s.session_id
  LEFT JOIN centers c ON c.id = s.center_id
  WHERE p.id = s.programme_id;
END $$;

-- What the student is ABOUT to pay for, written before they are sent to PayU.
-- PayU hands the callback only the transaction id, so the intent is what lets
-- the callback know which student and which fee the money belongs to — without
-- trusting anything that came back over the wire.
CREATE TABLE IF NOT EXISTS student_payment_intents (
  txn_id     text PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  kind       text NOT NULL,
  amount     numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE student_payment_intents ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'student_payment_intents' LOOP
    EXECUTE format('DROP POLICY %I ON student_payment_intents', p.policyname);
  END LOOP;
END $$;
CREATE POLICY spi_admin_all ON student_payment_intents
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Step 1 — the student presses Pay. Re-checks the amount against what is
-- actually owed, so a tampered browser cannot pay ₹1 for a ₹4,000 fee.
CREATE OR REPLACE FUNCTION student_payment_intent(
  p_ref text, p_mobile text, p_kind text, p_amount numeric, p_txn text)
RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  f   record;
  sid uuid;
BEGIN
  IF btrim(COALESCE(p_txn, '')) = '' OR COALESCE(p_amount, 0) <= 0
     OR p_kind NOT IN ('re_registration', 'admit_card') THEN
    RETURN false;
  END IF;

  SELECT * INTO f FROM student_fee_lookup(p_ref, p_mobile);
  IF NOT COALESCE(f.found, false) THEN RETURN false; END IF;

  -- The amount must match what the database says is owed.
  IF (p_kind = 're_registration' AND p_amount <> COALESCE(f.re_registration_fee, 0))
     OR (p_kind = 'admit_card'  AND p_amount <> COALESCE(f.admit_card_fee, 0)) THEN
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
END $$;

-- Step 2 — PayU confirms the payment. Credits students.fee_collected (which is
-- what unlocks the admit card) and, for a re-registration, raises the request
-- the admin approves. Idempotent: the unique txn id means the browser callback
-- and the server-to-server webhook can both fire without paying twice.
-- Returns false when the txn id belongs to something else (e.g. an approval
-- code), which is how the caller tells the two flows apart.
CREATE OR REPLACE FUNCTION student_payment_confirm(p_txn text)
RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  i        student_payment_intents%ROWTYPE;
  s        students%ROWTYPE;
  is_year  boolean;
  cur      int;
  inserted int;
BEGIN
  SELECT * INTO i FROM student_payment_intents WHERE txn_id = btrim(COALESCE(p_txn, ''));
  IF i.txn_id IS NULL THEN RETURN false; END IF;

  INSERT INTO student_online_payments (student_id, kind, amount, txn_id)
  VALUES (i.student_id, i.kind, i.amount, i.txn_id)
  ON CONFLICT (txn_id) DO NOTHING;
  GET DIAGNOSTICS inserted = ROW_COUNT;
  IF inserted = 0 THEN
    RETURN true;   -- already recorded: still "ours", but do not credit twice
  END IF;

  UPDATE students SET fee_collected = COALESCE(fee_collected, 0) + i.amount
  WHERE id = i.student_id;

  IF i.kind = 're_registration' THEN
    SELECT * INTO s FROM students WHERE id = i.student_id;
    is_year := COALESCE(s.semester_year, '') ~* 'year';
    cur := GREATEST(COALESCE(NULLIF(regexp_replace(COALESCE(s.semester_year,''), '\D', '', 'g'), '')::int, 1), 1);
    INSERT INTO re_registrations (student_id, center_id, session_id, from_term, to_term, fee_amount, status, remarks)
    SELECT s.id, s.center_id, s.session_id, s.semester_year,
      ordinal(cur + 1) || CASE WHEN is_year THEN ' Year' ELSE ' Semester' END,
      i.amount, 'Pending', 'Paid online by the student · ' || i.txn_id
    WHERE NOT EXISTS (SELECT 1 FROM re_registrations r
                      WHERE r.student_id = s.id AND r.status = 'Pending');
  END IF;

  RETURN true;
END $$;

-- ------------------------------------------------------------
-- Grants: the website is anon. Nothing else about the tables changes.
-- ------------------------------------------------------------
REVOKE ALL ON FUNCTION course_fee_upto(uuid, uuid, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION approval_code_lookup(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION approval_code_mark_paid(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION student_fee_lookup(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION student_payment_intent(text, text, text, numeric, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION student_payment_confirm(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION approval_code_lookup(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION approval_code_mark_paid(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION student_fee_lookup(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION student_payment_intent(text, text, text, numeric, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION student_payment_confirm(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION course_fee_upto(uuid, uuid, int) TO authenticated;

SELECT 'website public API ready' AS result;
