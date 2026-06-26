-- Global key/value settings for the app.
-- Currently used by the Exam Section to store the section-wide Exam Schedule
-- and the Admit Card valid-from date/time, which are printed on every Admit Card.
-- Run in Supabase -> SQL Editor.

CREATE TABLE IF NOT EXISTS app_settings (
  key        text PRIMARY KEY,
  value      text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed the two exam keys (no-op if they already exist).
INSERT INTO app_settings (key, value)
VALUES ('exam_schedule', NULL), ('admit_card_time', NULL)
ON CONFLICT (key) DO NOTHING;

SELECT 'app_settings ready' AS result;
