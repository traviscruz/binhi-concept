import { supabase } from './supabase';
import type { CrewAvailabilityRecord } from '../types';
import { fetchBookingSettings, type BookingSettings } from './bookingEngine';

const STORAGE_KEY = 'binhi_crew_availability';

export interface DailyCrewCapacity {
  date: string; // YYYY-MM-DD
  totalActiveCrew: number;
  availableCrewCount: number;
  onLeaveCrewCount: number;
  assignedCrewCount: number;
  isAvailableForBooking: boolean;
  blockReason?: string;
  crewRoster: Array<{
    crewId: string;
    crewName: string;
    status: 'available' | 'on_leave' | 'assigned';
    reason?: string;
    assignedBookingRef?: string;
  }>;
}

// Local cache helper
function getLocalAvailability(): CrewAvailabilityRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalAvailability(records: CrewAvailabilityRecord[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {}
}

/**
 * Fetch all active crew members (role === 'crew' only, excluding admins & inventory managers)
 */
export async function fetchActiveCrewMembers(): Promise<Array<{ id: string; name: string; email: string }>> {
  // 1. Try Supabase Edge Function list-staff (authoritative staff directory)
  try {
    const { data: fnData, error: fnError } = await supabase.functions.invoke('list-staff');
    if (!fnError && fnData?.staff && Array.isArray(fnData.staff)) {
      const activeCrews = fnData.staff.filter((s: any) => s.role === 'crew' && !s.is_disabled);
      if (activeCrews.length > 0) {
        const mapped = activeCrews.map((d: any) => ({
          id: d.id,
          name: `${d.first_name || ''} ${d.last_name || ''}`.trim() || d.name || d.email?.split('@')[0] || 'Crew Technician',
          email: d.email || '',
        }));
        try {
          localStorage.setItem('binhi_active_crew_count', String(mapped.length));
        } catch {}
        return mapped;
      }
    }
  } catch (err) {
    console.warn('Could not query list-staff edge function:', err);
  }

  // 2. Try Supabase profiles table directly
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, full_name, email, role, is_disabled')
      .eq('role', 'crew')
      .eq('is_disabled', false);

    if (!error && data && data.length > 0) {
      const mapped = data.map((d: any) => ({
        id: d.id,
        name: d.full_name || `${d.first_name || ''} ${d.last_name || ''}`.trim() || 'Crew Technician',
        email: d.email || '',
      }));
      try {
        localStorage.setItem('binhi_active_crew_count', String(mapped.length));
      } catch {}
      return mapped;
    }
  } catch (err) {
    console.warn('Could not query remote crew profiles, checking local staff:', err);
  }

  // 3. Fallback to local staff accounts saved by Admin Staff Management
  try {
    const localStaff = localStorage.getItem('binhi_staff_accounts');
    if (localStaff) {
      const parsed = JSON.parse(localStaff);
      const crews = parsed.filter((s: any) => (s.role === 'crew' || s.role === 'Crew') && !s.is_disabled && s.status !== 'Disabled');
      if (crews.length > 0) {
        const mapped = crews.map((c: any) => ({
          id: c.id,
          name: `${c.first_name || c.firstName || ''} ${c.last_name || c.lastName || ''}`.trim() || c.name || 'Crew Member',
          email: c.email || '',
        }));
        try {
          localStorage.setItem('binhi_active_crew_count', String(mapped.length));
        } catch {}
        return mapped;
      }
    }
  } catch {}

  // 4. Return empty array if no crew accounts exist yet (no hardcoded mock numbers)
  return [];
}

/**
 * Fetch all crew availability records for a given month or all
 */
