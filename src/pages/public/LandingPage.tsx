import type { Page } from '../../types';
import { FEATURED_PACKAGES } from '../../data/packages';
import { INVENTORY_PREVIEW } from '../../data/equipment';
import { MonoBadge, MonoBadgeDark } from '../../components/shared/Badges';
import { IconArrow, IconCalendar, IconTicket } from '../../components/shared/icons';
import { TestimonialsSection } from '../../components/shared/TestimonialsSection';

export default function LandingPage({
  go,
  goPackageDetail,
}: {
  go: (p: Page) => void;
  goPackageDetail: (id: string) => void;
}) {
  return (
    <>
      <section className="pt-40 pb-16 px-6 text-center">
        <div className="rise-in inline-block">
          <MonoBadge icon={IconCalendar}>Booking open for 2026 events</MonoBadge>
        </div>

        <h1 className="rise-in rise-in-delay-1 mt-6 font-extrabold tracking-tight leading-[0.98] text-[var(--ink)]" style={{ fontSize: 'clamp(2.6rem, 6vw, 4.6rem)' }}>
          Event production,
          <br />
          booked in one sitting.
        </h1>

        <p className="rise-in rise-in-delay-2 mt-6 max-w-xl mx-auto text-base leading-relaxed text-[#24252c]/60">
          Skip the Facebook Messenger back-and-forth. Browse real packages, customize the equipment,
          and lock in your date — all in one place.
        </p>

        <div className="rise-in rise-in-delay-3 mt-8 flex items-center justify-center gap-3 flex-wrap">
          <button
            onClick={() => go('signup')}
            className="inline-flex items-center gap-2 bg-[var(--ink)] text-white text-sm font-semibold px-6 py-3.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors"
          >
            Start booking
            <IconArrow className="w-4 h-4" />
          </button>
          <button
            onClick={() => go('contact')}
            className="bg-white border border-[#24252c]/10 text-sm font-semibold px-6 py-3.5 rounded-full hover:bg-[var(--mist)] transition-colors"
          >
            Talk to us
          </button>
        </div>
      </section>

      <section className="px-6 pb-20">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-5">
          <div className="bg-[var(--mist)] rounded-[2rem] p-6 md:p-8">
            <div className="bg-white rounded-2xl shadow-sm border border-[#24252c]/[0.06] p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold">September 2026</span>
                <span className="text-xs text-[#24252c]/40">Booking calendar</span>
              </div>
              <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] text-[#24252c]/40 mb-1.5">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                  <span key={i}>{d}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {Array.from({ length: 30 }).map((_, i) => {
                  const day = i + 1;
                  const isBooked = day === 14 || day === 21;
                  const isToday = day === 8;
                  return (
                    <div
                      key={i}
                      className={`aspect-square rounded-lg text-[11px] flex items-center justify-center ${
                        isBooked
                          ? 'bg-[var(--ink)] text-white font-semibold'
                          : isToday
                          ? 'border-2 border-[#1090F8] text-[#1090F8] font-semibold'
                          : 'bg-[var(--mist)] text-[#24252c]/50'
                      }`}
                    >
                      {day}
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-4 mt-4 text-[11px] text-[#24252c]/50">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[var(--ink)]" /> Reserved</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full border-2 border-[#1090F8]" /> Today</span>
              </div>
            </div>
            <h3 className="font-semibold mt-6 text-base">See real availability, not "let me check"</h3>
            <p className="text-sm text-[#24252c]/55 mt-1.5 leading-relaxed">
              Every date reflects actual crew and equipment availability — no waiting on a reply to find out it's taken.
            </p>
          </div>

          <div className="bg-[var(--ink)] text-white rounded-[2rem] p-6 md:p-8">
            <div className="bg-white/[0.06] border border-white/10 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold">Equipment inventory</span>
                <span className="text-xs text-white/40">Live status</span>
              </div>
              <div className="flex flex-col divide-y divide-white/[0.08]">
                {INVENTORY_PREVIEW.map((item) => (
                  <div key={item.name} className="flex items-center justify-between py-2.5 text-sm">
                    <span className="text-white/85">{item.name}</span>
                    <span className="flex items-center gap-1.5 text-[11px] text-white/50">
                      <span className={`w-1.5 h-1.5 rounded-full ${item.dot}`} />
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <h3 className="font-semibold mt-6 text-base">Every unit tracked, nothing double-booked</h3>
            <p className="text-sm text-white/55 mt-1.5 leading-relaxed">
              The LED wall on your date is the same LED wall in our warehouse — not a promise made twice.
            </p>
          </div>
        </div>
      </section>

      <section className="px-6 pb-24">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <MonoBadge icon={IconTicket}>Featured packages</MonoBadge>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mt-3">Pick a starting point</h2>
            <p className="text-[#24252c]/55 mt-2 text-base">Every package is fully customizable with add-ons after you pick one.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {FEATURED_PACKAGES.map((pkg) => (
              <div
                key={pkg.id}
                onClick={() => goPackageDetail(pkg.id)}
                className="group rounded-[1.75rem] border border-[#24252c]/[0.07] overflow-hidden bg-white hover:shadow-[0_20px_40px_-20px_rgba(0,0,0,.18)] transition-all cursor-pointer"
              >
                <div className="aspect-[4/3] overflow-hidden bg-[var(--mist)]">
                  <img src={pkg.img} alt={pkg.name} className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500" />
                </div>
                <div className="ticket-notch ticket-dash px-5 pt-4 pb-2 flex items-center justify-between">
                  <span className="text-[11px] mono uppercase tracking-widest text-[var(--muted-2)]">{pkg.tag}</span>
                  <span className="text-sm font-bold">{pkg.price}</span>
                </div>
                <div className="px-5 pb-5 pt-2">
                  <h3 className="font-semibold text-base">{pkg.name}</h3>
                  <p className="text-sm text-[#24252c]/55 mt-1.5 leading-relaxed">{pkg.desc}</p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      goPackageDetail(pkg.id);
                    }}
                    className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#1090F8] hover:gap-2.5 transition-all"
                  >
                    View package <IconArrow className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <TestimonialsSection />

      <div className="my-16 md:my-24 px-6">
        <div className="max-w-5xl mx-auto bg-[#161823] text-white rounded-[2.5rem] px-8 py-16 md:py-20 text-center shadow-xl">
          <MonoBadgeDark>Get started</MonoBadgeDark>
          <h2 className="mt-6 font-extrabold tracking-tight leading-[1.02]" style={{ fontSize: 'clamp(2rem, 5vw, 3.2rem)' }}>
            Let's lock in your event date.
          </h2>
          <p className="mt-4 text-white/55 max-w-md mx-auto text-base">
            Create an account to browse the full catalog, save packages, and check your event date instantly.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
            <button
              onClick={() => go('signup')}
              className="bg-white text-[var(--ink)] text-sm font-semibold px-6 py-3.5 rounded-full inline-flex items-center gap-2 hover:bg-white/90 transition-colors"
            >
              Create account <IconArrow className="w-4 h-4" />
            </button>
            <button
              onClick={() => go('contact')}
              className="border border-white/25 text-sm font-semibold px-6 py-3.5 rounded-full hover:bg-white/10 transition-colors"
            >
              Ask a question
            </button>
          </div>
        </div>
      </div>
    </>
  );
}