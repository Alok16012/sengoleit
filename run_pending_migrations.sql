-- ============================================================
-- PENDING MIGRATIONS — run all at once
-- ------------------------------------------------------------
-- Run this in: Supabase Dashboard -> SQL Editor -> New query -> Run
-- Safe to re-run (uses IF NOT EXISTS).
-- ============================================================

-- 1) Year of Established (centers)
ALTER TABLE centers
  ADD COLUMN IF NOT EXISTS establishment_year integer;

-- 2) Country columns for the public Add Center application form
ALTER TABLE center_applications
  ADD COLUMN IF NOT EXISTS permanent_country_id UUID REFERENCES countries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS org_country_id       UUID REFERENCES countries(id) ON DELETE SET NULL;

-- 3) Renumber all application numbers to CA/001/NNNN (oldest = 0001)
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

-- Verify
SELECT application_no, center_name
FROM centers
ORDER BY application_no;
