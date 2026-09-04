-- ====================================================================
-- SAFE MIGRATION SCRIPT FOR LOYALTY POINTS ENGINE & AUTO-COMPUTATION
-- ====================================================================

-- 1. Ensure loyalty_points column exists in profiles table
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS loyalty_points integer DEFAULT 0 NOT NULL;

-- 2. Ensure points_awarded column exists in bookings table
ALTER TABLE public.bookings 
  ADD COLUMN IF NOT EXISTS points_awarded boolean DEFAULT false NOT NULL;

-- 3. Create Loyalty Settings Table (For Admin Configuration)
CREATE TABLE IF NOT EXISTS public.loyalty_settings (
    id text PRIMARY KEY DEFAULT 'default_config',
    points_per_peso numeric NOT NULL DEFAULT 100, -- Default: ₱100 spent = 1 Point
    silver_threshold integer NOT NULL DEFAULT 500,
    gold_threshold integer NOT NULL DEFAULT 1500,
    platinum_threshold integer NOT NULL DEFAULT 4000,
    updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Seed default configuration if empty
INSERT INTO public.loyalty_settings (id, points_per_peso, silver_threshold, gold_threshold, platinum_threshold)
VALUES ('default_config', 100, 500, 1500, 4000)
ON CONFLICT (id) DO NOTHING;

-- 4. Create Loyalty Transactions Table (Point Earning & Redemption History)
CREATE TABLE IF NOT EXISTS public.loyalty_transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
    event_name text NOT NULL,
    points integer NOT NULL, -- Positive for earn (+350), Negative for redeem (-100)
    type text NOT NULL DEFAULT 'earn', -- 'earn' | 'redeem'
    created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_loyalty_tx_user ON public.loyalty_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_tx_created ON public.loyalty_transactions(created_at DESC);

-- 5. Create Redeemable Loyalty Rewards Table (Admin Editable Voucher Tiers)
CREATE TABLE IF NOT EXISTS public.loyalty_rewards (
    id text PRIMARY KEY,
    title text NOT NULL,
    cost integer NOT NULL, -- Points required to redeem (e.g. 100 PTS)
    discount_amount numeric NOT NULL, -- Direct ₱ cash discount (e.g. 500)
    description text NOT NULL DEFAULT '',
    badge text DEFAULT NULL, -- e.g. 'Popular', 'Best Value'
    is_active boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Seed initial reward options if empty
INSERT INTO public.loyalty_rewards (id, title, cost, discount_amount, description, badge, sort_order)
VALUES
  ('disc-500', '₱500 Cash Discount Voucher', 100, 500, 'Instant ₱500 deduction applied directly to your booking subtotal on any equipment or package.', 'Popular', 1),
  ('disc-1500', '₱1,500 Production Discount Voucher', 250, 1500, 'Save ₱1,500 on standard or multi-day event production sound & lighting reservations.', 'Best Value', 2),
  ('disc-3000', '₱3,000 Major Event Discount Voucher', 500, 3000, 'Flat ₱3,000 cash discount voucher directly applied to celebrations, concerts, or grand setups.', 'High Saver', 3),
  ('disc-6500', '₱6,500 VIP Celebration Voucher', 1000, 6500, 'Exclusive VIP host voucher offering ₱6,500 in direct rental fee credit.', 'VIP Exclusive', 4),
  ('disc-10000', '₱10,000 Executive Credit Voucher', 1500, 10000, 'Maximum tier voucher granting ₱10,000 direct deduction on premium arena & wedding packages.', 'Executive Tier', 5)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE public.loyalty_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_rewards ENABLE ROW LEVEL SECURITY;

-- Policies for loyalty_settings
DROP POLICY IF EXISTS "Public Read Loyalty Settings" ON public.loyalty_settings;
DROP POLICY IF EXISTS "Admin Full Access Loyalty Settings" ON public.loyalty_settings;

CREATE POLICY "Public Read Loyalty Settings" ON public.loyalty_settings
    FOR SELECT USING (true);

CREATE POLICY "Admin Full Access Loyalty Settings" ON public.loyalty_settings
    FOR ALL USING (true) WITH CHECK (true);

-- Policies for loyalty_transactions
DROP POLICY IF EXISTS "User Select Own Loyalty Transactions" ON public.loyalty_transactions;
DROP POLICY IF EXISTS "Full Access Loyalty Transactions" ON public.loyalty_transactions;

CREATE POLICY "User Select Own Loyalty Transactions" ON public.loyalty_transactions
    FOR SELECT USING (auth.uid() = user_id OR auth.uid() IS NULL);

CREATE POLICY "Full Access Loyalty Transactions" ON public.loyalty_transactions
    FOR ALL USING (true) WITH CHECK (true);

-- Policies for loyalty_rewards
DROP POLICY IF EXISTS "Public Read Loyalty Rewards" ON public.loyalty_rewards;
DROP POLICY IF EXISTS "Admin Full Access Loyalty Rewards" ON public.loyalty_rewards;

CREATE POLICY "Public Read Loyalty Rewards" ON public.loyalty_rewards
    FOR SELECT USING (true);

CREATE POLICY "Admin Full Access Loyalty Rewards" ON public.loyalty_rewards
    FOR ALL USING (true) WITH CHECK (true);
