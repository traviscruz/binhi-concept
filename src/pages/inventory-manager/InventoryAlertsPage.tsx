import { useState } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import { IconShield } from '../../components/shared/icons';

export default function InventoryAlertsPage({ go }: { go: (p: Page) => void }) {
  const [alerts, setAlerts] = useState([
    { id: 'alt-1', type: 'Maintenance Due', gear: 'P3 HD Indoor LED Wall Panel', details: '100 operating hours reached. Optical tile recalibration & DMX test required.', severity: 'High', date: 'Aug 19, 2026' },
    { id: 'alt-2', type: 'Low Available Stock', gear: 'UHF Wireless Microphones', details: 'Only 2 unassigned mic pairs remaining for the upcoming weekend of Sep 14.', severity: 'Medium', date: 'Aug 20, 2026' },
    { id: 'alt-3', type: 'Repair Log Needed', gear: 'Moving Head Beam Fixture #08', details: 'Pan motor mechanism lagging slightly during fast strobe sequences.', severity: 'High', date: 'Aug 18, 2026' },
  ]);

  const resolveAlert = (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#24252c]/[0.06]">
        <div>
          <MonoBadge icon={IconShield}>Action Required ({alerts.length})</MonoBadge>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ink)] mt-1.5">
            Maintenance & Low Stock Alerts
          </h1>
          <p className="text-xs text-[#24252c]/60 mt-1">Review equipment warnings, bench repair logs, and low availability threshold alerts.</p>
        </div>

        <button
          onClick={() => go('inventory-dashboard')}
          className="bg-[var(--mist)] text-[var(--ink)] border border-[#24252c]/10 text-xs font-bold px-4 py-2.5 rounded-full hover:bg-[var(--ink)] hover:text-white transition-colors"
        >
          Back to Overview
        </button>
      </div>

      {alerts.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-[#24252c]/[0.08] shadow-sm">
          <span className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 font-bold text-xl flex items-center justify-center mx-auto mb-3">
            ✓
          </span>
          <h3 className="font-bold text-base text-[var(--ink)]">All Alerts Resolved</h3>
          <p className="text-xs text-[#24252c]/50 mt-1">All equipment units are fully operational and ready for event deployment.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {alerts.map((item) => (
            <div
              key={item.id}
              className="p-6 rounded-2xl bg-white border border-[#24252c]/[0.08] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-amber-500/40 transition-all"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                      item.severity === 'High'
                        ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                        : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                    }`}
                  >
                    ● {item.severity} Priority
                  </span>
                  <span className="text-xs font-semibold text-[#1090F8]">{item.type}</span>
                  <span className="text-[11px] text-[#24252c]/40">• {item.date}</span>
                </div>
                <h3 className="font-bold text-lg text-[var(--ink)] mt-2">{item.gear}</h3>
                <p className="text-xs text-[#24252c]/60 mt-1 leading-relaxed">{item.details}</p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => resolveAlert(item.id)}
                  className="bg-[#1090F8] text-white text-xs font-semibold px-4 py-2.5 rounded-full hover:bg-[#1090F8]/90 transition-colors shadow-sm"
                >
                  Mark as Resolved
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
