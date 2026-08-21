import { useState } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import { IconShield, IconX } from '../../components/shared/icons';

const rewardsList = [
  { id: 'r1', pts: '250 PTS', title: 'Free Heavy Fog / Smoke Upgrade', desc: 'Upgrade any booking with a complimentary high-output low-lying fog cloud effect unit.' },
  { id: 'r2', pts: '500 PTS', title: '₱3,000 Booking Discount Voucher', desc: 'Apply a flat ₱3,000 discount voucher directly to your next event rental checkout.' },
  { id: 'r3', pts: '1,000 PTS', title: 'Free LED Par Uplight Pack (8x Units)', desc: 'Add 8 additional wireless RGBW ambient uplights to illuminate your event stage venue.' },
];

export default function LoyaltyPage({ go }: { go: (p: Page) => void }) {
  const [redeemedTitle, setRedeemedTitle] = useState<string | null>(null);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <div>
        <MonoBadge icon={IconShield}>BINHI Rewards Club</MonoBadge>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ink)] mt-1.5">
          Host Loyalty & Rewards
        </h1>
        <p className="text-xs text-[#24252c]/60 mt-1">
          Earn 1 PTS per ₱100 spent. Redeem points for equipment upgrades and booking discount vouchers.
        </p>
      </div>

      {/* Status Card */}
      <div className="bg-gradient-to-r from-[var(--ink)] to-[#1090F8] rounded-2xl p-6 text-white shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-mono uppercase tracking-wider opacity-80">VIP Tier Level</div>
          <div className="text-2xl sm:text-3xl font-extrabold mt-0.5">VIP Gold Host Status</div>
          <div className="text-xs opacity-90 mt-1">1,450 Available Points</div>
        </div>
        <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl border border-white/20 text-xs font-semibold">
          <MonoBadge icon={IconShield}>Host Loyalty Program</MonoBadge>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ink)] mt-1.5">
            Loyalty Rewards & VIP Status
          </h1>
          <p className="text-xs text-[#24252c]/60 mt-1">Earn points for every event production booked with BINHI.</p>
        </div>

        <div className="bg-white px-5 py-3 rounded-2xl border border-[#24252c]/10 shadow-sm flex items-center gap-3 shrink-0 self-start sm:self-auto">
          <div className="text-right">
            <div className="text-[10px] uppercase font-bold text-[#24252c]/50">Your Points Balance</div>
            <div className="text-xl font-extrabold text-[#1090F8]">{points} PTS</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] p-6 border border-[#24252c]/[0.08] shadow-sm space-y-4">
        <h2 className="text-base font-bold text-[var(--ink)]">Available Reward Vouchers</h2>

        <div className="grid sm:grid-cols-3 gap-4 text-xs">
          {rewards.map((r) => (
            <div key={r.id} className="p-5 rounded-2xl bg-[var(--mist)] border border-[#24252c]/[0.06] space-y-3 flex flex-col justify-between">
              <div>
                <span className="text-xs font-extrabold text-[#1090F8] bg-white px-3 py-1 rounded-full border border-[#1090F8]/20 inline-block mb-2">
                  {r.cost} PTS
                </span>
                <h3 className="font-bold text-sm text-[var(--ink)]">{r.title}</h3>
                <p className="text-xs text-[#24252c]/60 mt-1">{r.desc}</p>
              </div>

              <button
                onClick={() => handleRedeem(r)}
                disabled={points < r.cost}
                className="w-full bg-[var(--ink)] text-white text-xs font-semibold py-2.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors disabled:opacity-40 cursor-pointer"
              >
                {points >= r.cost ? 'Claim Reward' : 'Need More Points'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {redeemedTitle && (
        <ModalOverlay onClose={() => setRedeemedTitle(null)}>
          <div className="bg-white rounded-[2rem] p-6 max-w-sm w-full shadow-2xl border border-[#24252c]/10 relative text-center">
            <button onClick={() => setRedeemedTitle(null)} className="absolute top-5 right-5 text-[#24252c]/50 hover:text-[var(--ink)] p-1 cursor-pointer">
              <IconX className="w-5 h-5" />
            </button>
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 font-extrabold text-xl flex items-center justify-center mx-auto mb-3 border border-emerald-200">
              ✓
            </div>
            <h3 className="text-lg font-extrabold text-[var(--ink)] mb-1">Reward Voucher Redeemed</h3>
            <p className="text-xs text-[#24252c]/60 mb-5">
              You have successfully claimed <strong className="text-[var(--ink)]">{redeemedTitle}</strong>! The voucher has been applied to your account.
            </p>
            <button
              onClick={() => setRedeemedTitle(null)}
              className="w-full bg-[var(--ink)] text-white font-semibold py-3 rounded-full hover:bg-[var(--ink-soft)] transition-colors cursor-pointer"
            >
              Great!
            </button>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
