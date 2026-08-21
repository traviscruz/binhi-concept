import { useState, useEffect } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import { IconTicket, IconCalendar, IconPin, IconX } from '../../components/shared/icons';
import { ModalOverlay } from '../../components/shared/ModalOverlay';
import { EmptyState } from '../../components/shared/EmptyState';
import { supabase } from '../../lib/supabase';

export default function BookingHistoryPage({ go }: { go: (p: Page) => void }) {
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadModalItem, setDownloadModalItem] = useState<any | null>(null);

  useEffect(() => {
    async function fetchHistory() {
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
              // Only trust remaining_balance from DB if admin explicitly set is_fully_paid.
              // Otherwise compute it as total - deposit (DB defaults remaining_balance to 0).
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
                date: b.event_date ? new Date(b.event_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Selected Date',
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
              };
            })
          );
        }
      } catch (err) {
        console.error('Failed to fetch customer booking history:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchHistory();
  }, []);

  return (
    <section className="pt-36 pb-24 px-6 min-h-screen bg-[var(--mist)]">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <MonoBadge icon={IconTicket}>Booking Records</MonoBadge>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ink)] mt-1.5">
            Booking History & Receipts
          </h1>
          <p className="text-xs text-[#24252c]/60 mt-1">
            View all past and upcoming event reservations, invoices, and payment receipts.
          </p>
        </div>

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
                className="bg-white rounded-2xl p-5 border border-[#24252c]/[0.08] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-bold text-xs text-[#1090F8]">{item.id}</span>
                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${item.statusColor}`}
                    >
                      {item.status}
                    </span>
                    {item.isFullyPaid ? (
                      <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500 text-white uppercase tracking-wider">
                        Fully Paid (100%)
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20 uppercase tracking-wider">
                        50% Deposit Secured (Remaining Bal: {item.remaining})
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
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    onClick={() => setDownloadModalItem(item)}
                    className="bg-white text-[var(--ink)] border border-[#24252c]/10 text-xs font-semibold px-4 py-2.5 rounded-full hover:bg-[var(--mist)] transition-colors shadow-sm cursor-pointer"
                  >
                    View & Print Official Receipt
                  </button>
                  {item.isCompleted && (
                    <button
                      onClick={() => go('review-submit')}
                      className="bg-[var(--ink)] text-white text-xs font-semibold px-4 py-2.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors cursor-pointer"
                    >
                      Leave Review
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Printable Official Receipt Modal */}
        <ModalOverlay isOpen={!!downloadModalItem} onClose={() => setDownloadModalItem(null)}>
          {downloadModalItem && (
            <div className="bg-white rounded-[2rem] p-6 sm:p-8 max-w-lg w-full shadow-2xl print:shadow-none border border-[#24252c]/10 print:border-none relative">
              <button
                type="button"
                onClick={() => setDownloadModalItem(null)}
                className="absolute top-5 right-5 text-[#24252c]/50 hover:text-[var(--ink)] p-1 cursor-pointer print:hidden"
              >
                <IconX className="w-5 h-5" />
              </button>

              {/* Header & Branding */}
              <div className="text-center pb-4 border-b border-[#24252c]/10">
                <div className="text-[10px] font-extrabold uppercase tracking-widest text-[#1090F8] mb-1">
                  BINHI Concept Event Production
                </div>
                <h2 className="text-xl font-black text-[var(--ink)] uppercase tracking-tight">
                  Official Payment Receipt
                </h2>
                <div className="text-xs font-mono font-extrabold text-[#1090F8] mt-1">
                  Ref #{downloadModalItem.id}
                </div>
              </div>

              {/* Customer & Event Details */}
              <div className="grid grid-cols-2 gap-3 py-4 text-xs border-b border-[#24252c]/10">
                <div>
                  <span className="text-[10px] text-[#24252c]/50 uppercase font-semibold block mb-0.5">Customer Details</span>
                  <div className="font-bold text-[var(--ink)]">{downloadModalItem.customerName}</div>
                  <div className="text-[11px] text-[#24252c]/60">{downloadModalItem.customerEmail}</div>
                  {downloadModalItem.customerPhone && (
                    <div className="text-[11px] text-[#24252c]/60">{downloadModalItem.customerPhone}</div>
                  )}
                </div>
                <div>
                  <span className="text-[10px] text-[#24252c]/50 uppercase font-semibold block mb-0.5">Event Details</span>
                  <div className="font-bold text-[var(--ink)]">{downloadModalItem.date}</div>
                  <div className="text-[11px] text-[#24252c]/60">{downloadModalItem.venue}</div>
                  {downloadModalItem.eventType && (
                    <div className="text-[11px] text-[#1090F8] font-semibold">{downloadModalItem.eventType}</div>
                  )}
                </div>
              </div>

              {/* Line Item Financial Breakdown */}
              <div className="py-4 space-y-3 text-xs border-b border-[#24252c]/10">
                <span className="text-[10px] text-[#24252c]/50 uppercase font-semibold block mb-1">
                  Itemized Package & Production Inclusions
                </span>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-[var(--ink)] font-bold">{downloadModalItem.package}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--mist)] text-[#1090F8] border border-[#1090F8]/20">
                        {downloadModalItem.packageTag}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-[var(--ink)]">
                      ₱{downloadModalItem.packagePrice.toLocaleString()}
                    </span>
                  </div>

                  {/* Detailed Package Equipment & Inclusions List */}
                  {downloadModalItem.packageInclusions && downloadModalItem.packageInclusions.length > 0 && (
                    <div className="pl-3 py-1.5 border-l-2 border-[#1090F8]/40 bg-[var(--mist)]/50 rounded-r-xl space-y-1 text-[11px] text-[#24252c]/75">
                      <div className="text-[10px] font-bold uppercase text-[#24252c]/50">Included Technical Gear & Services:</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-2 gap-y-0.5">
                        {downloadModalItem.packageInclusions.map((inc: string, i: number) => (
                          <div key={i} className="flex items-start gap-1">
                            <span className="text-[#1090F8] font-bold shrink-0">•</span>
                            <span>{inc}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Selected Add-ons */}
                {downloadModalItem.selectedAddons && downloadModalItem.selectedAddons.length > 0 && (
                  <div className="space-y-1 pl-3 border-l-2 border-amber-500/40 py-1 bg-amber-50/30 rounded-r-xl">
                    <span className="text-[10px] font-bold text-amber-800 uppercase">Selected Equipment Add-ons:</span>
                    {downloadModalItem.selectedAddons.map((addon: string, idx: number) => (
                      <div key={idx} className="flex justify-between text-[11px] text-[#24252c]/80">
                        <span>• {addon}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-[11px] font-bold text-[var(--ink)] pt-1 border-t border-amber-200">
                      <span>Add-ons Subtotal:</span>
                      <span className="font-mono">₱{downloadModalItem.addonsCost.toLocaleString()}</span>
                    </div>
                  </div>
                )}

                {/* Transport Charge */}
                <div className="flex justify-between items-center text-[11px] text-[#24252c]/70 pt-1">
                  <span>Crew Transport & Logistics Charge</span>
                  <span className="font-mono font-bold text-[#1090F8]">₱{downloadModalItem.transportFee.toLocaleString()}</span>
                </div>

                <div className="flex justify-between items-center text-sm font-extrabold text-[var(--ink)] pt-2 border-t border-[#24252c]/10">
                  <span>Total Invoice Amount</span>
                  <span className="font-mono text-base">{downloadModalItem.total}</span>
                </div>
              </div>

              {/* Payment Settlement History */}
              <div className="py-4 space-y-2.5 text-xs">
                <span className="text-[10px] text-[#24252c]/50 uppercase font-semibold block">
                  Payment Audit & Settlement Status
                </span>

                <div className="p-3 rounded-xl bg-[var(--mist)] space-y-1">
                  <div className="flex justify-between">
                    <span className="text-[#24252c]/60">50% Reservation Deposit Paid:</span>
                    <span className="font-mono font-bold text-emerald-600">{downloadModalItem.deposit}</span>
                  </div>
                  <div className="flex justify-between text-[11px] text-[#24252c]/50">
                    <span>Deposit Payment Method:</span>
                    <span>{downloadModalItem.paymentChannel}</span>
                  </div>
                </div>

                {downloadModalItem.isFullyPaid ? (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 space-y-1">
                    <div className="flex justify-between items-center font-extrabold">
                      <span>Full Payment Settlement Status:</span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] uppercase">
                        Fully Settled (100%)
                      </span>
                    </div>
                    {downloadModalItem.balancePaidAt && (
                      <div className="flex justify-between text-[11px]">
                        <span>Full Payment Date & Time:</span>
                        <span className="font-semibold">{downloadModalItem.balancePaidAt}</span>
                      </div>
                    )}
                    {downloadModalItem.balancePaymentMethod && (
                      <div className="flex justify-between text-[11px]">
                        <span>Balance Payment Method:</span>
                        <span className="font-semibold">{downloadModalItem.balancePaymentMethod}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 flex justify-between items-center">
                    <div>
                      <span className="font-bold block">Remaining Balance Due:</span>
                      <span className="text-[10px] text-amber-700">To be settled on or before event date</span>
                    </div>
                    <span className="font-mono font-extrabold text-base text-amber-800">{downloadModalItem.remaining}</span>
                  </div>
                )}
              </div>

              {/* Actions (Print & Close) */}
              <div className="flex gap-3 pt-2 print:hidden">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex-1 bg-[var(--ink)] text-white text-xs font-semibold py-3 rounded-full hover:bg-[var(--ink-soft)] transition-colors shadow-md cursor-pointer text-center"
                >
                  Print / Save PDF Receipt
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
          )}
        </ModalOverlay>
      </div>
    </section>
  );
}
