-- Semester-wise admit cards.
--
-- An admit card belongs to a SEMESTER — a student sits one exam per semester,
-- and the Exam Section already issues the card per semester. Until now nothing
-- was recorded when one was issued, so the picker offered "Select Papers" again
-- for a semester whose card had already gone out, and there was no way to
-- re-print it, hide it or take it back.
--
-- `students.admit_card_released_at` stays untouched: it is what the student
-- portal used before this table existed, and old records must keep working.
--
-- Run once in Supabase -> SQL Editor. Safe to re-run.
-- (Run security_hardening.sql first — the policies below use is_admin().)

CREATE TABLE IF NOT EXISTS student_admit_cards (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  semester     int  NOT NULL,
  -- The papers the admin ticked. Empty means the card printed
  -- "as per university curriculum" because the syllabus had none.
  subject_ids  uuid[] NOT NULL DEFAULT '{}',
  generated_at timestamptz NOT NULL DEFAULT now(),
  released_at  timestamptz,          -- visible to the student; NULL = hidden
  UNIQUE (student_id, semester)
);

CREATE INDEX IF NOT EXISTS idx_admit_cards_student ON student_admit_cards(student_id);

ALTER TABLE student_admit_cards ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'student_admit_cards' LOOP
    EXECUTE format('DROP POLICY %I ON student_admit_cards', p.policyname);
  END LOOP;
END $$;

-- The Exam Section issues, hides and withdraws them.
CREATE POLICY admit_cards_admin_all ON student_admit_cards
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Centres see their own students' released cards.
CREATE POLICY admit_cards_center_read ON student_admit_cards
  FOR SELECT TO authenticated USING (
    released_at IS NOT NULL
    AND student_id IN (
      SELECT s.id FROM students s
      JOIN centers c ON c.id = s.center_id
      WHERE c.email = (auth.jwt() ->> 'email')
    )
  );

-- The student portal keeps its own session (not Supabase Auth), so it reads
-- through this function rather than the table — anon gets nothing directly.
CREATE OR REPLACE FUNCTION student_admit_cards_self(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE sid uuid; payload jsonb;
BEGIN
  SELECT ss.student_id INTO sid FROM student_sessions ss
  WHERE ss.token_hash = encode(digest(p_token, 'sha256'), 'hex') AND ss.expires_at > now()
  LIMIT 1;
  IF sid IS NULL THEN RETURN '[]'::jsonb; END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(a.*) ORDER BY a.semester), '[]'::jsonb) INTO payload
  FROM student_admit_cards a
  WHERE a.student_id = sid AND a.released_at IS NOT NULL;

  RETURN payload;
END $$;

GRANT EXECUTE ON FUNCTION student_admit_cards_self(text) TO anon, authenticated;

SELECT 'student_admit_cards ready' AS result;
