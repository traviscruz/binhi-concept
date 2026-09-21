-- ====================================================================
-- SAFE MIGRATION SCRIPT FOR COMPACT JSONB CANCELLATION DATA
-- ====================================================================

-- 1. Add single compact cancellation_data column to public.bookings
ALTER TABLE public.bookings 
    ADD COLUMN IF NOT EXISTS cancellation_data JSONB DEFAULT NULL;

-- 2. Create GIN index for high-performance JSONB filtering
CREATE INDEX IF NOT EXISTS idx_bookings_cancellation_data ON public.bookings USING gin (cancellation_data);

-- 3. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
