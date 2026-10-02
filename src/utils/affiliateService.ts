import { supabase } from './supabase';
import { sendPartnerApprovalEmail, sendPartnerRejectionEmail } from './emailService';

export interface AffiliatePartner {
  id: string;
  userId?: string;
  partnerName: string;
  businessName?: string;
  email: string;
  phone: string;
  isPhoneVerified?: boolean;
  profession: string;
  referralCode: string;
  commissionRate: number; // e.g. 5.0 (5%)
  clientDiscountRate: number; // e.g. 5.0 (5%)
  payoutMethod: 'GCash' | 'Maya' | 'Bank Transfer' | 'GoTyme Bank' | 'MariBank' | 'SeaBank' | 'Maya Bank' | 'Other Digital Bank' | string;
  payoutAccountName: string;
  payoutAccountNumber: string;
  payoutBankName?: string;
  payoutQrUrl?: string;
  status: 'pending_approval' | 'active' | 'deactivated' | 'rejected' | 'suspended';
  totalEarnings: number;
  totalPaid: number;
  pendingBalance: number;
  totalReferralsCount: number;
  createdAt: string;
}

export interface AffiliateReferralRecord {
  id: string;
  affiliateId: string;
  bookingId?: string;
  bookingRef: string;
  clientName: string;
  eventDate?: string;
  packageName?: string;
  contractAmount: number;
  discountApplied: number;
  commissionEarned: number;
  status: 'pending' | 'confirmed' | 'completed' | 'paid' | 'cancelled';
  createdAt: string;
}

export interface AffiliatePayoutRecord {
  id: string;
  affiliateId: string;
  amount: number;
  payoutMethod: string;
  payoutAccountName: string;
  payoutAccountNumber: string;
  payoutBankName?: string;
  transactionReference: string;
  receiptUrl?: string;
  notes?: string;
  processedBy?: string;
  processedAt: string;
}

// Fallback in-memory / local storage seed data
const LOCAL_STORAGE_AFFILIATES_KEY = 'binhi_affiliates_partners_v1';
const LOCAL_STORAGE_REFERRALS_KEY = 'binhi_affiliates_referrals_v1';
const LOCAL_STORAGE_PAYOUTS_KEY = 'binhi_affiliates_payouts_v1';

const INITIAL_AFFILIATES: AffiliatePartner[] = [];
const INITIAL_REFERRALS: AffiliateReferralRecord[] = [];
const INITIAL_PAYOUTS: AffiliatePayoutRecord[] = [];

export function isValidUuid(id: string | undefined | null): boolean {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

export function generateValidUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Helper to get local data with defaults
function getLocalAffiliates(): AffiliatePartner[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_AFFILIATES_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_STORAGE_AFFILIATES_KEY, JSON.stringify(INITIAL_AFFILIATES));
      return INITIAL_AFFILIATES;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_AFFILIATES;
  }
}

function saveLocalAffiliates(data: AffiliatePartner[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_AFFILIATES_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Could not save affiliates to local storage:', e);
  }
}

function getLocalReferrals(): AffiliateReferralRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_REFERRALS_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_STORAGE_REFERRALS_KEY, JSON.stringify(INITIAL_REFERRALS));
      return INITIAL_REFERRALS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_REFERRALS;
  }
}

function saveLocalReferrals(data: AffiliateReferralRecord[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_REFERRALS_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Could not save referrals to local storage:', e);
  }
}

function getLocalPayouts(): AffiliatePayoutRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_PAYOUTS_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_STORAGE_PAYOUTS_KEY, JSON.stringify(INITIAL_PAYOUTS));
      return INITIAL_PAYOUTS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_PAYOUTS;
  }
}

function saveLocalPayouts(data: AffiliatePayoutRecord[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_PAYOUTS_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Could not save payouts to local storage:', e);
  }
}

/**
 * Validate a referral promo code during checkout
 */
export async function validateReferralCode(code: string): Promise<{
  valid: boolean;
  affiliate?: AffiliatePartner;
  discountRate: number; // percentage (e.g. 5.0)
  message: string;
}> {
  if (!code || !code.trim()) {
    return { valid: false, discountRate: 0, message: 'Please provide a valid partner referral code.' };
  }

  const cleanCode = code.trim().toUpperCase();

  try {
    // 1. Try Supabase
    const { data, error } = await supabase
      .from('affiliates')
      .select('*')
      .ilike('referral_code', cleanCode)
      .eq('status', 'active')
      .maybeSingle();

    if (!error && data) {
      const partner: AffiliatePartner = {
        id: data.id,
        userId: data.user_id,
        partnerName: data.partner_name,
        businessName: data.business_name,
        email: data.email,
        phone: data.phone,
        isPhoneVerified: data.is_phone_verified,
        profession: data.profession,
        referralCode: data.referral_code,
        commissionRate: Number(data.commission_rate || 5.0),
        clientDiscountRate: Number(data.client_discount_rate || 5.0),
        payoutMethod: data.payout_method || 'GCash',
        payoutAccountName: data.payout_account_name,
        payoutAccountNumber: data.payout_account_number,
        payoutBankName: data.payout_bank_name,
        payoutQrUrl: data.payout_qr_url,
        status: data.status,
        totalEarnings: Number(data.total_earnings || 0),
        totalPaid: Number(data.total_paid || 0),
        pendingBalance: Number(data.pending_balance || 0),
        totalReferralsCount: Number(data.total_referrals_count || 0),
        createdAt: data.created_at,
      };

      return {
        valid: true,
        affiliate: partner,
        discountRate: partner.clientDiscountRate,
        message: `Partner code '${cleanCode}' applied: ${partner.clientDiscountRate}% partner discount active (${partner.partnerName}).`,
      };
    }
  } catch (err) {
    console.warn('Supabase affiliate query fallback to local:', err);
  }

  // 2. Fallback to local
  const localList = getLocalAffiliates();
  const matched = localList.find(
    (a) => a.referralCode.toUpperCase() === cleanCode && a.status === 'active'
  );

  if (matched) {
    return {
      valid: true,
      affiliate: matched,
      discountRate: matched.clientDiscountRate,
      message: `Partner code '${cleanCode}' applied: ${matched.clientDiscountRate}% partner discount active (${matched.partnerName}).`,
    };
  }

  return {
    valid: false,
    discountRate: 0,
    message: `Referral code '${cleanCode}' is invalid or currently inactive.`,
  };
}

/**
 * Apply to become a BINHI Concept Affiliate Partner
 */
