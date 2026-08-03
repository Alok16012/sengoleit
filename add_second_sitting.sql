-- Second exam sitting for the Ph.D entrance test.
--
-- The entrance exam is held twice for the same session (e.g. August and
-- September) — the same paper, two dates. The Research Dept stores both, and
-- picks one when it issues a candidate's Hall Ticket.
--
-- The choice is stored per candidate, not just used at print time. The student
-- portal and the centre lists print their own copy of the letter from the same
-- record, so a choice that lived only in the admin's browser would put a
-- different date on the student's copy than on the office copy.
--
-- Run once in Supabase -> SQL Editor. Safe to re-run.

-- The second sitting's date, alongside the existing test_date.
ALTER TABLE letter_settings ADD COLUMN IF NOT EXISTS test_date_2 date;

-- Which sitting a candidate was given: 1 = the first date, 2 = the second.
-- NULL means the first, so every letter issued before this change is unchanged.
ALTER TABLE letter_refs ADD COLUMN IF NOT EXISTS sitting smallint;

ALTER TABLE letter_refs DROP CONSTRAINT IF EXISTS letter_refs_sitting_check;
ALTER TABLE letter_refs ADD CONSTRAINT letter_refs_sitting_check
  CHECK (sitting IS NULL OR sitting IN (1, 2));

SELECT 'second sitting ready' AS result;
