-- ==============================================================================
-- Migration: Add Complete Booking Lifecycle, Cancellation, & Refund Columns
-- Description: Ensures all fields for Approval, Decline, and Refund exist in bookings
-- ==============================================================================

ALTER TABLE public.bookings
    -- Technical review & approval
    ADD COLUMN IF NOT EXISTS admin_technical_notes TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS approved_by TEXT DEFAULT NULL,

    -- Cancellation & Decline tracking
    ADD COLUMN IF NOT EXISTS cancellation_reason TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS cancellation_admin_notes TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS decline_reason TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS declined_at TIMESTAMPTZ DEFAULT NULL,

    -- Refund tracking
    ADD COLUMN IF NOT EXISTS refund_status TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS refund_amount NUMERIC DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS refund_channel TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS refund_reference_number TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS refund_id TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ DEFAULT NULL,

    -- Reschedule notes
    ADD COLUMN IF NOT EXISTS reschedule_admin_notes TEXT DEFAULT NULL;

-- Reload Supabase PostgREST Schema Cache
NOTIFY pgrst, 'reload schema';