export async function applyForAffiliateProgram(params: {
  partnerName: string;
  businessName?: string;
  email: string;
  phone: string;
  isPhoneVerified?: boolean;
  profession: string;
  preferredCode?: string;
  payoutMethod: string;
  payoutAccountName: string;
  payoutAccountNumber: string;
  payoutBankName?: string;
  payoutQrUrl?: string;
}): Promise<{ success: boolean; partner?: AffiliatePartner; message: string }> {
  const cleanEmail = params.email.trim().toLowerCase();
  const cleanPhone = params.phone.trim();
  let code = params.preferredCode?.trim().toUpperCase() || '';
  if (!code) {
    const cleanName = params.partnerName.replace(/[^a-zA-Z]/g, '').slice(0, 6).toUpperCase();
    code = `BINHI-${cleanName || 'PARTNER'}-${Math.floor(100 + Math.random() * 900)}`;
  }

  // 1. Uniqueness check against remote storage
  let existingDeactivatedId: string | null = null;
  try {
    const { data: existingEmailRecord } = await supabase
      .from('affiliates')
      .select('id, email, status, referral_code, phone')
      .ilike('email', cleanEmail)
      .maybeSingle();

    if (existingEmailRecord) {
      if (existingEmailRecord.status === 'active') {
        return {
          success: false,
          message: 'This email address is already registered to an active partner account. Please sign in or use another email.',
        };
      } else {
        // The partner was deactivated/rejected and is now re-registering to enable their account
        existingDeactivatedId = existingEmailRecord.id;
      }
    }

    const { data: existingPhoneRecord } = await supabase
      .from('affiliates')
      .select('id, phone, status')
      .eq('phone', cleanPhone)
      .maybeSingle();

    if (existingPhoneRecord && existingPhoneRecord.id !== existingDeactivatedId && existingPhoneRecord.status === 'active') {
      return {
        success: false,
        message: 'This mobile phone number is already associated with an existing active partner account.',
      };
    }

    const { data: existingCodeRecord } = await supabase
      .from('affiliates')
      .select('id, referral_code, status')
      .ilike('referral_code', code)
      .maybeSingle();

    if (existingCodeRecord && existingCodeRecord.id !== existingDeactivatedId && existingCodeRecord.status === 'active') {
      return {
        success: false,
        message: `The referral code "${code}" is already taken. Please choose another unique partner code.`,
      };
    }
  } catch (err) {
    console.warn('Remote duplicate check warning, checking local storage:', err);
  }

  // 2. Uniqueness check against local storage
  const localList = getLocalAffiliates();
  const localExisting = localList.find((p) => p.email.toLowerCase() === cleanEmail);
  if (localExisting) {
    if (localExisting.status === 'active') {
      return {
        success: false,
        message: 'This email address is already registered to an active partner account. Please sign in or use another email.',
      };
    } else if (!existingDeactivatedId && isValidUuid(localExisting.id)) {
      existingDeactivatedId = localExisting.id;
    }
  }

  const localPhoneDup = localList.find(
    (p) => p.phone === cleanPhone && p.id !== existingDeactivatedId && p.status === 'active'
  );
  if (localPhoneDup) {
    return {
      success: false,
      message: 'This mobile phone number is already associated with an existing active partner account.',
    };
  }

  const localCodeDup = localList.find(
    (p) => p.referralCode.toUpperCase() === code && p.id !== existingDeactivatedId && p.status === 'active'
  );
  if (localCodeDup) {
    return {
      success: false,
      message: `The referral code "${code}" is already taken. Please choose another unique partner code.`,
    };
  }

  const currentSettings = await fetchAffiliateSettings();
  const generatedId = existingDeactivatedId && isValidUuid(existingDeactivatedId) ? existingDeactivatedId : generateValidUuid();

  let resolvedUserId: string | undefined = undefined;
  try {
    const { data: authUserData } = await supabase.auth.getUser();
    if (authUserData?.user?.email?.toLowerCase() === cleanEmail) {
      resolvedUserId = authUserData.user.id;
    }
  } catch { }

  const partnerData: AffiliatePartner = {
    id: generatedId,
    userId: resolvedUserId,
    partnerName: params.partnerName.trim(),
    businessName: params.businessName?.trim() || undefined,
    email: cleanEmail,
    phone: cleanPhone,
    isPhoneVerified: params.isPhoneVerified ?? false,
    profession: params.profession,
    referralCode: code,
    commissionRate: currentSettings.defaultCommissionRate ?? 5.0,
    clientDiscountRate: currentSettings.defaultClientDiscountRate ?? 5.0,
    payoutMethod: params.payoutMethod,
    payoutAccountName: params.payoutAccountName.trim(),
    payoutAccountNumber: params.payoutAccountNumber.trim(),
    payoutBankName: params.payoutBankName?.trim() || undefined,
    payoutQrUrl: params.payoutQrUrl?.trim() || undefined,
    status: 'pending_approval',
    totalEarnings: 0,
    totalPaid: 0,
    pendingBalance: 0,
    totalReferralsCount: 0,
    createdAt: new Date().toISOString(),
  };

  try {
    if (existingDeactivatedId) {
      // UPDATE & REACTIVATE in Supabase
      const updatePayload: any = {
        partner_name: partnerData.partnerName,
        business_name: partnerData.businessName,
        phone: partnerData.phone,
        profession: partnerData.profession,
        referral_code: partnerData.referralCode,
        commission_rate: partnerData.commissionRate,
        client_discount_rate: partnerData.clientDiscountRate,
        payout_method: partnerData.payoutMethod,
        payout_account_name: partnerData.payoutAccountName,
        payout_account_number: partnerData.payoutAccountNumber,
        payout_bank_name: partnerData.payoutBankName,
        status: 'pending_approval',
        updated_at: new Date().toISOString(),
      };
      if (partnerData.isPhoneVerified !== undefined) updatePayload.is_phone_verified = partnerData.isPhoneVerified;
      if (partnerData.payoutQrUrl !== undefined) updatePayload.payout_qr_url = partnerData.payoutQrUrl;

      let { data, error } = await supabase
        .from('affiliates')
        .update(updatePayload)
        .eq('id', existingDeactivatedId)
        .select()
        .single();

      if (error) {
        // Retry without optional columns if schema differs
        delete updatePayload.is_phone_verified;
        delete updatePayload.payout_qr_url;
        const retry = await supabase
          .from('affiliates')
          .update(updatePayload)
          .eq('id', existingDeactivatedId)
          .select()
          .single();
        if (!retry.error && retry.data) {
          data = retry.data;
          error = null;
        }
      }

      if (!error && data) {
        partnerData.id = data.id;
        partnerData.totalEarnings = Number(data.total_earnings || 0);
        partnerData.totalPaid = Number(data.total_paid || 0);
        partnerData.pendingBalance = Number(data.pending_balance || 0);
        partnerData.totalReferralsCount = Number(data.total_referrals_count || 0);
      }
    } else {
      // INSERT new record into Supabase
      const insertPayload: any = {
        id: partnerData.id,
        partner_name: partnerData.partnerName,
        business_name: partnerData.businessName,
        email: partnerData.email,
        phone: partnerData.phone,
        profession: partnerData.profession,
        referral_code: partnerData.referralCode,
        commission_rate: partnerData.commissionRate,
        client_discount_rate: partnerData.clientDiscountRate,
        payout_method: partnerData.payoutMethod,
        payout_account_name: partnerData.payoutAccountName,
        payout_account_number: partnerData.payoutAccountNumber,
        payout_bank_name: partnerData.payoutBankName,
        status: partnerData.status,
      };
      if (partnerData.userId) insertPayload.user_id = partnerData.userId;
      if (partnerData.isPhoneVerified !== undefined) insertPayload.is_phone_verified = partnerData.isPhoneVerified;
      if (partnerData.payoutQrUrl !== undefined) insertPayload.payout_qr_url = partnerData.payoutQrUrl;

      let { data, error } = await supabase.from('affiliates').insert(insertPayload).select().single();

      if (error) {
        // Fallback retry without optional columns in case table hasn't been altered
        delete insertPayload.user_id;
        delete insertPayload.is_phone_verified;
        delete insertPayload.payout_qr_url;
        const retry = await supabase.from('affiliates').insert(insertPayload).select().single();
        if (!retry.error && retry.data) {
          data = retry.data;
          error = null;
        } else {
          console.error('Supabase affiliate partner insert error:', retry.error || error);
        }
      }

      if (!error && data) {
        partnerData.id = data.id;
      }
    }
  } catch (err) {
    console.error('Could not save affiliate to Supabase:', err);
  }

  // Save/Update in local storage
  const updatedLocal = localList.filter((p) => p.email.toLowerCase() !== cleanEmail && p.id !== partnerData.id);
  updatedLocal.unshift(partnerData);
  saveLocalAffiliates(updatedLocal);

  return {
    success: true,
    partner: partnerData,
    message: `Your partner application has been submitted for review. Promo code: ${partnerData.referralCode}. You will receive an email once approved by admin!`,
  };
}

