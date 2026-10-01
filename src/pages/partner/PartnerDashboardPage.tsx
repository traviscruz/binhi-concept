import { useState, useEffect, useMemo } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import {
  IconCheck,
  IconTicket,
  IconShield,
  IconArrow,
  IconX,
  IconEye,
  IconExternal,
  IconUser,
  IconSearch,
  IconBox,
  IconCalendar,
  IconAlertTriangle,
  IconFileSpreadsheet,
} from '../../components/shared/icons';
import { ModalOverlay } from '../../components/shared/ModalOverlay';
import {
  getAffiliateDashboardData,
  getStoredPartnerSession,
  setStoredPartnerSession,
  fetchAffiliateSettings,
  type AffiliatePartner,
  type AffiliateReferralRecord,
  type AffiliatePayoutRecord,
  type AffiliateSettings,
  DEFAULT_AFFILIATE_SETTINGS,
} from '../../utils/affiliateService';

export default function PartnerDashboardPage({ go }: { go: (p: Page) => void }) {
  const [partner, setPartner] = useState<AffiliatePartner | null>(() => getStoredPartnerSession());
  const [referrals, setReferrals] = useState<AffiliateReferralRecord[]>([]);
  const [payouts, setPayouts] = useState<AffiliatePayoutRecord[]>([]);
  const [settings, setSettings] = useState<AffiliateSettings>(DEFAULT_AFFILIATE_SETTINGS);
  const [loading, setLoading] = useState(true);

  // Tabs & Search/Filter
  const [activeTab, setActiveTab] = useState<'referrals' | 'payouts'>('referrals');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'confirmed' | 'pending' | 'completed' | 'paid'>('all');

  // Copy State Feedback
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ text: string; type: 'success' | 'info' } | null>(null);

  // Lightboxes (QR and Proof Receipt)
  const [enlargedQr, setEnlargedQr] = useState<{ url: string; title: string; subtitle?: string } | null>(null);
  const [viewingProof, setViewingProof] = useState<{
    url: string;
    ref: string;
    date?: string;
    amount?: number;
    method?: string;
    account?: string;
    notes?: string;
  } | null>(null);

  const loadPartnerData = async () => {
    const currentSession = getStoredPartnerSession();
    if (!currentSession) {
      go('partner-login');
      return;
    }

    setPartner(currentSession);
    setLoading(true);
    try {
      const lookupKey = currentSession.id || currentSession.email || currentSession.referralCode;
      const [data, appSettings] = await Promise.all([
        getAffiliateDashboardData(lookupKey),
        fetchAffiliateSettings(),
      ]);

      if (data && data.partner) {
        setPartner(data.partner);
        setReferrals(data.referrals);
        setPayouts(data.payouts);
        setStoredPartnerSession(data.partner);
      }
      setSettings(appSettings);
    } catch (err) {
      console.error('Failed to load partner dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPartnerData();
  }, []);

  const handleCopyCode = () => {
    if (!partner) return;
    navigator.clipboard.writeText(partner.referralCode);
    setCopiedCode(true);
    setActionFeedback({ text: `Promo code ${partner.referralCode} copied to clipboard!`, type: 'success' });
    setTimeout(() => {
      setCopiedCode(false);
      setActionFeedback(null);
    }, 3000);
  };

  const handleCopyLink = () => {
    if (!partner) return;
    const url = `${window.location.origin}/?ref=${encodeURIComponent(partner.referralCode)}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setActionFeedback({ text: 'Client referral link copied to clipboard!', type: 'success' });
    setTimeout(() => {
      setCopiedLink(false);
      setActionFeedback(null);
    }, 3000);
  };

  // Derived Financial Statistics
  const totalReferredSales = useMemo(() => {
    return referrals.reduce((sum, r) => sum + (Number(r.contractAmount) || 0), 0);
  }, [referrals]);

  // Filtered Referrals
  const filteredReferrals = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return referrals.filter((r) => {
      const matchesSearch =
        !q ||
        r.clientName.toLowerCase().includes(q) ||
        r.bookingRef.toLowerCase().includes(q) ||
        (r.packageName && r.packageName.toLowerCase().includes(q));

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'pending' && r.status === 'pending') ||
        (statusFilter === 'confirmed' && r.status === 'confirmed') ||
        (statusFilter === 'completed' && (r.status === 'completed' || r.status === 'paid')) ||
        (statusFilter === 'paid' && r.status === 'paid');

      return matchesSearch && matchesStatus;
    });
  }, [referrals, searchQuery, statusFilter]);

  // Filtered Payouts
  const filteredPayouts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return payouts.filter((p) => {
      return (
        !q ||
        p.transactionReference.toLowerCase().includes(q) ||
        p.payoutMethod.toLowerCase().includes(q) ||
        p.payoutAccountName.toLowerCase().includes(q) ||
        p.payoutAccountNumber.toLowerCase().includes(q) ||
        (p.notes && p.notes.toLowerCase().includes(q))
      );
    });
  }, [payouts, searchQuery]);

  if (!partner && !loading) {
    return (
      <div className="p-12 text-center space-y-4 max-w-md mx-auto bg-white rounded-2xl border border-[#24252c]/[0.08] shadow-xs my-12">
        <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
          <IconAlertTriangle className="w-6 h-6" />
        </div>
        <h3 className="font-extrabold text-base text-[var(--ink)]">Partner Portal Session</h3>
        <p className="text-xs text-[#24252c]/60 leading-relaxed">
          Please sign in to view your real-time referral ledger and payout history.
        </p>
        <button
          type="button"
          onClick={() => go('partner-login')}
          className="w-full py-3 bg-[var(--ink)] text-white text-xs font-bold rounded-full hover:bg-black/80 transition-colors cursor-pointer shadow-xs"
        >
          Sign In to Partner Portal
        </button>
      </div>
    );
  }

  const commissionRate = partner?.commissionRate || settings.defaultCommissionRate;
  const discountRate = partner?.clientDiscountRate || settings.defaultClientDiscountRate;

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* ── 1. Top Header & Quick Actions (System Admin Standard) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#24252c]/[0.06]">
        <div>
          <MonoBadge icon={IconTicket}>Affiliate &amp; Partner Commission Management</MonoBadge>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ink)] mt-1.5">
            Partner System Overview &amp; Earnings
          </h1>
          <p className="text-xs text-[#24252c]/60 mt-1">
            Real-time executive control center: track client bookings, commission ledger, payout balances, and verified disbursement slips.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            type="button"
            onClick={loadPartnerData}
            disabled={loading}
            className="px-4 py-2.5 rounded-full bg-white hover:bg-[var(--mist)] text-[var(--ink)] border border-[#24252c]/10 text-xs font-semibold transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
            title="Refresh dashboard data"
          >
            <span className={`inline-block ${loading ? 'animate-spin' : ''}`}>↻</span>
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleCopyLink}
            className="px-4 py-2.5 rounded-full bg-white hover:bg-[var(--mist)] text-[var(--ink)] border border-[#24252c]/10 text-xs font-semibold transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
          >
            <IconExternal className="w-3.5 h-3.5 text-[#1090F8]" />
            <span>{copiedLink ? 'Link Copied!' : 'Copy Referral Link'}</span>
          </button>

          <button
            type="button"
            onClick={handleCopyCode}
            className="bg-[#1090F8] hover:bg-[#0c78d1] text-white text-xs font-bold px-5 py-2.5 rounded-full transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <IconTicket className="w-3.5 h-3.5" />
            <span>{copiedCode ? 'Code Copied!' : `Promo Code: ${partner?.referralCode}`}</span>
          </button>
        </div>
      </div>

      {/* ── Toast Feedback Alert ── */}
      {actionFeedback && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center justify-between shadow-xs animate-fade-in ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-blue-50 border border-blue-200 text-blue-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <IconCheck className="w-4 h-4 text-emerald-600" />
            <span className="font-semibold">{actionFeedback.text}</span>
          </div>
          <button onClick={() => setActionFeedback(null)} className="opacity-70 hover:opacity-100 cursor-pointer">
            <IconX className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Status Alerts for Pending / Rejected Partners ── */}
      {partner && partner.status === 'pending_approval' && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 sm:p-5 flex items-start gap-3 shadow-xs animate-fade-in">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
            <IconAlertTriangle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-extrabold text-amber-900">
              Registration Under Review by System Administration
            </h3>
            <p className="text-xs text-amber-800/80 mt-0.5 leading-relaxed">
              Your partner registration and promo code <strong className="font-mono text-amber-950">{partner.referralCode}</strong> have been submitted for verification. You will receive an official approval email notification once activated by the admin team.
            </p>
          </div>
        </div>
      )}

      {partner && partner.status === 'rejected' && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 sm:p-5 flex items-start gap-3 shadow-xs animate-fade-in">
          <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold text-lg shrink-0">
            <IconAlertTriangle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-extrabold text-rose-900">
              Partner Application Status: Not Approved
            </h3>
            <p className="text-xs text-rose-800/80 mt-0.5 leading-relaxed">
              Your application was reviewed and not approved by administration. Please check your email for the reason or reach out to support.
            </p>
          </div>
        </div>
      )}

      {/* ── 2. Active Rates & Coordinator Info Banner (Admin Style) ── */}
      {partner && (
        <div className="bg-gradient-to-r from-emerald-500/10 via-blue-500/10 to-transparent border border-emerald-500/20 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-sm shrink-0 shadow-xs">
              %
            </div>
            <div>
              <div className="text-xs font-extrabold text-[var(--ink)] flex items-center gap-2 flex-wrap">
                <span>Active Partner Program Rates:</span>
                <span className="text-emerald-700 bg-emerald-100/70 border border-emerald-300 px-2 py-0.5 rounded-md font-mono">
                  {commissionRate}% Commission Rate
                </span>
                <span className="text-blue-700 bg-blue-100/70 border border-blue-300 px-2 py-0.5 rounded-md font-mono">
                  {discountRate}% Client Checkout Discount
                </span>
              </div>
              <p className="text-[11px] text-[#24252c]/60 mt-0.5">
                Referred clients receive {discountRate}% off automatically using code{' '}
                <strong className="font-mono text-[#1090F8]">{partner.referralCode}</strong>. Your {commissionRate}% commission accrues instantly upon event booking confirmation.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => go('partner-profile')}
              className="px-3 py-1.5 rounded-xl bg-white border border-[#24252c]/10 text-xs font-bold text-[var(--ink)] hover:bg-black/5 transition-colors cursor-pointer"
            >
              Payout Settings →
            </button>
          </div>
        </div>
      )}

      {/* ── 3. Executive KPI Metrics Grid (Identical to Admin Dashboard Cards) ── */}
      {partner && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Gross Referred Sales */}
          <div className="bg-white rounded-2xl p-5 border border-[#24252c]/[0.08] shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#24252c]/50 uppercase tracking-wider">Gross Referred Sales</span>
              <div className="p-2 rounded-xl bg-blue-50 text-[#1090F8]">
                <IconTicket className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-[var(--ink)]">
                {loading ? (
                  <div className="h-7 w-28 bg-black/5 animate-pulse rounded" />
                ) : (
                  `₱${totalReferredSales.toLocaleString()}`
                )}
              </div>
              <div className="text-[11px] text-[#24252c]/60 mt-1 flex items-center gap-1">
                <span>{referrals.length} client contract bookings generated</span>
              </div>
            </div>
          </div>

          {/* Cumulative Commission Accrued */}
          <div className="bg-white rounded-2xl p-5 border border-[#24252c]/[0.08] shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#24252c]/50 uppercase tracking-wider">Total Accrued</span>
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <IconCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-emerald-600">
                {loading ? (
                  <div className="h-7 w-24 bg-black/5 animate-pulse rounded" />
                ) : (
                  `₱${partner.totalEarnings.toLocaleString()}`
                )}
              </div>
              <div className="text-[11px] text-[#24252c]/60 mt-1">
                Cumulative {commissionRate}% commission earned
              </div>
            </div>
          </div>

          {/* Pending Disbursal Balance */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Pending Balance</span>
              <div className="p-2 rounded-xl bg-amber-100 text-amber-800">
                <IconShield className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-amber-900">
                {loading ? (
                  <div className="h-7 w-20 bg-black/5 animate-pulse rounded" />
                ) : (
                  `₱${partner.pendingBalance.toLocaleString()}`
                )}
              </div>
              <div className="text-[11px] text-amber-700 mt-1 font-medium">
                {partner.pendingBalance > 0 ? 'Queued for admin one-click disbursal' : 'All earnings fully settled'}
              </div>
            </div>
          </div>

          {/* Total Paid Out */}
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Total Paid Out</span>
              <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
                <IconBox className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-emerald-900">
                {loading ? (
                  <div className="h-7 w-24 bg-black/5 animate-pulse rounded" />
                ) : (
                  `₱${partner.totalPaid.toLocaleString()}`
                )}
              </div>
              <div className="text-[11px] text-emerald-700 mt-1 font-medium">
                Disbursed via {partner.payoutMethod} with proof slips
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 4. Coordinator Promo Kit & Payout Profile (Admin Dark Gradient Card) ── */}
      {partner && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--ink)] to-[#181920] p-6 text-white shadow-md">
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-start sm:items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[#1090F8]/20 text-[#1090F8] flex items-center justify-center font-black text-xl border border-[#1090F8]/30 shrink-0 shadow-inner">
                {partner.partnerName.slice(0, 2).toUpperCase()}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                    {partner.partnerName}
                  </h2>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {partner.profession || 'Event Coordinator'}
                  </span>
                  {partner.businessName && (
                    <span className="text-[10px] text-white/60">
                      · {partner.businessName}
                    </span>
                  )}
                </div>
                <p className="text-xs text-white/70">
                  {partner.email} · {partner.phone}
                </p>
                <div className="text-[11px] text-white/60 pt-1 flex items-center gap-2 flex-wrap">
                  <span>
                    Receiving Channel: <strong className="text-white">{partner.payoutMethod}</strong> ({partner.payoutAccountNumber})
                  </span>
                  {partner.payoutQrUrl && (
                    <button
                      type="button"
                      onClick={() =>
                        setEnlargedQr({
                          url: partner.payoutQrUrl!,
                          title: partner.partnerName,
                          subtitle: `${partner.payoutMethod} · ${partner.payoutAccountNumber} (${partner.payoutAccountName})`,
                        })
                      }
                      className="text-[10px] text-emerald-400 font-bold hover:underline cursor-pointer flex items-center gap-0.5"
                    >
                      <IconEye className="w-3 h-3" /> View QR Code
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => go('partner-profile')}
                    className="text-[10px] font-bold text-amber-300 hover:text-amber-200 underline cursor-pointer"
                  >
                    Edit Bank Info →
                  </button>
                </div>
              </div>
            </div>

            {/* Promo Code Quick Copy Box */}
            <div className="bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/15 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-white/60 block">
                  Your Client Promo Code
                </span>
                <span className="text-2xl font-mono font-black text-white tracking-wider block mt-0.5">
                  {partner.referralCode}
                </span>
                <span className="text-[10px] text-emerald-300 font-medium block mt-0.5">
                  Gives your clients <strong>{discountRate}% OFF</strong> at booking checkout
                </span>
              </div>
              <div className="flex sm:flex-col gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="px-3 py-1.5 rounded-lg bg-white text-[var(--ink)] text-xs font-bold hover:bg-slate-100 transition-colors cursor-pointer shadow-xs"
                >
                  {copiedCode ? 'Copied!' : 'Copy Code'}
                </button>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="px-3 py-1.5 rounded-lg bg-[#1090F8] text-white text-xs font-bold hover:bg-[#0c78d0] transition-colors cursor-pointer shadow-xs"
                >
                  {copiedLink ? 'Copied!' : 'Copy Link'}
                </button>
              </div>
            </div>
          </div>

          <div className="absolute -right-16 -bottom-16 w-80 h-80 bg-[#1090F8]/15 rounded-full blur-3xl pointer-events-none" />
        </div>
      )}

      {/* ── 5. Sub Tabs & Search Toolbar (Matching AdminAffiliatesPage) ── */}
      <div className="bg-white rounded-2xl p-4 border border-[#24252c]/[0.08] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => {
              setActiveTab('referrals');
              setSearchQuery('');
            }}
            className={`text-xs font-bold px-4 py-2 rounded-full transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'referrals'
                ? 'bg-[var(--ink)] text-white shadow-xs'
                : 'bg-[var(--mist)] text-[#24252c]/70 hover:bg-black/5'
            }`}
          >
            Referral Bookings Log ({referrals.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('payouts');
              setSearchQuery('');
            }}
            className={`text-xs font-bold px-4 py-2 rounded-full transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'payouts'
                ? 'bg-[var(--ink)] text-white shadow-xs'
                : 'bg-[var(--mist)] text-[#24252c]/70 hover:bg-black/5'
            }`}
          >
            Disbursement History ({payouts.length})
          </button>
        </div>

        {/* Search & Status Filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative min-w-[220px]">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={activeTab === 'referrals' ? 'Search client or booking ref...' : 'Search reference or notes...'}
              className="w-full pl-8 pr-4 py-2 rounded-full border border-[#24252c]/10 bg-[var(--mist)] text-xs text-[var(--ink)] focus:outline-none focus:border-[#1090F8]"
            />
            <IconSearch className="w-3.5 h-3.5 text-[#24252c]/40 absolute left-3 top-1/2 -translate-y-1/2" />
          </div>

          {activeTab === 'referrals' && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-4 py-2 rounded-full bg-[var(--mist)] border border-[#24252c]/10 text-xs font-semibold text-[var(--ink)] focus:outline-none focus:border-[#1090F8] cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="confirmed">Confirmed</option>
              <option value="pending">Pending Review</option>
              <option value="completed">Completed / Paid</option>
            </select>
          )}
        </div>
      </div>

      {/* ── SUB-VIEW 1: REFERRAL BOOKINGS TABLE (Admin Standard) ── */}
      {activeTab === 'referrals' && (
        <div className="bg-white rounded-2xl border border-[#24252c]/[0.08] shadow-xs overflow-hidden">
          {filteredReferrals.length === 0 ? (
            <div className="p-12 text-center text-xs text-[#24252c]/50 space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-[#24252c]/40 flex items-center justify-center mx-auto">
                <IconBox className="w-6 h-6" />
              </div>
              <p className="font-bold text-[var(--ink)] text-sm">No referrals match your filter</p>
              <p className="max-w-sm mx-auto">
                {searchQuery
                  ? `No bookings found matching "${searchQuery}". Clear your search query to view all records.`
                  : `Share your promo code ${partner?.referralCode} with event coordinators and clients to start earning.`}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#24252c]/[0.06] bg-[var(--mist)] text-[#24252c]/50 font-bold uppercase text-[10px]">
                    <th className="p-3.5 pl-4">Booking Ref</th>
                    <th className="p-3.5">Client &amp; Event Date</th>
                    <th className="p-3.5">Package Setup</th>
                    <th className="p-3.5 text-right">Contract Amount</th>
                    <th className="p-3.5 text-right">Client Discount</th>
                    <th className="p-3.5 text-right">Your Commission</th>
                    <th className="p-3.5 text-center pr-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#24252c]/[0.04]">
                  {filteredReferrals.map((ref) => {
                    const isPaid = ref.status === 'paid' || ref.status === 'completed';
                    const isPending = ref.status === 'pending';
                    return (
                      <tr key={ref.id} className="hover:bg-black/[0.015] transition-colors">
                        <td className="p-3.5 pl-4">
                          <span className="font-mono font-bold text-[#1090F8] bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md text-[11px]">
                            {ref.bookingRef}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <div className="font-extrabold text-[var(--ink)]">{ref.clientName}</div>
                          {ref.eventDate && (
                            <div className="text-[10px] text-[#24252c]/50 mt-0.5 flex items-center gap-1">
                              <IconCalendar className="w-3 h-3 text-[#24252c]/40" />
                              <span>{ref.eventDate}</span>
                            </div>
                          )}
                        </td>
                        <td className="p-3.5 text-[#24252c]/80 font-medium">
                          {ref.packageName || 'Event Production Setup'}
                        </td>
                        <td className="p-3.5 text-right font-semibold text-[var(--ink)]">
                          ₱{ref.contractAmount.toLocaleString()}
                        </td>
                        <td className="p-3.5 text-right font-medium text-emerald-600">
                          -₱{ref.discountApplied.toLocaleString()}
                        </td>
                        <td className="p-3.5 text-right font-black text-blue-600 text-sm">
                          +₱{ref.commissionEarned.toLocaleString()}
                        </td>
                        <td className="p-3.5 text-center pr-4">
                          <span
                            className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                              isPaid
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : isPending
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}
                          >
                            {ref.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── SUB-VIEW 2: DISBURSEMENT HISTORY TABLE (Admin Standard) ── */}
      {activeTab === 'payouts' && (
        <div className="bg-white rounded-2xl border border-[#24252c]/[0.08] shadow-xs overflow-hidden">
          {filteredPayouts.length === 0 ? (
            <div className="p-12 text-center text-xs text-[#24252c]/50 space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-[#24252c]/40 flex items-center justify-center mx-auto">
                <IconTicket className="w-6 h-6" />
              </div>
              <p className="font-bold text-[var(--ink)] text-sm">No payout disbursement records found</p>
              <p className="max-w-sm mx-auto">
                Commission payouts are credited and disbursed to your registered banking account as events are staged.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#24252c]/[0.06] bg-[var(--mist)] text-[#24252c]/50 font-bold uppercase text-[10px]">
                    <th className="p-3.5 pl-4">Disbursement Date</th>
                    <th className="p-3.5">Transaction Ref</th>
                    <th className="p-3.5">Payout Method &amp; Account</th>
                    <th className="p-3.5 text-right">Amount Disbursed</th>
                    <th className="p-3.5">Notes / Admin Memo</th>
                    <th className="p-3.5 text-center pr-4">Official Proof Slip</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#24252c]/[0.04]">
                  {filteredPayouts.map((py) => (
                    <tr key={py.id} className="hover:bg-black/[0.015] transition-colors">
                      <td className="p-3.5 pl-4 text-[#24252c]/80 font-medium">
                        {new Date(py.processedAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                        <span className="text-[10px] text-[#24252c]/40 block">
                          {new Date(py.processedAt).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <span className="font-mono font-bold text-[var(--ink)] bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md text-[11px]">
                          {py.transactionReference}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <div className="font-semibold text-[var(--ink)]">{py.payoutMethod}</div>
                        <div className="text-[10px] text-[#24252c]/60">
                          {py.payoutAccountNumber} ({py.payoutAccountName})
                        </div>
                      </td>
                      <td className="p-3.5 text-right font-black text-emerald-700 text-sm">
                        ₱{py.amount.toLocaleString()}
                      </td>
                      <td className="p-3.5 text-[#24252c]/70 text-[11px] max-w-xs truncate">
                        {py.notes || '—'}
                      </td>
                      <td className="p-3.5 text-center pr-4">
                        {py.receiptUrl ? (
                          <button
                            type="button"
                            onClick={() =>
                              setViewingProof({
                                url: py.receiptUrl!,
                                ref: py.transactionReference,
                                date: new Date(py.processedAt).toLocaleDateString('en-US', {
                                  month: 'long',
                                  day: 'numeric',
                                  year: 'numeric',
                                }),
                                amount: py.amount,
                                method: py.payoutMethod,
                                account: `${py.payoutAccountName} · ${py.payoutAccountNumber}`,
                                notes: py.notes,
                              })
                            }
                            className="px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-[#1090F8] text-[11px] font-bold hover:bg-blue-100 transition-colors inline-flex items-center gap-1 cursor-pointer shadow-2xs"
                          >
                            <IconEye className="w-3.5 h-3.5" />
                            <span>View Slip</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-[#24252c]/40 italic">No slip attached</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Lightbox Modal: Proof of Payment Slip ── */}
      <ModalOverlay isOpen={!!viewingProof} onClose={() => setViewingProof(null)}>
        <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-[#24252c]/10 relative space-y-4 animate-scale-in">
          <button
            type="button"
            onClick={() => setViewingProof(null)}
            className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-[var(--mist)] text-[#24252c]/40 cursor-pointer"
          >
            <IconX className="w-5 h-5" />
          </button>

          <div className="text-center space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
              Verified Commission Disbursement
            </span>
            <h3 className="text-lg font-black text-[var(--ink)] mt-1">Official Proof of Payment</h3>
            <p className="text-xs text-[#24252c]/60">
              Reference: <strong className="font-mono text-[var(--ink)]">{viewingProof?.ref}</strong>
            </p>
          </div>

          {viewingProof && (
            <div className="space-y-4">
              <div className="p-2 bg-slate-50 rounded-xl border border-[#24252c]/10 flex items-center justify-center max-h-80 overflow-hidden">
                <img
                  src={viewingProof.url}
                  alt={`Proof slip ${viewingProof.ref}`}
                  className="max-h-72 w-auto object-contain rounded-lg shadow-2xs"
                />
              </div>

              <div className="p-4 bg-[var(--mist)] rounded-xl border border-[#24252c]/[0.06] space-y-1.5 text-xs">
                {viewingProof.amount !== undefined && (
                  <div className="flex justify-between font-bold text-[var(--ink)]">
                    <span>Disbursed Amount:</span>
                    <span className="text-emerald-700 font-black text-sm">
                      ₱{viewingProof.amount.toLocaleString()}
                    </span>
                  </div>
                )}
                {viewingProof.date && (
                  <div className="flex justify-between text-[#24252c]/70 text-[11px]">
                    <span>Processed Date:</span>
                    <span>{viewingProof.date}</span>
                  </div>
                )}
                {viewingProof.method && (
                  <div className="flex justify-between text-[#24252c]/70 text-[11px]">
                    <span>Channel &amp; Account:</span>
                    <span>{viewingProof.method}</span>
                  </div>
                )}
                {viewingProof.notes && (
                  <div className="pt-1.5 border-t border-[#24252c]/10 text-[10px] text-[#24252c]/60">
                    Memo: {viewingProof.notes}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </ModalOverlay>

      {/* ── Lightbox Modal: Partner InstaPay / GCash QR ── */}
      <ModalOverlay isOpen={!!enlargedQr} onClose={() => setEnlargedQr(null)}>
        <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-sm w-full shadow-2xl border border-[#24252c]/10 relative space-y-4 text-center animate-scale-in">
          <button
            type="button"
            onClick={() => setEnlargedQr(null)}
            className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-[var(--mist)] text-[#24252c]/40 cursor-pointer"
          >
            <IconX className="w-5 h-5" />
          </button>

          <div>
            <h4 className="font-extrabold text-base text-[var(--ink)]">InstaPay / GCash QR</h4>
            <p className="text-xs text-[#24252c]/60 mt-0.5">{enlargedQr?.subtitle}</p>
          </div>

          {enlargedQr && (
            <div className="p-3 bg-slate-50 rounded-xl border border-[#24252c]/10 flex items-center justify-center">
              <img
                src={enlargedQr.url}
                alt="Enlarged QR Code"
                className="w-64 h-64 object-contain rounded-lg"
              />
            </div>
          )}

          <p className="text-[11px] text-[#24252c]/50">
            Registered for direct 1-click scan payouts from BINHI Concept administration.
          </p>
        </div>
      </ModalOverlay>
    </div>
  );
}

