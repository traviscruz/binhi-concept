import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import { IconBox, IconTicket, IconShield, IconArrow } from '../../components/shared/icons';

export default function InventoryDashboard({ go }: { go: (p: Page) => void }) {
  const kpis = [
    { label: 'Total Tracked Gear Units', value: '142 Units', change: '+12 this month', icon: <IconBox className="w-5 h-5 text-[#1090F8]" /> },
    { label: 'Currently Deployed Units', value: '86 Units', change: 'On active events', icon: <IconTicket className="w-5 h-5 text-emerald-500" /> },
    { label: 'Maintenance & Repair Alerts', value: '3 Action Items', change: 'Requires attention', icon: <IconShield className="w-5 h-5 text-amber-500" /> },
    { label: 'Warehouse Utilization', value: '78.4%', change: 'High demand season', icon: <IconArrow className="w-5 h-5 text-purple-500" /> },
  ];

  const recentMovements = [
    { unitId: 'LED-P3-004', name: 'P3 HD Indoor LED Wall Panel', booking: 'BNH-2026-889', destination: 'Shangri-La Fort BGC', status: 'Dispatched', time: '10 mins ago' },
    { unitId: 'SUB-D15-002', name: 'Dual 15-inch Subwoofer', booking: 'BNH-2026-889', destination: 'Shangri-La Fort BGC', status: 'Dispatched', time: '25 mins ago' },
    { unitId: 'MIC-UHF-001', name: 'UHF Wireless Microphones Set', booking: 'BNH-2026-502', destination: 'Warehouse Rigging', status: 'Returned & Tested', time: '2 hours ago' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#24252c]/[0.06]">
        <div>
          <MonoBadge icon={IconBox}>Warehouse Control</MonoBadge>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ink)] mt-1.5">
            Inventory Overview
          </h1>
          <p className="text-xs text-[#24252c]/60 mt-1">Live status of sound, lighting, and stage video equipment.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => go('inventory-items')}
            className="bg-[#1090F8] text-white text-xs font-bold px-4 py-2.5 rounded-full hover:bg-[#1090F8]/90 transition-colors shadow-sm"
          >
            + Add New Gear Unit
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <div key={i} className="bg-white rounded-2xl p-5 border border-[#24252c]/[0.08] shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#24252c]/50">{kpi.label}</span>
              <div className="p-2 rounded-xl bg-[var(--mist)]">{kpi.icon}</div>
            </div>
            <div className="mt-4">
              <div className="text-2xl font-extrabold text-[var(--ink)]">{kpi.value}</div>
              <div className="text-[11px] font-medium text-[#1090F8] mt-1">{kpi.change}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid sm:grid-cols-3 gap-4">
        <button
          onClick={() => go('inventory-items')}
          className="p-5 rounded-2xl bg-white border border-[#24252c]/[0.08] hover:border-[#1090F8]/50 transition-all text-left group shadow-sm"
        >
          <span className="text-xs font-bold text-[#1090F8] uppercase tracking-wider">Equipment CRUD</span>
          <h3 className="font-bold text-base text-[var(--ink)] mt-1 group-hover:text-[#1090F8] transition-colors">Manage Gear Catalog →</h3>
          <p className="text-xs text-[#24252c]/60 mt-1">Add, edit condition status, or update specs.</p>
        </button>

        <button
          onClick={() => go('inventory-units')}
          className="p-5 rounded-2xl bg-white border border-[#24252c]/[0.08] hover:border-[#1090F8]/50 transition-all text-left group shadow-sm"
        >
          <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Physical Serial Locks</span>
          <h3 className="font-bold text-base text-[var(--ink)] mt-1 group-hover:text-emerald-600 transition-colors">Unit Assignments →</h3>
          <p className="text-xs text-[#24252c]/60 mt-1">Bind specific serial numbers to active event bookings.</p>
        </button>

        <button
          onClick={() => go('inventory-alerts')}
          className="p-5 rounded-2xl bg-white border border-[#24252c]/[0.08] hover:border-amber-500/50 transition-all text-left group shadow-sm"
        >
          <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">Action Items (3)</span>
          <h3 className="font-bold text-base text-[var(--ink)] mt-1 group-hover:text-amber-600 transition-colors">Maintenance Alerts →</h3>
          <p className="text-xs text-[#24252c]/60 mt-1">Review low stock warnings and calibration logs.</p>
        </button>
      </div>

      {/* Recent Dispatches Table */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-[#24252c]/[0.08] shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-base text-[var(--ink)]">Recent Dispatch & Logistics Activity</h3>
          <button onClick={() => go('inventory-units')} className="text-xs font-semibold text-[#1090F8] hover:underline">
            View All Assignments →
          </button>
        </div>

        {/* Desktop Table View */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#24252c]/[0.06] text-[#24252c]/50 uppercase tracking-wider">
                <th className="py-3 px-3 font-semibold">Unit Serial</th>
                <th className="py-3 px-3 font-semibold">Equipment Name</th>
                <th className="py-3 px-3 font-semibold">Booking Ref</th>
                <th className="py-3 px-3 font-semibold">Destination Venue</th>
                <th className="py-3 px-3 font-semibold">Status</th>
                <th className="py-3 px-3 font-semibold text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#24252c]/[0.04]">
              {recentMovements.map((row, i) => (
                <tr key={i} className="hover:bg-[var(--mist)] transition-colors">
                  <td className="py-3 px-3 font-mono font-bold text-[#1090F8]">{row.unitId}</td>
                  <td className="py-3 px-3 font-semibold text-[var(--ink)]">{row.name}</td>
                  <td className="py-3 px-3 font-mono text-[#24252c]/70">{row.booking}</td>
                  <td className="py-3 px-3 text-[#24252c]/70">{row.destination}</td>
                  <td className="py-3 px-3">
                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                        row.status === 'Dispatched'
                          ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right text-[#24252c]/50">{row.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Row Cards View */}
        <div className="block sm:hidden space-y-3">
          {recentMovements.map((row, i) => (
            <div key={i} className="p-4 rounded-xl bg-[var(--mist)] border border-[#24252c]/[0.06] space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-mono font-extrabold text-[#1090F8]">{row.unitId}</span>
                <span
                  className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                    row.status === 'Dispatched'
                      ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                      : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                  }`}
                >
                  {row.status}
                </span>
              </div>
              <div className="font-bold text-[var(--ink)]">{row.name}</div>
              <div className="text-[11px] text-[#24252c]/70 flex items-center justify-between">
                <span>Ref: <strong className="font-mono text-[var(--ink)]">{row.booking}</strong></span>
                <span className="text-[#24252c]/40">{row.time}</span>
              </div>
              <div className="text-[11px] text-[#24252c]/60">{row.destination}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
