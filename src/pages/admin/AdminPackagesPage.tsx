import { useState } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import { IconTicket, IconX, IconBox, IconUser } from '../../components/shared/icons';
import { FEATURED_PACKAGES, type PackageData } from '../../data/packages';

const inputClass =
  'w-full rounded-full border px-4 py-2.5 text-xs bg-[#EEEEEE] text-[var(--ink)] placeholder:text-[#24252c]/40 focus:outline-none focus:border-[#1090F8] border-transparent transition-colors';

interface InventoryItemMap {
  id: string;
  name: string;
  category: string;
  defaultQty: number;
}

const INVENTORY_ITEMS_ROSTER: InventoryItemMap[] = [
  { id: 'item-spk', name: 'Yamaha Active PA 12" Speakers (1000W)', category: 'Audio', defaultQty: 2 },
  { id: 'item-sub', name: 'Yamaha Dual 15" Active Subwoofers', category: 'Audio', defaultQty: 2 },
  { id: 'item-led', name: 'P3 HD Indoor LED Wall Panels (500x500mm)', category: 'Video', defaultQty: 12 },
  { id: 'item-lgt', name: 'Chauvet 7R Moving Head Stage Lights', category: 'Lighting', defaultQty: 4 },
  { id: 'item-mic', name: 'UHF Wireless Microphones & Receiver', category: 'Audio', defaultQty: 2 },
  { id: 'item-fog', name: 'Low-Lying Heavy Fog Cloud Effect Machine', category: 'Effects', defaultQty: 1 },
  { id: 'item-dmx', name: 'DMX Stage Lighting Control Console', category: 'Lighting', defaultQty: 1 },
  { id: 'item-trs', name: 'Heavy Duty Stage Trussing & Stands', category: 'Staging', defaultQty: 2 },
];

