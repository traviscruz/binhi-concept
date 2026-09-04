import { useState, useEffect } from 'react';
import { fetchBannerVouchers, getBannerVouchersSync, type Voucher } from '../../utils/voucherService';
import { IconCheck, IconX } from '../shared/icons';

export function VoucherMarqueeBanner({
  go: _go,
  onVisibilityChange,
}: {
  go?: (page: any) => void;
  onVisibilityChange?: (visible: boolean) => void;
}) {
  const [vouchers, setVouchers] = useState<Voucher[]>(() => getBannerVouchersSync());
  const [isOpen, setIsOpen] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const loadVouchers = async () => {
    const syncActive = getBannerVouchersSync();
    setVouchers(syncActive);

    try {
      const active = await fetchBannerVouchers();
      setVouchers(active);
    } catch (e) {
      console.warn('Error loading banner vouchers:', e);
    }
  };

  useEffect(() => {
    loadVouchers();

    const handleUpdate = () => loadVouchers();
    window.addEventListener('vouchers-updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener('vouchers-updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const isBannerVisible = vouchers && vouchers.length > 0 && isOpen;

  useEffect(() => {
    onVisibilityChange?.(isBannerVisible);
  }, [isBannerVisible, onVisibilityChange]);

  const handleCopy = (e: React.MouseEvent, code: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1800);
  };

  if (!vouchers || vouchers.length === 0) {
    return null;
  }

  // Floating reopen capsule when dismissed
  if (!isOpen) {
    return (
      <div className="fixed top-2 right-4 z-[60] print:hidden animate-fade-in">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          title="View active promotional offers"
          className="bg-[#090a0f]/90 hover:bg-[#12141c] text-white/90 hover:text-white px-3 py-1.5 rounded-full border border-white/10 shadow-lg backdrop-blur-md flex items-center gap-2 text-[11px] font-medium transition-all duration-200 cursor-pointer group hover:border-[#1090F8]/40"
        >
          <span className="flex h-1.5 w-1.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1090F8] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#1090F8]"></span>
          </span>
          <span className="text-white/80 group-hover:text-white">Special Offers ({vouchers.length})</span>
        </button>
      </div>
    );
  }

  // Build a seamless duplicate array (at least 6-8 items per half so wide screens never run out)
  const repeatCount = Math.max(3, Math.ceil(8 / vouchers.length));
  const singleSet = Array(repeatCount).fill(vouchers).flat();

  const renderVoucherItem = (v: Voucher, keyPrefix: string, index: number) => {
    const discountText =
      v.discount_type === 'percentage'
        ? `${v.discount_value}% OFF`
        : `₱${v.discount_value.toLocaleString()} OFF`;

    const validityText = !v.is_all_time && v.end_date
      ? `Until ${new Date(v.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
      : v.max_uses !== null && v.max_uses > 0
      ? `${Math.max(0, v.max_uses - v.used_count)} left`
      : null;

    const isCopied = copiedCode === v.code;

    return (
      <div
        key={`${keyPrefix}-${v.id}-${index}`}
        className="inline-flex items-center gap-2.5 sm:gap-3 shrink-0 text-white/90 select-none text-[11px] sm:text-xs font-normal"
      >
        {/* Minimalist Accent Diamond */}
        <span className="text-[#1090F8] text-[10px] opacity-80">✦</span>

        {/* Crisp Formal Discount Badge */}
        <span className="font-semibold text-white tracking-tight">
          {discountText}
        </span>

        <span className="text-white/30 text-[10px]">•</span>

        {/* Clean Description */}
        <span className="text-white/75 font-normal tracking-wide">
          {v.description || 'Special Event Production Offer'}
        </span>

        {/* Subtle, zero-distraction code button (no popup toasts, clean inline indicator) */}
        <button
          type="button"
          onClick={(e) => handleCopy(e, v.code)}
          title={isCopied ? 'Copied' : 'Click to copy promo code'}
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold tracking-wider transition-colors duration-200 cursor-pointer ${
            isCopied
              ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 font-semibold'
              : 'bg-white/[0.08] hover:bg-white/[0.15] text-white/90 hover:text-white border border-white/10 hover:border-white/20 active:scale-95'
          }`}
        >
          <span>{v.code}</span>
          {isCopied ? (
            <IconCheck className="w-3 h-3 text-emerald-400 stroke-[2.5] shrink-0" />
          ) : (
            <svg viewBox="0 0 24 24" fill="none" className="w-2.5 h-2.5 opacity-50 shrink-0">
              <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="2" />
            </svg>
          )}
        </button>

        {/* Subtle validity note if available */}
        {validityText && (
          <span className="text-[10px] text-white/40 hidden md:inline font-medium">
            ({validityText})
          </span>
        )}

        {/* Trailing item spacer */}
        <span className="text-transparent px-2">|</span>
      </div>
    );
  };

  return (
    <div
      aria-label="Promotional Announcement Banner"
      className="fixed top-0 inset-x-0 z-[60] bg-[#090a0f] text-white border-b border-white/[0.07] shadow-xs overflow-hidden h-8 sm:h-8.5 flex items-center text-[11px] sm:text-xs select-none print:hidden transition-all duration-300"
    >
      {/* Left Edge Ambient Fade Mask */}
      <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-12 sm:w-24 bg-gradient-to-r from-[#090a0f] via-[#090a0f]/80 to-transparent z-10" />

      {/* Right Edge Ambient Fade Mask before Close Button */}
      <div className="pointer-events-none absolute right-8 top-0 bottom-0 w-12 sm:w-24 bg-gradient-to-l from-[#090a0f] via-[#090a0f]/80 to-transparent z-10" />

      {/* Endless Gapless Marquee Track (Full Width, Continuous Smooth Motion) */}
      <div className="w-full overflow-hidden flex items-center pl-4 pr-10">
        <div className="animate-marquee-smooth flex items-center gap-6 sm:gap-10">
          {/* Loop Set 1 */}
          <div className="flex items-center gap-6 sm:gap-10 shrink-0">
            {singleSet.map((v, i) => renderVoucherItem(v, 'set1', i))}
          </div>
          {/* Loop Set 2 (Exact duplicate for seamless 50% translation loop) */}
          <div className="flex items-center gap-6 sm:gap-10 shrink-0" aria-hidden="true">
            {singleSet.map((v, i) => renderVoucherItem(v, 'set2', i))}
          </div>
        </div>
      </div>

      {/* Subtle Minimalist Close Button */}
      <div className="absolute right-0 top-0 bottom-0 z-20 flex items-center pr-2 sm:pr-3 pl-2 bg-[#090a0f]">
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          title="Dismiss banner"
          className="text-white/40 hover:text-white p-1 hover:bg-white/10 rounded-full transition-colors cursor-pointer flex items-center justify-center"
        >
          <IconX className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
