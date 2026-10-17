-- Courier Details — admins log every document courier sent out: which super
-- centre / centre, which documents (Marksheet, Provisional, Migration, Degree,
-- or anything else typed in), the student, tracking number, address, sender,
-- and one or more receipt scans.
--
-- Receipts are uploaded to the `documents` bucket under courier-receipts/ and
-- kept here as a JSON list of { name, url }.
--
-- Run once in Supabase -> SQL Editor. Safe to re-run.

CREATE TABLE IF NOT EXISTS courier_details (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  super_center_id  uuid REFERENCES centers(id) ON DELETE SET NULL,
  center_id        uuid REFERENCES centers(id) ON DELETE SET NULL,
  document_types   text[] NOT NULL DEFAULT '{}',  -- Marksheet / Provisional / Migration / Degree / Other
  other_document   text,                          -- what "Other" is
  courier_date     date,
  student_name     text,
  tracking_no      text,
  sent_to_address  text,
  sent_from        text,
  sender_by        text,
  receipts         jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_courier_details_center ON courier_details(center_id);
CREATE INDEX IF NOT EXISTS idx_courier_details_super ON courier_details(super_center_id);
CREATE INDEX IF NOT EXISTS idx_courier_details_date ON courier_details(courier_date DESC);

ALTER TABLE courier_details ENABLE ROW LEVEL SECURITY;

-- Only university admins manage couriers (is_admin() comes from
-- security_hardening.sql — run that first).
DROP POLICY IF EXISTS courier_details_admin_all ON courier_details;
CREATE POLICY courier_details_admin_all ON courier_details
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

SELECT 'courier_details ready' AS result;
