import * as XLSX from 'xlsx';

export interface FinancialBookingRecord {
  id: string;
  dbId?: string;
  refNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  packageName: string;
  eventDate: string;
  venueAddress: string;
  paymentStatus: string;
  isFullyPaid: boolean;
  transportFee: number;
  depositAmount: number;
  remainingBalance: number;
  totalCost: number;
  paymentChannel: string;
  bookingSource: string;
  balanceMethod?: string;
  createdAt: string;
}

export interface FinancialLedgerSummary {
  totalSales: number;
  depositsCollected: number;
  pendingBalances: number;
  transportFees: number;
  totalBookings: number;
  fullyPaidCount: number;
  pendingCount: number;
}

/**
 * Computes financial ledger metrics from raw booking records.
 */
export function calculateFinancialSummary(records: FinancialBookingRecord[]): FinancialLedgerSummary {
  let totalSales = 0;
  let depositsCollected = 0;
  let pendingBalances = 0;
  let transportFees = 0;
  let fullyPaidCount = 0;
  let pendingCount = 0;

  records.forEach((b) => {
    // Only count non-cancelled bookings in financial ledger totals
    if (b.paymentStatus.toLowerCase() !== 'cancelled') {
      totalSales += b.totalCost || 0;
      depositsCollected += b.depositAmount || 0;
      pendingBalances += b.remainingBalance || 0;
      transportFees += b.transportFee || 0;

      if (b.isFullyPaid || b.remainingBalance === 0) {
        fullyPaidCount += 1;
      } else {
        pendingCount += 1;
      }
    }
  });

  return {
    totalSales,
    depositsCollected,
    pendingBalances,
    transportFees,
    totalBookings: records.length,
    fullyPaidCount,
    pendingCount,
  };
}

/**
 * Generates and downloads a multi-sheet, beautifully formatted Excel (.xlsx) file.
 * Compatible with Microsoft Excel, Google Sheets, and LibreOffice.
 */
