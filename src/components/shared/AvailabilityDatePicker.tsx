import React, { useState, useEffect } from 'react';
import {
  fetchDbBookedDates,
  normalizeDateToIso,
  isPastDate as checkIsPastDate,
  type DBBooking,
} from '../../utils/bookingService';
import {
  fetchBookingSettings,
  fetchScheduleOverrides,
  getDayAvailabilityStatus,
  DEFAULT_BOOKING_SETTINGS,
  type BookingSettings,
  type ScheduleOverride,
} from '../../utils/bookingEngine';
import { fetchCrewAvailabilityRecords } from '../../utils/crewAvailabilityService';
import { ModalOverlay } from './ModalOverlay';
import { IconCalendar, IconCheck, IconX, IconChevronDown } from './icons';
import { supabase } from '../../lib/supabase';

export interface AvailabilityDatePickerProps {
  selectedDate: string; // 'YYYY-MM-DD'
  onChange: (dateStr: string) => void;
  minDateOffsetDays?: number;
  label?: string;
  required?: boolean;
  inline?: boolean;
  className?: string;
  buttonClassName?: string;
  showAvailabilityBadge?: boolean;
  placeholder?: string;
}

export function AvailabilityDatePicker({
  selectedDate,
  onChange,
  minDateOffsetDays = 0,
  label,
  required = false,
  inline = false,
  className = '',
  buttonClassName = '',
  showAvailabilityBadge = false,
  placeholder = 'Select Event Date',
}: AvailabilityDatePickerProps) {
  const cleanSelectedDate = normalizeDateToIso(selectedDate);
  const [isOpen, setIsOpen] = useState(false);

  // Initialize month view safely based on selectedDate or current date
  const parseSafeDate = (d?: string) => {
    if (!d) return new Date();
    const iso = normalizeDateToIso(d);
    if (iso) {
      const [y, m, day] = iso.split('-').map(Number);
      return new Date(y, m - 1, day);
    }
    const parsed = new Date(d);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  };

  const initDate = parseSafeDate(cleanSelectedDate);
  const [calYear, setCalYear] = useState(initDate.getFullYear());
  const [calMonth, setCalMonth] = useState(initDate.getMonth());

  const [dbBookings, setDbBookings] = useState<DBBooking[]>([]);
  const [bookingSettings, setBookingSettings] = useState<BookingSettings>(DEFAULT_BOOKING_SETTINGS);
  const [scheduleOverrides, setScheduleOverrides] = useState<ScheduleOverride[]>([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);

  // Synchronize calendar month view when selectedDate changes externally
  useEffect(() => {
    if (cleanSelectedDate) {
      const target = parseSafeDate(cleanSelectedDate);
      setCalYear(target.getFullYear());
      setCalMonth(target.getMonth());
    }
  }, [cleanSelectedDate]);

  // Load bookings, settings, overrides, and crew availability from database
  const loadCalendarData = async () => {
    setLoadingAvailability(true);
    try {
      const [data, settings, overrides] = await Promise.all([
        fetchDbBookedDates(),
        fetchBookingSettings(),
        fetchScheduleOverrides(),
        fetchCrewAvailabilityRecords(),
      ]);

      if (settings) setBookingSettings(settings);
      if (overrides) setScheduleOverrides(overrides);
      if (data && Array.isArray(data)) setDbBookings(data);
    } catch (err) {
      console.warn('Failed to load availability data for date picker:', err);
    } finally {
      setLoadingAvailability(false);
    }
  };

  useEffect(() => {
    loadCalendarData();

    const channel = supabase
      .channel('availability-datepicker-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        () => {
          loadCalendarData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const monthName = monthNames[calMonth];

  const firstDayIndex = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

  const handlePrevMonth = () => {
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear((prev) => prev - 1);
    } else {
      setCalMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear((prev) => prev + 1);
    } else {
      setCalMonth((prev) => prev + 1);
    }
  };

  const isPastDate = (dateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    today.setDate(today.getDate() + minDateOffsetDays);

    const [year, month, day] = dateStr.split('-').map(Number);
    const target = new Date(year, month - 1, day);
    target.setHours(0, 0, 0, 0);

    return target < today;
  };

  const now = new Date();
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const currentSelectedDayStatus = cleanSelectedDate
    ? getDayAvailabilityStatus(cleanSelectedDate, dbBookings, bookingSettings, scheduleOverrides)
    : null;

  // Format date display for trigger button
  const formatFriendlyDate = (dStr?: string) => {
    if (!dStr) return '';
    try {
      const [y, m, d] = dStr.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      return dateObj.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dStr;
    }
  };

  // ── Render Calendar Core Content ──────────────────────────────────────────
  const renderCalendarBody = () => (
    <div className="space-y-3 sm:space-y-3.5 select-none">
      {/* Month Navigation Header */}
      <div className="flex items-center justify-between gap-1">
        <div>
          <span className="text-sm sm:text-base font-extrabold text-[var(--ink)] block leading-tight">
            {monthName} {calYear}
          </span>
          <span className="text-[10px] sm:text-[11px] text-[#24252c]/50 font-medium">
            {loadingAvailability ? 'Syncing availability' : 'Select an open date for your event production'}
          </span>
        </div>
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full bg-white hover:bg-[var(--ink)] hover:text-white text-[11px] sm:text-xs font-bold transition-colors cursor-pointer shadow-2xs border border-[#24252c]/10"
          >
            ← Prev
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full bg-white hover:bg-[var(--ink)] hover:text-white text-[11px] sm:text-xs font-bold transition-colors cursor-pointer shadow-2xs border border-[#24252c]/10"
          >
            Next →
          </button>
        </div>
      </div>

      {/* Weekday Header */}
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] sm:text-[11px] font-bold text-[#24252c]/50">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="py-0.5 sm:py-1">
            {d}
          </div>
        ))}
      </div>

      {/* 42-cell Fixed Grid */}
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {/* Leading empty cells */}
        {Array.from({ length: firstDayIndex }).map((_, i) => (
          <div key={`empty-${i}`} className="aspect-square rounded-lg sm:rounded-xl bg-transparent" />
        ))}

        {/* Days of the month */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const formattedIso = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isPast = isPastDate(formattedIso);
          const isSelected = formattedIso === cleanSelectedDate;
          const isToday = formattedIso === todayIso;

          const dayStatus = getDayAvailabilityStatus(formattedIso, dbBookings, bookingSettings, scheduleOverrides);
          const isClosed = dayStatus.status === 'closed';
          const isFullyBooked = dayStatus.status === 'fully_booked';
          const hasSlotsAvailable = dayStatus.status === 'slots_available';

          // Blocked dates rule: Past dates, schedule closed/off-duty dates, and fully booked dates are COMPLETELY disabled
          const isBlocked = isPast || isClosed || isFullyBooked;

          let cellClass =
            'bg-white text-[#24252c]/80 font-semibold cursor-pointer hover:bg-[#1090F8]/15 hover:text-[#1090F8] shadow-2xs';
          let cellStyle: React.CSSProperties | undefined = undefined;
          let badgeText = '';
          let isSlotsHalf = false;

          if (isSelected) {
            cellClass =
              'bg-[#1090F8] text-white font-black shadow-md scale-[1.03] z-10 ring-2 ring-[#1090F8]/30 cursor-pointer';
            badgeText = 'Selected';
          } else if (isPast) {
            cellClass = 'bg-black/[0.03] text-gray-300 font-medium cursor-not-allowed opacity-35 select-none pointer-events-none';
            badgeText = 'Past';
          } else if (isClosed) {
            cellClass = 'bg-rose-50 text-rose-500 font-semibold cursor-not-allowed opacity-75 select-none border border-rose-200/70 pointer-events-none';
            badgeText = 'Blocked';
          } else if (isFullyBooked) {
            cellClass = 'bg-[var(--ink)] text-white font-semibold shadow-2xs cursor-not-allowed opacity-85 select-none pointer-events-none';
            badgeText = isToday ? 'No Slots' : 'Booked';
          } else if (hasSlotsAvailable) {
            isSlotsHalf = true;
            cellClass =
              'border border-emerald-500/40 font-bold cursor-pointer hover:scale-[1.04] hover:shadow-md hover:border-emerald-400 transition-all shadow-xs relative overflow-hidden';
            cellStyle = { background: 'linear-gradient(135deg, #24252C 0%, #065F46 55%, #059669 100%)' };
            badgeText = 'Slots Open';
          } else if (isToday) {
            cellClass =
              'text-[#1090F8] font-bold bg-[#1090F8]/15 cursor-pointer hover:bg-[#1090F8]/25 shadow-2xs border border-[#1090F8]/30';
            badgeText = 'Today';
          }

          const handleCellClick = () => {
            if (isBlocked) return;
            onChange(formattedIso);
            localStorage.setItem('binhi_selected_event_date', formattedIso);
            setIsOpen(false);
          };

          return (
            <button
              type="button"
              key={day}
              onClick={handleCellClick}
              disabled={isBlocked}
              style={cellStyle}
              title={
                isSelected
                  ? `Selected: ${formattedIso}`
                  : isPast
                  ? 'Past date (Unavailable)'
                  : isClosed
                  ? 'Blocked / Closed (No bookings allowed on this date)'
                  : isFullyBooked
                  ? 'Fully Booked (All production time windows reserved)'
                  : isSlotsHalf
                  ? `Slots Open (${formattedIso}) - Multiple operational windows available`
                  : isToday
                  ? `Today (${formattedIso}) - Available`
                  : `Available for booking (${formattedIso})`
              }
              className={`aspect-square rounded-lg sm:rounded-xl text-[10px] sm:text-xs flex flex-col items-center justify-center relative transition-all outline-none focus:outline-none ${cellClass}`}
            >
              <span className={`leading-none ${isSlotsHalf ? 'font-black text-[10px] sm:text-[11.5px] text-white drop-shadow-xs z-10' : ''}`}>
                {day}
              </span>

              {badgeText && (
                <span
                  className={`text-[5px] sm:text-[6.5px] font-extrabold uppercase tracking-tight px-1 py-0.2 rounded-full mt-0.5 truncate max-w-[90%] leading-tight ${
                    isSelected
                      ? 'bg-white text-[#1090F8]'
                      : isSlotsHalf
                      ? 'text-emerald-100 bg-emerald-500/30 border border-emerald-400/30'
                      : isClosed
                      ? 'bg-rose-100 text-rose-700'
                      : isFullyBooked
                      ? 'bg-rose-500 text-white'
                      : isToday
                      ? 'text-[#1090F8]'
                      : 'text-[#24252c]/50'
                  }`}
                >
                  {badgeText}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Visual Status Legend */}
      <div className="pt-2 border-t border-[#24252c]/[0.08] flex flex-wrap items-center justify-between gap-1.5 text-[9px] sm:text-[10px] text-[#24252c]/60">
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-[#1090F8]" />
          <span>Selected</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span>Slots Open</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-white border border-[#24252c]/20" />
          <span>Available</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-100 border border-rose-300" />
          <span>Blocked</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-[var(--ink)]" />
          <span>Booked</span>
        </div>
      </div>
    </div>
  );

  // If Inline mode: render directly
  if (inline) {
    return (
      <div className={`p-3.5 sm:p-5 rounded-2xl bg-[var(--mist)] border border-[#24252c]/[0.08] shadow-xs ${className}`}>
        {renderCalendarBody()}
      </div>
    );
  }

  // Popover / Modal trigger mode
  return (
    <div className={`relative ${className}`}>
      {/* Trigger Button Field */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`w-full rounded-full border px-4 py-2.5 sm:py-3 text-xs sm:text-sm transition-all flex items-center justify-between gap-3 text-left cursor-pointer outline-none focus:outline-none ${
          cleanSelectedDate && currentSelectedDayStatus?.status !== 'closed' && currentSelectedDayStatus?.status !== 'fully_booked' && !isPastDate(cleanSelectedDate)
            ? 'bg-white border-[#24252c]/15 text-[var(--ink)] hover:border-[#1090F8] shadow-2xs'
            : cleanSelectedDate && (currentSelectedDayStatus?.status === 'closed' || currentSelectedDayStatus?.status === 'fully_booked' || isPastDate(cleanSelectedDate))
            ? 'bg-rose-50 border-rose-300 text-rose-800 font-bold'
            : 'bg-white border-[#24252c]/15 text-[#24252c]/60 hover:border-[#1090F8] hover:text-[var(--ink)] shadow-2xs'
        } ${buttonClassName}`}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <span className="p-1 rounded-full bg-[#1090F8]/10 text-[#1090F8] shrink-0">
            <IconCalendar className="w-4 h-4" />
          </span>
          <span className="font-semibold text-xs sm:text-sm whitespace-normal">
            {cleanSelectedDate ? formatFriendlyDate(cleanSelectedDate) : placeholder}
          </span>
        </div>

        <div className="flex items-center text-[#24252c]/40 shrink-0">
          <IconChevronDown className="w-4 h-4" />
        </div>
      </button>

      {/* Calendar Interactive Modal Overlay */}
      <ModalOverlay isOpen={isOpen} onClose={() => setIsOpen(false)}>
        <div className="bg-white rounded-2xl sm:rounded-[2.5rem] max-w-lg w-[96vw] sm:w-full shadow-2xl border border-[#24252c]/10 relative p-4 sm:p-6 overflow-hidden flex flex-col animate-blur-in">
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="absolute top-4 right-4 sm:top-5 sm:right-5 z-20 text-[#24252c]/50 hover:text-[var(--ink)] p-1.5 rounded-full hover:bg-[var(--mist)] transition-colors bg-white/90 backdrop-blur-md shadow-sm border border-[#24252c]/10 cursor-pointer"
            title="Close"
          >
            <IconX className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          <div className="mb-3 pb-3 border-b border-[#24252c]/[0.06] pr-8 sm:pr-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 rounded-lg bg-[#1090F8]/10 text-[#1090F8]">
                <IconCalendar className="w-4 h-4 sm:w-5 sm:h-5" />
              </span>
              <h3 className="text-lg sm:text-xl font-extrabold text-[var(--ink)]">
                Select Event Production Date
              </h3>
            </div>
            <p className="text-xs text-[#24252c]/60">
              Dates highlighted in red or dark are closed or fully booked. Click any open slot to instantly choose your date.
            </p>
          </div>

          <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-[var(--mist)]">
            {renderCalendarBody()}
          </div>

          {cleanSelectedDate && (
            <div className="mt-4 pt-3 border-t border-[#24252c]/[0.06] flex items-center justify-between gap-2">
              <div className="text-xs text-[var(--ink)]">
                <span className="text-[#24252c]/50 font-medium">Selected: </span>
                <strong>{formatFriendlyDate(cleanSelectedDate)}</strong>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="bg-[#1090F8] hover:bg-[#1090F8]/90 text-white text-xs font-bold px-4 py-2 rounded-full transition-all shadow-sm cursor-pointer"
              >
                Confirm Date
              </button>
            </div>
          )}
        </div>
      </ModalOverlay>
    </div>
  );
}
