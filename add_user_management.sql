-- ============================================================
-- USER MANAGEMENT — custom roles with ticked permissions, enforced in the
-- database as well as the app.
--
--   app_roles               a role: name, description, permissions text[]
--   profiles.role='staff'   a staff login; profiles.app_role_id is its role
--   has_perm('x.y')         true for the admin, or an active staff login whose
--                           role has that permission
--   perm_table_access       which permission may read (r) / write (w) which
--                           table — every staff policy reads from it
--
-- Permission keys are the ones in src/utils/permissions.js.
-- Needs security_step2_rls.sql. Run once in Supabase -> SQL Editor.
-- Safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Roles and staff logins
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  description text,
  permissions text[] NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS app_role_id uuid REFERENCES app_roles(id) ON DELETE SET NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'center', 'student', 'document_dept', 'staff'));

-- ------------------------------------------------------------
-- 2. Permission checks
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION my_permissions() RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(r.permissions, '{}')
  FROM profiles p JOIN app_roles r ON r.id = p.app_role_id
  WHERE p.id = auth.uid() AND p.role = 'staff' AND p.is_active
$$;

CREATE OR REPLACE FUNCTION has_perm(p_perm text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT is_admin() OR COALESCE(p_perm = ANY (my_permissions()), false)
$$;

CREATE OR REPLACE FUNCTION has_any_perm(p_perms text[]) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT is_admin() OR COALESCE(my_permissions() && p_perms, false)
$$;

GRANT EXECUTE ON FUNCTION my_permissions() TO authenticated;
GRANT EXECUTE ON FUNCTION has_perm(text) TO authenticated;
GRANT EXECUTE ON FUNCTION has_any_perm(text[]) TO authenticated;

-- ------------------------------------------------------------
-- 3. Which permission reaches which table
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS perm_table_access (
  perm       text NOT NULL,
  table_name text NOT NULL,
  access     char(1) NOT NULL CHECK (access IN ('r', 'w')),   -- w includes r
  PRIMARY KEY (perm, table_name, access)
);
TRUNCATE perm_table_access;
INSERT INTO perm_table_access (perm, table_name, access)
SELECT x.perm, unnest(x.tables), x.access FROM (VALUES
  ('location.manage',          ARRAY['countries','states','districts'], 'w'),
  ('universities.manage',      ARRAY['universities'], 'w'),
  ('sessions.manage',          ARRAY['academic_sessions'], 'w'),
  ('departments.manage',       ARRAY['departments'], 'w'),
  ('programs.manage',          ARRAY['programs','programme_types','study_modes','modes_of_study'], 'w'),
  ('boards.manage',            ARRAY['boards'], 'w'),
  ('schemes.manage',           ARRAY['schemes','scheme_papers','syllabus_subjects'], 'w'),

  ('dashboard.view',           ARRAY['students','centers'], 'r'),

  ('super_centers.view',       ARRAY['centers','center_commissions'], 'r'),
  ('centers.view',             ARRAY['centers','center_commissions'], 'r'),
  ('super_centers.add',        ARRAY['centers','center_commissions'], 'w'),
  ('super_centers.edit',       ARRAY['centers','center_commissions'], 'w'),
  ('super_centers.delete',     ARRAY['centers','center_commissions'], 'w'),
  ('super_centers.status',     ARRAY['centers'], 'w'),
  ('centers.add',              ARRAY['centers','center_commissions'], 'w'),
  ('centers.edit',             ARRAY['centers','center_commissions'], 'w'),
  ('centers.delete',           ARRAY['centers','center_commissions'], 'w'),
  ('centers.status',           ARRAY['centers'], 'w'),

  ('students.view',            ARRAY['students','centers','coupons','re_registrations','student_admit_cards','student_results'], 'r'),
  ('students.add',             ARRAY['students'], 'w'),
  ('students.edit',            ARRAY['students'], 'w'),
  ('students.delete',          ARRAY['students'], 'w'),
  ('students.hide',            ARRAY['students'], 'w'),
  ('students.credentials',     ARRAY['students'], 'w'),
  ('students.re_register',     ARRAY['students','re_registrations','student_fee_ledger'], 'w'),

  ('document_dept.view',       ARRAY['students','centers'], 'r'),
  ('document_dept.view_done',  ARRAY['students','centers'], 'r'),
  ('document_dept.verify',     ARRAY['students'], 'w'),
  ('document_dept.hold',       ARRAY['students'], 'w'),
  ('document_dept.reject',     ARRAY['students'], 'w'),
  ('document_dept.centers',    ARRAY['centers','center_applications'], 'w'),

  ('courier.view',             ARRAY['courier_details','centers','students'], 'r'),
  ('courier.add',              ARRAY['courier_details'], 'w'),
  ('courier.edit',             ARRAY['courier_details'], 'w'),
  ('courier.delete',           ARRAY['courier_details'], 'w'),

  ('account_dept.view',        ARRAY['students','centers','recharge_requests','re_registrations','coupons','center_applications','student_fee_ledger','deleted_recharges','approval_code_requests','recharge_commissions'], 'r'),
  ('account_dept.students',    ARRAY['students','student_fee_ledger','centers'], 'w'),
  ('account_dept.recharge_verify', ARRAY['recharge_requests','centers','recharge_commissions','commission_ledger'], 'w'),
  ('account_dept.recharge_edit',   ARRAY['recharge_requests'], 'w'),
  ('account_dept.recharge_delete', ARRAY['recharge_requests','deleted_recharges'], 'w'),
  ('account_dept.re_registration', ARRAY['re_registrations','students','centers','student_fee_ledger'], 'w'),
  ('account_dept.centers',     ARRAY['centers','center_applications'], 'w'),
  ('account_dept.approval_codes', ARRAY['coupons','approval_code_requests','centers'], 'w'),

  ('payment_summary.view',     ARRAY['students','centers','student_fee_ledger','recharge_requests','student_online_payments'], 'r'),

  ('research_dept.view',       ARRAY['students','letter_refs','letter_settings'], 'r'),
  ('research_dept.manage',     ARRAY['students','letter_refs'], 'w'),

  ('wallet_summary.view',      ARRAY['centers','recharge_requests','student_online_payments'], 'r'),

  ('coupons.view',             ARRAY['coupons','centers','approval_code_requests'], 'r'),
  ('coupons.generate',         ARRAY['coupons'], 'w'),
  ('coupons.edit',             ARRAY['coupons'], 'w'),
  ('coupons.delete',           ARRAY['coupons'], 'w'),
  ('coupons.toggle',           ARRAY['coupons'], 'w'),
  ('coupons.commission',       ARRAY['center_commissions','commission_ledger','recharge_commissions','coupons','centers','recharge_requests'], 'w'),

  ('fee_management.view',      ARRAY['centers'], 'r'),
  ('fee_management.manage',    ARRAY['fee_structures','fee_items','center_courses'], 'w'),

  ('center_pricing.view',      ARRAY['centers'], 'r'),
  ('center_pricing.manage',    ARRAY['centers'], 'w'),

  ('exam_section.view',        ARRAY['students','centers','student_admit_cards','student_results','student_paper_marks','exam_calendar','print_documents','print_history','certificate_numbers','dmc_series','letter_settings'], 'r'),
  ('exam_section.admit_cards', ARRAY['student_admit_cards','students','centers','student_fee_ledger','exam_schedules'], 'w'),
  ('exam_section.results',     ARRAY['student_results','student_paper_marks','students','dmc_series'], 'w'),
  ('exam_section.print',       ARRAY['print_documents','print_history','certificate_numbers'], 'w'),
  ('exam_section.calendar',    ARRAY['exam_calendar'], 'w'),

  ('syllabus.manage',          ARRAY['syllabus_subjects','course_syllabus_pdfs','scheme_papers'], 'w'),
  ('ebooks.manage',            ARRAY['ebooks'], 'w')
) AS x(perm, tables, access);

CREATE OR REPLACE FUNCTION staff_can(p_table text, p_access char) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM perm_table_access a
    WHERE a.table_name = p_table
      AND (a.access = 'w' OR p_access = 'r')
      AND a.perm = ANY (my_permissions())
  )
