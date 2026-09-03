import type { PackageData } from '../../../data/packages';
import { PAYMENT_METHODS } from './types';
import { IconCheck, IconTicket, IconChevronDown, IconChevronUp, IconArrow } from '../../shared/icons';

interface ManualBookingStep3Props {
  paymentType: 'deposit' | 'full';
  setPaymentType: (val: 'deposit' | 'full') => void;
  depositRequired: number;
  balanceDueOnEventDate: number;
  totalCost: number;
  promoOpen: boolean;
  setPromoOpen: (val: boolean) => void;
  promoInput: string;
  setPromoInput: (val: string) => void;
  appliedPromo: {
    code: string;
    description: string;
    discountType: 'percentage' | 'fixed';
    discountValue: number;
  } | null;
  setAppliedPromo: (val: any) => void;
  promoError: string;
  setPromoError: (val: string) => void;
  handleApplyPromo: () => void;
  discountAmount: number;
  paymentMethod: string;
  setPaymentMethod: (val: string) => void;
  customMethod: string;
  setCustomMethod: (val: string) => void;
  paymentRefNumber: string;
  setPaymentRefNumber: (val: string) => void;
  proofFile: File | null;
  setProofFile: (val: File | null) => void;
  proofPreview: string;
  setProofPreview: (val: string) => void;
  selectedPkg: PackageData;
  currentPkgPrice: number;
  addonsCost: number;
  selectedAddonStrings: string[];
  locationRegionName: string;
  transportFee: number;
  amountDueToday: number;
  remainingBalanceAmount: number;
  isFullPayment: boolean;
  submitting: boolean;
  error: string;
  onBack: () => void;
  onSubmit: () => void;
}

