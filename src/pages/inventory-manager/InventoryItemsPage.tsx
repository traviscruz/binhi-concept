import { useState } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import { IconBox, IconX, IconChevronDown, IconChevronUp, IconSearch } from '../../components/shared/icons';

const inputClass =
  'w-full rounded-full border px-4 py-2.5 text-xs bg-[#EEEEEE] text-[var(--ink)] placeholder:text-[#24252c]/40 focus:outline-none focus:border-[#1090F8] border-transparent transition-colors';

export interface PhysicalUnit {
  serialId: string;
  condition: 'Operational (Good)' | 'Minor Wear' | 'Needs Inspection' | 'In Repair';
  status: 'Available in Warehouse' | 'Assigned to Event';
  lastMaintenance: string;
}

export interface MasterEquipmentModel {
  modelId: string;
  name: string;
  brand: string;
  category: string;
  price: string;
  desc: string;
  img: string;
  units: PhysicalUnit[];
}

export default function InventoryItemsPage({ go }: { go: (p: Page) => void }) {
  const [models, setModels] = useState<MasterEquipmentModel[]>([
    {
      modelId: 'MOD-YAM-DBR12',
      name: 'Active PA 12-inch Speakers',
      brand: 'Yamaha',
      category: 'Audio Production',
      price: '₱3,500 / day',
      desc: '1000W RMS high-output active loudspeaker with onboard mixer.',
      img: 'https://picsum.photos/seed/binhi-a1/640/480',
      units: [
        { serialId: 'SPK-YAM-001', condition: 'Operational (Good)', status: 'Available in Warehouse', lastMaintenance: '2026-08-01' },
        { serialId: 'SPK-YAM-002', condition: 'Operational (Good)', status: 'Available in Warehouse', lastMaintenance: '2026-08-01' },
        { serialId: 'SPK-YAM-003', condition: 'Operational (Good)', status: 'Assigned to Event', lastMaintenance: '2026-07-25' },
        { serialId: 'SPK-YAM-004', condition: 'Minor Wear', status: 'Available in Warehouse', lastMaintenance: '2026-08-10' },
        { serialId: 'SPK-YAM-005', condition: 'In Repair', status: 'Available in Warehouse', lastMaintenance: '2026-08-18' },
      ],
    },
    {
      modelId: 'MOD-CHVT-BEAM',
      name: 'Moving Head Beam/Spot Lights',
      brand: 'Chauvet DJ',
      category: 'Lighting',
      price: '₱4,500 / day',
      desc: '7R DMX motorized pan/tilt moving head fixture for stage beam light shows.',
      img: 'https://picsum.photos/seed/binhi-b3/640/480',
      units: [
        { serialId: 'LGT-CHV-001', condition: 'Operational (Good)', status: 'Assigned to Event', lastMaintenance: '2026-08-12' },
        { serialId: 'LGT-CHV-002', condition: 'Operational (Good)', status: 'Assigned to Event', lastMaintenance: '2026-08-12' },
        { serialId: 'LGT-CHV-003', condition: 'Needs Inspection', status: 'Available in Warehouse', lastMaintenance: '2026-08-15' },
        { serialId: 'LGT-CHV-004', condition: 'Operational (Good)', status: 'Available in Warehouse', lastMaintenance: '2026-08-05' },
      ],
    },
    {
      modelId: 'MOD-LED-P3',
      name: 'P3 HD Indoor LED Wall Display Panel',
      brand: 'Absen',
      category: 'Video & Visuals',
      price: '₱18,000 / day',
      desc: 'High refresh rate P3 LED video tiles for backdrop visuals and stage presentations.',
      img: 'https://picsum.photos/seed/binhi-c3/640/480',
      units: [
        { serialId: 'LED-P3-001', condition: 'Operational (Good)', status: 'Assigned to Event', lastMaintenance: '2026-08-14' },
        { serialId: 'LED-P3-002', condition: 'Operational (Good)', status: 'Assigned to Event', lastMaintenance: '2026-08-14' },
        { serialId: 'LED-P3-003', condition: 'Operational (Good)', status: 'Available in Warehouse', lastMaintenance: '2026-08-02' },
      ],
    },
  ]);

  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('All');
  const [expandedModelId, setExpandedModelId] = useState<string | null>('MOD-YAM-DBR12');

  // Modals
  const [showAddModelModal, setShowAddModelModal] = useState(false);
  const [selectedUnitForEdit, setSelectedUnitForEdit] = useState<{ modelId: string; unit: PhysicalUnit } | null>(null);

  // Form States
  const [newModelName, setNewModelName] = useState('');
  const [newBrand, setNewBrand] = useState('');
  const [newCat, setNewCat] = useState('Audio Production');
  const [newPrice, setNewPrice] = useState('₱3,500 / day');
  const [newDesc, setNewDesc] = useState('');
  const [newUnitQty, setNewUnitQty] = useState(4);
  const [newSerialPrefix, setNewSerialPrefix] = useState('SPK-NEW');

  // Unit Condition Edit Form
  const [unitEditCondition, setUnitEditCondition] = useState<PhysicalUnit['condition']>('Operational (Good)');
  const [unitEditStatus, setUnitEditStatus] = useState<PhysicalUnit['status']>('Available in Warehouse');

  const categories = ['All', 'Audio Production', 'Lighting', 'Video & Visuals', 'Stage Effects'];

  const filteredModels = models.filter((m) => {
    const matchesCat = selectedCat === 'All' || m.category === selectedCat;
    const matchesSearch =
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.brand.toLowerCase().includes(search.toLowerCase()) ||
      m.modelId.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const handleAddModel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModelName.trim()) return;

    // Generate physical units
    const generatedUnits: PhysicalUnit[] = Array.from({ length: Math.max(1, newUnitQty) }).map((_, i) => ({
      serialId: `${newSerialPrefix.toUpperCase()}-${String(i + 1).padStart(3, '0')}`,
      condition: 'Operational (Good)',
      status: 'Available in Warehouse',
      lastMaintenance: new Date().toISOString().split('T')[0],
    }));

    const newModel: MasterEquipmentModel = {
      modelId: `MOD-${Date.now()}`,
      name: newModelName,
      brand: newBrand || 'BINHI Standard',
      category: newCat,
      price: newPrice,
      desc: newDesc || 'Professional event production equipment model.',
      img: 'https://picsum.photos/seed/binhi-gear-new/640/480',
      units: generatedUnits,
    };

    setModels([newModel, ...models]);
    setShowAddModelModal(false);
    setNewModelName('');
    setNewBrand('');
    setNewDesc('');
  };

  const handleAddUnitToModel = (modelId: string) => {
    setModels((prev) =>
      prev.map((m) => {
        if (m.modelId === modelId) {
          const nextIndex = m.units.length + 1;
          const prefix = m.units[0]?.serialId.split('-')[0] || 'UNIT';
          const newUnit: PhysicalUnit = {
            serialId: `${prefix}-${String(nextIndex).padStart(3, '0')}`,
            condition: 'Operational (Good)',
            status: 'Available in Warehouse',
            lastMaintenance: new Date().toISOString().split('T')[0],
          };
          return { ...m, units: [...m.units, newUnit] };
        }
        return m;
      })
    );
  };

  const handleUpdateUnitCondition = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUnitForEdit) return;

    const { modelId, unit } = selectedUnitForEdit;

    setModels((prev) =>
      prev.map((m) => {
        if (m.modelId === modelId) {
          return {
            ...m,
            units: m.units.map((u) =>
              u.serialId === unit.serialId
                ? { ...u, condition: unitEditCondition, status: unitEditStatus }
                : u
            ),
          };
        }
        return m;
      })
    );

    setSelectedUnitForEdit(null);
  };

  const handleDeleteModel = (modelId: string) => {
    if (confirm('Are you sure you want to delete this equipment model and all its physical serial units?')) {
      setModels((prev) => prev.filter((m) => m.modelId !== modelId));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#24252c]/[0.06]">
        <div>
          <MonoBadge icon={IconBox}>Multi-Layer Inventory</MonoBadge>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ink)] mt-1.5">
            Equipment Models & Physical Units
          </h1>
          <p className="text-xs text-[#24252c]/60 mt-1">
            Layer 1: Master Equipment Models. Layer 2: Individual physical unit serials & condition logs.
          </p>
        </div>

        <button
          onClick={() => setShowAddModelModal(true)}
          className="bg-[#1090F8] text-white text-xs font-bold px-5 py-2.5 rounded-full hover:bg-[#1090F8]/90 transition-colors shadow-sm self-start sm:self-auto"
        >
          + Add Equipment Model
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#24252c]/[0.08] shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCat(cat)}
              className={`text-xs px-3.5 py-1.5 rounded-full font-medium transition-all ${
                selectedCat === cat
                  ? 'bg-[var(--ink)] text-white shadow-sm font-semibold'
                  : 'bg-[var(--mist)] text-[#24252c]/60 hover:text-[var(--ink)]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <IconSearch className="w-4 h-4 text-[#24252c]/40 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search model, brand, or ID..."
            className={inputClass + ' pl-10'}
          />
        </div>
      </div>

      {/* Master Models List with Layered Unit Roster Expansion */}
      <div className="space-y-4">
        {filteredModels.map((model) => {
          const isExpanded = expandedModelId === model.modelId;
          const totalUnits = model.units.length;
          const availableUnits = model.units.filter((u) => u.status === 'Available in Warehouse').length;
          const repairUnits = model.units.filter((u) => u.condition === 'In Repair' || u.condition === 'Needs Inspection').length;

          return (
            <div
              key={model.modelId}
              className="bg-white rounded-2xl border border-[#24252c]/[0.08] shadow-sm overflow-hidden transition-all"
            >
              {/* Layer 1: Model Header Row */}
              <div
                onClick={() => setExpandedModelId(isExpanded ? null : model.modelId)}
                className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-[var(--mist)] transition-colors"
              >
                <div className="flex items-center gap-4">
                  <img src={model.img} alt={model.name} className="w-14 h-14 rounded-2xl object-cover border border-[#24252c]/10" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-[#1090F8]">{model.modelId}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-[var(--mist)] px-2.5 py-0.5 rounded-full border border-[#24252c]/10">
                        {model.brand}
                      </span>
                    </div>
                    <h3 className="font-extrabold text-lg text-[var(--ink)] mt-0.5">{model.name}</h3>
                    <p className="text-xs text-[#24252c]/60 mt-0.5">{model.desc}</p>
                  </div>
                </div>

                <div className="flex items-center gap-6 shrink-0 justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-[#24252c]/[0.06]">
                  <div className="text-right">
                    <div className="text-xs font-bold text-[var(--ink)]">{totalUnits} Physical Units</div>
                    <div className="text-[11px] text-emerald-600 font-semibold">{availableUnits} Available · {repairUnits} Alert</div>
                  </div>

                  <span className="text-sm font-extrabold text-[#1090F8]">{model.price}</span>

                  <div className="p-2 rounded-full bg-[var(--mist)] text-[var(--ink)]">
                    {isExpanded ? <IconChevronUp className="w-4 h-4" /> : <IconChevronDown className="w-4 h-4" />}
                  </div>
                </div>
              </div>

              {/* Layer 2: Physical Unit Roster Accordion */}
              {isExpanded && (
                <div className="bg-[var(--mist)] p-5 border-t border-[#24252c]/[0.08] animate-blur-in">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#24252c]/60">
                      Layer 2: Physical Serial Roster ({model.units.length} Registered Units)
                    </h4>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAddUnitToModel(model.modelId)}
                        className="bg-white border border-[#24252c]/10 text-xs font-bold px-3.5 py-1.5 rounded-full hover:bg-[var(--ink)] hover:text-white transition-colors shadow-sm"
                      >
                        + Add Physical Unit
                      </button>
                      <button
                        onClick={() => handleDeleteModel(model.modelId)}
                        className="bg-rose-50 text-rose-600 border border-rose-200 text-xs font-semibold px-3.5 py-1.5 rounded-full hover:bg-rose-100 transition-colors"
                      >
                        Delete Model
                      </button>
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {model.units.map((unit) => (
                      <div
                        key={unit.serialId}
                        className="bg-white p-4 rounded-xl border border-[#24252c]/[0.08] shadow-sm flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-mono font-extrabold text-[#1090F8]">{unit.serialId}</span>
                            <span
                              className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                unit.condition === 'Operational (Good)'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {unit.condition}
                            </span>
                          </div>

                          <div className="text-xs font-bold text-[var(--ink)] mt-2">{unit.status}</div>
                          <div className="text-[10px] text-[#24252c]/50 mt-1">Last Inspection: {unit.lastMaintenance}</div>
                        </div>

                        <button
                          onClick={() => {
                            setSelectedUnitForEdit({ modelId: model.modelId, unit });
                            setUnitEditCondition(unit.condition);
                            setUnitEditStatus(unit.status);
                          }}
                          className="mt-3 w-full bg-[var(--mist)] text-[var(--ink)] text-[11px] font-semibold py-1.5 rounded-lg border border-[#24252c]/10 hover:bg-[#1090F8] hover:text-white transition-colors"
                        >
                          Update Unit Condition
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Master Equipment Model Modal */}
      {showAddModelModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-blur-in">
          <div className="bg-white rounded-[2rem] p-6 max-w-lg w-full shadow-2xl border border-[#24252c]/10 relative">
            <button onClick={() => setShowAddModelModal(false)} className="absolute top-5 right-5 text-[#24252c]/50 hover:text-[var(--ink)] p-1">
              <IconX className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-extrabold text-[var(--ink)] mb-4">Add Master Equipment Model</h3>

            <form onSubmit={handleAddModel} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">Equipment Name</label>
                  <input value={newModelName} onChange={(e) => setNewModelName(e.target.value)} placeholder="e.g. Yamaha DBR12 Speaker" className={inputClass} required />
                </div>
                <div>
                  <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">Brand Name</label>
                  <input value={newBrand} onChange={(e) => setNewBrand(e.target.value)} placeholder="e.g. Yamaha / Chauvet" className={inputClass} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">Category</label>
                  <select value={newCat} onChange={(e) => setNewCat(e.target.value)} className={inputClass + ' font-semibold'}>
                    <option>Audio Production</option>
                    <option>Lighting</option>
                    <option>Video & Visuals</option>
                    <option>Stage Effects</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">Daily Rental Rate</label>
                  <input value={newPrice} onChange={(e) => setNewPrice(e.target.value)} className={inputClass} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">Initial Physical Units Qty</label>
                  <input type="number" min={1} max={50} value={newUnitQty} onChange={(e) => setNewUnitQty(Number(e.target.value))} className={inputClass} />
                </div>
                <div>
                  <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">Serial ID Tag Prefix</label>
                  <input value={newSerialPrefix} onChange={(e) => setNewSerialPrefix(e.target.value)} placeholder="e.g. SPK-YAM" className={inputClass} />
                </div>
              </div>

              <div>
                <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">Description & Specs</label>
                <textarea rows={2} value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Inclusions, wattage, dimensions..." className="w-full rounded-2xl border px-4 py-2.5 bg-[#EEEEEE] focus:outline-none focus:border-[#1090F8] border-transparent transition-colors" />
              </div>

              <button type="submit" className="w-full bg-[var(--ink)] text-white font-semibold py-3.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors">
                Generate Equipment Model & Serial Units
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Individual Physical Unit Condition Modal */}
      {selectedUnitForEdit && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-blur-in">
          <div className="bg-white rounded-[2rem] p-6 max-w-md w-full shadow-2xl border border-[#24252c]/10 relative">
            <button onClick={() => setSelectedUnitForEdit(null)} className="absolute top-5 right-5 text-[#24252c]/50 hover:text-[var(--ink)] p-1">
              <IconX className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-extrabold text-[var(--ink)] mb-1">Update Unit Condition</h3>
            <p className="text-xs font-mono font-bold text-[#1090F8] mb-4">Serial Tag: {selectedUnitForEdit.unit.serialId}</p>

            <form onSubmit={handleUpdateUnitCondition} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">Physical Condition Rating</label>
                <select value={unitEditCondition} onChange={(e) => setUnitEditCondition(e.target.value as any)} className={inputClass + ' font-semibold'}>
                  <option>Operational (Good)</option>
                  <option>Minor Wear</option>
                  <option>Needs Inspection</option>
                  <option>In Repair</option>
                </select>
              </div>

              <div>
                <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">Deployment Status</label>
                <select value={unitEditStatus} onChange={(e) => setUnitEditStatus(e.target.value as any)} className={inputClass + ' font-semibold'}>
                  <option>Available in Warehouse</option>
                  <option>Assigned to Event</option>
                </select>
              </div>

              <button type="submit" className="w-full bg-[var(--ink)] text-white font-semibold py-3.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors">
                Save Unit Condition Changes
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
