-- ============================================================
-- 1. NEW ORGANISATION / INFRASTRUCTURE FIELDS ON centers
-- ============================================================
ALTER TABLE centers ADD COLUMN IF NOT EXISTS centre_address TEXT;
ALTER TABLE centers ADD COLUMN IF NOT EXISTS num_classrooms INTEGER;
ALTER TABLE centers ADD COLUMN IF NOT EXISTS has_computer_lab BOOLEAN DEFAULT false;
ALTER TABLE centers ADD COLUMN IF NOT EXISTS num_computers INTEGER;
ALTER TABLE centers ADD COLUMN IF NOT EXISTS internet_speed TEXT;
ALTER TABLE centers ADD COLUMN IF NOT EXISTS has_cctv BOOLEAN DEFAULT false;
ALTER TABLE centers ADD COLUMN IF NOT EXISTS current_courses_offered TEXT;
ALTER TABLE centers ADD COLUMN IF NOT EXISTS num_faculty INTEGER;

-- ============================================================
-- 2. FIX DUPLICATE STATES (and districts) + PREVENT FUTURE DUPES
--    Root cause: `states` had no unique constraint on state_name,
--    so re-running the seed created duplicate rows. Districts were
--    only linked to ONE state id per name, so selecting a duplicate
--    state returned no districts.
-- ============================================================

-- 2a. Map every duplicate state to its canonical (earliest) row
CREATE TEMP TABLE _state_dedup ON COMMIT DROP AS
SELECT s.id AS dup_id, c.canonical_id
FROM states s
JOIN (
  SELECT state_name,
         (SELECT id FROM states s2 WHERE s2.state_name = g.state_name
          ORDER BY created_at, id LIMIT 1) AS canonical_id
  FROM states g GROUP BY state_name
) c ON s.state_name = c.state_name
WHERE s.id <> c.canonical_id;

-- 2b. Re-point all references from duplicate state ids to the canonical id
UPDATE districts            SET state_id           = m.canonical_id FROM _state_dedup m WHERE districts.state_id           = m.dup_id;
UPDATE universities         SET state_id           = m.canonical_id FROM _state_dedup m WHERE universities.state_id        = m.dup_id;
UPDATE centers              SET state_id           = m.canonical_id FROM _state_dedup m WHERE centers.state_id             = m.dup_id;
UPDATE centers              SET org_state_id       = m.canonical_id FROM _state_dedup m WHERE centers.org_state_id         = m.dup_id;
UPDATE center_applications  SET permanent_state_id = m.canonical_id FROM _state_dedup m WHERE center_applications.permanent_state_id = m.dup_id;
UPDATE center_applications  SET org_state_id       = m.canonical_id FROM _state_dedup m WHERE center_applications.org_state_id       = m.dup_id;

-- 2c. Delete the now-unreferenced duplicate states
DELETE FROM states USING _state_dedup m WHERE states.id = m.dup_id;

-- 2d. Deduplicate districts (same district_name under the same canonical state)
CREATE TEMP TABLE _district_dedup ON COMMIT DROP AS
SELECT d.id AS dup_id, c.canonical_id
FROM districts d
JOIN (
  SELECT district_name, state_id,
         (SELECT id FROM districts d2
          WHERE d2.district_name = g.district_name AND d2.state_id = g.state_id
          ORDER BY created_at, id LIMIT 1) AS canonical_id
  FROM districts g GROUP BY district_name, state_id
) c ON d.district_name = c.district_name AND d.state_id = c.state_id
WHERE d.id <> c.canonical_id;

UPDATE universities         SET district_id           = m.canonical_id FROM _district_dedup m WHERE universities.district_id        = m.dup_id;
UPDATE centers              SET district_id           = m.canonical_id FROM _district_dedup m WHERE centers.district_id             = m.dup_id;
UPDATE centers              SET org_district_id       = m.canonical_id FROM _district_dedup m WHERE centers.org_district_id         = m.dup_id;
UPDATE center_applications  SET permanent_district_id = m.canonical_id FROM _district_dedup m WHERE center_applications.permanent_district_id = m.dup_id;
UPDATE center_applications  SET org_district_id       = m.canonical_id FROM _district_dedup m WHERE center_applications.org_district_id       = m.dup_id;

DELETE FROM districts USING _district_dedup m WHERE districts.id = m.dup_id;

-- 2e. Add unique constraints so seeds / inserts can never duplicate again
--     (drop-then-add so the whole script is safe to re-run)
ALTER TABLE states     DROP CONSTRAINT IF EXISTS states_state_name_unique;
ALTER TABLE states     ADD  CONSTRAINT states_state_name_unique    UNIQUE (state_name);
ALTER TABLE districts  DROP CONSTRAINT IF EXISTS districts_name_state_unique;
ALTER TABLE districts  ADD  CONSTRAINT districts_name_state_unique UNIQUE (district_name, state_id);