/**
 * Record a referral booking event when client checks out
 */
export async function recordAffiliateReferral(params: {
  affiliateId: string;
  bookingId?: string;
  bookingRef: string;
  clientName: string;
  eventDate?: string;
  packageName?: string;
  contractAmount: number;
  discountApplied: number;
  commissionEarned: number;
}): Promise<void> {
  let targetAffiliateId = params.affiliateId;

  // Resolve valid UUID if old non-UUID string is passed
  if (!isValidUuid(targetAffiliateId)) {
    try {
      const localAff = getLocalAffiliates().find((a) => a.id === targetAffiliateId);
      if (localAff) {
        const { data: remoteAff } = await supabase
          .from('affiliates')
          .select('id')
          .or(`email.ilike.${localAff.email.toLowerCase()},referral_code.ilike.${localAff.referralCode.toUpperCase()}`)
          .maybeSingle();
        if (remoteAff?.id) {
          targetAffiliateId = remoteAff.id;
          localAff.id = remoteAff.id;
          saveLocalAffiliates(getLocalAffiliates().map((a) => (a.id === params.affiliateId ? { ...a, id: remoteAff.id } : a)));
        }
      }
    } catch (err) {
      console.warn('Could not resolve affiliate UUID:', err);
    }
  }

  // Parse event date safely to YYYY-MM-DD
  let formattedDate: string | null = null;
  if (params.eventDate) {
    const parsed = new Date(params.eventDate);
    if (!isNaN(parsed.getTime())) {
      formattedDate = parsed.toISOString().split('T')[0];
    }
  }

  const referralId = generateValidUuid();
  const cleanBookingId = params.bookingId && isValidUuid(params.bookingId) ? params.bookingId : null;

  const newRef: AffiliateReferralRecord = {
    id: referralId,
    affiliateId: targetAffiliateId,
    bookingId: cleanBookingId || undefined,
    bookingRef: params.bookingRef,
    clientName: params.clientName,
    eventDate: formattedDate || undefined,
    packageName: params.packageName,
    contractAmount: Number(params.contractAmount) || 0,
    discountApplied: Number(params.discountApplied) || 0,
    commissionEarned: Number(params.commissionEarned) || 0,
    status: 'confirmed',
    createdAt: new Date().toISOString(),
  };

  try {
    if (isValidUuid(targetAffiliateId)) {
      const { data: refData, error: refError } = await supabase.from('affiliate_referrals').insert({
        id: referralId,
        affiliate_id: targetAffiliateId,
        booking_id: cleanBookingId,
        booking_ref: params.bookingRef,
        client_name: params.clientName,
        event_date: formattedDate,
        package_name: params.packageName || null,
        contract_amount: Number(params.contractAmount) || 0,
        discount_applied: Number(params.discountApplied) || 0,
        commission_earned: Number(params.commissionEarned) || 0,
        status: 'confirmed',
      }).select().single();

      if (refError) {
        console.error('Supabase affiliate_referrals insert error:', refError);
      } else if (refData) {
        newRef.id = refData.id;
      }

      // Update affiliate total balance in Supabase
      const { data: currAff } = await supabase
        .from('affiliates')
        .select('total_earnings, pending_balance, total_referrals_count')
        .eq('id', targetAffiliateId)
        .single();

      if (currAff) {
        await supabase
          .from('affiliates')
          .update({
            total_earnings: (Number(currAff.total_earnings) || 0) + Number(params.commissionEarned || 0),
            pending_balance: (Number(currAff.pending_balance) || 0) + Number(params.commissionEarned || 0),
            total_referrals_count: (Number(currAff.total_referrals_count) || 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', targetAffiliateId);
      }
    }
  } catch (err) {
    console.error('Supabase referral record error:', err);
  }

  // Update local storage
  const refs = getLocalReferrals().filter((r) => r.id !== newRef.id && r.bookingRef !== newRef.bookingRef);
  refs.unshift(newRef);
  saveLocalReferrals(refs);

  const affs = getLocalAffiliates();
  const affIdx = affs.findIndex((a) => a.id === targetAffiliateId || a.id === params.affiliateId);
  if (affIdx !== -1) {
    affs[affIdx].totalEarnings += Number(params.commissionEarned || 0);
    affs[affIdx].pendingBalance += Number(params.commissionEarned || 0);
    affs[affIdx].totalReferralsCount += 1;
    saveLocalAffiliates(affs);
  }
}

/**
 * Fetch all affiliates and referrals for Admin Portal
 */
export async function fetchAllAffiliates(): Promise<{
  affiliates: AffiliatePartner[];
  referrals: AffiliateReferralRecord[];
  payouts: AffiliatePayoutRecord[];
  summary: {
    totalPartners: number;
    activePartners: number;
    totalReferralsCount: number;
    totalAffiliateSalesRevenue: number;
    totalCommissionsGenerated: number;
    totalCommissionsPaid: number;
    totalPendingDisbursements: number;
  };
}> {
  let affiliates = getLocalAffiliates();
  let referrals = getLocalReferrals();
  let payouts = getLocalPayouts();

  try {
    const [affRes, refRes, payRes] = await Promise.all([
      supabase.from('affiliates').select('*').order('created_at', { ascending: false }),
      supabase.from('affiliate_referrals').select('*').order('created_at', { ascending: false }),
      supabase.from('affiliate_payouts').select('*').order('processed_at', { ascending: false }),
    ]);

    if (!affRes.error && affRes.data && affRes.data.length > 0) {
      affiliates = affRes.data.map((d: any) => ({
        id: d.id,
        userId: d.user_id,
        partnerName: d.partner_name,
        businessName: d.business_name,
        email: d.email,
        phone: d.phone,
        isPhoneVerified: Boolean(d.is_phone_verified),
        profession: d.profession,
        referralCode: d.referral_code,
        commissionRate: Number(d.commission_rate || 5.0),
        clientDiscountRate: Number(d.client_discount_rate || 5.0),
        payoutMethod: d.payout_method || 'GCash',
        payoutAccountName: d.payout_account_name,
        payoutAccountNumber: d.payout_account_number,
        payoutBankName: d.payout_bank_name,
        payoutQrUrl: d.payout_qr_url,
        status: d.status,
        totalEarnings: Number(d.total_earnings || 0),
        totalPaid: Number(d.total_paid || 0),
        pendingBalance: Number(d.pending_balance || 0),
        totalReferralsCount: Number(d.total_referrals_count || 0),
        createdAt: d.created_at,
      }));
      saveLocalAffiliates(affiliates);
    } else if (affRes.error) {
      console.warn('Supabase fetch affiliates error:', affRes.error.message);
    }

    if (!refRes.error && refRes.data && refRes.data.length > 0) {
      referrals = refRes.data.map((r: any) => ({
        id: r.id,
        affiliateId: r.affiliate_id,
        bookingId: r.booking_id,
        bookingRef: r.booking_ref,
        clientName: r.client_name,
        eventDate: r.event_date,
        packageName: r.package_name,
        contractAmount: Number(r.contract_amount || 0),
        discountApplied: Number(r.discount_applied || 0),
        commissionEarned: Number(r.commission_earned || 0),
        status: r.status,
        createdAt: r.created_at,
      }));
      saveLocalReferrals(referrals);
    } else if (refRes.error) {
      console.warn('Supabase fetch referrals error:', refRes.error.message);
    }

    if (!payRes.error && payRes.data && payRes.data.length > 0) {
      payouts = payRes.data.map((p: any) => ({
        id: p.id,
        affiliateId: p.affiliate_id,
        amount: Number(p.amount || 0),
        payoutMethod: p.payout_method,
        payoutAccountName: p.payout_account_name,
        payoutAccountNumber: p.payout_account_number,
        payoutBankName: p.payout_bank_name,
        transactionReference: p.transaction_reference,
        receiptUrl: p.receipt_url,
        notes: p.notes,
        processedBy: p.processed_by,
        processedAt: p.processed_at,
      }));
      saveLocalPayouts(payouts);
    } else if (payRes.error) {
      console.warn('Supabase fetch payouts error:', payRes.error.message);
    }
  } catch (err) {
    console.warn('Fallback to local affiliate records:', err);
  }

  const totalPartners = affiliates.length;
  const activePartners = affiliates.filter((a) => a.status === 'active').length;
  const totalReferralsCount = referrals.length;
  const totalAffiliateSalesRevenue = referrals.reduce((sum, r) => sum + r.contractAmount, 0);
  const totalCommissionsGenerated = affiliates.reduce((sum, a) => sum + a.totalEarnings, 0);
  const totalCommissionsPaid = affiliates.reduce((sum, a) => sum + a.totalPaid, 0);
  const totalPendingDisbursements = affiliates.reduce((sum, a) => sum + a.pendingBalance, 0);

  return {
    affiliates,
    referrals,
    payouts,
    summary: {
      totalPartners,
      activePartners,
      totalReferralsCount,
      totalAffiliateSalesRevenue,
      totalCommissionsGenerated,
      totalCommissionsPaid,
      totalPendingDisbursements,
    },
  };
}

/**
 * Upload proof of commission disbursement to Supabase Storage with local data URL fallback
 */
export async function uploadAffiliateProof(file: File): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `payout-proof-${Date.now()}-${cleanName}`;

    // 1. Try uploading to booking-receipts bucket in Supabase storage
    const { error: uploadErr } = await supabase.storage
      .from('booking-receipts')
      .upload(fileName, file, { cacheControl: '3600', upsert: true });

    if (!uploadErr) {
      const { data: publicUrlData } = supabase.storage.from('booking-receipts').getPublicUrl(fileName);
      if (publicUrlData?.publicUrl) {
        return { success: true, url: publicUrlData.publicUrl };
      }
    }
  } catch (err) {
    console.warn('Supabase storage upload error, fallback to data URL:', err);
  }

  // 2. Fallback to base64 Data URL
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve({ success: true, url: reader.result as string });
    };
    reader.onerror = () => {
      resolve({ success: false, error: 'Failed to read file.' });
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Upload partner InstaPay / GCash QR code image to Supabase Storage with local data URL fallback
 */
export async function uploadAffiliateQr(file: File): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `partner-qr-${Date.now()}-${cleanName}`;

    // 1. Try uploading to booking-receipts bucket in Supabase storage
    const { error: uploadErr } = await supabase.storage
      .from('booking-receipts')
      .upload(fileName, file, { cacheControl: '3600', upsert: true });

    if (!uploadErr) {
      const { data: publicUrlData } = supabase.storage.from('booking-receipts').getPublicUrl(fileName);
      if (publicUrlData?.publicUrl) {
        return { success: true, url: publicUrlData.publicUrl };
      }
    }
  } catch (err) {
    console.warn('Supabase storage upload error for partner QR, fallback to data URL:', err);
  }

  // 2. Fallback to base64 Data URL
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve({ success: true, url: reader.result as string });
    };
    reader.onerror = () => {
      resolve({ success: false, error: 'Failed to read file.' });
    };
    reader.readAsDataURL(file);
  });
}

