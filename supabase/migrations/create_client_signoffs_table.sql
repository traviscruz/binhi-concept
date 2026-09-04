-- ====================================================================
-- CLIENT INGRESS & SOUNDCHECK DIGITAL SIGN-OFF TABLE
-- Stores digital signature, timestamp, and equipment checklist
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.client_signoffs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id TEXT NOT NULL UNIQUE,
    client_name TEXT NOT NULL,
    signer_role TEXT NOT NULL DEFAULT 'Event Client / Host',
    signature_url TEXT NOT NULL,
    signed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    verified_items JSONB DEFAULT '[]'::jsonb,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Enable Row Level Security
ALTER TABLE public.client_signoffs ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated and public users to read and submit sign-offs
DROP POLICY IF EXISTS "Allow select for client_signoffs" ON public.client_signoffs;
CREATE POLICY "Allow select for client_signoffs"
    ON public.client_signoffs FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Allow insert for client_signoffs" ON public.client_signoffs;
CREATE POLICY "Allow insert for client_signoffs"
    ON public.client_signoffs FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update for client_signoffs" ON public.client_signoffs;
CREATE POLICY "Allow update for client_signoffs"
    ON public.client_signoffs FOR UPDATE
    USING (true);

-- Index for fast lookup by booking ID
CREATE INDEX IF NOT EXISTS idx_client_signoffs_booking_id ON public.client_signoffs(booking_id);
