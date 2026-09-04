import { useState, useEffect } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import { IconCheck, IconX, IconShield, IconPrinter } from '../../components/shared/icons';
import { supabase } from '../../lib/supabase';
import { formatDisplayDate } from '../../utils/bookingService';
import { retrievePaymongoCheckoutSession } from '../../utils/paymongoPayment';

export default function PaymentResultPage({
  type,
  go,
}: {
  type: 'success' | 'failure' | 'cancel';
  go: (p: Page) => void;
}) {
  const [refNumber, setRefNumber] = useState('BNH-2026-889123');
  const [paymentChannelName, setPaymentChannelName] = useState('GCash E-Wallet');
  const [isFullyPaid, setIsFullyPaid] = useState(false);
  const [totalAmount, setTotalAmount] = useState<number | null>(null);
  const [paidAmount, setPaidAmount] = useState<number | null>(null);
  const [isBalanceSettlement, setIsBalanceSettlement] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [packageName, setPackageName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [venue, setVenue] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref') || params.get('requestReferenceNumber') || '';
    const bookingIdParam = params.get('booking_id');
    const isBalance = params.get('type') === 'balance' || ref.startsWith('BAL-');
    setIsBalanceSettlement(isBalance);

    const cleanRef = ref.replace(/^BAL-/, '');
    const csId =
      params.get('cs_id') ||
      params.get('checkout_session_id') ||
      (cleanRef ? localStorage.getItem(`binhi_cs_${cleanRef}`) : null) ||
      (ref ? localStorage.getItem(`binhi_cs_${ref}`) : null) ||
      localStorage.getItem('binhi_paymongo_cs_id');

    if (cleanRef || ref) {
      setRefNumber(cleanRef || ref);
    }

    const formatChannelName = (rawType: string) => {
      const lower = (rawType || '').toLowerCase();
      if (lower.includes('qr') || lower.includes('qrph') || lower.includes('ph')) return 'QR Ph (Scan to Pay)';
      if (lower.includes('maya') || lower.includes('paymaya')) return 'Maya Wallet';
      if (lower.includes('gcash')) return 'GCash E-Wallet';
      if (lower.includes('card') || lower.includes('visa') || lower.includes('mastercard')) return 'Visa / Mastercard Credit Card';
      if (lower.includes('grab')) return 'GrabPay';
      if (lower.includes('dob') || lower.includes('bank') || lower.includes('ubp')) return 'Online Bank Transfer';
      return rawType || 'PayMongo Online Payment';
    };

    const processPaymentVerification = async () => {
      let resolvedChannel = 'PayMongo Online Payment';

      // Fetch actual payment method chosen inside PayMongo from PayMongo API
      if (csId) {
        try {
          const sessionData = await retrievePaymongoCheckoutSession(csId);
          if (sessionData?.paymentMethodUsed) {
            resolvedChannel = formatChannelName(sessionData.paymentMethodUsed);
          }
        } catch (err) {
          console.warn('Could not retrieve PayMongo session channel:', err);
        }
      }

      setPaymentChannelName(resolvedChannel);

      // Complete or cancel booking record status in Supabase database
      if (cleanRef || ref || bookingIdParam) {
        try {
          let query = supabase.from('bookings').select('*');
          if (bookingIdParam) {
            query = query.eq('id', bookingIdParam);
          } else {
            query = query.or(`paymongo_reference_number.eq.${cleanRef},paymongo_reference_number.eq.${ref}`);
          }
          const { data: bookingData } = await query.maybeSingle();

          const isFull =
            isBalance ||
            bookingData?.is_fully_paid === true ||
            (bookingData?.deposit_amount &&
              bookingData?.total_cost &&
              Number(bookingData.deposit_amount) >= Number(bookingData.total_cost));

          if (bookingData) {
            setIsFullyPaid(Boolean(isFull));
            const total = Number(bookingData.total_cost || 0);
            const deposit = Number(bookingData.deposit_amount || 0);
            const remaining = Math.max(0, total - deposit);

            if (bookingData.total_cost) setTotalAmount(total);
            if (isBalance) {
              setPaidAmount(remaining > 0 ? remaining : deposit);
            } else if (bookingData.deposit_amount) {
              setPaidAmount(deposit);
            }
            if (bookingData.customer_name) setCustomerName(bookingData.customer_name);
            if (bookingData.customer_email) setCustomerEmail(bookingData.customer_email);
            if (bookingData.customer_phone) setCustomerPhone(bookingData.customer_phone);
            if (bookingData.package_name) setPackageName(bookingData.package_name);
            if (bookingData.event_date) setEventDate(formatDisplayDate(bookingData.event_date));
            if (bookingData.venue_address) setVenue(bookingData.venue_address);
          }

          if (type === 'success') {
            const updatePayload: any = {
              payment_status: 'paid',
              payment_channel: resolvedChannel,
              updated_at: new Date().toISOString(),
            };

            if (isFull || isBalance) {
              updatePayload.is_fully_paid = true;
              updatePayload.remaining_balance = 0;
              updatePayload.balance_paid_at = new Date().toISOString();
              updatePayload.balance_payment_method = resolvedChannel;
            }

            if (bookingData?.id) {
              await supabase
                .from('bookings')
                .update(updatePayload)
                .eq('id', bookingData.id);
            } else if (cleanRef) {
              await supabase
                .from('bookings')
                .update(updatePayload)
                .eq('paymongo_reference_number', cleanRef);
            }
          } else {
            // If it's a balance settlement attempt that failed or was cancelled, do NOT cancel the confirmed booking
            if (!isBalance) {
              if (bookingData?.id) {
                await supabase
                  .from('bookings')
                  .update({
                    payment_status: 'cancelled',
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', bookingData.id);
              } else if (cleanRef) {
                await supabase
                  .from('bookings')
                  .update({
                    payment_status: 'cancelled',
                    updated_at: new Date().toISOString(),
                  })
                  .eq('paymongo_reference_number', cleanRef);
              }
            }
          }
        } catch (err) {
          console.warn('Could not update booking status in DB:', err);
        }
      }
    };

    processPaymentVerification();
  }, [type]);

  const handleNavigate = (targetPage: Page) => {
    try {
      window.history.replaceState({}, '', window.location.pathname);
    } catch (e) { }
    go(targetPage);
  };

  return (
    <section className="payment-result-container pt-36 pb-24 px-6 min-h-screen bg-[var(--mist)] flex items-center justify-center print:pt-0 print:pb-0 print:px-0 print:min-h-0 print:bg-white print:block">
      <div className="payment-result-card max-w-md w-full bg-white rounded-[2.5rem] p-8 border border-[#24252c]/10 shadow-2xl text-center animate-blur-in space-y-6 print:max-w-2xl print:mx-auto print:shadow-none print:border print:border-gray-300 print:rounded-2xl print:p-6 print:space-y-4 print:text-left print:animate-none">
        
        {/* Printable Official Receipt Header */}
        <div className="hidden print:block border-b border-gray-300 pb-3 text-center mb-3">
          <div className="w-10 h-10 rounded-full bg-black text-white font-black text-xs flex items-center justify-center mx-auto mb-1.5">
            BC
          </div>
          <h2 className="text-xl font-extrabold text-black">BINHI Concept</h2>
          <p className="text-[11px] text-gray-600">Official Payment Receipt &amp; Reservation Confirmation</p>
          <span className="font-mono text-xs font-bold text-black mt-0.5 inline-block">
            Ref #{refNumber}
          </span>
        </div>

        {type === 'success' && (
          <>
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm print:hidden">
              <IconCheck className="w-8 h-8" />
            </div>

            <div className="print:hidden">
              <MonoBadge icon={IconShield}>PayMongo Payment Confirmed</MonoBadge>
              <h1 className="text-2xl font-extrabold text-[var(--ink)] mt-2">
                {isBalanceSettlement
                  ? 'Remaining Balance Settled!'
                  : isFullyPaid
                  ? 'Full Payment Completed!'
                  : '50% Deposit Paid!'}
              </h1>
              <p className="text-xs text-[#24252c]/60 mt-1.5 leading-relaxed">
                {isBalanceSettlement
                  ? 'Your remaining 50% balance has been successfully processed via PayMongo Checkout. Your booking is now 100% Fully Settled with zero remaining balance!'
                  : isFullyPaid
                  ? 'Your 100% full payment has been successfully processed via PayMongo Checkout. Your event production schedule is secured and fully settled with zero remaining balance!'
                  : 'Your 50% reservation deposit has been successfully processed via PayMongo Checkout. Your event production schedule is now locked in our system!'}
              </p>
            </div>

            {/* Customer & Event Details (Printable & Screen) */}
            {(customerName || eventDate) && (
              <div className="hidden print:grid grid-cols-2 gap-3 py-3 text-xs border-b border-gray-200">
                <div>
                  <span className="text-[10px] text-gray-500 uppercase font-semibold block mb-0.5">Customer Details</span>
                  <div className="font-bold text-black">{customerName || 'Valued Customer'}</div>
                  {customerEmail && <div className="text-[11px] text-gray-700">{customerEmail}</div>}
                  {customerPhone && <div className="text-[11px] text-gray-700">{customerPhone}</div>}
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 uppercase font-semibold block mb-0.5">Reserved Schedule &amp; Package</span>
                  {packageName && <div className="font-bold text-black">{packageName}</div>}
                  {eventDate && <div className="text-[11px] text-gray-700">{eventDate}</div>}
                  {venue && <div className="text-[11px] text-gray-700">{venue}</div>}
                </div>
              </div>
            )}

            <div className="p-4 rounded-2xl bg-[var(--mist)] border border-[#24252c]/[0.08] text-xs space-y-2 text-left print:bg-transparent print:border print:border-gray-200 print:rounded-lg print:p-4 print:space-y-2">
              <div className="flex justify-between text-[#24252c]/60 print:text-gray-700">
                <span>Reference Number</span>
                <span className="font-mono font-bold text-[var(--ink)] print:text-black">{refNumber}</span>
              </div>
              <div className="flex justify-between text-[#24252c]/60 print:text-gray-700">
                <span>Payment Plan</span>
                <span className="font-bold text-[var(--ink)] print:text-black">
                  {isBalanceSettlement
                    ? '50% Balance Settlement (Fully Paid 100%)'
                    : isFullyPaid
                    ? 'Full Payment (100%)'
                    : '50% Downpayment (Reservation)'}
                </span>
              </div>
              {paidAmount !== null && (
                <div className="flex justify-between text-[#24252c]/60 print:text-gray-700">
                  <span>Amount Paid Today</span>
                  <span className="font-bold text-[#1090F8] print:text-black">₱{paidAmount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-[#24252c]/60 print:text-gray-700">
                <span>Remaining Balance</span>
                <span className={isFullyPaid ? 'font-bold text-emerald-600 print:text-black' : 'font-bold text-[var(--ink)] print:text-black'}>
                  {isFullyPaid
                    ? '₱0 (Fully Settled)'
                    : totalAmount && paidAmount
                      ? `₱${Math.max(0, totalAmount - paidAmount).toLocaleString()} (Due on Event Day)`
                      : 'Payable on Event Day'}
                </span>
              </div>
              <div className="flex justify-between text-[#24252c]/60 print:text-gray-700">
                <span>Payment Method Used</span>
                <span className="font-bold text-emerald-600 print:text-black">{paymentChannelName}</span>
              </div>
              <div className="flex justify-between text-[#24252c]/60 print:text-gray-700">
                <span>Transaction Status</span>
                <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 print:bg-transparent print:border-gray-300 print:text-black">
                  Completed &amp; Confirmed
                </span>
              </div>
            </div>

            {/* Print Disclaimer */}
            <div className="hidden print:block pt-3 border-t border-gray-200 text-center text-[10px] text-gray-500">
              <p>Thank you for choosing BINHI Concept for your production &amp; events setup.</p>
              <p className="mt-0.5">For inquiries or coordination, contact us at support@binhiconcept.ph</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2 print:hidden">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 bg-white text-[var(--ink)] border border-[#24252c]/15 text-xs font-semibold py-3.5 px-4 rounded-full hover:bg-[var(--mist)] transition-colors shadow-sm cursor-pointer flex items-center justify-center gap-2"
              >
                <IconPrinter className="w-4 h-4 text-[#1090F8]" />
                <span>Print / Save Receipt</span>
              </button>
              <button
                type="button"
                onClick={() => handleNavigate('booking-tracker')}
                className="flex-1 bg-[var(--ink)] text-white text-xs font-semibold py-3.5 px-4 rounded-full hover:bg-[var(--ink-soft)] transition-colors shadow-md cursor-pointer text-center"
              >
                <span>View Active Tracker →</span>
              </button>
            </div>
          </>
        )}

        {type === 'failure' && (
          <>
            <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-sm">
              <IconX className="w-8 h-8" />
            </div>

            <div>
              <MonoBadge icon={IconShield}>PayMongo Checkout Error</MonoBadge>
              <h1 className="text-2xl font-extrabold text-[var(--ink)] mt-2">
                Payment Unsuccessful
              </h1>
              <p className="text-xs text-[#24252c]/60 mt-1.5 leading-relaxed">
                We couldn't process your payment via PayMongo. Please check your account balance or try another payment method.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium text-left">
              Reference: <strong className="font-mono">{refNumber}</strong>
              <br />
              Notice: Payment transaction was declined or timed out.
            </div>

            <button
              onClick={() => handleNavigate(isBalanceSettlement ? 'booking-tracker' : 'checkout')}
              className="w-full bg-[var(--ink)] text-white text-xs font-semibold py-4 rounded-full hover:bg-[var(--ink-soft)] transition-colors shadow-md cursor-pointer print:hidden"
            >
              {isBalanceSettlement ? 'Return to Booking Tracker & Retry →' : 'Return to Checkout & Retry →'}
            </button>
          </>
        )}

        {type === 'cancel' && (
          <>
            <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto shadow-sm">
              <IconShield className="w-8 h-8" />
            </div>

            <div>
              <MonoBadge icon={IconShield}>PayMongo Checkout Cancelled</MonoBadge>
              <h1 className="text-2xl font-extrabold text-[var(--ink)] mt-2">
                Payment Cancelled
              </h1>
              <p className="text-xs text-[#24252c]/60 mt-1.5 leading-relaxed">
                {isBalanceSettlement
                  ? 'You cancelled the remaining balance payment session. Your original reservation and deposit remain active and confirmed.'
                  : 'You cancelled the PayMongo Checkout session. Your booking draft is still saved. You can complete your payment anytime to confirm your date.'}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--mist)] border border-[#24252c]/[0.08] text-xs text-[#24252c]/60 text-left">
              Reference: <strong className="font-mono text-[var(--ink)]">{refNumber}</strong>
              <br />
              Status: {isBalanceSettlement ? 'Reservation confirmed. Balance payment cancelled.' : 'Draft reservation pending payment.'}
            </div>

            <button
              onClick={() => handleNavigate(isBalanceSettlement ? 'booking-tracker' : 'checkout')}
              className="w-full bg-[var(--ink)] text-white text-xs font-semibold py-4 rounded-full hover:bg-[var(--ink-soft)] transition-colors shadow-md cursor-pointer print:hidden"
            >
              {isBalanceSettlement ? 'Back to Booking Tracker →' : 'Return to Booking Checkout →'}
            </button>
          </>
        )}
      </div>
    </section>
  );
}

