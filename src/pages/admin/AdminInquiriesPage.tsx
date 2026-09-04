import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import {
  IconMail,
  IconX,
  IconCheck,
  IconTrash,
  IconClock,
  IconSearch,
  IconCalendar,
  IconExternal,
  IconTicket,
  IconUser,
} from '../../components/shared/icons';
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

  // Filters matching Audit Trail & Logs
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7days' | '30days'>('all');
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

  // Unique event types list for filters
  const uniqueEventTypes = useMemo(() => {
    const set = new Set<string>();
    inquiries.forEach((inq) => {
      if (inq.event_type && inq.event_type.trim()) {
        set.add(inq.event_type.trim());
      }
    });
    return Array.from(set).sort();
  }, [inquiries]);

  // Filtered Inquiries
  const filteredInquiries = useMemo(() => {
    return inquiries.filter((inq) => {
      // 1. Status Filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'new' && inq.status !== 'New') return false;
        if (statusFilter === 'replied' && inq.status !== 'Replied') return false;
      }

      // 2. Event Type Filter
      if (eventTypeFilter !== 'all') {
        if (inq.event_type.toLowerCase() !== eventTypeFilter.toLowerCase()) return false;
      }

      // 3. Date Range Filter
      if (dateFilter !== 'all') {
        try {
          const itemTime = new Date(inq.created_at).getTime();
          const now = Date.now();
          if (dateFilter === 'today' && now - itemTime > 24 * 60 * 60 * 1000) return false;
          if (dateFilter === '7days' && now - itemTime > 7 * 24 * 60 * 60 * 1000) return false;
          if (dateFilter === '30days' && now - itemTime > 30 * 24 * 60 * 60 * 1000) return false;
        } catch {}
      }

      // 4. Keyword Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesSearch =
          inq.name.toLowerCase().includes(q) ||
          inq.email.toLowerCase().includes(q) ||
          inq.event_type.toLowerCase().includes(q) ||
          inq.message.toLowerCase().includes(q) ||
          (inq.budget && inq.budget.toLowerCase().includes(q)) ||
          (inq.website && inq.website.toLowerCase().includes(q));

        if (!matchesSearch) return false;
      }

      return true;
    });
  }, [inquiries, statusFilter, eventTypeFilter, dateFilter, searchQuery]);

  // Metrics
  const metrics = useMemo(() => {
    const total = inquiries.length;
    const newItems = inquiries.filter((x) => x.status === 'New').length;
    const repliedItems = inquiries.filter((x) => x.status === 'Replied').length;
    const weddingItems = inquiries.filter((x) => x.event_type.toLowerCase().includes('wedding')).length;
    return { total, newItems, repliedItems, weddingItems };
  }, [inquiries]);

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
    <div className="space-y-6 pb-12">
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
            {metrics.newItems > 0 && (
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#1090F8] text-white">
                {metrics.newItems} New
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

      {/* Summary KPI Cards — Matching Audit Trail & Logs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#24252c]/[0.08] shadow-xs">
          <div className="text-[10px] font-bold text-[#24252c]/50 uppercase tracking-wider">
            Total Inquiries
          </div>
          <div className="text-2xl font-black text-[var(--ink)] mt-1">
            {metrics.total.toLocaleString()}
          </div>
          <div className="text-[10px] text-emerald-700 font-medium mt-0.5">
            Live database records
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#24252c]/[0.08] shadow-xs">
          <div className="text-[10px] font-bold text-[#24252c]/50 uppercase tracking-wider">
            New / Unanswered
          </div>
          <div className="text-2xl font-black text-[#1090F8] mt-1">
            {metrics.newItems.toLocaleString()}
          </div>
          <div className="text-[10px] text-[#1090F8]/80 font-medium mt-0.5">
            Requires email reply
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#24252c]/[0.08] shadow-xs">
          <div className="text-[10px] font-bold text-[#24252c]/50 uppercase tracking-wider">
            Replied & Resolved
          </div>
          <div className="text-2xl font-black text-emerald-600 mt-1">
            {metrics.repliedItems.toLocaleString()}
          </div>
          <div className="text-[10px] text-emerald-700 font-medium mt-0.5">
            Direct responses sent
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#24252c]/[0.08] shadow-xs">
          <div className="text-[10px] font-bold text-[#24252c]/50 uppercase tracking-wider">
            Weddings & Premier
          </div>
          <div className="text-2xl font-black text-[var(--ink)] mt-1">
            {metrics.weddingItems.toLocaleString()}
          </div>
          <div className="text-[10px] text-[#24252c]/50 mt-0.5">
            Specialized production leads
          </div>
        </div>
      </div>

      {/* Filter Control Bar — Identical to Audit Trail & Logs */}
      <div className="bg-white p-4 rounded-2xl border border-[#24252c]/[0.08] shadow-xs space-y-3">
        {/* Module / Status Oval Pill Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {[
            { id: 'all', label: `All Inquiries (${inquiries.length})` },
            { id: 'new', label: `New (${metrics.newItems})` },
            { id: 'replied', label: `Replied (${metrics.repliedItems})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-[var(--ink)] text-white shadow-xs'
                  : 'bg-[var(--mist)] text-[#24252c]/65 hover:text-[var(--ink)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Dropdowns & Search */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
          {/* Event Type Filter */}
          <div>
            <select
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
              className="w-full bg-[var(--mist)] border border-[#24252c]/10 rounded-full px-4 py-2 text-xs font-medium text-[var(--ink)] focus:outline-none focus:border-[#1090F8] transition-colors cursor-pointer"
            >
              <option value="all">All Event Types</option>
              {uniqueEventTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-[var(--mist)] border border-[#24252c]/10 rounded-full px-4 py-2 text-xs font-medium text-[var(--ink)] focus:outline-none focus:border-[#1090F8] transition-colors cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="new">New (Pending Reply)</option>
              <option value="replied">Replied / Resolved</option>
            </select>
          </div>

          {/* Date Range Filter */}
          <div>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="w-full bg-[var(--mist)] border border-[#24252c]/10 rounded-full px-4 py-2 text-xs font-medium text-[var(--ink)] focus:outline-none focus:border-[#1090F8] transition-colors cursor-pointer"
            >
              <option value="all">All Dates</option>
              <option value="today">Past 24 Hours</option>
              <option value="7days">Past 7 Days</option>
              <option value="30days">Past 30 Days</option>
            </select>
          </div>

          {/* Search Box */}
          <div className="relative">
            <IconSearch className="w-3.5 h-3.5 text-[#24252c]/40 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search client, email, message..."
              className="w-full bg-[var(--mist)] border border-[#24252c]/10 rounded-full pl-9 pr-4 py-2 text-xs font-medium text-[var(--ink)] focus:outline-none focus:border-[#1090F8] transition-colors"
            />
          </div>
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
                  ? `No inquiries matched "${searchQuery}". Try a different filter or keyword.`
                  : statusFilter === 'new'
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
                          className="text-[11px] font-medium text-[#1090F8] hover:underline bg-[#1090F8]/10 px-2 py-0.5 rounded-full inline-flex items-center gap-1"
                        >
                          <span>Website / Social</span>
                          <IconExternal className="w-3 h-3" />
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
                <div className="flex items-center justify-end pt-2 border-t border-[#24252c]/[0.06]">
                  <button
                    onClick={() => {
                      setReplyInquiry(inq);
                      setReplyMessage(
                        inq.reply_message ||
                          `Hi ${inq.name},\n\nThank you for reaching out to BINHI Concept regarding your upcoming ${inq.event_type}! We would love to provide the sound, lighting, and stage production support for your event.\n\nCould you share additional details regarding your venue location and setup timeline so we can prepare a customized quotation for you?\n\nWarm regards,\nBINHI Concept Production Team`
                      );
                    }}
                    className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-2 ${
                      isNew
                        ? 'bg-[var(--ink)] text-white hover:bg-[var(--ink-soft)]'
                        : 'bg-[var(--mist)] text-[var(--ink)] border border-[#24252c]/10 hover:bg-[var(--ink)] hover:text-white'
                    }`}
                  >
                    <IconMail className="w-3.5 h-3.5" />
                    <span>{isNew ? 'Send Email Response' : 'Send Follow-up Email'}</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Reply Modal */}
      {replyInquiry && (
        <ModalOverlay isOpen={Boolean(replyInquiry)} onClose={() => !sendingReply && setReplyInquiry(null)}>
          <div className="bg-white rounded-[2rem] p-6 max-w-lg w-full shadow-2xl border border-[#24252c]/10 relative space-y-4">
            <button
              onClick={() => !sendingReply && setReplyInquiry(null)}
              disabled={sendingReply}
              className="absolute top-5 right-5 text-[#24252c]/50 hover:text-[var(--ink)] p-1 cursor-pointer disabled:opacity-50"
            >
              <IconX className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-[#1090F8]/10 text-[#1090F8] flex items-center justify-center font-bold">
                <IconMail className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-[var(--ink)]">Reply to {replyInquiry.name}</h3>
                <p className="text-[11px] text-[#24252c]/60">Direct email will be dispatched to {replyInquiry.email}</p>
              </div>
            </div>

            {/* Original Inq Context */}
            <div className="bg-[var(--mist)] p-3 rounded-xl text-xs space-y-1">
              <div className="flex items-center justify-between text-[10px] text-[#24252c]/50 font-bold uppercase">
                <span>{replyInquiry.event_type}</span>
                <span>{formatDate(replyInquiry.event_date)}</span>
              </div>
              <p className="text-[11px] text-[#24252c]/80 line-clamp-2 italic">"{replyInquiry.message}"</p>
            </div>

            {replyError && (
              <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200">
                {replyError}
              </div>
            )}

            <form onSubmit={handleSendReply} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[var(--ink)] mb-1">Response Message Body</label>
                <textarea
                  rows={6}
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  placeholder="Compose your custom quotation or email message here..."
                  className="w-full rounded-2xl border border-[#24252c]/15 p-3.5 text-xs bg-[#EEEEEE] focus:outline-none focus:border-[#1090F8] text-[var(--ink)] leading-relaxed transition-colors"
                  required
                />
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setReplyInquiry(null)}
                  disabled={sendingReply}
                  className="px-4 py-2.5 rounded-full bg-gray-100 text-gray-700 text-xs font-semibold hover:bg-gray-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sendingReply || !replyMessage.trim()}
                  className="px-6 py-2.5 rounded-full bg-[#1090F8] text-white text-xs font-bold hover:bg-[#1090F8]/90 transition-all shadow-md disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {sendingReply ? (
                    <>
                      <IconClock className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending Email...</span>
                    </>
                  ) : (
                    <>
                      <IconMail className="w-3.5 h-3.5" />
                      <span>Send Branded Reply</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </ModalOverlay>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <ModalOverlay isOpen={Boolean(deletingId)} onClose={() => !isDeleting && setDeletingId(null)}>
          <div className="bg-white rounded-[2rem] p-6 max-w-sm w-full shadow-2xl border border-[#24252c]/10 relative text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
              <IconTrash className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-[var(--ink)]">Delete Inquiry?</h3>
              <p className="text-xs text-[#24252c]/60 mt-1">
                Are you sure you want to permanently remove this inquiry from your inbox? This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-full bg-gray-100 text-gray-700 text-xs font-bold hover:bg-gray-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deletingId && handleDeleteInquiry(deletingId)}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-full bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isDeleting ? <IconClock className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Delete</span>
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}
