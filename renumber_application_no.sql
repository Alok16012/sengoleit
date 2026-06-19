-- ============================================================
-- Renumber ALL center application numbers to CA/001/NNNN
-- ------------------------------------------------------------
-- Converts the old APP-2026-XXXX (and any other) application
-- numbers into the new sequential format:
--   CA/001/0001, CA/001/0002, CA/001/0003 …
-- Oldest center (by created_at) becomes 0001.
--
-- New centers created from the app continue from the highest
-- number automatically.
--
-- Run this in: Supabase Dashboard -> SQL Editor -> New query -> Run
-- ============================================================

WITH numbered AS (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY created_at ASC NULLS LAST, id ASC) AS rn
  FROM centers
)
UPDATE centers AS c
SET application_no = 'CA/001/' || lpad(numbered.rn::text, 4, '0')
FROM numbered
WHERE c.id = numbered.id;

SELECT application_no, center_name
FROM centers
ORDER BY application_no;
