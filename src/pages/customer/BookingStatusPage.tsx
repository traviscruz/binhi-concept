import { useState, useEffect } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import { IconTicket } from '../../components/shared/icons';
import { EmptyState } from '../../components/shared/EmptyState';
import { supabase } from '../../lib/supabase';
import { formatDisplayDate } from '../../utils/bookingService';

export default function BookingStatusPage({ go }: { go: (p: Page) => void }) {
  const [activeBooking, setActiveBooking] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchActiveBooking() {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        let query = supabase
          .from('bookings')
          .select('*')
          .in('payment_status', ['paid', 'confirmed'])
          .order('created_at', { ascending: false });

        if (user?.id || user?.email) {
          query = query.or(`user_id.eq.${user.id},customer_email.eq.${user.email}`);
        }

        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          setActiveBooking(data[0]);
        } else {
          setActiveBooking(null);
        }
      } catch (err) {
        console.error('Failed to fetch active booking:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchActiveBooking();
  }, []);

  if (loading) {
    return (
      <section className="pt-36 pb-24 px-6 min-h-screen bg-[var(--mist)]">
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="h-64 bg-white/60 rounded-3xl animate-pulse border border-[#24252c]/10" />
        </div>
      </section>
    );
  }

  if (!activeBooking) {
    return (
      <section className="pt-36 pb-24 px-6 min-h-screen bg-[var(--mist)]">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-[2rem] p-8 border border-[#24252c]/[0.08] shadow-sm text-center">
            <EmptyState
              title="No Active Booking Found"
              description="You currently don't have an active or confirmed event reservation. Choose your event package to start your booking."
            />
            <button
              onClick={() => go('packages')}
              className="mt-4 bg-[var(--ink)] text-white text-xs font-semibold px-6 py-3 rounded-full hover:bg-[var(--ink-soft)] transition-colors cursor-pointer"
            >
              Explore Production Packages →
            </button>
          </div>
        </div>
      </section>
    );
  }

  const steps = [
    { title: 'Reservation Deposit Uploaded', status: 'Completed', date: 'Deposit Secured', done: true },
    { title: 'Date Locked & Crew Assigned', status: 'Completed', date: formatDisplayDate(activeBooking.event_date), done: true },
    { title: 'Warehouse Equipment Pre-Check', status: 'In Progress', date: 'Pre-Event Check', current: true },
    { title: 'Logistics Transport & Venue Rigging', status: 'Scheduled', date: 'Event Day Setup', done: false },
    { title: 'Event Execution & Soundcheck', status: 'Scheduled', date: 'Event Execution', done: false },
  ];

  return (
    <section className="pt-36 pb-24 px-6 min-h-screen bg-[var(--mist)]">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-[2rem] p-6 md:p-8 border border-[#24252c]/[0.08] shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#24252c]/[0.06]">
            <div>
              <MonoBadge icon={IconTicket}>
                Booking Ref #{activeBooking.paymongo_reference_number || `BNH-${activeBooking.id.slice(0, 8)}`}
              </MonoBadge>
              <h2 className="text-2xl font-extrabold text-[var(--ink)] mt-2">{activeBooking.package_name}</h2>
              <p className="text-xs text-[#24252c]/60 mt-1">{activeBooking.event_type || 'Special Event Production'}</p>
            </div>
            <div className="text-right">
              <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-600 font-bold text-xs px-3.5 py-1.5 rounded-full border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Confirmed & Date Secured
              </span>
              <div className="text-xs text-[#24252c]/50 mt-1">Event Date: {formatDisplayDate(activeBooking.event_date)}</div>
            </div>
          </div>

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
                        ? 'bg-emerald-500 text-white'
                        : step.current
                        ? 'bg-[#1090F8] text-white ring-4 ring-[#1090F8]/20 shadow-md'
                        : 'bg-[var(--mist)] text-[#24252c]/40'
                    }`}
                  >
                    {step.done ? '✓' : i + 1}
                  </div>
                  <div className="flex-1 pb-4 border-b border-[#24252c]/[0.04]">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-sm text-[var(--ink)]">{step.title}</h4>
                      <span className="text-xs font-medium text-[#24252c]/50">{step.date}</span>
                    </div>
                    <p className="text-xs text-[#24252c]/60 mt-1">{step.status}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 p-5 rounded-2xl bg-[var(--mist)] flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[var(--ink)] text-white font-bold text-xs flex items-center justify-center">
                BC
              </div>
              <div>
                <div className="text-xs font-bold text-[var(--ink)]">BINHI Event Lead Team</div>
                <div className="text-[11px] text-[#24252c]/50">Assigned Venue: {activeBooking.venue_address || 'Selected Location'}</div>
              </div>
            </div>
            <button
              onClick={() => go('contact')}
              className="bg-white border border-[#24252c]/10 text-xs font-semibold px-4 py-2 rounded-full hover:bg-[var(--mist)] transition-colors cursor-pointer"
            >
              Contact Event Support
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}