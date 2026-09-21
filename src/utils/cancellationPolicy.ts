import { supabase } from '../lib/supabase';

export interface CancellationTier {
  id: string;
  days_threshold: number; // Minimum days before event for this tier to apply (e.g. 14, 7, 3, 0)
  refund_percentage: number; // 0 to 100
  label: string;
}

export interface CancellationPolicyConfig {
  isEnabled: boolean;
  policyName: string;
  tiers: CancellationTier[];
  gracePeriodHours: number;
  gracePeriodEnabled: boolean;
  processingFeeType: 'none' | 'fixed' | 'percentage';
  processingFeeAmount: number;
  allowRescheduleCredit: boolean;
  policyNotes: string;
}

export const DEFAULT_CANCELLATION_POLICY: CancellationPolicyConfig = {
  isEnabled: true,
  policyName: 'Standard Tiered Event Cancellation & Refund Policy',
  tiers: [
    {
      id: 'tier-1',
      days_threshold: 14,
      refund_percentage: 100,
      label: '14+ Days Before Event (100% Full Refund)',
    },
    {
      id: 'tier-2',
      days_threshold: 7,
      refund_percentage: 75,
      label: '7 to 13 Days Before Event (75% Refund)',
    },
    {
      id: 'tier-3',
      days_threshold: 3,
      refund_percentage: 50,
      label: '3 to 6 Days Before Event (50% Refund / Deposit Forfeit)',
    },
    {
      id: 'tier-4',
      days_threshold: 0,
      refund_percentage: 0,
      label: 'Under 72 Hours / 0-2 Days (0% Non-Refundable)',
    },
  ],
  gracePeriodHours: 24,
  gracePeriodEnabled: true,
  processingFeeType: 'none',
  processingFeeAmount: 0,
  allowRescheduleCredit: true,
  policyNotes:
    'Cancellations made 14 or more days prior to the scheduled event are eligible for a 100% refund. Cancellations made between 7 and 13 days prior receive a 75% refund. Cancellations made between 3 and 6 days prior receive a 50% refund. Cancellations within 72 hours of the event are strictly non-refundable due to reserved equipment, crew allocation, and production preparation. Bookings cancelled within 24 hours of confirmation receive a 100% refund regardless of timeline if event is at least 48 hours away.',
};

const STORAGE_KEY = 'binhi_cancellation_policy_config';

/**
 * Loads cancellation policy config from localStorage cache or Supabase
 */
export async function loadCancellationPolicy(): Promise<CancellationPolicyConfig> {
  try {
    const { data, error } = await supabase
      .from('cancellation_settings')
      .select('*')
      .eq('id', 'default')
      .maybeSingle();

    if (!error && data) {
      const config: CancellationPolicyConfig = {
        isEnabled: data.is_enabled !== false,
        policyName: data.policy_name || DEFAULT_CANCELLATION_POLICY.policyName,
        tiers: Array.isArray(data.tiers) && data.tiers.length > 0 ? data.tiers : DEFAULT_CANCELLATION_POLICY.tiers,
        gracePeriodHours: Number(data.grace_period_hours ?? DEFAULT_CANCELLATION_POLICY.gracePeriodHours),
        gracePeriodEnabled: data.grace_period_enabled !== false,
        processingFeeType: data.processing_fee_type || 'none',
        processingFeeAmount: Number(data.processing_fee_amount ?? 0),
        allowRescheduleCredit: data.allow_reschedule_credit !== false,
        policyNotes: data.policy_notes || DEFAULT_CANCELLATION_POLICY.policyNotes,
      };

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      } catch {}
      return config;
    }
  } catch (err) {
    console.warn('Could not load cancellation policy from DB, falling back to cache:', err);
  }

  // Fallback to cache
  const cached = localStorage.getItem(STORAGE_KEY);
  if (cached) {
    try {
      return { ...DEFAULT_CANCELLATION_POLICY, ...JSON.parse(cached) };
    } catch {}
  }

  return DEFAULT_CANCELLATION_POLICY;
}

/**
 * Saves cancellation policy configuration to Supabase & localStorage
 */
