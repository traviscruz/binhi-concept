-- ====================================================================
-- SAFE NON-DESTRUCTIVE MIGRATION SCRIPT FOR CREW BOOKING NOTES
-- ====================================================================

-- 1. Create booking_notes table if not exists
CREATE TABLE IF NOT EXISTS public.booking_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id TEXT NOT NULL,
    author TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'Crew Member',
    content TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'General',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT NULL
);

-- 2. Create indexes for fast querying by booking and date
CREATE INDEX IF NOT EXISTS idx_booking_notes_booking_id ON public.booking_notes(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_notes_created_at ON public.booking_notes(created_at DESC);

-- 3. Enable Row Level Security & Policies
ALTER TABLE public.booking_notes ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'booking_notes' AND policyname = 'Public Read Booking Notes'
    ) THEN
        CREATE POLICY "Public Read Booking Notes" ON public.booking_notes
            FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'booking_notes' AND policyname = 'Full Access Booking Notes'
    ) THEN
        CREATE POLICY "Full Access Booking Notes" ON public.booking_notes
            FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 4. Add crew_notes JSONB column to bookings table for redundancy
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS crew_notes JSONB DEFAULT '[]'::jsonb;
