-- ====================================================================
-- SAFE NON-DESTRUCTIVE MIGRATION SCRIPT (DOES NOT DROP ANY DATA OR TABLES)
-- ====================================================================

-- 1. CREATE GENERAL AUDIT LOGS TABLE IF NOT EXISTS
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_email TEXT,
    user_role TEXT DEFAULT 'system',
    action TEXT NOT NULL,
    module TEXT NOT NULL DEFAULT 'general',
    target_id TEXT,
    details TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON public.audit_logs(module);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;


-- 2. CREATE EQUIPMENT MODELS TABLE IF NOT EXISTS
CREATE TABLE IF NOT EXISTS public.equipment_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    brand TEXT NOT NULL DEFAULT 'BINHI Standard',
    category TEXT NOT NULL DEFAULT 'Audio Production',
    description TEXT,
    image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_equipment_models_category ON public.equipment_models(category);
ALTER TABLE public.equipment_models ENABLE ROW LEVEL SECURITY;


-- 3. CREATE PHYSICAL UNITS TABLE IF NOT EXISTS
CREATE TABLE IF NOT EXISTS public.physical_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id TEXT NOT NULL REFERENCES public.equipment_models(model_id) ON DELETE CASCADE,
    serial_id TEXT UNIQUE NOT NULL,
    condition TEXT NOT NULL DEFAULT 'Operational (Good)',
    status TEXT NOT NULL DEFAULT 'Available in Warehouse',
    last_maintenance DATE DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_physical_units_model_id ON public.physical_units(model_id);
CREATE INDEX IF NOT EXISTS idx_physical_units_status ON public.physical_units(status);
ALTER TABLE public.physical_units ENABLE ROW LEVEL SECURITY;


-- 4. CREATE INVENTORY ALERTS TABLE IF NOT EXISTS
CREATE TABLE IF NOT EXISTS public.inventory_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id TEXT REFERENCES public.equipment_models(model_id) ON DELETE CASCADE,
    serial_id TEXT REFERENCES public.physical_units(serial_id) ON DELETE CASCADE,
    alert_type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'High',
    gear_name TEXT NOT NULL,
    details TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_inventory_alerts_status ON public.inventory_alerts(status);
ALTER TABLE public.inventory_alerts ENABLE ROW LEVEL SECURITY;


-- 5. RLS POLICIES FOR TABLES
DROP POLICY IF EXISTS "Public Read Equipment Models" ON public.equipment_models;
DROP POLICY IF EXISTS "Full Access Equipment Models" ON public.equipment_models;
CREATE POLICY "Public Read Equipment Models" ON public.equipment_models FOR SELECT USING (true);
CREATE POLICY "Full Access Equipment Models" ON public.equipment_models FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Read Physical Units" ON public.physical_units;
DROP POLICY IF EXISTS "Full Access Physical Units" ON public.physical_units;
CREATE POLICY "Public Read Physical Units" ON public.physical_units FOR SELECT USING (true);
CREATE POLICY "Full Access Physical Units" ON public.physical_units FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Read Audit Logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Full Access Audit Logs" ON public.audit_logs;
CREATE POLICY "Public Read Audit Logs" ON public.audit_logs FOR SELECT USING (true);
CREATE POLICY "Full Access Audit Logs" ON public.audit_logs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Read Inventory Alerts" ON public.inventory_alerts;
DROP POLICY IF EXISTS "Full Access Inventory Alerts" ON public.inventory_alerts;
CREATE POLICY "Public Read Inventory Alerts" ON public.inventory_alerts FOR SELECT USING (true);
CREATE POLICY "Full Access Inventory Alerts" ON public.inventory_alerts FOR ALL USING (true) WITH CHECK (true);


-- 6. STORAGE BUCKET FOR EQUIPMENT IMAGES
INSERT INTO storage.buckets (id, name, public) 
VALUES ('equipment-images', 'equipment-images', true)
ON CONFLICT (id) DO NOTHING;

