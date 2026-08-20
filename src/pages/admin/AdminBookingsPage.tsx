import { useState } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import { IconShield, IconSearch, IconX } from '../../components/shared/icons';

const inputClass =
  'w-full rounded-full border px-4 py-2.5 text-xs bg-[#EEEEEE] text-[var(--ink)] placeholder:text-[#24252c]/40 focus:outline-none focus:border-[#1090F8] border-transparent transition-colors';

export default function AdminBookingsPage({ go }: { go: (p: Page) => void }) {
  const [bookings, setBookings] = useState([
    { id: 'BNH-2026-889', customer: 'Juan Dela Cruz', email: 'juan.delacruz@email.com', package: 'Standard Production Setup', date: 'September 14, 2026', venue: 'Shangri-La Fort, BGC', total: '₱33,500', deposit: '₱16,750', status: 'Pending Deposit Approval', slipRef: 'GCash Ref #889123' },
    { id: 'BNH-2026-502', customer: 'Maria Santos', email: 'maria.santos@email.com', package: 'Grand Stage & Concert Package', date: 'November 12, 2026', venue: 'Marriott Grand Ballroom', total: '₱65,000', deposit: '₱32,500', status: 'Pending Deposit Approval', slipRef: 'BDO Ref #441092' },
    { id: 'BNH-2026-301', customer: 'Carl Mendoza', email: 'carl.m@email.com', package: 'Minimalist Sound & Mic Package', date: 'August 10, 2026', venue: 'Alabang Country Club', total: '₱14,500', deposit: '₱7,250', status: 'Confirmed', slipRef: 'Verified GCash #220194' },
    { id: 'BNH-2026-104', customer: 'Rica Tan', email: 'rica.tan@email.com', package: 'Standard Production Setup', date: 'June 20, 2026', venue: 'Blue Leaf Events Pavilion', total: '₱31,000', deposit: '₱15,500', status: 'Completed', slipRef: 'Verified GCash #110482' },
  ]);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedReceipt, setSelectedReceipt] = useState<(typeof bookings)[0] | null>(null);
  const [rescheduleBooking, setRescheduleBooking] = useState<(typeof bookings)[0] | null>(null);
  const [newRescheduleDate, setNewRescheduleDate] = useState('');

  const filtered = bookings.filter((b) => {
    const matchesStatus = statusFilter === 'All' || b.status.toLowerCase().includes(statusFilter.toLowerCase());
    const matchesSearch =
      b.id.toLowerCase().includes(search.toLowerCase()) ||
      b.customer.toLowerCase().includes(search.toLowerCase()) ||
      b.package.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const handleApproveDeposit = (id: string) => {
    setBookings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, status: 'Confirmed' } : b))
    );
    setSelectedReceipt(null);
  };

  const [cancelBookingId, setCancelBookingId] = useState<string | null>(null);

  const handleConfirmCancel = () => {
    if (!cancelBookingId) return;
    setBookings((prev) =>
      prev.map((b) => (b.id === cancelBookingId ? { ...b, status: 'Cancelled' } : b))
    );
    setCancelBookingId(null);
  };

  const handleSaveReschedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleBooking || !newRescheduleDate) return;

    setBookings((prev) =>
      prev.map((b) =>
        b.id === rescheduleBooking.id ? { ...b, date: newRescheduleDate } : b
      )
    );

    setRescheduleBooking(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#24252c]/[0.06]">
        <div>
          <MonoBadge icon={IconShield}>Bookings Management</MonoBadge>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ink)] mt-1.5">
            Customer Event Bookings
          </h1>
          <p className="text-xs text-[#24252c]/60 mt-1">
            Approve GCash/Bank deposit slips, reschedule dates, or manage active reservations.
          </p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#24252c]/[0.08] shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto">
          {['All', 'Pending', 'Confirmed', 'Completed'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`text-xs px-3.5 py-1.5 rounded-full font-medium transition-all ${
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
                <th className="py-3 px-3 font-semibold">Customer Details</th>
                <th className="py-3 px-3 font-semibold">Package & Venue</th>
                <th className="py-3 px-3 font-semibold">Event Date</th>
                <th className="py-3 px-3 font-semibold">50% Deposit</th>
                <th className="py-3 px-3 font-semibold">Status</th>
                <th className="py-3 px-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#24252c]/[0.04]">
              {filtered.map((row) => (
                <tr key={row.id} className="hover:bg-[var(--mist)] transition-colors">
                  <td className="py-3.5 px-3 font-mono font-extrabold text-[#1090F8]">{row.id}</td>
                  <td className="py-3.5 px-3">
                    <div className="font-bold text-[var(--ink)]">{row.customer}</div>
                    <div className="text-[10px] text-[#24252c]/50">{row.email}</div>
                  </td>
                  <td className="py-3.5 px-3">
                    <div className="font-semibold text-[var(--ink)]">{row.package}</div>
                    <div className="text-[10px] text-[#24252c]/50">{row.venue}</div>
                  </td>
                  <td className="py-3.5 px-3 font-medium text-[var(--ink)]">{row.date}</td>
                  <td className="py-3.5 px-3">
                    <div className="font-extrabold text-[#1090F8]">{row.deposit}</div>
                    <div className="text-[10px] text-[#24252c]/50">{row.slipRef}</div>
                  </td>
                  <td className="py-3.5 px-3">
                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                        row.status.includes('Pending')
                          ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                          : row.status === 'Confirmed'
                          ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                          : 'bg-gray-500/10 text-gray-600 border border-gray-500/20'
                      }`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {row.status.includes('Pending') && (
                        <button
                          onClick={() => setSelectedReceipt(row)}
                          className="bg-[#1090F8] text-white text-[11px] font-semibold px-3 py-1 rounded-full hover:bg-[#1090F8]/90 transition-colors shadow-sm"
                        >
                          Approve
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setRescheduleBooking(row);
                          setNewRescheduleDate(row.date);
                        }}
                        className="bg-[var(--mist)] text-[var(--ink)] text-[11px] font-semibold px-3 py-1 rounded-full border border-[#24252c]/10 hover:bg-[var(--ink)] hover:text-white transition-colors"
                      >
                        Reschedule
                      </button>
                      <button
                        onClick={() => setCancelBookingId(row.id)}
                        className="text-rose-600 hover:bg-rose-50 text-[11px] font-semibold px-2 py-1 rounded-full transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Row Cards View */}
        <div className="block sm:hidden space-y-3">
          {filtered.map((row) => (
            <div key={row.id} className="p-4 rounded-xl bg-[var(--mist)] border border-[#24252c]/[0.06] space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-mono font-extrabold text-[#1090F8]">{row.id}</span>
                <span
                  className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                    row.status.includes('Pending')
                      ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                      : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                  }`}
                >
                  {row.status}
                </span>
              </div>
              <div className="font-bold text-[var(--ink)]">{row.customer} ({row.email})</div>
              <div className="text-[11px] text-[#24252c]/70">{row.package} · Date: <strong className="text-[var(--ink)]">{row.date}</strong></div>
              <div className="text-[11px] text-[#24252c]/60">50% Deposit: <strong className="text-[#1090F8]">{row.deposit}</strong> ({row.slipRef})</div>
              
              <div className="flex items-center gap-2 pt-2 border-t border-[#24252c]/10">
                {row.status.includes('Pending') && (
                  <button
                    onClick={() => setSelectedReceipt(row)}
                    className="flex-1 bg-[#1090F8] text-white text-xs font-semibold py-1.5 rounded-full"
                  >
                    Approve
                  </button>
                )}
                <button
                  onClick={() => {
                    setRescheduleBooking(row);
                    setNewRescheduleDate(row.date);
                  }}
                  className="flex-1 bg-white border border-[#24252c]/10 text-xs font-semibold py-1.5 rounded-full"
                >
                  Reschedule
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Deposit Receipt Preview Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-blur-in">
          <div className="bg-white rounded-[2rem] p-6 max-w-md w-full shadow-2xl border border-[#24252c]/10 relative">
            <button onClick={() => setSelectedReceipt(null)} className="absolute top-5 right-5 text-[#24252c]/50 hover:text-[var(--ink)] p-1">
              <IconX className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-extrabold text-[var(--ink)] mb-1">Verify GCash Deposit Slip</h3>
            <p className="text-xs font-mono font-bold text-[#1090F8] mb-4">{selectedReceipt.id} · {selectedReceipt.customer}</p>

            <div className="bg-[var(--mist)] p-4 rounded-2xl border border-[#24252c]/10 space-y-3 mb-5 text-xs">
              <div className="flex justify-between">
                <span className="text-[#24252c]/50">Deposit Slip Ref:</span>
                <span className="font-mono font-bold text-[var(--ink)]">{selectedReceipt.slipRef}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#24252c]/50">Required 50% Deposit:</span>
                <span className="font-extrabold text-[#1090F8]">{selectedReceipt.deposit}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#24252c]/50">Event Date:</span>
                <span className="font-semibold text-[var(--ink)]">{selectedReceipt.date}</span>
              </div>

              <div className="aspect-[4/3] rounded-xl bg-white border border-[#24252c]/10 flex flex-col items-center justify-center p-4 text-center">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-600 font-bold text-lg flex items-center justify-center mb-2">
                  ✓
                </div>
                <div className="font-bold text-xs text-[var(--ink)]">GCash Official Receipt Attached</div>
                <div className="text-[10px] text-[#24252c]/50 mt-1">Amount Verified: {selectedReceipt.deposit}</div>
              </div>
            </div>

            <button
              onClick={() => handleApproveDeposit(selectedReceipt.id)}
              className="w-full bg-emerald-600 text-white font-semibold py-3.5 rounded-full hover:bg-emerald-700 transition-colors shadow-md"
            >
              Approve Deposit & Confirm Reservation
            </button>
          </div>
        </div>
      )}

      {/* Reschedule Date Modal */}
      {rescheduleBooking && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-blur-in">
          <div className="bg-white rounded-[2rem] p-6 max-w-md w-full shadow-2xl border border-[#24252c]/10 relative">
            <button onClick={() => setRescheduleBooking(null)} className="absolute top-5 right-5 text-[#24252c]/50 hover:text-[var(--ink)] p-1">
              <IconX className="w-5 h-5" />
            </button>
            <h3 className="text-xl font-extrabold text-[var(--ink)] mb-1">Reschedule Event Date</h3>
            <p className="text-xs font-mono font-bold text-[#1090F8] mb-4">{rescheduleBooking.id} · {rescheduleBooking.customer}</p>

            <form onSubmit={handleSaveReschedule} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold uppercase text-[#24252c]/50 block mb-1">Select New Target Date</label>
                <input
                  type="date"
                  value={newRescheduleDate}
                  onChange={(e) => setNewRescheduleDate(e.target.value)}
                  className={inputClass + ' font-bold'}
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full bg-[var(--ink)] text-white font-semibold py-3.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors"
              >
                Save Rescheduled Date
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Cancellation Modal Overlay */}
      {cancelBookingId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-blur-in">
          <div className="bg-white rounded-[2rem] p-6 max-w-md w-full shadow-2xl border border-[#24252c]/10 relative text-center">
            <button onClick={() => setCancelBookingId(null)} className="absolute top-5 right-5 text-[#24252c]/50 hover:text-[var(--ink)] p-1">
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
                className="flex-1 bg-[var(--mist)] text-[var(--ink)] font-semibold py-3 rounded-full border border-[#24252c]/10 hover:bg-[var(--ink)] hover:text-white transition-colors"
              >
                Keep Booking
              </button>
              <button
                onClick={handleConfirmCancel}
                className="flex-1 bg-rose-600 text-white font-semibold py-3 rounded-full hover:bg-rose-700 transition-colors shadow-md"
              >
                Yes, Cancel Booking
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
