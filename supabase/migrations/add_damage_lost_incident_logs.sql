-- Migration: Add Damage & Lost Equipment Incident Log Fields to inventory_alerts
-- Allows tracking post-event reports for lost mics, damaged cables, replacement costs, and client liability.

ALTER TABLE public.inventory_alerts 
ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS event_name TEXT,
ADD COLUMN IF NOT EXISTS client_name TEXT,
ADD COLUMN IF NOT EXISTS estimated_cost NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS client_liability TEXT DEFAULT 'Client Liable',
ADD COLUMN IF NOT EXISTS incident_type TEXT DEFAULT 'Damage Incident',
ADD COLUMN IF NOT EXISTS resolution_notes TEXT;

-- Index for fast lookup by booking or incident status
CREATE INDEX IF NOT EXISTS idx_inventory_alerts_booking_id ON public.inventory_alerts(booking_id);
CREATE INDEX IF NOT EXISTS idx_inventory_alerts_incident_type ON public.inventory_alerts(incident_type);
