import { useState, useEffect, useRef } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import { IconTicket, IconCalendar, IconPin, IconUser, IconCheck, IconX } from '../../components/shared/icons';
import { ModalOverlay } from '../../components/shared/ModalOverlay';
import { EmptyState } from '../../components/shared/EmptyState';
import { BookingRescheduleCalendar } from '../../components/shared/BookingRescheduleCalendar';
import { supabase } from '../../lib/supabase';
import { formatDisplayDate } from '../../utils/bookingService';
import { sendAdminRescheduleAlert } from '../../utils/emailService';

export default function BookingStatusPage({ go }: { go: (p: Page) => void }) {
  const [bookings, setBookings] = useState<any[]>([]);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(() => {
    return localStorage.getItem('binhi_selected_active_booking_id') || null;
  });
  const [loading, setLoading] = useState(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Reschedule Request Modal State
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [newRescheduleDate, setNewRescheduleDate] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [submittingReschedule, setSubmittingReschedule] = useState(false);
  const [rescheduleSuccessToast, setRescheduleSuccessToast] = useState(false);
  const [rescheduleError, setRescheduleError] = useState('');
  const [cancellingReschedule, setCancellingReschedule] = useState(false);

  const fetchActiveBookings = async () => {
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
  };

  useEffect(() => {
    fetchActiveBookings();

    const channel = supabase
      .channel('booking-status-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        () => {
          fetchActiveBookings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectBooking = (id: string) => {
    setSelectedBookingId(id);
    localStorage.setItem('binhi_selected_active_booking_id', id);
  };

  const handleOpenRescheduleModal = () => {
    setNewRescheduleDate('');
    setRescheduleReason('');
    setRescheduleError('');
    setShowRescheduleModal(true);
  };

  const handleSubmitReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBooking || !newRescheduleDate) {
      setRescheduleError('Please select your new target event date from the calendar.');
      return;
    }
    const currentCleanDate = (activeBooking.event_date || '').slice(0, 10);
    if (newRescheduleDate === currentCleanDate) {
      setRescheduleError('The new date cannot be the same as your currently scheduled event date.');
      return;
    }
    if (!rescheduleReason.trim()) {
      setRescheduleError('Please provide a reason or note for your reschedule request.');
      return;
    }

    setSubmittingReschedule(true);
    setRescheduleError('');

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // 1. Update booking in Supabase
      const { error: dbError } = await supabase
        .from('bookings')
        .update({
          reschedule_status: 'pending',
          reschedule_requested_date: newRescheduleDate,
          reschedule_reason: rescheduleReason.trim(),
          reschedule_requested_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', activeBooking.id);

      if (dbError) throw dbError;

      // 2. Email ALL system admins in database
      await sendAdminRescheduleAlert({
        bookingId: activeBooking.paymongo_reference_number || `BNH-${activeBooking.id.slice(0, 8)}`,
        customerName: activeBooking.customer_name || user?.user_metadata?.full_name || 'Valued Customer',
        customerEmail: activeBooking.customer_email || user?.email || '',
        customerPhone: activeBooking.customer_phone || '',
        packageName: activeBooking.package_name,
        originalDate: formatDisplayDate(activeBooking.event_date),
        requestedDate: formatDisplayDate(newRescheduleDate),
        reason: rescheduleReason.trim(),
        venue: activeBooking.venue_address,
      });

      setShowRescheduleModal(false);
      setRescheduleSuccessToast(true);
      setTimeout(() => setRescheduleSuccessToast(false), 6000);

      // Refresh data
      fetchActiveBookings();
    } catch (err: any) {
      console.error('Failed to submit reschedule request:', err);
      setRescheduleError(err.message || 'Failed to submit reschedule request. Please try again.');
    } finally {
      setSubmittingReschedule(false);
    }
  };

  const handleCancelRescheduleRequest = async () => {
    if (!activeBooking) return;
    if (!confirm('Are you sure you want to cancel your pending reschedule request? Your original date will remain active.')) {
      return;
    }

    setCancellingReschedule(true);
    try {
      await supabase
        .from('bookings')
        .update({
          reschedule_status: null,
          reschedule_requested_date: null,
          reschedule_reason: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', activeBooking.id);

      fetchActiveBookings();
    } catch (err) {
      console.error('Error cancelling reschedule request:', err);
    } finally {
      setCancellingReschedule(false);
    }
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
  const isReschedulePending = activeBooking.reschedule_status === 'pending';
  const isRescheduleApproved = activeBooking.reschedule_status === 'approved';

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

        {/* Success Toast */}
        {rescheduleSuccessToast && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 shadow-sm flex items-center justify-between gap-3 animate-fade-in text-xs">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                ✓
              </span>
              <div>
                <strong className="font-extrabold text-sm block">Reschedule Request Submitted!</strong>
                <span>Our production lead and system administrators have been notified via email to review your requested date.</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setRescheduleSuccessToast(false)}
              className="text-emerald-700 hover:text-emerald-950 font-bold p-1 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* ── Active Bookings Selection Bar (Minimalist Dropdown) ────────────────────────── */}
        <div className="bg-white rounded-[2rem] px-6 py-5 border border-[#24252c]/[0.08] shadow-xs relative z-30" ref={dropdownRef}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-lg sm:text-xl font-extrabold text-[var(--ink)] tracking-tight">
                  Active Event Bookings
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#1090F8]/10 text-[#1090F8] border border-[#1090F8]/20 shrink-0">
                  {bookings.length} Ongoing
                </span>
              </div>
              <p className="text-xs text-[#24252c]/50 mt-0.5">
                {bookings.length > 1
                  ? 'Switch between your ongoing event reservations to track live setup progress.'
                  : 'Live progress tracking for your confirmed event production reservation.'}
              </p>
            </div>

            {/* Minimalist Capsule Dropdown Selector */}
            {bookings.length > 1 && (
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className={`inline-flex items-center gap-2.5 bg-[var(--mist)] hover:bg-[#E4E6EA] text-[var(--ink)] border transition-all rounded-full px-4 py-2.5 text-xs font-semibold cursor-pointer shadow-2xs group ${
                    isDropdownOpen ? 'border-[#1090F8] ring-2 ring-[#1090F8]/15 bg-white' : 'border-[#24252c]/10'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      (activeBooking.payment_status || '').toLowerCase() === 'pending'
                        ? 'bg-amber-400 animate-pulse'
                        : 'bg-emerald-500'
                    }`}
                  />
                  <span className="font-extrabold text-[var(--ink)] max-w-[160px] sm:max-w-[200px] truncate">
                    {activeBooking.package_name}
                  </span>
                  <span className="text-[#24252c]/50 font-medium hidden sm:inline">
                    • {formatDisplayDate(activeBooking.event_date)}
                  </span>
                  <svg
                    className={`w-3.5 h-3.5 text-[#24252c]/50 transition-transform duration-200 shrink-0 ${
                      isDropdownOpen ? 'rotate-180 text-[#1090F8]' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Floating Minimalist Dropdown Menu */}
                {isDropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-[#24252c]/10 p-1.5 z-50 animate-fade-in space-y-1">
                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#24252c]/40 flex items-center justify-between">
                      <span>Switch Reservation</span>
                      <span className="font-mono text-[#1090F8]">{bookings.length} events</span>
                    </div>
                    <div className="max-h-64 overflow-y-auto modal-scroll space-y-1">
                      {bookings.map((b) => {
                        const isSelected = b.id === activeBooking.id;
                        const bIsPending = (b.payment_status || '').toLowerCase() === 'pending';
                        const refNum = b.paymongo_reference_number || `BNH-${b.id.slice(0, 8)}`;

                        return (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => {
                              handleSelectBooking(b.id);
                              setIsDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2.5 rounded-xl text-xs transition-colors flex items-center justify-between gap-3 cursor-pointer ${
                              isSelected
                                ? 'bg-[#1090F8]/10 text-[#1090F8] font-bold'
                                : 'hover:bg-[var(--mist)] text-[var(--ink)] font-medium'
                            }`}
                          >
                            <div className="min-w-0 flex-1 space-y-0.5">
                              <div className="flex items-center gap-1.5 truncate">
                                <span
                                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                    bIsPending ? 'bg-amber-400' : 'bg-emerald-500'
                                  }`}
                                />
                                <span className="font-bold truncate text-[var(--ink)]">
                                  {b.package_name || 'Production Package'}
                                </span>
                              </div>
                              <div className="text-[10px] text-[#24252c]/50 pl-3">
                                {formatDisplayDate(b.event_date)} • <span className="font-mono">{refNum}</span>
                              </div>
                            </div>
                            {isSelected && <IconCheck className="w-4 h-4 text-[#1090F8] shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Active Booking Details & Timeline ───────────────────────── */}
        <div className="bg-white rounded-[2rem] p-6 sm:p-8 border border-[#24252c]/[0.08] shadow-sm relative">
          {/* Header with Status & Reschedule Action aligned Top-Right */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-[#24252c]/[0.06]">
            {/* Left: Package Info */}
            <div className="flex-1 pr-0 sm:pr-4">
              <MonoBadge icon={IconTicket}>
                Booking Ref #{activeBooking.paymongo_reference_number || `BNH-${activeBooking.id.slice(0, 8)}`}
              </MonoBadge>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--ink)] mt-2 leading-tight">
                {activeBooking.package_name}
              </h2>
              <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-[#24252c]/60">
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

            {/* Right: Top-Right Aligned Status & Request Reschedule Button */}
            <div className="flex flex-col sm:items-end gap-2.5 shrink-0">
              <div className="flex items-center gap-2 flex-wrap sm:justify-end">
                {isPending ? (
                  <span className="inline-flex items-center gap-1.5 bg-amber-500/10 text-amber-700 font-extrabold text-xs px-3.5 py-1.5 rounded-full border border-amber-500/20 whitespace-nowrap shadow-2xs">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                    Deposit Pending Approval
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-700 font-extrabold text-xs px-3.5 py-1.5 rounded-full border border-emerald-500/20 whitespace-nowrap shadow-2xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                    Confirmed & Date Secured
                  </span>
                )}

                <button
                  type="button"
                  onClick={handleOpenRescheduleModal}
                  className="bg-[var(--mist)] hover:bg-[var(--ink)] hover:text-white text-[var(--ink)] text-xs font-bold px-4 py-1.5 rounded-full border border-[#24252c]/10 transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs whitespace-nowrap shrink-0"
                >
                  <IconCalendar className="w-3.5 h-3.5 text-[#1090F8]" />
                  <span>Request Reschedule</span>
                </button>
              </div>

              <div className="text-xs font-semibold text-[var(--ink)] flex items-center gap-1.5 sm:justify-end">
                <span className="text-[10px] uppercase font-bold text-[#24252c]/50">Target Date:</span>
                <span className="bg-[var(--mist)] px-2.5 py-0.5 rounded-md border border-[#24252c]/10 font-bold text-[var(--ink)]">
                  {formatDisplayDate(activeBooking.event_date)}
                </span>
              </div>
            </div>
          </div>

          {/* ── Reschedule Request Status Banner ── */}
          {isReschedulePending && (
            <div className="my-6 p-4 rounded-2xl bg-amber-50/90 border border-amber-300 text-amber-950 text-xs shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-500 text-white font-bold flex items-center justify-center shrink-0 text-sm shadow-xs">
                  <IconCalendar className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-extrabold text-sm text-amber-900 flex items-center gap-2">
                    <span>Reschedule Request Pending Admin Review</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 border border-amber-300">
                      Pending Approval
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-800/90 mt-0.5">
                    Requested Target Date: <strong className="text-amber-950 font-bold">{formatDisplayDate(activeBooking.reschedule_requested_date)}</strong>
                  </p>
                  {activeBooking.reschedule_reason && (
                    <p className="text-[11px] text-amber-800/80 mt-1 italic">
                      Note: "{activeBooking.reschedule_reason}"
                    </p>
                  )}
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-2">
                <button
                  type="button"
                  disabled={cancellingReschedule}
                  onClick={handleCancelRescheduleRequest}
                  className="px-4 py-2 rounded-full bg-white border border-amber-300 text-amber-900 text-xs font-semibold hover:bg-amber-100 transition-colors cursor-pointer shadow-2xs disabled:opacity-50"
                >
                  {cancellingReschedule ? 'Cancelling...' : 'Cancel Request'}
                </button>
              </div>
            </div>
          )}

          {isRescheduleApproved && (
            <div className="my-6 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs shadow-2xs flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                ✓
              </span>
              <div>
                <strong className="font-bold text-emerald-900">Event Reschedule Confirmed</strong>
                <span className="text-[11px] text-emerald-800 ml-1">Your event date is locked for {formatDisplayDate(activeBooking.event_date)}.</span>
              </div>
            </div>
          )}

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
          <div className="mt-8 p-4 sm:p-5 rounded-2xl bg-[var(--mist)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-full bg-[var(--ink)] text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                BC
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-[var(--ink)]">BINHI Event Lead Team</div>
                <div className="text-[11px] text-[#24252c]/60 truncate" title={activeBooking.venue_address || 'Selected Location'}>
                  Venue: {activeBooking.venue_address || 'Selected Location'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <button
                type="button"
                onClick={() => go('booking-history')}
                className="bg-white border border-[#24252c]/10 text-xs font-semibold px-4 py-2 rounded-full hover:bg-[var(--mist)] transition-colors cursor-pointer shadow-2xs"
              >
                View Records
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

      {/* ── Customer Reschedule Request Modal ── */}
      <ModalOverlay isOpen={showRescheduleModal} onClose={() => setShowRescheduleModal(false)}>
        <div className="bg-white rounded-[2.5rem] max-w-xl w-full max-h-[85vh] shadow-2xl border border-[#24252c]/10 relative p-1.5 sm:p-2.5 overflow-hidden flex flex-col">
          <button
            type="button"
            onClick={() => setShowRescheduleModal(false)}
            className="absolute top-6 right-6 z-20 text-[#24252c]/50 hover:text-[var(--ink)] p-1.5 rounded-full hover:bg-[var(--mist)] transition-colors bg-white/90 backdrop-blur-md shadow-sm border border-[#24252c]/10 cursor-pointer"
          >
            <IconX className="w-5 h-5" />
          </button>

          <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-4 modal-scroll pr-4 sm:pr-6">
            <div className="mb-2 pb-3 border-b border-[#24252c]/[0.06]">
              <div className="flex items-center gap-2 mb-1">
                <span className="p-1.5 rounded-lg bg-[#1090F8]/10 text-[#1090F8]">
                  <IconCalendar className="w-4 h-4" />
                </span>
                <h3 className="text-xl font-extrabold text-[var(--ink)]">
                  Request Booking Reschedule
                </h3>
              </div>
              <p className="text-xs text-[#24252c]/60">
                Select your desired new event date on the calendar below. All system administrators will be notified immediately to review and confirm your request.
              </p>
            </div>

            <form onSubmit={handleSubmitReschedule} className="space-y-4 text-xs">
              {/* Current Schedule Summary */}
              <div className="p-3.5 rounded-2xl bg-[var(--mist)] border border-[#24252c]/[0.06] flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#24252c]/50 block">Current Schedule</span>
                  <span className="font-extrabold text-sm text-[var(--ink)]">
                    {formatDisplayDate(activeBooking.event_date)}
                  </span>
                </div>
                <span className="text-[11px] font-mono font-bold text-[#1090F8] bg-white px-2.5 py-1 rounded-full border border-black/10">
                  Ref #{activeBooking.paymongo_reference_number || `BNH-${activeBooking.id.slice(0, 8)}`}
                </span>
              </div>

              {/* Interactive Availability Calendar */}
              <div className="p-4 rounded-2xl bg-white border border-[#24252c]/15 shadow-2xs">
                <BookingRescheduleCalendar
                  originalDate={activeBooking.event_date}
                  selectedDate={newRescheduleDate}
                  onSelectDate={(d) => {
                    setNewRescheduleDate(d);
                    setRescheduleError('');
                  }}
                  excludeBookingId={activeBooking.id}
                  minDateOffsetDays={1}
                />
              </div>

              {/* Selected Date Indicator */}
              {newRescheduleDate && (
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-950 flex items-center justify-between">
                  <span className="font-semibold text-xs">Selected New Target Date:</span>
                  <span className="font-extrabold text-xs text-[#1090F8] bg-white px-3 py-1 rounded-full border border-blue-300 shadow-2xs">
                    {formatDisplayDate(newRescheduleDate)}
                  </span>
                </div>
              )}

              {/* Built-in Prefilled Reason & Email Message Box */}
              <div className="space-y-2 pt-2 border-t border-[#24252c]/[0.08]">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <label className="text-[11px] font-black uppercase text-[var(--ink)] block">
                      Email Alert to Admin &amp; Reason <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[10px] text-[#24252c]/60">
                      Dispatched instantly to BINHI Production Management
                    </span>
                  </div>

                  {/* Quick Reason Templates */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() =>
                        setRescheduleReason(
                          `Due to unexpected venue availability adjustments, we would like to request moving our event schedule${
                            newRescheduleDate ? ` to ${formatDisplayDate(newRescheduleDate)}` : ''
                          }.`
                        )
                      }
                      className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-blue-50 text-[#1090F8] border border-blue-200 hover:bg-blue-100 transition-colors cursor-pointer"
                    >
                      Venue Shift
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setRescheduleReason(
                          `Due to program timeline adjustments and client coordination, we kindly request rescheduling our booking${
                            newRescheduleDate ? ` to ${formatDisplayDate(newRescheduleDate)}` : ''
                          }.`
                        )
                      }
                      className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition-colors cursor-pointer"
                    >
                      Guest Coordination
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setRescheduleReason(
                          `Due to weather forecasts and outdoor logistical considerations, we request shifting our event reservation${
                            newRescheduleDate ? ` to ${formatDisplayDate(newRescheduleDate)}` : ''
                          }.`
                        )
                      }
                      className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer"
                    >
                      Weather / Delay
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setRescheduleReason(
                          `Due to an unavoidable schedule conflict, we would like to request moving our event date${
                            newRescheduleDate ? ` to ${formatDisplayDate(newRescheduleDate)}` : ''
                          }.`
                        )
                      }
                      className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer"
                    >
                      Schedule Conflict
                    </button>
                  </div>
                </div>

                <textarea
                  rows={4}
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  placeholder="State why you need to reschedule or choose a quick template above..."
                  className="w-full rounded-2xl border border-black/10 px-4 py-3 bg-[#F8F9FA] focus:bg-white text-xs font-medium text-[var(--ink)] placeholder:text-[#24252c]/40 focus:outline-none focus:border-[#1090F8] transition-colors resize-none leading-relaxed"
                  required
                />
                <div className="flex justify-between items-center text-[10px] text-[#24252c]/50 px-1">
                  <span>Admins will review calendar availability upon receiving this request.</span>
                  <span className="font-mono font-semibold">{rescheduleReason.length} chars</span>
                </div>
              </div>

              {/* Error banner if any */}
              {rescheduleError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                  {rescheduleError}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#24252c]/[0.06]">
                <button
                  type="button"
                  onClick={() => setShowRescheduleModal(false)}
                  className="px-5 py-2.5 rounded-full border border-black/10 text-xs font-semibold text-[var(--ink)] hover:bg-[#F0F0F0] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReschedule || !newRescheduleDate || !rescheduleReason.trim()}
                  className="bg-[var(--ink)] disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors cursor-pointer text-xs shadow-md flex items-center gap-1.5"
                >
                  {submittingReschedule ? 'Sending Alert to Admins...' : 'Submit Reschedule Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </ModalOverlay>
    </section>
  );
}