import { useState } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import { IconTicket, IconX } from '../../components/shared/icons';

export default function AdminReportsPage({ go }: { go: (p: Page) => void }) {
  const [showPdfModal, setShowPdfModal] = useState(false);

  const analytics = [
    { title: 'Booking Conversion Rate', value: '89.2%', sub: 'High customer satisfaction & instant check' },
    { title: 'Average Order Value (AOV)', value: '₱34,642', sub: 'Driven by LED wall & hazing add-ons' },
    { title: 'Top Selected Add-on', value: 'Low Fog Hazer', sub: 'Chosen in 74% of wedding bookings' },
    { title: 'Repeat Host Loyalty Rate', value: '41.5%', sub: 'Hosts claiming VIP Gold rewards' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#24252c]/[0.06]">
        <div>
          <MonoBadge icon={IconTicket}>Revenue & System Analytics</MonoBadge>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ink)] mt-1.5">
            System Revenue & Financial Reports
          </h1>
          <p className="text-xs text-[#24252c]/60 mt-1">
            Financial analytics, package profitability, and booking conversion benchmarks.
          </p>
        </div>

        <button
          onClick={() => setShowPdfModal(true)}
          className="bg-[var(--ink)] text-white text-xs font-bold px-5 py-2.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors shadow-sm self-start sm:self-auto"
        >
          Export System Report PDF
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {analytics.map((item, i) => (
          <div key={i} className="p-6 rounded-2xl bg-white border border-[#24252c]/[0.08] shadow-sm space-y-2">
            <span className="text-xs font-semibold text-[#24252c]/50">{item.title}</span>
            <div className="text-3xl font-extrabold text-[#1090F8]">{item.value}</div>
            <p className="text-xs text-[#24252c]/60">{item.sub}</p>
          </div>
        ))}
      </div>

      {showPdfModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-blur-in">
          <div className="bg-white rounded-[2rem] p-6 max-w-sm w-full shadow-2xl border border-[#24252c]/10 relative text-center">
            <button onClick={() => setShowPdfModal(false)} className="absolute top-5 right-5 text-[#24252c]/50 hover:text-[var(--ink)] p-1">
              <IconX className="w-5 h-5" />
            </button>
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 font-extrabold text-xl flex items-center justify-center mx-auto mb-3 border border-emerald-200">
              ✓
            </div>
            <h3 className="text-lg font-extrabold text-[var(--ink)] mb-1">Financial PDF Exported</h3>
            <p className="text-xs text-[#24252c]/60 mb-5">
              Q3 System Financial Analytics Report PDF has been compiled and downloaded to your device.
            </p>
            <button
              onClick={() => setShowPdfModal(false)}
              className="w-full bg-[var(--ink)] text-white font-semibold py-3 rounded-full hover:bg-[var(--ink-soft)] transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
