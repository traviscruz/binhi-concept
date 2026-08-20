import { useState } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import { IconTicket } from '../../components/shared/icons';

export default function AdminReviewsPage({ go }: { go: (p: Page) => void }) {
  const [reviews, setReviews] = useState([
    { id: 'rev-1', author: 'Juan Dela Cruz', rating: 5, date: 'August 15, 2026', package: 'Standard Production Setup', comment: 'The sound clarity and lighting atmosphere at Shangri-La Fort was beyond amazing! The crew arrived 2 hours early and soundcheck was seamless.', status: 'Approved' },
    { id: 'rev-2', name: 'Maria Santos', rating: 5, date: 'July 20, 2026', package: 'Minimalist Sound Package', comment: 'Clear wireless microphones during our debut host speeches. Highly recommended!', status: 'Pending Review' },
  ]);

  const toggleStatus = (id: string) => {
    setReviews((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          const isApproved = r.status === 'Approved';
          return { ...r, status: isApproved ? 'Hidden' : 'Approved' };
        }
        return r;
      })
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#24252c]/[0.06]">
        <div>
          <MonoBadge icon={IconTicket}>Review Moderation</MonoBadge>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ink)] mt-1.5">
            Customer Review Moderation
          </h1>
          <p className="text-xs text-[#24252c]/60 mt-1">
            Approve, feature, or hide customer reviews submitted after completed event bookings.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {reviews.map((r) => (
          <div key={r.id} className="p-6 rounded-2xl bg-white border border-[#24252c]/[0.08] shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold text-base text-[var(--ink)]">{r.author || r.name}</span>
                <span className="text-xs font-bold text-amber-500">{"★".repeat(r.rating)}</span>
              </div>
              <span
                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                  r.status === 'Approved'
                    ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                }`}
              >
                {r.status}
              </span>
            </div>

            <div className="text-xs text-[#1090F8] font-bold">{r.package} · Date: {r.date}</div>

            <p className="text-xs text-[#24252c]/70 leading-relaxed bg-[var(--mist)] p-3 rounded-xl border border-[#24252c]/[0.06]">
              "{r.comment}"
            </p>

            <div className="flex justify-end">
              <button
                onClick={() => toggleStatus(r.id)}
                className={`text-xs font-semibold px-4 py-2 rounded-full border transition-all ${
                  r.status === 'Approved'
                    ? 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100'
                    : 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {r.status === 'Approved' ? 'Hide Review' : 'Approve & Publish'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
