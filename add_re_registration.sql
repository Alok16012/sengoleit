-- Re-Registration — a student moving into the next semester / year.
--
-- Flow: the CENTER raises a request from its student list; the ADMIN reviews it
-- on the Students page. On approval the fee is held from the center's wallet
-- and the student's Semester / Year advances.
--
-- Run once in Supabase -> SQL Editor. Safe to re-run.
-- (Run security_hardening.sql first — the policies below use is_admin().)

CREATE TABLE IF NOT EXISTS re_registrations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  center_id    uuid REFERENCES centers(id) ON DELETE SET NULL,
  session_id   uuid REFERENCES academic_sessions(id) ON DELETE SET NULL,
  from_term    text,                      -- e.g. '1st Semester'
  to_term      text NOT NULL,             -- e.g. '2nd Semester'
  fee_amount   numeric NOT NULL DEFAULT 0,-- held from the wallet on approval
  status       text NOT NULL DEFAULT 'Pending',  -- Pending | Approved | Rejected
  remarks      text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  decided_at   timestamptz
);

CREATE INDEX IF NOT EXISTS idx_rereg_student ON re_registrations(student_id);
CREATE INDEX IF NOT EXISTS idx_rereg_status  ON re_registrations(status);

-- Only one request may be open per student at a time.
CREATE UNIQUE INDEX IF NOT EXISTS idx_rereg_one_pending
  ON re_registrations(student_id) WHERE status = 'Pending';

ALTER TABLE re_registrations ENABLE ROW LEVEL SECURITY;

-- Start from a clean slate so a leftover permissive policy can't widen this
-- (policies are OR'd).
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 're_registrations' LOOP
    EXECUTE format('DROP POLICY %I ON re_registrations', p.policyname);
  END LOOP;
END $$;

-- Admins review and decide.
CREATE POLICY rereg_admin_all ON re_registrations
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- A center sees and raises requests for its own students only. It cannot
-- approve: the status column is decided by the admin policy above.
CREATE POLICY rereg_center_read_own ON re_registrations
  FOR SELECT TO authenticated USING (
    center_id IN (SELECT id FROM centers WHERE email = (auth.jwt() ->> 'email'))
  );

CREATE POLICY rereg_center_insert_own ON re_registrations
  FOR INSERT TO authenticated WITH CHECK (
    status = 'Pending'
    AND center_id IN (SELECT id FROM centers WHERE email = (auth.jwt() ->> 'email'))
  );

SELECT 're_registrations ready' AS result;
