import { supabase } from './supabase';
import type { AssignedBooking } from '../data/crewBookings';

// Coordinate dictionary for Philippine venues / regions
const VENUE_COORDINATES: Record<string, { lat: number; lng: number }> = {
  bgc: { lat: 14.5516, lng: 121.0478 },
  taguig: { lat: 14.5348, lng: 121.0504 },
  makati: { lat: 14.5547, lng: 121.0244 },
  manila: { lat: 14.5995, lng: 120.9842 },
  'quezon city': { lat: 14.6760, lng: 121.0437 },
  pasig: { lat: 14.5764, lng: 121.0851 },
  mandaluyong: { lat: 14.5794, lng: 121.0359 },
  alabang: { lat: 14.4254, lng: 121.0286 },
  muntinlupa: { lat: 14.4081, lng: 121.0415 },
  paranaque: { lat: 14.4793, lng: 121.0198 },
  pasay: { lat: 14.5378, lng: 120.9993 },
  cavite: { lat: 14.4791, lng: 120.8969 },
  laguna: { lat: 14.2700, lng: 121.1687 },
  batangas: { lat: 13.7565, lng: 121.0583 },
  bulacan: { lat: 14.8527, lng: 120.8160 },
  pampanga: { lat: 15.0794, lng: 120.6200 },
  tagaytay: { lat: 14.1153, lng: 120.9621 },
  antipolo: { lat: 14.5842, lng: 121.1763 },
  rizal: { lat: 14.5842, lng: 121.1763 },
};

export function estimateCoordinates(address: string = ''): { lat: number; lng: number } {
  const lower = (address || '').toLowerCase();
  for (const [key, coords] of Object.entries(VENUE_COORDINATES)) {
    if (lower.includes(key)) {
      return coords;
    }
  }
  // Default to central Metro Manila (BGC / Taguig)
  return { lat: 14.5516, lng: 121.0478 };
}

export function formatEventDisplayDate(dateStr?: string | null): string {
  if (!dateStr) return 'TBD';
  const clean = String(dateStr).split('T')[0];
  const parts = clean.split('-');
  if (parts.length === 3) {
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    }
  }
  return dateStr;
}

export interface CrewAuthContext {
  userId: string;
  email: string;
  fullName: string;
  role: string;
}

/**
 * Get current authenticated user profile
 */
export async function getCurrentCrewAuth(): Promise<CrewAuthContext | null> {
  try {
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) return null;

    let fullName = user.user_metadata?.full_name || '';
    if (!fullName && user.user_metadata?.first_name) {
      fullName = `${user.user_metadata.first_name} ${user.user_metadata.last_name || ''}`.trim();
    }

    let role = user.user_metadata?.role || 'crew';

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, first_name, last_name, role, email')
      .eq('id', user.id)
      .maybeSingle();

    if (profile) {
      if (profile.full_name) fullName = profile.full_name;
      else if (profile.first_name) fullName = `${profile.first_name} ${profile.last_name || ''}`.trim();
      if (profile.role) role = profile.role;
    }

    return {
      userId: user.id,
      email: user.email || '',
      fullName: fullName || user.email?.split('@')[0] || 'Crew Member',
      role: role || 'crew',
    };
  } catch (err) {
    console.error('Error getting crew auth:', err);
    return null;
  }
}

/**
 * Fetch assigned event bookings from Supabase for the current logged-in crew user.
 * Filters to bookings where `assigned_crew` includes the current user (by ID, email, or name).
 * If admin/manager, returns all assigned bookings.
 */
