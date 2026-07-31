-- Ph.D Entrance Exam Hall Ticket — Research Dept.
--
-- The Research Dept issues a Provisional Hall Ticket before the entrance exam
-- (ahead of the Offer Letter / Entrance Certificate). Like the other letters it
-- has an Active/Inactive publish toggle, and its exam details (time, reporting
-- time, exam centre) live with the letter's reference series in letter_settings.
--
-- Run this once in Supabase -> SQL Editor. Safe to re-run.

-- Active = the Centre & Student panels show a Download button for the ticket.
ALTER TABLE students ADD COLUMN IF NOT EXISTS hall_ticket_active BOOLEAN DEFAULT FALSE;

-- Hall Ticket exam details, set per session in the Research Dept master panel.
-- The exam DATE reuses the existing test_date column (same entrance test the
-- Entrance Certificate refers to).
ALTER TABLE letter_settings ADD COLUMN IF NOT EXISTS exam_time      TEXT;
ALTER TABLE letter_settings ADD COLUMN IF NOT EXISTS reporting_time TEXT;
ALTER TABLE letter_settings ADD COLUMN IF NOT EXISTS exam_centre    TEXT;

SELECT 'hall ticket columns ready' AS result;
