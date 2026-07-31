-- E-Book library — admins upload study material PDFs, students download the
-- ones for their programme (or the ones marked for every programme).
--
-- Run once in Supabase -> SQL Editor. Safe to re-run.

CREATE TABLE IF NOT EXISTS ebooks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  description text,
  program_id  uuid REFERENCES programs(id) ON DELETE CASCADE,           -- null = every programme
  session_id  uuid REFERENCES academic_sessions(id) ON DELETE CASCADE,  -- null = every session
  file_url    text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ebooks_program ON ebooks(program_id);

ALTER TABLE ebooks ENABLE ROW LEVEL SECURITY;

-- Students read through the anon role (their portal has no Supabase Auth);
-- e-books are course material, not personal data, so open reads are fine.
DROP POLICY IF EXISTS ebooks_read_all ON ebooks;
CREATE POLICY ebooks_read_all ON ebooks
  FOR SELECT TO anon, authenticated USING (true);

-- Only university admins manage the library (is_admin() comes from
-- security_hardening.sql — run that first).
DROP POLICY IF EXISTS ebooks_admin_write ON ebooks;
CREATE POLICY ebooks_admin_write ON ebooks
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

SELECT 'ebooks ready' AS result;