$$;
GRANT EXECUTE ON FUNCTION staff_can(text, char) TO authenticated;

-- One read and one write policy per table, both driven by the map above.
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT DISTINCT table_name FROM perm_table_access LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('DROP POLICY IF EXISTS staff_read ON %I', t);
    EXECUTE format('CREATE POLICY staff_read ON %I FOR SELECT TO authenticated USING (staff_can(%L, ''r''))', t, t);
    EXECUTE format('DROP POLICY IF EXISTS staff_write ON %I', t);
    EXECUTE format('CREATE POLICY staff_write ON %I FOR ALL TO authenticated USING (staff_can(%L, ''w'')) WITH CHECK (staff_can(%L, ''w''))', t, t, t);
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- 4. Admin-only database functions — opened to the matching permission.
--    Each function's own is_admin() check becomes has_perm('…') (which is
--    still true for the admin), so nothing else in them changes.
-- ------------------------------------------------------------
DO $$
DECLARE r record; f record; def text;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('admin_add_recharge',               'account_dept.recharge_edit'),
    ('admin_update_recharge',            'account_dept.recharge_edit'),
    ('admin_edit_recharge_amount',       'account_dept.recharge_edit'),
    ('admin_delete_recharge',            'account_dept.recharge_delete'),
    ('admin_create_single_coupon',       'coupons.generate'),
    ('admin_create_course_coupons',      'coupons.generate'),
    ('mint_coupon_batch',                'coupons.generate'),
    ('admin_update_coupon',              'coupons.edit'),
    ('admin_delete_coupon',              'coupons.delete'),
    ('admin_toggle_coupon',              'coupons.toggle'),
    ('commission_set_sent',              'coupons.commission'),
    ('generate_commission_payables',     'coupons.commission'),
    ('generate_registration_commission', 'coupons.commission'),
    ('generate_commission_coupon',       'coupons.commission'),
    ('forward_result_to_print',          'exam_section.results'),
    ('withdraw_result_from_print',       'exam_section.results'),
    ('issue_dmc_no',                     'exam_section.results'),
    ('issue_certificate_no',             'exam_section.print'),
    ('record_document_prints',           'exam_section.print'),
    ('student_forward_hold',             'students.edit')
  ) AS v(fn, perm) LOOP
    FOR f IN SELECT p.oid FROM pg_proc p
             WHERE p.pronamespace = 'public'::regnamespace AND p.proname = r.fn LOOP
      def := pg_get_functiondef(f.oid);
      IF position('is_admin()' IN def) > 0 THEN
        EXECUTE replace(def, 'is_admin()', format('has_perm(%L)', r.perm));
      END IF;
    END LOOP;
  END LOOP;

  -- The wallet guard: any permission whose work moves a wallet.
  FOR f IN SELECT p.oid FROM pg_proc p
           WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'guard_center_money' LOOP
    def := pg_get_functiondef(f.oid);
    IF position('IF is_admin() THEN' IN def) > 0 THEN
      EXECUTE replace(def, 'IF is_admin() THEN',
        'IF has_any_perm(ARRAY[''account_dept.students'',''account_dept.recharge_verify'',''account_dept.recharge_edit'',''account_dept.recharge_delete'',''account_dept.re_registration'',''account_dept.centers'',''account_dept.approval_codes'',''exam_section.admit_cards'',''coupons.generate'',''coupons.commission'',''students.re_register'']) THEN');
    END IF;
  END LOOP;
