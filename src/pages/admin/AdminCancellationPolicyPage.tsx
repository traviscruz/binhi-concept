import { useState, useEffect } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import {
  IconShield,
  IconCheck,
  IconPlus,
  IconTrash,
  IconCalendar,
  IconClock,
  IconFileText,
  IconAlertTriangle,
  IconInfo,
} from '../../components/shared/icons';
import {
  type CancellationPolicyConfig,
  type CancellationTier,
  DEFAULT_CANCELLATION_POLICY,
  loadCancellationPolicy,
  saveCancellationPolicy,
  calculateCancellationRefund,
} from '../../utils/cancellationPolicy';
import { logAuditEvent } from '../../utils/auditLogger';

export default function AdminCancellationPolicyPage({ go: _go }: { go: (p: Page) => void }) {
  const [config, setConfig] = useState<CancellationPolicyConfig>(DEFAULT_CANCELLATION_POLICY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Live Simulator States
  const [simEventDate, setSimEventDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 10);
    return d.toISOString().split('T')[0];
  });
  const [simBookingCreatedAt, setSimBookingCreatedAt] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 2);
    return d.toISOString().split('T')[0];
  });
  const [simPaidAmount, setSimPaidAmount] = useState(15000);
  const [simTotalCost, setSimTotalCost] = useState(15000);

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const loaded = await loadCancellationPolicy();
        setConfig(loaded);
      } catch (err) {
        console.error('Error loading cancellation policy:', err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      if (config.tiers.length === 0) {
        throw new Error('At least one policy tier must be configured.');
      }

      const saved = await saveCancellationPolicy(config);
      setConfig(saved);
      setSaveSuccess(true);

      await logAuditEvent({
        action: 'UPDATE_BOOKING_STATUS',
        module: 'system',
        targetId: 'cancellation_policy',
        targetName: 'Cancellation Policy',
        details: `Updated cancellation policy tiers & rules (${config.tiers.length} active tiers, Grace Period: ${config.gracePeriodHours}h).`,
      });

      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save cancellation policy.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddTier = () => {
    const newTier: CancellationTier = {
      id: `tier-${Date.now()}`,
      days_threshold: 5,
      refund_percentage: 50,
      label: '5+ Days Prior to Event (50% Refund)',
    };
    setConfig((prev) => ({
      ...prev,
      tiers: [...prev.tiers, newTier].sort((a, b) => b.days_threshold - a.days_threshold),
    }));
  };

  const handleUpdateTier = (id: string, updates: Partial<CancellationTier>) => {
    setConfig((prev) => ({
      ...prev,
      tiers: prev.tiers.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    }));
  };

  const handleRemoveTier = (id: string) => {
    if (config.tiers.length <= 1) {
      alert('You must keep at least one cancellation tier.');
      return;
    }
    setConfig((prev) => ({
      ...prev,
      tiers: prev.tiers.filter((t) => t.id !== id),
    }));
  };

  const handleApplyPreset = (presetType: 'standard' | 'flexible' | 'strict') => {
    if (presetType === 'standard') {
      setConfig((prev) => ({
        ...prev,
        tiers: [
          { id: 'tier-1', days_threshold: 14, refund_percentage: 100, label: '14+ Days Before Event (100% Full Refund)' },
          { id: 'tier-2', days_threshold: 7, refund_percentage: 75, label: '7 to 13 Days Before Event (75% Refund)' },
          { id: 'tier-3', days_threshold: 3, refund_percentage: 50, label: '3 to 6 Days Before Event (50% Refund / Deposit Forfeit)' },
          { id: 'tier-4', days_threshold: 0, refund_percentage: 0, label: 'Under 72 Hours / 0-2 Days (0% Non-Refundable)' },
        ],
        gracePeriodHours: 24,
        gracePeriodEnabled: true,
        processingFeeType: 'none',
        processingFeeAmount: 0,
      }));
    } else if (presetType === 'flexible') {
      setConfig((prev) => ({
        ...prev,
        tiers: [
          { id: 'tier-1', days_threshold: 7, refund_percentage: 100, label: '7+ Days Before Event (100% Full Refund)' },
          { id: 'tier-2', days_threshold: 2, refund_percentage: 80, label: '2 to 6 Days Before Event (80% Refund)' },
          { id: 'tier-3', days_threshold: 0, refund_percentage: 50, label: 'Under 48 Hours (50% Deposit Refund)' },
        ],
        gracePeriodHours: 48,
        gracePeriodEnabled: true,
        processingFeeType: 'none',
        processingFeeAmount: 0,
      }));
    } else if (presetType === 'strict') {
      setConfig((prev) => ({
        ...prev,
        tiers: [
          { id: 'tier-1', days_threshold: 30, refund_percentage: 100, label: '30+ Days Before Event (100% Full Refund)' },
          { id: 'tier-2', days_threshold: 14, refund_percentage: 50, label: '14 to 29 Days Before Event (50% Refund)' },
          { id: 'tier-3', days_threshold: 0, refund_percentage: 0, label: 'Under 14 Days (Strictly Non-Refundable)' },
        ],
        gracePeriodHours: 12,
        gracePeriodEnabled: true,
        processingFeeType: 'fixed',
        processingFeeAmount: 500,
      }));
    }
  };

  const simResult = calculateCancellationRefund({
    eventDateStr: simEventDate,
    bookingCreatedAt: simBookingCreatedAt,
    amountPaid: Number(simPaidAmount) || 0,
    totalCost: Number(simTotalCost) || 0,
    policy: config,
  });

  if (loading) {
    return (
      <div className="flex-1 p-8 flex items-center justify-center min-h-[500px]">
        <div className="w-8 h-8 border-3 border-[#1090F8] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#24252c]/[0.06]">
        <div>
          <MonoBadge icon={IconShield}>Financial Governance</MonoBadge>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ink)] mt-1.5">
            Cancellation &amp; Refund Policy Rules
          </h1>
          <p className="text-xs text-[#24252c]/60 mt-1">
            Configure tiered refund rules, booking grace periods, and payment processing deductions.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="bg-[var(--ink)] hover:bg-[var(--ink)]/90 text-white text-xs font-bold px-6 py-2.5 rounded-full transition-all shadow-sm self-start sm:self-auto cursor-pointer inline-flex items-center gap-2 disabled:opacity-50"
        >
          {saving ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Saving Policy...</span>
            </>
          ) : (
            <>
              <IconCheck className="w-4 h-4" />
              <span>Publish Policy Changes</span>
            </>
          )}
        </button>
      </div>

      {/* ── Feedback Toasts / Alerts ── */}
      {saveSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 shadow-sm flex items-center justify-between gap-3 text-xs font-semibold">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
              <IconCheck className="w-3.5 h-3.5" />
            </span>
            <span>Policy changes saved and activated across all Customer &amp; Admin booking flows!</span>
          </div>
          <button
            type="button"
            onClick={() => setSaveSuccess(false)}
            className="text-emerald-700 hover:text-emerald-950 font-bold p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {saveError && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-300 text-rose-900 shadow-sm flex items-center justify-between gap-3 text-xs font-semibold">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
              <IconAlertTriangle className="w-3.5 h-3.5" />
            </span>
            <span>{saveError}</span>
          </div>
          <button
            type="button"
            onClick={() => setSaveError(null)}
            className="text-rose-700 hover:text-rose-950 font-bold p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Top Controls Grid: Grace Period & Processing Fees (Side-by-Side) ── */}
      <div className="grid lg:grid-cols-2 gap-4 sm:gap-5 items-stretch">
        {/* Card 1: Booking Grace Period */}
        <div className="bg-white rounded-3xl p-5 border border-[#24252c]/[0.08] shadow-sm flex flex-col justify-between gap-4">
          <div>
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#24252c]/[0.06]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#1090F8] flex items-center justify-center shrink-0 border border-blue-100">
                  <IconClock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-[var(--ink)]">
                    Free Cancellation Grace Period
                  </h3>
                  <p className="text-[11px] text-[#24252c]/60">Instant 100% refund window</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.gracePeriodEnabled}
                  onChange={(e) => setConfig((prev) => ({ ...prev, gracePeriodEnabled: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#1090F8]" />
              </label>
            </div>

            <p className="text-xs text-[#24252c]/70 leading-relaxed mt-3">
              Allows a 100% refund for bookings cancelled shortly after reservation.
            </p>
          </div>

          <div className="pt-3 border-t border-[#24252c]/[0.06] flex items-center justify-between gap-3 text-xs">
            <span className="font-bold text-[var(--ink)]">Grace Period Window:</span>
            <div className="relative w-36">
              <input
                type="number"
                min="1"
                max="72"
                disabled={!config.gracePeriodEnabled}
                value={config.gracePeriodHours}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, gracePeriodHours: Math.max(1, parseInt(e.target.value) || 24) }))
                }
                className="w-full rounded-xl border border-[#24252c]/15 px-3 py-2 bg-[#F8F9FA] focus:bg-white text-[var(--ink)] font-bold text-xs focus:outline-none focus:border-[#1090F8] disabled:opacity-50"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#24252c]/50 font-bold pointer-events-none">
                Hours
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Administrative / Processing Fee */}
        <div className="bg-white rounded-3xl p-5 border border-[#24252c]/[0.08] shadow-sm flex flex-col justify-between gap-4">
          <div>
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#24252c]/[0.06]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 border border-amber-100">
                  <IconShield className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-[var(--ink)]">
                    Payment Gateway &amp; Handling Fee
                  </h3>
                  <p className="text-[11px] text-[#24252c]/60">Deduct transaction fee from refund</p>
                </div>
              </div>
              <select
                value={config.processingFeeType}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    processingFeeType: e.target.value as 'none' | 'fixed' | 'percentage',
                  }))
                }
                className="rounded-xl border border-[#24252c]/15 px-3 py-1.5 bg-[#F8F9FA] text-xs font-bold text-[var(--ink)] focus:outline-none focus:border-[#1090F8] cursor-pointer"
              >
                <option value="none">No Fee (0%)</option>
                <option value="fixed">Flat Fee (₱)</option>
                <option value="percentage">Percentage (%)</option>
              </select>
            </div>

            <p className="text-xs text-[#24252c]/70 leading-relaxed mt-3">
              Subtracts transaction fees or handling costs from the refunded amount.
            </p>
          </div>

          <div className="pt-3 border-t border-[#24252c]/[0.06] flex items-center justify-between gap-3 text-xs">
            <span className="font-bold text-[var(--ink)]">Fee Deduction Amount:</span>
            {config.processingFeeType === 'none' ? (
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                0% (No Deduction)
              </span>
            ) : (
              <div className="relative w-36">
                <input
                  type="number"
                  min="0"
                  value={config.processingFeeAmount}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      processingFeeAmount: Math.max(0, parseFloat(e.target.value) || 0),
                    }))
                  }
                  className="w-full rounded-xl border border-[#24252c]/15 px-3 py-2 bg-[#F8F9FA] focus:bg-white text-[var(--ink)] font-bold text-xs focus:outline-none focus:border-[#1090F8]"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#24252c]/50 font-bold pointer-events-none">
                  {config.processingFeeType === 'fixed' ? 'PHP' : '%'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Main Section: Tiered Rules Schedule Matrix ── */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-[#24252c]/[0.08] shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#24252c]/[0.06]">
          <div>
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-[var(--ink)]">
              Tiered Days-Based Refund Schedule Matrix
            </h2>
            <p className="text-xs text-[#24252c]/60 mt-0.5">
              Defines refund percentage based on calendar days remaining until the event.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={handleAddTier}
              className="bg-[#1090F8] text-white text-xs font-bold px-4 py-2 rounded-full hover:bg-[#1090F8]/90 transition-colors shadow-sm cursor-pointer inline-flex items-center gap-1.5"
            >
              <IconPlus className="w-3.5 h-3.5" />
              <span>Add Custom Tier</span>
            </button>
          </div>
        </div>

        {/* Industry Presets Quick-Select */}
        <div className="flex items-center gap-2 flex-wrap pb-1">
          <span className="text-[10px] font-bold uppercase text-[#24252c]/50">Presets:</span>
          <button
            type="button"
            onClick={() => handleApplyPreset('standard')}
            className="text-[11px] font-bold px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 transition-colors cursor-pointer"
          >
            Standard 4-Tier
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset('flexible')}
            className="text-[11px] font-bold px-3 py-1 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition-colors cursor-pointer"
          >
            Flexible 3-Tier
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset('strict')}
            className="text-[11px] font-bold px-3 py-1 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors cursor-pointer"
          >
            Strict 30-Day
          </button>
        </div>

        {/* Tiers List Cards */}
        <div className="space-y-3">
          {config.tiers
            .sort((a, b) => b.days_threshold - a.days_threshold)
            .map((tier, idx) => (
              <div
                key={tier.id}
                className="p-4 rounded-2xl bg-[#F8F9FA] border border-[#24252c]/[0.08] hover:border-[#1090F8]/30 transition-all space-y-3"
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-full bg-[var(--ink)] text-white font-mono font-bold text-xs flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <span className="font-extrabold text-xs text-[var(--ink)]">
                      {tier.days_threshold === 0
                        ? 'Event Cutoff Window (0 Days)'
                        : `${tier.days_threshold}+ Days Before Event`}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-extrabold px-3 py-1 rounded-full border ${
                        tier.refund_percentage === 100
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : tier.refund_percentage > 0
                          ? 'bg-blue-50 text-blue-800 border-blue-300'
                          : 'bg-rose-50 text-rose-800 border-rose-300'
                      }`}
                    >
                      {tier.refund_percentage}% Refund
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTier(tier.id)}
                      className="p-1.5 rounded-lg text-[#24252c]/40 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Remove Tier"
                    >
                      <IconTrash className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs">
                  <div className="sm:col-span-3">
                    <label className="font-bold text-[10px] uppercase text-[#24252c]/60 block mb-1">
                      Min Days Threshold
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="365"
                        value={tier.days_threshold}
                        onChange={(e) =>
                          handleUpdateTier(tier.id, { days_threshold: Math.max(0, parseInt(e.target.value) || 0) })
                        }
                        className="w-full rounded-xl border border-[#24252c]/15 px-3 py-2 bg-white text-[var(--ink)] font-bold focus:outline-none focus:border-[#1090F8]"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#24252c]/50 font-bold pointer-events-none">
                        Days
                      </span>
                    </div>
                  </div>

                  <div className="sm:col-span-3">
                    <label className="font-bold text-[10px] uppercase text-[#24252c]/60 block mb-1">
                      Refund Percentage
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={tier.refund_percentage}
                        onChange={(e) =>
                          handleUpdateTier(tier.id, {
                            refund_percentage: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)),
                          })
                        }
                        className="w-full rounded-xl border border-[#24252c]/15 px-3 py-2 bg-white text-[var(--ink)] font-bold focus:outline-none focus:border-[#1090F8]"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#24252c]/50 font-bold pointer-events-none">
                        %
                      </span>
                    </div>
                  </div>

                  <div className="sm:col-span-6">
                    <label className="font-bold text-[10px] uppercase text-[#24252c]/60 block mb-1">
                      Tier Description / Label
                    </label>
                    <input
                      type="text"
                      value={tier.label}
                      onChange={(e) => handleUpdateTier(tier.id, { label: e.target.value })}
                      placeholder="e.g. 14+ Days Before Event (100% Full Refund)"
                      className="w-full rounded-xl border border-[#24252c]/15 px-3 py-2 bg-white text-[var(--ink)] font-medium text-xs focus:outline-none focus:border-[#1090F8]"
                    />
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* ── Bottom Grid: Disclosure Terms (Left) + Interactive Live Sandbox Simulator (Right) ── */}
      <div className="grid lg:grid-cols-12 gap-5 items-start">
        {/* Left: Customer Terms Disclosure (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-5 sm:p-6 border border-[#24252c]/[0.08] shadow-sm space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-[#24252c]/[0.06]">
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0 border border-purple-100">
              <IconFileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-[var(--ink)]">
                Customer Policy Terms Disclosure
              </h3>
              <p className="text-[11px] text-[#24252c]/60">Shown in customer booking history &amp; official documents</p>
            </div>
          </div>

          <textarea
            rows={5}
            value={config.policyNotes}
            onChange={(e) => setConfig((prev) => ({ ...prev, policyNotes: e.target.value }))}
            placeholder="Enter customer-facing policy terms disclosure..."
            className="w-full rounded-2xl border border-[#24252c]/15 p-4 bg-[#F8F9FA] focus:bg-white text-xs font-medium text-[var(--ink)] focus:outline-none focus:border-[#1090F8] transition-colors resize-none leading-relaxed"
          />

          <div className="flex items-center justify-between text-[11px] text-[#24252c]/50 px-1">
            <span className="flex items-center gap-1">
              <IconInfo className="w-3.5 h-3.5 text-[#1090F8]" />
              <span>Automatically saved and rendered in official booking documents.</span>
            </span>
            <span className="font-mono font-semibold">{config.policyNotes.length} chars</span>
          </div>
        </div>

        {/* Right: Live Policy Simulator (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-5 sm:p-6 border border-[#24252c]/[0.08] shadow-sm space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[#24252c]/[0.06]">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-100">
              <IconCalendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-[var(--ink)]">
                Live Calculation Simulator
              </h3>
              <p className="text-[11px] text-[#24252c]/60">Test scenarios and preview live formula results</p>
            </div>
          </div>

          {/* Test Inputs */}
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold uppercase text-[10px] text-[#24252c]/60 block mb-1">
                  Event Schedule Date
                </label>
                <input
                  type="date"
                  value={simEventDate}
                  onChange={(e) => setSimEventDate(e.target.value)}
                  className="w-full rounded-xl border border-[#24252c]/15 px-3 py-2 bg-[#F8F9FA] text-[var(--ink)] font-bold focus:bg-white focus:outline-none focus:border-[#1090F8]"
                />
              </div>

              <div>
                <label className="font-bold uppercase text-[10px] text-[#24252c]/60 block mb-1">
                  Booking Created Date
                </label>
                <input
                  type="date"
                  value={simBookingCreatedAt}
                  onChange={(e) => setSimBookingCreatedAt(e.target.value)}
                  className="w-full rounded-xl border border-[#24252c]/15 px-3 py-2 bg-[#F8F9FA] text-[var(--ink)] font-bold focus:bg-white focus:outline-none focus:border-[#1090F8]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold uppercase text-[10px] text-[#24252c]/60 block mb-1">
                  Total Booking Cost
                </label>
                <input
                  type="number"
                  value={simTotalCost}
                  onChange={(e) => setSimTotalCost(Number(e.target.value) || 0)}
                  className="w-full rounded-xl border border-[#24252c]/15 px-3 py-2 bg-[#F8F9FA] text-[var(--ink)] font-bold focus:bg-white focus:outline-none focus:border-[#1090F8]"
                />
              </div>

              <div>
                <label className="font-bold uppercase text-[10px] text-[#24252c]/60 block mb-1">
                  Amount Paid
                </label>
                <input
                  type="number"
                  value={simPaidAmount}
                  onChange={(e) => setSimPaidAmount(Number(e.target.value) || 0)}
                  className="w-full rounded-xl border border-[#24252c]/15 px-3 py-2 bg-[#F8F9FA] text-[var(--ink)] font-bold focus:bg-white focus:outline-none focus:border-[#1090F8]"
                />
              </div>
            </div>
          </div>

          {/* Simulated Outcome Result Card */}
          <div className="p-4 rounded-2xl bg-[var(--ink)] text-white space-y-3 shadow-sm">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-white/60 uppercase font-bold tracking-wider">Simulated Result</span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                  simResult.refundPercentage === 100
                    ? 'bg-emerald-500 text-white'
                    : simResult.refundPercentage > 0
                    ? 'bg-[#1090F8] text-white'
                    : 'bg-rose-500 text-white'
                }`}
              >
                {simResult.isGracePeriodApplied
                  ? 'Grace Period (100%)'
                  : `${simResult.refundPercentage}% Refund Schedule`}
              </span>
            </div>

            <div className="pt-2 border-t border-white/10 space-y-1.5 text-xs">
              <div className="flex justify-between text-white/80">
                <span>Days Remaining to Event:</span>
                <strong className="text-white font-mono">{simResult.daysUntilEvent} Days</strong>
              </div>
              <div className="flex justify-between text-white/80">
                <span>Gross Refundable Amount:</span>
                <strong className="text-white font-mono">₱{simResult.grossRefundable.toLocaleString()}</strong>
              </div>
              {simResult.processingFeeDeduction > 0 && (
                <div className="flex justify-between text-rose-300">
                  <span>Processing Fee Deduction:</span>
                  <strong className="font-mono">-₱{simResult.processingFeeDeduction.toLocaleString()}</strong>
                </div>
              )}
              <div className="flex justify-between items-center text-sm font-extrabold pt-2 border-t border-white/10 text-emerald-300">
                <span>Net Refund to Customer:</span>
                <span className="font-mono text-base font-black">₱{simResult.netRefundable.toLocaleString()}</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-white/10 text-[11px] text-white/80 leading-relaxed">
              {simResult.summaryExplanation}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
