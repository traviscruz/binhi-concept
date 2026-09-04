import { useState, useEffect } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import { IconArrow, IconCheck, IconTicket, IconSearch } from '../../components/shared/icons';
import { supabase } from '../../lib/supabase';
import { fetchDbBookedDates, isPastDate, type DBBooking } from '../../utils/bookingService';
import { EQUIPMENT_ITEMS } from '../../data/equipment';

// ─── Types ───────────────────────────────────────────────────────────────────

interface GearModel {
  id: string;
  name: string;
  brand: string;
  category: string;
  rentalRate: number;
  availableCount: number;
  description: string;
}

interface ItemQuantityMap {
  [modelId: string]: number;
}

// ─── GearCard Subcomponent (Compact & Clean) ──────────────────────────────────

function GearCard({
  model,
  qty,
  isSelected,
  setQty,
}: {
  model: GearModel;
  qty: number;
  isSelected: boolean;
  setQty: (modelId: string, qty: number) => void;
}) {
  return (
    <div
      className={`p-3 rounded-xl border transition-all flex flex-col justify-between ${
        isSelected
          ? 'bg-white border-[#1090F8] shadow-sm ring-1 ring-[#1090F8]/20'
          : 'bg-white/80 hover:bg-white border-[#24252c]/[0.07] hover:border-[#24252c]/20'
      }`}
    >
      <div>
        <div className="flex items-center justify-between gap-1.5 mb-1.5">
          <span className="text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-[var(--mist)] text-[#24252c]/60">
            {model.category}
          </span>
          <span className="text-[9px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200">
            {model.availableCount} in stock
          </span>
        </div>

        <h4 className="font-bold text-xs sm:text-sm text-[var(--ink)] leading-snug line-clamp-1">
          {model.name}
        </h4>
        <p className="text-[10px] text-[#24252c]/50 mt-0.5 truncate">
          {model.brand}
        </p>
      </div>

      <div className="mt-3 pt-2.5 border-t border-[#24252c]/[0.06] flex items-center justify-between gap-1.5">
        <div>
          <span className="text-[9px] uppercase text-[#24252c]/40 font-semibold block">Rate</span>
          <span className="font-extrabold text-xs sm:text-sm text-[#1090F8] whitespace-nowrap">
            ₱{model.rentalRate.toLocaleString()}<span className="font-normal text-[10px] text-[#24252c]/40">/day</span>
          </span>
        </div>

        {/* Stepper Controls */}
        <div className="flex items-center gap-1 bg-[var(--mist)] p-0.5 rounded-full border border-[#24252c]/10">
          <button
            type="button"
            onClick={() => setQty(model.id, qty - 1)}
            disabled={qty === 0}
            className="w-6 h-6 rounded-full bg-white text-[var(--ink)] font-bold text-xs flex items-center justify-center hover:bg-[#E4E6EA] disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-2xs cursor-pointer"
            title="Decrease quantity"
          >
            −
          </button>
          <span className={`w-4 text-center font-bold text-xs ${isSelected ? 'text-[#1090F8]' : 'text-[#24252c]/40'}`}>
            {qty}
          </span>
          <button
            type="button"
            onClick={() => setQty(model.id, qty + 1)}
            disabled={qty >= model.availableCount}
            className="w-6 h-6 rounded-full bg-white text-[var(--ink)] font-bold text-xs flex items-center justify-center hover:bg-[#E4E6EA] disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-2xs cursor-pointer"
            title="Increase quantity"
          >
            +
          </button>
        </div>
      </div>

      {isSelected && (
        <div className="mt-2 pt-1.5 border-t border-[#1090F8]/15 flex items-center justify-between text-[10px] font-bold text-[#1090F8]">
          <span>Subtotal ({qty}x):</span>
          <span>₱{(qty * model.rentalRate).toLocaleString()}</span>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CustomPackagePage({
  go,
  startBooking,
}: {
  go: (p: Page) => void;
  startBooking: (id: string, date: string, guestCount: number, addons: string[]) => void;
}) {
  const [selectedDate, setSelectedDate] = useState(() => {
    return localStorage.getItem('binhi_selected_event_date') || '2026-09-14';
  });
  const [guestCount, setGuestCount] = useState(100);
  const [gearList, setGearList] = useState<GearModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [itemSelections, setItemSelections] = useState<ItemQuantityMap>({});
  const [dbBookings, setDbBookings] = useState<DBBooking[]>([]);

  // Load booked dates to validate availability
  useEffect(() => {
    async function loadBookings() {
      const data = await fetchDbBookedDates();
      setDbBookings(data);
    }
    loadBookings();
  }, []);

  // Fetch real equipment from Supabase (with fallback to EQUIPMENT_ITEMS)
  useEffect(() => {
    async function fetchInventory() {
      setLoading(true);
      try {
        const { data: modelsData } = await supabase
          .from('equipment_models')
          .select('*')
          .order('name', { ascending: true });

        const { data: unitsData } = await supabase
          .from('physical_units')
          .select('model_id, status');

        if (modelsData && modelsData.length > 0) {
          const availMap: Record<string, number> = {};
          (unitsData || []).forEach((u: any) => {
            if (u.status === 'Available in Warehouse') {
              availMap[u.model_id] = (availMap[u.model_id] || 0) + 1;
            }
          });

          const mapped: GearModel[] = modelsData.map((m: any) => {
            const fallback = EQUIPMENT_ITEMS.find(
              (e) => e.id === m.model_id || e.name.toLowerCase() === m.name.toLowerCase()
            );
            const availCount = availMap[m.model_id] ?? availMap[m.id] ?? 4;
            const rate = Number(m.rental_rate || 0);

            return {
              id: m.model_id || m.id,
              name: m.name,
              brand: m.brand || 'BINHI Standard',
              category: m.category || 'Audio Production',
              rentalRate: rate > 0 ? rate : fallback?.rawPrice || 2500,
              availableCount: Math.max(1, availCount),
              description: m.description || fallback?.desc || 'Professional production grade event equipment.',
            };
          });

          setGearList(mapped);
        } else {
          // Static fallback mapping
          const staticMapped: GearModel[] = EQUIPMENT_ITEMS.map((item) => ({
            id: item.id,
            name: item.name,
            brand: 'BINHI Standard',
            category: item.category,
            rentalRate: item.rawPrice || 3500,
            availableCount: 4,
            description: item.desc,
          }));
          setGearList(staticMapped);
        }
      } catch (err) {
        console.error('Error fetching inventory for custom builder:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchInventory();
  }, []);

  // Update item quantity
  const handleSetQty = (modelId: string, newQty: number) => {
    const target = gearList.find((g) => g.id === modelId);
    const maxCount = target ? target.availableCount : 99;
    const clamped = Math.max(0, Math.min(newQty, maxCount));
    setItemSelections((prev) => {
      if (clamped <= 0) {
        const next = { ...prev };
        delete next[modelId];
        return next;
      }
      return { ...prev, [modelId]: clamped };
    });
  };

  const getQty = (modelId: string) => itemSelections[modelId] || 0;

  // Categories list
  const categories = ['All', ...Array.from(new Set(gearList.map((g) => g.category)))];

  // Filtered gear
  const filteredGear = gearList.filter((item) => {
    const matchCat = selectedCategory === 'All' || item.category === selectedCategory;
    const matchQuery =
      !searchQuery.trim() ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchQuery;
  });

  // Selected items list & calculations
  const selectedGearItems = gearList
    .filter((g) => getQty(g.id) > 0)
    .map((g) => ({
      ...g,
      qty: getQty(g.id),
      subtotal: getQty(g.id) * g.rentalRate,
    }));

  const totalEquipmentCost = selectedGearItems.reduce((acc, item) => acc + item.subtotal, 0);
  const totalItemsCount = selectedGearItems.reduce((acc, item) => acc + item.qty, 0);
  const requiredDeposit = Math.round(totalEquipmentCost * 0.5);
  const remainingBalance = totalEquipmentCost - requiredDeposit;

  // Selected date status
  const isDateBooked = dbBookings.some((b) => b.event_date === selectedDate);
  const isDatePast = isPastDate(selectedDate);

  // Convert selected gear into formatted strings for CheckoutPage
  const selectedAddonStrings = selectedGearItems.map(
    (item) => `${item.qty}x ${item.name} (+₱${item.subtotal.toLocaleString()})`
  );

  const handleProceedToCheckout = () => {
    if (selectedGearItems.length === 0) {
      alert('Please select at least one piece of equipment to build your custom package.');
      return;
    }
    if (isDateBooked) {
      alert(`The date ${selectedDate} is already booked. Please choose another event date.`);
      return;
    }
    if (isDatePast) {
      alert('Please choose a future event date.');
      return;
    }

    try {
      localStorage.setItem('binhi_selected_event_date', selectedDate);
    } catch {}

    startBooking('custom-package', selectedDate, guestCount, selectedAddonStrings);
  };

  return (
    <section className="pt-28 sm:pt-32 md:pt-36 pb-16 sm:pb-20 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Top Breadcrumb */}
        <div>
          <button
            type="button"
            onClick={() => go('packages')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#24252c]/60 hover:text-[var(--ink)] transition-colors mb-3 cursor-pointer"
          >
            ← Back to packages
          </button>

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-[#24252c]/[0.08]">
            <div>
              <MonoBadge icon={IconTicket}>Custom Production Setup</MonoBadge>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ink)] mt-2">
                Create &amp; Customize Your Own Package
              </h1>
              <p className="text-xs sm:text-sm text-[#24252c]/60 mt-1 max-w-xl">
                Pick specific audio, lighting, LED screens, and effects with live calculation directly from warehouse inventory.
              </p>
            </div>
            <div className="shrink-0 text-left sm:text-right">
              <div className="text-[10px] text-[#24252c]/50 font-semibold uppercase tracking-wider">Calculated Package Rate</div>
              <div className="text-2xl font-extrabold text-[#1090F8] mt-0.5">
                ₱{totalEquipmentCost.toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {/* ── Main Layout: Both Columns Scroll Naturally Together ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* ── Left Column (Inclusions + Compact 2-Column Catalog Grid) ── */}
          <div className="lg:col-span-2 space-y-6">
            {/* 1. Package Equipment Inclusions Card */}
            <div className="bg-[var(--mist)] rounded-2xl p-4 sm:p-5 border border-[#24252c]/[0.06]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base sm:text-lg font-bold flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#1090F8] text-white flex items-center justify-center text-xs font-bold">✓</span>
                  Package Equipment Inclusions
                </h3>
                {selectedGearItems.length > 0 && (
                  <span className="text-[11px] font-semibold text-[#1090F8] bg-[#1090F8]/10 px-2.5 py-0.5 rounded-full">
                    {totalItemsCount} {totalItemsCount === 1 ? 'unit' : 'units'} selected
                  </span>
                )}
              </div>

              {selectedGearItems.length === 0 ? (
                <div className="p-4 rounded-xl bg-white/70 border border-dashed border-[#24252c]/15 text-center text-xs text-[#24252c]/50 leading-relaxed">
                  No equipment selected yet. Choose items from the catalog below to add them to your custom package inclusions.
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedGearItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 p-2.5 sm:p-3 bg-white rounded-xl border border-[#24252c]/[0.05] shadow-2xs"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <IconCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-xs sm:text-sm font-semibold text-[var(--ink)] leading-snug">
                            {item.qty}x {item.name}
                          </span>
                          <span className="text-[10px] text-[#24252c]/50 block">
                            {item.brand} · {item.category}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0">
                        <span className="font-bold text-xs sm:text-sm text-[#1090F8]">₱{item.subtotal.toLocaleString()}</span>
                        <button
                          type="button"
                          onClick={() => handleSetQty(item.id, 0)}
                          className="text-[#24252c]/30 hover:text-rose-600 transition-colors p-1 text-xs font-bold cursor-pointer"
                          title="Remove item"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 2. Equipment Catalog Selection (Compact 2-Column Grid) */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#24252c]/[0.08] shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-base sm:text-lg font-extrabold text-[var(--ink)]">Available Gear Catalog</h3>
                  <p className="text-[11px] text-[#24252c]/50 mt-0.5">Live warehouse inventory available for your event setup.</p>
                </div>

                {/* Search Bar */}
                <div className="relative w-full sm:w-56">
                  <IconSearch className="w-3.5 h-3.5 text-[#24252c]/40 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search equipment..."
                    className="w-full bg-[var(--mist)] border border-[#24252c]/10 text-xs font-medium rounded-full pl-8 pr-7 py-2 outline-none focus:border-[#1090F8] focus:bg-white transition-all placeholder:text-[#24252c]/40"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#24252c]/40 hover:text-[var(--ink)] font-bold cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Category Filter Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-4 modal-scroll border-b border-[#24252c]/[0.06]">
                {categories.map((cat) => {
                  const isSelected = selectedCategory === cat;
                  const count =
                    cat === 'All'
                      ? gearList.length
                      : gearList.filter((g) => g.category === cat).length;

                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`text-[11px] font-semibold px-3 py-1 rounded-full transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-[var(--ink)] text-white shadow-xs'
                          : 'bg-[var(--mist)] text-[#24252c]/70 hover:bg-[#E4E6EA] border border-[#24252c]/[0.06]'
                      }`}
                    >
                      <span>{cat}</span>
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-black/5 text-[#24252c]/60'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Gear Grid */}
              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-28 bg-slate-100 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : filteredGear.length === 0 ? (
                <div className="p-8 rounded-xl bg-[var(--mist)] text-center space-y-1.5">
                  <p className="text-xs font-bold text-[var(--ink)]">No gear found matching your search</p>
                  <p className="text-[11px] text-[#24252c]/50">Try searching for a different item or resetting the category filter.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory('All');
                    }}
                    className="text-xs font-semibold text-[#1090F8] underline pt-0.5 cursor-pointer"
                  >
                    Reset filters
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredGear.map((item) => {
                    const qty = getQty(item.id);
                    const isSelected = qty > 0;
                    return (
                      <GearCard
                        key={item.id}
                        model={item}
                        qty={qty}
                        isSelected={isSelected}
                        setQty={handleSetQty}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Right Sidebar: Joins in natural page scroll ── */}
          <div className="lg:col-span-1">
            <div className="bg-[var(--mist)] rounded-2xl p-4 sm:p-5 border border-[#24252c]/[0.08] shadow-xs space-y-4">
              <h3 className="text-base font-bold">Pick Your Date &amp; Customize</h3>

              {/* Event Date */}
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-[#24252c]/50 ml-1 block mb-1">
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
                  className={`w-full rounded-full border px-3.5 py-2.5 text-xs focus:outline-none ${
                    isPastDate(selectedDate) || isDateBooked
                      ? 'border-rose-400 bg-rose-50 text-rose-800 font-bold'
                      : 'border-transparent bg-white text-[var(--ink)] focus:border-[#1090F8]'
                  }`}
                />
                {(isPastDate(selectedDate) || isDateBooked) && (
                  <p className="text-[10px] font-bold text-rose-600 mt-1 ml-1.5">
                    {isPastDate(selectedDate)
                      ? 'Past Date: Please choose a future event date.'
                      : 'Reserved Date: This date is already booked in database.'}
                  </p>
                )}
              </div>

              {/* Guest Count */}
              <div>
                <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-[#24252c]/50 ml-1 mb-1">
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

              {/* Selected Equipment Summary */}
              <div>
                <label className="text-[10px] font-semibold uppercase tracking-wider text-[#24252c]/50 ml-1 block mb-1.5">
                  Selected Equipment ({totalItemsCount})
                </label>

                {selectedGearItems.length === 0 ? (
                  <div className="p-3 rounded-xl bg-white/60 border border-[#24252c]/[0.05] text-center">
                    <p className="text-[11px] text-[#24252c]/50 font-medium">
                      No gear selected yet. Add items from the catalog.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto modal-scroll pr-1">
                    {selectedGearItems.map((item) => (
                      <div
                        key={item.id}
                        className="p-2 rounded-lg bg-white border border-[#24252c]/[0.05] flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-[var(--ink)] truncate text-[11px]">{item.name}</div>
                          <div className="text-[9px] text-[#24252c]/50">
                            {item.qty} × ₱{item.rentalRate.toLocaleString()}
                          </div>
                        </div>
                        <span className="font-bold text-[#1090F8] shrink-0 text-[11px]">
                          ₱{item.subtotal.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Price Summary */}
              <div className="pt-3 border-t border-[#24252c]/[0.08]">
                <div className="flex items-center justify-between text-[11px] text-[#24252c]/50 mb-1">
                  <span>Base Custom Rate</span>
                  <span>₱0</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-[#24252c]/50 mb-1">
                  <span>Selected Equipment</span>
                  <span>₱{totalEquipmentCost.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-sm font-extrabold text-[var(--ink)] mt-1.5 pt-1.5 border-t border-[#24252c]/[0.06]">
                  <span>Total Calculated Rate</span>
                  <span className="text-xl text-[#1090F8]">₱{totalEquipmentCost.toLocaleString()}</span>
                </div>
                {totalEquipmentCost > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-dashed border-[#24252c]/10 space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-emerald-700 bg-emerald-50/70 p-1.5 rounded-lg">
                      <span>50% Required Deposit:</span>
                      <span>₱{requiredDeposit.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-[#24252c]/50 px-1 pt-0.5">
                      <span>Remaining 50% Balance:</span>
                      <span>₱{remainingBalance.toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Primary Action Button */}
              <button
                type="button"
                disabled={selectedGearItems.length === 0 || isDateBooked || isPastDate(selectedDate)}
                onClick={handleProceedToCheckout}
                className="w-full bg-[var(--ink)] text-white text-xs font-semibold py-3.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors inline-flex items-center justify-center gap-1.5 shadow-md disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <span>
                  {selectedGearItems.length === 0
                    ? 'Select Equipment to Proceed'
                    : `Proceed to Booking Checkout (₱${requiredDeposit.toLocaleString()})`}
                </span>
                <IconArrow className="w-3.5 h-3.5" />
              </button>

              <div className="text-[10px] text-center text-[#24252c]/50">
                Secured via PayMongo · 50% Reservation Deposit
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
