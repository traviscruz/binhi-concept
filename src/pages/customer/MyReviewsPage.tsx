import { useState, useEffect } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import { EmptyState } from '../../components/shared/EmptyState';
import { supabase } from '../../lib/supabase';
import { awardReviewBonusPoints } from '../../utils/loyaltyService';

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

interface PastReviewItem {
  id: string;
  bookingId?: string;
  eventName: string;
  packageName: string;
  rating: number;
  comment: string;
  date: string;
  status: string;
  venue?: string;
}

export default function MyReviewsPage({ go }: { go: (p: Page) => void }) {
  const [activeTab, setActiveTab] = useState<'submit' | 'history'>('submit');
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState('');
  const [posted, setPosted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [completedBookings, setCompletedBookings] = useState<CompletedBookingOption[]>([]);
  const [myPastReviews, setMyPastReviews] = useState<PastReviewItem[]>([]);
  const [selectedBookingId, setSelectedBookingId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const fetchCustomerReviewsAndBookings = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // 1. Fetch user bookings
      let bookingsQuery = supabase
        .from('bookings')
        .select('*')
        .order('event_date', { ascending: false });

      if (user?.id || user?.email) {
        bookingsQuery = bookingsQuery.or(`user_id.eq.${user?.id},customer_email.eq.${user?.email}`);
      }
      const { data: userBookings } = await bookingsQuery;

      const userBookingMap = new Map<string, any>(
        (userBookings || []).map((b: any) => [b.id, b])
      );
      const userBookingIds = Array.from(userBookingMap.keys());

      // 2. Fetch past reviews submitted by this customer
      let reviewQuery = supabase
        .from('reviews')
        .select('*')
        .order('created_at', { ascending: false });

      if (user?.id) {
        if (userBookingIds.length > 0) {
          reviewQuery = reviewQuery.or(
            `user_id.eq.${user.id},booking_id.in.(${userBookingIds.join(',')})`
          );
        } else {
          reviewQuery = reviewQuery.eq('user_id', user.id);
        }
      }

      const { data: pastReviewsData } = await reviewQuery;

      const pastList: PastReviewItem[] = (pastReviewsData || []).map((r: any) => {
        const linkedBooking = r.booking_id ? userBookingMap.get(r.booking_id) : undefined;
        return {
          id: r.id,
          bookingId: r.booking_id,
          eventName: r.event_name || linkedBooking?.event_type || 'Event Production',
          packageName: r.package_name || linkedBooking?.package_name || 'Production Setup',
          rating: Number(r.rating) || 5,
          comment: r.comment || '',
          date: r.created_at
            ? new Date(r.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })
            : 'Date Unknown',
          status: r.status || 'approved',
          venue: linkedBooking?.venue_address || '',
        };
      });

      setMyPastReviews(pastList);

      const reviewedBookingIds = new Set<string>(
        (pastReviewsData || []).map((r: any) => r.booking_id).filter(Boolean)
      );

      // 3. Filter strictly for completed status AND not already reviewed
      const unreviewedCompleted = (userBookings || []).filter((b: any) => {
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

      // If user has no unreviewed events but has past reviews, default to history tab
      if (options.length === 0 && pastList.length > 0) {
        setActiveTab('history');
      }
    } catch (err) {
      console.error('Failed to fetch customer reviews and bookings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomerReviewsAndBookings();
  }, []);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBookingId || !review.trim()) return;

    setSubmitting(true);
    try {
      const selected = completedBookings.find((b) => b.id === selectedBookingId);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      await supabase.from('reviews').insert({
        booking_id: selectedBookingId,
        user_id: user?.id || null,
        customer_name: selected?.customerName || user?.email?.split('@')[0] || 'Verified Host',
        customer_role: 'Event Host',
        event_name: selected?.eventName || 'Production Event',
        package_name: selected?.packageName || 'Event Setup',
        rating,
        comment: review.trim(),
        status: 'approved', // Published directly
        is_mock: false,
      });

      // Award +100 bonus loyalty points to user profile
      if (user?.id) {
        await awardReviewBonusPoints(user.id, selected?.eventName);
      }

      // Refresh data
      await fetchCustomerReviewsAndBookings();
    } catch (err) {
      console.warn('Review save note:', err);
    } finally {
      setSubmitting(false);
      setPosted(true);
    }
  };

  if (posted) {
    return (
      <section className="pt-36 pb-24 px-4 sm:px-6 min-h-screen bg-white">
        <div className="max-w-xl mx-auto text-center">
          <div className="bg-white rounded-[2rem] p-6 sm:p-8 border border-[#24252c]/[0.08] shadow-sm">
            <span className="w-14 h-14 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto text-2xl font-bold mb-4 shadow-md">
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <h2 className="text-xl sm:text-2xl font-extrabold text-[var(--ink)]">Review Published Live!</h2>
            <p className="text-xs text-[#24252c]/60 mt-2">
              Thank you! Your review is now published live as a verified testimonial, and <strong className="text-[#1090F8]">+100 BINHI Loyalty Points</strong> have been added to your account balance.
            </p>
            <div className="flex flex-wrap justify-center gap-3 mt-6">
              <button
                onClick={() => {
                  setPosted(false);
                  setActiveTab('history');
                }}
                className="w-full sm:w-auto bg-[var(--ink)] text-white text-xs font-semibold px-5 py-3 rounded-full hover:bg-[var(--ink-soft)] transition-colors cursor-pointer"
              >
                View in Past Reviews →
              </button>
              <button
                onClick={() => go('loyalty')}
                className="w-full sm:w-auto bg-[var(--mist)] text-[var(--ink)] text-xs font-semibold px-5 py-3 rounded-full hover:bg-[var(--ink)] hover:text-white transition-colors cursor-pointer"
              >
                View Loyalty Balance
              </button>
              <button
                onClick={() => go('landing')}
                className="w-full sm:w-auto bg-[var(--mist)] text-[var(--ink)] text-xs font-semibold px-5 py-3 rounded-full hover:bg-[var(--ink)] hover:text-white transition-colors cursor-pointer"
              >
                Home Page
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="pt-36 pb-24 px-4 sm:px-6 min-h-screen bg-white">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header Title and Tabs */}
        <div className="bg-white rounded-[2rem] p-5 sm:p-8 border border-[#24252c]/[0.08] shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#24252c]/[0.06]">
            <div>
              <MonoBadge>Verified Client Feedback</MonoBadge>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ink)] mt-2">
                My Reviews & Feedback
              </h1>
              <p className="text-xs text-[#24252c]/60 mt-1">
                Share your production experience and access your submitted event reviews anytime.
              </p>
            </div>

            {/* Navigation Tabs */}
            <div className="grid grid-cols-2 sm:flex bg-[#EEEEEE] p-1.5 rounded-2xl w-full sm:w-auto gap-1">
              <button
                type="button"
                onClick={() => setActiveTab('submit')}
                className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === 'submit'
                    ? 'bg-white text-[var(--ink)] shadow-sm'
                    : 'text-[#24252c]/60 hover:text-[var(--ink)]'
                }`}
              >
                <span>Submit</span>
                {completedBookings.length > 0 && (
                  <span className="bg-[#1090F8] text-white text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
                    {completedBookings.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === 'history'
                    ? 'bg-white text-[var(--ink)] shadow-sm'
                    : 'text-[#24252c]/60 hover:text-[var(--ink)]'
                }`}
              >
                <span>Submitted</span>
                <span className="bg-[#24252c]/10 text-[var(--ink)] text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
                  {myPastReviews.length}
                </span>
              </button>
            </div>
          </div>

          {loading ? (
            <div className="space-y-4 py-8">
              <div className="h-12 bg-[var(--mist)] rounded-2xl animate-pulse" />
              <div className="h-24 bg-[var(--mist)] rounded-2xl animate-pulse" />
              <div className="h-24 bg-[var(--mist)] rounded-2xl animate-pulse" />
            </div>
          ) : activeTab === 'submit' ? (
            /* SUBMIT TAB */
            <div className="pt-6">
              {completedBookings.length === 0 ? (
                <div className="text-center py-8 space-y-4">
                  <EmptyState
                    title="No Events Available to Review"
                    description="You have already submitted reviews for all your completed events, or do not have any completed bookings yet."
                  />
                  <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
                    {myPastReviews.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setActiveTab('history')}
                        className="bg-[var(--ink)] text-white text-xs font-semibold px-6 py-3 rounded-full hover:bg-[var(--ink-soft)] transition-colors cursor-pointer"
                      >
                        View My Submitted Reviews ({myPastReviews.length}) →
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => go('booking-history')}
                      className="bg-[var(--mist)] text-[var(--ink)] text-xs font-semibold px-6 py-3 rounded-full hover:bg-[var(--ink)] hover:text-white transition-colors cursor-pointer"
                    >
                      Return to Booking History
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmitReview} className="space-y-5">
                  <div className="bg-[#1090F8]/10 border border-[#1090F8]/20 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[#1090F8] font-semibold">
                    <span>Post a verified review and earn +100 Loyalty Points!</span>
                    <span className="bg-[#1090F8] text-white px-2.5 py-1 rounded-full text-[10px] self-start sm:self-auto shrink-0">
                      Bonus Points
                    </span>
                  </div>

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
          ) : (
            /* PAST REVIEWS TAB */
            <div className="pt-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-[#24252c]/[0.06]">
                <h2 className="text-base font-bold text-[var(--ink)]">Your Past Reviews</h2>
                <span className="text-xs text-[#24252c]/60">
                  {myPastReviews.length} {myPastReviews.length === 1 ? 'Review' : 'Reviews'} on Record
                </span>
              </div>

              {myPastReviews.length === 0 ? (
                <div className="text-center py-10 space-y-4">
                  <EmptyState
                    title="No Past Reviews Found"
                    description="You haven't submitted any reviews yet. Complete an event and leave feedback to see your testimonials here."
                  />
                  {completedBookings.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('submit')}
                      className="bg-[var(--ink)] text-white text-xs font-semibold px-6 py-3 rounded-full hover:bg-[var(--ink-soft)] transition-colors cursor-pointer"
                    >
                      Submit a Review for {completedBookings[0].eventName} (+100 PTS)
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {myPastReviews.map((item) => (
                    <div
                      key={item.id}
                      className="bg-[#FBFBFB] rounded-2xl p-4 sm:p-6 border border-[#24252c]/[0.08] hover:border-[#1090F8]/30 transition-all space-y-3 relative group"
                    >
                      {/* Top Header: Event & Package */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <span className="font-extrabold text-[var(--ink)] text-sm sm:text-base break-words">
                            {item.eventName}
                          </span>
                          <span className="bg-[var(--mist)] text-[var(--ink)] text-[11px] font-semibold px-2.5 py-0.5 rounded-full shrink-0">
                            {item.packageName}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            {item.status === 'featured' ? 'Featured Review' : 'Published Live'}
                          </span>
                        </div>
                      </div>

                      {/* Stars & Date Sub-header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs text-[#24252c]/60 pt-2 border-t border-[#24252c]/[0.04]">
                        <div className="flex items-center gap-1.5">
                          <div className="flex text-amber-400 text-sm">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <span key={i} className={i < item.rating ? 'text-amber-400' : 'text-[#24252c]/20'}>
                                ★
                              </span>
                            ))}
                          </div>
                          <span className="font-bold text-[var(--ink)] text-xs">
                            {item.rating.toFixed(1)} / 5.0
                          </span>
                        </div>
                        <span className="text-[11px] font-medium text-[#24252c]/50">
                          Submitted on {item.date}
                        </span>
                      </div>

                      {/* Feedback Box */}
                      <div className="bg-white rounded-xl p-3.5 sm:p-4 border border-[#24252c]/[0.06] text-xs sm:text-sm text-[var(--ink)] leading-relaxed relative">
                        <div className="text-[#24252c]/40 text-lg leading-none font-serif select-none mb-1">“</div>
                        <p className="italic text-[var(--ink)]/90 whitespace-pre-wrap break-words pl-2">
                          {item.comment}
                        </p>
                        <div className="text-[#24252c]/40 text-lg leading-none font-serif select-none text-right mt-1">”</div>
                      </div>

                      {/* Address / Venue without emoji */}
                      {item.venue && (
                        <div className="text-[11px] text-[#24252c]/50 flex items-center gap-1.5">
                          <svg
                            className="w-3.5 h-3.5 text-[#24252c]/40 shrink-0"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path
                              d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <circle cx="12" cy="10" r="3" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          <span className="break-words">{item.venue}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
