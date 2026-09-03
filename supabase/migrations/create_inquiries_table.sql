-- Create Inquiries Table for Public Contact Us submissions
CREATE TABLE IF NOT EXISTS public.inquiries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  website text,
  event_type text NOT NULL,
  event_date text,
  budget text,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'New'::text, -- 'New', 'Replied'
  reply_message text,
  replied_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT inquiries_pkey PRIMARY KEY (id)
);

-- Enable Row Level Security
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;

-- Allow public users (anon) and authenticated users to submit inquiries
CREATE POLICY "Allow public insert to inquiries"
  ON public.inquiries FOR INSERT
  WITH CHECK (true);

-- Allow reading inquiries (used by Admin and inquiry services)
CREATE POLICY "Allow read access to inquiries"
  ON public.inquiries FOR SELECT
  USING (true);

-- Allow updating inquiries (e.g. marking as Replied)
CREATE POLICY "Allow update access to inquiries"
  ON public.inquiries FOR UPDATE
  USING (true);

-- Allow deletion of inquiries
CREATE POLICY "Allow delete access to inquiries"
  ON public.inquiries FOR DELETE
  USING (true);
