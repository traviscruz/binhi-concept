import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import { IconMail, IconX, IconCheck, IconTrash, IconClock, IconSearch } from '../../components/shared/icons';
import { ModalOverlay } from '../../components/shared/ModalOverlay';
import { EmptyState } from '../../components/shared/EmptyState';
import { supabase } from '../../utils/supabase';
import { sendInquiryReplyEmail } from '../../utils/emailService';
import { logAuditEvent } from '../../utils/auditLogger';

export interface InquiryItem {
  id: string;
  name: string;
  email: string;
  website?: string | null;
  event_type: string;
  event_date?: string | null;
  budget?: string | null;
  message: string;
  status: 'New' | 'Replied' | string;
  reply_message?: string | null;
  replied_at?: string | null;
  created_at: string;
}

export default function AdminInquiriesPage({ go }: { go?: (p: Page) => void }) {
  const [inquiries, setInquiries] = useState<InquiryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'new' | 'replied'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Reply Modal State
  const [replyInquiry, setReplyInquiry] = useState<InquiryItem | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Delete Confirmation State
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch inquiries from Supabase
  const fetchInquiries = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const { data, error } = await supabase
        .from('inquiries')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[AdminInquiriesPage] Error fetching inquiries:', error);
      } else if (data) {
        setInquiries(data as InquiryItem[]);
      }
    } catch (err) {
      console.error('[AdminInquiriesPage] Unexpected fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchInquiries();

    // Supabase real-time subscription for inquiries table
    const channel = supabase
      .channel('public:inquiries')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inquiries' },
        () => {
          fetchInquiries(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchInquiries]);

  // Show temporary toast message
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Filtered & Searched Inquiries
  const filteredInquiries = useMemo(() => {
    return inquiries.filter((inq) => {
      const matchesFilter =
        filter === 'all'
          ? true
          : filter === 'new'
          ? inq.status === 'New'
          : inq.status === 'Replied';

      if (!matchesFilter) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        inq.name.toLowerCase().includes(q) ||
        inq.email.toLowerCase().includes(q) ||
        inq.event_type.toLowerCase().includes(q) ||
        inq.message.toLowerCase().includes(q) ||
        (inq.website && inq.website.toLowerCase().includes(q))
      );
    });
  }, [inquiries, filter, searchQuery]);

  const newCount = useMemo(() => inquiries.filter((x) => x.status === 'New').length, [inquiries]);
  const repliedCount = useMemo(() => inquiries.filter((x) => x.status === 'Replied').length, [inquiries]);

  // Handle Send Reply
  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyInquiry || !replyMessage.trim()) return;

    setSendingReply(true);
    setReplyError(null);

    try {
      // 1. Dispatch reply email via SMTP
      const emailRes = await sendInquiryReplyEmail(
        {
          recipientName: replyInquiry.name,
          replyMessage: replyMessage.trim(),
          originalInquiry: {
            eventType: replyInquiry.event_type,
            eventDate: replyInquiry.event_date || undefined,
            message: replyInquiry.message,
          },
        },
        replyInquiry.email
      );

      if (!emailRes.success) {
        console.warn('[AdminInquiriesPage] Email send returned error, proceeding to update DB status:', emailRes.error);
      }

      // 2. Update Supabase inquiry row
      const nowIso = new Date().toISOString();
      const { error: updateError } = await supabase
        .from('inquiries')
        .update({
          status: 'Replied',
          reply_message: replyMessage.trim(),
          replied_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', replyInquiry.id);

      if (updateError) {
        console.error('[AdminInquiriesPage] DB update error:', updateError);
        setReplyError('Failed to record reply in database: ' + updateError.message);
        setSendingReply(false);
        return;
      }

      // 3. Log to audit trail
      try {
        await logAuditEvent({
          action: 'REPLY_INQUIRY',
          module: 'system',
          targetId: replyInquiry.id,
          targetName: replyInquiry.name,
          details: `Sent email response to inquiry from ${replyInquiry.name} (${replyInquiry.email}) regarding ${replyInquiry.event_type}.`,
          currentData: { reply_message: replyMessage.trim(), status: 'Replied' },
        });
      } catch (logErr) {
        console.warn('Failed to log audit for inquiry reply:', logErr);
      }

      // 4. Update local state
      setInquiries((prev) =>
        prev.map((item) =>
          item.id === replyInquiry.id
            ? {
                ...item,
                status: 'Replied',
                reply_message: replyMessage.trim(),
                replied_at: nowIso,
              }
            : item
        )
      );

      showToast(`Reply sent successfully to ${replyInquiry.email} and marked as Replied!`);
      setReplyInquiry(null);
      setReplyMessage('');
    } catch (err: any) {
      console.error('[AdminInquiriesPage] Reply error:', err);
      setReplyError(err.message || 'An unexpected error occurred sending the reply.');
    } finally {
      setSendingReply(false);
    }
  };

  // Handle Delete Inquiry
  const handleDeleteInquiry = async (id: string) => {
    setIsDeleting(true);
    try {
      const { error } = await supabase.from('inquiries').delete().eq('id', id);
      if (error) {
        console.error('[AdminInquiriesPage] Delete error:', error);
        showToast('Error deleting inquiry: ' + error.message);
      } else {
        setInquiries((prev) => prev.filter((item) => item.id !== id));
        showToast('Inquiry deleted successfully.');
      }
    } catch (err: any) {
      console.error('[AdminInquiriesPage] Delete error:', err);
    } finally {
      setIsDeleting(false);
      setDeletingId(null);
    }
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'Not specified';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[var(--ink)] text-white text-xs font-semibold px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-2.5 border border-white/20 animate-fade-in">
          <IconCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 text-white/50 hover:text-white cursor-pointer">
            <IconX className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#24252c]/[0.06]">
        <div>
          <div className="flex items-center gap-2">
            <MonoBadge icon={IconMail}>Public Inquiries</MonoBadge>
            {newCount > 0 && (
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#1090F8] text-white">
                {newCount} New
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ink)] mt-1.5">
            Public Inquiry Inbox
          </h1>
          <p className="text-xs text-[#24252c]/60 mt-1">
            Review custom event inquiries submitted from the public contact page and send direct branded email responses.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => fetchInquiries(true)}
            disabled={refreshing}
            className="px-4 py-2 rounded-full border border-black/10 text-xs font-semibold text-[var(--ink)] hover:bg-black/5 transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <IconClock className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh Inbox'}</span>
          </button>
        </div>
      </div>

      {/* Stats and Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--mist)] p-3.5 rounded-2xl border border-[#24252c]/[0.06]">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => setFilter('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              filter === 'all'
                ? 'bg-[var(--ink)] text-white shadow-sm'
                : 'text-[#24252c]/60 hover:text-[var(--ink)] hover:bg-white/60'
            }`}
          >
            All ({inquiries.length})
          </button>
          <button
            onClick={() => setFilter('new')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              filter === 'new'
                ? 'bg-[#1090F8] text-white shadow-sm'
                : 'text-[#24252c]/60 hover:text-[var(--ink)] hover:bg-white/60'
            }`}
          >
            <span>New</span>
            {newCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${filter === 'new' ? 'bg-white text-[#1090F8]' : 'bg-[#1090F8] text-white'}`}>
                {newCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setFilter('replied')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              filter === 'replied'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-[#24252c]/60 hover:text-[var(--ink)] hover:bg-white/60'
            }`}
          >
            Replied ({repliedCount})
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-64">
          <IconSearch className="w-3.5 h-3.5 text-[#24252c]/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search inquiries..."
            className="w-full pl-9 pr-3.5 py-1.5 text-xs bg-white rounded-xl border border-black/10 focus:outline-none focus:border-[#1090F8] text-[var(--ink)] placeholder:text-[#24252c]/40 transition-colors"
          />
        </div>
      </div>

      {/* Inquiries List */}
      <div className="space-y-4">
        {loading ? (
          <div className="bg-white p-12 rounded-[2rem] border border-[#24252c]/[0.08] text-center">
            <IconClock className="w-8 h-8 mx-auto animate-spin text-[#1090F8] mb-3" />
            <p className="text-xs font-semibold text-[#24252c]/60">Loading inquiries from database...</p>
          </div>
        ) : filteredInquiries.length === 0 ? (
          <div className="bg-white p-8 rounded-[2rem] border border-[#24252c]/[0.08]">
            <EmptyState
              icon={IconMail}
              title={searchQuery ? 'No matching inquiries found' : 'No inquiries in inbox'}
              description={
                searchQuery
                  ? `No inquiries matched "${searchQuery}". Try a different keyword.`
                  : filter === 'new'
                  ? 'There are no pending new inquiries. All caught up!'
                  : 'New event inquiries submitted from the public contact page will appear here.'
              }
            />
          </div>
        ) : (
          filteredInquiries.map((inq) => {
            const isNew = inq.status === 'New';
            return (
              <div
                key={inq.id}
                className={`bg-white rounded-[2rem] p-6 border transition-all relative shadow-sm hover:shadow-md ${
                  isNew ? 'border-[#1090F8]/30 ring-1 ring-[#1090F8]/20' : 'border-[#24252c]/10'
                }`}
              >
                {/* Top Bar: Client & Status */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-extrabold text-base text-[var(--ink)]">{inq.name}</h3>
                      {inq.website && (
                        <a
                          href={inq.website.startsWith('http') ? inq.website : `https://${inq.website}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] font-medium text-[#1090F8] hover:underline bg-[#1090F8]/10 px-2 py-0.5 rounded-full"
                        >
                          Website / Social ↗
                        </a>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[#24252c]/60 mt-0.5">
                      <a href={`mailto:${inq.email}`} className="text-[#1090F8] font-semibold hover:underline">
                        {inq.email}
                      </a>
                      <span>·</span>
                      <span>Received {formatDate(inq.created_at)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                        isNew
                          ? 'bg-[#1090F8] text-white shadow-sm'
                          : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                      }`}
                    >
                      {inq.status}
                    </span>
                    <button
                      onClick={() => setDeletingId(inq.id)}
                      title="Delete inquiry"
                      className="p-1.5 text-[#24252c]/30 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <IconTrash className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Event Details Badges */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-[var(--mist)] p-3.5 rounded-2xl mb-4 text-xs">
                  <div>
                    <span className="text-[#24252c]/50 font-bold uppercase block text-[10px]">Event Type</span>
                    <span className="font-semibold text-[var(--ink)]">{inq.event_type}</span>
                  </div>
                  <div>
                    <span className="text-[#24252c]/50 font-bold uppercase block text-[10px]">Target Date</span>
                    <span className="font-semibold text-[var(--ink)]">{formatDate(inq.event_date)}</span>
                  </div>
                  <div>
                    <span className="text-[#24252c]/50 font-bold uppercase block text-[10px]">Est. Budget</span>
                    <span className="font-semibold text-[var(--ink)]">{inq.budget || 'To be discussed'}</span>
                  </div>
                </div>

                {/* Client Message */}
                <div className="text-xs text-[#24252c]/85 bg-white p-3.5 rounded-xl border border-[#24252c]/5 mb-4 leading-relaxed font-normal">
                  <span className="text-[10px] font-bold uppercase text-[#24252c]/40 block mb-1">Inquiry Message:</span>
                  <p className="whitespace-pre-wrap italic">"{inq.message}"</p>
                </div>

                {/* Previous Reply Preview (if replied) */}
                {inq.reply_message && (
                  <div className="mb-4 p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-500/20 text-xs">
                    <div className="flex items-center justify-between text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-1">
                      <span>Our Response Sent {formatDate(inq.replied_at)}</span>
                      <IconCheck className="w-3 h-3 text-emerald-600" />
                    </div>
                    <p className="text-[#24252c]/80 whitespace-pre-wrap line-clamp-3">{inq.reply_message}</p>
                  </div>
                )}

                {/* Action Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-[#24252c]/5">
                  <div className="text-[11px] text-[#24252c]/40 font-mono">
                    ID: {inq.id.slice(0, 8)}...
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setReplyInquiry(inq);
                        setReplyError(null);
                        setReplyMessage(
                          `Hi ${inq.name},\n\nThank you for reaching out to BINHI Concept regarding your upcoming ${inq.event_type}${
                            inq.event_date ? ` on ${formatDate(inq.event_date)}` : ''
                          }.\n\nWe would love to help bring your event vision to life. Based on your requirements, here are our initial recommendations:\n\n- \n- \n\nPlease let us know your preferred schedule for a brief consultation or ocular inspection.\n\nWarm regards,\nBINHI Concept Team`
                        );
                      }}
                      className={`text-xs font-semibold px-4 py-2 rounded-full transition-colors cursor-pointer shadow-sm ${
                        isNew
                          ? 'bg-[var(--ink)] text-white hover:bg-[var(--ink-soft)]'
                          : 'bg-[#EEEEEE] text-[var(--ink)] hover:bg-[#E2E4E8]'
                      }`}
                    >
                      {isNew ? 'Send Email Reply' : 'Send Follow-up Email'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Send Email Reply Modal */}
      <ModalOverlay isOpen={!!replyInquiry} onClose={() => !sendingReply && setReplyInquiry(null)}>
        <div className="bg-white rounded-[2.5rem] p-6 md:p-8 max-w-2xl w-full shadow-2xl border border-[#24252c]/10 relative max-h-[90vh] overflow-y-auto">
          <button
            onClick={() => !sendingReply && setReplyInquiry(null)}
            disabled={sendingReply}
            className="absolute top-6 right-6 text-[#24252c]/50 hover:text-[var(--ink)] p-1 cursor-pointer disabled:opacity-40"
          >
            <IconX className="w-6 h-6" />
          </button>

          <h3 className="text-2xl font-extrabold text-[var(--ink)] mb-1">
            Reply to Inquiry
          </h3>
          <p className="text-xs font-semibold text-[#1090F8] mb-4">
            Recipient: <span className="font-bold">{replyInquiry?.name}</span> ({replyInquiry?.email})
          </p>

          {replyError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-medium">
              {replyError}
            </div>
          )}

          {/* Original Inquiry Summary in Modal */}
          {replyInquiry && (
            <div className="mb-4 p-3.5 rounded-2xl bg-[var(--mist)] border border-[#24252c]/[0.06] text-xs">
              <div className="flex items-center justify-between text-[10px] uppercase font-bold text-[#24252c]/50 mb-1">
                <span>Inquiry Context: {replyInquiry.event_type}</span>
                <span>Date: {formatDate(replyInquiry.event_date)}</span>
              </div>
              <p className="text-[#24252c]/75 italic line-clamp-2">"{replyInquiry.message}"</p>
            </div>
          )}

          <form onSubmit={handleSendReply} className="space-y-4 text-xs">
            <div>
              <label className="font-semibold uppercase text-[#24252c]/50 block mb-1.5 text-[11px]">
                Email Response Message
              </label>
              <textarea
                rows={10}
                value={replyMessage}
                onChange={(e) => setReplyMessage(e.target.value)}
                disabled={sendingReply}
                placeholder="Compose your personalized response..."
                className="w-full rounded-2xl border border-black/10 px-4 py-3.5 bg-[#F8F9FA] focus:bg-white focus:outline-none focus:border-[#1090F8] transition-all text-xs font-medium leading-relaxed min-h-[220px] text-[var(--ink)]"
                required
              />
              <p className="text-[11px] text-[#24252c]/50 mt-1.5">
                This response will be sent via official BINHI Concept SMTP styled with the BINHI Concept letterhead template.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setReplyInquiry(null)}
                disabled={sendingReply}
                className="px-5 py-2.5 rounded-full border border-black/10 text-xs font-semibold text-[var(--ink)] hover:bg-[#F0F0F0] transition-colors cursor-pointer disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={sendingReply || !replyMessage.trim()}
                className="bg-[var(--ink)] text-white font-semibold px-7 py-2.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors cursor-pointer text-xs shadow-md flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {sendingReply ? (
                  <>
                    <IconClock className="w-3.5 h-3.5 animate-spin" />
                    <span>Sending email...</span>
                  </>
                ) : (
                  <span>Send Email &amp; Mark as Replied</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </ModalOverlay>

      {/* Delete Confirmation Modal */}
      <ModalOverlay isOpen={!!deletingId} onClose={() => !isDeleting && setDeletingId(null)}>
        <div className="bg-white rounded-[2rem] p-6 max-w-sm w-full shadow-2xl border border-[#24252c]/10 text-center">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
            <IconTrash className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-[var(--ink)] mb-1">Delete Inquiry?</h3>
          <p className="text-xs text-[#24252c]/60 mb-5">
            Are you sure you want to delete this inquiry submission? This action cannot be undone.
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => setDeletingId(null)}
              disabled={isDeleting}
              className="px-5 py-2 rounded-full border border-black/10 text-xs font-semibold hover:bg-black/5"
            >
              Cancel
            </button>
            <button
              onClick={() => deletingId && handleDeleteInquiry(deletingId)}
              disabled={isDeleting}
              className="px-5 py-2 rounded-full bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 flex items-center gap-1.5"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </ModalOverlay>
    </div>
  );
}
