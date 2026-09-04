import { useState } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import {
  IconCalendar,
  IconPin,
  IconBox,
  IconNavigation,
  IconClock,
} from '../../components/shared/icons';
import { INITIAL_ASSIGNED_BOOKINGS, type AssignedBooking } from '../../data/crewBookings';
import VenueNavigationModal from '../../components/crew/VenueNavigationModal';

export default function CrewAssignedBookingsPage({ go }: { go: (p: Page) => void }) {
  const [filter, setFilter] = useState<'All' | 'Today' | 'Upcoming'>('All');
  const [bookings] = useState<AssignedBooking[]>(INITIAL_ASSIGNED_BOOKINGS);
  const [selectedRouteBooking, setSelectedRouteBooking] = useState<AssignedBooking | null>(null);

  const filtered = bookings.filter((b) => {
    if (filter === 'Today') return b.status === 'Setup In Progress';
    if (filter === 'Upcoming') return b.status === 'Pending Setup';
    return true;
  });

  const handleSelectBookingGear = (bookingId: string) => {
    sessionStorage.setItem('crew_selected_booking_id', bookingId);
    go('crew-booking-detail');
  };

  const handleSelectBookingSetup = (bookingId: string) => {
    sessionStorage.setItem('crew_selected_booking_id', bookingId);
    go('crew-setup-teardown');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#24252c]/[0.06]">
        <div>
          <MonoBadge icon={IconCalendar}>Rigging & Crew Roster</MonoBadge>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ink)] mt-1.5">
            Assigned Event Bookings
          </h1>
          <p className="text-xs text-[#24252c]/60 mt-1">
            Review event assignments, venue call times, direct GPS navigation routes, and setup tasks.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 bg-white p-1 rounded-full border border-[#24252c]/10 self-start sm:self-auto text-xs">
          {(['All', 'Today', 'Upcoming'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-4 py-1.5 rounded-full font-semibold transition-all cursor-pointer ${
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
            className="bg-white rounded-2xl p-5 border border-[#24252c]/[0.08] shadow-sm flex flex-col gap-4 transition-all hover:border-[#1090F8]/40"
          >
            {/* Top row: Badges and Details */}
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
              <div className="space-y-2 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-extrabold text-xs text-[#1090F8] bg-[#1090F8]/10 px-2 py-0.5 rounded-md">
                    {b.id}
                  </span>
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
                  <p className="text-xs text-[#24252c]/60 mt-0.5">
                    Host / Client: <strong className="text-[var(--ink)]">{b.customer}</strong>
                  </p>
                </div>

                {/* Date & Time Metadata */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#24252c]/70 pt-0.5">
                  <span className="inline-flex items-center gap-1 font-semibold">
                    <IconCalendar className="w-3.5 h-3.5 text-[#1090F8]" />
                    Event Date: {b.date}
                  </span>
                  <span className="inline-flex items-center gap-1 font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                    <IconClock className="w-3 h-3 text-amber-600 inline mr-0.5" />
                    Call Time: {b.callTime}
                  </span>
                </div>

                {/* Venue & Ingress Info Card */}
                <div className="p-3 bg-[var(--mist)] rounded-xl border border-[#24252c]/[0.06] text-xs space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-1.5">
                      <IconPin className="w-4 h-4 text-[#1090F8] shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-[var(--ink)] block">{b.venue}</span>
                        <span className="text-[#24252c]/65 text-[11px] block">{b.venueAddress}</span>
                      </div>
                    </div>
                  </div>

                  {/* Loading bay snippet */}
                  <div className="text-[11px] text-amber-900 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/15">
                    <strong>Logistics Ingress:</strong> {b.loadingBayNote}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row lg:flex-col gap-2 shrink-0 lg:w-48">
                <button
                  onClick={() => handleSelectBookingGear(b.id)}
                  className="w-full bg-[var(--mist)] text-[var(--ink)] text-xs font-semibold px-4 py-2.5 rounded-full border border-[#24252c]/10 hover:bg-[var(--ink)] hover:text-white transition-colors cursor-pointer text-center"
                >
                  <IconBox className="w-3.5 h-3.5 inline mr-1" />
                  Gear Checklist
                </button>
                <button
                  onClick={() => handleSelectBookingSetup(b.id)}
                  className="w-full bg-[#1090F8] text-white text-xs font-bold px-4 py-2.5 rounded-full hover:bg-[#1090F8]/90 transition-colors shadow-sm cursor-pointer text-center"
                >
                  Setup & Teardown →
                </button>
              </div>
            </div>

            {/* ROUTE MAP BUTTON BAR */}
            <div className="pt-3 border-t border-[#24252c]/[0.06] flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs text-[#24252c]/60 font-semibold">
                <IconNavigation className="w-3.5 h-3.5 text-[#1090F8]" />
                <span className="text-[11px] uppercase tracking-wider">Venue Directions:</span>
              </div>

              {/* Interactive Route Map Modal Launcher */}
              <button
                onClick={() => setSelectedRouteBooking(b)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white hover:bg-[#1090F8]/10 text-[var(--ink)] hover:text-[#1090F8] border border-[#24252c]/15 hover:border-[#1090F8]/40 text-xs font-bold transition-all shadow-2xs cursor-pointer group"
              >
                <IconPin className="w-3.5 h-3.5 text-[#1090F8] group-hover:scale-110 transition-transform" />
                <span>View Route on Map →</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Interactive Leaflet Navigation Route Modal with Waze and Google Maps Inside */}
      <VenueNavigationModal
        booking={selectedRouteBooking}
        isOpen={Boolean(selectedRouteBooking)}
        onClose={() => setSelectedRouteBooking(null)}
      />
    </div>
  );
}
