import { useState, useEffect } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import {
  IconShield,
  IconSearch,
  IconCheck,
  IconBox,
  IconClock,
  IconChevronUp,
  IconChevronDown,
  IconX,
} from '../../components/shared/icons';
import { EmptyState } from '../../components/shared/EmptyState';
import { supabase } from '../../lib/supabase';

function IconAlertTriangle({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  );
}

const inputClass =
  'w-full rounded-full border px-4 py-2.5 text-xs bg-[#EEEEEE] text-[var(--ink)] placeholder:text-[#24252c]/40 focus:outline-none focus:border-[#1090F8] border-transparent transition-colors';

interface GearItem {
  name: string;
  rawName: string;
  qty: number;
  serialIds: string[];
  isAddon: boolean;
}

interface BookingEquipment {
  id: string;
  bookingRef: string;
  customerName: string;
  packageName: string;
  packageTag: string;
  eventDate: string;
  eventDateRaw: string;
  eventType: string;
  venue: string;
  paymentStatus: string;
  assignedUnitsRaw: any[];
  gear: GearItem[];
  hasConflict?: boolean;
  conflictSerials?: string[];
}

const STATUS_COLORS: Record<string, string> = {
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  confirmed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  partial: 'bg-amber-50 text-amber-700 border-amber-200',
  pending: 'bg-sky-50 text-sky-700 border-sky-200',
  pending_verification: 'bg-purple-50 text-purple-700 border-purple-200',
  cancelled: 'bg-rose-50 text-rose-700 border-rose-200',
};

const STATUS_LABEL: Record<string, string> = {
  paid: 'Paid (Full)',
  confirmed: 'Confirmed',
  partial: 'Deposit Paid',
  pending: 'Pending',
  pending_verification: 'Pending Review',
  cancelled: 'Cancelled',
};

function seededIndex(seed: string, max: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % max;
}

function fuzzyMatch(itemLabel: string, modelName: string): boolean {
  const item = itemLabel.toLowerCase();
  const model = modelName.toLowerCase();
  if (model.includes(item) || item.includes(model)) return true;
  const keywords = item.split(/\s+/).filter((w) => w.length > 2);
  return keywords.some((kw) => model.includes(kw));
}

