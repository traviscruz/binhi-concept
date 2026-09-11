import { useState, useEffect, useMemo } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import {
  IconCalendar,
  IconX,
  IconSearch,
  IconCheck,
  IconDownload,
  IconFileSpreadsheet,
  IconChevronDown,
  IconEye,
  IconUser,
} from '../../components/shared/icons';
import { ModalOverlay } from '../../components/shared/ModalOverlay';
import { EmptyState } from '../../components/shared/EmptyState';
import { TablePagination } from '../../components/shared/TablePagination';
import { BookingRescheduleCalendar } from '../../components/shared/BookingRescheduleCalendar';
import { supabase } from '../../lib/supabase';
import { logAuditEvent } from '../../utils/auditLogger';
import { AssignCrewModal } from '../../components/admin/AssignCrewModal';
import { formatDisplayDate } from '../../utils/bookingService';
import { sendCustomerRescheduleApproval, sendCustomerRescheduleRejection } from '../../utils/emailService';
import {
  exportFinancialLedgerToExcel,
  exportFinancialLedgerToCSV,
  type FinancialBookingRecord,
} from '../../utils/financialExport';
import { autoComputeAndAwardBookingPoints } from '../../utils/loyaltyService';

const inputClass =
  'w-full rounded-full border px-4 py-2.5 text-xs bg-[#EEEEEE] text-[var(--ink)] placeholder:text-[#24252c]/40 focus:outline-none focus:border-[#1090F8] border-transparent transition-colors';

