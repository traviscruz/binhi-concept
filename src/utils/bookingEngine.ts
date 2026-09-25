import { supabase } from '../lib/supabase';
import { calculateDistanceKm } from './logistics';
import { estimateCoordinates } from './crewService';
import { type DBBooking, fetchDbBookedDates, normalizeDateToIso } from './bookingService';

export { normalizeDateToIso };

export interface DaySchedule {
  open: string;  // HH:MM
  close: string; // HH:MM
  is_open: boolean;
}

export interface BookingSettings {
  id: string;
  default_open_time: string;
  default_close_time: string;
  weekly_schedule?: Record<string, DaySchedule>;
  teardown_buffer_minutes: number;
  setup_buffer_minutes: number;
  default_turnaround_hours: number;
  avg_transit_speed_kmh: number;
  traffic_contingency_minutes: number;
  same_venue_radius_km?: number;
  same_venue_transit_minutes?: number;
  max_travel_radius_km: number;
  updated_at?: string;
}

export interface ScheduleOverride {
  id: string;
  override_date: string;
  is_closed: boolean;
  open_time?: string;
  close_time?: string;
  reason?: string;
}

export const DEFAULT_BOOKING_SETTINGS: BookingSettings = {
  id: 'default',
  default_open_time: '08:00',
  default_close_time: '23:00',
  teardown_buffer_minutes: 60,
  setup_buffer_minutes: 90,
  default_turnaround_hours: 3.0,
  avg_transit_speed_kmh: 25.0,
  traffic_contingency_minutes: 20,
  same_venue_radius_km: 0.5,
  same_venue_transit_minutes: 10,
  max_travel_radius_km: 60.0,
};

// ── Time Utility Functions ──────────────────────────────────────────────────

export function normalizeTimeString(timeStr: any, fallback = '08:00'): string {
  if (!timeStr) return fallback;
  const str = String(timeStr).trim();
  const parts = str.split(':');
  if (parts.length >= 2) {
    const h = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    return `${h}:${m}`;
  }
  return fallback;
}

export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const clean = normalizeTimeString(timeStr, '00:00');
  const [h, m] = clean.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function minutesToTime(minutes: number): string {
  const norm = Math.max(0, Math.min(1439, Math.round(minutes)));
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatTimeAmPm(timeStr: string): string {
  if (!timeStr) return '';
  const clean = normalizeTimeString(timeStr);
  const [hStr, mStr] = clean.split(':');
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr || '0', 10);
  if (isNaN(h)) return timeStr;
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  h = h ? h : 12;
  const mFmt = m < 10 ? `0${m}` : m;
  return `${h}:${mFmt} ${ampm}`;
}

const SETTINGS_STORAGE_KEY = 'binhi_booking_settings_config';
const OVERRIDES_STORAGE_KEY = 'binhi_booking_overrides_config';

// ── Database Operations ─────────────────────────────────────────────────────

export async function fetchBookingSettings(): Promise<BookingSettings> {
  // 1. Fetch directly from Supabase public.booking_settings table
  try {
    const { data, error } = await supabase
      .from('booking_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn('Supabase fetch error for booking_settings:', error.message);
    } else if (data) {
      const defaultOpen = normalizeTimeString(data.default_open_time, '08:00');
      const defaultClose = normalizeTimeString(data.default_close_time, '23:00');

      const config: BookingSettings = {
        id: data.id || 'default',
        default_open_time: defaultOpen,
        default_close_time: defaultClose,
        teardown_buffer_minutes: Number(data.teardown_buffer_minutes ?? 60),
        setup_buffer_minutes: Number(data.setup_buffer_minutes ?? 90),
        default_turnaround_hours: Number(data.default_turnaround_hours ?? 3.0),
        avg_transit_speed_kmh: Number(data.avg_transit_speed_kmh ?? 25.0),
        traffic_contingency_minutes: Number(data.traffic_contingency_minutes ?? 20),
        same_venue_radius_km: Number(data.same_venue_radius_km ?? 0.5),
        same_venue_transit_minutes: Number(data.same_venue_transit_minutes ?? 10),
        max_travel_radius_km: Number(data.max_travel_radius_km ?? 60.0),
        updated_at: data.updated_at,
      };

      try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(config));
      } catch (_) {}
      return config;
    }
  } catch (err) {
    console.warn('Network exception while fetching booking_settings:', err);
  }

  // 2. Check localStorage cached settings
  try {
    const cached = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (cached) {
      return { ...DEFAULT_BOOKING_SETTINGS, ...JSON.parse(cached) };
    }
  } catch (_) {}

  return DEFAULT_BOOKING_SETTINGS;
}

