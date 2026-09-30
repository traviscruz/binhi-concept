import { useState, useEffect, useMemo } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import { IconTicket, IconCalendar, IconPin, IconX, IconPrinter, IconCheck, IconShield, IconClock, IconAlertTriangle, IconBan } from '../../components/shared/icons';
import { ModalOverlay } from '../../components/shared/ModalOverlay';
import { EmptyState } from '../../components/shared/EmptyState';
import { BookingRescheduleCalendar } from '../../components/shared/BookingRescheduleCalendar';
import { supabase } from '../../lib/supabase';
import { formatDisplayDate, fetchDbBookedDates, normalizeDateToIso, type DBBooking } from '../../utils/bookingService';
import { sendAdminRescheduleAlert, sendAdminCancellationAlert } from '../../utils/emailService';
import { createPaymongoCheckoutSession } from '../../utils/paymongoPayment';
import {
  type CancellationPolicyConfig,
  DEFAULT_CANCELLATION_POLICY,
  loadCancellationPolicy,
  calculateCancellationRefund,
} from '../../utils/cancellationPolicy';
import {
  fetchBookingSettings,
  fetchScheduleOverrides,
  evaluateSlotFeasibility,
  timeToMinutes,
  minutesToTime,
  formatTimeAmPm,
  calculateCrewArrivalTime,
  getOperatingWindowForDate,
  DEFAULT_BOOKING_SETTINGS,
  type BookingSettings,
  type ScheduleOverride,
} from '../../utils/bookingEngine';

