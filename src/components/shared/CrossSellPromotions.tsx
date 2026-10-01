import { useMemo } from 'react';
import { IconCheck, IconStar } from './icons';

export interface CrossSellBundleItem {
  modelId: string;
  name: string;
  qty: number;
  rentalRate: number;
}

export interface CrossSellBundle {
  id: string;
  title: string;
  subtitle: string;
  tag: string;
  originalPrice: number;
  bundlePrice: number;
  savings: number;
  items: CrossSellBundleItem[];
  inclusions: string[];
}

export interface AddonInventoryItem {
  modelId: string;
  name: string;
  brand?: string;
  category?: string;
  rentalRate: number;
  availableCount: number;
}

/**
 * Smart engine to discover and construct real frequently paired add-on bundles
 * from actual available inventory in the database.
 * If no matching available equipment pairs are found, returns an empty array.
 */
export function generateSmartAddonBundles(
  availableModels: AddonInventoryItem[]
): CrossSellBundle[] {
  if (!availableModels || availableModels.length < 2) return [];

  // Filter only items with positive available inventory
  const available = availableModels.filter((m) => m.availableCount > 0 && m.rentalRate > 0);
  if (available.length < 2) return [];

  const bundles: CrossSellBundle[] = [];

  const norm = (s?: string) => (s || '').toLowerCase();

  // 1. Atmosphere & Special FX Duo (e.g. Smoke/Fog/Haze + Cold Sparks / Bubbles / Pyros)
  const fogModel = available.find((m) => {
    const text = `${norm(m.name)} ${norm(m.category)} ${norm(m.brand)}`;
    return text.includes('fog') || text.includes('smoke') || text.includes('haze') || text.includes('cloud');
  });

  const fxModel = available.find((m) => {
    if (m.modelId === fogModel?.modelId) return false;
    const text = `${norm(m.name)} ${norm(m.category)} ${norm(m.brand)}`;
    return (
      text.includes('spark') ||
      text.includes('pyro') ||
      text.includes('bubble') ||
      text.includes('flame') ||
      text.includes('confetti') ||
      text.includes('co2')
    );
  });

  if (fogModel && fxModel) {
    const items: CrossSellBundleItem[] = [
      {
        modelId: fogModel.modelId,
        name: fogModel.name,
        qty: 1,
        rentalRate: fogModel.rentalRate,
      },
      {
        modelId: fxModel.modelId,
        name: fxModel.name,
        qty: Math.min(2, fxModel.availableCount),
        rentalRate: fxModel.rentalRate,
      },
    ];

    const originalPrice = items.reduce((sum, it) => sum + it.rentalRate * it.qty, 0);
    const bundlePrice = Math.round(originalPrice * 0.8); // 20% bundle discount
    const savings = originalPrice - bundlePrice;

    bundles.push({
      id: 'bundle-atmosphere-vip',
      title: 'Atmosphere VIP Special Effects Bundle',
      subtitle: `${fogModel.name} + ${items[1].qty}x ${fxModel.name}`,
      tag: 'Frequently Paired for Weddings & Debuts',
      originalPrice,
      bundlePrice,
      savings,
      items,
      inclusions: [
        `${fogModel.name} (Low-lying clouds / ambient haze for grand entrance)`,
        `${items[1].qty}x ${fxModel.name} (Indoor non-flammable pyrotechnic/effect)`,
        'Dedicated operator technician & trigger accessories included',
      ],
    });
  }

  // 2. Live Vocal & Acoustic Stage Monitor Duo (e.g. Wireless Microphones + Active Stage Monitors)
  const micModel = available.find((m) => {
    const text = `${norm(m.name)} ${norm(m.category)} ${norm(m.brand)}`;
    return (
      text.includes('mic') ||
      text.includes('wireless') ||
      text.includes('uhf') ||
      text.includes('shure') ||
      text.includes('sennheiser')
    );
  });

  const monitorModel = available.find((m) => {
    if (m.modelId === micModel?.modelId) return false;
    const text = `${norm(m.name)} ${norm(m.category)} ${norm(m.brand)}`;
    return (
      text.includes('monitor') ||
      text.includes('wedge') ||
      text.includes('in-ear') ||
      text.includes('subwoofer') ||
      text.includes('stage speaker')
    );
  });

  if (micModel && monitorModel) {
    const items: CrossSellBundleItem[] = [
      {
        modelId: micModel.modelId,
        name: micModel.name,
        qty: Math.min(2, micModel.availableCount),
        rentalRate: micModel.rentalRate,
      },
      {
        modelId: monitorModel.modelId,
        name: monitorModel.name,
        qty: Math.min(2, monitorModel.availableCount),
        rentalRate: monitorModel.rentalRate,
      },
    ];

    const originalPrice = items.reduce((sum, it) => sum + it.rentalRate * it.qty, 0);
    const bundlePrice = Math.round(originalPrice * 0.8); // 20% bundle discount
    const savings = originalPrice - bundlePrice;

    bundles.push({
      id: 'bundle-acoustic-live',
      title: 'Live Acoustic & Vocal Monitor Bundle',
      subtitle: `${items[0].qty}x ${micModel.name} + ${items[1].qty}x ${monitorModel.name}`,
      tag: 'Recommended for Live Bands & Performers',
      originalPrice,
      bundlePrice,
      savings,
      items,
      inclusions: [
        `${items[0].qty}x ${micModel.name} (Pro handheld wireless UHF microphones)`,
        `${items[1].qty}x ${monitorModel.name} (Active performer floor wedges)`,
        'High-grade balanced XLR cabling & RF antenna management',
      ],
    });
  }

  // 3. Stage Lighting & Visuals Duo (e.g. Moving Heads + LED Wash/Par)
  const movingHeadModel = available.find((m) => {
    const text = `${norm(m.name)} ${norm(m.category)} ${norm(m.brand)}`;
    return text.includes('moving') || text.includes('beam') || text.includes('sharpy') || text.includes('spot');
  });

  const washModel = available.find((m) => {
    if (m.modelId === movingHeadModel?.modelId) return false;
    const text = `${norm(m.name)} ${norm(m.category)} ${norm(m.brand)}`;
    return (
      text.includes('par') ||
      text.includes('wash') ||
      text.includes('ambient') ||
      text.includes('led bar') ||
      text.includes('strobe')
    );
  });

  if (movingHeadModel && washModel) {
    const items: CrossSellBundleItem[] = [
      {
        modelId: movingHeadModel.modelId,
        name: movingHeadModel.name,
        qty: Math.min(2, movingHeadModel.availableCount),
        rentalRate: movingHeadModel.rentalRate,
      },
      {
        modelId: washModel.modelId,
        name: washModel.name,
        qty: Math.min(4, washModel.availableCount),
        rentalRate: washModel.rentalRate,
      },
    ];

    const originalPrice = items.reduce((sum, it) => sum + it.rentalRate * it.qty, 0);
    const bundlePrice = Math.round(originalPrice * 0.8); // 20% bundle discount
    const savings = originalPrice - bundlePrice;

    bundles.push({
      id: 'bundle-lighting-pro',
      title: 'Concert Lighting & Beam FX Bundle',
      subtitle: `${items[0].qty}x ${movingHeadModel.name} + ${items[1].qty}x ${washModel.name}`,
      tag: 'High Impact Stage Illumination',
      originalPrice,
      bundlePrice,
      savings,
      items,
      inclusions: [
        `${items[0].qty}x ${movingHeadModel.name} (Dynamic moving light heads)`,
        `${items[1].qty}x ${washModel.name} (Full-spectrum stage color wash)`,
        'Synchronized DMX lighting programming & master stage controller',
      ],
    });
  }

  // 4. Dynamic Pair Fallback: If no preset pairs matched, group top 2 available items from different categories
  if (bundles.length === 0) {
    const categories = Array.from(new Set(available.map((m) => m.category || 'General')));
    if (categories.length >= 2) {
      const itemA = available.find((m) => m.category === categories[0]);
      const itemB = available.find((m) => m.category === categories[1]);
      if (itemA && itemB) {
        const items: CrossSellBundleItem[] = [
          { modelId: itemA.modelId, name: itemA.name, qty: 1, rentalRate: itemA.rentalRate },
          { modelId: itemB.modelId, name: itemB.name, qty: 1, rentalRate: itemB.rentalRate },
        ];
        const originalPrice = items.reduce((sum, it) => sum + it.rentalRate * it.qty, 0);
        const bundlePrice = Math.round(originalPrice * 0.8);
        const savings = originalPrice - bundlePrice;

        bundles.push({
          id: 'bundle-production-duo',
          title: 'Frequently Paired Equipment Duo',
          subtitle: `${itemA.name} + ${itemB.name}`,
          tag: 'Smart Synergy Production Bundle',
          originalPrice,
          bundlePrice,
          savings,
          items,
          inclusions: [
            `1x ${itemA.name} (${itemA.category})`,
            `1x ${itemB.name} (${itemB.category})`,
            '20% Package Bundle Discount Included',
          ],
        });
      }
    }
  }

  return bundles;
}

