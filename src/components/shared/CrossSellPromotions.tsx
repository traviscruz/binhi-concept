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

function normStr(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
}

function inclusionMatchesModel(inclusion: string, modelName: string): boolean {
  const stripped = inclusion.replace(/^\d+\s*[xX]\s+/, '');
  const words = normStr(stripped).split(' ').filter((w) => w.length > 2);
  const normModel = normStr(modelName);
  const matched = words.filter((w) => normModel.includes(w));
  return matched.length >= Math.max(1, Math.floor(words.length * 0.4));
}

/**
 * Smart engine to discover and construct real frequently paired add-on bundles
 * from actual available inventory in the database.
 * Strictly excludes any equipment already included in the default package inclusions.
 */
export function generateSmartAddonBundles(
  availableModels: AddonInventoryItem[],
  existingInclusions: string[] = []
): CrossSellBundle[] {
  if (!availableModels || availableModels.length < 2) return [];

  // 1. Strictly filter to only items with positive available inventory AND that do NOT belong to the package's default inclusions
  const available = availableModels.filter((m) => {
    if (!m || m.availableCount <= 0 || m.rentalRate <= 0) return false;
    if (existingInclusions.some((inc) => inclusionMatchesModel(inc, m.name))) {
      return false;
    }
    return true;
  });

  if (available.length < 2) return [];

  const bundles: CrossSellBundle[] = [];
  const usedModelPairs = new Set<string>();

  const createBundle = (
    itemA: AddonInventoryItem,
    itemB: AddonInventoryItem,
    titleHint?: string
  ): CrossSellBundle | null => {
    if (!itemA || !itemB || itemA.modelId === itemB.modelId) return null;
    if (itemA.availableCount <= 0 || itemB.availableCount <= 0) return null;

    const pairKey = [itemA.modelId, itemB.modelId].sort().join('___');
    if (usedModelPairs.has(pairKey)) return null;
    usedModelPairs.add(pairKey);

    const qtyA = 1;
    const qtyB = Math.min(2, Math.max(1, itemB.availableCount));

    const items: CrossSellBundleItem[] = [
      {
        modelId: itemA.modelId,
        name: itemA.name,
        qty: qtyA,
        rentalRate: itemA.rentalRate,
      },
      {
        modelId: itemB.modelId,
        name: itemB.name,
        qty: qtyB,
        rentalRate: itemB.rentalRate,
      },
    ];

    const originalPrice = items.reduce((sum, it) => sum + it.rentalRate * it.qty, 0);
    const bundlePrice = Math.round(originalPrice * 0.8); // 20% bundle discount
    const savings = originalPrice - bundlePrice;

    // Generate dynamic readable title based on the paired items & categories
    const catA = itemA.category || 'Gear';
    const catB = itemB.category || 'Gear';
    let title = titleHint;
    if (!title) {
      if (catA !== catB) {
        title = `${itemA.name} & ${itemB.name} Combo`;
      } else {
        title = `${itemA.name} & ${itemB.name} Duo Pack`;
      }
    }

    return {
      id: `bundle-${itemA.modelId}-${itemB.modelId}`,
      title,
      subtitle: `${itemA.name} + ${qtyB > 1 ? `${qtyB}x ` : ''}${itemB.name}`,
      tag: '20% OFF Combo',
      originalPrice,
      bundlePrice,
      savings,
      items,
      inclusions: [
        `1x ${itemA.name}`,
        `${qtyB}x ${itemB.name}`,
        '20% group rental discount applied',
      ],
    };
  };

  // Categorize available non-included add-ons
  const fxItems = available.filter((m) => {
    const text = `${normStr(m.name)} ${normStr(m.category || '')}`;
    return text.includes('fog') || text.includes('smoke') || text.includes('haze') || text.includes('spark') || text.includes('bubble') || text.includes('effect') || text.includes('pyro');
  });

  const lightingItems = available.filter((m) => {
    const text = `${normStr(m.name)} ${normStr(m.category || '')}`;
    return (text.includes('light') || text.includes('par') || text.includes('beam') || text.includes('moving') || text.includes('head') || text.includes('spot') || text.includes('wash') || text.includes('laser')) && !fxItems.some(f => f.modelId === m.modelId);
  });

  const audioItems = available.filter((m) => {
    const text = `${normStr(m.name)} ${normStr(m.category || '')}`;
    return (text.includes('mic') || text.includes('speaker') || text.includes('subwoofer') || text.includes('monitor') || text.includes('audio') || text.includes('sound') || text.includes('mixer')) && !fxItems.some(f => f.modelId === m.modelId) && !lightingItems.some(l => l.modelId === m.modelId);
  });

  // Strategy 1: Special FX + Lighting
  if (fxItems.length > 0 && lightingItems.length > 0) {
    const b = createBundle(fxItems[0], lightingItems[0], 'Atmospheric & Lighting Enhancement Pack');
    if (b) bundles.push(b);
  }

  // Strategy 2: Audio + Lighting or Audio + Special FX
  if (audioItems.length > 0 && lightingItems.length > 1) {
    const b = createBundle(audioItems[0], lightingItems[1], 'Stage Audio & Visuals Pack');
    if (b) bundles.push(b);
  } else if (audioItems.length > 0 && fxItems.length > 1) {
    const b = createBundle(audioItems[0], fxItems[1], 'Audio & Atmospheric FX Pack');
    if (b) bundles.push(b);
  } else if (audioItems.length > 1) {
    const b = createBundle(audioItems[0], audioItems[1], 'Audio Rig Expansion Pack');
    if (b) bundles.push(b);
  }

  // Dynamic Fallback: Pair remaining top available items from different categories or different models
  if (bundles.length < 2 && available.length >= 2) {
    for (let i = 0; i < available.length - 1; i++) {
      for (let j = i + 1; j < available.length; j++) {
        const itemA = available[i];
        const itemB = available[j];
        const b = createBundle(itemA, itemB);
        if (b) {
          bundles.push(b);
          if (bundles.length >= 2) break;
        }
      }
      if (bundles.length >= 2) break;
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
      className={`rounded-2xl bg-gradient-to-br from-[var(--mist)] to-blue-50/60 border border-[#1090F8]/20 space-y-3.5 ${
        compact ? 'p-3.5 mb-4' : 'p-4 sm:p-5 mb-5'
      }`}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#1090F8] animate-pulse shrink-0" />
          <h4 className="font-extrabold text-[var(--ink)] uppercase tracking-wider text-xs sm:text-sm">
            Frequently Paired Upgrades (Bundle &amp; Save)
          </h4>
        </div>
        <span className="text-[10px] font-bold text-[#1090F8] bg-[#1090F8]/10 px-2.5 py-0.5 rounded-full whitespace-nowrap shrink-0">
          Save 20%
        </span>
      </div>

      <div className="space-y-3">
        {bundles.map((b) => {
          const isSelected = selectedBundleIds.includes(b.id);
          return (
            <div
              key={b.id}
              onClick={() => onToggleBundle(b)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                isSelected
                  ? 'bg-blue-50/90 border-[#1090F8] shadow-sm ring-1 ring-[#1090F8]/30'
                  : 'bg-white border-[#24252c]/[0.08] hover:border-[#1090F8]/40 hover:shadow-sm'
              }`}
            >
              <div>
                {/* Header: Tag + Price */}
                <div className="flex items-center justify-between gap-2 flex-wrap pb-1">
                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 whitespace-nowrap shrink-0">
                    {b.tag}
                  </span>
                  <div className="flex items-baseline gap-1.5 whitespace-nowrap shrink-0">
                    <span className="text-[11px] text-[#24252c]/40 line-through">
                      ₱{b.originalPrice.toLocaleString()}
                    </span>
                    <span className="text-sm font-black text-[#1090F8]">
                      ₱{b.bundlePrice.toLocaleString()}
                    </span>
                  </div>
                </div>

                <h5 className="font-extrabold text-sm text-[var(--ink)] mt-1.5 leading-snug">{b.title}</h5>
                <p className="text-xs text-[#24252c]/60 mt-0.5 leading-snug">{b.subtitle}</p>

                <ul className="mt-2.5 space-y-1.5 text-[11px] text-[#24252c]/75 bg-[var(--mist)]/60 p-2.5 rounded-xl border border-[#24252c]/[0.04]">
                  {b.inclusions.map((inc, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <IconCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span className="leading-tight">{inc}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Bottom Action Bar: Savings + Button */}
              <div className="pt-2.5 border-t border-[#24252c]/[0.06] flex items-center justify-between gap-3 flex-wrap">
                <span className="text-xs font-bold text-emerald-600 whitespace-nowrap">
                  Save ₱{b.savings.toLocaleString()} (20% Off)
                </span>
                <button
                  type="button"
                  className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shadow-2xs ${
                    isSelected
                      ? 'bg-[#1090F8] text-white shadow-sm'
                      : 'bg-[var(--mist)] text-[var(--ink)] hover:bg-[#1090F8] hover:text-white'
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
