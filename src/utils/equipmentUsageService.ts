import { supabase } from './supabase';
import * as XLSX from 'xlsx';

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
export function parseItemQty(raw: string): { qty: number; label: string } {
  if (!raw) return { qty: 1, label: '' };
  const m = raw.match(/^(\d+)\s*[xX]\s+(.+)$/);
  if (m) {
    return { qty: Math.max(1, parseInt(m[1], 10)), label: m[2].trim() };
  }
  return { qty: 1, label: raw.trim() };
}

// Fuzzy match for gear name against model name
export function matchGearToModel(itemLabel: string, modelName: string, category: string): boolean {
  const norm = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
  
  const normLabel = norm(itemLabel);
  const normModel = norm(modelName);
  const normCat = norm(category);

  if (normModel.includes(normLabel) || normLabel.includes(normModel)) return true;

  const labelWords = normLabel.split(' ').filter((w) => w.length > 2);
  if (labelWords.length === 0) return false;

  const matchCount = labelWords.filter((w) => normModel.includes(w) || normCat.includes(w)).length;
  return matchCount >= Math.max(1, Math.floor(labelWords.length * 0.4));
}

export type TimeRangeFilter = 'all' | '30days' | 'quarter' | 'year' | 'this_month' | 'custom';
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

  try {
    // 1. Fetch bookings, models, physical units, and packages concurrently
    const [bookingsRes, modelsRes, unitsRes, packagesRes] = await Promise.all([
      supabase
        .from('bookings')
        .select('*')
        .neq('payment_status', 'cancelled')
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

    // Build package lookup map
    const pkgMap: Record<string, { tag: string; inclusions: string[] }> = {};
    rawPackages.forEach((p: any) => {
      const inclusions: string[] =
        Array.isArray(p.inclusions) && p.inclusions.length > 0
          ? p.inclusions
          : Array.isArray(p.items)
          ? p.items.map((it: any) => (typeof it === 'string' ? it : `${it.qty || 1}x ${it.name}`))
          : [];
      const tag = p.tag || 'Production Setup';
      if (p.package_id) pkgMap[p.package_id] = { tag, inclusions };
      if (p.name) pkgMap[p.name] = { tag, inclusions };
      if (p.id) pkgMap[p.id] = { tag, inclusions };
    });

    // Build model to serials mapping
    const modelToSerials: Record<string, { serialId: string; condition: string; status: string }[]> = {};
    modelsList.forEach((m: any) => {
      modelToSerials[m.model_id] = [];
    });
    rawUnits.forEach((u: any) => {
      if (modelToSerials[u.model_id]) {
        modelToSerials[u.model_id].push({
          serialId: u.serial_id,
          condition: u.condition || 'Operational (Good)',
          status: u.status || 'Available in Warehouse',
        });
      }
    });

    // Map and filter bookings according to scope & date range
    const parsedEvents: BookingUsageEvent[] = rawBookings.map((b: any) => {
      const bDate = b.event_date ? (b.event_date.includes('T') ? b.event_date.split('T')[0] : b.event_date) : todayStr;
      const sTime = b.start_time ? String(b.start_time).slice(0, 5) : '13:00';
      const eTime = b.end_time ? String(b.end_time).slice(0, 5) : '18:00';
      const duration = calculateEventDurationHours(sTime, eTime);
      // Strict check for Completed status of bookings
      const isComp =
        b.is_completed === true ||
        (b.status && b.status.toLowerCase() === 'completed') ||
        (b.booking_status && b.booking_status.toLowerCase() === 'completed') ||
        b.setup_status === 'Teardown Complete' ||
        b.payment_status === 'completed';

      const assignedUnits = Array.isArray(b.assigned_units)
        ? b.assigned_units
        : typeof b.assigned_units === 'string'
        ? JSON.parse(b.assigned_units || '[]')
        : [];

      const selectedAddons = Array.isArray(b.selected_addons)
        ? b.selected_addons
        : typeof b.selected_addons === 'string'
        ? JSON.parse(b.selected_addons || '[]')
        : [];

      return {
        bookingId: b.id,
        bookingRef: b.paymongo_reference_number || `BNH-${b.id.slice(0, 8)}`,
        customerName: b.customer_name || 'Event Host',
        eventType: b.event_type || 'Event Production',
        eventDate: bDate,
        eventDateRaw: b.event_date || bDate,
        startTime: sTime,
        endTime: eTime,
        durationHours: duration,
        venueAddress: b.venue_address || 'Luzon Venue',
        paymentStatus: (b.payment_status || 'paid').toLowerCase(),
        status: isComp ? 'Completed' : (b.status || 'Upcoming'),
        isCompleted: isComp,
        assignedUnits,
        packageName: b.package_name || (b.package_id && pkgMap[b.package_id]?.tag) || 'Custom Staging Package',
        selectedAddons,
      };
    });

    // Date range filter logic - strictly only completed events
    const now = new Date();
    const filteredEvents = parsedEvents.filter((ev) => {
      // Strictly enforce completed bookings only
      if (!ev.isCompleted) {
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

    // 2. Compute accumulated operational hours per equipment model
    const modelsUsage: EquipmentModelUsage[] = modelsList.map((model: any) => {
      const units = modelToSerials[model.model_id] || [];
      const totalUnits = Math.max(1, units.length);
      const operationalCount = units.filter((u) => !u.status?.includes('Maintenance') && !u.condition?.includes('Repair')).length;
      const maintenanceCount = units.length - operationalCount;

      let accumulatedHours = 0;
      let unitsDeployedCount = 0;
      const deployments: ModelDeploymentRecord[] = [];

      filteredEvents.forEach((ev) => {
        let modelQuantityForEvent = 0;
        const serialsUsed: string[] = [];

        // Check assigned serial units
        if (ev.assignedUnits && ev.assignedUnits.length > 0) {
          ev.assignedUnits.forEach((assignedSerial: string) => {
            const foundUnit = units.find((u) => u.serialId.toUpperCase() === String(assignedSerial).toUpperCase());
            if (foundUnit || assignedSerial.toUpperCase().startsWith(model.model_id.toUpperCase())) {
              modelQuantityForEvent += 1;
              serialsUsed.push(assignedSerial);
            }
          });
        }

        // If no explicit serial match in assignedUnits, match package inclusions & selected add-ons
        if (modelQuantityForEvent === 0) {
          const pkg = pkgMap[ev.packageName] || pkgMap[ev.bookingRef] || { tag: '', inclusions: [] };
          const allItemsToCheck = [...pkg.inclusions, ...ev.selectedAddons];

          allItemsToCheck.forEach((itemStr) => {
            const { qty, label } = parseItemQty(itemStr);
            if (matchGearToModel(label, model.name, model.category || '')) {
              modelQuantityForEvent += qty;
              for (let k = 0; k < qty; k++) {
                const simSerial = units[k]?.serialId || `${model.model_id}-00${k + 1}`;
                if (!serialsUsed.includes(simSerial)) {
                  serialsUsed.push(simSerial);
                }
              }
            }
          });
        }

        // If this model was deployed in this event, accumulate actual operational duration
        if (modelQuantityForEvent > 0) {
          const eventHours = Number((ev.durationHours * modelQuantityForEvent).toFixed(1));
          accumulatedHours += eventHours;
          unitsDeployedCount += modelQuantityForEvent;

          deployments.push({
            bookingRef: ev.bookingRef,
            customerName: ev.customerName,
            eventDate: ev.eventDate,
            eventType: ev.eventType,
            venue: ev.venueAddress,
            durationHours: ev.durationHours,
            quantity: modelQuantityForEvent,
            serialsUsed,
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
        modelId: model.model_id,
        name: model.name,
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
    'Fleet Units': m.totalUnits,
    'Accumulated Operating Hours': `${m.accumulatedHours} hrs`,
    'Events Deployed': m.eventsCount,
    'Total Units Deployed': m.unitsDeployedCount,
    'Avg Hours per Event': `${m.avgHoursPerEvent} hrs`,
    'Utilization Rate (%)': `${m.utilizationRate}%`,
    'Demand Status': m.status,
    'Wear Health': m.wearStatus,
    'Next Maintenance In': `${m.nextServiceHoursRemaining} hrs`,
  }));

  // 2. Summary Sheet Data
  const summaryRows = [
    { 'Report Metric': 'Report Filter Range', 'Value': timeRangeLabel },
    { 'Report Metric': 'Total Fleet Operational Hours', 'Value': `${summary.totalFleetOperatingHours} Hours` },
    { 'Report Metric': 'Completed Events Tracked', 'Value': `${summary.totalCompletedEvents} Events` },
    { 'Report Metric': 'Total Unit Deployments', 'Value': `${summary.totalEquipmentDeployments} Deployments` },
    { 'Report Metric': 'Average Fleet Utilization', 'Value': `${summary.avgFleetUtilization}%` },
    { 'Report Metric': 'Top Utilized Equipment', 'Value': summary.topUtilizedModel },
    { 'Report Metric': 'Highest Demand Category', 'Value': summary.topCategory },
    { 'Report Metric': 'Active Tracked Models', 'Value': `${summary.activeTrackedModelsCount} Models` },
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
        'Event Duration (Hours)': dep.durationHours,
        'Quantity Deployed': dep.quantity,
        'Accumulated Model Hours': dep.totalModelHours,
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
 * Export Equipment Usage Report to CSV
 */
export function exportEquipmentUsageToCSV(models: EquipmentModelUsage[]) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const rows = models.map((m) => ({
    model_id: m.modelId,
    equipment_name: m.name,
    category: m.category,
    total_fleet_units: m.totalUnits,
    accumulated_operational_hours: m.accumulatedHours,
    events_count: m.eventsCount,
    utilization_rate_pct: m.utilizationRate,
    demand_status: m.status,
    wear_status: m.wearStatus,
    next_maintenance_hours_remaining: m.nextServiceHoursRemaining,
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
