import { useState, useEffect } from 'react';
import type { Page } from '../../types';
import { EQUIPMENT_ITEMS, type EquipmentItem } from '../../data/equipment';
import { MonoBadge } from '../../components/shared/Badges';
import { PhotoCarousel } from '../../components/shared/PhotoCarousel';
import { IconBox } from '../../components/shared/icons';
import { supabase } from '../../lib/supabase';

export default function ItemDetailPage({ itemId, go }: { itemId: string; go: (p: Page) => void }) {
  const staticFallback = EQUIPMENT_ITEMS.find((i) => i.id === itemId) || EQUIPMENT_ITEMS[0];
  const [item, setItem] = useState<EquipmentItem>(staticFallback);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchItemDetail() {
      setLoading(true);
      try {
        const { data: model, error } = await supabase
          .from('equipment_models')
          .select('*')
          .or(`model_id.eq.${itemId},id.eq.${itemId}`)
          .maybeSingle();

        if (!error && model) {
          const { data: units } = await supabase
            .from('physical_units')
            .select('status')
            .eq('model_id', model.model_id);

          const availCount = (units || []).filter((u: any) => u.status === 'Available in Warehouse').length;
          const rate = Number(model.rental_rate || 0);

          const itemImg = model.image_url || model.img || staticFallback.img || '';
          const itemPhotos = (staticFallback.photos && staticFallback.photos.length > 0)
            ? staticFallback.photos
            : (model.image_url ? [{ url: model.image_url, label: model.name }] : []);

          setItem({
            id: model.model_id || model.id,
            name: model.name,
            category: model.category || 'Audio Production',
            price: rate > 0 ? `₱${rate.toLocaleString()} / day` : 'Included in Package',
            rawPrice: rate,
            status: availCount > 0 ? `${availCount} Available in Warehouse` : 'Available for Booking',
            img: itemImg,
            photos: itemPhotos,
            desc: model.description || staticFallback.desc,
            specs: [
              `Brand: ${model.brand || 'BINHI Standard'}`,
              `Equipment Serial Prefix: ${model.model_id}`,
              `Category: ${model.category}`,
              `Rental Rate: ₱${rate.toLocaleString()} / day`,
              `Total Registered Warehouse Units: ${(units || []).length} units`,
            ],
            includedInPackages: staticFallback.includedInPackages || ['Package A — Intimate', 'Package Full — Concert'],
          });
        }
      } catch (err) {
        console.error('Failed to fetch item detail from Supabase:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchItemDetail();
  }, [itemId]);

  return (
    <section className="pt-40 pb-24 px-6">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => go('equipment')}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#24252c]/60 hover:text-[var(--ink)] transition-colors mb-6 cursor-pointer"
        >
          ← Back to equipment catalog
        </button>

        {loading ? (
          <div className="space-y-6">
            <div className="h-20 bg-[var(--mist)] rounded-2xl animate-pulse" />
            <div className="h-64 bg-[var(--mist)] rounded-[2rem] animate-pulse" />
          </div>
        ) : (
          <>
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 pb-6 border-b border-[#24252c]/[0.08]">
              <div>
                <MonoBadge icon={IconBox}>{item.category}</MonoBadge>
                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight mt-3">{item.name}</h1>
                <p className="text-[#24252c]/60 mt-2 text-base max-w-xl">{item.desc}</p>
              </div>
              <div className="shrink-0 text-left md:text-right">
                <div className="text-xs text-[#24252c]/50 font-medium uppercase tracking-wider">Status: {item.status}</div>
                <div className="text-3xl font-extrabold text-[#1090F8] mt-1">{item.price}</div>
              </div>
            </div>

            <div className="mb-10">
              <PhotoCarousel
                photos={item.photos}
                mainImage={item.img}
                category={item.category}
                name={item.name}
              />
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
                className="bg-[var(--ink)] text-white text-xs font-semibold px-6 py-3 rounded-full hover:bg-[var(--ink-soft)] transition-colors cursor-pointer"
              >
                Browse packages containing this gear
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}