export function ManualBookingStep3({
  paymentType,
  setPaymentType,
  depositRequired,
  balanceDueOnEventDate,
  totalCost,
  promoOpen,
  setPromoOpen,
  promoInput,
  setPromoInput,
  appliedPromo,
  setAppliedPromo,
  promoError,
  setPromoError,
  handleApplyPromo,
  discountAmount,
  paymentMethod,
  setPaymentMethod,
  customMethod,
  setCustomMethod,
  paymentRefNumber,
  setPaymentRefNumber,
  proofFile,
  setProofFile,
  proofPreview,
  setProofPreview,
  selectedPkg,
  currentPkgPrice,
  addonsCost,
  selectedAddonStrings,
  locationRegionName,
  transportFee,
  amountDueToday,
  remainingBalanceAmount,
  isFullPayment,
  submitting,
  error,
  onBack,
  onSubmit,
}: ManualBookingStep3Props) {
  return (
    <div className="bg-white rounded-[2rem] p-6 md:p-8 border border-[#24252c]/[0.08] shadow-sm animate-blur-in space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold text-[var(--ink)]">Step 3: Payment Plan & Attach Proof</h2>
        <p className="text-xs text-[#24252c]/60 mt-1">
          Select payment terms (50% downpayment or 100% full payment) and attach the proof of payment slip.
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-2xl text-xs bg-rose-50 border border-rose-200 text-rose-700 font-semibold">
          {error}
        </div>
      )}

      {/* Payment Plan Cards */}
      <div className="grid sm:grid-cols-2 gap-4">
        {/* Option 1: 50% Downpayment */}
        <div
          onClick={() => setPaymentType('deposit')}
          className={`relative p-5 rounded-3xl border-2 transition-all duration-200 cursor-pointer text-left flex flex-col justify-between ${
            paymentType === 'deposit'
              ? 'border-[#1090F8] bg-[#1090F8]/[0.03] shadow-md ring-1 ring-[#1090F8]/20'
              : 'border-[#24252c]/[0.08] bg-white hover:border-[#24252c]/20 hover:bg-[var(--mist)]/40'
          }`}
        >
          <div>
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <span className="text-[10px] font-extrabold tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-[#1090F8]/10 text-[#1090F8] border border-[#1090F8]/20">
                Standard Reservation
              </span>
              <div
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                  paymentType === 'deposit' ? 'border-[#1090F8] bg-[#1090F8] text-white' : 'border-[#24252c]/20 bg-white'
                }`}
              >
                {paymentType === 'deposit' && <IconCheck className="w-3 h-3 stroke-[3]" />}
              </div>
            </div>

            <h3 className="text-base font-extrabold text-[var(--ink)]">50% Downpayment</h3>
            <p className="text-[11px] text-[#24252c]/60 mt-0.5 leading-relaxed">
              Lock in client event date now. Settle the remaining 50% balance on the day of the event.
            </p>
          </div>

          <div className="mt-4 pt-3.5 border-t border-[#24252c]/[0.06] space-y-1">
            <div className="flex justify-between items-baseline">
              <span className="text-[10px] uppercase font-bold text-[#24252c]/40">Due Today</span>
              <span className="text-lg font-black text-[#1090F8]">₱{depositRequired.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-[11px] text-[#24252c]/60">
              <span>Balance on Event Day</span>
              <span className="font-semibold text-[var(--ink)]">₱{balanceDueOnEventDate.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Option 2: Full Payment (100%) */}
        <div
          onClick={() => setPaymentType('full')}
          className={`relative p-5 rounded-3xl border-2 transition-all duration-200 cursor-pointer text-left flex flex-col justify-between ${
            paymentType === 'full'
              ? 'border-[#1090F8] bg-[#1090F8]/[0.03] shadow-md ring-1 ring-[#1090F8]/20'
              : 'border-[#24252c]/[0.08] bg-white hover:border-[#24252c]/20 hover:bg-[var(--mist)]/40'
          }`}
        >
          <div>
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <span className="text-[10px] font-extrabold tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                Recommended · Hassle-Free
              </span>
              <div
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                  paymentType === 'full' ? 'border-[#1090F8] bg-[#1090F8] text-white' : 'border-[#24252c]/20 bg-white'
                }`}
              >
                {paymentType === 'full' && <IconCheck className="w-3 h-3 stroke-[3]" />}
              </div>
            </div>

            <h3 className="text-base font-extrabold text-[var(--ink)]">Full Payment (100%)</h3>
            <p className="text-[11px] text-[#24252c]/60 mt-0.5 leading-relaxed">
              Settle everything today. Zero balance, no cash handling or payments required on event day.
            </p>
          </div>

          <div className="mt-4 pt-3.5 border-t border-[#24252c]/[0.06] space-y-1">
            <div className="flex justify-between items-baseline">
              <span className="text-[10px] uppercase font-bold text-[#24252c]/40">Due Today</span>
              <span className="text-lg font-black text-[#1090F8]">₱{totalCost.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-[11px] text-[#24252c]/60">
              <span>Balance on Event Day</span>
              <span className="font-bold text-emerald-600">₱0 (Fully Settled)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Collapsible Promo Code Box */}
      <div className="rounded-2xl border border-[#24252c]/[0.08] bg-white overflow-hidden transition-all shadow-xs">
        <button
          type="button"
          onClick={() => setPromoOpen(!promoOpen)}
          className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-[var(--mist)]/40 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#1090F8]/10 text-[#1090F8] flex items-center justify-center shrink-0">
              <IconTicket className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-[var(--ink)] block">
                {appliedPromo ? (
                  <span className="flex items-center gap-1.5 text-emerald-600">
                    <IconCheck className="w-3.5 h-3.5" /> Promo Code Active: <strong>{appliedPromo.code}</strong>
                  </span>
                ) : (
                  'Have a promo code or voucher?'
                )}
              </span>
              <span className="text-[10px] text-[#24252c]/50">
                {appliedPromo
                  ? `${appliedPromo.description} (-₱${discountAmount.toLocaleString()})`
                  : 'Click to apply discount coupon or loyalty reward voucher'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {appliedPromo && (
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                -₱{discountAmount.toLocaleString()}
              </span>
            )}
            <span className="text-[#24252c]/40">
              {promoOpen ? <IconChevronUp className="w-4 h-4" /> : <IconChevronDown className="w-4 h-4" />}
            </span>
          </div>
        </button>

        {promoOpen && (
          <div className="px-5 pb-5 pt-2 border-t border-[#24252c]/[0.06] bg-[var(--mist)]/20 space-y-3 animate-blur-in">
            {appliedPromo ? (
              <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs">
                <span className="font-extrabold text-emerald-800 uppercase tracking-wide">
                  {appliedPromo.code} — {appliedPromo.description} (-₱{discountAmount.toLocaleString()})
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setAppliedPromo(null);
                    setPromoError('');
                  }}
                  className="text-[11px] font-bold text-rose-600 hover:text-rose-800 hover:underline cursor-pointer ml-3 shrink-0"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={promoInput}
                    onChange={(e) => {
                      setPromoInput(e.target.value.toUpperCase());
                      setPromoError('');
                    }}
                    placeholder="e.g. BINHI2026"
                    className="flex-1 rounded-full border border-[#24252c]/15 px-4 py-2.5 text-xs bg-white text-[var(--ink)] font-mono font-bold tracking-wider placeholder:font-sans placeholder:font-normal focus:outline-none focus:border-[#1090F8]"
                  />
                  <button
                    type="button"
                    onClick={handleApplyPromo}
                    className="bg-[#1090F8] hover:bg-[#1090F8]/90 text-white text-xs font-semibold px-5 py-2.5 rounded-full transition-colors cursor-pointer shadow-sm shrink-0"
                  >
                    Apply Code
                  </button>
                </div>
                {promoError && <p className="text-[11px] font-semibold text-rose-600 mt-1.5 ml-2">{promoError}</p>}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Payment Method & Reference Number */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50 ml-1 block mb-1">
            Payment Method Used <span className="text-rose-500">*</span>
          </label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            className="w-full rounded-full border border-transparent px-4 py-3 text-sm bg-[var(--mist)] text-[var(--ink)] font-bold focus:outline-none focus:border-[#1090F8] cursor-pointer"
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          {paymentMethod === 'Other Payment Method' && (
            <input
              type="text"
              value={customMethod}
              onChange={(e) => setCustomMethod(e.target.value)}
              placeholder="Specify custom method (e.g. Bank Cheque)"
              className="mt-2 w-full rounded-full border border-transparent px-4 py-2.5 text-xs bg-[var(--mist)] text-[var(--ink)] font-medium focus:outline-none focus:border-[#1090F8]"
            />
          )}
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50 ml-1 block mb-1">
            Transaction / Reference # <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={paymentRefNumber}
            onChange={(e) => setPaymentRefNumber(e.target.value)}
            placeholder="e.g. GCash Ref # / Bank Transfer Ref #"
            className="w-full rounded-full border border-transparent px-4 py-3 text-sm bg-[var(--mist)] text-[var(--ink)] font-mono font-bold focus:outline-none focus:border-[#1090F8]"
            required
          />
        </div>
      </div>

      {/* Attached Proof of Payment Upload */}
      <div>
        <div className="flex items-center justify-between ml-1 mb-1">
          <label className="text-xs font-bold uppercase tracking-wider text-[#24252c]/50">
            Attached Proof of Payment <span className="text-rose-500">*</span>
          </label>
          <span className="text-[10px] text-[#24252c]/50">Deposit slip, GCash screenshot, or Bank receipt</span>
        </div>

        <div className="border-2 border-dashed border-[#24252c]/15 hover:border-[#1090F8]/50 rounded-2xl p-5 bg-[var(--mist)]/40 text-center transition-colors">
          <input
            type="file"
            id="admin-page-proof"
            accept="image/*,.pdf"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                setProofFile(file);
                const reader = new FileReader();
                reader.onloadend = () => {
                  setProofPreview(reader.result as string);
                };
                reader.readAsDataURL(file);
              }
            }}
            className="hidden"
          />

          {proofPreview ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-2">
                <span className="text-xs font-bold text-[var(--ink)]">
                  Attached: {proofFile?.name || 'Payment Receipt Slip'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setProofFile(null);
                    setProofPreview('');
                  }}
                  className="text-xs font-bold text-rose-600 hover:underline cursor-pointer"
                >
                  Remove & Upload New
                </button>
              </div>
              <div className="h-48 rounded-xl overflow-hidden bg-white border border-[#24252c]/10 flex items-center justify-center p-2">
                <img src={proofPreview} alt="Proof slip" className="max-h-full max-w-full object-contain rounded-lg" />
              </div>
            </div>
          ) : (
            <label htmlFor="admin-page-proof" className="cursor-pointer block py-4">
              <div className="w-12 h-12 rounded-full bg-[#1090F8]/10 text-[#1090F8] flex items-center justify-center mx-auto mb-2 font-bold text-sm">
                <IconTicket className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-[var(--ink)]">
                Click to attach client Proof of Payment
              </p>
              <p className="text-[11px] text-[#24252c]/50 mt-0.5">
                Supports PNG, JPG, WEBP, or PDF
              </p>
            </label>
          )}
        </div>
      </div>

      {/* Payment Schedule Breakdown */}
      <div className="p-5 rounded-2xl bg-[var(--mist)] border border-[#24252c]/[0.08] space-y-3 text-xs">
        <div className="flex items-center justify-between pb-2 border-b border-[#24252c]/[0.06]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#24252c]/50">Selected Payment Terms</span>
          <span className="font-bold text-[#1090F8]">
            {paymentType === 'full' ? 'Full Payment (100% Settled)' : '50% Downpayment (Reservation)'}
          </span>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-[#24252c]/60">
            <span>Package Base Rate ({selectedPkg.name})</span>
            <span className="font-bold text-[var(--ink)]">₱{currentPkgPrice.toLocaleString()}</span>
          </div>

          {addonsCost > 0 && (
            <div className="flex justify-between text-[#24252c]/60">
              <span>Equipment Add-ons ({selectedAddonStrings.length})</span>
              <span className="font-bold text-[var(--ink)]">+₱{addonsCost.toLocaleString()}</span>
            </div>
          )}

          <div className="flex justify-between text-[#24252c]/60">
            <span>Transport & Logistics Fee ({locationRegionName})</span>
            <span className="font-bold text-[#1090F8]">+₱{transportFee.toLocaleString()}</span>
          </div>

          {discountAmount > 0 && (
            <div className="flex justify-between text-emerald-600 font-bold">
              <span>Promo Discount ({appliedPromo?.code})</span>
              <span>-₱{discountAmount.toLocaleString()}</span>
            </div>
          )}

          <div className="flex justify-between text-[#24252c]/80 pt-1 border-t border-[#24252c]/[0.05]">
            <span className="font-semibold">Total Event Booking Cost</span>
            <span className="font-bold text-[var(--ink)]">₱{totalCost.toLocaleString()}</span>
          </div>
        </div>

        <div className="pt-2 border-t border-[#24252c]/[0.08] space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="p-3.5 rounded-xl bg-white border border-[#1090F8]/25 shadow-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#1090F8]">
                  Amount Due Today
                </span>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#1090F8]/10 text-[#1090F8]">
                  {isFullPayment ? '100% Full' : '50% Deposit'}
                </span>
              </div>
              <div className="text-xl font-black text-[#1090F8]">
                ₱{amountDueToday.toLocaleString()}
              </div>
              <p className="text-[10px] text-[#24252c]/60 leading-tight">
                Proof of payment attached for this amount.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-white border border-[#24252c]/[0.08] shadow-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#24252c]/60">
                  Balance Due on Event Date
                </span>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-[var(--mist)] text-[#24252c]/60">
                  Event Day
                </span>
              </div>
              <div className={`text-xl font-black ${isFullPayment ? 'text-emerald-600' : 'text-[var(--ink)]'}`}>
                {isFullPayment ? '₱0 (Settled)' : `₱${remainingBalanceAmount.toLocaleString()}`}
              </div>
              <p className="text-[10px] text-[#24252c]/60 leading-tight">
                {isFullPayment ? '100% full payment — zero balance on event date.' : 'Payable on event date.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={onBack}
          className="w-1/3 bg-[var(--mist)] text-[var(--ink)] text-sm font-semibold py-4 rounded-full border border-[#24252c]/10 cursor-pointer hover:bg-black/5 transition-colors flex items-center justify-center gap-2"
        >
          <span className="rotate-180 inline-flex"><IconArrow className="w-4 h-4" /></span>
          <span>Back</span>
        </button>

        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          className="w-2/3 bg-[#1090F8] hover:bg-[#1090F8]/90 disabled:opacity-50 text-white text-sm font-bold py-4 rounded-full transition-colors shadow-lg cursor-pointer flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Saving Booking & Storing Slip...</span>
            </>
          ) : (
            <>
              <span>Confirm & Complete Manual Booking</span>
              <IconCheck className="w-4 h-4 stroke-[3]" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
