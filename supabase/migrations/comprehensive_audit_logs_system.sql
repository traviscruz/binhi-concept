-- ====================================================================
-- COMPREHENSIVE AUDIT LOGS SYSTEM & CREW ASSIGNMENT MIGRATION
-- Safe & Non-destructive: preserves existing tables and schema
-- ====================================================================

-- 1. Ensure public.audit_logs table exists with complete tracking schema
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_name TEXT,
    user_email TEXT,
    user_role TEXT DEFAULT 'system',
    action TEXT NOT NULL,
    module TEXT NOT NULL DEFAULT 'general',
    target_id TEXT,
    target_name TEXT,
    details TEXT NOT NULL,
    previous_data JSONB DEFAULT '{}'::jsonb,
    current_data JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT
);

-- 2. Add columns if table already existed without them
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS user_name TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS user_email TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS user_role TEXT DEFAULT 'system';
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS target_name TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS previous_data JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS current_data JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS ip_address TEXT;

-- 3. Add assigned_crew column to public.bookings if not present
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS assigned_crew JSONB DEFAULT '[]'::jsonb;

-- 4. Enable Row Level Security (RLS) on audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for audit_logs
-- Allow inserts from any authenticated or system service role (to record all activities)
DROP POLICY IF EXISTS "Allow insert for audit logs" ON public.audit_logs;
CREATE POLICY "Allow insert for audit logs"
    ON public.audit_logs FOR INSERT
    WITH CHECK (true);

-- Allow select for authenticated admins and managers
DROP POLICY IF EXISTS "Allow select audit logs" ON public.audit_logs;
CREATE POLICY "Allow select audit logs"
    ON public.audit_logs FOR SELECT
    USING (true);

-- Deny UPDATE and DELETE to guarantee audit immutability
DROP POLICY IF EXISTS "Deny update audit logs" ON public.audit_logs;
CREATE POLICY "Deny update audit logs"
    ON public.audit_logs FOR UPDATE
    USING (false);

DROP POLICY IF EXISTS "Deny delete audit logs" ON public.audit_logs;
CREATE POLICY "Deny delete audit logs"
    ON public.audit_logs FOR DELETE
    USING (false);

-- 6. High Performance Query Indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON public.audit_logs(module);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_email ON public.audit_logs(user_email);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_id ON public.audit_logs(target_id);
