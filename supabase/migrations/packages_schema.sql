-- ====================================================================
-- SAFE NON-DESTRUCTIVE MIGRATION SCRIPT FOR PACKAGES & PACKAGE IMAGES
-- ====================================================================

-- 1. CREATE PACKAGES TABLE IF NOT EXISTS
CREATE TABLE IF NOT EXISTS public.packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    tag TEXT NOT NULL DEFAULT 'Standard Setup',
    price TEXT NOT NULL,
    raw_price NUMERIC NOT NULL DEFAULT 0,
    description TEXT,
    img TEXT,
    photos JSONB DEFAULT '[]'::jsonb,
    inclusions JSONB DEFAULT '[]'::jsonb,
    recommended_for JSONB DEFAULT '[]'::jsonb,
    specs JSONB DEFAULT '{}'::jsonb,
    items JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_packages_package_id ON public.packages(package_id);
CREATE INDEX IF NOT EXISTS idx_packages_created_at ON public.packages(created_at DESC);

ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;

-- Allow public read access to packages
CREATE POLICY "Public Read Packages" ON public.packages
    FOR SELECT USING (true);

-- Allow authenticated users / full access to write packages
CREATE POLICY "Full Access Packages" ON public.packages
    FOR ALL USING (true) WITH CHECK (true);

-- 2. STORAGE BUCKET FOR PACKAGE IMAGES
INSERT INTO storage.buckets (id, name, public) 
VALUES ('package-images', 'package-images', true)
ON CONFLICT (id) DO NOTHING;
