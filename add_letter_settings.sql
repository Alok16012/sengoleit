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

ALTER TABLE letter_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE letter_refs     ENABLE ROW LEVEL SECURITY;

-- Portal users are authenticated; students need to read their own letter's
-- reference, admins need to write. Keep it simple: full access to authenticated.
DROP POLICY IF EXISTS letter_settings_all_authenticated ON letter_settings;
CREATE POLICY letter_settings_all_authenticated ON letter_settings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS letter_refs_all_authenticated ON letter_refs;
CREATE POLICY letter_refs_all_authenticated ON letter_refs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

SELECT 'letter_settings + letter_refs ready' AS result;
