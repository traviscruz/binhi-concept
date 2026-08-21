-- ── Migration: Comprehensive Bookings Table with PayMongo & Add-on Details ──────────

-- 1. Create or Update public.bookings table
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  package_id TEXT NOT NULL,
  package_name TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_date DATE NOT NULL,
  event_description TEXT,
  venue_address TEXT NOT NULL,
  region_rule_id TEXT,
  transport_fee NUMERIC(10,2) DEFAULT 0.00,
  total_cost NUMERIC(10,2) NOT NULL,
  deposit_amount NUMERIC(10,2) NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'paid', 'failed', 'cancelled'
  payment_channel TEXT DEFAULT 'PayMongo', -- 'GCash E-Wallet', 'Visa / Mastercard Credit Card', 'QR Ph Code', 'Maya Wallet'
  paymongo_checkout_id TEXT,
  paymongo_reference_number TEXT,
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  guest_count INTEGER DEFAULT 100,
  selected_addons JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add columns if table already exists
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS customer_email TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS customer_phone TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS guest_count INTEGER DEFAULT 100;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS selected_addons JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS payment_channel TEXT DEFAULT 'PayMongo';
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS paymongo_reference_number TEXT;

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
DROP POLICY IF EXISTS "Allow public select for bookings" ON public.bookings;
CREATE POLICY "Allow public select for bookings" 
  ON public.bookings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public and authenticated insert for bookings" ON public.bookings;
CREATE POLICY "Allow public and authenticated insert for bookings" 
  ON public.bookings FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public and authenticated update for bookings" ON public.bookings;
CREATE POLICY "Allow public and authenticated update for bookings" 
  ON public.bookings FOR UPDATE USING (true);

-- 5. Indexes for fast calendar lookup & payment reconciliation
CREATE INDEX IF NOT EXISTS idx_bookings_event_date ON public.bookings(event_date);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON public.bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_paymongo_ref ON public.bookings(paymongo_reference_number);
