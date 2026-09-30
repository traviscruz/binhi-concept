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
  IconAlertTriangle,
  IconInfo,
  IconX,
} from '../../components/shared/icons';
import { ModalOverlay } from '../../components/shared/ModalOverlay';
import { supabase } from '../../utils/supabase';
import { formatDisplayDate, normalizeDateToIso } from '../../utils/bookingService';
import {
  runSystemHealthDiagnostics,
  resolveSystemError,
  clearResolvedErrors,
  retryFailedEmail,
  type ServiceHealthItem,
  type SystemErrorLog,
  type HealthStatus,
} from '../../utils/systemHealthService';

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

  // System Health & Diagnostics State
  const [healthServices, setHealthServices] = useState<ServiceHealthItem[]>([]);
  const [errorLogs, setErrorLogs] = useState<SystemErrorLog[]>([]);
  const [overallHealth, setOverallHealth] = useState<HealthStatus>('operational');
  const [lastDiagnosticsRun, setLastDiagnosticsRun] = useState<string>('');
  const [runningDiagnostics, setRunningDiagnostics] = useState<boolean>(false);
  const [selectedErrorForModal, setSelectedErrorForModal] = useState<SystemErrorLog | null>(null);
  const [errorFilter, setErrorFilter] = useState<'all' | 'payment_webhook' | 'database' | 'email_sms'>('all');
  const [retryingErrorId, setRetryingErrorId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const loadHealthData = async () => {
    setRunningDiagnostics(true);
    try {
      const diag = await runSystemHealthDiagnostics();
      setHealthServices(diag.services);
      setErrorLogs(diag.errorLogs);
      setOverallHealth(diag.overallHealth);
      setLastDiagnosticsRun(diag.testedAt);
    } catch (err) {
      console.warn('Diagnostics error:', err);
    } finally {
      setRunningDiagnostics(false);
    }
  };

  const handleResolveLog = (id: string) => {
    resolveSystemError(id);
    setErrorLogs((prev) =>
      prev.map((e) => (e.id === id ? { ...e, status: 'resolved', resolvedAt: new Date().toISOString() } : e))
    );
    setActionFeedback({ text: 'Error marked as resolved.', type: 'success' });
    setTimeout(() => setActionFeedback(null), 3500);
  };

  const handleClearResolvedLogs = () => {
    clearResolvedErrors();
    setErrorLogs((prev) => prev.filter((e) => e.status !== 'resolved'));
    setActionFeedback({ text: 'Cleared resolved error items from panel.', type: 'success' });
    setTimeout(() => setActionFeedback(null), 3500);
  };

  const handleRetryDispatch = async (errorLog: SystemErrorLog) => {
    setRetryingErrorId(errorLog.id);
    try {
      const res = await retryFailedEmail(errorLog);
      if (res.success) {
        setActionFeedback({ text: res.message, type: 'success' });
        setErrorLogs((prev) =>
          prev.map((e) => (e.id === errorLog.id ? { ...e, status: 'resolved', resolvedAt: new Date().toISOString() } : e))
        );
      } else {
        setActionFeedback({ text: res.message, type: 'error' });
      }
    } catch (err: any) {
      setActionFeedback({ text: err.message || 'Retry failed', type: 'error' });
    } finally {
      setRetryingErrorId(null);
      setTimeout(() => setActionFeedback(null), 4000);
    }
  };

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
    loadHealthData();

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

  const filteredErrors = errorLogs.filter((item) => {
    if (errorFilter === 'all') return true;
    return item.service === errorFilter;
  });

  const activeErrorsCount = errorLogs.filter((e) => e.status === 'active').length;

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
            onClick={() => go('inventory-maintenance-reports')}
            className="px-4 py-2.5 rounded-full bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
          >
            <IconShield className="w-3.5 h-3.5 text-amber-700" />
            <span>Maintenance Reports</span>
          </button>

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

      {/* Action Toast Alert */}
      {actionFeedback && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center justify-between shadow-sm animate-fade-in ${
            actionFeedback.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <IconCheck className="w-4 h-4 text-emerald-600" />
            <span className="font-semibold">{actionFeedback.text}</span>
          </div>
          <button onClick={() => setActionFeedback(null)} className="opacity-70 hover:opacity-100">
            <IconX className="w-4 h-4" />
          </button>
        </div>
      )}

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

      {/* ── 🛡️ SYSTEM HEALTH, DIAGNOSTICS & ERROR LOGS PANEL ── */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-[#24252c]/[0.08] shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#24252c]/[0.06]">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-[#1090F8] border border-blue-200">
                System Health & Error Diagnostics
              </span>
              <span
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 ${
                  overallHealth === 'operational'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : overallHealth === 'degraded'
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    overallHealth === 'operational'
                      ? 'bg-emerald-500'
                      : overallHealth === 'degraded'
                      ? 'bg-amber-500'
                      : 'bg-rose-500 animate-ping'
                  }`}
                />
                <span>
                  {overallHealth === 'operational'
                    ? 'All Services Operational'
                    : overallHealth === 'degraded'
                    ? 'Attention Required'
                    : 'Service Interruption'}
                </span>
              </span>
            </div>
            <h2 className="text-lg font-extrabold text-[var(--ink)] mt-1.5">
              Service Health, Webhooks & Error Logs
            </h2>
            <p className="text-xs text-[#24252c]/60 mt-0.5">
              Real-time monitor for failed payment webhooks, database connection latency, and unsent customer emails/SMS.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadHealthData}
              disabled={runningDiagnostics}
              className="flex items-center gap-1.5 bg-[var(--ink)] hover:bg-[var(--ink-soft)] text-white text-xs font-semibold px-4 py-2 rounded-full transition-colors cursor-pointer disabled:opacity-50 shadow-xs"
            >
              <span className={runningDiagnostics ? 'animate-spin' : ''}>↻</span>
              <span>{runningDiagnostics ? 'Testing Endpoints...' : 'Run Diagnostics'}</span>
            </button>
          </div>
        </div>

        {/* Service Endpoint Status Badges Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {healthServices.map((svc) => {
            let badgeBg = 'bg-emerald-50 text-emerald-700 border-emerald-200';
            let dotBg = 'bg-emerald-500';
            if (svc.status === 'degraded') {
              badgeBg = 'bg-amber-50 text-amber-700 border-amber-200';
              dotBg = 'bg-amber-500';
            } else if (svc.status === 'outage') {
              badgeBg = 'bg-rose-50 text-rose-700 border-rose-200';
              dotBg = 'bg-rose-500';
            }

            return (
              <div
                key={svc.id}
                className="p-4 rounded-xl bg-[var(--mist)]/70 border border-[#24252c]/[0.06] space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[var(--ink)] truncate">{svc.name}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeBg} flex items-center gap-1 shrink-0`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${dotBg}`} />
                    <span className="capitalize">{svc.status}</span>
                  </span>
                </div>
                <p className="text-[11px] text-[#24252c]/65 line-clamp-2">{svc.details}</p>
                <div className="flex items-center justify-between text-[10px] text-[#24252c]/45 pt-1 border-t border-[#24252c]/[0.04]">
                  <span>{svc.latencyMs ? `Latency: ${svc.latencyMs}ms` : 'Status Active'}</span>
                  {svc.errorCount > 0 && (
                    <span className="font-bold text-rose-600">{svc.errorCount} Issue(s)</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Error Queue Filters & Control Bar */}
        <div className="pt-2 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-sm text-[var(--ink)]">
                Troubleshooting & Error Log Queue
              </h3>
              {activeErrorsCount > 0 ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                  {activeErrorsCount} Active
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  0 Active Errors
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs">
              {/* Category Filter Tabs */}
              <div className="flex rounded-lg bg-[var(--mist)] p-0.5 border border-[#24252c]/10 text-[11px]">
                <button
                  onClick={() => setErrorFilter('all')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                    errorFilter === 'all' ? 'bg-white text-[var(--ink)] shadow-2xs font-bold' : 'text-[#24252c]/60'
                  }`}
                >
                  All Logs ({errorLogs.length})
                </button>
                <button
                  onClick={() => setErrorFilter('payment_webhook')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                    errorFilter === 'payment_webhook' ? 'bg-white text-[var(--ink)] shadow-2xs font-bold' : 'text-[#24252c]/60'
                  }`}
                >
                  Webhooks
                </button>
                <button
                  onClick={() => setErrorFilter('database')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                    errorFilter === 'database' ? 'bg-white text-[var(--ink)] shadow-2xs font-bold' : 'text-[#24252c]/60'
                  }`}
                >
                  Database
                </button>
                <button
                  onClick={() => setErrorFilter('email_sms')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                    errorFilter === 'email_sms' ? 'bg-white text-[var(--ink)] shadow-2xs font-bold' : 'text-[#24252c]/60'
                  }`}
                >
                  Emails & SMS
                </button>
              </div>

              {errorLogs.some((e) => e.status === 'resolved') && (
                <button
                  onClick={handleClearResolvedLogs}
                  className="text-[11px] text-[#24252c]/50 hover:text-rose-600 font-semibold cursor-pointer underline"
                >
                  Clear Resolved
                </button>
              )}
            </div>
          </div>

          {/* Error Item List */}
          {filteredErrors.length === 0 ? (
            <div className="p-8 text-center bg-emerald-50/40 rounded-xl border border-dashed border-emerald-200 space-y-1">
              <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-2 font-bold">
                ✓
              </div>
              <h4 className="text-xs font-bold text-emerald-900">Zero System Errors Recorded</h4>
              <p className="text-[11px] text-emerald-700/80 max-w-sm mx-auto">
                Payment webhooks, Supabase queries, and automated email/SMS dispatches are functioning normally without unhandled failures.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredErrors.map((err) => {
                let sevBadge = 'bg-blue-50 text-blue-700 border-blue-200';
                if (err.severity === 'critical' || err.severity === 'high') {
                  sevBadge = 'bg-rose-50 text-rose-700 border-rose-200';
                } else if (err.severity === 'medium') {
                  sevBadge = 'bg-amber-50 text-amber-700 border-amber-200';
                }

                const isResolved = err.status === 'resolved';

                return (
                  <div
                    key={err.id}
                    className={`p-4 rounded-xl border transition-all text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isResolved
                        ? 'bg-white/60 border-[#24252c]/[0.04] opacity-60'
                        : 'bg-white border-[#24252c]/[0.08] shadow-2xs hover:border-[#1090F8]/30'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-bold px-2 py-0.2 rounded-full border ${sevBadge} uppercase font-mono`}>
                          {err.severity}
                        </span>
                        <span className="font-bold text-[var(--ink)] text-sm">{err.title}</span>
                        {isResolved ? (
                          <span className="text-[10px] px-2 py-0.2 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                            Resolved
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.2 rounded-full bg-rose-50 text-rose-700 font-semibold border border-rose-200">
                            Active Issue
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-rose-800/90 font-mono bg-rose-50/50 p-1.5 rounded border border-rose-100 max-w-2xl break-all">
                        {err.errorMessage}
                      </p>

                      <div className="flex items-center gap-3 text-[10px] text-[#24252c]/50">
                        {err.endpointOrContext && (
                          <span>Context: <strong>{err.endpointOrContext}</strong></span>
                        )}
                        <span>Logged: {formatRelativeTime(err.timestamp)}</span>
                      </div>
                    </div>

                    {/* Troubleshooting Action Controls */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <button
                        onClick={() => setSelectedErrorForModal(err)}
                        className="px-3 py-1.5 rounded-full bg-[var(--mist)] hover:bg-[#EEEEEE] text-[var(--ink)] text-[11px] font-bold transition-colors cursor-pointer"
                      >
                        Inspect
                      </button>

                      {err.service === 'email_sms' && !isResolved && (
                        <button
                          onClick={() => handleRetryDispatch(err)}
                          disabled={retryingErrorId === err.id}
                          className="px-3 py-1.5 rounded-full bg-[#1090F8] hover:bg-[#0c78d1] text-white text-[11px] font-bold transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1 shadow-xs"
                        >
                          {retryingErrorId === err.id ? 'Retrying...' : 'Resend Email'}
                        </button>
                      )}

                      {!isResolved && (
                        <button
                          onClick={() => handleResolveLog(err.id)}
                          className="px-3 py-1.5 rounded-full bg-white border border-[#24252c]/15 hover:border-emerald-500 hover:text-emerald-700 text-[var(--ink)] text-[11px] font-bold transition-colors cursor-pointer"
                        >
                          Resolve
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Error Technical Inspection Modal ── */}
      <ModalOverlay isOpen={Boolean(selectedErrorForModal)} onClose={() => setSelectedErrorForModal(null)}>
        {selectedErrorForModal && (
          <div className="bg-white rounded-[2rem] p-6 max-w-xl w-full shadow-2xl border border-[#24252c]/10 relative space-y-4 max-h-[90vh] overflow-y-auto text-xs">
            <button
              onClick={() => setSelectedErrorForModal(null)}
              className="absolute top-5 right-5 text-[#24252c]/50 hover:text-[var(--ink)] p-1 cursor-pointer"
            >
              <IconX className="w-5 h-5" />
            </button>

            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-rose-600 uppercase px-2.5 py-0.5 rounded-full bg-rose-50 border border-rose-200">
                  {selectedErrorForModal.service} · {selectedErrorForModal.severity}
                </span>
                <span className="text-[#24252c]/50 font-mono text-[11px]">
                  {selectedErrorForModal.timestamp}
                </span>
              </div>
              <h3 className="text-base font-extrabold text-[var(--ink)] mt-1">
                {selectedErrorForModal.title}
              </h3>
            </div>

            <div className="p-3 bg-rose-50 text-rose-900 rounded-xl font-mono text-[11px] border border-rose-200 break-all space-y-1">
              <div className="font-bold">Error Message:</div>
              <div>{selectedErrorForModal.errorMessage}</div>
            </div>

            {selectedErrorForModal.endpointOrContext && (
              <div>
                <span className="font-bold text-[#24252c]/60">Target Endpoint / Recipient:</span>
                <p className="font-mono text-[11px] text-[var(--ink)] bg-[var(--mist)] p-2 rounded-lg mt-0.5">
                  {selectedErrorForModal.endpointOrContext}
                </p>
              </div>
            )}

            {selectedErrorForModal.payload && (
              <div>
                <span className="font-bold text-[#24252c]/60">Captured Payload / Context:</span>
                <pre className="font-mono text-[10px] text-[var(--ink)] bg-[var(--mist)] p-3 rounded-xl overflow-x-auto mt-1 max-h-48 border border-[#24252c]/[0.06]">
                  {JSON.stringify(selectedErrorForModal.payload, null, 2)}
                </pre>
              </div>
            )}

            <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl text-blue-900 space-y-1">
              <div className="font-bold text-[11px]">💡 Troubleshooting Guide:</div>
              <ul className="list-disc pl-4 space-y-0.5 text-[10px] text-blue-800">
                {selectedErrorForModal.service === 'payment_webhook' && (
                  <>
                    <li>Verify PayMongo webhook signing secret in environment variables.</li>
                    <li>Check if the customer cancelled the e-wallet checkout or if network dropped.</li>
                  </>
                )}
                {selectedErrorForModal.service === 'email_sms' && (
                  <>
                    <li>Ensure SMTP credentials (user, pass, port 587/465) are valid.</li>
                    <li>Click "Resend Email" once network connectivity is restored.</li>
                  </>
                )}
                {selectedErrorForModal.service === 'database' && (
                  <>
                    <li>Check Supabase project status and RLS policies on target table.</li>
                    <li>Ensure user network is not blocking outbound REST / WebSocket traffic.</li>
                  </>
                )}
              </ul>
            </div>

            <div className="flex items-center gap-2 pt-2">
              {selectedErrorForModal.service === 'email_sms' && selectedErrorForModal.status !== 'resolved' && (
                <button
                  onClick={() => {
                    handleRetryDispatch(selectedErrorForModal);
                    setSelectedErrorForModal(null);
                  }}
                  className="flex-1 bg-[#1090F8] hover:bg-[#0c78d1] text-white font-bold py-2.5 rounded-full transition-colors cursor-pointer text-center"
                >
                  Resend Dispatch Now
                </button>
              )}
              <button
                onClick={() => {
                  handleResolveLog(selectedErrorForModal.id);
                  setSelectedErrorForModal(null);
                }}
                className="flex-1 bg-[var(--ink)] hover:bg-[var(--ink-soft)] text-white font-bold py-2.5 rounded-full transition-colors cursor-pointer text-center"
              >
                Mark as Resolved
              </button>
            </div>
          </div>
        )}
      </ModalOverlay>
    </div>
  );
}

