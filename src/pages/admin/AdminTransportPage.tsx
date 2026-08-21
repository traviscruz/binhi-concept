import { useState } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import { IconBox, IconPlus, IconX } from '../../components/shared/icons';
import { ModalOverlay } from '../../components/shared/ModalOverlay';
import { EmptyState } from '../../components/shared/EmptyState';

const inputClass =
  'w-full rounded-full border px-4 py-2.5 text-xs bg-[#EEEEEE] text-[var(--ink)] placeholder:text-[#24252c]/40 focus:outline-none focus:border-[#1090F8] border-transparent transition-colors';

export interface TransportRule {
  id: string;
  region: string;
  baseFee: string;
  crewAllowance: string;
  status: string;
}

export default function AdminTransportPage({ go }: { go: (p: Page) => void }) {
  const [rules, setRules] = useState<TransportRule[]>([
    { id: 'tr-1', region: 'Metro Manila (NCR)', baseFee: '₱1,500', crewAllowance: 'Included', status: 'Active' },
    { id: 'tr-2', region: 'Tagaytay / Cavite', baseFee: '₱3,500', crewAllowance: '₱500 / day', status: 'Active' },
    { id: 'tr-3', region: 'Laguna / Batangas', baseFee: '₱4,500', crewAllowance: '₱750 / day', status: 'Active' },
    { id: 'tr-4', region: 'Bulacan / Pampanga', baseFee: '₱4,000', crewAllowance: '₱500 / day', status: 'Active' },
  ]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newRegion, setNewRegion] = useState('');
  const [newFee, setNewFee] = useState('₱5,000');

  // Edit Fee Modal State
  const [editingRule, setEditingRule] = useState<TransportRule | null>(null);
  const [editFeeVal, setEditFeeVal] = useState('');

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRegion.trim()) return;

    setRules([
      ...rules,
      { id: `tr-${Date.now()}`, region: newRegion, baseFee: newFee, crewAllowance: '₱750 / day', status: 'Active' },
    ]);

    setShowAddModal(false);
    setNewRegion('');
  };

  const handleSaveEditFee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRule) return;

    setRules((prev) =>
      prev.map((r) => (r.id === editingRule.id ? { ...r, baseFee: editFeeVal } : r))
    );

    setEditingRule(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#24252c]/[0.06]">
        <div>
          <MonoBadge icon={IconBox}>Logistics & Coverage</MonoBadge>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ink)] mt-1.5">
            Transportation Fee Rule Editor
          </h1>
          <p className="text-xs text-[#24252c]/60 mt-1">
            Configure regional delivery, rigging truck fees, and out-of-town crew allowances.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="bg-[#1090F8] text-white text-xs font-bold px-5 py-2.5 rounded-full hover:bg-[#1090F8]/90 transition-colors shadow-sm self-start sm:self-auto"
        >
          + Add New Region Fee
        </button>
      </div>

      <div className="bg-white rounded-2xl p-5 border border-[#24252c]/[0.08] shadow-sm">
        {/* Desktop Table View */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#24252c]/[0.06] text-[#24252c]/50 uppercase tracking-wider">
                <th className="py-3 px-3 font-semibold">Region Zone</th>
                <th className="py-3 px-3 font-semibold">Base Logistics Fee</th>
                <th className="py-3 px-3 font-semibold">Crew Allowance</th>
                <th className="py-3 px-3 font-semibold">Status</th>
                <th className="py-3 px-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#24252c]/[0.04]">
            {rules.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-4">
                  <EmptyState
                    title="No Regional Zones Configured"
                    description="Click '+ Add Regional Zone' above to add transport fee rules for regional locations."
                  />
                </td>
              </tr>
            ) : (
              rules.map((r) => (
                <tr key={r.id} className="hover:bg-[var(--mist)] transition-colors">
                  <td className="py-3.5 px-3 font-bold text-[var(--ink)]">{r.region}</td>
                  <td className="py-3.5 px-3 font-extrabold text-[#1090F8]">{r.baseFee}</td>
                  <td className="py-3.5 px-3 text-[#24252c]/60">{r.crewAllowance}</td>
                  <td className="py-3.5 px-3">
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 uppercase">
                      {r.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-3 text-right">
                    <button
                      onClick={() => {
                        setEditingRule(r);
                        setEditFeeVal(r.baseFee);
                      }}
                      className="bg-[var(--mist)] text-[var(--ink)] text-[11px] font-semibold px-3 py-1.5 rounded-full border border-[#24252c]/10 hover:bg-[var(--ink)] hover:text-white transition-colors"
                    >
                      Edit Fee
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          </table>
        </div>

        {/* Mobile Row Cards View */}
        <div className="block sm:hidden space-y-3">
          {rules.map((r) => (
            <div key={r.id} className="p-4 rounded-xl bg-[var(--mist)] border border-[#24252c]/[0.06] space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[var(--ink)]">{r.region}</span>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  {r.status}
                </span>
              </div>
              <div className="text-[11px] text-[#24252c]/70">Base Logistics Fee: <strong className="text-[#1090F8]">{r.baseFee}</strong></div>
              <div className="text-[11px] text-[#24252c]/60">Crew Allowance: {r.crewAllowance}</div>
              <button
                onClick={() => {
                  setEditingRule(r);
                  setEditFeeVal(r.baseFee);
                }}
                className="w-full bg-white border border-[#24252c]/10 text-xs font-semibold py-1.5 rounded-full text-[var(--ink)]"
              >
                Edit Fee
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Edit Logistics Fee Modal */}
      {editingRule && (
        <ModalOverlay onClose={() => setEditingRule(null)}>
          <div className="bg-white rounded-[2rem] p-6 max-w-md w-full shadow-2xl border border-[#24252c]/10 relative">
            <button onClick={() => setEditingRule(null)} className="absolute top-5 right-5 text-[#24252c]/50 hover:text-[var(--ink)] p-1 cursor-pointer">
              <IconX className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-extrabold text-[var(--ink)] mb-1">Edit Regional Transport Fee</h3>
            <p className="text-xs font-bold text-[#1090F8] mb-4">{editingRule.region}</p>

            <form onSubmit={handleSaveEditFee} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">Base Transport Fee</label>
                <input
                  value={editFeeVal}
                  onChange={(e) => setEditFeeVal(e.target.value)}
                  className={inputClass + ' font-bold text-[#1090F8]'}
                  required
                />
              </div>

              <button type="submit" className="w-full bg-[var(--ink)] text-white font-semibold py-3.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors cursor-pointer">
                Save Fee Changes
              </button>
            </form>
          </div>
        </ModalOverlay>
      )}

      {/* Add Regional Zone Modal */}
      {showAddModal && (
        <ModalOverlay onClose={() => setShowAddModal(false)}>
          <div className="bg-white rounded-[2rem] p-6 max-w-md w-full shadow-2xl border border-[#24252c]/10 relative">
            <button onClick={() => setShowAddModal(false)} className="absolute top-5 right-5 text-[#24252c]/50 hover:text-[var(--ink)] p-1 cursor-pointer">
              <IconX className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-extrabold text-[var(--ink)] mb-4">Add Regional Transport Zone</h3>

            <form onSubmit={handleAddRule} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">Region Name</label>
                <input value={newRegion} onChange={(e) => setNewRegion(e.target.value)} placeholder="e.g. Subic / Zambales" className={inputClass} required />
              </div>
              <div>
                <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">Base Transport Fee</label>
                <input value={newFee} onChange={(e) => setNewFee(e.target.value)} className={inputClass + ' font-bold text-[#1090F8]'} />
              </div>
              <button type="submit" className="w-full bg-[var(--ink)] text-white font-semibold py-3.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors cursor-pointer">
                Create Regional Zone Rule
              </button>
            </form>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
