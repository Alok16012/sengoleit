-- Research Dept -> Candidates: a Hide / Unhide button under every Ph.D
-- document, not only the Hall Ticket, Offer Letter and Entrance Certificate.
-- Which of the other documents are visible is kept on the student:
--   { "ID Card": false, "Enrollment Certificate": true, ... }
-- A document not listed keeps its default — the ID Card visible (as it has
-- always been once the Registration No. exists), the rest hidden.
--
-- Run once in Supabase -> SQL Editor. Safe to re-run.

ALTER TABLE students ADD COLUMN IF NOT EXISTS phd_doc_visible jsonb NOT NULL DEFAULT '{}'::jsonb;

NOTIFY pgrst, 'reload schema';

SELECT 'Ph.D document visibility ready' AS result;
