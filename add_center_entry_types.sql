-- ============================================================
-- Which entry types a centre may admit under
-- ------------------------------------------------------------
-- Student Entry's "Entry Type" dropdown offered Regular / Lateral / External
-- to every centre, hard-coded in the form. There was no way to say that a
-- particular centre only admits Regular students.
--
-- centers.entry_types holds the ones a centre is allowed to pick. NULL — which
-- is what every existing centre gets — means no restriction, so nothing
-- changes for anyone until the admin sets it. An empty array is treated the
-- same way rather than locking a centre out of admitting at all.
--
-- Run once in Supabase -> SQL Editor. Safe to re-run.
-- ============================================================

ALTER TABLE centers ADD COLUMN IF NOT EXISTS entry_types text[];

COMMENT ON COLUMN centers.entry_types IS
  'Entry types this centre may admit under (Regular / Lateral / External). NULL or empty = all of them.';

SELECT 'centers.entry_types ready' AS result,
       count(*) FILTER (WHERE entry_types IS NOT NULL) AS centres_restricted,
       count(*)                                        AS centres_total
FROM centers;
