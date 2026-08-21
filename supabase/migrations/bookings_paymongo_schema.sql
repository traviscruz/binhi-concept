-- ── Migration: Create Bookings Table with PayMongo Payment Integration ──────────

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
  payment_channel TEXT DEFAULT 'PayMongo', -- 'GCash', 'Card (Visa/Mastercard)', 'QR Ph', 'Maya Wallet'
  paymongo_checkout_id TEXT,
  paymongo_reference_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Allow public read access to verify booked dates on availability calendar
CREATE POLICY "Allow public select for bookings" 
  ON public.bookings FOR SELECT USING (true);

-- Allow booking creation
CREATE POLICY "Allow public and authenticated insert for bookings" 
  ON public.bookings FOR INSERT WITH CHECK (true);

-- Allow booking status update after payment completion
CREATE POLICY "Allow public and authenticated update for bookings" 
  ON public.bookings FOR UPDATE USING (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_bookings_event_date ON public.bookings(event_date);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON public.bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_paymongo_ref ON public.bookings(paymongo_reference_number);
