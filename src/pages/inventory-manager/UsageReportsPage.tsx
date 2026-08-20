import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import { IconTicket } from '../../components/shared/icons';

export default function UsageReportsPage({ go }: { go: (p: Page) => void }) {
  const usageStats = [
    { category: 'P3 LED Wall Display Panels', utilization: '95.2%', totalHours: '340 Hours', status: 'Highest Demand' },
    { category: 'Audio PA & Subwoofers', utilization: '88.4%', totalHours: '280 Hours', status: 'Consistent Usage' },
    { category: 'Moving Head Lighting Truss', utilization: '74.1%', totalHours: '210 Hours', status: 'Moderate Usage' },
    { category: 'Stage Smoke & Haze Units', utilization: '62.0%', totalHours: '150 Hours', status: 'Optimal Condition' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#24252c]/[0.06]">
        <div>
          <MonoBadge icon={IconTicket}>Analytics & Reports</MonoBadge>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ink)] mt-1.5">
            Equipment Usage & Wear Reports
          </h1>
          <p className="text-xs text-[#24252c]/60 mt-1">Track utilization rates, total operational hours, and maintenance cycles.</p>
        </div>

        <button
          onClick={() => alert('Exporting Usage Report PDF...')}
          className="bg-[var(--ink)] text-white text-xs font-semibold px-4 py-2.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors shadow-sm"
        >
          Export Report PDF
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {usageStats.map((item, i) => (
          <div key={i} className="p-6 rounded-2xl bg-white border border-[#24252c]/[0.08] shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-[#1090F8]">{item.status}</span>
              <span className="text-2xl font-extrabold text-[var(--ink)]">{item.utilization}</span>
            </div>

            <div>
              <h3 className="font-bold text-base text-[var(--ink)]">{item.category}</h3>
              <p className="text-xs text-[#24252c]/50 mt-0.5">Total Deployed: {item.totalHours} this quarter</p>
            </div>

            <div className="h-2.5 rounded-full bg-[var(--mist)] overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[var(--ink)] to-[#1090F8] rounded-full transition-all duration-500"
                style={{ width: item.utilization }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
