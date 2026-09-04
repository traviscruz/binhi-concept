-- ====================================================================
-- SAFE NON-DESTRUCTIVE MIGRATION SCRIPT FOR SETUP & TEARDOWN STAGES
-- ====================================================================

-- 1. Add setup_stages JSONB and setup_status TEXT to public.bookings
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS setup_stages JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS setup_status TEXT DEFAULT 'Pending Setup';

-- 2. Create booking_workflow_stages table for granular stage event tracking
CREATE TABLE IF NOT EXISTS public.booking_workflow_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id TEXT NOT NULL,
    stage_id TEXT NOT NULL,
    step_num INTEGER NOT NULL DEFAULT 1,
    title TEXT NOT NULL,
    description TEXT,
    completed BOOLEAN NOT NULL DEFAULT false,
    completed_at TEXT,
    verified_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_booking_stage UNIQUE (booking_id, stage_id)
);

CREATE INDEX IF NOT EXISTS idx_booking_workflow_stages_booking_id ON public.booking_workflow_stages(booking_id);

ALTER TABLE public.booking_workflow_stages ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'booking_workflow_stages' AND policyname = 'Public Read Booking Workflow Stages'
    ) THEN
        CREATE POLICY "Public Read Booking Workflow Stages" ON public.booking_workflow_stages
            FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'booking_workflow_stages' AND policyname = 'Full Access Booking Workflow Stages'
    ) THEN
        CREATE POLICY "Full Access Booking Workflow Stages" ON public.booking_workflow_stages
            FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;
