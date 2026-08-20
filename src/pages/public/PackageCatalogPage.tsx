import { FEATURED_PACKAGES } from '../../data/packages';
import { MonoBadge } from '../../components/shared/Badges';
import { IconArrow, IconTicket, IconHeart } from '../../components/shared/icons';

export default function PackageCatalogPage({
  goPackageDetail,
  isCustomer,
  wishlistIds = [],
  toggleWishlist,
}: {
  goPackageDetail: (id: string) => void;
  isCustomer?: boolean;
  wishlistIds?: string[];
  toggleWishlist?: (id: string) => void;
}) {
  return (
    <section className="pt-28 sm:pt-36 md:pt-40 pb-20 sm:pb-24 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8 sm:mb-12">
          <MonoBadge icon={IconTicket}>All Packages</MonoBadge>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mt-4">Pick your event setup</h1>
          <p className="text-[#24252c]/60 mt-3 text-sm sm:text-base max-w-xl mx-auto">
            Browse our signature sound, lighting, and stage production packages. Click any package to view photos, equipment inclusions, and date availability.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {FEATURED_PACKAGES.map((pkg) => {
            const isSaved = wishlistIds.includes(pkg.id);
            return (
              <div
                key={pkg.id}
                onClick={() => goPackageDetail(pkg.id)}
                className="group rounded-[1.75rem] border border-[#24252c]/[0.08] overflow-hidden bg-white hover:shadow-xl transition-all cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="aspect-[4/3] overflow-hidden bg-[var(--mist)] relative">
                    <img src={pkg.img} alt={pkg.name} className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500" />
                    {isCustomer && (
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
                      {pkg.photos.length} Photos
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
      </div>
    </section>
  );
}