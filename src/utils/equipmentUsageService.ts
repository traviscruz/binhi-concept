import { supabase } from './supabase';
import * as XLSX from 'xlsx';
import { FEATURED_PACKAGES } from '../data/packages';

export interface BookingUsageEvent {
  bookingId: string;
  bookingRef: string;
  customerName: string;
  eventType: string;
  eventDate: string;
  eventDateRaw: string;
  startTime: string;
  endTime: string;
  durationHours: number;
  venueAddress: string;
  paymentStatus: string;
  status: string;
  isCompleted: boolean;
  assignedUnits: string[];
  packageName: string;
  selectedAddons: string[];
}

export interface ModelDeploymentRecord {
  bookingRef: string;
  customerName: string;
  eventDate: string;
  eventType: string;
  venue: string;
  durationHours: number;
  quantity: number;
  serialsUsed: string[];
  totalModelHours: number;
}

export interface EquipmentModelUsage {
  modelId: string;
  name: string;
  brand: string;
  category: string;
  description: string;
  imageUrl?: string;
  totalUnits: number;
  operationalUnitsCount: number;
  unitsInMaintenanceCount: number;
  serialsList: string[];

  // Computed Real Usage Metrics
  accumulatedHours: number;
  eventsCount: number;
  unitsDeployedCount: number;
  avgHoursPerEvent: number;
  utilizationRate: number; // percentage (0-100)
  status: 'Highest Demand' | 'Consistent Usage' | 'Moderate Usage' | 'Optimal Condition' | 'Standby / Low Usage';
  
  // Maintenance & Wear Health Tracking
  wearStatus: 'Good / Optimal' | 'Moderate Wear' | 'Service Due Soon' | 'Inspection Required';
  serviceIntervalHours: number; // default 100 hours cycle
  cycleHours: number;
  nextServiceHoursRemaining: number;
  wearPercentage: number; // percentage toward next service

  eventDeployments: ModelDeploymentRecord[];
}

export interface UsageFleetSummary {
  totalFleetOperatingHours: number;
  totalCompletedEvents: number;
  totalEquipmentDeployments: number;
  avgFleetUtilization: number;
  topUtilizedModel: string;
  topCategory: string;
  activeTrackedModelsCount: number;
  totalPhysicalUnitsCount: number;
}

