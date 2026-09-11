-- ── Migration: Add booking_status and is_completed tracking columns to public.bookings ──

-- 1. Add status columns to public.bookings
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Upcoming',
ADD COLUMN IF NOT EXISTS booking_status TEXT DEFAULT 'upcoming',
ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- 2. Backfill existing records based on dates and payment statuses:

-- A) Completed events (explicitly marked or past event date)
UPDATE public.bookings
SET 
  is_completed = true,
  status = 'Completed',
  booking_status = 'completed',
  completed_at = COALESCE(completed_at, updated_at, NOW())
WHERE 
  payment_status = 'completed' 
  OR (event_date < CURRENT_DATE AND payment_status != 'cancelled');

-- B) Cancelled events
UPDATE public.bookings
SET 
  is_completed = false,
  status = 'Cancelled',
  booking_status = 'cancelled'
WHERE 
  payment_status = 'cancelled';

-- C) Ongoing events (Today's active date)
UPDATE public.bookings
SET 
  is_completed = false,
  status = 'Ongoing',
  booking_status = 'ongoing'
WHERE 
  event_date = CURRENT_DATE
  AND payment_status IN ('paid', 'confirmed', 'completed_balance')
  AND payment_status != 'cancelled'
  AND is_completed = false;

-- D) Upcoming events (Future confirmed dates)
UPDATE public.bookings
SET 
  is_completed = false,
  status = 'Upcoming',
  booking_status = 'upcoming'
WHERE 
  payment_status IN ('paid', 'confirmed')
  AND (event_date > CURRENT_DATE OR event_date IS NULL)
  AND payment_status != 'cancelled'
  AND payment_status != 'completed';

-- E) Pending deposit reservations
UPDATE public.bookings
SET 
  is_completed = false,
  status = 'Pending Deposit Approval',
  booking_status = 'pending'
WHERE 
  payment_status = 'pending'
  AND payment_status != 'cancelled';
