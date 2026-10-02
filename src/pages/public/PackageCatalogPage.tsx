import { useState, useMemo, useRef } from 'react';
import type { Page } from '../../types';
import { FEATURED_PACKAGES, type PackageData, getPackagePhotoCount } from '../../data/packages';
import { MonoBadge } from '../../components/shared/Badges';
import { IconArrow, IconTicket, IconHeart, IconSearch, IconX } from '../../components/shared/icons';
import { ImageWithSkeleton } from '../../components/shared/ImageWithSkeleton';
import { EmptyState } from '../../components/shared/EmptyState';

interface EventCategory {
  id: string;
  label: string;
  keywords: string[];
}

const BINHI_EVENT_CATEGORIES: EventCategory[] = [
  { id: 'all', label: 'All Packages', keywords: [] },
  { id: 'weddings', label: 'Weddings & Receptions', keywords: ['wedding', 'reception', 'nuptial'] },
  { id: 'birthdays', label: 'Birthdays & Debuts', keywords: ['birthday', 'debut', '18th'] },
  { id: 'corporate', label: 'Corporate & Launches', keywords: ['corporate', 'launch', 'business', 'seminar', 'conference', 'program', 'gala', 'award', 'anniversary'] },
  { id: 'concerts', label: 'Live Bands & Concerts', keywords: ['concert', 'live music', 'band', 'festival', 'stage', 'line array'] },
  { id: 'intimate', label: 'Intimate & Backyard', keywords: ['intimate', 'backyard', 'small venue', 'small-medium', 'gathering', 'dinner'] },
];

