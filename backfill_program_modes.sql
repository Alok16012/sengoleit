-- Backfill Mode + Mode of Study for programs that have none (they show "—").
-- Run in Supabase -> SQL Editor.

-- 1) Make sure the mode rows exist.
INSERT INTO study_modes (mode_name, status)
SELECT 'Semester', 'Active'
WHERE NOT EXISTS (SELECT 1 FROM study_modes WHERE mode_name = 'Semester');

INSERT INTO modes_of_study (mode_name, status)
SELECT 'Regular,External', 'Active'
WHERE NOT EXISTS (SELECT 1 FROM modes_of_study WHERE mode_name = 'Regular,External');

-- 2) Backfill every program that is missing a mode.
UPDATE programs
SET mode_id = (SELECT id FROM study_modes WHERE mode_name = 'Semester' LIMIT 1)
WHERE mode_id IS NULL;

UPDATE programs
SET mode_of_study_id = (SELECT id FROM modes_of_study WHERE mode_name = 'Regular,External' LIMIT 1)
WHERE mode_of_study_id IS NULL;

SELECT 'program modes backfilled' AS result;
