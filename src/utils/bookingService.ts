import { supabase } from '../lib/supabase';

export interface DBBooking {
  id: string;
  user_id?: string;
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

export function normalizeDateToIso(val: any): string {
  if (!val) return '';
  const str = String(val).trim();
  // Check if it's already YYYY-MM-DD (e.g. 2026-09-14 or 2026-09-14T00:00:00)
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.slice(0, 10);
  }
  // Try parsing date strings like 'September 14, 2026' or 'Sep 14, 2026'
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return '';
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
        user_id: b.user_id || undefined,
        event_date: normalizeDateToIso(b.event_date) || (typeof b.event_date === 'string' ? b.event_date.split('T')[0] : b.event_date),
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
  const iso = normalizeDateToIso(dateIsoStr);
  if (!iso) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [year, month, day] = iso.split('-').map(Number);
  const target = new Date(year, month - 1, day);
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
