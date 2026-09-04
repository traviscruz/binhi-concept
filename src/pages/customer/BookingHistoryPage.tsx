import { useState, useEffect } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import { IconTicket, IconCalendar, IconPin, IconX, IconPrinter } from '../../components/shared/icons';
import { ModalOverlay } from '../../components/shared/ModalOverlay';
import { EmptyState } from '../../components/shared/EmptyState';
import { BookingRescheduleCalendar } from '../../components/shared/BookingRescheduleCalendar';
import { supabase } from '../../lib/supabase';
import { formatDisplayDate } from '../../utils/bookingService';
import { sendAdminRescheduleAlert } from '../../utils/emailService';

export default function BookingHistoryPage({ go }: { go: (p: Page) => void }) {
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadModalItem, setDownloadModalItem] = useState<any | null>(null);

  // Reschedule Request Modal States
  const [rescheduleTargetItem, setRescheduleTargetItem] = useState<any | null>(null);
  const [newRescheduleDate, setNewRescheduleDate] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [submittingReschedule, setSubmittingReschedule] = useState(false);
  const [rescheduleSuccessToast, setRescheduleSuccessToast] = useState(false);
  const [rescheduleError, setRescheduleError] = useState('');

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
              total: `₱${total.toLocaleString()}`,
              deposit: `₱${deposit.toLocaleString()}`,
              remaining: `₱${remBal.toLocaleString()}`,
              isFullyPaid: isFull,
              balancePaidAt: b.balance_paid_at ? new Date(b.balance_paid_at).toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '',
              balancePaymentMethod: b.balance_payment_method || 'Cash on Site / Event Day',
              createdAt: b.created_at ? new Date(b.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '',
              isCompleted: (b.status || b.payment_status || '').toLowerCase() === 'completed',
              status: (b.status || b.payment_status || '').toLowerCase() === 'completed' ? 'Completed' : b.payment_status === 'paid' ? 'Confirmed & Secured' : b.payment_status === 'pending' ? 'Pending Payment' : b.payment_status === 'cancelled' ? 'Cancelled' : 'Confirmed',
              statusColor: (b.status || b.payment_status || '').toLowerCase() === 'completed' ? 'bg-[#1090F8]/10 text-[#1090F8] border-[#1090F8]/20' : b.payment_status === 'paid' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : b.payment_status === 'pending' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' : 'bg-rose-500/10 text-rose-600 border-rose-500/20',
              paymentChannel: b.payment_channel || 'PayMongo',
              rescheduleStatus: b.reschedule_status || null,
              rescheduleRequestedDate: b.reschedule_requested_date || null,
              rescheduleReason: b.reschedule_reason || null,
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
    if (!rescheduleReason.trim()) {
      setRescheduleError('Please enter a reason or note for your reschedule request.');
      return;
    }

    setSubmittingReschedule(true);
    setRescheduleError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();

      // 1. Update booking in database
      const { error: dbError } = await supabase
        .from('bookings')
        .update({
          reschedule_status: 'pending',
          reschedule_requested_date: newRescheduleDate,
          reschedule_reason: rescheduleReason.trim(),
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
        requestedDate: formatDisplayDate(newRescheduleDate),
        reason: rescheduleReason.trim(),
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

        {/* Success Toast */}
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
                className="bg-white rounded-2xl p-5 border border-[#24252c]/[0.08] shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-bold text-xs text-[#1090F8]">{item.id}</span>
                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${item.statusColor}`}
                    >
                      {item.status}
                    </span>
                    {item.rescheduleStatus === 'pending' && (
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500 text-white uppercase tracking-wider shadow-2xs">
                        Reschedule Pending: {formatDisplayDate(item.rescheduleRequestedDate)}
                      </span>
                    )}
                    {item.isFullyPaid ? (
                      <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500 text-white uppercase tracking-wider">
                        Fully Paid (100%)
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20 uppercase tracking-wider">
                        50% Reservation Secured (Remaining Bal: {item.remaining})
                      </span>
                    )}
                    <span className="text-[10px] font-semibold text-[#24252c]/50">
                      Via {item.paymentChannel}
                    </span>
                  </div>
                  <h3 className="font-bold text-base text-[var(--ink)]">{item.package}</h3>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#24252c]/60">
                    <span className="inline-flex items-center gap-1">
                      <IconCalendar className="w-3.5 h-3.5 text-[#24252c]/40" />
                      {item.date}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <IconPin className="w-3.5 h-3.5 text-[#24252c]/40" />
                      {item.venue}
                    </span>
                    <span>Total: <strong className="text-[var(--ink)]">{item.total}</strong></span>
                    <span>Deposit Paid: <strong className="text-emerald-600">{item.deposit}</strong></span>
                  </div>
                  {item.rescheduleStatus === 'pending' && item.rescheduleReason && (
                    <div className="text-[11px] text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 mt-1 inline-block">
                      <strong>Reschedule Note:</strong> "{item.rescheduleReason}"
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 w-full sm:w-56 shrink-0 pt-3 sm:pt-0 sm:pl-4 sm:border-l border-[#24252c]/[0.08]">
                  {!item.isCompleted && item.status !== 'Cancelled' && (
                    <button
                      onClick={() => {
                        localStorage.setItem('binhi_selected_active_booking_id', item.dbId);
                        go('booking-tracker');
                      }}
                      className="w-full bg-[#1090F8] text-white text-xs font-bold px-4 py-2.5 rounded-full hover:bg-[#1090F8]/90 transition-colors shadow-sm cursor-pointer inline-flex items-center justify-center gap-1.5"
                    >
                      <span>Track Live Setup</span>
                      <span className="font-bold">→</span>
                    </button>
                  )}
                  {!item.isCompleted && item.status !== 'Cancelled' && (
                    <button
                      type="button"
                      onClick={() => handleOpenRescheduleModal(item)}
                      className="w-full bg-amber-500/10 hover:bg-amber-500 hover:text-white text-amber-800 border border-amber-500/25 text-xs font-bold px-4 py-2 rounded-full transition-all shadow-2xs cursor-pointer inline-flex items-center justify-center gap-1.5 group"
                    >
                      <IconCalendar className="w-3.5 h-3.5 text-amber-600 group-hover:text-white transition-colors" />
                      <span>{item.rescheduleStatus === 'pending' ? 'Update Reschedule' : 'Reschedule'}</span>
                    </button>
                  )}
                  <button
                    onClick={() => setDownloadModalItem(item)}
                    className="w-full bg-white text-[var(--ink)] border border-[#24252c]/15 text-xs font-semibold px-4 py-2 rounded-full hover:bg-[var(--mist)] transition-colors shadow-2xs cursor-pointer inline-flex items-center justify-center gap-1.5"
                  >
                    <IconPrinter className="w-3.5 h-3.5 text-[#1090F8]" />
                    <span>View &amp; Print Official Receipt</span>
                  </button>
                  {item.isCompleted && (
                    <button
                      onClick={() => go('review-submit')}
                      className="w-full bg-[var(--ink)] text-white text-xs font-semibold px-4 py-2.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors shadow-sm cursor-pointer inline-flex items-center justify-center"
                    >
                      Leave Review
                    </button>
                  )}
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
      </div>
    </section>
  );
}