export default function AdminBookingsPage({ go }: { go: (p: Page) => void }) {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);

  // ── Reschedule States ────────────────────────────────────────────────────
  const [rescheduleBooking, setRescheduleBooking] = useState<any | null>(null);
  const [newRescheduleDate, setNewRescheduleDate] = useState('');
  const [adminRescheduleNotes, setAdminRescheduleNotes] = useState('');
  const [reviewRescheduleBooking, setReviewRescheduleBooking] = useState<any | null>(null);
  const [isProcessingReschedule, setIsProcessingReschedule] = useState(false);
  const [rescheduleToast, setRescheduleToast] = useState<string | null>(null);

  const [cancelBookingId, setCancelBookingId] = useState<string | null>(null);
  const [assignCrewBooking, setAssignCrewBooking] = useState<any | null>(null);

  // ── Refund Processing Modal State (Informational Preview) ──────────────
  const [refundModalBooking, setRefundModalBooking] = useState<any | null>(null);

  // ── Full Payment Settlement Modal State ─────────────────────────────────
  const [settleModalBooking, setSettleModalBooking] = useState<any | null>(null);
  const [isFullyPaidInput, setIsFullyPaidInput] = useState(true);
  const [isSettlementEditMode, setIsSettlementEditMode] = useState(false);
  const [balanceMethodInput, setBalanceMethodInput] = useState('Cash on Site / Event Day');
  const [customMethodInput, setCustomMethodInput] = useState('');
  const [balancePaymentDate, setBalancePaymentDate] = useState<string>('');
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

            const isPast = b.event_date ? new Date(b.event_date).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0) : false;
            const isToday = b.event_date ? new Date(b.event_date).toDateString() === new Date().toDateString() : false;
            const rawSt = (b.payment_status || b.booking_status || b.status || 'pending').toLowerCase();
            const isMarkedCompleted = b.is_completed === true || rawSt === 'completed' || (b.status && b.status.toLowerCase() === 'completed');
            
            let computedStatus = 'Pending Deposit Approval';
            if (rawSt === 'cancelled' || (b.status && b.status.toLowerCase() === 'cancelled')) {
              computedStatus = 'Cancelled';
            } else if (isMarkedCompleted || isPast) {
              computedStatus = 'Completed';
            } else if (isToday && (rawSt === 'paid' || rawSt === 'confirmed' || rawSt === 'ongoing' || (b.status && (b.status.toLowerCase() === 'ongoing' || b.status.toLowerCase() === 'confirmed' || b.status.toLowerCase() === 'upcoming')))) {
              computedStatus = 'Ongoing';
            } else if (rawSt === 'paid' || rawSt === 'confirmed' || (b.status && (b.status.toLowerCase() === 'confirmed' || b.status.toLowerCase() === 'upcoming'))) {
              computedStatus = 'Upcoming';
            }

            return {
              dbId: b.id,
              userId: b.user_id,
              id: b.paymongo_reference_number || `BNH-${b.id.slice(0, 8)}`,
              customer: b.customer_name || 'Valued Customer',
              email: b.customer_email || 'customer@binhiconcept.ph',
              phone: b.customer_phone || '',
              package: b.package_name || 'Event Production Setup',
              date: formatDisplayDate(b.event_date),
              rawDate: b.event_date || '',
              venue: b.venue_address || 'Selected Location',
              totalNum: total,
              depositNum: deposit,
              remainingNum: remBal,
              transportFee: Number(b.transport_fee) || 0,
              total: `₱${total.toLocaleString()}`,
              deposit: `₱${deposit.toLocaleString()}`,
              remaining: `₱${remBal.toLocaleString()}`,
              rawStatus: rawSt,
              status: computedStatus,
              isPast: isPast,
              isToday: isToday,
              isCompleted: isMarkedCompleted || isPast || computedStatus === 'Completed',
              completedAt: b.completed_at || null,
              paymentChannel: b.payment_channel || 'PayMongo',
              bookingSource: bookingSource,
              slipRef: b.paymongo_reference_number ? `Ref #${b.paymongo_reference_number}` : 'Deposit Pending',
              isFullyPaid: isFull,
              balancePaymentMethod: b.balance_payment_method || 'Cash on Site / Event Day',
              balanceReceiptUrl: b.balance_receipt_url || '',
              depositReceiptUrl: b.deposit_receipt_url || '',
              balancePaidAt: b.balance_paid_at ? new Date(b.balance_paid_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '',
              rawBalancePaidAt: b.balance_paid_at || null,
              assignedCrew: Array.isArray(b.assigned_crew) ? b.assigned_crew : [],
              rescheduleStatus: b.reschedule_status || null,
              rescheduleRequestedDate: b.reschedule_requested_date || null,
              rescheduleReason: b.reschedule_reason || null,
              rescheduleRequestedAt: b.reschedule_requested_at || null,
              rescheduleAdminNotes: b.reschedule_admin_notes || null,
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

    const channel = supabase
      .channel('admin-bookings-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        () => {
          loadBookings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Reset pagination to page 1 whenever search, filter, or page size changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, pageSize]);

  // Close action dropdown menu when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.booking-action-menu')) {
        setOpenActionMenuId(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenActionMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const filtered = bookings.filter((b) => {
    const matchesStatus =
      statusFilter === 'All' ||
      b.status.toLowerCase() === statusFilter.toLowerCase() ||
      (statusFilter === 'Upcoming' && (b.status === 'Upcoming' || b.status === 'Confirmed')) ||
      (statusFilter === 'Pending' && b.status.toLowerCase().includes('pending'));
    const matchesSearch =
      b.id.toLowerCase().includes(search.toLowerCase()) ||
      b.customer.toLowerCase().includes(search.toLowerCase()) ||
      b.package.toLowerCase().includes(search.toLowerCase()) ||
      (b.bookingSource && b.bookingSource.toLowerCase().includes(search.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  const paginatedBookings = useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const safePage = Math.min(Math.max(1, currentPage), totalPages);
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  const handleStatusChange = async (dbId: string, newStatus: string) => {
    const target = bookings.find((b) => b.dbId === dbId);
    const oldStatus = target ? target.rawStatus : 'unknown';

    try {
      await supabase
        .from('bookings')
        .update({ payment_status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', dbId);

      await logAuditEvent({
        action: 'UPDATE_BOOKING_STATUS',
        module: 'bookings',
        targetId: target?.id || dbId,
        targetName: target ? `${target.customer} (${target.package})` : dbId,
        details: `Booking ${target?.id || dbId} status updated from "${oldStatus}" to "${newStatus}"`,
        previousData: { payment_status: oldStatus },
        currentData: { payment_status: newStatus },
      });

      loadBookings();
    } catch (err) {
      console.error('Error updating booking status:', err);
    }
  };

  const handleApproveDeposit = async (row: any) => {
    try {
      await supabase
        .from('bookings')
        .update({
          payment_status: 'paid',
          status: 'Confirmed',
          booking_status: 'confirmed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.dbId);

      await logAuditEvent({
        action: 'APPROVE_BOOKING_DEPOSIT',
        module: 'bookings',
        targetId: row.id,
        targetName: `${row.customer} - ${row.package}`,
        details: `Approved 50% deposit payment (${row.deposit}) for booking ${row.id} (${row.customer})`,
        previousData: { status: row.status, payment_status: row.rawStatus },
        currentData: { status: 'Confirmed', payment_status: 'paid' },
        metadata: {
          deposit: row.deposit,
          total: row.total,
          paymentChannel: row.paymentChannel,
          customer: row.customer,
        },
      });

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
          .update({
            payment_status: 'cancelled',
            status: 'Cancelled',
            booking_status: 'cancelled',
            is_completed: false,
            updated_at: new Date().toISOString(),
          })
          .eq('id', target.dbId);

        await logAuditEvent({
          action: 'CANCEL_BOOKING',
          module: 'bookings',
          targetId: target.id,
          targetName: `${target.customer} - ${target.package}`,
          details: `Booking ${target.id} (${target.customer}) was cancelled`,
          previousData: { payment_status: target.rawStatus, status: target.status },
          currentData: { payment_status: 'cancelled', status: 'Cancelled' },
        });

        loadBookings();
      }
    } catch (err) {
      console.error('Error cancelling booking:', err);
    } finally {
      setCancelBookingId(null);
    }
  };

  const handleMarkAsCompleted = async (booking: any) => {
    if (!booking) return;
    try {
      const { error } = await supabase
        .from('bookings')
        .update({
          payment_status: 'completed',
          status: 'Completed',
          booking_status: 'completed',
          is_completed: true,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking.dbId);

      if (error) throw error;

      await logAuditEvent({
        action: 'COMPLETE_BOOKING',
        module: 'bookings',
        targetId: booking.id,
        targetName: `${booking.customer} - ${booking.package}`,
        details: `Booking #${booking.id} (${booking.customer}) was marked as COMPLETED.`,
        previousData: { status: booking.status, payment_status: booking.rawStatus },
        currentData: { status: 'Completed', payment_status: 'completed', is_completed: true },
      });

      try {
        await autoComputeAndAwardBookingPoints(booking.userId || '', booking.email);
      } catch (loyaltyErr) {
        console.warn('Loyalty points calculation non-blocking note:', loyaltyErr);
      }

      setRescheduleToast(`Booking #${booking.id} (${booking.customer}) successfully marked as COMPLETED!`);
      setTimeout(() => setRescheduleToast(null), 6000);
      await loadBookings();
    } catch (err: any) {
      console.error('Error completing booking:', err);
      alert(`Failed to complete booking: ${err.message || 'Unknown error'}`);
    }
  };

  const handleUndoMarkAsCompleted = async (booking: any) => {
    if (!booking) return;
    try {
      const restoredStatus = booking.isToday ? 'Ongoing' : 'Upcoming';
      const restoredRawStatus = booking.isToday ? 'ongoing' : 'paid';

      const { error } = await supabase
        .from('bookings')
        .update({
          payment_status: 'paid',
          status: restoredStatus,
          booking_status: restoredRawStatus,
          is_completed: false,
          completed_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking.dbId);

      if (error) throw error;

      await logAuditEvent({
        action: 'UNDO_COMPLETE_BOOKING',
        module: 'bookings',
        targetId: booking.id,
        targetName: `${booking.customer} - ${booking.package}`,
        details: `Reopened booking #${booking.id} (${booking.customer}) and restored status to ${restoredStatus}.`,
        previousData: { status: 'Completed', is_completed: true },
        currentData: { status: restoredStatus, is_completed: false },
      });

      setRescheduleToast(`Booking #${booking.id} (${booking.customer}) status reverted to ${restoredStatus}!`);
      setTimeout(() => setRescheduleToast(null), 6000);
      await loadBookings();
    } catch (err: any) {
      console.error('Error reverting completed booking:', err);
      alert(`Failed to revert completed booking: ${err.message || 'Unknown error'}`);
    }
  };

  const getApprovalEmailTemplate = (booking: any) => {
    if (!booking) return '';
    const reqDate = formatDisplayDate(booking.rescheduleRequestedDate);
    return `Dear ${booking.customer},\n\nWe are pleased to inform you that your request to reschedule Booking #${booking.id} (${booking.package}) to ${reqDate} has been APPROVED and officially confirmed in our production calendar.\n\nAll your equipment inclusions, technical gear, and assigned crew arrangements have been secured for your new date.\n\nWarm regards,\nBINHI Concept Production Team`;
  };

  const getDeclineEmailTemplate = (booking: any) => {
    if (!booking) return '';
    const reqDate = formatDisplayDate(booking.rescheduleRequestedDate);
    return `Dear ${booking.customer},\n\nThank you for reaching out. Regrettably, our production crew and staging equipment are fully booked for your requested date (${reqDate}).\n\nYour reservation remains active and secured for your original scheduled date (${booking.date}). Please feel free to reply if you would like to explore alternative open dates.\n\nBest regards,\nBINHI Concept Production Team`;
  };

  const getDirectRescheduleEmailTemplate = (booking: any, targetDate: string) => {
    if (!booking) return '';
    const dateStr = formatDisplayDate(targetDate);
    return `Dear ${booking.customer},\n\nThis is an official notice that your event schedule for Booking #${booking.id} (${booking.package}) has been updated to ${dateStr} per our recent coordination.\n\nAll staging equipment, logistics, and crew assignments have been updated accordingly.\n\nWarm regards,\nBINHI Concept Production Team`;
  };

  const handleApproveCustomerReschedule = async () => {
    if (!reviewRescheduleBooking) return;
    setIsProcessingReschedule(true);
    try {
      const oldDate = reviewRescheduleBooking.date;
      const newDateIso = reviewRescheduleBooking.rescheduleRequestedDate;
      const formattedNewDate = formatDisplayDate(newDateIso);

      const { error } = await supabase
        .from('bookings')
        .update({
          event_date: newDateIso,
          reschedule_status: 'approved',
          reschedule_reviewed_at: new Date().toISOString(),
          reschedule_admin_notes: adminRescheduleNotes.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', reviewRescheduleBooking.dbId);

      if (error) throw error;

      await logAuditEvent({
        action: 'APPROVE_RESCHEDULE',
        module: 'bookings',
        targetId: reviewRescheduleBooking.id,
        targetName: `${reviewRescheduleBooking.customer} - ${reviewRescheduleBooking.package}`,
        details: `Approved reschedule for booking ${reviewRescheduleBooking.id} from "${oldDate}" to "${formattedNewDate}"`,
        previousData: { event_date: oldDate },
        currentData: { event_date: formattedNewDate },
      });

      // Email customer
      await sendCustomerRescheduleApproval({
        customerName: reviewRescheduleBooking.customer,
        customerEmail: reviewRescheduleBooking.email,
        bookingId: reviewRescheduleBooking.id,
        packageName: reviewRescheduleBooking.package,
        oldDate: oldDate,
        newDate: formattedNewDate,
        venue: reviewRescheduleBooking.venue,
        adminNotes: adminRescheduleNotes.trim() || undefined,
        isDirectAdminReschedule: false,
      });

      setRescheduleToast(`Reschedule approved for #${reviewRescheduleBooking.id}! Customer has been emailed confirmation.`);
      setTimeout(() => setRescheduleToast(null), 6000);
      setReviewRescheduleBooking(null);
      setAdminRescheduleNotes('');
      await loadBookings();
    } catch (err: any) {
      console.error('Error approving reschedule:', err);
      alert(`Failed to approve reschedule: ${err.message || 'Unknown error'}`);
    } finally {
      setIsProcessingReschedule(false);
    }
  };

  const handleDeclineCustomerReschedule = async () => {
    if (!reviewRescheduleBooking) return;
    setIsProcessingReschedule(true);
    try {
      const origDate = reviewRescheduleBooking.date;
      const requestedDateFormatted = formatDisplayDate(reviewRescheduleBooking.rescheduleRequestedDate);

      const { error } = await supabase
        .from('bookings')
        .update({
          reschedule_status: 'rejected',
          reschedule_reviewed_at: new Date().toISOString(),
          reschedule_admin_notes: adminRescheduleNotes.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', reviewRescheduleBooking.dbId);

      if (error) throw error;

      await logAuditEvent({
        action: 'DECLINE_RESCHEDULE',
        module: 'bookings',
        targetId: reviewRescheduleBooking.id,
        targetName: `${reviewRescheduleBooking.customer} - ${reviewRescheduleBooking.package}`,
        details: `Declined reschedule for booking ${reviewRescheduleBooking.id} (requested ${requestedDateFormatted})`,
      });

      // Email customer
      await sendCustomerRescheduleRejection({
        customerName: reviewRescheduleBooking.customer,
        customerEmail: reviewRescheduleBooking.email,
        bookingId: reviewRescheduleBooking.id,
        packageName: reviewRescheduleBooking.package,
        originalDate: origDate,
        requestedDate: requestedDateFormatted,
        adminNotes: adminRescheduleNotes.trim() || undefined,
      });

      setRescheduleToast(`Reschedule declined for #${reviewRescheduleBooking.id}. Customer has been notified via email.`);
      setTimeout(() => setRescheduleToast(null), 6000);
      setReviewRescheduleBooking(null);
      setAdminRescheduleNotes('');
      await loadBookings();
    } catch (err: any) {
      console.error('Error declining reschedule:', err);
      alert(`Failed to decline reschedule: ${err.message || 'Unknown error'}`);
    } finally {
      setIsProcessingReschedule(false);
    }
  };

  const handleDirectAdminReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleBooking || !newRescheduleDate) return;
    setIsProcessingReschedule(true);

    try {
      const oldDate = rescheduleBooking.date;
      const formattedNewDate = formatDisplayDate(newRescheduleDate);

      const { error } = await supabase
        .from('bookings')
        .update({
          event_date: newRescheduleDate,
          reschedule_status: 'approved',
          reschedule_reviewed_at: new Date().toISOString(),
          reschedule_admin_notes: adminRescheduleNotes.trim() || 'Directly rescheduled by System Administrator',
          updated_at: new Date().toISOString(),
        })
        .eq('id', rescheduleBooking.dbId);

      if (error) throw error;

      await logAuditEvent({
        action: 'RESCHEDULE_BOOKING',
        module: 'bookings',
        targetId: rescheduleBooking.id,
        targetName: `${rescheduleBooking.customer} - ${rescheduleBooking.package}`,
        details: `Directly rescheduled booking ${rescheduleBooking.id} from "${oldDate}" to "${formattedNewDate}"`,
        previousData: { event_date: oldDate },
        currentData: { event_date: formattedNewDate },
      });

      // Email customer
      await sendCustomerRescheduleApproval({
        customerName: rescheduleBooking.customer,
        customerEmail: rescheduleBooking.email,
        bookingId: rescheduleBooking.id,
        packageName: rescheduleBooking.package,
        oldDate: oldDate,
        newDate: formattedNewDate,
        venue: rescheduleBooking.venue,
        adminNotes: adminRescheduleNotes.trim() || 'Rescheduled per production logistics update.',
        isDirectAdminReschedule: true,
      });

      setRescheduleToast(`Booking #${rescheduleBooking.id} successfully rescheduled to ${formattedNewDate}! Customer notified via email.`);
      setTimeout(() => setRescheduleToast(null), 6000);
      setRescheduleBooking(null);
      setAdminRescheduleNotes('');
      await loadBookings();
    } catch (err: any) {
      console.error('Error directly rescheduling booking:', err);
      alert(`Failed to reschedule booking: ${err.message || 'Unknown error'}`);
    } finally {
      setIsProcessingReschedule(false);
    }
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
          const fileExt = balanceReceiptFile.name.split('.').pop() || 'png';
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
            console.warn('Storage upload fallback to preview data URL:', uploadErr);
            receiptUrl = balanceReceiptPreview;
          }
        } catch (storageErr) {
          console.warn('Supabase storage upload fallback to preview:', storageErr);
          receiptUrl = balanceReceiptPreview;
        }
      } else if (balanceReceiptPreview) {
        receiptUrl = balanceReceiptPreview;
      } else {
        receiptUrl = '';
      }

      const finalPaymentMethod = balanceMethodInput === 'Others'
        ? (customMethodInput.trim() || 'Others')
        : balanceMethodInput;

      const originalRemaining = Math.max(0, settleModalBooking.totalNum - settleModalBooking.depositNum);
      const paymentTimestamp = balancePaymentDate
        ? new Date(balancePaymentDate + 'T12:00:00Z').toISOString()
        : new Date().toISOString();

      const updateData: any = {
        is_fully_paid: isFullyPaidInput,
        remaining_balance: isFullyPaidInput ? 0 : originalRemaining,
        balance_payment_method: finalPaymentMethod,
        balance_receipt_url: receiptUrl,
        balance_paid_at: isFullyPaidInput ? paymentTimestamp : null,
        updated_at: new Date().toISOString(),
      };

      const { error: updateErr } = await supabase
        .from('bookings')
        .update(updateData)
        .eq('id', settleModalBooking.dbId);

      if (updateErr) throw updateErr;

      await logAuditEvent({
        action: 'SETTLE_BOOKING_BALANCE',
        module: 'bookings',
        targetId: settleModalBooking.id,
        targetName: `${settleModalBooking.customer} - ${settleModalBooking.package}`,
        details: `Settled balance payment for booking #${settleModalBooking.id}: ${isFullyPaidInput ? 'Marked Fully Paid (100%)' : 'Updated Payment Info'} via ${finalPaymentMethod} (Settlement Date: ${formatDisplayDate(balancePaymentDate || new Date().toISOString())})`,
        previousData: {
          is_fully_paid: settleModalBooking.isFullyPaid,
          balance_payment_method: settleModalBooking.balancePaymentMethod,
          remaining: settleModalBooking.remaining,
        },
        currentData: {
          is_fully_paid: isFullyPaidInput,
          balance_payment_method: finalPaymentMethod,
          remaining: isFullyPaidInput ? '₱0' : settleModalBooking.remaining,
          balance_receipt_url: receiptUrl ? 'Receipt attached' : 'None',
        },
      });

      // Automatically award loyalty points if fully paid
      if (isFullyPaidInput) {
        try {
          await autoComputeAndAwardBookingPoints(settleModalBooking.userId || '', settleModalBooking.email);
        } catch (loyaltyErr) {
          console.warn('Loyalty points calculation non-blocking note:', loyaltyErr);
        }
      }

      setRescheduleToast(`Payment settlement saved for Booking #${settleModalBooking.id}! Status: ${isFullyPaidInput ? '100% Fully Settled' : 'Payment Updated'}.`);
      setTimeout(() => setRescheduleToast(null), 6000);

      await loadBookings();
      setSettleModalBooking(null);
    } catch (err: any) {
      console.error('Error saving balance payment:', err);
      alert(`Failed to save payment settlement: ${err.message || 'Unknown error'}`);
    } finally {
      setSavingBalance(false);
    }
  };

  const handleOpenSettleModal = (row: any) => {
    setSettleModalBooking(row);
    setIsFullyPaidInput(row.isFullyPaid);
    setIsSettlementEditMode(!row.isFullyPaid);
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
    const targetDate = row.rawBalancePaidAt
      ? new Date(row.rawBalancePaidAt).toISOString().slice(0, 10)
      : row.rawDate
      ? row.rawDate.slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    setBalancePaymentDate(targetDate);
    setBalanceReceiptPreview(row.balanceReceiptUrl || '');
    setBalanceReceiptFile(null);
  };

  const handleExportBookingsExcel = () => {
    const exportRecords: FinancialBookingRecord[] = filtered.map((b) => ({
      id: b.dbId,
      refNumber: b.id,
      customerName: b.customer,
      customerEmail: b.email,
      customerPhone: b.phone,
      packageName: b.package,
      eventDate: b.rawDate || b.date,
      venueAddress: b.venue,
      paymentStatus: b.rawStatus,
      isFullyPaid: b.isFullyPaid,
      transportFee: b.transportFee || 0,
      depositAmount: b.depositNum || 0,
      remainingBalance: b.remainingNum || 0,
      totalCost: b.totalNum || 0,
      paymentChannel: b.paymentChannel || 'PayMongo',
      bookingSource: b.bookingSource || 'Online Booking',
      balanceMethod: b.balancePaymentMethod,
      createdAt: b.rawDate || '',
    }));

    exportFinancialLedgerToExcel(exportRecords, 'BINHI_Bookings_Report');
  };

  const handleExportBookingsCSV = () => {
    const exportRecords: FinancialBookingRecord[] = filtered.map((b) => ({
      id: b.dbId,
      refNumber: b.id,
      customerName: b.customer,
      customerEmail: b.email,
      customerPhone: b.phone,
      packageName: b.package,
      eventDate: b.rawDate || b.date,
      venueAddress: b.venue,
      paymentStatus: b.rawStatus,
      isFullyPaid: b.isFullyPaid,
      transportFee: b.transportFee || 0,
      depositAmount: b.depositNum || 0,
      remainingBalance: b.remainingNum || 0,
      totalCost: b.totalNum || 0,
      paymentChannel: b.paymentChannel || 'PayMongo',
      bookingSource: b.bookingSource || 'Online Booking',
      balanceMethod: b.balancePaymentMethod,
      createdAt: b.rawDate || '',
    }));

    exportFinancialLedgerToCSV(exportRecords, 'BINHI_Bookings_Report');
  };

  const activeSelectedReceipt = selectedReceipt || { id: '', customer: '', slipRef: '', deposit: '', date: '' };

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

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => go('admin-reports')}
            className="inline-flex items-center gap-1.5 bg-[var(--mist)] border border-[#24252c]/10 text-[var(--ink)] text-xs font-semibold px-4 py-2.5 rounded-full hover:bg-gray-200 transition-colors shadow-2xs cursor-pointer"
            title="Open Financial Ledger & Reports"
          >
            <span>Ledger & Reports →</span>
          </button>

          <button
            type="button"
            onClick={handleExportBookingsExcel}
            className="inline-flex items-center gap-1.5 bg-emerald-600 text-white text-xs font-bold px-4 py-2.5 rounded-full hover:bg-emerald-700 transition-all shadow-sm cursor-pointer"
            title="Export filtered bookings to Excel"
          >
            <IconFileSpreadsheet className="w-4 h-4 text-white" />
            <span>Export Excel</span>
          </button>

          <button
            type="button"
            onClick={loadBookings}
            disabled={loading}
            className="inline-flex items-center gap-1.5 bg-white border border-[#24252c]/15 text-[var(--ink)] text-xs font-bold px-3 py-2.5 rounded-full hover:bg-[var(--mist)] transition-all shadow-2xs cursor-pointer disabled:opacity-50"
            title="Refresh bookings data"
          >
            <span className={loading ? 'animate-spin inline-block' : ''}>↻</span>
          </button>

          <button
            type="button"
            onClick={() => go('admin-manual-booking')}
            className="inline-flex items-center gap-2 bg-[#1090F8] text-white text-xs font-bold px-4.5 py-2.5 rounded-full hover:bg-[#1090F8]/90 transition-all shadow-sm hover:shadow-md cursor-pointer shrink-0"
          >
            <span className="text-base font-bold leading-none">+</span>
            <span>Manual Booking</span>
          </button>
        </div>
      </div>

      {/* Toast Alert Notification */}
      {rescheduleToast && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 shadow-sm flex items-center justify-between gap-3 animate-fade-in text-xs">
          <div className="flex items-center gap-2.5">
            <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
              ✓
            </span>
            <span className="font-semibold">{rescheduleToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setRescheduleToast(null)}
            className="text-emerald-700 hover:text-emerald-950 font-bold p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#24252c]/[0.08] shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto">
          {['All', 'Pending', 'Upcoming', 'Ongoing', 'Completed', 'Cancelled'].map((st) => (
            <button
              key={st}
              onClick={() => {
                setStatusFilter(st);
                setCurrentPage(1);
              }}
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
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search booking ID or customer..."
            className={inputClass + ' pl-10'}
          />
        </div>
      </div>

        {/* Desktop Bookings Table */}
        <div className="hidden sm:block bg-white rounded-3xl border border-[#24252c]/10 shadow-sm overflow-visible">
          <div className="w-full">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#24252c]/10 bg-[var(--mist)]/50 text-[#24252c]/60 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-4 px-4">Ref / Customer</th>
                  <th className="py-4 px-4">Package & Venue</th>
                  <th className="py-4 px-4">Schedule Date</th>
                  <th className="py-4 px-4">Cost Breakdown</th>
                  <th className="py-4 px-4">Assigned Crew</th>
                  <th className="py-4 px-4">Booking Status</th>
                  <th className="py-4 px-4">Payment Status</th>
                  <th className="py-4 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#24252c]/5">
                {paginatedBookings.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-xs text-[#24252c]/50">
                      No bookings found matching your search and filter criteria.
                    </td>
                  </tr>
                ) : (
                  paginatedBookings.map((row, idx) => {
                    const popUpwards = idx >= Math.max(2, paginatedBookings.length - 3);

                    return (
                      <tr key={row.dbId} className="hover:bg-[var(--mist)]/40 transition-colors">
                        {/* Col 1: Customer & Ref */}
                        <td className="py-4 px-4">
                          <div className="font-bold text-[#1090F8] text-[11px] tracking-wide">
                            #{row.id}
                          </div>
                          <div className="font-extrabold text-[var(--ink)] text-xs mt-0.5">
                            {row.customer}
                          </div>
                          <div className="text-[10px] text-[#24252c]/50 truncate max-w-[150px]">
                            {row.email}
                          </div>
                        </td>

                        {/* Col 2: Package & Venue */}
                        <td className="py-4 px-4">
                          <div className="font-bold text-[var(--ink)]">{row.package}</div>
                          <div className="text-[10px] text-[#24252c]/60 truncate max-w-[170px] mt-0.5">
                            {row.venue}
                          </div>
                        </td>

                        {/* Col 3: Event Date & Reschedule Alert */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          <div className="font-semibold text-[var(--ink)] flex items-center gap-1.5">
                            <IconCalendar className="w-3.5 h-3.5 text-[#1090F8] shrink-0" />
                            <span>{row.date}</span>
                          </div>
                          {row.rescheduleStatus === 'pending' && (
                            <div className="mt-1.5 inline-flex items-center gap-1 bg-amber-500 text-white font-extrabold text-[9px] px-2.5 py-0.5 rounded-full shadow-2xs">
                              <span>Reschedule Requested</span>
                            </div>
                          )}
                        </td>

                        {/* Col 4: Cost Breakdown */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          <div className="font-extrabold text-[var(--ink)] text-xs">{row.total}</div>
                          <div className="text-[11px] text-[#24252c]/60 mt-0.5 space-y-0.5">
                            <div className="text-emerald-700 font-medium">50% Dep: {row.deposit}</div>
                            <div>Bal: {row.isFullyPaid ? '₱0' : row.remaining}</div>
                          </div>
                        </td>

                        {/* Col 5: Assigned Crew */}
                        <td className="py-4 px-4">
                          {row.assignedCrew.length > 0 ? (
                            <span className="text-xs text-[var(--ink)] font-medium">
                              {row.assignedCrew.map((c: any) => c.name || c.full_name).join(', ')}
                            </span>
                          ) : (
                            <span className="text-xs text-[#24252c]/40 italic">Unassigned</span>
                          )}
                        </td>

                        {/* Col 6: Booking Status */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border shadow-2xs ${
                              row.status === 'Ongoing'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-extrabold'
                                : row.status === 'Upcoming' || row.status === 'Confirmed'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : row.status === 'Completed'
                                ? 'bg-slate-100 text-slate-700 border-slate-300'
                                : row.status === 'Cancelled'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            <span
                              className={`rounded-full ${
                                row.status === 'Ongoing'
                                  ? 'w-2 h-2 bg-emerald-500 animate-pulse'
                                  : 'w-1.5 h-1.5 bg-current'
                              }`}
                            />
                            {row.status}
                          </span>
                        </td>

                        {/* Col 7: Payment Status (Only 50% deposit or fully paid) */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          {row.isFullyPaid ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Fully Paid
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              50% Deposit
                            </span>
                          )}
                        </td>

                        {/* Col 8: Actions (Streamlined Quick Action + Dropdown) */}
                        <td className="py-4 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            {/* 1. Contextual Primary Action Button */}
                            {row.rescheduleStatus === 'pending' ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setReviewRescheduleBooking(row);
                                  setAdminRescheduleNotes(getApprovalEmailTemplate(row));
                                }}
                                className="bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-extrabold px-3 py-1.5 rounded-full transition-colors shadow-2xs cursor-pointer shrink-0 flex items-center gap-1"
                                title="Review customer reschedule request"
                              >
                                <IconCalendar className="w-3.5 h-3.5" />
                                <span>Review</span>
                              </button>
                            ) : row.status.includes('Pending') ? (
                              <button
                                type="button"
                                onClick={() => setSelectedReceipt(row)}
                                className="bg-[#1090F8] hover:bg-[#1090F8]/90 text-white text-[11px] font-bold px-3 py-1.5 rounded-full transition-colors shadow-2xs cursor-pointer shrink-0 flex items-center gap-1"
                                title="Approve booking deposit"
                              >
                                <IconCheck className="w-3.5 h-3.5" />
                                <span>Approve</span>
                              </button>
                            ) : row.rawStatus === 'cancelled' ? (
                              <button
                                type="button"
                                onClick={() => setRefundModalBooking(row)}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-[11px] font-bold px-3 py-1.5 rounded-full transition-colors shadow-2xs cursor-pointer shrink-0"
                                title="Process / View Refund"
                              >
                                Refund
                              </button>
                            ) : !row.isFullyPaid ? (
                              <button
                                type="button"
                                onClick={() => handleOpenSettleModal(row)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-full transition-all shadow-2xs cursor-pointer shrink-0 flex items-center gap-1"
                                title={`Settle Remaining Balance (${row.remaining})`}
                              >
                                <span>₱</span>
                                <span>Settle</span>
                              </button>
                            ) : null}

                            {/* 2. Sleek Actions Dropdown Menu */}
                            <div className="relative inline-block text-left booking-action-menu">
                              <button
                                type="button"
                                onClick={() => setOpenActionMenuId(openActionMenuId === row.dbId ? null : row.dbId)}
                                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full border text-[11px] font-bold transition-all cursor-pointer ${
                                  openActionMenuId === row.dbId
                                    ? 'bg-[var(--ink)] text-white border-[var(--ink)] shadow-xs'
                                    : 'bg-white hover:bg-[var(--mist)] text-[var(--ink)] border-[#24252c]/15 hover:border-[#24252c]/30 shadow-2xs'
                                }`}
                                title="More booking actions"
                              >
                                <span>Actions</span>
                                <IconChevronDown
                                  className={`w-3 h-3 transition-transform duration-200 ${
                                    openActionMenuId === row.dbId ? 'rotate-180' : ''
                                  }`}
                                />
                              </button>

                              {openActionMenuId === row.dbId && (
                                <div
                                  className={`absolute right-0 ${
                                    popUpwards ? 'bottom-full mb-1.5 origin-bottom-right' : 'top-full mt-1.5 origin-top-right'
                                  } w-56 bg-white rounded-2xl shadow-xl border border-[#24252c]/10 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 text-left`}
                                >
                                  <div className="px-3.5 py-1 text-[10px] font-bold text-[#24252c]/40 uppercase tracking-wider">
                                    Booking Actions
                                  </div>

                                  {/* Settle / Payment Details */}
                                  {row.rawStatus !== 'cancelled' && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenActionMenuId(null);
                                        handleOpenSettleModal(row);
                                      }}
                                      className="w-full text-left px-3.5 py-2 text-xs font-semibold text-[var(--ink)] hover:bg-emerald-50 hover:text-emerald-800 flex items-center gap-2.5 transition-colors cursor-pointer"
                                    >
                                      <span className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center text-[11px] font-bold shrink-0">
                                        ₱
                                      </span>
                                      <div className="flex flex-col min-w-0">
                                        <span className="truncate">
                                          {row.isFullyPaid ? 'Payment Settlement' : 'Settle Balance'}
                                        </span>
                                        <span className="text-[10px] font-normal text-[#24252c]/50 truncate">
                                          {row.isFullyPaid ? 'View & edit settlement proof' : `Bal: ${row.remaining}`}
                                        </span>
                                      </div>
                                    </button>
                                  )}

                                  {/* Mark as Completed Event */}
                                  {row.rawStatus !== 'cancelled' && !row.isCompleted && row.status !== 'Completed' && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenActionMenuId(null);
                                        handleMarkAsCompleted(row);
                                      }}
                                      className="w-full text-left px-3.5 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                                    >
                                      <span className="w-5 h-5 rounded-md bg-blue-100 text-[#1090F8] flex items-center justify-center font-bold text-[11px] shrink-0">
                                        ✓
                                      </span>
                                      <div className="flex flex-col min-w-0">
                                        <span className="truncate">Mark as Completed</span>
                                        <span className="text-[10px] font-normal text-[#24252c]/50 truncate">
                                          {row.isToday ? 'Event is today' : 'Set status to completed'}
                                        </span>
                                      </div>
                                    </button>
                                  )}

                                   {/* Undo Mark as Completed (Allowed if event is today or not past) */}
                                   {row.rawStatus !== "cancelled" && (row.isCompleted || row.status === "Completed") && (row.isToday || !row.isPast) && (
                                     <button
                                       type="button"
                                       onClick={() => {
                                         setOpenActionMenuId(null);
                                         handleUndoMarkAsCompleted(row);
                                       }}
                                       className="w-full text-left px-3.5 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                                     >
                                       <span className="w-5 h-5 rounded-md bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-[11px] shrink-0">
                                         ↺
                                       </span>
                                       <div className="flex flex-col min-w-0">
                                         <span className="truncate">Undo Completed</span>
                                         <span className="text-[10px] font-normal text-[#24252c]/50 truncate">
                                           {row.isToday ? "Reopen as Ongoing (Today)" : "Reopen as Upcoming"}
                                         </span>
                                       </div>
                                     </button>
                                   )}

                                  {/* Proof Slips */}
                                  {(row.depositReceiptUrl || row.balanceReceiptUrl) && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenActionMenuId(null);
                                        setSelectedReceipt(row);
                                      }}
                                      className="w-full text-left px-3.5 py-2 text-xs font-semibold text-[var(--ink)] hover:bg-purple-50 hover:text-purple-800 flex items-center gap-2.5 transition-colors cursor-pointer"
                                    >
                                      <span className="w-5 h-5 rounded-md bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                                        <IconEye className="w-3 h-3" />
                                      </span>
                                      <div className="flex flex-col min-w-0">
                                        <span className="truncate">View Proof Slips</span>
                                        <span className="text-[10px] font-normal text-[#24252c]/50 truncate">
                                          Deposit & settlement slips
                                        </span>
                                      </div>
                                    </button>
                                  )}

                                  {/* Reschedule Date (Hidden if completed, past date, or cancelled) */}
                                  {row.rawStatus !== 'cancelled' && !row.isCompleted && !row.isPast && row.status !== 'Completed' && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenActionMenuId(null);
                                        setRescheduleBooking(row);
                                        const targetDate = row.rawDate ? row.rawDate.slice(0, 10) : '';
                                        setNewRescheduleDate(targetDate);
                                        setAdminRescheduleNotes(getDirectRescheduleEmailTemplate(row, targetDate));
                                      }}
                                      className="w-full text-left px-3.5 py-2 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--mist)] flex items-center gap-2.5 transition-colors cursor-pointer"
                                    >
                                      <span className="w-5 h-5 rounded-md bg-[#24252c]/10 text-[var(--ink)] flex items-center justify-center shrink-0">
                                        <IconCalendar className="w-3 h-3" />
                                      </span>
                                      <div className="flex flex-col min-w-0">
                                        <span className="truncate">Reschedule Date</span>
                                        <span className="text-[10px] font-normal text-[#24252c]/50 truncate">
                                          Change event date
                                        </span>
                                      </div>
                                    </button>
                                  )}

                                  {/* Assign Crew (Hidden if completed, past date, or cancelled) */}
                                  {row.rawStatus !== 'cancelled' && !row.isCompleted && !row.isPast && row.status !== 'Completed' && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenActionMenuId(null);
                                        setAssignCrewBooking(row);
                                      }}
                                      className="w-full text-left px-3.5 py-2 text-xs font-semibold text-[var(--ink)] hover:bg-indigo-50 hover:text-indigo-800 flex items-center gap-2.5 transition-colors cursor-pointer"
                                    >
                                      <span className="w-5 h-5 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                                        <IconUser className="w-3 h-3" />
                                      </span>
                                      <div className="flex flex-col min-w-0">
                                        <span className="truncate">Assign Crew</span>
                                        <span className="text-[10px] font-normal text-[#24252c]/50 truncate">
                                          {row.assignedCrew.length > 0
                                            ? `${row.assignedCrew.length} crew assigned`
                                            : 'Assign production crew'}
                                        </span>
                                      </div>
                                    </button>
                                  )}

                                  {/* Review Reschedule Request */}
                                  {row.rescheduleStatus === 'pending' && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenActionMenuId(null);
                                        setReviewRescheduleBooking(row);
                                        setAdminRescheduleNotes(getApprovalEmailTemplate(row));
                                      }}
                                      className="w-full text-left px-3.5 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                                    >
                                      <span className="w-5 h-5 rounded-md bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                                        <IconCalendar className="w-3 h-3" />
                                      </span>
                                      <div className="flex flex-col min-w-0">
                                        <span className="truncate">Review Reschedule</span>
                                        <span className="text-[10px] font-normal text-[#24252c]/50 truncate">
                                          Customer request pending
                                        </span>
                                      </div>
                                    </button>
                                  )}

                                  {/* Approve Deposit (if pending) */}
                                  {row.status.includes('Pending') && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenActionMenuId(null);
                                        setSelectedReceipt(row);
                                      }}
                                      className="w-full text-left px-3.5 py-2 text-xs font-semibold text-[#1090F8] hover:bg-blue-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                                    >
                                      <span className="w-5 h-5 rounded-md bg-[#1090F8]/15 text-[#1090F8] flex items-center justify-center shrink-0">
                                        <IconCheck className="w-3 h-3" />
                                      </span>
                                      <div className="flex flex-col min-w-0">
                                        <span className="truncate">Approve Deposit</span>
                                        <span className="text-[10px] font-normal text-[#24252c]/50 truncate">
                                          Confirm reservation
                                        </span>
                                      </div>
                                    </button>
                                  )}

                                  {/* Refund (if cancelled) */}
                                  {row.rawStatus === 'cancelled' && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenActionMenuId(null);
                                        setRefundModalBooking(row);
                                      }}
                                      className="w-full text-left px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 flex items-center gap-2.5 transition-colors cursor-pointer"
                                    >
                                      <span className="w-5 h-5 rounded-md bg-slate-200 text-slate-700 flex items-center justify-center text-[11px] font-bold shrink-0">
                                        ₱
                                      </span>
                                      <div className="flex flex-col min-w-0">
                                        <span className="truncate">Process Refund</span>
                                        <span className="text-[10px] font-normal text-[#24252c]/50 truncate">
                                          Refund breakdown info
                                        </span>
                                      </div>
                                    </button>
                                  )}

                                  {/* Cancel Booking (Hidden if completed, past date, or cancelled) */}
                                  {row.rawStatus !== 'cancelled' && !row.isCompleted && !row.isPast && row.status !== 'Completed' && (
                                    <>
                                      <div className="my-1 border-t border-[#24252c]/5" />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setOpenActionMenuId(null);
                                          setCancelBookingId(row.id);
                                        }}
                                        className="w-full text-left px-3.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                                      >
                                        <span className="w-5 h-5 rounded-md bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                                          <IconX className="w-3 h-3" />
                                        </span>
                                        <div className="flex flex-col min-w-0">
                                          <span className="truncate">Cancel Booking</span>
                                          <span className="text-[10px] font-normal text-[#24252c]/50 truncate">
                                            Cancel this booking
                                          </span>
                                        </div>
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile Row Cards View */}
        <div className="block sm:hidden space-y-3">
          {paginatedBookings.map((row, idx) => {
            const isMobileNearBottom = idx >= Math.max(1, paginatedBookings.length - 2);

            return (
              <div key={row.dbId} className="bg-white rounded-2xl p-4 border border-[#24252c]/10 shadow-sm space-y-3 relative overflow-visible">
                {/* Header: Ref, Customer, Booking Status & Payment Status */}
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <span className="font-bold text-xs text-[#1090F8]">#{row.id}</span>
                    <h4 className="font-extrabold text-sm text-[var(--ink)] mt-0.5">{row.customer}</h4>
                    <div className="text-[11px] text-[#24252c]/60">{row.package}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border inline-flex items-center gap-1 ${
                        row.status === 'Ongoing'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-extrabold'
                          : row.status === 'Upcoming' || row.status === 'Confirmed'
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : row.status === 'Completed'
                          ? 'bg-slate-100 text-slate-700 border-slate-300'
                          : row.status === 'Cancelled'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      {row.status === 'Ongoing' && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      )}
                      {row.status}
                    </span>
                    {row.isFullyPaid ? (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Fully Paid
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                        50% Deposit
                      </span>
                    )}
                  </div>
                </div>

                {/* Schedule, Venue, Crew & Cost */}
                <div className="text-xs space-y-1.5 py-2 border-y border-[#24252c]/[0.06] text-[#24252c]/70">
                  <div className="flex justify-between">
                    <span className="text-[#24252c]/50">Event Date:</span>
                    <span className="font-semibold text-[var(--ink)]">{row.date}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#24252c]/50">Venue:</span>
                    <span className="font-medium text-[var(--ink)] truncate max-w-[200px]">{row.venue}</span>
                  </div>
                  {row.rescheduleStatus === 'pending' && (
                    <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px]">
                      <strong>Reschedule Requested:</strong> {formatDisplayDate(row.rescheduleRequestedDate)}
                    </div>
                  )}
                  <div className="flex justify-between items-start">
                    <span className="text-[#24252c]/50">Crew:</span>
                    <span className="text-[var(--ink)] font-medium text-right max-w-[200px]">
                      {row.assignedCrew.length > 0
                        ? row.assignedCrew.map((c: any) => c.name || c.full_name).join(', ')
                        : <span className="italic text-[#24252c]/40">Unassigned</span>}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-[#24252c]/[0.05]">
                    <span className="text-[#24252c]/50">Cost:</span>
                    <div className="text-right">
                      <span className="font-bold text-[var(--ink)]">{row.total}</span>
                      <span className="text-[11px] text-[#24252c]/60 ml-2">
                        (50% Dep: {row.deposit}, Bal: {row.isFullyPaid ? '₱0' : row.remaining})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Mobile Actions: Clean Primary Action + Actions Dropdown */}
                <div className="flex items-center gap-2 pt-1">
                  {row.rescheduleStatus === 'pending' ? (
                    <button
                      type="button"
                      onClick={() => {
                        setReviewRescheduleBooking(row);
                        setAdminRescheduleNotes(getApprovalEmailTemplate(row));
                      }}
                      className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs py-2 rounded-full shadow-sm text-center cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <IconCalendar className="w-3.5 h-3.5" />
                      <span>Review Reschedule</span>
                    </button>
                  ) : row.status.includes('Pending') ? (
                    <button
                      type="button"
                      onClick={() => setSelectedReceipt(row)}
                      className="flex-1 bg-[#1090F8] hover:bg-[#1090F8]/90 text-white text-xs font-bold py-2 rounded-full transition-colors shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <IconCheck className="w-3.5 h-3.5" />
                      <span>Approve Deposit</span>
                    </button>
                  ) : row.rawStatus === 'cancelled' ? (
                    <button
                      type="button"
                      onClick={() => setRefundModalBooking(row)}
                      className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-bold py-2 rounded-full transition-colors cursor-pointer shadow-2xs"
                    >
                      Process Refund
                    </button>
                  ) : !row.isFullyPaid ? (
                    <button
                      type="button"
                      onClick={() => handleOpenSettleModal(row)}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 rounded-full hover:bg-emerald-700 transition-colors shadow-sm cursor-pointer flex items-center justify-center gap-1"
                    >
                      <span>₱</span>
                      <span>Settle Balance ({row.remaining})</span>
                    </button>
                  ) : null}

                  {/* Mobile Actions Dropdown */}
                  <div className={`relative inline-block text-left booking-action-menu ${row.isFullyPaid && !row.rescheduleStatus && !row.status.includes('Pending') && row.rawStatus !== 'cancelled' ? 'w-full' : ''}`}>
                    <button
                      type="button"
                      onClick={() => setOpenActionMenuId(openActionMenuId === row.dbId ? null : row.dbId)}
                      className={`inline-flex items-center justify-center gap-1 px-3 py-2 rounded-full border text-xs font-bold transition-all cursor-pointer ${
                        row.isFullyPaid && !row.rescheduleStatus && !row.status.includes('Pending') && row.rawStatus !== 'cancelled' ? 'w-full' : ''
                      } ${
                        openActionMenuId === row.dbId
                          ? 'bg-[var(--ink)] text-white border-[var(--ink)]'
                          : 'bg-white hover:bg-[var(--mist)] text-[var(--ink)] border-[#24252c]/15 shadow-2xs'
                      }`}
                    >
                      <span>Actions</span>
                      <IconChevronDown
                        className={`w-3.5 h-3.5 transition-transform duration-200 ${
                          openActionMenuId === row.dbId ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {openActionMenuId === row.dbId && (
                      <div
                        className={`absolute right-0 ${
                          isMobileNearBottom ? 'bottom-full mb-2 origin-bottom-right' : 'top-full mt-2 origin-top-right'
                        } w-56 bg-white rounded-2xl shadow-xl border border-[#24252c]/10 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 text-left`}
                      >
                        <div className="px-3.5 py-1 text-[10px] font-bold text-[#24252c]/40 uppercase tracking-wider">
                          Booking Actions
                        </div>

                        {/* Settle / Payment Details */}
                        {row.rawStatus !== 'cancelled' && (
                          <button
                            type="button"
                            onClick={() => {
                              setOpenActionMenuId(null);
                              handleOpenSettleModal(row);
                            }}
                            className="w-full text-left px-3.5 py-2 text-xs font-semibold text-[var(--ink)] hover:bg-emerald-50 hover:text-emerald-800 flex items-center gap-2.5 transition-colors cursor-pointer"
                          >
                            <span className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center text-[11px] font-bold shrink-0">
                              ₱
                            </span>
                            <div className="flex flex-col min-w-0">
                              <span className="truncate">
                                {row.isFullyPaid ? 'Payment Settlement' : 'Settle Balance'}
                              </span>
                              <span className="text-[10px] font-normal text-[#24252c]/50 truncate">
                                {row.isFullyPaid ? 'View & edit settlement proof' : `Bal: ${row.remaining}`}
                              </span>
                            </div>
                          </button>
                        )}

                        {/* Mark as Completed Event */}
                        {row.rawStatus !== 'cancelled' && !row.isCompleted && row.status !== 'Completed' && (
                          <button
                            type="button"
                            onClick={() => {
                              setOpenActionMenuId(null);
                              handleMarkAsCompleted(row);
                            }}
                            className="w-full text-left px-3.5 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                          >
                            <span className="w-5 h-5 rounded-md bg-blue-100 text-[#1090F8] flex items-center justify-center font-bold text-[11px] shrink-0">
                              ✓
                            </span>
                            <div className="flex flex-col min-w-0">
                              <span className="truncate">Mark as Completed</span>
                              <span className="text-[10px] font-normal text-[#24252c]/50 truncate">
                                {row.isToday ? 'Event is today' : 'Set status to completed'}
                              </span>
                            </div>
                          </button>
                        )}

                         {/* Undo Mark as Completed (Allowed if event is today or not past) */}
                         {row.rawStatus !== "cancelled" && (row.isCompleted || row.status === "Completed") && (row.isToday || !row.isPast) && (
                           <button
                             type="button"
                             onClick={() => {
                               setOpenActionMenuId(null);
                               handleUndoMarkAsCompleted(row);
                             }}
                             className="w-full text-left px-3.5 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                           >
                             <span className="w-5 h-5 rounded-md bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-[11px] shrink-0">
                               ↺
                             </span>
                             <div className="flex flex-col min-w-0">
                               <span className="truncate">Undo Completed</span>
                               <span className="text-[10px] font-normal text-[#24252c]/50 truncate">
                                 {row.isToday ? "Reopen as Ongoing (Today)" : "Reopen as Upcoming"}
                               </span>
                             </div>
                           </button>
                         )}

                        {/* Reschedule Date (Hidden if completed, past date, or cancelled) */}
                        {row.rawStatus !== 'cancelled' && !row.isCompleted && !row.isPast && row.status !== 'Completed' && (
                          <button
                            type="button"
                            onClick={() => {
                              setOpenActionMenuId(null);
                              setRescheduleBooking(row);
                              const targetDate = row.rawDate ? row.rawDate.slice(0, 10) : '';
                              setNewRescheduleDate(targetDate);
                              setAdminRescheduleNotes(getDirectRescheduleEmailTemplate(row, targetDate));
                            }}
                            className="w-full text-left px-3.5 py-2 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--mist)] flex items-center gap-2.5 transition-colors cursor-pointer"
                          >
                            <span className="w-5 h-5 rounded-md bg-[#24252c]/10 text-[var(--ink)] flex items-center justify-center shrink-0">
                              <IconCalendar className="w-3 h-3" />
                            </span>
                            <div className="flex flex-col min-w-0">
                              <span className="truncate">Reschedule Date</span>
                              <span className="text-[10px] font-normal text-[#24252c]/50 truncate">
                                Change event date
                              </span>
                            </div>
                          </button>
                        )}

                        {/* Proof Slips */}
                        {(row.depositReceiptUrl || row.balanceReceiptUrl) && (
                          <button
                            type="button"
                            onClick={() => {
                              setOpenActionMenuId(null);
                              setSelectedReceipt(row);
                            }}
                            className="w-full text-left px-3.5 py-2 text-xs font-semibold text-[var(--ink)] hover:bg-purple-50 hover:text-purple-800 flex items-center gap-2.5 transition-colors cursor-pointer"
                          >
                            <span className="w-5 h-5 rounded-md bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                              <IconEye className="w-3 h-3" />
                            </span>
                            <div className="flex flex-col min-w-0">
                              <span className="truncate">View Proof Slips</span>
                              <span className="text-[10px] font-normal text-[#24252c]/50 truncate">
                                Deposit & settlement receipts
                              </span>
                            </div>
                          </button>
                        )}

                        {/* Crew (Hidden if completed, past date, or cancelled) */}
                        {row.rawStatus !== 'cancelled' && !row.isCompleted && !row.isPast && row.status !== 'Completed' && (
                          <button
                            type="button"
                            onClick={() => {
                              setOpenActionMenuId(null);
                              setAssignCrewBooking(row);
                            }}
                            className="w-full text-left px-3.5 py-2 text-xs font-semibold text-[var(--ink)] hover:bg-indigo-50 hover:text-indigo-800 flex items-center gap-2.5 transition-colors cursor-pointer"
                          >
                            <span className="w-5 h-5 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                              <IconUser className="w-3 h-3" />
                            </span>
                            <div className="flex flex-col min-w-0">
                              <span className="truncate">Assign Crew</span>
                              <span className="text-[10px] font-normal text-[#24252c]/50 truncate">
                                {row.assignedCrew.length > 0
                                  ? `${row.assignedCrew.length} assigned`
                                  : 'Assign production crew'}
                              </span>
                            </div>
                          </button>
                        )}

                        {/* Cancel Booking (Hidden if completed, past date, or cancelled) */}
                        {row.rawStatus !== 'cancelled' && !row.isCompleted && !row.isPast && row.status !== 'Completed' && (
                          <>
                            <div className="my-1 border-t border-[#24252c]/5" />
                            <button
                              type="button"
                              onClick={() => {
                                setOpenActionMenuId(null);
                                setCancelBookingId(row.id);
                              }}
                              className="w-full text-left px-3.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                            >
                              <span className="w-5 h-5 rounded-md bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                                <IconX className="w-3 h-3" />
                              </span>
                              <div className="flex flex-col min-w-0">
                                <span className="truncate">Cancel Booking</span>
                                <span className="text-[10px] font-normal text-[#24252c]/50 truncate">
                                  Cancel this booking
                                </span>
                              </div>
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Pagination Footer */}
        <TablePagination
          currentPage={currentPage}
          pageSize={pageSize}
          totalItems={filtered.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={(sz) => {
            setPageSize(sz);
            setCurrentPage(1);
          }}
        />

      {/* ── Modal 1: Review Customer Reschedule Request ── */}
      <ModalOverlay isOpen={!!reviewRescheduleBooking} onClose={() => setReviewRescheduleBooking(null)}>
        {reviewRescheduleBooking && (
          <div className="bg-white rounded-[2.5rem] max-w-xl w-full max-h-[85vh] shadow-2xl border border-[#24252c]/10 relative p-1.5 sm:p-2.5 overflow-hidden flex flex-col">
            <button
              type="button"
              onClick={() => setReviewRescheduleBooking(null)}
              className="absolute top-6 right-6 z-20 text-[#24252c]/50 hover:text-[var(--ink)] p-1.5 rounded-full hover:bg-[var(--mist)] transition-colors bg-white/90 backdrop-blur-md shadow-sm border border-[#24252c]/10 cursor-pointer"
            >
              <IconX className="w-5 h-5" />
            </button>

            <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-4 modal-scroll pr-4 sm:pr-6">
              <div className="mb-2 pb-3 border-b border-[#24252c]/[0.06]">
                <div className="flex items-center gap-2 mb-1">
                  <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600">
                    <IconCalendar className="w-4 h-4" />
                  </span>
                  <h3 className="text-xl font-extrabold text-[var(--ink)]">
                    Review Reschedule Request
                  </h3>
                </div>
                <p className="text-xs text-[#24252c]/60">
                  Customer requested a new date for Booking #{reviewRescheduleBooking.id}. Review calendar availability before confirming or declining.
                </p>
              </div>

              <div className="space-y-4 text-xs">
                {/* Customer & Booking Header */}
                <div className="p-3.5 rounded-2xl bg-[var(--mist)] border border-[#24252c]/[0.06] flex items-center justify-between">
                  <div>
                    <div className="font-extrabold text-sm text-[var(--ink)]">{reviewRescheduleBooking.customer}</div>
                    <div className="text-[11px] text-[#24252c]/60">{reviewRescheduleBooking.email} · {reviewRescheduleBooking.phone || 'No phone'}</div>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-xs text-[var(--ink)] block">{reviewRescheduleBooking.package}</span>
                    <span className="text-[10px] font-mono text-[#1090F8]">Ref #{reviewRescheduleBooking.id}</span>
                  </div>
                </div>

                {/* Date Comparison Box */}
                <div className="p-4 rounded-2xl bg-amber-50/90 border border-amber-300/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                  <div className="space-y-1">
                    <span className="text-[10px] font-extrabold text-amber-800 uppercase tracking-wider block">
                      Current Schedule
                    </span>
                    <span className="font-bold text-xs text-amber-900 line-through opacity-75 inline-block bg-amber-100/60 px-2.5 py-1 rounded-lg">
                      {reviewRescheduleBooking.date}
                    </span>
                  </div>
                  <div className="hidden sm:flex items-center justify-center w-8 h-8 rounded-full bg-amber-200/80 text-amber-800 font-black text-sm shrink-0">
                    →
                  </div>
                  <div className="space-y-1.5 sm:text-right">
                    <span className="text-[10px] font-extrabold text-amber-800 uppercase tracking-wider block">
                      Requested New Date
                    </span>
                    <span className="font-black text-sm text-amber-950 bg-amber-200 px-3.5 py-1.5 rounded-full border border-amber-400/70 shadow-xs inline-block">
                      {formatDisplayDate(reviewRescheduleBooking.rescheduleRequestedDate)}
                    </span>
                  </div>
                </div>

                {/* Customer Reason Note */}
                <div>
                  <label className="text-[10px] font-bold uppercase text-[#24252c]/50 block mb-1">
                    Customer's Reason / Request Message:
                  </label>
                  <div className="p-3.5 rounded-2xl bg-white border border-[#24252c]/15 text-xs text-[var(--ink)] italic">
                    "{reviewRescheduleBooking.rescheduleReason || 'No specific reason provided.'}"
                  </div>
                </div>

                {/* Live Calendar Availability Preview */}
                <div>
                  <label className="text-[10px] font-bold uppercase text-[#24252c]/50 block mb-1.5">
                    Live Production Schedule on Requested Month:
                  </label>
                  <div className="p-4 rounded-2xl bg-white border border-[#24252c]/15 shadow-2xs">
                    <BookingRescheduleCalendar
                      originalDate={reviewRescheduleBooking.rawDate}
                      selectedDate={reviewRescheduleBooking.rescheduleRequestedDate ? reviewRescheduleBooking.rescheduleRequestedDate.slice(0, 10) : ''}
                      onSelectDate={() => {}}
                      excludeBookingId={reviewRescheduleBooking.dbId}
                    />
                  </div>
                </div>

                {/* Built-in Prefilled Email Message Box */}
                <div className="space-y-2 pt-2 border-t border-[#24252c]/[0.08]">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <label className="text-[11px] font-black uppercase text-[var(--ink)] block">
                        Customer Email Notification
                      </label>
                      <span className="text-[10px] text-[#24252c]/60">
                        Recipient: <strong className="text-[#1090F8] font-mono">{reviewRescheduleBooking.email}</strong>
                      </span>
                    </div>

                    {/* Quick Template Chips */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setAdminRescheduleNotes(getApprovalEmailTemplate(reviewRescheduleBooking))}
                        className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer"
                      >
                        Approval Note
                      </button>
                      <button
                        type="button"
                        onClick={() => setAdminRescheduleNotes(getDeclineEmailTemplate(reviewRescheduleBooking))}
                        className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors cursor-pointer"
                      >
                        Decline Note
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setAdminRescheduleNotes(
                            `Dear ${reviewRescheduleBooking.customer},\n\nRegarding your request to reschedule Booking #${reviewRescheduleBooking.id}, our team has adjusted our technical logistics to accommodate your event on ${formatDisplayDate(reviewRescheduleBooking.rescheduleRequestedDate)}.\n\nWarm regards,\nBINHI Concept Production Team`
                          )
                        }
                        className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-blue-50 text-[#1090F8] border border-blue-200 hover:bg-blue-100 transition-colors cursor-pointer"
                      >
                        Logistics Note
                      </button>
                    </div>
                  </div>

                  <textarea
                    rows={6}
                    value={adminRescheduleNotes}
                    onChange={(e) => setAdminRescheduleNotes(e.target.value)}
                    placeholder="Enter or customize the message to be sent to the customer..."
                    className="w-full rounded-2xl border border-black/10 px-4 py-3 bg-[#F8F9FA] focus:bg-white text-xs font-medium text-[var(--ink)] placeholder:text-[#24252c]/40 focus:outline-none focus:border-[#1090F8] transition-colors resize-none leading-relaxed"
                    required
                  />
                  <div className="flex justify-between items-center text-[10px] text-[#24252c]/50 px-1">
                    <span>This message will be dispatched via official BINHI email letterhead.</span>
                    <span className="font-mono font-semibold">{adminRescheduleNotes.length} chars</span>
                  </div>
                </div>

                {/* Actions: Decline / Approve */}
                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#24252c]/[0.06]">
                  <button
                    type="button"
                    disabled={isProcessingReschedule}
                    onClick={handleDeclineCustomerReschedule}
                    className="px-5 py-2.5 rounded-full border border-rose-300 text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <span>{isProcessingReschedule ? 'Processing...' : 'Decline & Email Customer'}</span>
                  </button>
                  <button
                    type="button"
                    disabled={isProcessingReschedule}
                    onClick={handleApproveCustomerReschedule}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-6 py-2.5 rounded-full shadow-md transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <IconCheck className="w-4 h-4" />
                    <span>{isProcessingReschedule ? 'Approving & Emailing...' : 'Approve & Confirm Date'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </ModalOverlay>

      {/* ── Modal 2: Direct / Manual Admin Reschedule Modal ── */}
      <ModalOverlay isOpen={!!rescheduleBooking} onClose={() => setRescheduleBooking(null)}>
        {rescheduleBooking && (
          <div className="bg-white rounded-[2.5rem] max-w-xl w-full max-h-[85vh] shadow-2xl border border-[#24252c]/10 relative p-1.5 sm:p-2.5 overflow-hidden flex flex-col">
            <button
              type="button"
              onClick={() => setRescheduleBooking(null)}
              className="absolute top-6 right-6 z-20 text-[#24252c]/50 hover:text-[var(--ink)] p-1.5 rounded-full hover:bg-[var(--mist)] transition-colors bg-white/90 backdrop-blur-md shadow-sm border border-[#24252c]/10 cursor-pointer"
            >
              <IconX className="w-5 h-5" />
            </button>

            <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-4 modal-scroll pr-4 sm:pr-6">
              <div className="mb-2 pb-3 border-b border-[#24252c]/[0.06]">
                <div className="flex items-center gap-2 mb-1">
                  <span className="p-1.5 rounded-lg bg-[#1090F8]/10 text-[#1090F8]">
                    <IconCalendar className="w-4 h-4" />
                  </span>
                  <h3 className="text-xl font-extrabold text-[var(--ink)]">
                    Direct Reschedule (Admin Override)
                  </h3>
                </div>
                <p className="text-xs text-[#24252c]/60">
                  Directly select and lock a new event date for #{rescheduleBooking.id}. The customer will automatically receive an email confirmation.
                </p>
              </div>

              <form onSubmit={handleDirectAdminReschedule} className="space-y-4 text-xs">
                {/* Booking Summary */}
                <div className="p-3.5 rounded-2xl bg-[var(--mist)] border border-[#24252c]/[0.06] flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-[#24252c]/50 block">Current Schedule</span>
                    <span className="font-extrabold text-sm text-[var(--ink)]">{rescheduleBooking.date}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-xs text-[var(--ink)] block">{rescheduleBooking.customer}</span>
                    <span className="text-[10px] font-mono text-[#1090F8]">Ref #{rescheduleBooking.id}</span>
                  </div>
                </div>

                {/* Interactive Calendar with availability */}
                <div className="p-4 rounded-2xl bg-white border border-[#24252c]/15 shadow-2xs">
                  <BookingRescheduleCalendar
                    originalDate={rescheduleBooking.rawDate}
                    selectedDate={newRescheduleDate}
                    onSelectDate={(d) => {
                      setNewRescheduleDate(d);
                      setAdminRescheduleNotes(getDirectRescheduleEmailTemplate(rescheduleBooking, d));
                    }}
                    excludeBookingId={rescheduleBooking.dbId}
                  />
                </div>

                {/* Selected Target Date Alert */}
                {newRescheduleDate && (
                  <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-950 flex items-center justify-between">
                    <span className="font-semibold text-xs">Target Reschedule Date:</span>
                    <span className="font-extrabold text-xs text-[#1090F8] bg-white px-3 py-1 rounded-full border border-blue-300 shadow-2xs">
                      {formatDisplayDate(newRescheduleDate)}
                    </span>
                  </div>
                )}

                {/* Built-in Prefilled Email Message Box */}
                <div className="space-y-2 pt-2 border-t border-[#24252c]/[0.08]">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <label className="text-[11px] font-black uppercase text-[var(--ink)] block">
                        Customer Email Notification
                      </label>
                      <span className="text-[10px] text-[#24252c]/60">
                        Recipient: <strong className="text-[#1090F8] font-mono">{rescheduleBooking.email}</strong>
                      </span>
                    </div>

                    {/* Quick Template Chips */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() =>
                          setAdminRescheduleNotes(
                            getDirectRescheduleEmailTemplate(rescheduleBooking, newRescheduleDate || rescheduleBooking.rawDate)
                          )
                        }
                        className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-blue-50 text-[#1090F8] border border-blue-200 hover:bg-blue-100 transition-colors cursor-pointer"
                      >
                        Standard Notice
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setAdminRescheduleNotes(
                            `Dear ${rescheduleBooking.customer},\n\nAs discussed during our phone coordination regarding Booking #${rescheduleBooking.id}, your event date has been moved to ${formatDisplayDate(newRescheduleDate || rescheduleBooking.rawDate)}. All equipment inclusions and crew assignments remain secured.\n\nWarm regards,\nBINHI Concept Production Team`
                          )
                        }
                        className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition-colors cursor-pointer"
                      >
                        Phone Coordination
                      </button>
                    </div>
                  </div>

                  <textarea
                    rows={5}
                    value={adminRescheduleNotes}
                    onChange={(e) => setAdminRescheduleNotes(e.target.value)}
                    placeholder="Enter or customize the email notice for the customer..."
                    className="w-full rounded-2xl border border-black/10 px-4 py-3 bg-[#F8F9FA] focus:bg-white text-xs font-medium text-[var(--ink)] placeholder:text-[#24252c]/40 focus:outline-none focus:border-[#1090F8] transition-colors resize-none leading-relaxed"
                    required
                  />
                  <div className="flex justify-between items-center text-[10px] text-[#24252c]/50 px-1">
                    <span>This confirmation email will be automatically sent upon saving.</span>
                    <span className="font-mono font-semibold">{adminRescheduleNotes.length} chars</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#24252c]/[0.06]">
                  <button
                    type="button"
                    onClick={() => setRescheduleBooking(null)}
                    className="px-5 py-2.5 rounded-full border border-black/10 text-xs font-semibold text-[var(--ink)] hover:bg-[#F0F0F0] transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isProcessingReschedule || !newRescheduleDate}
                    className="bg-[var(--ink)] disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors cursor-pointer text-xs shadow-md flex items-center gap-1.5"
                  >
                    {isProcessingReschedule ? 'Saving & Emailing...' : 'Confirm & Reschedule Date'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </ModalOverlay>

      {/* ── Proof of Payment & Slips Viewer Modal ── */}
      <ModalOverlay isOpen={!!selectedReceipt} onClose={() => setSelectedReceipt(null)}>
        <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] max-w-lg w-full max-h-[85vh] shadow-2xl border border-[#24252c]/10 relative flex flex-col overflow-hidden text-xs">
          {/* Fixed Header */}
          <div className="p-5 sm:p-6 pb-4 border-b border-[#24252c]/[0.08] flex items-center justify-between shrink-0 bg-white">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-2xl bg-[#1090F8]/10 text-[#1090F8] font-bold text-sm flex items-center justify-center shrink-0">
                ₱
              </span>
              <div>
                <h3 className="text-lg sm:text-xl font-extrabold text-[var(--ink)]">
                  Payment & Proof Slips
                </h3>
                <p className="text-[11px] text-[#24252c]/60">
                  <span className="font-mono font-bold text-[#1090F8]">#{activeSelectedReceipt.id}</span> · <span className="font-semibold text-[var(--ink)]">{activeSelectedReceipt.customer}</span>
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSelectedReceipt(null)}
              className="text-[#24252c]/50 hover:text-[var(--ink)] p-2 rounded-full hover:bg-[var(--mist)] transition-colors cursor-pointer bg-white shadow-2xs border border-[#24252c]/10"
            >
              <IconX className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 custom-scrollbar">
            {/* Booking Financial Overview */}
            <div className="bg-[var(--mist)] p-4 rounded-2xl border border-[#24252c]/10 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[#24252c]/50">Package & Venue:</span>
                <span className="font-bold text-[var(--ink)] text-right max-w-[220px] truncate">{activeSelectedReceipt.package}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#24252c]/50">Total Event Cost:</span>
                <span className="font-extrabold text-[var(--ink)]">{activeSelectedReceipt.total}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#24252c]/50">50% Deposit Paid:</span>
                <span className="font-extrabold text-emerald-600">{activeSelectedReceipt.deposit}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#24252c]/50">Remaining Balance:</span>
                <span className="font-extrabold text-[#1090F8]">
                  {activeSelectedReceipt.isFullyPaid ? '₱0 (100% Settled)' : activeSelectedReceipt.remaining}
                </span>
              </div>
              <div className="flex justify-between pt-1 border-t border-[#24252c]/[0.06]">
                <span className="text-[#24252c]/50">Event Schedule:</span>
                <span className="font-semibold text-[var(--ink)]">{activeSelectedReceipt.date}</span>
              </div>
            </div>

            {/* Receipts Section */}
            <div className="space-y-3">
              {/* 1. Deposit Receipt Slip */}
              {activeSelectedReceipt.depositReceiptUrl ? (
                <div className="rounded-2xl bg-white border border-[#24252c]/15 overflow-hidden p-3 shadow-2xs">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      <span className="text-xs font-bold text-[var(--ink)]">50% Initial Deposit Proof</span>
                    </div>
                    <a
                      href={activeSelectedReceipt.depositReceiptUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] font-bold text-[#1090F8] hover:underline"
                    >
                      View Full Image ↗
                    </a>
                  </div>
                  <div className="aspect-[16/9] rounded-xl overflow-hidden bg-[var(--mist)] flex items-center justify-center border border-[#24252c]/10">
                    <img
                      src={activeSelectedReceipt.depositReceiptUrl}
                      alt="50% Deposit Proof Slip"
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>
              ) : null}

              {/* 2. Balance Settlement Receipt Slip */}
              {activeSelectedReceipt.balanceReceiptUrl && (
                <div className="rounded-2xl bg-white border border-emerald-300 overflow-hidden p-3 shadow-2xs bg-emerald-50/20">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className="text-xs font-bold text-emerald-950">
                        Balance Settlement Proof ({activeSelectedReceipt.balancePaymentMethod || 'Event Day'})
                      </span>
                    </div>
                    <a
                      href={activeSelectedReceipt.balanceReceiptUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] font-bold text-emerald-700 hover:underline"
                    >
                      View Full Image ↗
                    </a>
                  </div>
                  <div className="aspect-[16/9] rounded-xl overflow-hidden bg-[var(--mist)] flex items-center justify-center border border-emerald-200">
                    <img
                      src={activeSelectedReceipt.balanceReceiptUrl}
                      alt="Balance Settlement Receipt Slip"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  {activeSelectedReceipt.balancePaidAt && (
                    <div className="text-[10px] text-emerald-800 font-medium mt-1.5">
                      Settled on: <strong>{activeSelectedReceipt.balancePaidAt}</strong>
                    </div>
                  )}
                </div>
              )}

              {/* Fallback if no image receipt uploaded yet */}
              {!activeSelectedReceipt.depositReceiptUrl && !activeSelectedReceipt.balanceReceiptUrl && (
                <div className="rounded-2xl bg-[var(--mist)] border border-[#24252c]/10 flex flex-col items-center justify-center p-6 text-center">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-600 font-bold text-lg flex items-center justify-center mb-2">
                    ✓
                  </div>
                  <div className="font-bold text-xs text-[var(--ink)]">Payment Slip Confirmed</div>
                  <div className="text-[11px] text-[#24252c]/60 mt-0.5">
                    Verified Payment: {activeSelectedReceipt.deposit} via {activeSelectedReceipt.paymentChannel || 'PayMongo'}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Fixed Footer */}
          <div className="p-4 sm:p-5 border-t border-[#24252c]/[0.08] bg-white space-y-2 shrink-0">
            {activeSelectedReceipt.status?.includes('Pending') && (
              <button
                type="button"
                onClick={() => handleApproveDeposit(activeSelectedReceipt)}
                className="w-full bg-emerald-600 text-white font-bold py-3 rounded-full hover:bg-emerald-700 transition-colors shadow-md cursor-pointer text-xs flex items-center justify-center gap-1.5"
              >
                <IconCheck className="w-4 h-4" />
                <span>Approve Deposit & Confirm Reservation</span>
              </button>
            )}

            {activeSelectedReceipt.rawStatus !== 'cancelled' && (
              <button
                type="button"
                onClick={() => {
                  const target = selectedReceipt;
                  setSelectedReceipt(null);
                  if (target) handleOpenSettleModal(target);
                }}
                className="w-full bg-[var(--ink)] text-white font-bold py-3 rounded-full hover:bg-[var(--ink-soft)] transition-colors shadow-sm cursor-pointer text-xs flex items-center justify-center gap-1.5"
              >
                <span>₱</span>
                <span>{activeSelectedReceipt.isFullyPaid ? 'Edit Payment Settlement' : 'Settle Event Day Balance'}</span>
              </button>
            )}
          </div>
        </div>
      </ModalOverlay>

      {/* ── Balance Settlement & Full Payment Modal ── */}
      <ModalOverlay isOpen={!!settleModalBooking} onClose={() => setSettleModalBooking(null)}>
        {settleModalBooking && (
          <div className="bg-white rounded-[2rem] sm:rounded-[2.5rem] max-w-lg w-full max-h-[85vh] shadow-2xl border border-[#24252c]/10 relative flex flex-col overflow-hidden text-xs">
            {/* Fixed Header */}
            <div className="p-5 sm:p-6 pb-4 border-b border-[#24252c]/[0.08] flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center gap-3">
                <span className={`w-9 h-9 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 ${
                  settleModalBooking.isFullyPaid && !isSettlementEditMode
                    ? 'bg-emerald-500/10 text-emerald-600'
                    : 'bg-[#1090F8]/10 text-[#1090F8]'
                }`}>
                  {settleModalBooking.isFullyPaid && !isSettlementEditMode ? '✓' : '₱'}
                </span>
                <div>
                  <h3 className="text-lg sm:text-xl font-extrabold text-[var(--ink)]">
                    {settleModalBooking.isFullyPaid && !isSettlementEditMode ? 'Payment Details' : 'Manual Payment Settlement'}
                  </h3>
                  <p className="text-[11px] text-[#24252c]/60">
                    <span className="font-mono font-bold text-[#1090F8]">#{settleModalBooking.id}</span> · <span className="font-semibold text-[var(--ink)]">{settleModalBooking.customer}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSettleModalBooking(null)}
                className="text-[#24252c]/50 hover:text-[var(--ink)] p-2 rounded-full hover:bg-[var(--mist)] transition-colors cursor-pointer bg-white shadow-2xs border border-[#24252c]/10"
              >
                <IconX className="w-5 h-5" />
              </button>
            </div>

            {/* ── VIEW ONLY MODE: For bookings that are already 100% fully paid (e.g. PayMongo or already settled) ── */}
            {settleModalBooking.isFullyPaid && !isSettlementEditMode ? (
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                {/* Scrollable Body */}
                <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 custom-scrollbar">
                  {/* 100% Fully Settled Verified Badge */}
                  {settleModalBooking.paymentChannel?.toLowerCase().includes('paymongo') &&
                   !settleModalBooking.balancePaymentMethod?.toLowerCase().includes('cash') &&
                   !settleModalBooking.balancePaymentMethod?.toLowerCase().includes('gcash') &&
                   !settleModalBooking.balancePaymentMethod?.toLowerCase().includes('maya') &&
                   !settleModalBooking.balancePaymentMethod?.toLowerCase().includes('bank') &&
                   !settleModalBooking.balancePaymentMethod?.toLowerCase().includes('cheque') &&
                   !settleModalBooking.balanceReceiptUrl &&
                   !settleModalBooking.bookingSource?.toLowerCase().includes('walk-in') &&
                   !settleModalBooking.bookingSource?.toLowerCase().includes('manual') ? (
                    <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-blue-950 flex items-start gap-3 shadow-2xs">
                      <span className="w-7 h-7 rounded-full bg-[#1090F8] text-white flex items-center justify-center font-black text-xs shrink-0 shadow-2xs mt-0.5">
                        ✓
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="font-extrabold text-sm text-blue-950">PayMongo Online Payment</strong>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 uppercase tracking-wider">
                            View Only
                          </span>
                        </div>
                        <p className="text-xs text-blue-900/80 mt-1 leading-relaxed">
                          This booking was paid online directly via PayMongo Checkout. Gateway transaction records are locked in view-only mode.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-950 flex items-start gap-3 shadow-2xs">
                      <span className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-2xs mt-0.5">
                        ✓
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="font-extrabold text-sm text-emerald-950">Manual Settlement</strong>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-200/70 text-emerald-900 uppercase tracking-wider">
                            Fully Settled
                          </span>
                        </div>
                        <p className="text-xs text-emerald-900/80 mt-1 leading-relaxed">
                          Settled via <strong className="text-emerald-950">{settleModalBooking.balancePaymentMethod || 'Manual Payment'}</strong>. Zero remaining balance.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Structured Financial Details Breakdown */}
                  <div className="bg-[var(--mist)] p-4 rounded-2xl border border-[#24252c]/10 space-y-2.5">
                    <div className="flex justify-between items-center">
                      <span className="text-[#24252c]/50">Package:</span>
                      <span className="font-bold text-[var(--ink)] text-right max-w-[200px] truncate">{settleModalBooking.package}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#24252c]/50">Total Event Cost:</span>
                      <span className="font-extrabold text-[var(--ink)]">{settleModalBooking.total}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#24252c]/50">Amount Paid in Full:</span>
                      <span className="font-extrabold text-emerald-600">{settleModalBooking.total}</span>
                    </div>
                    <div className="flex justify-between items-center pt-1.5 border-t border-[#24252c]/[0.06]">
                      <span className="text-[#24252c]/50">Remaining Balance:</span>
                      <span className="font-black text-emerald-700">₱0.00 (Zero Due)</span>
                    </div>
                    <div className="flex justify-between items-center pt-1.5 border-t border-[#24252c]/[0.06]">
                      <span className="text-[#24252c]/50">Payment Method / Channel:</span>
                      <span className="font-bold text-[var(--ink)]">{settleModalBooking.balancePaymentMethod || settleModalBooking.paymentChannel || 'PayMongo Online Payment'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#24252c]/50">Settlement Date:</span>
                      <span className="font-semibold text-[var(--ink)]">{settleModalBooking.balancePaidAt || settleModalBooking.date}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[#24252c]/50">Transaction Reference:</span>
                      <span className="font-mono font-bold text-[#1090F8]">#{settleModalBooking.id}</span>
                    </div>
                  </div>

                  {/* Attached Proof or Online Gateway Verification */}
                  {settleModalBooking.balanceReceiptUrl || settleModalBooking.depositReceiptUrl ? (
                    <div className="rounded-2xl bg-white border border-[#24252c]/15 overflow-hidden p-3 shadow-2xs">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold text-[#24252c]/70">Attached Payment Proof:</span>
                        <a
                          href={settleModalBooking.balanceReceiptUrl || settleModalBooking.depositReceiptUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] font-bold text-[#1090F8] hover:underline"
                        >
                          View Full Image ↗
                        </a>
                      </div>
                      <div className="aspect-[16/9] rounded-xl overflow-hidden bg-[var(--mist)] flex items-center justify-center border border-[#24252c]/10">
                        <img
                          src={settleModalBooking.balanceReceiptUrl || settleModalBooking.depositReceiptUrl}
                          alt="Payment Proof"
                          className="w-full h-full object-contain"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200/80 text-blue-900 text-xs flex items-center gap-2.5">
                      <span className="w-2 h-2 rounded-full bg-[#1090F8] shrink-0" />
                      <span>Verified transaction record. Gateway digital confirmation secured.</span>
                    </div>
                  )}
                </div>

                {/* Fixed Footer Actions: Close & Edit Settlement Button for Manual Settlements */}
                <div className="p-4 sm:p-5 border-t border-[#24252c]/[0.08] bg-white shrink-0">
                  {settleModalBooking.paymentChannel?.toLowerCase().includes('paymongo') &&
                   !settleModalBooking.balancePaymentMethod?.toLowerCase().includes('cash') &&
                   !settleModalBooking.balancePaymentMethod?.toLowerCase().includes('gcash') &&
                   !settleModalBooking.balancePaymentMethod?.toLowerCase().includes('maya') &&
                   !settleModalBooking.balancePaymentMethod?.toLowerCase().includes('bank') &&
                   !settleModalBooking.balancePaymentMethod?.toLowerCase().includes('cheque') &&
                   !settleModalBooking.balanceReceiptUrl &&
                   !settleModalBooking.bookingSource?.toLowerCase().includes('walk-in') &&
                   !settleModalBooking.bookingSource?.toLowerCase().includes('manual') ? (
                    <button
                      type="button"
                      onClick={() => setSettleModalBooking(null)}
                      className="w-full py-3 rounded-full bg-[var(--ink)] hover:bg-[var(--ink-soft)] text-white font-bold text-xs transition-colors cursor-pointer shadow-sm text-center"
                    >
                      Close Payment View
                    </button>
                  ) : (
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => setSettleModalBooking(null)}
                        className="px-5 py-3 rounded-full border border-black/10 text-xs font-semibold text-[var(--ink)] hover:bg-[#F0F0F0] transition-colors cursor-pointer"
                      >
                        Close
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsSettlementEditMode(true)}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-full transition-colors shadow-md hover:shadow-lg cursor-pointer text-xs flex items-center justify-center gap-1.5"
                      >
                        <span>✎</span>
                        <span>Edit Settlement</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* ── EDIT / MANUAL SETTLEMENT FORM ── */
              <form onSubmit={handleSaveBalanceSettlement} className="flex-1 flex flex-col min-h-0 overflow-hidden">
                {/* Scrollable Form Body */}
                <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 custom-scrollbar">
                  {/* Financial Summary Card */}
                  <div className="bg-gradient-to-br from-[var(--mist)] to-white p-4 rounded-2xl border border-[#24252c]/10 space-y-2 text-xs shadow-2xs">
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
                      <span className="font-black text-[#1090F8]">
                        {isFullyPaidInput ? '₱0 (Fully Settled)' : settleModalBooking.remaining}
                      </span>
                    </div>
                  </div>

                  {/* Checkbox: Mark as Fully Paid */}
                  <label className="flex items-center gap-3 p-3.5 rounded-2xl border-2 border-emerald-300 bg-emerald-50/50 cursor-pointer hover:bg-emerald-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={isFullyPaidInput}
                      onChange={(e) => setIsFullyPaidInput(e.target.checked)}
                      className="w-4 h-4 text-emerald-600 rounded accent-emerald-600 cursor-pointer"
                    />
                    <div>
                      <div className="font-extrabold text-emerald-950 text-xs">Mark as 100% Fully Paid</div>
                      <div className="text-[11px] text-emerald-800">Sets remaining balance to ₱0 and unlocks loyalty rewards</div>
                    </div>
                  </label>

                  {/* Settlement / Event Payment Date */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-bold uppercase text-[10px] text-[#24252c]/60">
                        Payment Date <span className="text-rose-500">*</span>
                      </label>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setBalancePaymentDate(new Date().toISOString().slice(0, 10))}
                          className="text-[10px] font-bold text-[#1090F8] hover:underline cursor-pointer"
                        >
                          Today
                        </button>
                        <span className="text-[#24252c]/30">·</span>
                        <button
                          type="button"
                          onClick={() => {
                            if (settleModalBooking.rawDate) {
                              setBalancePaymentDate(settleModalBooking.rawDate.slice(0, 10));
                            }
                          }}
                          className="text-[10px] font-bold text-[#1090F8] hover:underline cursor-pointer"
                        >
                          Event Day
                        </button>
                      </div>
                    </div>
                    <input
                      type="date"
                      value={balancePaymentDate}
                      onChange={(e) => setBalancePaymentDate(e.target.value)}
                      className="w-full rounded-2xl border border-[#24252c]/15 px-4 py-2.5 bg-[#F8F9FA] text-[var(--ink)] font-bold text-xs focus:outline-none focus:border-[#1090F8] focus:bg-white transition-colors"
                      required
                    />
                  </div>

                  {/* Payment Method Selector */}
                  <div>
                    <label className="font-bold uppercase text-[10px] text-[#24252c]/60 block mb-1">
                      Payment Settlement Method <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={balanceMethodInput}
                      onChange={(e) => setBalanceMethodInput(e.target.value)}
                      className="w-full rounded-2xl border border-[#24252c]/15 px-4 py-3 bg-[#F8F9FA] text-[var(--ink)] font-bold focus:outline-none focus:border-[#1090F8] focus:bg-white cursor-pointer transition-colors text-xs"
                    >
                      <option value="Cash on Site / Event Day">Cash on Site / Event Day</option>
                      <option value="GCash E-Wallet">GCash E-Wallet</option>
                      <option value="Maya Wallet">Maya Wallet</option>
                      <option value="Bank Transfer (BDO/BPI)">Bank Transfer (BDO/BPI)</option>
                      <option value="PayMongo Online Payment">PayMongo Online Payment</option>
                      <option value="Company Cheque / Voucher">Company Cheque / Voucher</option>
                      <option value="Others">Others (Specify Custom Method)</option>
                    </select>

                    {balanceMethodInput === 'Others' && (
                      <div className="mt-2">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-[#1090F8] ml-1 block mb-1">
                          Specify Custom Method <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={customMethodInput}
                          onChange={(e) => setCustomMethodInput(e.target.value)}
                          placeholder="e.g. Bank Cheque, Cash On-Site, Manager Check..."
                          className="w-full rounded-2xl border border-[#24252c]/15 px-4 py-2.5 bg-[#F8F9FA] text-[var(--ink)] font-bold text-xs focus:outline-none focus:border-[#1090F8] focus:bg-white"
                          required
                        />
                      </div>
                    )}
                  </div>

                  {/* Proof of Receipt Upload */}
                  <div>
                    <label className="font-bold uppercase text-[10px] text-[#24252c]/60 block mb-1">
                      Proof of Settlement Image / Slip (Optional)
                    </label>
                    <div className="relative border-2 border-dashed border-[#24252c]/15 rounded-2xl p-3 bg-[#F8F9FA] hover:bg-white hover:border-[#1090F8]/50 transition-colors">
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
                        className="w-full text-xs text-[var(--ink)] font-medium file:mr-3 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-[11px] file:font-bold file:bg-[#1090F8] file:text-white hover:file:bg-[#1090F8]/90 cursor-pointer"
                      />
                      <p className="text-[10px] text-[#24252c]/50 mt-1.5 ml-1">
                        Receipt is uploaded to Supabase Storage (booking-receipts)
                      </p>
                    </div>
                  </div>

                  {/* Receipt Image Preview */}
                  {balanceReceiptPreview && (
                    <div className="space-y-1.5 p-2.5 rounded-2xl bg-[var(--mist)] border border-[#24252c]/10">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-[10px] font-bold text-[#24252c]/60 uppercase">
                          {balanceReceiptFile ? `Attached: ${balanceReceiptFile.name}` : 'Current Settlement Proof:'}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setBalanceReceiptPreview('');
                            setBalanceReceiptFile(null);
                          }}
                          className="text-[10px] font-bold text-rose-600 hover:underline cursor-pointer"
                        >
                          Remove Proof
                        </button>
                      </div>
                      <div className="aspect-[16/9] rounded-xl overflow-hidden border border-[#24252c]/10 bg-white flex items-center justify-center p-2">
                        <img src={balanceReceiptPreview} alt="Receipt Slip Preview" className="w-full h-full object-contain rounded-lg" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Fixed Footer Actions */}
                <div className="p-4 sm:p-5 border-t border-[#24252c]/[0.08] bg-white flex items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (settleModalBooking.isFullyPaid) {
                        setIsSettlementEditMode(false);
                      } else {
                        setSettleModalBooking(null);
                      }
                    }}
                    className="px-5 py-3 rounded-full border border-black/10 text-xs font-semibold text-[var(--ink)] hover:bg-[#F0F0F0] transition-colors cursor-pointer"
                  >
                    {settleModalBooking.isFullyPaid ? 'Back to View' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={savingBalance}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-full transition-colors shadow-md hover:shadow-lg cursor-pointer text-xs disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    <IconCheck className="w-4 h-4" />
                    <span>{savingBalance ? 'Saving Payment Settlement...' : 'Save Payment Settlement'}</span>
                  </button>
                </div>
              </form>
            )}
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

      {/* Assign Crew Modal */}
      <AssignCrewModal
        isOpen={Boolean(assignCrewBooking)}
        onClose={() => setAssignCrewBooking(null)}
        booking={assignCrewBooking}
        onAssigned={() => loadBookings()}
      />

      {/* ── Modal: Processing Refund (Informational Preview Only) ── */}
      <ModalOverlay isOpen={Boolean(refundModalBooking)} onClose={() => setRefundModalBooking(null)}>
        {refundModalBooking && (
          <div className="bg-white rounded-[2.5rem] p-6 sm:p-8 max-w-md w-full shadow-2xl border border-[#24252c]/10 relative animate-blur-in text-xs">
            <button
              type="button"
              onClick={() => setRefundModalBooking(null)}
              className="absolute top-5 right-5 text-[#24252c]/50 hover:text-[var(--ink)] p-1.5 rounded-full hover:bg-[var(--mist)] transition-colors cursor-pointer"
            >
              <IconX className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold border border-slate-200 shrink-0 text-base">
                ₱
              </div>
              <div>
                <span className="text-[10px] font-bold text-[#1090F8] uppercase tracking-wider block">
                  Disbursement Preview
                </span>
                <h3 className="text-lg font-extrabold text-[var(--ink)] -mt-0.5">
                  Process Customer Refund
                </h3>
              </div>
            </div>

            <p className="text-xs text-[#24252c]/60 mb-4 leading-relaxed">
              Disbursement details for cancelled booking <strong className="text-[var(--ink)]">#{refundModalBooking.id}</strong>.
            </p>

            {/* Summary Details Card */}
            <div className="bg-[var(--mist)]/70 rounded-2xl p-4 border border-[#24252c]/[0.06] space-y-2 mb-4">
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#24252c]/50">Booking Reference:</span>
                <span className="font-bold text-[#1090F8]">#{refundModalBooking.id}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#24252c]/50">Customer:</span>
                <span className="font-bold text-[var(--ink)]">{refundModalBooking.customer}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#24252c]/50">Package:</span>
                <span className="font-medium text-[var(--ink)]">{refundModalBooking.package}</span>
              </div>
              <div className="flex justify-between items-center text-xs pt-1.5 border-t border-[#24252c]/[0.06]">
                <span className="text-[#24252c]/50">Payment Channel:</span>
                <span className="font-semibold text-[var(--ink)]">{refundModalBooking.paymentChannel}</span>
              </div>
              <div className="flex justify-between items-center text-xs pt-1.5 border-t border-[#24252c]/[0.06]">
                <span className="font-bold text-[var(--ink)]">Refundable Amount:</span>
                <span className="font-black text-[var(--ink)] text-sm">
                  {refundModalBooking.isFullyPaid ? refundModalBooking.total : refundModalBooking.deposit}
                </span>
              </div>
            </div>

            {/* Info Notice */}
            <div className="p-3.5 rounded-2xl bg-blue-50/80 border border-blue-200/80 text-blue-900 text-[11px] flex items-start gap-2.5 mb-4">
              <span className="w-2 h-2 rounded-full bg-[#1090F8] shrink-0 mt-1" />
              <span>Refund gateway integration is in preview mode. No disbursement transactions or status changes are executed.</span>
            </div>

            {/* Dismiss Button */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setRefundModalBooking(null)}
                className="w-full py-3 rounded-full bg-[var(--ink)] hover:bg-[var(--ink-soft)] text-white font-semibold text-xs transition-colors cursor-pointer shadow-sm"
              >
                Close Preview
              </button>
            </div>
          </div>
        )}
      </ModalOverlay>
    </div>
  );
}