export async function saveBookingSettings(settings: Partial<BookingSettings>): Promise<boolean> {
  const merged: BookingSettings = {
    ...DEFAULT_BOOKING_SETTINGS,
    ...settings,
    id: 'default',
    default_open_time: settings.default_open_time ? normalizeTimeString(settings.default_open_time, '08:00') : DEFAULT_BOOKING_SETTINGS.default_open_time,
    default_close_time: settings.default_close_time ? normalizeTimeString(settings.default_close_time, '23:00') : DEFAULT_BOOKING_SETTINGS.default_close_time,
    updated_at: new Date().toISOString(),
  };

  // 1. Immediately cache in localStorage for instant resilience
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(merged));
  } catch (lsErr) {
    console.warn('LocalStorage save warning:', lsErr);
  }

  // 2. Attempt Supabase upsert
  try {
    const payload: any = {
      id: 'default',
      default_open_time: `${merged.default_open_time}:00`,
      default_close_time: `${merged.default_close_time}:00`,
      teardown_buffer_minutes: merged.teardown_buffer_minutes,
      setup_buffer_minutes: merged.setup_buffer_minutes,
      default_turnaround_hours: merged.default_turnaround_hours,
      avg_transit_speed_kmh: merged.avg_transit_speed_kmh,
      traffic_contingency_minutes: merged.traffic_contingency_minutes,
      same_venue_radius_km: merged.same_venue_radius_km,
      same_venue_transit_minutes: merged.same_venue_transit_minutes,
      max_travel_radius_km: merged.max_travel_radius_km,
      updated_at: merged.updated_at,
    };

    const { error } = await supabase.from('booking_settings').upsert(payload);
    if (error) {
      console.warn('Note: booking_settings DB sync warning (cached locally):', error.message || error);
    }
  } catch (err) {
    console.warn('Database save caught gracefully:', err);
  }

  return true;
}

export async function fetchScheduleOverrides(): Promise<ScheduleOverride[]> {
  try {
    const { data, error } = await supabase
      .from('booking_schedule_overrides')
      .select('*')
      .order('override_date', { ascending: true });

    if (!error && data) {
      const items = data.map((d: any) => ({
        id: d.id,
        override_date: d.override_date,
        is_closed: d.is_closed,
        open_time: d.open_time ? normalizeTimeString(d.open_time) : undefined,
        close_time: d.close_time ? normalizeTimeString(d.close_time) : undefined,
        reason: d.reason || '',
      }));
      try {
        localStorage.setItem(OVERRIDES_STORAGE_KEY, JSON.stringify(items));
      } catch (_) {}
      return items;
    }
  } catch (_) {}

  try {
    const cached = localStorage.getItem(OVERRIDES_STORAGE_KEY);
    if (cached) return JSON.parse(cached);
  } catch (_) {}

  return [];
}

// ── Operating Hours Resolution ──────────────────────────────────────────────

export function getOperatingWindowForDate(
  dateIso: string,
  settings: BookingSettings,
  overrides: ScheduleOverride[] = []
): { isOpen: boolean; openTime: string; closeTime: string; reason?: string } {
  // 1. Check for specific date override (holidays, special events, or explicit date closures)
  const override = overrides.find((o) => o.override_date === dateIso);
  if (override) {
    if (override.is_closed) {
      return {
        isOpen: false,
        openTime: '00:00',
        closeTime: '00:00',
        reason: override.reason || 'Closed on this date (Schedule Override)',
      };
    }
    return {
      isOpen: true,
      openTime: override.open_time ? normalizeTimeString(override.open_time) : normalizeTimeString(settings.default_open_time, '08:00'),
      closeTime: override.close_time ? normalizeTimeString(override.close_time) : normalizeTimeString(settings.default_close_time, '23:00'),
      reason: override.reason,
    };
  }

  // 2. Standard operating hours directly from booking_settings default_open_time & default_close_time
  return {
    isOpen: true,
    openTime: normalizeTimeString(settings.default_open_time, '08:00'),
    closeTime: normalizeTimeString(settings.default_close_time, '23:00'),
  };
}

