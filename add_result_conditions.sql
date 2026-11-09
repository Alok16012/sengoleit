-- Result Condition: a result is declared only once enough days have passed
-- since the student's form was submitted (students.date_of_submission). An
-- earlier result costs a fast-track charge, set slab by slab.
--
--   result_rules        one row: the standard wait in days, what the charge
--                       is a multiple of (the semester's fee or the whole
--                       course fee), and the slabs.
--   result_fast_track   an early result the office allowed for one student's
--                       semester, and what was charged for it.
--
-- A slab: { "from": 15, "to": 19, "multiplier": 2, "extra": 0 } — a result
-- wanted on day 15-19 after submission costs 2 x the fee + 0.
--
-- Run once in Supabase -> SQL Editor. Safe to re-run.

CREATE TABLE IF NOT EXISTS result_rules (
  id            int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  standard_days int NOT NULL DEFAULT 20,
  fee_base      text NOT NULL DEFAULT 'semester' CHECK (fee_base IN ('semester', 'course')),
  slabs         jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

INSERT INTO result_rules (id, standard_days, fee_base, slabs)
VALUES (1, 20, 'semester', '[
  {"from": 15, "to": 19, "multiplier": 2, "extra": 0},
  {"from": 6,  "to": 14, "multiplier": 3, "extra": 0},
  {"from": 0,  "to": 5,  "multiplier": 3, "extra": 15000}
]'::jsonb)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS result_fast_track (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  semester    int  NOT NULL,
  allowed_day int,                      -- days after submission it was allowed on
  amount      numeric NOT NULL DEFAULT 0,
  note        text,
  approved_by uuid DEFAULT auth.uid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, semester)
);

ALTER TABLE result_rules      ENABLE ROW LEVEL SECURITY;
ALTER TABLE result_fast_track ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS result_rules_admin ON result_rules;
CREATE POLICY result_rules_admin ON result_rules
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS result_fast_track_admin ON result_fast_track;
CREATE POLICY result_fast_track_admin ON result_fast_track
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Staff roles: Exam Section -> View reads both; the new "Result conditions"
-- permission changes them.
INSERT INTO perm_table_access (perm, table_name, access) VALUES
  ('exam_section.view',             'result_rules',      'r'),
  ('exam_section.view',             'result_fast_track', 'r'),
  ('exam_section.result_condition', 'result_rules',      'w'),
  ('exam_section.result_condition', 'result_fast_track', 'w')
ON CONFLICT DO NOTHING;

DROP POLICY IF EXISTS staff_read ON result_rules;
CREATE POLICY staff_read ON result_rules FOR SELECT TO authenticated USING (staff_can('result_rules', 'r'));
DROP POLICY IF EXISTS staff_write ON result_rules;
CREATE POLICY staff_write ON result_rules FOR ALL TO authenticated
  USING (staff_can('result_rules', 'w')) WITH CHECK (staff_can('result_rules', 'w'));
DROP POLICY IF EXISTS staff_read ON result_fast_track;
CREATE POLICY staff_read ON result_fast_track FOR SELECT TO authenticated USING (staff_can('result_fast_track', 'r'));
DROP POLICY IF EXISTS staff_write ON result_fast_track;
CREATE POLICY staff_write ON result_fast_track FOR ALL TO authenticated
  USING (staff_can('result_fast_track', 'w')) WITH CHECK (staff_can('result_fast_track', 'w'));

NOTIFY pgrst, 'reload schema';

SELECT 'result conditions ready' AS result;
