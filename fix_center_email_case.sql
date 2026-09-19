-- A centre whose stored email is not all-lowercase cannot see its own portal.
--
-- WHY
--   Supabase Auth stores the login email lowercased. Every centre screen finds
--   its own record with  centers.email = auth email  (23 places), and the RLS
--   policies match the same way. Both comparisons are case-sensitive, so a
--   centre saved as "Gkrathore08@gmail.com" never matches the "gkrathore08@…"
--   it logs in as: the portal shows no centre name, no students, no balance —
--   while admin, which never looks the centre up by email, shows everything.
--
--   Fixing this in the app would mean 23 call sites AND every RLS policy.
--   Lowercasing the stored value fixes all of them at once, because the value
--   arriving from Auth is already lowercase.
--
-- Run in Supabase -> SQL Editor. STEP 1 changes nothing.

-- ── STEP 1: what would change, and would anything collide? ──
SELECT center_code, center_name, email AS stored_email, lower(email) AS will_become
FROM centers
WHERE email IS NOT NULL AND email <> lower(email)
ORDER BY center_code;

-- Two centres that differ ONLY by case would become duplicates. This must
-- return NO rows before running STEP 2.
SELECT lower(email) AS clashing_email, count(*) AS rows_sharing_it,
       string_agg(center_code, ', ' ORDER BY center_code) AS centers
FROM centers
WHERE email IS NOT NULL
GROUP BY lower(email)
HAVING count(*) > 1;


-- ── STEP 2: the fix. Uncomment and run once STEP 1 reads right. ──
/*
BEGIN;

UPDATE centers
   SET email = lower(trim(email))
 WHERE email IS NOT NULL AND email <> lower(trim(email));

-- Keep it that way, whatever writes the row — the admin's Center form, a
-- super centre adding a sub-centre, an approved application, or SQL by hand.
CREATE OR REPLACE FUNCTION centers_normalise_email() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.email IS NOT NULL THEN NEW.email := lower(trim(NEW.email)); END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_centers_normalise_email ON centers;
CREATE TRIGGER trg_centers_normalise_email
  BEFORE INSERT OR UPDATE OF email ON centers
  FOR EACH ROW EXECUTE FUNCTION centers_normalise_email();

SELECT count(*) AS centers_with_uppercase_email_left
FROM centers WHERE email IS NOT NULL AND email <> lower(email);

COMMIT;
*/