export function CrossSellPromotions({
  bundles = [],
  selectedBundleIds = [],
  onToggleBundle,
  compact = false,
}: {
  bundles?: CrossSellBundle[];
  selectedBundleIds: string[];
  onToggleBundle: (bundle: CrossSellBundle) => void;
  compact?: boolean;
}) {
  // If no smart bundles found from available inventory, gracefully do not render
  if (!bundles || bundles.length === 0) {
    return null;
  }

  return (
    <div
      className={`rounded-2xl bg-gradient-to-br from-[var(--mist)] to-blue-50/50 border border-[#1090F8]/20 space-y-3 ${
        compact ? 'p-3.5 mb-4' : 'p-5 mb-5'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#1090F8] animate-pulse" />
          <h4
            className={`font-black text-[var(--ink)] uppercase tracking-wider ${
              compact ? 'text-[11px]' : 'text-xs sm:text-sm'
            }`}
          >
            Frequently Paired Upgrades (Bundle &amp; Save)
          </h4>
        </div>
        <span className="text-[10px] font-bold text-[#1090F8] bg-[#1090F8]/10 px-2 py-0.5 rounded-full">
          Save 20%
        </span>
      </div>

      <div className={`grid gap-2.5 ${compact ? 'grid-cols-1' : 'sm:grid-cols-2'}`}>
        {bundles.map((b) => {
          const isSelected = selectedBundleIds.includes(b.id);
          return (
            <div
              key={b.id}
              onClick={() => onToggleBundle(b)}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-2.5 ${
                isSelected
                  ? 'bg-blue-50/90 border-[#1090F8] shadow-xs'
                  : 'bg-white border-[#24252c]/[0.08] hover:border-[#1090F8]/40 shadow-2xs'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-1.5 flex-wrap">
                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    {b.tag}
                  </span>
                  <div className="text-right whitespace-nowrap">
                    <span className="text-[10px] text-[#24252c]/40 line-through mr-1">
                      ₱{b.originalPrice.toLocaleString()}
                    </span>
                    <span className="text-xs font-black text-[#1090F8]">
                      ₱{b.bundlePrice.toLocaleString()}
                    </span>
                  </div>
                </div>

                <h5 className="font-extrabold text-xs text-[var(--ink)] mt-1.5 leading-tight">{b.title}</h5>
                <p className="text-[11px] text-[#24252c]/60 mt-0.5 leading-snug">{b.subtitle}</p>

                <ul className="mt-2 space-y-1 text-[10px] text-[#24252c]/70">
                  {b.inclusions.map((inc, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <IconCheck className="w-3 h-3 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{inc}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-2 border-t border-[#24252c]/[0.06] flex items-center justify-between">
                <span className="text-[10px] font-bold text-emerald-600">
                  Save ₱{b.savings.toLocaleString()}
                </span>
                <button
                  type="button"
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-colors cursor-pointer flex items-center gap-1 ${
                    isSelected
                      ? 'bg-[#1090F8] text-white'
                      : 'bg-[var(--mist)] text-[var(--ink)] hover:bg-[#1090F8]/10 hover:text-[#1090F8]'
                  }`}
                >
                  {isSelected ? '✓ Added to Rig' : '+ Add Bundle Deal'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
