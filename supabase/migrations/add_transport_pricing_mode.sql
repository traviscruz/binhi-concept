-- ====================================================================
-- SAFE MIGRATION SCRIPT FOR TRANSPORT PRICING MODES & PER-KM RATES
-- ====================================================================

-- 1. Create dedicated logistics_settings table if it doesn't already exist
CREATE TABLE IF NOT EXISTS public.logistics_settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    warehouse_name TEXT DEFAULT 'BINHI Central Warehouse & Production Hub',
    warehouse_address TEXT DEFAULT 'BINHI Hub, Bonifacio Global City, Taguig, Metro Manila, Philippines',
    warehouse_lat NUMERIC DEFAULT 14.5547,
    warehouse_lng NUMERIC DEFAULT 121.0456,
    free_radius_km NUMERIC DEFAULT 2.0,
    is_free_radius_enabled BOOLEAN DEFAULT true,
    pricing_mode TEXT DEFAULT 'fixed',
    cost_per_km NUMERIC DEFAULT 80,
    min_transport_fee NUMERIC DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 2. Add columns to logistics_settings in case the table already exists
ALTER TABLE public.logistics_settings 
    ADD COLUMN IF NOT EXISTS pricing_mode TEXT DEFAULT 'fixed',
    ADD COLUMN IF NOT EXISTS cost_per_km NUMERIC DEFAULT 80,
    ADD COLUMN IF NOT EXISTS min_transport_fee NUMERIC DEFAULT 0;

-- 3. Enable RLS & Policies
ALTER TABLE public.logistics_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read Logistics Settings" ON public.logistics_settings;
DROP POLICY IF EXISTS "Full Access Logistics Settings" ON public.logistics_settings;

CREATE POLICY "Public Read Logistics Settings" ON public.logistics_settings
    FOR SELECT USING (true);

CREATE POLICY "Full Access Logistics Settings" ON public.logistics_settings
    FOR ALL USING (true) WITH CHECK (true);

-- 4. Seed default row
INSERT INTO public.logistics_settings (
    id,
    warehouse_name,
    warehouse_address,
    warehouse_lat,
    warehouse_lng,
    free_radius_km,
    is_free_radius_enabled,
    pricing_mode,
    cost_per_km,
    min_transport_fee
) VALUES (
    'default',
    'BINHI Central Warehouse & Production Hub',
    'BINHI Hub, Bonifacio Global City, Taguig, Metro Manila, Philippines',
    14.5547,
    121.0456,
    2.0,
    true,
    'fixed',
    80,
    0
)
ON CONFLICT (id) DO UPDATE SET
    cost_per_km = COALESCE(public.logistics_settings.cost_per_km, EXCLUDED.cost_per_km),
    pricing_mode = COALESCE(public.logistics_settings.pricing_mode, EXCLUDED.pricing_mode);
