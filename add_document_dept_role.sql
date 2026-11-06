-- Document Verification login — a staff role that sees only the Document Dept.
--
-- A user whose profiles.role is 'document_dept' can:
--   * read every student, and update them (verify / hold / reject / forward),
--   * read and update centers (Center / Super Center Applications),
--   * read programmes, sessions and universities for the lists.
-- It is NOT an admin: is_admin() stays false for it, so wallets, coupons,
-- fees, recharges, results and every admin-only RPC stay closed to it. The
-- app also keeps it on the Document Dept page.
--
-- Run once in Supabase -> SQL Editor. Safe to re-run.

-- 1. Allow the new role on profiles.
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'center', 'student', 'document_dept'));

-- 2. Who is Document Dept staff — SECURITY DEFINER so policies that call it
--    do not re-trigger RLS on profiles.
CREATE OR REPLACE FUNCTION is_doc_dept() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'document_dept')
$$;

-- 3. What it may read and change.
DROP POLICY IF EXISTS doc_dept_read_students ON students;
CREATE POLICY doc_dept_read_students ON students
  FOR SELECT TO authenticated USING (is_doc_dept());
DROP POLICY IF EXISTS doc_dept_update_students ON students;
CREATE POLICY doc_dept_update_students ON students
  FOR UPDATE TO authenticated USING (is_doc_dept()) WITH CHECK (is_doc_dept());

DROP POLICY IF EXISTS doc_dept_read_centers ON centers;
CREATE POLICY doc_dept_read_centers ON centers
  FOR SELECT TO authenticated USING (is_doc_dept());
DROP POLICY IF EXISTS doc_dept_update_centers ON centers;
CREATE POLICY doc_dept_update_centers ON centers
  FOR UPDATE TO authenticated USING (is_doc_dept()) WITH CHECK (is_doc_dept());

DROP POLICY IF EXISTS doc_dept_read_programs ON programs;
CREATE POLICY doc_dept_read_programs ON programs
  FOR SELECT TO authenticated USING (is_doc_dept());
DROP POLICY IF EXISTS doc_dept_read_sessions ON academic_sessions;
CREATE POLICY doc_dept_read_sessions ON academic_sessions
  FOR SELECT TO authenticated USING (is_doc_dept());
DROP POLICY IF EXISTS doc_dept_read_universities ON universities;
CREATE POLICY doc_dept_read_universities ON universities
  FOR SELECT TO authenticated USING (is_doc_dept());

NOTIFY pgrst, 'reload schema';

SELECT 'document_dept role ready' AS result;

-- ------------------------------------------------------------
-- 4. Make a login a Document Dept login (run AFTER creating the user in
--    Authentication -> Users -> Add user). Put that user's email below.
-- ------------------------------------------------------------
-- INSERT INTO profiles (id, role)
-- SELECT id, 'document_dept' FROM auth.users WHERE email = 'docverify@sengol.com'
-- ON CONFLICT (id) DO UPDATE SET role = 'document_dept';
