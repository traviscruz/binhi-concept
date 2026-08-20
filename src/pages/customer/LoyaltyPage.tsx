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
          ✦ Gold Perks Active
        </div>
      </div>

      {/* Redeemable Rewards */}
      <div className="space-y-4 pt-2">
        <h3 className="font-extrabold text-lg text-[var(--ink)]">Redeemable Host Rewards</h3>
        <div className="grid md:grid-cols-3 gap-4">
          {rewardsList.map((r) => (
            <div
              key={r.id}
              className="bg-white rounded-2xl p-5 border border-[#24252c]/[0.08] shadow-sm flex flex-col justify-between"
            >
              <div>
                <span className="text-xs font-bold text-[#1090F8] bg-[#1090F8]/10 px-3 py-1 rounded-full">
                  {r.pts}
                </span>
                <h4 className="font-bold text-base text-[var(--ink)] mt-3">{r.title}</h4>
                <p className="text-xs text-[#24252c]/60 mt-1 leading-relaxed">{r.desc}</p>
              </div>
              <button
                onClick={() => setRedeemedTitle(r.title)}
                className="mt-5 w-full bg-[var(--ink)] text-white text-xs font-semibold py-3 rounded-full hover:bg-[var(--ink-soft)] transition-colors shadow-sm"
              >
                Redeem Reward Voucher
              </button>
            </div>
          ))}
        </div>
      </div>

      {redeemedTitle && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-blur-in">
          <div className="bg-white rounded-[2rem] p-6 max-w-sm w-full shadow-2xl border border-[#24252c]/10 relative text-center">
            <button onClick={() => setRedeemedTitle(null)} className="absolute top-5 right-5 text-[#24252c]/50 hover:text-[var(--ink)] p-1">
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
              className="w-full bg-[var(--ink)] text-white font-semibold py-3 rounded-full hover:bg-[var(--ink-soft)] transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
