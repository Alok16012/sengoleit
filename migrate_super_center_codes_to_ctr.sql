-- ============================================================
-- Migrate existing Super Center codes to the CTR### structure
-- ------------------------------------------------------------
-- Code structure:
--   Super Center  -> CTR001, CTR002, CTR003 ...
--   Center        -> SIU001, SIU002, SIU003 ...
--
-- New approvals already follow this. This script fixes the
-- OLD super centers that were approved earlier with SIU codes.
--
-- NOTE: A super center's public registration link is
--   /apply/<center_code>, so any previously shared SIU link
--   will stop working after this — re-share the new CTR link.
--
-- Run this in: Supabase Dashboard -> SQL Editor -> New query -> Run
-- ============================================================

-- Step 1: park every super center code in a collision-free temp value
--         (avoids transient UNIQUE violations during renumbering)
UPDATE centers
SET center_code = 'TMP_' || id::text
WHERE center_type = 'super_center';

-- Step 2: renumber sequentially as CTR001, CTR002 ... by creation order
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn
  FROM centers
  WHERE center_type = 'super_center'
)
UPDATE centers c
SET center_code = 'CTR' || LPAD(o.rn::text, 3, '0')
FROM ordered o
WHERE c.id = o.id;

-- Verify
SELECT center_name, center_code, created_at
FROM centers
WHERE center_type = 'super_center'
ORDER BY center_code;
