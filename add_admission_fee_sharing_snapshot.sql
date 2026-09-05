-- ============================================================
-- Freeze the fee sharing that applied when an admission was taken
-- ------------------------------------------------------------
-- The university's original course fee never changes and is never stored
-- per centre. What a CENTRE owes is worked out from it:
--
--     University payable = per-semester fee x (100 - Center Sharing %) / 100
--
-- The share is centers.fee_sharing — "how much the centre keeps".
--
-- The percentage is copied onto the admission at the moment it is created, so
-- changing a centre's sharing later cannot re-price students already admitted.
-- The three amounts are stored beside it as the record of what was agreed:
-- they are a snapshot, not the running total, which still grows semester by
-- semester as the exam calendar advances.
--
-- Run in Supabase -> SQL Editor. Safe to re-run.
-- ============================================================

ALTER TABLE students
  ADD COLUMN IF NOT EXISTS fee_sharing_pct    numeric,   -- % the centre kept, as at admission
  ADD COLUMN IF NOT EXISTS original_fee       numeric,   -- university's full fee, before the split
  ADD COLUMN IF NOT EXISTS center_share       numeric,   -- centre's part of it
  ADD COLUMN IF NOT EXISTS university_payable numeric;   -- what the centre owes the university

COMMENT ON COLUMN students.fee_sharing_pct IS
  'Center Sharing % in force when this admission was created. Frozen on purpose: changing the centre''s rate must not re-price admissions already taken. NULL on rows created before sharing existed — those fall back to the centre''s current rate.';
COMMENT ON COLUMN students.original_fee IS
  'The university''s full fee due at admission, before the centre''s share. A record of the agreement, not a running total.';
COMMENT ON COLUMN students.center_share IS
  'original_fee - university_payable, at admission.';
COMMENT ON COLUMN students.university_payable IS
  'original_fee x (100 - fee_sharing_pct) / 100, at admission.';

SELECT 'admission fee sharing snapshot ready' AS result,
       count(*) FILTER (WHERE fee_sharing_pct IS NOT NULL) AS already_stamped,
       count(*) AS total_students
FROM students;