// Convert "HH:MM" or "HH:MM:SS" to minutes
export function parseTimeToMinutes(timeStr?: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

// Compute event duration in hours from start_time and end_time
export function calculateEventDurationHours(startTime?: string, endTime?: string): number {
  if (!startTime && !endTime) return 5.0; // Default standard event runtime (5 hours)
  const sMin = parseTimeToMinutes(startTime || '13:00');
  let eMin = parseTimeToMinutes(endTime || '18:00');
  
  if (eMin <= sMin) {
    // Cross midnight or overnight event (e.g. 20:00 to 02:00)
    eMin += 24 * 60;
  }

  const diffHours = (eMin - sMin) / 60;
  return diffHours > 0 ? Number(diffHours.toFixed(1)) : 5.0;
}

// Parse quantity prefix from string (e.g. "2x Active Subwoofer" -> { qty: 2, label: "Active Subwoofer" })
export function parseItemQty(raw: any): { qty: number; label: string } {
  if (!raw) return { qty: 1, label: '' };
  
  let str = '';
  let explicitQty: number | null = null;

  if (typeof raw === 'object') {
    str = raw.name || raw.label || raw.model_id || raw.modelId || '';
    if (raw.qty) explicitQty = Number(raw.qty);
    else if (raw.quantity) explicitQty = Number(raw.quantity);
  } else {
    str = String(raw).trim();
  }

  // Strip price tags e.g. "Wireless Mic (₱1,500)" or "(+₱2,000)" or "- ₱1,500"
  str = str.replace(/(\s*[\(\[-]\s*(\+?\s*₱|\+?\s*PHP)\s*[\d,]+(\.\d{2})?(\s*each|\s*\/unit)?\s*[\)\]]?)/gi, '').trim();

  const m = str.match(/^(\d+)\s*(?:[xX]|\s*units?\s+of)\s+(.+)$/i);
  if (m) {
    return { qty: Math.max(1, parseInt(m[1], 10)), label: m[2].trim() };
  }

  return { qty: explicitQty && explicitQty > 0 ? explicitQty : 1, label: str };
}

// Filter out non-hardware labor and service items
export function isServiceItem(rawLabel: string): boolean {
  const lower = rawLabel.toLowerCase();
  const serviceKeywords = [
    'technician',
    'soundcheck',
    'sound check',
    'operator',
    'director',
    'engineer',
    'crew',
    'load-in',
    'load in',
    'on-site',
    'onsite',
    'setup & teardown',
    'delivery',
    'transport',
    'labor',
    'vj',
    'stage director',
    'sound engineer',
    'lighting operator',
  ];
  return serviceKeywords.some((k) => lower.includes(k));
}

// Calculate match score between a package inclusion label and a specific equipment model
export function calculateMatchScore(
  itemLabel: string,
  modelName: string,
  modelId: string,
  modelDesc: string
): number {
  const norm = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();

  const l = norm(itemLabel);
  const name = norm(modelName);
  const id = norm(modelId);
  const desc = norm(modelDesc);

  if (!l) return 0;

  // Direct match on ID or full Name
  if (id && (l.includes(id) || id.includes(l))) return 10;
  if (name && (l.includes(name) || name.includes(l))) return 8;

  let score = 0;

  // Target specific equipment patterns
  const patterns: { keywords: string[]; modelKeywords: string[]; weight: number }[] = [
    {
      keywords: ['led wall', 'p3', 'led panel', 'video wall', 'video screen', 'display screen', 'led screen', 'indoor led'],
      modelKeywords: ['led wall', 'p3', 'led panel', 'video wall', 'led screen', 'display screen', 'led-p3'],
      weight: 6,
    },
    {
      keywords: ['line array', 'array module', 'concert line array', 'line array speaker'],
      modelKeywords: ['line array', 'array rig', 'spk-line', 'array module'],
      weight: 6,
    },
    {
      keywords: ['subwoofer', 'subs', 'dual 15', 'dual 18', '18 inch sub', '15 inch sub', 'powered subwoofer'],
      modelKeywords: ['subwoofer', 'subs', 'sub', 'bass bin'],
      weight: 5,
    },
    {
      keywords: ['active pa', 'pa speaker', 'top speaker', '12 inch speaker', 'pa 12', 'concert speaker'],
      modelKeywords: ['speaker', 'pa', 'top speaker', 'audio speaker', 'active pa'],
      weight: 5,
    },
    {
      keywords: ['moving head', 'beam', 'spot light', '7r', '230w', 'moving head beam', 'dmx light'],
      modelKeywords: ['moving head', 'beam', 'spot', 'lgt-mhead', '7r'],
      weight: 6,
    },
    {
      keywords: ['uplight', 'color uplight', 'par uplight', 'led par', 'rgbw', 'par light'],
      modelKeywords: ['uplight', 'par', 'color light', 'ambient light', 'par light'],
      weight: 5,
    },
    {
      keywords: ['fog machine', 'smoke machine', 'haze', 'low lying fog', 'smoke effect', 'haze machine', 'low fog'],
      modelKeywords: ['fog', 'smoke', 'haze', 'low lying', 'efx-smk'],
      weight: 6,
    },
    {
      keywords: ['wireless mic', 'handheld mic', 'microphone', 'uhf', 'vocal mic', 'host microphone', 'dual wireless'],
      modelKeywords: ['microphone', 'mic', 'uhf', 'wireless', 'mic-uhf', 'sennheiser', 'shure'],
      weight: 6,
    },
    {
      keywords: ['truss', 'trussing', 'aluminum truss', 'box truss', 'overhead truss', 'global truss'],
      modelKeywords: ['truss', 'box truss', 'rigging', 'trs-alum', 'aluminum box'],
      weight: 6,
    },
    {
      keywords: ['mixer', 'mixing console', 'digital mixer', 'compact mixer', '8 channel mixer', '16 channel mixer'],
      modelKeywords: ['mixer', 'mixing console', 'console', 'digital 8', 'digital 16'],
      weight: 6,
    },
    {
      keywords: ['laptop', 'macbook', 'songs', 'playback laptop', 'dj laptop'],
      modelKeywords: ['laptop', 'macbook', 'songs', 'laptop w/ songs'],
      weight: 7,
    },
    {
      keywords: ['drum kit', 'bass amp', 'guitar amp', 'backline', 'band backline'],
      modelKeywords: ['backline', 'drum', 'amp', 'guitar amp', 'live band'],
      weight: 6,
    },
  ];

  for (const p of patterns) {
    const hasItemKey = p.keywords.some((k) => l.includes(k));
    const hasModelKey = p.modelKeywords.some((k) => name.includes(k) || id.includes(k) || desc.includes(k));
    if (hasItemKey && hasModelKey) {
      score += p.weight;
    }
  }

  // Exact word tokens overlap
  const stopWords = new Set(['and', 'with', 'full', 'set', 'unit', 'units', 'each', 'the', 'for', 'inch', 'high', 'output', 'heavy', 'duty', 'sound', 'system', 'audio', 'lighting']);
  const itemWords = l.split(' ').filter((w) => w.length > 2 && !stopWords.has(w));
  const modelWords = name.split(' ').filter((w) => w.length > 2 && !stopWords.has(w));

  const overlap = itemWords.filter((w) => modelWords.includes(w)).length;
  score += overlap * 2;

  return score;
}

export type TimeRangeFilter = 'all' | '7days' | '30days' | 'quarter' | 'year' | 'this_month' | 'custom';
export type EventScopeFilter = 'completed_only' | 'all_active';

/**
 * Main query & computation engine:
 * Fetches real bookings, equipment models, physical units, and packages from Supabase
 * and calculates exact accumulated operational hours and utilization for every model.
 */
export async function fetchEquipmentUsageStats(options?: {
  timeRange?: TimeRangeFilter;
  scope?: EventScopeFilter;
  startDate?: string;
  endDate?: string;
}): Promise<{
  modelsUsage: EquipmentModelUsage[];
  summary: UsageFleetSummary;
  allEvents: BookingUsageEvent[];
}> {
  const timeRange = options?.timeRange || 'all';
  const scope = options?.scope || 'completed_only';
  const startDate = options?.startDate || '';
  const endDate = options?.endDate || '';
  const todayStr = new Date().toISOString().split('T')[0];
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  try {
    // 1. Fetch bookings, models, physical units, and packages concurrently
    const [bookingsRes, modelsRes, unitsRes, packagesRes] = await Promise.all([
      supabase
        .from('bookings')
        .select('*')
        .order('event_date', { ascending: false }),
      supabase
        .from('equipment_models')
        .select('*')
        .order('category', { ascending: true }),
      supabase
        .from('physical_units')
        .select('*'),
      supabase
        .from('packages')
        .select('package_id, name, tag, inclusions, items'),
    ]);

    const rawBookings: any[] = bookingsRes.data || [];
    const rawModels: any[] = modelsRes.data || [];
    const rawUnits: any[] = unitsRes.data || [];
    const rawPackages: any[] = packagesRes.data || [];

    // Fallback default models if DB table is empty
    let modelsList = rawModels;
    if (modelsList.length === 0) {
      modelsList = [
        { model_id: 'LED-P3', name: 'P3 HD Indoor LED Wall Panel (3.5m x 2m)', brand: 'Novastar / BINHI', category: 'Video & Visuals', description: 'High definition 3.91mm pitch LED display screen.' },
        { model_id: 'SPK-LINE', name: 'Active Concert Line Array Speaker Rig', brand: 'Yamaha / D&B', category: 'Audio Production', description: 'Dual 8-inch line array modules with 18-inch powered subwoofers.' },
        { model_id: 'LGT-MHEAD', name: 'Moving Head Beam/Spot Light Set (8 Units)', brand: 'Beam 230W 7R', category: 'Lighting & Atmosphere', description: 'Synchronized DMX 7R moving head stage lights.' },
        { model_id: 'EFX-SMK', name: 'Low-Lying Fog & Smoke Machine', brand: 'Chauvet Stage', category: 'Stage Special Effects', description: 'Water-based low-fog machine for bridal dancing on clouds.' },
        { model_id: 'MIC-UHF', name: 'UHF Wireless Handheld Microphone System', brand: 'Sennheiser / Shure', category: 'Audio Production', description: 'Dual diversity wireless handheld vocal microphones.' },
        { model_id: 'TRS-ALUM', name: 'Heavy Duty Aluminum Box Trussing 4m', brand: 'Global Truss', category: 'Staging & Rigging', description: 'Modular aluminum box truss for stage lighting and LED walls.' },
      ];
    }

    // Build package lookup map with standard packages + database packages
    const pkgMap: Record<string, { tag: string; inclusions: string[] }> = {};
    
    // 1a. Load default FEATURED_PACKAGES
    FEATURED_PACKAGES.forEach((p) => {
      const data = { tag: p.tag, inclusions: p.inclusions };
      pkgMap[p.id] = data;
      pkgMap[p.id.toLowerCase()] = data;
      pkgMap[p.name] = data;
      pkgMap[p.name.toLowerCase()] = data;
      const shortName = p.name.split('—')[0].trim();
      pkgMap[shortName] = data;
      pkgMap[shortName.toLowerCase()] = data;
    });

    // 1b. Overlay DB packages
    rawPackages.forEach((p: any) => {
      const inclusions: string[] =
        Array.isArray(p.inclusions) && p.inclusions.length > 0
          ? p.inclusions
          : Array.isArray(p.items)
          ? p.items.map((it: any) => (typeof it === 'string' ? it : `${it.qty || 1}x ${it.name || it.label || ''}`))
          : [];
      const tag = p.tag || p.name || 'Production Setup';
      const entry = { tag, inclusions };
      const pid = p.package_id || p.id;
      if (pid) {
        pkgMap[pid] = entry;
        pkgMap[String(pid).toLowerCase()] = entry;
      }
      if (p.name) {
        pkgMap[p.name] = entry;
        pkgMap[String(p.name).toLowerCase()] = entry;
        const shortName = String(p.name).split('—')[0].trim();
        pkgMap[shortName] = entry;
        pkgMap[shortName.toLowerCase()] = entry;
      }
    });

    // Build model to serials mapping
    const modelToSerials: Record<string, { serialId: string; condition: string; status: string }[]> = {};
    modelsList.forEach((m: any) => {
      const mid = m.model_id || m.modelId || m.id;
      modelToSerials[mid] = [];
    });
    rawUnits.forEach((u: any) => {
      const mid = u.model_id || u.modelId;
      const sid = u.serial_id || u.serialId || u.id;
      if (mid && sid) {
        if (!modelToSerials[mid]) modelToSerials[mid] = [];
        modelToSerials[mid].push({
          serialId: sid,
          condition: u.condition || 'Operational (Good)',
          status: u.status || 'Available in Warehouse',
        });
      }
    });

    // Map and filter bookings according to scope & date range
    const parsedEvents: BookingUsageEvent[] = [];

    rawBookings.forEach((b: any) => {
      const rawStatus = String(b.status || b.booking_status || '').toLowerCase().trim();
      const payStatus = String(b.payment_status || '').toLowerCase().trim();
      const setupStatus = String(b.setup_status || '').toLowerCase().trim();

      // Exclude explicitly cancelled, declined, or voided bookings
      const isCancelled =
        rawStatus === 'cancelled' ||
        rawStatus === 'declined' ||
        rawStatus === 'refunded' ||
        payStatus === 'cancelled' ||
        payStatus === 'declined' ||
        payStatus === 'refunded';

      if (isCancelled) return;

      const bDate = b.event_date ? (b.event_date.includes('T') ? b.event_date.split('T')[0] : b.event_date) : todayStr;
      const sTime = b.start_time ? String(b.start_time).slice(0, 5) : '13:00';
      const eTime = b.end_time ? String(b.end_time).slice(0, 5) : '18:00';
      const duration = calculateEventDurationHours(sTime, eTime);

      // Event date timestamp check
      const eventDateObj = new Date(bDate + 'T00:00:00');
      const isPastOrToday = !isNaN(eventDateObj.getTime()) && eventDateObj.getTime() <= (todayMidnight + 24 * 60 * 60 * 1000);

      // Completion Criteria:
      // 1. Explicitly marked complete in is_completed
      // 2. status or booking_status === 'completed'
      // 3. setup_status === 'teardown complete' or 'completed'
      // 4. payment_status === 'completed'
      // 5. Past / concluded event date and confirmed/paid
      const isCompleted =
        b.is_completed === true ||
        rawStatus === 'completed' ||
        setupStatus === 'teardown complete' ||
        setupStatus === 'completed' ||
        payStatus === 'completed' ||
        (isPastOrToday && (payStatus === 'paid' || payStatus === 'deposit_paid' || rawStatus === 'confirmed' || rawStatus === 'upcoming' || rawStatus === 'pending_approval' || !rawStatus));

      let assignedUnits: string[] = [];
      if (Array.isArray(b.assigned_units)) {
        assignedUnits = b.assigned_units.map((u: any) => typeof u === 'string' ? u : u.serial_id || u.serialId || u.serial || String(u));
      } else if (typeof b.assigned_units === 'string') {
        try {
          const parsed = JSON.parse(b.assigned_units);
          if (Array.isArray(parsed)) {
            assignedUnits = parsed.map((u: any) => typeof u === 'string' ? u : u.serial_id || u.serialId || u.serial || String(u));
          }
        } catch {}
      }

      let selectedAddons: string[] = [];
      if (Array.isArray(b.selected_addons)) {
        selectedAddons = b.selected_addons.map((a: any) => typeof a === 'string' ? a : (a.name || a.label || ''));
      } else if (typeof b.selected_addons === 'string') {
        try {
          const parsed = JSON.parse(b.selected_addons);
          if (Array.isArray(parsed)) {
            selectedAddons = parsed.map((a: any) => typeof a === 'string' ? a : (a.name || a.label || ''));
          }
        } catch {}
      }

      const pkgName = b.package_name || (b.package_id && pkgMap[b.package_id]?.tag) || 'Event Production Setup';

      parsedEvents.push({
        bookingId: b.id,
        bookingRef: b.paymongo_reference_number || `BNH-${b.id?.slice(0, 8) || 'BOOKING'}`,
        customerName: b.customer_name || 'Event Host',
        eventType: b.event_type || 'Event Production',
        eventDate: bDate,
        eventDateRaw: b.event_date || bDate,
        startTime: sTime,
        endTime: eTime,
        durationHours: duration,
        venueAddress: b.venue_address || 'Luzon Venue',
        paymentStatus: payStatus || 'paid',
        status: isCompleted ? 'Completed' : (b.status || 'Upcoming'),
        isCompleted,
        assignedUnits,
        packageName: pkgName,
        selectedAddons,
      });
    });

    // Date range filter logic
    const filteredEvents = parsedEvents.filter((ev) => {
      // If scope is completed_only, strictly enforce completed bookings
      if (scope === 'completed_only' && !ev.isCompleted) {
        return false;
      }

      // 2. Custom Date Range filter
      if (startDate && ev.eventDate < startDate) {
        return false;
      }
      if (endDate && ev.eventDate > endDate) {
        return false;
      }

      if (timeRange === 'all' || timeRange === 'custom') return true;

      const evDate = new Date(ev.eventDate);
      if (isNaN(evDate.getTime())) return true;

      if (timeRange === '30days') {
        const past30 = new Date(now.getTime() - 30 * 24 * 60 * 1000);
        return evDate >= past30 && evDate <= now;
      }
      if (timeRange === 'this_month') {
        return evDate.getFullYear() === now.getFullYear() && evDate.getMonth() === now.getMonth();
      }
      if (timeRange === 'quarter') {
        const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        return evDate >= quarterStart && evDate <= now;
      }
      if (timeRange === 'year') {
        return evDate.getFullYear() === now.getFullYear();
      }
      return true;
    });

    // 2. Pre-process equipment assignments per event to guarantee accurate 1-to-1 matching
    const eventModelAllocations = new Map<string, Map<string, { qty: number; serialsUsed: string[] }>>();

    filteredEvents.forEach((ev) => {
      const modelAlloc = new Map<string, { qty: number; serialsUsed: string[] }>();

      // 1. Explicit assigned serial units
      if (ev.assignedUnits && ev.assignedUnits.length > 0) {
        ev.assignedUnits.forEach((assignedSerial: string) => {
          const cleanSerial = String(assignedSerial).toUpperCase().trim();
          const foundModel = modelsList.find((m: any) => {
            const mid = m.model_id || m.modelId || m.id || '';
            const uList = modelToSerials[mid] || [];
            return (
              uList.some((u) => u.serialId.toUpperCase() === cleanSerial) ||
              (mid && cleanSerial.startsWith(mid.toUpperCase()))
            );
          });
          if (foundModel) {
            const mid = foundModel.model_id || foundModel.modelId || foundModel.id;
            const curr = modelAlloc.get(mid) || { qty: 0, serialsUsed: [] };
            curr.qty += 1;
            curr.serialsUsed.push(assignedSerial);
            modelAlloc.set(mid, curr);
          }
        });
      }

      // 2. If no explicit assigned serials, match package inclusions & add-ons to single best model
      if (modelAlloc.size === 0) {
        const pkgLookup =
          pkgMap[ev.packageName] ||
          pkgMap[ev.packageName?.toLowerCase()] ||
          pkgMap[ev.packageName?.split('—')[0]?.trim()] ||
          pkgMap[ev.bookingRef] ||
          { tag: '', inclusions: [] };

        const allItemsToCheck = [...pkgLookup.inclusions, ...ev.selectedAddons];

        allItemsToCheck.forEach((itemRaw) => {
          const { qty, label } = parseItemQty(itemRaw);
          if (!label || isServiceItem(label)) return;

          // Find the single best matching model for this item
          let bestModel: any = null;
          let highestScore = 0;

          modelsList.forEach((model: any) => {
            const mid = model.model_id || model.modelId || model.id || '';
            const score = calculateMatchScore(label, model.name, mid, model.description || '');
            if (score > highestScore && score >= 3) {
              highestScore = score;
              bestModel = model;
            }
          });

          if (bestModel) {
            const mid = bestModel.model_id || bestModel.modelId || bestModel.id;
            const curr = modelAlloc.get(mid) || { qty: 0, serialsUsed: [] };
            curr.qty += qty;
            const uList = modelToSerials[mid] || [];
            for (let k = 0; k < qty; k++) {
              const simSerial = uList[k]?.serialId || `${mid}-00${k + 1}`;
              if (!curr.serialsUsed.includes(simSerial)) {
                curr.serialsUsed.push(simSerial);
              }
            }
            modelAlloc.set(mid, curr);
          }
        });
      }

      eventModelAllocations.set(ev.bookingId, modelAlloc);
    });

    // 3. Compute accumulated operational hours per equipment model
    const modelsUsage: EquipmentModelUsage[] = modelsList.map((model: any) => {
      const mid = model.model_id || model.modelId || model.id || 'MODEL';
      const units = modelToSerials[mid] || [];
      const totalUnits = Math.max(1, units.length);
      const operationalCount = units.filter((u) => !u.status?.includes('Maintenance') && !u.condition?.includes('Repair')).length;
      const maintenanceCount = units.length - operationalCount;

      let accumulatedHours = 0;
      let unitsDeployedCount = 0;
      const deployments: ModelDeploymentRecord[] = [];

      filteredEvents.forEach((ev) => {
        const allocMap = eventModelAllocations.get(ev.bookingId);
        const alloc = allocMap?.get(mid);

        if (alloc && alloc.qty > 0) {
          const eventHours = Number((ev.durationHours * alloc.qty).toFixed(1));
          accumulatedHours += eventHours;
          unitsDeployedCount += alloc.qty;

          deployments.push({
            bookingRef: ev.bookingRef,
            customerName: ev.customerName,
            eventDate: ev.eventDate,
            eventType: ev.eventType,
            venue: ev.venueAddress,
            durationHours: ev.durationHours,
            quantity: alloc.qty,
            serialsUsed: alloc.serialsUsed,
            totalModelHours: eventHours,
          });
        }
      });

      // Calculate Utilization Rate %
      // Standard benchmark: Standard operational benchmark hours per unit fleet
      const benchmarkHoursPerUnit = timeRange === '30days' || timeRange === 'this_month' ? 40 : timeRange === 'quarter' ? 120 : 300;
      const fleetCapacityHours = totalUnits * benchmarkHoursPerUnit;
      const rawUtil = fleetCapacityHours > 0 ? (accumulatedHours / fleetCapacityHours) * 100 : 0;
      const utilizationRate = Math.min(100, Math.round(rawUtil * 10) / 10);

      // Categorize Demand Status dynamically
      let status: EquipmentModelUsage['status'] = 'Standby / Low Usage';
      if (utilizationRate >= 70 || accumulatedHours >= 80) {
        status = 'Highest Demand';
      } else if (utilizationRate >= 40 || accumulatedHours >= 40) {
        status = 'Consistent Usage';
      } else if (utilizationRate >= 15 || accumulatedHours >= 15) {
        status = 'Moderate Usage';
      } else if (accumulatedHours > 0) {
        status = 'Optimal Condition';
      }

      // Wear & Maintenance Health Index
      const serviceIntervalHours = 100; // Maintenance recommended every 100 operational hours
      const cycleHours = accumulatedHours % serviceIntervalHours;
      const nextServiceHoursRemaining = Math.max(0, serviceIntervalHours - cycleHours);
      const wearPercentage = Math.min(100, Math.round((cycleHours / serviceIntervalHours) * 100));

      let wearStatus: EquipmentModelUsage['wearStatus'] = 'Good / Optimal';
      if (cycleHours >= 85) {
        wearStatus = 'Inspection Required';
      } else if (cycleHours >= 60) {
        wearStatus = 'Service Due Soon';
      } else if (cycleHours >= 30) {
        wearStatus = 'Moderate Wear';
      }

      const eventsCount = deployments.length;
      const avgHoursPerEvent = eventsCount > 0 ? Number((accumulatedHours / eventsCount).toFixed(1)) : 0;

      return {
        modelId: mid,
        name: model.name || mid,
        brand: model.brand || 'BINHI Standard',
        category: model.category || 'Production Gear',
        description: model.description || '',
        imageUrl: model.image_url,
        totalUnits,
        operationalUnitsCount: operationalCount,
        unitsInMaintenanceCount: maintenanceCount,
        serialsList: units.map((u) => u.serialId),
        accumulatedHours: Number(accumulatedHours.toFixed(1)),
        eventsCount,
        unitsDeployedCount,
        avgHoursPerEvent,
        utilizationRate,
        status,
        wearStatus,
        serviceIntervalHours,
        cycleHours: Number(cycleHours.toFixed(1)),
        nextServiceHoursRemaining: Number(nextServiceHoursRemaining.toFixed(1)),
        wearPercentage,
        eventDeployments: deployments,
      };
    });

    // Sort by accumulated hours descending (most utilized first)
    modelsUsage.sort((a, b) => b.accumulatedHours - a.accumulatedHours);

    // 3. Compute Fleet Summary Metrics
    const totalFleetOperatingHours = Number(
      modelsUsage.reduce((sum, m) => sum + m.accumulatedHours, 0).toFixed(1)
    );
    const totalCompletedEvents = filteredEvents.length;
    const totalEquipmentDeployments = modelsUsage.reduce((sum, m) => sum + m.unitsDeployedCount, 0);
    const avgFleetUtilization =
      modelsUsage.length > 0
        ? Number(
            (modelsUsage.reduce((sum, m) => sum + m.utilizationRate, 0) / modelsUsage.length).toFixed(1)
          )
        : 0;

    const topUtilizedModel = modelsUsage[0]?.name || 'N/A';
    
    // Determine top category
    const catMap: Record<string, number> = {};
    modelsUsage.forEach((m) => {
      catMap[m.category] = (catMap[m.category] || 0) + m.accumulatedHours;
    });
    const topCategory = Object.keys(catMap).sort((a, b) => catMap[b] - catMap[a])[0] || 'Audio & Video';

    const summary: UsageFleetSummary = {
      totalFleetOperatingHours,
      totalCompletedEvents,
      totalEquipmentDeployments,
      avgFleetUtilization,
      topUtilizedModel,
      topCategory,
      activeTrackedModelsCount: modelsUsage.length,
      totalPhysicalUnitsCount: modelsUsage.reduce((sum, m) => sum + m.totalUnits, 0),
    };

    return {
      modelsUsage,
      summary,
      allEvents: filteredEvents,
    };
  } catch (err) {
    console.error('Error in fetchEquipmentUsageStats:', err);
    throw err;
  }
}

/**
 * Export Equipment Usage & Operational Hours Report to Excel (.xlsx)
 */
export function exportEquipmentUsageToExcel(
  models: EquipmentModelUsage[],
  summary: UsageFleetSummary,
  timeRangeLabel: string
) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  // 1. Model Usage Sheet Data
  const modelRows = models.map((m) => ({
    'Model ID': m.modelId,
    'Equipment Name': m.name,
    'Category': m.category,
    'Brand': m.brand,
    'Total Fleet Units': `${m.totalUnits} Units`,
    'Operational Units': `${m.operationalUnitsCount} Units`,
    'In Maintenance Units': `${m.unitsInMaintenanceCount} Units`,
    'Accumulated Operating Runtime': `${m.accumulatedHours} Hours`,
    'Completed Events Deployed': `${m.eventsCount} Events`,
    'Total Units Dispatched': `${m.unitsDeployedCount} Deployments`,
    'Avg Operating Runtime per Event': `${m.avgHoursPerEvent} Hours / Event`,
    'Fleet Utilization Rate': `${m.utilizationRate}%`,
    'Demand Status': m.status,
    'Wear & Maintenance Health': `${m.wearStatus} (${m.wearPercentage}% Worn)`,
    'Next Scheduled Maintenance Due In': `${m.nextServiceHoursRemaining} Operating Hours (Interval: Every ${m.serviceIntervalHours} hrs)`,
  }));

  // 2. Summary Sheet Data
  const summaryRows = [
    { 'Report Metric': 'Report Filter Range', 'Value': timeRangeLabel },
    { 'Report Metric': 'Total Fleet Operational Runtime', 'Value': `${summary.totalFleetOperatingHours} Operating Hours` },
    { 'Report Metric': 'Completed Events Tracked', 'Value': `${summary.totalCompletedEvents} Completed Events` },
    { 'Report Metric': 'Total Equipment Unit Deployments', 'Value': `${summary.totalEquipmentDeployments} Unit Deployments` },
    { 'Report Metric': 'Average Fleet Utilization', 'Value': `${summary.avgFleetUtilization}%` },
    { 'Report Metric': 'Top Utilized Equipment Model', 'Value': summary.topUtilizedModel },
    { 'Report Metric': 'Highest Demand Category', 'Value': summary.topCategory },
    { 'Report Metric': 'Active Tracked Models', 'Value': `${summary.activeTrackedModelsCount} Equipment Models` },
    { 'Report Metric': 'Total Physical Serial Fleet', 'Value': `${summary.totalPhysicalUnitsCount} Physical Units` },
    { 'Report Metric': 'Generated At', 'Value': new Date().toLocaleString() },
  ];

  // 3. Granular Event Deployment Log Sheet
  const deploymentRows: any[] = [];
  models.forEach((m) => {
    m.eventDeployments.forEach((dep) => {
      deploymentRows.push({
        'Equipment Model': m.name,
        'Model ID': m.modelId,
        'Booking Reference': dep.bookingRef,
        'Customer': dep.customerName,
        'Event Date': dep.eventDate,
        'Event Type': dep.eventType,
        'Venue': dep.venue,
        'Event Duration': `${dep.durationHours} Hours`,
        'Quantity Deployed': `${dep.quantity} Units`,
        'Accumulated Model Operating Time': `${dep.totalModelHours} Operating Hours`,
        'Serials Assigned': dep.serialsUsed.join(', '),
      });
    });
  });

  const wb = XLSX.utils.book_new();

  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Fleet Summary');

  const wsModels = XLSX.utils.json_to_sheet(modelRows);
  XLSX.utils.book_append_sheet(wb, wsModels, 'Equipment Operational Hours');

  if (deploymentRows.length > 0) {
    const wsDeployments = XLSX.utils.json_to_sheet(deploymentRows);
    XLSX.utils.book_append_sheet(wb, wsDeployments, 'Event Deployment Logs');
  }

  XLSX.writeFile(wb, `BINHI_Equipment_Usage_Report_${timestamp}.xlsx`);
}

