import { supabase } from './supabase';

export interface LoyaltySettings {
  points_per_peso: number;
  silver_threshold: number;
  gold_threshold: number;
  platinum_threshold: number;
}

export interface LoyaltyTransaction {
  id: string;
  user_id: string;
  booking_id?: string | null;
  event_name: string;
  points: number;
  type: 'earn' | 'redeem';
  created_at: string;
}

export interface DiscountReward {
  id: string;
  cost: number;
  discountAmount: number;
  title: string;
  desc: string;
  badge?: string;
  isActive?: boolean;
}

export const DEFAULT_LOYALTY_SETTINGS: LoyaltySettings = {
  points_per_peso: 100, // ₱100 spent = 1 Point
  silver_threshold: 500,
  gold_threshold: 1500,
  platinum_threshold: 4000,
};

export const DEFAULT_REWARDS: DiscountReward[] = [
  {
    id: 'disc-500',
    cost: 100,
    discountAmount: 500,
    title: '₱500 Cash Discount Voucher',
    desc: 'Instant ₱500 deduction applied directly to your booking subtotal on any equipment or package.',
    badge: 'Popular',
    isActive: true,
  },
  {
    id: 'disc-1500',
    cost: 250,
    discountAmount: 1500,
    title: '₱1,500 Production Discount Voucher',
    desc: 'Save ₱1,500 on standard or multi-day event production sound & lighting reservations.',
    badge: 'Best Value',
    isActive: true,
  },
  {
    id: 'disc-3000',
    cost: 500,
    discountAmount: 3000,
    title: '₱3,000 Major Event Discount Voucher',
    desc: 'Flat ₱3,000 cash discount voucher directly applied to celebrations, concerts, or grand setups.',
    badge: 'High Saver',
    isActive: true,
  },
  {
    id: 'disc-6500',
    cost: 1000,
    discountAmount: 6500,
    title: '₱6,500 VIP Celebration Voucher',
    desc: 'Exclusive VIP host voucher offering ₱6,500 in direct rental fee credit.',
    badge: 'VIP Exclusive',
    isActive: true,
  },
  {
    id: 'disc-10000',
    cost: 1500,
    discountAmount: 10000,
    title: '₱10,000 Executive Credit Voucher',
    desc: 'Maximum tier voucher granting ₱10,000 direct deduction on premium arena & wedding packages.',
    badge: 'Executive Tier',
    isActive: true,
  },
];

/**
 * Fetch Admin Loyalty Configuration from database
 */
export async function fetchLoyaltySettings(): Promise<LoyaltySettings> {
  try {
    const { data, error } = await supabase
      .from('loyalty_settings')
      .select('*')
      .eq('id', 'default_config')
      .maybeSingle();

    if (error || !data) {
      return DEFAULT_LOYALTY_SETTINGS;
    }

    return {
      points_per_peso: Number(data.points_per_peso) || 100,
      silver_threshold: Number(data.silver_threshold) || 500,
      gold_threshold: Number(data.gold_threshold) || 1500,
      platinum_threshold: Number(data.platinum_threshold) || 4000,
    };
  } catch (err) {
    console.warn('Using default loyalty settings due to error:', err);
    return DEFAULT_LOYALTY_SETTINGS;
  }
}

/**
 * Save Admin Loyalty Configuration to database
 */