const SESSION_PARTNER_KEY = 'binhi_active_partner_session';
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 Days Standard Device Session

interface StoredPartnerSessionWrapper {
  partner: AffiliatePartner;
  savedAt: number;
  expiresAt: number;
}

export function getStoredPartnerSession(): AffiliatePartner | null {
  try {
    const raw = localStorage.getItem(SESSION_PARTNER_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);

    // Support wrapped format with timestamp validation
    if (parsed && typeof parsed === 'object' && 'partner' in parsed && 'expiresAt' in parsed) {
      const wrapper = parsed as StoredPartnerSessionWrapper;
      if (Date.now() > wrapper.expiresAt) {
        // Expired -> automatically clear session
        localStorage.removeItem(SESSION_PARTNER_KEY);
        return null;
      }

      // Rolling extension: if more than 1 day has passed, refresh the 30-day expiry
      if (Date.now() - wrapper.savedAt > 24 * 60 * 60 * 1000) {
        setStoredPartnerSession(wrapper.partner);
      }

      return wrapper.partner;
    }

    // Support backward-compatible direct partner object (upgrade to wrapped format)
    if (parsed && typeof parsed === 'object' && parsed.id && parsed.email) {
      setStoredPartnerSession(parsed as AffiliatePartner);
      return parsed as AffiliatePartner;
    }

    return null;
  } catch (err) {
    console.warn('Error reading stored partner session:', err);
    return null;
  }
}

export function setStoredPartnerSession(partner: AffiliatePartner | null): void {
  try {
    if (partner) {
      const wrapper: StoredPartnerSessionWrapper = {
        partner,
        savedAt: Date.now(),
        expiresAt: Date.now() + SESSION_DURATION_MS,
      };
      localStorage.setItem(SESSION_PARTNER_KEY, JSON.stringify(wrapper));
    } else {
      localStorage.removeItem(SESSION_PARTNER_KEY);
    }
    window.dispatchEvent(new Event('storage'));
  } catch (err) {
    console.error('Error saving partner session:', err);
  }
}

export function clearStoredPartnerSession(): void {
  try {
    localStorage.removeItem(SESSION_PARTNER_KEY);
    window.dispatchEvent(new Event('storage'));
  } catch (err) {
    console.error('Error clearing partner session:', err);
  }
}

/**
 * Update partner profile details, banking methods, or QR code
 */
