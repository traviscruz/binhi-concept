import { useState, useEffect } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import { IconBox, IconPlus, IconX, IconTrash, IconSearch } from '../../components/shared/icons';
import { ModalOverlay } from '../../components/shared/ModalOverlay';
import { EmptyState } from '../../components/shared/EmptyState';
import { supabase } from '../../lib/supabase';
import { logAuditEvent } from '../../utils/auditLogger';

const inputClass =
  'w-full rounded-full border px-4 py-2.5 text-xs bg-[#EEEEEE] text-[var(--ink)] placeholder:text-[#24252c]/40 focus:outline-none focus:border-[#1090F8] border-transparent transition-colors';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface TransportRule {
  id: string;
  region: string;
  baseFee: number;
  status: 'Active' | 'Inactive';
  createdAt?: string;
}

interface PsgcRegion {
  code: string;
  name: string;
  regionName: string;
}

interface PsgcProvince {
  code: string;
  name: string;
  regionCode: string;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminTransportPage({ go: _go }: { go: (p: Page) => void }) {
  const [rules, setRules] = useState<TransportRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal States - Add Rule
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRegion, setNewRegion] = useState('');
  const [newFee, setNewFee] = useState('');
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);

  // Modal States - Edit Rule
  const [editingRule, setEditingRule] = useState<TransportRule | null>(null);
  const [editRegion, setEditRegion] = useState('');
  const [editFeeVal, setEditFeeVal] = useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Delete Confirm State
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null);

  // PSGC API Picker States (Region and Province only)
  const [psgcRegions, setPsgcRegions] = useState<PsgcRegion[]>([]);
  const [psgcProvinces, setPsgcProvinces] = useState<PsgcProvince[]>([]);
  const [selectedRegionCode, setSelectedRegionCode] = useState('');
  const [selectedProvinceCode, setSelectedProvinceCode] = useState('');
  const [loadingProvinces, setLoadingProvinces] = useState(false);

  // Active target for PSGC picker ('add' or 'edit')
  const [psgcTarget, setPsgcTarget] = useState<'add' | 'edit'>('add');

  // ── Fetch Rules from Supabase ──────────────────────────────────────────────
  const fetchRules = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('transport_rules')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formatted: TransportRule[] = (data ?? []).map((row: any) => ({
        id: row.id,
        region: row.region,
        baseFee: Number(row.base_fee ?? 0),
        status: row.status === 'Inactive' ? 'Inactive' : 'Active',
        createdAt: row.created_at,
      }));

      setRules(formatted);
    } catch (err) {
      console.error('Error fetching transport rules:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  // ── Fetch PSGC Regions ─────────────────────────────────────────────────────
  useEffect(() => {
    const fetchRegions = async () => {
      try {
        const res = await fetch('https://psgc.gitlab.io/api/regions.json');
        if (res.ok) {
          const data: PsgcRegion[] = await res.json();
          setPsgcRegions(data.sort((a, b) => a.name.localeCompare(b.name)));
        }
      } catch (err) {
        console.error('Failed to fetch PSGC regions:', err);
      }
    };
    fetchRegions();
  }, []);

  // Handle PSGC Region Selection
  const handleRegionSelect = async (regionCode: string) => {
    setSelectedRegionCode(regionCode);
    setSelectedProvinceCode('');
    setPsgcProvinces([]);

    if (!regionCode) {
      if (psgcTarget === 'add') setNewRegion('');
      else setEditRegion('');
      return;
    }

    const regObj = psgcRegions.find((r) => r.code === regionCode);
    const regLabel = regObj ? `${regObj.name} (${regObj.regionName})` : '';

    // Immediately update location preview to chosen region
    if (psgcTarget === 'add') setNewRegion(regLabel);
    else setEditRegion(regLabel);

    // Fetch Provinces for this region
    setLoadingProvinces(true);
    try {
      const res = await fetch(`https://psgc.gitlab.io/api/regions/${regionCode}/provinces.json`);
      if (res.ok) {
        const data: PsgcProvince[] = await res.json();
        const sorted = data.sort((a, b) => a.name.localeCompare(b.name));
        setPsgcProvinces(sorted);
      }
    } catch (err) {
      console.error('Error loading provinces:', err);
    } finally {
      setLoadingProvinces(false);
    }
  };

  // Handle PSGC Province Selection
  const handleProvinceSelect = (provinceCode: string) => {
    setSelectedProvinceCode(provinceCode);
    const regObj = psgcRegions.find((r) => r.code === selectedRegionCode);
    const provObj = psgcProvinces.find((p) => p.code === provinceCode);

    if (provObj) {
      const label = `${provObj.name} (${regObj ? regObj.regionName : ''})`;
      if (psgcTarget === 'add') setNewRegion(label);
      else setEditRegion(label);
    } else if (regObj) {
      const label = `${regObj.name} (${regObj.regionName})`;
      if (psgcTarget === 'add') setNewRegion(label);
      else setEditRegion(label);
    }
  };

  // ── Digit-only Input Helper ────────────────────────────────────────────────
  const handleDigitsOnly = (val: string, setter: (v: string) => void) => {
    const digitsOnly = val.replace(/[^0-9]/g, '');
    setter(digitsOnly);
  };

  // ── Add New Transport Rule ─────────────────────────────────────────────────
  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRegion.trim()) return;
    const numericFee = Number(newFee) || 0;

    setIsSubmittingAdd(true);
    try {
      const { data, error } = await supabase
        .from('transport_rules')
        .insert([
          {
            region: newRegion.trim(),
            base_fee: numericFee,
            status: 'Active',
          },
        ])
        .select()
        .single();

      if (error) throw error;

      const created: TransportRule = {
        id: data.id,
        region: data.region,
        baseFee: Number(data.base_fee),
        status: 'Active',
        createdAt: data.created_at,
      };

      setRules((prev) => [created, ...prev]);
      await logAuditEvent({
        action: 'CREATE_TRANSPORT_RULE',
        module: 'transport',
        targetId: data.id,
        targetName: data.region,
        details: `Created transport fee rule for "${data.region}" (Base Fee: ₱${numericFee.toLocaleString()})`,
        currentData: { region: data.region, baseFee: numericFee, status: 'Active' },
      });
      setShowAddModal(false);
      resetAddForm();
    } catch (err) {
      console.error('Failed to add transport rule:', err);
      alert('Failed to save transport rule to database.');
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  const resetAddForm = () => {
    setNewRegion('');
    setNewFee('');
    setSelectedRegionCode('');
    setSelectedProvinceCode('');
    setPsgcProvinces([]);
    setPsgcTarget('add');
  };

  const openEditModal = async (rule: TransportRule) => {
    setEditingRule(rule);
    setEditRegion(rule.region);
    setEditFeeVal(rule.baseFee.toString());
    setPsgcTarget('edit');
    setSelectedRegionCode('');
    setSelectedProvinceCode('');
    setPsgcProvinces([]);

    if (!rule.region) return;
    const ruleText = rule.region.toLowerCase();

    // Ensure psgcRegions are loaded
    let regionsList = psgcRegions;
    if (regionsList.length === 0) {
      try {
        const res = await fetch('https://psgc.gitlab.io/api/regions.json');
        if (res.ok) {
          regionsList = await res.json();
          setPsgcRegions(regionsList.sort((a, b) => a.name.localeCompare(b.name)));
        }
      } catch (err) {}
    }

    // 1. Try matching region first
    let matchedRegion = regionsList.find(
      (r) =>
        (r.name && ruleText.includes(r.name.toLowerCase())) ||
        (r.regionName && ruleText.includes(r.regionName.toLowerCase()))
    );

    setLoadingProvinces(true);
    try {
      if (matchedRegion) {
        setSelectedRegionCode(matchedRegion.code);
        const res = await fetch(`https://psgc.gitlab.io/api/regions/${matchedRegion.code}/provinces.json`);
        if (res.ok) {
          const provs: PsgcProvince[] = await res.json();
          const sorted = provs.sort((a, b) => a.name.localeCompare(b.name));
          setPsgcProvinces(sorted);

          const matchedProv = sorted.find((p) => ruleText.includes(p.name.toLowerCase()));
          if (matchedProv) {
            setSelectedProvinceCode(matchedProv.code);
          }
        }
      } else {
        // 2. If region tag wasn't in text (e.g. rule is just "Cavite"), search provinces across all regions
        for (const reg of regionsList) {
          const res = await fetch(`https://psgc.gitlab.io/api/regions/${reg.code}/provinces.json`);
          if (res.ok) {
            const provs: PsgcProvince[] = await res.json();
            const foundProv = provs.find((p) => ruleText.includes(p.name.toLowerCase()));
            if (foundProv) {
              const sorted = provs.sort((a, b) => a.name.localeCompare(b.name));
              setPsgcProvinces(sorted);
              setSelectedRegionCode(reg.code);
              setSelectedProvinceCode(foundProv.code);
              break;
            }
          }
        }
      }
    } catch (err) {
      console.error('Error prefilling location for edit:', err);
    } finally {
      setLoadingProvinces(false);
    }
  };

  // ── Edit Fee & Region ─────────────────────────────────────────────────────
  const handleSaveEditFee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRule) return;

    const numericFee = Number(editFeeVal) || 0;
    const finalRegion = editRegion.trim() || editingRule.region;
    setIsSubmittingEdit(true);

    try {
      const { error } = await supabase
        .from('transport_rules')
        .update({ region: finalRegion, base_fee: numericFee, updated_at: new Date().toISOString() })
        .eq('id', editingRule.id);

      if (error) throw error;

      setRules((prev) =>
        prev.map((r) => (r.id === editingRule.id ? { ...r, region: finalRegion, baseFee: numericFee } : r))
      );

      const feeChanged = editingRule.baseFee !== numericFee;
      await logAuditEvent({
        action: 'UPDATE_TRANSPORT_RULE',
        module: 'transport',
        targetId: editingRule.id,
        targetName: finalRegion,
        details: feeChanged
          ? `Updated transport base fee for "${finalRegion}" from ₱${editingRule.baseFee.toLocaleString()} to ₱${numericFee.toLocaleString()}`
          : `Updated transport coverage details for "${finalRegion}"`,
        previousData: { region: editingRule.region, baseFee: editingRule.baseFee },
        currentData: { region: finalRegion, baseFee: numericFee },
      });

      setEditingRule(null);
    } catch (err) {
      console.error('Failed to update transport rule:', err);
      alert('Failed to update rule in database.');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // ── Toggle Active Status ──────────────────────────────────────────────────
  const handleToggleStatus = async (rule: TransportRule) => {
    const nextStatus = rule.status === 'Active' ? 'Inactive' : 'Active';
    try {
      const { error } = await supabase
        .from('transport_rules')
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', rule.id);

      if (error) throw error;

      setRules((prev) =>
        prev.map((r) => (r.id === rule.id ? { ...r, status: nextStatus } : r))
      );

      await logAuditEvent({
        action: 'UPDATE_TRANSPORT_RULE',
        module: 'transport',
        targetId: rule.id,
        targetName: rule.region,
        details: `Toggled transport rule "${rule.region}" status to ${nextStatus}`,
        previousData: { status: rule.status },
        currentData: { status: nextStatus },
      });
    } catch (err) {
      console.error('Failed to toggle status:', err);
    }
  };

  // ── Delete Rule ────────────────────────────────────────────────────────────
  const handleDeleteRule = async (id: string) => {
    const target = rules.find((r) => r.id === id);
    try {
      const { error } = await supabase.from('transport_rules').delete().eq('id', id);
      if (error) throw error;

      setRules((prev) => prev.filter((r) => r.id !== id));

      await logAuditEvent({
        action: 'DELETE_TRANSPORT_RULE',
        module: 'transport',
        targetId: id,
        targetName: target?.region || id,
        details: `Deleted transport fee rule for "${target?.region || id}"`,
        previousData: target ? { region: target.region, baseFee: target.baseFee } : null,
      });

      setDeletingRuleId(null);
    } catch (err) {
      console.error('Failed to delete transport rule:', err);
      alert('Failed to delete rule from database.');
    }
  };

  // ── Filtered Rules ─────────────────────────────────────────────────────────
  const filteredRules = rules.filter((r) =>
    r.region.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#24252c]/[0.06]">
        <div>
          <MonoBadge icon={IconBox}>Logistics & Coverage</MonoBadge>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ink)] mt-1.5">
            Transportation Fee Rule Editor
          </h1>
          <p className="text-xs text-[#24252c]/60 mt-1">
            Configure regional delivery and logistics transport rates.
          </p>
        </div>

        <button
          onClick={() => {
            resetAddForm();
            setShowAddModal(true);
          }}
          className="bg-[#1090F8] text-white text-xs font-bold px-5 py-2.5 rounded-full hover:bg-[#1090F8]/90 transition-colors shadow-sm self-start sm:self-auto cursor-pointer inline-flex items-center gap-1.5"
        >
          <IconPlus className="w-4 h-4" /> Add New Region Fee
        </button>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <IconSearch className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#24252c]/40" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search region or location..."
            className={inputClass + ' pl-10'}
          />
        </div>
        <span className="text-xs text-[#24252c]/50 font-medium">
          {filteredRules.length} region{filteredRules.length !== 1 ? 's' : ''} configured
        </span>
      </div>

      {/* Content Area */}
      <div className="bg-white rounded-2xl p-5 border border-[#24252c]/[0.08] shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-xs text-[#24252c]/40 font-medium animate-pulse">
            Loading regional transportation fee rules from database...
          </div>
        ) : filteredRules.length === 0 ? (
          <EmptyState
            title="No Regional Zones Configured"
            description="Click '+ Add New Region Fee' above to add transport rates for Philippines locations."
          />
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#24252c]/[0.06] text-[#24252c]/50 uppercase tracking-wider">
                    <th className="py-3 px-3 font-semibold">Region / Location</th>
                    <th className="py-3 px-3 font-semibold">Base Transport Fee</th>
                    <th className="py-3 px-3 font-semibold">Status</th>
                    <th className="py-3 px-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#24252c]/[0.04]">
                  {filteredRules.map((r) => (
                    <tr key={r.id} className="hover:bg-[var(--mist)] transition-colors">
                      <td className="py-3.5 px-3 font-bold text-[var(--ink)]">{r.region}</td>
                      <td className="py-3.5 px-3 font-extrabold text-[#1090F8] text-sm">
                        ₱{r.baseFee.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-3">
                        <button
                          onClick={() => handleToggleStatus(r)}
                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase cursor-pointer border transition-colors ${
                            r.status === 'Active'
                              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20'
                              : 'bg-gray-200 text-gray-600 border-gray-300 hover:bg-gray-300'
                          }`}
                          title="Click to toggle status"
                        >
                          {r.status}
                        </button>
                      </td>
                      <td className="py-3.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(r)}
                            className="bg-[var(--mist)] text-[var(--ink)] text-[11px] font-semibold px-3 py-1 rounded-full border border-[#24252c]/10 hover:bg-[var(--ink)] hover:text-white transition-colors cursor-pointer"
                          >
                            Edit Fee
                          </button>
                          <button
                            onClick={() => setDeletingRuleId(r.id)}
                            className="text-rose-500 hover:text-rose-700 p-1.5 rounded-full hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Delete rule"
                          >
                            <IconTrash className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="block sm:hidden space-y-3">
              {filteredRules.map((r) => (
                <div
                  key={r.id}
                  className="p-4 rounded-xl bg-[var(--mist)] border border-[#24252c]/[0.06] space-y-2.5 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[var(--ink)]">{r.region}</span>
                    <button
                      onClick={() => handleToggleStatus(r)}
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                        r.status === 'Active'
                          ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                          : 'bg-gray-200 text-gray-600 border-gray-300'
                      }`}
                    >
                      {r.status}
                    </button>
                  </div>
                  <div className="text-[11px] text-[#24252c]/70">
                    Base Transport Fee:{' '}
                    <strong className="text-[#1090F8] text-sm">₱{r.baseFee.toLocaleString()}</strong>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => openEditModal(r)}
                      className="flex-1 bg-white border border-[#24252c]/10 text-xs font-semibold py-1.5 rounded-full text-[var(--ink)] cursor-pointer"
                    >
                      Edit Fee
                    </button>
                    <button
                      onClick={() => setDeletingRuleId(r.id)}
                      className="p-2 rounded-full text-rose-500 hover:bg-rose-50 border border-rose-200 cursor-pointer"
                    >
                      <IconTrash className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Edit Logistics Fee Modal (Identical Layout to Add Modal) ── */}
      <ModalOverlay isOpen={!!editingRule} onClose={() => setEditingRule(null)}>
        <div className="bg-white rounded-[2.5rem] p-6 sm:p-8 max-w-xl w-full shadow-2xl border border-[#24252c]/10 relative">
          <button
            onClick={() => setEditingRule(null)}
            className="absolute top-6 right-6 text-[#24252c]/50 hover:text-[var(--ink)] p-1 cursor-pointer"
          >
            <IconX className="w-5 h-5" />
          </button>

          <h3 className="text-xl font-extrabold text-[var(--ink)] mb-1">Edit Regional Transport Zone</h3>
          <p className="text-xs text-[#24252c]/60 mb-5">
            Select an official Philippine region or province, then specify the transport rate.
          </p>

          <form onSubmit={handleSaveEditFee} className="space-y-4 text-xs">
            {/* ── Location Selectors ── */}
            <div className="p-4 rounded-2xl bg-[var(--mist)] border border-[#24252c]/[0.06] space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#24252c]/60 block">
                1. Select Location
              </span>

              {/* Step A: Region Select */}
              <div>
                <label className="text-[10px] font-semibold text-[#24252c]/50 uppercase block mb-1">
                  Region <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={selectedRegionCode}
                  onChange={(e) => handleRegionSelect(e.target.value)}
                  className="w-full rounded-xl border border-[#24252c]/15 bg-white px-3 py-2 text-xs font-semibold text-[var(--ink)] cursor-pointer focus:outline-none focus:border-[#1090F8]"
                >
                  <option value="">-- Choose Region (Required) --</option>
                  {psgcRegions.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.name} ({r.regionName})
                    </option>
                  ))}
                </select>
              </div>

              {/* Step B: Province Select (Required when available) */}
              {selectedRegionCode && psgcProvinces.length > 0 && (
                <div>
                  <label className="text-[10px] font-semibold text-[#24252c]/50 uppercase block mb-1">
                    Province <span className="text-rose-500">*</span> {loadingProvinces && '(Loading...)'}
                  </label>
                  <select
                    required
                    value={selectedProvinceCode}
                    onChange={(e) => handleProvinceSelect(e.target.value)}
                    className="w-full rounded-xl border border-[#24252c]/15 bg-white px-3 py-2 text-xs font-semibold text-[var(--ink)] cursor-pointer focus:outline-none focus:border-[#1090F8]"
                  >
                    <option value="">-- Choose Province (Required) --</option>
                    {psgcProvinces.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  {!selectedProvinceCode && (
                    <p className="text-[10px] text-rose-500 font-semibold ml-1 mt-1">
                      Notice: Selecting a province is required for this region.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Region / Location Name (Uneditable Preview) */}
            <div>
              <label className="font-semibold uppercase text-[#24252c]/50 block mb-1 text-[11px]">
                Region / Location Name
              </label>
              <input
                type="text"
                value={editRegion}
                readOnly
                placeholder="Selected location will appear here..."
                className="w-full rounded-full border border-transparent px-4 py-2.5 text-xs bg-[#E5E7EB] text-[var(--ink)] font-semibold cursor-not-allowed opacity-90 focus:outline-none"
                required
              />
            </div>

            {/* Base Transport Fee Input */}
            <div>
              <label className="font-semibold uppercase text-[#24252c]/50 block mb-1 text-[11px]">
                Base Transport Fee
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-[#1090F8] text-sm">
                  ₱
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={editFeeVal}
                  onChange={(e) => handleDigitsOnly(e.target.value, setEditFeeVal)}
                  placeholder="e.g. 3500"
                  className={inputClass + ' font-bold text-[#1090F8] text-sm py-2.5 pl-8 pr-4'}
                  required
                />
              </div>
              <p className="text-[10px] text-[#24252c]/50 mt-1 ml-1">
                Formatted rate: <strong className="text-[#1090F8]">₱{Number(editFeeVal || 0).toLocaleString()}</strong>
              </p>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setEditingRule(null)}
                className="px-6 py-2.5 rounded-full border border-black/10 text-xs font-semibold text-[var(--ink)] hover:bg-[#F0F0F0] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingEdit || !selectedRegionCode || (psgcProvinces.length > 0 && !selectedProvinceCode) || !editRegion.trim() || !editFeeVal.trim()}
                className="bg-[var(--ink)] disabled:opacity-50 text-white font-semibold px-7 py-2.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors cursor-pointer text-xs shadow-md"
              >
                {isSubmittingEdit ? 'Saving...' : 'Save Fee Changes'}
              </button>
            </div>
          </form>
        </div>
      </ModalOverlay>

      {/* ── Add Regional Zone Modal (Identical Layout to Edit Modal) ── */}
      <ModalOverlay isOpen={showAddModal} onClose={() => setShowAddModal(false)}>
        <div className="bg-white rounded-[2.5rem] p-6 sm:p-8 max-w-xl w-full shadow-2xl border border-[#24252c]/10 relative">
          <button
            onClick={() => setShowAddModal(false)}
            className="absolute top-6 right-6 text-[#24252c]/50 hover:text-[var(--ink)] p-1 cursor-pointer"
          >
            <IconX className="w-5 h-5" />
          </button>

          <h3 className="text-xl font-extrabold text-[var(--ink)] mb-1">Add Regional Transport Zone</h3>
          <p className="text-xs text-[#24252c]/60 mb-5">
            Select an official Philippine region or province, then specify the transport rate.
          </p>

          <form onSubmit={handleAddRule} className="space-y-4 text-xs">

            {/* ── Location Selectors ── */}
            <div className="p-4 rounded-2xl bg-[var(--mist)] border border-[#24252c]/[0.06] space-y-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#24252c]/60 block">
                1. Select Location
              </span>

              {/* Step A: Region Select */}
              <div>
                <label className="text-[10px] font-semibold text-[#24252c]/50 uppercase block mb-1">
                  Region <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={selectedRegionCode}
                  onChange={(e) => handleRegionSelect(e.target.value)}
                  className="w-full rounded-xl border border-[#24252c]/15 bg-white px-3 py-2 text-xs font-semibold text-[var(--ink)] cursor-pointer focus:outline-none focus:border-[#1090F8]"
                >
                  <option value="">-- Choose Region (Required) --</option>
                  {psgcRegions.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.name} ({r.regionName})
                    </option>
                  ))}
                </select>
              </div>

              {/* Step B: Province Select (Required when available) */}
              {selectedRegionCode && psgcProvinces.length > 0 && (
                <div>
                  <label className="text-[10px] font-semibold text-[#24252c]/50 uppercase block mb-1">
                    Province <span className="text-rose-500">*</span> {loadingProvinces && '(Loading...)'}
                  </label>
                  <select
                    required
                    value={selectedProvinceCode}
                    onChange={(e) => handleProvinceSelect(e.target.value)}
                    className="w-full rounded-xl border border-[#24252c]/15 bg-white px-3 py-2 text-xs font-semibold text-[var(--ink)] cursor-pointer focus:outline-none focus:border-[#1090F8]"
                  >
                    <option value="">-- Choose Province (Required) --</option>
                    {psgcProvinces.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  {!selectedProvinceCode && (
                    <p className="text-[10px] text-rose-500 font-semibold ml-1 mt-1">
                      Notice: Selecting a province is required for this region.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Region Label Input (Uneditable preview) */}
            <div>
              <label className="font-semibold uppercase text-[#24252c]/50 block mb-1 text-[11px]">
                Region / Location Name
              </label>
              <input
                type="text"
                value={newRegion}
                readOnly
                placeholder="Selected location will appear here..."
                className="w-full rounded-full border border-transparent px-4 py-2.5 text-xs bg-[#E5E7EB] text-[var(--ink)] font-semibold cursor-not-allowed opacity-90 focus:outline-none"
                required
              />
            </div>

            {/* Base Fee Input */}
            <div>
              <label className="font-semibold uppercase text-[#24252c]/50 block mb-1 text-[11px]">
                Base Transport Fee
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-[#1090F8] text-sm">
                  ₱
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={newFee}
                  onChange={(e) => handleDigitsOnly(e.target.value, setNewFee)}
                  placeholder="e.g. 3500"
                  className={inputClass + ' font-bold text-[#1090F8] text-sm py-2.5 pl-8 pr-4'}
                  required
                />
              </div>
              <p className="text-[10px] text-[#24252c]/50 mt-1 ml-1">
                Formatted rate: <strong className="text-[#1090F8]">₱{Number(newFee || 0).toLocaleString()}</strong>
              </p>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-6 py-2.5 rounded-full border border-black/10 text-xs font-semibold text-[var(--ink)] hover:bg-[#F0F0F0] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingAdd || !selectedRegionCode || (psgcProvinces.length > 0 && !selectedProvinceCode) || !newRegion.trim() || !newFee.trim()}
                className="bg-[var(--ink)] disabled:opacity-50 text-white font-semibold px-7 py-2.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors cursor-pointer text-xs shadow-md"
              >
                {isSubmittingAdd ? 'Saving...' : 'Create Transport Rule'}
              </button>
            </div>
          </form>
        </div>
      </ModalOverlay>

      {/* ── Delete Confirmation Modal ── */}
      <ModalOverlay isOpen={!!deletingRuleId} onClose={() => setDeletingRuleId(null)}>
        <div className="bg-white rounded-[2.5rem] p-6 max-w-sm w-full shadow-2xl border border-[#24252c]/10 text-center">
          <h3 className="text-lg font-extrabold text-[var(--ink)] mb-2">Delete Transport Rule?</h3>
          <p className="text-xs text-[#24252c]/60 mb-6">
            Are you sure you want to remove this regional fee rule from database?
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => setDeletingRuleId(null)}
              className="px-5 py-2 rounded-full border border-black/10 text-xs font-semibold text-[var(--ink)] hover:bg-[#F0F0F0] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => deletingRuleId && handleDeleteRule(deletingRuleId)}
              className="bg-rose-600 text-white text-xs font-semibold px-6 py-2 rounded-full hover:bg-rose-700 transition-colors shadow-md cursor-pointer"
            >
              Delete Rule
            </button>
          </div>
        </div>
      </ModalOverlay>
    </div>
  );
}
