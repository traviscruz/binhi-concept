import type { Page } from '../../types';
import { EQUIPMENT_ITEMS } from '../../data/equipment';
import { MonoBadge } from '../../components/shared/Badges';
import { PhotoCarousel } from '../../components/shared/PhotoCarousel';
import { IconBox } from '../../components/shared/icons';

export default function ItemDetailPage({ itemId, go }: { itemId: string; go: (p: Page) => void }) {
  const item = EQUIPMENT_ITEMS.find((i) => i.id === itemId) || EQUIPMENT_ITEMS[0];

  return (
    <section className="pt-40 pb-24 px-6">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => go('equipment')}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#24252c]/60 hover:text-[var(--ink)] transition-colors mb-6"
        >
          ← Back to equipment catalog
        </button>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 pb-6 border-b border-[#24252c]/[0.08]">
          <div>
            <MonoBadge icon={IconBox}>{item.category}</MonoBadge>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mt-3">{item.name}</h1>
            <p className="text-[#24252c]/60 mt-2 text-base max-w-xl">{item.desc}</p>
          </div>
          <div className="shrink-0 text-left md:text-right">
            <div className="text-xs text-[#24252c]/50 font-medium uppercase tracking-wider">Status: {item.status}</div>
            <div className="text-3xl font-extrabold text-[#1090F8] mt-1">{item.price} <span className="text-xs font-medium text-[#24252c]/50">/ day</span></div>
          </div>
        </div>

        <div className="mb-10">
          <PhotoCarousel photos={item.photos} />
        </div>

        <div className="bg-[var(--mist)] rounded-[2rem] p-6 md:p-8 border border-[#24252c]/[0.06] mb-8">
          <h3 className="text-xl font-bold mb-4">Technical Specifications</h3>
          <div className="space-y-3">
            {item.specs.map((spec, i) => (
              <div key={i} className="p-3.5 bg-white rounded-xl border border-[#24252c]/[0.05] text-sm font-medium text-[var(--ink)]">
                {spec}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-[2rem] p-6 md:p-8 border border-[#24252c]/[0.08] flex items-center justify-between flex-wrap gap-4">
          <div>
            <h4 className="font-bold text-base">Included in Standard Packages</h4>
            <p className="text-xs text-[#24252c]/60 mt-1">{item.includedInPackages.join(' · ')}</p>
          </div>
          <button
            onClick={() => go('packages')}
            className="bg-[var(--ink)] text-white text-xs font-semibold px-6 py-3 rounded-full hover:bg-[var(--ink-soft)] transition-colors"
          >
            Browse packages containing this gear
          </button>
        </div>
      </div>
    </section>
  );
}