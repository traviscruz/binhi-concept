import { useState, useEffect, useMemo } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import {
  IconShield,
  IconSearch,
  IconX,
  IconDownload,
  IconCheck,
} from '../../components/shared/icons';
import { ModalOverlay } from '../../components/shared/ModalOverlay';
import { EmptyState } from '../../components/shared/EmptyState';
import { TablePagination } from '../../components/shared/TablePagination';
import { supabase } from '../../utils/supabase';
import {
  fetchAuditLogs,
  exportAuditLogsToCsv,
  type AuditLogEntry,
} from '../../utils/auditLogger';

export default function AdminAuditLogsPage({ go }: { go: (p: Page) => void }) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  // Filters
  const [moduleFilter, setModuleFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [actorFilter, setActorFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7days' | '30days'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Inspection Modal
  const [inspectingLog, setInspectingLog] = useState<AuditLogEntry | null>(null);

  // Check Admin role access
  useEffect(() => {
    async function verifyAdminAccess() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
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

  // Actors list for filter
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
      if (moduleFilter !== 'all' && log.module !== moduleFilter) return false;
      if (actionFilter !== 'all' && log.action !== actionFilter) return false;
      if (actorFilter !== 'all' && log.user_email !== actorFilter) return false;

      if (dateFilter !== 'all') {
        const logTime = new Date(log.timestamp).getTime();
        const diffHours = (now - logTime) / (1000 * 60 * 60);
        if (dateFilter === 'today' && diffHours > 24) return false;
        if (dateFilter === '7days' && diffHours > 24 * 7) return false;
        if (dateFilter === '30days' && diffHours > 24 * 30) return false;
      }

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

  useEffect(() => {
    setCurrentPage(1);
  }, [moduleFilter, actionFilter, actorFilter, dateFilter, searchQuery, pageSize]);

  const paginatedLogs = useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
    const safePage = Math.min(Math.max(1, currentPage), totalPages);
    const start = (safePage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  // Metrics
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

  if (isAdmin === false) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl p-6 border border-[#24252c]/10 text-center space-y-4">
          <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto">
            <IconShield className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-[var(--ink)]">Admin Access Required</h2>
          <p className="text-xs text-[#24252c]/60">
            Audit Trail & Logs are restricted to system administrators.
          </p>
          <button
            onClick={() => go('admin-dashboard')}
            className="bg-[var(--ink)] text-white text-xs font-semibold px-5 py-2.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors cursor-pointer"
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

  const getActionBadge = (action: string) => {
    const act = action.toUpperCase();
    if (act.includes('APPROVE') || act.includes('CREATE') || act.includes('SUCCESS') || act.includes('SETTLE')) {
      return {
        label: action.replace(/_/g, ' '),
        className: 'bg-emerald-50 text-emerald-800 border-emerald-200/60',
      };
    }
    if (act.includes('CANCEL') || act.includes('DELETE') || act.includes('FAIL')) {
      return {
        label: action.replace(/_/g, ' '),
        className: 'bg-rose-50 text-rose-800 border-rose-200/60',
      };
    }
    if (act.includes('PRICE') || act.includes('UPDATE') || act.includes('RESCHEDULE')) {
      return {
        label: action.replace(/_/g, ' '),
        className: 'bg-amber-50 text-amber-800 border-amber-200/60',
      };
    }
    return {
      label: action.replace(/_/g, ' '),
      className: 'bg-slate-100 text-slate-800 border-slate-200',
    };
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#24252c]/[0.06]">
        <div>
          <MonoBadge icon={IconShield}>Accountability</MonoBadge>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ink)] mt-1.5">
            Audit Trail & Logs
          </h1>
          <p className="text-xs text-[#24252c]/60 mt-1">
            System activity logs: price modifications, booking status updates, crew assignments, and staff operations.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            type="button"
            onClick={loadLogs}
            className="px-3.5 py-2 rounded-full bg-white hover:bg-[var(--mist)] text-[var(--ink)] border border-[#24252c]/10 text-xs font-semibold transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
          >
            <span className={loading ? 'animate-spin inline-block' : ''}>↻</span>
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => exportAuditLogsToCsv(filteredLogs)}
            disabled={filteredLogs.length === 0}
            className="px-4 py-2 rounded-full bg-[var(--ink)] hover:bg-[var(--ink-soft)] text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
          >
            <IconDownload className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Summary - Clean Institutional Styling */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#24252c]/[0.08] shadow-xs">
          <div className="text-[10px] font-bold text-[#24252c]/50 uppercase tracking-wider">
            Total Audited
          </div>
          <div className="text-2xl font-black text-[var(--ink)] mt-1">
            {metrics.total.toLocaleString()}
          </div>
          <div className="text-[10px] text-emerald-700 font-medium mt-0.5">
            Real-time logging
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#24252c]/[0.08] shadow-xs">
          <div className="text-[10px] font-bold text-[#24252c]/50 uppercase tracking-wider">
            Pricing & Logistics
          </div>
          <div className="text-2xl font-black text-[var(--ink)] mt-1">
            {metrics.priceUpdates.toLocaleString()}
          </div>
          <div className="text-[10px] text-[#24252c]/50 mt-0.5">
            Rates & coverage edits
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#24252c]/[0.08] shadow-xs">
          <div className="text-[10px] font-bold text-[#24252c]/50 uppercase tracking-wider">
            Crew & Unit Rosters
          </div>
          <div className="text-2xl font-black text-[var(--ink)] mt-1">
            {metrics.crewAssignments.toLocaleString()}
          </div>
          <div className="text-[10px] text-[#24252c]/50 mt-0.5">
            Personnel & gear assignments
          </div>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#24252c]/[0.08] shadow-xs">
          <div className="text-[10px] font-bold text-[#24252c]/50 uppercase tracking-wider">
            Booking Operations
          </div>
          <div className="text-2xl font-black text-[var(--ink)] mt-1">
            {metrics.bookingApprovals.toLocaleString()}
          </div>
          <div className="text-[10px] text-[#24252c]/50 mt-0.5">
            Approvals & status updates
          </div>
        </div>
      </div>

      {/* Filter Control Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#24252c]/[0.08] shadow-xs space-y-3">
        {/* Module Tab Filter */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 text-xs">
          {[
            { id: 'all', label: 'All Modules' },
            { id: 'bookings', label: 'Bookings' },
            { id: 'packages', label: 'Packages' },
            { id: 'crew', label: 'Crew' },
            { id: 'staff', label: 'Staff' },
            { id: 'vouchers', label: 'Vouchers' },
            { id: 'transport', label: 'Logistics' },
            { id: 'inventory', label: 'Inventory' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setModuleFilter(tab.id)}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                moduleFilter === tab.id
                  ? 'bg-[var(--ink)] text-white'
                  : 'bg-[var(--mist)] text-[#24252c]/65 hover:text-[var(--ink)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Dropdowns & Search */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
          {/* Action Filter */}
          <div>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full bg-[var(--mist)] border border-[#24252c]/10 rounded-full px-4 py-2 text-xs font-medium text-[var(--ink)] focus:outline-none focus:border-[#1090F8] transition-colors cursor-pointer"
            >
              <option value="all">All Action Types</option>
              {uniqueActions.map((act) => (
                <option key={act} value={act}>
                  {act.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          {/* Actor Filter */}
          <div>
            <select
              value={actorFilter}
              onChange={(e) => setActorFilter(e.target.value)}
              className="w-full bg-[var(--mist)] border border-[#24252c]/10 rounded-full px-4 py-2 text-xs font-medium text-[var(--ink)] focus:outline-none focus:border-[#1090F8] transition-colors cursor-pointer"
            >
              <option value="all">All Staff / Operators</option>
              {uniqueActors.map((actor) => (
                <option key={actor.email} value={actor.email}>
                  {actor.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Filter */}
          <div>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="w-full bg-[var(--mist)] border border-[#24252c]/10 rounded-full px-4 py-2 text-xs font-medium text-[var(--ink)] focus:outline-none focus:border-[#1090F8] transition-colors cursor-pointer"
            >
              <option value="all">All Dates</option>
              <option value="today">Past 24 Hours</option>
              <option value="7days">Past 7 Days</option>
              <option value="30days">Past 30 Days</option>
            </select>
          </div>

          {/* Search Box */}
          <div className="relative">
            <IconSearch className="w-3.5 h-3.5 text-[#24252c]/40 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search keyword, ID, client..."
              className="w-full bg-[var(--mist)] border border-[#24252c]/10 rounded-full pl-9 pr-4 py-2 text-xs font-medium text-[var(--ink)] focus:outline-none focus:border-[#1090F8] transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Main Audit Log Table & Mobile Cards */}
      <div className="bg-white rounded-2xl border border-[#24252c]/[0.08] shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-[#24252c]/50 space-y-2">
            <div className="inline-block w-5 h-5 border-2 border-[#1090F8] border-t-transparent rounded-full animate-spin" />
            <div>Loading audit records...</div>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-10 text-center">
            <EmptyState
              title="No Audit Logs Found"
              description="No logged events match the selected filters or search terms."
            />
          </div>
        ) : (
          <>
            {/* Desktop Table View - Generous Column Spacing */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[var(--mist)] text-[#24252c]/60 text-[10px] font-extrabold uppercase tracking-wider border-b border-[#24252c]/[0.06]">
                    <th className="py-4 px-6 whitespace-nowrap">Date & Time</th>
                    <th className="py-4 px-6 whitespace-nowrap">Operator</th>
                    <th className="py-4 px-6 whitespace-nowrap">Action</th>
                    <th className="py-4 px-6 whitespace-nowrap">Module</th>
                    <th className="py-4 px-6">Activity Summary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#24252c]/[0.04]">
                  {paginatedLogs.map((log) => {
                    const badge = getActionBadge(log.action);

                    return (
                      <tr
                        key={log.id}
                        className="hover:bg-[var(--mist)]/50 transition-colors cursor-pointer group"
                        onClick={() => setInspectingLog(log)}
                      >
                        {/* Timestamp */}
                        <td className="py-4 px-6 whitespace-nowrap">
                          <div className="font-medium text-[var(--ink)]">
                            {new Date(log.timestamp).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </div>
                          <div className="text-[10px] text-[#24252c]/45 mt-0.5">
                            {new Date(log.timestamp).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}{' '}
                            · {formatRelativeTime(log.timestamp)}
                          </div>
                        </td>

                        {/* Actor */}
                        <td className="py-4 px-6">
                          <div className="font-bold text-[var(--ink)]">
                            {log.user_name || 'Staff'}
                          </div>
                          <div className="text-[10px] text-[#24252c]/45 mt-0.5">
                            {log.user_email}
                          </div>
                        </td>

                        {/* Action */}
                        <td className="py-4 px-6 whitespace-nowrap">
                          <span
                            className={`inline-block text-[10px] font-semibold px-3 py-1 rounded-full border capitalize ${badge.className}`}
                          >
                            {badge.label.toLowerCase()}
                          </span>
                        </td>

                        {/* Module & Target */}
                        <td className="py-4 px-6 whitespace-nowrap">
                          <div className="text-[10px] font-semibold text-[#24252c]/60 uppercase">
                            {log.module}
                          </div>
                          <div className="font-bold text-xs text-[var(--ink)] truncate max-w-[180px] mt-0.5" title={log.target_name || log.target_id}>
                            {log.target_name || log.target_id || '—'}
                          </div>
                        </td>

                        {/* Details */}
                        <td className="py-4 px-6">
                          <p className="text-xs text-[#24252c]/80 font-medium leading-relaxed">
                            {log.details}
                          </p>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View - Bookings Manager Style */}
            <div className="block sm:hidden divide-y divide-[#24252c]/[0.06] p-2">
              {paginatedLogs.map((log) => {
                const badge = getActionBadge(log.action);

                return (
                  <div
                    key={log.id}
                    onClick={() => setInspectingLog(log)}
                    className="p-4 space-y-2.5 cursor-pointer hover:bg-[var(--mist)]/40 rounded-2xl transition-colors"
                  >
                    {/* Top Row: Operator + Action Pill */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-[var(--mist)] text-[var(--ink)] font-bold text-xs flex items-center justify-center border border-[#24252c]/10 shrink-0">
                          {(log.user_name || 'S').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-xs text-[var(--ink)]">{log.user_name}</div>
                          <div className="text-[10px] text-[#24252c]/50">{log.user_email}</div>
                        </div>
                      </div>
                      <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border capitalize shrink-0 ${badge.className}`}>
                        {badge.label.toLowerCase()}
                      </span>
                    </div>

                    {/* Middle Info Box */}
                    <div className="text-xs space-y-1 py-2 px-3 rounded-xl bg-[var(--mist)]/70 text-[#24252c]/75">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-[#24252c]/50 text-[10px] uppercase font-semibold">Target</span>
                        <span className="font-bold text-[var(--ink)] truncate max-w-[170px]">
                          {log.module} · {log.target_name || log.target_id || '—'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-[#24252c]/50 text-[10px] uppercase font-semibold">Date & Time</span>
                        <span className="font-medium text-[var(--ink)]">
                          {new Date(log.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · {formatRelativeTime(log.timestamp)}
                        </span>
                      </div>
                    </div>

                    {/* Activity Summary */}
                    <p className="text-xs text-[#24252c]/85 font-medium leading-normal">
                      {log.details}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            <div className="p-4 border-t border-[#24252c]/[0.06]">
              <TablePagination
                currentPage={currentPage}
                totalItems={filteredLogs.length}
                pageSize={pageSize}
                pageSizeOptions={[10, 25, 50]}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
                itemLabel="audit records"
              />
            </div>
          </>
        )}
      </div>

      {/* Audit Log Details Modal */}
      <ModalOverlay isOpen={Boolean(inspectingLog)} onClose={() => setInspectingLog(null)}>
        {inspectingLog && (
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-[#24252c]/10 relative max-h-[90vh] flex flex-col text-xs">
            {/* Close Button */}
            <button
              onClick={() => setInspectingLog(null)}
              className="absolute top-4 right-4 text-[#24252c]/50 hover:text-[var(--ink)] p-1 rounded-full cursor-pointer"
            >
              <IconX className="w-4 h-4" />
            </button>

            {/* Modal Header */}
            <div className="pb-3 border-b border-[#24252c]/[0.08]">
              <div className="text-[10px] font-bold text-[#24252c]/50 uppercase tracking-wider">
                Audit Record Details
              </div>
              <h2 className="text-base font-bold text-[var(--ink)] mt-0.5 flex items-center gap-2">
                <span>{inspectingLog.action.replace(/_/g, ' ')}</span>
                <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700 uppercase">
                  {inspectingLog.module}
                </span>
              </h2>
              <div className="text-xs text-[#24252c]/60 mt-0.5">
                Target: <span className="font-semibold text-[var(--ink)]">{inspectingLog.target_name || inspectingLog.target_id}</span>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4">
              {/* Meta Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-2xl bg-[var(--mist)] text-xs">
                <div>
                  <div className="text-[10px] text-[#24252c]/50 font-semibold uppercase">Operator</div>
                  <div className="font-bold text-[var(--ink)]">{inspectingLog.user_name}</div>
                  <div className="text-[10px] text-[#24252c]/50">{inspectingLog.user_email}</div>
                </div>

                <div>
                  <div className="text-[10px] text-[#24252c]/50 font-semibold uppercase">Role</div>
                  <div className="font-bold text-[var(--ink)] capitalize">{inspectingLog.user_role}</div>
                </div>

                <div>
                  <div className="text-[10px] text-[#24252c]/50 font-semibold uppercase">Timestamp</div>
                  <div className="font-medium text-[var(--ink)]">
                    {new Date(inspectingLog.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#24252c]/50 mb-1.5">
                  Action Summary
                </div>
                <div className="p-3.5 rounded-xl bg-white border border-[#24252c]/[0.08] text-[var(--ink)] text-xs font-medium leading-relaxed">
                  {inspectingLog.details}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-[#24252c]/[0.08] flex items-center justify-between">
              <span className="text-[10px] text-[#24252c]/40 font-semibold">
                Reference #{inspectingLog.id.slice(0, 14)}
              </span>
              <button
                type="button"
                onClick={() => setInspectingLog(null)}
                className="px-4 py-1.5 rounded-full text-xs font-semibold bg-[var(--ink)] text-white hover:bg-[var(--ink-soft)] transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </ModalOverlay>
    </div>
  );
}