export default function UnitAssignmentPage({ go }: { go: (p: Page) => void }) {
  const [bookingsList, setBookingsList] = useState<BookingEquipment[]>([]);
  const [physicalUnitsLookup, setPhysicalUnitsLookup] = useState<Record<string, { status: string; condition: string; modelId: string }>>({});
  const [modelAvailableSerials, setModelAvailableSerials] = useState<Record<string, { name: string; availableSerials: string[] }>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [expandedRef, setExpandedRef] = useState<string | null>(null);
  const [swappingSerial, setSwappingSerial] = useState(false);

  // Success Notification State
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 4500);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch all non-cancelled bookings with assigned_units directly from Supabase
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select(
          'id, paymongo_reference_number, customer_name, package_id, package_name, event_date, event_type, venue_address, payment_status, selected_addons, assigned_units'
        )
        .neq('payment_status', 'cancelled')
        .order('event_date', { ascending: true });

      if (bookingsError) throw bookingsError;

      // 2. Fetch all packages for inclusions/tag
      const { data: packages, error: packagesError } = await supabase
        .from('packages')
        .select('package_id, name, tag, inclusions, items');

      if (packagesError) throw packagesError;

      // 3. Fetch all physical units with status and condition
      const { data: physicalUnits, error: unitsError } = await supabase
        .from('physical_units')
        .select('serial_id, model_id, status, condition');

      if (unitsError) throw unitsError;

      // 4. Fetch equipment models for name lookup
      const { data: equipmentModels, error: modelsError } = await supabase
        .from('equipment_models')
        .select('model_id, name, category');

      if (modelsError) throw modelsError;

      // Build physical units status lookup
      const unitLookup: Record<string, { status: string; condition: string; modelId: string }> = {};
      (physicalUnits || []).forEach((u: any) => {
        unitLookup[u.serial_id] = {
          status: u.status,
          condition: u.condition,
          modelId: u.model_id,
        };
      });
      setPhysicalUnitsLookup(unitLookup);

      // Build lookup maps
      const pkgMap: Record<string, { tag: string; inclusions: string[] }> = {};
      (packages || []).forEach((p: any) => {
        const inclusions: string[] =
          Array.isArray(p.inclusions) && p.inclusions.length > 0
            ? p.inclusions
            : Array.isArray(p.items)
            ? p.items
            : [];
        pkgMap[p.package_id] = { tag: p.tag || 'Standard Setup', inclusions };
      });

      // model_id -> { name, availableSerials: string[] } ONLY operational warehouse units
      const modelMap: Record<string, { name: string; availableSerials: string[] }> = {};
      (equipmentModels || []).forEach((m: any) => {
        modelMap[m.model_id] = { name: m.name, availableSerials: [] };
      });

      (physicalUnits || []).forEach((u: any) => {
        const isOperational =
          u.status === 'Available in Warehouse' &&
          u.condition !== 'In Repair' &&
          u.status !== 'Maintenance / Repair' &&
          u.status !== 'Decommissioned / Inactive';

        if (isOperational && modelMap[u.model_id]) {
          modelMap[u.model_id].availableSerials.push(u.serial_id);
        }
      });
      setModelAvailableSerials(modelMap);

      // Flatten: itemLabel -> list of available serial IDs
      const allModelEntries = Object.values(modelMap);

      // Parse quantity prefix and format proper clean naming for gear & add-on items
      function parseQty(raw: any): { qty: number; label: string } {
        if (!raw) return { qty: 1, label: 'Add-on Item' };

        let str = '';
        let explicitQty: number | null = null;

        if (typeof raw === 'object') {
          str = raw.name || raw.label || raw.model_id || raw.modelId || 'Add-on Item';
          if (raw.qty) explicitQty = Number(raw.qty);
          else if (raw.quantity) explicitQty = Number(raw.quantity);
        } else {
          str = String(raw).trim();
        }

        // Strip price tags e.g. "Wireless Mic (₱1,500)" or "(+₱2,000)" or "- ₱1,500" or "[+₱1,500]"
        str = str.replace(/(\s*[\(\[-]\s*(\+?\s*₱|\+?\s*PHP)\s*[\d,]+(\.\d{2})?(\s*each|\s*\/unit)?\s*[\)\]]?)/gi, '').trim();

        // Check if string starts with "2x " or "2 x " or "2 Units of "
        const qtyMatch = str.match(/^(\d+)\s*(?:[xX]|\s*units?\s+of)\s+(.+)$/i);
        if (qtyMatch) {
          explicitQty = parseInt(qtyMatch[1], 10) || 1;
          str = qtyMatch[2].trim();
        }

        // Check if str matches an official equipment model ID
        if (modelMap[str]?.name) {
          str = modelMap[str].name;
        } else {
          const matchedModel = Object.entries(modelMap).find(([mid]) => mid.toLowerCase() === str.toLowerCase());
          if (matchedModel) {
            str = matchedModel[1].name;
          }
        }

        // Convert hyphenated or underscored slugs (e.g. "chauvet-intimidator-moving-head") to proper Title Case
        if (/^[a-z0-9_-]+$/i.test(str) && (str.includes('-') || str.includes('_'))) {
          str = str
            .split(/[-_]+/)
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join(' ');
        }

        return { qty: explicitQty || 1, label: str.trim() || 'Add-on Item' };
      }

      // Resolve N unique serials for a given gear item using seeded rotation or database
      function resolveSerials(
        rawLabel: string,
        bookingRef: string,
        itemIndex: number,
        existingUnitsForBooking: any[]
      ): { label: string; qty: number; serialIds: string[] } {
        const { qty, label } = parseQty(rawLabel);

        // Check if already persisted in database assigned_units
        const matchingDbSerials = existingUnitsForBooking
          .filter((u: any) => {
            if (typeof u === 'string') return false;
            const uName = (u.name || u.raw_name || '').toLowerCase();
            return uName.includes(label.toLowerCase()) || label.toLowerCase().includes(uName);
          })
          .map((u: any) => u.serial_id || u.serialId)
          .filter(Boolean);

        if (matchingDbSerials.length >= qty) {
          return { label, qty, serialIds: matchingDbSerials.slice(0, qty) };
        }

        const matched = allModelEntries.filter((m) => fuzzyMatch(label, m.name));
        const allSerials = [...new Set(matched.flatMap((m) => m.availableSerials))].sort();

        if (allSerials.length === 0) return { label, qty, serialIds: [] };

        // Pick `qty` unique serials by rotating through pool with seeded offsets
        const chosen: string[] = [];
        const used = new Set<string>();
        for (let k = 0; k < qty; k++) {
          const seed = `${bookingRef}::${label}::${itemIndex}::${k}`;
          let idx = seededIndex(seed, allSerials.length);
          let attempts = 0;
          while (used.has(allSerials[idx]) && attempts < allSerials.length) {
            idx = (idx + 1) % allSerials.length;
            attempts++;
          }
          const picked = allSerials[idx];
          chosen.push(picked);
          used.add(picked);
        }

        return { label, qty, serialIds: chosen };
      }

      // Map bookings to BookingEquipment with conflict detection
      const mapped: BookingEquipment[] = (bookings || []).map((b: any) => {
        const pkg = pkgMap[b.package_id] || { tag: 'Production Setup', inclusions: [] };
        const addons: string[] = Array.isArray(b.selected_addons) ? b.selected_addons : [];
        const bookingRef = b.paymongo_reference_number || `BNH-${b.id.slice(0, 8)}`;
        const dbAssigned: any[] = Array.isArray(b.assigned_units)
          ? b.assigned_units
          : typeof b.assigned_units === 'string'
          ? JSON.parse(b.assigned_units || '[]')
          : [];

        let allGear: GearItem[] = [];
        const conflictSerials: string[] = [];

        if (dbAssigned.length > 0) {
          const gearMap: Record<string, GearItem> = {};
          dbAssigned.forEach((u: any) => {
            const { label: properName } = parseQty(typeof u === 'string' ? u : u.name || u.raw_name || 'Equipment Item');
            const name = properName;
            const rawName = typeof u === 'string' ? u : u.raw_name || name;
            const isAddon = typeof u === 'object' ? Boolean(u.is_addon || u.isAddon) : false;
            const key = `${isAddon ? 'addon' : 'pkg'}::${name}`;
            const sid = typeof u === 'string' ? u : u.serial_id || u.serialId || '';

            if (!gearMap[key]) {
              gearMap[key] = {
                name,
                rawName,
                qty: 0,
                serialIds: [],
                isAddon,
              };
            }

            gearMap[key].qty += 1;
            if (sid && !gearMap[key].serialIds.includes(sid)) {
              gearMap[key].serialIds.push(sid);
              // Check if assigned serial is currently under repair / quarantine
              const uInfo = unitLookup[sid];
              if (
                uInfo &&
                (uInfo.status === 'Maintenance / Repair' ||
                  uInfo.status === 'Decommissioned / Inactive' ||
                  uInfo.condition === 'In Repair')
              ) {
                conflictSerials.push(sid);
              }
            }
          });
          allGear = Object.values(gearMap);
        } else {
          const inclusionGear: GearItem[] = pkg.inclusions.map((item, i) => {
            const { label, qty, serialIds } = resolveSerials(item, bookingRef, i, dbAssigned);
            return { name: label, rawName: item, qty, serialIds, isAddon: false };
          });

          const addonGear: GearItem[] = addons.map((addon, i) => {
            const { label, qty, serialIds } = resolveSerials(addon, bookingRef, pkg.inclusions.length + i, dbAssigned);
            return { name: label, rawName: addon, qty, serialIds, isAddon: true };
          });

          allGear = [...inclusionGear, ...addonGear];

          if (allGear.length > 0) {
            const initialUnits = allGear.flatMap((g, gIdx) =>
              g.serialIds.map((sid, sIdx) => ({
                serial_id: sid,
                unit_id: `${bookingRef}__${g.name}__${gIdx}__${sIdx}__${sid}`,
                name: g.name,
                raw_name: g.rawName,
                is_addon: g.isAddon,
                condition: 'Operational (Good)',
                checked: false,
              }))
            );
            supabase
              .from('bookings')
              .update({ assigned_units: initialUnits, updated_at: new Date().toISOString() })
              .eq('id', b.id)
              .then();
          }
        }

        return {
          id: b.id,
          bookingRef,
          customerName: b.customer_name || 'Event Host',
          packageName: b.package_name || 'Custom Setup',
          packageTag: pkg.tag,
          eventDate: b.event_date
            ? new Date(b.event_date + 'T00:00:00').toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })
            : 'Date Pending',
          eventDateRaw: b.event_date || '',
          eventType: b.event_type || 'Event Production',
          venue: b.venue_address || 'TBD / Manila',
          paymentStatus: (b.payment_status || 'pending').toLowerCase(),
          gear: allGear,
          assignedUnitsRaw: dbAssigned,
          hasConflict: conflictSerials.length > 0,
          conflictSerials,
        };
      });

      setBookingsList(mapped);
    } catch (err) {
      console.error('Error fetching unit assignments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const handleUpdate = () => fetchData();
    window.addEventListener('inventory-updated', handleUpdate);
    return () => window.removeEventListener('inventory-updated', handleUpdate);
  }, []);

  // Swap out a damaged/under-repair serial unit with an available operational unit
  const handleSwapSerial = async (bookingId: string, oldSerialId: string, newSerialId: string, gearName: string) => {
    if (!newSerialId || oldSerialId === newSerialId) return;

    setSwappingSerial(true);
    try {
      const targetBooking = bookingsList.find((b) => b.id === bookingId);
      if (!targetBooking) return;

      const rawAssigned: any[] = targetBooking.assignedUnitsRaw || [];
      const updatedAssigned = rawAssigned.map((u: any) => {
        const sid = typeof u === 'string' ? u : u.serial_id || u.serialId || '';
        if (sid === oldSerialId) {
          if (typeof u === 'string') return newSerialId;
          return {
            ...u,
            serial_id: newSerialId,
            unit_id: u.unit_id ? u.unit_id.replace(oldSerialId, newSerialId) : `${targetBooking.bookingRef}__${gearName}__${newSerialId}`,
            condition: 'Operational (Good)',
            checked: false,
          };
        }
        return u;
      });

      const { error } = await supabase
        .from('bookings')
        .update({
          assigned_units: updatedAssigned,
          updated_at: new Date().toISOString(),
        })
        .eq('id', bookingId);

      if (error) throw error;

      // Log Audit Trail
      await supabase.from('audit_logs').insert({
        action: 'SWAP_UNDER_REPAIR_UNIT',
        module: 'inventory',
        target_id: bookingId,
        details: `Replaced under-repair unit ${oldSerialId} with available unit ${newSerialId} for ${gearName} in Booking ${targetBooking.bookingRef}`,
        user_role: 'inventory_manager',
      });

      await fetchData();
      showSuccess(`Replaced unit ${oldSerialId} with available unit ${newSerialId} for "${gearName}".`);
      window.dispatchEvent(new Event('inventory-updated'));
    } catch (err) {
      console.error('Failed to swap unit:', err);
    } finally {
      setSwappingSerial(false);
    }
  };

  // Helper to find available operational serials matching gear item name
  const getAvailableSerialsForGear = (gearName: string, currentAssignedSerials: string[]): string[] => {
    const matchedModels = Object.values(modelAvailableSerials).filter((m) => fuzzyMatch(gearName, m.name));
    const allAvail = [...new Set(matchedModels.flatMap((m) => m.availableSerials))];
    // Exclude serials already assigned in this booking
    return allAvail.filter((s) => !currentAssignedSerials.includes(s));
  };

  const totalConflictBookings = bookingsList.filter((b) => b.hasConflict).length;

  const filtered = bookingsList.filter((b) => {
    const matchesStatus =
      statusFilter === 'All'
        ? true
        : statusFilter === 'Confirmed'
        ? b.paymentStatus === 'confirmed' || b.paymentStatus === 'paid' || b.paymentStatus === 'partial'
        : statusFilter === 'Pending'
        ? b.paymentStatus === 'pending' || b.paymentStatus === 'pending_verification'
        : true;

    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      b.bookingRef.toLowerCase().includes(q) ||
      b.customerName.toLowerCase().includes(q) ||
      b.packageName.toLowerCase().includes(q) ||
      b.venue.toLowerCase().includes(q) ||
      b.eventType.toLowerCase().includes(q) ||
      b.gear.some((g) => g.name.toLowerCase().includes(q) || g.serialIds.some((s) => s.toLowerCase().includes(q)));

    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#24252c]/[0.06]">
        <div>
          <MonoBadge icon={IconShield}>Equipment Planning & Quarantine Filter</MonoBadge>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ink)] mt-1.5">
            Unit-Level Date Assignments
          </h1>
          <p className="text-xs text-[#24252c]/60 mt-1">
            Per-booking operational unit assignments. Damaged &amp; quarantined units are automatically filtered out from availability.
          </p>
        </div>

        <button
          onClick={() => go('inventory-items')}
          className="bg-[var(--mist)] text-[var(--ink)] border border-[#24252c]/10 text-xs font-bold px-4 py-2.5 rounded-full hover:bg-[var(--ink)] hover:text-white transition-colors self-start sm:self-auto cursor-pointer"
        >
          Manage Unit Quarantine in Catalog
        </button>
      </div>

      {/* Operation Success Notification Banner */}
      {successMessage && (
        <div className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold shadow-xs animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-700 flex items-center justify-center shrink-0">
              <IconCheck className="w-3.5 h-3.5 text-emerald-700" />
            </span>
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 p-1 rounded-full hover:bg-emerald-100/50 cursor-pointer transition-colors"
            title="Dismiss notification"
          >
            <IconX className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Conflict Warning Banner if Any Booking Has Under-Repair Units */}
      {totalConflictBookings > 0 && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-300 shadow-sm flex items-start gap-3.5">
          <IconAlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-xs text-rose-900 flex-1">
            <p className="font-extrabold text-sm text-rose-900">
              Maintenance Conflict Detected ({totalConflictBookings} booking{totalConflictBookings > 1 ? 's' : ''} affected)
            </p>
            <p className="text-rose-800/80 mt-0.5 leading-relaxed">
              One or more units scheduled for upcoming events are currently tagged as <strong>Under Repair / Quarantine</strong>. Use the swap selectors below to reassign available operational warehouse units.
            </p>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#24252c]/[0.08] shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto">
          {['All', 'Confirmed', 'Pending'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`text-xs px-3.5 py-1.5 rounded-full font-medium transition-all cursor-pointer ${
                statusFilter === s
                  ? 'bg-[var(--ink)] text-white shadow-sm font-semibold'
                  : 'bg-[var(--mist)] text-[#24252c]/60 hover:text-[var(--ink)]'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <IconSearch className="w-4 h-4 text-[#24252c]/40 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search booking, gear, serial, or venue..."
            className={inputClass + ' pl-10'}
          />
        </div>
      </div>

      {/* Booking Equipment Cards */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-white rounded-2xl animate-pulse border border-[#24252c]/[0.08]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 border border-[#24252c]/[0.08] shadow-sm">
          <EmptyState
            title="No Bookings Found"
            description={
              search || statusFilter !== 'All'
                ? 'No bookings match your filter or search. Try adjusting them.'
                : 'No bookings with equipment assignments yet.'
            }
          />
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((b) => {
            const isExpanded = expandedRef === b.bookingRef;
            const isPast = b.eventDateRaw ? new Date(b.eventDateRaw) < new Date() : false;
            const packageGear = b.gear.filter((g) => !g.isAddon);
            const addonGear = b.gear.filter((g) => g.isAddon);
            const totalUnitsCount = b.gear.reduce((sum, g) => sum + g.qty, 0);

            // Read live packing verification status directly from Supabase assigned_units
            const dbAssigned = b.assignedUnitsRaw || [];
            const isSerialVerified = (serialId: string) => {
              return dbAssigned.some((u: any) => {
                if (!u) return false;
                const uSerial = typeof u === 'string' ? u : (u.serial_id || u.serialId || u.unit_id || '');
                return uSerial.toUpperCase().includes(serialId.toUpperCase()) && Boolean(u.checked);
              });
            };

            const verifiedCount = b.gear.reduce((sum, g) => {
              return sum + g.serialIds.filter((s) => isSerialVerified(s)).length;
            }, 0);

            const packingPct = totalUnitsCount > 0 ? Math.min(100, Math.round((verifiedCount / totalUnitsCount) * 100)) : 0;
            const isFullyPacked = packingPct === 100 && totalUnitsCount > 0;

            const allCurrentSerialsInBooking = b.gear.flatMap((g) => g.serialIds);

            return (
              <div
                key={b.bookingRef}
                className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${
                  b.hasConflict ? 'border-rose-300 ring-1 ring-rose-200' : 'border-[#24252c]/[0.08]'
                }`}
              >
                {/* Booking Row Header */}
                <button
                  type="button"
                  onClick={() => setExpandedRef(isExpanded ? null : b.bookingRef)}
                  className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 text-left hover:bg-[var(--mist)] transition-colors cursor-pointer"
                >
                  <div className="flex flex-wrap items-center gap-2.5 min-w-0">
                    <span className="font-mono font-extrabold text-xs text-[#1090F8] shrink-0">
                      {b.bookingRef}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${
                        STATUS_COLORS[b.paymentStatus] || STATUS_COLORS['pending']
                      }`}
                    >
                      {STATUS_LABEL[b.paymentStatus] || b.paymentStatus}
                    </span>

                    {/* Conflict Badge */}
                    {b.hasConflict && (
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-300 flex items-center gap-1 animate-pulse">
                        <IconAlertTriangle className="w-3 h-3 text-rose-600" />
                        <span>Unit Under Repair Flagged</span>
                      </span>
                    )}

                    {isPast && (
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#24252c]/10 text-[#24252c]/50 border border-[#24252c]/10 uppercase tracking-wider">
                        Past Event
                      </span>
                    )}

                    {/* Live Warehouse Packing Status Badge */}
                    {isFullyPacked ? (
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-300 flex items-center gap-1.5">
                        <IconCheck className="w-3 h-3 text-emerald-600 stroke-[2.5]" />
                        <span>100% Packed &amp; Verified</span>
                      </span>
                    ) : verifiedCount > 0 ? (
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-300 flex items-center gap-1.5">
                        <IconBox className="w-3 h-3 text-amber-600" />
                        <span>Packing: {verifiedCount}/{totalUnitsCount} ({packingPct}%)</span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200 flex items-center gap-1.5">
                        <IconClock className="w-3 h-3 text-gray-400" />
                        <span>Dispatch Pending</span>
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 text-xs text-[#24252c]/60 min-w-0 flex-1 sm:flex-none">
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-[var(--ink)] truncate">{b.customerName}</span>
                      <span className="text-[10px] truncate">
                        {b.packageName} · <span className="text-[#1090F8] font-semibold">{b.packageTag}</span>
                      </span>
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-semibold text-[var(--ink)]">{b.eventDate}</span>
                      <span className="text-[10px] truncate max-w-[200px]">{b.venue}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] font-semibold bg-[#1090F8]/10 text-[#1090F8] px-2 py-0.5 rounded-full border border-[#1090F8]/20">
                        {totalUnitsCount} unit{totalUnitsCount !== 1 ? 's' : ''}
                      </span>
                      {isExpanded ? (
                        <IconChevronUp className="w-4 h-4 text-[#24252c]/40" />
                      ) : (
                        <IconChevronDown className="w-4 h-4 text-[#24252c]/40" />
                      )}
                    </div>
                  </div>
                </button>

                {/* Expandable Gear Table */}
                {isExpanded && (
                  <div className="border-t border-[#24252c]/[0.06] px-5 pb-5 pt-4 space-y-5">
                    {/* Package Inclusions */}
                    {packageGear.length > 0 && (
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-[#24252c]/50 mb-2">
                          {b.packageName} — Package Inclusions
                        </div>
                        <div className="rounded-xl border border-[#24252c]/[0.08] overflow-hidden">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-[var(--mist)] border-b border-[#24252c]/[0.06] text-[#24252c]/50 uppercase tracking-wider text-[10px]">
                                <th className="py-2 px-3 font-semibold text-left">Equipment Item</th>
                                <th className="py-2 px-3 font-semibold text-left w-1/2">Assigned Serial IDs &amp; Reassignment</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#24252c]/[0.04]">
                              {packageGear.map((g, i) => (
                                <tr key={i} className="hover:bg-[var(--mist)]/40 transition-colors">
                                  <td className="py-2.5 px-3 align-top">
                                    <div className="flex items-start gap-2">
                                      <span className="w-1.5 h-1.5 rounded-full bg-[#1090F8] shrink-0 mt-1" />
                                      <div>
                                        <span className="font-medium text-[var(--ink)]">{g.name}</span>
                                        {g.qty > 1 && (
                                          <span className="ml-1.5 text-[10px] font-bold text-[#1090F8]/60">×{g.qty}</span>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-3 align-top">
                                    {g.serialIds.length > 0 ? (
                                      <div className="flex flex-col gap-2">
                                        {g.serialIds.map((sid, si) => {
                                          const verified = isSerialVerified(sid);
                                          const uInfo = physicalUnitsLookup[sid];
                                          const isUnderRepair =
                                            uInfo &&
                                            (uInfo.status === 'Maintenance / Repair' ||
                                              uInfo.status === 'Decommissioned / Inactive' ||
                                              uInfo.condition === 'In Repair');

                                          const availableReplacements = getAvailableSerialsForGear(g.name, allCurrentSerialsInBooking);

                                          return (
                                            <div key={si} className="flex flex-wrap items-center gap-2">
                                              <span
                                                className={`inline-flex items-center gap-1 font-mono font-bold text-[10px] px-2 py-0.5 rounded-lg border transition-all ${
                                                  isUnderRepair
                                                    ? 'bg-rose-50 text-rose-800 border-rose-300 ring-1 ring-rose-200'
                                                    : verified
                                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                                    : 'bg-[#1090F8]/8 text-[#1090F8] border-[#1090F8]/15'
                                                }`}
                                              >
                                                {isUnderRepair ? (
                                                  <span className="text-rose-600 font-extrabold flex items-center gap-1">
                                                    <IconAlertTriangle className="w-3 h-3 text-rose-600" />
                                                    {sid} [UNDER REPAIR]
                                                  </span>
                                                ) : (
                                                  <>
                                                    {verified && <IconCheck className="w-2.5 h-2.5 text-emerald-600 stroke-[3]" />}
                                                    <span>{sid}</span>
                                                    {verified && <span className="text-[9px] text-emerald-600 uppercase font-semibold">Packed</span>}
                                                  </>
                                                )}
                                              </span>

                                              {/* 1-Click Reassignment Swap Selector for Under-Repair or Quarantined Units */}
                                              {isUnderRepair && (
                                                <div className="flex items-center gap-1.5">
                                                  <select
                                                    disabled={swappingSerial}
                                                    onChange={(e) => handleSwapSerial(b.id, sid, e.target.value, g.name)}
                                                    className="text-[11px] bg-white border border-rose-300 text-rose-900 rounded-lg px-2.5 py-1 font-semibold focus:outline-none focus:border-[#1090F8] shadow-2xs"
                                                  >
                                                    <option value="">Reassign Replacement Unit...</option>
                                                    {availableReplacements.map((availSid) => (
                                                      <option key={availSid} value={availSid}>
                                                        Swap to: {availSid} (Operational in Warehouse)
                                                      </option>
                                                    ))}
                                                  </select>
                                                  {availableReplacements.length === 0 && (
                                                    <span className="text-[10px] text-rose-600 font-bold italic">
                                                      No other warehouse units available
                                                    </span>
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      <span className="text-[#24252c]/30 italic text-[10px]">No unit matched</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Add-ons */}
                    {addonGear.length > 0 && (
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-2">
                          Selected Add-ons
                        </div>
                        <div className="rounded-xl border border-amber-200/60 overflow-hidden">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-amber-50 border-b border-amber-200/60 text-amber-800/60 uppercase tracking-wider text-[10px]">
                                <th className="py-2 px-3 font-semibold text-left">Add-on Item</th>
                                <th className="py-2 px-3 font-semibold text-left w-1/2">Assigned Serial IDs &amp; Reassignment</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-amber-100">
                              {addonGear.map((g, i) => (
                                <tr key={i} className="hover:bg-amber-50/60 transition-colors">
                                  <td className="py-2.5 px-3 align-top">
                                    <div className="flex items-start gap-2">
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-1" />
                                      <div>
                                        <span className="font-medium text-[var(--ink)]">{g.name}</span>
                                        {g.qty > 1 && (
                                          <span className="ml-1.5 text-[10px] font-bold text-amber-600/60">×{g.qty}</span>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-3 align-top">
                                    {g.serialIds.length > 0 ? (
                                      <div className="flex flex-col gap-2">
                                        {g.serialIds.map((sid, si) => {
                                          const verified = isSerialVerified(sid);
                                          const uInfo = physicalUnitsLookup[sid];
                                          const isUnderRepair =
                                            uInfo &&
                                            (uInfo.status === 'Maintenance / Repair' ||
                                              uInfo.status === 'Decommissioned / Inactive' ||
                                              uInfo.condition === 'In Repair');

                                          const availableReplacements = getAvailableSerialsForGear(g.name, allCurrentSerialsInBooking);

                                          return (
                                            <div key={si} className="flex flex-wrap items-center gap-2">
                                              <span
                                                className={`inline-flex items-center gap-1 font-mono font-bold text-[10px] px-2 py-0.5 rounded-lg border transition-all ${
                                                  isUnderRepair
                                                    ? 'bg-rose-50 text-rose-800 border-rose-300 ring-1 ring-rose-200'
                                                    : verified
                                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                                    : 'bg-amber-100 text-amber-700 border-amber-200'
                                                }`}
                                              >
                                                {isUnderRepair ? (
                                                  <span className="text-rose-600 font-extrabold flex items-center gap-1">
                                                    <IconAlertTriangle className="w-3 h-3 text-rose-600" />
                                                    {sid} [UNDER REPAIR]
                                                  </span>
                                                ) : (
                                                  <>
                                                    {verified && <IconCheck className="w-2.5 h-2.5 text-emerald-600 stroke-[3]" />}
                                                    <span>{sid}</span>
                                                    {verified && <span className="text-[9px] text-emerald-600 uppercase font-semibold">Packed</span>}
                                                  </>
                                                )}
                                              </span>

                                              {/* 1-Click Reassignment Swap Selector for Addon */}
                                              {isUnderRepair && (
                                                <div className="flex items-center gap-1.5">
                                                  <select
                                                    disabled={swappingSerial}
                                                    onChange={(e) => handleSwapSerial(b.id, sid, e.target.value, g.name)}
                                                    className="text-[11px] bg-white border border-rose-300 text-rose-900 rounded-lg px-2.5 py-1 font-semibold focus:outline-none focus:border-[#1090F8] shadow-2xs"
                                                  >
                                                    <option value="">Reassign Replacement Unit...</option>
                                                    {availableReplacements.map((availSid) => (
                                                      <option key={availSid} value={availSid}>
                                                        Swap to: {availSid} (Operational in Warehouse)
                                                      </option>
                                                    ))}
                                                  </select>
                                                  {availableReplacements.length === 0 && (
                                                    <span className="text-[10px] text-rose-600 font-bold italic">
                                                      No other warehouse units available
                                                    </span>
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      <span className="text-[#24252c]/30 italic text-[10px]">No unit matched</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
