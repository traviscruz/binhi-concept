import { useState, useEffect } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import {
  IconCalendar,
  IconPin,
  IconBox,
  IconNavigation,
  IconClock,
  IconShield,
} from '../../components/shared/icons';
import type { AssignedBooking } from '../../data/crewBookings';
import VenueNavigationModal from '../../components/crew/VenueNavigationModal';
import { fetchAssignedBookingsForCurrentCrew } from '../../utils/crewService';
import { supabase } from '../../utils/supabase';

export default function CrewAssignedBookingsPage({ go }: { go: (p: Page) => void }) {
  const [filter, setFilter] = useState<'All' | 'Today' | 'Upcoming'>('All');
  const [bookings, setBookings] = useState<AssignedBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [crewInfo, setCrewInfo] = useState<{ fullName: string; role: string } | null>(null);
  const [selectedRouteBooking, setSelectedRouteBooking] = useState<AssignedBooking | null>(null);

  const loadAssignedBookings = async () => {
    try {
      const { bookings: fetched, currentUser } = await fetchAssignedBookingsForCurrentCrew();
      setBookings(fetched);
      if (currentUser) {
        setCrewInfo({ fullName: currentUser.fullName, role: currentUser.role });
      }
    } catch (err) {
      console.error('Failed to load assigned bookings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssignedBookings();

    // Listen to real-time changes in bookings table (e.g. admin assigns crew)
    const channel = supabase
      .channel('crew-assigned-bookings-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        () => {
          loadAssignedBookings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Filter evaluation helpers
  const isTodayEvent = (b: AssignedBooking): boolean => {
    if (b.status === 'Setup In Progress') return true;

    const now = new Date();
    const todayYmd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    if (b.rawDate) {
      const rawClean = b.rawDate.split('T')[0];
      if (rawClean === todayYmd) return true;
    }

    const todayFormatted = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    if (b.date && b.date.toLowerCase().trim() === todayFormatted.toLowerCase().trim()) {
      return true;
    }

    return false;
  };

  const isUpcomingEvent = (b: AssignedBooking): boolean => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    if (b.rawDate) {
      const rawClean = b.rawDate.split('T')[0];
      const parts = rawClean.split('-');
      if (parts.length === 3) {
        const eventDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        if (!isNaN(eventDate.getTime())) {
          return eventDate >= now && b.status !== 'Teardown Complete';
        }
      }
    }

    // Default to true if not yet completed/past
    return b.status === 'Pending Setup' || b.status === 'Setup In Progress';
  };

  const todayBookingsCount = bookings.filter(isTodayEvent).length;
  const upcomingBookingsCount = bookings.filter(isUpcomingEvent).length;

  const filtered = bookings.filter((b) => {
    if (filter === 'Today') return isTodayEvent(b);
    if (filter === 'Upcoming') return isUpcomingEvent(b);
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
            {crewInfo ? (
              <span>
                Viewing assigned events for <strong className="text-[var(--ink)]">{crewInfo.fullName}</strong>. Review venue call times, direct GPS navigation routes, and setup tasks.
              </span>
            ) : (
              'Review event assignments, venue call times, direct GPS navigation routes, and setup tasks.'
            )}
          </p>
        </div>

        {/* Filter Pills with Live Database Counts */}
        <div className="flex items-center gap-1.5 bg-white p-1 rounded-full border border-[#24252c]/10 self-start sm:self-auto text-xs">
          <button
            onClick={() => setFilter('All')}
            className={`px-3.5 py-1.5 rounded-full font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              filter === 'All'
                ? 'bg-[var(--ink)] text-white shadow-xs'
                : 'text-[#24252c]/60 hover:text-[var(--ink)]'
            }`}
          >
            <span>All</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${filter === 'All' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>
              {bookings.length}
            </span>
          </button>

          <button
            onClick={() => setFilter('Today')}
            className={`px-3.5 py-1.5 rounded-full font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              filter === 'Today'
                ? 'bg-[var(--ink)] text-white shadow-xs'
                : 'text-[#24252c]/60 hover:text-[var(--ink)]'
            }`}
          >
            <span>Today</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${filter === 'Today' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>
              {todayBookingsCount}
            </span>
          </button>

          <button
            onClick={() => setFilter('Upcoming')}
            className={`px-3.5 py-1.5 rounded-full font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              filter === 'Upcoming'
                ? 'bg-[var(--ink)] text-white shadow-xs'
                : 'text-[#24252c]/60 hover:text-[var(--ink)]'
            }`}
          >
            <span>Upcoming</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${filter === 'Upcoming' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'}`}>
              {upcomingBookingsCount}
            </span>
          </button>
        </div>
      </div>

      {/* Loading Skeletons */}
      {loading ? (
        <div className="grid gap-4">
          {[1, 2].map((n) => (
            <div key={n} className="bg-white rounded-2xl p-6 border border-[#24252c]/10 animate-pulse space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-5 w-24 bg-black/10 rounded-md" />
                <div className="h-5 w-28 bg-black/10 rounded-full" />
              </div>
              <div className="h-6 w-3/4 bg-black/10 rounded-lg" />
              <div className="h-16 w-full bg-black/5 rounded-xl" />
            </div>
          ))}
        </div>
      ) : bookings.length === 0 ? (
        /* Empty state when no bookings are assigned to this crew member */
        <div className="bg-white rounded-3xl p-8 sm:p-12 text-center border border-[#24252c]/10 shadow-sm space-y-4 max-w-xl mx-auto my-6">
          <div className="w-14 h-14 rounded-full bg-[#1090F8]/10 text-[#1090F8] flex items-center justify-center mx-auto border border-[#1090F8]/20">
            <IconShield className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-[var(--ink)]">No Assigned Event Bookings Yet</h3>
            <p className="text-xs text-[#24252c]/60 mt-1.5 leading-relaxed">
              You are not currently assigned to any active event booking by the system administrator. Once the administrator designates you to an upcoming production setup, your schedule, gear packing list, and venue routes will automatically appear here.
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={loadAssignedBookings}
              className="px-5 py-2.5 rounded-full bg-[var(--ink)] text-white text-xs font-bold hover:bg-[var(--ink-soft)] transition-colors cursor-pointer"
            >
              Check for New Assignments
            </button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-3xl p-8 sm:p-10 text-center border border-[#24252c]/[0.08] shadow-sm space-y-3 max-w-lg mx-auto my-4">
          <div className="w-12 h-12 rounded-full bg-[var(--mist)] text-[#24252c]/60 flex items-center justify-center mx-auto border border-[#24252c]/10">
            <IconCalendar className="w-6 h-6" />
          </div>
          <h3 className="text-base font-extrabold text-[var(--ink)]">
            {filter === 'Today'
              ? 'No Events Scheduled for Today'
              : `No ${filter} Event Bookings Found`}
          </h3>
          <p className="text-xs text-[#24252c]/60 leading-relaxed">
            {filter === 'Today'
              ? `You don't have any active setups scheduled for today. You have ${upcomingBookingsCount} upcoming event(s) in your roster.`
              : `No bookings matched the "${filter}" filter. Switch to "All" to view all assigned events.`}
          </p>
          <div className="pt-1">
            <button
              onClick={() => setFilter(filter === 'Today' && upcomingBookingsCount > 0 ? 'Upcoming' : 'All')}
              className="px-4 py-2 rounded-full bg-[var(--ink)] text-white text-xs font-bold hover:bg-[var(--ink-soft)] transition-colors cursor-pointer"
            >
              {filter === 'Today' && upcomingBookingsCount > 0 ? 'View Upcoming Events' : 'View All Bookings'}
            </button>
          </div>
        </div>
      ) : (
        /* Bookings Grid / Cards */
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
      )}

      {/* Interactive Leaflet Navigation Route Modal with Waze and Google Maps Inside */}
      <VenueNavigationModal
        booking={selectedRouteBooking}
        isOpen={Boolean(selectedRouteBooking)}
        onClose={() => setSelectedRouteBooking(null)}
      />
    </div>
  );
}
