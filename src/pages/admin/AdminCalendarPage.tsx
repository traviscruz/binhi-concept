import { useState } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import { IconCalendar } from '../../components/shared/icons';

export default function AdminCalendarPage({ go }: { go: (p: Page) => void }) {
  const [selectedMonth, setSelectedMonth] = useState('September 2026');

  const events = [
    { day: 14, title: "Juan Dela Cruz's Wedding", package: 'Standard Production Setup', venue: 'Shangri-La Fort, BGC', status: 'Confirmed' },
    { day: 21, title: 'Corporate Annual Gala', package: 'Minimalist Sound Package', venue: 'Makati Diamond Residences', status: 'Confirmed' },
    { day: 28, title: '18th Birthday Debut', package: 'Standard Production Setup', venue: 'Alabang Country Club', status: 'Pending Deposit' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#24252c]/[0.06]">
        <div>
          <MonoBadge icon={IconCalendar}>System Master Calendar</MonoBadge>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ink)] mt-1.5">
            2026 Event Production Schedule
          </h1>
          <p className="text-xs text-[#24252c]/60 mt-1">
            Master calendar of all confirmed, pending, and rigged event setups across the Philippines.
          </p>
        </div>

        <button
          onClick={() => go('admin-bookings')}
          className="bg-[var(--mist)] text-[var(--ink)] border border-[#24252c]/10 text-xs font-bold px-4 py-2.5 rounded-full hover:bg-[var(--ink)] hover:text-white transition-colors self-start sm:self-auto"
        >
          View Bookings List
        </button>
      </div>

      <div className="bg-white rounded-2xl p-6 border border-[#24252c]/[0.08] shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-extrabold text-lg text-[var(--ink)]">{selectedMonth}</h3>
          <div className="flex gap-2">
            <button onClick={() => setSelectedMonth('August 2026')} className="text-xs font-bold px-3 py-1.5 rounded-full bg-[var(--mist)] hover:bg-[var(--ink)] hover:text-white transition-colors">
              ← Prev
            </button>
            <button onClick={() => setSelectedMonth('October 2026')} className="text-xs font-bold px-3 py-1.5 rounded-full bg-[var(--mist)] hover:bg-[var(--ink)] hover:text-white transition-colors">
              Next →
            </button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-[#24252c]/50 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="py-1">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 30 }).map((_, i) => {
            const dayNum = i + 1;
            const event = events.find((e) => e.day === dayNum);

            return (
              <div
                key={i}
                className={`min-h-[80px] p-2 rounded-xl border text-left flex flex-col justify-between transition-all ${
                  event
                    ? 'bg-[#1090F8]/10 border-[#1090F8]/40 shadow-sm'
                    : 'bg-[var(--mist)] border-transparent'
                }`}
              >
                <span className={`text-xs font-bold ${event ? 'text-[#1090F8]' : 'text-[#24252c]/60'}`}>{dayNum}</span>
                {event && (
                  <div>
                    <div className="text-[10px] font-extrabold text-[var(--ink)] leading-tight truncate">{event.title}</div>
                    <div className="text-[9px] text-[#1090F8] font-semibold truncate mt-0.5">{event.venue}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
