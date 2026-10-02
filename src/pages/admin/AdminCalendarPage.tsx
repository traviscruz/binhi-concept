import { useState, useEffect } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import { IconCalendar, IconX, IconCheck, IconPin, IconSettings } from '../../components/shared/icons';
import { ModalOverlay } from '../../components/shared/ModalOverlay';
import { fetchDbBookedDates, isPastDate, formatDisplayDate, type DBBooking } from '../../utils/bookingService';
import {
  fetchBookingSettings,
  fetchScheduleOverrides,
  saveBookingSettings,
  getDayAvailabilityStatus,
  formatTimeAmPm,
  calculateCrewArrivalTime,
  timeToMinutes,
  type BookingSettings,
  type ScheduleOverride,
  DEFAULT_BOOKING_SETTINGS,
} from '../../utils/bookingEngine';
import { getDailyCrewCapacity, type DailyCrewCapacity } from '../../utils/crewAvailabilityService';

export default function AdminCalendarPage({ go }: { go: (p: Page) => void }) {
  const today = new Date();
  const [calYear, setCalYear] = useState(() => today.getFullYear());
  const [calMonth, setCalMonth] = useState(() => today.getMonth());
  const [dbBookings, setDbBookings] = useState<DBBooking[]>([]);
  const [bookingSettings, setBookingSettings] = useState<BookingSettings>(DEFAULT_BOOKING_SETTINGS);
  const [scheduleOverrides, setScheduleOverrides] = useState<ScheduleOverride[]>([]);
  const [dayCrewCapacity, setDayCrewCapacity] = useState<DailyCrewCapacity | null>(null);

  // Modals state
  const [selectedBookingModal, setSelectedBookingModal] = useState<DBBooking | null>(null);
  const [selectedDaySchedule, setSelectedDaySchedule] = useState<{ date: string; bookings: DBBooking[] } | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isCustomTurnaround, setIsCustomTurnaround] = useState(false);
  const [settingsForm, setSettingsForm] = useState<BookingSettings>(DEFAULT_BOOKING_SETTINGS);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSuccessNotice, setSettingsSuccessNotice] = useState(false);
  const [settingsErrorNotice, setSettingsErrorNotice] = useState('');

  useEffect(() => {
    const targetDate = selectedDaySchedule?.date || selectedBookingModal?.event_date;
    if (targetDate) {
      getDailyCrewCapacity(targetDate).then(setDayCrewCapacity);
    } else {
      setDayCrewCapacity(null);
    }
  }, [selectedDaySchedule, selectedBookingModal]);

  useEffect(() => {
    async function loadData() {
      const [bookings, settings, overrides] = await Promise.all([
        fetchDbBookedDates(),
        fetchBookingSettings(),
        fetchScheduleOverrides(),
      ]);
      setDbBookings(bookings);
      setBookingSettings(settings);
      setSettingsForm(settings);
      setIsCustomTurnaround(![2.0, 2.5, 3.0, 4.0].includes(Number(settings.default_turnaround_hours)));
      setScheduleOverrides(overrides);
    }
    loadData();
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

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsErrorNotice('');
    setIsSavingSettings(true);

    try {
      const ok = await saveBookingSettings(settingsForm);
      setIsSavingSettings(false);
      if (ok) {
        setBookingSettings(settingsForm);
        setSettingsSuccessNotice(true);
        setTimeout(() => {
          setSettingsSuccessNotice(false);
          setShowSettingsModal(false);
        }, 1200);
      } else {
        setSettingsErrorNotice('Could not save booking settings. Please try again.');
      }
    } catch (err: any) {
      setIsSavingSettings(false);
      setSettingsErrorNotice(err?.message || 'Failed to update settings.');
    }
  };

  // Helper presets for operating window
  const applyHoursPreset = (open: string, close: string) => {
    setSettingsForm((prev) => ({
      ...prev,
      default_open_time: open,
      default_close_time: close,
    }));
  };

  // Helper presets for turnaround buffer
  const applyTurnaroundPreset = (hours: number) => {
    setSettingsForm((prev) => ({
      ...prev,
      default_turnaround_hours: hours,
    }));
  };

  const firstDayIndex = new Date(calYear, calMonth, 1).getDay(); // 0 = Sun
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
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
            Real-time multi-booking calendar with automated transit turnaround validation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => {
              setSettingsForm(bookingSettings);
              setIsCustomTurnaround(![2.0, 2.5, 3.0, 4.0].includes(Number(bookingSettings.default_turnaround_hours)));
              setSettingsErrorNotice('');
              setShowSettingsModal(true);
            }}
            className="bg-white text-[var(--ink)] border border-[#24252c]/15 text-xs font-bold px-4 py-2.5 rounded-full hover:bg-[var(--mist)] transition-colors cursor-pointer shadow-2xs inline-flex items-center gap-2"
          >
            <IconSettings className="w-3.5 h-3.5 text-[var(--ink)]" />
            <span>Operating Rules &amp; Turnaround</span>
          </button>

          <button
            onClick={() => go('admin-bookings')}
            className="bg-[var(--mist)] text-[var(--ink)] border border-[#24252c]/10 text-xs font-bold px-4 py-2.5 rounded-full hover:bg-[var(--ink)] hover:text-white transition-colors cursor-pointer"
          >
            View Bookings List
          </button>
        </div>
      </div>

      {/* Main Calendar Card */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 border border-[#24252c]/[0.08] shadow-sm">
        {/* Top Controls Bar */}
        <div className="flex items-center justify-between gap-2 mb-4 sm:mb-6">
          <div>
            <h3 className="font-extrabold text-base sm:text-lg text-[var(--ink)]">
              {monthName} {calYear}
            </h3>
            <p className="text-[11px] sm:text-xs text-[#24252c]/50">
              Daily Operating Window: {formatTimeAmPm(bookingSettings.default_open_time)} – {formatTimeAmPm(bookingSettings.default_close_time)} • Min. Turnaround: {bookingSettings.default_turnaround_hours}h
            </p>
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
          <div className="min-w-[700px] sm:min-w-0">
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
                <div key={`empty-${i}`} className="min-h-[90px] sm:min-h-[105px] rounded-xl bg-transparent" />
              ))}

              {/* Days of the month */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1;
                const formattedIso = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                const dayBookings = dbBookings
                  .filter((b) => (b.event_date || '').split('T')[0] === formattedIso)
                  .sort((a, b) => timeToMinutes(a.start_time || '13:00') - timeToMinutes(b.start_time || '13:00'));

                const isPast = isPastDate(formattedIso);
                const dayStatus = getDayAvailabilityStatus(formattedIso, dbBookings, bookingSettings, scheduleOverrides);
                const now = new Date();
                const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                const isToday = formattedIso === todayIso;

                let cellBorder = 'border-[#24252c]/[0.08]';
                let cellBg = 'bg-[var(--mist)]/50';

                if (isToday) {
                  cellBorder = 'border-2 border-[#1090F8]';
                  cellBg = 'bg-[#1090F8]/5';
                }

                if (dayBookings.length > 0) {
                  cellBg = isPast ? 'bg-zinc-100' : 'bg-white';
                  cellBorder = isPast ? 'border-zinc-300' : 'border-[#1090F8]/30 shadow-xs';
                }

                return (
                  <div
                    key={dayNum}
                    onClick={() => {
                      if (dayBookings.length === 1) {
                        setSelectedBookingModal(dayBookings[0]);
                      } else if (dayBookings.length > 1) {
                        setSelectedDaySchedule({ date: formattedIso, bookings: dayBookings });
                      }
                    }}
                    className={`min-h-[95px] sm:min-h-[110px] p-2 rounded-xl border text-left flex flex-col justify-between transition-all ${cellBg} ${cellBorder} ${
                      dayBookings.length > 0 ? 'cursor-pointer hover:border-[#1090F8] hover:shadow-md' : ''
                    }`}
                  >
                    {/* Date Number & Status Header */}
                    <div className="flex items-center justify-between gap-1">
                      <span className={`text-xs font-extrabold ${isToday ? 'text-[#1090F8]' : isPast ? 'text-gray-400' : 'text-[var(--ink)]'}`}>
                        {dayNum}
                      </span>

                      {dayBookings.length > 0 ? (
                        <span
                          className={`text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded-full ${
                            dayBookings.length > 1
                              ? 'bg-purple-600 text-white shadow-2xs'
                              : isPast
                              ? 'bg-zinc-700 text-zinc-200'
                              : 'bg-[#1090F8] text-white'
                          }`}
                        >
                          {dayBookings.length} {dayBookings.length === 1 ? 'Event' : 'Events'}
                        </span>
                      ) : dayStatus.status === 'closed' ? (
                        <span className="text-[7px] font-bold uppercase text-zinc-400">Closed</span>
                      ) : null}
                    </div>

                    {/* Events list in the day box */}
                    <div className="space-y-1 mt-1 flex-1 overflow-hidden">
                      {dayBookings.slice(0, 2).map((b, idx) => (
                        <div
                          key={idx}
                          className="bg-[var(--ink)] text-white text-[9px] rounded-md px-1.5 py-1 leading-tight truncate shadow-2xs"
                        >
                          <div className="font-bold flex items-center justify-between gap-1">
                            <span className="text-sky-300 font-mono text-[8px]">
                              {formatTimeAmPm(b.start_time || '13:00').slice(0, -3)}
                            </span>
                            <span className="truncate opacity-90">{b.package_name}</span>
                          </div>
                          <div className="text-[7.5px] text-white/60 truncate mt-0.5">
                            {b.venue_address ? b.venue_address.split(',')[0] : 'Venue'}
                          </div>
                        </div>
                      ))}

                      {dayBookings.length > 2 && (
                        <div className="text-[8px] font-bold text-center text-purple-700 bg-purple-50 rounded py-0.5">
                          +{dayBookings.length - 2} more events...
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Trailing blank cells */}
              {Array.from({ length: Math.max(0, 42 - (firstDayIndex + daysInMonth)) }).map((_, i) => (
                <div key={`trail-${i}`} className="min-h-[95px] sm:min-h-[110px] rounded-xl bg-transparent opacity-0 pointer-events-none" />
              ))}
            </div>
          </div>
        </div>

        {/* Legend Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 mt-4 sm:mt-6 pt-4 border-t border-[#24252c]/[0.06] text-[10px] sm:text-[11px] text-[#24252c]/60">
          <span className="flex items-center gap-1.5 font-semibold text-[var(--ink)]">
            <span className="w-3 h-3 rounded-md bg-[#1090F8]" /> Single Booked Event
          </span>
          <span className="flex items-center gap-1.5 font-bold text-purple-700">
            <span className="w-3 h-3 rounded-md bg-purple-600" /> Multi-Booking Day (2+ Events)
          </span>
          <span className="flex items-center gap-1.5 font-bold text-[#1090F8]">
            <span className="w-3 h-3 rounded-md border-2 border-[#1090F8] bg-[#1090F8]/10" /> Today
          </span>
          <span className="flex items-center gap-1.5 font-semibold text-gray-400">
            <span className="w-3 h-3 rounded-md bg-zinc-200" /> Past Events
          </span>
          <span className="flex items-center gap-1.5 font-semibold">
            <span className="w-3 h-3 rounded-md bg-[var(--mist)] border border-[#24252c]/10" /> Open / Available
          </span>
        </div>
      </div>

      {/* ── Day Schedule Inspector Modal (Multi-Booking Timeline) ── */}
      <ModalOverlay isOpen={!!selectedDaySchedule} onClose={() => setSelectedDaySchedule(null)}>
        {selectedDaySchedule && (
          <div className="bg-white rounded-[2rem] p-6 sm:p-8 max-w-2xl w-full shadow-2xl border border-[#24252c]/10 relative space-y-4">
            <button
              type="button"
              onClick={() => setSelectedDaySchedule(null)}
              className="absolute top-5 right-5 text-[#24252c]/50 hover:text-[var(--ink)] p-1 cursor-pointer"
            >
              <IconX className="w-5 h-5" />
            </button>

            <div>
              <span className="text-[10px] font-mono font-extrabold uppercase tracking-widest text-[#1090F8]">
                Daily Schedule Timeline
              </span>
              <h3 className="text-xl font-extrabold text-[var(--ink)] mt-0.5">
                {formatDisplayDate(selectedDaySchedule.date)}
              </h3>
              <p className="text-xs text-[#24252c]/60">
                {selectedDaySchedule.bookings.length} production setups scheduled on this date with turnaround analysis.
              </p>
            </div>

            {dayCrewCapacity && dayCrewCapacity.totalActiveCrew > 0 ? (
              <div className="p-3.5 rounded-2xl bg-sky-50/70 border border-sky-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <span className="font-bold text-sky-950 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-sky-500" />
                    Crew Roster &amp; Capacity: {dayCrewCapacity.availableCrewCount} of {dayCrewCapacity.totalActiveCrew} Available
                  </span>
                  <p className="text-[11px] text-sky-800 mt-0.5">
                    {dayCrewCapacity.onLeaveCrewCount > 0
                      ? `${dayCrewCapacity.onLeaveCrewCount} crew technician(s) on leave today.`
                      : 'All registered crew technicians available for deployment.'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {dayCrewCapacity.crewRoster.map((c) => (
                    <span
                      key={c.crewId}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                        c.status === 'on_leave'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : c.status === 'assigned'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      }`}
                      title={c.reason || c.status}
                    >
                      {c.crewName.split(' ')[0]} ({c.status === 'on_leave' ? 'Leave' : c.status === 'assigned' ? 'Assigned' : 'Active'})
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {selectedDaySchedule.bookings.map((b, idx) => {
                const nextBooking = selectedDaySchedule.bookings[idx + 1];
                let gapMinutes = 0;
                const reqMinutes = Math.round(Number(bookingSettings.default_turnaround_hours || 3) * 60);

                if (nextBooking) {
                  const bEnd = (b.end_time || '18:00').slice(0, 5);
                  const nextStart = (nextBooking.start_time || '13:00').slice(0, 5);
                  gapMinutes = timeToMinutes(nextStart) - timeToMinutes(bEnd);
                }

                return (
                  <div key={b.id} className="space-y-3">
                    <div className="p-4 rounded-2xl bg-[var(--mist)] border border-[#24252c]/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-extrabold text-[#1090F8] bg-[#1090F8]/10 px-2.5 py-0.5 rounded-full">
                            Event Proper: {formatTimeAmPm(b.start_time || '13:00')} – {formatTimeAmPm(b.end_time || '18:00')}
                          </span>
                          <span className="font-mono text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            Crew Setup Call Time: ~{formatTimeAmPm(calculateCrewArrivalTime(b.start_time || '13:00', bookingSettings.default_turnaround_hours))}
                          </span>
                          <span className="text-xs font-bold text-[var(--ink)]">{b.package_name}</span>
                        </div>
                        <p className="text-xs text-[#24252c]/70 mt-1 flex items-center gap-1.5">
                          <IconPin className="w-3.5 h-3.5 text-[#1090F8]" />
                          <span>{b.venue_address || 'Private Venue'}</span>
                        </p>
                        <p className="text-[11px] text-[#24252c]/50 mt-0.5">
                          Host: <strong className="text-[var(--ink)]">{b.customer_name}</strong> • Ref: {b.paymongo_reference_number}
                        </p>
                      </div>

                      <button
                        onClick={() => setSelectedBookingModal(b)}
                        className="text-xs font-bold text-[#1090F8] hover:underline self-end sm:self-center shrink-0 cursor-pointer"
                      >
                        View Full Details →
                      </button>
                    </div>

                    {/* Turnaround gap indicator between consecutive bookings */}
                    {nextBooking && (
                      <div className={`p-3 rounded-xl border border-dashed flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
                        gapMinutes < reqMinutes
                          ? 'border-amber-300 bg-amber-50/60 text-amber-950'
                          : 'border-[#1090F8]/30 bg-blue-50/50 text-[#0c162c]'
                      }`}>
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${gapMinutes < reqMinutes ? 'bg-amber-500' : 'bg-[#1090F8]'}`} />
                          <span>
                            <strong>Gap to Next Event:</strong> {gapMinutes > 0 ? `${Math.floor(gapMinutes / 60)}h ${gapMinutes % 60}m (${gapMinutes} mins)` : `${gapMinutes} mins`}
                          </span>
                        </div>
                        <span className="text-[11px] text-[#24252c]/70">
                          Required Turnaround: <strong>{bookingSettings.default_turnaround_hours}h ({reqMinutes} mins)</strong>
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </ModalOverlay>

      {/* ── Booked Date Reservation Details Modal ── */}
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
                <span className="text-[#24252c]/50">Event Proper Window:</span>
                <span className="font-mono font-extrabold text-[var(--ink)]">
                  {formatTimeAmPm(selectedBookingModal.start_time || '13:00')} – {formatTimeAmPm(selectedBookingModal.end_time || '18:00')}
                </span>
              </div>
              <div className="flex justify-between items-center bg-emerald-50 border border-emerald-200/80 p-2.5 rounded-xl">
                <div>
                  <span className="text-[10px] uppercase font-bold text-emerald-900 block">Crew Arrival / Setup (Ingress):</span>
                  <span className="text-[11px] text-emerald-800">
                    Binhi crew arrives ~{bookingSettings.default_turnaround_hours}h early for staging
                  </span>
                </div>
                <span className="font-mono font-extrabold text-xs text-emerald-950 bg-white px-2 py-1 rounded-lg border border-emerald-300">
                  {formatTimeAmPm(calculateCrewArrivalTime(selectedBookingModal.start_time || '13:00', bookingSettings.default_turnaround_hours))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#24252c]/50">Venue Location:</span>
                <span className="font-semibold text-[var(--ink)] text-right max-w-[200px] truncate">{selectedBookingModal.venue_address}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#24252c]/50">Deposit Paid:</span>
                <span className="font-extrabold text-emerald-600">₱{(Number(selectedBookingModal.deposit_amount) || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#24252c]/50">Total Package Cost:</span>
                <span className="font-extrabold text-[var(--ink)]">₱{(Number(selectedBookingModal.total_cost) || 0).toLocaleString()}</span>
              </div>
            </div>

            {selectedBookingModal.event_description && (
              <div className="text-xs">
                <span className="font-bold text-[#24252c]/50 uppercase tracking-wider text-[10px] block mb-1">Event Notes &amp; Requests:</span>
                <div className="p-3 rounded-xl bg-[var(--mist)] text-[var(--ink)] font-medium leading-relaxed italic">
                  "{selectedBookingModal.event_description}"
                </div>
              </div>
            )}
          </div>
        )}
      </ModalOverlay>

      {/* ── Operating Rules & Feasibility Settings Modal (User-Friendly & Streamlined) ── */}
      <ModalOverlay isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)}>
        <div className="bg-white rounded-[2rem] p-6 sm:p-8 max-w-xl w-full shadow-2xl border border-[#24252c]/10 relative space-y-4">
          <button
            type="button"
            onClick={() => setShowSettingsModal(false)}
            className="absolute top-5 right-5 text-[#24252c]/50 hover:text-[var(--ink)] p-1 cursor-pointer"
          >
            <IconX className="w-5 h-5" />
          </button>

          <div>
            <span className="text-[10px] font-mono font-extrabold uppercase tracking-widest text-[#1090F8]">
              Easy Configuration
            </span>
            <h3 className="text-xl font-extrabold text-[var(--ink)] mt-0.5">
              Operating Hours &amp; Pre-Event Setup / Buffer Rules
            </h3>
            <p className="text-xs text-[#24252c]/60">
              Set system operating hours and the required pre-event setup (ingress), transit, and turnaround gap.
            </p>
          </div>

          <div className="p-3 bg-blue-50/80 rounded-xl border border-blue-200 text-blue-950 text-[11px] leading-relaxed">
            <strong>Note on Event Times:</strong> Customers pick their <strong>actual event start &amp; end time</strong> (Event Proper). The system uses the <strong>Pre-Event Setup &amp; Turnaround Gap</strong> below to ensure the Binhi crew has sufficient time to travel and arrive on-site early to set up before the party starts.
          </div>

          {settingsSuccessNotice && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-fade-in">
              <IconCheck className="w-4 h-4 text-emerald-600" />
              Settings saved successfully!
            </div>
          )}

          {settingsErrorNotice && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center justify-between gap-2">
              <span>{settingsErrorNotice}</span>
              <button onClick={() => setSettingsErrorNotice('')}><IconX className="w-3.5 h-3.5" /></button>
            </div>
          )}

          <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
            {/* 1. Daily Operating Window */}
            <div className="p-4 rounded-2xl bg-[var(--mist)] border border-[#24252c]/[0.06] space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-extrabold text-sm text-[var(--ink)]">1. Daily Operating Hours</h4>
                  <p className="text-[11px] text-[#24252c]/55">Earliest start and latest closing time for event operations.</p>
                </div>
              </div>

              {/* Quick Presets */}
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => applyHoursPreset('08:00', '23:00')}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors cursor-pointer ${
                    settingsForm.default_open_time === '08:00' && settingsForm.default_close_time === '23:00'
                      ? 'bg-[var(--ink)] text-white border-[var(--ink)]'
                      : 'bg-white text-[#24252c]/70 border-[#24252c]/10 hover:border-[#1090F8]'
                  }`}
                >
                  Standard (8:00 AM – 11:00 PM)
                </button>
                <button
                  type="button"
                  onClick={() => applyHoursPreset('07:00', '23:59')}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors cursor-pointer ${
                    settingsForm.default_open_time === '07:00' && settingsForm.default_close_time === '23:59'
                      ? 'bg-[var(--ink)] text-white border-[var(--ink)]'
                      : 'bg-white text-[#24252c]/70 border-[#24252c]/10 hover:border-[#1090F8]'
                  }`}
                >
                  Extended (7:00 AM – Midnight)
                </button>
                <button
                  type="button"
                  onClick={() => applyHoursPreset('09:00', '22:00')}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors cursor-pointer ${
                    settingsForm.default_open_time === '09:00' && settingsForm.default_close_time === '22:00'
                      ? 'bg-[var(--ink)] text-white border-[var(--ink)]'
                      : 'bg-white text-[#24252c]/70 border-[#24252c]/10 hover:border-[#1090F8]'
                  }`}
                >
                  Strict (9:00 AM – 10:00 PM)
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#24252c]/60 ml-1 block mb-1">
                    Earliest Start (Open)
                  </label>
                  <input
                    type="time"
                    value={settingsForm.default_open_time}
                    onChange={(e) => setSettingsForm({ ...settingsForm, default_open_time: e.target.value })}
                    className="w-full bg-white rounded-xl border border-[#24252c]/10 px-3 py-2 font-bold text-[var(--ink)] focus:outline-none focus:border-[#1090F8]"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-[#24252c]/60 ml-1 block mb-1">
                    Latest Finish (Close)
                  </label>
                  <input
                    type="time"
                    value={settingsForm.default_close_time}
                    onChange={(e) => setSettingsForm({ ...settingsForm, default_close_time: e.target.value })}
                    className="w-full bg-white rounded-xl border border-[#24252c]/10 px-3 py-2 font-bold text-[var(--ink)] focus:outline-none focus:border-[#1090F8]"
                    required
                  />
                </div>
              </div>
            </div>

            {/* 2. Pre-Event Setup & Turnaround Gap */}
            <div className="p-4 rounded-2xl bg-[var(--mist)] border border-[#24252c]/[0.06] space-y-3">
              <div>
                <h4 className="font-extrabold text-sm text-[var(--ink)]">2. Pre-Event Setup &amp; Turnaround Gap</h4>
                <p className="text-[11px] text-[#24252c]/55">
                  How much time the Binhi crew needs before event start (for on-site staging/ingress) &amp; between consecutive bookings.
                </p>
              </div>

              {/* Turnaround presets & selectable Custom button */}
              {(() => {
                const PRESET_TURNAROUNDS = [
                  { label: '2.0 Hours', hours: 2.0 },
                  { label: '2.5 Hours', hours: 2.5 },
                  { label: '3.0 Hours', hours: 3.0, badge: 'Recommended' },
                  { label: '4.0 Hours', hours: 4.0 },
                ];
                const isPreset = PRESET_TURNAROUNDS.some(
                  (p) => p.hours === Number(settingsForm.default_turnaround_hours)
                );
                const isCustomSelected = isCustomTurnaround || !isPreset;

                return (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {PRESET_TURNAROUNDS.map((item) => {
                        const isSelected = !isCustomSelected && Number(settingsForm.default_turnaround_hours) === item.hours;
                        return (
                          <button
                            key={item.hours}
                            type="button"
                            onClick={() => {
                              setIsCustomTurnaround(false);
                              applyTurnaroundPreset(item.hours);
                            }}
                            className={`py-2 px-1 text-center rounded-xl font-bold border transition-colors cursor-pointer ${
                              isSelected
                                ? 'bg-[var(--ink)] text-white border-[var(--ink)] shadow-2xs'
                                : 'bg-white text-[var(--ink)] border-[#24252c]/10 hover:border-[#1090F8]'
                            }`}
                          >
                            <div className="text-xs">{item.label}</div>
                            <div className="text-[9px] opacity-70">
                              {item.badge ? item.badge : `${item.hours * 60} mins`}
                            </div>
                          </button>
                        );
                      })}

                      {/* 5th Option: Selectable Custom choice */}
                      <button
                        type="button"
                        onClick={() => setIsCustomTurnaround(true)}
                        className={`col-span-2 sm:col-span-1 py-2 px-1 text-center rounded-xl font-bold border transition-colors cursor-pointer ${
                          isCustomSelected
                            ? 'bg-[var(--ink)] text-white border-[var(--ink)] shadow-2xs'
                            : 'bg-white text-[var(--ink)] border-[#24252c]/10 hover:border-[#1090F8]'
                        }`}
                      >
                        <div className="text-xs">Custom</div>
                        <div className="text-[9px] opacity-70">
                          {isCustomSelected ? `${settingsForm.default_turnaround_hours}h set` : 'Set Time'}
                        </div>
                      </button>
                    </div>

                    {/* Expandable Custom Interval setter when Custom is active */}
                    {isCustomSelected && (
                      <div className="pt-3 border-t border-[#24252c]/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white/80 p-3 rounded-xl border border-[#1090F8]/30 shadow-2xs">
                        <div>
                          <span className="text-xs font-bold text-[var(--ink)] block">Custom Time Interval</span>
                          <span className="text-[10px] text-[#24252c]/50">Enter the required buffer hours between events</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.25"
                            min="0.5"
                            max="24"
                            autoFocus
                            value={settingsForm.default_turnaround_hours}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              setSettingsForm((prev) => ({
                                ...prev,
                                default_turnaround_hours: isNaN(val) ? 0 : val,
                              }));
                            }}
                            className="w-20 px-2.5 py-1.5 bg-white rounded-lg border border-[#1090F8] text-xs font-extrabold text-[var(--ink)] text-center focus:ring-2 focus:ring-[#1090F8]/20 outline-none"
                            placeholder="e.g. 1.5"
                          />
                          <span className="text-xs font-bold text-[var(--ink)]">hours</span>
                          <span className="text-[10px] font-mono font-bold text-[#1090F8] bg-blue-50 px-2 py-1 rounded-md border border-[#1090F8]/20 whitespace-nowrap">
                            ({Math.round(Number(settingsForm.default_turnaround_hours || 0) * 60)} mins)
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            {/* 3. Technical Crew Staffing Requirement */}
            <div className="p-4 rounded-2xl bg-[var(--mist)] border border-[#24252c]/[0.06] space-y-3">
              <div>
                <h4 className="font-extrabold text-sm text-[var(--ink)]">3. Technical Crew Staffing Requirement</h4>
                <p className="text-[11px] text-[#24252c]/55">
                  Configure when customer booking dates should be automatically blocked due to missing/absent crew.
                </p>
              </div>

              <div className="space-y-2.5">
                {/* Option A: Strict Full Roster Present */}
                <label
                  className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                    settingsForm.require_full_crew_roster !== false
                      ? 'bg-white border-[#1090F8] shadow-xs'
                      : 'bg-white/60 border-[#24252c]/10 hover:bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="crew_rule"
                    checked={settingsForm.require_full_crew_roster !== false}
                    onChange={() => setSettingsForm((prev) => ({ ...prev, require_full_crew_roster: true }))}
                    className="mt-0.5 accent-[#1090F8]"
                  />
                  <div>
                    <span className="font-extrabold text-xs text-[var(--ink)] block">
                      Require Full Crew Presence (Block date if 1 crew is missing)
                    </span>
                    <span className="text-[11px] text-[#24252c]/65 block mt-0.5">
                      Blocks customer bookings on any date where <strong>even 1 crew technician is absent / on-leave</strong>. All registered crew must be on-duty.
                    </span>
                  </div>
                </label>

                {/* Option B: Flexible Minimum Threshold */}
                <label
                  className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                    settingsForm.require_full_crew_roster === false
                      ? 'bg-white border-[#1090F8] shadow-xs'
                      : 'bg-white/60 border-[#24252c]/10 hover:bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="crew_rule"
                    checked={settingsForm.require_full_crew_roster === false}
                    onChange={() => setSettingsForm((prev) => ({ ...prev, require_full_crew_roster: false }))}
                    className="mt-0.5 accent-[#1090F8]"
                  />
                  <div className="flex-1">
                    <span className="font-extrabold text-xs text-[var(--ink)] block">
                      Minimum Available Crew Threshold
                    </span>
                    <span className="text-[11px] text-[#24252c]/65 block mt-0.5">
                      Allow bookings as long as a minimum number of technicians are on-duty.
                    </span>

                    {settingsForm.require_full_crew_roster === false && (
                      <div className="mt-2.5 pt-2.5 border-t border-[#24252c]/[0.08] flex items-center gap-2 animate-fade-in">
                        <span className="text-[11px] font-bold text-[var(--ink)]">Minimum Crew Needed Per Event:</span>
                        <input
                          type="number"
                          min="1"
                          max="20"
                          value={settingsForm.min_crew_required !== undefined ? settingsForm.min_crew_required : 1}
                          onChange={(e) =>
                            setSettingsForm((prev) => ({
                              ...prev,
                              min_crew_required: Math.max(1, parseInt(e.target.value, 10) || 1),
                            }))
                          }
                          className="w-16 px-2.5 py-1 bg-white rounded-lg border border-[#1090F8] text-xs font-black text-center text-[var(--ink)] focus:outline-none"
                        />
                        <span className="text-[11px] text-[#24252c]/60">technicians</span>
                      </div>
                    )}
                  </div>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="px-4 py-2.5 rounded-full border border-[#24252c]/15 text-xs font-bold hover:bg-[var(--mist)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingSettings}
                className="px-6 py-2.5 rounded-full bg-[var(--ink)] text-white text-xs font-bold hover:bg-black transition-colors cursor-pointer"
              >
                {isSavingSettings ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </form>
        </div>
      </ModalOverlay>
    </div>
  );
}
