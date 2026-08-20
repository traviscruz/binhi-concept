import { useState } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import { IconBox, IconX, IconChevronDown, IconChevronUp, IconSearch } from '../../components/shared/icons';

const inputClass =
  'w-full rounded-full border px-4 py-2.5 text-xs bg-[#EEEEEE] text-[var(--ink)] placeholder:text-[#24252c]/40 focus:outline-none focus:border-[#1090F8] border-transparent transition-colors';

export interface PhysicalUnit {
  serialId: string;
  condition: 'Operational (Good)' | 'Minor Wear' | 'Needs Inspection' | 'In Repair';
  status: 'Available in Warehouse' | 'Assigned to Event' | 'Decommissioned / Inactive';
  lastMaintenance: string;
  notes?: string;
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
        { serialId: 'SPK-YAM-001', condition: 'Operational (Good)', status: 'Available in Warehouse', lastMaintenance: 'August 1, 2026', notes: 'Routine check done.' },
        { serialId: 'SPK-YAM-002', condition: 'Operational (Good)', status: 'Available in Warehouse', lastMaintenance: 'August 1, 2026' },
        { serialId: 'SPK-YAM-003', condition: 'Operational (Good)', status: 'Assigned to Event', lastMaintenance: 'July 25, 2026' },
        { serialId: 'SPK-YAM-004', condition: 'Minor Wear', status: 'Available in Warehouse', lastMaintenance: 'August 10, 2026' },
        { serialId: 'SPK-YAM-005', condition: 'In Repair', status: 'Decommissioned / Inactive', lastMaintenance: 'August 18, 2026', notes: 'Tweeter replacement pending.' },
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
        { serialId: 'LGT-CHV-001', condition: 'Operational (Good)', status: 'Assigned to Event', lastMaintenance: 'August 12, 2026' },
        { serialId: 'LGT-CHV-002', condition: 'Operational (Good)', status: 'Assigned to Event', lastMaintenance: 'August 12, 2026' },
        { serialId: 'LGT-CHV-003', condition: 'Needs Inspection', status: 'Available in Warehouse', lastMaintenance: 'August 15, 2026', notes: 'Pan motor needs lubrication.' },
        { serialId: 'LGT-CHV-004', condition: 'Operational (Good)', status: 'Available in Warehouse', lastMaintenance: 'August 5, 2026' },
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
        { serialId: 'LED-P3-001', condition: 'Operational (Good)', status: 'Assigned to Event', lastMaintenance: 'August 14, 2026' },
        { serialId: 'LED-P3-002', condition: 'Operational (Good)', status: 'Assigned to Event', lastMaintenance: 'August 14, 2026' },
        { serialId: 'LED-P3-003', condition: 'Operational (Good)', status: 'Available in Warehouse', lastMaintenance: 'August 2, 2026' },
      ],
    },
  ]);

  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('All');
  const [expandedModelId, setExpandedModelId] = useState<string | null>('MOD-YAM-DBR12');

  // Modals State
  const [showAddModelModal, setShowAddModelModal] = useState(false);
  const [editingModel, setEditingModel] = useState<MasterEquipmentModel | null>(null);
  const [selectedUnitForEdit, setSelectedUnitForEdit] = useState<{ modelId: string; unit: PhysicalUnit } | null>(null);

  // Add Model Form State
  const [newModelName, setNewModelName] = useState('');
  const [newBrand, setNewBrand] = useState('');
  const [newCat, setNewCat] = useState('Audio Production');
  const [newPrice, setNewPrice] = useState('₱3,500 / day');
  const [newDesc, setNewDesc] = useState('');
  const [newUnitQty, setNewUnitQty] = useState(4);
  const [newSerialPrefix, setNewSerialPrefix] = useState('SPK-NEW');

  // Edit Model Form State
  const [editModelName, setEditModelName] = useState('');
  const [editModelBrand, setEditModelBrand] = useState('');
  const [editModelCat, setEditModelCat] = useState('');
  const [editModelPrice, setEditModelPrice] = useState('');
  const [editModelDesc, setEditModelDesc] = useState('');

  // Unit Condition Edit Form State
  const [unitEditSerialId, setUnitEditSerialId] = useState('');
  const [unitEditCondition, setUnitEditCondition] = useState<PhysicalUnit['condition']>('Operational (Good)');
  const [unitEditStatus, setUnitEditStatus] = useState<PhysicalUnit['status']>('Available in Warehouse');
  const [unitEditLastMaint, setUnitEditLastMaint] = useState('');
  const [unitEditNotes, setUnitEditNotes] = useState('');

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

  const handleOpenEditModelModal = (model: MasterEquipmentModel) => {
    setEditingModel(model);
    setEditModelName(model.name);
    setEditModelBrand(model.brand);
    setEditModelCat(model.category);
    setEditModelPrice(model.price);
    setEditModelDesc(model.desc);
  };

  const handleSaveModelEdits = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingModel) return;

    setModels((prev) =>
      prev.map((m) =>
        m.modelId === editingModel.modelId
          ? {
              ...m,
              name: editModelName,
              brand: editModelBrand,
              category: editModelCat,
              price: editModelPrice,
              desc: editModelDesc,
            }
          : m
      )
    );

    setEditingModel(null);
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

  const handleOpenEditUnitModal = (modelId: string, unit: PhysicalUnit) => {
    setSelectedUnitForEdit({ modelId, unit });
    setUnitEditSerialId(unit.serialId);
    setUnitEditCondition(unit.condition);
    setUnitEditStatus(unit.status);
    setUnitEditLastMaint(unit.lastMaintenance || new Date().toISOString().split('T')[0]);
    setUnitEditNotes(unit.notes || '');
  };

  const handleSaveUnitEdits = (e: React.FormEvent) => {
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
                ? {
                    ...u,
                    serialId: unitEditSerialId,
                    condition: unitEditCondition,
                    status: unitEditStatus,
                    lastMaintenance: unitEditLastMaint,
                    notes: unitEditNotes,
                  }
                : u
            ),
          };
        }
        return m;
      })
    );

    setSelectedUnitForEdit(null);
  };

  const [deleteModelId, setDeleteModelId] = useState<string | null>(null);

  const handleConfirmDeleteModel = () => {
    if (!deleteModelId) return;
    setModels((prev) => prev.filter((m) => m.modelId !== deleteModelId));
    setDeleteModelId(null);
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
            Layer 1: Master Equipment Details. Layer 2: Physical Serial Roster & Unit Status.
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
          const activeUnits = model.units.filter((u) => u.status === 'Assigned to Event').length;
          const inactiveUnits = model.units.filter((u) => u.status === 'Decommissioned / Inactive' || u.condition === 'In Repair').length;

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

                <div className="flex items-center gap-4 shrink-0 justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-[#24252c]/[0.06]">
                  <div className="text-right">
                    <div className="text-xs font-bold text-[var(--ink)]">{totalUnits} Physical Units</div>
                    <div className="text-[11px] text-[#24252c]/60">
                      <span className="text-emerald-600 font-semibold">{availableUnits} Avail</span> ·{' '}
                      <span className="text-amber-600 font-semibold">{activeUnits} Active</span>
                      {inactiveUnits > 0 && <span className="text-rose-600 font-semibold"> · {inactiveUnits} Inactive</span>}
                    </div>
                  </div>

                  <span className="text-sm font-extrabold text-[#1090F8]">{model.price}</span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenEditModelModal(model);
                    }}
                    className="text-xs font-bold px-3 py-1.5 rounded-full bg-[var(--mist)] border border-[#24252c]/10 hover:bg-[var(--ink)] hover:text-white transition-colors"
                  >
                    Edit Model
                  </button>

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
                        onClick={() => setDeleteModelId(model.modelId)}
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
                                  : unit.condition === 'In Repair'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {unit.condition}
                            </span>
                          </div>

                          <div className="text-xs font-bold text-[var(--ink)] mt-2">{unit.status}</div>
                          <div className="text-[10px] text-[#24252c]/50 mt-1">Last Inspection: {unit.lastMaintenance}</div>
                          {unit.notes && <div className="text-[10px] text-amber-600 mt-1 italic">"{unit.notes}"</div>}
                        </div>

                        <button
                          onClick={() => handleOpenEditUnitModal(model.modelId, unit)}
                          className="mt-3 w-full bg-[var(--mist)] text-[var(--ink)] text-[11px] font-semibold py-1.5 rounded-lg border border-[#24252c]/10 hover:bg-[#1090F8] hover:text-white transition-colors"
                        >
                          Edit Serial & Status
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

      {/* Layer 1: Edit Master Model Modal */}
      {editingModel && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-blur-in">
          <div className="bg-white rounded-[2rem] p-6 max-w-md w-full shadow-2xl border border-[#24252c]/10 relative">
            <button onClick={() => setEditingModel(null)} className="absolute top-5 right-5 text-[#24252c]/50 hover:text-[var(--ink)] p-1">
              <IconX className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-extrabold text-[var(--ink)] mb-1">Edit Master Model Details</h3>
            <p className="text-xs font-mono font-bold text-[#1090F8] mb-4">Model ID: {editingModel.modelId}</p>

            <form onSubmit={handleSaveModelEdits} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">Model Name</label>
                <input value={editModelName} onChange={(e) => setEditModelName(e.target.value)} className={inputClass} required />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">Brand Name</label>
                  <input value={editModelBrand} onChange={(e) => setEditModelBrand(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">Daily Rate</label>
                  <input value={editModelPrice} onChange={(e) => setEditModelPrice(e.target.value)} className={inputClass} />
                </div>
              </div>

              <div>
                <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">Category</label>
                <select value={editModelCat} onChange={(e) => setEditModelCat(e.target.value)} className={inputClass + ' font-semibold'}>
                  <option>Audio Production</option>
                  <option>Lighting</option>
                  <option>Video & Visuals</option>
                  <option>Stage Effects</option>
                </select>
              </div>

              <div>
                <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">Equipment Photo Image URL</label>
                <div className="flex items-center gap-3">
                  <img src={editModelImg || editingModel.img} alt="Preview" className="w-12 h-12 rounded-xl object-cover border border-[#24252c]/10 shrink-0" />
                  <input
                    value={editModelImg}
                    onChange={(e) => setEditModelImg(e.target.value)}
                    placeholder="Image URL (https://...)"
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">Description & Inclusions</label>
                <textarea rows={3} value={editModelDesc} onChange={(e) => setEditModelDesc(e.target.value)} className="w-full rounded-2xl border px-4 py-2.5 bg-[#EEEEEE] focus:outline-none focus:border-[#1090F8] border-transparent transition-colors" />
              </div>

              <button type="submit" className="w-full bg-[var(--ink)] text-white font-semibold py-3.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors">
                Save Model Details
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add Master Model Modal */}
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
                <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">Equipment Photo Image URL</label>
                <input
                  placeholder="https://picsum.photos/seed/binhi-gear-new/640/480"
                  className={inputClass}
                />
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

      {/* Layer 2: Edit Individual Physical Unit Serial & Status Modal */}
      {selectedUnitForEdit && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-blur-in">
          <div className="bg-white rounded-[2rem] p-6 max-w-md w-full shadow-2xl border border-[#24252c]/10 relative">
            <button onClick={() => setSelectedUnitForEdit(null)} className="absolute top-5 right-5 text-[#24252c]/50 hover:text-[var(--ink)] p-1">
              <IconX className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-extrabold text-[var(--ink)] mb-1">Edit Layer 2 Physical Serial Unit</h3>
            <p className="text-xs text-[#24252c]/50 mb-4">Modify unit serial tag, condition rating, or decommission status.</p>

            <form onSubmit={handleSaveUnitEdits} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">Physical Serial ID Tag</label>
                <input value={unitEditSerialId} onChange={(e) => setUnitEditSerialId(e.target.value)} className={inputClass + ' font-mono font-bold text-[#1090F8]'} required />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">Physical Condition</label>
                  <select value={unitEditCondition} onChange={(e) => setUnitEditCondition(e.target.value as any)} className={inputClass + ' font-semibold'}>
                    <option>Operational (Good)</option>
                    <option>Minor Wear</option>
                    <option>Needs Inspection</option>
                    <option>In Repair</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">Unit Status</label>
                  <select value={unitEditStatus} onChange={(e) => setUnitEditStatus(e.target.value as any)} className={inputClass + ' font-semibold'}>
                    <option>Available in Warehouse</option>
                    <option>Assigned to Event</option>
                    <option>Decommissioned / Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">Last Bench Inspection Date</label>
                <input type="date" value={unitEditLastMaint} onChange={(e) => setUnitEditLastMaint(e.target.value)} className={inputClass} />
              </div>

              <div>
                <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">Maintenance / Repair Notes</label>
                <textarea rows={2} value={unitEditNotes} onChange={(e) => setUnitEditNotes(e.target.value)} placeholder="Notes about wear, repair parts, or decommissioning..." className="w-full rounded-2xl border px-4 py-2.5 bg-[#EEEEEE] focus:outline-none focus:border-[#1090F8] border-transparent transition-colors" />
              </div>

              <button type="submit" className="w-full bg-[var(--ink)] text-white font-semibold py-3.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors">
                Save Physical Unit Changes
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete Equipment Model Modal Overlay */}
      {deleteModelId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-blur-in">
          <div className="bg-white rounded-[2rem] p-6 max-w-md w-full shadow-2xl border border-[#24252c]/10 relative text-center">
            <button onClick={() => setDeleteModelId(null)} className="absolute top-5 right-5 text-[#24252c]/50 hover:text-[var(--ink)] p-1">
              <IconX className="w-5 h-5" />
            </button>
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 font-extrabold text-xl flex items-center justify-center mx-auto mb-3 border border-rose-200">
              !
            </div>
            <h3 className="text-xl font-extrabold text-[var(--ink)] mb-1">Delete Equipment Model</h3>
            <p className="text-xs text-[#24252c]/60 mb-5">
              Are you sure you want to delete equipment model <strong className="text-[var(--ink)] font-mono">{deleteModelId}</strong> and all its physical serial units?
            </p>

            <div className="flex items-center gap-3 text-xs">
              <button
                onClick={() => setDeleteModelId(null)}
                className="flex-1 bg-[var(--mist)] text-[var(--ink)] font-semibold py-3 rounded-full border border-[#24252c]/10 hover:bg-[var(--ink)] hover:text-white transition-colors"
              >
                Keep Model
              </button>
              <button
                onClick={handleConfirmDeleteModel}
                className="flex-1 bg-rose-600 text-white font-semibold py-3 rounded-full hover:bg-rose-700 transition-colors shadow-md"
              >
                Delete Model
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