// ── Transit & Location Feasibility ──────────────────────────────────────────

export interface TransitEvaluation {
  distanceKm: number;
  isSameVenue: boolean;
  transitMinutes: number;
  requiredTurnaroundMinutes: number;
  teardownBufferMinutes: number;
  setupBufferMinutes: number;
}

export function computeTransitAndBuffer(
  originCoords: { lat: number; lng: number },
  destCoords: { lat: number; lng: number },
  settings: BookingSettings
): TransitEvaluation {
  const distanceKm = calculateDistanceKm(
    originCoords.lat,
    originCoords.lng,
    destCoords.lat,
    destCoords.lng
  );

  // Travel across city with speed + contingency traffic
  const speed = Math.max(5, settings.avg_transit_speed_kmh || 25);
  const driveMinutes = (distanceKm / speed) * 60;
  const transitMinutes = Math.round(driveMinutes + (settings.traffic_contingency_minutes || 20));

  const requiredTurnaroundMinutes =
    settings.teardown_buffer_minutes + transitMinutes + settings.setup_buffer_minutes;

  return {
    distanceKm,
    isSameVenue: false,
    transitMinutes,
    requiredTurnaroundMinutes,
    teardownBufferMinutes: settings.teardown_buffer_minutes,
    setupBufferMinutes: settings.setup_buffer_minutes,
  };
}

// ── Slot Feasibility Evaluation Engine ──────────────────────────────────────

export interface FeasibilityConflict {
  type: 'outside_operating_hours' | 'direct_overlap' | 'insufficient_turnaround' | 'exceeds_travel_radius';
  message: string;
  conflictingBooking?: DBBooking;
  requiredMinutes?: number;
  availableMinutes?: number;
  transitMinutes?: number;
  distanceKm?: number;
  suggestedAvailableTime?: string;
}

export interface SlotFeasibilityResult {
  isAvailable: boolean;
  conflicts: FeasibilityConflict[];
  operatingHours: { open: string; close: string; isOpen: boolean };
  dayBookingsCount: number;
}

