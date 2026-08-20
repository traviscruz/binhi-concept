import { useState } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import { IconBox, IconX } from '../../components/shared/icons';
import { EQUIPMENT_ITEMS } from '../../data/equipment';

const inputClass =
  'w-full rounded-full border px-4 py-2.5 text-xs bg-[#EEEEEE] text-[var(--ink)] placeholder:text-[#24252c]/40 focus:outline-none focus:border-[#1090F8] border-transparent transition-colors';

export default function InventoryItemsPage({ go }: { go: (p: Page) => void }) {
  const [items, setItems] = useState(EQUIPMENT_ITEMS);
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('All');

  // Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [editItem, setEditItem] = useState<(typeof EQUIPMENT_ITEMS)[0] | null>(null);

  // Add Form State
  const [newName, setNewName] = useState('');
  const [newCat, setNewCat] = useState('Audio Production');
  const [newPrice, setNewPrice] = useState('₱3,500 / day');
  const [newDesc, setNewDesc] = useState('');

  // Edit Form State
  const [editCondition, setEditCondition] = useState('Operational (Good)');
  const [editStatus, setEditStatus] = useState('Available in Warehouse');

  const categories = ['All', 'Audio Production', 'Lighting', 'Video & Visuals', 'Stage Effects'];

  const filtered = items.filter((item) => {
    const matchesCat = selectedCat === 'All' || item.category === selectedCat;
    const matchesSearch =
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.category.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const newItem = {
      id: `item-${Date.now()}`,
      name: newName,
      category: newCat,
      price: newPrice,
      desc: newDesc || 'High quality event production equipment unit.',
      status: 'Available in Warehouse',
      img: 'https://picsum.photos/seed/binhi-gear/640/480',
      specs: { power: '220V 15A', weight: '12 kg', dimensions: '40x40x50 cm', frequency: '50Hz - 20kHz' },
    };
    setItems([newItem, ...items]);
    setShowAddModal(false);
    setNewName('');
    setNewDesc('');
  };

  const handleUpdateItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem) return;
    setItems((prev) =>
      prev.map((item) =>
        item.id === editItem.id ? { ...item, status: editStatus } : item
      )
    );
    setEditItem(null);
  };

  const handleDeleteItem = (id: string) => {
    if (confirm('Are you sure you want to remove this equipment item from the inventory catalog?')) {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#24252c]/[0.06]">
        <div>
          <MonoBadge icon={IconBox}>Gear Catalog (CRUD)</MonoBadge>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ink)] mt-1.5">
            Equipment Inventory List
          </h1>
          <p className="text-xs text-[#24252c]/60 mt-1">Add new gear, update condition status, and manage warehouse records.</p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="bg-[#1090F8] text-white text-xs font-bold px-5 py-2.5 rounded-full hover:bg-[#1090F8]/90 transition-colors shadow-sm self-start sm:self-auto"
        >
          + Add New Equipment
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
                  ? 'bg-[var(--ink)] text-white shadow-sm'
                  : 'bg-[var(--mist)] text-[#24252c]/60 hover:text-[var(--ink)]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search gear by name..."
          className={inputClass + ' sm:w-64'}
        />
      </div>

      {/* Equipment Table */}
      <div className="bg-white rounded-2xl p-5 border border-[#24252c]/[0.08] shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#24252c]/[0.06] text-[#24252c]/50 uppercase tracking-wider">
                <th className="py-3 px-3 font-semibold">Equipment Item</th>
                <th className="py-3 px-3 font-semibold">Category</th>
                <th className="py-3 px-3 font-semibold">Standard Rate</th>
                <th className="py-3 px-3 font-semibold">Condition Status</th>
                <th className="py-3 px-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#24252c]/[0.04]">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-[var(--mist)] transition-colors">
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-3">
                      <img src={item.img} alt={item.name} className="w-10 h-10 rounded-xl object-cover border border-[#24252c]/10" />
                      <div>
                        <div className="font-bold text-[var(--ink)] text-sm">{item.name}</div>
                        <div className="text-[10px] text-[#24252c]/50 truncate max-w-xs">{item.desc}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <span className="text-[10px] font-semibold bg-[var(--mist)] px-2.5 py-1 rounded-full text-[#24252c]/70 border border-[#24252c]/[0.06]">
                      {item.category}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-bold text-[#1090F8]">{item.price}</td>
                  <td className="py-3 px-3">
                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                        item.status.includes('Available')
                          ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setEditItem(item);
                          setEditStatus(item.status);
                        }}
                        className="bg-[var(--mist)] text-[var(--ink)] border border-[#24252c]/10 px-3 py-1.5 rounded-full font-semibold hover:bg-[var(--ink)] hover:text-white transition-colors"
                      >
                        Edit Status
                      </button>
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="text-rose-600 hover:bg-rose-50 p-1.5 rounded-full transition-colors"
                        title="Delete Equipment"
                      >
                        <IconX className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Equipment Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-blur-in">
          <div className="bg-white rounded-[2rem] p-6 max-w-lg w-full shadow-2xl border border-[#24252c]/10 relative">
            <button onClick={() => setShowAddModal(false)} className="absolute top-5 right-5 text-[#24252c]/50 hover:text-[var(--ink)] p-1">
              <IconX className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-extrabold text-[var(--ink)] mb-4">Add Equipment Unit</h3>

            <form onSubmit={handleAddItem} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">Equipment Name</label>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Pioneer DDJ-FLX10 DJ Controller" className={inputClass} required />
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
                  <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">Standard Daily Rate</label>
                  <input value={newPrice} onChange={(e) => setNewPrice(e.target.value)} className={inputClass} />
                </div>
              </div>
              <div>
                <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">Technical Inclusions & Description</label>
                <textarea rows={3} value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Technical specifications..." className="w-full rounded-2xl border px-4 py-3 bg-[#EEEEEE] focus:outline-none focus:border-[#1090F8] border-transparent transition-colors" />
              </div>
              <button type="submit" className="w-full bg-[var(--ink)] text-white font-semibold py-3.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors">
                Save & Add to Catalog
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Condition/Status Modal */}
      {editItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-blur-in">
          <div className="bg-white rounded-[2rem] p-6 max-w-md w-full shadow-2xl border border-[#24252c]/10 relative">
            <button onClick={() => setEditItem(null)} className="absolute top-5 right-5 text-[#24252c]/50 hover:text-[var(--ink)] p-1">
              <IconX className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-extrabold text-[var(--ink)] mb-1">Edit Condition & Status</h3>
            <p className="text-xs text-[#24252c]/50 mb-4">{editItem.name}</p>

            <form onSubmit={handleUpdateItem} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">Condition Rating</label>
                <select value={editCondition} onChange={(e) => setEditCondition(e.target.value)} className={inputClass + ' font-semibold'}>
                  <option>Operational (Good)</option>
                  <option>Minor Cosmetic Wear</option>
                  <option>Requires Bench Inspection</option>
                  <option>Out of Service (Repair Needed)</option>
                </select>
              </div>

              <div>
                <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">Warehouse Deployment Status</label>
                <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)} className={inputClass + ' font-semibold'}>
                  <option>Available in Warehouse</option>
                  <option>Assigned to Active Booking</option>
                  <option>Under Maintenance / Repair</option>
                  <option>Decommissioned</option>
                </select>
              </div>

              <button type="submit" className="w-full bg-[var(--ink)] text-white font-semibold py-3.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors">
                Update Equipment Status
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
