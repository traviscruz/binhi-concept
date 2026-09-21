-- ====================================================================
-- SAFE MIGRATION SCRIPT FOR BOOKING CANCELLATION & REFUND SYSTEM
-- ====================================================================

-- 1. Add cancellation and refund tracking columns to public.bookings
ALTER TABLE public.bookings 
    ADD COLUMN IF NOT EXISTS cancellation_status TEXT DEFAULT NULL, -- 'requested', 'approved', 'rejected', 'cancelled_by_admin'
    ADD COLUMN IF NOT EXISTS cancellation_reason TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS cancellation_requested_at TIMESTAMPTZ DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS cancellation_reviewed_at TIMESTAMPTZ DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS cancellation_reviewed_by TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS cancellation_admin_notes TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS refund_status TEXT DEFAULT NULL, -- 'pending', 'refunded', 'declined', 'not_applicable'
    ADD COLUMN IF NOT EXISTS refund_amount NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS refund_channel TEXT DEFAULT NULL, -- 'PayMongo Original Payment', 'GCash', 'Maya', 'Bank Transfer', 'Cash'
    ADD COLUMN IF NOT EXISTS refund_reference_number TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS refund_receipt_url TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Create indexes for quick filtering
CREATE INDEX IF NOT EXISTS idx_bookings_cancellation_status ON public.bookings(cancellation_status);
CREATE INDEX IF NOT EXISTS idx_bookings_refund_status ON public.bookings(refund_status);
