-- SECURITY STEP 1b — the public (anon) key can no longer read centres'
-- passwords, KYC and bank details.
--
-- WHY
--   centers holds login_password / generated_password, Aadhaar, PAN, bank
--   account numbers, wallet balances. With RLS off and a full SELECT grant,
--   anyone holding the website's public key could read all of it.
--
--   What public pages actually read: the centre registration form looks up a
--   super centre by code (id, center_name, center_code, center_type) and
--   numbers the application (application_no). Only those, plus a few other
--   non-sensitive listing columns, stay readable without a login.
--
-- Undo: GRANT SELECT ON public.centers TO anon;   Safe to re-run.

REVOKE SELECT ON public.centers FROM anon;
GRANT SELECT (id, center_name, center_code, center_type, application_no,
              super_center_id, status, approval_status, city, state_id, district_id)
  ON public.centers TO anon;

SELECT 'step 1b done — centres'' private columns are no longer public' AS result;
