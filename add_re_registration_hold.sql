-- Re-Registration: hold the fee when the CENTRE raises the request.
--
-- The money used to move only when the admin approved. The centre's modal,
-- though, said "Held from the centre's wallet: ₹4,000" at request time — so a
-- centre that raised eight requests saw nothing leave its wallet and reasonably
-- concluded the deduction was broken.
--
-- The hold now happens on the centre's own click, matching what the modal says.
-- held_at records that it did, so that:
--   * approving does not take the same money a second time, and
--   * rejecting puts it back.
--
-- Requests raised BEFORE this column existed have held_at NULL, and are still
-- charged at approval exactly as they were.
--
-- Run in Supabase -> SQL Editor. Safe to re-run.

ALTER TABLE re_registrations ADD COLUMN IF NOT EXISTS held_at timestamptz;

COMMENT ON COLUMN re_registrations.held_at IS
  'When fee_amount was taken from the centre wallet. NULL = not yet held (a request raised before holds moved to request time); the charge then happens at approval.';

SELECT 'held_at ready' AS result;