export default function AdminPackagesPage({ go }: { go: (p: Page) => void }) {
  const [packages, setPackages] = useState<PackageData[]>(FEATURED_PACKAGES);

  // Modals State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPkg, setEditingPkg] = useState<PackageData | null>(null);

  // Form Fields State
  const [pkgName, setPkgName] = useState('');
  const [pkgTag, setPkgTag] = useState('Standard Setup');
  const [pkgPrice, setPkgPrice] = useState('₱28,000');
  const [pkgDesc, setPkgDesc] = useState('');
  const [pkgImg, setPkgImg] = useState('');
  const [pkgRecommendedFor, setPkgRecommendedFor] = useState('');
  const [specPower, setSpecPower] = useState('220V 30A Dedicated Line');
  const [specSetupTime, setSpecSetupTime] = useState('2.5 Hours');
  const [specCrewSize, setSpecCrewSize] = useState('3 Technicians');

  // Inventory Selection & Qty Mapping
  const [selectedItems, setSelectedItems] = useState<{ [itemId: string]: { checked: boolean; qty: number } }>({
    'item-spk': { checked: true, qty: 2 },
    'item-mic': { checked: true, qty: 2 },
  });

  const toggleItemCheck = (itemId: string, defaultQty: number) => {
    setSelectedItems((prev) => {
      const current = prev[itemId] || { checked: false, qty: defaultQty };
      return {
        ...prev,
        [itemId]: { ...current, checked: !current.checked },
      };
    });
  };

  const updateItemQty = (itemId: string, delta: number) => {
    setSelectedItems((prev) => {
      const current = prev[itemId] || { checked: true, qty: 1 };
      const newQty = Math.max(1, current.qty + delta);
      return {
        ...prev,
        [itemId]: { ...current, qty: newQty },
      };
    });
  };

  const generateInclusionsList = (): string[] => {
    const mapped = INVENTORY_ITEMS_ROSTER.filter((item) => selectedItems[item.id]?.checked).map(
      (item) => `${selectedItems[item.id].qty}x ${item.name}`
    );
    mapped.push(`Full Load-in, Technical Crew (${specCrewSize}) & On-site Soundcheck`);
    return mapped;
  };

  const handleOpenEditModal = (pkg: PackageData) => {
    setEditingPkg(pkg);
    setPkgName(pkg.name);
    setPkgTag(pkg.tag);
    setPkgPrice(pkg.price);
    setPkgDesc(pkg.desc);
    setPkgImg(pkg.img);
    setPkgRecommendedFor(pkg.recommendedFor ? pkg.recommendedFor.join(', ') : '');
    setSpecPower(pkg.specs?.powerReq || '220V 30A Line');
    setSpecSetupTime(pkg.specs?.setupTime || '2.5 Hours');
    setSpecCrewSize(pkg.specs?.crewSize || '3 Technicians');

    const initialMap: { [itemId: string]: { checked: boolean; qty: number } } = {};
    INVENTORY_ITEMS_ROSTER.forEach((item) => {
      initialMap[item.id] = { checked: true, qty: item.defaultQty };
    });
    setSelectedItems(initialMap);
  };

  const handleOpenCreateModal = () => {
    setEditingPkg(null);
    setPkgName('');
    setPkgTag('Signature Event Setup');
    setPkgPrice('₱35,000');
    setPkgDesc('Complete audio, lighting, and stage setup for medium to large event celebrations.');
    setPkgImg('https://picsum.photos/seed/binhi-pkg-new/640/480');
    setPkgRecommendedFor('Weddings up to 150 guests, Corporate Galas, 18th Birthdays');
    setSpecPower('220V 30A Dedicated Line');
    setSpecSetupTime('3.0 Hours');
    setSpecCrewSize('3 Technicians');

    const initialMap: { [itemId: string]: { checked: boolean; qty: number } } = {};
    INVENTORY_ITEMS_ROSTER.forEach((item) => {
      initialMap[item.id] = { checked: true, qty: item.defaultQty };
    });
    setSelectedItems(initialMap);
    setShowCreateModal(true);
  };

  const handleSavePackage = (e: React.FormEvent) => {
    e.preventDefault();

    const recommendedList = pkgRecommendedFor
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const generatedInclusions = generateInclusionsList();

    if (editingPkg) {
      setPackages((prev) =>
        prev.map((p) =>
          p.id === editingPkg.id
            ? {
                ...p,
                name: pkgName,
                tag: pkgTag,
                price: pkgPrice,
                desc: pkgDesc,
                img: pkgImg || p.img,
                recommendedFor: recommendedList,
                inclusions: generatedInclusions,
                specs: {
                  powerReq: specPower,
                  setupTime: specSetupTime,
                  crewSize: specCrewSize,
                },
              }
            : p
        )
      );
      setEditingPkg(null);
    } else {
      const newPkg: PackageData = {
        id: `pkg-${Date.now()}`,
        name: pkgName || 'Custom Signature Package',
        tag: pkgTag,
        price: pkgPrice,
        rawPrice: parseInt(pkgPrice.replace(/\D/g, '')) || 35000,
        desc: pkgDesc,
        img: pkgImg || 'https://picsum.photos/seed/binhi-pkg-new/640/480',
        photos: [
          { url: 'https://picsum.photos/seed/binhi-new1/800/500', label: 'Sample Setup' },
          { url: 'https://picsum.photos/seed/binhi-new2/800/500', label: 'Equipment Rig' },
        ],
        inclusions: generatedInclusions,
        recommendedFor: recommendedList.length > 0 ? recommendedList : ['Weddings', 'Corporate Galas'],
        specs: {
          powerReq: specPower,
          setupTime: specSetupTime,
          crewSize: specCrewSize,
        },
      };
      setPackages([newPkg, ...packages]);
      setShowCreateModal(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#24252c]/[0.06]">
        <div>
          <MonoBadge icon={IconTicket}>Package Builder & Inventory Mapping</MonoBadge>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ink)] mt-1.5">
            Signature Production Packages
          </h1>
          <p className="text-xs text-[#24252c]/60 mt-1">
            Build package tiers, configure public detail page inclusions, and map equipment with quantities.
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="bg-[#1090F8] text-white text-xs font-bold px-5 py-2.5 rounded-full hover:bg-[#1090F8]/90 transition-colors shadow-sm self-start sm:self-auto"
        >
          + Create New Package
        </button>
      </div>

      {/* Package Cards List */}
      <div className="grid md:grid-cols-3 gap-5">
        {packages.map((pkg) => (
          <div key={pkg.id} className="bg-white rounded-2xl border border-[#24252c]/[0.08] p-5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="aspect-[16/9] rounded-xl bg-[var(--mist)] overflow-hidden mb-4 relative">
                <img src={pkg.img} alt={pkg.name} className="w-full h-full object-cover" />
                <span className="absolute top-3 right-3 text-xs font-extrabold bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-[#1090F8] border border-black/10">
                  {pkg.price}
                </span>
              </div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#24252c]/50">{pkg.tag}</span>
              <h3 className="font-extrabold text-base text-[var(--ink)] mt-1">{pkg.name}</h3>
              <p className="text-xs text-[#24252c]/60 mt-1 leading-relaxed line-clamp-2">{pkg.desc}</p>

              {/* Recommended For Badges */}
              <div className="mt-3 pt-3 border-t border-[#24252c]/[0.06]">
                <div className="text-[10px] uppercase font-bold text-[#24252c]/50 mb-1">Recommended For:</div>
                <div className="flex flex-wrap gap-1">
                  {pkg.recommendedFor.slice(0, 2).map((item, idx) => (
                    <span key={idx} className="text-[10px] font-medium bg-[var(--mist)] px-2 py-0.5 rounded-md border border-[#24252c]/10 text-[var(--ink)] truncate max-w-[140px]">
                      • {item}
                    </span>
                  ))}
                  {pkg.recommendedFor.length > 2 && (
                    <span className="text-[10px] font-bold text-[#1090F8] self-center">+{pkg.recommendedFor.length - 2} more</span>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={() => handleOpenEditModal(pkg)}
              className="mt-4 w-full bg-[var(--mist)] text-[var(--ink)] text-xs font-bold py-2.5 rounded-full border border-[#24252c]/10 hover:bg-[var(--ink)] hover:text-white transition-colors"
            >
              Edit Pricing & Map Gear
            </button>
          </div>
        ))}
      </div>

      {/* Spacious 4XL Non-Crowded Package Builder Modal */}
      {(showCreateModal || editingPkg) && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-blur-in">
          <div className="bg-white rounded-[2.5rem] max-w-4xl w-full shadow-2xl border border-[#24252c]/10 relative p-1.5 sm:p-2.5 overflow-hidden">
            <button
              onClick={() => {
                setShowCreateModal(false);
                setEditingPkg(null);
              }}
              className="absolute top-6 right-6 z-20 text-[#24252c]/50 hover:text-[var(--ink)] p-1.5 rounded-full hover:bg-[var(--mist)] transition-colors bg-white/90 backdrop-blur-md shadow-sm border border-[#24252c]/10"
            >
              <IconX className="w-5 h-5" />
            </button>

            <div className="max-h-[84vh] overflow-y-auto p-5 sm:p-7 space-y-6 modal-scroll pr-4 sm:pr-6">
              <div>
                <span className="text-xs font-mono font-bold text-[#1090F8] uppercase tracking-wider">
                  {editingPkg ? `Editing ID: ${editingPkg.id}` : 'New Package Setup'}
                </span>
                <h2 className="text-2xl font-extrabold text-[var(--ink)] mt-0.5">
                  {editingPkg ? `Edit Package: ${editingPkg.name}` : 'Create Signature Production Package'}
                </h2>
                <p className="text-xs text-[#24252c]/50 mt-1">
                  Configure public detail page content, technical specifications, and mapped inventory equipment.
                </p>
              </div>

            <form onSubmit={handleSavePackage} className="space-y-6 text-xs">
              {/* Grid 1: Basic Details & Pricing */}
              <div className="bg-[var(--mist)] p-5 rounded-2xl border border-[#24252c]/[0.08] space-y-4">
                <h3 className="font-extrabold text-sm text-[var(--ink)] flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#1090F8] text-white text-[10px] flex items-center justify-center">1</span>
                  Basic Information & Pricing
                </h3>

                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">Package Title / Name</label>
                    <input
                      value={pkgName}
                      onChange={(e) => setPkgName(e.target.value)}
                      placeholder="e.g. Package B — Celebration Setup"
                      className={inputClass}
                      required
                    />
                  </div>

                  <div>
                    <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">Daily Package Rate</label>
                    <input
                      value={pkgPrice}
                      onChange={(e) => setPkgPrice(e.target.value)}
                      placeholder="e.g. ₱28,000"
                      className={inputClass + ' font-bold text-[#1090F8]'}
                      required
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">Setup Subtitle / Tag</label>
                    <input
                      value={pkgTag}
                      onChange={(e) => setPkgTag(e.target.value)}
                      placeholder="e.g. Celebration Setup"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">Package Photo Cover Image</label>
                    <input
                      value={pkgImg}
                      onChange={(e) => setPkgImg(e.target.value)}
                      placeholder="Image URL (https://...)"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div>
                  <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">Overview Description</label>
                  <textarea
                    rows={2}
                    value={pkgDesc}
                    onChange={(e) => setPkgDesc(e.target.value)}
                    placeholder="Brief description of who this package is built for..."
                    className="w-full rounded-2xl border px-4 py-2.5 bg-white focus:outline-none focus:border-[#1090F8] border-transparent transition-colors"
                  />
                </div>
              </div>

              {/* Grid 2: Public Detail Page Recommendation & Tech Specs */}
              <div className="bg-[var(--mist)] p-5 rounded-2xl border border-[#24252c]/[0.08] space-y-4">
                <h3 className="font-extrabold text-sm text-[var(--ink)] flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-[#1090F8] text-white text-[10px] flex items-center justify-center">2</span>
                  Public Page: Recommended For & Tech Specs
                </h3>

                <div>
                  <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">
                    Recommended For / Ideal Event Types (Comma-Separated)
                  </label>
                  <input
                    value={pkgRecommendedFor}
                    onChange={(e) => setPkgRecommendedFor(e.target.value)}
                    placeholder="e.g. 18th Birthday Debuts, Intimate Weddings up to 120 guests, Corporate Galas"
                    className={inputClass}
                    required
                  />
                  <p className="text-[10px] text-[#24252c]/50 mt-1">Separate multiple event types with commas.</p>
                </div>

                <div className="grid sm:grid-cols-3 gap-4">
                  <div>
                    <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">Power Requirements</label>
                    <input
                      value={specPower}
                      onChange={(e) => setSpecPower(e.target.value)}
                      placeholder="e.g. 220V 30A Dedicated Line"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">Setup Duration</label>
                    <input
                      value={specSetupTime}
                      onChange={(e) => setSpecSetupTime(e.target.value)}
                      placeholder="e.g. 2.5 Hours"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">Technical Crew Size</label>
                    <input
                      value={specCrewSize}
                      onChange={(e) => setSpecCrewSize(e.target.value)}
                      placeholder="e.g. 3 Technicians"
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>

              {/* Grid 3: Inventory Equipment Checkboxes & Quantity Steppers */}
              <div className="bg-[var(--mist)] p-5 rounded-2xl border border-[#24252c]/[0.08] space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-extrabold text-sm text-[var(--ink)] flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#1090F8] text-white text-[10px] flex items-center justify-center">3</span>
                    Inventory Equipment Mapping (Checkboxes + Quantity Stepper)
                  </h3>
                  <span className="text-[10px] text-[#24252c]/50 font-semibold">Select items & specify Qty</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {INVENTORY_ITEMS_ROSTER.map((item) => {
                    const itemState = selectedItems[item.id] || { checked: false, qty: item.defaultQty };

                    return (
                      <div
                        key={item.id}
                        className={`p-3 sm:p-3.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-all ${
                          itemState.checked
                            ? 'bg-white border-[#1090F8]/40 shadow-sm'
                            : 'bg-white/60 border-[#24252c]/10 opacity-70'
                        }`}
                      >
                        <label className="flex items-center gap-3 cursor-pointer select-none min-w-0 flex-1">
                          <input
                            type="checkbox"
                            checked={itemState.checked}
                            onChange={() => toggleItemCheck(item.id, item.defaultQty)}
                            className="w-4.5 h-4.5 accent-[#1090F8] rounded cursor-pointer shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="font-bold text-xs text-[var(--ink)] break-words leading-tight">{item.name}</div>
                            <div className="text-[10px] text-[#24252c]/50 mt-0.5">{item.category} Category</div>
                          </div>
                        </label>

                        {itemState.checked && (
                          <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 bg-[var(--mist)] px-3 py-1.5 rounded-full border border-[#24252c]/10 w-full sm:w-auto mt-1 sm:mt-0">
                            <span className="text-[10px] font-semibold text-[#24252c]/60">Qty Included:</span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => updateItemQty(item.id, -1)}
                                className="w-6 h-6 rounded-full bg-white text-[var(--ink)] font-bold text-xs flex items-center justify-center hover:bg-[#1090F8] hover:text-white transition-colors shadow-sm"
                              >
                                -
                              </button>
                              <span className="font-extrabold text-xs text-[#1090F8] min-w-[20px] text-center">
                                {itemState.qty}
                              </span>
                              <button
                                type="button"
                                onClick={() => updateItemQty(item.id, 1)}
                                className="w-6 h-6 rounded-full bg-white text-[var(--ink)] font-bold text-xs flex items-center justify-center hover:bg-[#1090F8] hover:text-white transition-colors shadow-sm"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Grid 4: Live Inclusions & Public Page Preview */}
              <div className="bg-white p-5 rounded-2xl border border-[#24252c]/10 space-y-3">
                <h4 className="font-extrabold text-xs text-[var(--ink)] uppercase tracking-wider">
                  Live Public Detail Page Inclusions Preview
                </h4>
                <div className="space-y-1.5 pl-2">
                  {generateInclusionsList().map((inc, i) => (
                    <div key={i} className="text-xs text-[#24252c]/70 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#1090F8]" />
                      <span>{inc}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full bg-[var(--ink)] text-white text-sm font-extrabold py-4 rounded-full hover:bg-[var(--ink-soft)] transition-colors shadow-lg"
                >
                  {editingPkg ? 'Save Package Details & Mapped Gear' : 'Publish New Signature Package'}
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
