import { useState, useEffect, useMemo } from 'react';

import type { Page } from '../../types';
import { FEATURED_PACKAGES, type PackageData } from '../../data/packages';
import { MonoBadge } from '../../components/shared/Badges';
import { PhotoCarousel } from '../../components/shared/PhotoCarousel';
import { IconArrow, IconCheck, IconTicket, IconHeart, IconX, IconShield } from '../../components/shared/icons';
import { ModalOverlay } from '../../components/shared/ModalOverlay';
import { PackageReviewsSection } from '../../components/shared/PackageReviewsSection';
import { CrossSellPromotions, generateSmartAddonBundles, type CrossSellBundle } from '../../components/shared/CrossSellPromotions';
import { supabase } from '../../lib/supabase';
import { fetchDbBookedDates, isPastDate, getDefaultEventDate, getEarliestAvailableDate, type DBBooking } from '../../utils/bookingService';
import {
  fetchBookingSettings,
  fetchScheduleOverrides,
  getDayAvailabilityStatus,
  type BookingSettings,
  type ScheduleOverride,
  DEFAULT_BOOKING_SETTINGS,
} from '../../utils/bookingEngine';
import { fetchCrewAvailabilityRecords } from '../../utils/crewAvailabilityService';
import { AvailabilityDatePicker } from '../../components/shared/AvailabilityDatePicker';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AddonModel {
  modelId: string;
  name: string;
  brand: string;
  category: string;
  rentalRate: number;
  availableCount: number;
  underRepairCount: number;
}

interface AddonSelection {
  [modelId: string]: number; // qty selected per model
}

// ─── AddonCard subcomponent ──────────────────────────────────────────────────

