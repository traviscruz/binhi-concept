-- ====================================================================
-- MIGRATION: Add assigned_units column to public.bookings
-- Stores unit-level physical serial assignments for packing & dispatch
-- ====================================================================

-- 1. Add assigned_units JSONB column to public.bookings if not present
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS assigned_units JSONB DEFAULT '[]'::jsonb;

-- 2. Add comment explaining column purpose
COMMENT ON COLUMN public.bookings.assigned_units IS 'Array of physical equipment unit serial IDs assigned to this booking for stage rigging, packing checklist, and audit tracking';

-- 3. Create GIN index for fast JSON query and lookup
CREATE INDEX IF NOT EXISTS idx_bookings_assigned_units ON public.bookings USING GIN (assigned_units);

-- 4. Enable RLS and public policies (matching existing bookings table permissions)
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
