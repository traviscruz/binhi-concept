import { useState } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import { IconTicket, IconCalendar, IconPin, IconX } from '../../components/shared/icons';

const historyItems = [
  {
    id: 'BNH-2026-889',
    package: 'Standard Production Setup',
    date: 'September 14, 2026',
    venue: 'Shangri-La Fort, BGC',
    total: '₱33,500',
    status: 'Upcoming',
    statusColor: 'bg-[#1090F8]/10 text-[#1090F8] border-[#1090F8]/20',
  },
  {
    id: 'BNH-2026-104',
    package: 'Minimalist Sound & Mic Package',
    date: 'June 20, 2026',
    venue: 'Blue Leaf Events Pavilion',
    total: '₱14,500',
    status: 'Completed',
    statusColor: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  },
];

export default function BookingHistoryPage({ go }: { go: (p: Page) => void }) {
  const [downloadModalItem, setDownloadModalItem] = useState<string | null>(null);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <div>
        <MonoBadge icon={IconTicket}>Booking Records</MonoBadge>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ink)] mt-1.5">
          Booking History & Receipts
        </h1>
        <p className="text-xs text-[#24252c]/60 mt-1">
          View all past and upcoming event reservations, invoices, and payment receipts.
        </p>
      </div>

      <div className="space-y-4">
        {historyItems.map((item) => (
          <div
            key={item.id}
            className="bg-white rounded-2xl p-5 border border-[#24252c]/[0.08] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5">
                <span className="font-mono font-bold text-xs text-[#1090F8]">{item.id}</span>
                <span
                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${item.statusColor}`}
                >
                  {item.status}
                </span>
              </div>
              <h3 className="font-bold text-base text-[var(--ink)]">{item.package}</h3>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#24252c]/60">
                <span className="inline-flex items-center gap-1">
                  <IconCalendar className="w-3.5 h-3.5 text-[#24252c]/40" />
                  {item.date}
                </span>
                <span className="inline-flex items-center gap-1">
                  <IconPin className="w-3.5 h-3.5 text-[#24252c]/40" />
                  {item.venue}
                </span>
                <span>Total: <strong className="text-[var(--ink)]">{item.total}</strong></span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                onClick={() => setDownloadModalItem(item.id)}
                className="bg-white text-[var(--ink)] border border-[#24252c]/10 text-xs font-semibold px-4 py-2.5 rounded-full hover:bg-[var(--mist)] transition-colors shadow-sm"
              >
                Download PDF Receipt
              </button>
              {item.status === 'Completed' && (
                <button
                  onClick={() => go('review-submit')}
                  className="bg-[var(--ink)] text-white text-xs font-semibold px-4 py-2.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors"
                >
                  Leave Review
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {downloadModalItem && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-blur-in">
          <div className="bg-white rounded-[2rem] p-6 max-w-sm w-full shadow-2xl border border-[#24252c]/10 relative text-center">
            <button onClick={() => setDownloadModalItem(null)} className="absolute top-5 right-5 text-[#24252c]/50 hover:text-[var(--ink)] p-1">
              <IconX className="w-5 h-5" />
            </button>
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 font-extrabold text-xl flex items-center justify-center mx-auto mb-3 border border-emerald-200">
              ✓
            </div>
            <h3 className="text-lg font-extrabold text-[var(--ink)] mb-1">Receipt PDF Downloaded</h3>
            <p className="text-xs text-[#24252c]/60 mb-5">
              Official BINHI Tax Invoice & Receipt for <strong className="text-[var(--ink)] font-mono">{downloadModalItem}</strong> has been saved to your device.
            </p>
            <button
              onClick={() => setDownloadModalItem(null)}
              className="w-full bg-[var(--ink)] text-white font-semibold py-3 rounded-full hover:bg-[var(--ink-soft)] transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