export async function updateAffiliateProfile(params: {
  partnerId: string;
  partnerName?: string;
  businessName?: string;
  phone?: string;
  isPhoneVerified?: boolean;
  profession?: string;
  payoutMethod?: string;
  payoutAccountName?: string;
  payoutAccountNumber?: string;
  payoutBankName?: string;
  payoutQrUrl?: string;
}): Promise<{ success: boolean; message: string; partner?: AffiliatePartner }> {
  const affs = getLocalAffiliates();
  const partnerIndex = affs.findIndex((a) => a.id === params.partnerId);

  if (partnerIndex === -1) {
    return { success: false, message: 'Partner profile not found.' };
  }

  const existing = affs[partnerIndex];
  const updatedPartner: AffiliatePartner = {
    ...existing,
    partnerName: params.partnerName ?? existing.partnerName,
    businessName: params.businessName !== undefined ? params.businessName : existing.businessName,
    phone: params.phone ?? existing.phone,
    isPhoneVerified: params.isPhoneVerified !== undefined ? params.isPhoneVerified : existing.isPhoneVerified,
    profession: params.profession ?? existing.profession,
    payoutMethod: (params.payoutMethod as any) ?? existing.payoutMethod,
    payoutAccountName: params.payoutAccountName ?? existing.payoutAccountName,
    payoutAccountNumber: params.payoutAccountNumber ?? existing.payoutAccountNumber,
    payoutBankName: params.payoutBankName !== undefined ? params.payoutBankName : existing.payoutBankName,
    payoutQrUrl: params.payoutQrUrl !== undefined ? params.payoutQrUrl : existing.payoutQrUrl,
  };

  try {
    if (isValidUuid(params.partnerId)) {
      const payload: any = {};
      if (params.partnerName !== undefined) payload.partner_name = params.partnerName;
      if (params.businessName !== undefined) payload.business_name = params.businessName;
      if (params.phone !== undefined) payload.phone = params.phone;
      if (params.isPhoneVerified !== undefined) payload.is_phone_verified = params.isPhoneVerified;
      if (params.profession !== undefined) payload.profession = params.profession;
      if (params.payoutMethod !== undefined) payload.payout_method = params.payoutMethod;
      if (params.payoutAccountName !== undefined) payload.payout_account_name = params.payoutAccountName;
      if (params.payoutAccountNumber !== undefined) payload.payout_account_number = params.payoutAccountNumber;
      if (params.payoutBankName !== undefined) payload.payout_bank_name = params.payoutBankName;
      if (params.payoutQrUrl !== undefined) payload.payout_qr_url = params.payoutQrUrl;
      payload.updated_at = new Date().toISOString();

      await supabase.from('affiliates').update(payload).eq('id', params.partnerId);
    }
  } catch (err) {
    console.warn('Supabase partner profile update error:', err);
  }

  // Update local storage
  affs[partnerIndex] = updatedPartner;
  saveLocalAffiliates(affs);

  // Update session if stored
  const session = getStoredPartnerSession();
  if (session && session.id === params.partnerId) {
    setStoredPartnerSession(updatedPartner);
  }

  return {
    success: true,
    message: 'Profile and payout details updated successfully!',
    partner: updatedPartner,
  };
}

/**
 * Disburse commission payout to an affiliate partner
 */
export async function disburseAffiliatePayout(params: {
  affiliateId: string;
  amount: number;
  transactionReference: string;
  notes?: string;
  receiptUrl?: string;
  adminEmail?: string;
}): Promise<{ success: boolean; message: string }> {
  const affs = getLocalAffiliates();
  const partner = affs.find((a) => a.id === params.affiliateId);

  if (!partner) {
    return { success: false, message: 'Affiliate partner record not found.' };
  }

  if (params.amount <= 0 || params.amount > partner.pendingBalance) {
    return { success: false, message: 'Invalid payout amount or exceeds pending balance.' };
  }

  let targetAffiliateId = partner.id;
  if (!isValidUuid(targetAffiliateId)) {
    try {
      const { data: remoteAff } = await supabase
        .from('affiliates')
        .select('id')
        .or(`email.ilike.${partner.email.toLowerCase()},referral_code.ilike.${partner.referralCode.toUpperCase()}`)
        .maybeSingle();
      if (remoteAff?.id) {
        targetAffiliateId = remoteAff.id;
        partner.id = remoteAff.id;
      }
    } catch (err) {
      console.warn('Could not resolve payout affiliate UUID:', err);
    }
  }

  const payoutId = generateValidUuid();

  const newPayout: AffiliatePayoutRecord = {
    id: payoutId,
    affiliateId: targetAffiliateId,
    amount: params.amount,
    payoutMethod: partner.payoutMethod,
    payoutAccountName: partner.payoutAccountName,
    payoutAccountNumber: partner.payoutAccountNumber,
    payoutBankName: partner.payoutBankName,
    transactionReference: params.transactionReference,
    receiptUrl: params.receiptUrl,
    notes: params.notes,
    processedBy: params.adminEmail || 'admin@binhiconcept.ph',
    processedAt: new Date().toISOString(),
  };

  try {
    if (isValidUuid(targetAffiliateId)) {
      const { data: pData, error: pError } = await supabase.from('affiliate_payouts').insert({
        id: payoutId,
        affiliate_id: targetAffiliateId,
        amount: params.amount,
        payout_method: partner.payoutMethod,
        payout_account_name: partner.payoutAccountName,
        payout_account_number: partner.payoutAccountNumber,
        payout_bank_name: partner.payoutBankName || null,
        transaction_reference: params.transactionReference,
        receipt_url: params.receiptUrl || null,
        notes: params.notes || null,
        processed_by: params.adminEmail || 'admin@binhiconcept.ph',
      }).select().single();

      if (pError) {
        console.error('Supabase affiliate_payouts insert error:', pError);
      } else if (pData) {
        newPayout.id = pData.id;
      }

      const { data: currAff } = await supabase
        .from('affiliates')
        .select('total_paid, pending_balance')
        .eq('id', targetAffiliateId)
        .single();

      if (currAff) {
        await supabase
          .from('affiliates')
          .update({
            total_paid: (Number(currAff.total_paid) || 0) + Number(params.amount || 0),
            pending_balance: Math.max(0, (Number(currAff.pending_balance) || 0) - Number(params.amount || 0)),
            updated_at: new Date().toISOString(),
          })
          .eq('id', targetAffiliateId);
      }
    }
  } catch (err) {
    console.error('Supabase payout insert error:', err);
  }

  // Update local
  partner.totalPaid += params.amount;
  partner.pendingBalance = Math.max(0, partner.pendingBalance - params.amount);
  saveLocalAffiliates(affs);

  const payouts = getLocalPayouts().filter((p) => p.id !== newPayout.id);
  payouts.unshift(newPayout);
  saveLocalPayouts(payouts);

  return {
    success: true,
    message: `Successfully disbursed ₱${params.amount.toLocaleString()} to ${partner.partnerName} (${partner.payoutMethod} ${partner.payoutAccountNumber}).`,
  };
}

/**
 * Edit / Update an existing affiliate payout record
 */
