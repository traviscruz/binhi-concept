import { useState, useEffect } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import { IconTicket } from '../../components/shared/icons';
import { EmptyState } from '../../components/shared/EmptyState';
import { supabase } from '../../lib/supabase';
import { logAuditEvent } from '../../utils/auditLogger';

interface ReviewItem {
  id: string;
  author: string;
  rating: number;
  date: string;
  packageName: string;
  eventName: string;
  comment: string;
  status: string; // 'pending', 'approved', 'featured', 'hidden'
  isMock: boolean;
}

export default function AdminReviewsPage({ go: _go }: { go: (p: Page) => void }) {
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');

  const loadReviews = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        const mapped: ReviewItem[] = data.map((r: any) => ({
          id: r.id,
          author: r.customer_name || 'Verified Host',
          rating: Number(r.rating) || 5,
          date: r.created_at
            ? new Date(r.created_at).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })
            : 'Date Unknown',
          packageName: r.package_name || 'Production Setup',
          eventName: r.event_name || 'Event Production',
          comment: r.comment,
          status: r.status || 'pending',
          isMock: Boolean(r.is_mock),
        }));
        setReviews(mapped);
      }
    } catch (err) {
      console.error('Error loading reviews for admin moderation:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReviews();
  }, []);

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    const target = reviews.find((r) => r.id === id);
    try {
      await supabase
        .from('reviews')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', id);

      await logAuditEvent({
        action: 'MODERATE_REVIEW',
        module: 'reviews',
        targetId: id,
        targetName: target ? `${target.author} (${target.packageName})` : id,
        details: `Updated review status for ${target?.author || id} from "${target?.status || 'pending'}" to "${newStatus}"`,
        previousData: { status: target?.status },
        currentData: { status: newStatus },
      });

      setReviews((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r))
      );
    } catch (err) {
      console.error('Error updating review status:', err);
    }
  };

  const filteredReviews = reviews.filter((r) => {
    if (filter === 'All') return true;
    if (filter === 'Pending') return r.status === 'pending';
    if (filter === 'Approved') return r.status === 'approved' || r.status === 'featured';
    if (filter === 'Hidden') return r.status === 'hidden';
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#24252c]/[0.06]">
        <div>
          <MonoBadge icon={IconTicket}>Review Moderation</MonoBadge>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ink)] mt-1.5">
            Customer Review Moderation
          </h1>
          <p className="text-xs text-[#24252c]/60 mt-1">
            Approve, feature, or hide customer reviews before they appear on the landing page testimonials.
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        {['All', 'Pending', 'Approved', 'Hidden'].map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`text-xs px-4 py-2 rounded-full font-semibold transition-all cursor-pointer ${
              filter === tab
                ? 'bg-[var(--ink)] text-white shadow-sm'
                : 'bg-white text-[#24252c]/60 hover:text-[var(--ink)] border border-[#24252c]/10'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 bg-white rounded-2xl animate-pulse border border-[#24252c]/[0.08]" />
          ))}
        </div>
      ) : filteredReviews.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 border border-[#24252c]/[0.08] shadow-sm text-center">
          <EmptyState
            title="No Reviews Found"
            description="No customer reviews match the selected filter category."
          />
        </div>
      ) : (
        <div className="space-y-4">
          {filteredReviews.map((r) => {
            const isApproved = r.status === 'approved' || r.status === 'featured';

            return (
              <div key={r.id} className="p-6 rounded-2xl bg-white border border-[#24252c]/[0.08] shadow-sm space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base text-[var(--ink)]">{r.author}</span>
                    <span className="text-xs font-bold text-amber-500">{'★'.repeat(r.rating)}</span>
                    {r.isMock && (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 border border-amber-500/20 uppercase tracking-wider">
                        Mock Data
                      </span>
                    )}
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                      isApproved
                        ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                        : r.status === 'pending'
                        ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                        : 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                    }`}
                  >
                    {r.status}
                  </span>
                </div>

                <div className="text-xs text-[#1090F8] font-bold">
                  {r.eventName} · {r.packageName} · Submitted: {r.date}
                </div>

                <p className="text-xs text-[#24252c]/70 leading-relaxed bg-[var(--mist)] p-3 rounded-xl border border-[#24252c]/[0.06]">
                  "{r.comment}"
                </p>

                <div className="flex justify-end gap-2">
                  {isApproved ? (
                    <button
                      onClick={() => handleUpdateStatus(r.id, 'hidden')}
                      className="text-xs font-semibold px-4 py-2 rounded-full border bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100 transition-all cursor-pointer"
                    >
                      Hide Review
                    </button>
                  ) : (
                    <button
                      onClick={() => handleUpdateStatus(r.id, 'approved')}
                      className="text-xs font-semibold px-4 py-2 rounded-full bg-emerald-600 text-white border border-emerald-600 hover:bg-emerald-700 transition-all cursor-pointer shadow-sm"
                    >
                      Approve & Publish to Landing Page
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
