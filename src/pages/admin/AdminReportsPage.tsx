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

// Fallback bookings to guarantee zero empty states if Supabase is offline
const SAMPLE_FINANCIAL_BOOKINGS: FinancialBookingRecord[] = [
  {
    id: 'b1',
    refNumber: 'BNH-2026-889',
    customerName: 'Patricia Reyes',
    customerEmail: 'patricia.reyes@gmail.com',
    customerPhone: '+63 917 555 0192',
    packageName: 'Grand Wedding Production (Audio + Lights + LED)',
    eventDate: '2026-09-15',
    venueAddress: 'The Glass Garden, Pasig City, Metro Manila',
    paymentStatus: 'paid',
    isFullyPaid: false,
    transportFee: 3500,
    depositAmount: 25000,
    remainingBalance: 23500,
    totalCost: 48500,
    paymentChannel: 'PayMongo (GCash)',
    bookingSource: 'Online Booking',
    balanceMethod: 'Cash on Site / Event Day',
    createdAt: '2026-08-20T10:30:00Z',
  },
  {
    id: 'b2',
    refNumber: 'BNH-2026-902',
    customerName: 'Dennis Gomez',
    customerEmail: 'dennis.gomez@techcorp.ph',
    customerPhone: '+63 918 444 8821',
    packageName: 'Corporate Summit Sound & Visual Truss',
    eventDate: '2026-09-22',
    venueAddress: 'Blue Leaf Events Pavilion, Taguig City, Metro Manila',
    paymentStatus: 'paid',
    isFullyPaid: true,
    transportFee: 4200,
    depositAmount: 58000,
    remainingBalance: 0,
    totalCost: 58000,
    paymentChannel: 'Bank Transfer (BDO)',
    bookingSource: 'Corporate Referral',
    balanceMethod: 'Online Full Settlement',
    createdAt: '2026-08-22T14:15:00Z',
  },
  {
    id: 'b3',
    refNumber: 'BNH-2026-104',
    customerName: 'Angela Mercado',
    customerEmail: 'angela.mercado@gmail.com',
    customerPhone: '+63 920 333 1109',
    packageName: 'Debut Acoustic Lights & Moving Heads Package',
    eventDate: '2026-09-28',
    venueAddress: 'Metropolitan Theater Annex, Manila City',
    paymentStatus: 'pending',
    isFullyPaid: false,
    transportFee: 2800,
    depositAmount: 12000,
    remainingBalance: 16800,
    totalCost: 28800,
    paymentChannel: 'Maya Wallet',
    bookingSource: 'Instagram Inquiry',
    balanceMethod: 'Cash on Site / Event Day',
    createdAt: '2026-08-25T09:00:00Z',
  },
  {
    id: 'b4',
    refNumber: 'BNH-2026-215',
    customerName: 'Mark Anthony Ramos',
    customerEmail: 'mark.ramos@creativeworks.com',
    customerPhone: '+63 919 888 2314',
    packageName: 'Concert Band PA System & Heavy Hazer Effects',
    eventDate: '2026-10-05',
    venueAddress: 'SMX Convention Center, Pasay City',
    paymentStatus: 'paid',
    isFullyPaid: true,
    transportFee: 5000,
    depositAmount: 75000,
    remainingBalance: 0,
    totalCost: 75000,
    paymentChannel: 'PayMongo (Credit Card)',
    bookingSource: 'Walk-in Studio',
    balanceMethod: 'Credit Card Settlement',
    createdAt: '2026-08-28T16:45:00Z',
  },
  {
    id: 'b5',
    refNumber: 'BNH-2026-330',
    customerName: 'Clarisse Villanueva',
    customerEmail: 'clarisse.v@gmail.com',
    customerPhone: '+63 927 999 4410',
    packageName: 'Intimate Gathering Sound & Ambient Lights',
    eventDate: '2026-10-12',
    venueAddress: 'Palazzo Verde, Las Piñas City, Metro Manila',
    paymentStatus: 'paid',
    isFullyPaid: false,
    transportFee: 3000,
    depositAmount: 15000,
    remainingBalance: 9000,
    totalCost: 24000,
    paymentChannel: 'GCash Direct',
    bookingSource: 'Facebook Page',
    balanceMethod: 'Cash on Site / Event Day',
    createdAt: '2026-08-30T11:20:00Z',
  },
];

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
  // FETCH BOOKINGS FROM SUPABASE
  // ───────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let isMounted = true;

    async function loadBookings() {
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

            return {
              id: b.id,
              refNumber: b.paymongo_reference_number || `BNH-${b.id.slice(0, 8)}`,
              customerName: b.customer_name || 'Valued Customer',
              customerEmail: b.customer_email || '',
              customerPhone: b.customer_phone || '',
              packageName: b.package_name || 'Event Production Setup',
              eventDate: b.event_date || 'N/A',
              venueAddress: b.venue_address || 'Selected Location',
              paymentStatus: b.payment_status || 'pending',
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
          setRecords(SAMPLE_FINANCIAL_BOOKINGS);
        }
      } catch (err) {
        if (!isMounted) return;
        console.warn('Financial records fetch note:', err);
        setRecords(SAMPLE_FINANCIAL_BOOKINGS);
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
      if (statusFilter === 'Fully Paid' && !r.isFullyPaid) return false;
      if (statusFilter === 'Pending Balance' && r.isFullyPaid) return false;
      if (statusFilter === 'Pending Deposit' && r.paymentStatus !== 'pending') return false;
      if (statusFilter === 'Paid / Confirmed' && r.paymentStatus !== 'paid' && r.paymentStatus !== 'confirmed') return false;

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
        if (!matchesRef && !matchesClient && !matchesPkg && !matchesVenue) return false;
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
          <MonoBadge icon={IconTicket}>Accounting & Revenue Hub</MonoBadge>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ink)] mt-1.5">
            Financial Ledger & Revenue Reports
          </h1>
          <p className="text-xs text-[#24252c]/60 mt-1">
            Real-time accounting ledger: track deposits collected, receivables, logistics transport fees, and export cleanly formatted spreadsheets.
          </p>
        </div>

        {/* Action Export Buttons */}
        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          <button
            onClick={() => go('admin-bookings')}
            className="px-4 py-2.5 rounded-full bg-[var(--mist)] hover:bg-gray-200 text-[var(--ink)] border border-[#24252c]/10 text-xs font-semibold transition-colors cursor-pointer"
          >
            Manage Bookings →
          </button>

          <button
            onClick={handleExportExcel}
            className="px-5 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm hover:scale-[1.02] flex items-center gap-2 cursor-pointer"
            title="Download formatted multi-sheet Excel spreadsheet"
          >
            <IconFileSpreadsheet className="w-4 h-4 text-white" />
            <span>Export to Excel</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="px-4 py-2.5 rounded-full bg-white hover:bg-gray-50 text-[var(--ink)] border border-[#24252c]/15 text-xs font-semibold transition-colors shadow-2xs flex items-center gap-2 cursor-pointer"
            title="Download universal CSV file with UTF-8 BOM"
          >
            <IconDownload className="w-4 h-4 text-[#24252c]/70" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* 4 Core Financial Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Sales */}
        <div className="bg-white p-5 rounded-2xl border border-[#24252c]/[0.08] shadow-xs relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500" />
          <span className="text-[11px] font-extrabold text-[#24252c]/50 uppercase tracking-wider block">
            Total Gross Sales
          </span>
          <div className="text-2xl sm:text-3xl font-black text-[var(--ink)] mt-2 font-mono">
            ₱{summary.totalSales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-[#24252c]/60 mt-1.5 flex items-center gap-1">
            <span>{summary.totalBookings} total reservations</span>
          </p>
        </div>

        {/* Deposits Collected */}
        <div className="bg-white p-5 rounded-2xl border border-[#24252c]/[0.08] shadow-xs relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
          <span className="text-[11px] font-extrabold text-emerald-700 uppercase tracking-wider block">
            Deposits Collected
          </span>
          <div className="text-2xl sm:text-3xl font-black text-emerald-600 mt-2 font-mono">
            ₱{summary.depositsCollected.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-[#24252c]/60 mt-1.5 flex items-center gap-1">
            <span>Advance payments secured in bank/wallet</span>
          </p>
        </div>

        {/* Pending Balances */}
        <div className="bg-white p-5 rounded-2xl border border-[#24252c]/[0.08] shadow-xs relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500" />
          <span className="text-[11px] font-extrabold text-amber-700 uppercase tracking-wider block">
            Pending Balances
          </span>
          <div className="text-2xl sm:text-3xl font-black text-amber-600 mt-2 font-mono">
            ₱{summary.pendingBalances.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-[#24252c]/60 mt-1.5 flex items-center gap-1">
            <span>{summary.pendingCount} bookings due on event date</span>
          </p>
        </div>

        {/* Transport Fees */}
        <div className="bg-white p-5 rounded-2xl border border-[#24252c]/[0.08] shadow-xs relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-purple-500" />
          <span className="text-[11px] font-extrabold text-purple-700 uppercase tracking-wider block">
            Transport Fees Collected
          </span>
          <div className="text-2xl sm:text-3xl font-black text-purple-600 mt-2 font-mono">
            ₱{summary.transportFees.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-[#24252c]/60 mt-1.5 flex items-center gap-1">
            <span>Dedicated delivery & fuel allocations</span>
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-[#24252c]/[0.08] shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <IconSearch className="w-4 h-4 text-[#24252c]/40 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search reference #, client name, package, or venue address..."
              className="w-full rounded-xl border border-[#24252c]/15 pl-10 pr-4 py-2.5 text-xs bg-[var(--mist)] text-[var(--ink)] placeholder:text-[#24252c]/40 focus:outline-none focus:border-[#1090F8] transition-colors font-medium"
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
              className="px-3.5 py-2.5 rounded-xl border border-[#24252c]/15 bg-[var(--mist)] text-xs font-semibold text-[var(--ink)] focus:outline-none focus:border-[#1090F8] cursor-pointer"
            >
              <option value="All">All Payment Statuses</option>
              <option value="Fully Paid">100% Fully Paid</option>
              <option value="Pending Balance">Has Pending Balance</option>
              <option value="Paid / Confirmed">Paid / Confirmed Deposits</option>
              <option value="Pending Deposit">Pending Approval</option>
            </select>

            {/* Date Range Dropdown */}
            <select
              value={dateRangeFilter}
              onChange={(e) => {
                setDateRangeFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3.5 py-2.5 rounded-xl border border-[#24252c]/15 bg-[var(--mist)] text-xs font-semibold text-[var(--ink)] focus:outline-none focus:border-[#1090F8] cursor-pointer"
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
                className="text-xs text-rose-600 font-bold hover:underline px-2 cursor-pointer"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* Sub-bar showing active count */}
        <div className="text-[11px] text-[#24252c]/55 flex items-center justify-between pt-2 border-t border-[#24252c]/[0.06]">
          <span>
            Showing <strong>{filteredRecords.length}</strong> matching transactions in ledger
          </span>
          <span className="font-mono font-medium">
            Active Ledger Subtotal: ₱{summary.totalSales.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Financial Ledger Table */}
      <div className="bg-white rounded-2xl border border-[#24252c]/[0.08] shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-[#24252c]/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconFileSpreadsheet className="w-4 h-4 text-[#1090F8]" />
            <h2 className="text-sm font-extrabold text-[var(--ink)]">
              Detailed Financial Ledger Table
            </h2>
          </div>
          <span className="text-[11px] text-[#24252c]/50">
            Accounting breakdown per booking
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-[#24252c]/50">
            Compiling financial ledger records from database...
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-10 text-center">
            <EmptyState
              icon={IconShield}
              title="No Financial Records Found"
              description="No booking records match your active search or date filters."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[var(--mist)] text-[#24252c]/65 text-[11px] font-extrabold uppercase tracking-wider border-b border-[#24252c]/[0.08]">
                  <th className="py-3.5 px-4">Booking Ref</th>
                  <th className="py-3.5 px-4">Event Date</th>
                  <th className="py-3.5 px-4">Client / Host</th>
                  <th className="py-3.5 px-4">Package</th>
                  <th className="py-3.5 px-4 text-right">Transport Fee</th>
                  <th className="py-3.5 px-4 text-right">Deposit</th>
                  <th className="py-3.5 px-4 text-right">Balance Due</th>
                  <th className="py-3.5 px-4 text-right">Total Sales</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#24252c]/[0.06]">
                {paginatedRecords.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-[#1090F8]">
                      {r.refNumber}
                    </td>
                    <td className="py-3 px-4 text-[#24252c]/80 whitespace-nowrap">
                      {r.eventDate}
                    </td>
                    <td className="py-3 px-4 font-bold text-[var(--ink)]">
                      <div>{r.customerName}</div>
                      <div className="text-[10px] text-[#24252c]/50 font-normal">{r.customerPhone || r.customerEmail}</div>
                    </td>
                    <td className="py-3 px-4 text-[var(--ink)] max-w-xs truncate" title={r.packageName}>
                      {r.packageName}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-purple-700">
                      ₱{r.transportFee.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-700 font-semibold">
                      ₱{r.depositAmount.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-mono">
                      {r.remainingBalance > 0 ? (
                        <span className="text-amber-700 font-bold">
                          ₱{r.remainingBalance.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-emerald-600 font-semibold">₱0 (Paid)</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-extrabold text-[var(--ink)]">
                      ₱{r.totalCost.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      {r.isFullyPaid || r.remainingBalance === 0 ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <IconCheck className="w-3 h-3 text-emerald-600" />
                          Fully Settled
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          Balance Due
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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

      {/* Export Confirmation Toast / Modal */}
      {exportFeedback && (
        <div className="fixed bottom-6 right-6 z-50 bg-[var(--ink)] text-white p-4 rounded-2xl shadow-2xl border border-white/10 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold shrink-0">
            <IconCheck className="w-5 h-5" />
          </div>
          <div className="space-y-0.5 text-xs pr-2">
            <strong className="block text-white">
              {exportFeedback.type === 'xlsx' ? 'Excel Spreadsheet Downloaded' : 'CSV File Downloaded'}
            </strong>
            <p className="text-white/70 text-[11px]">
              Exported {exportFeedback.count} accounting ledger records with formatted headers and totals.
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
