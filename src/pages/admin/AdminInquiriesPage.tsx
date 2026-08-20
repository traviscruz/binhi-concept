import { useState } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import { IconMail, IconX } from '../../components/shared/icons';

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

export default function AdminInquiriesPage({ go }: { go: (p: Page) => void }) {
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
        {inquiries.map((item) => (
          <div key={item.id} className="p-6 rounded-2xl bg-white border border-[#24252c]/[0.08] shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold text-base text-[var(--ink)]">{item.name}</span>
                <span className="text-xs text-[#24252c]/50">({item.email})</span>
              </div>
              <span
                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                  item.status === 'New' ? 'bg-[#1090F8] text-white' : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                }`}
              >
                {item.status}
              </span>
            </div>

            <div className="text-xs text-[#1090F8] font-bold">
              {item.eventType} · Date: {item.date} · Budget: {item.budget}
            </div>

            <p className="text-xs text-[#24252c]/70 leading-relaxed bg-[var(--mist)] p-3 rounded-xl border border-[#24252c]/[0.06]">
              "{item.message}"
            </p>

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => {
                  setReplyInquiry(item);
                  setReplyMessage(`Hi ${item.name},\n\nThank you for reaching out to BINHI Production! Regarding your inquiry for ${item.eventType} on ${item.date}...`);
                }}
                className="bg-[var(--ink)] text-white text-xs font-semibold px-4 py-2 rounded-full hover:bg-[var(--ink-soft)] transition-colors"
              >
                Send Email Reply
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Send Email Reply Modal */}
      {replyInquiry && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-blur-in">
          <div className="bg-white rounded-[2rem] p-6 max-w-md w-full shadow-2xl border border-[#24252c]/10 relative">
            <button onClick={() => setReplyInquiry(null)} className="absolute top-5 right-5 text-[#24252c]/50 hover:text-[var(--ink)] p-1">
              <IconX className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-extrabold text-[var(--ink)] mb-1">Reply to Inquiry</h3>
            <p className="text-xs font-bold text-[#1090F8] mb-4">Recipient: {replyInquiry.name} ({replyInquiry.email})</p>

            <form onSubmit={handleSendReply} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">Email Response Message</label>
                <textarea
                  rows={5}
                  value={replyMessage}
                  onChange={(e) => setReplyMessage(e.target.value)}
                  className="w-full rounded-2xl border px-4 py-2.5 bg-[#EEEEEE] focus:outline-none focus:border-[#1090F8] border-transparent transition-colors"
                  required
                />
              </div>

              <button type="submit" className="w-full bg-[var(--ink)] text-white font-semibold py-3.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors">
                Send Email & Mark as Replied
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