export async function updateAffiliatePayout(params: {
  payoutId: string;
  transactionReference?: string;
  notes?: string;
  receiptUrl?: string;
}): Promise<{ success: boolean; message: string; payout?: AffiliatePayoutRecord }> {
  try {
    if (isValidUuid(params.payoutId)) {
      const updatePayload: any = {};
      if (params.transactionReference !== undefined) updatePayload.transaction_reference = params.transactionReference;
      if (params.notes !== undefined) updatePayload.notes = params.notes;
      if (params.receiptUrl !== undefined) updatePayload.receipt_url = params.receiptUrl;

      const { error } = await supabase
        .from('affiliate_payouts')
        .update(updatePayload)
        .eq('id', params.payoutId);

      if (error) {
        console.warn('Supabase update payout warning:', error);
      }
    }
  } catch (err) {
    console.warn('Supabase update payout fallback:', err);
  }

  // Update local storage record
  const payouts = getLocalPayouts();
  const idx = payouts.findIndex((p) => p.id === params.payoutId);
  if (idx !== -1) {
    if (params.transactionReference !== undefined) payouts[idx].transactionReference = params.transactionReference;
    if (params.notes !== undefined) payouts[idx].notes = params.notes;
    if (params.receiptUrl !== undefined) payouts[idx].receiptUrl = params.receiptUrl;
    saveLocalPayouts(payouts);
    return { success: true, message: 'Disbursement record updated successfully.', payout: payouts[idx] };
  }

  return { success: true, message: 'Disbursement record updated successfully.' };
}

/**
 * Fetch partner dashboard stats by code or email
 */
export async function getAffiliateDashboardData(identifier: string): Promise<{
  partner: AffiliatePartner | null;
  referrals: AffiliateReferralRecord[];
  payouts: AffiliatePayoutRecord[];
}> {
  const clean = (identifier || '').trim();
  if (!clean) {
    return { partner: null, referrals: [], payouts: [] };
  }

  const isUuid = isValidUuid(clean);

  // 1. Try Supabase
  try {
    let query = supabase.from('affiliates').select('*');
    if (isUuid) {
      query = query.or(`id.eq.${clean},email.ilike.${clean.toLowerCase()},referral_code.ilike.${clean.toUpperCase()}`);
    } else {
      query = query.or(`email.ilike.${clean.toLowerCase()},referral_code.ilike.${clean.toUpperCase()}`);
    }

    const { data: pData } = await query.maybeSingle();

    if (pData) {
      const partner: AffiliatePartner = {
        id: pData.id,
        userId: pData.user_id,
        partnerName: pData.partner_name,
        businessName: pData.business_name,
        email: pData.email,
        phone: pData.phone,
        isPhoneVerified: Boolean(pData.is_phone_verified),
        profession: pData.profession,
        referralCode: pData.referral_code,
        commissionRate: Number(pData.commission_rate || 5.0),
        clientDiscountRate: Number(pData.client_discount_rate || 5.0),
        payoutMethod: pData.payout_method || 'GCash',
        payoutAccountName: pData.payout_account_name,
        payoutAccountNumber: pData.payout_account_number,
        payoutBankName: pData.payout_bank_name,
        payoutQrUrl: pData.payout_qr_url,
        status: pData.status,
        totalEarnings: Number(pData.total_earnings || 0),
        totalPaid: Number(pData.total_paid || 0),
        pendingBalance: Number(pData.pending_balance || 0),
        totalReferralsCount: Number(pData.total_referrals_count || 0),
        createdAt: pData.created_at,
      };

      const { data: rData } = await supabase
        .from('affiliate_referrals')
        .select('*')
        .eq('affiliate_id', partner.id)
        .order('created_at', { ascending: false });

      const referrals: AffiliateReferralRecord[] = (rData || []).map((r) => ({
        id: r.id,
        affiliateId: r.affiliate_id,
        bookingId: r.booking_id,
        bookingRef: r.booking_ref,
        clientName: r.client_name,
        eventDate: r.event_date,
        packageName: r.package_name,
        contractAmount: Number(r.contract_amount || 0),
        discountApplied: Number(r.discount_applied || 0),
        commissionEarned: Number(r.commission_earned || 0),
        status: r.status || 'confirmed',
        createdAt: r.created_at,
      }));

      const { data: payData } = await supabase
        .from('affiliate_payouts')
        .select('*')
        .eq('affiliate_id', partner.id)
        .order('processed_at', { ascending: false });

      const payouts: AffiliatePayoutRecord[] = (payData || []).map((p) => ({
        id: p.id,
        affiliateId: p.affiliate_id,
        amount: Number(p.amount || 0),
        payoutMethod: p.payout_method,
        payoutAccountName: p.payout_account_name,
        payoutAccountNumber: p.payout_account_number,
        payoutBankName: p.payout_bank_name,
        transactionReference: p.transaction_reference,
        receiptUrl: p.receipt_url,
        notes: p.notes,
        processedBy: p.processed_by,
        processedAt: p.processed_at,
      }));

      return { partner, referrals, payouts };
    }
  } catch (err) {
    console.warn('Supabase dashboard data lookup fallback:', err);
  }

  // 2. Fallback to Local Storage
  const affs = getLocalAffiliates();
  const lower = clean.toLowerCase();
  const partner = affs.find(
    (a) => a.id === clean || a.email.toLowerCase() === lower || a.referralCode.toLowerCase() === lower
  ) || null;

  if (!partner) {
    return { partner: null, referrals: [], payouts: [] };
  }

  const referrals = getLocalReferrals().filter((r) => r.affiliateId === partner.id);
  const payouts = getLocalPayouts().filter((p) => p.affiliateId === partner.id);

  return { partner, referrals, payouts };
}

// ── Rate & Program Customization Settings ────────────────────────────────────
export interface AffiliateSettings {
  id?: string;
  defaultCommissionRate: number; // e.g. 5.0 (5%)
  defaultClientDiscountRate: number; // e.g. 5.0 (5%)
  isProgramActive: boolean;
  minPayoutThreshold: number; // e.g. 1000
  updatedAt?: string;
}

const LOCAL_STORAGE_SETTINGS_KEY = 'binhi_affiliates_settings_v1';

export const DEFAULT_AFFILIATE_SETTINGS: AffiliateSettings = {
  defaultCommissionRate: 5.0,
  defaultClientDiscountRate: 5.0,
  isProgramActive: true,
  minPayoutThreshold: 1000,
};

/**
 * Fetch Global Affiliate Program Rate Settings
 */
export async function fetchAffiliateSettings(): Promise<AffiliateSettings> {
  try {
    const { data, error } = await supabase
      .from('affiliate_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      const s: AffiliateSettings = {
        id: data.id,
        defaultCommissionRate: Number(data.default_commission_rate ?? 5.0),
        defaultClientDiscountRate: Number(data.default_client_discount_rate ?? 5.0),
        isProgramActive: Boolean(data.is_program_active ?? true),
        minPayoutThreshold: Number(data.min_payout_threshold ?? 1000),
        updatedAt: data.updated_at,
      };
      localStorage.setItem(LOCAL_STORAGE_SETTINGS_KEY, JSON.stringify(s));
      return s;
    }
  } catch (err) {
    console.warn('Supabase fetch settings fallback to local:', err);
  }

  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_SETTINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}

  return DEFAULT_AFFILIATE_SETTINGS;
}

