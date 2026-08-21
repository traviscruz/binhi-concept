import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import { IconBox, IconTicket, IconShield, IconUser, IconArrow } from '../../components/shared/icons';

export default function AdminDashboard({ go }: { go: (p: Page) => void }) {
  const kpis = [
    { label: 'Q3 Total Booking Revenue', value: '₱485,000', change: '+24% vs Q2', icon: <IconTicket className="w-5 h-5 text-[#1090F8]" /> },
    { label: 'Confirmed Events Scheduled', value: '14 Events', change: 'Fully staffed & rigged', icon: <IconBox className="w-5 h-5 text-emerald-500" /> },
    { label: 'Pending GCash Slips', value: '2 Pending', change: 'Requires approval', icon: <IconShield className="w-5 h-5 text-amber-500" /> },
    { label: 'Active Crew & Staff', value: '8 Team Members', change: 'On active rotation', icon: <IconUser className="w-5 h-5 text-purple-500" /> },
  ];

  const pendingApprovals = [
    { id: 'BNH-2026-889', customer: 'Juan Dela Cruz', package: 'Standard Production Setup', date: 'September 14, 2026', deposit: '₱16,750', slip: 'GCash Ref #889123' },
    { id: 'BNH-2026-502', customer: 'Maria Santos', package: 'Grand Stage & Concert Package', date: 'November 12, 2026', deposit: '₱32,500', slip: 'BDO Ref #441092' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#24252c]/[0.06]">
        <div>
          <MonoBadge icon={IconShield}>Admin Control</MonoBadge>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ink)] mt-1.5">
            Admin System Overview
          </h1>
          <p className="text-xs text-[#24252c]/60 mt-1">
            Manage bookings, approve deposit receipts, configure pricing rules, and assign technical staff.
          </p>
        </div>

        <button
          onClick={() => go('admin-bookings')}
          className="bg-[#1090F8] text-white text-xs font-bold px-5 py-2.5 rounded-full hover:bg-[#1090F8]/90 transition-colors shadow-sm self-start sm:self-auto"
        >
          Manage Bookings →
        </button>
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

      {/* Quick Nav Shortcuts */}
      <div className="grid sm:grid-cols-3 gap-4">
        <button
          onClick={() => go('admin-bookings')}
          className="p-5 rounded-2xl bg-white border border-[#24252c]/[0.08] hover:border-[#1090F8]/50 transition-all text-left group shadow-sm"
        >
          <span className="text-xs font-bold text-[#1090F8] uppercase tracking-wider">Bookings & Receipts</span>
          <h3 className="font-bold text-base text-[var(--ink)] mt-1 group-hover:text-[#1090F8] transition-colors">Approve Deposits →</h3>
          <p className="text-xs text-[#24252c]/60 mt-1">Review GCash & Bank transfer deposit uploads.</p>
        </button>

        <button
          onClick={() => go('admin-packages')}
          className="p-5 rounded-2xl bg-white border border-[#24252c]/[0.08] hover:border-emerald-600/50 transition-all text-left group shadow-sm"
        >
          <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Catalog & Pricing</span>
          <h3 className="font-bold text-base text-[var(--ink)] mt-1 group-hover:text-emerald-600 transition-colors">Package Builder →</h3>
          <p className="text-xs text-[#24252c]/60 mt-1">Map inventory gear to signature packages & rates.</p>
        </button>

        <button
          onClick={() => go('admin-transport')}
          className="p-5 rounded-2xl bg-white border border-[#24252c]/[0.08] hover:border-amber-500/50 transition-all text-left group shadow-sm"
        >
          <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">Coverage Rules</span>
          <h3 className="font-bold text-base text-[var(--ink)] mt-1 group-hover:text-amber-600 transition-colors">Transport Fee Rules →</h3>
          <p className="text-xs text-[#24252c]/60 mt-1">Edit regional logistics & venue transport fees.</p>
        </button>
      </div>

      {/* Pending Deposit Approvals Section */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-[#24252c]/[0.08] shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-base text-[var(--ink)]">Pending Deposit Approvals</h3>
            <p className="text-xs text-[#24252c]/50">Customer deposit slips awaiting verification.</p>
          </div>
          <button onClick={() => go('admin-bookings')} className="text-xs font-semibold text-[#1090F8] hover:underline">
            View All Bookings →
          </button>
        </div>

        <div className="space-y-3">
          {pendingApprovals.map((item) => (
            <div key={item.id} className="p-4 rounded-xl bg-[var(--mist)] border border-[#24252c]/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-[#1090F8]">{item.id}</span>
                  <span className="font-bold text-[var(--ink)]">{item.customer}</span>
                </div>
                <div className="text-[#24252c]/60 mt-0.5">{item.package} · Event Date: <strong className="text-[var(--ink)]">{item.date}</strong></div>
                <div className="text-[11px] text-amber-600 font-medium mt-0.5">{item.slip}</div>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-[var(--ink)] mr-2">{item.deposit}</span>
                <button
                  onClick={() => go('admin-bookings')}
                  className="bg-[var(--ink)] text-white text-xs font-semibold px-4 py-2 rounded-full hover:bg-[var(--ink-soft)] transition-colors"
                >
                  Review & Approve
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
