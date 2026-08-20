import { useState } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import { IconCalendar, IconPin, IconBox } from '../../components/shared/icons';

export interface AssignedBooking {
  id: string;
  customer: string;
  package: string;
  date: string;
  callTime: string;
  venue: string;
  crewRole: string;
  status: 'Pending Setup' | 'Setup In Progress' | 'Setup Complete' | 'Teardown Complete';
}

export default function CrewAssignedBookingsPage({ go }: { go: (p: Page) => void }) {
  const [filter, setFilter] = useState<'All' | 'Today' | 'Upcoming'>('All');

  const [bookings] = useState<AssignedBooking[]>([
    {
      id: 'BNH-2026-889',
      customer: 'Patricia Reyes',
      package: 'Grand Wedding Production (P3 LED + Line Array)',
      date: 'September 14, 2026',
      callTime: '08:00 AM (Rigging & Cable Run)',
      venue: 'Shangri-La Fort, BGC (Grand Ballroom)',
      crewRole: 'Lead Audio & Rigging Technician',
      status: 'Setup In Progress',
    },
    {
      id: 'BNH-2026-902',
      customer: 'Dennis Gomez',
      package: 'Standard Concert Sound & Lighting Truss',
      date: 'October 5, 2026',
      callTime: '11:00 AM (Stage Setup)',
      venue: 'Blue Leaf Events Pavilion, McKinley',
      crewRole: 'Lighting & Hazer Operator',
      status: 'Pending Setup',
    },
    {
      id: 'BNH-2026-104',
      customer: 'Angela Mercado',
      package: 'Minimalist Sound & Mic Package',
      date: 'June 20, 2026',
      callTime: '02:00 PM (Quick Setup)',
      venue: 'Metropolitan Theater Annex',
      crewRole: 'Sound Engineer',
      status: 'Teardown Complete',
    },
  ]);

  const filtered = bookings.filter((b) => {
    if (filter === 'Today') return b.status === 'Setup In Progress';
    if (filter === 'Upcoming') return b.status === 'Pending Setup';
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#24252c]/[0.06]">
        <div>
          <MonoBadge icon={IconCalendar}>Rigging & Crew Roster</MonoBadge>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ink)] mt-1.5">
            Assigned Event Bookings
          </h1>
          <p className="text-xs text-[#24252c]/60 mt-1">
            Review event assignments, venue call times, required equipment packages, and setup tasks.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 bg-white p-1 rounded-full border border-[#24252c]/10 self-start sm:self-auto text-xs">
          {(['All', 'Today', 'Upcoming'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-4 py-1.5 rounded-full font-semibold transition-all ${
                filter === tab
                  ? 'bg-[var(--ink)] text-white shadow-xs'
                  : 'text-[#24252c]/60 hover:text-[var(--ink)]'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Bookings Grid / Cards */}
      <div className="grid gap-4">
        {filtered.map((b) => (
          <div
            key={b.id}
            className="bg-white rounded-2xl p-5 border border-[#24252c]/[0.08] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:border-[#1090F8]/40"
          >
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono font-extrabold text-xs text-[#1090F8]">{b.id}</span>
                <span
                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${
                    b.status === 'Setup In Progress'
                      ? 'bg-amber-500/10 text-amber-600 border-amber-500/20 animate-pulse'
                      : b.status === 'Setup Complete' || b.status === 'Teardown Complete'
                      ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                      : 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                  }`}
                >
                  {b.status}
                </span>
                <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-[var(--mist)] text-[var(--ink)] border border-[#24252c]/10">
                  Role: {b.crewRole}
                </span>
              </div>

              <div>
                <h3 className="font-extrabold text-base text-[var(--ink)]">{b.package}</h3>
                <p className="text-xs text-[#24252c]/60 mt-0.5">Host / Client: <strong className="text-[var(--ink)]">{b.customer}</strong></p>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#24252c]/70 pt-1">
                <span className="inline-flex items-center gap-1 font-semibold">
                  <IconCalendar className="w-3.5 h-3.5 text-[#1090F8]" />
                  Event Date: {b.date}
                </span>
                <span className="inline-flex items-center gap-1 font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                  Call Time: {b.callTime}
                </span>
                <span className="inline-flex items-center gap-1">
                  <IconPin className="w-3.5 h-3.5 text-[#24252c]/40" />
                  {b.venue}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-[#24252c]/10">
              <button
                onClick={() => go('crew-booking-detail')}
                className="flex-1 md:flex-none bg-[var(--mist)] text-[var(--ink)] text-xs font-semibold px-4 py-2.5 rounded-full border border-[#24252c]/10 hover:bg-[var(--ink)] hover:text-white transition-colors"
              >
                <IconBox className="w-3.5 h-3.5 inline mr-1" />
                Gear Checklist
              </button>
              <button
                onClick={() => go('crew-setup-teardown')}
                className="flex-1 md:flex-none bg-[#1090F8] text-white text-xs font-bold px-4 py-2.5 rounded-full hover:bg-[#1090F8]/90 transition-colors shadow-sm"
              >
                Setup & Teardown →
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
