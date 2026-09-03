-- ====================================================================
-- SAFE MIGRATION SCRIPT FOR PROMOTIONAL VOUCHERS AND MARQUEE BANNERS
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.vouchers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    discount_type TEXT NOT NULL DEFAULT 'percentage', -- 'percentage' | 'fixed'
    discount_value NUMERIC NOT NULL DEFAULT 0,
    max_uses INTEGER DEFAULT NULL, -- NULL = unlimited uses, or integer e.g. 50 checkouts
    used_count INTEGER NOT NULL DEFAULT 0,
    is_all_time BOOLEAN NOT NULL DEFAULT true,
    start_date DATE DEFAULT NULL,
    end_date DATE DEFAULT NULL,
    status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'inactive'
    show_in_banner BOOLEAN NOT NULL DEFAULT false, -- toggle for scrolling marquee banner
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_vouchers_code ON public.vouchers(code);
CREATE INDEX IF NOT EXISTS idx_vouchers_status ON public.vouchers(status);
CREATE INDEX IF NOT EXISTS idx_vouchers_banner ON public.vouchers(show_in_banner);

ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read Vouchers" ON public.vouchers;
DROP POLICY IF EXISTS "Full Access Vouchers" ON public.vouchers;

CREATE POLICY "Public Read Vouchers" ON public.vouchers
    FOR SELECT USING (true);

CREATE POLICY "Full Access Vouchers" ON public.vouchers
    FOR ALL USING (true) WITH CHECK (true);

-- Seed initial voucher codes if empty
INSERT INTO public.vouchers (code, description, discount_type, discount_value, max_uses, used_count, is_all_time, status, show_in_banner)
VALUES
    ('BINHI2026', '10% Seasonal Event Discount', 'percentage', 10, 100, 0, true, 'active', true),
    ('BINHI3K', '₱3,000 Loyalty Voucher', 'fixed', 3000, 50, 0, true, 'active', true),
    ('EARLYBIRD', '₱2,000 Early Booking Reward', 'fixed', 2000, 30, 0, true, 'active', false),
    ('WELCOME500', '₱500 Celebration Discount', 'fixed', 500, NULL, 0, true, 'active', false)
ON CONFLICT (code) DO NOTHING;