export async function fetchCrewAvailabilityRecords(datePrefixOrExact?: string): Promise<CrewAvailabilityRecord[]> {
  try {
    let query = supabase.from('crew_availability').select('*');
    if (datePrefixOrExact) {
      const clean = datePrefixOrExact.trim();
      if (clean.length === 7) {
        // Month prefix format: YYYY-MM
        query = query.gte('date', `${clean}-01`).lte('date', `${clean}-31`);
      } else if (clean.length === 10) {
        // Exact date format: YYYY-MM-DD
        query = query.eq('date', clean);
      }
    }
    const { data, error } = await query;
    if (!error && data) {
      const records = data.map((d: any) => ({
        id: d.id || `ca-${d.crew_id}-${d.date}`,
        crewId: d.crew_id,
        crewName: d.crew_name,
        date: typeof d.date === 'string' ? d.date.split('T')[0] : String(d.date),
        status: d.status,
        reason: d.reason || '',
        createdAt: d.created_at,
        updatedAt: d.updated_at,
      }));
      saveLocalAvailability(records);
      return records;
    } else if (error) {
      console.warn('Supabase crew_availability query notice:', error);
    }
  } catch (err) {
    console.warn('Supabase crew_availability query catch:', err);
  }

  return getLocalAvailability();
}

/**
 * Toggle or save a crew member's availability for a specific date
 */