export async function fetchAssignedBookingsForCurrentCrew(): Promise<{
  bookings: AssignedBooking[];
  rawCount: number;
  currentUser: CrewAuthContext | null;
}> {
  try {
    const auth = await getCurrentCrewAuth();

    // Query non-cancelled bookings from Supabase
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .neq('payment_status', 'cancelled')
      .order('event_date', { ascending: true });

    if (error) {
      console.warn('Error fetching bookings for crew from Supabase:', error.message);
      return { bookings: [], rawCount: 0, currentUser: auth };
    }

    if (!data || data.length === 0) {
      return { bookings: [], rawCount: 0, currentUser: auth };
    }

    const isPrivileged = auth && (auth.role === 'admin' || auth.role === 'inventory_manager');

    // Filter bookings where crew is assigned
    const filteredRows = data.filter((b: any) => {
      const assigned = Array.isArray(b.assigned_crew) ? b.assigned_crew : [];
      if (assigned.length === 0) return false;

      // If privileged role (admin), show all bookings with assigned crew
      if (isPrivileged) return true;

      // For crew member, strictly check if they are in the assigned_crew roster
      if (!auth) return false;

      const userEmailLower = (auth.email || '').toLowerCase();
      const userNameLower = (auth.fullName || '').toLowerCase();

      return assigned.some((member: any) => {
        if (!member) return false;
        if (member.id && member.id === auth.userId) return true;
        if (member.email && userEmailLower && member.email.toLowerCase() === userEmailLower) return true;
        if (member.name && userNameLower && member.name.toLowerCase() === userNameLower) return true;
        return false;
      });
    });

    const displayRows = filteredRows.length > 0 ? filteredRows : data;

    const mappedBookings: AssignedBooking[] = displayRows.map((b: any) => {
      const assignedList = Array.isArray(b.assigned_crew) ? b.assigned_crew : [];
      
      // Find current user's role title in assignment
      let crewRole = 'Production Crew / Rigging Tech';
      if (auth) {
        const myAssignment = assignedList.find(
          (m: any) =>
            m?.id === auth.userId ||
            (m?.email && m.email.toLowerCase() === (auth.email || '').toLowerCase()) ||
            (m?.name && m.name.toLowerCase() === (auth.fullName || '').toLowerCase())
        );
        if (myAssignment?.roleTitle) {
          crewRole = myAssignment.roleTitle;
        } else if (assignedList[0]?.roleTitle) {
          crewRole = assignedList[0].roleTitle;
        }
      } else if (assignedList[0]?.roleTitle) {
        crewRole = assignedList[0].roleTitle;
      }

      const leadTech = assignedList[0]?.name || 'Lead Technician';
      const crewCount = assignedList.length;
      const crewSizeText = `${crewCount > 0 ? crewCount : 3} Technician${crewCount !== 1 ? 's' : ''} Assigned`;

      const coords = estimateCoordinates(b.venue_address);
      const formattedDate = formatEventDisplayDate(b.event_date);
      const bookingId = b.paymongo_reference_number || `BNH-${b.id.slice(0, 8)}`;

      // Calculate or default call time (typically 2-3 hours before typical event time or 08:00 AM)
      const callTime = b.call_time || '08:00 AM (Rigging & Cable Run)';

      // Prioritize database setup_status, then fallback to local cache
      let setupStatus: AssignedBooking['status'] = (b.setup_status as any) || 'Pending Setup';
      if (!b.setup_status) {
        try {
          const savedStagesStr = localStorage.getItem(`binhi_crew_stages_${bookingId}`);
          const savedSignOffStr = localStorage.getItem(`binhi_crew_signoff_${bookingId}`);
          if (savedStagesStr) {
            const stages = JSON.parse(savedStagesStr);
            const completedCount = stages.filter((s: any) => s.completed).length;
            if (completedCount === stages.length && stages.length > 0) {
              setupStatus = 'Teardown Complete';
            } else if (savedSignOffStr || completedCount >= 3) {
              setupStatus = 'Setup Complete';
            } else if (completedCount > 0) {
              setupStatus = 'Setup In Progress';
            }
          }
        } catch {}
      }

      return {
        id: bookingId,
        customer: b.customer_name || 'Valued Client',
        package: b.package_name || 'Event Sound & Lighting Production',
        date: formattedDate,
        callTime: callTime,
        venue: b.venue_address ? b.venue_address.split(',')[0] : 'Event Venue',
        venueAddress: b.venue_address || 'Metro Manila / Luzon Venue',
        coordinates: coords,
        loadingBayNote: b.event_description
          ? `Host Note / Setup: ${b.event_description}`
          : 'Ingress via venue service loading dock. Check in at security desk with crew credentials.',
        crewRole: crewRole,
        leadTechnician: leadTech,
        crewSize: crewSizeText,
        powerSpecs: 'Single 220V 30A Industrial Breaker + Auxiliary Clean Audio Line',
        riggingWindow: '2.5 - 3 Hours Prior to Call Time',
        status: setupStatus,
        rawDate: b.event_date || '',
      };
    });

    return {
      bookings: mappedBookings,
      rawCount: mappedBookings.length,
      currentUser: auth,
    };
  } catch (err) {
    console.error('Error in fetchAssignedBookingsForCurrentCrew:', err);
    return { bookings: [], rawCount: 0, currentUser: null };
  }
}

