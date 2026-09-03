import { useState } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import { IconShield, IconX, IconCheck, IconArrow } from '../../components/shared/icons';
import { ModalOverlay } from '../../components/shared/ModalOverlay';

interface DiscountReward {
  id: string;
  cost: number;
  discountAmount: number;
  title: string;
  desc: string;
  badge?: string;
}

interface ClaimedVoucher {
  id: string;
  code: string;
  title: string;
  discountAmount: number;
  claimedAt: string;
  expiresAt: string;
}

const discountRewardsList: DiscountReward[] = [
  {
    id: 'disc-500',
    cost: 100,
    discountAmount: 500,
    title: '₱500 Cash Discount Voucher',
    desc: 'Instant ₱500 deduction applied directly to your booking subtotal on any equipment or package.',
    badge: 'Popular',
  },
  {
    id: 'disc-1500',
    cost: 250,
    discountAmount: 1500,
    title: '₱1,500 Production Discount Voucher',
    desc: 'Save ₱1,500 on standard or multi-day event production sound & lighting reservations.',
    badge: 'Best Value',
  },
  {
    id: 'disc-3000',
    cost: 500,
    discountAmount: 3000,
    title: '₱3,000 Major Event Discount Voucher',
    desc: 'Flat ₱3,000 cash discount voucher directly applied to celebrations, concerts, or grand setups.',
    badge: 'High Saver',
  },
  {
    id: 'disc-6500',
    cost: 1000,
    discountAmount: 6500,
    title: '₱6,500 VIP Celebration Voucher',
    desc: 'Exclusive VIP host voucher offering ₱6,500 in direct rental fee credit.',
    badge: 'VIP Exclusive',
  },
  {
    id: 'disc-10000',
    cost: 1500,
    discountAmount: 10000,
    title: '₱10,000 Executive Credit Voucher',
    desc: 'Maximum tier voucher granting ₱10,000 direct deduction on premium arena & wedding packages.',
    badge: 'Executive Tier',
  },
];

const mockHistory = [
  {
    id: 'h1',
    event: 'Completed Booking #BK-2026-081 (Wedding Package)',
    date: 'Aug 24, 2026',
    points: '+350 PTS',
    type: 'earn',
  },
  {
    id: 'h2',
    event: 'Verified Customer 5-Star Review Bonus',
    date: 'Aug 25, 2026',
    points: '+100 PTS',
    type: 'earn',
  },
  {
    id: 'h3',
    event: 'VIP Gold Host Annual Milestone Reward',
    date: 'Aug 01, 2026',
    points: '+1,000 PTS',
    type: 'earn',
  },
];

