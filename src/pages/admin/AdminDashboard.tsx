import { useState, useEffect } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import {
  IconBox,
  IconTicket,
  IconShield,
  IconUser,
  IconCalendar,
  IconSearch,
  IconCheck,
  IconEnvelope,
  IconTruck,
  IconFileSpreadsheet,
} from '../../components/shared/icons';
import { supabase } from '../../utils/supabase';
import { formatDisplayDate, normalizeDateToIso } from '../../utils/bookingService';

interface DashboardStats {
  totalRevenue: number;
  depositsCollected: number;
  pendingBalances: number;
  confirmedEventsCount: number;
  upcomingEventsCount: number;
  pendingApprovalsCount: number;
  totalStaffCount: number;
  pendingInquiriesCount: number;
}

interface PendingBookingItem {
  id: string;
  dbId: string;
  customerName: string;
  customerPhone?: string;
  packageName: string;
  eventDate: string;
  depositAmount: number;
  totalCost: number;
  paymentChannel: string;
  createdAt: string;
}

interface UpcomingEventItem {
  id: string;
  customerName: string;
  packageName: string;
  eventDate: string;
  venueAddress: string;
  totalCost: number;
  isFullyPaid: boolean;
}

interface RecentActivityItem {
  id: string;
  action: string;
  module: string;
  userName: string;
  targetName: string;
  details: string;
  timestamp: string;
}

