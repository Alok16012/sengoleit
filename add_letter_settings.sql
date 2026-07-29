-- Research Dept letter settings — reference series, letter date and the
-- entrance-test date — plus the reference number assigned to each candidate.
--
-- These used to live in the admin's browser (localStorage), so every computer
-- had its own series and the student portal could not show the same reference
-- number. Storing them here makes one shared series across all admins, and lets
-- a student's own copy of a letter carry the same Ref. No. and date.
--
-- Run this once in Supabase -> SQL Editor.

-- One row per letter type (Offer Letter, Entrance Certificate, …).
CREATE TABLE IF NOT EXISTS letter_settings (
  name        text PRIMARY KEY,
  prefix      text NOT NULL DEFAULT '',
  next_num    int  NOT NULL DEFAULT 1,
  letter_date date,
  test_date   date,
  updated_at  timestamptz DEFAULT now()
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
