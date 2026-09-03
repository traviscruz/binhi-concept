import { useState, useEffect } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import { IconCalendar, IconX, IconSearch } from '../../components/shared/icons';
import { ModalOverlay } from '../../components/shared/ModalOverlay';
import { EmptyState } from '../../components/shared/EmptyState';
import { supabase } from '../../lib/supabase';

const inputClass =
  'w-full rounded-full border px-4 py-2.5 text-xs bg-[#EEEEEE] text-[var(--ink)] placeholder:text-[#24252c]/40 focus:outline-none focus:border-[#1090F8] border-transparent transition-colors';

export default function AdminBookingsPage({ go }: { go: (p: Page) => void }) {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null);
  const [rescheduleBooking, setRescheduleBooking] = useState<any | null>(null);
  const [newRescheduleDate, setNewRescheduleDate] = useState('');
  const [cancelBookingId, setCancelBookingId] = useState<string | null>(null);

  // ── Full Payment Settlement Modal State ─────────────────────────────────
  const [settleModalBooking, setSettleModalBooking] = useState<any | null>(null);
  const [isFullyPaidInput, setIsFullyPaidInput] = useState(true);
  const [balanceMethodInput, setBalanceMethodInput] = useState('Cash on Site / Event Day');
  const [customMethodInput, setCustomMethodInput] = useState('');
  const [balanceReceiptFile, setBalanceReceiptFile] = useState<File | null>(null);
  const [balanceReceiptPreview, setBalanceReceiptPreview] = useState<string>('');
  const [savingBalance, setSavingBalance] = useState(false);

  const loadBookings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setBookings(
          data.map((b: any) => {
            const total = Number(b.total_cost) || 0;
            const deposit = Number(b.deposit_amount) || 0;
            const defaultRemaining = Math.max(0, total - deposit);
            const isFull = b.is_fully_paid === true;
            const remBal = isFull ? 0 : defaultRemaining;

            const bookingSource = b.booking_source || 
              (b.payment_channel?.toLowerCase().includes('walk-in') ? 'Walk-in' :
               b.payment_channel?.toLowerCase().includes('viber') ? 'Viber' :
               b.payment_channel?.toLowerCase().includes('facebook') ? 'Facebook' :
               b.payment_channel?.toLowerCase().includes('call') ? 'Phone Call' :
               b.payment_channel?.toLowerCase().includes('instagram') ? 'Instagram' :
               b.payment_channel?.toLowerCase().includes('whatsapp') ? 'WhatsApp' :
               'Online Booking');

            return {
              dbId: b.id,
              id: b.paymongo_reference_number || `BNH-${b.id.slice(0, 8)}`,
              customer: b.customer_name || 'Valued Customer',
              email: b.customer_email || 'customer@binhiconcept.ph',
              phone: b.customer_phone || '',
              package: b.package_name || 'Event Production Setup',
              date: b.event_date ? new Date(b.event_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Selected Date',
              rawDate: b.event_date || '',
              venue: b.venue_address || 'Selected Location',
              totalNum: total,
              depositNum: deposit,
              remainingNum: remBal,
              total: `₱${total.toLocaleString()}`,
              deposit: `₱${deposit.toLocaleString()}`,
              remaining: `₱${remBal.toLocaleString()}`,
              rawStatus: (b.payment_status || b.status || 'pending').toLowerCase(),
              status: (b.payment_status || b.status || 'pending').toLowerCase() === 'completed' ? 'Completed' : b.payment_status === 'paid' || b.payment_status === 'confirmed' ? 'Confirmed' : b.payment_status === 'cancelled' ? 'Cancelled' : 'Pending Deposit Approval',
              paymentChannel: b.payment_channel || 'PayMongo',
              bookingSource: bookingSource,
              slipRef: b.paymongo_reference_number ? `Ref #${b.paymongo_reference_number}` : 'Deposit Pending',
              isFullyPaid: isFull,
              balancePaymentMethod: b.balance_payment_method || 'Cash on Site / Event Day',
              balanceReceiptUrl: b.balance_receipt_url || '',
              depositReceiptUrl: b.deposit_receipt_url || b.balance_receipt_url || '',
              balancePaidAt: b.balance_paid_at ? new Date(b.balance_paid_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '',
            };
          })
        );
      }
    } catch (err) {
      console.error('Error loading admin bookings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBookings();
  }, []);

  const filtered = bookings.filter((b) => {
    const matchesStatus = statusFilter === 'All' || b.status.toLowerCase().includes(statusFilter.toLowerCase());
    const matchesSearch =
      b.id.toLowerCase().includes(search.toLowerCase()) ||
      b.customer.toLowerCase().includes(search.toLowerCase()) ||
      b.package.toLowerCase().includes(search.toLowerCase()) ||
      (b.bookingSource && b.bookingSource.toLowerCase().includes(search.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  const handleStatusChange = async (dbId: string, newStatus: string) => {
    try {
      await supabase
        .from('bookings')
        .update({ payment_status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', dbId);
      loadBookings();
    } catch (err) {
      console.error('Error updating booking status:', err);
    }
  };

  const handleApproveDeposit = async (row: any) => {
    try {
      await supabase
        .from('bookings')
        .update({ payment_status: 'paid', updated_at: new Date().toISOString() })
        .eq('id', row.dbId);
      loadBookings();
    } catch (err) {
      console.error('Error approving booking deposit:', err);
    }
    setSelectedReceipt(null);
  };

  const handleConfirmCancel = async () => {
    if (!cancelBookingId) return;
    try {
      const target = bookings.find((b) => b.id === cancelBookingId);
      if (target?.dbId) {
        await supabase
          .from('bookings')
          .update({ payment_status: 'cancelled', updated_at: new Date().toISOString() })
          .eq('id', target.dbId);
        loadBookings();
      }
    } catch (err) {
      console.error('Error cancelling booking:', err);
    }
    setCancelBookingId(null);
  };

  const handleSaveReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleBooking || !newRescheduleDate) return;

    try {
      await supabase
        .from('bookings')
        .update({ event_date: newRescheduleDate, updated_at: new Date().toISOString() })
        .eq('id', rescheduleBooking.dbId);
      loadBookings();
    } catch (err) {
      console.error('Error rescheduling booking:', err);
    }

    setRescheduleBooking(null);
  };

  const handleSaveBalanceSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settleModalBooking) return;
    setSavingBalance(true);

    try {
      let receiptUrl = settleModalBooking.balanceReceiptUrl || '';

      // Upload receipt file if provided
      if (balanceReceiptFile) {
        try {
          const fileExt = balanceReceiptFile.name.split('.').pop();
          const fileName = `balance-receipts/${settleModalBooking.dbId}-${Date.now()}.${fileExt}`;
          const { data: uploadData, error: uploadErr } = await supabase.storage
            .from('booking-receipts')
            .upload(fileName, balanceReceiptFile, { upsert: true });

          if (!uploadErr && uploadData) {
            const { data: publicUrlData } = supabase.storage.from('booking-receipts').getPublicUrl(fileName);
            if (publicUrlData?.publicUrl) {
              receiptUrl = publicUrlData.publicUrl;
            }
          } else {
            receiptUrl = balanceReceiptPreview;
          }
        } catch (storageErr) {
          console.warn('Supabase storage upload fallback to preview:', storageErr);
          receiptUrl = balanceReceiptPreview;
        }
      } else if (balanceReceiptPreview) {
        receiptUrl = balanceReceiptPreview;
      }

      const finalPaymentMethod = balanceMethodInput === 'Others'
        ? (customMethodInput.trim() || 'Others')
        : balanceMethodInput;

      const originalRemaining = Math.max(0, settleModalBooking.totalNum - settleModalBooking.depositNum);

      const updateData: any = {
        is_fully_paid: isFullyPaidInput,
        remaining_balance: isFullyPaidInput ? 0 : originalRemaining,
        balance_payment_method: finalPaymentMethod,
        balance_receipt_url: receiptUrl,
        balance_paid_at: isFullyPaidInput ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      };

      await supabase
        .from('bookings')
        .update(updateData)
        .eq('id', settleModalBooking.dbId);

      await loadBookings();
      setSettleModalBooking(null);
    } catch (err) {
      console.error('Error saving balance payment:', err);
    } finally {
      setSavingBalance(false);
    }
  };

  const handleOpenSettleModal = (row: any) => {
    setSettleModalBooking(row);
    setIsFullyPaidInput(row.isFullyPaid);
    const standardMethods = [
      'Cash on Site / Event Day',
      'GCash E-Wallet',
      'Maya Wallet',
      'Bank Transfer (BDO/BPI)',
      'PayMongo Online Payment',
    ];
    const method = row.balancePaymentMethod || 'Cash on Site / Event Day';
    if (standardMethods.includes(method)) {
      setBalanceMethodInput(method);
      setCustomMethodInput('');
    } else {
      setBalanceMethodInput('Others');
      setCustomMethodInput(method);
    }
    setBalanceReceiptPreview(row.balanceReceiptUrl || '');
    setBalanceReceiptFile(null);
  };

  const activeSelectedReceipt = selectedReceipt || { id: '', customer: '', slipRef: '', deposit: '', date: '' };
  const activeRescheduleBooking = rescheduleBooking || { id: '', customer: '' };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#24252c]/[0.06]">
        <div>
          <MonoBadge icon={IconCalendar}>Bookings Management</MonoBadge>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ink)] mt-1.5">
            Customer Event Bookings
          </h1>
          <p className="text-xs text-[#24252c]/60 mt-1">
            Approve GCash/Bank deposit slips, reschedule dates, or manage active reservations.
          </p>
        </div>

        <button
          type="button"
          onClick={() => go('admin-manual-booking')}
          className="inline-flex items-center gap-2 bg-[#1090F8] text-white text-xs font-bold px-5 py-2.5 rounded-full hover:bg-[#1090F8]/90 transition-all shadow-sm hover:shadow-md cursor-pointer shrink-0"
        >
          <span className="text-base font-bold leading-none">+</span>
          <span>Manual Booking (Walk-in / Channels)</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#24252c]/[0.08] shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto">
          {['All', 'Pending', 'Confirmed', 'Completed', 'Cancelled'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`text-xs px-3.5 py-1.5 rounded-full font-medium transition-all cursor-pointer ${
                statusFilter === st
                  ? 'bg-[var(--ink)] text-white shadow-sm font-semibold'
                  : 'bg-[var(--mist)] text-[#24252c]/60 hover:text-[var(--ink)]'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <IconSearch className="w-4 h-4 text-[#24252c]/40 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search booking ID or customer..."
            className={inputClass + ' pl-10'}
          />
        </div>
      </div>

      {/* Bookings Table */}
      <div className="bg-white rounded-2xl p-5 border border-[#24252c]/[0.08] shadow-sm">
        {/* Desktop Table View */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#24252c]/[0.06] text-[#24252c]/50 uppercase tracking-wider">
                <th className="py-3 px-3 font-semibold">Booking Ref</th>
                <th className="py-3 px-3 font-semibold">Customer</th>
                <th className="py-3 px-3 font-semibold">Package & Venue</th>
                <th className="py-3 px-3 font-semibold">Event Date</th>
                <th className="py-3 px-3 font-semibold">Payment Breakdown</th>
                <th className="py-3 px-3 font-semibold">Status</th>
                {statusFilter !== 'Cancelled' && (
                  <th className="py-3 px-3 font-semibold text-right whitespace-nowrap min-w-[320px]">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#24252c]/[0.04]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={statusFilter === 'Cancelled' ? 6 : 7} className="py-4">
                    <EmptyState
                      title="No Bookings Found"
                      description="No event reservations match your current search terms or filter status."
                    />
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr key={row.id} className="hover:bg-[var(--mist)] transition-colors">
                    {/* Col 1: Booking Ref & Channel */}
                    <td className="py-3.5 px-3">
                      <div className="font-mono font-extrabold text-[#1090F8]">{row.id}</div>
                      {row.bookingSource && row.bookingSource !== 'Online Booking' ? (
                        <span className="inline-block mt-1 text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200 uppercase tracking-wider">
                          {row.bookingSource}
                        </span>
                      ) : (
                        <span className="inline-block mt-1 text-[9px] font-medium text-[#24252c]/40">
                          Website
                        </span>
                      )}
                    </td>

                    {/* Col 2: Customer */}
                    <td className="py-3.5 px-3">
                      <div className="font-bold text-[var(--ink)]">{row.customer}</div>
                      <div className="text-[10px] text-[#24252c]/50">{row.email}</div>
                      {row.phone && <div className="text-[10px] text-[#24252c]/50">{row.phone}</div>}
                    </td>

                    {/* Col 3: Package & Venue */}
                    <td className="py-3.5 px-3">
                      <div className="font-semibold text-[var(--ink)]">{row.package}</div>
                      <div className="text-[10px] text-[#24252c]/50 truncate max-w-[180px]">{row.venue}</div>
                    </td>

                    {/* Col 4: Event Date */}
                    <td className="py-3.5 px-3 font-semibold text-[var(--ink)]">{row.date}</td>

                    {/* Col 5: Payment Breakdown */}
                    <td className="py-3.5 px-3">
                      <div className="font-extrabold text-[var(--ink)]">{row.total}</div>
                      <div className="text-[10px] text-emerald-600 font-bold">50% Dep: {row.deposit}</div>
                      <div className="text-[10px] text-[#1090F8] font-bold">
                        {row.isFullyPaid ? 'Bal: ₱0' : `Bal: ${row.remaining}`}
                      </div>
                    </td>

                    {/* Col 6: Status */}
                    <td className="py-3.5 px-3">
                      <div className="flex flex-col gap-1 items-start">
                        <select
                          value={row.rawStatus}
                          onChange={(e) => handleStatusChange(row.dbId, e.target.value)}
                          className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider border cursor-pointer focus:outline-none transition-all ${
                            row.rawStatus === 'completed'
                              ? 'bg-[#1090F8]/10 text-[#1090F8] border-[#1090F8]/30'
                              : row.rawStatus === 'paid' || row.rawStatus === 'confirmed'
                              ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20'
                              : row.rawStatus === 'cancelled'
                              ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                              : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                          }`}
                        >
                          <option value="pending" className="bg-white text-[var(--ink)]">Pending</option>
                          <option value="paid" className="bg-white text-[var(--ink)]">Confirmed</option>
                          <option value="completed" className="bg-white text-[var(--ink)]">Completed</option>
                          <option value="cancelled" className="bg-white text-[var(--ink)]">Cancelled</option>
                        </select>
                        {row.isFullyPaid ? (
                          <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500 text-white uppercase tracking-wider">
                            ✓ Fully Paid (100%)
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20 uppercase tracking-wider">
                            50% Deposit Secured
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Col 7: Actions (Hidden on Cancelled Tab) */}
                    {statusFilter !== 'Cancelled' && (
                      <td className="py-3.5 px-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5 whitespace-nowrap">
                          {(row.depositReceiptUrl || row.balanceReceiptUrl) && (
                            <button
                              type="button"
                              onClick={() => setSelectedReceipt(row)}
                              className="bg-purple-50 text-purple-700 border border-purple-200 text-[11px] font-semibold px-2.5 py-1 rounded-full hover:bg-purple-100 transition-colors shadow-2xs cursor-pointer shrink-0"
                            >
                              Proof Slip
                            </button>
                          )}
                          {row.rawStatus !== 'cancelled' && (
                            <button
                              onClick={() => handleOpenSettleModal(row)}
                              className="bg-emerald-600 text-white text-[11px] font-semibold px-2.5 py-1 rounded-full hover:bg-emerald-700 transition-colors shadow-sm cursor-pointer shrink-0"
                            >
                              {row.isFullyPaid ? 'Payment Info' : 'Settle Balance'}
                            </button>
                          )}
                          {row.status.includes('Pending') && (
                            <button
                              onClick={() => setSelectedReceipt(row)}
                              className="bg-[#1090F8] text-white text-[11px] font-semibold px-2.5 py-1 rounded-full hover:bg-[#1090F8]/90 transition-colors shadow-sm cursor-pointer shrink-0"
                            >
                              Approve
                            </button>
                          )}
                          {row.rawStatus !== 'cancelled' && (
                            <button
                              onClick={() => {
                                setRescheduleBooking(row);
                                setNewRescheduleDate(row.rawDate || row.date);
                              }}
                              className="bg-[var(--mist)] text-[var(--ink)] text-[11px] font-semibold px-2.5 py-1 rounded-full border border-[#24252c]/10 hover:bg-[var(--ink)] hover:text-white transition-colors cursor-pointer shrink-0"
                            >
                              Reschedule
                            </button>
                          )}
                          {row.rawStatus !== 'cancelled' && (
                            <button
                              onClick={() => setCancelBookingId(row.id)}
                              className="bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors cursor-pointer shrink-0"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Row Cards View */}
        <div className="block sm:hidden space-y-3">
          {filtered.map((row) => (
            <div key={row.id} className="p-4 rounded-xl bg-[var(--mist)] border border-[#24252c]/[0.06] space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-mono font-extrabold text-[#1090F8]">{row.id}</span>
                  {row.bookingSource && row.bookingSource !== 'Online Booking' && (
                    <span className="ml-2 text-[9px] font-extrabold px-1.5 py-0.2 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                      {row.bookingSource}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <select
                    value={row.rawStatus}
                    onChange={(e) => handleStatusChange(row.dbId, e.target.value)}
                    className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider border cursor-pointer focus:outline-none ${
                      row.rawStatus === 'completed'
                        ? 'bg-[#1090F8]/10 text-[#1090F8] border-[#1090F8]/30'
                        : row.rawStatus === 'paid' || row.rawStatus === 'confirmed'
                        ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20'
                        : row.rawStatus === 'cancelled'
                        ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                        : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                    }`}
                  >
                    <option value="pending" className="bg-white text-[var(--ink)]">Pending</option>
                    <option value="paid" className="bg-white text-[var(--ink)]">Confirmed</option>
                    <option value="completed" className="bg-white text-[var(--ink)]">Completed</option>
                    <option value="cancelled" className="bg-white text-[var(--ink)]">Cancelled</option>
                  </select>
                  <span
                    className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                      row.isFullyPaid ? 'bg-emerald-500 text-white' : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                    }`}
                  >
                    {row.isFullyPaid ? 'Fully Paid' : `Bal: ${row.remaining}`}
                  </span>
                </div>
              </div>
              <div className="font-bold text-[var(--ink)]">{row.customer} ({row.email})</div>
              <div className="text-[11px] text-[#24252c]/70">{row.package} · Date: <strong className="text-[var(--ink)]">{row.date}</strong></div>
              <div className="text-[11px] text-[#24252c]/60">Total: <strong className="text-[var(--ink)]">{row.total}</strong> · Deposit: <strong className="text-[#1090F8]">{row.deposit}</strong></div>
              
              {statusFilter !== 'Cancelled' && (
                <div className="flex items-center gap-1.5 pt-2 border-t border-[#24252c]/10 flex-wrap">
                  {(row.depositReceiptUrl || row.balanceReceiptUrl) && (
                    <button
                      type="button"
                      onClick={() => setSelectedReceipt(row)}
                      className="bg-purple-50 text-purple-700 border border-purple-200 text-xs font-semibold px-3 py-1.5 rounded-full hover:bg-purple-100 transition-colors cursor-pointer"
                    >
                      Proof Slip
                    </button>
                  )}
                  {row.rawStatus !== 'cancelled' && (
                    <button
                      onClick={() => handleOpenSettleModal(row)}
                      className="flex-1 bg-emerald-600 text-white text-xs font-semibold py-1.5 rounded-full cursor-pointer text-center"
                    >
                      {row.isFullyPaid ? 'Payment Info' : 'Settle Balance'}
                    </button>
                  )}
                  {row.rawStatus !== 'cancelled' && (
                    <button
                      onClick={() => {
                        setRescheduleBooking(row);
                        setNewRescheduleDate(row.date);
                      }}
                      className="flex-1 bg-white border border-[#24252c]/10 text-xs font-semibold py-1.5 rounded-full cursor-pointer text-center"
                    >
                      Reschedule
                    </button>
                  )}
                  {row.rawStatus !== 'cancelled' && (
                    <button
                      onClick={() => setCancelBookingId(row.id)}
                      className="bg-rose-50 text-rose-600 border border-rose-200 text-xs font-semibold px-3 py-1.5 rounded-full hover:bg-rose-100 cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Deposit Receipt Preview Modal */}
      <ModalOverlay isOpen={!!selectedReceipt} onClose={() => setSelectedReceipt(null)}>
        <div className="bg-white rounded-[2rem] p-6 max-w-md w-full shadow-2xl border border-[#24252c]/10 relative">
          <button onClick={() => setSelectedReceipt(null)} className="absolute top-5 right-5 text-[#24252c]/50 hover:text-[var(--ink)] p-1 cursor-pointer">
            <IconX className="w-5 h-5" />
          </button>
          <h3 className="text-xl font-extrabold text-[var(--ink)] mb-1">Verify Payment / Deposit Slip</h3>
          <p className="text-xs font-mono font-bold text-[#1090F8] mb-4">{activeSelectedReceipt.id} · {activeSelectedReceipt.customer}</p>

          <div className="bg-[var(--mist)] p-4 rounded-2xl border border-[#24252c]/10 space-y-3 mb-5 text-xs">
            <div className="flex justify-between">
              <span className="text-[#24252c]/50">Payment Channel / Source:</span>
              <span className="font-bold text-[var(--ink)]">{activeSelectedReceipt.paymentChannel || activeSelectedReceipt.bookingSource || 'Direct'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#24252c]/50">Transaction / Slip Ref:</span>
              <span className="font-mono font-bold text-[var(--ink)]">{activeSelectedReceipt.slipRef}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#24252c]/50">Deposit / Paid Amount:</span>
              <span className="font-extrabold text-[#1090F8]">{activeSelectedReceipt.deposit}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#24252c]/50">Event Date:</span>
              <span className="font-semibold text-[var(--ink)]">{activeSelectedReceipt.date}</span>
            </div>

            {activeSelectedReceipt.depositReceiptUrl || activeSelectedReceipt.balanceReceiptUrl ? (
              <div className="rounded-xl bg-white border border-[#24252c]/10 overflow-hidden p-2">
                <div className="text-[10px] font-bold text-[#24252c]/50 uppercase mb-1.5 ml-1">Attached Receipt Image:</div>
                <div className="aspect-[4/3] rounded-lg overflow-hidden bg-[var(--mist)] flex items-center justify-center">
                  <img
                    src={activeSelectedReceipt.depositReceiptUrl || activeSelectedReceipt.balanceReceiptUrl}
                    alt="Proof of Payment"
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>
            ) : (
              <div className="aspect-[4/3] rounded-xl bg-white border border-[#24252c]/10 flex flex-col items-center justify-center p-4 text-center">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-600 font-bold text-lg flex items-center justify-center mb-2">
                  ✓
                </div>
                <div className="font-bold text-xs text-[var(--ink)]">Official Payment Receipt Verified</div>
                <div className="text-[10px] text-[#24252c]/50 mt-1">Amount Verified: {activeSelectedReceipt.deposit}</div>
              </div>
            )}
          </div>

          {activeSelectedReceipt.status?.includes('Pending') && (
            <button
              onClick={() => handleApproveDeposit(activeSelectedReceipt)}
              className="w-full bg-emerald-600 text-white font-semibold py-3.5 rounded-full hover:bg-emerald-700 transition-colors shadow-md cursor-pointer text-xs"
            >
              Approve Deposit & Confirm Reservation
            </button>
          )}
        </div>
      </ModalOverlay>

      {/* Reschedule Date Modal */}
      <ModalOverlay isOpen={!!rescheduleBooking} onClose={() => setRescheduleBooking(null)}>
        <div className="bg-white rounded-[2rem] p-6 max-w-md w-full shadow-2xl border border-[#24252c]/10 relative">
          <button onClick={() => setRescheduleBooking(null)} className="absolute top-5 right-5 text-[#24252c]/50 hover:text-[var(--ink)] p-1 cursor-pointer">
            <IconX className="w-5 h-5" />
          </button>
          <h3 className="text-xl font-extrabold text-[var(--ink)] mb-1">Reschedule Event Date</h3>
          <p className="text-xs font-mono font-bold text-[#1090F8] mb-4">{activeRescheduleBooking.id} · {activeRescheduleBooking.customer}</p>

          <form onSubmit={handleSaveReschedule} className="space-y-4 text-xs">
            <div>
              <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">Select New Target Date</label>
              <input
                type="date"
                value={newRescheduleDate}
                onChange={(e) => setNewRescheduleDate(e.target.value)}
                className="w-full rounded-full border border-transparent px-4 py-3 bg-[var(--mist)] text-[var(--ink)] font-bold focus:outline-none focus:border-[#1090F8]"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full bg-[var(--ink)] text-white font-semibold py-3.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors cursor-pointer"
            >
              Save New Event Date
            </button>
          </form>
        </div>
      </ModalOverlay>

      {/* Balance Settlement & Full Payment Modal */}
      <ModalOverlay isOpen={!!settleModalBooking} onClose={() => setSettleModalBooking(null)}>
        {settleModalBooking && (
          <div className="bg-white rounded-[2rem] p-6 max-w-md w-full shadow-2xl border border-[#24252c]/10 relative">
            <button
              type="button"
              onClick={() => setSettleModalBooking(null)}
              className="absolute top-5 right-5 text-[#24252c]/50 hover:text-[var(--ink)] p-1 cursor-pointer"
            >
              <IconX className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-extrabold text-[var(--ink)] mb-1">
              Settle Balance Payment
            </h3>
            <p className="text-xs font-mono font-bold text-[#1090F8] mb-4">
              {settleModalBooking.id} · {settleModalBooking.customer}
            </p>

            <div className="bg-[var(--mist)] p-4 rounded-2xl border border-[#24252c]/10 space-y-2 mb-4 text-xs">
              <div className="flex justify-between">
                <span className="text-[#24252c]/50">Total Package Cost:</span>
                <span className="font-extrabold text-[var(--ink)]">{settleModalBooking.total}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#24252c]/50">50% Deposit Paid:</span>
                <span className="font-extrabold text-emerald-600">{settleModalBooking.deposit}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-[#24252c]/10 text-sm">
                <span className="font-extrabold text-[var(--ink)]">Remaining Balance:</span>
                <span className="font-extrabold text-[#1090F8]">
                  {isFullyPaidInput ? '₱0 (Settled)' : settleModalBooking.remaining}
                </span>
              </div>
            </div>

            <form onSubmit={handleSaveBalanceSettlement} className="space-y-4 text-xs">
              {/* Checkbox: Mark as Fully Paid */}
              <label className="flex items-center gap-3 p-3.5 rounded-2xl border border-[#24252c]/10 bg-[var(--mist)] cursor-pointer hover:border-[#1090F8]">
                <input
                  type="checkbox"
                  checked={isFullyPaidInput}
                  onChange={(e) => setIsFullyPaidInput(e.target.checked)}
                  className="w-4 h-4 text-[#1090F8] rounded accent-[#1090F8] cursor-pointer"
                />
                <div>
                  <div className="font-bold text-[var(--ink)] text-xs">Mark as Fully Paid</div>
                  <div className="text-[10px] text-[#24252c]/50">Set remaining balance to ₱0</div>
                </div>
              </label>

              {/* Payment Method Selector */}
              <div>
                <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">
                  Balance Payment Method <span className="text-rose-500">*</span>
                </label>
                <select
                  value={balanceMethodInput}
                  onChange={(e) => setBalanceMethodInput(e.target.value)}
                  className="w-full rounded-full border border-transparent px-4 py-3 bg-[var(--mist)] text-[var(--ink)] font-bold focus:outline-none focus:border-[#1090F8] cursor-pointer"
                >
                  <option value="Cash on Site / Event Day">Cash on Site / Event Day</option>
                  <option value="GCash E-Wallet">GCash E-Wallet</option>
                  <option value="Maya Wallet">Maya Wallet</option>
                  <option value="Bank Transfer (BDO/BPI)">Bank Transfer (BDO/BPI)</option>
                  <option value="PayMongo Online Payment">PayMongo Online Payment</option>
                  <option value="Others">Others (Specify Custom Method)</option>
                </select>

                {balanceMethodInput === 'Others' && (
                  <div className="mt-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#1090F8] ml-1 block mb-1">
                      Custom Payment Method <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={customMethodInput}
                      onChange={(e) => setCustomMethodInput(e.target.value)}
                      placeholder="e.g. Bank Cheque, PayPal, Cash Deposit..."
                      className="w-full rounded-full border border-transparent px-4 py-3 bg-[var(--mist)] text-[var(--ink)] font-bold text-xs focus:outline-none focus:border-[#1090F8]"
                      required
                    />
                  </div>
                )}
              </div>

              {/* Proof of Receipt Upload */}
              <div>
                <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">
                  Proof of Receipt (Optional)
                </label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setBalanceReceiptFile(file);
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setBalanceReceiptPreview(reader.result as string);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="w-full rounded-full border border-transparent px-4 py-2.5 bg-[var(--mist)] text-xs text-[var(--ink)] font-medium cursor-pointer"
                />
              </div>

              {/* Receipt Image Preview */}
              {balanceReceiptPreview && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-[#24252c]/50 uppercase">Receipt Preview:</span>
                    <button
                      type="button"
                      onClick={() => {
                        setBalanceReceiptPreview('');
                        setBalanceReceiptFile(null);
                      }}
                      className="text-[10px] font-bold text-rose-600 hover:underline cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="aspect-[16/9] rounded-2xl overflow-hidden border border-[#24252c]/10 bg-[var(--mist)] flex items-center justify-center p-2">
                    <img src={balanceReceiptPreview} alt="Receipt Slip Preview" className="w-full h-full object-contain rounded-xl" />
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={savingBalance}
                className="w-full bg-[var(--ink)] text-white font-semibold py-3.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors shadow-md cursor-pointer text-xs disabled:opacity-50"
              >
                {savingBalance ? 'Saving Payment Settlement...' : 'Save Payment Settlement'}
              </button>
            </form>
          </div>
        )}
      </ModalOverlay>

      {/* Confirm Cancellation Modal Overlay */}
      <ModalOverlay isOpen={!!cancelBookingId} onClose={() => setCancelBookingId(null)}>
        <div className="bg-white rounded-[2rem] p-6 max-w-md w-full shadow-2xl border border-[#24252c]/10 relative text-center">
          <button onClick={() => setCancelBookingId(null)} className="absolute top-5 right-5 text-[#24252c]/50 hover:text-[var(--ink)] p-1 cursor-pointer">
            <IconX className="w-5 h-5" />
          </button>
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 font-extrabold text-xl flex items-center justify-center mx-auto mb-3 border border-rose-200">
            !
          </div>
          <h3 className="text-xl font-extrabold text-[var(--ink)] mb-1">Confirm Booking Cancellation</h3>
          <p className="text-xs text-[#24252c]/60 mb-5">
            Are you sure you want to cancel booking <strong className="text-[var(--ink)] font-mono">{cancelBookingId}</strong>? This action cannot be undone.
          </p>

          <div className="flex items-center gap-3 text-xs">
            <button
              onClick={() => setCancelBookingId(null)}
              className="flex-1 bg-[var(--mist)] text-[var(--ink)] font-semibold py-3 rounded-full border border-[#24252c]/10 hover:bg-[var(--ink)] hover:text-white transition-colors cursor-pointer"
            >
              Keep Booking
            </button>
            <button
              onClick={handleConfirmCancel}
              className="flex-1 bg-rose-600 text-white font-semibold py-3 rounded-full hover:bg-rose-700 transition-colors shadow-md cursor-pointer"
            >
              Yes, Cancel Booking
            </button>
          </div>
        </div>
      </ModalOverlay>
    </div>
  );
}
