-- Apply coupons that were missed at admission, for four students.
--
--   Yatee Yadav     EN25PGDCA0012  Course Coupon    D363C901       ₹1600, fee already
--                                  collected, so ₹1600 goes back to the centre wallet.
--   Satish Kumar    EN25PGDCA0015  Course Coupon    CE37DAD2       ₹1600 (re-registration
--                                  due 4000 -> 2400).
--   Himanshu Patel  EN25PGDCA0014  Admission Coupon CPNC774C92A18  ₹1500 (due 3200 -> 1700).
--   Sandeep Kumar   EN25PGDCA0013  Admission Coupon CPN37D8E5E886  ₹1500 (due 3200 -> 1700).
--
-- Each coupon must exist, be unused, be of the right type, belong to the
-- student's centre and carry the expected amount. If ANY check fails nothing
-- at all is changed (one transaction) and the error says which one.
-- Safe to re-run: a student who already carries the coupon is skipped.
--
-- Run once in Supabase -> SQL Editor.

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.apply_late_coupon(
  p_enrollment text, p_code text, p_kind text, p_amount numeric, p_refund boolean)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  st record; cp record;
  want_type text := CASE p_kind WHEN 'admission' THEN 'discount' ELSE 'course' END;
BEGIN
  SELECT * INTO st FROM students WHERE enrollment_no = p_enrollment;
  IF st.id IS NULL THEN RAISE EXCEPTION 'No student with enrollment %', p_enrollment; END IF;

  -- Already applied (a re-run): leave it alone.
  IF (p_kind = 'admission' AND upper(coalesce(st.coupon_code, '')) = upper(p_code))
  OR (p_kind = 'course' AND upper(coalesce(st.course_coupon_code, '')) = upper(p_code)) THEN
    RETURN p_enrollment || ': already has ' || p_code || ' — skipped';
  END IF;
  IF p_kind = 'admission' AND coalesce(st.coupon_discount, 0) > 0 THEN
    RAISE EXCEPTION '% already has an admission coupon (%)', p_enrollment, st.coupon_code;
  END IF;
  IF p_kind = 'course' AND coalesce(st.course_coupon_discount, 0) > 0 THEN
    RAISE EXCEPTION '% already has a course coupon (%)', p_enrollment, st.course_coupon_code;
  END IF;

  SELECT * INTO cp FROM coupons WHERE upper(coupon_code) = upper(p_code) FOR UPDATE;
  IF cp.id IS NULL THEN RAISE EXCEPTION 'Coupon % not found', p_code; END IF;
  IF coalesce(cp.is_used, false) OR cp.used_at IS NOT NULL THEN
    RAISE EXCEPTION 'Coupon % is already used', p_code;
  END IF;
  IF coalesce(cp.coupon_type, 'discount') <> want_type THEN
    RAISE EXCEPTION 'Coupon % is a % coupon, expected %', p_code, cp.coupon_type, want_type;
  END IF;
  IF cp.center_id IS DISTINCT FROM st.center_id THEN
    RAISE EXCEPTION 'Coupon % belongs to a different centre than %', p_code, p_enrollment;
  END IF;
  IF p_kind = 'course' AND cp.program_id IS NOT NULL AND cp.program_id <> st.programme_id THEN
    RAISE EXCEPTION 'Course coupon % is for a different programme than %', p_code, p_enrollment;
  END IF;
  IF round(cp.face_value) <> p_amount THEN
    RAISE EXCEPTION 'Coupon % is worth %, expected %', p_code, cp.face_value, p_amount;
  END IF;

  UPDATE coupons SET is_used = true, used_at = now() WHERE id = cp.id;

  IF p_kind = 'admission' THEN
    UPDATE students SET coupon_discount = p_amount, coupon_code = upper(p_code) WHERE id = st.id;
  ELSE
    UPDATE students SET course_coupon_discount = p_amount, course_coupon_code = upper(p_code),
                        course_coupon_program_id = st.programme_id WHERE id = st.id;
  END IF;

  -- The fee was already taken in full: give the coupon's worth back to the
  -- centre wallet and take it off what was collected for this student.
  IF p_refund THEN
    UPDATE centers SET virtual_balance = coalesce(virtual_balance, 0) + p_amount WHERE id = st.center_id;
    UPDATE students SET fee_collected = greatest(coalesce(fee_collected, 0) - p_amount, 0) WHERE id = st.id;
    INSERT INTO student_fee_ledger (student_id, center_id, amount, kind, term, note)
    -- Its own kind: the ledger allows only one 'admission' line per student.
    VALUES (st.id, st.center_id, -p_amount, 'coupon_refund', st.semester_year,
            'Coupon ' || upper(p_code) || ' applied late — ₹' || p_amount || ' returned to the centre wallet.');
  END IF;

  RETURN p_enrollment || ': ' || upper(p_code) || ' applied (₹' || p_amount || ')'
         || CASE WHEN p_refund THEN ', ₹' || p_amount || ' returned to wallet' ELSE '' END;
END $$;

SELECT pg_temp.apply_late_coupon('EN25PGDCA0012', 'D363C901',      'course',    1600, true)  AS result
UNION ALL
SELECT pg_temp.apply_late_coupon('EN25PGDCA0015', 'CE37DAD2',      'course',    1600, false)
UNION ALL
SELECT pg_temp.apply_late_coupon('EN25PGDCA0014', 'CPNC774C92A18', 'admission', 1500, false)
UNION ALL
SELECT pg_temp.apply_late_coupon('EN25PGDCA0013', 'CPN37D8E5E886', 'admission', 1500, false);

COMMIT;

-- Check afterwards:
SELECT s.enrollment_no, s.student_name, s.fee_collected, s.coupon_code, s.coupon_discount,
       s.course_coupon_code, s.course_coupon_discount, c.center_name, c.virtual_balance
FROM students s LEFT JOIN centers c ON c.id = s.center_id
WHERE s.enrollment_no IN ('EN25PGDCA0012', 'EN25PGDCA0013', 'EN25PGDCA0014', 'EN25PGDCA0015');