export function evaluateSlotFeasibility(params: {
  targetDate: string;
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
  venueAddress?: string;
  venueCoords?: { lat: number; lng: number } | null;
  existingBookings: DBBooking[];
  settings: BookingSettings;
  overrides?: ScheduleOverride[];
  excludeBookingId?: string;
}): SlotFeasibilityResult {
  const {
    targetDate,
    startTime,
    endTime,
    venueAddress = 'Metro Manila',
    venueCoords,
    existingBookings,
    settings,
    overrides = [],
    excludeBookingId,
  } = params;

  const conflicts: FeasibilityConflict[] = [];

  // 1. Check Operating Window
  const opWindow = getOperatingWindowForDate(targetDate, settings, overrides);
  if (!opWindow.isOpen) {
    conflicts.push({
      type: 'outside_operating_hours',
      message: opWindow.reason || 'The system is closed for bookings on this date.',
    });
    return {
      isAvailable: false,
      conflicts,
      operatingHours: { open: opWindow.openTime, close: opWindow.closeTime, isOpen: false },
      dayBookingsCount: 0,
    };
  }

  const targetStartMin = timeToMinutes(startTime);
  const targetEndMin = timeToMinutes(endTime);
  const opOpenMin = timeToMinutes(opWindow.openTime);
  const opCloseMin = timeToMinutes(opWindow.closeTime);

  // Time validity check
  if (targetEndMin <= targetStartMin) {
    conflicts.push({
      type: 'outside_operating_hours',
      message: 'Event end time must be later than event start time.',
    });
    return {
      isAvailable: false,
      conflicts,
      operatingHours: { open: opWindow.openTime, close: opWindow.closeTime, isOpen: true },
      dayBookingsCount: 0,
    };
  }

  if (targetStartMin < opOpenMin) {
    conflicts.push({
      type: 'outside_operating_hours',
      message: `Event cannot start before opening hours (${formatTimeAmPm(opWindow.openTime)}).`,
    });
  }

  if (targetEndMin > opCloseMin) {
    conflicts.push({
      type: 'outside_operating_hours',
      message: `Event cannot extend past closing hours (${formatTimeAmPm(opWindow.closeTime)}).`,
    });
  }

  // Same-day check: if targetDate is today, start time must not have already passed
  const now = new Date();
  const currentIso = normalizeDateToIso(now);
  if (targetDate === currentIso) {
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    if (targetStartMin <= currentMinutes) {
      conflicts.push({
        type: 'outside_operating_hours',
        message: `Event start time (${formatTimeAmPm(startTime)}) has already passed today. Please select a time slot after ${formatTimeAmPm(minutesToTime(currentMinutes))}.`,
      });
    }
  }

  // 2. Minimum Rest & Turnaround Gap between consecutive events (in minutes)
  const turnaroundHours = Number(settings.default_turnaround_hours) || 2.5;
  const requiredTurnaroundMinutes = Math.round(turnaroundHours * 60);

  // 3. Filter existing bookings for the specified date
  const dayBookings = existingBookings.filter((b) => {
    if (excludeBookingId && b.id === excludeBookingId) return false;
    const cleanDate = (b.event_date || '').split('T')[0];
    return cleanDate === targetDate && b.payment_status !== 'cancelled';
  });

  // 4. Test each existing booking for overlaps & minimum turnaround gap
  for (const existing of dayBookings) {
    const existStartStr = (existing.start_time || '13:00').slice(0, 5);
    const existEndStr = (existing.end_time || '18:00').slice(0, 5);
    const existStartMin = timeToMinutes(existStartStr);
    const existEndMin = timeToMinutes(existEndStr);

    // Direct overlap check
    const isDirectOverlap = !(targetEndMin <= existStartMin || targetStartMin >= existEndMin);
    if (isDirectOverlap) {
      conflicts.push({
        type: 'direct_overlap',
        message: `Direct time conflict with existing event "${existing.package_name || 'Booked Event'}" scheduled from ${formatTimeAmPm(existStartStr)} to ${formatTimeAmPm(existEndStr)}.`,
        conflictingBooking: existing,
      });
      continue;
    }

    // Check Case A: Target Booking is AFTER Existing Booking
    if (targetStartMin >= existEndMin) {
      const gapMin = targetStartMin - existEndMin;
      if (gapMin < requiredTurnaroundMinutes) {
        const earliestStartMin = existEndMin + requiredTurnaroundMinutes;
        const earliestTimeFmt = minutesToTime(earliestStartMin);

        conflicts.push({
          type: 'insufficient_turnaround',
          message: `Insufficient turnaround interval after prior event ending at ${formatTimeAmPm(existEndStr)}. Requires at least ${turnaroundHours} hours (${requiredTurnaroundMinutes} mins) rest & turnaround gap. Earliest available start time: ${formatTimeAmPm(earliestTimeFmt)}.`,
          conflictingBooking: existing,
          requiredMinutes: requiredTurnaroundMinutes,
          availableMinutes: gapMin,
          suggestedAvailableTime: earliestTimeFmt,
        });
      }
    }

    // Check Case B: Target Booking is BEFORE Existing Booking
    if (targetEndMin <= existStartMin) {
      const gapMin = existStartMin - targetEndMin;
      if (gapMin < requiredTurnaroundMinutes) {
        const latestEndMin = existStartMin - requiredTurnaroundMinutes;
        const latestTimeFmt = minutesToTime(latestEndMin);

        conflicts.push({
          type: 'insufficient_turnaround',
          message: `Event ends too close to subsequent booking starting at ${formatTimeAmPm(existStartStr)}. Requires at least ${turnaroundHours} hours (${requiredTurnaroundMinutes} mins) rest & turnaround gap. Event must conclude by ${formatTimeAmPm(latestTimeFmt)}.`,
          conflictingBooking: existing,
          requiredMinutes: requiredTurnaroundMinutes,
          availableMinutes: gapMin,
          suggestedAvailableTime: latestTimeFmt,
        });
      }
    }
  }

  return {
    isAvailable: conflicts.length === 0,
    conflicts,
    operatingHours: { open: opWindow.openTime, close: opWindow.closeTime, isOpen: true },
    dayBookingsCount: dayBookings.length,
  };
}

