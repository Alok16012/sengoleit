-- A new password signs the account out everywhere.
--
-- Staff, admin, centre and super-centre logins (Supabase Auth): when a
-- password changes — set by the admin from User Management, or changed by the
-- user themselves — every open session of that login is deleted. Each open
-- browser notices within a minute and goes back to the sign-in page. The user
-- who changed their own password is signed straight back in by the app.
--
-- Students: when their password changes (set by the admin or the centre, or
-- changed by the student), every other student-portal session ends. A student
-- changing their own password keeps the session they did it from.
--
-- Run once in Supabase -> SQL Editor. Safe to re-run.

-- 1. Supabase Auth logins.
CREATE OR REPLACE FUNCTION public.revoke_sessions_on_password_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = auth, public AS $$
BEGIN
  IF NEW.encrypted_password IS DISTINCT FROM OLD.encrypted_password THEN
    DELETE FROM auth.sessions WHERE user_id = NEW.id;            -- refresh tokens go with them
    DELETE FROM auth.refresh_tokens WHERE user_id = NEW.id::text;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS revoke_sessions_on_password_change ON auth.users;
CREATE TRIGGER revoke_sessions_on_password_change
  AFTER UPDATE OF encrypted_password ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.revoke_sessions_on_password_change();

-- 2. Student portal.
CREATE OR REPLACE FUNCTION public.revoke_student_sessions_on_password_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE keep text := current_setting('app.keep_student_session', true);
BEGIN
  IF NEW.login_password IS DISTINCT FROM OLD.login_password THEN
    DELETE FROM student_sessions
     WHERE student_id = NEW.id
       AND (keep IS NULL OR keep = '' OR id::text <> keep);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS revoke_student_sessions_on_password_change ON students;
CREATE TRIGGER revoke_student_sessions_on_password_change
  AFTER UPDATE OF login_password ON students
  FOR EACH ROW EXECUTE FUNCTION public.revoke_student_sessions_on_password_change();

-- The student's own change keeps the session it was made from.
CREATE OR REPLACE FUNCTION student_change_password(p_token text, p_old text, p_new text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  sid uuid; sess uuid; s record;
BEGIN
  SELECT ss.student_id, ss.id INTO sid, sess FROM student_sessions ss
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

  PERFORM set_config('app.keep_student_session', sess::text, true);
  -- The UPDATE trigger re-hashes from the plaintext column.
  UPDATE students SET login_password = trim(p_new) WHERE id = sid;
  RETURN jsonb_build_object('ok', true);
END $$;
GRANT EXECUTE ON FUNCTION student_change_password(text, text, text) TO anon, authenticated;

SELECT 'logout on password change ready' AS result;
