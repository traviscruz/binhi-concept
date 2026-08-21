import { supabase } from '../lib/supabase';

export interface DBBooking {
  id: string;
  event_date: string; // YYYY-MM-DD
  package_name?: string;
  event_type?: string;
  venue_address?: string;
  payment_status?: string;
  payment_channel?: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  total_cost?: number;
  deposit_amount?: number;
  event_description?: string;
  selected_addons?: any[];
  paymongo_reference_number?: string;
}

export async function fetchDbBookedDates(): Promise<DBBooking[]> {
  try {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .neq('payment_status', 'cancelled');

    if (!error && data) {
      return data.map((b: any) => ({
        id: b.id,
        event_date: typeof b.event_date === 'string' ? b.event_date.split('T')[0] : b.event_date,
        package_name: b.package_name || 'Booked Event',
        event_type: b.event_type || 'Event Production',
        venue_address: b.venue_address || 'Private Location',
        payment_status: b.payment_status || 'paid',
        payment_channel: b.payment_channel || 'PayMongo',
        customer_name: b.customer_name || 'Valued Customer',
        customer_email: b.customer_email || 'customer@binhiconcept.ph',
        customer_phone: b.customer_phone || '',
        total_cost: Number(b.total_cost) || 0,
        deposit_amount: Number(b.deposit_amount) || 0,
        event_description: b.event_description || '',
        selected_addons: b.selected_addons || [],
        paymongo_reference_number: b.paymongo_reference_number || `BNH-${b.id.slice(0, 8)}`,
      }));
    }
  } catch (err) {
    console.error('Failed to fetch db bookings:', err);
  }
  return [];
}

export function isPastDate(dateIsoStr: string): boolean {
  if (!dateIsoStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateIsoStr);
  target.setHours(0, 0, 0, 0);
  return target.getTime() < today.getTime();
}

export function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const cleanStr = typeof dateStr === 'string' ? dateStr.split('T')[0] : dateStr;
    const parts = cleanStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      }
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }
  } catch (e) {}
  return dateStr;
}
