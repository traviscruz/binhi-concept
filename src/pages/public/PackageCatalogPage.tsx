import { useRef } from 'react';
import type { Page } from '../../types';
import { FEATURED_PACKAGES, type PackageData, getPackagePhotoCount } from '../../data/packages';
import { MonoBadge } from '../../components/shared/Badges';
import { IconArrow, IconTicket, IconHeart, IconBox } from '../../components/shared/icons';
import { ImageWithSkeleton } from '../../components/shared/ImageWithSkeleton';

export default function PackageCatalogPage({
  goPackageDetail,
  isCustomer,
  wishlistIds = [],
  toggleWishlist,
  packages = [],
  go,
}: {
  goPackageDetail: (id: string) => void;
  isCustomer?: boolean;
  wishlistIds?: string[];
  toggleWishlist?: (id: string) => void;
  packages?: PackageData[];
  go?: (p: Page) => void;
}) {
  const displayPackages = [...(packages && packages.length > 0 ? packages : FEATURED_PACKAGES)].sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  const scrollRef = useRef<HTMLDivElement>(null);

  // Slide one card by one card with wrap-around looping
  const scrollLeft = () => {
    if (scrollRef.current) {
      const el = scrollRef.current;
      const firstChild = el.firstElementChild as HTMLElement;
      const cardWidth = firstChild ? firstChild.offsetWidth + 24 : 360;

      if (el.scrollLeft <= 10) {
        // If at the beginning, wrap around to the last card
        el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' });
      } else {
        el.scrollBy({ left: -cardWidth, behavior: 'smooth' });
      }
    }
  };

  const scrollRight = () => {
    if (scrollRef.current) {
      const el = scrollRef.current;
      const firstChild = el.firstElementChild as HTMLElement;
      const cardWidth = firstChild ? firstChild.offsetWidth + 24 : 360;

      const maxScrollLeft = el.scrollWidth - el.clientWidth;
      if (el.scrollLeft >= maxScrollLeft - 10) {
        // If at the end, wrap around to the first card
        el.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        el.scrollBy({ left: cardWidth, behavior: 'smooth' });
      }
    }
  };

  return (
    <section className="pt-28 sm:pt-36 md:pt-40 pb-20 sm:pb-24 px-4 sm:px-6 overflow-hidden">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8 sm:mb-12">
          <MonoBadge icon={IconTicket}>All Packages</MonoBadge>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mt-4">Pick your event setup</h1>
          <p className="text-[#24252c]/60 mt-3 text-sm sm:text-base max-w-xl mx-auto">
            Browse our signature sound, lighting, and stage production packages. Click any package to view photos, equipment inclusions, and date availability.
          </p>
        </div>

        {!isCustomer ? (
          /* Public View: One-by-One Sliding Carousel with Spacious Outer Navigation Arrows */
          <div className="relative px-6 sm:px-12 lg:px-16">
            {/* Left Arrow Button (Spacious outer offset) */}
            <button
              onClick={scrollLeft}
              className="absolute -left-2 sm:-left-6 lg:-left-10 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white border border-[#24252c]/15 text-[var(--ink)] font-bold text-xl flex items-center justify-center hover:bg-[var(--ink)] hover:text-white transition-all shadow-xl z-30 cursor-pointer"
              title="Previous Package"
              aria-label="Previous Package"
            >
              ←
            </button>

            {/* Right Arrow Button (Spacious outer offset) */}
            <button
              onClick={scrollRight}
              className="absolute -right-2 sm:-right-6 lg:-right-10 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white border border-[#24252c]/15 text-[var(--ink)] font-bold text-xl flex items-center justify-center hover:bg-[var(--ink)] hover:text-white transition-all shadow-xl z-30 cursor-pointer"
              title="Next Package"
              aria-label="Next Package"
            >
              →
            </button>

            {/* One-by-One Responsive Sliding Track */}
            <div
              ref={scrollRef}
              className="grid grid-flow-col auto-cols-[100%] sm:auto-cols-[calc(50%-12px)] lg:auto-cols-[calc(33.333%-16px)] gap-4 sm:gap-6 overflow-x-auto scroll-smooth py-2 px-1 snap-x snap-mandatory"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {displayPackages.map((pkg) => (
                <div
                  key={pkg.id}
                  onClick={() => goPackageDetail(pkg.id)}
                  className="snap-start group rounded-[1.75rem] border border-[#24252c]/[0.08] overflow-hidden bg-white hover:shadow-xl transition-all cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    <div className="aspect-[4/3] overflow-hidden bg-[var(--mist)] relative">
                      <ImageWithSkeleton
                        src={pkg.img}
                        alt={pkg.name}
                        className="w-full h-full group-hover:scale-[1.04] transition-transform duration-500"
                      />
                      <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md text-white text-xs font-semibold px-3 py-1 rounded-full">
                        {getPackagePhotoCount(pkg)} {getPackagePhotoCount(pkg) === 1 ? 'Photo' : 'Photos'}
                      </div>
                    </div>

                    <div className="ticket-notch ticket-dash px-5 pt-4 pb-2 flex items-center justify-between">
                      <span className="text-[11px] mono uppercase tracking-widest text-[#24252c]/50 font-semibold">
                        {pkg.tag}
                      </span>
                      <span className="text-base font-bold text-[#1090F8]">{pkg.price}</span>
                    </div>

                    <div className="px-5 pb-5 pt-2">
                      <h3 className="font-semibold text-lg">{pkg.name}</h3>
                      <p className="text-sm text-[#24252c]/60 mt-2 leading-relaxed">{pkg.desc}</p>
                    </div>
                  </div>

                  <div className="px-5 pb-5 pt-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        goPackageDetail(pkg.id);
                      }}
                      className="w-full bg-[var(--ink)] text-white text-sm font-semibold py-3 rounded-full hover:bg-[var(--ink-soft)] transition-colors inline-flex items-center justify-center gap-1.5"
                    >
                      View package & inclusions <IconArrow className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Customer Logged-in View: Show All Packages Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {displayPackages.map((pkg) => {
              const isSaved = wishlistIds.includes(pkg.id);
              return (
                <div
                  key={pkg.id}
                  onClick={() => goPackageDetail(pkg.id)}
                  className="group rounded-[1.75rem] border border-[#24252c]/[0.08] overflow-hidden bg-white hover:shadow-xl transition-all cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    <div className="aspect-[4/3] overflow-hidden bg-[var(--mist)] relative">
                      <ImageWithSkeleton
                        src={pkg.img}
                        alt={pkg.name}
                        className="w-full h-full group-hover:scale-[1.04] transition-transform duration-500"
                      />
                      {toggleWishlist && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleWishlist?.(pkg.id);
                          }}
                          className={`absolute top-3 left-3 p-2 rounded-full border shadow-sm transition-all ${
                            isSaved
                              ? 'bg-rose-50 border-rose-200 text-rose-500 scale-110'
                              : 'bg-white/90 hover:bg-white text-[var(--ink)] hover:text-rose-600 border-black/10'
                          }`}
                          title={isSaved ? 'Remove from Wishlist' : 'Add to Wishlist'}
                        >
                          <IconHeart className={`w-4 h-4 ${isSaved ? 'fill-rose-500 text-rose-500' : ''}`} />
                        </button>
                      )}
                      <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md text-white text-xs font-semibold px-3 py-1 rounded-full">
                        {getPackagePhotoCount(pkg)} {getPackagePhotoCount(pkg) === 1 ? 'Photo' : 'Photos'}
                      </div>
                    </div>
                    <div className="ticket-notch ticket-dash px-5 pt-4 pb-2 flex items-center justify-between">
                      <span className="text-[11px] mono uppercase tracking-widest text-[#24252c]/50">{pkg.tag}</span>
                      <span className="text-base font-bold text-[#1090F8]">{pkg.price}</span>
                    </div>
                    <div className="px-5 pb-5 pt-2">
                      <h3 className="font-semibold text-lg">{pkg.name}</h3>
                      <p className="text-sm text-[#24252c]/60 mt-2 leading-relaxed">{pkg.desc}</p>
                    </div>
                  </div>
                  <div className="px-5 pb-5 pt-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        goPackageDetail(pkg.id);
                      }}
                      className="w-full bg-[var(--ink)] text-white text-sm font-semibold py-3 rounded-full hover:bg-[var(--ink-soft)] transition-colors inline-flex items-center justify-center gap-1.5"
                    >
                      View package & inclusions <IconArrow className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Custom Package Call-to-Action Banner (Below Packages) ── */}
        <div className="mt-12 sm:mt-16 p-6 sm:p-8 rounded-[2rem] bg-gradient-to-r from-[var(--ink)] via-[#20222a] to-[#121318] text-white shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative overflow-hidden group">
          <div className="relative z-10 space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-white/10 text-white border border-white/20">
              <span>Custom Production Setup</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
              Create &amp; Customize Your Own Package
            </h2>
            <p className="text-xs sm:text-sm text-white/75 leading-relaxed">
              Prefer to pick your own sound gear, stage lights, moving heads, wireless mics, and LED video panels? Build your bespoke package directly from our live warehouse inventory.
            </p>
          </div>

          <div className="relative z-10 shrink-0">
            <button
              type="button"
              onClick={() => go?.('custom-package')}
              className="w-full sm:w-auto bg-[#1090F8] hover:bg-[#1090F8]/90 text-white font-extrabold text-xs px-6 py-3.5 rounded-full transition-all shadow-md hover:shadow-lg hover:scale-[1.02] cursor-pointer inline-flex items-center justify-center gap-2"
            >
              <span>Build Custom Package</span>
              <span>→</span>
            </button>
          </div>

          {/* Subtle ambient lighting effect */}
          <div className="absolute -right-8 -bottom-8 w-44 h-44 rounded-full bg-[#1090F8]/20 blur-3xl pointer-events-none" />
        </div>
      </div>
    </section>
  );
}