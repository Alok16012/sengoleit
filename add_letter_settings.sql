-- Research Dept letter settings — reference series, letter date and the
-- entrance-test date — plus the reference number assigned to each candidate.
--
-- These used to live in the admin's browser (localStorage), so every computer
-- had its own series and the student portal could not show the same reference
-- number. Storing them here gives one shared setup, and lets a student's own
-- copy of a letter carry the same Ref. No. and date.
--
-- Settings are per SESSION + letter, so June 2026 and July 2025 keep their own
-- series and dates. session_key holds the session id as text; '' is the
-- fallback used by any session that has no entry of its own (a nullable column
-- can't take part in a primary key, hence text rather than a uuid FK).
--
-- Run this once in Supabase -> SQL Editor.

CREATE TABLE IF NOT EXISTS letter_settings (
  session_key text NOT NULL DEFAULT '',
  name        text NOT NULL,
  prefix      text NOT NULL DEFAULT '',
  next_num    int  NOT NULL DEFAULT 1,
  letter_date date,
  test_date   date,
  updated_at  timestamptz DEFAULT now(),
  PRIMARY KEY (session_key, name)
);

-- The reference number handed to a candidate for a given letter. Assigned once
-- and then reused, so re-opening a letter never renumbers it.
CREATE TABLE IF NOT EXISTS letter_refs (
  letter_name text NOT NULL,
  student_id  uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  num         int  NOT NULL,
  created_at  timestamptz DEFAULT now(),
  PRIMARY KEY (letter_name, student_id)
);

-- ---------------------------------------------------------------------------
-- Upgrade an EXISTING letter_settings created before the per-session rewrite.
-- CREATE TABLE IF NOT EXISTS above does nothing when the table is already
-- there, so a database set up with the first version of this script never got
-- session_key — and every read of the table failed with
--   column letter_settings.session_key does not exist
-- which silently dropped the whole panel back to browser-only storage.
ALTER TABLE letter_settings ADD COLUMN IF NOT EXISTS session_key text NOT NULL DEFAULT '';

-- Re-point the primary key at (session_key, name); the first version keyed on
-- name alone, which would reject a second session's copy of the same letter.
DO $$
DECLARE pk_name text; pk_cols int;
BEGIN
  SELECT conname, array_length(conkey, 1) INTO pk_name, pk_cols
  FROM pg_constraint
  WHERE conrelid = 'letter_settings'::regclass AND contype = 'p';

  IF pk_name IS NULL THEN
    ALTER TABLE letter_settings ADD PRIMARY KEY (session_key, name);
  ELSIF pk_cols = 1 THEN
    EXECUTE format('ALTER TABLE letter_settings DROP CONSTRAINT %I', pk_name);
    ALTER TABLE letter_settings ADD PRIMARY KEY (session_key, name);
  END IF;
END $$;

-- Hall Ticket exam details (also added by add_hall_ticket.sql) — repeated here
-- so this one script is enough to bring an old database fully up to date.
ALTER TABLE letter_settings ADD COLUMN IF NOT EXISTS exam_time      TEXT;
ALTER TABLE letter_settings ADD COLUMN IF NOT EXISTS reporting_time TEXT;
ALTER TABLE letter_settings ADD COLUMN IF NOT EXISTS exam_centre    TEXT;
-- ---------------------------------------------------------------------------

ALTER TABLE letter_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE letter_refs     ENABLE ROW LEVEL SECURITY;

-- Admins sign in through Supabase Auth, so they get the `authenticated` role
-- and full read/write.
DROP POLICY IF EXISTS letter_settings_all_authenticated ON letter_settings;
CREATE POLICY letter_settings_all_authenticated ON letter_settings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS letter_refs_all_authenticated ON letter_refs;
CREATE POLICY letter_refs_all_authenticated ON letter_refs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- The STUDENT portal does not use Supabase Auth — it keeps its own session, so
-- those queries run as `anon`. Without a read policy for anon a student's copy
-- of a letter silently loses its Ref. No. and falls back to the application
-- number, which is exactly what these tables exist to prevent. Read only —
-- issuing and renumbering stays with the admins above.
DROP POLICY IF EXISTS letter_settings_read_anon ON letter_settings;
CREATE POLICY letter_settings_read_anon ON letter_settings
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS letter_refs_read_anon ON letter_refs;
CREATE POLICY letter_refs_read_anon ON letter_refs
  FOR SELECT TO anon USING (true);

SELECT 'letter_settings + letter_refs ready' AS result;
