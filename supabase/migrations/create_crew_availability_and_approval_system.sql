-- ==============================================================================
-- Migration: Create Crew Availability Table & Approval Tracking
-- Description: Supports the Crew Attendance/Leave System and Booking Approval/Decline Lifecycle
-- ==============================================================================

-- 1. Create crew_availability table
CREATE TABLE IF NOT EXISTS public.crew_availability (
    id TEXT PRIMARY KEY,
    crew_id TEXT NOT NULL,
    crew_name TEXT,
    date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('available', 'on_leave', 'unavailable')),
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup by date and crew_id
CREATE INDEX IF NOT EXISTS idx_crew_availability_date ON public.crew_availability(date);
CREATE INDEX IF NOT EXISTS idx_crew_availability_crew_id ON public.crew_availability(crew_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_crew_availability_crew_date ON public.crew_availability(crew_id, date);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.crew_availability ENABLE ROW LEVEL SECURITY;

-- Allow public / anon to read crew availability (needed for customer checkout calendar availability check)
CREATE POLICY "Allow public read crew availability"
    ON public.crew_availability
    FOR SELECT
    USING (true);

-- Allow authenticated users (crew & admin) to insert/update availability
CREATE POLICY "Allow authenticated manage crew availability"
    ON public.crew_availability
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Allow service role / anon fallback for demo/local testing
CREATE POLICY "Allow anon manage crew availability"
    ON public.crew_availability
    FOR ALL
    TO anon
    USING (true)
    WITH CHECK (true);

-- 3. Add approval & decline audit columns to bookings table (if not already present)
ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS approved_by TEXT,
    ADD COLUMN IF NOT EXISTS decline_reason TEXT,
    ADD COLUMN IF NOT EXISTS declined_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS refund_id TEXT;

-- 4. Add dynamic crew staffing rules to booking_settings table (if not already present)
ALTER TABLE public.booking_settings
    ADD COLUMN IF NOT EXISTS min_crew_required INTEGER DEFAULT 2,
    ADD COLUMN IF NOT EXISTS require_full_crew_roster BOOLEAN DEFAULT TRUE;
