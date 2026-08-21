-- Migration script to add full payment tracking, remaining balance, and receipt proof columns to public.bookings
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS is_fully_paid boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS remaining_balance numeric DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS balance_payment_method text,
ADD COLUMN IF NOT EXISTS balance_receipt_url text,
ADD COLUMN IF NOT EXISTS balance_paid_at timestamp with time zone;
