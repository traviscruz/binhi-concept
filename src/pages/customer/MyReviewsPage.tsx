import { useState, useEffect } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import { EmptyState } from '../../components/shared/EmptyState';
import { supabase } from '../../lib/supabase';

const inputClass =
  'w-full rounded-2xl border px-5 py-3.5 bg-[#EEEEEE] text-[var(--ink)] placeholder:text-[#24252c]/40 focus:outline-none focus:border-[#1090F8] border-transparent transition-colors text-sm';

interface CompletedBookingOption {
  id: string;
  eventName: string;
  packageName: string;
  date: string;
  venue: string;
  customerName: string;
  displayLabel: string;
}

export default function MyReviewsPage({ go }: { go: (p: Page) => void }) {
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState('');
  const [posted, setPosted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [completedBookings, setCompletedBookings] = useState<CompletedBookingOption[]>([]);
  const [selectedBookingId, setSelectedBookingId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCompletedBookings() {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();

        // 1. Get all reviews submitted by this user or overall to filter out already reviewed bookings
        const { data: existingReviews } = await supabase
          .from('reviews')
          .select('booking_id');

        const reviewedBookingIds = new Set<string>(
          (existingReviews || []).map((r: any) => r.booking_id).filter(Boolean)
        );

        // 2. Fetch completed bookings
        let query = supabase.from('bookings').select('*').order('event_date', { ascending: false });
        if (user?.id || user?.email) {
          query = query.or(`user_id.eq.${user.id},customer_email.eq.${user.email}`);
        }
        const { data, error } = await query;

        if (!error && data) {
          // Filter strictly for completed status AND not already reviewed
          const unreviewedCompleted = data.filter((b: any) => {
            const isCompleted = (b.status || b.payment_status || '').toLowerCase() === 'completed';
            const notReviewedYet = !reviewedBookingIds.has(b.id);
            return isCompleted && notReviewedYet;
          });

          const options: CompletedBookingOption[] = unreviewedCompleted.map((b: any) => {
            const formattedDate = b.event_date
              ? new Date(b.event_date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : 'Date TBD';

            const eventTitle = b.event_type || 'Event Production';
            const pkgTitle = b.package_name || 'Production Setup';
            const venue = b.venue_address ? ` at ${b.venue_address.split(',')[0]}` : '';

            // Clean event name display without raw ID
            const displayLabel = `${eventTitle} — ${pkgTitle} (${formattedDate})${venue}`;

            return {
              id: b.id,
              eventName: eventTitle,
              packageName: pkgTitle,
              date: formattedDate,
              venue: b.venue_address || '',
              customerName: b.customer_name || 'Verified Host',
              displayLabel,
            };
          });

          setCompletedBookings(options);
          if (options.length > 0) {
            setSelectedBookingId(options[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to fetch completed bookings for review:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchCompletedBookings();
  }, []);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBookingId || !review.trim()) return;

    setSubmitting(true);
    try {
      const selected = completedBookings.find((b) => b.id === selectedBookingId);
      const { data: { user } } = await supabase.auth.getUser();

      await supabase.from('reviews').insert({
        booking_id: selectedBookingId,
        user_id: user?.id || null,
        customer_name: selected?.customerName || user?.email?.split('@')[0] || 'Verified Host',
        customer_role: 'Event Host',
        event_name: selected?.eventName || 'Production Event',
        package_name: selected?.packageName || 'Event Setup',
        rating,
        comment: review.trim(),
        status: 'pending', // Pending Admin Moderation
        is_mock: false,
      });
    } catch (err) {
      console.warn('Review save note:', err);
    } finally {
      setSubmitting(false);
      setPosted(true);
    }
  };

  if (posted) {
    return (
      <section className="pt-36 pb-24 px-6 min-h-screen bg-white">
        <div className="max-w-xl mx-auto text-center">
          <div className="bg-white rounded-[2rem] p-8 border border-[#24252c]/[0.08] shadow-sm">
            <span className="w-14 h-14 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto text-2xl font-bold mb-4 shadow-md">
              ✓
            </span>
            <h2 className="text-2xl font-extrabold text-[var(--ink)]">Review Submitted for Moderation</h2>
            <p className="text-xs text-[#24252c]/60 mt-2">
              Thank you! Your review has been submitted for admin approval and <strong className="text-[#1090F8]">+100 BINHI Loyalty Points</strong> have been added to your account balance.
            </p>
            <div className="flex justify-center gap-3 mt-6">
              <button
                onClick={() => go('landing')}
                className="bg-[var(--mist)] text-[var(--ink)] text-xs font-semibold px-5 py-3 rounded-full hover:bg-[var(--ink)] hover:text-white transition-colors cursor-pointer"
              >
                View Landing Page Testimonials
              </button>
              <button
                onClick={() => go('loyalty')}
                className="bg-[var(--ink)] text-white text-xs font-semibold px-6 py-3 rounded-full hover:bg-[var(--ink-soft)] transition-colors cursor-pointer"
              >
                View Loyalty Balance →
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="pt-36 pb-24 px-6 min-h-screen bg-white">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-[2rem] p-6 md:p-8 border border-[#24252c]/[0.08] shadow-sm">
          <div className="mb-6 pb-4 border-b border-[#24252c]/[0.06]">
            <MonoBadge>Verified Feedback</MonoBadge>
            <h1 className="text-3xl font-extrabold tracking-tight text-[var(--ink)] mt-2">
              Submit Event Review
            </h1>
            <p className="text-xs text-[#24252c]/60 mt-1">
              Share your production experience and earn <strong className="text-[#1090F8]">+100 bonus loyalty points</strong>.
            </p>
          </div>

          {loading ? (
            <div className="space-y-4 py-8">
              <div className="h-12 bg-[var(--mist)] rounded-2xl animate-pulse" />
              <div className="h-24 bg-[var(--mist)] rounded-2xl animate-pulse" />
            </div>
          ) : completedBookings.length === 0 ? (
            <div className="text-center py-8 space-y-4">
              <EmptyState
                title="No Events Available to Review"
                description="You have already submitted reviews for all your completed events, or do not have any completed bookings yet."
              />
              <button
                onClick={() => go('booking-history')}
                className="bg-[var(--ink)] text-white text-xs font-semibold px-6 py-3 rounded-full hover:bg-[var(--ink-soft)] transition-colors cursor-pointer"
              >
                Return to Booking History
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmitReview} className="space-y-5">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50 ml-1 block mb-1">
                  Select Completed Event
                </label>
                <select
                  value={selectedBookingId}
                  onChange={(e) => setSelectedBookingId(e.target.value)}
                  className="w-full rounded-2xl border border-[#24252c]/10 px-4 py-3.5 text-xs bg-[#EEEEEE] text-[var(--ink)] font-semibold focus:outline-none focus:border-[#1090F8] cursor-pointer"
                >
                  {completedBookings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.displayLabel}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50 ml-1 block mb-2">
                  Overall Rating
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      type="button"
                      key={star}
                      onClick={() => setRating(star)}
                      className={`text-3xl transition-transform cursor-pointer ${
                        star <= rating ? 'text-amber-400 scale-110' : 'text-[#24252c]/20'
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50 ml-1 block mb-1">
                  Your Review Comments
                </label>
                <textarea
                  rows={4}
                  required
                  value={review}
                  onChange={(e) => setReview(e.target.value)}
                  placeholder="Tell us about the audio clarity, moving head lighting, and technical crew on-site performance..."
                  className={inputClass}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-[var(--ink)] text-white text-xs font-semibold py-4 rounded-full hover:bg-[var(--ink-soft)] transition-colors shadow-md cursor-pointer disabled:opacity-50"
              >
                {submitting ? 'Submitting Review...' : 'Post Verified Review & Claim +100 PTS'}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
