-- ==============================================================================
-- Migration: Add Admin Technical Notes and Approval Columns to Bookings Table
-- Description: Supports Admin Booking Approval with Technical/Crew Notes
-- ==============================================================================

ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS admin_technical_notes TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS approved_by TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS decline_reason TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS declined_at TIMESTAMPTZ DEFAULT NULL;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
