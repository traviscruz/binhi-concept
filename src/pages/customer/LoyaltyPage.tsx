import { useState, useEffect } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import { IconShield, IconX, IconArrow, IconTicket, IconCheck } from '../../components/shared/icons';
import { ModalOverlay } from '../../components/shared/ModalOverlay';
import binhiLogo from '../../assets/branding/BINHI Concept Logo.webp';
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
  const [userName, setUserName] = useState<string>('Valued Host');
  const [userEmail, setUserEmail] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'rewards' | 'vouchers' | 'history'>('rewards');

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
      setUserEmail(user.email || '');

      // Fetch user profile name
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, first_name, last_name')
        .eq('id', user.id)
        .maybeSingle();

      if (profile) {
        const name = profile.full_name || `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
        if (name) setUserName(name);
      } else if (user.email) {
        setUserName(user.email.split('@')[0]);
      }

      // Automatically compute points for completed & fully paid bookings, and fetch refreshed data
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

  // Define full tier progression details
  const tierMilestones = [
    {
      id: 'standard',
      name: 'Standard Host',
      shortName: 'Standard',
      minPoints: 0,
      targetPoints: settings.silver_threshold,
      color: '#1090F8',
      barGradient: 'from-blue-500 to-cyan-400',
      pillBg: 'bg-blue-50 text-blue-700 border-blue-200',
      perk: 'Standard Points Earning (₱100 = 1 PTS)',
    },
    {
      id: 'silver',
      name: 'Silver Host',
      shortName: 'Silver',
      minPoints: settings.silver_threshold,
      targetPoints: settings.gold_threshold,
      color: '#64748b',
      barGradient: 'from-slate-600 to-slate-400',
      pillBg: 'bg-slate-100 text-slate-800 border-slate-300',
      perk: 'Priority Soundcheck & Tech Dispatch',
    },
    {
      id: 'gold',
      name: 'VIP Gold Host',
      shortName: 'Gold',
      minPoints: settings.gold_threshold,
      targetPoints: settings.platinum_threshold,
      color: '#f59e0b',
      barGradient: 'from-amber-500 to-yellow-400',
      pillBg: 'bg-amber-50 text-amber-800 border-amber-300',
      perk: 'VIP Discount Vouchers & Express Support',
    },
    {
      id: 'platinum',
      name: 'VIP Platinum Host',
      shortName: 'Platinum',
      minPoints: settings.platinum_threshold,
      targetPoints: settings.platinum_threshold,
      color: '#a855f7',
      barGradient: 'from-purple-600 via-pink-500 to-indigo-600',
      pillBg: 'bg-purple-50 text-purple-800 border-purple-300',
      perk: 'Executive Concierge & Maximum Discounts',
    },
  ];

  // Calculate current tier index & target
  const currentTierIndex =
    points >= settings.platinum_threshold
      ? 3
      : points >= settings.gold_threshold
      ? 2
      : points >= settings.silver_threshold
      ? 1
      : 0;

  const currentTier = tierMilestones[currentTierIndex];
  const nextTier = currentTierIndex < 3 ? tierMilestones[currentTierIndex + 1] : null;

  // Step progress percentage within current tier
  const stepProgress = (() => {
    if (currentTierIndex === 3) return 100;
    if (currentTierIndex === 2) {
      const range = settings.platinum_threshold - settings.gold_threshold;
      if (range <= 0) return 100;
      return Math.min(100, Math.max(0, Math.round(((points - settings.gold_threshold) / range) * 100)));
    }
    if (currentTierIndex === 1) {
      const range = settings.gold_threshold - settings.silver_threshold;
      if (range <= 0) return 100;
      return Math.min(100, Math.max(0, Math.round(((points - settings.silver_threshold) / range) * 100)));
    }
    const range = settings.silver_threshold;
    if (range <= 0) return 100;
    return Math.min(100, Math.max(0, Math.round((points / range) * 100)));
  })();

  // 3 Milestone Segments (Standard->Silver, Silver->Gold, Gold->Platinum)
  const tierSegments = [
    {
      id: 'seg-silver',
      targetName: 'Silver',
      min: 0,
      max: settings.silver_threshold,
      isCompleted: points >= settings.silver_threshold,
      isCurrent: currentTierIndex === 0,
      isLocked: false,
      progress: Math.min(100, Math.max(0, Math.round((points / Math.max(1, settings.silver_threshold)) * 100))),
    },
    {
      id: 'seg-gold',
      targetName: 'Gold',
      min: settings.silver_threshold,
      max: settings.gold_threshold,
      isCompleted: points >= settings.gold_threshold,
      isCurrent: currentTierIndex === 1,
      isLocked: points < settings.silver_threshold,
      progress:
        points >= settings.gold_threshold
          ? 100
          : points < settings.silver_threshold
          ? 0
          : Math.round(((points - settings.silver_threshold) / Math.max(1, settings.gold_threshold - settings.silver_threshold)) * 100),
    },
    {
      id: 'seg-platinum',
      targetName: 'Platinum',
      min: settings.gold_threshold,
      max: settings.platinum_threshold,
      isCompleted: points >= settings.platinum_threshold,
      isCurrent: currentTierIndex === 2,
      isLocked: points < settings.gold_threshold,
      progress:
        points >= settings.platinum_threshold
          ? 100
          : points < settings.gold_threshold
          ? 0
          : Math.round(((points - settings.gold_threshold) / Math.max(1, settings.platinum_threshold - settings.gold_threshold)) * 100),
    },
  ];

  // Get dynamic card theme based on tier
  const getTierTheme = () => {
    if (points >= settings.platinum_threshold) {
      return {
        bg: 'from-[#140b2b] via-[#211145] to-[#0c051a]',
        accent: '#c084fc',
        badgeBg: 'bg-purple-500/25 border-purple-400/40 text-purple-200',
        cardBorder: 'border-purple-500/30',
        glow: 'rgba(192, 132, 252, 0.35)',
        chipBg: 'from-purple-300 via-amber-200 to-purple-400',
        chipText: 'text-purple-950',
      };
    }
    if (points >= settings.gold_threshold) {
      return {
        bg: 'from-[#2b1f09] via-[#45300f] to-[#1a1205]',
        accent: '#fbbf24',
        badgeBg: 'bg-amber-500/25 border-amber-400/40 text-amber-200',
        cardBorder: 'border-amber-500/30',
        glow: 'rgba(251, 191, 36, 0.35)',
        chipBg: 'from-amber-200 via-yellow-100 to-amber-300',
        chipText: 'text-amber-950',
      };
    }
    if (points >= settings.silver_threshold) {
      return {
        bg: 'from-[#1a202c] via-[#2d3748] to-[#121722]',
        accent: '#e2e8f0',
        badgeBg: 'bg-slate-400/25 border-slate-300/40 text-slate-100',
        cardBorder: 'border-slate-400/30',
        glow: 'rgba(226, 232, 240, 0.25)',
        chipBg: 'from-slate-200 via-gray-100 to-slate-300',
        chipText: 'text-slate-900',
      };
    }
    return {
      bg: 'from-[#0a1835] via-[#102756] to-[#050e21]',
      accent: '#1090F8',
      badgeBg: 'bg-blue-500/25 border-blue-400/40 text-blue-200',
      cardBorder: 'border-blue-500/30',
      glow: 'rgba(16, 144, 248, 0.35)',
      chipBg: 'from-cyan-300 via-blue-200 to-blue-400',
      chipText: 'text-blue-950',
    };
  };

  const theme = getTierTheme();

  return (
    <section className="pt-28 sm:pt-36 md:pt-40 pb-28 px-4 sm:px-6 min-h-screen bg-[#F8F9FC] relative overflow-hidden">
      {/* Background Decorative Ambient Blobs */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-to-b from-[#1090F8]/8 via-purple-500/5 to-transparent rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Top Header */}
        <div className="pb-2">
          <MonoBadge icon={IconShield}>BINHI Host Rewards Program</MonoBadge>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-[var(--ink)] mt-2">
            Host Loyalty &amp; Rewards
          </h1>
          <p className="text-xs sm:text-sm text-[#24252c]/65 mt-1 max-w-xl leading-relaxed">
            Earn points automatically on every completed booking. Exchange your points for instant monetary discount vouchers on future event productions.
          </p>
        </div>

        {/* LOADING SKELETON */}
        {isLoading ? (
          <div className="space-y-6 animate-pulse">
            <div className="grid lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 h-72 rounded-[2.5rem] bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700/50 p-8 flex flex-col justify-between" />
              <div className="lg:col-span-5 grid grid-cols-2 gap-4">
                <div className="h-34 rounded-3xl bg-slate-200/80 border border-slate-300/40" />
                <div className="h-34 rounded-3xl bg-slate-200/80 border border-slate-300/40" />
                <div className="col-span-2 h-34 rounded-3xl bg-slate-200/80 border border-slate-300/40" />
              </div>
            </div>
            <div className="h-96 rounded-[2.5rem] bg-slate-200/70 border border-slate-300/40" />
          </div>
        ) : (
          <>
            {/* VIP MEMBER CARD & TIER PROGRESSION ROW */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
              
              {/* Left Column: Authentic Compact VIP Membership Card & Quick Stats */}
              <div className="flex flex-col justify-between gap-4">
                {/* Physical Credit Card Proportioned VIP Pass */}
                <div
                  className={`w-full aspect-[1.62/1] min-h-[220px] rounded-[2rem] p-6 sm:p-7 text-white relative overflow-hidden shadow-xl bg-gradient-to-br ${theme.bg} border ${theme.cardBorder} flex flex-col justify-between transition-all duration-300 hover:scale-[1.005]`}
                  style={{
                    boxShadow: `0 20px 40px -15px ${theme.glow}, 0 0 0 1px rgba(255, 255, 255, 0.12) inset`,
                  }}
                >
                  {/* Subtle Laser Reflection Sheen */}
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/20 via-transparent to-transparent pointer-events-none" />
                  <div
                    className="absolute -right-16 -bottom-16 w-60 h-60 rounded-full blur-3xl pointer-events-none opacity-40"
                    style={{ backgroundColor: theme.accent }}
                  />

                  {/* Card Top: Brand Logo, EMV Chip & VIP Status Badge */}
                  <div className="relative z-10 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-md p-1.5 border border-white/25 flex items-center justify-center shrink-0 shadow-2xs">
                        <img
                          src={binhiLogo}
                          alt="BINHI Concept"
                          className="w-full h-full object-contain filter brightness-110 drop-shadow"
                          draggable={false}
                        />
                      </div>
                      <div>
                        <div className="text-[9px] tracking-[0.2em] font-black uppercase text-white/60 leading-none">BINHI EXCLUSIVE</div>
                        <div className="text-[11px] font-extrabold text-white mt-0.5 tracking-wide">HOST MEMBERSHIP PASS</div>
                      </div>
                    </div>

                    {/* Tier Pill */}
                    <div
                      className={`inline-flex items-center gap-1.5 border text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider shadow-md backdrop-blur-md shrink-0 ${theme.badgeBg}`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                      <span>{tierInfo.tierName}</span>
                    </div>
                  </div>

                  {/* Card Center: EMV Chip & Points Balance */}
                  <div className="relative z-10 my-auto py-2 flex items-center justify-between gap-4">
                    {/* Golden Holographic Smart Chip */}
                    <div className="flex items-center gap-2">
                      <div className={`w-10 h-7 rounded-lg bg-gradient-to-br ${theme.chipBg} p-1 shadow-inner border border-white/40 flex flex-col justify-between overflow-hidden relative shrink-0`}>
                        <div className="w-full h-0.5 bg-black/25" />
                        <div className="w-full h-0.5 bg-black/25" />
                        <div className="w-full h-0.5 bg-black/25" />
                        <div className="absolute right-2.5 top-0 bottom-0 w-0.5 bg-black/25" />
                      </div>

                      {/* Contactless Wave Signal */}
                      <svg className="w-5 h-5 text-white/50 rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0" />
                      </svg>
                    </div>

                    {/* Points Balance Tag */}
                    <div className="text-right">
                      <div className="text-[9px] font-bold tracking-wider text-white/60 uppercase">Reward Balance</div>
                      <div className="flex items-baseline justify-end gap-1.5">
                        <span className="text-2xl sm:text-3xl font-black tracking-tight text-white drop-shadow-sm">
                          {points.toLocaleString()}
                        </span>
                        <span className="text-sm font-black" style={{ color: theme.accent }}>
                          PTS
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Bottom: Cardholder Name, Membership ID & Cash Value */}
                  <div className="relative z-10 pt-3 border-t border-white/15 flex items-end justify-between gap-3">
                    <div>
                      <div className="text-[8px] font-bold text-white/45 uppercase tracking-widest leading-none">Cardholder Host</div>
                      <div className="text-xs font-black text-white tracking-wide uppercase mt-1 truncate max-w-[170px]">{userName}</div>
                      <div className="text-[9px] text-white/50 font-mono mt-0.5">
                        {userEmail ? `${userEmail.slice(0, 3)}••••@${userEmail.split('@')[1] || ''}` : 'BNH-VIP-MEMBER'}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[8px] font-bold text-white/45 uppercase tracking-widest leading-none">Rental Credit</div>
                      <div className="text-xs font-black text-emerald-300 mt-1">
                        ≈ ₱{estimatedCashValue.toLocaleString()} OFF
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2 Quick Summary Stats directly below card */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white rounded-[2rem] p-5 border border-[#24252c]/[0.08] shadow-sm flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black text-lg border border-emerald-200 shrink-0">
                      ₱
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[#24252c]/50">Estimated Value</div>
                      <div className="text-lg font-black text-emerald-600">
                        ₱{estimatedCashValue.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-[2rem] p-5 border border-[#24252c]/[0.08] shadow-sm flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[#1090F8] flex items-center justify-center font-bold border border-blue-200 shrink-0">
                      <IconTicket className="w-5 h-5 text-[#1090F8]" />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[#24252c]/50">Claimed Vouchers</div>
                      <div className="text-lg font-black text-[var(--ink)]">
                        {claimedVouchers.length} Ready
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: VIP Tier Progression & Privileges Card */}
              <div className="flex flex-col justify-between h-full">
                <div className="bg-white rounded-[2.5rem] p-6 sm:p-7 border border-[#24252c]/[0.08] shadow-sm flex flex-col justify-between h-full gap-5 relative overflow-hidden">
                  {/* Subtle ambient light in the top-right corner */}
                  <div
                    className="absolute -top-16 -right-16 w-40 h-40 rounded-full blur-2xl opacity-20 pointer-events-none"
                    style={{ backgroundColor: currentTier.color }}
                  />

                  <div className="space-y-4 relative z-10">
                    {/* Header: Title & Current Tier Pill */}
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#24252c]/50 block">
                          VIP Tier Progression
                        </span>
                        <h3 className="text-lg font-black text-[var(--ink)] mt-0.5 tracking-tight">
                          {currentTier.name}
                        </h3>
                      </div>

                      <div className={`inline-flex items-center gap-1.5 text-xs font-black px-3.5 py-1.5 rounded-full border shadow-2xs ${currentTier.pillBg}`}>
                        <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                        <span>{currentTier.shortName} Rank</span>
                      </div>
                    </div>

                    {/* Hero Progress Bar Card */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[#F8F9FC] to-white border border-[#24252c]/[0.08] shadow-xs space-y-3">
                      <div className="flex items-baseline justify-between gap-2">
                        <div>
                          <div className="text-[10px] font-bold text-[#24252c]/50 uppercase tracking-wider">
                            {nextTier ? `Progress to ${nextTier.shortName}` : 'All Milestones Completed'}
                          </div>
                          <div className="flex items-baseline gap-1.5 mt-0.5">
                            <span className="text-2xl font-black text-[var(--ink)] tracking-tight">
                              {points.toLocaleString()}
                            </span>
                            <span className="text-xs font-bold text-[#24252c]/50">
                              {nextTier ? `/ ${nextTier.minPoints.toLocaleString()} PTS` : 'PTS'}
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-xs font-black text-[#1090F8] bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full shadow-2xs inline-block">
                            {stepProgress}% Completed
                          </span>
                        </div>
                      </div>

                      {/* Dynamic Glow Progress Bar */}
                      <div className="relative w-full h-3.5 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-[#24252c]/10 shadow-inner">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${currentTier.barGradient} transition-all duration-700 ease-out shadow-sm`}
                          style={{ width: `${Math.max(4, stepProgress)}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-[#24252c]/65 font-medium pt-0.5">
                        <span>
                          {nextTier ? (
                            <>
                              <strong className="text-[var(--ink)] font-extrabold">{(nextTier.minPoints - points).toLocaleString()} PTS</strong> until {nextTier.shortName} Host
                            </>
                          ) : (
                            <span className="text-purple-700 font-extrabold">Top VIP Rank Active</span>
                          )}
                        </span>
                        <span className="text-[10px] font-bold text-[#24252c]/45">
                          ₱{settings.points_per_peso} = 1 PTS
                        </span>
                      </div>
                    </div>

                    {/* 4 Tier Milestone Ranks List */}
                    <div className="space-y-2 pt-1">
                      <div className="text-[10px] font-extrabold uppercase tracking-widest text-[#24252c]/50">
                        Rank Milestones &amp; Unlocks
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {tierMilestones.map((tm, idx) => {
                          const isReached = points >= tm.minPoints;
                          const isCurrent = currentTierIndex === idx;

                          return (
                            <div
                              key={tm.id}
                              className={`p-3 rounded-2xl border transition-all flex flex-col justify-between gap-1.5 ${
                                isCurrent
                                  ? 'bg-gradient-to-br from-blue-50/90 via-white to-white border-[#1090F8]/40 shadow-sm ring-1 ring-[#1090F8]/20'
                                  : isReached
                                  ? 'bg-slate-50/80 border-slate-200/80 text-slate-800'
                                  : 'bg-white border-slate-100 opacity-55'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className={`text-xs font-black ${isCurrent ? 'text-[#1090F8]' : isReached ? 'text-[var(--ink)]' : 'text-slate-500'}`}>
                                  {tm.shortName}
                                </span>
                                
                                {isCurrent ? (
                                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-[#1090F8] text-white">
                                    Current
                                  </span>
                                ) : isReached ? (
                                  <span className="text-[9px] font-extrabold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200">
                                    ✓ Unlocked
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-bold text-slate-400">
                                    {tm.minPoints.toLocaleString()} PTS
                                  </span>
                                )}
                              </div>

                              <div className="text-[10px] text-[#24252c]/65 font-medium leading-tight truncate" title={tm.perk}>
                                {tm.perk}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Footer Perk Highlight */}
                  <div className="pt-3 border-t border-[#24252c]/[0.06] text-[11px] text-[#24252c]/75 flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="font-extrabold text-[var(--ink)]">Active Privilege:</span>
                      <span className="truncate font-medium">{currentTier.perk}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* TAB NAVIGATION: REWARDS STORE, ACTIVE VOUCHERS, ACTIVITY LEDGER */}
            <div className="flex items-center gap-2 border-b border-[#24252c]/10 pb-2 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveTab('rewards')}
                className={`text-xs sm:text-sm font-bold px-5 py-2.5 rounded-full transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                  activeTab === 'rewards'
                    ? 'bg-[var(--ink)] text-white shadow-sm'
                    : 'bg-white text-[#24252c]/60 hover:text-[var(--ink)] border border-[#24252c]/10 hover:bg-[var(--mist)]'
                }`}
              >
                <span>Redeem Rewards Store</span>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${activeTab === 'rewards' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'}`}>
                  {rewardsList.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('vouchers')}
                className={`text-xs sm:text-sm font-bold px-5 py-2.5 rounded-full transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                  activeTab === 'vouchers'
                    ? 'bg-[var(--ink)] text-white shadow-sm'
                    : 'bg-white text-[#24252c]/60 hover:text-[var(--ink)] border border-[#24252c]/10 hover:bg-[var(--mist)]'
                }`}
              >
                <span>My Claimed Vouchers</span>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${activeTab === 'vouchers' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'}`}>
                  {claimedVouchers.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`text-xs sm:text-sm font-bold px-5 py-2.5 rounded-full transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                  activeTab === 'history'
                    ? 'bg-[var(--ink)] text-white shadow-sm'
                    : 'bg-white text-[#24252c]/60 hover:text-[var(--ink)] border border-[#24252c]/10 hover:bg-[var(--mist)]'
                }`}
              >
                <span>Points History &amp; Earnings</span>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${activeTab === 'history' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'}`}>
                  {transactions.length}
                </span>
              </button>
            </div>

            {/* TAB 1: REWARDS STORE (REDEEMABLE VOUCHERS) */}
            {activeTab === 'rewards' && (
              <div className="space-y-6 animate-fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h2 className="text-xl font-extrabold text-[var(--ink)]">Redeem Discount Money Vouchers</h2>
                    <p className="text-xs text-[#24252c]/60 mt-0.5">
                      Exchange your loyalty points for high-value monetary discount coupons applied instantly during booking checkout.
                    </p>
                  </div>
                  <div className="text-xs font-semibold text-[#24252c]/50">
                    Your Balance: <strong className="text-[#1090F8] font-extrabold">{points.toLocaleString()} PTS</strong>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {rewardsList.map((r) => {
                    const canAfford = points >= r.cost;
                    const progress = Math.min(100, Math.round((points / r.cost) * 100));

                    return (
                      <div
                        key={r.id}
                        className={`rounded-[2rem] p-6 border transition-all duration-300 flex flex-col justify-between gap-5 relative group ${
                          canAfford
                            ? 'bg-white border-[#24252c]/10 hover:border-[#1090F8]/50 hover:shadow-xl hover:-translate-y-1'
                            : 'bg-white/80 border-slate-200/80 opacity-75'
                        }`}
                      >
                        {/* Voucher Header: Tag & Cost */}
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-3">
                            <span className="text-xs font-black text-[#1090F8] bg-blue-50 border border-blue-200 px-3 py-1 rounded-full shadow-2xs">
                              {r.cost} PTS
                            </span>
                            {r.badge && (
                              <span className="text-[10px] font-extrabold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                                {r.badge}
                              </span>
                            )}
                          </div>

                          {/* Discount Big Typography */}
                          <div className="text-2xl sm:text-3xl font-black text-emerald-600 tracking-tight">
                            ₱{r.discountAmount.toLocaleString()}{' '}
                            <span className="text-xs sm:text-sm font-bold text-[var(--ink)]">Discount</span>
                          </div>

                          <h3 className="font-extrabold text-sm text-[var(--ink)] mt-2 leading-snug">{r.title}</h3>
                          <p className="text-xs text-[#24252c]/65 mt-1.5 leading-relaxed">{r.desc}</p>
                        </div>

                        {/* Progress or Direct Redeem Action */}
                        <div className="space-y-3 pt-4 border-t border-[#24252c]/[0.06]">
                          {!canAfford && (
                            <div className="space-y-1">
                              <div className="flex justify-between text-[10px] font-bold text-[#24252c]/50">
                                <span>Progress</span>
                                <span>{progress}% ({points}/{r.cost} PTS)</span>
                              </div>
                              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-slate-400 rounded-full"
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => handleRedeem(r)}
                            disabled={!canAfford || isRedeeming}
                            className={`w-full text-xs font-bold py-3.5 rounded-full transition-all cursor-pointer flex items-center justify-center gap-2 ${
                              canAfford
                                ? 'bg-[var(--ink)] text-white hover:bg-[#1090F8] shadow-md hover:shadow-lg'
                                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            }`}
                          >
                            {canAfford ? (
                              <>
                                <span>Redeem ₱{r.discountAmount.toLocaleString()} Voucher</span>
                                <IconArrow className="w-3.5 h-3.5" />
                              </>
                            ) : (
                              `Need ${r.cost - points} More Points`
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 2: MY CLAIMED VOUCHERS (ACTIVE WALLET) */}
            {activeTab === 'vouchers' && (
              <div className="space-y-6 animate-fade-in">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-extrabold text-[var(--ink)]">My Active Claimed Vouchers</h2>
                    <p className="text-xs text-[#24252c]/60 mt-0.5">
                      Copy your personal voucher codes below and paste them on the checkout page for instant price deduction.
                    </p>
                  </div>
                  <span className="text-xs font-extrabold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                    {claimedVouchers.length} Active Codes
                  </span>
                </div>

                {claimedVouchers.length === 0 ? (
                  <div className="bg-white rounded-[2rem] p-12 text-center border border-[#24252c]/10 space-y-4">
                    <div className="w-16 h-16 rounded-2xl bg-blue-50 text-[#1090F8] flex items-center justify-center mx-auto border border-blue-200 shadow-2xs">
                      <IconTicket className="w-7 h-7 text-[#1090F8]" />
                    </div>
                    <h3 className="text-lg font-bold text-[var(--ink)]">No Claimed Vouchers Yet</h3>
                    <p className="text-xs text-[#24252c]/60 max-w-md mx-auto">
                      You haven't claimed any discount vouchers yet. Use your available loyalty points in the Rewards Store to get discounts!
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveTab('rewards')}
                      className="bg-[var(--ink)] text-white font-bold text-xs px-6 py-3 rounded-full hover:bg-[var(--ink-soft)] transition-colors cursor-pointer shadow-sm inline-flex items-center gap-2"
                    >
                      <span>Go to Rewards Store</span>
                      <IconArrow className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {claimedVouchers.map((v) => (
                      <div
                        key={v.id}
                        className="rounded-[2rem] bg-gradient-to-br from-emerald-50/80 via-white to-white border border-emerald-200/90 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-4 relative overflow-hidden"
                      >
                        {/* Perforated Ticket Notches */}
                        <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#F8F9FC] border-r border-emerald-200" />
                        <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#F8F9FC] border-l border-emerald-200" />

                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-black text-emerald-800 bg-emerald-100 px-3 py-0.5 rounded-full border border-emerald-300">
                              -₱{v.discountAmount.toLocaleString()} DEDUCTION
                            </span>
                            <span className="text-[10px] text-[#24252c]/50">Expires: {v.expiresAt}</span>
                          </div>
                          <h3 className="font-extrabold text-sm text-[var(--ink)] mt-2.5">{v.title}</h3>
                          <div className="text-[11px] text-[#24252c]/50 mt-1">Claimed: {v.claimedAt}</div>
                        </div>

                        {/* Code & Action Box */}
                        <div className="pt-3 border-t border-dashed border-emerald-200 flex items-center justify-between gap-2">
                          <code className="text-xs font-mono font-black bg-white px-3 py-2 rounded-xl border border-emerald-300 text-emerald-950 tracking-wider select-all">
                            {v.code}
                          </code>
                          <button
                            type="button"
                            onClick={() => copyVoucher(v.code)}
                            className={`text-xs font-extrabold px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                              copiedCode === v.code
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300/60'
                            }`}
                          >
                            {copiedCode === v.code ? (
                              <>
                                <IconCheck className="w-3.5 h-3.5" />
                                <span>Copied!</span>
                              </>
                            ) : (
                              <span>Copy Code</span>
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: POINTS ACTIVITY HISTORY LEDGER */}
            {activeTab === 'history' && (
              <div className="bg-white rounded-[2.5rem] p-6 sm:p-8 border border-[#24252c]/[0.08] shadow-sm space-y-5 animate-fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h2 className="text-xl font-extrabold text-[var(--ink)]">Points History &amp; Earnings Ledger</h2>
                    <p className="text-xs text-[#24252c]/60 mt-0.5">
                      Immutable real-time audit record of point earnings from completed bookings and redemptions.
                    </p>
                  </div>
                  <span className="text-xs font-bold text-[#24252c]/50">
                    {transactions.length} Total Recorded {transactions.length === 1 ? 'Entry' : 'Entries'}
                  </span>
                </div>

                {transactions.length === 0 ? (
                  <div className="p-12 text-center bg-[var(--mist)]/60 rounded-3xl border border-dashed border-[#24252c]/10 text-xs text-[#24252c]/50">
                    No points transactions yet. Your completed event bookings and verified reviews will automatically appear here!
                  </div>
                ) : (
                  <div className="divide-y divide-[#24252c]/[0.06] text-xs">
                    {transactions.map((item) => {
                      const isEarn = item.type === 'earn' || item.points > 0;
                      return (
                        <div key={item.id} className="py-4 flex items-center justify-between gap-4 hover:bg-[var(--mist)]/40 px-3 rounded-2xl transition-colors">
                          <div className="flex items-center gap-3">
                            <span
                              className={`w-9 h-9 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 border ${
                                isEarn
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}
                            >
                              {isEarn ? '↑' : '↓'}
                            </span>
                            <div>
                              <div className="font-bold text-[var(--ink)] text-xs sm:text-sm">{item.event_name}</div>
                              <div className="text-[11px] text-[#24252c]/50 mt-0.5 font-medium">
                                {new Date(item.created_at).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </div>
                            </div>
                          </div>

                          <span
                            className={`font-black text-xs sm:text-sm px-3.5 py-1.5 rounded-full border shrink-0 ${
                              isEarn
                                ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                                : 'text-rose-700 bg-rose-50 border-rose-200'
                            }`}
                          >
                            {isEarn ? `+${item.points}` : item.points} PTS
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* CELEBRATION VOUCHER CLAIM MODAL */}
            <ModalOverlay isOpen={!!activeModalVoucher} onClose={() => setActiveModalVoucher(null)}>
              <div className="bg-white rounded-[2.5rem] p-6 sm:p-8 max-w-md w-full shadow-2xl border border-[#24252c]/10 relative text-center animate-in zoom-in-95 duration-200">
                <button
                  onClick={() => setActiveModalVoucher(null)}
                  className="absolute top-5 right-5 text-[#24252c]/40 hover:text-[var(--ink)] p-1.5 rounded-full hover:bg-[var(--mist)] cursor-pointer"
                >
                  <IconX className="w-5 h-5" />
                </button>

                {/* Confetti & Icon */}
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 font-black text-3xl flex items-center justify-center mx-auto mb-4 border border-emerald-200 shadow-md">
                  ₱
                </div>

                <div className="inline-block px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-extrabold uppercase tracking-wider mb-2">
                  Voucher Claimed Successfully!
                </div>

                <h3 className="text-2xl font-black text-[var(--ink)] tracking-tight">
                  ₱{activeModalVoucher?.discountAmount.toLocaleString()} OFF Unlocked
                </h3>
                <p className="text-xs text-[#24252c]/65 mt-1.5 mb-6 leading-relaxed">
                  You redeemed <strong>{activeModalVoucher?.title}</strong>. Apply your code at checkout for an instant subtotal discount.
                </p>

                {activeModalVoucher && (
                  <div className="bg-gradient-to-br from-emerald-50/80 to-white p-5 rounded-3xl border border-emerald-200/90 mb-6 text-center shadow-xs">
                    <div className="text-[10px] uppercase font-extrabold text-emerald-800/60 tracking-wider mb-1.5">
                      Your Voucher Promo Code
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <code className="text-lg font-mono font-black text-emerald-950 tracking-wider bg-white px-3 py-1.5 rounded-xl border border-emerald-300 shadow-2xs">
                        {activeModalVoucher.code}
                      </code>
                      <button
                        onClick={() => copyVoucher(activeModalVoucher.code)}
                        className="px-3.5 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors text-xs font-bold cursor-pointer shadow-sm flex items-center gap-1"
                      >
                        {copiedCode === activeModalVoucher.code ? (
                          <>
                            <IconCheck className="w-3.5 h-3.5" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <span>Copy</span>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveModalVoucher(null);
                      go('packages');
                    }}
                    className="w-full bg-[var(--ink)] text-white font-extrabold py-3.5 rounded-full hover:bg-[var(--ink-soft)] transition-all cursor-pointer text-xs shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                  >
                    <span>Use Discount on a Package Now</span>
                    <IconArrow className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveModalVoucher(null)}
                    className="w-full bg-[var(--mist)] text-[var(--ink)] font-bold py-3 rounded-full hover:bg-gray-200 transition-colors cursor-pointer text-xs"
                  >
                    Keep Browsing Rewards
                  </button>
                </div>
              </div>
            </ModalOverlay>
          </>
        )}
      </div>
    </section>
  );
}
