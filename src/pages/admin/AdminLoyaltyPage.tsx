import { useState, useEffect } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import { IconShield, IconX, IconArrow } from '../../components/shared/icons';
import { ModalOverlay } from '../../components/shared/ModalOverlay';
import { logAuditEvent } from '../../utils/auditLogger';
import {
  fetchLoyaltySettings,
  saveLoyaltySettings,
  fetchDiscountRewards,
  saveDiscountReward,
  deleteDiscountReward,
  type DiscountReward,
} from '../../utils/loyaltyService';

const inputClass =
  'w-full rounded-full border px-4 py-2.5 text-xs bg-[#EEEEEE] text-[var(--ink)] placeholder:text-[#24252c]/40 focus:outline-none focus:border-[#1090F8] border-transparent transition-colors font-bold';

export default function AdminLoyaltyPage({ go }: { go: (p: Page) => void }) {
  const [ptsPerPeso, setPtsPerPeso] = useState('100');
  const [silverThreshold, setSilverThreshold] = useState('500');
  const [goldThreshold, setGoldThreshold] = useState('1500');
  const [platThreshold, setPlatThreshold] = useState('4000');
  const [showSavedModal, setShowSavedModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Rewards catalog state
  const [rewards, setRewards] = useState<DiscountReward[]>([]);
  const [editingReward, setEditingReward] = useState<Partial<DiscountReward> | null>(null);
  const [isSavingReward, setIsSavingReward] = useState(false);

  // Load existing settings and rewards from Supabase database
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [settings, rewardsList] = await Promise.all([
        fetchLoyaltySettings(),
        fetchDiscountRewards(),
      ]);
      setPtsPerPeso(String(settings.points_per_peso));
      setSilverThreshold(String(settings.silver_threshold));
      setGoldThreshold(String(settings.gold_threshold));
      setPlatThreshold(String(settings.platinum_threshold));
      setRewards(rewardsList);
    } catch (err) {
      console.error('Error loading loyalty settings and rewards:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const numericPtsPerPeso = Number(ptsPerPeso.replace(/\D/g, '')) || 100;
      const numericSilver = Number(silverThreshold.replace(/\D/g, '')) || 500;
      const numericGold = Number(goldThreshold.replace(/\D/g, '')) || 1500;
      const numericPlat = Number(platThreshold.replace(/\D/g, '')) || 4000;

      await saveLoyaltySettings({
        points_per_peso: numericPtsPerPeso,
        silver_threshold: numericSilver,
        gold_threshold: numericGold,
        platinum_threshold: numericPlat,
      });

      await logAuditEvent({
        action: 'UPDATE_LOYALTY_SETTINGS',
        module: 'loyalty',
        targetId: 'loyalty-config',
        targetName: 'Binhi Loyalty Engine',
        details: `Saved loyalty configuration: ₱${numericPtsPerPeso} spent per point. Tier Thresholds: Silver=${numericSilver}pts, Gold=${numericGold}pts, VIP Platinum=${numericPlat}pts`,
        currentData: {
          points_per_peso: numericPtsPerPeso,
          silver_threshold: numericSilver,
          gold_threshold: numericGold,
          platinum_threshold: numericPlat,
        },
      });

      setShowSavedModal(true);
    } catch (err) {
      console.error('Failed to save loyalty settings:', err);
      alert('Failed to save loyalty settings to database. Please check Supabase connection.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveRewardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReward || !editingReward.title || !editingReward.cost || !editingReward.discountAmount) {
      alert('Please fill out all required reward fields.');
      return;
    }

    setIsSavingReward(true);
    try {
      await saveDiscountReward({
        id: editingReward.id,
        title: editingReward.title,
        cost: Number(editingReward.cost),
        discountAmount: Number(editingReward.discountAmount),
        desc: editingReward.desc,
        badge: editingReward.badge,
      });

      await logAuditEvent({
        action: 'UPDATE_LOYALTY_SETTINGS',
        module: 'loyalty',
        targetId: editingReward.id || 'new-reward',
        targetName: editingReward.title,
        details: `Saved discount voucher reward tier: ${editingReward.title} (${editingReward.cost} PTS for ₱${editingReward.discountAmount} OFF)`,
      });

      setEditingReward(null);
      await loadData();
    } catch (err) {
      console.error('Failed to save reward:', err);
      alert('Failed to save reward tier to database.');
    } finally {
      setIsSavingReward(false);
    }
  };

  const handleDeleteReward = async (reward: DiscountReward) => {
    if (!confirm(`Are you sure you want to delete the reward "${reward.title}"?`)) return;

    try {
      await deleteDiscountReward(reward.id);
      await logAuditEvent({
        action: 'UPDATE_LOYALTY_SETTINGS',
        module: 'loyalty',
        targetId: reward.id,
        targetName: reward.title,
        details: `Deleted discount voucher reward tier: ${reward.title}`,
      });
      await loadData();
    } catch (err) {
      console.error('Failed to delete reward:', err);
      alert('Failed to delete reward tier.');
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#24252c]/[0.06]">
        <div>
          <MonoBadge icon={IconShield}>Loyalty &amp; Rewards Program</MonoBadge>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ink)] mt-1.5">
            Loyalty Engine Settings &amp; Rewards
          </h1>
          <p className="text-xs text-[#24252c]/60 mt-1">
            Configure point conversion formulas, VIP host tier qualification rules, and editable discount vouchers.
          </p>
        </div>

        <button
          onClick={handleSaveSettings}
          disabled={isSaving || isLoading}
          className="bg-[var(--ink)] hover:bg-[var(--ink-soft)] text-white text-xs font-semibold px-5 py-2.5 rounded-full transition-colors shrink-0 self-start sm:self-auto cursor-pointer disabled:opacity-50 shadow-sm"
        >
          {isSaving ? 'Saving...' : 'Save Loyalty Configuration'}
        </button>
      </div>

      {/* 1. Points Earning & VIP Tier Config */}
      <div className="grid md:grid-cols-2 gap-6 text-xs">
        <div className="bg-white rounded-[2rem] p-6 border border-[#24252c]/[0.08] shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-[var(--ink)]">Points Earning Formula</h2>
          <div>
            <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">Spent Amount Required per 1 Point (₱)</label>
            <input
              type="number"
              min="1"
              value={ptsPerPeso}
              onChange={(e) => setPtsPerPeso(e.target.value)}
              className={inputClass}
            />
            <p className="text-[10px] text-[#24252c]/50 mt-1">Default: ₱100 spent = 1 Binhi Point</p>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] p-6 border border-[#24252c]/[0.08] shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-[var(--ink)]">VIP Host Tier Requirements</h2>
          <div>
            <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">Silver Host Minimum PTS</label>
            <input
              type="number"
              min="0"
              value={silverThreshold}
              onChange={(e) => setSilverThreshold(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">Gold Host Minimum PTS</label>
            <input
              type="number"
              min="0"
              value={goldThreshold}
              onChange={(e) => setGoldThreshold(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">VIP Platinum Host Minimum PTS</label>
            <input
              type="number"
              min="0"
              value={platThreshold}
              onChange={(e) => setPlatThreshold(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* 2. Redeemable Discount Voucher Catalog (Admin CRUD) */}
      <div className="bg-white rounded-[2rem] p-6 sm:p-7 border border-[#24252c]/[0.08] shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#24252c]/[0.06]">
          <div>
            <h2 className="text-lg font-bold text-[var(--ink)]">Redeemable Discount Voucher Tiers</h2>
            <p className="text-xs text-[#24252c]/60 mt-0.5">
              Manage the discount options available for customers to exchange with their loyalty points.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              setEditingReward({
                title: '',
                cost: 100,
                discountAmount: 500,
                desc: 'Instant deduction applied directly to your booking subtotal.',
                badge: '',
              })
            }
            className="bg-[#1090F8] hover:bg-[#1090F8]/90 text-white text-xs font-semibold px-4 py-2.5 rounded-full transition-colors shrink-0 self-start sm:self-auto cursor-pointer shadow-sm"
          >
            + Add New Reward Tier
          </button>
        </div>

        {/* Rewards Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          {rewards.map((r) => (
            <div
              key={r.id}
              className="p-5 rounded-2xl bg-[var(--mist)] border border-[#24252c]/[0.08] hover:shadow-md transition-all flex flex-col justify-between gap-4 relative group"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-extrabold text-[#1090F8] bg-white px-3 py-1 rounded-full border border-[#1090F8]/20 shadow-xs">
                    {r.cost} PTS
                  </span>
                  {r.badge && (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                      {r.badge}
                    </span>
                  )}
                </div>

                <div className="text-xl font-black text-emerald-600 mt-1">
                  ₱{r.discountAmount.toLocaleString()} <span className="text-xs font-bold text-[var(--ink)]">Discount</span>
                </div>

                <h3 className="font-bold text-sm text-[var(--ink)] mt-1">{r.title}</h3>
                <p className="text-xs text-[#24252c]/65 mt-1.5 leading-relaxed">{r.desc}</p>
              </div>

              <div className="pt-3 border-t border-[#24252c]/[0.08] flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setEditingReward(r)}
                  className="flex-1 bg-white border border-[#24252c]/10 hover:border-[#1090F8] text-[var(--ink)] hover:text-[#1090F8] font-bold py-2 rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Edit Tier
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteReward(r)}
                  className="px-3 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold py-2 rounded-xl text-xs transition-colors cursor-pointer"
                  title="Delete reward tier"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal: Edit or Create Reward Tier */}
      <ModalOverlay isOpen={!!editingReward} onClose={() => setEditingReward(null)}>
        <div className="bg-white rounded-[2rem] p-6 sm:p-8 max-w-md w-full shadow-2xl border border-[#24252c]/10 relative text-left">
          <button
            onClick={() => setEditingReward(null)}
            className="absolute top-5 right-5 text-[#24252c]/50 hover:text-[var(--ink)] p-1 cursor-pointer"
          >
            <IconX className="w-5 h-5" />
          </button>

          <h3 className="text-lg font-extrabold text-[var(--ink)] mb-1">
            {editingReward?.id ? 'Edit Reward Voucher Tier' : 'Add New Reward Voucher Tier'}
          </h3>
          <p className="text-xs text-[#24252c]/60 mb-5">
            Set the required loyalty points and direct monetary discount amount for this reward.
          </p>

          <form onSubmit={handleSaveRewardSubmit} className="space-y-3.5 text-xs">
            <div>
              <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">Reward Title</label>
              <input
                type="text"
                required
                value={editingReward?.title || ''}
                onChange={(e) => setEditingReward((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="e.g. ₱500 Cash Discount Voucher"
                className={inputClass}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">Points Cost (PTS)</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={editingReward?.cost ?? 100}
                  onChange={(e) => setEditingReward((prev) => ({ ...prev, cost: Number(e.target.value) }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">Discount Amount (₱)</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={editingReward?.discountAmount ?? 500}
                  onChange={(e) => setEditingReward((prev) => ({ ...prev, discountAmount: Number(e.target.value) }))}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">Badge Tag (Optional)</label>
              <input
                type="text"
                value={editingReward?.badge || ''}
                onChange={(e) => setEditingReward((prev) => ({ ...prev, badge: e.target.value }))}
                placeholder="e.g. Popular, Best Value, VIP Exclusive"
                className={inputClass}
              />
            </div>

            <div>
              <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">Description</label>
              <textarea
                rows={2}
                value={editingReward?.desc || ''}
                onChange={(e) => setEditingReward((prev) => ({ ...prev, desc: e.target.value }))}
                placeholder="Description of the discount reward..."
                className="w-full rounded-2xl border p-3 text-xs bg-[#EEEEEE] text-[var(--ink)] placeholder:text-[#24252c]/40 focus:outline-none focus:border-[#1090F8] border-transparent font-medium"
              />
            </div>

            <div className="pt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingReward(null)}
                className="px-4 py-2.5 rounded-full text-xs font-semibold bg-[var(--mist)] text-[#24252c]/70 hover:bg-gray-200 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingReward}
                className="px-5 py-2.5 rounded-full text-xs font-semibold bg-[var(--ink)] hover:bg-[var(--ink-soft)] text-white cursor-pointer disabled:opacity-50 shadow-sm"
              >
                {isSavingReward ? 'Saving...' : 'Save Reward Tier'}
              </button>
            </div>
          </form>
        </div>
      </ModalOverlay>

      {/* Modal: Settings Saved */}
      <ModalOverlay isOpen={showSavedModal} onClose={() => setShowSavedModal(false)}>
        <div className="bg-white rounded-[2rem] p-6 max-w-sm w-full shadow-2xl border border-[#24252c]/10 relative text-center">
          <button onClick={() => setShowSavedModal(false)} className="absolute top-5 right-5 text-[#24252c]/50 hover:text-[var(--ink)] p-1 cursor-pointer">
            <IconX className="w-5 h-5" />
          </button>
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 font-extrabold text-xl flex items-center justify-center mx-auto mb-3 border border-emerald-200">
            ✓
          </div>
          <h3 className="text-lg font-extrabold text-[var(--ink)] mb-1">Loyalty Settings Saved</h3>
          <p className="text-xs text-[#24252c]/60 mb-5">
            Host point earning rules and VIP tier thresholds updated successfully in the Supabase database.
          </p>
          <button
            onClick={() => setShowSavedModal(false)}
            className="w-full bg-[var(--ink)] text-white font-semibold py-3 rounded-full hover:bg-[var(--ink-soft)] transition-colors cursor-pointer"
          >
            Great, Got It
          </button>
        </div>
      </ModalOverlay>
    </div>
  );
}
