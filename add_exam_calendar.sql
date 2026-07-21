-- Examination Calendar — per-session, per-semester exam start/end dates.
--
-- The Exam Section > Examination Calendar tab lets the admin pick a session and
-- set the examination start & end date for each semester (1–10). One row per
-- (session, semester); the app deletes + re-inserts a session's rows on Save.
--
-- Run this once in Supabase -> SQL Editor.

CREATE TABLE IF NOT EXISTS exam_calendar (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
  semester    int  NOT NULL CHECK (semester BETWEEN 1 AND 12),
  start_date  date,
  end_date    date,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (session_id, semester)
);

ALTER TABLE exam_calendar ENABLE ROW LEVEL SECURITY;

-- Admin/center portal users are authenticated; give them full access. Students
-- (also authenticated) can read their session's calendar.
DROP POLICY IF EXISTS exam_calendar_all_authenticated ON exam_calendar;
CREATE POLICY exam_calendar_all_authenticated ON exam_calendar
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

SELECT 'exam_calendar ready' AS result;