function AddonCard({
  model,
  qty,
  isSelected,
  setQty,
}: {
  model: AddonModel;
  qty: number;
  isSelected: boolean;
  setQty: (modelId: string, qty: number) => void;
}) {
  return (
    <div
      className={`p-3 rounded-xl border text-xs transition-all ${
        isSelected ? 'bg-white border-[#1090F8] shadow-sm' : 'bg-white/60 border-[#24252c]/[0.05]'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-[var(--ink)] truncate leading-tight">{model.name}</div>
          <div className="text-[10px] text-[#24252c]/50 mt-0.5">{model.brand} · {model.category}</div>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span className="text-[10px] text-emerald-600 font-semibold">
              {model.availableCount} unit{model.availableCount !== 1 ? 's' : ''} available
            </span>
            {model.underRepairCount > 0 && (
              <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                {model.underRepairCount} in repair
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className="font-bold text-[#1090F8] whitespace-nowrap">
            +₱{model.rentalRate.toLocaleString()}<span className="font-normal text-[#24252c]/40">/day</span>
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setQty(model.modelId, qty - 1)}
              disabled={qty === 0}
              className="w-6 h-6 rounded-full bg-[var(--mist)] border border-[#24252c]/10 flex items-center justify-center font-bold text-sm hover:bg-[#1090F8]/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              −
            </button>
            <span className={`w-5 text-center font-bold text-sm ${isSelected ? 'text-[#1090F8]' : 'text-[#24252c]/40'}`}>
              {qty}
            </span>
            <button
              onClick={() => setQty(model.modelId, qty + 1)}
              disabled={qty >= model.availableCount}
              className="w-6 h-6 rounded-full bg-[var(--mist)] border border-[#24252c]/10 flex items-center justify-center font-bold text-sm hover:bg-[#1090F8]/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              +
            </button>
          </div>
        </div>
      </div>
      {isSelected && (
        <div className="mt-2 pt-2 border-t border-[#1090F8]/10 flex items-center justify-between">
          <span className="text-[#24252c]/50">{qty} × ₱{model.rentalRate.toLocaleString()}</span>
          <span className="font-bold text-[#1090F8]">₱{(qty * model.rentalRate).toLocaleString()}</span>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PackageDetailPage({
  packageId,
  go,
  startBooking,
  isCustomer,
  wishlistIds = [],
  toggleWishlist,
  packages = [],
}: {
  packageId: string;
  go: (p: Page) => void;
  startBooking: (id: string, date: string, guestCount: number, addons: string[]) => void;
  isCustomer?: boolean;
  wishlistIds?: string[];
  toggleWishlist?: (id: string) => void;
  packages?: PackageData[];
}) {
  const allPackages = packages && packages.length > 0 ? packages : FEATURED_PACKAGES;
  const pkg = allPackages.find((p) => p.id === packageId) || allPackages[0];

  const [selectedDate, setSelectedDate] = useState(() => {
    return getDefaultEventDate(localStorage.getItem('binhi_selected_event_date'));
  });
  const [guestCount, setGuestCount] = useState(100);
  const [addonSelections, setAddonSelections] = useState<AddonSelection>({});
  const [dbBookings, setDbBookings] = useState<DBBooking[]>([]);
  const [bookingSettings, setBookingSettings] = useState<BookingSettings>(DEFAULT_BOOKING_SETTINGS);
  const [scheduleOverrides, setScheduleOverrides] = useState<ScheduleOverride[]>([]);

  useEffect(() => {
    async function loadEngineData() {
      try {
        const [bookings, settings, overrides] = await Promise.all([
          fetchDbBookedDates(),
          fetchBookingSettings(),
          fetchScheduleOverrides(),
          fetchCrewAvailabilityRecords(),
        ]);
        setDbBookings(bookings);
        setBookingSettings(settings);
        setScheduleOverrides(overrides);

        const saved = localStorage.getItem('binhi_selected_event_date');
        const earliest = getEarliestAvailableDate(saved, bookings, settings, overrides);
        setSelectedDate(earliest);
        localStorage.setItem('binhi_selected_event_date', earliest);
      } catch (e) {
        console.warn('Failed loading engine data in PackageDetailPage:', e);
      }
    }
    loadEngineData();
  }, []);

  const [addonModels, setAddonModels] = useState<AddonModel[]>([]);
  const [addonsLoading, setAddonsLoading] = useState(true);
  const [showAddonModal, setShowAddonModal] = useState(false);
  const [totalMaintenanceDeduction, setTotalMaintenanceDeduction] = useState(0);
  const [inclusionsMaintenanceMap, setInclusionsMaintenanceMap] = useState<
    Record<string, { inRepairCount: number; deductedAmount: number; modelName: string }>
  >({});
  const [selectedBundleIds, setSelectedBundleIds] = useState<string[]>([]);

  const ADDON_PREVIEW_COUNT = 3;

  // ── Smart Dynamic Frequently Paired Bundles (Real DB Inventory Only) ───────
  const smartBundles = useMemo(() => {
    return generateSmartAddonBundles(addonModels);
  }, [addonModels]);

  // ── Fetch available inventory & compute maintenance deductions ──────────────
  useEffect(() => {
    const fetchAvailableInventory = async () => {
      setAddonsLoading(true);
      try {
        // Get all physical units across statuses to detect available & quarantined gear
        const { data: units, error } = await supabase
          .from('physical_units')
          .select(`
            model_id,
            status,
            condition,
            equipment_models (
              model_id,
              name,
              brand,
              category,
              rental_rate
            )
          `);

        if (error) throw error;

        // Group by model_id and count available vs under-repair units
        const modelMap: Record<string, AddonModel> = {};

        (units ?? []).forEach((unit: any) => {
          const em = unit.equipment_models;
          if (!em) return;
          const mid = em.model_id;
          if (!modelMap[mid]) {
            modelMap[mid] = {
              modelId: mid,
              name: em.name,
              brand: em.brand,
              category: em.category,
              rentalRate: Number(em.rental_rate ?? 0),
              availableCount: 0,
              underRepairCount: 0,
            };
          }
          if (unit.status === 'Available in Warehouse') {
            modelMap[mid].availableCount += 1;
          } else if (unit.status === 'Maintenance / Repair' || unit.condition === 'In Repair') {
            modelMap[mid].underRepairCount += 1;
          }
        });

        // ── Match Package Inclusions to compute automatic maintenance discount ──
        const packageInclusions: string[] = Array.isArray(pkg.inclusions) ? pkg.inclusions : [];

        function normStr(s: string) {
          return s.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
        }

        function inclusionFuzzyMatch(inclusionLabel: string, modelName: string): boolean {
          const stripped = inclusionLabel.replace(/^\d+\s*[xX]\s+/, '');
          const words = normStr(stripped).split(' ').filter((w) => w.length > 2);
          const normModel = normStr(modelName);
          const matched = words.filter((w) => normModel.includes(w));
          return matched.length >= Math.max(1, Math.floor(words.length * 0.4));
        }

        function parseQtyPrefix(label: string): number {
          const m = label.match(/^(\d+)\s*[xX]\s+/);
          return m ? parseInt(m[1], 10) : 1;
        }

        let totalDeduction = 0;
        const maintMap: Record<string, { inRepairCount: number; deductedAmount: number; modelName: string }> = {};

        packageInclusions.forEach((inclusion) => {
          const claimedQty = parseQtyPrefix(inclusion);
          let matchedModel: AddonModel | null = null;

          for (const model of Object.values(modelMap)) {
            if (inclusionFuzzyMatch(inclusion, model.name)) {
              matchedModel = model;
              // Deduct claimed units from add-on availability
              model.availableCount = Math.max(0, model.availableCount - claimedQty);
              break;
            }
          }

          // If matched model has units in repair / quarantine, calculate discount
          if (matchedModel && matchedModel.underRepairCount > 0) {
            const affectedUnits = Math.min(claimedQty, matchedModel.underRepairCount);
            const deduction = affectedUnits * matchedModel.rentalRate;
            if (deduction > 0) {
              maintMap[inclusion] = {
                inRepairCount: affectedUnits,
                deductedAmount: deduction,
                modelName: matchedModel.name,
              };
              totalDeduction += deduction;
            }
          }
        });

        setTotalMaintenanceDeduction(totalDeduction);
        setInclusionsMaintenanceMap(maintMap);

        // Remove models with 0 available units after package deduction
        const afterDeduction = Object.values(modelMap).filter((m) => m.availableCount > 0);
        const sorted = afterDeduction.sort((a, b) => a.name.localeCompare(b.name));

        setAddonModels(sorted);
      } catch (err) {
        console.error('Failed to fetch available inventory for add-ons:', err);
        setAddonModels([]);
        setTotalMaintenanceDeduction(0);
        setInclusionsMaintenanceMap({});
      } finally {
        setAddonsLoading(false);
      }
    };

    fetchAvailableInventory();
  }, [pkg.id]); // re-fetch if package changes

  // ── Quantity helpers ──────────────────────────────────────────────────────
  const setQty = (modelId: string, qty: number) => {
    setAddonSelections((prev) => {
      if (qty <= 0) {
        const next = { ...prev };
        delete next[modelId];
        return next;
      }
      return { ...prev, [modelId]: qty };
    });

    // Auto-update bundle selections if quantity is lowered below bundle requirement
    setSelectedBundleIds((prev) =>
      prev.filter((bId) => {
        const b = smartBundles.find((bundle) => bundle.id === bId);
        if (!b) return false;
        const bItem = b.items.find((it) => it.modelId === modelId);
        if (bItem && qty < bItem.qty) {
          return false;
        }
        return true;
      })
    );
  };

  const getQty = (modelId: string) => addonSelections[modelId] ?? 0;

  // ── Smart Bundle Toggle Handler ───────────────────────────────────────────
  const handleToggleBundle = (bundle: CrossSellBundle) => {
    const isSelected = selectedBundleIds.includes(bundle.id);
    if (isSelected) {
      // Remove bundle and zero out its items
      setSelectedBundleIds((prev) => prev.filter((id) => id !== bundle.id));
      setAddonSelections((prev) => {
        const next = { ...prev };
        bundle.items.forEach((item) => {
          delete next[item.modelId];
        });
        return next;
      });
    } else {
      // Select bundle and set item quantities
      setSelectedBundleIds((prev) => [...prev, bundle.id]);
      setAddonSelections((prev) => {
        const next = { ...prev };
        bundle.items.forEach((item) => {
          next[item.modelId] = Math.max(next[item.modelId] || 0, item.qty);
        });
        return next;
      });
    }
  };

  // ── Totals ────────────────────────────────────────────────────────────────
  const activeBundles = useMemo(() => {
    return smartBundles.filter((b) => selectedBundleIds.includes(b.id));
  }, [smartBundles, selectedBundleIds]);

  const totalBundleSavings = useMemo(() => {
    return activeBundles.reduce((sum, b) => sum + b.savings, 0);
  }, [activeBundles]);

  const rawAddonsTotal = addonModels.reduce((sum, m) => {
    const qty = getQty(m.modelId);
    return sum + qty * m.rentalRate;
  }, 0);

  const addonsTotal = Math.max(0, rawAddonsTotal - totalBundleSavings);
  const adjustedPackagePrice = Math.max(0, pkg.rawPrice - totalMaintenanceDeduction);
  const totalPrice = adjustedPackagePrice + addonsTotal;

  // ── Dynamic Sorting: Selected items float to top ──────────────────────────
  const displayAddonModels = [...addonModels].sort((a, b) => {
    const qtyA = getQty(a.modelId);
    const qtyB = getQty(b.modelId);
    if (qtyA > 0 && qtyB === 0) return -1;
    if (qtyA === 0 && qtyB > 0) return 1;
    return a.name.localeCompare(b.name);
  });

  // Build addon string array for startBooking callback
  const selectedAddonStrings = displayAddonModels
    .filter((m) => getQty(m.modelId) > 0)
    .map((m) => `${getQty(m.modelId)}x ${m.name} (+₱${(getQty(m.modelId) * m.rentalRate).toLocaleString()})`);

  const handleStartBookingWithDiscount = () => {
    try {
      localStorage.setItem('binhi_package_maintenance_deduction', String(totalMaintenanceDeduction));
    } catch (e) {}
    startBooking(pkg.id, selectedDate, guestCount, selectedAddonStrings);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <section className="pt-40 pb-24 px-6">
      <div className="max-w-5xl mx-auto">
        <button
          onClick={() => go('packages')}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#24252c]/60 hover:text-[var(--ink)] transition-colors mb-6"
        >
          ← Back to packages
        </button>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 pb-6 border-b border-[#24252c]/[0.08]">
          <div>
            <MonoBadge icon={IconTicket}>{pkg.tag}</MonoBadge>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mt-3">{pkg.name}</h1>
            <p className="text-[#24252c]/60 mt-2 text-base max-w-2xl">{pkg.desc}</p>
          </div>
          <div className="shrink-0 text-left md:text-right">
            <div className="text-xs text-[#24252c]/50 font-medium uppercase tracking-wider">Starting Package Rate</div>
            <div className="text-3xl font-extrabold text-[#1090F8] mt-1">{pkg.price}</div>
          </div>
        </div>

        <div className="mb-12">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-[#24252c]/50 mb-3 ml-1">
            Package Photo Gallery
          </h3>
          <PhotoCarousel photos={pkg.photos} mainImage={pkg.img} />
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* ── Left Column ── */}
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-[var(--mist)] rounded-[2rem] p-6 md:p-8 border border-[#24252c]/[0.06]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <span className="w-8 h-8 rounded-full bg-[#1090F8] text-white flex items-center justify-center">
                    <IconCheck className="w-4 h-4" />
                  </span>
                  Package Equipment Inclusions
                </h3>
                {totalMaintenanceDeduction > 0 && (
                  <span className="text-[11px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-3 py-1 rounded-full flex items-center gap-1">
                    <IconShield className="w-3 h-3 text-amber-800" />
                    <span>-₱{totalMaintenanceDeduction.toLocaleString()} Maintenance Discount</span>
                  </span>
                )}
              </div>

              {totalMaintenanceDeduction > 0 && (
                <div className="mb-4 p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                  <IconShield className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Quarantine / Maintenance Price Adjustment Applied</span>
                    <span className="text-[#24252c]/70 text-[11px]">
                      Some units in this package are currently in maintenance/repair. Available stock has been safely locked and the rental rate has been automatically deducted from your package total.
                    </span>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {pkg.inclusions.map((item, i) => {
                  const maintInfo = inclusionsMaintenanceMap[item];
                  return (
                    <div
                      key={i}
                      className={`flex items-start justify-between gap-3 p-3.5 rounded-xl border transition-colors ${
                        maintInfo
                          ? 'bg-amber-50/70 border-amber-200 shadow-sm'
                          : 'bg-white border-[#24252c]/[0.05]'
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <IconCheck
                          className={`w-5 h-5 shrink-0 mt-0.5 ${
                            maintInfo ? 'text-amber-600' : 'text-emerald-600'
                          }`}
                        />
                        <div>
                          <span className="text-sm font-medium text-[var(--ink)] leading-snug block">{item}</span>
                          {maintInfo && (
                            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-200 flex items-center gap-1">
                                <IconShield className="w-3 h-3 text-amber-800" />
                                <span>{maintInfo.inRepairCount} unit{maintInfo.inRepairCount !== 1 ? 's' : ''} in repair</span>
                              </span>
                              <span className="text-[10px] text-amber-700 font-semibold">
                                (-₱{maintInfo.deductedAmount.toLocaleString()} deducted)
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {maintInfo && (
                        <span className="shrink-0 text-xs font-bold text-amber-700 bg-white border border-amber-200 px-2.5 py-1 rounded-lg">
                          -₱{maintInfo.deductedAmount.toLocaleString()}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-[2rem] p-6 md:p-8 border border-[#24252c]/[0.08]">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-extrabold text-[var(--ink)]">Recommended For What Events</h3>
                  <p className="text-xs text-[#24252c]/50 mt-1">Tailored acoustic, lighting & visual staging for specific event formats.</p>
                </div>
                <span className="text-xs font-semibold text-[#1090F8] bg-[#1090F8]/10 px-3 py-1.5 rounded-full">
                  Ideal Fits
                </span>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                {pkg.recommendedFor.map((evt, i) => (
                  <div
                    key={i}
                    className="group p-5 rounded-2xl bg-[var(--mist)] border border-[#24252c]/[0.04] hover:border-[#1090F8]/40 hover:bg-white hover:shadow-md transition-all duration-300 flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="w-8 h-8 rounded-xl bg-white text-[#1090F8] font-extrabold text-xs flex items-center justify-center shadow-sm group-hover:bg-[#1090F8] group-hover:text-white transition-colors">
                        0{i + 1}
                      </span>
                      <span className="text-[11px] font-semibold text-[#24252c]/40 uppercase tracking-wider">
                        Matched Setup
                      </span>
                    </div>

                    <h4 className="font-bold text-base text-[var(--ink)] group-hover:text-[#1090F8] transition-colors leading-snug">
                      {evt}
                    </h4>

                    <div className="mt-4 pt-3 border-t border-[#24252c]/[0.06] flex items-center gap-2 text-xs text-[#24252c]/60">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>Full Sound, Lighting & Crew Included</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[var(--ink)] text-white rounded-[2rem] p-6 md:p-8">
              <h3 className="text-xl font-bold mb-4">Technical Specs & Requirements</h3>
              <div className="grid sm:grid-cols-2 gap-4 text-center">
                <div className="bg-white/10 rounded-xl p-4">
                  <div className="text-xs text-white/50 uppercase tracking-wider">Setup Time</div>
                  <div className="text-sm font-bold mt-1">{pkg.specs?.setupTime || '2.5 Hours'}</div>
                </div>
                <div className="bg-white/10 rounded-xl p-4">
                  <div className="text-xs text-white/50 uppercase tracking-wider">Crew Size</div>
                  <div className="text-sm font-bold mt-1">{pkg.specs?.crewSize || '3 Technicians'}</div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Right Sidebar ── */}
          <div className="lg:col-span-1">
            <div className="sticky top-28 bg-[var(--mist)] rounded-[2rem] p-6 border border-[#24252c]/[0.08] shadow-sm">
              <h3 className="text-lg font-bold mb-4">Pick Your Date & Customize</h3>

              <div className="mb-4">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50 block ml-1 mb-1">
                  Event Date
                </label>
                <AvailabilityDatePicker
                  selectedDate={selectedDate}
                  onChange={(d) => {
                    setSelectedDate(d);
                    localStorage.setItem('binhi_selected_event_date', d);
                  }}
                  placeholder="Select Event Date"
                  showAvailabilityBadge={false}
                />
                {isPastDate(selectedDate) ? (
                  <p className="text-[11px] font-bold text-rose-600 mt-1 ml-2">
                    Past Date: Please choose a future event date.
                  </p>
                ) : getDayAvailabilityStatus(selectedDate, dbBookings, bookingSettings, scheduleOverrides).status === 'fully_booked' ? (
                  <p className="text-[11px] font-bold text-rose-600 mt-1 ml-2">
                    Reserved Date: All available operational windows are booked.
                  </p>
                ) : getDayAvailabilityStatus(selectedDate, dbBookings, bookingSettings, scheduleOverrides).status === 'closed' ? (
                  <p className="text-[11px] font-bold text-rose-600 mt-1 ml-2">
                    No bookings allowed on this date (Crew technician is off-duty / on leave). Please select another date.
                  </p>
                ) : getDayAvailabilityStatus(selectedDate, dbBookings, bookingSettings, scheduleOverrides).status === 'slots_available' ? (
                  <p className="text-[11px] font-bold text-amber-700 mt-1 ml-2 flex items-center gap-1">
                    <IconCheck className="w-3.5 h-3.5 text-amber-600 inline shrink-0" />
                    <span>Multiple slots available! Exact timings validated during checkout.</span>
                  </p>
                ) : null}
              </div>

              <div className="mb-5">
                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[#24252c]/50 ml-1 mb-1">
                  <span>Guest Count</span>
                  <span className="text-[#1090F8] font-bold">{guestCount} Guests</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="400"
                  value={guestCount}
                  onChange={(e) => setGuestCount(Number(e.target.value))}
                  className="w-full accent-[#1090F8]"
                />
              </div>

              {/* ── Optional Equipment Add-ons ── */}
              <div className="mb-6">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50 ml-1 block mb-2">
                  Optional Equipment Add-ons
                </label>

                {/* Smart Frequently Paired Upgrades (Bundle & Save) */}
                {!addonsLoading && (
                  <CrossSellPromotions
                    bundles={smartBundles}
                    selectedBundleIds={selectedBundleIds}
                    onToggleBundle={handleToggleBundle}
                    compact={true}
                  />
                )}

                {/* Loading skeleton */}
                {addonsLoading && (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-12 bg-white/60 rounded-xl animate-pulse" />
                    ))}
                  </div>
                )}

                {/* Empty */}
                {!addonsLoading && addonModels.length === 0 && (
                  <div className="p-4 rounded-xl bg-white/60 border border-[#24252c]/[0.05] text-center">
                    <p className="text-xs text-[#24252c]/50 font-medium">
                      No additional equipment available right now.
                    </p>
                  </div>
                )}

                {/* Preview: first 3 items */}
                {!addonsLoading && displayAddonModels.length > 0 && (
                  <>
                    <div className="space-y-2">
                      {displayAddonModels.slice(0, ADDON_PREVIEW_COUNT).map((model) => {
                        const qty = getQty(model.modelId);
                        const isSelected = qty > 0;
                        return <AddonCard key={model.modelId} model={model} qty={qty} isSelected={isSelected} setQty={setQty} />;
                      })}
                    </div>

                    {/* Browse all button */}
                    {displayAddonModels.length > ADDON_PREVIEW_COUNT && (
                      <button
                        onClick={() => setShowAddonModal(true)}
                        className="mt-3 w-full bg-white border border-[#24252c]/10 hover:border-[#1090F8]/40 hover:bg-[#1090F8]/5 text-xs font-semibold text-[#24252c]/60 hover:text-[#1090F8] py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <span>Browse all {displayAddonModels.length} available items</span>
                        <span className="text-base leading-none">›</span>
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* ── Add-ons Full Modal ── */}
              <ModalOverlay isOpen={showAddonModal} onClose={() => setShowAddonModal(false)}>
                <div className="bg-white rounded-[2.5rem] p-6 md:p-8 max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-[#24252c]/10">

                  {/* Modal Header */}
                  <div className="flex items-center justify-between mb-5 pb-4 border-b border-[#24252c]/[0.08]">
                    <div>
                      <h3 className="text-lg font-extrabold text-[var(--ink)]">Equipment Add-ons</h3>
                      <p className="text-xs text-[#24252c]/50 mt-0.5">{displayAddonModels.length} items available to add to your package</p>
                    </div>
                    <button
                      onClick={() => setShowAddonModal(false)}
                      className="text-[#24252c]/40 hover:text-[var(--ink)] p-1.5 rounded-full hover:bg-[var(--mist)] transition-colors cursor-pointer"
                    >
                      <IconX className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Smart Frequently Paired Upgrades inside Modal */}
                  {!addonsLoading && smartBundles.length > 0 && (
                    <div className="mb-4">
                      <CrossSellPromotions
                        bundles={smartBundles}
                        selectedBundleIds={selectedBundleIds}
                        onToggleBundle={handleToggleBundle}
                        compact={false}
                      />
                    </div>
                  )}

                  {/* Selected summary bar */}
                  {Object.keys(addonSelections).length > 0 && (
                    <div className="mb-4 px-3 py-2 bg-[#1090F8]/5 border border-[#1090F8]/15 rounded-xl flex items-center justify-between">
                      <span className="text-xs font-semibold text-[#1090F8]">
                        {Object.values(addonSelections).reduce((a, b) => a + b, 0)} item{Object.values(addonSelections).reduce((a, b) => a + b, 0) !== 1 ? 's' : ''} selected
                      </span>
                      <span className="text-xs font-bold text-[#1090F8]">+₱{addonsTotal.toLocaleString()}</span>
                    </div>
                  )}

                  {/* Full scrollable list */}
                  <div className="overflow-y-auto flex-1 space-y-2 pr-0.5">
                    {displayAddonModels.map((model) => {
                      const qty = getQty(model.modelId);
                      const isSelected = qty > 0;
                      return <AddonCard key={model.modelId} model={model} qty={qty} isSelected={isSelected} setQty={setQty} />;
                    })}
                  </div>

                  {/* Modal footer */}
                  <div className="mt-5 pt-4 border-t border-[#24252c]/[0.08]">
                    <button
                      onClick={() => setShowAddonModal(false)}
                      className="w-full bg-[var(--ink)] text-white text-sm font-semibold py-3 rounded-full hover:bg-[var(--ink-soft)] transition-colors cursor-pointer"
                    >
                      Done — Add to Package
                    </button>
                  </div>
                </div>
              </ModalOverlay>

              {/* ── Price Summary ── */}
              <div className="pt-4 border-t border-[#24252c]/[0.08] mb-5 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-[#24252c]/50">
                  <span>Standard Package Base Rate</span>
                  <span className={totalMaintenanceDeduction > 0 ? 'line-through text-[#24252c]/40' : ''}>{pkg.price}</span>
                </div>

                {totalMaintenanceDeduction > 0 && (
                  <>
                    <div className="flex items-center justify-between text-xs text-amber-700 font-medium bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200">
                      <span className="flex items-center gap-1.5">
                        <IconShield className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                        <span>Maintenance / Quarantine Discount</span>
                      </span>
                      <span className="font-bold">-₱{totalMaintenanceDeduction.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-[var(--ink)] font-semibold">
                      <span>Adjusted Package Base</span>
                      <span className="text-emerald-700">₱{adjustedPackagePrice.toLocaleString()}</span>
                    </div>
                  </>
                )}

                {addonsTotal > 0 && (
                  <div className="flex items-center justify-between text-xs text-[#24252c]/50">
                    <span>Optional Add-ons Total</span>
                    <span>+₱{rawAddonsTotal.toLocaleString()}</span>
                  </div>
                )}

                {totalBundleSavings > 0 && (
                  <div className="flex items-center justify-between text-xs text-emerald-700 font-medium bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-200">
                    <span className="flex items-center gap-1.5">
                      <IconCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Bundle &amp; Save Special Discount (20% Off)</span>
                    </span>
                    <span className="font-bold">-₱{totalBundleSavings.toLocaleString()}</span>
                  </div>
                )}

                <div className="flex items-center justify-between text-base font-extrabold text-[var(--ink)] pt-2 border-t border-[#24252c]/[0.06]">
                  <div>
                    <span>Total Calculated Rate</span>
                    {totalMaintenanceDeduction > 0 && (
                      <span className="block text-[10px] text-amber-600 font-medium">Includes quarantine discount</span>
                    )}
                  </div>
                  <span className="text-2xl text-[#1090F8]">₱{totalPrice.toLocaleString()}</span>
                </div>
              </div>

              {(() => {
                const dayStatus = getDayAvailabilityStatus(selectedDate, dbBookings, bookingSettings, scheduleOverrides);
                const isDateBlocked = isPastDate(selectedDate) || dayStatus.status === 'closed' || dayStatus.status === 'fully_booked';

                return (
                  <button
                    onClick={handleStartBookingWithDiscount}
                    disabled={isDateBlocked}
                    className={`w-full text-sm font-semibold py-4 rounded-full transition-all inline-flex items-center justify-center gap-2 shadow-md ${
                      isDateBlocked
                        ? 'bg-zinc-300 text-zinc-500 cursor-not-allowed opacity-60'
                        : 'bg-[var(--ink)] text-white hover:bg-[var(--ink-soft)] cursor-pointer'
                    }`}
                  >
                    {isDateBlocked ? 'Date Unavailable for Booking' : 'Proceed to Book This Setup'} <IconArrow className="w-4 h-4" />
                  </button>
                );
              })()}

              {isCustomer && toggleWishlist && (
                <button
                  type="button"
                  onClick={() => toggleWishlist?.(pkg.id)}
                  className={`w-full mt-2 border text-xs font-semibold py-3 rounded-full transition-all inline-flex items-center justify-center gap-2 shadow-sm ${
                    wishlistIds.includes(pkg.id)
                      ? 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100'
                      : 'bg-white text-[var(--ink)] border-[#24252c]/10 hover:bg-[var(--mist)]'
                  }`}
                >
                  <IconHeart className={`w-4 h-4 ${wishlistIds.includes(pkg.id) ? 'fill-rose-500 text-rose-500' : 'text-rose-500'}`} />
                  <span>{wishlistIds.includes(pkg.id) ? 'Remove from Wishlist' : 'Save to Wishlist'}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Per-Package Client Reviews Section */}
        <PackageReviewsSection
          packageName={pkg.name}
          packageId={pkg.id}
          go={go}
          isCustomer={isCustomer}
        />
      </div>
    </section>
  );
}