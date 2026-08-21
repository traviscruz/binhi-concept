import { useState, useEffect } from 'react';

import type { Page } from '../../types';
import { FEATURED_PACKAGES, type PackageData } from '../../data/packages';
import { MonoBadge } from '../../components/shared/Badges';
import { PhotoCarousel } from '../../components/shared/PhotoCarousel';
import { IconArrow, IconCheck, IconTicket, IconHeart, IconX } from '../../components/shared/icons';
import { ModalOverlay } from '../../components/shared/ModalOverlay';
import { supabase } from '../../lib/supabase';
import { fetchDbBookedDates, isPastDate, type DBBooking } from '../../utils/bookingService';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AddonModel {
  modelId: string;
  name: string;
  brand: string;
  category: string;
  rentalRate: number;
  availableCount: number;
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
          <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">
            {model.availableCount} unit{model.availableCount !== 1 ? 's' : ''} available
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
    return localStorage.getItem('binhi_selected_event_date') || '2026-09-14';
  });
  const [guestCount, setGuestCount] = useState(100);
  const [addonSelections, setAddonSelections] = useState<AddonSelection>({});
  const [dbBookings, setDbBookings] = useState<DBBooking[]>([]);

  useEffect(() => {
    async function loadBookings() {
      const data = await fetchDbBookedDates();
      setDbBookings(data);
    }
    loadBookings();
  }, []);

  // Live inventory add-ons state
  const [addonModels, setAddonModels] = useState<AddonModel[]>([]);
  const [addonsLoading, setAddonsLoading] = useState(true);
  const [showAddonModal, setShowAddonModal] = useState(false);

  const ADDON_PREVIEW_COUNT = 3;

  // ── Fetch available inventory from Supabase ───────────────────────────────
  useEffect(() => {
    const fetchAvailableInventory = async () => {
      setAddonsLoading(true);
      try {
        // Get all physical units that are available
        const { data: units, error } = await supabase
          .from('physical_units')
          .select(`
            model_id,
            status,
            equipment_models (
              model_id,
              name,
              brand,
              category,
              rental_rate
            )
          `)
          .eq('status', 'Available in Warehouse');

        if (error) throw error;

        // Group by model_id and count available units
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
            };
          }
          modelMap[mid].availableCount += 1;
        });

        // ── Triple-check: remove models already fully used by this package ──
        // The package inclusions list strings like "2x Active PA Speakers".
        // We fuzzy-match each inclusion label to equipment model names.
        // For each matched model, we subtract the inclusion's quantity from
        // availableCount. If it reaches 0 or below, the model is hidden from add-ons.
        const packageInclusions: string[] = Array.isArray(pkg.inclusions) ? pkg.inclusions : [];

        function normStr(s: string) {
          return s.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
        }

        function inclusionFuzzyMatch(inclusionLabel: string, modelName: string): boolean {
          // Strip leading quantity prefix (e.g. "2x")
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

        packageInclusions.forEach((inclusion) => {
          const claimedQty = parseQtyPrefix(inclusion);
          Object.values(modelMap).forEach((model) => {
            if (inclusionFuzzyMatch(inclusion, model.name)) {
              model.availableCount = Math.max(0, model.availableCount - claimedQty);
            }
          });
        });

        // Remove models with 0 available units after package deduction
        const afterDeduction = Object.values(modelMap).filter((m) => m.availableCount > 0);

        // Sort alphabetically by name
        const sorted = afterDeduction.sort((a, b) => a.name.localeCompare(b.name));

        setAddonModels(sorted);
      } catch (err) {
        console.error('Failed to fetch available inventory for add-ons:', err);
        setAddonModels([]);
      } finally {
        setAddonsLoading(false);
      }
    };

    fetchAvailableInventory();
  }, [pkg.id]);  // re-fetch if package changes

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
  };

  const getQty = (modelId: string) => addonSelections[modelId] ?? 0;

  // ── Totals ────────────────────────────────────────────────────────────────
  const addonsTotal = addonModels.reduce((sum, m) => {
    const qty = getQty(m.modelId);
    return sum + qty * m.rentalRate;
  }, 0);

  const totalPrice = pkg.rawPrice + addonsTotal;

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
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-[#1090F8] text-white flex items-center justify-center text-sm">✓</span>
                Package Equipment Inclusions
              </h3>
              <div className="space-y-3">
                {pkg.inclusions.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-white rounded-xl border border-[#24252c]/[0.05]">
                    <IconCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <span className="text-sm font-medium text-[var(--ink)] leading-snug">{item}</span>
                  </div>
                ))}
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
                <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50 ml-1 block mb-1">
                  Event Date
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    localStorage.setItem('binhi_selected_event_date', e.target.value);
                  }}
                  className={`w-full rounded-full border px-4 py-3 text-sm focus:outline-none ${
                    isPastDate(selectedDate) || dbBookings.some((b) => b.event_date === selectedDate)
                      ? 'border-rose-400 bg-rose-50 text-rose-800 font-bold'
                      : 'border-transparent bg-white text-[var(--ink)] focus:border-[#1090F8]'
                  }`}
                />
                {(isPastDate(selectedDate) || dbBookings.some((b) => b.event_date === selectedDate)) && (
                  <p className="text-[11px] font-bold text-rose-600 mt-1 ml-2">
                    {isPastDate(selectedDate)
                      ? 'Past Date: Please choose a future event date.'
                      : 'Reserved Date: This date is already booked in database.'}
                  </p>
                )}
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
              <div className="pt-4 border-t border-[#24252c]/[0.08] mb-5">
                <div className="flex items-center justify-between text-xs text-[#24252c]/50 mb-1">
                  <span>Base Package Rate</span>
                  <span>{pkg.price}</span>
                </div>
                {addonsTotal > 0 && (
                  <div className="flex items-center justify-between text-xs text-[#24252c]/50 mb-1">
                    <span>Add-ons Total</span>
                    <span>+₱{addonsTotal.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-base font-extrabold text-[var(--ink)] mt-2 pt-2 border-t border-[#24252c]/[0.06]">
                  <span>Total Calculated Rate</span>
                  <span className="text-2xl text-[#1090F8]">₱{totalPrice.toLocaleString()}</span>
                </div>
              </div>

              <button
                onClick={() => startBooking(pkg.id, selectedDate, guestCount, selectedAddonStrings)}
                className="w-full bg-[var(--ink)] text-white text-sm font-semibold py-4 rounded-full hover:bg-[var(--ink-soft)] transition-colors inline-flex items-center justify-center gap-2 shadow-md"
              >
                Proceed to Book This Setup <IconArrow className="w-4 h-4" />
              </button>

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
      </div>
    </section>
  );
}