function isPackageMatchingCategory(pkg: PackageData, cat: EventCategory): boolean {
  if (cat.id === 'all') return true;
  const recs = (pkg.recommendedFor || (pkg as any).recommended_for || []) as string[];
  const combinedText = [
    pkg.name,
    pkg.tag,
    pkg.desc,
    ...recs,
  ].join(' ').toLowerCase();

  return cat.keywords.some((kw) => combinedText.includes(kw.toLowerCase()));
}

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
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const displayPackages = useMemo(() => {
    return [...(packages && packages.length > 0 ? packages : FEATURED_PACKAGES)].sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [packages]);

  // Only show categories that have at least one matching package
  const activeCategories = useMemo(() => {
    return BINHI_EVENT_CATEGORIES.filter((cat) => {
      if (cat.id === 'all') return true;
      return displayPackages.some((pkg) => isPackageMatchingCategory(pkg, cat));
    });
  }, [displayPackages]);

  // Filter packages based on active smart category and search query
  const filteredPackages = useMemo(() => {
    const activeCat = BINHI_EVENT_CATEGORIES.find((c) => c.id === selectedCategoryId) || BINHI_EVENT_CATEGORIES[0];

    return displayPackages.filter((pkg) => {
      // Category Filter
      if (!isPackageMatchingCategory(pkg, activeCat)) {
        return false;
      }

      // Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const recList: string[] = (pkg.recommendedFor || (pkg as any).recommended_for || []).filter(
          (x: any) => typeof x === 'string'
        );
        const matchName = pkg.name.toLowerCase().includes(q);
        const matchTag = pkg.tag.toLowerCase().includes(q);
        const matchDesc = pkg.desc.toLowerCase().includes(q);
        const matchInclusions = (pkg.inclusions || []).some((inc) =>
          inc.toLowerCase().includes(q)
        );
        const matchRecs = recList.some((rec) => rec.toLowerCase().includes(q));

        if (!matchName && !matchTag && !matchDesc && !matchInclusions && !matchRecs) {
          return false;
        }
      }

      return true;
    });
  }, [displayPackages, selectedCategoryId, searchQuery]);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Slide one card by one card with wrap-around looping
  const scrollLeft = () => {
    if (scrollRef.current) {
      const el = scrollRef.current;
      const firstChild = el.firstElementChild as HTMLElement;
      const cardWidth = firstChild ? firstChild.offsetWidth + 24 : 360;

      if (el.scrollLeft <= 10) {
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
        el.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        el.scrollBy({ left: cardWidth, behavior: 'smooth' });
      }
    }
  };

  return (
    <section className="pt-28 sm:pt-36 md:pt-40 pb-20 sm:pb-24 px-4 sm:px-6 overflow-hidden">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-6 sm:mb-8">
          <MonoBadge icon={IconTicket}>Event Packages</MonoBadge>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mt-4">Pick your event setup</h1>
          <p className="text-[#24252c]/60 mt-3 text-sm sm:text-base max-w-xl mx-auto">
            Browse our signature sound, lighting, and stage production packages. Click any package to view photos, equipment inclusions, and date availability.
          </p>
        </div>

        {/* ── Search Bar & Event Filter Pills (BINHI Concept Event Types) ── */}
        <div className="max-w-2xl mx-auto mb-10 space-y-3.5">
          {/* Search Input Bar */}
          <div className="relative flex items-center">
            <IconSearch className="w-4 h-4 text-[#24252c]/40 absolute left-4 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by event type (wedding, debut, concert...), package, gear..."
              className="w-full bg-white border border-[#24252c]/15 focus:border-[var(--ink)] focus:ring-4 focus:ring-[var(--ink)]/5 rounded-full pl-11 pr-10 py-3 text-sm font-medium text-[var(--ink)] placeholder-[#24252c]/40 shadow-sm transition-all outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 p-1 rounded-full text-[#24252c]/40 hover:text-[var(--ink)] hover:bg-[#24252c]/5 transition-colors cursor-pointer"
                title="Clear search"
              >
                <IconX className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Event Filter Pills */}
          <div className="flex items-center justify-center gap-1.5 sm:gap-2 flex-wrap pt-1">
            {activeCategories.map((cat) => {
              const count = displayPackages.filter((pkg) => isPackageMatchingCategory(pkg, cat)).length;
              const isActive = selectedCategoryId === cat.id;

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`text-xs px-3.5 sm:px-4 py-2 rounded-full font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-[var(--ink)] text-white shadow-md font-bold'
                      : 'bg-white border border-[#24252c]/12 text-[#24252c]/70 hover:text-[var(--ink)] hover:border-[#24252c]/30 hover:bg-[#24252c]/[0.02]'
                  }`}
                >
                  <span>{cat.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-[#24252c]/6 text-[#24252c]/60'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Package Listings / Empty State ── */}
        {filteredPackages.length === 0 ? (
          <div className="py-12 text-center bg-white rounded-3xl border border-[#24252c]/10 p-8 max-w-md mx-auto shadow-sm">
            <EmptyState
              icon={IconSearch}
              title="No packages match your search"
              description={
                searchQuery || selectedCategoryId !== 'all'
                  ? `We couldn't find any packages matching your search. Try selecting another event category or clearing your query.`
                  : 'No packages are currently listed.'
              }
            />
            {(searchQuery || selectedCategoryId !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategoryId('all');
                }}
                className="mt-4 px-5 py-2.5 bg-[var(--ink)] text-white text-xs font-bold rounded-full hover:bg-[var(--ink-soft)] transition-colors cursor-pointer"
              >
                Clear Filters &amp; Show All
              </button>
            )}
          </div>
        ) : !isCustomer ? (
          /* Public View: One-by-One Sliding Carousel with Spacious Outer Navigation Arrows */
          <div className="relative px-6 sm:px-12 lg:px-16">
            {/* Left Arrow Button (Spacious outer offset) */}
            {filteredPackages.length > 1 && (
              <button
                onClick={scrollLeft}
                className="absolute -left-2 sm:-left-6 lg:-left-10 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white border border-[#24252c]/15 text-[var(--ink)] font-bold text-xl flex items-center justify-center hover:bg-[var(--ink)] hover:text-white transition-all shadow-xl z-30 cursor-pointer"
                title="Previous Package"
                aria-label="Previous Package"
              >
                ←
              </button>
            )}

            {/* Right Arrow Button (Spacious outer offset) */}
            {filteredPackages.length > 1 && (
              <button
                onClick={scrollRight}
                className="absolute -right-2 sm:-right-6 lg:-right-10 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white border border-[#24252c]/15 text-[var(--ink)] font-bold text-xl flex items-center justify-center hover:bg-[var(--ink)] hover:text-white transition-all shadow-xl z-30 cursor-pointer"
                title="Next Package"
                aria-label="Next Package"
              >
                →
              </button>
            )}

            {/* One-by-One Responsive Sliding Track */}
            <div
              ref={scrollRef}
              className="grid grid-flow-col auto-cols-[100%] sm:auto-cols-[calc(50%-12px)] lg:auto-cols-[calc(33.333%-16px)] gap-4 sm:gap-6 overflow-x-auto scroll-smooth py-2 px-1 snap-x snap-mandatory"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {filteredPackages.map((pkg) => {
                const recs = (pkg.recommendedFor || (pkg as any).recommended_for || []) as string[];
                return (
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

                      <div className="px-5 pb-3 pt-2">
                        <h3 className="font-semibold text-lg">{pkg.name}</h3>

                        {/* Venue Sizing & Crowd Capacity Badges */}
                        {(pkg.specs?.venueSize || pkg.specs?.guestCapacity) && (
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap text-[10px] font-bold text-[#1090F8]">
                            {pkg.specs?.venueSize && (
                              <span className="bg-[#1090F8]/8 border border-[#1090F8]/15 px-2 py-0.5 rounded-full">
                                {pkg.specs.venueSize}
                              </span>
                            )}
                            {pkg.specs?.guestCapacity && (
                              <span className="bg-[#1090F8]/8 border border-[#1090F8]/15 px-2 py-0.5 rounded-full">
                                {pkg.specs.guestCapacity}
                              </span>
                            )}
                          </div>
                        )}

                        <p className="text-sm text-[#24252c]/60 mt-2 leading-relaxed">{pkg.desc}</p>

                        {/* Ideal for Events Tags */}
                        {recs.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-[#24252c]/[0.06] flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#24252c]/40 shrink-0">
                              Ideal for:
                            </span>
                            {recs.slice(0, 2).map((evt, idx) => {
                              const activeCat = BINHI_EVENT_CATEGORIES.find((c) => c.id === selectedCategoryId);
                              const isMatched =
                                (selectedCategoryId !== 'all' &&
                                  activeCat?.keywords.some((kw) =>
                                    evt.toLowerCase().includes(kw.toLowerCase())
                                  )) ||
                                (searchQuery.trim() !== '' &&
                                  evt.toLowerCase().includes(searchQuery.toLowerCase().trim()));

                              return (
                                <span
                                  key={idx}
                                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border transition-colors ${
                                    isMatched
                                      ? 'bg-[var(--ink)]/10 text-[var(--ink)] border-[var(--ink)]/20 font-bold'
                                      : 'bg-[var(--mist)] text-[#24252c]/70 border-transparent'
                                  }`}
                                >
                                  {evt}
                                </span>
                              );
                            })}
                            {recs.length > 2 && (
                              <span className="text-[10px] font-medium text-[#24252c]/40">
                                +{recs.length - 2} more
                              </span>
                            )}
                          </div>
                        )}
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
          </div>
        ) : (
          /* Customer Logged-in View: Show All Packages Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredPackages.map((pkg) => {
              const isSaved = wishlistIds.includes(pkg.id);
              const recs = (pkg.recommendedFor || (pkg as any).recommended_for || []) as string[];

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
                    <div className="px-5 pb-3 pt-2">
                      <h3 className="font-semibold text-lg">{pkg.name}</h3>

                      {/* Venue Sizing & Crowd Capacity Badges */}
                      {(pkg.specs?.venueSize || pkg.specs?.guestCapacity) && (
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap text-[10px] font-bold text-[#1090F8]">
                          {pkg.specs?.venueSize && (
                            <span className="bg-[#1090F8]/8 border border-[#1090F8]/15 px-2 py-0.5 rounded-full">
                              {pkg.specs.venueSize}
                            </span>
                          )}
                          {pkg.specs?.guestCapacity && (
                            <span className="bg-[#1090F8]/8 border border-[#1090F8]/15 px-2 py-0.5 rounded-full">
                              {pkg.specs.guestCapacity}
                            </span>
                          )}
                        </div>
                      )}

                      <p className="text-sm text-[#24252c]/60 mt-2 leading-relaxed">{pkg.desc}</p>

                      {/* Ideal for Events Tags */}
                      {recs.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-[#24252c]/[0.06] flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#24252c]/40 shrink-0">
                            Ideal for:
                          </span>
                          {recs.slice(0, 2).map((evt, idx) => {
                            const activeCat = BINHI_EVENT_CATEGORIES.find((c) => c.id === selectedCategoryId);
                            const isMatched =
                              (selectedCategoryId !== 'all' &&
                                activeCat?.keywords.some((kw) =>
                                  evt.toLowerCase().includes(kw.toLowerCase())
                                )) ||
                              (searchQuery.trim() !== '' &&
                                evt.toLowerCase().includes(searchQuery.toLowerCase().trim()));

                            return (
                              <span
                                key={idx}
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border transition-colors ${
                                  isMatched
                                    ? 'bg-[#1090F8]/10 text-[#1090F8] border-[#1090F8]/25 font-bold'
                                    : 'bg-[var(--mist)] text-[#24252c]/70 border-transparent'
                                }`}
                              >
                                {evt}
                              </span>
                            );
                          })}
                          {recs.length > 2 && (
                            <span className="text-[10px] font-medium text-[#24252c]/40">
                              +{recs.length - 2} more
                            </span>
                          )}
                        </div>
                      )}
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