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
      className={`p-3.5 sm:p-4 rounded-2xl border text-xs transition-all ${
        isSelected ? 'bg-white border-[#1090F8] shadow-sm ring-1 ring-[#1090F8]/20' : 'bg-white/80 border-[#24252c]/[0.08] hover:border-[#24252c]/20 hover:bg-white'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-bold text-sm text-[var(--ink)] leading-snug">{model.name}</div>
          <div className="text-[11px] text-[#24252c]/60 mt-0.5">{model.brand} · {model.category}</div>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              {model.availableCount} unit{model.availableCount !== 1 ? 's' : ''} available
            </span>
            {model.underRepairCount > 0 && (
              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                {model.underRepairCount} in repair
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center sm:flex-col sm:items-end justify-between sm:justify-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#24252c]/5">
          <span className="font-extrabold text-sm text-[#1090F8] whitespace-nowrap">
            +₱{model.rentalRate.toLocaleString()}<span className="text-[10px] font-normal text-[#24252c]/40">/day</span>
          </span>
          <div className="flex items-center gap-1.5 bg-[var(--mist)] px-2 py-1 rounded-full border border-[#24252c]/10">
            <button
              type="button"
              onClick={() => setQty(model.modelId, qty - 1)}
              disabled={qty === 0}
              className="w-6 h-6 rounded-full bg-white text-[var(--ink)] border border-[#24252c]/10 flex items-center justify-center font-bold text-xs hover:bg-[#1090F8] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer shadow-2xs"
            >
              −
            </button>
            <span className={`w-6 text-center font-bold text-xs ${isSelected ? 'text-[#1090F8]' : 'text-[#24252c]/50'}`}>
              {qty}
            </span>
            <button
              type="button"
              onClick={() => setQty(model.modelId, qty + 1)}
              disabled={qty >= model.availableCount}
              className="w-6 h-6 rounded-full bg-white text-[var(--ink)] border border-[#24252c]/10 flex items-center justify-center font-bold text-xs hover:bg-[#1090F8] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer shadow-2xs"
            >
              +
            </button>
          </div>
        </div>
      </div>
      {isSelected && (
        <div className="mt-2.5 pt-2.5 border-t border-[#1090F8]/15 flex items-center justify-between text-xs">
          <span className="text-[#24252c]/60 font-medium">{qty} × ₱{model.rentalRate.toLocaleString()}</span>
          <span className="font-extrabold text-[#1090F8]">₱{(qty * model.rentalRate).toLocaleString()}</span>
        </div>
      )}
    </div>
  );
}

// ─── Package Inclusion Item Helper ──────────────────────────────────────────
export interface ParsedInclusion {
  id: string;
  originalText: string;
  displayName: string;
  originalQty: number;
  currentQty: number;
  isCoreEssential: boolean;
  unitRentalRate: number;
  smartDeductionRate: number;
  isRemoved: boolean;
}

function normStr(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseQtyPrefix(label: string): number {
  const m = label.match(/^(\d+)\s*[xX]\s+/);
  return m ? parseInt(m[1], 10) : 1;
}

function inclusionFuzzyMatch(inclusionLabel: string, modelName: string): boolean {
  const stripped = inclusionLabel.replace(/^\d+\s*[xX]\s+/, '');
  const words = normStr(stripped).split(' ').filter((w) => w.length > 2);
  const normModel = normStr(modelName);
  const matched = words.filter((w) => normModel.includes(w));
  return matched.length >= Math.max(1, Math.floor(words.length * 0.4));
}

function parseInclusionDetails(
  text: string,
  modelMap: Record<string, AddonModel>,
  customQtyMap: Record<number, number>,
  index: number
): ParsedInclusion {
  const norm = text.toLowerCase().trim();
  const originalQty = parseQtyPrefix(text);
  const displayName = text.replace(/^\d+\s*[xX]\s+/, '').trim();

  // Determine if core essential (backbone items that cannot be removed)
  const isCoreEssential = (
    norm.includes('load-in') ||
    norm.includes('technical crew') ||
    norm.includes('technician') ||
    norm.includes('director') ||
    norm.includes('soundcheck') ||
    norm.includes('mixing console') ||
    norm.includes('compact audio mixer') ||
    norm.includes('main pa') ||
    norm.includes('main speakers') ||
    norm.includes('line array system')
  );

  // Match with DB equipment model if available
  let matchedRate = 0;
  for (const model of Object.values(modelMap)) {
    if (inclusionFuzzyMatch(text, model.name)) {
      matchedRate = model.rentalRate;
      break;
    }
  }

  // Fallback realistic rental rate based on keyword
  if (matchedRate === 0) {
    if (norm.includes('subwoofer')) matchedRate = 1800;
    else if (norm.includes('moving head')) matchedRate = 1200;
    else if (norm.includes('fog') || norm.includes('smoke') || norm.includes('haze')) matchedRate = 1000;
    else if (norm.includes('wireless mic') || norm.includes('microphone')) matchedRate = 600;
    else if (norm.includes('par') || norm.includes('uplight')) matchedRate = 300;
    else if (norm.includes('monitor') || norm.includes('wedge')) matchedRate = 1000;
    else if (norm.includes('led wall')) matchedRate = 6000;
    else if (norm.includes('backline') || norm.includes('drum')) matchedRate = 2500;
    else matchedRate = 600;
  }

  // 50% Smart Bundle Deduction Credit (preserves package profit and crew overhead)
  const smartDeductionRate = Math.max(150, Math.round(matchedRate * 0.50));
  const currentQty = customQtyMap[index] !== undefined ? customQtyMap[index] : originalQty;

  return {
    id: `inc-${index}`,
    originalText: text,
    displayName,
    originalQty,
    currentQty,
    isCoreEssential,
    unitRentalRate: matchedRate,
    smartDeductionRate,
    isRemoved: currentQty === 0,
  };
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
  const [guestCount, setGuestCount] = useState(() => pkg.specs?.guestMin || 50);
  const [addonSelections, setAddonSelections] = useState<AddonSelection>({});
  const [dbBookings, setDbBookings] = useState<DBBooking[]>([]);
  const [bookingSettings, setBookingSettings] = useState<BookingSettings>(DEFAULT_BOOKING_SETTINGS);
  const [scheduleOverrides, setScheduleOverrides] = useState<ScheduleOverride[]>([]);

  useEffect(() => {
    if (pkg.specs?.guestMin) {
      setGuestCount(pkg.specs.guestMin);
    }
  }, [pkg.id, pkg.specs?.guestMin]);

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

  const [addonCategory, setAddonCategory] = useState('All');
  const [showAllAddons, setShowAllAddons] = useState(false);

  // ── Smart Dynamic Frequently Paired Bundles (Real DB Inventory Only) ───────
  const smartBundles = useMemo(() => {
    return generateSmartAddonBundles(addonModels, pkg.inclusions || []);
  }, [addonModels, pkg.inclusions]);

  // ── Fetch available inventory & compute maintenance deductions ──────────────
  useEffect(() => {
    const fetchAvailableInventory = async () => {
      setAddonsLoading(true);
      try {
        const [modelsRes, unitsRes] = await Promise.all([
          supabase.from('equipment_models').select('model_id, name, brand, category, rental_rate').order('name', { ascending: true }),
          supabase.from('physical_units').select('model_id, status, condition'),
        ]);

        const equipmentModels: any[] = modelsRes.data || [];
        const physicalUnits: any[] = unitsRes.data || [];

        const modelMap: Record<string, AddonModel> = {};

        equipmentModels.forEach((em: any) => {
          const mid = em.model_id;
          modelMap[mid] = {
            modelId: mid,
            name: em.name,
            brand: em.brand || 'BINHI',
            category: em.category || 'Production Gear',
            rentalRate: Number(em.rental_rate ?? 0),
            availableCount: 0,
            underRepairCount: 0,
          };
        });

        physicalUnits.forEach((unit: any) => {
          const mid = unit.model_id;
          if (!modelMap[mid]) return;
          if (
            unit.status === 'Available in Warehouse' &&
            unit.condition !== 'In Repair' &&
            unit.status !== 'Maintenance / Repair' &&
            unit.status !== 'Decommissioned / Inactive'
          ) {
            modelMap[mid].availableCount += 1;
          } else if (unit.status === 'Maintenance / Repair' || unit.condition === 'In Repair') {
            modelMap[mid].underRepairCount += 1;
          }
        });

        // Ensure available units fallback if table has equipment models
        Object.values(modelMap).forEach((m) => {
          if (m.availableCount === 0 && physicalUnits.length === 0) {
            m.availableCount = 4;
          }
        });

        const packageInclusions: string[] = Array.isArray(pkg.inclusions) ? pkg.inclusions : [];
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
        setModelMapState(modelMap);

        // Keep strictly ONLY models that have positive available count (> 0) and rental rate (> 0)
        const availableList = Object.values(modelMap).filter((m) => m.availableCount > 0 && m.rentalRate > 0);
        const sorted = availableList.sort((a, b) => a.name.localeCompare(b.name));

        setAddonModels(sorted);
      } catch (err) {
        console.error('Failed to fetch available inventory for add-ons:', err);
        setAddonModels([]);
        setTotalMaintenanceDeduction(0);
        setInclusionsMaintenanceMap({});
        setModelMapState({});
      } finally {
        setAddonsLoading(false);
      }
    };

    fetchAvailableInventory();
  }, [pkg.id]); // re-fetch if package changes

  const [modelMapState, setModelMapState] = useState<Record<string, AddonModel>>({});
  const [inclusionQtyMap, setInclusionQtyMap] = useState<Record<number, number>>({});

  useEffect(() => {
    setInclusionQtyMap({});
  }, [pkg.id]);

  // ── Inclusion Customization Handlers ──────────────────────────────────────
  const toggleInclusion = (idx: number, originalQty: number) => {
    setInclusionQtyMap((prev) => {
      const current = prev[idx] !== undefined ? prev[idx] : originalQty;
      return {
        ...prev,
        [idx]: current > 0 ? 0 : originalQty,
      };
    });
  };

  const updateInclusionQty = (idx: number, delta: number, maxQty: number) => {
    setInclusionQtyMap((prev) => {
      const current = prev[idx] !== undefined ? prev[idx] : maxQty;
      const next = Math.max(0, Math.min(maxQty, current + delta));
      return {
        ...prev,
        [idx]: next,
      };
    });
  };

  const resetInclusions = () => {
    setInclusionQtyMap({});
  };

  // ── Smart Customization Deduction Calculation ─────────────────────────────
  const parsedInclusions = useMemo(() => {
    return (pkg.inclusions || []).map((text, idx) =>
      parseInclusionDetails(text, modelMapState, inclusionQtyMap, idx)
    );
  }, [pkg.inclusions, modelMapState, inclusionQtyMap]);

  const rawCustomizationDeduction = useMemo(() => {
    return parsedInclusions.reduce((sum, item) => {
      const removedUnits = Math.max(0, item.originalQty - item.currentQty);
      return sum + removedUnits * item.smartDeductionRate;
    }, 0);
  }, [parsedInclusions]);

  // Protected Minimum Floor: max 35% deduction allowed to protect crew & base equipment overhead
  const maxAllowedCustomizationDeduction = Math.round(pkg.rawPrice * 0.35);
  const totalCustomizationDeduction = Math.min(rawCustomizationDeduction, maxAllowedCustomizationDeduction);
  const isFloorReached = rawCustomizationDeduction > maxAllowedCustomizationDeduction;

  const customizedItemsCount = parsedInclusions.filter((item) => item.currentQty < item.originalQty).length;

  // ── Quantity helpers ──────────────────────────────────────────────────────
  const setQty = (modelId: string, qty: number) => {
    const targetModel = modelMapState[modelId] || addonModels.find((m) => m.modelId === modelId);
    if (!targetModel || targetModel.availableCount <= 0) return;
    const clampedQty = Math.max(0, Math.min(targetModel.availableCount, qty));

    setAddonSelections((prev) => {
      if (clampedQty <= 0) {
        const next = { ...prev };
        delete next[modelId];
        return next;
      }
      return { ...prev, [modelId]: clampedQty };
    });

    // Auto-update bundle selections if quantity is lowered below bundle requirement
    setSelectedBundleIds((prev) =>
      prev.filter((bId) => {
        const b = smartBundles.find((bundle) => bundle.id === bId);
        if (!b) return false;
        const bItem = b.items.find((it) => it.modelId === modelId);
        if (bItem && clampedQty < bItem.qty) {
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
      // Guard: Ensure every item in bundle has sufficient positive available inventory
      const hasStock = bundle.items.every((item) => {
        const m = modelMapState[item.modelId] || addonModels.find((mod) => mod.modelId === item.modelId);
        return m && m.availableCount >= item.qty && m.availableCount > 0;
      });
      if (!hasStock) return;

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
    if (m.availableCount <= 0) return sum;
    const qty = getQty(m.modelId);
    return sum + qty * m.rentalRate;
  }, 0);

  const addonsTotal = Math.max(0, rawAddonsTotal - totalBundleSavings);
  const adjustedPackagePrice = Math.max(
    Math.round(pkg.rawPrice * 0.65),
    pkg.rawPrice - totalMaintenanceDeduction - totalCustomizationDeduction
  );
  const totalPrice = adjustedPackagePrice + addonsTotal;

  // ── Dynamic Sorting & Filtering: Selected items float to top ─────────────
  const displayAddonModels = useMemo(() => {
    return addonModels
      .filter((m) => m.availableCount > 0)
      .sort((a, b) => {
        const qtyA = getQty(a.modelId);
        const qtyB = getQty(b.modelId);
        if (qtyA > 0 && qtyB === 0) return -1;
        if (qtyA === 0 && qtyB > 0) return 1;
        return a.name.localeCompare(b.name);
      });
  }, [addonModels, addonSelections]);

  const filteredAddonModels = useMemo(() => {
    return displayAddonModels.filter((m) => {
      if (m.availableCount <= 0) return false;
      if (addonCategory === 'All') return true;
      const cat = (m.category || '').toLowerCase();
      const name = (m.name || '').toLowerCase();
      if (addonCategory === 'Sound') {
        return cat.includes('audio') || cat.includes('sound') || cat.includes('mic') || cat.includes('speaker') || cat.includes('mixer') || name.includes('mic') || name.includes('speaker') || name.includes('audio');
      }
      if (addonCategory === 'Lighting') {
        return cat.includes('light') || cat.includes('par') || cat.includes('beam') || cat.includes('moving') || name.includes('light') || name.includes('head') || name.includes('spot') || name.includes('par');
      }
      if (addonCategory === 'Special FX') {
        return cat.includes('effect') || cat.includes('fog') || cat.includes('smoke') || cat.includes('spark') || cat.includes('haze') || name.includes('fog') || name.includes('smoke') || name.includes('spark') || name.includes('bubble');
      }
      return true;
    });
  }, [displayAddonModels, addonCategory]);

  // Build addon string array for startBooking callback
  const selectedAddonStrings = displayAddonModels
    .filter((m) => getQty(m.modelId) > 0)
    .map((m) => `${getQty(m.modelId)}x ${m.name} (+₱${(getQty(m.modelId) * m.rentalRate).toLocaleString()})`);

  const handleStartBookingWithDiscount = () => {
    try {
      localStorage.setItem('binhi_package_maintenance_deduction', String(totalMaintenanceDeduction));
      localStorage.setItem('binhi_package_customization_deduction', String(totalCustomizationDeduction));
      localStorage.setItem('binhi_package_bundle_discount', String(totalBundleSavings));
      localStorage.setItem('binhi_package_active_bundles', JSON.stringify(activeBundles));
      localStorage.setItem('binhi_package_bundle_ids', JSON.stringify(selectedBundleIds));
      
      const customizedInclusionsList = parsedInclusions
        .filter((item) => item.currentQty > 0)
        .map((item) => item.currentQty === 1 ? item.displayName : `${item.currentQty}x ${item.displayName}`);
      
      localStorage.setItem('binhi_package_customized_inclusions', JSON.stringify(customizedInclusionsList));
    } catch (e) {}
    startBooking(pkg.id, selectedDate, guestCount, selectedAddonStrings);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <section className="pt-32 sm:pt-36 lg:pt-40 pb-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <button
          onClick={() => go('packages')}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#24252c]/60 hover:text-[var(--ink)] transition-colors mb-6 cursor-pointer"
        >
          ← Back to packages
        </button>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 pb-6 border-b border-[#24252c]/[0.08]">
          <div>
            <MonoBadge icon={IconTicket}>{pkg.tag}</MonoBadge>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight mt-3">{pkg.name}</h1>
            <p className="text-[#24252c]/60 mt-2 text-sm sm:text-base max-w-2xl">{pkg.desc}</p>
          </div>
          <div className="shrink-0 text-left md:text-right">
            <div className="text-xs text-[#24252c]/50 font-medium uppercase tracking-wider whitespace-nowrap">Starting Package Rate</div>
            <div className="text-3xl sm:text-4xl font-extrabold text-[#1090F8] mt-1 whitespace-nowrap">{pkg.price}</div>
          </div>
        </div>

        <div className="mb-12">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-[#24252c]/50 mb-3 ml-1">
            Package Photo Gallery
          </h3>
          <PhotoCarousel photos={pkg.photos} mainImage={pkg.img} />
        </div>

        <div className="grid lg:grid-cols-12 gap-8 lg:gap-10">
          {/* ── Left Column (Package Specs & Customization) ── */}
          <div className="lg:col-span-7 xl:col-span-7 space-y-8">
            <div className="bg-[var(--mist)] rounded-[2rem] p-6 md:p-8 border border-[#24252c]/[0.06]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-xl font-bold flex items-center gap-2 text-[var(--ink)]">
                    <span className="w-8 h-8 rounded-full bg-[#1090F8] text-white flex items-center justify-center shrink-0">
                      <IconCheck className="w-4 h-4" />
                    </span>
                    <span>Package Equipment Inclusions</span>
                  </h3>
                  <p className="text-xs text-[#24252c]/60 mt-1">
                    Toggle or lessen quantities for gear you don't need to receive smart bundle credits (50% credit with protected base overhead).
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-nowrap shrink-0">
                  {customizedItemsCount > 0 && (
                    <button
                      type="button"
                      onClick={resetInclusions}
                      className="text-xs font-bold text-[#1090F8] hover:underline bg-white border border-[#1090F8]/20 px-3 py-1.5 rounded-full shadow-2xs cursor-pointer whitespace-nowrap shrink-0"
                    >
                      ↺ Reset Inclusions
                    </button>
                  )}
                  {totalMaintenanceDeduction > 0 && (
                    <span className="text-[11px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-3 py-1 rounded-full flex items-center gap-1 whitespace-nowrap shrink-0">
                      <IconShield className="w-3 h-3 text-amber-800 shrink-0" />
                      <span>-₱{totalMaintenanceDeduction.toLocaleString()} Maintenance Discount</span>
                    </span>
                  )}
                </div>
              </div>

              {totalCustomizationDeduction > 0 && (
                <div className="mb-4 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <IconCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>
                      <strong className="font-bold">Smart Customization Deduction:</strong> {customizedItemsCount} item{customizedItemsCount > 1 ? 's' : ''} adjusted.
                      {isFloorReached && ' (Protected base production floor reached).'}
                    </span>
                  </div>
                  <span className="font-extrabold text-sm text-emerald-800 whitespace-nowrap shrink-0">
                    -₱{totalCustomizationDeduction.toLocaleString()}
                  </span>
                </div>
              )}

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
                {parsedInclusions.map((item, i) => {
                  const maintInfo = inclusionsMaintenanceMap[item.originalText];
                  return (
                    <div
                      key={item.id}
                      className={`p-3.5 rounded-2xl border transition-all ${
                        item.isRemoved
                          ? 'bg-zinc-100/90 border-zinc-200 opacity-70'
                          : item.currentQty < item.originalQty
                          ? 'bg-amber-50/70 border-amber-200 shadow-2xs'
                          : maintInfo
                          ? 'bg-amber-50/70 border-amber-200 shadow-sm'
                          : 'bg-white border-[#24252c]/[0.06] shadow-2xs'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {item.isCoreEssential ? (
                            <div className="w-5 h-5 rounded-full bg-zinc-200 text-zinc-600 flex items-center justify-center shrink-0" title="Core System Backbone — Required for Event Operations">
                              <span className="text-[10px] font-bold">🔒</span>
                            </div>
                          ) : (
                            <input
                              type="checkbox"
                              checked={item.currentQty > 0}
                              onChange={() => toggleInclusion(i, item.originalQty)}
                              className="w-5 h-5 accent-[#1090F8] rounded cursor-pointer shrink-0"
                            />
                          )}
                          <div className="min-w-0">
                            <div className={`text-sm font-bold truncate leading-tight ${item.isRemoved ? 'line-through text-[#24252c]/40' : 'text-[var(--ink)]'}`}>
                              {item.currentQty > 1 && !item.isRemoved ? `${item.currentQty}x ` : ''}{item.displayName}
                            </div>
                            <div className="text-[10px] text-[#24252c]/60 flex items-center gap-2 mt-0.5 flex-wrap">
                              {item.isCoreEssential ? (
                                <span className="font-bold text-zinc-600 bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-200 whitespace-nowrap shrink-0">
                                  Core Backbone (Essential System)
                                </span>
                              ) : item.isRemoved ? (
                                <span className="font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200 whitespace-nowrap shrink-0">
                                  Removed (-₱{(item.originalQty * item.smartDeductionRate).toLocaleString()} Smart Credit)
                                </span>
                              ) : item.currentQty < item.originalQty ? (
                                <span className="font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200 whitespace-nowrap shrink-0">
                                  Reduced to {item.currentQty}x (-₱{((item.originalQty - item.currentQty) * item.smartDeductionRate).toLocaleString()} Smart Credit)
                                </span>
                              ) : (
                                <span className="text-emerald-700 font-semibold whitespace-nowrap shrink-0">Included in Standard Package</span>
                              )}

                              {maintInfo && (
                                <span className="font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200 whitespace-nowrap shrink-0">
                                  {maintInfo.inRepairCount} in repair (-₱{maintInfo.deductedAmount.toLocaleString()})
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Stepper for customizable items with quantity > 1 */}
                        {!item.isCoreEssential && item.originalQty > 1 && (
                          <div className="flex items-center gap-1.5 shrink-0 bg-[var(--mist)] px-2.5 py-1 rounded-full border border-[#24252c]/10">
                            <button
                              type="button"
                              disabled={item.currentQty === 0}
                              onClick={() => updateInclusionQty(i, -1, item.originalQty)}
                              className="w-5 h-5 rounded-full bg-white text-[var(--ink)] font-bold text-xs flex items-center justify-center hover:bg-[#1090F8] hover:text-white transition-colors shadow-2xs cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              −
                            </button>
                            <span className="font-mono font-extrabold text-xs text-[var(--ink)] min-w-[24px] text-center whitespace-nowrap">
                              {item.currentQty}/{item.originalQty}
                            </span>
                            <button
                              type="button"
                              disabled={item.currentQty >= item.originalQty}
                              onClick={() => updateInclusionQty(i, 1, item.originalQty)}
                              className="w-5 h-5 rounded-full bg-white text-[var(--ink)] font-bold text-xs flex items-center justify-center hover:bg-[#1090F8] hover:text-white transition-colors shadow-2xs cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              +
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-[2rem] p-6 md:p-8 border border-[#24252c]/[0.08] space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-extrabold text-[var(--ink)]">Recommended For What Events</h3>
                  <p className="text-xs text-[#24252c]/50 mt-1">Tailored acoustic, lighting & visual staging for specific venue sizes & event formats.</p>
                </div>
                <span className="text-xs font-semibold text-[#1090F8] bg-[#1090F8]/10 px-3 py-1.5 rounded-full self-start sm:self-auto whitespace-nowrap shrink-0">
                  Ideal Capacity Fit
                </span>
              </div>

              {/* Recommended Venue Size & Audience Footprint Card */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-[var(--mist)] border border-[#24252c]/[0.06]">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#24252c]/50 block">Recommended Venue Size</span>
                  <div className="text-sm font-extrabold text-[var(--ink)] mt-0.5 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#1090F8]" />
                    <span>{pkg.specs?.venueSize || '50 – 150 sq.m'}</span>
                  </div>
                  <span className="text-[10px] text-[#24252c]/50">Floor space coverage</span>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-[#24252c]/50 block">Target Crowd Capacity</span>
                  <div className="text-sm font-extrabold text-[var(--ink)] mt-0.5 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>{pkg.specs?.guestCapacity || '50 – 150 Guests'}</span>
                  </div>
                  <span className="text-[10px] text-[#24252c]/50">Ideal listening audience</span>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-[#24252c]/50 block">Acoustic Sound Field</span>
                  <div className="text-xs font-bold text-[var(--ink)] mt-0.5 truncate" title={pkg.specs?.acousticCoverage || 'Full Sound Reinforcement'}>
                    {pkg.specs?.acousticCoverage || 'Full Sound Reinforcement'}
                  </div>
                  <span className="text-[10px] text-[#24252c]/50">Calibrated SPL throw</span>
                </div>
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
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="bg-white/10 rounded-xl p-3.5">
                  <div className="text-[10px] text-white/50 uppercase tracking-wider">Setup Time</div>
                  <div className="text-xs sm:text-sm font-bold mt-1">{pkg.specs?.setupTime || '2.5 Hours'}</div>
                </div>
                <div className="bg-white/10 rounded-xl p-3.5">
                  <div className="text-[10px] text-white/50 uppercase tracking-wider">Crew Size</div>
                  <div className="text-xs sm:text-sm font-bold mt-1">{pkg.specs?.crewSize || '3 Technicians'}</div>
                </div>
                <div className="bg-white/10 rounded-xl p-3.5">
                  <div className="text-[10px] text-white/50 uppercase tracking-wider">Venue Size</div>
                  <div className="text-xs sm:text-sm font-bold mt-1">{pkg.specs?.venueSize || '100–250 sq.m'}</div>
                </div>
                <div className="bg-white/10 rounded-xl p-3.5">
                  <div className="text-[10px] text-white/50 uppercase tracking-wider">Power Demand</div>
                  <div className="text-xs sm:text-sm font-bold mt-1 truncate" title={pkg.specs?.powerReq || '220V Single Phase'}>
                    {pkg.specs?.powerReq || '220V Single Phase'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Right Sidebar ── */}
          <div className="lg:col-span-5 xl:col-span-5">
            <div className="sticky top-28 bg-[var(--mist)] rounded-[2rem] p-5 sm:p-7 border border-[#24252c]/[0.08] shadow-sm space-y-5">
              <h3 className="text-xl font-bold text-[var(--ink)]">Pick Your Date & Customize</h3>

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

              {/* Dynamic Guest & Venue Reference Slider */}
              <div className="mb-5 p-3.5 rounded-2xl bg-white border border-[#24252c]/[0.06] shadow-2xs">
                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[#24252c]/50 mb-1">
                  <span>Guest & Venue Reference</span>
                  <span className="text-[#1090F8] font-extrabold text-sm">{guestCount} Guests</span>
                </div>
                <input
                  type="range"
                  min={pkg.specs?.guestMin || 20}
                  max={pkg.specs?.guestMax || 400}
                  value={guestCount}
                  onChange={(e) => setGuestCount(Number(e.target.value))}
                  className="w-full accent-[#1090F8] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-[#24252c]/40 font-mono mt-1">
                  <span>Min: {pkg.specs?.guestMin || 20} Guests</span>
                  <span>Max Limit: {pkg.specs?.guestMax || 400}+ Guests</span>
                </div>
                <p className="text-[10px] text-[#24252c]/50 mt-2 italic leading-relaxed">
                  * Note: Guest count & venue size are for engineering crew calibration (acoustic coverage & cable runs) and do not affect base rental pricing.
                </p>
              </div>

              {/* ── Optional Equipment Add-ons ── */}
              <div className="mb-6 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50 ml-1 block">
                      Optional Equipment Add-ons
                    </label>
                    <span className="text-[10px] text-[#24252c]/40 ml-1">
                      Add individual gear items to your package
                    </span>
                  </div>
                  {addonModels.length > 0 && (
                    <span className="text-[10px] font-bold text-[#1090F8] bg-[#1090F8]/10 px-2.5 py-0.5 rounded-full">
                      {addonModels.length} available
                    </span>
                  )}
                </div>

                {/* Category Filter Pills */}
                {addonModels.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    {['All', 'Sound', 'Lighting', 'Special FX'].map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setAddonCategory(cat)}
                        className={`text-[10px] px-2.5 py-1 rounded-full font-bold transition-all cursor-pointer ${
                          addonCategory === cat
                            ? 'bg-[var(--ink)] text-white shadow-2xs'
                            : 'bg-white border border-[#24252c]/10 text-[#24252c]/60 hover:text-[var(--ink)]'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
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
                {!addonsLoading && filteredAddonModels.length === 0 && (
                  <div className="p-4 rounded-xl bg-white/60 border border-[#24252c]/[0.05] text-center">
                    <p className="text-xs text-[#24252c]/50 font-medium">
                      No matching equipment add-ons found.
                    </p>
                  </div>
                )}

                {/* List of AddonCards */}
                {!addonsLoading && filteredAddonModels.length > 0 && (
                  <>
                    <div className="space-y-2">
                      {(showAllAddons ? filteredAddonModels : filteredAddonModels.slice(0, 4)).map((model) => {
                        const qty = getQty(model.modelId);
                        const isSelected = qty > 0;
                        return <AddonCard key={model.modelId} model={model} qty={qty} isSelected={isSelected} setQty={setQty} />;
                      })}
                    </div>

                    {/* Expand/Collapse Toggle Button */}
                    {filteredAddonModels.length > 4 && (
                      <button
                        type="button"
                        onClick={() => setShowAllAddons(!showAllAddons)}
                        className="mt-2 w-full bg-white border border-[#24252c]/10 hover:border-[#1090F8]/40 hover:bg-[#1090F8]/5 text-xs font-semibold text-[#24252c]/60 hover:text-[#1090F8] py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <span>{showAllAddons ? '▲ Show fewer items' : `▼ View all ${filteredAddonModels.length} available items`}</span>
                      </button>
                    )}
                  </>
                )}

                {/* ── Frequently Paired Upgrades (Bundle & Save) BELOW Individual Add-ons ── */}
                {!addonsLoading && smartBundles.length > 0 && (
                  <div className="pt-2">
                    <CrossSellPromotions
                      bundles={smartBundles}
                      selectedBundleIds={selectedBundleIds}
                      onToggleBundle={handleToggleBundle}
                      compact={false}
                    />
                  </div>
                )}
              </div>

              {/* ── Price Summary ── */}
              <div className="pt-4 border-t border-[#24252c]/[0.08] mb-5 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-[#24252c]/50">
                  <span>Standard Package Base Rate</span>
                  <span className={totalMaintenanceDeduction > 0 || totalCustomizationDeduction > 0 ? 'line-through text-[#24252c]/40' : ''}>{pkg.price}</span>
                </div>

                {totalCustomizationDeduction > 0 && (
                  <div className="flex items-center justify-between text-xs text-emerald-800 font-medium bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-200">
                    <span className="flex items-center gap-1.5">
                      <IconCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Equipment Customization Credit</span>
                    </span>
                    <span className="font-bold">-₱{totalCustomizationDeduction.toLocaleString()}</span>
                  </div>
                )}

                {totalMaintenanceDeduction > 0 && (
                  <div className="flex items-center justify-between text-xs text-amber-700 font-medium bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200">
                    <span className="flex items-center gap-1.5">
                      <IconShield className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                      <span>Maintenance / Quarantine Discount</span>
                    </span>
                    <span className="font-bold">-₱{totalMaintenanceDeduction.toLocaleString()}</span>
                  </div>
                )}

                {(totalMaintenanceDeduction > 0 || totalCustomizationDeduction > 0) && (
                  <div className="flex items-center justify-between text-xs text-[var(--ink)] font-semibold">
                    <span>Adjusted Package Base</span>
                    <span className="text-emerald-700 font-bold">₱{adjustedPackagePrice.toLocaleString()}</span>
                  </div>
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
                    {totalCustomizationDeduction > 0 && (
                      <span className="block text-[10px] text-emerald-600 font-medium">Includes customized gear credits</span>
                    )}
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