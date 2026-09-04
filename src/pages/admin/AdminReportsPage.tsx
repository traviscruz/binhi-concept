import { useState, useEffect, useMemo } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import {
  IconTicket,
  IconSearch,
  IconDownload,
  IconFileSpreadsheet,
  IconCheck,
  IconShield,
  IconCalendar,
} from '../../components/shared/icons';
import { TablePagination } from '../../components/shared/TablePagination';
import { EmptyState } from '../../components/shared/EmptyState';
import { supabase } from '../../utils/supabase';
import {
  exportFinancialLedgerToExcel,
  exportFinancialLedgerToCSV,
  calculateFinancialSummary,
  type FinancialBookingRecord,
} from '../../utils/financialExport';
import { formatDisplayDate } from '../../utils/bookingService';

interface RawBookingRow {
  id: string;
  paymongo_reference_number?: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  package_name?: string;
  event_date?: string;
  venue_address?: string;
  payment_status?: string;
  status?: string;
  is_fully_paid?: boolean;
  transport_fee?: number | string;
  deposit_amount?: number | string;
  remaining_balance?: number | string;
  total_cost?: number | string;
  payment_channel?: string;
  booking_source?: string;
  balance_payment_method?: string;
  created_at?: string;
}

export default function AdminReportsPage({ go }: { go: (p: Page) => void }) {
  const [records, setRecords] = useState<FinancialBookingRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [channelFilter, setChannelFilter] = useState('All');
  const [dateRangeFilter, setDateRangeFilter] = useState('All');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Export Feedback Modal
  const [exportFeedback, setExportFeedback] = useState<{ type: 'xlsx' | 'csv'; count: number } | null>(null);

  // ───────────────────────────────────────────────────────────────────────────
  // FETCH REAL BOOKINGS FROM SUPABASE
  // ───────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;

    async function loadBookings() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('bookings')
          .select('*')
          .order('event_date', { ascending: false });

        if (!isMounted) return;

        if (!error && data && data.length > 0) {
          const rawRows = data as unknown as RawBookingRow[];
          const mapped: FinancialBookingRecord[] = rawRows.map((b) => {
            const total = Number(b.total_cost) || 0;
            const deposit = Number(b.deposit_amount) || 0;
            const transport = Number(b.transport_fee) || 0;
            const isFull = b.is_fully_paid === true;
            const rem = isFull ? 0 : Math.max(0, total - deposit);
            const rawStatus = (b.payment_status || b.status || 'pending').toLowerCase();

            return {
              id: b.id,
              dbId: b.id,
              refNumber: b.paymongo_reference_number || `BNH-${b.id.slice(0, 8)}`,
              customerName: b.customer_name || 'Customer',
              customerEmail: b.customer_email || '',
              customerPhone: b.customer_phone || '',
              packageName: b.package_name || 'Event Production Package',
              eventDate: b.event_date ? (b.event_date.includes('T') ? b.event_date.split('T')[0] : b.event_date) : 'N/A',
              venueAddress: b.venue_address || 'Selected Location',
              paymentStatus: rawStatus,
              isFullyPaid: isFull,
              transportFee: transport,
              depositAmount: deposit,
              remainingBalance: rem,
              totalCost: total,
              paymentChannel: b.payment_channel || 'PayMongo',
              bookingSource: b.booking_source || 'Online Booking',
              balanceMethod: b.balance_payment_method || 'Cash on Site / Event Day',
              createdAt: b.created_at || '',
            };
          });
          setRecords(mapped);
        } else {
          // Zero rows in DB -> empty list, no fake mock data
          setRecords([]);
        }
      } catch (err) {
        if (!isMounted) return;
        console.warn('Financial records fetch note:', err);
        setRecords([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadBookings();

    return () => {
      isMounted = false;
    };
  }, []);

  // ───────────────────────────────────────────────────────────────────────────
  // FILTERING LOGIC
  // ───────────────────────────────────────────────────────────────────────────
  const filteredRecords = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const currentMonthPrefix = today.slice(0, 7);

    return records.filter((r) => {
      // Status Filter
      if (statusFilter === 'Fully Settled' && (!r.isFullyPaid && r.remainingBalance > 0)) return false;
      if (statusFilter === 'Balance Due' && (r.isFullyPaid || r.remainingBalance === 0)) return false;
      if (statusFilter === 'Pending Deposit' && r.paymentStatus !== 'pending') return false;
      if (statusFilter === 'Confirmed' && r.paymentStatus !== 'paid' && r.paymentStatus !== 'confirmed') return false;
      if (statusFilter === 'Cancelled' && r.paymentStatus !== 'cancelled') return false;

      // Channel Filter
      if (channelFilter !== 'All' && !r.paymentChannel.toLowerCase().includes(channelFilter.toLowerCase())) {
        return false;
      }

      // Date Range Filter
      if (dateRangeFilter === 'This Month' && !r.eventDate.startsWith(currentMonthPrefix)) return false;
      if (dateRangeFilter === 'Upcoming' && r.eventDate < today) return false;
      if (dateRangeFilter === 'Past' && r.eventDate >= today) return false;

      // Search Query
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesRef = r.refNumber.toLowerCase().includes(q);
        const matchesClient = r.customerName.toLowerCase().includes(q);
        const matchesPkg = r.packageName.toLowerCase().includes(q);
        const matchesVenue = r.venueAddress.toLowerCase().includes(q);
        const matchesEmail = r.customerEmail.toLowerCase().includes(q);
        if (!matchesRef && !matchesClient && !matchesPkg && !matchesVenue && !matchesEmail) return false;
      }

      return true;
    });
  }, [records, search, statusFilter, channelFilter, dateRangeFilter]);

  // Overall Financial Summary across filtered results
  const summary = useMemo(() => calculateFinancialSummary(filteredRecords), [filteredRecords]);

  // Pagination Slice
  const totalPages = Math.ceil(filteredRecords.length / pageSize) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, currentPage, pageSize]);

  // ───────────────────────────────────────────────────────────────────────────
  // EXPORT HANDLERS
  // ───────────────────────────────────────────────────────────────────────────
  const handleExportExcel = () => {
    exportFinancialLedgerToExcel(filteredRecords, 'BINHI_Financial_Ledger');
    setExportFeedback({ type: 'xlsx', count: filteredRecords.length });
  };

  const handleExportCSV = () => {
    exportFinancialLedgerToCSV(filteredRecords, 'BINHI_Financial_Ledger');
    setExportFeedback({ type: 'csv', count: filteredRecords.length });
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#24252c]/[0.06]">
        <div>
          <MonoBadge icon={IconTicket}>Financial Management</MonoBadge>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ink)] mt-1.5">
            Financial Ledger & Revenue Reports
          </h1>
          <p className="text-xs text-[#24252c]/60 mt-1">
            Reconciliation ledger: gross bookings, advance deposits, outstanding receivables, and logistics costs.
          </p>
        </div>

        {/* Action Export Buttons */}
        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          <button
            onClick={() => go('admin-bookings')}
            className="px-4 py-2 rounded-full bg-[var(--mist)] hover:bg-gray-200 text-[var(--ink)] border border-[#24252c]/10 text-xs font-semibold transition-colors cursor-pointer"
          >
            Manage Bookings →
          </button>

          <button
            onClick={handleExportExcel}
            disabled={filteredRecords.length === 0}
            className="px-4 py-2 rounded-full bg-[var(--ink)] hover:bg-[var(--ink-soft)] text-white text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-40"
            title="Download formatted Excel spreadsheet (.xlsx)"
          >
            <IconFileSpreadsheet className="w-3.5 h-3.5 text-white" />
            <span>Export Excel</span>
          </button>

          <button
            onClick={handleExportCSV}
            disabled={filteredRecords.length === 0}
            className="px-3.5 py-2 rounded-full bg-white hover:bg-gray-50 text-[var(--ink)] border border-[#24252c]/15 text-xs font-semibold transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
            title="Download universal CSV file"
          >
            <IconDownload className="w-3.5 h-3.5 text-[#24252c]/60" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* 4 Core Financial Summary Cards - Formal Institutional Styling */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Gross Sales */}
        <div className="bg-white p-5 rounded-2xl border border-[#24252c]/[0.08] shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-bold text-[#24252c]/50 uppercase tracking-wider">
            <span>Gross Revenue</span>
            <span className="text-[10px] text-[#24252c]/40 font-semibold">{summary.totalBookings} records</span>
          </div>
          <div className="text-2xl font-black text-[var(--ink)] mt-2">
            ₱{summary.totalSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-[#24252c]/55 mt-1">
            Total non-cancelled reservation value
          </p>
        </div>

        {/* Deposits Collected */}
        <div className="bg-white p-5 rounded-2xl border border-[#24252c]/[0.08] shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-bold text-[#24252c]/50 uppercase tracking-wider">
            <span>Deposits Secured</span>
            <span className="text-[10px] text-emerald-700 font-bold">
              {summary.totalSales > 0 ? `${Math.round((summary.depositsCollected / summary.totalSales) * 100)}%` : '0%'}
            </span>
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-2">
            ₱{summary.depositsCollected.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-[#24252c]/55 mt-1">
            Advance payments received & verified
          </p>
        </div>

        {/* Pending Receivables */}
        <div className="bg-white p-5 rounded-2xl border border-[#24252c]/[0.08] shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-bold text-[#24252c]/50 uppercase tracking-wider">
            <span>Outstanding Balance</span>
            <span className="text-[10px] text-amber-700 font-bold">{summary.pendingCount} pending</span>
          </div>
          <div className="text-2xl font-black text-amber-700 mt-2">
            ₱{summary.pendingBalances.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-[#24252c]/55 mt-1">
            Due on or before event setup
          </p>
        </div>

        {/* Transport Costs */}
        <div className="bg-white p-5 rounded-2xl border border-[#24252c]/[0.08] shadow-xs">
          <div className="flex items-center justify-between text-[11px] font-bold text-[#24252c]/50 uppercase tracking-wider">
            <span>Logistics & Transport</span>
            <span className="text-[10px] text-[#24252c]/40 font-semibold">Allocation</span>
          </div>
          <div className="text-2xl font-black text-[var(--ink)] mt-2">
            ₱{summary.transportFees.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-[#24252c]/55 mt-1">
            Venue trucking & delivery component
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#24252c]/[0.08] shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <IconSearch className="w-3.5 h-3.5 text-[#24252c]/40 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search reference #, client name, package, or venue..."
              className="w-full rounded-full border border-[#24252c]/10 pl-9 pr-4 py-2 text-xs bg-[var(--mist)] text-[var(--ink)] placeholder:text-[#24252c]/40 focus:outline-none focus:border-[#1090F8] transition-colors"
            />
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Payment Status Dropdown */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3.5 py-2 rounded-full border border-[#24252c]/10 bg-[var(--mist)] text-xs font-semibold text-[var(--ink)] focus:outline-none focus:border-[#1090F8] cursor-pointer"
            >
              <option value="All">All Statuses</option>
              <option value="Fully Settled">Fully Settled (100%)</option>
              <option value="Balance Due">Has Balance Due</option>
              <option value="Confirmed">Confirmed Deposits</option>
              <option value="Pending Deposit">Pending Approval</option>
              <option value="Cancelled">Cancelled</option>
            </select>

            {/* Date Range Dropdown */}
            <select
              value={dateRangeFilter}
              onChange={(e) => {
                setDateRangeFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3.5 py-2 rounded-full border border-[#24252c]/10 bg-[var(--mist)] text-xs font-semibold text-[var(--ink)] focus:outline-none focus:border-[#1090F8] cursor-pointer"
            >
              <option value="All">All Event Dates</option>
              <option value="This Month">This Month</option>
              <option value="Upcoming">Upcoming Events</option>
              <option value="Past">Past Events</option>
            </select>

            {/* Reset Filters */}
            {(search || statusFilter !== 'All' || dateRangeFilter !== 'All' || channelFilter !== 'All') && (
              <button
                onClick={() => {
                  setSearch('');
                  setStatusFilter('All');
                  setDateRangeFilter('All');
                  setChannelFilter('All');
                  setCurrentPage(1);
                }}
                className="text-xs text-[#24252c]/60 hover:text-[var(--ink)] font-semibold px-3 py-1.5 rounded-full bg-[var(--mist)] hover:bg-gray-200 transition-colors cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Sub-bar showing active count */}
        <div className="text-[11px] text-[#24252c]/50 flex items-center justify-between pt-2 border-t border-[#24252c]/[0.06]">
          <span>
            Showing <strong>{filteredRecords.length}</strong> matching ledger rows
          </span>
          <span className="font-bold text-[var(--ink)]">
            Subtotal: ₱{summary.totalSales.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Financial Ledger Table */}
      <div className="bg-white rounded-2xl border border-[#24252c]/[0.08] shadow-xs overflow-hidden">
        <div className="p-4 border-b border-[#24252c]/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconFileSpreadsheet className="w-4 h-4 text-[#24252c]/70" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--ink)]">
              Transaction Breakdown
            </h2>
          </div>
          <span className="text-[11px] text-[#24252c]/40 font-semibold">
            Itemized Ledger
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-[#24252c]/50 space-y-2">
            <div className="inline-block w-5 h-5 border-2 border-[#1090F8] border-t-transparent rounded-full animate-spin" />
            <div>Loading accounting ledger records...</div>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-10 text-center">
            <EmptyState
              icon={IconShield}
              title="No Ledger Records Found"
              description="No booking transactions match your selected search or date criteria."
            />
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[var(--mist)] text-[#24252c]/60 text-[10px] font-extrabold uppercase tracking-wider border-b border-[#24252c]/[0.06]">
                    <th className="py-4 px-5">Ref #</th>
                    <th className="py-4 px-5">Event Date</th>
                    <th className="py-4 px-5">Client / Contact</th>
                    <th className="py-4 px-5">Package Details</th>
                    <th className="py-4 px-5 text-right">Transport</th>
                    <th className="py-4 px-5 text-right">Deposit Paid</th>
                    <th className="py-4 px-5 text-right">Balance Due</th>
                    <th className="py-4 px-5 text-right">Gross Total</th>
                    <th className="py-4 px-5 text-center">Settlement Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#24252c]/[0.04]">
                  {paginatedRecords.map((r) => (
                    <tr key={r.id} className="hover:bg-[var(--mist)]/50 transition-colors">
                      <td className="py-3.5 px-5 font-bold text-[#1090F8]">
                        {r.refNumber}
                      </td>
                      <td className="py-3.5 px-5 text-[#24252c]/80 whitespace-nowrap font-medium">
                        {formatDisplayDate(r.eventDate)}
                      </td>
                      <td className="py-3.5 px-5">
                        <div className="font-bold text-[var(--ink)]">{r.customerName}</div>
                        <div className="text-[10px] text-[#24252c]/45 mt-0.5">{r.customerPhone || r.customerEmail || '—'}</div>
                      </td>
                      <td className="py-3.5 px-5 max-w-xs truncate text-[#24252c]/75" title={r.packageName}>
                        {r.packageName}
                      </td>
                      <td className="py-3.5 px-5 text-right font-medium text-[#24252c]/70">
                        ₱{r.transportFee.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-5 text-right text-emerald-700 font-semibold">
                        ₱{r.depositAmount.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        {r.remainingBalance > 0 ? (
                          <span className="text-amber-700 font-semibold">
                            ₱{r.remainingBalance.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-emerald-700 font-medium">₱0</span>
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-right font-extrabold text-[var(--ink)]">
                        ₱{r.totalCost.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-5 text-center whitespace-nowrap">
                        {r.paymentStatus === 'cancelled' ? (
                          <span className="inline-block text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                            Cancelled
                          </span>
                        ) : r.isFullyPaid || r.remainingBalance === 0 ? (
                          <span className="inline-block text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Fully Settled
                          </span>
                        ) : r.depositAmount > 0 ? (
                          <span className="inline-block text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                            Balance Due
                          </span>
                        ) : (
                          <span className="inline-block text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700 border border-gray-200">
                            Pending Deposit
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View - Bookings Manager Style */}
            <div className="block sm:hidden divide-y divide-[#24252c]/[0.06] p-2">
              {paginatedRecords.map((r) => (
                <div key={r.id} className="p-4 space-y-3 rounded-2xl hover:bg-[var(--mist)]/40 transition-colors">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <span className="font-bold text-xs text-[#1090F8]">{r.refNumber}</span>
                      <h4 className="font-extrabold text-sm text-[var(--ink)] mt-0.5">{r.customerName}</h4>
                      <div className="text-[11px] text-[#24252c]/65">{r.packageName}</div>
                    </div>
                    {r.paymentStatus === 'cancelled' ? (
                      <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 shrink-0">
                        Cancelled
                      </span>
                    ) : r.isFullyPaid || r.remainingBalance === 0 ? (
                      <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                        Fully Settled
                      </span>
                    ) : r.depositAmount > 0 ? (
                      <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                        Balance Due
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700 border border-gray-200 shrink-0">
                        Pending Deposit
                      </span>
                    )}
                  </div>

                  <div className="text-xs space-y-1 py-2 px-3 rounded-xl bg-[var(--mist)]/70 text-[#24252c]/75">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[#24252c]/50 text-[10px] uppercase font-semibold">Event Date:</span>
                      <span className="font-semibold text-[var(--ink)]">{formatDisplayDate(r.eventDate)}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[#24252c]/50 text-[10px] uppercase font-semibold">Gross Total:</span>
                      <span className="font-extrabold text-[var(--ink)]">₱{r.totalCost.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-[#24252c]/50 text-[10px] uppercase font-semibold">Deposit Paid:</span>
                      <span className="font-bold text-emerald-700">₱{r.depositAmount.toLocaleString()}</span>
                    </div>
                    {r.remainingBalance > 0 && (
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-[#24252c]/50 text-[10px] uppercase font-semibold">Balance Due:</span>
                        <span className="font-bold text-amber-700">₱{r.remainingBalance.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Pagination Footer */}
        {filteredRecords.length > pageSize && (
          <div className="p-4 border-t border-[#24252c]/[0.06]">
            <TablePagination
              currentPage={currentPage}
              onPageChange={setCurrentPage}
              pageSize={pageSize}
              onPageSizeChange={(sz) => {
                setPageSize(sz);
                setCurrentPage(1);
              }}
              totalItems={filteredRecords.length}
            />
          </div>
        )}
      </div>

      {/* Export Confirmation Toast */}
      {exportFeedback && (
        <div className="fixed bottom-6 right-6 z-50 bg-[var(--ink)] text-white p-4 rounded-xl shadow-xl border border-white/10 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-3 duration-200 text-xs">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold shrink-0">
            <IconCheck className="w-4 h-4" />
          </div>
          <div className="space-y-0.5 pr-2">
            <strong className="block text-white font-semibold">
              {exportFeedback.type === 'xlsx' ? 'Excel File Exported' : 'CSV File Exported'}
            </strong>
            <p className="text-white/70 text-[11px]">
              {exportFeedback.count} accounting ledger records downloaded.
            </p>
          </div>
          <button
            onClick={() => setExportFeedback(null)}
            className="text-white/60 hover:text-white p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
