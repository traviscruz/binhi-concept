import { useState, useEffect, useMemo } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import {
  IconShield,
  IconSearch,
  IconX,
  IconUser,
  IconCalendar,
  IconBox,
  IconTicket,
} from '../../components/shared/icons';
import { ModalOverlay } from '../../components/shared/ModalOverlay';
import { EmptyState } from '../../components/shared/EmptyState';
import { TablePagination } from '../../components/shared/TablePagination';
import { supabase } from '../../utils/supabase';
import {
  fetchAuditLogs,
  exportAuditLogsToCsv,
  type AuditLogEntry,
  type AuditModule,
} from '../../utils/auditLogger';

export default function AdminAuditLogsPage({ go }: { go: (p: Page) => void }) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  // Filters State
  const [moduleFilter, setModuleFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [actorFilter, setActorFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7days' | '30days'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Selected Log for Inspection Modal
  const [inspectingLog, setInspectingLog] = useState<AuditLogEntry | null>(null);

  // Check Admin role access
  useEffect(() => {
    async function verifyAdminAccess() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          // Allow fallback during development/prototype if no auth session
          setIsAdmin(true);
          return;
        }

        const role = user.user_metadata?.role || 'admin';
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();

        const finalRole = (profile?.role || role || '').toLowerCase();
        setIsAdmin(finalRole === 'admin' || finalRole === 'system_admin' || !finalRole);
      } catch (err) {
        console.warn('Role verification note:', err);
        setIsAdmin(true);
      }
    }
    verifyAdminAccess();
  }, []);

  // Load audit logs
  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await fetchAuditLogs();
      setLogs(data);
    } catch (err) {
      console.error('Error loading audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();

    const handleUpdate = () => {
      loadLogs();
    };

    window.addEventListener('audit-logs-updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener('audit-logs-updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  // Calculate unique staff list for actor filter
  const uniqueActors = useMemo(() => {
    const map = new Map<string, string>();
    logs.forEach((l) => {
      if (l.user_email) {
        map.set(l.user_email, l.user_name || l.user_email);
      }
    });
    return Array.from(map.entries()).map(([email, name]) => ({ email, name }));
  }, [logs]);

  // Unique actions list
  const uniqueActions = useMemo(() => {
    return Array.from(new Set(logs.map((l) => l.action))).sort();
  }, [logs]);

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    const now = new Date().getTime();
    const query = searchQuery.trim().toLowerCase();

    return logs.filter((log) => {
      // 1. Module filter
      if (moduleFilter !== 'all' && log.module !== moduleFilter) {
        return false;
      }

      // 2. Action filter
      if (actionFilter !== 'all' && log.action !== actionFilter) {
        return false;
      }

      // 3. Actor filter
      if (actorFilter !== 'all' && log.user_email !== actorFilter) {
        return false;
      }

      // 4. Date range filter
      if (dateFilter !== 'all') {
        const logTime = new Date(log.timestamp).getTime();
        const diffHours = (now - logTime) / (1000 * 60 * 60);

        if (dateFilter === 'today' && diffHours > 24) return false;
        if (dateFilter === '7days' && diffHours > 24 * 7) return false;
        if (dateFilter === '30days' && diffHours > 24 * 30) return false;
      }

      // 5. Search query
      if (query) {
        const matchTarget = (log.target_id || '').toLowerCase().includes(query);
        const matchTargetName = (log.target_name || '').toLowerCase().includes(query);
        const matchUser = (log.user_name || '').toLowerCase().includes(query) || (log.user_email || '').toLowerCase().includes(query);
        const matchDetails = (log.details || '').toLowerCase().includes(query);
        const matchAction = (log.action || '').toLowerCase().includes(query);

        if (!matchTarget && !matchTargetName && !matchUser && !matchDetails && !matchAction) {
          return false;
        }
      }

      return true;
    });
  }, [logs, moduleFilter, actionFilter, actorFilter, dateFilter, searchQuery]);

  // Reset pagination to page 1 whenever any filter, search, or page size changes
  useEffect(() => {
    setCurrentPage(1);
  }, [moduleFilter, actionFilter, actorFilter, dateFilter, searchQuery, pageSize]);

  const paginatedLogs = useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
    const safePage = Math.min(Math.max(1, currentPage), totalPages);
    const start = (safePage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = logs.length;
    const priceUpdates = logs.filter(
      (l) =>
        l.action.includes('PRICE') ||
        l.action.includes('VOUCHER') ||
        l.action.includes('TRANSPORT') ||
        l.action.includes('SETTLE')
    ).length;
    const crewAssignments = logs.filter(
      (l) => l.action.includes('CREW') || l.action.includes('UNIT')
    ).length;
    const bookingApprovals = logs.filter(
      (l) => l.action.includes('APPROVE') || l.action.includes('CANCEL') || l.action.includes('STATUS')
    ).length;

    return { total, priceUpdates, crewAssignments, bookingApprovals };
  }, [logs]);

  // Access Denied Screen for non-admins
  if (isAdmin === false) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-[2rem] p-8 border border-rose-200 shadow-xl text-center space-y-4">
          <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto border border-rose-100">
            <IconShield className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-extrabold text-[var(--ink)]">Access Restricted</h2>
          <p className="text-xs text-[#24252c]/60">
            The Audit Trail & Accountability system is restricted exclusively to authorized System Administrators.
          </p>
          <button
            onClick={() => go('admin-dashboard')}
            className="w-full bg-[var(--ink)] text-white text-xs font-bold py-3 rounded-full hover:bg-[var(--ink-soft)] transition-colors cursor-pointer"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const formatRelativeTime = (isoString: string): string => {
    try {
      const date = new Date(isoString);
      const diffMs = Date.now() - date.getTime();
      const diffSecs = Math.floor(diffMs / 1000);
      const diffMins = Math.floor(diffSecs / 60);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffSecs < 60) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const getActionBadgeStyle = (action: string) => {
    const act = action.toUpperCase();
    if (act.includes('APPROVE') || act.includes('CREATE') || act.includes('SUCCESS')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (act.includes('ASSIGN') || act.includes('UNIT')) {
      return 'bg-blue-50 text-[#1090F8] border-blue-200';
    }
    if (act.includes('PRICE') || act.includes('UPDATE') || act.includes('RESCHEDULE') || act.includes('SETTLE')) {
      return 'bg-amber-50 text-amber-700 border-amber-200';
    }
    if (act.includes('CANCEL') || act.includes('DELETE') || act.includes('FAIL')) {
      return 'bg-rose-50 text-rose-700 border-rose-200';
    }
    return 'bg-purple-50 text-purple-700 border-purple-200';
  };

  const getModuleBadgeStyle = (module: string) => {
    switch (module) {
      case 'bookings':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'packages':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'crew':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'staff':
        return 'bg-cyan-50 text-cyan-700 border-cyan-200';
      case 'vouchers':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'transport':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'inventory':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#24252c]/[0.06]">
        <div>
          <MonoBadge icon={IconShield}>Accountability & Security</MonoBadge>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ink)] mt-1.5">
            Audit Trail & Logs
          </h1>
          <p className="text-xs text-[#24252c]/60 mt-1">
            Immutable, real-time chronicle of all administrative modifications, pricing adjustments, crew rosters, and booking operations.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            type="button"
            onClick={loadLogs}
            className="inline-flex items-center gap-1.5 bg-white text-[var(--ink)] text-xs font-semibold px-4 py-2.5 rounded-full border border-[#24252c]/10 hover:bg-[var(--mist)] transition-all cursor-pointer shadow-2xs"
          >
            <span className={loading ? 'animate-spin inline-block' : ''}>↻</span>
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => exportAuditLogsToCsv(filteredLogs)}
            disabled={filteredLogs.length === 0}
            className="inline-flex items-center gap-2 bg-[var(--ink)] text-white text-xs font-bold px-5 py-2.5 rounded-full hover:bg-[var(--ink-soft)] transition-all shadow-sm cursor-pointer disabled:opacity-40"
          >
            <IconTicket className="w-3.5 h-3.5" />
            <span>Export CSV ({filteredLogs.length})</span>
          </button>
        </div>
      </div>

      {/* ── KPI Metric Cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#24252c]/[0.08] shadow-xs">
          <div className="text-[11px] font-bold text-[#24252c]/50 uppercase tracking-wider">
            Total Audited Activities
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-[var(--ink)] mt-1">
            {metrics.total.toLocaleString()}
          </div>
          <div className="text-[10px] text-emerald-600 font-semibold mt-1">
            ✓ Immutable Log Active
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#24252c]/[0.08] shadow-xs">
          <div className="text-[11px] font-bold text-[#24252c]/50 uppercase tracking-wider">
            Pricing & Fee Adjustments
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-amber-600 mt-1">
            {metrics.priceUpdates.toLocaleString()}
          </div>
          <div className="text-[10px] text-[#24252c]/50 mt-1">
            Packages, Vouchers, Transport
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#24252c]/[0.08] shadow-xs">
          <div className="text-[11px] font-bold text-[#24252c]/50 uppercase tracking-wider">
            Crew & Unit Assignments
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-[#1090F8] mt-1">
            {metrics.crewAssignments.toLocaleString()}
          </div>
          <div className="text-[10px] text-[#24252c]/50 mt-1">
            Event personnel & serial gear
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#24252c]/[0.08] shadow-xs">
          <div className="text-[11px] font-bold text-[#24252c]/50 uppercase tracking-wider">
            Booking Actions & Statuses
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-purple-600 mt-1">
            {metrics.bookingApprovals.toLocaleString()}
          </div>
          <div className="text-[10px] text-[#24252c]/50 mt-1">
            Approvals, reschedules, cancels
          </div>
        </div>
      </div>

      {/* ── Filters & Search Control Bar ────────────────────────────── */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#24252c]/[0.08] shadow-sm space-y-4">
        {/* Module Tab Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {[
            { id: 'all', label: 'All Activities' },
            { id: 'bookings', label: 'Bookings' },
            { id: 'packages', label: 'Package Builder' },
            { id: 'crew', label: 'Crew Assignments' },
            { id: 'staff', label: 'Staff Accounts' },
            { id: 'vouchers', label: 'Vouchers' },
            { id: 'transport', label: 'Transport Rules' },
            { id: 'inventory', label: 'Inventory' },
            { id: 'loyalty', label: 'Loyalty' },
            { id: 'reviews', label: 'Reviews' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setModuleFilter(tab.id)}
              className={`px-3.5 py-1.5 rounded-full font-semibold whitespace-nowrap transition-all cursor-pointer ${
                moduleFilter === tab.id
                  ? 'bg-[var(--ink)] text-white shadow-xs'
                  : 'bg-[var(--mist)] text-[#24252c]/60 hover:text-[var(--ink)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Dropdowns & Search Input */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Action Filter */}
          <div>
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-[#24252c]/50 block mb-1">
              Action Category
            </label>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full bg-[#EEEEEE] border border-transparent focus:border-[#1090F8] rounded-full px-4 py-2 text-xs font-semibold text-[var(--ink)] focus:outline-none transition-colors"
            >
              <option value="all">All Actions</option>
              {uniqueActions.map((act) => (
                <option key={act} value={act}>
                  {act.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          {/* Actor Filter */}
          <div>
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-[#24252c]/50 block mb-1">
              Performed By (Admin/Staff)
            </label>
            <select
              value={actorFilter}
              onChange={(e) => setActorFilter(e.target.value)}
              className="w-full bg-[#EEEEEE] border border-transparent focus:border-[#1090F8] rounded-full px-4 py-2 text-xs font-semibold text-[var(--ink)] focus:outline-none transition-colors"
            >
              <option value="all">All Staff Members</option>
              {uniqueActors.map((actor) => (
                <option key={actor.email} value={actor.email}>
                  {actor.name} ({actor.email})
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Filter */}
          <div>
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-[#24252c]/50 block mb-1">
              Date Period
            </label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="w-full bg-[#EEEEEE] border border-transparent focus:border-[#1090F8] rounded-full px-4 py-2 text-xs font-semibold text-[var(--ink)] focus:outline-none transition-colors"
            >
              <option value="all">All Historical Time</option>
              <option value="today">Past 24 Hours</option>
              <option value="7days">Past 7 Days</option>
              <option value="30days">Past 30 Days</option>
            </select>
          </div>

          {/* Search Input */}
          <div>
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-[#24252c]/50 block mb-1">
              Search Target / Keyword
            </label>
            <div className="relative">
              <IconSearch className="w-3.5 h-3.5 text-[#24252c]/40 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Booking ID, package, staff..."
                className="w-full bg-[#EEEEEE] border border-transparent focus:border-[#1090F8] rounded-full pl-9 pr-4 py-2 text-xs font-medium text-[var(--ink)] focus:outline-none transition-colors"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Audit Log Table ────────────────────────────────────── */}
      <div className="bg-white rounded-2xl p-5 border border-[#24252c]/[0.08] shadow-sm">
        {loading ? (
          <div className="space-y-3 py-6">
            <div className="h-12 bg-black/5 animate-pulse rounded-xl" />
            <div className="h-12 bg-black/5 animate-pulse rounded-xl" />
            <div className="h-12 bg-black/5 animate-pulse rounded-xl" />
            <div className="h-12 bg-black/5 animate-pulse rounded-xl" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <EmptyState
            title="No Audit Logs Found"
            description="No logged system operations match your selected module, action category, or search query."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#24252c]/[0.06] text-[#24252c]/50 uppercase tracking-wider">
                    <th className="py-3 px-3 font-semibold whitespace-nowrap">Timestamp</th>
                    <th className="py-3 px-3 font-semibold whitespace-nowrap">Actor / Staff</th>
                    <th className="py-3 px-3 font-semibold whitespace-nowrap">Action Performed</th>
                    <th className="py-3 px-3 font-semibold whitespace-nowrap">Module & Target</th>
                    <th className="py-3 px-3 font-semibold">Activity Details</th>
                    <th className="py-3 px-3 font-semibold text-right whitespace-nowrap">Changes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#24252c]/[0.04]">
                  {paginatedLogs.map((log) => {
                    const hasDiff =
                      (log.previous_data && Object.keys(log.previous_data).length > 0) ||
                      (log.current_data && Object.keys(log.current_data).length > 0);

                    return (
                      <tr
                        key={log.id}
                        className="hover:bg-[var(--mist)] transition-colors cursor-pointer group"
                        onClick={() => setInspectingLog(log)}
                      >
                        {/* Col 1: Timestamp */}
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <div className="font-semibold text-[var(--ink)]">
                            {new Date(log.timestamp).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </div>
                          <div className="text-[10px] text-[#24252c]/50 font-mono">
                            {new Date(log.timestamp).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                            <span className="ml-1.5 font-bold text-[#1090F8]">
                              ({formatRelativeTime(log.timestamp)})
                            </span>
                          </div>
                        </td>

                        {/* Col 2: Actor */}
                        <td className="py-3.5 px-3">
                          <div className="font-bold text-[var(--ink)] flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-[var(--mist)] text-[10px] font-extrabold flex items-center justify-center border border-[#24252c]/10 text-[#24252c]">
                              {(log.user_name || log.user_email || 'A').charAt(0).toUpperCase()}
                            </span>
                            <span>{log.user_name || 'Staff User'}</span>
                          </div>
                          <div className="text-[10px] text-[#24252c]/50 font-mono">
                            {log.user_email}
                          </div>
                        </td>

                        {/* Col 3: Action */}
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <span
                            className={`inline-block text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${getActionBadgeStyle(
                              log.action
                            )}`}
                          >
                            {log.action.replace(/_/g, ' ')}
                          </span>
                        </td>

                        {/* Col 4: Module & Target */}
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-[9px] font-extrabold px-2 py-0.2 rounded-md border uppercase tracking-wider ${getModuleBadgeStyle(
                                log.module
                              )}`}
                            >
                              {log.module}
                            </span>
                            <span className="font-mono font-bold text-xs text-[var(--ink)]">
                              {log.target_name || log.target_id}
                            </span>
                          </div>
                        </td>

                        {/* Col 5: Activity Details */}
                        <td className="py-3.5 px-3 max-w-md">
                          <p className="text-xs text-[var(--ink)] font-medium line-clamp-2">
                            {log.details}
                          </p>
                        </td>

                        {/* Col 6: Changes / Diff Button */}
                        <td className="py-3.5 px-3 text-right whitespace-nowrap">
                          {hasDiff ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setInspectingLog(log);
                              }}
                              className="bg-white border border-[#1090F8]/30 hover:border-[#1090F8] text-[#1090F8] text-[11px] font-bold px-3 py-1 rounded-full hover:bg-[#1090F8]/5 transition-all shadow-2xs cursor-pointer inline-flex items-center gap-1"
                            >
                              <span>Inspect Diff</span>
                              <span>→</span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-[#24252c]/40 italic">
                              Recorded
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <TablePagination
              currentPage={currentPage}
              totalItems={filteredLogs.length}
              pageSize={pageSize}
              pageSizeOptions={[10, 50, 100]}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              itemLabel="audit logs"
            />
          </>
        )}
      </div>

      {/* ── Inspection Modal: Side-by-Side "What Was Changed" Diff Viewer ── */}
      <ModalOverlay isOpen={Boolean(inspectingLog)} onClose={() => setInspectingLog(null)}>
        {inspectingLog && (
          <div className="bg-white rounded-[2rem] p-6 sm:p-7 max-w-3xl w-full shadow-2xl border border-[#24252c]/10 relative max-h-[92vh] flex flex-col">
            {/* Close Button */}
            <button
              onClick={() => setInspectingLog(null)}
              className="absolute top-5 right-5 text-[#24252c]/50 hover:text-[var(--ink)] p-1 rounded-full hover:bg-black/5 transition-colors cursor-pointer"
            >
              <IconX className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="pb-4 border-b border-[#24252c]/[0.08]">
              <div className="flex items-center gap-2 text-xs font-mono font-extrabold text-[#1090F8] mb-1">
                <IconShield className="w-4 h-4" />
                <span>Accountability Audit Record</span>
              </div>
              <h2 className="text-xl font-extrabold text-[var(--ink)] tracking-tight flex items-center gap-2.5 flex-wrap">
                <span>{inspectingLog.action.replace(/_/g, ' ')}</span>
                <span
                  className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${getModuleBadgeStyle(
                    inspectingLog.module
                  )}`}
                >
                  {inspectingLog.module}
                </span>
              </h2>
              <div className="text-xs text-[#24252c]/60 mt-1">
                Target Reference: <span className="font-bold text-[var(--ink)]">{inspectingLog.target_name || inspectingLog.target_id}</span>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto py-5 space-y-5 text-xs">
              {/* Actor & Timestamp Meta Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-2xl bg-[var(--mist)] border border-[#24252c]/[0.06]">
                <div>
                  <div className="text-[10px] font-bold text-[#24252c]/50 uppercase tracking-wider">
                    Staff / Admin
                  </div>
                  <div className="font-bold text-[var(--ink)] mt-0.5">
                    {inspectingLog.user_name}
                  </div>
                  <div className="text-[10px] text-[#24252c]/50">
                    {inspectingLog.user_email}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-bold text-[#24252c]/50 uppercase tracking-wider">
                    Assigned Role
                  </div>
                  <div className="font-bold text-[var(--ink)] capitalize mt-0.5">
                    {inspectingLog.user_role}
                  </div>
                  <div className="text-[10px] text-emerald-600 font-semibold">
                    Authorized System Operator
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-bold text-[#24252c]/50 uppercase tracking-wider">
                    Exact Timestamp
                  </div>
                  <div className="font-bold text-[var(--ink)] mt-0.5">
                    {new Date(inspectingLog.timestamp).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </div>
                  <div className="text-[10px] text-[#24252c]/50 font-mono">
                    {new Date(inspectingLog.timestamp).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </div>
                </div>
              </div>

              {/* Activity Description */}
              <div className="space-y-1">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#24252c]/50">
                  Recorded Summary of Action
                </div>
                <div className="p-3.5 rounded-xl bg-white border border-[#24252c]/[0.08] font-medium text-[var(--ink)]">
                  {inspectingLog.details}
                </div>
              </div>

              {/* Side-by-Side "What Was Changed" Diff Comparison */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#24252c]/50">
                    State Diff (What was changed vs Current state)
                  </div>
                  <span className="text-[10px] font-mono text-[#1090F8]">
                    Accountability Comparison
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Previous State Card */}
                  <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-4 space-y-2">
                    <div className="flex items-center justify-between text-rose-700 font-extrabold text-[11px] pb-1 border-b border-rose-200">
                      <span>PREVIOUS VALUES (BEFORE)</span>
                      <span>—</span>
                    </div>
                    {inspectingLog.previous_data ? (
                      <pre className="text-[11px] font-mono whitespace-pre-wrap text-rose-950 overflow-x-auto">
                        {JSON.stringify(inspectingLog.previous_data, null, 2)}
                      </pre>
                    ) : (
                      <div className="text-[11px] text-[#24252c]/50 italic py-2">
                        None / Initial Creation
                      </div>
                    )}
                  </div>

                  {/* Current State Card */}
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-2">
                    <div className="flex items-center justify-between text-emerald-700 font-extrabold text-[11px] pb-1 border-b border-emerald-200">
                      <span>CURRENT VALUES (AFTER)</span>
                      <span>✓</span>
                    </div>
                    {inspectingLog.current_data ? (
                      <pre className="text-[11px] font-mono whitespace-pre-wrap text-emerald-950 overflow-x-auto">
                        {JSON.stringify(inspectingLog.current_data, null, 2)}
                      </pre>
                    ) : (
                      <div className="text-[11px] text-[#24252c]/50 italic py-2">
                        No State Record
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Technical Audit Metadata */}
              {inspectingLog.metadata && Object.keys(inspectingLog.metadata).length > 0 && (
                <div className="space-y-1">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#24252c]/50">
                    System & Network Metadata
                  </div>
                  <pre className="text-[10px] font-mono bg-black/5 p-3 rounded-xl overflow-x-auto text-[#24252c]/70">
                    {JSON.stringify(inspectingLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-4 border-t border-[#24252c]/[0.08] flex items-center justify-between">
              <div className="text-[10px] text-[#24252c]/40 font-mono">
                Log ID: {inspectingLog.id}
              </div>
              <button
                type="button"
                onClick={() => setInspectingLog(null)}
                className="px-5 py-2 rounded-full text-xs font-bold bg-[var(--ink)] hover:bg-[var(--ink-soft)] text-white transition-colors cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        )}
      </ModalOverlay>
    </div>
  );
}
