import { useState } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import { IconShield, IconX } from '../../components/shared/icons';

const inputClass =
  'w-full rounded-full border px-4 py-2.5 text-xs bg-[#EEEEEE] text-[var(--ink)] placeholder:text-[#24252c]/40 focus:outline-none focus:border-[#1090F8] border-transparent transition-colors';

export default function AdminLoyaltyPage({ go }: { go: (p: Page) => void }) {
  const [earnRate, setEarnRate] = useState('1 PTS per ₱100 spent');
  const [reviewBonus, setReviewBonus] = useState('+100 PTS per verified review');
  const [goldThreshold, setGoldThreshold] = useState('1,000 PTS');
  const [platThreshold, setPlatThreshold] = useState('3,000 PTS');

  const [showSavedModal, setShowSavedModal] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#24252c]/[0.06]">
        <div>
          <MonoBadge icon={IconShield}>Rewards Program Rules</MonoBadge>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ink)] mt-1.5">
            Loyalty Program & Voucher Settings
          </h1>
          <p className="text-xs text-[#24252c]/60 mt-1">
            Configure host point earning rates, tier thresholds, and redeemable gear upgrade vouchers.
          </p>
        </div>

        <button
          onClick={() => setShowSavedModal(true)}
          className="bg-[var(--ink)] text-white text-xs font-semibold px-5 py-2.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors shadow-sm self-start sm:self-auto"
        >
          Save Loyalty Settings
        </button>
      </div>

      <div className="bg-white rounded-2xl p-6 border border-[#24252c]/[0.08] shadow-sm space-y-4">
        <h3 className="font-extrabold text-base text-[var(--ink)] mb-2">Points Earning Rules</h3>

        <div className="grid sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">Booking Spend Earning Rate</label>
            <input value={earnRate} onChange={(e) => setEarnRate(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">Verified Review Bonus</label>
            <input value={reviewBonus} onChange={(e) => setReviewBonus(e.target.value)} className={inputClass} />
          </div>
        </div>

        <h3 className="font-extrabold text-base text-[var(--ink)] pt-4 mb-2">VIP Tier Thresholds</h3>

        <div className="grid sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">VIP Gold Host Minimum PTS</label>
            <input value={goldThreshold} onChange={(e) => setGoldThreshold(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">VIP Platinum Host Minimum PTS</label>
            <input value={platThreshold} onChange={(e) => setPlatThreshold(e.target.value)} className={inputClass} />
          </div>
        </div>
      </div>

      {showSavedModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-blur-in">
          <div className="bg-white rounded-[2rem] p-6 max-w-sm w-full shadow-2xl border border-[#24252c]/10 relative text-center">
            <button onClick={() => setShowSavedModal(false)} className="absolute top-5 right-5 text-[#24252c]/50 hover:text-[var(--ink)] p-1">
              <IconX className="w-5 h-5" />
            </button>
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 font-extrabold text-xl flex items-center justify-center mx-auto mb-3 border border-emerald-200">
              ✓
            </div>
            <h3 className="text-lg font-extrabold text-[var(--ink)] mb-1">Loyalty Settings Saved</h3>
            <p className="text-xs text-[#24252c]/60 mb-5">
              Host point earning rules and VIP tier thresholds updated successfully across the platform.
            </p>
            <button
              onClick={() => setShowSavedModal(false)}
              className="w-full bg-[var(--ink)] text-white font-semibold py-3 rounded-full hover:bg-[var(--ink-soft)] transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
