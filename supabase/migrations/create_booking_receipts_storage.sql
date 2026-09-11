-- Migration script to create the storage bucket for booking receipts (deposit slips and event-day balance settlement proofs)

INSERT INTO storage.buckets (id, name, public)
VALUES ('booking-receipts', 'booking-receipts', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow public read access to booking receipts
CREATE POLICY "Public Read Booking Receipts" ON storage.objects
    FOR SELECT USING (bucket_id = 'booking-receipts');

-- Allow uploads (authenticated, anon, or service role)
CREATE POLICY "Allow All Uploads Booking Receipts" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'booking-receipts');

CREATE POLICY "Allow All Updates Booking Receipts" ON storage.objects
    FOR UPDATE USING (bucket_id = 'booking-receipts') WITH CHECK (bucket_id = 'booking-receipts');

CREATE POLICY "Allow All Deletes Booking Receipts" ON storage.objects
    FOR DELETE USING (bucket_id = 'booking-receipts');