export async function saveCancellationPolicy(
  config: Partial<CancellationPolicyConfig>
): Promise<CancellationPolicyConfig> {
  const merged: CancellationPolicyConfig = {
    isEnabled: config.isEnabled !== false,
    policyName: String(config.policyName || DEFAULT_CANCELLATION_POLICY.policyName),
    tiers: Array.isArray(config.tiers) && config.tiers.length > 0 ? config.tiers : DEFAULT_CANCELLATION_POLICY.tiers,
    gracePeriodHours: Number(config.gracePeriodHours ?? DEFAULT_CANCELLATION_POLICY.gracePeriodHours),
    gracePeriodEnabled: config.gracePeriodEnabled !== false,
    processingFeeType: config.processingFeeType || 'none',
    processingFeeAmount: Number(config.processingFeeAmount ?? 0),
    allowRescheduleCredit: config.allowRescheduleCredit !== false,
    policyNotes: String(config.policyNotes || DEFAULT_CANCELLATION_POLICY.policyNotes),
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch (lsErr) {
    console.warn('LocalStorage save error:', lsErr);
  }

  try {
    await supabase.from('cancellation_settings').upsert({
      id: 'default',
      is_enabled: merged.isEnabled,
      policy_name: merged.policyName,
      tiers: merged.tiers,
      grace_period_hours: merged.gracePeriodHours,
      grace_period_enabled: merged.gracePeriodEnabled,
      processing_fee_type: merged.processingFeeType,
      processing_fee_amount: merged.processingFeeAmount,
      allow_reschedule_credit: merged.allowRescheduleCredit,
      policy_notes: merged.policyNotes,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Could not save to cancellation_settings table:', err);
  }

  return merged;
}

export interface RefundCalculationResult {
  daysUntilEvent: number;
  hoursSinceBooking: number | null;
  isGracePeriodApplied: boolean;
  matchedTier: CancellationTier | null;
  tierLabel: string;
  refundPercentage: number;
  grossRefundable: number;
  processingFeeDeduction: number;
  feeDeducted: number;
  netRefundable: number;
  summaryExplanation: string;
}

/**
 * Calculates dynamic cancellation refund based on current policy tiers,
 * days until event, booking creation time (grace period), and paid amount.
 */
export function calculateCancellationRefund({
  eventDateStr,
  bookingCreatedAt,
  amountPaid,
  totalCost: _totalCost,
  policy = DEFAULT_CANCELLATION_POLICY,
}: {
  eventDateStr?: string;
  bookingCreatedAt?: string;
  amountPaid: number;
  totalCost: number;
  policy?: CancellationPolicyConfig;
}): RefundCalculationResult {
  const now = new Date();
  
  // 1. Calculate days until event
  let daysUntilEvent = 0;
  if (eventDateStr) {
    const eventDate = new Date(eventDateStr);
    if (!isNaN(eventDate.getTime())) {
      const diffMs = eventDate.getTime() - now.getTime();
      daysUntilEvent = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    }
  }

  // 2. Calculate hours since booking was created
  let hoursSinceBooking: number | null = null;
  if (bookingCreatedAt) {
    const bookingDate = new Date(bookingCreatedAt);
    if (!isNaN(bookingDate.getTime())) {
      const diffMs = now.getTime() - bookingDate.getTime();
      hoursSinceBooking = Math.max(0, diffMs / (1000 * 60 * 60));
    }
  }

  // 3. Check 24h grace period condition
  const isGracePeriodEligible =
    policy.gracePeriodEnabled &&
    hoursSinceBooking !== null &&
    hoursSinceBooking <= policy.gracePeriodHours &&
    daysUntilEvent >= 2; // Grace period applies if event is not within 48h

  if (isGracePeriodEligible) {
    const grossRefundable = amountPaid;
    return {
      daysUntilEvent,
      hoursSinceBooking,
      isGracePeriodApplied: true,
      matchedTier: null,
      tierLabel: `Grace Period (${policy.gracePeriodHours}h / 100%)`,
      refundPercentage: 100,
      grossRefundable,
      processingFeeDeduction: 0,
      feeDeducted: 0,
      netRefundable: grossRefundable,
      summaryExplanation: `Eligible for 100% refund under the ${policy.gracePeriodHours}-Hour Free Cancellation Grace Period (booked ${Math.round(hoursSinceBooking!)}h ago).`,
    };
  }

  // 4. Match policy tier based on days_threshold (sorted descending)
  const sortedTiers = [...policy.tiers].sort((a, b) => b.days_threshold - a.days_threshold);
  let matchedTier: CancellationTier | null = null;

  for (const tier of sortedTiers) {
    if (daysUntilEvent >= tier.days_threshold) {
      matchedTier = tier;
      break;
    }
  }

  // Fallback to lowest tier if none matched
  if (!matchedTier && sortedTiers.length > 0) {
    matchedTier = sortedTiers[sortedTiers.length - 1];
  }

  const refundPercentage = matchedTier ? matchedTier.refund_percentage : 0;
  const tierLabel = matchedTier ? matchedTier.label : `${refundPercentage}% Refund Tier`;
  const grossRefundable = Math.round((amountPaid * refundPercentage) / 100);

  // 5. Compute processing fee deductions
  let processingFeeDeduction = 0;
  if (grossRefundable > 0 && policy.processingFeeType !== 'none') {
    if (policy.processingFeeType === 'fixed') {
      processingFeeDeduction = Math.min(grossRefundable, policy.processingFeeAmount);
    } else if (policy.processingFeeType === 'percentage') {
      processingFeeDeduction = Math.round((grossRefundable * policy.processingFeeAmount) / 100);
    }
  }

  const netRefundable = Math.max(0, grossRefundable - processingFeeDeduction);

  let summaryExplanation = '';
  if (refundPercentage === 100) {
    summaryExplanation = `Event is ${daysUntilEvent} days away (Eligible for 100% full refund under Tier: ${matchedTier?.label || '14+ Days'}).`;
  } else if (refundPercentage > 0) {
    summaryExplanation = `Event is ${daysUntilEvent} days away (Eligible for ${refundPercentage}% partial refund under Tier: ${matchedTier?.label || `${refundPercentage}% Refund`}).`;
  } else {
    summaryExplanation = `Event is ${daysUntilEvent} days away (Within non-refundable cutoff period; 0% refund applies).`;
  }

  if (processingFeeDeduction > 0) {
    summaryExplanation += ` Admin/payment processing fee deduction of ₱${processingFeeDeduction.toLocaleString()} applied.`;
  }

  return {
    daysUntilEvent,
    hoursSinceBooking,
    isGracePeriodApplied: false,
    matchedTier,
    tierLabel,
    refundPercentage,
    grossRefundable,
    processingFeeDeduction,
    feeDeducted: processingFeeDeduction,
    netRefundable,
    summaryExplanation,
  };
}