/**
 * Update Global Affiliate Program Rates in Admin
 */
export async function updateAffiliateSettings(
  settings: Partial<AffiliateSettings>
): Promise<{ success: boolean; settings: AffiliateSettings; message: string }> {
  const current = await fetchAffiliateSettings();
  const updated: AffiliateSettings = {
    ...current,
    ...settings,
    updatedAt: new Date().toISOString(),
  };

  try {
    if (updated.id && isValidUuid(updated.id)) {
      await supabase
        .from('affiliate_settings')
        .update({
          default_commission_rate: updated.defaultCommissionRate,
          default_client_discount_rate: updated.defaultClientDiscountRate,
          is_program_active: updated.isProgramActive,
          min_payout_threshold: updated.minPayoutThreshold,
          updated_at: updated.updatedAt,
        })
        .eq('id', updated.id);
    } else {
      const { data } = await supabase
        .from('affiliate_settings')
        .upsert({
          default_commission_rate: updated.defaultCommissionRate,
          default_client_discount_rate: updated.defaultClientDiscountRate,
          is_program_active: updated.isProgramActive,
          min_payout_threshold: updated.minPayoutThreshold,
          updated_at: updated.updatedAt,
        })
        .select()
        .single();
      if (data) updated.id = data.id;
    }
  } catch (err) {
    console.warn('Supabase update settings fallback:', err);
  }

  localStorage.setItem(LOCAL_STORAGE_SETTINGS_KEY, JSON.stringify(updated));

  return {
    success: true,
    settings: updated,
    message: `Default partner rates updated to: ${updated.defaultCommissionRate}% Commission & ${updated.defaultClientDiscountRate}% Client Discount.`,
  };
}

/**
 * Customize rates for a specific individual partner (e.g. VIP Coordinator Tier)
 */