export default function BookingHistoryPage({ go }: { go: (p: Page) => void }) {
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadModalItem, setDownloadModalItem] = useState<any | null>(null);

  // Balance Payment State
  const [payingBalanceId, setPayingBalanceId] = useState<string | null>(null);
  const [balanceError, setBalanceError] = useState('');

  // Reschedule Request Modal States
  const [rescheduleTargetItem, setRescheduleTargetItem] = useState<any | null>(null);
  const [newRescheduleDate, setNewRescheduleDate] = useState('');
  const [newRescheduleStartTime, setNewRescheduleStartTime] = useState('13:00');
  const [newRescheduleEndTime, setNewRescheduleEndTime] = useState('18:00');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [submittingReschedule, setSubmittingReschedule] = useState(false);
  const [rescheduleSuccessToast, setRescheduleSuccessToast] = useState(false);
  const [rescheduleError, setRescheduleError] = useState('');
  const [dbBookings, setDbBookings] = useState<DBBooking[]>([]);
  const [bookingSettings, setBookingSettings] = useState<BookingSettings>(DEFAULT_BOOKING_SETTINGS);
  const [scheduleOverrides, setScheduleOverrides] = useState<ScheduleOverride[]>([]);

  // Cancellation & Refund Modal States
  const [cancellationTargetItem, setCancellationTargetItem] = useState<any | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [submittingCancellation, setSubmittingCancellation] = useState(false);
  const [cancellationSuccessToast, setCancellationSuccessToast] = useState(false);
  const [cancellationError, setCancellationError] = useState('');
  const [cancellationPolicy, setCancellationPolicy] = useState<CancellationPolicyConfig>(DEFAULT_CANCELLATION_POLICY);

  useEffect(() => {
    loadCancellationPolicy().then(setCancellationPolicy).catch(() => {});
  }, []);

  useEffect(() => {
    async function loadEngineData() {
      try {
        const [settings, overrides, bookedDates] = await Promise.all([
          fetchBookingSettings(),
          fetchScheduleOverrides(),
          fetchDbBookedDates(),
        ]);
        if (settings) setBookingSettings(settings);
        setScheduleOverrides(overrides);
        setDbBookings(bookedDates);
      } catch (err) {
        console.warn('Failed loading booking engine data in history page:', err);
      }
    }
    loadEngineData();
  }, []);

  const rescheduleOpWindow = useMemo(() => {
    const res = getOperatingWindowForDate(newRescheduleDate, bookingSettings, scheduleOverrides);
    const openTime = res.openTime || '08:00';
    const closeTime = res.closeTime === '00:00' && res.isOpen ? '23:59' : (res.closeTime || '23:00');
    return { ...res, openTime, closeTime };
  }, [newRescheduleDate, bookingSettings, scheduleOverrides]);

  const rescheduleFeasibility = useMemo(() => {
    if (!newRescheduleDate || !newRescheduleStartTime || !newRescheduleEndTime) return null;
    return evaluateSlotFeasibility({
      targetDate: newRescheduleDate,
      startTime: newRescheduleStartTime,
      endTime: newRescheduleEndTime,
      venueAddress: rescheduleTargetItem?.venue || 'Metro Manila',
      existingBookings: dbBookings,
      settings: bookingSettings,
      overrides: scheduleOverrides,
      excludeBookingId: rescheduleTargetItem?.dbId || undefined,
    });
  }, [newRescheduleDate, newRescheduleStartTime, newRescheduleEndTime, rescheduleTargetItem, dbBookings, bookingSettings, scheduleOverrides]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let query = supabase.from('bookings').select('*').order('created_at', { ascending: false });
      if (user?.id || user?.email) {
        query = query.or(`user_id.eq.${user.id},customer_email.eq.${user.email}`);
      }
      const { data, error } = await query;
      const { data: packagesData } = await supabase.from('packages').select('*');

      if (!error && data) {
        setHistoryItems(
          data.map((b: any) => {
            const total = Number(b.total_cost) || 0;
            const deposit = Number(b.deposit_amount) || 0;
            const pkgPrice = Number(b.package_price) || 0;
            const addPrice = Number(b.addons_cost) || 0;
            const transPrice = Number(b.transport_fee) || 0;
            const isFull = b.is_fully_paid === true;
            const remBal = isFull
              ? 0
              : (b.remaining_balance !== undefined && b.remaining_balance !== null && Number(b.remaining_balance) > 0)
                ? Number(b.remaining_balance)
                : Math.max(0, total - deposit);

            const pkgMatch = packagesData?.find(
              (p: any) => p.package_id === b.package_id || p.name?.toLowerCase() === b.package_name?.toLowerCase()
            );
            const packageTag = pkgMatch?.tag || 'Production Setup';
            const packageInclusions = Array.isArray(pkgMatch?.inclusions) && pkgMatch.inclusions.length > 0
              ? pkgMatch.inclusions
              : Array.isArray(pkgMatch?.items)
                ? pkgMatch.items
                : [];

            return {
              dbId: b.id,
              id: b.paymongo_reference_number || `BNH-${b.id.slice(0, 8)}`,
              customerName: b.customer_name || 'Valued Customer',
              customerEmail: b.customer_email || 'customer@binhiconcept.ph',
              customerPhone: b.customer_phone || '',
              package: b.package_name || 'Event Production Setup',
              packageTag,
              packageInclusions,
              packagePrice: pkgPrice > 0 ? pkgPrice : Math.max(0, total - addPrice - transPrice),
              addonsCost: addPrice,
              transportFee: transPrice,
              selectedAddons: b.selected_addons || [],
              eventType: b.event_type || '',
              eventDescription: b.event_description || '',
              date: formatDisplayDate(b.event_date),
              rawDate: b.event_date || '',
              venue: b.venue_address || 'Selected Location',
              rawTotal: total,
              rawDeposit: deposit,
              rawRemaining: remBal,
              total: `₱${total.toLocaleString()}`,
              deposit: `₱${deposit.toLocaleString()}`,
              remaining: `₱${remBal.toLocaleString()}`,
              isFullyPaid: isFull,
              balancePaidAt: b.balance_paid_at ? new Date(b.balance_paid_at).toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '',
              balancePaymentMethod: b.balance_payment_method || 'Cash on Site / Event Day',
              createdAt: b.created_at ? new Date(b.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '',
              rawCreatedAt: b.created_at || '',
              isCompleted: (b.status || b.payment_status || '').toLowerCase() === 'completed',
              rawStatus: (b.status || b.payment_status || '').toLowerCase(),
              status: (b.status || b.payment_status || '').toLowerCase() === 'completed' ? 'Completed' : (b.status || b.payment_status || '').toLowerCase() === 'cancelled' ? 'Cancelled' : b.payment_status === 'paid' ? 'Confirmed & Secured' : b.payment_status === 'pending' ? 'Pending Payment' : 'Confirmed',
              statusColor: (b.status || b.payment_status || '').toLowerCase() === 'completed' ? 'bg-[#1090F8]/10 text-[#1090F8] border-[#1090F8]/20' : (b.status || b.payment_status || '').toLowerCase() === 'cancelled' ? 'bg-rose-500/10 text-rose-600 border-rose-500/20' : b.payment_status === 'paid' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : b.payment_status === 'pending' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' : 'bg-rose-500/10 text-rose-600 border-rose-500/20',
              paymentChannel: b.payment_channel || 'PayMongo',
              rescheduleStatus: b.reschedule_status || null,
              rescheduleRequestedDate: b.reschedule_requested_date || null,
              rescheduleReason: b.reschedule_reason || null,
              cancellationStatus: (b.cancellation_data?.status || b.cancellation_status) || null,
              cancellationReason: (b.cancellation_data?.reason || b.cancellation_reason) || null,
              cancellationRequestedAt: (b.cancellation_data?.requested_at || b.cancellation_requested_at) || null,
              cancellationAdminNotes: (b.cancellation_data?.admin_notes || b.cancellation_admin_notes) || null,
              refundStatus: (b.cancellation_data?.refund_status || b.refund_status) || null,
              refundAmount: b.cancellation_data?.refund_amount ? Number(b.cancellation_data.refund_amount) : (b.refund_amount ? Number(b.refund_amount) : null),
              refundChannel: (b.cancellation_data?.refund_channel || b.refund_channel) || null,
              refundReferenceNumber: (b.cancellation_data?.refund_reference_number || b.refund_reference_number) || null,
              refundReceiptUrl: (b.cancellation_data?.refund_receipt_url || b.refund_receipt_url) || null,
              refundedAt: (b.cancellation_data?.refunded_at || b.refunded_at) || null,
              startTime: (b.start_time || '13:00').slice(0, 5),
              endTime: (b.end_time || '18:00').slice(0, 5),
            };
          })
        );
      }
    } catch (err) {
      console.error('Failed to fetch customer booking history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();

    const channel = supabase
      .channel('customer-booking-history-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        () => {
          fetchHistory();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleOpenRescheduleModal = (item: any) => {
    setRescheduleTargetItem(item);
    setNewRescheduleDate('');
    setNewRescheduleStartTime((item.startTime || '13:00').slice(0, 5));
    setNewRescheduleEndTime((item.endTime || '18:00').slice(0, 5));
    setRescheduleReason('');
    setRescheduleError('');
  };

  const handleSubmitReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleTargetItem || !newRescheduleDate) {
      setRescheduleError('Please pick your new event date from the calendar.');
      return;
    }
    const currentCleanDate = (rescheduleTargetItem.rawDate || '').slice(0, 10);
    if (newRescheduleDate === currentCleanDate) {
      setRescheduleError('The new date cannot be the same as your currently scheduled event date.');
      return;
    }
    if (!newRescheduleStartTime || !newRescheduleEndTime) {
      setRescheduleError('Please select both start and end times for your event.');
      return;
    }
    if (timeToMinutes(newRescheduleEndTime) <= timeToMinutes(newRescheduleStartTime)) {
      setRescheduleError('Event end time must be after the start time.');
      return;
    }

    // Validate same-day start time has not already passed
    const todayIso = normalizeDateToIso(new Date());
    if (newRescheduleDate === todayIso) {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      if (timeToMinutes(newRescheduleStartTime) <= currentMinutes) {
        setRescheduleError(
          `Event start time (${formatTimeAmPm(newRescheduleStartTime)}) has already passed today. Please select a time slot after ${formatTimeAmPm(minutesToTime(currentMinutes))}.`
        );
        return;
      }
    }

    if (rescheduleFeasibility && !rescheduleFeasibility.isAvailable) {
      const firstConflict = rescheduleFeasibility.conflicts[0]?.message || 'Selected time slot conflicts with existing production schedules or operating hours.';
      setRescheduleError(`Scheduling Conflict: ${firstConflict}`);
      return;
    }
    if (!rescheduleReason.trim()) {
      setRescheduleError('Please enter a reason or note for your reschedule request.');
      return;
    }

    setSubmittingReschedule(true);
    setRescheduleError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const timeTag = `[Requested Time: ${formatTimeAmPm(newRescheduleStartTime)} – ${formatTimeAmPm(newRescheduleEndTime)}]`;
      const combinedReason = `${timeTag} ${rescheduleReason.trim()}`;

      // 1. Update booking in database
      const { error: dbError } = await supabase
        .from('bookings')
        .update({
          reschedule_status: 'pending',
          reschedule_requested_date: newRescheduleDate,
          reschedule_reason: combinedReason,
          reschedule_requested_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', rescheduleTargetItem.dbId);

      if (dbError) throw dbError;

      // 2. Email ALL system admins in database
      await sendAdminRescheduleAlert({
        bookingId: rescheduleTargetItem.id,
        customerName: rescheduleTargetItem.customerName || user?.user_metadata?.full_name || 'Valued Customer',
        customerEmail: rescheduleTargetItem.customerEmail || user?.email || '',
        customerPhone: rescheduleTargetItem.customerPhone || '',
        packageName: rescheduleTargetItem.package,
        originalDate: rescheduleTargetItem.date,
        requestedDate: `${formatDisplayDate(newRescheduleDate)} (${formatTimeAmPm(newRescheduleStartTime)} – ${formatTimeAmPm(newRescheduleEndTime)})`,
        reason: combinedReason,
        venue: rescheduleTargetItem.venue,
      });

      setRescheduleTargetItem(null);
      setRescheduleSuccessToast(true);
      setTimeout(() => setRescheduleSuccessToast(false), 6000);

      fetchHistory();
    } catch (err: any) {
      console.error('Failed to submit reschedule request:', err);
      setRescheduleError(err.message || 'Failed to submit reschedule request. Please try again.');
    } finally {
      setSubmittingReschedule(false);
    }
  };

  const handleOpenCancellationModal = (item: any) => {
    setCancellationTargetItem(item);
    setCancellationReason('');
    setCancellationError('');
  };

  const handleSubmitCancellation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellationTargetItem) return;

    if (!cancellationReason.trim()) {
      setCancellationError('Please provide a reason for cancelling your booking.');
      return;
    }

    setSubmittingCancellation(true);
    setCancellationError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const refundableAmount = cancellationTargetItem.isFullyPaid
        ? (cancellationTargetItem.rawTotal || 0)
        : (cancellationTargetItem.rawDeposit || 0);

      // Calculate transparent policy refund
      const refundCalc = calculateCancellationRefund({
        eventDateStr: cancellationTargetItem.rawDate,
        bookingCreatedAt: cancellationTargetItem.rawCreatedAt,
        amountPaid: refundableAmount,
        totalCost: cancellationTargetItem.rawTotal,
        policy: cancellationPolicy,
      });

      // 1. Update booking in database using single compact cancellation_data JSONB
      const { error: dbError } = await supabase
        .from('bookings')
        .update({
          cancellation_data: {
            status: 'requested',
            reason: cancellationReason.trim(),
            requested_at: new Date().toISOString(),
            refund_status: 'pending',
            refundable_amount: refundableAmount,
            refund_percentage: refundCalc.refundPercentage,
            gross_refund: refundCalc.grossRefundable,
            processing_fee: refundCalc.feeDeducted,
            net_refund: refundCalc.netRefundable,
            tier_applied: refundCalc.tierLabel,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', cancellationTargetItem.dbId);

      if (dbError) throw dbError;

      // 2. Email ALL system admins with exact Policy Net Refund recommendation
      await sendAdminCancellationAlert({
        bookingId: cancellationTargetItem.id,
        customerName: cancellationTargetItem.customerName || user?.user_metadata?.full_name || 'Valued Customer',
        customerEmail: cancellationTargetItem.customerEmail || user?.email || '',
        customerPhone: cancellationTargetItem.customerPhone || '',
        packageName: cancellationTargetItem.package,
        eventDate: cancellationTargetItem.date,
        totalCost: cancellationTargetItem.total,
        depositPaid: cancellationTargetItem.deposit,
        paidAmount: `₱${refundableAmount.toLocaleString()}`,
        policyNetRefund: `₱${refundCalc.netRefundable.toLocaleString()}`,
        tierApplied: refundCalc.tierLabel,
        reason: cancellationReason.trim(),
        venue: cancellationTargetItem.venue,
      });

      setCancellationTargetItem(null);
      setCancellationSuccessToast(true);
      setTimeout(() => setCancellationSuccessToast(false), 8000);

      fetchHistory();
    } catch (err: any) {
      console.error('Failed to submit cancellation request:', err);
      setCancellationError(err.message || 'Failed to submit cancellation request. Please try again.');
    } finally {
      setSubmittingCancellation(false);
    }
  };

  const handlePayRemainingBalance = async (item: any) => {
    if (!item) return;
    setPayingBalanceId(item.dbId);
    setBalanceError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const total = item.rawTotal || Number((item.total || '').replace(/[^\d.]/g, '')) || 0;
      const deposit = item.rawDeposit || Number((item.deposit || '').replace(/[^\d.]/g, '')) || 0;
      const rem = item.rawRemaining !== undefined ? item.rawRemaining : Math.max(0, total - deposit);

      if (rem <= 0) {
        alert('This booking is already fully settled.');
        return;
      }

      const cleanRef = item.id || `BNH-${item.dbId.slice(0, 8)}`;
      const refNum = `BAL-${cleanRef}`;

      const fullName = (item.customerName || user?.user_metadata?.full_name || '').trim();
      const nameParts = fullName ? fullName.split(' ') : [];
      const firstName = nameParts[0] || user?.user_metadata?.first_name || 'Valued';
      const lastName = nameParts.slice(1).join(' ') || user?.user_metadata?.last_name || 'Customer';
      const email = item.customerEmail || user?.email || 'customer@binhiconcept.ph';
      const phone = item.customerPhone || user?.user_metadata?.phone || '';

      const origin = window.location.origin;
      const redirectUrl = {
        success: `${origin}/?page=payment-success&ref=${cleanRef}&type=balance&booking_id=${item.dbId}`,
        failure: `${origin}/?page=payment-failure&ref=${cleanRef}&type=balance&booking_id=${item.dbId}`,
        cancel: `${origin}/?page=payment-cancel&ref=${cleanRef}&type=balance&booking_id=${item.dbId}`,
      };

      const sessionResult = await createPaymongoCheckoutSession({
        amount: rem,
        itemDesc: `50% Remaining Balance - ${item.package || 'Event Production'}`,
        referenceNumber: refNum,
        buyer: {
          firstName,
          lastName,
          email,
          phone,
        },
        redirectUrl,
      });

      if (sessionResult?.checkout_url) {
        if (sessionResult.checkout_id) {
          try {
            localStorage.setItem('binhi_paymongo_cs_id', sessionResult.checkout_id);
            localStorage.setItem(`binhi_cs_${cleanRef}`, sessionResult.checkout_id);
            localStorage.setItem(`binhi_cs_${refNum}`, sessionResult.checkout_id);
          } catch { }
        }
        window.location.href = sessionResult.checkout_url;
      } else {
        throw new Error('Unable to generate PayMongo checkout URL.');
      }
    } catch (err: any) {
      console.error('Balance settlement error:', err);
      setBalanceError(err?.message || 'Failed to initiate PayMongo payment. Please try again.');
    } finally {
      setPayingBalanceId(null);
    }
  };

  return (
    <section className={`pt-36 pb-24 px-6 min-h-screen bg-[var(--mist)] ${downloadModalItem ? 'print:hidden' : ''}`}>
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <MonoBadge icon={IconTicket}>Booking Records</MonoBadge>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ink)] mt-1.5">
            Booking History &amp; Receipts
          </h1>
          <p className="text-xs text-[#24252c]/60 mt-1">
            View all past and upcoming event reservations, invoices, and payment receipts.
          </p>
        </div>

        {/* Balance Error Toast */}
        {balanceError && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-300 text-rose-900 shadow-sm flex items-center justify-between gap-3 animate-fade-in text-xs">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                !
              </span>
              <div>
                <strong className="font-extrabold text-sm block">Payment Initialization Failed</strong>
                <span>{balanceError}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setBalanceError('')}
              className="text-rose-700 hover:text-rose-950 font-bold p-1 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Reschedule Success Toast */}
        {rescheduleSuccessToast && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 shadow-sm flex items-center justify-between gap-3 animate-fade-in text-xs">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                ✓
              </span>
              <div>
                <strong className="font-extrabold text-sm block">Reschedule Request Sent!</strong>
                <span>Our production administrators have been notified via email to review and confirm your new requested date.</span>
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

        {/* Cancellation Success Toast */}
        {cancellationSuccessToast && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-300 text-rose-900 shadow-sm flex items-center justify-between gap-3 animate-fade-in text-xs">
            <div className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                ✓
              </span>
              <div>
                <strong className="font-extrabold text-sm block">Cancellation &amp; Refund Request Submitted</strong>
                <span>Our production management team has received your cancellation and will process your refund according to our policy.</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setCancellationSuccessToast(false)}
              className="text-rose-700 hover:text-rose-950 font-bold p-1 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-28 bg-white/60 rounded-2xl animate-pulse border border-[#24252c]/10" />
            ))}
          </div>
        ) : historyItems.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 border border-[#24252c]/[0.08] shadow-sm text-center">
            <EmptyState
              title="No Active or Past Bookings"
              description="You haven't reserved an event package yet. Choose your date and package to start your booking."
            />
            <button
              onClick={() => go('packages')}
              className="mt-4 bg-[var(--ink)] text-white text-xs font-semibold px-5 py-2.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors cursor-pointer"
            >
              Explore Production Packages →
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {historyItems.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-2xl p-5 border border-[#24252c]/[0.08] shadow-sm hover:border-[#1090F8]/30 transition-all space-y-3.5"
              >
                {/* Header Row: Ref #, Badges & Payment Method */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#24252c]/[0.06]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-bold text-xs text-[#1090F8]">{item.id}</span>
                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${item.statusColor}`}
                    >
                      {item.status}
                    </span>
                    {item.cancellationStatus === 'requested' && (
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-600 text-white uppercase tracking-wider shadow-2xs animate-pulse">
                        Cancellation Requested
                      </span>
                    )}
                    {item.cancellationStatus === 'rejected' && (
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-300 uppercase tracking-wider">
                        Cancellation Declined (Active)
                      </span>
                    )}
                    {item.rawStatus === 'cancelled' && item.refundStatus === 'processed' && (
                      <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 uppercase tracking-wider">
                        Refunded ₱{item.refundAmount?.toLocaleString() || item.deposit} ({item.refundChannel || 'PayMongo'})
                      </span>
                    )}
                    {item.rescheduleStatus === 'pending' && (
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500 text-white uppercase tracking-wider shadow-2xs">
                        Reschedule Pending: {formatDisplayDate(item.rescheduleRequestedDate)}
                      </span>
                    )}
                    {item.rawStatus !== 'cancelled' && (
                      item.isFullyPaid ? (
                        <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500 text-white uppercase tracking-wider shadow-2xs">
                          Fully Paid (100%) ✓
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20 uppercase tracking-wider">
                          50% Deposit Paid (Balance: {item.remaining})
                        </span>
                      )
                    )}
                  </div>

                  <div className="text-[10px] font-semibold text-[#24252c]/50">
                    Via {item.paymentChannel}
                  </div>
                </div>

                {/* Content & Horizontal Actions Toolbar */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left: Package details & pricing stats */}
                  <div className="space-y-1.5 min-w-0">
                    <h3 className="font-bold text-base text-[var(--ink)] leading-snug">{item.package}</h3>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#24252c]/60">
                      <span className="inline-flex items-center gap-1 font-medium text-[var(--ink)]">
                        <IconCalendar className="w-3.5 h-3.5 text-[#1090F8]" />
                        {item.date}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[#24252c]/70 truncate max-w-[220px]">
                        <IconPin className="w-3.5 h-3.5 text-[#24252c]/40 shrink-0" />
                        {item.venue}
                      </span>
                      <span>Total: <strong className="text-[var(--ink)] font-bold">{item.total}</strong></span>
                      <span>Paid: <strong className="text-emerald-700 font-bold">{item.isFullyPaid ? item.total : item.deposit}</strong></span>
                      {!item.isFullyPaid && item.rawRemaining > 0 && item.rawStatus !== 'cancelled' && item.cancellationStatus !== 'requested' && (
                        <span>Bal: <strong className="text-amber-700 font-bold">{item.remaining}</strong></span>
                      )}
                    </div>

                    {item.cancellationStatus === 'requested' && item.cancellationReason && (
                      <div className="text-[11px] text-rose-800 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200 mt-1 inline-block">
                        <strong>Cancellation Requested:</strong> "{item.cancellationReason}"
                      </div>
                    )}
                    {item.cancellationStatus === 'rejected' && item.cancellationAdminNotes && (
                      <div className="text-[11px] text-slate-800 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 mt-1 inline-block">
                        <strong>Admin Note:</strong> {item.cancellationAdminNotes}
                      </div>
                    )}
                    {item.rescheduleStatus === 'pending' && item.rescheduleReason && (
                      <div className="text-[11px] text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 mt-1 inline-block">
                        <strong>Reschedule Note:</strong> "{item.rescheduleReason}"
                      </div>
                    )}
                  </div>

                  {/* Right: Streamlined Action Buttons */}
                  <div className="flex items-center gap-2 flex-wrap lg:justify-end shrink-0 pt-2 lg:pt-0">
                    {/* If cancellation is requested, hide interfering buttons and show clear review status */}
                    {item.cancellationStatus === 'requested' ? (
                      <div className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-3.5 py-1.5 rounded-full inline-flex items-center gap-1.5 shadow-2xs">
                        <IconAlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span>Cancellation Under Review</span>
                      </div>
                    ) : (
                      <>
                        {/* Pay Remaining Balance (High-priority action) */}
                        {!item.isCompleted && item.rawStatus !== 'cancelled' && !item.isFullyPaid && item.rawRemaining > 0 && (
                          <button
                            type="button"
                            onClick={() => handlePayRemainingBalance(item)}
                            disabled={payingBalanceId === item.dbId}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3.5 py-1.5 rounded-full transition-all shadow-2xs cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-60"
                          >
                            <IconCheck className="w-3.5 h-3.5" />
                            <span>{payingBalanceId === item.dbId ? 'Connecting...' : `Pay Bal (${item.remaining})`}</span>
                          </button>
                        )}

                        {/* Track Live Setup */}
                        {!item.isCompleted && item.rawStatus !== 'cancelled' && (
                          <button
                            onClick={() => {
                              localStorage.setItem('binhi_selected_active_booking_id', item.dbId);
                              go('booking-tracker');
                            }}
                            className="bg-[#1090F8] text-white text-xs font-bold px-3.5 py-1.5 rounded-full hover:bg-[#1090F8]/90 transition-colors shadow-2xs cursor-pointer inline-flex items-center gap-1"
                          >
                            <span>Track Live</span>
                            <span className="font-bold">→</span>
                          </button>
                        )}

                        {/* Reschedule Button */}
                        {!item.isCompleted && item.rawStatus !== 'cancelled' && (
                          <button
                            type="button"
                            onClick={() => handleOpenRescheduleModal(item)}
                            className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors cursor-pointer inline-flex items-center gap-1"
                            title="Reschedule event date"
                          >
                            <IconCalendar className="w-3.5 h-3.5 text-amber-600" />
                            <span>{item.rescheduleStatus === 'pending' ? 'Reschedule Pending' : 'Reschedule'}</span>
                          </button>
                        )}

                        {/* Cancel & Refund Button */}
                        {!item.isCompleted && item.rawStatus !== 'cancelled' && (
                          <button
                            type="button"
                            onClick={() => handleOpenCancellationModal(item)}
                            className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors cursor-pointer inline-flex items-center gap-1"
                            title="Cancel reservation & request refund"
                          >
                            <IconX className="w-3.5 h-3.5 text-rose-600" />
                            <span>Cancel</span>
                          </button>
                        )}
                      </>
                    )}

                    {/* View & Print Official Receipt (Always available) */}
                    <button
                      onClick={() => setDownloadModalItem(item)}
                      className="bg-white text-[var(--ink)] border border-[#24252c]/15 text-xs font-semibold px-3 py-1.5 rounded-full hover:bg-[var(--mist)] transition-colors cursor-pointer inline-flex items-center gap-1 shadow-2xs"
                      title="View & Print Official Receipt"
                    >
                      <IconPrinter className="w-3.5 h-3.5 text-[#1090F8]" />
                      <span>Receipt</span>
                    </button>

                    {/* Leave Review (Completed bookings) */}
                    {item.isCompleted && (
                      <button
                        onClick={() => go('review-submit')}
                        className="bg-[var(--ink)] text-white text-xs font-semibold px-4 py-1.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors shadow-2xs cursor-pointer inline-flex items-center"
                      >
                        Leave Review
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Official Receipt Modal ── */}
        <ModalOverlay
          isOpen={!!downloadModalItem}
          onClose={() => setDownloadModalItem(null)}
          className="printable-receipt-modal"
        >
          {downloadModalItem && (
            <div className="printable-receipt-card bg-white rounded-[2.5rem] max-w-lg w-full max-h-[85vh] shadow-2xl border border-[#24252c]/10 relative p-1.5 sm:p-2.5 overflow-hidden flex flex-col print:max-w-none print:w-full print:max-h-none print:shadow-none print:border print:border-gray-300 print:rounded-2xl print:p-6 print:m-0 print:overflow-visible">
              <button
                type="button"
                onClick={() => setDownloadModalItem(null)}
                className="absolute top-6 right-6 z-20 text-[#24252c]/50 hover:text-[var(--ink)] p-1.5 rounded-full hover:bg-[var(--mist)] transition-colors bg-white/90 backdrop-blur-md shadow-sm border border-[#24252c]/10 cursor-pointer print:hidden"
              >
                <IconX className="w-5 h-5" />
              </button>

              <div className="printable-receipt-content flex-1 overflow-y-auto p-5 sm:p-7 space-y-4 modal-scroll pr-4 sm:pr-6 print:overflow-visible print:max-h-none print:p-0 print:space-y-4">
                <div className="border-b border-[#24252c]/10 pb-4 mb-2 text-center print:pb-3 print:mb-2 print:border-gray-300">
                  <div className="w-10 h-10 rounded-full bg-[var(--ink)] text-white font-black text-xs flex items-center justify-center mx-auto mb-2 print:bg-black print:text-white">
                    BC
                  </div>
                  <h3 className="text-xl font-extrabold text-[var(--ink)] print:text-black">BINHI Concept</h3>
                  <p className="text-[11px] text-[#24252c]/60 print:text-gray-600">Official Event Booking Invoice &amp; Slip</p>
                  <span className="font-mono text-xs font-bold text-[#1090F8] mt-1 inline-block print:text-black">
                    Ref #{downloadModalItem.id}
                  </span>
                  {downloadModalItem.createdAt && (
                    <div className="text-[10px] text-[#24252c]/50 print:text-gray-500 mt-0.5">
                      Booking Date: {downloadModalItem.createdAt}
                    </div>
                  )}
                </div>

                {/* Customer & Event Details */}
                <div className="grid grid-cols-2 gap-3 py-4 text-xs border-b border-[#24252c]/10 print:border-gray-200 print:py-3">
                  <div>
                    <span className="text-[10px] text-[#24252c]/50 print:text-gray-500 uppercase font-semibold block mb-0.5">Customer Details</span>
                    <div className="font-bold text-[var(--ink)] print:text-black">{downloadModalItem.customerName}</div>
                    <div className="text-[11px] text-[#24252c]/60 print:text-gray-700">{downloadModalItem.customerEmail}</div>
                    {downloadModalItem.customerPhone && (
                      <div className="text-[11px] text-[#24252c]/60 print:text-gray-700">{downloadModalItem.customerPhone}</div>
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] text-[#24252c]/50 print:text-gray-500 uppercase font-semibold block mb-0.5">Event Details</span>
                    <div className="font-bold text-[var(--ink)] print:text-black">{downloadModalItem.date}</div>
                    <div className="text-[11px] text-[#24252c]/60 print:text-gray-700">{downloadModalItem.venue}</div>
                    {downloadModalItem.eventType && (
                      <div className="text-[11px] text-[#1090F8] font-semibold print:text-gray-800">{downloadModalItem.eventType}</div>
                    )}
                  </div>
                </div>

                {/* Line Item Financial Breakdown */}
                <div className="py-4 space-y-3 text-xs border-b border-[#24252c]/10 print:border-gray-200 print:py-3">
                  <span className="text-[10px] text-[#24252c]/50 print:text-gray-500 uppercase font-semibold block mb-1">
                    Itemized Package &amp; Production Inclusions
                  </span>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="text-[var(--ink)] font-bold print:text-black">{downloadModalItem.package}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--mist)] text-[#1090F8] border border-[#1090F8]/20 print:border-gray-300 print:text-gray-700 print:bg-transparent">
                          {downloadModalItem.packageTag}
                        </span>
                      </div>
                      <span className="font-mono font-bold text-[var(--ink)] print:text-black">
                        ₱{downloadModalItem.packagePrice.toLocaleString()}
                      </span>
                    </div>

                    {/* Detailed Package Equipment & Inclusions List */}
                    {downloadModalItem.packageInclusions && downloadModalItem.packageInclusions.length > 0 && (
                      <div className="pl-3 py-1.5 border-l-2 border-[#1090F8]/40 bg-[var(--mist)]/50 rounded-r-xl space-y-1 text-[11px] text-[#24252c]/75 print:border-l-2 print:border-gray-400 print:bg-transparent print:rounded-none">
                        <div className="text-[10px] font-bold uppercase text-[#24252c]/50 print:text-gray-600">Included Technical Gear &amp; Services:</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-2 gap-y-0.5">
                          {downloadModalItem.packageInclusions.map((inc: string, i: number) => (
                            <div key={i} className="flex items-start gap-1 text-[11px] print:text-gray-800">
                              <span className="text-[#1090F8] print:text-gray-600 font-bold shrink-0">•</span>
                              <span>{inc}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Selected Add-ons */}
                  {downloadModalItem.selectedAddons && downloadModalItem.selectedAddons.length > 0 && (
                    <div className="space-y-1 pl-3 border-l-2 border-amber-500/40 py-1 bg-amber-50/30 rounded-r-xl print:border-gray-400 print:bg-transparent print:rounded-none">
                      <span className="text-[10px] font-bold text-amber-800 print:text-gray-700 uppercase">Selected Equipment Add-ons:</span>
                      {downloadModalItem.selectedAddons.map((addon: string, idx: number) => (
                        <div key={idx} className="flex justify-between text-[11px] text-[#24252c]/80 print:text-gray-800">
                          <span>• {addon}</span>
                        </div>
                      ))}
                      <div className="flex justify-between text-[11px] font-bold text-[var(--ink)] print:text-black pt-1 border-t border-amber-200 print:border-gray-300">
                        <span>Add-ons Subtotal:</span>
                        <span className="font-mono">₱{downloadModalItem.addonsCost.toLocaleString()}</span>
                      </div>
                    </div>
                  )}

                  {/* Transport Charge */}
                  <div className="flex justify-between items-center text-[11px] text-[#24252c]/70 print:text-gray-700 pt-1">
                    <span>Crew Transport &amp; Logistics Charge</span>
                    <span className="font-mono font-bold text-[#1090F8] print:text-black">₱{downloadModalItem.transportFee.toLocaleString()}</span>
                  </div>

                  <div className="flex justify-between items-center text-sm font-extrabold text-[var(--ink)] print:text-black pt-2 border-t border-[#24252c]/10 print:border-gray-300">
                    <span>Total Invoice Amount</span>
                    <span className="font-mono text-base">{downloadModalItem.total}</span>
                  </div>
                </div>

                {/* Payment Settlement History */}
                <div className="py-4 space-y-2.5 text-xs print:py-3">
                  <span className="text-[10px] text-[#24252c]/50 print:text-gray-500 uppercase font-semibold block">
                    Payment Audit &amp; Settlement Status
                  </span>

                  <div className="p-3 rounded-xl bg-[var(--mist)] space-y-1 print:bg-transparent print:border print:border-gray-200 print:rounded-lg">
                    <div className="flex justify-between">
                      <span className="text-[#24252c]/60 print:text-gray-700">50% Reservation Deposit Paid:</span>
                      <span className="font-mono font-bold text-emerald-600 print:text-black">{downloadModalItem.deposit}</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-[#24252c]/50 print:text-gray-600">
                      <span>Deposit Payment Method:</span>
                      <span>{downloadModalItem.paymentChannel}</span>
                    </div>
                  </div>

                  {downloadModalItem.isFullyPaid ? (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 space-y-1 print:bg-transparent print:border-gray-200 print:text-black print:rounded-lg">
                      <div className="flex justify-between font-bold">
                        <span>✓ Balance Fully Settled (100% Paid)</span>
                        <span className="font-mono">₱0 Rem.</span>
                      </div>
                      {downloadModalItem.balancePaidAt && (
                        <div className="flex justify-between text-[11px] print:text-gray-700">
                          <span>Full Payment Date &amp; Time:</span>
                          <span className="font-semibold">{downloadModalItem.balancePaidAt}</span>
                        </div>
                      )}
                      {downloadModalItem.balancePaymentMethod && (
                        <div className="flex justify-between text-[11px] print:text-gray-700">
                          <span>Balance Payment Method:</span>
                          <span className="font-semibold">{downloadModalItem.balancePaymentMethod}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 flex justify-between items-center print:bg-transparent print:border-gray-200 print:text-black print:rounded-lg">
                      <div>
                        <span className="font-bold block">Remaining Balance Due:</span>
                        <span className="text-[10px] text-amber-700 print:text-gray-600">To be settled on or before event date</span>
                      </div>
                      <span className="font-mono font-extrabold text-base text-amber-800 print:text-black">{downloadModalItem.remaining}</span>
                    </div>
                  )}
                </div>

                {/* Receipt Print Disclaimer */}
                <div className="hidden print:block pt-3 border-t border-gray-200 text-center text-[10px] text-gray-500">
                  <p>Thank you for choosing BINHI Concept for your production &amp; events setup.</p>
                  <p className="mt-0.5">For inquiries or coordination, reach out to us at support@binhiconcept.ph</p>
                </div>

                {/* Actions (Print & Close) */}
                <div className="flex gap-3 pt-2 print:hidden">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="flex-1 bg-[var(--ink)] text-white text-xs font-semibold py-3 rounded-full hover:bg-[var(--ink-soft)] transition-colors shadow-md cursor-pointer text-center flex items-center justify-center gap-2"
                  >
                    <IconPrinter className="w-4 h-4 text-[#1090F8]" />
                    <span>Print / Save PDF Receipt</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDownloadModalItem(null)}
                    className="bg-[var(--mist)] text-[var(--ink)] border border-[#24252c]/10 text-xs font-semibold px-5 py-3 rounded-full hover:bg-white transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </ModalOverlay>

        {/* ── Customer Reschedule Request Modal ── */}
        <ModalOverlay isOpen={!!rescheduleTargetItem} onClose={() => setRescheduleTargetItem(null)}>
          {rescheduleTargetItem && (
            <div className="bg-white rounded-[2.5rem] max-w-xl w-full max-h-[85vh] shadow-2xl border border-[#24252c]/10 relative p-1.5 sm:p-2.5 overflow-hidden flex flex-col">
              <button
                type="button"
                onClick={() => setRescheduleTargetItem(null)}
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
                    Select your desired new event date on the calendar below. All system administrators will be alerted immediately via email to review your request.
                  </p>
                </div>

                <form onSubmit={handleSubmitReschedule} className="space-y-4 text-xs">
                  {/* Current Schedule Summary */}
                  <div className="p-3.5 rounded-2xl bg-[var(--mist)] border border-[#24252c]/[0.06] flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#24252c]/50 block">Current Schedule</span>
                      <span className="font-extrabold text-sm text-[var(--ink)]">
                        {rescheduleTargetItem.date}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono font-bold text-[#1090F8] bg-white px-2.5 py-1 rounded-full border border-black/10">
                      Ref #{rescheduleTargetItem.id}
                    </span>
                  </div>

                  {/* Interactive Availability Calendar without stroke */}
                  <div className="p-4 rounded-2xl bg-[var(--mist)]">
                    <BookingRescheduleCalendar
                      originalDate={rescheduleTargetItem.rawDate}
                      selectedDate={newRescheduleDate}
                      onSelectDate={(d) => {
                        setNewRescheduleDate(d);
                        setRescheduleError('');
                      }}
                      excludeBookingId={rescheduleTargetItem.dbId}
                      minDateOffsetDays={0}
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

                  {/* Event Schedule Window & Time Selection */}
                  {newRescheduleDate && (
                    <div className="p-4 rounded-2xl bg-[#F8F9FA] border border-[#24252c]/10 space-y-3.5">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-1.5">
                          <IconClock className="w-4 h-4 text-[#1090F8]" />
                          <span className="text-[11px] font-bold uppercase text-[var(--ink)] tracking-wider">
                            Event Schedule Window (Event Proper)
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              rescheduleOpWindow.isOpen
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                : 'bg-rose-50 text-rose-800 border-rose-300'
                            }`}
                          >
                            {rescheduleOpWindow.isOpen
                              ? `Operating Hours: ${formatTimeAmPm(rescheduleOpWindow.openTime)} - ${formatTimeAmPm(rescheduleOpWindow.closeTime)}`
                              : 'Closed on this Date'}
                          </span>
                        </div>
                      </div>

                      {rescheduleOpWindow.isOpen && newRescheduleStartTime && (
                        <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200/90 px-3 py-2 rounded-xl text-xs">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-900 block">Binhi Styling &amp; Setup Ingress:</span>
                            <span className="text-[11px] text-emerald-800">
                              Crew arrives on-site early to assemble styling before program start
                            </span>
                          </div>
                          <span className="font-mono font-extrabold text-xs text-emerald-950 bg-white px-2.5 py-1 rounded-lg border border-emerald-300 shrink-0">
                            Call Time: ~{formatTimeAmPm(calculateCrewArrivalTime(newRescheduleStartTime, bookingSettings.default_turnaround_hours))}
                          </span>
                        </div>
                      )}

                      {/* Quick Preset Buttons */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[10px] text-[#24252c]/50 font-bold uppercase mr-1">Quick Presets:</span>
                        {[
                          { label: 'Afternoon (1 PM - 6 PM)', s: '13:00', e: '18:00' },
                          { label: 'Morning (9 AM - 2 PM)', s: '09:00', e: '14:00' },
                          { label: 'Evening (4 PM - 9 PM)', s: '16:00', e: '21:00' },
                          { label: 'Full Day (10 AM - 6 PM)', s: '10:00', e: '18:00' },
                        ].map((preset) => {
                          const isMatch = newRescheduleStartTime === preset.s && newRescheduleEndTime === preset.e;
                          return (
                            <button
                              key={preset.label}
                              type="button"
                              onClick={() => {
                                setNewRescheduleStartTime(preset.s);
                                setNewRescheduleEndTime(preset.e);
                                setRescheduleError('');
                              }}
                              className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                                isMatch
                                  ? 'bg-[var(--ink)] text-white border-[var(--ink)] shadow-2xs'
                                  : 'bg-white text-[var(--ink)] border-black/10 hover:border-black/25'
                              }`}
                            >
                              {preset.label}
                            </button>
                          );
                        })}
                      </div>

                      {/* Time Inputs Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div>
                          <label className="text-[10px] font-bold uppercase text-[#24252c]/60 block mb-1">
                            Start Time <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="time"
                            value={newRescheduleStartTime}
                            min={rescheduleOpWindow.openTime}
                            max={rescheduleOpWindow.closeTime}
                            onChange={(e) => {
                              setNewRescheduleStartTime(e.target.value);
                              setRescheduleError('');
                            }}
                            className="w-full rounded-xl border border-black/10 px-3 py-2 bg-white text-xs font-semibold text-[var(--ink)] focus:outline-none focus:border-[#1090F8] transition-colors"
                            required
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold uppercase text-[#24252c]/60 block mb-1">
                            End Time <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="time"
                            value={newRescheduleEndTime}
                            min={newRescheduleStartTime || rescheduleOpWindow.openTime}
                            max={rescheduleOpWindow.closeTime}
                            onChange={(e) => {
                              setNewRescheduleEndTime(e.target.value);
                              setRescheduleError('');
                            }}
                            className="w-full rounded-xl border border-black/10 px-3 py-2 bg-white text-xs font-semibold text-[var(--ink)] focus:outline-none focus:border-[#1090F8] transition-colors"
                            required
                          />
                        </div>
                      </div>

                      {/* Duration Info Pill */}
                      {newRescheduleStartTime && newRescheduleEndTime && (
                        <div className="flex items-center justify-between text-[11px] px-1 text-[#24252c]/70">
                          <span>Event Duration:</span>
                          <span className="font-bold text-[var(--ink)]">
                            {(() => {
                              const diffMin = timeToMinutes(newRescheduleEndTime) - timeToMinutes(newRescheduleStartTime);
                              if (diffMin <= 0) return 'Invalid time range (End must be after start)';
                              const hrs = Math.floor(diffMin / 60);
                              const mins = diffMin % 60;
                              return `${hrs > 0 ? `${hrs} hr${hrs > 1 ? 's' : ''}` : ''}${mins > 0 ? ` ${mins} min` : ''} (${formatTimeAmPm(newRescheduleStartTime)} - ${formatTimeAmPm(newRescheduleEndTime)})`;
                            })()}
                          </span>
                        </div>
                      )}

                      {/* Real-time Feasibility & Minimum Rest / Turnaround Gap Feedback */}
                      {rescheduleFeasibility && (
                        <div className="pt-1">
                          {rescheduleFeasibility.isAvailable ? (
                            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-emerald-200 text-emerald-800 flex items-center justify-center shrink-0">
                                <IconCheck className="w-3.5 h-3.5" />
                              </span>
                              <div>
                                <strong className="block font-bold">Time Slot Confirmed Available</strong>
                                <span className="text-[11px] text-emerald-800">
                                  Required crew turnaround buffer is clear. No conflicts with other events.
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1.5">
                              <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-amber-200 text-amber-800 flex items-center justify-center shrink-0">
                                  <IconAlertTriangle className="w-3.5 h-3.5" />
                                </span>
                                <strong className="font-bold text-amber-950">
                                  Schedule Notice / Turnaround Gap Warning
                                </strong>
                              </div>
                              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-900 pl-1">
                                {rescheduleFeasibility.conflicts.map((c, idx) => (
                                  <li key={idx}>{c.message}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
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
                              `Due to unexpected venue availability adjustments, we would like to request moving our event schedule${newRescheduleDate ? ` to ${formatDisplayDate(newRescheduleDate)}` : ''
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
                              `Due to program timeline adjustments and client coordination, we kindly request rescheduling our booking${newRescheduleDate ? ` to ${formatDisplayDate(newRescheduleDate)}` : ''
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
                              `Due to weather forecasts and outdoor logistical considerations, we request shifting our event reservation${newRescheduleDate ? ` to ${formatDisplayDate(newRescheduleDate)}` : ''
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
                              `Due to an unavoidable schedule conflict, we would like to request moving our event date${newRescheduleDate ? ` to ${formatDisplayDate(newRescheduleDate)}` : ''
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
                      onClick={() => setRescheduleTargetItem(null)}
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
          )}
        </ModalOverlay>

        {/* ── Customer Cancellation & Refund Request Modal ── */}
        <ModalOverlay isOpen={!!cancellationTargetItem} onClose={() => setCancellationTargetItem(null)}>
          {cancellationTargetItem && (() => {
            const refundCalc = calculateCancellationRefund({
              eventDateStr: cancellationTargetItem.rawDate,
              bookingCreatedAt: cancellationTargetItem.rawCreatedAt,
              amountPaid: cancellationTargetItem.isFullyPaid
                ? cancellationTargetItem.rawTotal
                : cancellationTargetItem.rawDeposit,
              totalCost: cancellationTargetItem.rawTotal,
              policy: cancellationPolicy,
            });

            return (
            <div className="bg-white rounded-[2.5rem] max-w-xl w-full max-h-[85vh] shadow-2xl border border-[#24252c]/10 relative p-1.5 sm:p-2.5 overflow-hidden flex flex-col">
              <button
                type="button"
                onClick={() => setCancellationTargetItem(null)}
                className="absolute top-6 right-6 z-20 text-[#24252c]/50 hover:text-[var(--ink)] p-1.5 rounded-full hover:bg-[var(--mist)] transition-colors bg-white/90 backdrop-blur-md shadow-sm border border-[#24252c]/10 cursor-pointer"
              >
                <IconX className="w-5 h-5" />
              </button>

              <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-4 modal-scroll pr-4 sm:pr-6">
                <div className="mb-2 pb-3 border-b border-[#24252c]/[0.06]">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600">
                      <IconX className="w-4 h-4" />
                    </span>
                    <h3 className="text-xl font-extrabold text-[var(--ink)]">
                      Cancel Booking &amp; Request Refund
                    </h3>
                  </div>
                  <p className="text-xs text-[#24252c]/60">
                    Submit your cancellation request. Production administrators will review and disburse your refund based on our cancellation policy.
                  </p>
                </div>

                <form onSubmit={handleSubmitCancellation} className="space-y-4 text-xs">
                  {/* Booking & Refundable Amount Summary */}
                  <div className="p-4 rounded-2xl bg-rose-50/50 border border-rose-200/70 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-rose-900/60 block">Event Package</span>
                      <span className="text-[11px] font-mono font-bold text-rose-700 bg-white px-2.5 py-0.5 rounded-full border border-rose-200">
                        Ref #{cancellationTargetItem.id}
                      </span>
                    </div>
                    <div className="font-extrabold text-sm text-[var(--ink)]">
                      {cancellationTargetItem.package} • {cancellationTargetItem.date}
                    </div>

                    {/* Policy Matched Tier Banner */}
                    <div className="p-3 rounded-xl bg-white border border-rose-200/80 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#24252c]/60 font-medium">Policy Tier:</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                          refundCalc.refundPercentage === 100
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : refundCalc.refundPercentage > 0
                            ? 'bg-blue-50 text-blue-800 border-blue-300'
                            : 'bg-rose-50 text-rose-800 border-rose-300'
                        }`}>
                          {refundCalc.isGracePeriodApplied
                            ? 'Grace Period (100% Refund)'
                            : `${refundCalc.refundPercentage}% Refund Schedule`}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-[#24252c]/5">
                        <div>
                          <span className="text-[#24252c]/50 block text-[10px]">Paid Amount</span>
                          <strong className="text-[var(--ink)]">
                            ₱{(cancellationTargetItem.isFullyPaid ? cancellationTargetItem.rawTotal : cancellationTargetItem.rawDeposit)?.toLocaleString()}
                          </strong>
                        </div>
                        <div>
                          <span className="text-[#24252c]/50 block text-[10px]">Calculated Refund</span>
                          <strong className="text-emerald-700 text-sm">
                            ₱{refundCalc.netRefundable.toLocaleString()}
                          </strong>
                        </div>
                      </div>

                      <div className="text-[10px] text-[#24252c]/70 leading-relaxed bg-[var(--mist)] p-2 rounded-lg">
                        {refundCalc.summaryExplanation}
                      </div>
                    </div>
                  </div>

                  {/* Refund Policy Notice (Clean Icon, No Emoji) */}
                  <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-900 text-[11px] space-y-1">
                    <div className="font-extrabold flex items-center gap-1.5 text-amber-950">
                      <IconShield className="w-3.5 h-3.5 text-amber-700" />
                      <span>Refund Policy &amp; Timelines</span>
                    </div>
                    <p className="text-amber-900/80 leading-relaxed">
                      Approved refunds via the original PayMongo payment method will automatically reflect in your bank account or e-wallet within <strong>5 to 10 business days</strong>. Manual refunds will be coordinated directly.
                    </p>
                  </div>

                  {/* Reason & Templates */}
                  <div className="space-y-2 pt-2 border-t border-[#24252c]/[0.08]">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div>
                        <label className="text-[11px] font-black uppercase text-[var(--ink)] block">
                          Reason for Cancellation <span className="text-rose-500">*</span>
                        </label>
                        <span className="text-[10px] text-[#24252c]/60">
                          Please let us know the reason for cancellation
                        </span>
                      </div>

                      {/* Quick Reason Templates */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() =>
                            setCancellationReason(
                              'Due to unforeseen circumstances, our event has been officially cancelled.'
                            )
                          }
                          className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors cursor-pointer"
                        >
                          Event Cancelled
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setCancellationReason(
                              'Due to unexpected schedule conflicts and personal emergency, we are unable to proceed.'
                            )
                          }
                          className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition-colors cursor-pointer"
                        >
                          Emergency
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setCancellationReason(
                              'Due to venue booking cancellation and client budget changes, we request to cancel.'
                            )
                          }
                          className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors cursor-pointer"
                        >
                          Venue/Budget Change
                        </button>
                      </div>
                    </div>

                    <textarea
                      rows={4}
                      value={cancellationReason}
                      onChange={(e) => setCancellationReason(e.target.value)}
                      placeholder="Please explain why you need to cancel this reservation..."
                      className="w-full rounded-2xl border border-black/10 px-4 py-3 bg-[#F8F9FA] focus:bg-white text-xs font-medium text-[var(--ink)] placeholder:text-[#24252c]/40 focus:outline-none focus:border-rose-500 transition-colors resize-none leading-relaxed"
                      required
                    />
                    <div className="flex justify-between items-center text-[10px] text-[#24252c]/50 px-1">
                      <span>Our administration will review and confirm your refund.</span>
                      <span className="font-mono font-semibold">{cancellationReason.length} chars</span>
                    </div>
                  </div>

                  {/* Error banner if any */}
                  {cancellationError && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                      {cancellationError}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#24252c]/[0.06]">
                    <button
                      type="button"
                      onClick={() => setCancellationTargetItem(null)}
                      className="px-5 py-2.5 rounded-full border border-black/10 text-xs font-semibold text-[var(--ink)] hover:bg-[#F0F0F0] transition-colors cursor-pointer"
                    >
                      Go Back
                    </button>
                    <button
                      type="submit"
                      disabled={submittingCancellation || !cancellationReason.trim()}
                      className="bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-full transition-colors cursor-pointer text-xs shadow-md flex items-center gap-1.5"
                    >
                      {submittingCancellation ? 'Submitting Cancellation...' : 'Confirm Cancellation & Refund Request'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
            );
          })()}
        </ModalOverlay>
      </div>
    </section>
  );
}
