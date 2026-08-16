-- Student fee ledger — one row per DEDUCTION from a centre's wallet.
--
-- Until now the only record of money taken for a student was the running total
-- in students.fee_collected. Three different events add to it — admission
-- approval, a re-registration approval, and the Exam Section collecting a
-- semester's balance — so the Payment Summary could only ever show one merged
-- figure ("− ₹16,000") with no way to tell what it was made of, and the Exam
-- Section's collections left no trace at all.
--
-- This table records each deduction as it happens. fee_collected stays as the
-- authoritative running total (every gate reads it); the ledger explains it.
--
-- Run once in Supabase -> SQL Editor. Safe to re-run.
-- (Run security_hardening.sql first — the policy below uses is_admin().)

CREATE TABLE IF NOT EXISTS student_fee_ledger (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id  uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  center_id   uuid REFERENCES centers(id) ON DELETE SET NULL,
  amount      numeric NOT NULL,
  -- 'admission'       — taken when the Account Dept approved the admission
  -- 're_registration' — taken when a re-registration was approved
  -- 'exam_balance'    — the semester balance the Exam Section collected
  -- 'opening'         — backfilled below: money taken before this table existed
  kind        text NOT NULL,
  term        text,            -- e.g. '2nd Semester' — which term it paid for
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fee_ledger_student ON student_fee_ledger(student_id);
CREATE INDEX IF NOT EXISTS idx_fee_ledger_center  ON student_fee_ledger(center_id);

ALTER TABLE student_fee_ledger ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies
           WHERE schemaname = 'public' AND tablename = 'student_fee_ledger' LOOP
    EXECUTE format('DROP POLICY %I ON student_fee_ledger', p.policyname);
  END LOOP;
END $$;

-- The university writes it; centres read their own students' lines.
CREATE POLICY fee_ledger_admin_all ON student_fee_ledger
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY fee_ledger_center_read ON student_fee_ledger
  FOR SELECT TO authenticated USING (
    center_id IN (SELECT id FROM centers WHERE email = (auth.jwt() ->> 'email'))
    OR center_id IN (
      SELECT c.id FROM centers c
      JOIN centers sc ON c.super_center_id = sc.id
      WHERE sc.email = (auth.jwt() ->> 'email')
    )
  );

-- ------------------------------------------------------------
-- Backfill, so existing students' totals are explained rather than appearing
-- from nowhere. Runs only when the table is empty, so re-running is safe.
--
-- Approved re-registrations are known exactly. Whatever is left of
-- fee_collected after those is money taken before this table existed — it may
-- be an admission deduction, an Exam Section collection, or both, and the old
-- data cannot tell them apart, so it is honestly labelled 'opening'.
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM student_fee_ledger) THEN

    IF EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'public' AND table_name = 're_registrations') THEN
      INSERT INTO student_fee_ledger (student_id, center_id, amount, kind, term, note, created_at)
      SELECT r.student_id, r.center_id, r.fee_amount, 're_registration', r.to_term,
             'Backfilled from the re-registration record', coalesce(r.decided_at, r.requested_at)
      FROM re_registrations r
      WHERE r.status = 'Approved' AND coalesce(r.fee_amount, 0) > 0;
    END IF;

    INSERT INTO student_fee_ledger (student_id, center_id, amount, kind, term, note, created_at)
    SELECT s.id, s.center_id,
           coalesce(s.fee_collected, 0) - coalesce((
             SELECT sum(l.amount) FROM student_fee_ledger l WHERE l.student_id = s.id
           ), 0),
           'opening', s.semester_year,
           'Balance already collected before itemised records began',
           coalesce(s.date_of_admission, s.created_at)
    FROM students s
    WHERE coalesce(s.fee_collected, 0) - coalesce((
            SELECT sum(l.amount) FROM student_fee_ledger l WHERE l.student_id = s.id
          ), 0) > 0;

  END IF;
END $$;

SELECT 'student_fee_ledger ready' AS result;
