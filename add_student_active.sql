-- Activate / Deactivate a student's portal login.
--
-- A deactivated student cannot sign in to the student portal, and any portal
-- session they already have open ends at once. Nothing else changes: the
-- record, fees, documents and results stay exactly as they are, and
-- activating again restores the login with the same password.
--
-- Run once in Supabase -> SQL Editor. Safe to re-run.

ALTER TABLE students ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Deactivating ends every open portal session of that student.
CREATE OR REPLACE FUNCTION public.revoke_student_sessions_on_deactivate() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_active IS FALSE AND OLD.is_active IS DISTINCT FROM FALSE THEN
    DELETE FROM student_sessions WHERE student_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS revoke_student_sessions_on_deactivate ON students;
CREATE TRIGGER revoke_student_sessions_on_deactivate
  AFTER UPDATE OF is_active ON students
  FOR EACH ROW EXECUTE FUNCTION public.revoke_student_sessions_on_deactivate();

-- Login — as in student_auth.sql, plus the deactivated check.
CREATE OR REPLACE FUNCTION student_login_v2(p_identifier text, p_pwd text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  s record;
  tok text;
BEGIN
  IF position('@' in p_identifier) > 0 THEN
    SELECT * INTO s FROM students WHERE lower(email) = lower(trim(p_identifier)) LIMIT 1;
  ELSE
    SELECT * INTO s FROM students WHERE enrollment_no = trim(p_identifier) LIMIT 1;
  END IF;

  IF s.id IS NULL THEN RETURN jsonb_build_object('error', 'invalid_credentials'); END IF;

  IF s.login_password_hash IS NOT NULL THEN
    IF crypt(p_pwd, s.login_password_hash) <> s.login_password_hash THEN
      RETURN jsonb_build_object('error', 'invalid_credentials');
    END IF;
  ELSIF s.login_password IS NULL OR s.login_password = '' OR s.login_password <> p_pwd THEN
    RETURN jsonb_build_object('error', 'invalid_credentials');
  END IF;

  IF s.status IS DISTINCT FROM 'Approved' THEN
    RETURN jsonb_build_object('error', 'not_approved');
  END IF;

  IF s.is_active IS FALSE THEN
    RETURN jsonb_build_object('error', 'deactivated');
  END IF;

  tok := encode(gen_random_bytes(32), 'hex');
  DELETE FROM student_sessions WHERE expires_at < now();
  INSERT INTO student_sessions (student_id, token_hash)
  VALUES (s.id, encode(digest(tok, 'sha256'), 'hex'));

  RETURN jsonb_build_object(
    'token', tok,
    'student', jsonb_build_object(
      'id', s.id, 'student_name', s.student_name, 'enrollment_no', s.enrollment_no));
END $$;

GRANT EXECUTE ON FUNCTION student_login_v2(text, text) TO anon, authenticated;
