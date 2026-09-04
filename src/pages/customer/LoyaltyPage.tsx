import { useState, useEffect } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import { IconShield, IconX, IconArrow, IconTicket } from '../../components/shared/icons';
import { ModalOverlay } from '../../components/shared/ModalOverlay';
import { supabase } from '../../lib/supabase';
import {
  fetchUserLoyaltyData,
  redeemLoyaltyPoints,
  fetchDiscountRewards,
  type LoyaltyTransaction,
  type LoyaltySettings,
  type DiscountReward,
  DEFAULT_LOYALTY_SETTINGS,
  DEFAULT_REWARDS,
} from '../../utils/loyaltyService';

interface ClaimedVoucher {
  id: string;
  code: string;
  title: string;
  discountAmount: number;
  claimedAt: string;
  expiresAt: string;
}

export default function LoyaltyPage({ go }: { go: (p: Page) => void }) {
  const [points, setPoints] = useState(0);
  const [tierInfo, setTierInfo] = useState({
    tierName: 'Standard Host',
    badgeClass: 'bg-blue-500/20 border-blue-400/40 text-blue-200',
    glowColor: '#1090F8',
    nextTierName: 'Silver Host' as string | null,
    pointsToNext: 500,
  });
  const [settings, setSettings] = useState<LoyaltySettings>(DEFAULT_LOYALTY_SETTINGS);
  const [rewardsList, setRewardsList] = useState<DiscountReward[]>(DEFAULT_REWARDS);
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);
  const [claimedVouchers, setClaimedVouchers] = useState<ClaimedVoucher[]>([]);
  const [activeModalVoucher, setActiveModalVoucher] = useState<ClaimedVoucher | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Load real user loyalty points, rewards catalog & transaction history from Supabase
  const loadLoyalty = async () => {
    try {
      // 1. Fetch live reward options from database
      const liveRewards = await fetchDiscountRewards();
      setRewardsList(liveRewards);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }
      setCurrentUserId(user.id);

      const loyaltyData = await fetchUserLoyaltyData(user.id, user.email || undefined);
      setPoints(loyaltyData.points);
      setTierInfo(loyaltyData.tier);
      setSettings(loyaltyData.settings);
      setTransactions(loyaltyData.transactions);

      // Fetch user's claimed loyalty vouchers from vouchers table
      const { data: voucherRows } = await supabase
        .from('vouchers')
        .select('*')
        .like('description', '%Loyalty Reward%')
        .order('created_at', { ascending: false });

      if (voucherRows && voucherRows.length > 0) {
        const mapped: ClaimedVoucher[] = voucherRows.map((v: any) => ({
          id: v.id,
          code: v.code,
          title: v.description.replace('Loyalty Reward: ', ''),
          discountAmount: Number(v.discount_value || 0),
          claimedAt: new Date(v.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }),
          expiresAt: v.end_date ? new Date(v.end_date).toLocaleDateString() : '60 Days from issue',
        }));
        setClaimedVouchers(mapped);
      }
    } catch (err) {
      console.error('Failed to load loyalty page data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLoyalty();
  }, []);

  const handleRedeem = async (r: DiscountReward) => {
    if (!currentUserId) {
      alert('Please log in to redeem loyalty rewards.');
      return;
    }
    if (points < r.cost) {
      alert(`You need ${r.cost - points} more points to redeem this voucher.`);
      return;
    }

    setIsRedeeming(true);
    try {
      const result = await redeemLoyaltyPoints(currentUserId, r.cost, r.discountAmount, r.title);
      if (!result.success) {
        alert(result.error || 'Failed to redeem reward.');
        return;
      }

      setPoints(result.newBalance);

      const newVoucher: ClaimedVoucher = {
        id: `v-${Date.now()}`,
        code: result.voucherCode,
        title: r.title,
        discountAmount: r.discountAmount,
        claimedAt: 'Just now',
        expiresAt: '60 Days from issue',
      };

      setClaimedVouchers((prev) => [newVoucher, ...prev]);
      setActiveModalVoucher(newVoucher);

      // Refresh transactions and balances
      await loadLoyalty();
    } catch (err) {
      console.error('Redeem error:', err);
      alert('An error occurred while redeeming voucher.');
    } finally {
      setIsRedeeming(false);
    }
  };

  const copyVoucher = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  // 1 PTS ≈ ₱5.00 cash discount value (100 PTS = ₱500)
  const estimatedCashValue = Math.round(points * 5);

  return (
    <section className="pt-28 sm:pt-36 md:pt-40 pb-24 px-4 sm:px-6 min-h-screen bg-[var(--mist)]">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header Title Area */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <MonoBadge icon={IconShield}>BINHI Host Rewards Program</MonoBadge>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-[var(--ink)] mt-2">
              Host Loyalty &amp; Rewards
            </h1>
            <p className="text-xs sm:text-sm text-[#24252c]/60 mt-1 max-w-xl">
              Earn 1 point per ₱{settings.points_per_peso} spent on completed bookings. Convert your points directly into cash discount vouchers for your next event setup.
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
          <div
            className="absolute -right-16 -bottom-16 w-80 h-80 rounded-full blur-3xl pointer-events-none opacity-40"
            style={{ backgroundColor: tierInfo.glowColor }}
          />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div
                className={`inline-flex items-center gap-2 border text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider ${tierInfo.badgeClass}`}
              >
                <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                {tierInfo.tierName}
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {isLoading ? '...' : points.toLocaleString()}{' '}
                <span className="text-[#1090F8]">Points Available</span>
              </h2>
              <p className="text-xs sm:text-sm text-white/70">
                Direct Cash Equivalent:{' '}
                <strong className="text-emerald-400 font-bold">
                  ≈ ₱{estimatedCashValue.toLocaleString()}
                </strong>{' '}
                in rental discount credits
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4 shrink-0">
              <div className="bg-white/10 backdrop-blur-md px-4 sm:px-5 py-3.5 rounded-2xl border border-white/15 text-left">
                <div className="text-[10px] uppercase font-bold text-white/60 tracking-wider">Points Balance</div>
                <div className="text-xl sm:text-2xl font-black text-white mt-0.5">
                  {isLoading ? '...' : points.toLocaleString()} PTS
                </div>
              </div>
              <div className="bg-emerald-500/15 backdrop-blur-md px-4 sm:px-5 py-3.5 rounded-2xl border border-emerald-500/30 text-left">
                <div className="text-[10px] uppercase font-bold text-emerald-300 tracking-wider">Cash Value</div>
                <div className="text-xl sm:text-2xl font-black text-emerald-300 mt-0.5">
                  ₱{estimatedCashValue.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* Tier Progress Bar */}
          <div className="relative z-10 mt-6 pt-6 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-white/75">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white">Earning Formula:</span> ₱{settings.points_per_peso} spent = 1 Point · 100 PTS = ₱500 Voucher
            </div>
            {tierInfo.nextTierName && tierInfo.pointsToNext > 0 ? (
              <div className="text-xs text-amber-300 font-medium">
                {tierInfo.pointsToNext.toLocaleString()} PTS away from {tierInfo.nextTierName}
              </div>
            ) : (
              <div className="text-xs text-purple-300 font-bold">
                Max VIP Status Achieved
              </div>
            )}
          </div>
        </div>

        {/* Claimed Discount Vouchers Wallet */}
        {claimedVouchers.length > 0 && (
          <div className="bg-white rounded-[2rem] p-6 sm:p-7 border border-[#24252c]/[0.08] shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-[var(--ink)]">My Active Discount Vouchers</h2>
                <p className="text-xs text-[#24252c]/60 mt-0.5">
                  Copy your voucher promo code and apply it during checkout for instant monetary deduction.
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
            {rewardsList.map((r) => {
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
                    disabled={!canAfford || isRedeeming}
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

        {/* Points Activity History (Live Database Transactions) */}
        <div className="bg-white rounded-[2rem] p-6 sm:p-7 border border-[#24252c]/[0.08] shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-[var(--ink)]">Points History &amp; Earnings</h2>
              <p className="text-xs text-[#24252c]/60 mt-0.5">Real-time point accumulation from your completed bookings &amp; redemptions.</p>
            </div>
            <span className="text-xs font-medium text-[#24252c]/50">
              {transactions.length} {transactions.length === 1 ? 'Transaction' : 'Transactions'}
            </span>
          </div>

          {transactions.length === 0 ? (
            <div className="p-8 text-center bg-[var(--mist)] rounded-2xl border border-dashed border-[#24252c]/10 text-xs text-[#24252c]/50">
              No points history yet. Completed event bookings will automatically award points to your balance!
            </div>
          ) : (
            <div className="divide-y divide-[#24252c]/[0.06] text-xs">
              {transactions.map((item) => (
                <div key={item.id} className="py-3.5 flex items-center justify-between gap-4">
                  <div>
                    <div className="font-semibold text-[var(--ink)]">{item.event_name}</div>
                    <div className="text-[11px] text-[#24252c]/50 mt-0.5">
                      {new Date(item.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                  <span
                    className={`font-extrabold px-3 py-1 rounded-full border shrink-0 ${
                      item.type === 'earn' || item.points > 0
                        ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
                        : 'text-rose-600 bg-rose-50 border-rose-200'
                    }`}
                  >
                    {item.points > 0 ? `+${item.points}` : item.points} PTS
                  </span>
                </div>
              ))}
            </div>
          )}
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