export function exportFinancialLedgerToExcel(
  records: FinancialBookingRecord[],
  filenamePrefix = 'BINHI_Financial_Ledger'
): void {
  const summary = calculateFinancialSummary(records);
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  // ───────────────────────────────────────────────────────────────────────────
  // SHEET 1: EXECUTIVE REVENUE & FINANCIAL SUMMARY
  // ───────────────────────────────────────────────────────────────────────────
  const summaryRows: (string | number)[][] = [
    ['BINHI CONCEPT - SYSTEM FINANCIAL LEDGER & REVENUE REPORT'],
    [`Generated On: ${dateStr} at ${timeStr}`],
    ['Report Type: Accounting & Bookings Revenue Audit'],
    [],
    ['KEY FINANCIAL METRICS', 'AMOUNT (PHP)', 'NOTES / ACCOUNTING STATUS'],
    ['Gross Revenue / Total Sales', summary.totalSales, 'Total value of all confirmed & completed bookings'],
    ['Total Deposits Collected', summary.depositsCollected, 'Advance initial payments received'],
    ['Total Pending Balances', summary.pendingBalances, 'Receivables due on event day / balance settlement'],
    ['Total Transport Fees Collected', summary.transportFees, 'Logistics & delivery charges included in sales'],
    [],
    ['OPERATIONAL BOOKING COUNTS', 'COUNT', 'STATUS BREAKDOWN'],
    ['Total Bookings Recorded', summary.totalBookings, 'Active & past event reservations'],
    ['Fully Paid Bookings', summary.fullyPaidCount, '100% balance settled'],
    ['Pending Balance Bookings', summary.pendingCount, 'Awaiting final payment turnover'],
    [],
    ['BREAKDOWN BY PAYMENT CHANNEL', 'TOTAL SALES (PHP)', 'TRANSACTIONS COUNT'],
  ];

  // Group by payment channel
  const channelMap = new Map<string, { total: number; count: number }>();
  records.forEach((r) => {
    if (r.paymentStatus.toLowerCase() !== 'cancelled') {
      const ch = r.paymentChannel || 'PayMongo';
      const existing = channelMap.get(ch) || { total: 0, count: 0 };
      existing.total += r.totalCost;
      existing.count += 1;
      channelMap.set(ch, existing);
    }
  });

  channelMap.forEach((val, key) => {
    summaryRows.push([key, val.total, `${val.count} bookings`]);
  });

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);

  // Set column widths for summary sheet
  wsSummary['!cols'] = [
    { wch: 38 }, // Col A
    { wch: 22 }, // Col B
    { wch: 48 }, // Col C
  ];

  // ───────────────────────────────────────────────────────────────────────────
  // SHEET 2: DETAILED BOOKINGS TRANSACTION LEDGER
  // ───────────────────────────────────────────────────────────────────────────
  const headers = [
    'Booking Reference',
    'Event Date',
    'Customer Name',
    'Customer Email',
    'Customer Phone',
    'Package / Setup Name',
    'Venue Address',
    'Payment Status',
    'Is Fully Paid',
    'Transport Fee (PHP)',
    'Deposit Amount (PHP)',
    'Pending Balance (PHP)',
    'Total Cost (PHP)',
    'Payment Channel',
    'Booking Source',
    'Balance Payment Method',
    'Booking Created Date',
  ];

  const transactionData = records.map((r) => [
    r.refNumber || r.id,
    r.eventDate,
    r.customerName,
    r.customerEmail,
    r.customerPhone,
    r.packageName,
    r.venueAddress,
    r.paymentStatus.toUpperCase(),
    r.isFullyPaid ? 'YES' : 'NO',
    r.transportFee,
    r.depositAmount,
    r.remainingBalance,
    r.totalCost,
    r.paymentChannel,
    r.bookingSource,
    r.balanceMethod || 'N/A',
    r.createdAt ? r.createdAt.split('T')[0] : 'N/A',
  ]);

  const wsTransactions = XLSX.utils.aoa_to_sheet([headers, ...transactionData]);

  // Set column widths so data is never clipped in Excel
  wsTransactions['!cols'] = [
    { wch: 20 }, // Ref
    { wch: 14 }, // Date
    { wch: 24 }, // Customer
    { wch: 28 }, // Email
    { wch: 16 }, // Phone
    { wch: 30 }, // Package
    { wch: 38 }, // Venue
    { wch: 16 }, // Status
    { wch: 14 }, // Fully Paid
    { wch: 20 }, // Transport Fee
    { wch: 20 }, // Deposit
    { wch: 22 }, // Balance
    { wch: 20 }, // Total Cost
    { wch: 20 }, // Channel
    { wch: 16 }, // Source
    { wch: 24 }, // Balance Method
    { wch: 18 }, // Created At
  ];

  // ───────────────────────────────────────────────────────────────────────────
  // BUILD WORKBOOK & TRIGGER DOWNLOAD
  // ───────────────────────────────────────────────────────────────────────────
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Financial Summary');
  XLSX.utils.book_append_sheet(wb, wsTransactions, 'Booking Ledger');

  XLSX.writeFile(wb, `${filenamePrefix}_${dateStr}.xlsx`);
}

/**
 * Generates and downloads a clean CSV file with UTF-8 BOM so Excel opens it with perfect columns.
 */
export function exportFinancialLedgerToCSV(
  records: FinancialBookingRecord[],
  filenamePrefix = 'BINHI_Financial_Ledger'
): void {
  const dateStr = new Date().toISOString().split('T')[0];

  const headers = [
    'Booking Reference',
    'Event Date',
    'Customer Name',
    'Customer Email',
    'Customer Phone',
    'Package Name',
    'Venue Address',
    'Payment Status',
    'Fully Paid',
    'Transport Fee (PHP)',
    'Deposit Amount (PHP)',
    'Pending Balance (PHP)',
    'Total Cost (PHP)',
    'Payment Channel',
    'Booking Source',
    'Created At',
  ];

  const escapeCSV = (val: unknown) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = records.map((r) => [
    escapeCSV(r.refNumber || r.id),
    escapeCSV(r.eventDate),
    escapeCSV(r.customerName),
    escapeCSV(r.customerEmail),
    escapeCSV(r.customerPhone),
    escapeCSV(r.packageName),
    escapeCSV(r.venueAddress),
    escapeCSV(r.paymentStatus),
    escapeCSV(r.isFullyPaid ? 'YES' : 'NO'),
    r.transportFee,
    r.depositAmount,
    r.remainingBalance,
    r.totalCost,
    escapeCSV(r.paymentChannel),
    escapeCSV(r.bookingSource),
    escapeCSV(r.createdAt ? r.createdAt.split('T')[0] : ''),
  ]);

  // \uFEFF is the UTF-8 Byte Order Mark that forces Microsoft Excel to render UTF-8 properly
  const csvContent = '\uFEFF' + [headers.map(escapeCSV).join(','), ...rows.map((row) => row.join(','))].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filenamePrefix}_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
