import { useState, useEffect } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import {
  IconCheck,
  IconTicket,
  IconShield,
  IconArrow,
  IconX,
  IconSearch,
  IconSettings,
  IconAlertTriangle,
  IconEye,
  IconExternal,
} from '../../components/shared/icons';
import { ModalOverlay } from '../../components/shared/ModalOverlay';
import {
  fetchAllAffiliates,
  disburseAffiliatePayout,
  updateAffiliatePayout,
  uploadAffiliateProof,
  fetchAffiliateSettings,
  updateAffiliateSettings,
  updatePartnerRates,
  deactivateAffiliatePartner,
  approveAffiliatePartner,
  rejectAffiliatePartner,
  deleteAffiliatePartner,
  clearAllAffiliateData,
  type AffiliatePartner,
  type AffiliateReferralRecord,
  type AffiliatePayoutRecord,
  type AffiliateSettings,
  DEFAULT_AFFILIATE_SETTINGS,
} from '../../utils/affiliateService';

export default function AdminAffiliatesPage({ go }: { go: (p: Page) => void }) {
  const [loading, setLoading] = useState(true);
  const [affiliates, setAffiliates] = useState<AffiliatePartner[]>([]);
  const [referrals, setReferrals] = useState<AffiliateReferralRecord[]>([]);
  const [payouts, setPayouts] = useState<AffiliatePayoutRecord[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [settings, setSettings] = useState<AffiliateSettings>(DEFAULT_AFFILIATE_SETTINGS);

  // Search & Filter
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'partners' | 'pending' | 'rejected' | 'referrals' | 'payouts'>('partners');

  // Approval & Rejection State
  const [approvingPartnerId, setApprovingPartnerId] = useState<string | null>(null);
  const [partnerToReject, setPartnerToReject] = useState<AffiliatePartner | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectingPartnerId, setRejectingPartnerId] = useState<string | null>(null);

  // Deletion State
  const [partnerToDelete, setPartnerToDelete] = useState<AffiliatePartner | null>(null);
  const [deletingPartner, setDeletingPartner] = useState(false);
  const [showClearAllModal, setShowClearAllModal] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);

  // Payout Disbursal Modal
  const [selectedAffiliateForPayout, setSelectedAffiliateForPayout] = useState<AffiliatePartner | null>(null);
  const [payoutAmount, setPayoutAmount] = useState<number>(0);
  const [txnReference, setTxnReference] = useState('');
  const [payoutNotes, setPayoutNotes] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [processingPayout, setProcessingPayout] = useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null);

  // Edit Disbursement Modal
  const [editingPayout, setEditingPayout] = useState<AffiliatePayoutRecord | null>(null);
  const [editTxnRef, setEditTxnRef] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editProofFile, setEditProofFile] = useState<File | null>(null);
  const [editProofPreview, setEditProofPreview] = useState<string | null>(null);
  const [savingEditPayout, setSavingEditPayout] = useState(false);

  // Lightbox Modals (QR and Proof Receipt)
  const [enlargedQr, setEnlargedQr] = useState<{ url: string; title: string; subtitle?: string } | null>(null);
  const [viewingProof, setViewingProof] = useState<{
    url: string;
    ref: string;
    partnerName?: string;
    date?: string;
    amount?: number;
    notes?: string;
  } | null>(null);

  // Deactivate Partner Modal
  const [partnerToDeactivate, setPartnerToDeactivate] = useState<AffiliatePartner | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  // Rate Settings Modal (Global)
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [formCommissionRate, setFormCommissionRate] = useState(5);
  const [formDiscountRate, setFormDiscountRate] = useState(5);
  const [formMinPayout, setFormMinPayout] = useState(1000);
  const [formIsActive, setFormIsActive] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  // Individual Partner Custom Rates Modal
  const [editingPartnerRates, setEditingPartnerRates] = useState<AffiliatePartner | null>(null);
  const [customPartnerCommission, setCustomPartnerCommission] = useState(5);
  const [customPartnerDiscount, setCustomPartnerDiscount] = useState(5);
  const [savingPartnerRates, setSavingPartnerRates] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [res, appSettings] = await Promise.all([
        fetchAllAffiliates(),
        fetchAffiliateSettings(),
      ]);
      setAffiliates(res.affiliates);
      setReferrals(res.referrals);
      setPayouts(res.payouts);
      setSummary(res.summary);
      setSettings(appSettings);
      setFormCommissionRate(appSettings.defaultCommissionRate);
      setFormDiscountRate(appSettings.defaultClientDiscountRate);
      setFormMinPayout(appSettings.minPayoutThreshold);
      setFormIsActive(appSettings.isProgramActive);
    } catch (err) {
      console.error('Failed to load affiliates in admin:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenPayoutModal = (partner: AffiliatePartner) => {
    setSelectedAffiliateForPayout(partner);
    setPayoutAmount(partner.pendingBalance);
    setTxnReference(`GCASH-REF-${Math.floor(1000000000 + Math.random() * 9000000000)}`);
    setPayoutNotes(`Commission payout for ${partner.partnerName}`);
    setProofFile(null);
    setProofPreview(null);
  };

  const handleConfirmPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAffiliateForPayout || payoutAmount <= 0 || !txnReference.trim()) return;

    setProcessingPayout(true);
    setActionErrorMessage(null);
    try {
      let uploadedReceiptUrl: string | undefined = undefined;
      if (proofFile) {
        const uploadRes = await uploadAffiliateProof(proofFile);
        if (uploadRes.success && uploadRes.url) {
          uploadedReceiptUrl = uploadRes.url;
        }
      }

      const res = await disburseAffiliatePayout({
        affiliateId: selectedAffiliateForPayout.id,
        amount: payoutAmount,
        transactionReference: txnReference.trim(),
        notes: payoutNotes.trim(),
        receiptUrl: uploadedReceiptUrl,
      });

      if (res.success) {
        setActionSuccessMessage(res.message);
        setSelectedAffiliateForPayout(null);
        setProofFile(null);
        setProofPreview(null);
        await loadData();
        setTimeout(() => setActionSuccessMessage(null), 5000);
      } else {
        setActionErrorMessage(res.message);
      }
    } catch (err: any) {
      console.error('Error disbursing payout:', err);
      setActionErrorMessage(err?.message || 'Failed to process disbursal.');
    } finally {
      setProcessingPayout(false);
    }
  };

  const handleOpenEditPayoutModal = (payout: AffiliatePayoutRecord) => {
    setEditingPayout(payout);
    setEditTxnRef(payout.transactionReference || '');
    setEditNotes(payout.notes || '');
    setEditProofFile(null);
    setEditProofPreview(payout.receiptUrl || null);
  };

  const handleSaveEditPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPayout) return;

    setSavingEditPayout(true);
    setActionErrorMessage(null);
    try {
      let finalReceiptUrl = editProofPreview || undefined;

      if (editProofFile) {
        const uploadRes = await uploadAffiliateProof(editProofFile);
        if (uploadRes.success && uploadRes.url) {
          finalReceiptUrl = uploadRes.url;
        }
      }

      const res = await updateAffiliatePayout({
        payoutId: editingPayout.id,
        transactionReference: editTxnRef.trim(),
        notes: editNotes.trim(),
        receiptUrl: finalReceiptUrl,
      });

      if (res.success) {
        setActionSuccessMessage('Disbursement details updated successfully.');
        setEditingPayout(null);
        await loadData();
        setTimeout(() => setActionSuccessMessage(null), 5000);
      } else {
        setActionErrorMessage(res.message);
      }
    } catch (err: any) {
      console.error('Failed to update payout record:', err);
      setActionErrorMessage(err?.message || 'Failed to update disbursement record.');
    } finally {
      setSavingEditPayout(false);
    }
  };

  const handleSaveGlobalSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await updateAffiliateSettings({
        defaultCommissionRate: Number(formCommissionRate),
        defaultClientDiscountRate: Number(formDiscountRate),
        minPayoutThreshold: Number(formMinPayout),
        isProgramActive: formIsActive,
      });

      if (res.success) {
        setSettings(res.settings);
        setShowSettingsModal(false);
        setActionSuccessMessage(res.message);
        await loadData();
        setTimeout(() => setActionSuccessMessage(null), 5000);
      }
    } catch (err) {
      console.error('Failed to update rate settings:', err);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleOpenPartnerRatesModal = (partner: AffiliatePartner) => {
    setEditingPartnerRates(partner);
    setCustomPartnerCommission(partner.commissionRate || settings.defaultCommissionRate);
    setCustomPartnerDiscount(partner.clientDiscountRate || settings.defaultClientDiscountRate);
  };

  const handleSavePartnerRates = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPartnerRates) return;

    setSavingPartnerRates(true);
    try {
      const res = await updatePartnerRates({
        partnerId: editingPartnerRates.id,
        commissionRate: Number(customPartnerCommission),
        clientDiscountRate: Number(customPartnerDiscount),
      });

      if (res.success) {
        setActionSuccessMessage(res.message);
        setEditingPartnerRates(null);
        await loadData();
        setTimeout(() => setActionSuccessMessage(null), 5000);
      }
    } catch (err) {
      console.error('Failed to save custom rates:', err);
    } finally {
      setSavingPartnerRates(false);
    }
  };

  const handleConfirmDeactivation = async () => {
    if (!partnerToDeactivate) return;
    setDeactivating(true);
    setActionErrorMessage(null);
    try {
      const res = await deactivateAffiliatePartner(partnerToDeactivate.id);
      if (res.success) {
        setActionSuccessMessage(res.message);
        setPartnerToDeactivate(null);
        await loadData();
        setTimeout(() => setActionSuccessMessage(null), 5000);
      } else {
        setActionErrorMessage(res.message);
      }
    } catch (err: any) {
      console.error('Failed to deactivate partner:', err);
      setActionErrorMessage(err?.message || 'Failed to deactivate partner account.');
    } finally {
      setDeactivating(false);
    }
  };

  const handleApprovePartner = async (partner: AffiliatePartner) => {
    setApprovingPartnerId(partner.id);
    setActionErrorMessage(null);
    try {
      const res = await approveAffiliatePartner({ partnerId: partner.id });
      if (res.success) {
        setActionSuccessMessage(res.message);
        await loadData();
        setTimeout(() => setActionSuccessMessage(null), 6000);
      } else {
        setActionErrorMessage(res.message);
      }
    } catch (err: any) {
      console.error('Approval error:', err);
      setActionErrorMessage(err?.message || 'Failed to approve partner application.');
    } finally {
      setApprovingPartnerId(null);
    }
  };

  const handleOpenRejectModal = (partner: AffiliatePartner) => {
    setPartnerToReject(partner);
    setRejectReason('Information provided did not meet our partner program criteria.');
  };

  const handleConfirmReject = async () => {
    if (!partnerToReject) return;
    setRejectingPartnerId(partnerToReject.id);
    setActionErrorMessage(null);
    try {
      const res = await rejectAffiliatePartner({
        partnerId: partnerToReject.id,
        reason: rejectReason.trim(),
      });
      if (res.success) {
        setActionSuccessMessage(res.message);
        setPartnerToReject(null);
        await loadData();
        setTimeout(() => setActionSuccessMessage(null), 6000);
      } else {
        setActionErrorMessage(res.message);
      }
    } catch (err: any) {
      console.error('Rejection error:', err);
      setActionErrorMessage(err?.message || 'Failed to reject partner application.');
    } finally {
      setRejectingPartnerId(null);
    }
  };

  const handleConfirmDeletePartner = async () => {
    if (!partnerToDelete) return;
    setDeletingPartner(true);
    setActionErrorMessage(null);
    try {
      const res = await deleteAffiliatePartner(partnerToDelete.id);
      if (res.success) {
        setActionSuccessMessage(res.message);
        setPartnerToDelete(null);
        await loadData();
        setTimeout(() => setActionSuccessMessage(null), 5000);
      } else {
        setActionErrorMessage(res.message);
      }
    } catch (err: any) {
      console.error('Delete partner error:', err);
      setActionErrorMessage(err?.message || 'Failed to delete partner account.');
    } finally {
      setDeletingPartner(false);
    }
  };

  const handleConfirmClearAll = async () => {
    setClearingAll(true);
    setActionErrorMessage(null);
    try {
      const res = await clearAllAffiliateData();
      if (res.success) {
        setActionSuccessMessage(res.message);
        setShowClearAllModal(false);
        await loadData();
        setTimeout(() => setActionSuccessMessage(null), 5000);
      } else {
        setActionErrorMessage(res.message);
      }
    } catch (err: any) {
      console.error('Clear all error:', err);
      setActionErrorMessage(err?.message || 'Failed to clear all affiliate accounts.');
    } finally {
      setClearingAll(false);
    }
  };

  const pendingApprovals = affiliates.filter((a) => a.status === 'pending_approval');
  const activeAffiliatesList = affiliates.filter((a) => a.status === 'active' || a.status === 'deactivated');
  const rejectedAffiliatesList = affiliates.filter((a) => a.status === 'rejected');

  const filteredAffiliates = activeAffiliatesList.filter((a) => {
    const q = search.toLowerCase();
    return (
      !q ||
      a.partnerName.toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q) ||
      a.referralCode.toLowerCase().includes(q) ||
      a.profession.toLowerCase().includes(q)
    );
  });

  const filteredPending = pendingApprovals.filter((a) => {
    const q = search.toLowerCase();
    return (
      !q ||
      a.partnerName.toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q) ||
      a.referralCode.toLowerCase().includes(q) ||
      a.profession.toLowerCase().includes(q)
    );
  });

  const filteredRejected = rejectedAffiliatesList.filter((a) => {
    const q = search.toLowerCase();
    return (
      !q ||
      a.partnerName.toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q) ||
      a.referralCode.toLowerCase().includes(q) ||
      a.profession.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* ── Top Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#24252c]/[0.08]">
        <div>
          <div className="flex items-center gap-2">
            <MonoBadge icon={IconTicket}>Affiliate &amp; Partner Commission Management</MonoBadge>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
              B2B Referral Network
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--ink)] tracking-tight mt-1.5">
            Affiliate &amp; Partner Commission Management
          </h1>
          <p className="text-xs text-[#24252c]/60 mt-1">
            Configure dynamic commission rates, adjust client promo discounts, and manage partner payouts in real time.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setFormCommissionRate(settings.defaultCommissionRate);
              setFormDiscountRate(settings.defaultClientDiscountRate);
              setFormMinPayout(settings.minPayoutThreshold);
              setFormIsActive(settings.isProgramActive);
              setShowSettingsModal(true);
            }}
            className="text-xs font-bold px-4 py-2 rounded-full bg-amber-500 text-white hover:bg-amber-600 transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
          >
            <IconSettings className="w-3.5 h-3.5" /> Program Rate Settings ({settings.defaultCommissionRate}% / {settings.defaultClientDiscountRate}%)
          </button>

          <button
            type="button"
            onClick={() => go('affiliates')}
            className="text-xs font-semibold px-4 py-2 rounded-full bg-[var(--mist)] text-[var(--ink)] hover:bg-[#1090F8]/10 hover:text-[#1090F8] transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <IconArrow className="w-3.5 h-3.5" /> View Public Portal
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {actionSuccessMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 font-semibold flex items-center justify-between shadow-xs animate-fade-in">
          <div className="flex items-center gap-2">
            <IconCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccessMessage}</span>
          </div>
          <button onClick={() => setActionSuccessMessage(null)} className="text-emerald-700 hover:text-emerald-900 cursor-pointer">
            <IconX className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error Notification Banner */}
      {actionErrorMessage && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-900 font-semibold flex items-center justify-between shadow-xs animate-fade-in">
          <div className="flex items-center gap-2">
            <IconX className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{actionErrorMessage}</span>
          </div>
          <button onClick={() => setActionErrorMessage(null)} className="text-rose-700 hover:text-rose-900 cursor-pointer">
            <IconX className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Dynamic Rate Status Banner ── */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50/80 via-emerald-50/50 to-transparent border border-blue-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#1090F8] text-white flex items-center justify-center font-bold text-sm shadow-xs">
            %
          </div>
          <div>
            <div className="text-xs font-extrabold text-[var(--ink)] flex items-center gap-2 flex-wrap">
              <span>Active System Rates:</span>
              <span className="text-emerald-700 bg-emerald-100/70 border border-emerald-300 px-3 py-0.5 rounded-full font-mono">
                {settings.defaultCommissionRate}% Partner Commission
              </span>
              <span className="text-blue-700 bg-blue-100/70 border border-blue-300 px-3 py-0.5 rounded-full font-mono">
                {settings.defaultClientDiscountRate}% Client Promo Discount
              </span>
            </div>
            <p className="text-[11px] text-[#24252c]/60 mt-0.5">
              New partners automatically inherit these rates. You can also assign custom VIP percentage rates to specific coordinators below.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            type="button"
            onClick={() => setShowClearAllModal(true)}
            className="text-xs font-bold px-4 py-2 rounded-full bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer shadow-2xs"
          >
            Clear All Partner Accounts
          </button>
          <button
            type="button"
            onClick={() => {
              setFormCommissionRate(settings.defaultCommissionRate);
              setFormDiscountRate(settings.defaultClientDiscountRate);
              setFormMinPayout(settings.minPayoutThreshold);
              setFormIsActive(settings.isProgramActive);
              setShowSettingsModal(true);
            }}
            className="text-xs font-bold px-4 py-2 rounded-full bg-white border border-[#24252c]/10 text-[var(--ink)] hover:bg-black/5 transition-colors cursor-pointer shadow-2xs"
          >
            Change Default Rates
          </button>
        </div>
      </div>

      {/* ── Executive Summary KPI Cards ── */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 rounded-2xl bg-white border border-[#24252c]/[0.08] shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#24252c]/50 block">Active Partners</span>
            <div className="text-2xl sm:text-3xl font-black text-[var(--ink)] mt-1">
              {summary.activePartners} <span className="text-xs font-semibold text-[#24252c]/50">coordinators/venues</span>
            </div>
            <span className="text-[10px] text-emerald-600 font-semibold mt-1 block">
              {summary.totalReferralsCount} referred bookings
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-[#24252c]/[0.08] shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#24252c]/50 block">Affiliate-Driven Sales</span>
            <div className="text-2xl sm:text-3xl font-black text-[#1090F8] mt-1">
              ₱{summary.totalAffiliateSalesRevenue.toLocaleString()}
            </div>
            <span className="text-[10px] text-[#24252c]/50 font-medium mt-1 block">Direct contract gross value</span>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">Commissions Paid</span>
            <div className="text-2xl sm:text-3xl font-black text-emerald-900 mt-1">
              ₱{summary.totalCommissionsPaid.toLocaleString()}
            </div>
            <span className="text-[10px] text-emerald-700 font-medium mt-1 block">Disbursed via GCash / Maya / Bank</span>
          </div>

          <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">Pending Payout Queue</span>
            <div className="text-2xl sm:text-3xl font-black text-amber-900 mt-1">
              ₱{summary.totalPendingDisbursements.toLocaleString()}
            </div>
            <span className="text-[10px] text-amber-700 font-medium mt-1 block">Awaiting admin one-click disbursal</span>
          </div>
        </div>
      )}

      {/* ── Sub Tabs & Search Toolbar ── */}
      <div className="bg-white rounded-2xl p-4 border border-[#24252c]/[0.08] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setActiveTab('partners')}
            className={`text-xs font-bold px-4 py-2 rounded-full transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'partners'
                ? 'bg-[var(--ink)] text-white shadow-xs'
                : 'bg-[var(--mist)] text-[#24252c]/70 hover:bg-black/5'
            }`}
          >
            Active Partners ({activeAffiliatesList.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pending')}
            className={`text-xs font-bold px-4 py-2 rounded-full transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'pending'
                ? 'bg-[var(--ink)] text-white shadow-xs'
                : 'bg-[var(--mist)] text-[#24252c]/70 hover:bg-black/5'
            }`}
          >
            <span>Pending Approvals</span>
            {pendingApprovals.length > 0 ? (
              <span className="px-2 py-0.5 bg-amber-500 text-white rounded-full text-[10px] font-black animate-pulse">
                {pendingApprovals.length}
              </span>
            ) : (
              <span className="text-[10px] opacity-60">({pendingApprovals.length})</span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('referrals')}
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
            onClick={() => setActiveTab('payouts')}
            className={`text-xs font-bold px-4 py-2 rounded-full transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'payouts'
                ? 'bg-[var(--ink)] text-white shadow-xs'
                : 'bg-[var(--mist)] text-[#24252c]/70 hover:bg-black/5'
            }`}
          >
            Disbursement History ({payouts.length})
          </button>
        </div>

        {/* Search */}
        <div className="relative min-w-[240px]">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search partner, code, or email..."
            className="w-full pl-8 pr-4 py-2 rounded-full border border-[#24252c]/10 bg-[var(--mist)] text-xs text-[var(--ink)] focus:outline-none focus:border-[#1090F8]"
          />
          <IconSearch className="w-3.5 h-3.5 text-[#24252c]/40 absolute left-3 top-1/2 -translate-y-1/2" />
        </div>
      </div>

      {/* ── SUB-VIEW 1: PARTNERS LIST ── */}
      {activeTab === 'partners' && (
        <div className="bg-white rounded-2xl border border-[#24252c]/[0.08] shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#24252c]/[0.06] bg-[var(--mist)] text-[#24252c]/50 font-bold uppercase text-[10px]">
                  <th className="p-3.5 pl-4">Partner & Profession</th>
                  <th className="p-3.5">Promo Code</th>
                  <th className="p-3.5">Assigned Rates</th>
                  <th className="p-3.5">Payout Details (GCash/Bank)</th>
                  <th className="p-3.5 text-center">Referrals</th>
                  <th className="p-3.5 text-right">Total Earned</th>
                  <th className="p-3.5 text-right">Pending Balance</th>
                  <th className="p-3.5 text-center pr-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#24252c]/[0.04]">
                {filteredAffiliates.map((a) => {
                  const comm = a.commissionRate ?? settings.defaultCommissionRate;
                  const disc = a.clientDiscountRate ?? settings.defaultClientDiscountRate;
                  const isCustomRate = comm !== settings.defaultCommissionRate || disc !== settings.defaultClientDiscountRate;

                  return (
                    <tr key={a.id} className="hover:bg-black/[0.015] transition-colors">
                      <td className="p-3.5 pl-4">
                        <div className="font-extrabold text-[var(--ink)]">{a.partnerName}</div>
                        <div className="text-[11px] text-[#24252c]/60">
                          {a.businessName || a.profession} · {a.phone}
                        </div>
                      </td>
                      <td className="p-3.5">
                        <span className="font-mono font-black text-[#1090F8] bg-blue-50 border border-blue-200 px-3 py-1 rounded-full text-[11px] inline-block">
                          {a.referralCode}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[10px] font-bold px-3 py-0.5 rounded-full ${
                            isCustomRate 
                              ? 'bg-amber-100 text-amber-900 border border-amber-300 font-extrabold' 
                              : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          }`}>
                            Partner: {comm}% · Client: {disc}%
                          </span>
                          {isCustomRate && (
                            <span className="text-[9px] font-black uppercase text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                              Custom VIP
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpenPartnerRatesModal(a)}
                          className="text-[10px] text-[#1090F8] hover:underline font-semibold mt-1 block cursor-pointer"
                        >
                          Edit Rates
                        </button>
                      </td>
                      <td className="p-3.5">
                        <div className="flex items-start gap-2">
                          <div>
                            <div className="font-semibold text-[var(--ink)]">{a.payoutMethod}: {a.payoutAccountNumber}</div>
                            <div className="text-[10px] text-[#24252c]/50">
                              {a.payoutAccountName} {a.payoutBankName ? `(${a.payoutBankName})` : ''}
                            </div>
                          </div>
                          {a.payoutQrUrl && (
                            <button
                              type="button"
                              onClick={() =>
                                setEnlargedQr({
                                    url: a.payoutQrUrl!,
                                    title: a.partnerName,
                                    subtitle: `${a.payoutMethod} · ${a.payoutAccountNumber} (${a.payoutAccountName})`,
                                })
                              }
                              className="shrink-0 p-1 rounded-full border border-amber-300 bg-amber-50/70 hover:bg-amber-100 transition-colors group cursor-pointer"
                              title="Click to enlarge partner QR code"
                            >
                              <img
                                src={a.payoutQrUrl}
                                alt="QR"
                                className="w-6 h-6 object-contain rounded-full"
                              />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="p-3.5 text-center font-bold text-[var(--ink)]">
                        {a.totalReferralsCount}
                      </td>
                      <td className="p-3.5 text-right font-extrabold text-[var(--ink)]">
                        ₱{a.totalEarnings.toLocaleString()}
                      </td>
                      <td className="p-3.5 text-right font-black text-amber-700">
                        ₱{a.pendingBalance.toLocaleString()}
                      </td>
                      <td className="p-3.5 text-center pr-4">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          {a.status === 'deactivated' ? (
                            <>
                              <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-3 py-1 rounded-full">
                                Deactivated
                              </span>
                              <button
                                type="button"
                                onClick={() => setPartnerToDelete(a)}
                                className="text-[10px] font-bold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2.5 py-1 rounded-full transition-colors cursor-pointer"
                                title="Delete partner account permanently"
                              >
                                Delete
                              </button>
                            </>
                          ) : a.pendingBalance > 0 ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenPayoutModal(a)}
                                className="px-4 py-1.5 rounded-full bg-emerald-600 text-white font-extrabold text-[11px] hover:bg-emerald-700 transition-colors cursor-pointer shadow-xs"
                              >
                                Disburse ₱{a.pendingBalance.toLocaleString()}
                              </button>
                              <button
                                type="button"
                                onClick={() => setPartnerToDelete(a)}
                                className="text-[10px] font-bold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2.5 py-1 rounded-full transition-colors cursor-pointer"
                                title="Delete partner account permanently"
                              >
                                Delete
                              </button>
                            </>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                                Settled
                              </span>
                              <button
                                type="button"
                                onClick={() => setPartnerToDeactivate(a)}
                                className="text-[10px] font-bold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2.5 py-0.5 rounded-full transition-colors cursor-pointer"
                                title="Deactivate this partner account"
                              >
                                Deactivate
                              </button>
                              <button
                                type="button"
                                onClick={() => setPartnerToDelete(a)}
                                className="text-[10px] font-bold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2.5 py-0.5 rounded-full transition-colors cursor-pointer"
                                title="Delete partner account permanently"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── SUB-VIEW: PENDING AFFILIATE REGISTRATION APPROVALS ── */}
      {activeTab === 'pending' && (
        <div className="bg-white rounded-2xl border border-[#24252c]/[0.08] shadow-xs overflow-hidden">
          {filteredPending.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
                <IconCheck className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-sm text-[var(--ink)]">No Pending Partner Applications</h3>
              <p className="text-xs text-[#24252c]/60 max-w-sm mx-auto">
                All registered event coordinators and affiliate partners have been reviewed and approved.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#24252c]/[0.06] bg-[var(--mist)] text-[#24252c]/50 font-bold uppercase text-[10px]">
                    <th className="p-3.5 pl-4">Applicant & Contact</th>
                    <th className="p-3.5">Profession / Business</th>
                    <th className="p-3.5">Requested Promo Code</th>
                    <th className="p-3.5">Default Rates</th>
                    <th className="p-3.5">Payout Details & QR</th>
                    <th className="p-3.5 text-center pr-4">Review Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#24252c]/[0.04]">
                  {filteredPending.map((a) => {
                    const isApproving = approvingPartnerId === a.id;
                    return (
                      <tr key={a.id} className="hover:bg-black/[0.015] transition-colors">
                        <td className="p-3.5 pl-4">
                          <div className="font-extrabold text-[var(--ink)] text-sm">{a.partnerName}</div>
                          <div className="text-[11px] text-[#1090F8] font-medium mt-0.5">{a.email}</div>
                          <div className="text-[11px] text-[#24252c]/60 mt-0.5">{a.phone}</div>
                        </td>
                        <td className="p-3.5">
                          <div className="font-bold text-[var(--ink)]">{a.profession}</div>
                          {a.businessName && (
                            <div className="text-[11px] text-[#24252c]/60 mt-0.5">{a.businessName}</div>
                          )}
                        </td>
                        <td className="p-3.5">
                          <span className="font-mono font-black text-[#1090F8] bg-blue-50 border border-blue-200 px-3 py-1 rounded-full text-xs inline-block">
                            {a.referralCode}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-0.5 rounded-full inline-block">
                              Partner: {a.commissionRate || settings.defaultCommissionRate}%
                            </span>
                            <span className="text-[10px] font-bold text-blue-800 bg-blue-50 border border-blue-200 px-3 py-0.5 rounded-full inline-block">
                              Client: {a.clientDiscountRate || settings.defaultClientDiscountRate}%
                            </span>
                          </div>
                        </td>
                        <td className="p-3.5">
                          <div className="space-y-0.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full">
                              {a.payoutMethod || 'GCash'}
                            </span>
                            <div className="font-bold text-[var(--ink)] text-xs">{a.payoutAccountName}</div>
                            <div className="font-mono text-[#24252c]/60 text-[11px]">{a.payoutAccountNumber}</div>
                            {a.payoutQrUrl && (
                              <button
                                type="button"
                                onClick={() =>
                                  setEnlargedQr({
                                    url: a.payoutQrUrl!,
                                    title: `${a.partnerName} (${a.payoutMethod})`,
                                    subtitle: `${a.payoutAccountName} · ${a.payoutAccountNumber}`,
                                  })
                                }
                                className="mt-1 text-[10px] font-bold text-[#1090F8] hover:underline flex items-center gap-1 cursor-pointer"
                              >
                                <IconEye className="w-3 h-3" />
                                View Uploaded QR
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="p-3.5 text-center pr-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              disabled={isApproving || Boolean(rejectingPartnerId)}
                              onClick={() => handleApprovePartner(a)}
                              className="px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs transition-all shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                            >
                              {isApproving ? (
                                <>
                                  <span className="animate-spin text-xs">↻</span>
                                  <span>Approving...</span>
                                </>
                              ) : (
                                <>
                                  <IconCheck className="w-3.5 h-3.5" />
                                  <span>Approve &amp; Send Email</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              disabled={isApproving || Boolean(rejectingPartnerId)}
                              onClick={() => handleOpenRejectModal(a)}
                              className="px-3.5 py-2 rounded-full bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1"
                            >
                              <IconX className="w-3.5 h-3.5" />
                              <span>Reject</span>
                            </button>

                            <button
                              type="button"
                              disabled={isApproving || Boolean(rejectingPartnerId)}
                              onClick={() => setPartnerToDelete(a)}
                              className="px-3 py-2 rounded-full bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
                              title="Delete application"
                            >
                              Delete
                            </button>
                          </div>
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

      {/* ── SUB-VIEW: REJECTED AFFILIATE APPLICATIONS ── */}
      {activeTab === 'rejected' && (
        <div className="bg-white rounded-2xl border border-[#24252c]/[0.08] shadow-xs overflow-hidden">
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mx-auto border border-rose-200">
              <IconX className="w-6 h-6" />
            </div>
            <h3 className="font-extrabold text-sm text-[var(--ink)]">Rejections Are Permanent</h3>
            <p className="text-xs text-[#24252c]/60 max-w-sm mx-auto">
              When you reject an application, the record is immediately and permanently deleted — no rejected tab to manage.
              The applicant receives a rejection email and can re-apply with a new email if they wish.
            </p>
          </div>
        </div>
      )}

      {/* ── SUB-VIEW 2: REFERRALS AUDIT ── */}
      {activeTab === 'referrals' && (
        <div className="bg-white rounded-2xl border border-[#24252c]/[0.08] shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#24252c]/[0.06] bg-[var(--mist)] text-[#24252c]/50 font-bold uppercase text-[10px]">
                  <th className="p-3.5 pl-4">Booking Ref</th>
                  <th className="p-3.5">Client & Event</th>
                  <th className="p-3.5">Staging Package</th>
                  <th className="p-3.5 text-right">Contract Value</th>
                  <th className="p-3.5 text-right">Client Promo Discount</th>
                  <th className="p-3.5 text-right">Partner Commission</th>
                  <th className="p-3.5 text-center pr-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#24252c]/[0.04]">
                {referrals.map((r) => (
                  <tr key={r.id} className="hover:bg-black/[0.015]">
                    <td className="p-3.5 pl-4 font-mono font-bold text-[#1090F8]">{r.bookingRef}</td>
                    <td className="p-3.5">
                      <div className="font-bold text-[var(--ink)]">{r.clientName}</div>
                      <div className="text-[10px] text-[#24252c]/50">{r.eventDate || 'Confirmed Event'}</div>
                    </td>
                    <td className="p-3.5 text-[#24252c]/70 font-medium">{r.packageName || 'Production Setup'}</td>
                    <td className="p-3.5 text-right font-semibold">₱{r.contractAmount.toLocaleString()}</td>
                    <td className="p-3.5 text-right text-emerald-600 font-semibold">-₱{r.discountApplied.toLocaleString()}</td>
                    <td className="p-3.5 text-right font-black text-[var(--ink)]">₱{r.commissionEarned.toLocaleString()}</td>
                    <td className="p-3.5 text-center pr-4">
                      <span className={`inline-block text-[10px] font-bold px-3 py-0.5 rounded-full ${
                        r.status === 'paid'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {r.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── SUB-VIEW 3: PAYOUTS HISTORY ── */}
      {activeTab === 'payouts' && (
        <div className="bg-white rounded-2xl border border-[#24252c]/[0.08] shadow-xs overflow-hidden">
          {payouts.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#24252c]/50">
              No commission payouts recorded yet.
            </div>
          ) : (
            <div className="divide-y divide-[#24252c]/[0.04] text-xs">
              {payouts.map((p) => (
                <div key={p.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-black/[0.01]">
                  <div className="space-y-1">
                    <div className="text-base font-extrabold text-[var(--ink)] flex items-center gap-2">
                      <span>₱{p.amount.toLocaleString()}</span>
                      <span className="text-xs font-normal text-[#24252c]/50">via {p.payoutMethod}</span>
                    </div>
                    <div className="text-[11px] text-[#24252c]/60">
                      Account: <strong>{p.payoutAccountName}</strong> ({p.payoutAccountNumber}) {p.payoutBankName ? `· ${p.payoutBankName}` : ''}
                    </div>
                    <div className="text-[11px] text-[#24252c]/50 font-mono">
                      Reference: <strong className="text-[var(--ink)]">{p.transactionReference}</strong> {p.notes ? `· Notes: ${p.notes}` : ''}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap sm:justify-end">
                    {p.receiptUrl ? (
                      <button
                        type="button"
                        onClick={() =>
                          setViewingProof({
                            url: p.receiptUrl!,
                            ref: p.transactionReference,
                            partnerName: p.payoutAccountName,
                            amount: p.amount,
                            date: p.processedAt,
                            notes: p.notes,
                          })
                        }
                        className="px-3 py-1 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <IconEye className="w-3.5 h-3.5 text-blue-600" />
                        View Proof Slip
                      </button>
                    ) : (
                      <span className="text-[10px] text-[#24252c]/40 italic px-2 py-0.5">
                        No proof attached
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => handleOpenEditPayoutModal(p)}
                      className="px-3 py-1 rounded-full bg-[var(--mist)] hover:bg-black/10 text-[var(--ink)] border border-[#24252c]/10 text-[11px] font-semibold transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <IconSettings className="w-3.5 h-3.5 text-[#24252c]/60" />
                      Edit Details
                    </button>

                    <div className="text-right shrink-0 pl-2">
                      <span className="text-[10px] font-bold px-3 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 block">
                        Disbursed
                      </span>
                      <div className="text-[10px] text-[#24252c]/40 mt-0.5">
                        {new Date(p.processedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── MODAL 1: Global Program Rate Settings Modal ── */}
      <ModalOverlay isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)}>
        <div className="bg-white rounded-[2rem] p-6 max-w-lg w-full shadow-2xl border border-[#24252c]/10 relative space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#24252c]/10">
            <div className="flex items-center gap-2">
              <IconSettings className="w-5 h-5 text-amber-500" />
              <h3 className="text-base font-extrabold text-[var(--ink)]">Global Affiliate Rate Configuration</h3>
            </div>
            <button
              type="button"
              onClick={() => setShowSettingsModal(false)}
              className="p-1 rounded-full hover:bg-[var(--mist)] text-[#24252c]/40 cursor-pointer"
            >
              <IconX className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSaveGlobalSettings} className="space-y-4 text-xs">
            <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl text-blue-900 leading-relaxed">
              These percentage rates apply as the <strong>default rates</strong> for all new partner registrations, the public simulator, and marketing copy.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold uppercase text-[#24252c]/60 block mb-1">
                  Default Partner Commission (%) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="50"
                    required
                    value={formCommissionRate}
                    onChange={(e) => setFormCommissionRate(Number(e.target.value))}
                    className="w-full pl-3 pr-8 py-2 rounded-xl border border-[#24252c]/15 bg-[var(--mist)] font-extrabold text-sm text-[var(--ink)] focus:outline-none focus:border-[#1090F8]"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-extrabold text-[#24252c]/40">%</span>
                </div>
                <span className="text-[10px] text-[#24252c]/50 mt-0.5 block">What partner earns per booking</span>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-[#24252c]/60 block mb-1">
                  Default Client Promo Discount (%) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="50"
                    required
                    value={formDiscountRate}
                    onChange={(e) => setFormDiscountRate(Number(e.target.value))}
                    className="w-full pl-3 pr-8 py-2 rounded-xl border border-[#24252c]/15 bg-[var(--mist)] font-extrabold text-sm text-[var(--ink)] focus:outline-none focus:border-[#1090F8]"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-extrabold text-[#24252c]/40">%</span>
                </div>
                <span className="text-[10px] text-[#24252c]/50 mt-0.5 block">Discount client receives on checkout</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold uppercase text-[#24252c]/60 block mb-1">
                  Minimum Payout Threshold (PHP)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-[#24252c]/40">₱</span>
                  <input
                    type="number"
                    step="100"
                    min="100"
                    value={formMinPayout}
                    onChange={(e) => setFormMinPayout(Number(e.target.value))}
                    className="w-full pl-7 pr-3 py-2 rounded-xl border border-[#24252c]/15 bg-[var(--mist)] font-semibold text-xs text-[var(--ink)] focus:outline-none focus:border-[#1090F8]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl border border-[#24252c]/10 bg-[var(--mist)] self-end">
                <div>
                  <div className="font-bold text-[var(--ink)]">Program Active Status</div>
                  <div className="text-[10px] text-[#24252c]/50">Accept new partners & codes</div>
                </div>
                <input
                  type="checkbox"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                />
              </div>
            </div>

            <div className="pt-3 flex justify-end gap-2 border-t border-[#24252c]/10">
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="px-4 py-2 bg-[var(--mist)] text-[var(--ink)] text-xs font-semibold rounded-xl hover:bg-black/5 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingSettings}
                className="px-5 py-2 bg-amber-500 text-white text-xs font-extrabold rounded-xl hover:bg-amber-600 transition-colors cursor-pointer shadow-md disabled:opacity-50"
              >
                {savingSettings ? 'Saving Settings...' : 'Save Global Rates'}
              </button>
            </div>
          </form>
        </div>
      </ModalOverlay>

      {/* ── MODAL 2: Individual Partner Custom Rates Modal ── */}
      <ModalOverlay isOpen={Boolean(editingPartnerRates)} onClose={() => setEditingPartnerRates(null)}>
        {editingPartnerRates && (
          <div className="bg-white rounded-[2rem] p-6 max-w-md w-full shadow-2xl border border-[#24252c]/10 relative space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#24252c]/10">
              <div>
                <h3 className="text-base font-extrabold text-[var(--ink)]">Customize Partner Rate</h3>
                <p className="text-[11px] text-[#24252c]/60">{editingPartnerRates.partnerName} ({editingPartnerRates.referralCode})</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingPartnerRates(null)}
                className="p-1 rounded-full hover:bg-[var(--mist)] text-[#24252c]/40 cursor-pointer"
              >
                <IconX className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePartnerRates} className="space-y-4 text-xs">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-[11px] leading-relaxed">
                Assign customized commission or discount rates specifically for this coordinator (e.g. VIP 8% commission).
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-[#24252c]/60 block mb-1">
                  Custom Partner Commission Rate (%) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="50"
                    required
                    value={customPartnerCommission}
                    onChange={(e) => setCustomPartnerCommission(Number(e.target.value))}
                    className="w-full pl-3 pr-8 py-2 rounded-xl border border-[#24252c]/15 bg-[var(--mist)] font-extrabold text-sm text-[var(--ink)] focus:outline-none focus:border-amber-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-extrabold text-[#24252c]/40">%</span>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-[#24252c]/60 block mb-1">
                  Custom Client Promo Discount Rate (%) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="50"
                    required
                    value={customPartnerDiscount}
                    onChange={(e) => setCustomPartnerDiscount(Number(e.target.value))}
                    className="w-full pl-3 pr-8 py-2 rounded-xl border border-[#24252c]/15 bg-[var(--mist)] font-extrabold text-sm text-[var(--ink)] focus:outline-none focus:border-amber-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 font-extrabold text-[#24252c]/40">%</span>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingPartnerRates(null)}
                  className="px-4 py-2 bg-[var(--mist)] text-[var(--ink)] text-xs font-semibold rounded-xl hover:bg-black/5 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPartnerRates}
                  className="px-5 py-2 bg-amber-500 text-white text-xs font-extrabold rounded-xl hover:bg-amber-600 transition-colors cursor-pointer shadow-md disabled:opacity-50"
                >
                  {savingPartnerRates ? 'Saving...' : 'Apply Custom Rates'}
                </button>
              </div>
            </form>
          </div>
        )}
      </ModalOverlay>

      {/* ── MODAL 3: One-Click Payout Disbursal Modal ── */}
      <ModalOverlay isOpen={Boolean(selectedAffiliateForPayout)} onClose={() => setSelectedAffiliateForPayout(null)}>
        {selectedAffiliateForPayout && (
          <div className="bg-white rounded-[2rem] p-6 max-w-lg w-full shadow-2xl border border-[#24252c]/10 relative space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#24252c]/10">
              <div className="flex items-center gap-2">
                <IconShield className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-extrabold text-[var(--ink)]">Disburse Partner Commission</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAffiliateForPayout(null)}
                className="p-1 rounded-full hover:bg-[var(--mist)] text-[#24252c]/40 cursor-pointer"
              >
                <IconX className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmPayout} className="space-y-3.5 text-xs">
              {/* Partner Bank / GCash summary box */}
              <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-amber-900 block">Recipient Account Details</span>
                    <div className="font-extrabold text-sm text-amber-950">{selectedAffiliateForPayout.partnerName}</div>
                    <div className="font-semibold text-xs text-amber-900">
                      {selectedAffiliateForPayout.payoutMethod}: {selectedAffiliateForPayout.payoutAccountNumber}
                    </div>
                    <div className="text-[11px] text-amber-800/80">
                      Account Name: {selectedAffiliateForPayout.payoutAccountName} {selectedAffiliateForPayout.payoutBankName ? `(${selectedAffiliateForPayout.payoutBankName})` : ''}
                    </div>
                  </div>

                  {selectedAffiliateForPayout.payoutQrUrl && (
                    <div className="shrink-0 text-center">
                      <button
                        type="button"
                        onClick={() =>
                          setEnlargedQr({
                            url: selectedAffiliateForPayout.payoutQrUrl!,
                            title: selectedAffiliateForPayout.partnerName,
                            subtitle: `${selectedAffiliateForPayout.payoutMethod} · ${selectedAffiliateForPayout.payoutAccountNumber} (${selectedAffiliateForPayout.payoutAccountName})`,
                          })
                        }
                        className="group relative cursor-pointer block rounded-lg border-2 border-amber-400/80 bg-white p-1 shadow-sm hover:scale-105 transition-transform"
                        title="Click to zoom / enlarge QR code"
                      >
                        <img
                          src={selectedAffiliateForPayout.payoutQrUrl}
                          alt="Partner InstaPay QR"
                          className="w-20 h-20 object-contain rounded"
                        />
                        <div className="absolute inset-0 bg-black/40 text-white opacity-0 group-hover:opacity-100 rounded flex items-center justify-center transition-opacity">
                          <IconEye className="w-4 h-4" />
                        </div>
                      </button>
                      <span className="text-[9px] font-extrabold text-amber-800 block mt-1 hover:underline cursor-pointer" onClick={() =>
                        setEnlargedQr({
                          url: selectedAffiliateForPayout.payoutQrUrl!,
                          title: selectedAffiliateForPayout.partnerName,
                          subtitle: `${selectedAffiliateForPayout.payoutMethod} · ${selectedAffiliateForPayout.payoutAccountNumber}`,
                        })
                      }>
                        Click to Enlarge
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-[#24252c]/60 block mb-1">
                  Disbursal Amount (PHP) *
                </label>
                <input
                  type="number"
                  required
                  max={selectedAffiliateForPayout.pendingBalance}
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-[#24252c]/15 bg-[var(--mist)] font-extrabold text-base text-[var(--ink)] focus:outline-none focus:border-emerald-600"
                />
                <span className="text-[10px] text-[#24252c]/40 mt-0.5 block">
                  Max available balance: ₱{selectedAffiliateForPayout.pendingBalance.toLocaleString()}
                </span>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-[#24252c]/60 block mb-1">
                  Transaction Reference No. (GCash / Bank Ref) *
                </label>
                <input
                  type="text"
                  required
                  value={txnReference}
                  onChange={(e) => setTxnReference(e.target.value)}
                  placeholder="e.g. GCASH-REF-9928194819"
                  className="w-full px-3 py-2 rounded-xl border border-[#24252c]/15 bg-[var(--mist)] font-mono text-xs focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-[#24252c]/60 block mb-1">
                  Attach Payment Proof / Receipt Slip (Saves to Cloud Storage)
                </label>
                <div className="p-3 rounded-xl border border-dashed border-[#24252c]/20 bg-[var(--mist)] flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      id="disburse-proof-file-input"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          setProofFile(f);
                          const reader = new FileReader();
                          reader.onload = () => setProofPreview(reader.result as string);
                          reader.readAsDataURL(f);
                        }
                      }}
                    />
                    <label
                      htmlFor="disburse-proof-file-input"
                      className="px-3 py-1.5 rounded-lg bg-white border border-[#24252c]/15 text-xs font-bold text-[var(--ink)] hover:bg-black/5 cursor-pointer flex items-center gap-1.5 shadow-2xs"
                    >
                      <IconExternal className="w-3.5 h-3.5" />
                      {proofFile ? 'Change Slip' : 'Choose Receipt Image'}
                    </label>
                    <span className="text-[11px] text-[#24252c]/60 truncate max-w-[180px]">
                      {proofFile ? proofFile.name : 'No file chosen'}
                    </span>
                  </div>

                  {proofPreview && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          setViewingProof({
                            url: proofPreview,
                            ref: txnReference || 'Draft Disbursal',
                            partnerName: selectedAffiliateForPayout?.partnerName,
                            amount: payoutAmount,
                            notes: payoutNotes,
                          })
                        }
                        className="p-1 rounded bg-white border border-[#24252c]/10 text-blue-600 hover:text-blue-800 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                        title="Preview uploaded proof"
                      >
                        <IconEye className="w-3.5 h-3.5" />
                        Preview
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setProofFile(null);
                          setProofPreview(null);
                        }}
                        className="p-1 text-rose-600 hover:text-rose-800 text-[10px] font-bold cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-[#24252c]/40 mt-1 block">
                  Uploaded receipt is securely saved to Supabase storage and instantly visible to the partner in their portal.
                </span>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-[#24252c]/60 block mb-1">
                  Internal Notes / Event Summary
                </label>
                <input
                  type="text"
                  value={payoutNotes}
                  onChange={(e) => setPayoutNotes(e.target.value)}
                  placeholder="e.g. Commission for Mark & Bea Wedding"
                  className="w-full px-3 py-2 rounded-xl border border-[#24252c]/15 bg-[var(--mist)] text-xs focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedAffiliateForPayout(null)}
                  className="px-4 py-2 bg-[var(--mist)] text-[var(--ink)] text-xs font-semibold rounded-xl hover:bg-black/5 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processingPayout}
                  className="px-5 py-2 bg-emerald-600 text-white text-xs font-extrabold rounded-xl hover:bg-emerald-700 transition-colors cursor-pointer shadow-md disabled:opacity-50"
                >
                  {processingPayout ? 'Processing Disbursal...' : `Confirm & Mark as Paid (₱${payoutAmount.toLocaleString()})`}
                </button>
              </div>
            </form>
          </div>
        )}
      </ModalOverlay>

      {/* ── MODAL 4: Edit Disbursement Record Modal ── */}
      <ModalOverlay isOpen={Boolean(editingPayout)} onClose={() => setEditingPayout(null)}>
        {editingPayout && (
          <div className="bg-white rounded-[2rem] p-6 max-w-lg w-full shadow-2xl border border-[#24252c]/10 relative space-y-4 max-h-[92vh] overflow-y-auto animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-[#24252c]/10">
              <div className="flex items-center gap-2">
                <IconSettings className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-extrabold text-[var(--ink)]">Edit Disbursement Record</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingPayout(null)}
                className="p-1 rounded-full hover:bg-[var(--mist)] text-[#24252c]/40 cursor-pointer"
              >
                <IconX className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditPayout} className="space-y-3.5 text-xs">
              <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200">
                <div className="font-extrabold text-sm text-blue-950">
                  ₱{editingPayout.amount.toLocaleString()} Disbursed via {editingPayout.payoutMethod}
                </div>
                <div className="text-[11px] text-blue-900 mt-0.5">
                  Recipient: <strong>{editingPayout.payoutAccountName}</strong> ({editingPayout.payoutAccountNumber})
                </div>
                <div className="text-[10px] text-blue-800/70 mt-0.5">
                  Disbursed on: {new Date(editingPayout.processedAt).toLocaleString()}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-[#24252c]/60 block mb-1">
                  Transaction Reference No. *
                </label>
                <input
                  type="text"
                  required
                  value={editTxnRef}
                  onChange={(e) => setEditTxnRef(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#24252c]/15 bg-[var(--mist)] font-mono text-xs focus:outline-none focus:border-blue-600 font-bold"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-[#24252c]/60 block mb-1">
                  Internal Notes / Description
                </label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="e.g. GCash slip attached, verified with partner"
                  className="w-full px-3 py-2 rounded-xl border border-[#24252c]/15 bg-[var(--mist)] text-xs focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase text-[#24252c]/60 block mb-1">
                  Payment Proof / Receipt Slip
                </label>
                <div className="p-3 rounded-xl border border-dashed border-[#24252c]/20 bg-[var(--mist)] space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      id="edit-payout-proof-input"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          setEditProofFile(f);
                          const reader = new FileReader();
                          reader.onload = () => setEditProofPreview(reader.result as string);
                          reader.readAsDataURL(f);
                        }
                      }}
                    />
                    <label
                      htmlFor="edit-payout-proof-input"
                      className="px-3 py-1.5 rounded-lg bg-white border border-[#24252c]/15 text-xs font-bold text-[var(--ink)] hover:bg-black/5 cursor-pointer flex items-center gap-1.5 shadow-2xs"
                    >
                      <IconExternal className="w-3.5 h-3.5" />
                      {editProofPreview ? 'Replace Receipt Slip' : 'Upload Receipt Slip'}
                    </label>

                    {editProofPreview && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setViewingProof({
                              url: editProofPreview!,
                              ref: editTxnRef || editingPayout.transactionReference,
                              partnerName: editingPayout.payoutAccountName,
                              amount: editingPayout.amount,
                              notes: editNotes,
                            })
                          }
                          className="px-2 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <IconEye className="w-3.5 h-3.5" />
                          View Slip
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditProofFile(null);
                            setEditProofPreview(null);
                          }}
                          className="text-rose-600 hover:text-rose-800 text-[10px] font-bold cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>

                  {editProofPreview && (
                    <div className="pt-2 border-t border-[#24252c]/10 flex items-center gap-3">
                      <img
                        src={editProofPreview}
                        alt="Proof Preview"
                        className="w-14 h-14 object-cover rounded-lg border border-blue-200 shadow-2xs cursor-pointer hover:opacity-80"
                        onClick={() =>
                          setViewingProof({
                            url: editProofPreview!,
                            ref: editTxnRef || editingPayout.transactionReference,
                            partnerName: editingPayout.payoutAccountName,
                            amount: editingPayout.amount,
                            notes: editNotes,
                          })
                        }
                      />
                      <span className="text-[10px] text-[#24252c]/60">
                        {editProofFile ? 'New file selected (will upload on save)' : 'Existing attached receipt'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-[#24252c]/10">
                <button
                  type="button"
                  onClick={() => setEditingPayout(null)}
                  className="px-4 py-2 bg-[var(--mist)] text-[var(--ink)] text-xs font-semibold rounded-xl hover:bg-black/5 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEditPayout}
                  className="px-5 py-2 bg-[#1090F8] text-white text-xs font-extrabold rounded-xl hover:bg-[#0c78d0] transition-colors cursor-pointer shadow-md disabled:opacity-50"
                >
                  {savingEditPayout ? 'Saving Changes...' : 'Save Disbursement Changes'}
                </button>
              </div>
            </form>
          </div>
        )}
      </ModalOverlay>

      {/* ── MODAL 5: Enlarged QR Code Lightbox Modal ── */}
      <ModalOverlay isOpen={Boolean(enlargedQr)} onClose={() => setEnlargedQr(null)}>
        {enlargedQr && (
          <div className="bg-white rounded-[2rem] p-6 max-w-sm w-full shadow-2xl border border-[#24252c]/10 relative text-center space-y-4 animate-scale-in">
            <button
              type="button"
              onClick={() => setEnlargedQr(null)}
              className="absolute top-4 right-4 p-1 rounded-full hover:bg-[var(--mist)] text-[#24252c]/40 cursor-pointer"
            >
              <IconX className="w-5 h-5" />
            </button>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                InstaPay / GCash QR
              </span>
              <h3 className="text-base font-extrabold text-[var(--ink)] mt-2">
                {enlargedQr.title}
              </h3>
              {enlargedQr.subtitle && (
                <p className="text-xs text-[#24252c]/60 mt-0.5 font-medium">
                  {enlargedQr.subtitle}
                </p>
              )}
            </div>

            <div className="p-3 bg-gradient-to-b from-amber-50 to-white rounded-2xl border-2 border-amber-300 shadow-inner inline-block">
              <img
                src={enlargedQr.url}
                alt="Enlarged QR Code"
                className="w-64 h-64 sm:w-72 sm:h-72 object-contain rounded-xl bg-white p-2"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <a
                href={enlargedQr.url}
                download={`QR-${enlargedQr.title.replace(/\s+/g, '_')}.png`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-2.5 rounded-xl bg-[var(--mist)] text-[var(--ink)] text-xs font-bold hover:bg-black/5 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <IconExternal className="w-3.5 h-3.5" />
                Open / Save Image
              </a>
              <button
                type="button"
                onClick={() => setEnlargedQr(null)}
                className="flex-1 py-2.5 rounded-xl bg-[var(--ink)] text-white text-xs font-bold hover:bg-black/80 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </ModalOverlay>

      {/* ── MODAL 6: Payment Proof Slip Lightbox Modal ── */}
      <ModalOverlay isOpen={Boolean(viewingProof)} onClose={() => setViewingProof(null)}>
        {viewingProof && (
          <div className="bg-white rounded-[2rem] p-6 max-w-lg w-full shadow-2xl border border-[#24252c]/10 relative space-y-4 max-h-[92vh] overflow-y-auto animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-[#24252c]/10">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    Disbursement Proof Slip
                  </span>
                </div>
                <h3 className="text-base font-extrabold text-[var(--ink)] mt-1">
                  Ref: {viewingProof.ref}
                </h3>
                {viewingProof.partnerName && (
                  <p className="text-xs text-[#24252c]/60">
                    Recipient: {viewingProof.partnerName} {viewingProof.amount ? `· ₱${viewingProof.amount.toLocaleString()}` : ''}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setViewingProof(null)}
                className="p-1 rounded-full hover:bg-[var(--mist)] text-[#24252c]/40 cursor-pointer"
              >
                <IconX className="w-5 h-5" />
              </button>
            </div>

            <div className="p-2 bg-slate-900 rounded-2xl flex items-center justify-center overflow-hidden shadow-inner min-h-[220px]">
              <img
                src={viewingProof.url}
                alt="Disbursement Proof Slip"
                className="max-h-[60vh] max-w-full object-contain rounded-lg"
              />
            </div>

            {viewingProof.notes && (
              <div className="p-3 bg-[var(--mist)] rounded-xl text-xs text-[#24252c]/70">
                <strong>Notes:</strong> {viewingProof.notes}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <a
                href={viewingProof.url}
                download={`Proof-${viewingProof.ref}.png`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-2.5 rounded-xl bg-[var(--mist)] text-[var(--ink)] text-xs font-bold hover:bg-black/5 cursor-pointer flex items-center justify-center gap-1.5"
              >
                <IconExternal className="w-3.5 h-3.5" />
                Open Full Resolution
              </a>
              <button
                type="button"
                onClick={() => setViewingProof(null)}
                className="flex-1 py-2.5 rounded-xl bg-[var(--ink)] text-white text-xs font-bold hover:bg-black/80 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </ModalOverlay>

      {/* ── MODAL 7: Deactivate Partner Confirmation Modal ── */}
      <ModalOverlay isOpen={Boolean(partnerToDeactivate)} onClose={() => setPartnerToDeactivate(null)}>
        {partnerToDeactivate && (
          <div className="bg-white rounded-[2rem] p-6 max-w-md w-full shadow-2xl border border-[#24252c]/10 relative text-center space-y-4 animate-scale-in">
            <button
              type="button"
              onClick={() => setPartnerToDeactivate(null)}
              className="absolute top-4 right-4 p-1 rounded-full hover:bg-[var(--mist)] text-[#24252c]/40 cursor-pointer"
            >
              <IconX className="w-5 h-5" />
            </button>

            <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200 shadow-xs">
              <IconAlertTriangle className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-lg font-extrabold text-[var(--ink)]">Deactivate Partner Account?</h3>
              <p className="text-xs text-[#24252c]/60 mt-1.5 leading-relaxed">
                All commissions for <strong>{partnerToDeactivate.partnerName}</strong> are settled (₱0 pending balance).
              </p>
              <p className="text-xs text-[#24252c]/70 mt-1">
                Deactivating will disable referral promo code <strong className="font-mono text-[#1090F8]">{partnerToDeactivate.referralCode}</strong> from client checkout.
              </p>
              <p className="text-[11px] text-[#24252c]/50 mt-2 bg-amber-50 border border-amber-200 p-2 rounded-xl text-amber-900">
                To re-enable this coordinator profile in the future, they must apply or register again.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPartnerToDeactivate(null)}
                className="flex-1 py-3 rounded-xl bg-[var(--mist)] text-[var(--ink)] text-xs font-semibold hover:bg-black/5 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deactivating}
                onClick={handleConfirmDeactivation}
                className="flex-1 py-3 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-colors shadow-md cursor-pointer disabled:opacity-50"
              >
                {deactivating ? 'Deactivating...' : 'Confirm Deactivation'}
              </button>
            </div>
          </div>
        )}
      </ModalOverlay>

      {/* ── MODAL 8: Reject Partner Application Modal ── */}
      <ModalOverlay isOpen={Boolean(partnerToReject)} onClose={() => setPartnerToReject(null)}>
        {partnerToReject && (
          <div className="bg-white rounded-[2rem] p-6 max-w-md w-full shadow-2xl border border-[#24252c]/10 relative space-y-4 animate-scale-in">
            <button
              type="button"
              onClick={() => setPartnerToReject(null)}
              className="absolute top-4 right-4 p-1 rounded-full hover:bg-[var(--mist)] text-[#24252c]/40 cursor-pointer"
            >
              <IconX className="w-5 h-5" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200">
              <IconAlertTriangle className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-extrabold text-[var(--ink)]">Reject &amp; Delete Application</h3>
              <p className="text-xs text-[#24252c]/60 mt-1">
                Declining the application for <strong>{partnerToReject.partnerName}</strong> ({partnerToReject.email}) will <strong className="text-rose-700">permanently delete</strong> the record. A rejection email with your reason will be sent first.
              </p>
              <p className="text-[11px] bg-rose-50 border border-rose-200 text-rose-800 p-2 rounded-xl mt-2">
                This cannot be undone. The applicant can re-apply using a different email.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-[var(--ink)] block">
                Reason / Note for Applicant
              </label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explain why this application was not approved..."
                className="w-full p-3 rounded-xl border border-[#24252c]/10 bg-[var(--mist)] text-xs text-[var(--ink)] focus:outline-none focus:border-rose-500"
              />
              <p className="text-[10px] text-[#24252c]/50">
                This message will be included directly in the formal rejection email.
              </p>
            </div>

            <div className="flex gap-2 pt-2 border-t border-[#24252c]/10">
              <button
                type="button"
                onClick={() => setPartnerToReject(null)}
                className="flex-1 py-2.5 rounded-xl bg-[var(--mist)] text-[var(--ink)] text-xs font-semibold hover:bg-black/5 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={Boolean(rejectingPartnerId)}
                onClick={handleConfirmReject}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-colors shadow-md cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {rejectingPartnerId ? (
                  <>
                    <span className="animate-spin text-xs">↻</span>
                    <span>Rejecting &amp; Deleting...</span>
                  </>
                ) : (
                  'Reject &amp; Delete Permanently'
                )}
              </button>
            </div>
          </div>
        )}
      </ModalOverlay>

      {/* ── MODAL 9: Delete Single Partner Account Modal ── */}
      <ModalOverlay isOpen={Boolean(partnerToDelete)} onClose={() => setPartnerToDelete(null)}>
        {partnerToDelete && (
          <div className="bg-white rounded-[2rem] p-6 max-w-md w-full shadow-2xl border border-[#24252c]/10 relative text-center space-y-4 animate-scale-in">
            <button
              type="button"
              onClick={() => setPartnerToDelete(null)}
              className="absolute top-4 right-4 p-1 rounded-full hover:bg-[var(--mist)] text-[#24252c]/40 cursor-pointer"
            >
              <IconX className="w-5 h-5" />
            </button>

            <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto border border-rose-300 shadow-xs">
              <IconAlertTriangle className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-lg font-extrabold text-[var(--ink)]">Delete Partner Account?</h3>
              <p className="text-xs text-[#24252c]/60 mt-1.5 leading-relaxed">
                Are you sure you want to permanently delete <strong>{partnerToDelete.partnerName}</strong> ({partnerToDelete.referralCode})?
              </p>
              <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 p-2.5 rounded-xl mt-2 font-medium">
                This will permanently remove the partner account and all its associated commission referral records and payout logs from the system and database.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPartnerToDelete(null)}
                className="flex-1 py-3 rounded-xl bg-[var(--mist)] text-[var(--ink)] text-xs font-semibold hover:bg-black/5 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingPartner}
                onClick={handleConfirmDeletePartner}
                className="flex-1 py-3 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-colors shadow-md cursor-pointer disabled:opacity-50"
              >
                {deletingPartner ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        )}
      </ModalOverlay>

      {/* ── MODAL 10: Clear All Partner Accounts Modal ── */}
      <ModalOverlay isOpen={showClearAllModal} onClose={() => setShowClearAllModal(false)}>
        <div className="bg-white rounded-[2rem] p-6 max-w-md w-full shadow-2xl border border-[#24252c]/10 relative text-center space-y-4 animate-scale-in">
          <button
            type="button"
            onClick={() => setShowClearAllModal(false)}
            className="absolute top-4 right-4 p-1 rounded-full hover:bg-[var(--mist)] text-[#24252c]/40 cursor-pointer"
          >
            <IconX className="w-5 h-5" />
          </button>

          <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto border border-rose-300 shadow-xs">
            <IconAlertTriangle className="w-7 h-7" />
          </div>

          <div>
            <h3 className="text-lg font-extrabold text-[var(--ink)]">Clear All Partner Accounts?</h3>
            <p className="text-xs text-[#24252c]/60 mt-1.5 leading-relaxed">
              This action will delete <strong>ALL</strong> settled affiliate partner accounts ({affiliates.filter(a => a.status !== 'pending_approval').length}), referral booking records ({referrals.length}), and payout logs ({payouts.length}) from both the Supabase cloud database and local cache.
            </p>
            {pendingApprovals.length > 0 ? (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-left">
                <p className="text-xs font-bold text-amber-800">
                  {pendingApprovals.length} pending application{pendingApprovals.length > 1 ? 's' : ''} must be approved or rejected first.
                </p>
                <p className="text-[11px] text-amber-700 mt-0.5">
                  You cannot clear all accounts while there are unreviewed applications. Go to the Pending Approvals tab to review them.
                </p>
              </div>
            ) : (
              <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 p-2.5 rounded-xl mt-2 font-semibold">
                This action cannot be undone. All settled accounts will be completely wiped.
              </p>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowClearAllModal(false)}
              className="flex-1 py-3 rounded-xl bg-[var(--mist)] text-[var(--ink)] text-xs font-semibold hover:bg-black/5 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={clearingAll || pendingApprovals.length > 0}
              onClick={handleConfirmClearAll}
              className="flex-1 py-3 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-colors shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title={pendingApprovals.length > 0 ? `${pendingApprovals.length} pending application(s) must be resolved first` : ''}
            >
              {clearingAll ? 'Clearing All...' : pendingApprovals.length > 0 ? `${pendingApprovals.length} Pending — Resolve First` : 'Confirm Clear All'}
            </button>
          </div>
        </div>
      </ModalOverlay>
    </div>
  );
}

