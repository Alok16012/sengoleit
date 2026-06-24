-- Course allotment: which fee-structure (program + session) a center is allowed
-- to offer. Admin ticks courses for a center in Fee Management → "Center Courses".
--
-- status:
--   'pending'  = just allotted, awaiting approval
--   'approved' = approved / active for the center
--
-- Run once in Supabase → SQL Editor.

CREATE TABLE IF NOT EXISTS center_courses (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id        uuid NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
  fee_structure_id uuid NOT NULL REFERENCES fee_structures(id) ON DELETE CASCADE,
  status           text NOT NULL DEFAULT 'pending',
  created_at       timestamptz NOT NULL DEFAULT now(),
  approved_at      timestamptz,
  UNIQUE (center_id, fee_structure_id)
);

CREATE INDEX IF NOT EXISTS idx_center_courses_center  ON center_courses(center_id);
CREATE INDEX IF NOT EXISTS idx_center_courses_status  ON center_courses(status);

SELECT 'center_courses ready' AS result;
