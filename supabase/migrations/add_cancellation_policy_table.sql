-- ====================================================================
-- SAFE MIGRATION SCRIPT FOR CANCELLATION & REFUND POLICY SETTINGS
-- ====================================================================

-- 1. Create table for system cancellation policy settings
CREATE TABLE IF NOT EXISTS public.cancellation_settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    is_enabled BOOLEAN DEFAULT true,
    policy_name TEXT DEFAULT 'Standard Tiered Event Cancellation & Refund Policy',
    tiers JSONB NOT NULL DEFAULT '[
        {"id": "tier-1", "days_threshold": 14, "refund_percentage": 100, "label": "14+ Days Before Event (100% Full Refund)"},
        {"id": "tier-2", "days_threshold": 7, "refund_percentage": 75, "label": "7 to 13 Days Before Event (75% Refund)"},
        {"id": "tier-3", "days_threshold": 3, "refund_percentage": 50, "label": "3 to 6 Days Before Event (50% Refund / Deposit Forfeit)"},
        {"id": "tier-4", "days_threshold": 0, "refund_percentage": 0, "label": "Under 72 Hours / 0-2 Days (0% Non-Refundable)"}
    ]'::jsonb,
    grace_period_hours INTEGER DEFAULT 24,
    grace_period_enabled BOOLEAN DEFAULT true,
    processing_fee_type TEXT DEFAULT 'none', -- 'none', 'fixed', 'percentage'
    processing_fee_amount NUMERIC DEFAULT 0,
    allow_reschedule_credit BOOLEAN DEFAULT true,
    policy_notes TEXT DEFAULT 'Cancellations made 14 or more days prior to the scheduled event are eligible for a 100% refund. Cancellations made between 7 and 13 days prior receive a 75% refund. Cancellations made between 3 and 6 days prior receive a 50% refund. Cancellations within 72 hours of the event are strictly non-refundable due to reserved equipment, crew allocation, and production preparation. Bookings cancelled within 24 hours of confirmation receive a 100% refund regardless of timeline if event is at least 48 hours away.',
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 2. Insert default row if not exists
INSERT INTO public.cancellation_settings (id, is_enabled)
VALUES ('default', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Enable RLS (Read for all authenticated/anon, write for admins)
ALTER TABLE public.cancellation_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read cancellation policy settings" ON public.cancellation_settings;
CREATE POLICY "Public can read cancellation policy settings" 
    ON public.cancellation_settings 
    FOR SELECT 
    USING (true);

DROP POLICY IF EXISTS "Admins can update cancellation policy settings" ON public.cancellation_settings;
CREATE POLICY "Admins can update cancellation policy settings" 
    ON public.cancellation_settings 
    FOR ALL 
    USING (auth.jwt() ->> 'role' = 'admin' OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');