END $$;

-- reserve_coupon: a staff login adding a student may claim the coupon too.
CREATE OR REPLACE FUNCTION reserve_coupon(p_coupon_id uuid, p_application_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_updated int;
BEGIN
  UPDATE coupons
     SET is_used        = true,
         used_at        = COALESCE(used_at, now()),
         application_id = p_application_id
   WHERE id = p_coupon_id
     AND COALESCE(is_used, false) = false
     AND (
       center_id IN (SELECT id FROM centers WHERE lower(email) = lower(auth.jwt() ->> 'email'))
       OR has_perm('students.add')
     );
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;
GRANT EXECUTE ON FUNCTION reserve_coupon(uuid, uuid) TO authenticated;

-- ------------------------------------------------------------
-- 5. Who may manage roles and staff logins
-- ------------------------------------------------------------
ALTER TABLE app_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS app_roles_manage ON app_roles;
CREATE POLICY app_roles_manage ON app_roles
  FOR ALL TO authenticated USING (has_perm('users.manage')) WITH CHECK (has_perm('users.manage'));
DROP POLICY IF EXISTS app_roles_read_own ON app_roles;
CREATE POLICY app_roles_read_own ON app_roles
  FOR SELECT TO authenticated
  USING (id = (SELECT app_role_id FROM profiles WHERE id = auth.uid()));

ALTER TABLE perm_table_access ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS perm_table_access_admin ON perm_table_access;
CREATE POLICY perm_table_access_admin ON perm_table_access
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- A user manager sees and edits staff logins (never the admin, a centre or
-- a student).
DROP POLICY IF EXISTS profile_staff_manage ON profiles;
CREATE POLICY profile_staff_manage ON profiles
  FOR ALL TO authenticated
  USING (has_perm('users.manage') AND role = 'staff')
  WITH CHECK (has_perm('users.manage') AND role = 'staff');

-- The staff list with e-mails and last sign-in (auth.users is not readable
-- from the app).
CREATE OR REPLACE FUNCTION list_staff_users()
RETURNS TABLE (id uuid, email text, full_name text, app_role_id uuid, is_active boolean,
               created_at timestamptz, last_sign_in_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT has_perm('users.manage') THEN RAISE EXCEPTION 'Not allowed.'; END IF;
  RETURN QUERY
    SELECT p.id, u.email::text, p.full_name, p.app_role_id, p.is_active, u.created_at, u.last_sign_in_at
    FROM profiles p JOIN auth.users u ON u.id = p.id
    WHERE p.role IN ('staff', 'document_dept')
    ORDER BY u.created_at DESC;
END $$;
REVOKE ALL ON FUNCTION list_staff_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION list_staff_users() TO authenticated;

-- ------------------------------------------------------------
-- 6. The existing Document Dept login becomes a staff login on a
--    "Document Dept" role.
-- ------------------------------------------------------------
INSERT INTO app_roles (name, description, permissions)
VALUES ('Document Dept', 'Document verification — pending, hold and rejected queues',
        ARRAY['document_dept.view','document_dept.verify','document_dept.hold','document_dept.reject','document_dept.centers'])
ON CONFLICT (name) DO NOTHING;

UPDATE profiles
   SET role = 'staff',
       app_role_id = (SELECT id FROM app_roles WHERE name = 'Document Dept'),
       full_name = COALESCE(full_name, 'Document Dept')
 WHERE role = 'document_dept';

NOTIFY pgrst, 'reload schema';

SELECT 'user management ready' AS result;
