-- ============================================================
-- FIX: Super Center can't see the centers it created
-- ------------------------------------------------------------
-- Problem: the only SELECT policy on `centers` lets an authenticated
-- user read just their OWN row (email match) or admin. A super center
-- therefore cannot read its child centers (super_center_id = own id),
-- so "Center Applications" and "My Centers" show nothing.
--
-- Fix: allow a super center to read rows whose super_center_id points
-- to the super-center row it owns. We resolve "my super center id"
-- through a SECURITY DEFINER helper so the policy does NOT re-trigger
-- RLS on `centers` (which would cause infinite-recursion errors).
--
-- Run this in: Supabase Dashboard -> SQL Editor -> New query -> Run
-- ============================================================

-- Helper: current user's super-center id, bypassing RLS (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION my_super_center_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id
  FROM centers
  WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    AND center_type = 'super_center'
  LIMIT 1
$$;

-- Allow super center to READ its child centers
DROP POLICY IF EXISTS "Super center read children" ON centers;
CREATE POLICY "Super center read children" ON centers
  FOR SELECT TO authenticated
  USING (super_center_id = my_super_center_id());

SELECT 'Super center can now read its child centers.' AS result;
