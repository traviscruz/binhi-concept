import { useState, useEffect } from 'react';
import { MonoBadgeDark } from './Badges';
import { supabase } from '../../lib/supabase';

export interface LiveTestimonialItem {
  id: string;
  quote: string;
  author: string;
  role: string;
  event: string;
  stars: number;
}

function StarIcon({ className = 'w-4 h-4 text-amber-400 fill-amber-400' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}

function ChevronLeftIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function ChevronRightIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
    </svg>
  );
}

export function TestimonialsSection() {
  const [testimonials, setTestimonials] = useState<LiveTestimonialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    async function fetchDbReviews() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('reviews')
          .select('*')
          .neq('status', 'hidden')
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          const liveReviews: LiveTestimonialItem[] = data.map((r: any) => ({
            id: r.id,
            quote: r.comment,
            author: r.customer_name || 'Verified Host',
            role: r.customer_role || 'Event Host',
            event: r.event_name || r.package_name || 'Production Event',
            stars: Number(r.rating) || 5,
          }));

          setTestimonials(liveReviews);
        } else {
          setTestimonials([]);
        }
      } catch (err) {
        console.error('Error loading live reviews from Supabase:', err);
        setTestimonials([]);
      } finally {
        setLoading(false);
      }
    }

    fetchDbReviews();
  }, []);

  const prev = () => setIndex((i) => (i === 0 ? testimonials.length - 1 : i - 1));
  const next = () => setIndex((i) => (i === testimonials.length - 1 ? 0 : i + 1));

  const t = testimonials[index] || testimonials[0];

  return (
    <div className="w-full bg-[#12141d] text-white py-24 px-6 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[34rem] h-[34rem] bg-[#1090F8]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-4xl mx-auto text-center relative z-10">
        <MonoBadgeDark>TESTIMONIALS</MonoBadgeDark>
        <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mt-4 text-white">
          What our clients say
        </h2>
        <p className="text-white/50 text-sm mt-2 max-w-md mx-auto">
          Direct, unfiltered reviews published in real-time from verified event organizers.
        </p>
      </div>

      {loading ? (
        <div className="max-w-2xl mx-auto mt-10 bg-white/5 rounded-2xl p-8 text-center border border-white/10 z-10 relative animate-pulse">
          <div className="h-4 bg-white/20 rounded w-1/3 mx-auto mb-4" />
          <div className="h-6 bg-white/10 rounded w-3/4 mx-auto" />
        </div>
      ) : testimonials.length === 0 ? (
        <div className="max-w-2xl mx-auto mt-10 bg-white/5 rounded-2xl md:rounded-3xl p-8 md:p-12 text-center border border-white/10 z-10 relative">
          <p className="text-white/70 text-base md:text-lg font-medium">
            Verified event reviews will appear here live once hosts complete bookings and submit ratings.
          </p>
          <span className="inline-block mt-4 text-xs font-semibold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-3.5 py-1.5 rounded-full border border-emerald-500/20">
            Real-Time Community Feedback
          </span>
        </div>
      ) : (
        <>
          <div className="max-w-2xl mx-auto mt-10 bg-white text-[var(--ink)] rounded-2xl md:rounded-3xl p-8 md:p-12 shadow-2xl relative border border-white/20 z-10">
            <div className="flex items-center justify-between gap-2 mb-6">
              <div className="flex items-center gap-1">
                {Array.from({ length: t.stars || 5 }).map((_, i) => (
                  <StarIcon key={i} />
                ))}
              </div>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 uppercase tracking-wider">
                Verified Host
              </span>
            </div>

            <blockquote className="text-lg md:text-xl font-medium tracking-tight text-[#24252c]/90 leading-relaxed min-h-[5.5rem]">
              "{t.quote}"
            </blockquote>

            <div className="h-px bg-gradient-to-r from-transparent via-[#24252c]/10 to-transparent my-8" />

            <div className="flex flex-col items-end text-right">
              <span className="font-handwriting text-3xl md:text-4xl text-[var(--ink)] font-bold tracking-wide">
                {t.author}
              </span>
              <span className="text-xs font-semibold text-[#24252c]/50 mt-1 uppercase tracking-wider">
                {t.role} · {t.event}
              </span>
            </div>
          </div>

          {testimonials.length > 1 && (
            <div className="max-w-2xl mx-auto flex items-center justify-between mt-8 relative z-10">
              <button
                onClick={prev}
                aria-label="Previous testimonial"
                className="w-11 h-11 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-white hover:bg-white/20 transition-colors focus:outline-none cursor-pointer"
              >
                <ChevronLeftIcon />
              </button>

              <div className="flex items-center gap-2">
                {testimonials.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setIndex(i)}
                    className={`h-2.5 rounded-full transition-all cursor-pointer ${
                      i === index ? 'bg-[#1090F8] w-6' : 'bg-white/20 w-2.5'
                    }`}
                  />
                ))}
              </div>

              <button
                onClick={next}
                aria-label="Next testimonial"
                className="w-11 h-11 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-white hover:bg-white/20 transition-colors focus:outline-none cursor-pointer"
              >
                <ChevronRightIcon />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}