export default function LoyaltyPage({ go }: { go: (p: Page) => void }) {
  const [points, setPoints] = useState(1450);
  const [claimedVouchers, setClaimedVouchers] = useState<ClaimedVoucher[]>([
    {
      id: 'v-initial',
      code: 'BINHI-GOLD-500',
      title: '₱500 Cash Discount Voucher',
      discountAmount: 500,
      claimedAt: 'Aug 26, 2026',
      expiresAt: 'Dec 31, 2026',
    },
  ]);
  const [activeModalVoucher, setActiveModalVoucher] = useState<ClaimedVoucher | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleRedeem = (r: DiscountReward) => {
    if (points >= r.cost) {
      const newBalance = points - r.cost;
      setPoints(newBalance);

      const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      const newVoucher: ClaimedVoucher = {
        id: `v-${Date.now()}`,
        code: `BINHI-DISC${r.discountAmount}-${randomSuffix}`,
        title: r.title,
        discountAmount: r.discountAmount,
        claimedAt: 'Just now',
        expiresAt: '60 Days from issue',
      };

      setClaimedVouchers((prev) => [newVoucher, ...prev]);
      setActiveModalVoucher(newVoucher);
    }
  };

  const copyVoucher = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  // 1 PTS ≈ ₱5.00 cash discount value
  const estimatedCashValue = points * 5;

  return (
    <section className="pt-28 sm:pt-36 md:pt-40 pb-24 px-4 sm:px-6 min-h-screen bg-[var(--mist)]">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header Title Area */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <MonoBadge icon={IconShield}>BINHI Host Rewards Program</MonoBadge>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-[var(--ink)] mt-2">
              Host Loyalty & Rewards
            </h1>
            <p className="text-xs sm:text-sm text-[#24252c]/60 mt-1 max-w-xl">
              Earn 1 point per ₱100 spent. Convert your points directly into cash discount vouchers for your next event booking.
            </p>
          </div>

          <button
            onClick={() => go('packages')}
            className="bg-[var(--ink)] text-white text-xs font-semibold px-5 py-2.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors cursor-pointer self-start sm:self-auto shrink-0 shadow-sm"
          >
            Browse Packages →
          </button>
        </div>

        {/* Status & Points Balance Card */}
        <div className="bg-gradient-to-br from-[#0c162c] via-[#111e3b] to-[#0a1224] rounded-[2rem] p-6 sm:p-8 text-white shadow-xl relative overflow-hidden border border-white/10">
          {/* Subtle Ambient Backlight Glow */}
          <div className="absolute -right-16 -bottom-16 w-80 h-80 bg-[#1090F8]/20 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 bg-amber-400/15 border border-amber-400/30 text-amber-300 text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                VIP Gold Host Tier
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {points.toLocaleString()} <span className="text-[#1090F8]">Points Available</span>
              </h2>
              <p className="text-xs sm:text-sm text-white/70">
                Direct Cash Equivalent:{' '}
                <strong className="text-emerald-400 font-bold">≈ ₱{estimatedCashValue.toLocaleString()}</strong> in rental discount credits
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4 shrink-0">
              <div className="bg-white/10 backdrop-blur-md px-4 sm:px-5 py-3.5 rounded-2xl border border-white/15 text-left">
                <div className="text-[10px] uppercase font-bold text-white/60 tracking-wider">Points Balance</div>
                <div className="text-xl sm:text-2xl font-black text-white mt-0.5">{points.toLocaleString()} PTS</div>
              </div>
              <div className="bg-emerald-500/15 backdrop-blur-md px-4 sm:px-5 py-3.5 rounded-2xl border border-emerald-500/30 text-left">
                <div className="text-[10px] uppercase font-bold text-emerald-300 tracking-wider">Cash Value</div>
                <div className="text-xl sm:text-2xl font-black text-emerald-300 mt-0.5">₱{estimatedCashValue.toLocaleString()}</div>
              </div>
            </div>
          </div>

          {/* Tier Progress Bar */}
          <div className="relative z-10 mt-6 pt-6 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-white/75">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white">Conversion Rate:</span> 100 PTS = ₱500 Direct Cash Discount
            </div>
            <div className="text-xs text-amber-300 font-medium">
              550 PTS away from VIP Platinum Host Tier
            </div>
          </div>
        </div>

        {/* Claimed Discount Vouchers Wallet */}
        {claimedVouchers.length > 0 && (
          <div className="bg-white rounded-[2rem] p-6 sm:p-7 border border-[#24252c]/[0.08] shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-[var(--ink)]">My Active Discount Vouchers</h2>
                <p className="text-xs text-[#24252c]/60 mt-0.5">
                  Copy your voucher code and apply it during checkout for instant monetary deduction.
                </p>
              </div>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                {claimedVouchers.length} Ready to Use
              </span>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {claimedVouchers.map((v) => (
                <div
                  key={v.id}
                  className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50/70 to-white border border-emerald-200/80 shadow-xs flex flex-col justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-black text-emerald-700 bg-emerald-100/80 px-2.5 py-0.5 rounded-full">
                        -₱{v.discountAmount.toLocaleString()} OFF
                      </span>
                      <span className="text-[10px] text-[#24252c]/50">Expires: {v.expiresAt}</span>
                    </div>
                    <h3 className="font-bold text-sm text-[var(--ink)] mt-2">{v.title}</h3>
                  </div>

                  <div className="pt-2 border-t border-emerald-100 flex items-center justify-between gap-2">
                    <code className="text-xs font-mono font-bold bg-white px-2.5 py-1.5 rounded-lg border border-emerald-300 text-emerald-900 tracking-wider">
                      {v.code}
                    </code>
                    <button
                      onClick={() => copyVoucher(v.code)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-full transition-all cursor-pointer ${
                        copiedCode === v.code
                          ? 'bg-emerald-600 text-white'
                          : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                      }`}
                    >
                      {copiedCode === v.code ? 'Copied!' : 'Copy Code'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Available Money Discount Vouchers for Points Redemption */}
        <div className="bg-white rounded-[2rem] p-6 sm:p-7 border border-[#24252c]/[0.08] shadow-sm space-y-5">
          <div>
            <h2 className="text-lg font-bold text-[var(--ink)]">Redeem Discount Money Vouchers</h2>
            <p className="text-xs text-[#24252c]/60 mt-0.5">
              Select a monetary discount tier below to exchange your earned points for direct booking vouchers.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            {discountRewardsList.map((r) => {
              const canAfford = points >= r.cost;
              return (
                <div
                  key={r.id}
                  className={`p-5 rounded-2xl border transition-all flex flex-col justify-between gap-4 ${
                    canAfford
                      ? 'bg-[var(--mist)] border-[#24252c]/[0.08] hover:border-[#1090F8]/40 hover:shadow-md'
                      : 'bg-gray-50 border-gray-200 opacity-60'
                  }`}
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

                  <button
                    onClick={() => handleRedeem(r)}
                    disabled={!canAfford}
                    className={`w-full text-xs font-semibold py-3 rounded-full transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      canAfford
                        ? 'bg-[var(--ink)] text-white hover:bg-[#1090F8] shadow-sm'
                        : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {canAfford ? (
                      <>
                        Redeem ₱{r.discountAmount.toLocaleString()} Voucher <IconArrow className="w-3.5 h-3.5" />
                      </>
                    ) : (
                      `Need ${r.cost - points} More Points`
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Points Activity History */}
        <div className="bg-white rounded-[2rem] p-6 sm:p-7 border border-[#24252c]/[0.08] shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-[var(--ink)]">Points History & Earnings</h2>
              <p className="text-xs text-[#24252c]/60 mt-0.5">Recent points transactions from your completed bookings.</p>
            </div>
            <span className="text-xs font-medium text-[#24252c]/50">Mock Activity</span>
          </div>

          <div className="divide-y divide-[#24252c]/[0.06] text-xs">
            {mockHistory.map((item) => (
              <div key={item.id} className="py-3.5 flex items-center justify-between gap-4">
                <div>
                  <div className="font-semibold text-[var(--ink)]">{item.event}</div>
                  <div className="text-[11px] text-[#24252c]/50 mt-0.5">{item.date}</div>
                </div>
                <span className="font-extrabold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 shrink-0">
                  {item.points}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Success Redemption Modal */}
        <ModalOverlay isOpen={!!activeModalVoucher} onClose={() => setActiveModalVoucher(null)}>
          <div className="bg-white rounded-[2rem] p-6 sm:p-8 max-w-md w-full shadow-2xl border border-[#24252c]/10 relative text-center">
            <button
              onClick={() => setActiveModalVoucher(null)}
              className="absolute top-5 right-5 text-[#24252c]/50 hover:text-[var(--ink)] p-1 cursor-pointer"
            >
              <IconX className="w-5 h-5" />
            </button>

            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 font-extrabold text-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-200 shadow-sm">
              ₱
            </div>

            <h3 className="text-xl font-extrabold text-[var(--ink)] mb-1">Discount Voucher Claimed!</h3>
            <p className="text-xs text-[#24252c]/60 mb-5">
              You redeemed <strong>{activeModalVoucher?.title}</strong> for an instant deduction of{' '}
              <strong className="text-emerald-600">₱{activeModalVoucher?.discountAmount.toLocaleString()}</strong>.
            </p>

            {activeModalVoucher && (
              <div className="bg-[var(--mist)] p-4 rounded-2xl border border-[#24252c]/10 mb-5 text-center">
                <div className="text-[10px] uppercase font-bold text-[#24252c]/50 mb-1">Your Voucher Promo Code</div>
                <div className="flex items-center justify-center gap-2">
                  <code className="text-base font-mono font-black text-[var(--ink)] tracking-wider">
                    {activeModalVoucher.code}
                  </code>
                  <button
                    onClick={() => copyVoucher(activeModalVoucher.code)}
                    className="p-1.5 rounded-lg bg-white border border-[#24252c]/15 hover:bg-gray-50 transition-colors text-xs font-bold cursor-pointer"
                  >
                    {copiedCode === activeModalVoucher.code ? '✓' : 'Copy'}
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <button
                onClick={() => {
                  setActiveModalVoucher(null);
                  go('packages');
                }}
                className="w-full bg-[var(--ink)] text-white font-semibold py-3 rounded-full hover:bg-[var(--ink-soft)] transition-colors cursor-pointer text-xs"
              >
                Use Discount on a Package Now →
              </button>
              <button
                onClick={() => setActiveModalVoucher(null)}
                className="w-full bg-[var(--mist)] text-[var(--ink)] font-semibold py-3 rounded-full hover:bg-gray-200 transition-colors cursor-pointer text-xs"
              >
                Keep Browsing Rewards
              </button>
            </div>
          </div>
        </ModalOverlay>
      </div>
    </section>
  );
}
