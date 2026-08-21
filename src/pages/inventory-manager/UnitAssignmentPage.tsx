import { useState, useEffect } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import { IconShield, IconSearch } from '../../components/shared/icons';
import { EmptyState } from '../../components/shared/EmptyState';
import { supabase } from '../../lib/supabase';

const inputClass =
  'w-full rounded-full border px-4 py-2.5 text-xs bg-[#EEEEEE] text-[var(--ink)] placeholder:text-[#24252c]/40 focus:outline-none focus:border-[#1090F8] border-transparent transition-colors';

interface GearItem {
  name: string;       // raw item label (with qty prefix stripped)
  rawName: string;    // original label as stored
  qty: number;        // parsed quantity (e.g. 2 for "2x")
  serialIds: string[]; // assigned serial IDs (length = qty or pool size)
  isAddon: boolean;
}

interface BookingEquipment {
  bookingRef: string;
  customerName: string;
  packageName: string;
  packageTag: string;
  eventDate: string;
  eventDateRaw: string;
  eventType: string;
  venue: string;
  paymentStatus: string;
  gear: GearItem[]; // merged inclusions + addons with serials
}

const STATUS_COLORS: Record<string, string> = {
  paid: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  confirmed: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  pending: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  cancelled: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
};

const STATUS_LABEL: Record<string, string> = {
  paid: 'Confirmed',
  confirmed: 'Confirmed',
  pending: 'Pending',
  cancelled: 'Cancelled',
};

// Deterministic-but-spread hash: seeds with bookingRef + item name + itemIndex
// so the same booking always gets the same serials, but different items/bookings rotate
function seededIndex(seed: string, len: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % len;
}

// Fuzzy match: check if a model name is relevant to a gear item label
function fuzzyMatch(itemLabel: string, modelName: string): boolean {
  const norm = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
  const labelWords = norm(itemLabel).split(' ').filter((w) => w.length > 2);
  const modelNorm = norm(modelName);
  const matches = labelWords.filter((w) => modelNorm.includes(w));
  return matches.length >= Math.max(1, Math.floor(labelWords.length * 0.4));
}

