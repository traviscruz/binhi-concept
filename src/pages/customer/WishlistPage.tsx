import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import { FEATURED_PACKAGES, type PackageData } from '../../data/packages';
import { IconHeart, IconArrow } from '../../components/shared/icons';
import { EmptyState } from '../../components/shared/EmptyState';
import { ImageWithSkeleton } from '../../components/shared/ImageWithSkeleton';

export default function WishlistPage({
  go,
  goPackageDetail,
  wishlistIds = [],
  toggleWishlist,
  packages = [],
}: {
  go: (p: Page) => void;
  goPackageDetail: (id: string) => void;
  wishlistIds?: string[];
  toggleWishlist?: (id: string) => void;
  packages?: PackageData[];
}) {
  const allPackages = packages && packages.length > 0 ? packages : FEATURED_PACKAGES;
  const wishlistItems = allPackages.filter((pkg) => wishlistIds.includes(pkg.id));

  return (
    <section className="pt-36 pb-24 px-6 min-h-screen bg-white">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-[2rem] p-6 md:p-8 border border-[#24252c]/[0.08] shadow-sm">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#24252c]/[0.06]">
            <div>
              <MonoBadge icon={IconHeart}>Saved Items ({wishlistItems.length})</MonoBadge>
              <h1 className="text-3xl font-extrabold tracking-tight text-[var(--ink)] mt-2">
                Saved Wishlist & Packages
              </h1>
              <p className="text-xs text-[#24252c]/60 mt-1">Bookmarked production setups for your upcoming event dates.</p>
            </div>
            <button
              onClick={() => go('packages')}
              className="bg-[var(--mist)] text-[var(--ink)] border border-[#24252c]/10 text-xs font-bold px-4 py-2.5 rounded-full hover:bg-[var(--ink)] hover:text-white transition-colors"
            >
              Browse Full Catalog
            </button>
          </div>

          {wishlistItems.length === 0 ? (
            <div className="bg-[var(--mist)] rounded-2xl border border-[#24252c]/[0.05]">
              <EmptyState
                icon={IconHeart}
                title="Your Wishlist is Empty"
                description="Browse packages and click 'Add to Wishlist' to save your favourite event setups here."
              />
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              {wishlistItems.map((pkg) => (
                <div
                  key={pkg.id}
                  className="p-5 rounded-2xl bg-[var(--mist)] border border-[#24252c]/[0.05] flex flex-col justify-between hover:shadow-md transition-all group"
                >
                  <div>
                    <div className="aspect-[16/9] rounded-xl overflow-hidden mb-4 relative bg-white">
                      <ImageWithSkeleton src={pkg.img} alt={pkg.name} className="w-full h-full group-hover:scale-[1.03] transition-transform duration-500" />
                      <button
                        onClick={() => toggleWishlist?.(pkg.id)}
                        className="absolute top-3 right-3 bg-white/90 hover:bg-rose-50 hover:text-rose-600 text-[var(--ink)] text-xs font-semibold px-3 py-1 rounded-full border border-black/10 transition-colors shadow-sm"
                        title="Remove from wishlist"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-[#1090F8]">{pkg.tag}</span>
                      <span className="font-extrabold text-base text-[var(--ink)]">{pkg.price}</span>
                    </div>

                    <h3 className="font-bold text-lg text-[var(--ink)] mt-1">{pkg.name}</h3>
                    <p className="text-xs text-[#24252c]/60 mt-1.5 leading-relaxed line-clamp-2">{pkg.desc}</p>
                  </div>

                  <div className="mt-5 pt-3 border-t border-[#24252c]/[0.06] flex items-center gap-2">
                    <button
                      onClick={() => goPackageDetail(pkg.id)}
                      className="w-full bg-[var(--ink)] text-white text-xs font-semibold py-3 rounded-full hover:bg-[var(--ink-soft)] transition-colors shadow-sm inline-flex items-center justify-center gap-2"
                    >
                      <span>Customize & Book Setup</span>
                      <IconArrow className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
