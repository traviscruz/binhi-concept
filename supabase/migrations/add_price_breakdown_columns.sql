-- Migration script to add detailed price breakdown columns to public.bookings
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS package_price numeric DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS addons_cost numeric DEFAULT 0.00;
