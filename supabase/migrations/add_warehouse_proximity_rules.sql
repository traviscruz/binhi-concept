-- ====================================================================
-- SAFE MIGRATION SCRIPT FOR WAREHOUSE PROXIMITY & FREE TRANSPORT RADIUS
-- ====================================================================

-- 1. Create dedicated logistics_settings table for warehouse pin & proximity rules
CREATE TABLE IF NOT EXISTS public.logistics_settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    warehouse_name TEXT DEFAULT 'BINHI Central Warehouse & Production Hub',
    warehouse_address TEXT DEFAULT 'BINHI Hub, Bonifacio Global City, Taguig, Metro Manila, Philippines',
    warehouse_lat NUMERIC DEFAULT 14.5547,
    warehouse_lng NUMERIC DEFAULT 121.0456,
    free_radius_km NUMERIC DEFAULT 2.0,
    is_free_radius_enabled BOOLEAN DEFAULT true,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Enable RLS & Policies
ALTER TABLE public.logistics_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read Logistics Settings" ON public.logistics_settings;
DROP POLICY IF EXISTS "Full Access Logistics Settings" ON public.logistics_settings;

CREATE POLICY "Public Read Logistics Settings" ON public.logistics_settings
    FOR SELECT USING (true);

CREATE POLICY "Full Access Logistics Settings" ON public.logistics_settings
    FOR ALL USING (true) WITH CHECK (true);

-- Insert default warehouse logistics settings (2km free transport radius)
INSERT INTO public.logistics_settings (
    id,
    warehouse_name,
    warehouse_address,
    warehouse_lat,
    warehouse_lng,
    free_radius_km,
    is_free_radius_enabled
) VALUES (
    'default',
    'BINHI Central Warehouse & Production Hub',
    'BINHI Hub, Bonifacio Global City, Taguig, Metro Manila, Philippines',
    14.5547,
    121.0456,
    2.0,
    true
)
ON CONFLICT (id) DO UPDATE SET
    free_radius_km = EXCLUDED.free_radius_km,
    is_free_radius_enabled = EXCLUDED.is_free_radius_enabled;

-- 2. Optional: Add warehouse proximity metadata columns to transport_rules
ALTER TABLE public.transport_rules 
    ADD COLUMN IF NOT EXISTS free_distance_km NUMERIC DEFAULT 2.0;
