-- Courier Details: centres and super centres see the couriers sent to them.
--
-- courier_details was admin-only. Now (read-only):
--   * a centre reads the couriers entered against it (center_id);
--   * a super centre reads those entered against itself (super_center_id or
--     center_id) and against any of its centres.
-- Only the admin still adds, edits or deletes.
--
-- The centre ids are resolved by a SECURITY DEFINER helper so the policy does
-- not re-trigger RLS on `centers`. Run once in Supabase -> SQL Editor, after
-- add_courier_details.sql. Safe to re-run.

CREATE OR REPLACE FUNCTION my_courier_center_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  WITH me AS (
    SELECT id FROM centers WHERE lower(email) = lower(auth.jwt() ->> 'email')
  )
  SELECT id FROM me
  UNION
  SELECT c.id FROM centers c JOIN me ON c.super_center_id = me.id
$$;

DROP POLICY IF EXISTS courier_details_center_read ON courier_details;
CREATE POLICY courier_details_center_read ON courier_details
  FOR SELECT TO authenticated
  USING (
    center_id IN (SELECT * FROM my_courier_center_ids())
    OR super_center_id IN (SELECT * FROM my_courier_center_ids())
  );

NOTIFY pgrst, 'reload schema';

SELECT 'centres can now read their couriers' AS result;
