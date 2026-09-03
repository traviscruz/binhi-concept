-- ── Migration: Add Manual Booking Source & Deposit Receipt Columns ──────────
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS booking_source TEXT DEFAULT 'Online Booking',
ADD COLUMN IF NOT EXISTS deposit_receipt_url TEXT;

-- Index for filtering by booking source (e.g., Walk-in, Viber, Facebook)
CREATE INDEX IF NOT EXISTS idx_bookings_booking_source ON public.bookings(booking_source);
