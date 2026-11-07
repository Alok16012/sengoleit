-- ============================================================
-- SECURITY STEP 2 — Row Level Security on the core tables.
--
-- WHY
--   students, centers, profiles and the reference tables had RLS switched
--   OFF, so every login saw every row: any centre could read and edit all 443
--   students of all 28 centres, every centre's passwords / KYC / bank details,
--   and every login's profile — including setting its own role to 'admin'.
--   Policies existed for most of them but were never enforced.
--
-- WHAT THIS DOES
--   1. Helper functions (SECURITY DEFINER, so policies can use them without
--      re-triggering RLS and recursing):
--        my_own_center_ids()  — the centre row(s) this login owns
--        my_center_scope()    — own centre + (for a super centre) its centres
--        is_staging_login()   — this login is a Staging centre
--   2. Functions for the two places that legitimately need ALL rows:
--        next_center_application_no()      — CA/001/NNNN numbering
--        student_number_taken(col, value)  — is an admission / registration /
--        student_numbers_issued(col)         enrollment number already used
--   3. students — admin all; a centre its own students; a super centre its
--      own and its centres' students; Document Dept read/update.
--   4. centers — admin all; a centre reads/updates its own row; a super
--      centre reads/creates/updates its centres; a Staging centre reads all
--      (to pick a transfer target); Document Dept read/update; the public
--      registration form inserts a pending centre and reads only the safe
--      columns granted to anon in step 1b.
--   5. profiles — a login reads its own row and can create it only as
--      'center' / 'student'; it can no longer change its own role. Admin all.
--   6. Reference tables (programmes, sessions, fees, locations …) — everyone
--      reads; only the admin writes.
--
-- The old centre / student policies read auth.users, which a login cannot
-- read — with RLS on they would have errored — so they are replaced, and
-- e-mails are compared case-insensitively.
--
-- Undo: rollback_security_step2.sql.   Safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Helpers
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION my_own_center_ids() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM centers
  WHERE lower(email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
$$;

CREATE OR REPLACE FUNCTION my_center_scope() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH me AS (
    SELECT id FROM centers WHERE lower(email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
  )
  SELECT id FROM me
  UNION
  SELECT c.id FROM centers c JOIN me ON c.super_center_id = me.id
$$;

CREATE OR REPLACE FUNCTION is_staging_login() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM centers
    WHERE lower(email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
      AND COALESCE(is_staging, false)
  )
$$;

-- ------------------------------------------------------------
-- 2. Numbering that has to see every row
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION next_center_application_no() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT 'CA/001/' || lpad((COALESCE(MAX(substring(application_no FROM '^CA/001/(\d+)$')::int), 0) + 1)::text, 4, '0')
  FROM centers WHERE application_no ~ '^CA/001/\d+$'
$$;

CREATE OR REPLACE FUNCTION student_number_taken(p_column text, p_value text) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE hit boolean;
BEGIN
  IF p_column NOT IN ('admission_number', 'registration_no', 'enrollment_no') THEN
    RAISE EXCEPTION 'Unknown number column %', p_column;
  END IF;
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first.'; END IF;
  EXECUTE format('SELECT EXISTS (SELECT 1 FROM students WHERE %I = $1)', p_column) INTO hit USING p_value;
  RETURN hit;
END $$;

CREATE OR REPLACE FUNCTION student_numbers_issued(p_column text) RETURNS integer
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF p_column NOT IN ('admission_number', 'registration_no', 'enrollment_no') THEN
    RAISE EXCEPTION 'Unknown number column %', p_column;
  END IF;
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first.'; END IF;
  EXECUTE format('SELECT count(*) FROM students WHERE %I IS NOT NULL AND %I <> ''''', p_column, p_column) INTO n;
  RETURN n;
END $$;

REVOKE ALL ON FUNCTION student_number_taken(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION student_numbers_issued(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION student_number_taken(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION student_numbers_issued(text) TO authenticated;
GRANT EXECUTE ON FUNCTION next_center_application_no() TO anon, authenticated;

-- ------------------------------------------------------------
-- 3. students
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Center manage own students" ON students;
DROP POLICY IF EXISTS center_scope_students ON students;
CREATE POLICY center_scope_students ON students
  FOR ALL TO authenticated
  USING (center_id IN (SELECT my_center_scope()))
  WITH CHECK (center_id IN (SELECT my_center_scope()));
-- Kept as they are: "Admin full access", doc_dept_read_students, doc_dept_update_students.
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 4. centers
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Center own record" ON centers;
DROP POLICY IF EXISTS "super_center can read own sub-centers" ON centers;   -- recursive
DROP POLICY IF EXISTS super_center_read_sub_centers ON centers;            -- recursive

DROP POLICY IF EXISTS center_own_read ON centers;
CREATE POLICY center_own_read ON centers
  FOR SELECT TO authenticated USING (id IN (SELECT my_own_center_ids()));
DROP POLICY IF EXISTS center_own_update ON centers;
CREATE POLICY center_own_update ON centers
  FOR UPDATE TO authenticated
  USING (id IN (SELECT my_own_center_ids()))
  WITH CHECK (id IN (SELECT my_own_center_ids()));

DROP POLICY IF EXISTS super_center_insert_children ON centers;
CREATE POLICY super_center_insert_children ON centers
  FOR INSERT TO authenticated WITH CHECK (super_center_id = my_super_center_id());
DROP POLICY IF EXISTS super_center_update_children ON centers;
CREATE POLICY super_center_update_children ON centers
  FOR UPDATE TO authenticated
  USING (super_center_id = my_super_center_id())
  WITH CHECK (super_center_id = my_super_center_id());
-- Kept: "Super center read children" (SELECT, super_center_id = my_super_center_id()).

DROP POLICY IF EXISTS staging_read_centers ON centers;
CREATE POLICY staging_read_centers ON centers
  FOR SELECT TO authenticated USING (is_staging_login());

-- The public registration form: rows are visible to anon, but step 1b left
-- anon only the safe columns, so this exposes nothing private.
DROP POLICY IF EXISTS anon_read_public_columns ON centers;
CREATE POLICY anon_read_public_columns ON centers
  FOR SELECT TO anon USING (true);
-- Kept: "Admin full access", allow_public_center_registration (INSERT, pending
-- centre only), doc_dept_read_centers, doc_dept_update_centers.
ALTER TABLE centers ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 5. profiles
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Own profile" ON profiles;
DROP POLICY IF EXISTS "Allow insert on signup" ON profiles;

DROP POLICY IF EXISTS profile_own_read ON profiles;
CREATE POLICY profile_own_read ON profiles
  FOR SELECT TO authenticated USING (id = auth.uid());
DROP POLICY IF EXISTS profile_own_insert ON profiles;
CREATE POLICY profile_own_insert ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() AND role IN ('center', 'student'));
DROP POLICY IF EXISTS profile_admin_all ON profiles;
CREATE POLICY profile_admin_all ON profiles
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 6. Reference tables — everyone reads, only the admin writes
-- ------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'academic_sessions', 'app_settings', 'boards', 'center_courses', 'countries',
    'course_syllabus_pdfs', 'departments', 'districts', 'exam_schedules',
    'fee_items', 'fee_structures', 'programme_types', 'programs', 'schemes',
    'states', 'study_modes', 'syllabus_subjects', 'universities'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS ref_read_all ON %I', t);
    EXECUTE format('CREATE POLICY ref_read_all ON %I FOR SELECT TO anon, authenticated USING (true)', t);
    EXECUTE format('DROP POLICY IF EXISTS ref_admin_write ON %I', t);
    EXECUTE format('CREATE POLICY ref_admin_write ON %I FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin())', t);
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- approval_code_requests — a centre's own requests; admin all.
DROP POLICY IF EXISTS acr_center_own ON approval_code_requests;
CREATE POLICY acr_center_own ON approval_code_requests
  FOR ALL TO authenticated
  USING (center_id IN (SELECT my_center_scope()))
  WITH CHECK (center_id IN (SELECT my_center_scope()));
DROP POLICY IF EXISTS acr_admin_all ON approval_code_requests;
CREATE POLICY acr_admin_all ON approval_code_requests
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
ALTER TABLE approval_code_requests ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';

SELECT 'step 2 done — row level security is on' AS result;
