-- Create Reviews Table for Customer Submitted & Featured Testimonials
CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES public.bookings(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  customer_role text DEFAULT 'Event Host'::text,
  event_name text NOT NULL,
  package_name text,
  rating integer NOT NULL DEFAULT 5,
  comment text NOT NULL,
  status text NOT NULL DEFAULT 'approved'::text, -- 'pending', 'approved', 'featured'
  is_mock boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT reviews_pkey PRIMARY KEY (id)
);

-- Enable RLS
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Allow public read access to approved and featured reviews
CREATE POLICY "Allow public read access to approved reviews"
  ON public.reviews FOR SELECT
  USING (true);

-- Allow authenticated users to insert reviews
CREATE POLICY "Allow authenticated users to insert reviews"
  ON public.reviews FOR INSERT
  WITH CHECK (true);