export async function saveLoyaltySettings(settings: LoyaltySettings): Promise<void> {
  const { error } = await supabase
    .from('loyalty_settings')
    .upsert({
      id: 'default_config',
      points_per_peso: settings.points_per_peso,
      silver_threshold: settings.silver_threshold,
      gold_threshold: settings.gold_threshold,
      platinum_threshold: settings.platinum_threshold,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    console.error('Failed to save loyalty settings:', error);
    throw error;
  }
}

/**
 * Fetch all redeemable discount rewards from database (CRUD - Read)
 */
export async function fetchDiscountRewards(): Promise<DiscountReward[]> {
  try {
    const { data, error } = await supabase
      .from('loyalty_rewards')
      .select('*')
      .order('cost', { ascending: true });

    if (error || !data || data.length === 0) {
      return DEFAULT_REWARDS;
    }

    return data
      .filter((r: any) => r.is_active !== false)
      .map((r: any) => ({
        id: r.id,
        cost: Number(r.cost),
        discountAmount: Number(r.discount_amount),
        title: r.title,
        desc: r.description || '',
        badge: r.badge || undefined,
        isActive: r.is_active,
      }));
  } catch (err) {
    console.warn('Using fallback default rewards:', err);
    return DEFAULT_REWARDS;
  }
}

/**
 * Save or Update a redeemable discount reward in database (CRUD - Create / Update)
 */
export async function saveDiscountReward(reward: {
  id?: string;
  title: string;
  cost: number;
  discountAmount: number;
  desc?: string;
  badge?: string;
}): Promise<void> {
  const rewardId = reward.id || `disc-${reward.discountAmount}-${Date.now()}`;
  const payload = {
    id: rewardId,
    title: reward.title,
    cost: reward.cost,
    discount_amount: reward.discountAmount,
    description: reward.desc || '',
    badge: reward.badge || null,
    is_active: true,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('loyalty_rewards')
    .upsert(payload);

  if (error) {
    console.error('Failed to save discount reward tier:', error);
    throw error;
  }
}

/**
 * Delete a discount reward from database (CRUD - Delete)
 */
export async function deleteDiscountReward(rewardId: string): Promise<void> {
  const { error } = await supabase
    .from('loyalty_rewards')
    .delete()
    .eq('id', rewardId);

  if (error) {
    console.error('Failed to delete discount reward:', error);
    throw error;
  }
}

/**
 * Helper to compute tier name from point balance
 */
export function computeLoyaltyTier(points: number, settings: LoyaltySettings): {
  tierName: string;
  badgeClass: string;
  glowColor: string;
  nextTierName: string | null;
  pointsToNext: number;
} {
  if (points >= settings.platinum_threshold) {
    return {
      tierName: 'VIP Platinum Host',
      badgeClass: 'bg-purple-500/20 border-purple-400/40 text-purple-200',
      glowColor: '#a855f7',
      nextTierName: null,
      pointsToNext: 0,
    };
  }
  if (points >= settings.gold_threshold) {
    return {
      tierName: 'VIP Gold Host',
      badgeClass: 'bg-amber-400/20 border-amber-400/40 text-amber-300',
      glowColor: '#f59e0b',
      nextTierName: 'VIP Platinum Host',
      pointsToNext: settings.platinum_threshold - points,
    };
  }
  if (points >= settings.silver_threshold) {
    return {
      tierName: 'Silver Host',
      badgeClass: 'bg-slate-300/20 border-slate-300/40 text-slate-200',
      glowColor: '#94a3b8',
      nextTierName: 'VIP Gold Host',
      pointsToNext: settings.gold_threshold - points,
    };
  }
  return {
    tierName: 'Standard Host',
    badgeClass: 'bg-blue-500/20 border-blue-400/40 text-blue-200',
    glowColor: '#1090F8',
    nextTierName: 'Silver Host',
    pointsToNext: settings.silver_threshold - points,
  };
}

/**
 * Automatically compute and award points for completed and fully paid bookings
 */
export async function autoComputeAndAwardBookingPoints(userId: string, userEmail?: string): Promise<number> {
  if (!userId && !userEmail) return 0;
  try {
    const settings = await fetchLoyaltySettings();
    const ptsRatio = Number(settings.points_per_peso) || 100;

    // 1. Find all bookings for this user (by user_id or customer_email)
    let query = supabase.from('bookings').select('*');
    if (userId && userEmail) {
      query = query.or(`user_id.eq.${userId},customer_email.ilike.${userEmail}`);
    } else if (userId) {
      query = query.eq('user_id', userId);
    } else if (userEmail) {
      query = query.ilike('customer_email', userEmail);
    }

    const { data: bookings, error: bookingsErr } = await query;
    if (bookingsErr || !bookings || bookings.length === 0) return 0;

    // 2. Filter strictly for COMPLETED and FULLY PAID bookings (not cancelled)
    const qualifyingBookings = bookings.filter((b: any) => {
      const rawStatus = (b.status || '').toLowerCase();
      const rawPaymentStatus = (b.payment_status || '').toLowerCase();
      const rawBookingStatus = (b.booking_status || '').toLowerCase();

      if (rawStatus === 'cancelled' || rawPaymentStatus === 'cancelled' || rawBookingStatus === 'cancelled') {
        return false;
      }

      const isPast = b.event_date ? new Date(b.event_date).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0) : false;
      const isCompleted = b.is_completed === true || rawStatus === 'completed' || rawPaymentStatus === 'completed' || rawBookingStatus === 'completed' || isPast;
      const isFullyPaid = b.is_fully_paid === true || (Number(b.remaining_balance ?? 0) <= 0 && rawPaymentStatus === 'paid');

      return isCompleted && isFullyPaid;
    });

    if (qualifyingBookings.length === 0) return 0;

    // 3. Fetch existing loyalty transactions for this user to prevent double crediting
    const { data: existingTx } = await supabase
      .from('loyalty_transactions')
      .select('booking_id')
      .eq('user_id', userId);

    const creditedBookingIds = new Set((existingTx || []).map((t: any) => t.booking_id).filter(Boolean));

    let totalNewPoints = 0;
    const newTransactions: any[] = [];

    for (const booking of qualifyingBookings) {
      const bId = booking.id;
      if (!creditedBookingIds.has(bId) && !booking.points_awarded) {
        // Calculate points based on total_cost and admin points_per_peso formula
        const totalAmountSpent = Number(booking.total_cost || booking.total_price || booking.raw_price || 0) || 0;
        const earnedPoints = Math.max(1, Math.floor(totalAmountSpent / ptsRatio));
        totalNewPoints += earnedPoints;

        const bookingRef = booking.paymongo_reference_number || (bId ? `BNH-${bId.slice(0, 8)}` : 'Completed Booking');
        const pkgName = booking.package_name || 'Event Production Setup';

        newTransactions.push({
          user_id: userId,
          booking_id: bId,
          event_name: `Completed Event (${pkgName}) - Ref #${bookingRef}`,
          points: earnedPoints,
          type: 'earn',
          created_at: new Date().toISOString(),
        });

        // Mark booking points_awarded flag in database
        try {
          await supabase
            .from('bookings')
            .update({ points_awarded: true })
            .eq('id', bId);
        } catch (updateErr) {
          console.warn('Booking points_awarded update note:', updateErr);
        }
      }
    }

    if (newTransactions.length > 0) {
      // Insert new transactions to database ledger
      await supabase.from('loyalty_transactions').insert(newTransactions);
    }

    // 4. Reconcile total points balance in profiles table from transaction history
    const { data: allUserTx } = await supabase
      .from('loyalty_transactions')
      .select('points')
      .eq('user_id', userId);

    if (allUserTx) {
      const reconciledBalance = allUserTx.reduce((sum: number, tx: any) => sum + (Number(tx.points) || 0), 0);
      await supabase
        .from('profiles')
        .update({
          loyalty_points: Math.max(0, reconciledBalance),
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);
    }

    return totalNewPoints;
  } catch (err) {
    console.error('Error auto-computing loyalty points for completed bookings:', err);
    return 0;
  }
}

/**
 * Fetch full user loyalty data (points balance, tier, and transaction history)
 */
export async function fetchUserLoyaltyData(userId: string, userEmail?: string): Promise<{
  points: number;
  tier: ReturnType<typeof computeLoyaltyTier>;
  transactions: LoyaltyTransaction[];
  settings: LoyaltySettings;
}> {
  const settings = await fetchLoyaltySettings();

  // Trigger auto-computation for completed bookings
  await autoComputeAndAwardBookingPoints(userId, userEmail);

  // 1. Fetch live balance from profiles
  const { data: profile } = await supabase
    .from('profiles')
    .select('loyalty_points')
    .eq('id', userId)
    .maybeSingle();

  const points = Number(profile?.loyalty_points || 0);
  const tier = computeLoyaltyTier(points, settings);

  // 2. Fetch transaction history
  const { data: txData } = await supabase
    .from('loyalty_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  const transactions: LoyaltyTransaction[] = (txData || []).map((t: any) => ({
    id: t.id,
    user_id: t.user_id,
    booking_id: t.booking_id,
    event_name: t.event_name,
    points: Number(t.points),
    type: t.type,
    created_at: t.created_at,
  }));

  return {
    points,
    tier,
    transactions,
    settings,
  };
}

