-- ==============================================================================
-- BINHI Concept: Affiliate & Partner Management System Migration
-- ==============================================================================

-- 1. Create Affiliates Master Table
CREATE TABLE IF NOT EXISTS public.affiliates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    partner_name TEXT NOT NULL,
    business_name TEXT,
    email TEXT NOT NULL UNIQUE,
    phone TEXT NOT NULL,
    is_phone_verified BOOLEAN DEFAULT true,
    profession TEXT NOT NULL, -- 'Wedding Coordinator', 'Event Planner', 'Venue Manager', 'DJ / Performer', 'Photographer / Videographer', 'Other'
    referral_code TEXT NOT NULL UNIQUE,
    commission_rate NUMERIC(5,2) DEFAULT 5.00, -- 5% commission to affiliate
    client_discount_rate NUMERIC(5,2) DEFAULT 5.00, -- 5% discount to referred customer
    payout_method TEXT NOT NULL DEFAULT 'GCash', -- 'GCash', 'Maya', 'Bank Transfer', 'GoTyme Bank', 'MariBank', 'SeaBank', etc.
    payout_account_name TEXT NOT NULL,
    payout_account_number TEXT NOT NULL,
    payout_bank_name TEXT,
    payout_qr_url TEXT,
    status TEXT NOT NULL DEFAULT 'active', -- 'pending_approval', 'active', 'rejected', 'suspended'
    total_earnings NUMERIC(12,2) DEFAULT 0.00,
    total_paid NUMERIC(12,2) DEFAULT 0.00,
    pending_balance NUMERIC(12,2) DEFAULT 0.00,
    total_referrals_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add affiliate tracking column to Bookings table if not existing
ALTER TABLE public.bookings 
ADD COLUMN IF NOT EXISTS affiliate_code TEXT,
ADD COLUMN IF NOT EXISTS affiliate_id UUID REFERENCES public.affiliates(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS affiliate_discount_amount NUMERIC(10,2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS affiliate_commission_amount NUMERIC(10,2) DEFAULT 0.00;

-- 3. Create Affiliate Referrals Ledger Table
CREATE TABLE IF NOT EXISTS public.affiliate_referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
    booking_ref TEXT NOT NULL,
    client_name TEXT NOT NULL,
    event_date TEXT,
    package_name TEXT,
    contract_amount NUMERIC(12,2) NOT NULL,
    discount_applied NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    commission_earned NUMERIC(10,2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'confirmed', 'completed', 'paid', 'cancelled'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create Affiliate Payouts History Table
CREATE TABLE IF NOT EXISTS public.affiliate_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
    amount NUMERIC(12,2) NOT NULL,
    payout_method TEXT NOT NULL,
    payout_account_name TEXT NOT NULL,
    payout_account_number TEXT NOT NULL,
    payout_bank_name TEXT,
    transaction_reference TEXT NOT NULL,
    receipt_url TEXT,
    notes TEXT,
    processed_by TEXT,
    processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create Affiliate Program Global Settings Table
CREATE TABLE IF NOT EXISTS public.affiliate_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    default_commission_rate NUMERIC(5,2) NOT NULL DEFAULT 5.00,
    default_client_discount_rate NUMERIC(5,2) NOT NULL DEFAULT 5.00,
    is_program_active BOOLEAN NOT NULL DEFAULT true,
    min_payout_threshold NUMERIC(10,2) NOT NULL DEFAULT 1000.00,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default row if not exists
INSERT INTO public.affiliate_settings (default_commission_rate, default_client_discount_rate, is_program_active, min_payout_threshold)
SELECT 5.00, 5.00, true, 1000.00
WHERE NOT EXISTS (SELECT 1 FROM public.affiliate_settings LIMIT 1);

-- 6. Enable Row Level Security (RLS) & Policies
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_settings ENABLE ROW LEVEL SECURITY;

-- Ensure all columns exist if table was previously created
ALTER TABLE public.affiliates ADD COLUMN IF NOT EXISTS is_phone_verified BOOLEAN DEFAULT true;
ALTER TABLE public.affiliates ADD COLUMN IF NOT EXISTS payout_qr_url TEXT;

-- Grants for anon and authenticated clients
GRANT ALL ON TABLE public.affiliates TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.affiliate_referrals TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.affiliate_payouts TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.affiliate_settings TO anon, authenticated, service_role;

-- Affiliates policies
DROP POLICY IF EXISTS "Allow public read of active affiliate codes" ON public.affiliates;
CREATE POLICY "Allow public read of active affiliate codes" 
ON public.affiliates FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert of affiliate applications" ON public.affiliates;
CREATE POLICY "Allow insert of affiliate applications" 
ON public.affiliates FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update of affiliates" ON public.affiliates;
CREATE POLICY "Allow update of affiliates" 
ON public.affiliates FOR ALL USING (true);

-- Referrals policies
DROP POLICY IF EXISTS "Allow all on referrals ledger" ON public.affiliate_referrals;
CREATE POLICY "Allow all on referrals ledger" 
ON public.affiliate_referrals FOR ALL USING (true);

-- Payouts policies
DROP POLICY IF EXISTS "Allow all on payouts" ON public.affiliate_payouts;
CREATE POLICY "Allow all on payouts" 
ON public.affiliate_payouts FOR ALL USING (true);

-- Settings policies
DROP POLICY IF EXISTS "Allow public select on affiliate settings" ON public.affiliate_settings;
CREATE POLICY "Allow public select on affiliate settings" 
ON public.affiliate_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow update on affiliate settings" ON public.affiliate_settings;
CREATE POLICY "Allow update on affiliate settings" 
ON public.affiliate_settings FOR ALL USING (true);

-- 7. Indexes for High-Performance Referral Lookups
CREATE INDEX IF NOT EXISTS idx_affiliates_referral_code ON public.affiliates (referral_code);
CREATE INDEX IF NOT EXISTS idx_affiliate_referrals_affiliate_id ON public.affiliate_referrals (affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_payouts_affiliate_id ON public.affiliate_payouts (affiliate_id);

