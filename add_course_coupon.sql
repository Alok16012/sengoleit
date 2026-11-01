-- Course Discount Coupon — a third kind of coupon, tied to one programme
-- (course) at one center, that cuts the COURSE FEE ITSELF at admission —
-- before the existing admission ("Discounted Coupon") cuts the 50%
-- required-at-entry amount on top of that already-reduced fee.
--
-- 'approval' and 'discount' coupons are generated one at a time (Generate
-- Code). A course coupon is generated in a QUANTITY, since a center is
-- typically handed several at once for the same course — so a dedicated
-- admin_create_course_coupons() loops and inserts p_quantity rows.
--
-- Run once in Supabase -> SQL Editor, after add_coupon_type.sql,
-- add_admin_coupon_rpcs.sql and add_student_coupon_discount.sql. Safe to re-run.

-- Which course a coupon is for. Null for 'approval' / 'discount' coupons.
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS program_id uuid REFERENCES programs(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_coupons_program ON coupons(program_id);

-- What the course coupon did to this student's admission — kept separate
-- from coupon_discount / coupon_code (the admission coupon's own fields) so
-- the two can be audited, edited and reported on independently.
ALTER TABLE students ADD COLUMN IF NOT EXISTS course_coupon_discount numeric;
ALTER TABLE students ADD COLUMN IF NOT EXISTS course_coupon_code text;
-- Deliberately NOT a foreign key: students.programme_id already references
-- programs(id), and a second FK from students to programs makes every
-- embedded select ("students ... programs(...)") ambiguous — PostgREST
-- cannot tell which relationship to use and refuses the whole query. Nothing
-- joins through this column; it is read straight off the student row.
ALTER TABLE students ADD COLUMN IF NOT EXISTS course_coupon_program_id uuid;

-- Let both existing single/batch coupon RPCs accept the new type.
CREATE OR REPLACE FUNCTION admin_create_single_coupon(
  p_center_id uuid,
  p_face_value numeric,
  p_coupon_type text DEFAULT 'discount'
)
RETURNS TABLE (id uuid, coupon_code text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_code text;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only the university admin can create coupons.';
  END IF;
  IF p_center_id IS NULL THEN
    RAISE EXCEPTION 'Center is required.';
  END IF;
  IF p_face_value IS NULL OR p_face_value < 1 THEN
    RAISE EXCEPTION 'Face value must be at least ₹1.';
  END IF;
  IF p_coupon_type NOT IN ('discount', 'approval', 'course') THEN
    RAISE EXCEPTION 'Unknown coupon type %.', p_coupon_type;
  END IF;

  v_code := substr(upper(md5(random()::text || clock_timestamp()::text)), 1, 8);

  INSERT INTO coupons (center_id, face_value, coupon_type, coupon_code)
  VALUES (p_center_id, p_face_value, p_coupon_type, v_code)
  RETURNING coupons.id, coupons.coupon_code INTO id, coupon_code;

  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION mint_coupon_batch(
  p_center uuid,
  p_count  int,
  p_value  numeric,
  p_type   text DEFAULT 'discount'
)
RETURNS TABLE (batch_id uuid, minted int, wallet_after numeric)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  bal   numeric;
  total numeric;
  bid   uuid := gen_random_uuid();
  MAX_ROWS constant int := 2000;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only the university admin can mint coupons.';
  END IF;
  IF p_count IS NULL OR p_count < 1 THEN
    RAISE EXCEPTION 'Enter how many coupons to create.';
  END IF;
  IF p_value IS NULL OR p_value < 1 THEN
    RAISE EXCEPTION 'Enter the value of each coupon.';
  END IF;
  IF p_count > MAX_ROWS THEN
    RAISE EXCEPTION 'A batch is limited to % coupons; % were asked for.', MAX_ROWS, p_count;
  END IF;
  IF p_type NOT IN ('discount', 'approval', 'course') THEN
    RAISE EXCEPTION 'Unknown coupon type %.', p_type;
  END IF;

  total := p_count * p_value;

  SELECT coupon_wallet_balance INTO bal FROM centers WHERE id = p_center FOR UPDATE;
  IF bal IS NULL THEN
    RAISE EXCEPTION 'Centre not found.';
  END IF;
  IF bal < total THEN
    RAISE EXCEPTION 'The coupon wallet holds % but % is needed.', bal, total;
  END IF;

  PERFORM set_config('app.wallet_write', 'on', true);
  UPDATE centers SET coupon_wallet_balance = bal - total WHERE id = p_center;

  INSERT INTO coupons (center_id, face_value, coupon_type, mint_batch_id)
  SELECT p_center, p_value, p_type, bid FROM generate_series(1, p_count);

  batch_id := bid; minted := p_count; wallet_after := bal - total;
  RETURN NEXT;
END;
$$;

-- A course coupon is handed out free (like approval/discount single codes —
-- no coupon wallet involved), but several at a time for the same course, so
-- it gets its own RPC rather than overloading admin_create_single_coupon's
-- one-row return shape.
CREATE OR REPLACE FUNCTION admin_create_course_coupons(
  p_center_id uuid,
  p_program_id uuid,
  p_face_value numeric,
  p_quantity int DEFAULT 1
)
RETURNS TABLE (id uuid, coupon_code text)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  i int;
  v_code text;
  v_id uuid;
  MAX_ROWS constant int := 2000;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Only the university admin can create coupons.';
  END IF;
  IF p_center_id IS NULL THEN
    RAISE EXCEPTION 'Center is required.';
  END IF;
  IF p_program_id IS NULL THEN
    RAISE EXCEPTION 'Course is required.';
  END IF;
  IF p_face_value IS NULL OR p_face_value < 1 THEN
    RAISE EXCEPTION 'Amount must be at least ₹1.';
  END IF;
  IF p_quantity IS NULL OR p_quantity < 1 THEN
    RAISE EXCEPTION 'Quantity must be at least 1.';
  END IF;
  IF p_quantity > MAX_ROWS THEN
    RAISE EXCEPTION 'A batch is limited to % coupons; % were asked for.', MAX_ROWS, p_quantity;
  END IF;

  FOR i IN 1..p_quantity LOOP
    v_code := substr(upper(md5(random()::text || clock_timestamp()::text || i::text)), 1, 8);
    INSERT INTO coupons (center_id, program_id, face_value, coupon_type, coupon_code)
    VALUES (p_center_id, p_program_id, p_face_value, 'course', v_code)
    RETURNING coupons.id INTO v_id;
    id := v_id; coupon_code := v_code;
    RETURN NEXT;
  END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';

SELECT 'Course coupons ready' AS result;
