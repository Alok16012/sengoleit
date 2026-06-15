-- Adds a column to record WHICH form fields the Document Department flagged for
-- correction when it holds a center application. On resubmit, the super center can
-- only edit these specific fields/documents — every verified field stays locked.
--
-- Run this once in Supabase → SQL Editor.

ALTER TABLE centers
  ADD COLUMN IF NOT EXISTS correction_fields jsonb;

-- correction_fields holds a JSON array of SubCenterForm field names, e.g.
--   ["aadhar_no", "cancel_cheque_url", "state_id"]
-- NULL or empty array  => nothing specific was flagged (whole form stays editable).
