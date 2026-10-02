-- ==============================================================================
-- BINHI Concept: Equipment Model Image Storage & RLS Configuration
-- Run this in your Supabase SQL Editor
-- ==============================================================================

-- 1. Ensure `image_url` column exists on public.equipment_models
ALTER TABLE public.equipment_models 
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 2. Create Public Storage Bucket for Equipment Images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'equipment-images',
  'equipment-images',
  true,
  5242880, -- 5 MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET 
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- 3. Storage Policies for `equipment-images` bucket

-- Allow public read access to equipment photos
DROP POLICY IF EXISTS "Public Access equipment-images" ON storage.objects;
CREATE POLICY "Public Access equipment-images" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'equipment-images');

-- Allow authenticated / staff upload access
DROP POLICY IF EXISTS "Allow Upload equipment-images" ON storage.objects;
CREATE POLICY "Allow Upload equipment-images" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'equipment-images');

-- Allow update / replace access
DROP POLICY IF EXISTS "Allow Update equipment-images" ON storage.objects;
CREATE POLICY "Allow Update equipment-images" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'equipment-images');

-- Allow delete access when models are updated or deleted
DROP POLICY IF EXISTS "Allow Delete equipment-images" ON storage.objects;
CREATE POLICY "Allow Delete equipment-images" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'equipment-images');