export default function UnitAssignmentPage({ go }: { go: (p: Page) => void }) {
  const [bookingItems, setBookingItems] = useState<BookingEquipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [expandedRef, setExpandedRef] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        // 1. Fetch all non-cancelled bookings sorted by event date ascending
        const { data: bookings, error: bookingsError } = await supabase
          .from('bookings')
          .select(
            'id, paymongo_reference_number, customer_name, package_id, package_name, event_date, event_type, venue_address, payment_status, selected_addons'
          )
          .neq('payment_status', 'cancelled')
          .order('event_date', { ascending: true });

        if (bookingsError) throw bookingsError;

        // 2. Fetch all packages for inclusions/tag
        const { data: packages, error: packagesError } = await supabase
          .from('packages')
          .select('package_id, name, tag, inclusions, items');

        if (packagesError) throw packagesError;

        // 3. Fetch all physical units with model info
        const { data: physicalUnits, error: unitsError } = await supabase
          .from('physical_units')
          .select('serial_id, model_id, status, condition');

        if (unitsError) throw unitsError;

        // 4. Fetch equipment models for name lookup
        const { data: equipmentModels, error: modelsError } = await supabase
          .from('equipment_models')
          .select('model_id, name, category');

        if (modelsError) throw modelsError;

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

        // model_id -> { name, units: serial_id[] }
        const modelMap: Record<string, { name: string; serials: string[] }> = {};
        (equipmentModels || []).forEach((m: any) => {
          modelMap[m.model_id] = { name: m.name, serials: [] };
        });
        (physicalUnits || []).forEach((u: any) => {
          if (modelMap[u.model_id]) {
            modelMap[u.model_id].serials.push(u.serial_id);
          }
        });

        // Flatten: itemLabel -> list of available serial IDs
        // We'll fuzzy-match package inclusions/addon names to model names
        const allModelEntries = Object.values(modelMap); // { name, serials }[]

        // Parse quantity prefix from label, e.g. "2x Active PA" -> { qty: 2, label: "Active PA" }
        function parseQty(raw: string): { qty: number; label: string } {
          const m = raw.match(/^(\d+)\s*[xX]\s+(.+)$/);
          if (m) return { qty: parseInt(m[1], 10), label: m[2].trim() };
          return { qty: 1, label: raw.trim() };
        }

        // Resolve N unique serials for a given gear item using seeded rotation
        function resolveSerials(
          rawLabel: string,
          bookingRef: string,
          itemIndex: number
        ): { label: string; qty: number; serialIds: string[] } {
          const { qty, label } = parseQty(rawLabel);

          const matched = allModelEntries.filter((m) => fuzzyMatch(label, m.name));
          const allSerials = [...new Set(matched.flatMap((m) => m.serials))].sort();

          if (allSerials.length === 0) return { label, qty, serialIds: [] };

          // Pick `qty` unique serials by rotating through pool with seeded offsets
          const chosen: string[] = [];
          const used = new Set<string>();
          for (let k = 0; k < qty; k++) {
            const seed = `${bookingRef}::${label}::${itemIndex}::${k}`;
            let idx = seededIndex(seed, allSerials.length);
            // Walk forward until we find an unused serial (wrap around)
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

        // Map bookings to BookingEquipment
        const mapped: BookingEquipment[] = (bookings || []).map((b: any) => {
          const pkg = pkgMap[b.package_id] || { tag: 'Production Setup', inclusions: [] };
          const addons: string[] = Array.isArray(b.selected_addons) ? b.selected_addons : [];
          const bookingRef = b.paymongo_reference_number || `BNH-${b.id.slice(0, 8)}`;

          const inclusionGear: GearItem[] = pkg.inclusions.map((item, i) => {
            const { label, qty, serialIds } = resolveSerials(item, bookingRef, i);
            return { name: label, rawName: item, qty, serialIds, isAddon: false };
          });

          const addonGear: GearItem[] = addons.map((addon, i) => {
            const { label, qty, serialIds } = resolveSerials(addon, bookingRef, pkg.inclusions.length + i);
            return { name: label, rawName: addon, qty, serialIds, isAddon: true };
          });

          return {
            bookingRef,
            customerName: b.customer_name || 'Customer',
            packageName: b.package_name || 'Production Package',
            packageTag: pkg.tag,
            eventDate: b.event_date
              ? new Date(b.event_date).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })
              : '—',
            eventDateRaw: b.event_date || '',
            eventType: b.event_type || '',
            venue: b.venue_address || '—',
            paymentStatus: b.payment_status || 'pending',
            gear: [...inclusionGear, ...addonGear],
          };
        });

        setBookingItems(mapped);
      } catch (err) {
        console.error('Failed to fetch booking equipment data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const filtered = bookingItems.filter((b) => {
    const matchesStatus =
      statusFilter === 'All' ||
      (statusFilter === 'Confirmed' && (b.paymentStatus === 'paid' || b.paymentStatus === 'confirmed')) ||
      (statusFilter === 'Pending' && b.paymentStatus === 'pending');

    const q = search.toLowerCase();
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
          <MonoBadge icon={IconShield}>Equipment Planning</MonoBadge>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ink)] mt-1.5">
            Unit-Level Date Assignments
          </h1>
          <p className="text-xs text-[#24252c]/60 mt-1">
            Per-booking gear list with assigned serial unit IDs — including upcoming events.
          </p>
        </div>

        <button
          onClick={() => go('inventory-items')}
          className="bg-[var(--mist)] text-[var(--ink)] border border-[#24252c]/10 text-xs font-bold px-4 py-2.5 rounded-full hover:bg-[var(--ink)] hover:text-white transition-colors self-start sm:self-auto cursor-pointer"
        >
          View Equipment Catalog
        </button>
      </div>

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

            return (
              <div
                key={b.bookingRef}
                className="bg-white rounded-2xl border border-[#24252c]/[0.08] shadow-sm overflow-hidden"
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
                    {isPast && (
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#24252c]/10 text-[#24252c]/50 border border-[#24252c]/10 uppercase tracking-wider">
                        Past Event
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
                        {b.gear.reduce((sum, g) => sum + g.qty, 0)} unit{b.gear.reduce((sum, g) => sum + g.qty, 0) !== 1 ? 's' : ''}
                      </span>
                      <span className="text-[#24252c]/40 font-bold text-sm">{isExpanded ? '▲' : '▼'}</span>
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
                                <th className="py-2 px-3 font-semibold text-left w-1/2">Assigned Serial IDs</th>
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
                                      <div className="flex flex-wrap gap-1">
                                        {g.serialIds.map((sid, si) => (
                                          <span
                                            key={si}
                                            className="font-mono font-bold text-[10px] text-[#1090F8] bg-[#1090F8]/8 px-2 py-0.5 rounded-lg border border-[#1090F8]/15"
                                          >
                                            {sid}
                                          </span>
                                        ))}
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
                                <th className="py-2 px-3 font-semibold text-left w-1/2">Assigned Serial IDs</th>
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
                                      <div className="flex flex-wrap gap-1">
                                        {g.serialIds.map((sid, si) => (
                                          <span
                                            key={si}
                                            className="font-mono font-bold text-[10px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded-lg border border-amber-200"
                                          >
                                            {sid}
                                          </span>
                                        ))}
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

                    {b.gear.length === 0 && (
                      <p className="text-xs text-[#24252c]/40 italic">
                        No gear inclusions found for this package.
                      </p>
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
