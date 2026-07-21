-- Staging (draft) center flag.
--
-- A center marked is_staging = true is a holding area: admissions are pre-filled
-- there as drafts (status Pending), then transferred to a real center from the
-- Pending Students list ("Transfer & Forward") — which reassigns the student to
-- the destination center, holds the fee from THAT center's wallet, and sends the
-- application to the Document Department (the normal flow).
--
-- Run this once in Supabase -> SQL Editor.

ALTER TABLE centers ADD COLUMN IF NOT EXISTS is_staging boolean DEFAULT false;

SELECT 'is_staging ready' AS result;
