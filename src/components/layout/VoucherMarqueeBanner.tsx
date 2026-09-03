import { useState, useEffect } from 'react';
import { fetchBannerVouchers, getBannerVouchersSync, type Voucher } from '../../utils/voucherService';
import { IconTicket, IconCheck, IconX, IconChevronDown } from '../shared/icons';

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
    // 1. Immediately read from synchronous local cache so it reflects in 0ms!
    const syncActive = getBannerVouchersSync();
    setVouchers(syncActive);

    // 2. Fetch fresh data asynchronously from Supabase in background
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
    setTimeout(() => setCopiedCode(null), 2500);
  };

  if (!vouchers || vouchers.length === 0) {
    return null;
  }

  // If user closed the banner, show a slim banner tab with an arrow icon to reopen it
  if (!isOpen) {
    return (
      <div className="fixed top-0 inset-x-0 z-[60] flex justify-center pointer-events-none">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          title="Open promotional vouchers announcement banner"
          className="pointer-events-auto bg-[#12131A] hover:bg-black text-white/90 hover:text-white px-3.5 py-1 rounded-b-xl border-x border-b border-white/15 shadow-md flex items-center gap-1.5 text-[10px] font-bold transition-all cursor-pointer group animate-blur-in hover:pt-1.5"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#1090F8] animate-ping" />
          <IconTicket className="w-3 h-3 text-[#F59E0B]" />
          <span>Promo Vouchers Available</span>
          <span className="text-[#1090F8] group-hover:translate-y-0.5 transition-transform inline-flex items-center">
            <IconChevronDown className="w-3 h-3" />
          </span>
        </button>
      </div>
    );
  }

  // Repeat vouchers inside single track if few so it fills wide viewports
  const singleTrackItems = vouchers.length < 5
    ? [...vouchers, ...vouchers, ...vouchers]
    : vouchers;

  const renderTrack = (trackKey: string) => (
    <div
      key={trackKey}
      aria-hidden={trackKey === 'track2'}
      className="flex shrink-0 items-center gap-8 pr-8 whitespace-nowrap animate-marquee-infinite group-hover:[animation-play-state:paused]"
    >
      {singleTrackItems.map((v, idx) => {
        const discountText =
          v.discount_type === 'percentage'
            ? `${v.discount_value}% OFF`
            : `₱${v.discount_value.toLocaleString()} OFF`;

        const validityText = !v.is_all_time && v.end_date
          ? `Valid until ${new Date(v.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} only`
          : v.max_uses !== null && v.max_uses > 0
          ? `${Math.max(0, v.max_uses - v.used_count)} checkouts left`
          : 'All-Time Special';

        const isCopied = copiedCode === v.code;

        return (
          <div
            key={`${trackKey}-${v.id}-${idx}`}
            className="inline-flex items-center gap-2 shrink-0 group text-white/80 select-none"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#1090F8] shrink-0 animate-ping" />

            <span className="font-extrabold text-[#F59E0B] tracking-wide">
              {discountText}
            </span>

            <span className="text-white/60 hidden sm:inline">—</span>

            <span className="text-white/85 font-medium truncate max-w-[200px] sm:max-w-none">
              {v.description || 'Special Booking Discount'}
            </span>

            {/* Interactive Voucher Code Chip */}
            <button
              type="button"
              onClick={(e) => handleCopy(e, v.code)}
              title="Click to copy voucher code"
              className={`px-2 py-0.5 rounded-md font-mono font-extrabold text-[10px] tracking-wider transition-all cursor-pointer flex items-center gap-1 border ${
                isCopied
                  ? 'bg-emerald-500 text-white border-emerald-400'
                  : 'bg-white/10 hover:bg-[#1090F8] text-white border-white/15 hover:border-[#1090F8]'
              }`}
            >
              {isCopied ? (
                <>
                  <IconCheck className="w-3 h-3 stroke-[3]" />
                  <span>COPIED!</span>
                </>
              ) : (
                <>
                  <IconTicket className="w-3 h-3" />
                  <span>{v.code}</span>
                </>
              )}
            </button>

            <span className="text-[10px] font-medium text-white/50 bg-white/5 px-2 py-0.5 rounded-full border border-white/5 hidden md:inline">
              {validityText}
            </span>

            <span className="text-white/20 mx-2">✦</span>
          </div>
        );
      })}
    </div>
  );

  return (
    <div
      aria-label="Promotional Vouchers Announcement Marquee"
      className="fixed top-0 inset-x-0 z-[60] bg-[#12131A] text-white border-b border-white/[0.08] shadow-xs overflow-hidden h-7.5 sm:h-8 flex items-center text-[11px] sm:text-xs"
    >
      {/* Left Edge Gradient Fade Mask */}
      <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 sm:w-12 bg-gradient-to-r from-[#12131A] to-transparent z-10" />

      {/* Dual Seamless Tracks: Track 1 and Track 2 run side-by-side for an infinite, gapless loop */}
      <div className="relative flex overflow-hidden w-full select-none group pr-10">
        {renderTrack('track1')}
        {renderTrack('track2')}
      </div>

      {/* Close 'X' Button on the right with dark gradient backdrop */}
      <div className="absolute right-0 top-0 bottom-0 z-20 flex items-center pr-2 sm:pr-3 pl-6 bg-gradient-to-l from-[#12131A] via-[#12131A]/95 to-transparent">
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          title="Close announcement banner"
          className="text-white/60 hover:text-white p-1 hover:bg-white/15 rounded-full transition-colors cursor-pointer flex items-center justify-center"
        >
          <IconX className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
