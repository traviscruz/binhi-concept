import { useState } from 'react';

import type { Page } from '../../types';
import { FEATURED_PACKAGES } from '../../data/packages';
import { MonoBadge } from '../../components/shared/Badges';
import { PhotoCarousel } from '../../components/shared/PhotoCarousel';
import { IconArrow, IconCheck, IconTicket, IconHeart } from '../../components/shared/icons';

export default function PackageDetailPage({
  packageId,
  go,
  startBooking,
  isCustomer,
  wishlistIds = [],
  toggleWishlist,
}: {
  packageId: string;
  go: (p: Page) => void;
  startBooking: (id: string, date: string, guestCount: number, addons: string[]) => void;
  isCustomer?: boolean;
  wishlistIds?: string[];
  toggleWishlist?: (id: string) => void;
}) {
  const pkg = FEATURED_PACKAGES.find((p) => p.id === packageId) || FEATURED_PACKAGES[0];
  const [selectedDate, setSelectedDate] = useState('2026-09-14');
  const [guestCount, setGuestCount] = useState(100);
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);

  const addonsList = [
    { id: 'add-mic', name: 'Extra Dual Wireless Host Mics', price: 3000 },
    { id: 'add-smoke', name: 'Low-Lying Fog Machine', price: 4500 },
    { id: 'add-led', name: 'P3 HD LED Wall Display Upgrade', price: 18000 },
  ];

  const toggleAddon = (id: string) => {
    setSelectedAddons((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const addonsTotal = selectedAddons.reduce((sum, id) => {
    const item = addonsList.find((a) => a.id === id);
    return sum + (item ? item.price : 0);
  }, 0);

  const totalPrice = pkg.rawPrice + addonsTotal;

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
          <PhotoCarousel photos={pkg.photos} />
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
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
              <div className="grid sm:grid-cols-3 gap-4 text-center">
                <div className="bg-white/10 rounded-xl p-4">
                  <div className="text-xs text-white/50 uppercase tracking-wider">Power Req</div>
                  <div className="text-sm font-bold mt-1">{pkg.specs.powerReq}</div>
                </div>
                <div className="bg-white/10 rounded-xl p-4">
                  <div className="text-xs text-white/50 uppercase tracking-wider">Setup Time</div>
                  <div className="text-sm font-bold mt-1">{pkg.specs.setupTime}</div>
                </div>
                <div className="bg-white/10 rounded-xl p-4">
                  <div className="text-xs text-white/50 uppercase tracking-wider">Crew Size</div>
                  <div className="text-sm font-bold mt-1">{pkg.specs.crewSize}</div>
                </div>
              </div>
            </div>
          </div>

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
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full rounded-full border border-transparent px-4 py-3 text-sm bg-white text-[var(--ink)] focus:outline-none focus:border-[#1090F8]"
                />
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

              <div className="mb-6">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50 ml-1 block mb-2">
                  Optional Equipment Add-ons
                </label>
                <div className="space-y-2">
                  {addonsList.map((addon) => {
                    const isChecked = selectedAddons.includes(addon.id);
                    return (
                      <div
                        key={addon.id}
                        onClick={() => toggleAddon(addon.id)}
                        className={`p-3 rounded-xl border text-xs cursor-pointer flex items-center justify-between transition-all ${
                          isChecked
                            ? 'bg-white border-[#1090F8] shadow-sm font-semibold'
                            : 'bg-white/60 border-[#24252c]/[0.05] text-[#24252c]/70'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="rounded accent-[#1090F8]"
                          />
                          <span>{addon.name}</span>
                        </div>
                        <span className="font-bold text-[#1090F8]">+₱{addon.price.toLocaleString()}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

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
                onClick={() => startBooking(pkg.id, selectedDate, guestCount, selectedAddons)}
                className="w-full bg-[var(--ink)] text-white text-sm font-semibold py-4 rounded-full hover:bg-[var(--ink-soft)] transition-colors inline-flex items-center justify-center gap-2 shadow-md"
              >
                Proceed to Book This Setup <IconArrow className="w-4 h-4" />
              </button>

              {isCustomer && (
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