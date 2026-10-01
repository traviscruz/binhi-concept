-- ==============================================================================
-- BINHI Concept: Supabase Storage Buckets & Affiliate System Policies
-- Run this in your Supabase SQL Editor to ensure all storage buckets and tables are active
-- ==============================================================================

-- 1. Create Storage Buckets (booking-receipts for payouts, proofs & QR codes, and avatars)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    ('booking-receipts', 'booking-receipts', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']),
    ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO UPDATE SET 
    public = true,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Storage Policies for `booking-receipts` bucket
DROP POLICY IF EXISTS "Public Access booking-receipts" ON storage.objects;
CREATE POLICY "Public Access booking-receipts" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'booking-receipts' OR bucket_id = 'avatars');

DROP POLICY IF EXISTS "Allow Upload to booking-receipts" ON storage.objects;
CREATE POLICY "Allow Upload to booking-receipts" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'booking-receipts' OR bucket_id = 'avatars');

DROP POLICY IF EXISTS "Allow Update on booking-receipts" ON storage.objects;
CREATE POLICY "Allow Update on booking-receipts" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'booking-receipts' OR bucket_id = 'avatars');

DROP POLICY IF EXISTS "Allow Delete on booking-receipts" ON storage.objects;
CREATE POLICY "Allow Delete on booking-receipts" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'booking-receipts' OR bucket_id = 'avatars');

-- 3. Ensure Affiliates Tables Exist with all Required Columns
CREATE TABLE IF NOT EXISTS public.affiliates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    partner_name TEXT NOT NULL,
    business_name TEXT,
    email TEXT NOT NULL UNIQUE,
    phone TEXT NOT NULL,
    is_phone_verified BOOLEAN DEFAULT true,
    profession TEXT NOT NULL,
    referral_code TEXT NOT NULL UNIQUE,
    commission_rate NUMERIC(5,2) DEFAULT 5.00,
    client_discount_rate NUMERIC(5,2) DEFAULT 5.00,
    payout_method TEXT NOT NULL DEFAULT 'GCash',
    payout_account_name TEXT NOT NULL,
    payout_account_number TEXT NOT NULL,
    payout_bank_name TEXT,
    payout_qr_url TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    total_earnings NUMERIC(12,2) DEFAULT 0.00,
    total_paid NUMERIC(12,2) DEFAULT 0.00,
    pending_balance NUMERIC(12,2) DEFAULT 0.00,
    total_referrals_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure affiliate_payouts Table exists with receipt_url column
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

-- Ensure affiliate_referrals Table exists
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
    status TEXT NOT NULL DEFAULT 'confirmed',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable RLS and Permissive Policies for Web Access
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all on affiliates" ON public.affiliates;
CREATE POLICY "Allow all on affiliates" ON public.affiliates FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on payouts" ON public.affiliate_payouts;
CREATE POLICY "Allow all on payouts" ON public.affiliate_payouts FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on referrals" ON public.affiliate_referrals;
CREATE POLICY "Allow all on referrals" ON public.affiliate_referrals FOR ALL USING (true) WITH CHECK (true);
