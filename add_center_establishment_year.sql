-- ============================================================
-- Center Establishment Year
-- ------------------------------------------------------------
-- Adds an optional "establishment year" field to centers so the
-- center-create forms can record when the organisation / center
-- was founded (e.g. 2015).
--
-- Run this in: Supabase Dashboard -> SQL Editor -> New query -> Run
-- ============================================================

ALTER TABLE centers
  ADD COLUMN IF NOT EXISTS establishment_year integer;

SELECT 'centers.establishment_year ready' AS result;