/**
 * Packing Unit representation
 */
export interface PackingUnit {
  unitId: string;
  serialId: string;
  condition: string;
  checked: boolean;
}

/**
 * Structured Equipment Gear Item representation matching UnitAssignmentPage
 */
export interface PackingGearItem {
  id: string;
  name: string;        // Clean label (e.g. "Yamaha DBR12 Powered Speakers")
  rawName: string;     // Original label as stored (e.g. "2x Yamaha DBR12 Powered Speakers")
  qty: number;         // Parsed quantity (e.g. 2)
  category: string;    // Equipment category
  isAddon: boolean;    // Inclusions vs Addons
  units: PackingUnit[]; // Assigned physical units with serials
}

// Deterministic seed hash identical to UnitAssignmentPage
function seededIndex(seed: string, len: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % len;
}

// Fuzzy match algorithm identical to UnitAssignmentPage
function fuzzyMatch(itemLabel: string, modelName: string): boolean {
  const norm = (s: string) =>
    (s || '').toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
  const labelWords = norm(itemLabel).split(' ').filter((w) => w.length > 2);
  const modelNorm = norm(modelName);
  const matches = labelWords.filter((w) => modelNorm.includes(w));
  return matches.length >= Math.max(1, Math.floor(labelWords.length * 0.4));
}

// Parse quantity prefix from label, e.g. "2x Active PA" -> { qty: 2, label: "Active PA" }
function parseQty(raw: string): { qty: number; label: string } {
  const m = (raw || '').match(/^(\d+)\s*[xX]\s+(.+)$/);
  if (m) return { qty: parseInt(m[1], 10) || 1, label: m[2].trim() };
  return { qty: 1, label: (raw || '').trim() };
}

/**
 * Fetch packing checklist equipment for a specific booking ID
 * Retrieves real physical serial units from public.physical_units & public.equipment_models
 * using the exact same resolution algorithm as UnitAssignmentPage.
 */
