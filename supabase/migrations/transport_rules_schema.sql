-- ====================================================================
-- SAFE NON-DESTRUCTIVE MIGRATION SCRIPT FOR TRANSPORTATION FEE RULES
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.transport_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    region TEXT NOT NULL,
    base_fee NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_transport_rules_status ON public.transport_rules(status);
CREATE INDEX IF NOT EXISTS idx_transport_rules_region ON public.transport_rules(region);

ALTER TABLE public.transport_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read Transport Rules" ON public.transport_rules;
DROP POLICY IF EXISTS "Full Access Transport Rules" ON public.transport_rules;

CREATE POLICY "Public Read Transport Rules" ON public.transport_rules
    FOR SELECT USING (true);

CREATE POLICY "Full Access Transport Rules" ON public.transport_rules
    FOR ALL USING (true) WITH CHECK (true);
