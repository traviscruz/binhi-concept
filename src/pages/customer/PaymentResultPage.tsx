import { useState, useEffect } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import { IconCheck, IconX, IconShield } from '../../components/shared/icons';
import { supabase } from '../../lib/supabase';

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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref') || params.get('requestReferenceNumber');
    const csId =
      params.get('cs_id') ||
      params.get('checkout_session_id') ||
      (ref ? localStorage.getItem(`binhi_cs_${ref}`) : null) ||
      localStorage.getItem('binhi_paymongo_cs_id');

    if (ref) {
      setRefNumber(ref);
    }

    const formatChannelName = (rawType: string) => {
      const lower = rawType.toLowerCase();
      if (lower.includes('maya') || lower.includes('paymaya')) return 'Maya Wallet';
      if (lower.includes('gcash')) return 'GCash E-Wallet';
      if (lower.includes('card') || lower.includes('visa') || lower.includes('mastercard')) return 'Visa / Mastercard Credit Card';
      if (lower.includes('qr')) return 'QR Ph Code';
      return rawType;
    };

    const processPaymentVerification = async () => {
      let resolvedChannel = 'PayMongo Online Payment';

      // Fetch actual payment method chosen inside PayMongo from PayMongo API
      if (csId) {
        try {
          const { data, error } = await supabase.functions.invoke('create-checkout-session', {
            body: {
              action: 'retrieve_session',
              checkout_session_id: csId,
            },
          });

          if (!error && data?.payment_method_used) {
            resolvedChannel = formatChannelName(data.payment_method_used);
          }
        } catch (err) {
          console.warn('Could not retrieve PayMongo session channel:', err);
        }
      }

      setPaymentChannelName(resolvedChannel);

      // Complete or cancel booking record status in Supabase database
      if (ref) {
        try {
          // Fetch booking record to check payment option & amounts
          const { data: bookingData } = await supabase
            .from('bookings')
            .select('*')
            .eq('paymongo_reference_number', ref)
            .single();

          const isFull =
            bookingData?.is_fully_paid === true ||
            (bookingData?.deposit_amount &&
              bookingData?.total_cost &&
              Number(bookingData.deposit_amount) >= Number(bookingData.total_cost));

          if (bookingData) {
            setIsFullyPaid(Boolean(isFull));
            if (bookingData.total_cost) setTotalAmount(Number(bookingData.total_cost));
            if (bookingData.deposit_amount) setPaidAmount(Number(bookingData.deposit_amount));
          }

          if (type === 'success') {
            const updatePayload: any = {
              payment_status: 'paid',
              payment_channel: resolvedChannel,
              updated_at: new Date().toISOString(),
            };

            if (isFull) {
              updatePayload.is_fully_paid = true;
              updatePayload.remaining_balance = 0;
              updatePayload.balance_paid_at = new Date().toISOString();
              updatePayload.balance_payment_method = resolvedChannel;
            }

            await supabase
              .from('bookings')
              .update(updatePayload)
              .eq('paymongo_reference_number', ref);
          } else {
            await supabase
              .from('bookings')
              .update({
                payment_status: 'cancelled',
                updated_at: new Date().toISOString(),
              })
              .eq('paymongo_reference_number', ref);
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
    } catch (e) {}
    go(targetPage);
  };

  return (
    <section className="pt-36 pb-24 px-6 min-h-screen bg-[var(--mist)] flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-[2.5rem] p-8 border border-[#24252c]/10 shadow-2xl text-center animate-blur-in space-y-6">
        {type === 'success' && (
          <>
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
              <IconCheck className="w-8 h-8" />
            </div>

            <div>
              <MonoBadge icon={IconShield}>PayMongo Payment Confirmed</MonoBadge>
              <h1 className="text-2xl font-extrabold text-[var(--ink)] mt-2">
                {isFullyPaid ? 'Full Payment Completed!' : '50% Deposit Paid!'}
              </h1>
              <p className="text-xs text-[#24252c]/60 mt-1.5 leading-relaxed">
                {isFullyPaid
                  ? 'Your 100% full payment has been successfully processed via PayMongo Checkout. Your event production schedule is secured and fully settled with zero remaining balance!'
                  : 'Your 50% reservation deposit has been successfully processed via PayMongo Checkout. Your event production schedule is now locked in our system!'}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--mist)] border border-[#24252c]/[0.08] text-xs space-y-2 text-left">
              <div className="flex justify-between text-[#24252c]/60">
                <span>Reference Number</span>
                <span className="font-mono font-bold text-[var(--ink)]">{refNumber}</span>
              </div>
              <div className="flex justify-between text-[#24252c]/60">
                <span>Payment Plan</span>
                <span className="font-bold text-[var(--ink)]">
                  {isFullyPaid ? 'Full Payment (100%)' : '50% Downpayment (Reservation)'}
                </span>
              </div>
              {paidAmount !== null && (
                <div className="flex justify-between text-[#24252c]/60">
                  <span>Amount Paid Today</span>
                  <span className="font-bold text-[#1090F8]">₱{paidAmount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-[#24252c]/60">
                <span>Remaining Balance</span>
                <span className={isFullyPaid ? 'font-bold text-emerald-600' : 'font-bold text-[var(--ink)]'}>
                  {isFullyPaid
                    ? '₱0 (Fully Settled)'
                    : totalAmount && paidAmount
                    ? `₱${Math.max(0, totalAmount - paidAmount).toLocaleString()} (Due on Event Day)`
                    : 'Payable on Event Day'}
                </span>
              </div>
              <div className="flex justify-between text-[#24252c]/60">
                <span>Payment Method Used</span>
                <span className="font-bold text-emerald-600">{paymentChannelName}</span>
              </div>
              <div className="flex justify-between text-[#24252c]/60">
                <span>Transaction Status</span>
                <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Completed
                </span>
              </div>
            </div>

            <button
              onClick={() => handleNavigate('booking-tracker')}
              className="w-full bg-[var(--ink)] text-white text-xs font-semibold py-4 rounded-full hover:bg-[var(--ink-soft)] transition-colors shadow-md cursor-pointer"
            >
              View Active Booking Tracker →
            </button>
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
              onClick={() => handleNavigate('checkout')}
              className="w-full bg-[var(--ink)] text-white text-xs font-semibold py-4 rounded-full hover:bg-[var(--ink-soft)] transition-colors shadow-md cursor-pointer"
            >
              Return to Checkout & Retry →
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
                You cancelled the PayMongo Checkout session. Your booking draft is still saved. You can complete your payment anytime to confirm your date.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--mist)] border border-[#24252c]/[0.08] text-xs text-[#24252c]/60 text-left">
              Reference: <strong className="font-mono text-[var(--ink)]">{refNumber}</strong>
              <br />
              Status: Draft reservation pending payment.
            </div>

            <button
              onClick={() => handleNavigate('checkout')}
              className="w-full bg-[var(--ink)] text-white text-xs font-semibold py-4 rounded-full hover:bg-[var(--ink-soft)] transition-colors shadow-md cursor-pointer"
            >
              Return to Booking Checkout →
            </button>
          </>
        )}
      </div>
    </section>
  );
}
