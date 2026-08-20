import React from 'react';

/* ------------------------------------------------------------------ */
/*  Phase 2 — Customer Dashboard UI / UX Components (Preserved Backup) */
/* ------------------------------------------------------------------ */

export function CustomerPortalLayout({
  activeTab,
  go,
  children,
}: {
  activeTab: string;
  go: (p: string) => void;
  children: React.ReactNode;
}) {
  const tabs = [
    { id: 'booking-tracker', label: 'Active Booking Tracker' },
    { id: 'booking-history', label: 'Booking History' },
    { id: 'wishlist', label: 'Saved Wishlist' },
    { id: 'loyalty', label: 'Loyalty Rewards' },
    { id: 'review-submit', label: 'Submit Review' },
    { id: 'profile', label: 'Account Settings' },
  ];

  return (
    <section className="pt-36 pb-24 px-6 min-h-screen bg-white">
      <div className="max-w-5xl mx-auto">
        <div className="bg-[#161823] text-white rounded-[2.5rem] p-6 md:p-8 mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xl">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#1090F8] text-white font-extrabold text-xl flex items-center justify-center shrink-0 shadow-lg">
              JD
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-extrabold text-white">Juan Dela Cruz</h2>
                <span className="text-[11px] font-bold uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/30 px-3 py-0.5 rounded-full">
                  ★ VIP Gold Member
                </span>
              </div>
              <p className="text-xs text-white/60 mt-1">
                Active Booking: <span className="text-white font-semibold">Grand Wedding Reception (Sep 14, 2026)</span>
              </p>
            </div>
          </div>

          <button
            onClick={() => go('packages')}
            className="bg-[#1090F8] text-white text-xs font-semibold px-5 py-3 rounded-full hover:bg-[#1090F8]/90 transition-colors inline-flex items-center gap-1.5 shadow-md"
          >
            + Book Another Event
          </button>
        </div>

        <div className="flex justify-center gap-2 mb-8 flex-wrap">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => go(tab.id)}
              className={`text-xs px-4 py-2.5 rounded-full font-semibold transition-all ${
                activeTab === tab.id
                  ? 'bg-[var(--ink)] text-white shadow-sm'
                  : 'bg-[var(--mist)] text-[#24252c]/60 hover:text-[var(--ink)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {children}
      </div>
    </section>
  );
}

export function BookingTrackerView({ go }: { go: (p: string) => void }) {
  const steps = [
    { title: 'Reservation Deposit Uploaded', status: 'Completed', date: 'Aug 18, 2026', done: true },
    { title: 'Date Locked & Crew Assigned', status: 'Completed', date: 'Aug 19, 2026', done: true },
    { title: 'Warehouse Equipment Pre-Check', status: 'In Progress', date: 'Sep 13, 2026', current: true },
    { title: 'Logistics Transport & Venue Rigging', status: 'Scheduled', date: 'Sep 14, 1:00 PM', done: false },
    { title: 'Event Execution & Soundcheck', status: 'Scheduled', date: 'Sep 14, 4:00 PM', done: false },
  ];

  return (
    <div className="bg-white rounded-[2rem] p-6 md:p-8 border border-[#24252c]/[0.08]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#24252c]/[0.06]">
        <div>
          <span className="inline-block bg-[var(--mist)] px-3 py-1 rounded-full text-xs font-mono text-[#24252c]/60">Booking Ref #BNH-2026-889</span>
          <h2 className="text-2xl font-extrabold mt-2">Grand Wedding Reception</h2>
          <p className="text-xs text-[#24252c]/60 mt-1">Package C — Grand + Custom Low Fog Addition</p>
        </div>
        <div className="text-right">
          <span className="inline-block bg-emerald-500/10 text-emerald-600 font-bold text-xs px-3.5 py-1.5 rounded-full border border-emerald-500/20">
            ● Confirmed & Date Secured
          </span>
          <div className="text-xs text-[#24252c]/50 mt-1">Event Date: Sep 14, 2026</div>
        </div>
      </div>

      <div className="mt-8">
        <h3 className="text-sm font-bold uppercase tracking-wider text-[#24252c]/40 mb-6">
          Live Setup Progress Timeline
        </h3>
        <div className="space-y-4">
          {steps.map((step, i) => (
            <div key={i} className="flex items-start gap-4">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                  step.done
                    ? 'bg-emerald-500 text-white'
                    : step.current
                    ? 'bg-[#1090F8] text-white ring-4 ring-[#1090F8]/20'
                    : 'bg-[var(--mist)] text-[#24252c]/40'
                }`}
              >
                {step.done ? '✓' : i + 1}
              </div>
              <div className="flex-1 pb-4 border-b border-[#24252c]/[0.04]">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm text-[var(--ink)]">{step.title}</h4>
                  <span className="text-xs font-medium text-[#24252c]/50">{step.date}</span>
                </div>
                <p className="text-xs text-[#24252c]/60 mt-1">{step.status}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 p-5 rounded-2xl bg-[var(--mist)] flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[var(--ink)] text-white font-bold text-xs flex items-center justify-center">
            RM
          </div>
          <div>
            <div className="text-xs font-bold text-[var(--ink)]">Lead Sound Engineer: Raymund M.</div>
            <div className="text-[11px] text-[#24252c]/50">Assigned Crew: 5 Technicians · Warehouse Unit A</div>
          </div>
        </div>
        <button
          onClick={() => go('contact')}
          className="bg-white border border-[#24252c]/10 text-xs font-semibold px-4 py-2 rounded-full hover:bg-[var(--mist)] transition-colors"
        >
          Contact On-Site Lead
        </button>
      </div>
    </div>
  );
}

