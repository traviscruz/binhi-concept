import { useState } from 'react';

import { EQUIPMENT_ITEMS } from '../../data/equipment';
import { MonoBadge } from '../../components/shared/Badges';
import { IconArrow, IconBox } from '../../components/shared/icons';

export default function EquipmentCatalogPage({ goItemDetail }: { goItemDetail: (id: string) => void }) {
  const [category, setCategory] = useState('All');
  const categories = ['All', 'Audio Production', 'Lighting', 'Video & Visuals', 'Stage Effects'];

  const filteredItems =
    category === 'All'
      ? EQUIPMENT_ITEMS
      : EQUIPMENT_ITEMS.filter((item) => item.category === category);

  return (
    <section className="pt-28 sm:pt-36 md:pt-40 pb-20 sm:pb-24 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8 sm:mb-10">
          <MonoBadge icon={IconBox}>Full Equipment Catalog</MonoBadge>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mt-4">Individual Gear & Specifications</h1>
          <p className="text-[#24252c]/60 mt-3 text-sm sm:text-base max-w-xl mx-auto">
            Browse individual speakers, LED panels, moving head lights, and stage effect units with full technical specs.
          </p>
        </div>

        <div className="flex justify-center gap-1.5 sm:gap-2 mb-8 sm:mb-10 flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`text-xs px-3.5 sm:px-4 py-2 rounded-full font-medium transition-all ${category === cat
                  ? 'bg-[var(--ink)] text-white shadow-sm'
                  : 'bg-[var(--mist)] text-[#24252c]/60 hover:text-[var(--ink)]'
                }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              onClick={() => goItemDetail(item.id)}
              className="group rounded-[1.75rem] border border-[#24252c]/[0.08] overflow-hidden bg-white hover:shadow-xl transition-all cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="aspect-[16/9] overflow-hidden bg-[var(--mist)] relative">
                  <img src={item.img} alt={item.name} className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500" />
                  <div className="absolute top-3 left-3 bg-black/65 backdrop-blur-md text-white text-[11px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider">
                    {item.category}
                  </div>
                  <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-md text-[var(--ink)] text-xs font-semibold px-3 py-1 rounded-full border border-black/10">
                    {item.status}
                  </div>
                </div>

                <div className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="font-bold text-lg text-[var(--ink)] leading-snug">{item.name}</h3>
                    <span className="text-base font-extrabold text-[#1090F8] shrink-0">{item.price}</span>
                  </div>
                  <p className="text-sm text-[#24252c]/60 mt-2 leading-relaxed line-clamp-2">{item.desc}</p>
                </div>
              </div>

              <div className="px-6 pb-6 pt-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    goItemDetail(item.id);
                  }}
                  className="w-full bg-[var(--mist)] text-[var(--ink)] border border-[#24252c]/10 text-xs font-semibold py-3 rounded-full hover:bg-[var(--ink)] hover:text-white transition-colors inline-flex items-center justify-center gap-1.5"
                >
                  View full technical specs <IconArrow className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}