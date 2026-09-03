import { useState, useEffect } from 'react';
import { EQUIPMENT_ITEMS, type EquipmentItem } from '../../data/equipment';
import { MonoBadge } from '../../components/shared/Badges';
import { IconArrow, IconBox } from '../../components/shared/icons';
import { EmptyState } from '../../components/shared/EmptyState';
import { ImageWithSkeleton } from '../../components/shared/ImageWithSkeleton';
import { EquipmentCategoryPlaceholder } from '../../components/shared/EquipmentCategoryPlaceholder';
import { supabase } from '../../lib/supabase';

export default function EquipmentCatalogPage({ goItemDetail }: { goItemDetail: (id: string) => void }) {
  const [category, setCategory] = useState('All');
  const [items, setItems] = useState<EquipmentItem[]>(EQUIPMENT_ITEMS);
  const [categories, setCategories] = useState<string[]>([
    'All',
    'Audio Production',
    'Lighting',
    'Video & Visuals',
    'Stage Effects',
  ]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDatabaseEquipment() {
      setLoading(true);
      try {
        const { data: modelsData, error: modelsError } = await supabase
          .from('equipment_models')
          .select('*')
          .order('name', { ascending: true });

        const { data: unitsData } = await supabase
          .from('physical_units')
          .select('model_id, status');

        if (!modelsError && modelsData && modelsData.length > 0) {
          // Build availability lookup per model_id
          const availableCountMap: Record<string, number> = {};
          (unitsData || []).forEach((u: any) => {
            if (u.status === 'Available in Warehouse') {
              availableCountMap[u.model_id] = (availableCountMap[u.model_id] || 0) + 1;
            }
          });

          // Build dynamic categories list
          const catSet = new Set<string>(['All']);

          const dbMappedItems: EquipmentItem[] = modelsData.map((m: any) => {
            if (m.category) catSet.add(m.category);

            const availCount = availableCountMap[m.model_id] ?? availableCountMap[m.id] ?? 0;
            const rate = Number(m.rental_rate || 0);

            // Match fallback static item for photos & specs if available
            const staticMatch = EQUIPMENT_ITEMS.find(
              (si) => si.id === m.model_id || si.name.toLowerCase() === m.name.toLowerCase()
            );

            const itemImg = m.image_url || m.img || staticMatch?.img || '';
            const itemPhotos = (staticMatch?.photos && staticMatch.photos.length > 0)
              ? staticMatch.photos
              : (m.image_url ? [{ url: m.image_url, label: m.name }] : []);

            return {
              id: m.model_id || m.id,
              name: m.name,
              category: m.category || 'Audio Production',
              price: rate > 0 ? `₱${rate.toLocaleString()}/day` : 'Included in Package',
              rawPrice: rate,
              status: availCount > 0 ? `${availCount} Available in Warehouse` : 'Available for Booking',
              img: itemImg,
              photos: itemPhotos,
              desc: m.description || m.desc || staticMatch?.desc || 'Professional-grade event production equipment maintained to BINHI quality standards.',
              specs: staticMatch?.specs || [
                `Brand: ${m.brand || 'BINHI Standard'}`,
                `Model ID: ${m.model_id}`,
                `Category: ${m.category}`,
                `Rental Rate: ₱${rate.toLocaleString()} / day`,
              ],
              includedInPackages: staticMatch?.includedInPackages || ['Package A — Intimate', 'Package Full — Concert'],
            };
          });

          setItems(dbMappedItems);
          setCategories(Array.from(catSet));
        }
      } catch (err) {
        console.error('Failed to fetch equipment catalog from Supabase:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchDatabaseEquipment();
  }, []);

  const filteredItems =
    category === 'All'
      ? items
      : items.filter((item) => item.category === category);

  return (
    <section className="pt-28 sm:pt-36 md:pt-40 pb-20 sm:pb-24 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8 sm:mb-10">
          <MonoBadge icon={IconBox}>Full Equipment Catalog</MonoBadge>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mt-4">
            Individual Gear & Specifications
          </h1>
          <p className="text-[#24252c]/60 mt-3 text-sm sm:text-base max-w-xl mx-auto">
            Browse live inventory equipment models, active warehouse availability, and technical specifications directly from our database.
          </p>
        </div>

        {/* Category Pills */}
        <div className="flex justify-center gap-1.5 sm:gap-2 mb-8 sm:mb-10 flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`text-xs px-3.5 sm:px-4 py-2 rounded-full font-medium transition-all cursor-pointer ${
                category === cat
                  ? 'bg-[var(--ink)] text-white shadow-sm'
                  : 'bg-[var(--mist)] text-[#24252c]/60 hover:text-[var(--ink)]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-64 bg-[var(--mist)] rounded-[1.75rem] animate-pulse" />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#24252c]/[0.08] shadow-sm">
            <EmptyState
              title="No Equipment Items Found"
              description="No equipment matches your selected category filter. Try selecting a different category."
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                onClick={() => goItemDetail(item.id)}
                className="group rounded-[1.75rem] border border-[#24252c]/[0.08] overflow-hidden bg-white hover:shadow-xl transition-all cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="aspect-[16/9] overflow-hidden bg-[#12141d] relative">
                    {item.img && item.img.trim() !== '' ? (
                      <ImageWithSkeleton
                        src={item.img}
                        alt={item.name}
                        className="w-full h-full group-hover:scale-[1.04] transition-transform duration-500"
                      />
                    ) : (
                      <EquipmentCategoryPlaceholder category={item.category} name={item.name} />
                    )}
                    <div className="absolute top-3 left-3 bg-black/65 backdrop-blur-md text-white text-[11px] font-semibold px-3 py-1 rounded-full uppercase tracking-wider z-10">
                      {item.category}
                    </div>
                    <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-md text-[var(--ink)] text-xs font-semibold px-3 py-1 rounded-full border border-black/10 z-10">
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
                    className="w-full bg-[var(--mist)] text-[var(--ink)] border border-[#24252c]/10 text-xs font-semibold py-3 rounded-full hover:bg-[var(--ink)] hover:text-white transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    View full technical specs <IconArrow className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}