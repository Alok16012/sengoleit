-- Research Dept -> Fee Entry: the Ph.D fee a centre pays the university,
-- decided by the Research Dept instead of Fee Management x Center Sharing %.
-- One row per Ph.D programme, either for every session (session_id NULL, the
-- fallback) or for one session. It may never be less than the highest
-- Payment Condition amount — the page enforces that.
--
-- Centres read it (their admission form and wallet check quote this fee);
-- only the admin / Research Dept staff can change it.
--
-- Run once in Supabase -> SQL Editor. Safe to re-run.

CREATE TABLE IF NOT EXISTS research_fees (
  id          text PRIMARY KEY,            -- '<program_id>:<session_id|all>'
  program_id  uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  session_id  uuid REFERENCES academic_sessions(id) ON DELETE CASCADE,
  fee         numeric NOT NULL CHECK (fee >= 0),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE research_fees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS research_fees_read ON research_fees;
CREATE POLICY research_fees_read ON research_fees
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS research_fees_admin ON research_fees;
CREATE POLICY research_fees_admin ON research_fees
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

INSERT INTO perm_table_access (perm, table_name, access) VALUES
  ('research_dept.manage', 'research_fees', 'w')
ON CONFLICT DO NOTHING;

DROP POLICY IF EXISTS staff_write ON research_fees;
CREATE POLICY staff_write ON research_fees FOR ALL TO authenticated
  USING (staff_can('research_fees', 'w')) WITH CHECK (staff_can('research_fees', 'w'));

NOTIFY pgrst, 'reload schema';

SELECT 'research fees ready' AS result;