export default function AdminDashboard({ go }: { go: (p: Page) => void }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalRevenue: 0,
    depositsCollected: 0,
    pendingBalances: 0,
    confirmedEventsCount: 0,
    upcomingEventsCount: 0,
    pendingApprovalsCount: 0,
    totalStaffCount: 0,
    pendingInquiriesCount: 0,
  });

  const [pendingBookings, setPendingBookings] = useState<PendingBookingItem[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEventItem[]>([]);
  const [recentActivities, setRecentActivities] = useState<RecentActivityItem[]>([]);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboardData() {
      setLoading(true);
      try {
        const todayIso = new Date().toISOString().split('T')[0];

        // 1. Fetch Bookings
        const { data: bookingsData, error: bookingsError } = await supabase
          .from('bookings')
          .select('*')
          .order('created_at', { ascending: false });

        let totalRev = 0;
        let deposits = 0;
        let balances = 0;
        let confirmedCount = 0;
        let upcomingCount = 0;
        const pendingList: PendingBookingItem[] = [];
        const upcomingList: UpcomingEventItem[] = [];

        if (!bookingsError && bookingsData) {
          bookingsData.forEach((b: any) => {
            const total = Number(b.total_cost) || 0;
            const deposit = Number(b.deposit_amount) || 0;
            const status = (b.payment_status || b.status || 'pending').toLowerCase();
            const eventIso = normalizeDateToIso(b.event_date);
            const isFull = b.is_fully_paid === true;

            if (status !== 'cancelled') {
              totalRev += total;
              if (status === 'paid' || status === 'confirmed' || isFull) {
                deposits += isFull ? total : deposit;
                balances += isFull ? 0 : Math.max(0, total - deposit);
                confirmedCount += 1;

                if (eventIso && eventIso >= todayIso) {
                  upcomingCount += 1;
                  upcomingList.push({
                    id: b.paymongo_reference_number || `BNH-${b.id.slice(0, 8)}`,
                    customerName: b.customer_name || 'Valued Client',
                    packageName: b.package_name || 'Production Package',
                    eventDate: formatDisplayDate(b.event_date),
                    venueAddress: b.venue_address || 'Private Venue',
                    totalCost: total,
                    isFullyPaid: isFull,
                  });
                }
              }
            }

            if (status === 'pending') {
              pendingList.push({
                id: b.paymongo_reference_number || `BNH-${b.id.slice(0, 8)}`,
                dbId: b.id,
                customerName: b.customer_name || 'Customer',
                customerPhone: b.customer_phone || b.customer_email || '',
                packageName: b.package_name || 'Event Production Setup',
                eventDate: formatDisplayDate(b.event_date),
                depositAmount: deposit || Math.round(total * 0.5),
                totalCost: total,
                paymentChannel: b.payment_channel || 'PayMongo',
                createdAt: b.created_at || '',
              });
            }
          });
        }

        // 2. Fetch Profiles / Staff Count
        let staffCount = 0;
        try {
          const { count, error: profileErr } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true });
          if (!profileErr && count !== null) {
            staffCount = count;
          }
        } catch {
          staffCount = 0;
        }

        // 3. Fetch Pending Inquiries Count
        let inquiriesCount = 0;
        try {
          const { count, error: inqErr } = await supabase
            .from('inquiries')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'unread');
          if (!inqErr && count !== null) {
            inquiriesCount = count;
          }
        } catch {
          inquiriesCount = 0;
        }

        // 4. Fetch Recent Live Audit Activities
        const recentAudit: RecentActivityItem[] = [];
        try {
          const { data: auditData } = await supabase
            .from('audit_logs')
            .select('*')
            .order('timestamp', { ascending: false })
            .limit(5);

          if (auditData && auditData.length > 0) {
            auditData.forEach((a: any) => {
              recentAudit.push({
                id: a.id,
                action: (a.action || 'SYSTEM_ACTIVITY').replace(/_/g, ' '),
                module: a.module || 'system',
                userName: a.user_name || 'System Administrator',
                targetName: a.target_name || a.target_id || '',
                details: a.details || '',
                timestamp: a.timestamp || a.created_at || '',
              });
            });
          }
        } catch {
          // Ignore audit fallback
        }

        if (isMounted) {
          setStats({
            totalRevenue: totalRev,
            depositsCollected: deposits,
            pendingBalances: balances,
            confirmedEventsCount: confirmedCount,
            upcomingEventsCount: upcomingCount,
            pendingApprovalsCount: pendingList.length,
            totalStaffCount: staffCount,
            pendingInquiriesCount: inquiriesCount,
          });
          setPendingBookings(pendingList.slice(0, 5));
          setUpcomingEvents(upcomingList.slice(0, 4));
          setRecentActivities(recentAudit);
        }
      } catch (err) {
        console.error('Admin dashboard data fetch error:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadDashboardData();

    return () => {
      isMounted = false;
    };
  }, []);

  const formatRelativeTime = (isoString?: string): string => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      const diffMs = Date.now() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#24252c]/[0.06]">
        <div>
          <MonoBadge icon={IconShield}>System Management</MonoBadge>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ink)] mt-1.5">
            Admin System Overview
          </h1>
          <p className="text-xs text-[#24252c]/60 mt-1">
            Real-time executive control center: monitor confirmed events, pending client deposits, system receivables, and inventory operations.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            onClick={() => go('admin-reports')}
            className="px-4 py-2.5 rounded-full bg-white hover:bg-[var(--mist)] text-[var(--ink)] border border-[#24252c]/10 text-xs font-semibold transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
          >
            <IconFileSpreadsheet className="w-3.5 h-3.5 text-[#24252c]/60" />
            <span>Financial Ledger</span>
          </button>

          <button
            onClick={() => go('admin-bookings')}
            className="bg-[#1090F8] hover:bg-[#0c78d1] text-white text-xs font-bold px-5 py-2.5 rounded-full transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <span>Manage Bookings</span>
            <span>→</span>
          </button>
        </div>
      </div>

      {/* 4 Key Executive Performance Indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Gross Revenue */}
        <div className="bg-white rounded-2xl p-5 border border-[#24252c]/[0.08] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#24252c]/50 uppercase tracking-wider">Gross Booking Sales</span>
            <div className="p-2 rounded-xl bg-blue-50 text-[#1090F8]">
              <IconTicket className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-[var(--ink)]">
              {loading ? (
                <div className="h-7 w-28 bg-black/5 animate-pulse rounded" />
              ) : (
                `₱${stats.totalRevenue.toLocaleString()}`
              )}
            </div>
            <div className="text-[11px] text-[#24252c]/60 mt-1 flex items-center gap-1">
              <span>₱{stats.depositsCollected.toLocaleString()} deposits collected</span>
            </div>
          </div>
        </div>

        {/* Upcoming Confirmed Events */}
        <div className="bg-white rounded-2xl p-5 border border-[#24252c]/[0.08] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#24252c]/50 uppercase tracking-wider">Upcoming Events</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <IconCalendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-emerald-600">
              {loading ? (
                <div className="h-7 w-16 bg-black/5 animate-pulse rounded" />
              ) : (
                `${stats.upcomingEventsCount} Scheduled`
              )}
            </div>
            <div className="text-[11px] text-[#24252c]/60 mt-1">
              {stats.confirmedEventsCount} total confirmed bookings
            </div>
          </div>
        </div>

        {/* Pending Deposit Approvals */}
        <div className="bg-white rounded-2xl p-5 border border-[#24252c]/[0.08] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#24252c]/50 uppercase tracking-wider">Pending Approvals</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <IconShield className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-amber-600">
              {loading ? (
                <div className="h-7 w-16 bg-black/5 animate-pulse rounded" />
              ) : (
                `${stats.pendingApprovalsCount} Action Required`
              )}
            </div>
            <div className="text-[11px] text-[#24252c]/60 mt-1">
              Customer deposits awaiting review
            </div>
          </div>
        </div>

        {/* Staff & Crew In System */}
        <div className="bg-white rounded-2xl p-5 border border-[#24252c]/[0.08] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#24252c]/50 uppercase tracking-wider">Active Staff & Crew</span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <IconUser className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-black text-purple-600">
              {loading ? (
                <div className="h-7 w-16 bg-black/5 animate-pulse rounded" />
              ) : (
                `${stats.totalStaffCount} Registered`
              )}
            </div>
            <div className="text-[11px] text-[#24252c]/60 mt-1">
              Authorized operators & technicians
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Pending Approvals & Upcoming Production Events */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Pending Deposit Approvals */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-[#24252c]/[0.08] shadow-xs">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#24252c]/[0.06]">
              <div>
                <h2 className="font-extrabold text-base text-[var(--ink)] flex items-center gap-2">
                  <span>Pending Booking & Deposit Approvals</span>
                  {pendingBookings.length > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                      {pendingBookings.length}
                    </span>
                  )}
                </h2>
                <p className="text-xs text-[#24252c]/50 mt-0.5">
                  Live reservations requiring verification or payment confirmation.
                </p>
              </div>

              <button
                onClick={() => go('admin-bookings')}
                className="text-xs font-semibold text-[#1090F8] hover:underline cursor-pointer"
              >
                View All Bookings →
              </button>
            </div>

            {loading ? (
              <div className="space-y-3 py-4">
                <div className="h-16 bg-black/5 animate-pulse rounded-xl" />
                <div className="h-16 bg-black/5 animate-pulse rounded-xl" />
              </div>
            ) : pendingBookings.length === 0 ? (
              <div className="py-8 text-center bg-[var(--mist)] rounded-xl border border-[#24252c]/[0.04]">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-2 font-bold">
                  <IconCheck className="w-5 h-5" />
                </div>
                <h4 className="text-xs font-bold text-[var(--ink)]">All Bookings Up to Date</h4>
                <p className="text-[11px] text-[#24252c]/50 mt-0.5 max-w-sm mx-auto">
                  There are no pending deposit slips or unconfirmed bookings awaiting review.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingBookings.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-xl bg-[var(--mist)] border border-[#24252c]/[0.06] hover:border-[#1090F8]/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#1090F8]">{item.id}</span>
                        <span className="font-bold text-[var(--ink)]">{item.customerName}</span>
                        <span className="text-[10px] px-2 py-0.2 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-semibold">
                          Awaiting Review
                        </span>
                      </div>
                      <div className="text-[#24252c]/65 text-[11px]">
                        {item.packageName} · Event Date: <strong className="text-[var(--ink)]">{item.eventDate}</strong>
                      </div>
                      <div className="text-[10px] text-[#24252c]/50">
                        Via {item.paymentChannel} · Received {formatRelativeTime(item.createdAt)}
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#24252c]/[0.06]">
                      <div className="text-right">
                        <div className="text-[10px] text-[#24252c]/50 uppercase font-semibold">Deposit Due</div>
                        <div className="font-extrabold text-sm text-[var(--ink)]">
                          ₱{item.depositAmount.toLocaleString()}
                        </div>
                      </div>
                      <button
                        onClick={() => go('admin-bookings')}
                        className="bg-[var(--ink)] hover:bg-[var(--ink-soft)] text-white text-xs font-semibold px-4 py-2 rounded-full transition-colors cursor-pointer shrink-0"
                      >
                        Review
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Management Directories Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={() => go('admin-packages')}
              className="p-4 rounded-2xl bg-white border border-[#24252c]/[0.08] hover:border-[#1090F8]/40 transition-all text-left group shadow-2xs cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold text-[#1090F8] uppercase tracking-wider">Catalog</span>
                <IconBox className="w-4 h-4 text-[#1090F8]" />
              </div>
              <h3 className="font-bold text-sm text-[var(--ink)] mt-1.5 group-hover:text-[#1090F8] transition-colors">
                Package Builder →
              </h3>
              <p className="text-[11px] text-[#24252c]/55 mt-1">Configure gear packages, audio rigs & pricing rates.</p>
            </button>

            <button
              onClick={() => go('admin-transport')}
              className="p-4 rounded-2xl bg-white border border-[#24252c]/[0.08] hover:border-amber-500/40 transition-all text-left group shadow-2xs cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold text-amber-600 uppercase tracking-wider">Logistics</span>
                <IconTruck className="w-4 h-4 text-amber-600" />
              </div>
              <h3 className="font-bold text-sm text-[var(--ink)] mt-1.5 group-hover:text-amber-600 transition-colors">
                Transport Rules →
              </h3>
              <p className="text-[11px] text-[#24252c]/55 mt-1">Set regional delivery coverage & venue logistics fees.</p>
            </button>

            <button
              onClick={() => go('admin-inquiries')}
              className="p-4 rounded-2xl bg-white border border-[#24252c]/[0.08] hover:border-purple-500/40 transition-all text-left group shadow-2xs cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold text-purple-600 uppercase tracking-wider">Inquiries</span>
                <IconEnvelope className="w-4 h-4 text-purple-600" />
              </div>
              <h3 className="font-bold text-sm text-[var(--ink)] mt-1.5 group-hover:text-purple-600 transition-colors">
                Inquiry Inbox →
              </h3>
              <p className="text-[11px] text-[#24252c]/55 mt-1">Respond to custom event inquiries and quotation leads.</p>
            </button>
          </div>
        </div>

        {/* Right Column (1 Col): Upcoming Schedule & Live Activity Feed */}
        <div className="space-y-6">
          {/* Upcoming Production Schedule */}
          <div className="bg-white rounded-2xl p-5 border border-[#24252c]/[0.08] shadow-xs">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#24252c]/[0.06]">
              <h3 className="font-extrabold text-sm text-[var(--ink)] flex items-center gap-1.5">
                <IconCalendar className="w-4 h-4 text-emerald-600" />
                <span>Next Confirmed Events</span>
              </h3>
              <button
                onClick={() => go('admin-calendar')}
                className="text-[11px] font-semibold text-[#1090F8] hover:underline cursor-pointer"
              >
                Calendar →
              </button>
            </div>

            {upcomingEvents.length === 0 ? (
              <div className="py-6 text-center text-xs text-[#24252c]/50">
                No upcoming confirmed events scheduled.
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingEvents.map((ev) => (
                  <div key={ev.id} className="p-3 rounded-xl bg-[var(--mist)] border border-[#24252c]/[0.06] text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[var(--ink)]">{ev.customerName}</span>
                      <span className="font-mono font-bold text-[#1090F8] text-[11px]">{ev.eventDate}</span>
                    </div>
                    <div className="text-[11px] text-[#24252c]/65 truncate">{ev.packageName}</div>
                    <div className="text-[10px] text-[#24252c]/45 truncate">{ev.venueAddress}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Live Activity Stream */}
          <div className="bg-white rounded-2xl p-5 border border-[#24252c]/[0.08] shadow-xs">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#24252c]/[0.06]">
              <h3 className="font-extrabold text-sm text-[var(--ink)] flex items-center gap-1.5">
                <IconShield className="w-4 h-4 text-[#1090F8]" />
                <span>Recent System Activity</span>
              </h3>
              <button
                onClick={() => go('admin-audit-logs')}
                className="text-[11px] font-semibold text-[#1090F8] hover:underline cursor-pointer"
              >
                Audit Trail →
              </button>
            </div>

            {recentActivities.length === 0 ? (
              <div className="py-6 text-center text-xs text-[#24252c]/50">
                System operations are logged securely.
              </div>
            ) : (
              <div className="space-y-3">
                {recentActivities.map((act) => (
                  <div key={act.id} className="text-xs pb-2.5 border-b border-[#24252c]/[0.04] last:border-0 last:pb-0 space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[var(--ink)] text-[11px]">{act.action}</span>
                      <span className="text-[10px] text-[#24252c]/45 font-mono">
                        {formatRelativeTime(act.timestamp)}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#24252c]/65 line-clamp-1">{act.details}</div>
                    <div className="text-[10px] text-[#24252c]/40 font-mono">by {act.userName}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
