-- ── Migration: Add Reschedule System to Bookings ─────────────────────────────

-- 1. Add Reschedule Request & Tracking Columns to public.bookings
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS reschedule_status TEXT DEFAULT NULL; 
-- Possible values: 'pending', 'approved', 'rejected', NULL

ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS reschedule_requested_date DATE DEFAULT NULL;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS reschedule_reason TEXT DEFAULT NULL;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS reschedule_requested_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS reschedule_reviewed_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS reschedule_reviewed_by TEXT DEFAULT NULL;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS reschedule_admin_notes TEXT DEFAULT NULL;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS reschedule_history JSONB DEFAULT '[]'::jsonb;

-- 2. Index for fast lookup of pending reschedule requests
CREATE INDEX IF NOT EXISTS idx_bookings_reschedule_status ON public.bookings(reschedule_status);
