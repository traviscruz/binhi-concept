-- Create Wishlists Table for Customer Saved Packages
CREATE TABLE IF NOT EXISTS public.wishlists (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  package_id text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT wishlists_pkey PRIMARY KEY (id),
  CONSTRAINT wishlists_user_package_unique UNIQUE (user_id, package_id)
);

-- Enable RLS
ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own wishlist items
CREATE POLICY "Allow users to select their own wishlists"
  ON public.wishlists FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() IS NULL);

-- Allow users to insert their own wishlist items
CREATE POLICY "Allow users to insert their own wishlists"
  ON public.wishlists FOR INSERT
  WITH CHECK (auth.uid() = user_id OR auth.uid() IS NULL);

-- Allow users to delete their own wishlist items
CREATE POLICY "Allow users to delete their own wishlists"
  ON public.wishlists FOR DELETE
  USING (auth.uid() = user_id OR auth.uid() IS NULL);
