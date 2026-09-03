import type { ManualBookingSuccessData } from './types';
import { IconCheck } from '../../shared/icons';

interface ManualBookingSuccessProps {
  data: ManualBookingSuccessData;
  onGoToBookings: () => void;
  onBookAnother: () => void;
}

export function ManualBookingSuccess({
  data,
  onGoToBookings,
  onBookAnother,
}: ManualBookingSuccessProps) {
  return (
    <div className="py-8 px-4 sm:px-8 max-w-2xl mx-auto space-y-6">
      <div className="bg-white rounded-[2.5rem] p-8 sm:p-10 border border-[#24252c]/[0.08] shadow-sm text-center space-y-5 animate-blur-in">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-2">
          <IconCheck className="w-8 h-8 stroke-[3]" />
        </div>

        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-[var(--ink)]">Manual Booking Confirmed!</h2>
          <p className="text-xs sm:text-sm text-[#24252c]/60 mt-1.5">
            The reservation is now registered and blocked on the master event calendar.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-[var(--mist)] border border-[#24252c]/[0.08] text-xs space-y-2.5 text-left">
          <div className="flex justify-between items-center pb-2 border-b border-[#24252c]/[0.06]">
            <span className="text-[#24252c]/50 uppercase tracking-wider font-semibold text-[10px]">Reference Number:</span>
            <span className="font-mono font-extrabold text-[#1090F8] text-sm">{data.ref}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#24252c]/50">Customer:</span>
            <span className="font-bold text-[var(--ink)]">{data.customer}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#24252c]/50">Booking Channel:</span>
            <span className="font-bold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200 text-[11px]">
              {data.channel}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#24252c]/50">Package:</span>
            <span className="font-semibold text-[var(--ink)]">{data.package}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#24252c]/50">Event Date:</span>
            <span className="font-semibold text-[var(--ink)]">{data.date}</span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-[#24252c]/[0.06]">
            <span className="text-[#24252c]/50">Total Event Cost:</span>
            <span className="font-extrabold text-[var(--ink)] text-sm">₱{data.total.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-emerald-700 font-bold">Amount Paid (Proof Attached):</span>
            <span className="font-black text-emerald-600 text-sm">₱{data.paid.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#24252c]/50">Remaining Balance:</span>
            <span className="font-bold text-[#1090F8]">
              {data.isFull ? '₱0 (Fully Settled)' : `₱${data.balance.toLocaleString()}`}
            </span>
          </div>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            onClick={onGoToBookings}
            className="bg-[#1090F8] text-white text-xs font-bold px-8 py-3.5 rounded-full hover:bg-[#1090F8]/90 transition-colors shadow-md cursor-pointer"
          >
            Back to Bookings Manager
          </button>
          <button
            type="button"
            onClick={onBookAnother}
            className="bg-[var(--mist)] text-[var(--ink)] text-xs font-semibold px-6 py-3.5 rounded-full border border-[#24252c]/10 hover:bg-black/5 transition-colors cursor-pointer"
          >
            Book Another Client
          </button>
        </div>
      </div>
    </div>
  );
}