// ── Day Availability Badge Analyzer ─────────────────────────────────────────

export type DayStatusType = 'closed' | 'open' | 'slots_available' | 'fully_booked';

export function getDayAvailabilityStatus(
  dateIso: string,
  bookings: DBBooking[],
  settings: BookingSettings,
  overrides: ScheduleOverride[] = []
): {
  status: DayStatusType;
  label: string;
  badgeClass: string;
  bookingCount: number;
} {
  const op = getOperatingWindowForDate(dateIso, settings, overrides);
  if (!op.isOpen) {
    return {
      status: 'closed',
      label: 'Closed',
      badgeClass: 'bg-zinc-800 text-zinc-400 border border-zinc-700',
      bookingCount: 0,
    };
  }

  const dayBookings = bookings.filter((b) => {
    const cleanDate = (b.event_date || '').split('T')[0];
    return cleanDate === dateIso && b.payment_status !== 'cancelled';
  });

  const now = new Date();
  const currentIso = normalizeDateToIso(now);
  if (dateIso === currentIso) {
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    if (currentMinutes >= timeToMinutes(op.closeTime) - 60) {
      return {
        status: 'fully_booked',
        label: 'No Slots Left Today',
        badgeClass: 'bg-zinc-800 text-zinc-400 border border-zinc-700',
        bookingCount: dayBookings.length,
      };
    }
  }

  if (dayBookings.length === 0) {
    return {
      status: 'open',
      label: 'Available',
      badgeClass: 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/30',
      bookingCount: 0,
    };
  }

  // If there are bookings, let's see if the day is saturated (e.g., 3+ bookings or full hours consumed)
  const totalOccupiedMinutes = dayBookings.reduce((acc, b) => {
    const s = timeToMinutes((b.start_time || '13:00').slice(0, 5));
    const e = timeToMinutes((b.end_time || '18:00').slice(0, 5));
    return acc + Math.max(0, e - s) + (settings.default_turnaround_hours * 60);
  }, 0);

  const totalOperatingMinutes = Math.max(
    0,
    timeToMinutes(op.closeTime) - timeToMinutes(op.openTime)
  );

  // If remaining time is less than 3 hours, consider it fully booked
  if (totalOccupiedMinutes >= totalOperatingMinutes - 180 || dayBookings.length >= 3) {
    return {
      status: 'fully_booked',
      label: 'Fully Booked',
      badgeClass: 'bg-red-500/10 text-red-700 border border-red-500/30',
      bookingCount: dayBookings.length,
    };
  }

  return {
    status: 'slots_available',
    label: `${dayBookings.length} Booked • Slots Open`,
    badgeClass: 'bg-amber-500/10 text-amber-700 border border-amber-500/30',
    bookingCount: dayBookings.length,
  };
}

/**
 * Parses requested start and end times from a reschedule reason string.
 * Example tag format: "[Requested Time: 13:00 - 18:00]" or "[Requested Time: 01:00 PM – 06:00 PM]"
 */
export function parseRequestedTimesFromReason(reason?: string | null): {
  startTime?: string;
  endTime?: string;
  cleanReason: string;
} {
  if (!reason) return { cleanReason: '' };
  const match = reason.match(/\[Requested Time:\s*([^–\-]+)\s*[–\-]\s*([^\]]+)\]/i);
  if (!match) {
    return { cleanReason: reason };
  }

  const parseTo24h = (str: string): string | undefined => {
    const trimmed = str.trim();
    if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
      const [h, m] = trimmed.split(':');
      return `${h.padStart(2, '0')}:${m}`;
    }
    const ampmMatch = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (ampmMatch) {
      let h = parseInt(ampmMatch[1], 10);
      const m = ampmMatch[2];
      const meridiem = ampmMatch[3].toUpperCase();
      if (meridiem === 'PM' && h < 12) h += 12;
      if (meridiem === 'AM' && h === 12) h = 0;
      return `${String(h).padStart(2, '0')}:${m}`;
    }
    return undefined;
  };

  const startTime = parseTo24h(match[1]);
  const endTime = parseTo24h(match[2]);
  const cleanReason = reason.replace(match[0], '').trim();

  return {
    startTime,
    endTime,
    cleanReason,
  };
}
