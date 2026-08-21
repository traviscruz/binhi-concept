import { useState, useEffect } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import { IconCalendar, IconX } from '../../components/shared/icons';
import { ModalOverlay } from '../../components/shared/ModalOverlay';
import { fetchDbBookedDates, isPastDate, formatDisplayDate, type DBBooking } from '../../utils/bookingService';

export default function AdminCalendarPage({ go }: { go: (p: Page) => void }) {
  const today = new Date();
  const [calYear, setCalYear] = useState(() => today.getFullYear());
  const [calMonth, setCalMonth] = useState(() => today.getMonth());
  const [dbBookings, setDbBookings] = useState<DBBooking[]>([]);
  const [selectedBookingModal, setSelectedBookingModal] = useState<DBBooking | null>(null);

  useEffect(() => {
    async function loadBookings() {
      const data = await fetchDbBookedDates();
      setDbBookings(data);
    }
    loadBookings();
  }, []);

  const handlePrevMonth = () => {
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear((y) => y - 1);
    } else {
      setCalMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear((y) => y + 1);
    } else {
      setCalMonth((m) => m + 1);
    }
  };

  const firstDayIndex = new Date(calYear, calMonth, 1).getDay(); // 0 = Sun
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthName = monthNames[calMonth];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#24252c]/[0.06]">
        <div>
          <MonoBadge icon={IconCalendar}>System Master Calendar</MonoBadge>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ink)] mt-1.5">
            {calYear} Event Production Schedule
          </h1>
          <p className="text-xs text-[#24252c]/60 mt-1">
            Master calendar of all confirmed, pending, and rigged event setups across the Philippines.
          </p>
        </div>

        <button
          onClick={() => go('admin-bookings')}
          className="bg-[var(--mist)] text-[var(--ink)] border border-[#24252c]/10 text-xs font-bold px-4 py-2.5 rounded-full hover:bg-[var(--ink)] hover:text-white transition-colors self-start sm:self-auto cursor-pointer"
        >
          View Bookings List
        </button>
      </div>

      {/* Main Calendar Card */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 border border-[#24252c]/[0.08] shadow-sm">
        {/* Top Controls Bar */}
        <div className="flex items-center justify-between gap-2 mb-4 sm:mb-6">
          <div>
            <h3 className="font-extrabold text-base sm:text-lg text-[var(--ink)]">{monthName} {calYear}</h3>
            <p className="text-[11px] sm:text-xs text-[#24252c]/50">Master Production Rigging Calendar</p>
          </div>
          <div className="flex gap-1.5 sm:gap-2">
            <button
              onClick={handlePrevMonth}
              className="px-3 py-1.5 rounded-full bg-[var(--mist)] hover:bg-[var(--ink)] hover:text-white text-xs font-bold transition-colors cursor-pointer"
            >
              ← Prev
            </button>
            <button
              onClick={handleNextMonth}
              className="px-3 py-1.5 rounded-full bg-[var(--mist)] hover:bg-[var(--ink)] hover:text-white text-xs font-bold transition-colors cursor-pointer"
            >
              Next →
            </button>
          </div>
        </div>

        {/* Scrollable Container for Mobile Viewports */}
        <div className="overflow-x-auto pb-2 -mx-1 px-1">
          <div className="min-w-[620px] sm:min-w-0">
            {/* Calendar Grid Header */}
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2 text-center text-xs font-semibold text-[#24252c]/50 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} className="py-1">{d}</div>
              ))}
            </div>

            {/* Accurate Month Days Grid */}
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {/* Blank leading cells */}
              {Array.from({ length: firstDayIndex }).map((_, i) => (
                <div key={`empty-${i}`} className="min-h-[70px] sm:min-h-[80px] rounded-xl bg-transparent" />
              ))}

              {/* Days of the month */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1;
                const formattedIso = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                const booking = dbBookings.find((b) => b.event_date === formattedIso);
                const isPast = isPastDate(formattedIso);
                const now = new Date();
                const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                const isToday = formattedIso === todayIso;

                let cellClass = 'bg-[var(--mist)] border-transparent text-[#24252c]/60';
                let dayTextClass = 'text-[#24252c]/60';

                if (booking && isPast) {
                  cellClass = 'bg-black text-white border-zinc-800 shadow-md cursor-pointer hover:bg-zinc-900';
                  dayTextClass = 'text-white';
                } else if (booking) {
                  cellClass = 'bg-[var(--ink)] text-white border-[var(--ink)] shadow-md cursor-pointer hover:bg-black/90';
                  dayTextClass = 'text-white';
                } else if (isPast) {
                  cellClass = 'bg-gray-100 border-gray-200 opacity-40';
                  dayTextClass = 'text-gray-400';
                } else if (isToday) {
                  cellClass = 'border-2 border-[#1090F8] bg-[#1090F8]/10 shadow-xs';
                  dayTextClass = 'text-[#1090F8]';
                }

                return (
                  <div
                    key={dayNum}
                    onClick={() => booking && setSelectedBookingModal(booking)}
                    title={booking && isPast ? `Past Event: ${booking.package_name}` : isPast ? 'Past Date' : booking ? `Click to view booking: ${booking.package_name}` : isToday ? 'Today' : `Available ${formattedIso}`}
                    className={`min-h-[72px] sm:min-h-[80px] p-2 sm:p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all ${cellClass}`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className={`text-xs font-extrabold ${dayTextClass}`}>{dayNum}</span>
                      {booking && isPast ? (
                        <span className="text-[7px] sm:text-[8px] font-extrabold uppercase px-1 sm:px-1.5 py-0.5 rounded bg-zinc-800 text-amber-400 border border-amber-400/40">
                          Past
                        </span>
                      ) : booking ? (
                        <span className="text-[7px] sm:text-[8px] font-extrabold uppercase px-1 sm:px-1.5 py-0.5 rounded bg-[#1090F8] text-white">
                          Booked
                        </span>
                      ) : isToday ? (
                        <span className="text-[7px] sm:text-[8px] font-extrabold uppercase px-1 sm:px-1.5 py-0.5 rounded bg-[#1090F8] text-white">
                          Today
                        </span>
                      ) : isPast ? (
                        <span className="text-[7px] sm:text-[8px] font-semibold text-gray-400 uppercase">
                          Past
                        </span>
                      ) : null}
                    </div>

                    {booking && (
                      <div className="mt-1">
                        <div className="text-[9px] sm:text-[10px] font-extrabold text-white leading-tight truncate">{booking.package_name || 'Booked Event'}</div>
                        <div className="text-[8px] sm:text-[9px] text-white/80 font-semibold truncate mt-0.5">{booking.customer_name || booking.venue_address}</div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Trailing blank cells */}
              {Array.from({ length: Math.max(0, 42 - (firstDayIndex + daysInMonth)) }).map((_, i) => (
                <div key={`trail-${i}`} className="min-h-[72px] sm:min-h-[80px] rounded-xl bg-transparent opacity-0 pointer-events-none" />
              ))}
            </div>
          </div>
        </div>

        {/* Legend Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 mt-4 sm:mt-6 pt-4 border-t border-[#24252c]/[0.06] text-[10px] sm:text-[11px] text-[#24252c]/60">
          <span className="flex items-center gap-1.5 font-semibold text-[var(--ink)]">
            <span className="w-3 h-3 rounded-md bg-[var(--ink)]" /> Active / Upcoming Event
          </span>
          <span className="flex items-center gap-1.5 font-bold text-amber-600">
            <span className="w-3 h-3 rounded-md bg-black border border-amber-400/40" /> Past Event (Completed)
          </span>
          <span className="flex items-center gap-1.5 font-bold text-[#1090F8]">
            <span className="w-3 h-3 rounded-md border-2 border-[#1090F8] bg-[#1090F8]/10" /> Today
          </span>
          <span className="flex items-center gap-1.5 font-semibold text-gray-400">
            <span className="w-3 h-3 rounded-md bg-gray-200" /> Past Date (Empty)
          </span>
          <span className="flex items-center gap-1.5 font-semibold">
            <span className="w-3 h-3 rounded-md bg-[var(--mist)] border border-[#24252c]/10" /> Available Date
          </span>
        </div>
      </div>

      {/* Booked Date Reservation Details Modal */}
      <ModalOverlay isOpen={!!selectedBookingModal} onClose={() => setSelectedBookingModal(null)}>
        {selectedBookingModal && (
          <div className="bg-white rounded-[2rem] p-6 sm:p-8 max-w-md w-full shadow-2xl border border-[#24252c]/10 relative space-y-4">
            <button
              type="button"
              onClick={() => setSelectedBookingModal(null)}
              className="absolute top-5 right-5 text-[#24252c]/50 hover:text-[var(--ink)] p-1 cursor-pointer"
            >
              <IconX className="w-5 h-5" />
            </button>

            <div>
              <span className="text-[10px] font-mono font-extrabold uppercase tracking-widest text-[#1090F8]">
                {selectedBookingModal.paymongo_reference_number || 'Confirmed Reservation'}
              </span>
              <h3 className="text-xl font-extrabold text-[var(--ink)] mt-0.5">
                {selectedBookingModal.package_name}
              </h3>
              <p className="text-xs text-[#24252c]/60">{selectedBookingModal.event_type || 'Special Event Production'}</p>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--mist)] border border-[#24252c]/[0.08] space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-[#24252c]/50">Customer Name:</span>
                <span className="font-extrabold text-[var(--ink)]">{selectedBookingModal.customer_name}</span>
              </div>
              {selectedBookingModal.customer_email && (
                <div className="flex justify-between">
                  <span className="text-[#24252c]/50">Email:</span>
                  <span className="font-semibold text-[var(--ink)]">{selectedBookingModal.customer_email}</span>
                </div>
              )}
              {selectedBookingModal.customer_phone && (
                <div className="flex justify-between">
                  <span className="text-[#24252c]/50">Mobile Phone:</span>
                  <span className="font-semibold text-[var(--ink)]">{selectedBookingModal.customer_phone}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-[#24252c]/50">Event Date:</span>
                <span className="font-extrabold text-[#1090F8]">{formatDisplayDate(selectedBookingModal.event_date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#24252c]/50">Venue Location:</span>
                <span className="font-semibold text-[var(--ink)] text-right max-w-[200px] truncate">{selectedBookingModal.venue_address}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#24252c]/50">50% Deposit Paid:</span>
                <span className="font-extrabold text-emerald-600">₱{(Number(selectedBookingModal.deposit_amount) || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#24252c]/50">Total Package Cost:</span>
                <span className="font-extrabold text-[var(--ink)]">₱{(Number(selectedBookingModal.total_cost) || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#24252c]/50">Payment Method:</span>
                <span className="font-semibold text-[#1090F8]">{selectedBookingModal.payment_channel || 'PayMongo'}</span>
              </div>
            </div>

            {selectedBookingModal.event_description && (
              <div className="text-xs">
                <span className="font-bold text-[#24252c]/50 uppercase tracking-wider text-[10px] block mb-1">Event Notes & Requests:</span>
                <div className="p-3 rounded-xl bg-[var(--mist)] text-[var(--ink)] font-medium leading-relaxed italic">
                  "{selectedBookingModal.event_description}"
                </div>
              </div>
            )}

            {selectedBookingModal.selected_addons && selectedBookingModal.selected_addons.length > 0 && (
              <div className="text-xs">
                <span className="font-bold text-[#1090F8] uppercase tracking-wider text-[10px] block mb-1">Selected Equipment Add-ons ({selectedBookingModal.selected_addons.length}):</span>
                <div className="space-y-1 pl-1">
                  {selectedBookingModal.selected_addons.map((item: any, idx: number) => (
                    <div key={idx} className="text-[#24252c]/80 text-[11px]">
                      • {typeof item === 'string' ? item : item.name || JSON.stringify(item)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setSelectedBookingModal(null)}
              className="w-full bg-[var(--ink)] text-white text-xs font-semibold py-3.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors cursor-pointer"
            >
              Close Booking Details
            </button>
          </div>
        )}
      </ModalOverlay>
    </div>
  );
}