/**
 * Export Equipment Usage Report to CSV with explicit units
 */
export function exportEquipmentUsageToCSV(models: EquipmentModelUsage[]) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const rows = models.map((m) => ({
    'Model ID': m.modelId,
    'Equipment Name': m.name,
    'Category': m.category,
    'Brand': m.brand,
    'Total Fleet Units': `${m.totalUnits} Units`,
    'Operational Units': `${m.operationalUnitsCount} Units`,
    'In Maintenance Units': `${m.unitsInMaintenanceCount} Units`,
    'Accumulated Operating Runtime': `${m.accumulatedHours} Hours`,
    'Completed Events Count': `${m.eventsCount} Events`,
    'Total Unit Deployments': `${m.unitsDeployedCount} Deployments`,
    'Avg Runtime per Event': `${m.avgHoursPerEvent} Hours/Event`,
    'Utilization Rate (%)': `${m.utilizationRate}%`,
    'Demand Status': m.status,
    'Wear Health Status': m.wearStatus,
    'Wear Cycle (% Worn)': `${m.wearPercentage}%`,
    'Next Maintenance Due In': `${m.nextServiceHoursRemaining} Operating Hours`,
    'Recommended Maintenance Interval': `Every ${m.serviceIntervalHours} Operating Hours`,
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws);

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `BINHI_Equipment_Usage_${timestamp}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
