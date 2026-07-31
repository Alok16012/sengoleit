-- ============================================================
-- STUDENT AUTH — server-verified sessions + hashed passwords.
-- Run once in Supabase -> SQL Editor. Safe to re-run.
--
-- What this fixes (2026-08-01 audit):
--   * The student "session" was just a localStorage blob with a student id —
--     anyone could forge it, and the portal's anon reads meant anyone could
--     read ANY student's full row (bank details and plaintext password
--     included) or overwrite their password, without ever logging in.
--
-- After this migration:
--   * Passwords are checked SERVER-side against a bcrypt hash.
--   * Login issues a random session token (30 days); every student-portal
--     read goes through student_self(token) — no token, no data.
--   * The anon role loses ALL direct access to the students table.
--
-- The plaintext login_password column is kept for the admin panel's
-- credential-distribution workflow (staff hand the password to the student),
-- but it is no longer reachable from the public API — only signed-in staff
-- can see it. A trigger keeps the hash in sync when staff set a password.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------
-- 1) Hash column, backfilled from the existing plaintext passwords,
--    kept in sync by trigger whenever staff set/change login_password.
-- ------------------------------------------------------------
ALTER TABLE students ADD COLUMN IF NOT EXISTS login_password_hash text;

UPDATE students
SET login_password_hash = crypt(login_password, gen_salt('bf'))
WHERE login_password IS NOT NULL AND login_password <> ''
  AND login_password_hash IS NULL;

CREATE OR REPLACE FUNCTION sync_student_password_hash() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  IF NEW.login_password IS DISTINCT FROM OLD.login_password THEN
    NEW.login_password_hash :=
      CASE WHEN NEW.login_password IS NULL OR NEW.login_password = '' THEN NULL
           ELSE crypt(NEW.login_password, gen_salt('bf')) END;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_student_password_hash ON students;
CREATE TRIGGER trg_sync_student_password_hash
  BEFORE UPDATE ON students
  FOR EACH ROW EXECUTE FUNCTION sync_student_password_hash();

-- New rows inserted with a password get a hash too.
CREATE OR REPLACE FUNCTION sync_student_password_hash_ins() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  IF NEW.login_password IS NOT NULL AND NEW.login_password <> '' THEN
    NEW.login_password_hash := crypt(NEW.login_password, gen_salt('bf'));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_student_password_hash_ins ON students;
CREATE TRIGGER trg_sync_student_password_hash_ins
  BEFORE INSERT ON students
  FOR EACH ROW EXECUTE FUNCTION sync_student_password_hash_ins();

-- ------------------------------------------------------------
-- 2) Sessions. Only the SECURITY DEFINER functions below touch this
--    table — RLS is enabled with no policies, so no API role can.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS student_sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  token_hash  text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL DEFAULT now() + interval '30 days'
);
CREATE INDEX IF NOT EXISTS idx_student_sessions_hash ON student_sessions(token_hash);
ALTER TABLE student_sessions ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 3) Login — email (Ph.D candidates) or enrollment number.
--    Returns { token, student: {...} } or { error: ... }.
-- ------------------------------------------------------------
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

  -- Hash check; rows that somehow predate the backfill fall back to plaintext.
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

  tok := encode(gen_random_bytes(32), 'hex');
  DELETE FROM student_sessions WHERE expires_at < now();
  INSERT INTO student_sessions (student_id, token_hash)
  VALUES (s.id, encode(digest(tok, 'sha256'), 'hex'));

  RETURN jsonb_build_object(
    'token', tok,
    'student', jsonb_build_object(
      'id', s.id, 'student_name', s.student_name, 'enrollment_no', s.enrollment_no));
END $$;

-- ------------------------------------------------------------
-- 4) The student's own data — the ONLY way the portal reads it now.
--    Returns the row (minus password columns) with the related rows
--    embedded under the same keys the old PostgREST joins used.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION student_self(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  sid uuid;
  payload jsonb;
BEGIN
  SELECT ss.student_id INTO sid FROM student_sessions ss
  WHERE ss.token_hash = encode(digest(p_token, 'sha256'), 'hex') AND ss.expires_at > now()
  LIMIT 1;
  IF sid IS NULL THEN RETURN NULL; END IF;

  SELECT to_jsonb(st.*)
         - 'login_password' - 'login_password_hash'
         || jsonb_build_object(
              'programs',          (SELECT to_jsonb(p.*)  FROM programs p          WHERE p.id  = st.programme_id),
              'academic_sessions', (SELECT to_jsonb(a.*)  FROM academic_sessions a WHERE a.id  = st.session_id),
              'centers',           (SELECT to_jsonb(c.*) - 'generated_password' FROM centers c WHERE c.id = st.center_id),
              'departments',       (SELECT to_jsonb(d.*)  FROM departments d       WHERE d.id  = st.department_id),
              'study_modes',       (SELECT to_jsonb(m.*)  FROM study_modes m       WHERE m.id  = st.mode_id))
    INTO payload
  FROM students st WHERE st.id = sid;

  RETURN payload;
END $$;

-- ------------------------------------------------------------
-- 5) Password change from the student portal (old password required).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION student_change_password(p_token text, p_old text, p_new text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  sid uuid; s record;
BEGIN
  SELECT ss.student_id INTO sid FROM student_sessions ss
  WHERE ss.token_hash = encode(digest(p_token, 'sha256'), 'hex') AND ss.expires_at > now()
  LIMIT 1;
  IF sid IS NULL THEN RETURN jsonb_build_object('error', 'not_signed_in'); END IF;
  IF p_new IS NULL OR length(trim(p_new)) < 6 THEN
    RETURN jsonb_build_object('error', 'weak_password');
  END IF;

  SELECT * INTO s FROM students WHERE id = sid;
  IF s.login_password_hash IS NOT NULL THEN
    IF crypt(p_old, s.login_password_hash) <> s.login_password_hash THEN
      RETURN jsonb_build_object('error', 'wrong_password');
    END IF;
  ELSIF s.login_password IS DISTINCT FROM p_old THEN
    RETURN jsonb_build_object('error', 'wrong_password');
  END IF;

  -- The UPDATE trigger re-hashes from the plaintext column.
  UPDATE students SET login_password = trim(p_new) WHERE id = sid;
  RETURN jsonb_build_object('ok', true);
END $$;

-- ------------------------------------------------------------
-- 6) Logout — drop the session server-side too.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION student_logout(p_token text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public, extensions AS $$
  DELETE FROM student_sessions
  WHERE token_hash = encode(digest(p_token, 'sha256'), 'hex')
$$;

GRANT EXECUTE ON FUNCTION student_login_v2(text, text)                TO anon, authenticated;
GRANT EXECUTE ON FUNCTION student_self(text)                          TO anon, authenticated;
GRANT EXECUTE ON FUNCTION student_change_password(text, text, text)   TO anon, authenticated;
GRANT EXECUTE ON FUNCTION student_logout(text)                        TO anon, authenticated;

-- ------------------------------------------------------------
-- 7) Close the hole: the public (anon) role loses every direct path to
--    the students table. Staff portals sign in through Supabase Auth
--    (authenticated role) and are unaffected. If some other anon flow
--    ever legitimately needed students, give it its own DEFINER function
--    instead of re-granting the table.
-- ------------------------------------------------------------
REVOKE ALL ON students FROM anon;

SELECT 'student auth ready' AS result;
