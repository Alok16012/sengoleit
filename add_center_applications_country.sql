-- ============================================================
-- Add country columns to center_applications
-- ------------------------------------------------------------
-- The public "Add Center" application form now starts location
-- selection from Country -> State -> District. Store the chosen
-- country alongside the existing state/district foreign keys.
--
-- Run this in: Supabase Dashboard -> SQL Editor -> New query -> Run
-- ============================================================

ALTER TABLE center_applications
  ADD COLUMN IF NOT EXISTS permanent_country_id UUID REFERENCES countries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS org_country_id       UUID REFERENCES countries(id) ON DELETE SET NULL;