export async function updatePartnerRates(params: {
  partnerId: string;
  commissionRate: number;
  clientDiscountRate: number;
}): Promise<{ success: boolean; message: string }> {
  try {
    if (isValidUuid(params.partnerId)) {
      await supabase
        .from('affiliates')
        .update({
          commission_rate: params.commissionRate,
          client_discount_rate: params.clientDiscountRate,
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.partnerId);
    }
  } catch (err) {
    console.warn('Supabase update individual partner rates fallback:', err);
  }

  // Update local storage
  const list = getLocalAffiliates();
  const target = list.find((p) => p.id === params.partnerId);
  if (target) {
    target.commissionRate = params.commissionRate;
    target.clientDiscountRate = params.clientDiscountRate;
    saveLocalAffiliates(list);
  }

  return {
    success: true,
    message: `Custom rates saved for partner: ${params.commissionRate}% Commission, ${params.clientDiscountRate}% Client Discount.`,
  };
}

/**
 * Deactivate / Remove an affiliate partner once all pending balances are settled (pending_balance === 0).
 * Once deactivated, their promo code is disabled and they must register/apply again to re-enable.
 */
export async function deactivateAffiliatePartner(partnerId: string): Promise<{ success: boolean; message: string }> {
  try {
    if (isValidUuid(partnerId)) {
      await supabase
        .from('affiliates')
        .update({ status: 'deactivated', updated_at: new Date().toISOString() })
        .eq('id', partnerId);
    }
  } catch (err) {
    console.warn('Supabase deactivate affiliate fallback:', err);
  }

  const list = getLocalAffiliates();
  const target = list.find((p) => p.id === partnerId);
  if (target) {
    target.status = 'deactivated';
    saveLocalAffiliates(list);
  }

  return {
    success: true,
    message: 'Partner account has been deactivated. The promo code is disabled and cannot be used for discounts or commissions.',
  };
}

/**
 * Approve a pending partner registration and dispatch the official approval notification email
 */
export async function approveAffiliatePartner(params: {
  partnerId: string;
  adminEmail?: string;
}): Promise<{ success: boolean; message: string; partner?: AffiliatePartner }> {
  const affs = getLocalAffiliates();
  const partner = affs.find((a) => a.id === params.partnerId);

  if (!partner) {
    return { success: false, message: 'Affiliate partner record not found.' };
  }

  partner.status = 'active';
  saveLocalAffiliates(affs);

  try {
    if (isValidUuid(params.partnerId)) {
      await supabase
        .from('affiliates')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('id', params.partnerId);
    }
  } catch (err) {
    console.warn('Supabase approve affiliate fallback:', err);
  }

  // Dispatch approval notification email to coordinator
  try {
    await sendPartnerApprovalEmail({
      partnerName: partner.partnerName,
      email: partner.email,
      referralCode: partner.referralCode,
      commissionRate: partner.commissionRate,
      clientDiscountRate: partner.clientDiscountRate,
      approvedBy: params.adminEmail || 'admin@binhiconcept.ph',
    });
  } catch (emailErr) {
    console.warn('Could not dispatch partner approval email:', emailErr);
  }

  return {
    success: true,
    message: `Partner ${partner.partnerName} (${partner.referralCode}) has been APPROVED. An official confirmation email with login access was dispatched to ${partner.email}.`,
    partner,
  };
}

/**
 * Reject AND permanently delete a pending partner application.
 * Sends a rejection email first, then removes the record from DB, local storage, and Supabase Auth.
 */
export async function rejectAffiliatePartner(params: {
  partnerId: string;
  reason?: string;
  adminEmail?: string;
}): Promise<{ success: boolean; message: string }> {
  const affs = getLocalAffiliates();
  let partner = affs.find((a) => a.id === params.partnerId);

  // If partner is not found locally or lacks userId/email, fetch from Supabase
  if ((!partner || !partner.userId || !partner.email) && isValidUuid(params.partnerId)) {
    try {
      const { data: remoteData } = await supabase
        .from('affiliates')
        .select('*')
        .eq('id', params.partnerId)
        .maybeSingle();
      if (remoteData) {
        partner = {
          ...(partner || {}),
          id: remoteData.id,
          userId: remoteData.user_id || partner?.userId,
          partnerName: remoteData.partner_name || partner?.partnerName || 'Partner',
          email: remoteData.email || partner?.email,
          phone: remoteData.phone || partner?.phone,
          status: remoteData.status,
          commissionRate: Number(remoteData.commission_rate || 5),
          clientDiscountRate: Number(remoteData.client_discount_rate || 5),
          payoutMethod: remoteData.payout_method || 'GCash',
          payoutAccountName: remoteData.payout_account_name || '',
          payoutAccountNumber: remoteData.payout_account_number || '',
          referralCode: remoteData.referral_code || '',
          profession: remoteData.profession || '',
          totalEarnings: 0,
          totalPaid: 0,
          pendingBalance: 0,
          totalReferralsCount: 0,
          createdAt: remoteData.created_at || new Date().toISOString(),
        };
      }
    } catch (remoteErr) {
      console.warn('Could not fetch affiliate from DB before rejection:', remoteErr);
    }
  }

  if (!partner) {
    return { success: false, message: 'Affiliate partner record not found.' };
  }

  // 1. Send rejection notification email BEFORE deleting
  try {
    await sendPartnerRejectionEmail({
      partnerName: partner.partnerName,
      email: partner.email,
      reason: params.reason,
    });
  } catch (emailErr) {
    console.warn('Could not dispatch partner rejection email:', emailErr);
  }

  // 2. Delete from Supabase Database (cascades referrals & payouts via FK)
  try {
    if (isValidUuid(params.partnerId)) {
      const { error } = await supabase
        .from('affiliates')
        .delete()
        .eq('id', params.partnerId);
      if (error) {
        console.warn('Supabase delete on reject warning:', error);
      }
    }
  } catch (err) {
    console.warn('Supabase delete affiliate on reject fallback:', err);
  }

  // 3. Remove from Supabase Auth & public.profiles via manage-staff Edge Function
  if (partner.userId || partner.email) {
    try {
      await supabase.functions.invoke('manage-staff', {
        body: {
          action: 'delete',
          userId: partner.userId,
          email: partner.email,
        },
      });
    } catch (authErr) {
      console.warn('Could not delete auth user on rejection via edge function:', authErr);
    }
  }

  // 4. Remove from local storage
  const updatedAffs = getLocalAffiliates().filter((a) => a.id !== params.partnerId);
  saveLocalAffiliates(updatedAffs);

  const updatedRefs = getLocalReferrals().filter((r) => r.affiliateId !== params.partnerId);
  saveLocalReferrals(updatedRefs);

  const updatedPays = getLocalPayouts().filter((p) => p.affiliateId !== params.partnerId);
  saveLocalPayouts(updatedPays);

  // 5. Clear session if this partner was logged in
  const session = getStoredPartnerSession();
  if (session && session.id === params.partnerId) {
    clearStoredPartnerSession();
  }

  return {
    success: true,
    message: `Application from ${partner.partnerName} has been rejected and permanently removed. The account has been cleared from authentication so they may apply again in the future.`,
  };
}

/**
 * Permanently delete a single affiliate partner and cascading records
 */
export async function deleteAffiliatePartner(partnerId: string): Promise<{ success: boolean; message: string }> {
  const affs = getLocalAffiliates();
  let partner = affs.find((a) => a.id === partnerId);

  if ((!partner || !partner.userId || !partner.email) && isValidUuid(partnerId)) {
    try {
      const { data: remoteData } = await supabase
        .from('affiliates')
        .select('id, user_id, email, partner_name')
        .eq('id', partnerId)
        .maybeSingle();
      if (remoteData) {
        partner = {
          ...(partner || {}),
          id: remoteData.id,
          userId: remoteData.user_id || partner?.userId,
          email: remoteData.email || partner?.email,
          partnerName: remoteData.partner_name || partner?.partnerName || 'Partner',
        } as any;
      }
    } catch (e) {
      console.warn('Could not fetch remote affiliate info before deletion:', e);
    }
  }

  try {
    if (isValidUuid(partnerId)) {
      // Cascading foreign keys will also remove referral logs & payouts in Supabase
      const { error } = await supabase.from('affiliates').delete().eq('id', partnerId);
      if (error) {
        console.warn('Supabase delete affiliate warning:', error);
      }
    }
  } catch (err) {
    console.warn('Supabase delete affiliate fallback:', err);
  }

  // Remove from Supabase Auth & public.profiles via manage-staff Edge Function
  if (partner?.userId || partner?.email) {
    try {
      await supabase.functions.invoke('manage-staff', {
        body: {
          action: 'delete',
          userId: partner.userId,
          email: partner.email,
        },
      });
    } catch (authErr) {
      console.warn('Could not delete auth user on affiliate delete via edge function:', authErr);
    }
  }

  // Remove from local storage
  const updatedAffs = getLocalAffiliates().filter((a) => a.id !== partnerId);
  saveLocalAffiliates(updatedAffs);

  const refs = getLocalReferrals().filter((r) => r.affiliateId !== partnerId);
  saveLocalReferrals(refs);

  const pays = getLocalPayouts().filter((p) => p.affiliateId !== partnerId);
  saveLocalPayouts(pays);

  // Clear session if this partner was logged in
  const session = getStoredPartnerSession();
  if (session && session.id === partnerId) {
    clearStoredPartnerSession();
  }

  return {
    success: true,
    message: 'Affiliate partner account has been completely removed from the database and authentication system.',
  };
}

/**
 * Remove all affiliate accounts, referrals, and payouts from both database and local cache.
 * Blocked if any partners are still in pending_approval status (must be settled first).
 */
export async function clearAllAffiliateData(): Promise<{ success: boolean; message: string; pendingCount?: number }> {
  // Validate: no pending approvals allowed before clearing
  const currentAffs = getLocalAffiliates();
  const pendingCount = currentAffs.filter((a) => a.status === 'pending_approval').length;
  if (pendingCount > 0) {
    return {
      success: false,
      message: `Cannot clear all accounts yet. There are ${pendingCount} pending application(s) that must be approved or rejected first.`,
      pendingCount,
    };
  }

  // Also double-check Supabase for pending records (in case local is stale)
  try {
    const { data: pendingRemote } = await supabase
      .from('affiliates')
      .select('id')
      .eq('status', 'pending_approval');
    if (pendingRemote && pendingRemote.length > 0) {
      return {
        success: false,
        message: `Cannot clear all accounts yet. There are ${pendingRemote.length} pending application(s) in the database that must be approved or rejected first.`,
        pendingCount: pendingRemote.length,
      };
    }
  } catch (err) {
    console.warn('Could not check remote pending count, proceeding with local validation only:', err);
  }

  // Fetch all affiliates to get their userId & email for auth cleanup
  const allPartnersToPurge: Array<{ userId?: string; email?: string }> = currentAffs.map((a) => ({
    userId: a.userId,
    email: a.email,
  }));

  try {
    const { data: remoteAffs } = await supabase.from('affiliates').select('user_id, email');
    if (remoteAffs && remoteAffs.length > 0) {
      remoteAffs.forEach((r: any) => {
        if (!allPartnersToPurge.some((p) => (r.email && p.email?.toLowerCase() === r.email.toLowerCase()) || (r.user_id && p.userId === r.user_id))) {
          allPartnersToPurge.push({ userId: r.user_id, email: r.email });
        }
      });
    }
  } catch (err) {
    console.warn('Could not fetch all remote affiliates before clearing:', err);
  }

  // Delete from Supabase Database
  try {
    await Promise.all([
      supabase.from('affiliate_payouts').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      supabase.from('affiliate_referrals').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
      supabase.from('affiliates').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
    ]);
  } catch (err) {
    console.warn('Supabase clear all fallback:', err);
  }

  // Delete all users from Supabase Auth & public.profiles
  for (const partner of allPartnersToPurge) {
    if (partner.userId || partner.email) {
      try {
        await supabase.functions.invoke('manage-staff', {
          body: {
            action: 'delete',
            userId: partner.userId,
            email: partner.email,
          },
        });
      } catch (authErr) {
        console.warn(`Could not delete auth user for ${partner.email}:`, authErr);
      }
    }
  }

  // Clear local storage
  saveLocalAffiliates([]);
  saveLocalReferrals([]);
  saveLocalPayouts([]);
  clearStoredPartnerSession();

  return {
    success: true,
    message: 'All settled affiliate accounts, referral records, payouts, and authentication accounts have been successfully removed.',
  };
}