export async function setCrewDateAvailability(params: {
  crewId: string;
  crewName: string;
  date: string; // YYYY-MM-DD
  status: 'available' | 'on_leave' | 'unavailable';
  reason?: string;
}): Promise<{ success: boolean; record: CrewAvailabilityRecord }> {
  const cleanDate = params.date.includes('T') ? params.date.split('T')[0] : params.date.trim();
  const recordId = `ca-${params.crewId}-${cleanDate}`;

  const newRecord: CrewAvailabilityRecord = {
    id: recordId,
    crewId: params.crewId,
    crewName: params.crewName,
    date: cleanDate,
    status: params.status,
    reason: params.status === 'available' ? '' : (params.reason || ''),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // 1. Update localStorage cache cleanly (remove any conflicting/stale records for this crew & date)
  let localRecords = getLocalAvailability().filter(
    (r) =>
      !(
        r.date === cleanDate &&
        (r.crewId === params.crewId ||
          (r.crewName && params.crewName && r.crewName.toLowerCase() === params.crewName.toLowerCase()) ||
          r.id === recordId)
      )
  );

  localRecords.push(newRecord);
  saveLocalAvailability(localRecords);

  // 2. Sync to Supabase table
  try {
    // Delete any old conflicting entries for this crew & date (by crew_id, crew_name, or recordId)
    const deleteQueries = [];
    if (params.crewId) {
      deleteQueries.push(
        supabase.from('crew_availability').delete().eq('date', cleanDate).eq('crew_id', params.crewId)
      );
    }
    if (params.crewName) {
      deleteQueries.push(
        supabase.from('crew_availability').delete().eq('date', cleanDate).eq('crew_name', params.crewName)
      );
    }
    deleteQueries.push(
      supabase.from('crew_availability').delete().eq('id', recordId)
    );
    await Promise.allSettled(deleteQueries);

    // Upsert the new record with exact status ('available', 'on_leave', etc.)
    const { error } = await supabase.from('crew_availability').upsert({
      id: recordId,
      crew_id: params.crewId,
      crew_name: params.crewName,
      date: cleanDate,
      status: params.status,
      reason: params.status === 'available' ? '' : (params.reason || ''),
      updated_at: newRecord.updatedAt,
    });
    if (error) {
      console.warn('Supabase crew_availability save error:', error);
    }
  } catch (err) {
    console.warn('Supabase crew_availability save notice:', err);
  }

  return { success: true, record: newRecord };
}

/**
 * Calculate dynamic crew capacity for a specific date
 */
export async function getDailyCrewCapacity(
  dateStr: string,
  confirmedBookingsOnDate?: any[],
  customSettings?: BookingSettings
): Promise<DailyCrewCapacity> {
  const cleanDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
  const activeCrews = await fetchActiveCrewMembers();
  const availabilityRecords = await fetchCrewAvailabilityRecords(cleanDate);
  const settings = customSettings || (await fetchBookingSettings());

  // Also check assigned bookings on this date
  let assignedBookings = confirmedBookingsOnDate;
  if (!assignedBookings) {
    try {
      const { data } = await supabase
        .from('bookings')
        .select('id, booking_reference, assigned_crew, status, event_date')
        .eq('event_date', cleanDate)
        .neq('status', 'cancelled')
        .neq('status', 'declined')
        .neq('status', 'refunded');
      assignedBookings = data || [];
    } catch {
      assignedBookings = [];
    }
  }

  const assignedCrewIds = new Set<string>();
  const crewBookingMap = new Map<string, string>();

  const dayBookings = (assignedBookings || []).filter((b: any) => {
    const bDate = typeof b.event_date === 'string' ? b.event_date.split('T')[0] : '';
    return bDate === cleanDate && b.status !== 'cancelled' && b.status !== 'declined' && b.status !== 'refunded';
  });

  dayBookings.forEach((b: any) => {
    if (Array.isArray(b.assigned_crew)) {
      b.assigned_crew.forEach((c: any) => {
        const id = typeof c === 'string' ? c : c.id || c.name;
        assignedCrewIds.add(id);
        crewBookingMap.set(id, b.booking_reference || 'Assigned Event');
      });
    }
  });

  const roster: DailyCrewCapacity['crewRoster'] = [];
  let onLeaveCount = 0;
  let assignedCount = 0;
  let availableCount = 0;

  activeCrews.forEach((crew) => {
    const record = availabilityRecords.find(
      (r) =>
        r.date === cleanDate &&
        (r.crewId === crew.id ||
          (r.crewName && crew.name && r.crewName.toLowerCase() === crew.name.toLowerCase()))
    );
    const isAssigned = assignedCrewIds.has(crew.id) || assignedCrewIds.has(crew.name);

    if (record && (record.status === 'on_leave' || record.status === 'unavailable')) {
      onLeaveCount++;
      roster.push({
        crewId: crew.id,
        crewName: crew.name,
        status: 'on_leave',
        reason: record.reason || 'Filed Day-Off / Absence',
      });
    } else if (isAssigned) {
      assignedCount++;
      roster.push({
        crewId: crew.id,
        crewName: crew.name,
        status: 'assigned',
        assignedBookingRef: crewBookingMap.get(crew.id) || crewBookingMap.get(crew.name),
      });
    } else {
      availableCount++;
      roster.push({
        crewId: crew.id,
        crewName: crew.name,
        status: 'available',
      });
    }
  });

  const requireFullRoster = settings.require_full_crew_roster ?? true;
  const minRequired = settings.min_crew_required !== undefined ? Number(settings.min_crew_required) : 1;

  let isAvailableForBooking = true;
  let blockReason: string | undefined = undefined;

  if (requireFullRoster && onLeaveCount > 0) {
    isAvailableForBooking = false;
    blockReason = `Full crew presence required (${onLeaveCount} technician on leave)`;
  } else if (availableCount < minRequired) {
    isAvailableForBooking = false;
    blockReason = `Insufficient crew (${availableCount}/${minRequired} required technicians available)`;
  }

  return {
    date: cleanDate,
    totalActiveCrew: activeCrews.length,
    availableCrewCount: availableCount,
    onLeaveCrewCount: onLeaveCount,
    assignedCrewCount: assignedCount,
    isAvailableForBooking,
    blockReason,
    crewRoster: roster,
  };
}

/**
 * Fetch all dates in a month range where available crew drops below staffing requirements
 */
export async function getUnavailableCrewDates(monthPrefix: string, customSettings?: BookingSettings): Promise<string[]> {
  const records = await fetchCrewAvailabilityRecords(monthPrefix);
  const activeCrews = await fetchActiveCrewMembers();
  const settings = customSettings || (await fetchBookingSettings());
  if (activeCrews.length === 0) return [];

  const requireFullRoster = settings.require_full_crew_roster ?? true;
  const minRequired = settings.min_crew_required !== undefined ? Number(settings.min_crew_required) : 1;

  const leaveCountByDate = new Map<string, number>();

  records.forEach((r) => {
    if (r.status === 'on_leave' || r.status === 'unavailable') {
      leaveCountByDate.set(r.date, (leaveCountByDate.get(r.date) || 0) + 1);
    }
  });

  const fullyBlockedDates: string[] = [];
  leaveCountByDate.forEach((onLeaveCount, date) => {
    const availableCount = Math.max(0, activeCrews.length - onLeaveCount);
    if (requireFullRoster && onLeaveCount > 0) {
      fullyBlockedDates.push(date);
    } else if (availableCount < minRequired) {
      fullyBlockedDates.push(date);
    }
  });

  return fullyBlockedDates;
}
