-- ROLLBACK for security_step2_rls.sql — only if a portal stopped working.
-- Switches RLS back off on the tables step 2 turned it on for and restores
-- the policies it replaced, exactly as they were. Leaves the new helper
-- functions in place (unused, harmless).

ALTER TABLE students DISABLE ROW LEVEL SECURITY;
ALTER TABLE centers DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE approval_code_requests DISABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'academic_sessions', 'app_settings', 'boards', 'center_courses', 'countries',
    'course_syllabus_pdfs', 'departments', 'districts', 'exam_schedules',
    'fee_items', 'fee_structures', 'programme_types', 'programs', 'schemes',
    'states', 'study_modes', 'syllabus_subjects', 'universities'
  ] LOOP
    EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- students
DROP POLICY IF EXISTS center_scope_students ON students;
CREATE POLICY "Center manage own students" ON students FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM centers WHERE centers.id = students.center_id
                 AND centers.email = (SELECT users.email FROM auth.users WHERE users.id = auth.uid())::text))
  WITH CHECK (EXISTS (SELECT 1 FROM centers WHERE centers.id = students.center_id
                 AND centers.email = (SELECT users.email FROM auth.users WHERE users.id = auth.uid())::text));

-- centers
DROP POLICY IF EXISTS center_own_read ON centers;
DROP POLICY IF EXISTS center_own_update ON centers;
DROP POLICY IF EXISTS super_center_insert_children ON centers;
DROP POLICY IF EXISTS super_center_update_children ON centers;
DROP POLICY IF EXISTS staging_read_centers ON centers;
DROP POLICY IF EXISTS anon_read_public_columns ON centers;
CREATE POLICY "Center own record" ON centers FOR ALL TO authenticated
  USING ((email = (SELECT users.email FROM auth.users WHERE users.id = auth.uid())::text)
         OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'))
  WITH CHECK ((email = (SELECT users.email FROM auth.users WHERE users.id = auth.uid())::text)
         OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "super_center can read own sub-centers" ON centers FOR SELECT
  USING (super_center_id IN (SELECT centers_1.id FROM centers centers_1 WHERE centers_1.email = auth.email()));
CREATE POLICY super_center_read_sub_centers ON centers FOR SELECT
  USING (super_center_id IN (SELECT centers_1.id FROM centers centers_1 WHERE centers_1.email = auth.email()));

-- profiles
DROP POLICY IF EXISTS profile_own_read ON profiles;
DROP POLICY IF EXISTS profile_own_insert ON profiles;
DROP POLICY IF EXISTS profile_admin_all ON profiles;
CREATE POLICY "Own profile" ON profiles FOR ALL TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "Allow insert on signup" ON profiles FOR INSERT WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
SELECT 'step 2 rolled back' AS result;
