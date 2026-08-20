import { useState } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';

const inputClass =
  'w-full rounded-2xl border px-5 py-3.5 bg-[#EEEEEE] text-[var(--ink)] placeholder:text-[#24252c]/40 focus:outline-none focus:border-[#1090F8] border-transparent transition-colors text-sm';

export default function MyReviewsPage({ go }: { go: (p: Page) => void }) {
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState('');
  const [posted, setPosted] = useState(false);

  if (posted) {
    return (
      <section className="pt-36 pb-24 px-6 min-h-screen bg-white">
        <div className="max-w-xl mx-auto text-center">
          <div className="bg-white rounded-[2rem] p-8 border border-[#24252c]/[0.08] shadow-sm">
            <span className="w-14 h-14 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto text-2xl font-bold mb-4 shadow-md">
              ✓
            </span>
            <h2 className="text-2xl font-extrabold text-[var(--ink)]">Review Published</h2>
            <p className="text-xs text-[#24252c]/60 mt-2">
              Thank you! <strong className="text-[#1090F8]">+100 BINHI Loyalty Points</strong> have been added to your account balance.
            </p>
            <button
              onClick={() => go('loyalty')}
              className="mt-6 bg-[var(--ink)] text-white text-xs font-semibold px-6 py-3 rounded-full hover:bg-[var(--ink-soft)] transition-colors"
            >
              View Loyalty Balance →
            </button>
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

          <form
            onSubmit={(e) => {
              e.preventDefault();
              setPosted(true);
            }}
            className="space-y-5"
          >
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50 ml-1 block mb-1">
                Select Completed Event
              </label>
              <select className="w-full rounded-full border border-transparent px-5 py-3.5 text-sm bg-[#EEEEEE] text-[var(--ink)] font-medium focus:outline-none focus:border-[#1090F8]">
                <option>Corporate Tech Summit 2025 (Nov 12, 2025)</option>
                <option>18th Birthday Debut Staging (Jun 20, 2025)</option>
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
                    className={`text-3xl transition-transform ${
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
                value={review}
                onChange={(e) => setReview(e.target.value)}
                placeholder="Tell us about the audio clarity, moving head lighting, and technical crew on-site performance..."
                className={inputClass}
              />
            </div>

            <button
              type="submit"
              className="w-full bg-[var(--ink)] text-white text-xs font-semibold py-4 rounded-full hover:bg-[var(--ink-soft)] transition-colors shadow-md"
            >
              Post Verified Review & Claim +100 PTS
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
