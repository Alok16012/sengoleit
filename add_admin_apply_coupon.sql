-- Admin applies an Admission or Course Coupon to a student after entry
-- (the centre forgot to apply it on the admission form).
--
--   * The coupon is marked used and written onto the student, so every fee
--     screen (re-registration, exam, admit card) charges that much less.
--   * p_refund: the part of the coupon the centre had ALREADY paid. It goes
--     back to the centre wallet and comes off the student's fee_collected,
--     with a 'coupon_refund' line in the fee ledger. The page works it out
--     from the fee structure; here it is only capped (never more than the
--     coupon, never more than was collected).
--
-- All in one transaction: any failed check changes nothing.
-- Run once in Supabase -> SQL Editor. Safe to re-run.

CREATE OR REPLACE FUNCTION admin_apply_late_coupon(
  p_student uuid,
  p_coupon  uuid,
  p_refund  numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  st record; cp record;
  v_amount numeric;
  v_refund numeric;
  v_kind text;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only the university admin can apply a coupon to a student.';
  END IF;

  SELECT * INTO st FROM students WHERE id = p_student FOR UPDATE;
  IF st.id IS NULL THEN RAISE EXCEPTION 'Student not found.'; END IF;

  SELECT * INTO cp FROM coupons WHERE id = p_coupon FOR UPDATE;
  IF cp.id IS NULL THEN RAISE EXCEPTION 'Coupon not found.'; END IF;
  IF coalesce(cp.is_used, false) OR cp.used_at IS NOT NULL THEN
    RAISE EXCEPTION 'Coupon % is already used.', cp.coupon_code;
  END IF;

  v_kind := CASE coalesce(cp.coupon_type, 'discount')
              WHEN 'discount' THEN 'admission'
              WHEN 'course'   THEN 'course'
              ELSE NULL END;
  IF v_kind IS NULL THEN
    RAISE EXCEPTION 'Only an Admission or Course Coupon can be applied to a student.';
  END IF;
  IF cp.center_id IS DISTINCT FROM st.center_id THEN
    RAISE EXCEPTION 'Coupon % belongs to a different centre than this student.', cp.coupon_code;
  END IF;
  IF v_kind = 'course' AND cp.program_id IS NOT NULL AND cp.program_id IS DISTINCT FROM st.programme_id THEN
    RAISE EXCEPTION 'Course Coupon % is for a different course than this student.', cp.coupon_code;
  END IF;
  IF v_kind = 'admission' AND coalesce(st.coupon_discount, 0) > 0 THEN
    RAISE EXCEPTION 'This student already has an Admission Coupon (%).', coalesce(st.coupon_code, '—');
  END IF;
  IF v_kind = 'course' AND coalesce(st.course_coupon_discount, 0) > 0 THEN
    RAISE EXCEPTION 'This student already has a Course Coupon (%).', coalesce(st.course_coupon_code, '—');
  END IF;

  v_amount := round(coalesce(cp.face_value, 0));
  IF v_amount <= 0 THEN RAISE EXCEPTION 'Coupon % has no amount.', cp.coupon_code; END IF;
  v_refund := least(greatest(round(coalesce(p_refund, 0)), 0), v_amount, coalesce(st.fee_collected, 0));

  UPDATE coupons SET is_used = true, used_at = now() WHERE id = cp.id;

  IF v_kind = 'admission' THEN
    UPDATE students SET coupon_discount = v_amount, coupon_code = upper(cp.coupon_code) WHERE id = st.id;
  ELSE
    UPDATE students SET course_coupon_discount = v_amount, course_coupon_code = upper(cp.coupon_code),
                        course_coupon_program_id = st.programme_id WHERE id = st.id;
  END IF;

  IF v_refund > 0 THEN
    UPDATE centers SET virtual_balance = coalesce(virtual_balance, 0) + v_refund WHERE id = st.center_id;
    UPDATE students SET fee_collected = greatest(coalesce(fee_collected, 0) - v_refund, 0) WHERE id = st.id;
    INSERT INTO student_fee_ledger (student_id, center_id, amount, kind, term, note)
    VALUES (st.id, st.center_id, -v_refund, 'coupon_refund', st.semester_year,
            'Coupon ' || upper(cp.coupon_code) || ' applied by admin — ₹' || v_refund
            || ' returned to the centre wallet.');
  END IF;

  RETURN jsonb_build_object('kind', v_kind, 'amount', v_amount, 'refund', v_refund,
                            'code', upper(cp.coupon_code));
END $$;

GRANT EXECUTE ON FUNCTION admin_apply_late_coupon(uuid, uuid, numeric) TO authenticated;
