import { useState } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import { IconMail, IconX } from '../../components/shared/icons';
import { ModalOverlay } from '../../components/shared/ModalOverlay';
import { EmptyState } from '../../components/shared/EmptyState';

export interface InquiryItem {
  id: string;
  name: string;
  email: string;
  eventType: string;
  date: string;
  budget: string;
  message: string;
  status: string;
}

export default function AdminInquiriesPage({ go }: { go?: (p: Page) => void }) {
  const [inquiries, setInquiries] = useState<InquiryItem[]>([
    { id: 'inq-1', name: 'Patricia Reyes', email: 'patricia@eventstudio.ph', eventType: 'Wedding Reception', date: 'October 5, 2026', budget: '₱40,000', message: 'Hi! We need a full LED wall and sound setup for 150 guests at Blue Leaf. Can we customize the speaker count?', status: 'New' },
    { id: 'inq-2', name: 'Dennis Gomez', email: 'dennis.gomez@techcorp.com', eventType: 'Corporate Event / Gala', date: 'December 1, 2026', budget: '₱80,000', message: 'Looking for stage hazers and dual 15-inch subs for our annual company party.', status: 'Replied' },
  ]);

  const [replyInquiry, setReplyInquiry] = useState<InquiryItem | null>(null);
  const [replyMessage, setReplyMessage] = useState('');

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyInquiry) return;

    setInquiries((prev) =>
      prev.map((item) => (item.id === replyInquiry.id ? { ...item, status: 'Replied' } : item))
    );

    setReplyInquiry(null);
    setReplyMessage('');
  };

  const activeReplyInquiry = replyInquiry || { name: '', email: '' };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#24252c]/[0.06]">
        <div>
          <MonoBadge icon={IconMail}>Contact Submissions ({inquiries.filter(x => x.status === 'New').length})</MonoBadge>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ink)] mt-1.5">
            Public Inquiry Inbox
          </h1>
          <p className="text-xs text-[#24252c]/60 mt-1">
            Review and respond to custom event inquiry messages submitted from the public contact page.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {inquiries.length === 0 ? (
          <div className="bg-white p-6 rounded-2xl border border-[#24252c]/[0.08]">
            <EmptyState
              icon={IconMail}
              title="No Inquiries in Inbox"
              description="New custom event inquiries submitted from the contact page will appear here."
            />
          </div>
        ) : (
          inquiries.map((inq) => (
            <div key={inq.id} className="bg-white rounded-[2rem] p-6 border border-[#24252c]/10 shadow-sm hover:shadow-md transition-shadow relative">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-extrabold text-base text-[var(--ink)]">{inq.name}</h3>
                  <p className="text-xs text-[#1090F8] font-semibold">{inq.email}</p>
                </div>
                <span
                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                    inq.status === 'New' ? 'bg-[#1090F8] text-white' : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                  }`}
                >
                  {inq.status}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 bg-[var(--mist)] p-3 rounded-2xl mb-4 text-xs">
                <div><span className="text-[#24252c]/50 font-bold uppercase block text-[10px]">Event Type</span><span className="font-semibold text-[var(--ink)]">{inq.eventType}</span></div>
                <div><span className="text-[#24252c]/50 font-bold uppercase block text-[10px]">Target Date</span><span className="font-semibold text-[var(--ink)]">{inq.date}</span></div>
                <div><span className="text-[#24252c]/50 font-bold uppercase block text-[10px]">Est. Budget</span><span className="font-semibold text-[var(--ink)]">{inq.budget}</span></div>
              </div>

              <p className="text-xs text-[#24252c]/80 bg-white p-3 rounded-xl border border-[#24252c]/5 mb-4 italic">
                "{inq.message}"
              </p>

              <div className="flex justify-end">
                <button
                  onClick={() => {
                    setReplyInquiry(inq);
                    setReplyMessage(`Hi ${inq.name},\n\nThank you for reaching out regarding your ${inq.eventType} on ${inq.date}.\n\n`);
                  }}
                  className="bg-[var(--ink)] text-white text-xs font-semibold px-4 py-2 rounded-full hover:bg-[var(--ink-soft)] transition-colors cursor-pointer"
                >
                  Send Email Reply
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Send Email Reply Modal */}
      <ModalOverlay isOpen={!!replyInquiry} onClose={() => setReplyInquiry(null)}>
        <div className="bg-white rounded-[2.5rem] p-6 md:p-8 max-w-4xl w-full shadow-2xl border border-[#24252c]/10 relative">
          <button onClick={() => setReplyInquiry(null)} className="absolute top-6 right-6 text-[#24252c]/50 hover:text-[var(--ink)] p-1 cursor-pointer">
            <IconX className="w-6 h-6" />
          </button>
          <h3 className="text-2xl font-extrabold text-[var(--ink)] mb-1">Reply to Inquiry</h3>
          <p className="text-xs font-bold text-[#1090F8] mb-4">Recipient: {activeReplyInquiry.name} ({activeReplyInquiry.email})</p>

          <form onSubmit={handleSendReply} className="space-y-4 text-xs">
            <div>
              <label className="font-semibold uppercase text-[#24252c]/50 block mb-1.5 text-[11px]">Email Response Message</label>
              <textarea
                rows={10}
                value={replyMessage}
                onChange={(e) => setReplyMessage(e.target.value)}
                placeholder="Type your reply message here..."
                className="w-full rounded-2xl border border-black/10 px-5 py-4 bg-[#F8F9FA] focus:bg-white focus:outline-none focus:border-[#1090F8] transition-all text-sm font-medium leading-relaxed min-h-[260px] text-[var(--ink)]"
                required
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setReplyInquiry(null)}
                className="px-6 py-3 rounded-full border border-black/10 text-xs font-semibold text-[var(--ink)] hover:bg-[#F0F0F0] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-[var(--ink)] text-white font-semibold px-8 py-3.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors cursor-pointer text-xs shadow-lg"
              >
                Send Email & Mark as Replied
              </button>
            </div>
          </form>
        </div>
      </ModalOverlay>
    </div>
  );
}