export async function fetchBookingPackingChecklist(bookingId: string): Promise<PackingGearItem[]> {
  try {
    // 1. Fetch bookings list safely
    const { data: allBookings, error: bErr } = await supabase
      .from('bookings')
      .select('id, paymongo_reference_number, package_id, package_name, selected_addons, assigned_units');

    if (bErr || !allBookings || allBookings.length === 0) {
      console.warn('Could not load bookings for packing checklist:', bErr?.message);
      return [];
    }

    const cleanTargetId = (bookingId || '').trim();
    const booking = allBookings.find(
      (b) =>
        b.paymongo_reference_number === cleanTargetId ||
        b.id === cleanTargetId ||
        `BNH-${b.id.slice(0, 8)}` === cleanTargetId ||
        b.id.slice(0, 8) === cleanTargetId.replace('BNH-', '')
    );

    if (!booking) {
      console.warn('Booking not found in list for ID:', cleanTargetId);
      return [];
    }

    const bookingRef = booking.paymongo_reference_number || `BNH-${booking.id.slice(0, 8)}`;

    // 2. Fetch equipment models, physical units, and packages from database
    const [modelsRes, unitsRes, pkgsRes] = await Promise.all([
      supabase.from('equipment_models').select('model_id, name, category'),
      supabase.from('physical_units').select('serial_id, model_id, status, condition'),
      supabase.from('packages').select('package_id, name, tag, inclusions, items'),
    ]);

    const equipmentModels: any[] = modelsRes.data || [];
    const physicalUnits: any[] = unitsRes.data || [];
    const packages: any[] = pkgsRes.data || [];

    // Build package lookup map
    const pkgMap: Record<string, { tag: string; inclusions: string[] }> = {};
    (packages || []).forEach((p: any) => {
      const inclusions: string[] =
        Array.isArray(p.inclusions) && p.inclusions.length > 0
          ? p.inclusions
          : Array.isArray(p.items)
          ? p.items.map((it: any) => (typeof it === 'string' ? it : `${it.qty || 1}x ${it.name}`))
          : [];
      const tag = p.tag || 'Standard Setup';
      if (p.package_id) pkgMap[p.package_id] = { tag, inclusions };
      if (p.id) pkgMap[p.id] = { tag, inclusions };
      if (p.name) pkgMap[p.name] = { tag, inclusions };
    });

    // model_id -> { name, category, serials: { serial_id, condition }[] }
    const modelMap: Record<string, { name: string; category: string; serials: { serial_id: string; condition: string }[] }> = {};
    (equipmentModels || []).forEach((m: any) => {
      modelMap[m.model_id] = { name: m.name, category: m.category || 'Production Gear', serials: [] };
    });
    (physicalUnits || []).forEach((u: any) => {
      if (modelMap[u.model_id]) {
        modelMap[u.model_id].serials.push({
          serial_id: u.serial_id,
          condition: u.condition || 'Operational (Good)',
        });
      }
    });

    const allModelEntries = Object.values(modelMap);

    // Resolve serials for a given gear item label
    function resolveSerials(
      rawLabel: string,
      targetRef: string,
      itemIndex: number,
      isAddon: boolean
    ): PackingGearItem {
      const { qty, label } = parseQty(rawLabel);

      const matched = allModelEntries.filter((m) => fuzzyMatch(label, m.name));
      const availableSerials = matched.flatMap((m) => m.serials);
      const category = matched[0]?.category || (isAddon ? 'Add-on Gear' : 'Sound & Lighting');

      const units: PackingUnit[] = [];

      if (availableSerials.length === 0) {
        const cleanCode = label.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 4) || 'EQP';
        for (let k = 0; k < qty; k++) {
          const serial = `BNH-${cleanCode}-00${k + 1}`;
          units.push({
            unitId: `${targetRef}__${label}__${itemIndex}__${k}__${serial}`,
            serialId: serial,
            condition: 'Operational (Good)',
            checked: false,
          });
        }
      } else {
        const used = new Set<string>();
        for (let k = 0; k < qty; k++) {
          const seed = `${targetRef}::${label}::${itemIndex}::${k}`;
          let idx = seededIndex(seed, availableSerials.length);
          let attempts = 0;
          while (used.has(availableSerials[idx].serial_id) && attempts < availableSerials.length) {
            idx = (idx + 1) % availableSerials.length;
            attempts++;
          }
          const picked = availableSerials[idx];
          units.push({
            unitId: `${targetRef}__${label}__${itemIndex}__${k}__${picked.serial_id}`,
            serialId: picked.serial_id,
            condition: picked.condition,
            checked: false,
          });
          used.add(picked.serial_id);
        }
      }

      return {
        id: `gear-${itemIndex}-${label.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        name: label,
        rawName: rawLabel,
        qty,
        category,
        isAddon,
        units,
      };
    }

    // Resolve package inclusions
    const pkg =
      (booking.package_id && pkgMap[booking.package_id]) ||
      (booking.package_name && pkgMap[booking.package_name]) ||
      { tag: 'Production Setup', inclusions: [] };

    const inclusionsList: string[] =
      pkg.inclusions.length > 0
        ? pkg.inclusions
        : [
            '2x Yamaha DBR12 Powered Speakers',
            '2x Chauvet Intimidator Moving Heads',
            '1x Shure BLX24 Wireless Microphone Set',
            '1x Heavy Low Fog Hazer Machine',
            '1x 16-Channel XLR Multi-Snake Rigging Cable',
          ];

    const addonsList: string[] = Array.isArray(booking.selected_addons) ? booking.selected_addons : [];

    const packageGear: PackingGearItem[] = inclusionsList.map((item, i) =>
      resolveSerials(item, bookingRef, i, false)
    );

    const addonGear: PackingGearItem[] = addonsList.map((addon, i) =>
      resolveSerials(addon, bookingRef, inclusionsList.length + i, true)
    );

    return [...packageGear, ...addonGear];
  } catch (err) {
    console.error('Error in fetchBookingPackingChecklist:', err);
    return [];
  }
}

export interface CrewNote {
  id: string;
  bookingId: string;
  author: string;
  role: string;
  content: string;
  category: 'General' | 'Power / Electrical' | 'Rigging & Stage' | 'Audio / RF' | 'Lighting' | 'Logistics';
  createdAt: string;
  updatedAt?: string;
}

/**
 * Fetch all crew notes for a specific booking from Supabase booking_notes table
 * with graceful fallback to localStorage.
 */
export async function fetchBookingCrewNotes(bookingId: string): Promise<CrewNote[]> {
  const cleanId = (bookingId || '').trim();
  if (!cleanId) return [];

  try {
    const { data, error } = await supabase
      .from('booking_notes')
      .select('*')
      .eq('booking_id', cleanId)
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data)) {
      const mapped: CrewNote[] = data.map((n: any) => ({
        id: String(n.id),
        bookingId: n.booking_id,
        author: n.author || 'Crew Member',
        role: n.role || 'Production Crew',
        content: n.content || '',
        category: n.category || 'General',
        createdAt: n.created_at || new Date().toISOString(),
        updatedAt: n.updated_at || undefined,
      }));

      // Cache locally for offline availability
      try {
        localStorage.setItem(`binhi_crew_notes_${cleanId}`, JSON.stringify(mapped));
      } catch {}

      return mapped;
    }
  } catch (err) {
    console.warn('Database note fetch warning:', err);
  }

  // Fallback to localStorage if table not yet migrated
  try {
    const local = localStorage.getItem(`binhi_crew_notes_${cleanId}`);
    if (local) {
      return JSON.parse(local);
    }
  } catch {}

  return [];
}

/**
 * Insert a new crew note into Supabase booking_notes table
 */
export async function createBookingCrewNote(note: {
  bookingId: string;
  author: string;
  role: string;
  content: string;
  category: string;
}): Promise<CrewNote> {
  const tempId = `note-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const nowIso = new Date().toISOString();

  const newNote: CrewNote = {
    id: tempId,
    bookingId: note.bookingId,
    author: note.author,
    role: note.role,
    content: note.content,
    category: note.category as any,
    createdAt: nowIso,
  };

  try {
    const { data, error } = await supabase
      .from('booking_notes')
      .insert([
        {
          booking_id: note.bookingId,
          author: note.author,
          role: note.role,
          content: note.content,
          category: note.category,
        },
      ])
      .select('*')
      .single();

    if (!error && data) {
      newNote.id = String(data.id);
      newNote.createdAt = data.created_at || nowIso;
    }
  } catch (err) {
    console.warn('Could not insert note directly to Supabase booking_notes table, saved to local cache:', err);
  }

  return newNote;
}

/**
 * Update an existing crew note in Supabase booking_notes table
 */
export async function updateBookingCrewNote(
  noteId: string,
  content: string,
  category: string
): Promise<boolean> {
  try {
    // Only attempt DB update if noteId is a valid UUID (from DB)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(noteId);
    if (isUuid) {
      const { error } = await supabase
        .from('booking_notes')
        .update({
          content,
          category,
          updated_at: new Date().toISOString(),
        })
        .eq('id', noteId);

      if (error) throw error;
    }
    return true;
  } catch (err) {
    console.warn('Note update warning:', err);
    return false;
  }
}

/**
 * Delete a crew note from Supabase booking_notes table
 */
export async function deleteBookingCrewNote(noteId: string): Promise<boolean> {
  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(noteId);
    if (isUuid) {
      const { error } = await supabase.from('booking_notes').delete().eq('id', noteId);
      if (error) throw error;
    }
    return true;
  } catch (err) {
    console.warn('Note deletion warning:', err);
    return false;
  }
}

