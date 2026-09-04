import { useState, useEffect } from 'react';
import { fetchDbBookedDates, normalizeDateToIso, isPastDate as checkIsPastDate } from '../../utils/bookingService';
import { supabase } from '../../lib/supabase';

interface BookingRescheduleCalendarProps {
  originalDate?: string; // 'YYYY-MM-DD' or ISO string or 'September 14, 2026'
  selectedDate: string; // 'YYYY-MM-DD'
  onSelectDate: (dateStr: string) => void;
  excludeBookingId?: string; // Exclude current booking ID so its own date doesn't block
  minDateOffsetDays?: number; // Minimum days from now (e.g. 1)
  className?: string;
}

export function BookingRescheduleCalendar({
  originalDate,
  selectedDate,
  onSelectDate,
  excludeBookingId,
  minDateOffsetDays = 0,
  className = '',
}: BookingRescheduleCalendarProps) {
  // Normalize original date to YYYY-MM-DD
  const cleanOriginalDate = normalizeDateToIso(originalDate);
  const cleanSelectedDate = normalizeDateToIso(selectedDate);

  // Initialize month view safely based on selectedDate or originalDate or current date
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

  const initDate = parseSafeDate(cleanSelectedDate || cleanOriginalDate);
  const [calYear, setCalYear] = useState(initDate.getFullYear());
  const [calMonth, setCalMonth] = useState(initDate.getMonth());

  const [dbBookings, setDbBookings] = useState<Array<{ event_date: string; id?: string; paymongo_reference_number?: string }>>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);

  // Fetch booked dates from database to disable already reserved slots
  useEffect(() => {
    async function loadBookedDates() {
      setLoadingBookings(true);
      try {
        const data = await fetchDbBookedDates();
        if (data && Array.isArray(data)) {
          // Exclude the active booking being rescheduled
          const filtered = data.filter((b: any) => {
            if (!excludeBookingId) return true;
            return b.id !== excludeBookingId && b.paymongo_reference_number !== excludeBookingId;
          });

          setDbBookings(
            filtered.map((b: any) => ({
              id: b.id,
              paymongo_reference_number: b.paymongo_reference_number,
              event_date: normalizeDateToIso(b.event_date),
            }))
          );
        }
      } catch (err) {
        console.error('Failed to load booked dates for reschedule calendar:', err);
      } finally {
        setLoadingBookings(false);
      }
    }
    loadBookedDates();

    const channel = supabase
      .channel('reschedule-calendar-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        () => {
          loadBookedDates();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [excludeBookingId]);

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

  return (
    <div className={`space-y-3.5 ${className}`}>
      {/* Month Navigation Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-base font-extrabold text-[var(--ink)] block">
            {monthName} {calYear}
          </span>
          <span className="text-[11px] text-[#24252c]/50 font-medium">
            {loadingBookings ? 'Checking database availability...' : 'Click an open slot to select your new event date'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="px-3 py-1.5 rounded-full bg-[var(--mist)] hover:bg-[var(--ink)] hover:text-white text-xs font-bold transition-colors cursor-pointer"
          >
            ← Prev
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            className="px-3 py-1.5 rounded-full bg-[var(--mist)] hover:bg-[var(--ink)] hover:text-white text-xs font-bold transition-colors cursor-pointer"
          >
            Next →
          </button>
        </div>
      </div>

      {/* Weekday Header */}
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-[#24252c]/50">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      {/* 42-cell Fixed Grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Leading empty cells */}
        {Array.from({ length: firstDayIndex }).map((_, i) => (
          <div key={`empty-${i}`} className="aspect-square rounded-xl bg-transparent" />
        ))}

        {/* Days of month */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const formattedIso = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isPast = isPastDate(formattedIso);
          const isBooked = dbBookings.some((b) => b.event_date === formattedIso);
          const isOriginal = formattedIso === cleanOriginalDate;
          const isSelected = formattedIso === cleanSelectedDate;
          const isToday = formattedIso === todayIso;

          let cellClass =
            'bg-white text-[#24252c]/80 font-semibold cursor-pointer hover:bg-[#1090F8]/15 hover:text-[#1090F8] shadow-2xs';
          let badgeText = '';

          if (isSelected) {
            cellClass =
              'bg-[#1090F8] text-white font-black shadow-md scale-[1.03] z-10';
            badgeText = 'New Date';
          } else if (isOriginal) {
            cellClass =
              'bg-blue-100 text-blue-900 font-bold cursor-not-allowed opacity-80 select-none';
            badgeText = 'Original';
          } else if (isPast) {
            cellClass = 'bg-black/[0.03] text-gray-300 font-medium cursor-not-allowed opacity-40 select-none';
            badgeText = 'Past';
          } else if (isBooked) {
            cellClass = 'bg-[var(--ink)] text-white font-semibold shadow-2xs cursor-not-allowed opacity-85 select-none';
            badgeText = 'Booked';
          } else if (isToday) {
            cellClass =
              'text-[#1090F8] font-bold bg-[#1090F8]/15 cursor-pointer hover:bg-[#1090F8]/25 shadow-2xs';
            badgeText = 'Today';
          }

          const handleClick = () => {
            if (isPast || isBooked || isOriginal) return;
            onSelectDate(formattedIso);
          };

          return (
            <div
              key={day}
              onClick={handleClick}
              title={
                isSelected
                  ? `Selected New Date: ${formattedIso}`
                  : isOriginal
                  ? `Original Date (${formattedIso}) - Cannot reschedule to the exact same date`
                  : isPast
                  ? 'Past Date - Cannot be selected'
                  : isBooked
                  ? 'Date Already Booked / Unavailable'
                  : `Select ${formattedIso}`
              }
              className={`aspect-square rounded-xl text-xs flex flex-col items-center justify-center relative transition-all ${cellClass}`}
            >
              <span className="leading-none">{day}</span>
              {badgeText && (
                <span className="text-[7px] font-extrabold uppercase tracking-tight opacity-90 mt-0.5">
                  {badgeText}
                </span>
              )}
            </div>
          );
        })}

        {/* Trailing empty cells */}
        {Array.from({ length: Math.max(0, 42 - (firstDayIndex + daysInMonth)) }).map((_, i) => (
          <div key={`trail-${i}`} className="aspect-square rounded-xl bg-transparent opacity-0 pointer-events-none" />
        ))}
      </div>

      {/* Legend Bar without stroke */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 text-[10px] text-[#24252c]/70">
        <span className="flex items-center gap-1.5 font-semibold text-[var(--ink)]">
          <span className="w-2.5 h-2.5 rounded-md bg-[var(--ink)]" /> Booked / Unavailable
        </span>
        <span className="flex items-center gap-1.5 font-semibold text-blue-900">
          <span className="w-2.5 h-2.5 rounded-md bg-blue-100" /> Original Date
        </span>
        <span className="flex items-center gap-1.5 font-bold text-[#1090F8]">
          <span className="w-2.5 h-2.5 rounded-md bg-[#1090F8]" /> Selected New Date
        </span>
        <span className="flex items-center gap-1.5 text-[#24252c]/60">
          <span className="w-2.5 h-2.5 rounded-md bg-white shadow-2xs" /> Open Date
        </span>
      </div>
    </div>
  );
}
