import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import { IconCalendar, IconPin, IconBox } from '../../components/shared/icons';

export default function BookingHistoryPage({ go }: { go: (p: Page) => void }) {
  const history = [
    { id: 'BNH-889', title: 'Grand Wedding Reception', date: 'Sep 14, 2026', total: '₱29,500', status: 'Confirmed', venue: 'Shangri-La Fort, BGC' },
    { id: 'BNH-502', title: 'Corporate Tech Summit 2025', date: 'Nov 12, 2025', total: '₱55,000', status: 'Completed', venue: 'Marriott Grand Ballroom' },
    { id: 'BNH-104', title: '18th Birthday Debut Staging', date: 'Jun 20, 2025', total: '₱15,000', status: 'Completed', venue: 'Fernwood Gardens, QC' },
  ];

  return (
    <section className="pt-36 pb-24 px-6 min-h-screen bg-white">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-[2rem] p-6 md:p-8 border border-[#24252c]/[0.08] shadow-sm">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#24252c]/[0.06]">
            <div>
              <MonoBadge icon={IconBox}>Booking Records</MonoBadge>
              <h1 className="text-3xl font-extrabold tracking-tight text-[var(--ink)] mt-2">
                Booking History & Official Receipts
              </h1>
              <p className="text-xs text-[#24252c]/60 mt-1">Download official PDF receipts and review past production setups.</p>
            </div>
            <button
              onClick={() => go('packages')}
              className="hidden sm:inline-flex bg-[#1090F8] text-white text-xs font-bold px-5 py-2.5 rounded-full hover:bg-[#1090F8]/90 transition-colors shadow-sm"
            >
              + Book New Event
            </button>
          </div>

          <div className="space-y-4">
            {history.map((item) => (
              <div
                key={item.id}
                className="p-6 rounded-2xl bg-[var(--mist)] border border-[#24252c]/[0.05] flex flex-col md:flex-row md:items-center justify-between gap-5 hover:border-[#1090F8]/30 transition-all"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-[#1090F8]">{item.id}</span>
                    <span
                      className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                        item.status === 'Confirmed'
                          ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                          : 'bg-[#24252c]/10 text-[#24252c]/60'
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                  <h3 className="font-bold text-lg text-[var(--ink)] mt-1.5">{item.title}</h3>
                  <div className="text-xs text-[#24252c]/60 mt-1 flex flex-wrap gap-x-4 gap-y-1">
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
                    onClick={() => alert(`Downloading PDF Invoice for ${item.id}...`)}
                    className="bg-white text-[var(--ink)] border border-[#24252c]/10 text-xs font-semibold px-4 py-2.5 rounded-full hover:bg-[var(--mist)] transition-colors shadow-sm"
                  >
                    Download PDF Receipt
                  </button>
                  {item.status === 'Completed' && (
                    <button
                      onClick={() => go('review-submit')}
                      className="bg-[var(--ink)] text-white text-xs font-semibold px-4 py-2.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors"
                    >
                      Submit Review
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
