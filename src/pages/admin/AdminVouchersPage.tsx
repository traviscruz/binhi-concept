import { useState, useEffect, useMemo, useRef } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import {
  IconTicket,
  IconPlus,
  IconX,
  IconTrash,
  IconSearch,
  IconCheck,
  IconShield,
} from '../../components/shared/icons';
import { ModalOverlay } from '../../components/shared/ModalOverlay';
import { EmptyState } from '../../components/shared/EmptyState';
import {
  fetchAllVouchers,
  saveVoucher,
  deleteVoucher,
  toggleVoucherBanner,
  getVoucherStatusInfo,
  sortVouchersDeterministically,
  type Voucher,
} from '../../utils/voucherService';
import { logAuditEvent } from '../../utils/auditLogger';

const inputClass =
  'w-full rounded-full border px-4 py-2.5 text-xs bg-[#EEEEEE] text-[var(--ink)] placeholder:text-[#24252c]/40 focus:outline-none focus:border-[#1090F8] border-transparent transition-colors font-medium';

export default function AdminVouchersPage({ go: _go }: { go: (p: Page) => void }) {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'active' | 'banner' | 'expired'>('all');

  // Modal States
  const [showModal, setShowModal] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState<Voucher | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Form Field States
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState<string>('10');
  const [isUnlimitedUses, setIsUnlimitedUses] = useState(false);
  const [maxUses, setMaxUses] = useState<string>('50');
  const [isAllTime, setIsAllTime] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showInBanner, setShowInBanner] = useState(true);
  const [status, setStatus] = useState<'active' | 'inactive'>('active');

  // Delete State
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const activeTogglesRef = useRef<Set<string>>(new Set());

  // Load vouchers
  const loadData = async (showSpinner = false) => {
    if (showSpinner) {
      setLoading(true);
    }
    try {
      const data = await fetchAllVouchers();
      // Ensure any currently in-flight toggle is preserved
      setVouchers((prev) => {
        if (activeTogglesRef.current.size === 0) return data;
        return data.map((item) => {
          if (activeTogglesRef.current.has(item.id)) {
            const existing = prev.find((p) => p.id === item.id);
            if (existing) {
              return { ...item, show_in_banner: existing.show_in_banner };
            }
          }
          return item;
        });
      });
    } catch (err) {
      console.error('Error loading vouchers in admin:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(true);

    const handleUpdate = () => {
      loadData(false);
    };
    window.addEventListener('vouchers-updated', handleUpdate);
    return () => window.removeEventListener('vouchers-updated', handleUpdate);
  }, []);

  // Quick banner toggle handler - instantaneous and completely glitch-free
  const handleToggleBanner = async (id: string, currentValue: boolean) => {
    const nextVal = !currentValue;
    activeTogglesRef.current.add(id);

    // Instant optimistic UI update
    setVouchers((prev) =>
      prev.map((v) => (v.id === id ? { ...v, show_in_banner: nextVal } : v))
    );

    try {
      await toggleVoucherBanner(id, nextVal);
      const target = vouchers.find((v) => v.id === id);
      await logAuditEvent({
        action: 'TOGGLE_VOUCHER_BANNER',
        module: 'vouchers',
        targetId: target?.code || id,
        targetName: target?.code || id,
        details: `Toggled voucher "${target?.code || id}" marquee banner visibility to ${nextVal ? 'Visible' : 'Hidden'}`,
        previousData: { show_in_banner: currentValue },
        currentData: { show_in_banner: nextVal },
      });
    } catch (err) {
      console.error('Error toggling banner display:', err);
      // Revert if error
      setVouchers((prev) =>
        prev.map((v) => (v.id === id ? { ...v, show_in_banner: currentValue } : v))
      );
    } finally {
      setTimeout(() => {
        activeTogglesRef.current.delete(id);
      }, 1500);
    }
  };

  // Open Create Modal
  const openCreateModal = () => {
    setEditingVoucher(null);
    setCode('');
    setDescription('');
    setDiscountType('percentage');
    setDiscountValue('10');
    setIsUnlimitedUses(false);
    setMaxUses('50');
    setIsAllTime(true);
    setStartDate('');
    setEndDate('');
    setShowInBanner(true);
    setStatus('active');
    setFormError('');
    setShowModal(true);
  };

  // Open Edit Modal
  const openEditModal = (v: Voucher) => {
    setEditingVoucher(v);
    setCode(v.code);
    setDescription(v.description);
    setDiscountType(v.discount_type);
    setDiscountValue(String(v.discount_value));
    setIsUnlimitedUses(v.max_uses === null || v.max_uses === undefined || v.max_uses === 0);
    setMaxUses(v.max_uses ? String(v.max_uses) : '50');
    setIsAllTime(v.is_all_time);
    setStartDate(v.start_date || '');
    setEndDate(v.end_date || '');
    setShowInBanner(v.show_in_banner);
    setStatus(v.status);
    setFormError('');
    setShowModal(true);
  };

  // Form Submit (Create / Edit)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const cleanCode = code.trim().toUpperCase();
    if (!cleanCode) {
      setFormError('Please enter a voucher code.');
      return;
    }

    const val = Number(discountValue);
    if (isNaN(val) || val <= 0) {
      setFormError('Discount value must be greater than zero.');
      return;
    }

    if (discountType === 'percentage' && val > 100) {
      setFormError('Percentage discount cannot exceed 100%.');
      return;
    }

    if (!isAllTime) {
      if (!startDate || !endDate) {
        setFormError('Please choose both a start date and end date for validity.');
        return;
      }
      if (startDate > endDate) {
        setFormError('End date must be on or after the start date.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await saveVoucher({
        id: editingVoucher?.id,
        code: cleanCode,
        description: description.trim(),
        discount_type: discountType,
        discount_value: val,
        max_uses: isUnlimitedUses ? null : Math.max(1, Number(maxUses) || 1),
        used_count: editingVoucher ? editingVoucher.used_count : 0,
        is_all_time: isAllTime,
        start_date: isAllTime ? null : startDate,
        end_date: isAllTime ? null : endDate,
        status,
        show_in_banner: showInBanner,
      });

      if (editingVoucher) {
        await logAuditEvent({
          action: 'UPDATE_VOUCHER',
          module: 'vouchers',
          targetId: code.trim().toUpperCase(),
          targetName: code.trim().toUpperCase(),
          details: `Updated voucher "${code.trim().toUpperCase()}" (${discountType === 'percentage' ? `${val}%` : `₱${val}`} off)`,
          previousData: {
            code: editingVoucher.code,
            discount_type: editingVoucher.discount_type,
            discount_value: editingVoucher.discount_value,
            max_uses: editingVoucher.max_uses,
            status: editingVoucher.status,
          },
          currentData: {
            code: code.trim().toUpperCase(),
            discount_type: discountType,
            discount_value: val,
            max_uses: isUnlimitedUses ? 'Unlimited' : Number(maxUses),
            status,
          },
        });
      } else {
        await logAuditEvent({
          action: 'CREATE_VOUCHER',
          module: 'vouchers',
          targetId: code.trim().toUpperCase(),
          targetName: code.trim().toUpperCase(),
          details: `Created new promo voucher "${code.trim().toUpperCase()}" (${discountType === 'percentage' ? `${val}%` : `₱${val}`} off, Status: ${status})`,
          currentData: {
            code: code.trim().toUpperCase(),
            discount_type: discountType,
            discount_value: val,
            max_uses: isUnlimitedUses ? 'Unlimited' : Number(maxUses),
            status,
          },
        });
      }

      setShowModal(false);
      loadData();
    } catch (err: any) {
      console.error('Error saving voucher:', err);
      setFormError(err?.message || 'Failed to save voucher. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete handler
  const handleDelete = async () => {
    if (!deletingId) return;
    const target = vouchers.find((v) => v.id === deletingId);
    try {
      await deleteVoucher(deletingId);

      await logAuditEvent({
        action: 'DELETE_VOUCHER',
        module: 'vouchers',
        targetId: target?.code || deletingId,
        targetName: target?.code || deletingId,
        details: `Deleted promo voucher "${target?.code || deletingId}"`,
        previousData: target
          ? {
              code: target.code,
              discount_type: target.discount_type,
              discount_value: target.discount_value,
              status: target.status,
            }
          : null,
      });

      setDeletingId(null);
      loadData();
    } catch (err) {
      console.error('Error deleting voucher:', err);
    }
  };

  // Quick Copy
  const handleCopy = (codeText: string) => {
    navigator.clipboard.writeText(codeText);
    setCopiedCode(codeText);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Quick Toggle Active Status
  const handleToggleStatus = async (v: Voucher) => {
    const nextStatus = v.status === 'active' ? 'inactive' : 'active';
    try {
      await saveVoucher({
        ...v,
        status: nextStatus,
      });

      await logAuditEvent({
        action: 'UPDATE_VOUCHER',
        module: 'vouchers',
        targetId: v.code,
        targetName: v.code,
        details: `Toggled voucher "${v.code}" status to ${nextStatus}`,
        previousData: { status: v.status },
        currentData: { status: nextStatus },
      });

      loadData();
    } catch (err) {
      console.error('Error toggling voucher status:', err);
    }
  };

  // Filtered Vouchers (Fixed, deterministic row position)
  const filteredVouchers = useMemo(() => {
    const matched = vouchers.filter((v) => {
      const matchSearch =
        v.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.description.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchSearch) return false;

      const statusInfo = getVoucherStatusInfo(v);

      if (filterTab === 'active') {
        return statusInfo.isUsable;
      }
      if (filterTab === 'banner') {
        return v.show_in_banner;
      }
      if (filterTab === 'expired') {
        return !statusInfo.isUsable;
      }

      return true;
    });

    return sortVouchersDeterministically(matched);
  }, [vouchers, searchQuery, filterTab]);

  // Summary Metrics
  const stats = useMemo(() => {
    const total = vouchers.length;
    const bannerCount = vouchers.filter((v) => v.show_in_banner && getVoucherStatusInfo(v).isUsable).length;
    const totalRedemptions = vouchers.reduce((sum, v) => sum + (v.used_count || 0), 0);
    const usableCount = vouchers.filter((v) => getVoucherStatusInfo(v).isUsable).length;

    return { total, bannerCount, totalRedemptions, usableCount };
  }, [vouchers]);

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#24252c]/[0.06]">
        <div>
          <MonoBadge icon={IconTicket}>Promotional Voucher Engine</MonoBadge>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ink)] mt-1.5">
            Voucher Codes & Marquee Banners
          </h1>
          <p className="text-xs text-[#24252c]/60 mt-1">
            Configure checkout discount vouchers with 1 checkout = 1 usage limits, validity date ranges, and toggle
            customer-facing header scrolling marquee announcements.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="bg-[#1090F8] hover:bg-[#1090F8]/90 text-white text-xs font-bold px-5 py-2.5 rounded-full transition-colors shrink-0 self-start sm:self-auto cursor-pointer inline-flex items-center gap-2 shadow-sm"
        >
          <IconPlus className="w-3.5 h-3.5" />
          <span>Create New Voucher</span>
        </button>
      </div>

      {/* ── KPI Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4.5 rounded-3xl bg-white border border-[#24252c]/[0.08] shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#24252c]/50 block">Total Vouchers</span>
          <span className="text-2xl font-black text-[var(--ink)] mt-1 block">{stats.total}</span>
          <span className="text-[10px] text-[#24252c]/50 mt-0.5 block">Configured voucher codes</span>
        </div>

        <div className="p-4.5 rounded-3xl bg-white border border-[#24252c]/[0.08] shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#1090F8] block">Header Marquee Active</span>
          <span className="text-2xl font-black text-[#1090F8] mt-1 block">{stats.bannerCount}</span>
          <span className="text-[10px] text-[#24252c]/50 mt-0.5 block">Live in scrolling banner</span>
        </div>

        <div className="p-4.5 rounded-3xl bg-white border border-[#24252c]/[0.08] shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 block">Total Redemptions</span>
          <span className="text-2xl font-black text-emerald-600 mt-1 block">{stats.totalRedemptions}</span>
          <span className="text-[10px] text-[#24252c]/50 mt-0.5 block">Checkouts using vouchers</span>
        </div>

        <div className="p-4.5 rounded-3xl bg-white border border-[#24252c]/[0.08] shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#24252c]/50 block">Valid & Available</span>
          <span className="text-2xl font-black text-[var(--ink)] mt-1 block">{stats.usableCount}</span>
          <span className="text-[10px] text-[#24252c]/50 mt-0.5 block">Usable at checkout now</span>
        </div>
      </div>

      {/* ── Filter & Search Toolbar ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-full bg-[var(--mist)] border border-[#24252c]/[0.08] self-start">
          {[
            { id: 'all', label: 'All Vouchers' },
            { id: 'active', label: 'Active & Usable' },
            { id: 'banner', label: 'Marquee Banner' },
            { id: 'expired', label: 'Expired / Depleted' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterTab(tab.id as any)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                filterTab === tab.id
                  ? 'bg-white text-[var(--ink)] shadow-xs'
                  : 'text-[#24252c]/60 hover:text-[var(--ink)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-72">
          <IconSearch className="w-3.5 h-3.5 text-[#24252c]/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search code or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-full text-xs bg-white border border-[#24252c]/15 focus:outline-none focus:border-[#1090F8] text-[var(--ink)]"
          />
        </div>
      </div>

      {/* ── Vouchers Table ── */}
      <div className="bg-white rounded-[2rem] border border-[#24252c]/[0.08] shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-20 text-center">
            <span className="w-6 h-6 border-2 border-[#1090F8] border-t-transparent rounded-full animate-spin inline-block mb-2" />
            <p className="text-xs text-[#24252c]/60 font-medium">Loading promotional vouchers...</p>
          </div>
        ) : filteredVouchers.length === 0 ? (
          <div className="py-14 flex flex-col items-center">
            <EmptyState
              title="No Vouchers Found"
              description={
                searchQuery
                  ? `No vouchers match "${searchQuery}". Try clearing your search query.`
                  : 'Create your first promotional voucher code to offer booking discounts.'
              }
            />
            <button
              type="button"
              onClick={searchQuery ? () => setSearchQuery('') : openCreateModal}
              className="mt-2 text-xs font-semibold px-4 py-2 rounded-full bg-[var(--ink)] text-white hover:bg-[var(--ink-soft)] transition-colors cursor-pointer"
            >
              {searchQuery ? 'Clear Search' : '+ Create Voucher'}
            </button>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#24252c]/[0.06] bg-[var(--mist)]/40 text-[10px] uppercase font-bold tracking-wider text-[#24252c]/50">
                    <th className="py-4 px-6">Voucher Code</th>
                    <th className="py-4 px-6">Discount</th>
                    <th className="py-4 px-6">Usage Cap (1 Use = 1 Checkout)</th>
                    <th className="py-4 px-6">Validity Window</th>
                    <th className="py-4 px-6">Marquee Banner</th>
                    <th className="py-4 px-6">Status</th>
                    <th className="py-4 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#24252c]/[0.05]">
                  {filteredVouchers.map((v) => {
                    const statusInfo = getVoucherStatusInfo(v);
                    const isUnlimited = v.max_uses === null || v.max_uses === undefined || v.max_uses === 0;
                    const usagePercent = isUnlimited
                      ? 0
                      : Math.min(100, Math.round((v.used_count / (v.max_uses || 1)) * 100));

                    const isCopied = copiedCode === v.code;

                    return (
                      <tr key={v.id} className="hover:bg-[var(--mist)]/30 transition-colors">
                        {/* Code */}
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleCopy(v.code)}
                              title="Click to copy code"
                              className="px-3 py-1 rounded-full bg-[var(--mist)] hover:bg-[#1090F8]/10 text-[var(--ink)] hover:text-[#1090F8] font-bold text-xs tracking-wider border border-[#24252c]/10 transition-colors cursor-pointer inline-flex items-center gap-1.5"
                            >
                              <span>{v.code}</span>
                              {isCopied ? (
                                <IconCheck className="w-3 h-3 text-emerald-600 stroke-[3]" />
                              ) : (
                                <span className="text-[10px] text-[#24252c]/40">⧉</span>
                              )}
                            </button>
                          </div>
                          {v.description && (
                            <p className="text-[11px] text-[#24252c]/60 mt-1 max-w-xs truncate">
                              {v.description}
                            </p>
                          )}
                        </td>

                        {/* Discount */}
                        <td className="py-4 px-6 font-bold">
                          <span className="text-sm font-black text-[var(--ink)] block">
                            {v.discount_type === 'percentage'
                              ? `${v.discount_value}% OFF`
                              : `₱${v.discount_value.toLocaleString()} OFF`}
                          </span>
                          <span className="text-[10px] text-[#24252c]/50 font-normal">
                            {v.discount_type === 'percentage' ? 'Percentage Deduction' : 'Fixed Amount Deduction'}
                          </span>
                        </td>

                        {/* Usage Limit & Progress */}
                        <td className="py-4 px-6">
                          {isUnlimited ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              Unlimited ({v.used_count} redemptions)
                            </span>
                          ) : (
                            <div className="space-y-1 w-36">
                              <div className="flex justify-between text-[11px] font-semibold text-[#24252c]/75">
                                <span>{v.used_count} / {v.max_uses} used</span>
                                <span className="text-[10px] font-semibold">{usagePercent}%</span>
                              </div>
                              <div className="w-full h-1.5 rounded-full bg-black/10 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${
                                    v.used_count >= (v.max_uses || 0)
                                      ? 'bg-rose-500'
                                      : usagePercent > 75
                                      ? 'bg-amber-500'
                                      : 'bg-[#1090F8]'
                                  }`}
                                  style={{ width: `${usagePercent}%` }}
                                />
                              </div>
                              {v.used_count >= (v.max_uses || 0) && (
                                <span className="text-[9px] font-bold text-rose-600 block">
                                  Limit reached (1 checkout = 1 usage)
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Validity Period */}
                        <td className="py-4 px-6">
                          {v.is_all_time ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                              <span>●</span> All Time (No Expiry)
                            </span>
                          ) : (
                            <div className="space-y-0.5">
                              <span className="font-semibold text-[var(--ink)] block">
                                {v.start_date
                                  ? new Date(v.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                  : 'Start'}{' '}
                                –{' '}
                                {v.end_date
                                  ? new Date(v.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                  : 'End'}
                              </span>
                              <span className="text-[10px] text-[#24252c]/50 block">
                                {statusInfo.label === 'Expired'
                                  ? 'Expired period'
                                  : statusInfo.label === 'Upcoming'
                                  ? 'Scheduled future release'
                                  : 'Active validity window'}
                              </span>
                            </div>
                          )}
                        </td>

                        {/* Marquee Banner Toggle */}
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleToggleBanner(v.id, v.show_in_banner)}
                              aria-label="Toggle scrolling marquee banner display"
                              className={`w-11 h-6 rounded-full p-0.5 transition-colors cursor-pointer relative flex items-center ${
                                v.show_in_banner ? 'bg-[#1090F8]' : 'bg-[#24252c]/20'
                              }`}
                            >
                              <div
                                className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                                  v.show_in_banner ? 'translate-x-5' : 'translate-x-0'
                                }`}
                              />
                            </button>
                            <span
                              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                                v.show_in_banner
                                  ? 'bg-[#1090F8]/10 text-[#1090F8]'
                                  : 'bg-[var(--mist)] text-[#24252c]/50'
                              }`}
                            >
                              {v.show_in_banner ? 'In Banner' : 'Hidden'}
                            </span>
                          </div>
                          <span className="text-[9px] text-[#24252c]/40 block mt-0.5">
                            {v.show_in_banner ? 'Displayed in top header marquee' : 'Usable via code input only'}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-4 px-6">
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${statusInfo.color}`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            {statusInfo.label}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-6 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(v)}
                              title={v.status === 'active' ? 'Deactivate Voucher' : 'Activate Voucher'}
                              className="px-3 py-1 rounded-full text-[#24252c]/70 hover:text-[var(--ink)] bg-[var(--mist)] hover:bg-gray-200 transition-colors cursor-pointer text-xs font-semibold"
                            >
                              {v.status === 'active' ? 'Disable' : 'Enable'}
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditModal(v)}
                              className="px-3 py-1 rounded-full text-[#1090F8] bg-[#1090F8]/10 hover:bg-[#1090F8]/20 transition-colors cursor-pointer text-xs font-semibold"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingId(v.id)}
                              className="p-1.5 rounded-full text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            >
                              <IconTrash className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View - Bookings Manager Style */}
            <div className="block sm:hidden divide-y divide-[#24252c]/[0.06] p-2">
              {filteredVouchers.map((v) => {
                const statusInfo = getVoucherStatusInfo(v);
                const isUnlimited = v.max_uses === null || v.max_uses === undefined || v.max_uses === 0;

                return (
                  <div key={v.id} className="p-4 space-y-3 rounded-2xl hover:bg-[var(--mist)]/40 transition-colors">
                    {/* Top: Code + Status Pill */}
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <button
                          type="button"
                          onClick={() => handleCopy(v.code)}
                          className="px-3 py-1 rounded-full bg-[var(--mist)] text-[var(--ink)] font-bold text-xs border border-[#24252c]/10 inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>{v.code}</span>
                          {copiedCode === v.code ? (
                            <IconCheck className="w-3 h-3 text-emerald-600 stroke-[3]" />
                          ) : (
                            <span className="text-[10px] text-[#24252c]/40">⧉</span>
                          )}
                        </button>
                        <h4 className="font-black text-base text-[var(--ink)] mt-1.5">
                          {v.discount_type === 'percentage'
                            ? `${v.discount_value}% OFF`
                            : `₱${v.discount_value.toLocaleString()} OFF`}
                        </h4>
                        {v.description && (
                          <div className="text-[11px] text-[#24252c]/65 mt-0.5">{v.description}</div>
                        )}
                      </div>
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border shrink-0 ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    </div>

                    {/* Metadata Box */}
                    <div className="text-xs space-y-1.5 py-2.5 px-3 rounded-xl bg-[var(--mist)]/70 text-[#24252c]/75">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-[#24252c]/50 text-[10px] uppercase font-semibold">Usage Cap</span>
                        <span className="font-semibold text-[var(--ink)]">
                          {isUnlimited ? 'Unlimited' : `${v.used_count} / ${v.max_uses} used`}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-[#24252c]/50 text-[10px] uppercase font-semibold">Validity</span>
                        <span className="font-semibold text-[var(--ink)]">
                          {v.is_all_time ? 'All Time (No Expiry)' : `${v.start_date || 'Start'} – ${v.end_date || 'End'}`}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[11px] pt-1 border-t border-[#24252c]/[0.06]">
                        <span className="text-[#24252c]/50 text-[10px] uppercase font-semibold">Header Marquee</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleBanner(v.id, v.show_in_banner)}
                            className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer relative flex items-center ${
                              v.show_in_banner ? 'bg-[#1090F8]' : 'bg-[#24252c]/20'
                            }`}
                          >
                            <div
                              className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                                v.show_in_banner ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                          <span className="text-[10px] font-bold text-[#1090F8]">
                            {v.show_in_banner ? 'Visible' : 'Hidden'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => openEditModal(v)}
                        className="flex-1 py-1.5 rounded-full bg-[#1090F8]/10 text-[#1090F8] text-xs font-semibold text-center cursor-pointer hover:bg-[#1090F8]/20 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(v)}
                        className="flex-1 py-1.5 rounded-full bg-[var(--mist)] text-[var(--ink)] text-xs font-semibold text-center cursor-pointer hover:bg-gray-200 transition-colors"
                      >
                        {v.status === 'active' ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingId(v.id)}
                        className="p-1.5 rounded-full text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
                      >
                        <IconTrash className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Create / Edit Voucher Modal ── */}
      <ModalOverlay isOpen={showModal} onClose={() => !isSubmitting && setShowModal(false)}>
        <div className="bg-white rounded-[2.5rem] max-w-xl w-full max-h-[88vh] shadow-2xl border border-[#24252c]/10 relative flex flex-col overflow-hidden animate-blur-in">
          <button
            type="button"
            onClick={() => setShowModal(false)}
            disabled={isSubmitting}
            className="absolute top-6 right-6 z-20 text-[#24252c]/50 hover:text-[var(--ink)] p-1.5 rounded-full hover:bg-[var(--mist)] transition-colors bg-white/90 backdrop-blur-md shadow-xs border border-[#24252c]/10 cursor-pointer"
          >
            <IconX className="w-5 h-5" />
          </button>

          {/* Modal Header */}
          <div className="p-6 sm:p-8 pb-3 shrink-0">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-full bg-[#1090F8]/10 text-[#1090F8] flex items-center justify-center font-bold shrink-0">
                <IconTicket className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-[#1090F8] uppercase tracking-wider block">
                  {editingVoucher ? `Editing: ${editingVoucher.code}` : 'New Voucher Promotion'}
                </span>
                <h2 className="text-xl sm:text-2xl font-extrabold text-[var(--ink)] -mt-0.5">
                  {editingVoucher ? 'Edit Voucher Code' : 'Create New Voucher'}
                </h2>
              </div>
            </div>
            <p className="text-xs text-[#24252c]/60 mt-1">
              Configure discount parameters, 1 checkout = 1 usage limits, validity dates, and header marquee banner.
            </p>
          </div>

          {/* Scrollable Form Body without scrollbar */}
          <div className="flex-1 overflow-y-auto px-6 sm:px-8 py-3 space-y-4 no-scrollbar">
            {formError && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} id="voucher-form" className="space-y-4 text-xs">
              {/* Code & Discount Type */}
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-[#24252c]/70 block mb-1 uppercase tracking-wider text-[10px]">
                    Voucher Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. BINHI2026"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className={`${inputClass} font-bold tracking-wider uppercase`}
                  />
                </div>

                <div>
                  <label className="font-bold text-[#24252c]/70 block mb-1 uppercase tracking-wider text-[10px]">
                    Discount Type *
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 p-1 rounded-full bg-[#EEEEEE]">
                    <button
                      type="button"
                      onClick={() => setDiscountType('percentage')}
                      className={`py-1.5 rounded-full font-bold transition-all text-xs cursor-pointer ${
                        discountType === 'percentage'
                          ? 'bg-white text-[var(--ink)] shadow-xs'
                          : 'text-[#24252c]/50 hover:text-[var(--ink)]'
                      }`}
                    >
                      Percent (%)
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountType('fixed')}
                      className={`py-1.5 rounded-full font-bold transition-all text-xs cursor-pointer ${
                        discountType === 'fixed'
                          ? 'bg-white text-[var(--ink)] shadow-xs'
                          : 'text-[#24252c]/50 hover:text-[var(--ink)]'
                      }`}
                    >
                      Fixed (₱)
                    </button>
                  </div>
                </div>
              </div>

              {/* Discount Value & Status */}
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-[#24252c]/70 block mb-1 uppercase tracking-wider text-[10px]">
                    Discount Value ({discountType === 'percentage' ? '%' : '₱'}) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    max={discountType === 'percentage' ? 100 : undefined}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="font-bold text-[#24252c]/70 block mb-1 uppercase tracking-wider text-[10px]">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className={inputClass}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive (Disabled)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-[#24252c]/70 block mb-1 uppercase tracking-wider text-[10px]">
                  Description / Campaign Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. 10% Off Intimate & Grand Gatherings"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className={inputClass}
                />
              </div>

              {/* Usage Limit Section (1 usage = 1 checkout) */}
              <div className="p-4 rounded-2xl bg-[var(--mist)] border border-[#24252c]/[0.08] space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-[var(--ink)] block">Usage Limit (Checkouts)</span>
                    <span className="text-[10px] text-[#24252c]/60">
                      1 usage = 1 completed checkout. Automatically disabled when limit is reached.
                    </span>
                  </div>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer text-[11px] font-semibold text-[#24252c]/70">
                    <input
                      type="checkbox"
                      checked={isUnlimitedUses}
                      onChange={(e) => setIsUnlimitedUses(e.target.checked)}
                      className="rounded text-[#1090F8] focus:ring-0"
                    />
                    <span>Unlimited</span>
                  </label>
                </div>

                {!isUnlimitedUses && (
                  <div className="pt-1">
                    <label className="font-bold text-[#24252c]/70 block mb-1 uppercase tracking-wider text-[10px]">
                      Maximum Redemptions (Checkouts)
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={maxUses}
                      onChange={(e) => setMaxUses(e.target.value)}
                      placeholder="e.g. 50"
                      className={inputClass}
                    />
                  </div>
                )}
              </div>

              {/* Validity Dates Section */}
              <div className="p-4 rounded-2xl bg-[var(--mist)] border border-[#24252c]/[0.08] space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-[var(--ink)] block">Validity Window</span>
                    <span className="text-[10px] text-[#24252c]/60">
                      Set a restricted date range (e.g. September 1–4 only) or All-Time.
                    </span>
                  </div>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer text-[11px] font-semibold text-[#24252c]/70">
                    <input
                      type="checkbox"
                      checked={isAllTime}
                      onChange={(e) => setIsAllTime(e.target.checked)}
                      className="rounded text-[#1090F8] focus:ring-0"
                    />
                    <span>All Time</span>
                  </label>
                </div>

                {!isAllTime && (
                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <div>
                      <label className="font-bold text-[#24252c]/70 block mb-1 uppercase tracking-wider text-[10px]">
                        Start Date *
                      </label>
                      <input
                        type="date"
                        required
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="font-bold text-[#24252c]/70 block mb-1 uppercase tracking-wider text-[10px]">
                        End Date *
                      </label>
                      <input
                        type="date"
                        required
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Scrolling Marquee Banner Toggle */}
              <div className="p-4 rounded-2xl bg-[#12131A] text-white border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="pr-4">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#1090F8] animate-ping" />
                      <span className="font-extrabold text-white text-xs block">
                        Display in Header Marquee Banner
                      </span>
                    </div>
                    <p className="text-[10px] text-white/60 mt-0.5 leading-relaxed">
                      Toggles whether this voucher code scrolls continuously across the top header in public and customer screens.
                      If toggled off, customers can still use it directly at checkout!
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowInBanner(!showInBanner)}
                    className={`w-11 h-6 rounded-full p-0.5 transition-colors cursor-pointer relative shrink-0 flex items-center ${
                      showInBanner ? 'bg-[#1090F8]' : 'bg-white/20'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                        showInBanner ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[10px] text-white/50">
                  <span>Banner Status:</span>
                  <span className={showInBanner ? 'text-[#F59E0B] font-bold' : 'text-white/40'}>
                    {showInBanner ? 'Active in Top Scrolling Loop' : 'Hidden from Banner (Direct Code Only)'}
                  </span>
                </div>
              </div>
            </form>
          </div>

          {/* Modal Footer */}
          <div className="p-5 sm:p-6 bg-[var(--mist)]/40 border-t border-[#24252c]/[0.06] shrink-0 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-full border border-[#24252c]/15 text-[#24252c]/70 hover:bg-black/5 font-semibold text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="voucher-form"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-full bg-[var(--ink)] hover:bg-[var(--ink-soft)] text-white font-semibold text-xs transition-colors cursor-pointer shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>{editingVoucher ? 'Save Changes' : 'Create Voucher'}</span>
              )}
            </button>
          </div>
        </div>
      </ModalOverlay>

      {/* ── Delete Confirmation Modal ── */}
      <ModalOverlay isOpen={Boolean(deletingId)} onClose={() => setDeletingId(null)}>
        <div className="bg-white rounded-[2.5rem] p-6 sm:p-8 max-w-sm w-full shadow-2xl border border-[#24252c]/10 text-center relative overflow-hidden animate-blur-in">
          <button
            type="button"
            onClick={() => setDeletingId(null)}
            className="absolute top-5 right-5 text-[#24252c]/50 hover:text-[var(--ink)] p-1 cursor-pointer"
          >
            <IconX className="w-5 h-5" />
          </button>

          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 font-bold text-xl flex items-center justify-center mx-auto mb-3 border border-rose-200">
            <IconTrash className="w-5 h-5" />
          </div>
          <h3 className="text-base font-extrabold text-[var(--ink)] mb-1">Delete Voucher Code?</h3>
          <p className="text-xs text-[#24252c]/60 mb-5 leading-relaxed">
            This will permanently remove the voucher code. Customers will no longer be able to use it at checkout.
          </p>
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => setDeletingId(null)}
              className="w-1/2 py-2.5 rounded-full border border-[#24252c]/15 text-[#24252c]/70 text-xs font-semibold hover:bg-black/5 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="w-1/2 py-2.5 rounded-full bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 transition-colors shadow-sm cursor-pointer"
            >
              Delete
            </button>
          </div>
        </div>
      </ModalOverlay>
    </div>
  );
}