export function BookingHistoryView({ go }: { go: (p: string) => void }) {
  const history = [
    { id: 'BNH-889', title: 'Grand Wedding Reception', date: 'Sep 14, 2026', total: '₱29,500', status: 'Confirmed' },
    { id: 'BNH-502', title: 'Corporate Tech Summit 2025', date: 'Nov 12, 2025', total: '₱55,000', status: 'Completed' },
    { id: 'BNH-104', title: '18th Birthday Debut Staging', date: 'Jun 20, 2025', total: '₱15,000', status: 'Completed' },
  ];

  return (
    <div className="bg-white rounded-[2rem] p-6 md:p-8 border border-[#24252c]/[0.08]">
      <h2 className="text-2xl font-extrabold mb-1">Booking History & Official Receipts</h2>
      <p className="text-xs text-[#24252c]/60 mb-6">Download invoices and review past production setups.</p>

      <div className="space-y-4">
        {history.map((item) => (
          <div key={item.id} className="p-5 rounded-2xl bg-[var(--mist)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#1090F8]">{item.id}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-bold">
                  {item.status}
                </span>
              </div>
              <h3 className="font-bold text-base text-[var(--ink)] mt-1">{item.title}</h3>
              <div className="text-xs text-[#24252c]/50 mt-1">Date: {item.date} · Total: {item.total}</div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => alert(`Downloading PDF Invoice for ${item.id}...`)}
                className="bg-white border border-[#24252c]/10 text-xs font-semibold px-4 py-2 rounded-full hover:bg-[var(--mist)] transition-colors"
              >
                Download PDF Receipt
              </button>
              {item.status === 'Completed' && (
                <button
                  onClick={() => go('review-submit')}
                  className="bg-[var(--ink)] text-white text-xs font-semibold px-4 py-2 rounded-full hover:bg-[var(--ink-soft)] transition-colors"
                >
                  Submit Review
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LoyaltyView() {
  return (
    <div className="bg-white rounded-[2rem] p-6 md:p-8 border border-[#24252c]/[0.08]">
      <h2 className="text-2xl font-extrabold mb-1">Loyalty & VIP Rewards</h2>
      <p className="text-xs text-[#24252c]/60 mb-6">Earn points on every event booking and redeem free equipment add-ons.</p>

      <div className="bg-[#161823] text-white rounded-2xl p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-xs text-white/50 uppercase tracking-wider">Current Status</div>
            <div className="text-xl font-extrabold text-amber-300">★ VIP Gold Host Member</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-white/50 uppercase tracking-wider">Points Balance</div>
            <div className="text-2xl font-extrabold text-[#1090F8]">1,450 PTS</div>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-white/60">
            <span>Progress to Platinum Rank</span>
            <span>1,450 / 2,000 PTS</span>
          </div>
          <div className="h-2 rounded-full bg-white/20 overflow-hidden">
            <div className="h-full bg-[#1090F8] rounded-full w-[72%]" />
          </div>
        </div>
      </div>

      <h3 className="text-sm font-bold uppercase tracking-wider text-[#24252c]/40 mb-4">
        Redeemable Equipment Upgrades
      </h3>
      <div className="grid sm:grid-cols-2 gap-4">
        {[
          { title: 'Free Low Fog Cloud Machine', pts: '300 PTS', desc: 'Complimentary bridal entrance cloud effect unit.' },
          { title: '₱2,000 Off P3 LED Wall Upgrade', pts: '500 PTS', desc: 'Discount applied to any Package C setup.' },
        ].map((r, i) => (
          <div key={i} className="p-5 rounded-2xl bg-[var(--mist)] flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-[#1090F8]">{r.pts}</span>
              <h4 className="font-bold text-base text-[var(--ink)] mt-1">{r.title}</h4>
              <p className="text-xs text-[#24252c]/60 mt-1">{r.desc}</p>
            </div>
            <button
              onClick={() => alert(`Redeemed ${r.title}!`)}
              className="mt-4 bg-[var(--ink)] text-white text-xs font-semibold py-2.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors"
            >
              Redeem Reward
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProfileView() {
  return (
    <div className="bg-white rounded-[2rem] p-6 md:p-8 border border-[#24252c]/[0.08]">
      <h2 className="text-2xl font-extrabold mb-1">Account & Profile Settings</h2>
      <p className="text-xs text-[#24252c]/60 mb-6">Manage contact information and default venue preferences.</p>

      <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50 ml-1 block mb-1">First Name</label>
            <input defaultValue="Juan" className="w-full rounded-full border border-transparent px-4 py-3 text-sm bg-[var(--mist)] text-[var(--ink)]" />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50 ml-1 block mb-1">Last Name</label>
            <input defaultValue="Dela Cruz" className="w-full rounded-full border border-transparent px-4 py-3 text-sm bg-[var(--mist)] text-[var(--ink)]" />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50 ml-1 block mb-1">Email Address</label>
          <input defaultValue="juan.delacruz@gmail.com" className="w-full rounded-full border border-transparent px-4 py-3 text-sm bg-[var(--mist)] text-[var(--ink)]" />
        </div>

        <button type="submit" className="bg-[var(--ink)] text-white text-xs font-semibold px-6 py-3.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors">
          Save Profile Updates
        </button>
      </form>
    </div>
  );
}
