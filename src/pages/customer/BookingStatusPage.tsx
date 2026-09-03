import { useState, useEffect } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import { IconTicket, IconCalendar, IconPin, IconUser, IconCheck } from '../../components/shared/icons';
import { EmptyState } from '../../components/shared/EmptyState';
import { supabase } from '../../lib/supabase';
import { formatDisplayDate } from '../../utils/bookingService';

export default function BookingStatusPage({ go }: { go: (p: Page) => void }) {
  const [bookings, setBookings] = useState<any[]>([]);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(() => {
    return localStorage.getItem('binhi_selected_active_booking_id') || null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchActiveBookings() {
      setLoading(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        let query = supabase
          .from('bookings')
          .select('*')
          .neq('payment_status', 'cancelled')
          .order('created_at', { ascending: false });

        if (user?.id || user?.email) {
          query = query.or(`user_id.eq.${user.id},customer_email.eq.${user.email}`);
        }

        const { data, error } = await query;
        if (!error && data) {
          // Filter only active / ongoing bookings (not cancelled and not completed)
          const ongoing = data.filter(
            (b: any) =>
              (b.payment_status || '').toLowerCase() !== 'cancelled' &&
              (b.payment_status || '').toLowerCase() !== 'completed' &&
              (b.status || '').toLowerCase() !== 'cancelled' &&
              (b.status || '').toLowerCase() !== 'completed'
          );

          setBookings(ongoing);

          // If current selectedBookingId is valid in the loaded bookings, keep it.
          // Otherwise, default to the latest ongoing booking (data[0]).
          setSelectedBookingId((prev) => {
            if (prev && ongoing.some((b: any) => b.id === prev)) {
              return prev;
            }
            const defaultId = ongoing[0]?.id || null;
            if (defaultId) {
              localStorage.setItem('binhi_selected_active_booking_id', defaultId);
            }
            return defaultId;
          });
        } else {
          setBookings([]);
        }
      } catch (err) {
        console.error('Failed to fetch active bookings:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchActiveBookings();
  }, []);

  const handleSelectBooking = (id: string) => {
    setSelectedBookingId(id);
    localStorage.setItem('binhi_selected_active_booking_id', id);
  };

  if (loading) {
    return (
      <section className="pt-36 pb-24 px-6 min-h-screen bg-[var(--mist)]">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="h-28 bg-white/60 rounded-3xl animate-pulse border border-[#24252c]/10" />
          <div className="h-96 bg-white/60 rounded-3xl animate-pulse border border-[#24252c]/10" />
        </div>
      </section>
    );
  }

  const activeBooking = bookings.find((b) => b.id === selectedBookingId) || bookings[0] || null;

  if (!activeBooking) {
    return (
      <section className="pt-36 pb-24 px-6 min-h-screen bg-[var(--mist)]">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-[2rem] p-8 border border-[#24252c]/[0.08] shadow-sm text-center">
            <EmptyState
              title="No Active Bookings Found"
              description="You currently don't have any ongoing or confirmed event reservations. Choose your event package to start your booking."
            />
            <div className="flex justify-center gap-3 mt-6 flex-wrap">
              <button
                onClick={() => go('packages')}
                className="bg-[var(--ink)] text-white text-xs font-semibold px-6 py-3 rounded-full hover:bg-[var(--ink-soft)] transition-colors cursor-pointer"
              >
                Explore Production Packages →
              </button>
              <button
                onClick={() => go('booking-history')}
                className="bg-white text-[var(--ink)] border border-[#24252c]/15 text-xs font-semibold px-6 py-3 rounded-full hover:bg-[var(--mist)] transition-colors cursor-pointer"
              >
                View Past Bookings
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const isPending = (activeBooking.payment_status || '').toLowerCase() === 'pending';
  const assignedCrewList = Array.isArray(activeBooking.assigned_crew) ? activeBooking.assigned_crew : [];

  const steps = [
    {
      title: isPending ? 'Reservation Deposit Pending Verification' : 'Reservation Deposit Secured',
      status: isPending ? 'Pending Approval' : 'Completed',
      date: isPending ? 'Verification in Progress' : 'Deposit Secured',
      done: !isPending,
      current: isPending,
    },
    {
      title: 'Date Locked & Production Schedule',
      status: isPending ? 'Pending Deposit' : 'Confirmed',
      date: formatDisplayDate(activeBooking.event_date),
      done: !isPending,
    },
    {
      title: 'Warehouse Equipment Pre-Check & Staging',
      status: 'In Progress',
      date: 'Pre-Event Staging',
      current: !isPending,
      done: false,
    },
    {
      title: 'Logistics Transport & Venue Rigging',
      status: 'Scheduled',
      date: 'Event Day Setup',
      done: false,
    },
    {
      title: 'Soundcheck, Lighting Cue & Execution',
      status: 'Scheduled',
      date: 'Event Execution',
      done: false,
    },
  ];

  const totalCost = Number(activeBooking.total_cost || 0);
  const depositAmount = Number(activeBooking.deposit_amount || 0);
  const isFullyPaid = activeBooking.is_fully_paid === true;
  const remBal = isFullyPaid ? 0 : Math.max(0, totalCost - depositAmount);

  return (
    <section className="pt-36 pb-24 px-4 sm:px-6 min-h-screen bg-[var(--mist)]">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* ── Active Bookings Switcher Bar ────────────────────────────── */}
        <div className="bg-white rounded-[2rem] p-5 sm:p-6 border border-[#24252c]/[0.08] shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black text-[var(--ink)]">
                  Active Event Bookings
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-[#1090F8]/10 text-[#1090F8] border border-[#1090F8]/20">
                  {bookings.length} Ongoing
                </span>
              </div>
              <p className="text-xs text-[#24252c]/60 mt-0.5">
                {bookings.length > 1
                  ? 'Select an event below to switch and track its live logistics, crew, and setup progress.'
                  : 'Live progress tracking for your confirmed event production reservation.'}
              </p>
            </div>

            {/* Mobile quick dropdown */}
            {bookings.length > 1 && (
              <div className="sm:hidden w-full pt-2">
                <label className="text-[11px] font-bold text-[#24252c]/60 block mb-1">
                  Switch Active Booking:
                </label>
                <select
                  value={activeBooking.id}
                  onChange={(e) => handleSelectBooking(e.target.value)}
                  className="w-full bg-[var(--mist)] border border-[#24252c]/15 text-xs font-semibold rounded-xl px-3 py-2.5 text-[var(--ink)] outline-none focus:border-[#1090F8]"
                >
                  {bookings.map((b, idx) => (
                    <option key={b.id} value={b.id}>
                      #{idx + 1}: {b.package_name} — {formatDisplayDate(b.event_date)}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Interactive Switcher Cards List */}
          <div className="flex items-stretch gap-3 overflow-x-auto pb-2 scrollbar-thin">
            {bookings.map((b, idx) => {
              const isSelected = b.id === activeBooking.id;
              const refNum = b.paymongo_reference_number || `BNH-${b.id.slice(0, 8)}`;
              const bIsPending = (b.payment_status || '').toLowerCase() === 'pending';

              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => handleSelectBooking(b.id)}
                  className={`flex-shrink-0 w-64 sm:w-72 p-4 rounded-2xl text-left transition-all duration-200 cursor-pointer border ${
                    isSelected
                      ? 'bg-[#161823] text-white border-[#1090F8] shadow-lg ring-4 ring-[#1090F8]/20 -translate-y-0.5'
                      : 'bg-[var(--mist)]/70 hover:bg-white text-[var(--ink)] border-[#24252c]/10 hover:border-[#1090F8]/40 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span
                      className={`text-[10px] font-mono font-bold tracking-tight px-2 py-0.5 rounded-full ${
                        isSelected
                          ? 'bg-white/10 text-white/90 border border-white/15'
                          : 'bg-white text-[#24252c]/70 border border-[#24252c]/10'
                      }`}
                    >
                      Ref #{refNum}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                        bIsPending
                          ? isSelected
                            ? 'bg-amber-400/20 text-amber-300 border-amber-400/40'
                            : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                          : isSelected
                          ? 'bg-emerald-400/20 text-emerald-300 border-emerald-400/40'
                          : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          bIsPending ? 'bg-amber-400' : 'bg-emerald-400'
                        }`}
                      />
                      {bIsPending ? 'Pending' : 'Confirmed'}
                    </span>
                  </div>

                  <div className="font-extrabold text-sm truncate mb-0.5">
                    {b.package_name || 'Production Package'}
                  </div>
                  <div
                    className={`text-[11px] truncate mb-3 ${
                      isSelected ? 'text-white/60' : 'text-[#24252c]/60'
                    }`}
                  >
                    {b.event_type || 'Special Event'}
                  </div>

                  <div className="pt-2 border-t border-current/10 flex items-center justify-between text-[11px]">
                    <span className="flex items-center gap-1.5 font-medium">
                      <IconCalendar className="w-3.5 h-3.5 shrink-0 opacity-70" />
                      {formatDisplayDate(b.event_date)}
                    </span>
                    {isSelected ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#1090F8] bg-white px-2 py-0.5 rounded-full shadow-xs">
                        <IconCheck className="w-3 h-3 text-[#1090F8]" />
                        Tracking
                      </span>
                    ) : (
                      <span className="text-[10px] text-[#24252c]/40 font-semibold group-hover:text-[#1090F8]">
                        Switch →
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Active Booking Details & Timeline ───────────────────────── */}
        <div className="bg-white rounded-[2rem] p-6 sm:p-8 border border-[#24252c]/[0.08] shadow-sm">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#24252c]/[0.06]">
            <div>
              <MonoBadge icon={IconTicket}>
                Booking Ref #{activeBooking.paymongo_reference_number || `BNH-${activeBooking.id.slice(0, 8)}`}
              </MonoBadge>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--ink)] mt-2">
                {activeBooking.package_name}
              </h2>
              <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-[#24252c]/60">
                <span className="font-semibold text-[var(--ink)]">
                  {activeBooking.event_type || 'Special Event Production'}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 text-[#24252c]/70">
                  <IconPin className="w-3.5 h-3.5 shrink-0" />
                  {activeBooking.venue_address || 'Selected Location'}
                </span>
              </div>
            </div>

            <div className="sm:text-right flex flex-col sm:items-end gap-1">
              {isPending ? (
                <span className="inline-flex items-center gap-1.5 bg-amber-500/10 text-amber-600 font-bold text-xs px-3.5 py-1.5 rounded-full border border-amber-500/20">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  Deposit Pending Approval
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-600 font-bold text-xs px-3.5 py-1.5 rounded-full border border-emerald-500/20">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Confirmed & Date Secured
                </span>
              )}
              <div className="text-xs font-semibold text-[var(--ink)] flex items-center gap-1.5 mt-1">
                <IconCalendar className="w-3.5 h-3.5 text-[#1090F8]" />
                Event Date: {formatDisplayDate(activeBooking.event_date)}
              </div>
            </div>
          </div>

          {/* Booking Summary Chips */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-6 p-4 rounded-2xl bg-[var(--mist)]/70 border border-[#24252c]/[0.05] text-xs">
            <div>
              <span className="text-[10px] text-[#24252c]/50 uppercase font-bold block mb-0.5">
                Total Production Cost
              </span>
              <span className="font-extrabold text-sm text-[var(--ink)]">
                ₱{totalCost.toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-[#24252c]/50 uppercase font-bold block mb-0.5">
                Deposit Paid
              </span>
              <span className="font-extrabold text-sm text-emerald-600">
                ₱{depositAmount.toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-[#24252c]/50 uppercase font-bold block mb-0.5">
                Remaining Balance
              </span>
              <span className="font-extrabold text-sm text-[var(--ink)]">
                {isFullyPaid ? (
                  <span className="text-emerald-600">Fully Paid ✓</span>
                ) : (
                  `₱${remBal.toLocaleString()}`
                )}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-[#24252c]/50 uppercase font-bold block mb-0.5">
                Guest Capacity
              </span>
              <span className="font-extrabold text-sm text-[var(--ink)]">
                {activeBooking.guest_count || 100} Guests
              </span>
            </div>
          </div>

          {/* Selected Add-ons (if any) */}
          {Array.isArray(activeBooking.selected_addons) && activeBooking.selected_addons.length > 0 && (
            <div className="mb-6 p-4 rounded-2xl bg-white border border-[#24252c]/[0.08]">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#24252c]/50 block mb-2">
                Custom Production Add-ons
              </span>
              <div className="flex flex-wrap gap-2">
                {activeBooking.selected_addons.map((addon: any, idx: number) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#1090F8]/10 text-[#1090F8] border border-[#1090F8]/20"
                  >
                    <span>+</span>
                    <span>{addon.name || addon.title || 'Add-on'}</span>
                    {addon.price && (
                      <span className="text-[10px] opacity-75 font-mono">
                        (₱{Number(addon.price).toLocaleString()})
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Assigned Crew (if any) */}
          {assignedCrewList.length > 0 && (
            <div className="mb-6 p-4 rounded-2xl bg-white border border-[#24252c]/[0.08]">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#24252c]/50 block mb-2">
                Assigned Production Crew & Engineers
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {assignedCrewList.map((crew: any, idx: number) => (
                  <div
                    key={crew.id || idx}
                    className="flex items-center gap-2.5 p-2 rounded-xl bg-[var(--mist)] text-xs"
                  >
                    <div className="w-7 h-7 rounded-full bg-[#1090F8] text-white flex items-center justify-center font-bold shrink-0 text-[10px]">
                      <IconUser className="w-3.5 h-3.5" />
                    </div>
                    <div className="truncate">
                      <div className="font-bold text-[var(--ink)] truncate">
                        {crew.name || crew.full_name}
                      </div>
                      <div className="text-[10px] text-[#24252c]/60 truncate">
                        {crew.roleTitle || 'Production Crew'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Live Setup Progress Timeline */}
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
                        ? 'bg-emerald-500 text-white shadow-sm'
                        : step.current
                        ? 'bg-[#1090F8] text-white ring-4 ring-[#1090F8]/20 shadow-md'
                        : 'bg-[var(--mist)] text-[#24252c]/40 border border-[#24252c]/10'
                    }`}
                  >
                    {step.done ? '✓' : i + 1}
                  </div>
                  <div className="flex-1 pb-4 border-b border-[#24252c]/[0.04]">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-bold text-sm text-[var(--ink)]">{step.title}</h4>
                      <span className="text-xs font-medium text-[#24252c]/50 shrink-0">
                        {step.date}
                      </span>
                    </div>
                    <p className="text-xs text-[#24252c]/60 mt-1">{step.status}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Card */}
          <div className="mt-8 p-5 rounded-2xl bg-[var(--mist)] flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="w-10 h-10 rounded-full bg-[var(--ink)] text-white font-bold text-xs flex items-center justify-center shrink-0">
                BC
              </div>
              <div className="truncate">
                <div className="text-xs font-bold text-[var(--ink)]">BINHI Event Lead Team</div>
                <div className="text-[11px] text-[#24252c]/60 truncate">
                  Venue: {activeBooking.venue_address || 'Selected Location'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => go('booking-history')}
                className="bg-white border border-[#24252c]/10 text-xs font-semibold px-4 py-2 rounded-full hover:bg-[var(--mist)] transition-colors cursor-pointer"
              >
                View Receipt & Records
              </button>
              <button
                type="button"
                onClick={() => go('contact')}
                className="bg-[var(--ink)] text-white text-xs font-semibold px-4 py-2 rounded-full hover:bg-[var(--ink-soft)] transition-colors cursor-pointer shadow-xs"
              >
                Contact Lead Team
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}