/**
 * Redeem loyalty points for a discount voucher in database
 */
export async function redeemLoyaltyPoints(
  userId: string,
  rewardCost: number,
  discountAmount: number,
  rewardTitle: string
): Promise<{ success: boolean; newBalance: number; voucherCode: string; error?: string }> {
  try {
    // 1. Check current points balance
    const { data: profile } = await supabase
      .from('profiles')
      .select('loyalty_points')
      .eq('id', userId)
      .maybeSingle();

    const currentPoints = Number(profile?.loyalty_points || 0);
    if (currentPoints < rewardCost) {
      return {
        success: false,
        newBalance: currentPoints,
        voucherCode: '',
        error: `Insufficient loyalty points (You have ${currentPoints} PTS, need ${rewardCost} PTS).`,
      };
    }

    const newBalance = currentPoints - rewardCost;
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const voucherCode = `BINHI-DISC${discountAmount}-${randomSuffix}`;

    // 2. Create actual active discount voucher in public.vouchers
    await supabase.from('vouchers').insert({
      code: voucherCode,
      description: `Loyalty Reward: ${rewardTitle}`,
      discount_type: 'fixed',
      discount_value: discountAmount,
      max_uses: 1,
      used_count: 0,
      is_all_time: false,
      status: 'active',
      show_in_banner: false,
    });

    // 3. Deduct points from user profile
    await supabase
      .from('profiles')
      .update({
        loyalty_points: newBalance,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    // 4. Log redemption transaction in loyalty_transactions
    await supabase.from('loyalty_transactions').insert({
      user_id: userId,
      event_name: `Redeemed ${rewardTitle} (Code: ${voucherCode})`,
      points: -rewardCost,
      type: 'redeem',
      created_at: new Date().toISOString(),
    });

    return {
      success: true,
      newBalance,
      voucherCode,
    };
  } catch (err: any) {
    console.error('Error redeeming loyalty points:', err);
    return {
      success: false,
      newBalance: 0,
      voucherCode: '',
      error: err.message || 'Failed to process redemption',
    };
  }
}

/**
 * Award +100 bonus loyalty points when customer submits a verified review
 */
export async function awardReviewBonusPoints(userId: string, eventName?: string): Promise<number> {
  if (!userId) return 0;
  try {
    const bonusPoints = 100;

    // 1. Fetch current profile loyalty points
    const { data: profile } = await supabase
      .from('profiles')
      .select('loyalty_points')
      .eq('id', userId)
      .maybeSingle();

    const currentPoints = Number(profile?.loyalty_points || 0);
    const newPoints = currentPoints + bonusPoints;

    // 2. Update profile points balance
    await supabase
      .from('profiles')
      .update({
        loyalty_points: newPoints,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    // 3. Record transaction in loyalty_transactions
    await supabase.from('loyalty_transactions').insert({
      user_id: userId,
      event_name: `Verified Review Bonus (+100 PTS) - ${eventName || 'Event Review'}`,
      points: bonusPoints,
      type: 'earn',
      created_at: new Date().toISOString(),
    });

    return bonusPoints;
  } catch (err) {
    console.error('Error awarding review bonus points:', err);
    return 0;
  }
}
