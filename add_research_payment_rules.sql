-- Research Dept -> Payment Condition: the least fee a Ph.D candidate must have
-- paid (students.fee_collected) before each document is issued — e.g. the
-- Hall Ticket, Offer Letter and Entrance Certificate need Rs 50,000.
--
-- Run once in Supabase -> SQL Editor. Safe to re-run.

CREATE TABLE IF NOT EXISTS research_payment_rules (
  doc        text PRIMARY KEY,
  min_fee    numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE research_payment_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS research_payment_rules_admin ON research_payment_rules;
CREATE POLICY research_payment_rules_admin ON research_payment_rules
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

INSERT INTO perm_table_access (perm, table_name, access) VALUES
  ('research_dept.view',   'research_payment_rules', 'r'),
  ('research_dept.manage', 'research_payment_rules', 'w')
ON CONFLICT DO NOTHING;

DROP POLICY IF EXISTS staff_read ON research_payment_rules;
CREATE POLICY staff_read ON research_payment_rules FOR SELECT TO authenticated
  USING (staff_can('research_payment_rules', 'r'));
DROP POLICY IF EXISTS staff_write ON research_payment_rules;
CREATE POLICY staff_write ON research_payment_rules FOR ALL TO authenticated
  USING (staff_can('research_payment_rules', 'w')) WITH CHECK (staff_can('research_payment_rules', 'w'));

NOTIFY pgrst, 'reload schema';

SELECT 'research payment rules ready' AS result;
