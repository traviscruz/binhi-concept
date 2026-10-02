import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { IconCalendar, IconChevronDown, IconX } from './icons';

function IconChevronLeft({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function IconChevronRight({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

export interface DualCalendarDateRangePickerProps {
  startDate: string; // 'YYYY-MM-DD' or ''
  endDate: string;   // 'YYYY-MM-DD' or ''
  onChange: (startDate: string, endDate: string) => void;
  preset?: string;
  onPresetChange?: (preset: string) => void;
  className?: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Formats YYYY-MM-DD into readable word date like "Oct 1, 2025"
 */
export function formatDateWords(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts.map(Number);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return dateStr;
  const monthName = MONTH_SHORT[m - 1] || '';
  return `${monthName} ${d}, ${y}`;
}

/**
 * Formats a date range into words: "Oct 1, 2025 – Oct 15, 2025" or "Oct 1, 2025"
 */
export function formatRangeWords(start: string, end: string): string {
  if (!start && !end) return 'All Time History';
  if (start && end) {
    if (start === end) return formatDateWords(start);
    const [y1, m1, d1] = start.split('-').map(Number);
    const [y2, m2, d2] = end.split('-').map(Number);
    // If same month and same year: "Oct 1 – 15, 2025"
    if (y1 === y2 && m1 === m2) {
      return `${MONTH_SHORT[m1 - 1]} ${d1} – ${d2}, ${y1}`;
    }
    // If same year: "Oct 1 – Nov 5, 2025"
    if (y1 === y2) {
      return `${MONTH_SHORT[m1 - 1]} ${d1} – ${MONTH_SHORT[m2 - 1]} ${d2}, ${y1}`;
    }
    return `${formatDateWords(start)} – ${formatDateWords(end)}`;
  }
  if (start) return `From ${formatDateWords(start)}`;
  if (end) return `Until ${formatDateWords(end)}`;
  return 'All Time History';
}

export function DualCalendarDateRangePicker({
  startDate,
  endDate,
  onChange,
  preset,
  onPresetChange,
  className = '',
}: DualCalendarDateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState<boolean>(() => typeof window !== 'undefined' ? window.innerWidth < 640 : false);
  const containerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Parse initial calendar month views based on startDate or current date
  const getInitialDate = () => {
    if (startDate) {
      const [y, m, d] = startDate.split('-').map(Number);
      return new Date(y, m - 1, d || 1);
    }
    return new Date();
  };

  const initial = getInitialDate();
  const [calYear, setCalYear] = useState(initial.getFullYear());
  const [calMonth, setCalMonth] = useState(initial.getMonth());

  // Temporary selection state when picking ranges
  const [tempStart, setTempStart] = useState<string>(startDate);
  const [tempEnd, setTempEnd] = useState<string>(endDate);
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  // Sync temp dates when props change or popover opens
  useEffect(() => {
    setTempStart(startDate);
    setTempEnd(endDate);
    if (startDate) {
      const [y, m] = startDate.split('-').map(Number);
      if (!isNaN(y) && !isNaN(m)) {
        setCalYear(y);
        setCalMonth(m - 1);
      }
    }
  }, [startDate, endDate, isOpen]);

  // Lock body scroll on mobile when modal is open to prevent screen jump / scroll
  useEffect(() => {
    if (isOpen && isMobile) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [isOpen, isMobile]);

  // Click outside listener for desktop
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        !isMobile &&
        containerRef.current &&
        !containerRef.current.contains(event.target as Node) &&
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen && !isMobile) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, isMobile]);

  // Navigation handlers
  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear((y) => y - 1);
    } else {
      setCalMonth((m) => m - 1);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear((y) => y + 1);
    } else {
      setCalMonth((m) => m + 1);
    }
  };

  // Month N+1 calculation for right calendar
  const nextCalMonth = calMonth === 11 ? 0 : calMonth + 1;
  const nextCalYear = calMonth === 11 ? calYear + 1 : calYear;

  // Format date helper: YYYY-MM-DD
  const formatIso = (year: number, month: number, day: number) => {
    const m = String(month + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${year}-${m}-${d}`;
  };

  // Click on a calendar day
  const handleDayClick = (dateStr: string) => {
    // If no start date, or both start & end dates are already set -> start a new selection
    if (!tempStart || (tempStart && tempEnd)) {
      setTempStart(dateStr);
      setTempEnd('');
    } else if (tempStart && !tempEnd) {
      // If clicked date is earlier than start date, reset start date to clicked date (Constraint rule)
      if (dateStr < tempStart) {
        setTempStart(dateStr);
        setTempEnd('');
      } else {
        // Valid end date: apply range immediately
        setTempEnd(dateStr);
        onChange(tempStart, dateStr);
        if (onPresetChange) onPresetChange('custom');
      }
    }
  };

  // Quick Presets
  const applyPreset = (type: string) => {
    const now = new Date();
    const todayStr = formatIso(now.getFullYear(), now.getMonth(), now.getDate());

    if (type === 'today') {
      onChange(todayStr, todayStr);
    } else if (type === '7days') {
      const past = new Date(now);
      past.setDate(past.getDate() - 7);
      onChange(formatIso(past.getFullYear(), past.getMonth(), past.getDate()), todayStr);
    } else if (type === '30days') {
      const past = new Date(now);
      past.setDate(past.getDate() - 30);
      onChange(formatIso(past.getFullYear(), past.getMonth(), past.getDate()), todayStr);
    } else if (type === 'this_month') {
      const start = formatIso(now.getFullYear(), now.getMonth(), 1);
      onChange(start, todayStr);
    } else if (type === 'year') {
      const start = formatIso(now.getFullYear(), 0, 1);
      onChange(start, todayStr);
    } else if (type === 'all') {
      onChange('', '');
    }

    if (onPresetChange) onPresetChange(type);
    setIsOpen(false);
  };

  const handleApply = () => {
    if (tempStart && tempEnd) {
      onChange(tempStart, tempEnd);
    } else if (tempStart && !tempEnd) {
      onChange(tempStart, tempStart);
    }
    if (onPresetChange) onPresetChange('custom');
    setIsOpen(false);
  };

  const handleClear = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setTempStart('');
    setTempEnd('');
    onChange('', '');
    if (onPresetChange) onPresetChange('all');
  };

  // Human readable label for trigger button in words
  const getTriggerLabel = () => {
    if (startDate || endDate) {
      return formatRangeWords(startDate, endDate);
    }
    if (preset === '7days') return 'Last 7 Days';
    if (preset === '30days') return 'Last 30 Days';
    if (preset === 'this_month') return 'This Month';
    if (preset === 'quarter') return 'This Quarter';
    if (preset === 'year') return 'This Year';
    return 'All Time History';
  };

  // Render month matrix
  const renderMonthCalendar = (year: number, month: number, isRight = false) => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];

    // Empty blank slots
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`blank-${i}`} className="w-8 h-8 sm:w-8 sm:h-8" />);
    }

    // Days slots
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = formatIso(year, month, d);
      const isStart = dateStr === tempStart;
      const isEnd = dateStr === tempEnd;

      // Range check
      const effectiveEnd = tempEnd || (tempStart && hoverDate && hoverDate > tempStart ? hoverDate : '');
      const isInRange = tempStart && effectiveEnd && dateStr > tempStart && dateStr < effectiveEnd;

      let buttonStyles = 'text-gray-700 hover:bg-[#1090F8]/10 hover:text-[#1090F8] rounded-lg font-medium';

      if (isStart || isEnd) {
        buttonStyles = 'bg-[var(--ink)] text-white font-bold rounded-lg shadow-xs';
      } else if (isInRange) {
        buttonStyles = 'bg-blue-50 text-blue-900 font-semibold rounded-none';
      }

      days.push(
        <button
          key={dateStr}
          type="button"
          onClick={() => handleDayClick(dateStr)}
          onMouseEnter={() => setHoverDate(dateStr)}
          className={`w-8 h-8 sm:w-8 sm:h-8 text-xs flex items-center justify-center transition-colors cursor-pointer relative ${buttonStyles}`}
        >
          {d}
        </button>
      );
    }

    return (
      <div className="p-3 sm:p-4 min-w-[260px] flex-1">
        {/* Month Header */}
        <div className="flex items-center justify-between mb-3 px-1">
          {!isRight ? (
            <button
              type="button"
              onClick={handlePrevMonth}
              className="w-7 h-7 rounded-full bg-[var(--mist)] hover:bg-[var(--ink)] hover:text-white transition-colors flex items-center justify-center cursor-pointer text-xs shadow-xs"
              title="Previous Month"
            >
              <IconChevronLeft className="w-3.5 h-3.5" />
            </button>
          ) : (
            <div className="w-7 h-7 hidden sm:block" />
          )}

          <div className="text-xs sm:text-sm font-extrabold text-[var(--ink)]">
            {MONTH_NAMES[month]} {year}
          </div>

          {!isRight ? (
            <>
              {/* Next Month Button visible on mobile when only 1 calendar is shown */}
              <button
                type="button"
                onClick={handleNextMonth}
                className="w-7 h-7 rounded-full bg-[var(--mist)] hover:bg-[var(--ink)] hover:text-white transition-colors flex items-center justify-center cursor-pointer text-xs shadow-xs sm:hidden"
                title="Next Month"
              >
                <IconChevronRight className="w-3.5 h-3.5" />
              </button>
              <div className="w-7 h-7 hidden sm:block" />
            </>
          ) : (
            <button
              type="button"
              onClick={handleNextMonth}
              className="w-7 h-7 rounded-full bg-[var(--mist)] hover:bg-[var(--ink)] hover:text-white transition-colors flex items-center justify-center cursor-pointer text-xs shadow-xs"
              title="Next Month"
            >
              <IconChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Days of week header */}
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-[#24252c]/50 mb-1.5">
          {DAY_NAMES.map((n) => (
            <span key={n} className="w-8">
              {n}
            </span>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-1" onMouseLeave={() => setHoverDate(null)}>
          {days}
        </div>
      </div>
    );
  };

  // The actual dialog content
  const dialogContent = (
    <div
      ref={popoverRef}
      className={`bg-white rounded-3xl shadow-2xl border border-[#24252c]/10 overflow-hidden ${
        isMobile
          ? 'w-[340px] max-w-[calc(100vw-24px)] mx-auto animate-in fade-in zoom-in-95 duration-200'
          : 'w-[580px] max-w-[580px] absolute right-0 top-full mt-2 z-50 animate-in fade-in zoom-in-95 sm:slide-in-from-top-2 duration-150'
      }`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Top Presets Bar */}
      <div className="p-3 bg-gray-50/95 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
          <span className="text-[10px] uppercase font-bold text-[#24252c]/50 mr-1">Presets:</span>
          <button
            type="button"
            onClick={() => applyPreset('7days')}
            className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer ${
              preset === '7days'
                ? 'bg-[var(--ink)] text-white border-[var(--ink)]'
                : 'bg-white border-gray-200/80 hover:bg-[var(--mist)] text-[var(--ink)]'
            }`}
          >
            7 Days
          </button>
          <button
            type="button"
            onClick={() => applyPreset('30days')}
            className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer ${
              preset === '30days'
                ? 'bg-[var(--ink)] text-white border-[var(--ink)]'
                : 'bg-white border-gray-200/80 hover:bg-[var(--mist)] text-[var(--ink)]'
            }`}
          >
            30 Days
          </button>
          <button
            type="button"
            onClick={() => applyPreset('this_month')}
            className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer ${
              preset === 'this_month'
                ? 'bg-[var(--ink)] text-white border-[var(--ink)]'
                : 'bg-white border-gray-200/80 hover:bg-[var(--mist)] text-[var(--ink)]'
            }`}
          >
            This Month
          </button>
          <button
            type="button"
            onClick={() => applyPreset('year')}
            className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer ${
              preset === 'year'
                ? 'bg-[var(--ink)] text-white border-[var(--ink)]'
                : 'bg-white border-gray-200/80 hover:bg-[var(--mist)] text-[var(--ink)]'
            }`}
          >
            This Year
          </button>
          <button
            type="button"
            onClick={() => applyPreset('all')}
            className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer ${
              preset === 'all' && !startDate && !endDate
                ? 'bg-[var(--ink)] text-white border-[var(--ink)]'
                : 'bg-white border-gray-200/80 hover:bg-[var(--mist)] text-[var(--ink)]'
            }`}
          >
            All Time
          </button>
        </div>

        {/* Active Range Display in Word Format */}
        <div className="flex items-center gap-1.5">
          <div className="text-[11px] font-bold text-[#1090F8] bg-blue-50/90 border border-blue-200/60 px-2.5 py-0.5 rounded-lg whitespace-nowrap">
            {tempStart ? formatDateWords(tempStart) : 'Start'} → {tempEnd ? formatDateWords(tempEnd) : 'End'}
          </div>
          {isMobile && (
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 text-gray-400 hover:text-gray-700 rounded-full cursor-pointer"
            >
              <IconX className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Calendar Month Views (Single on mobile, Dual side-by-side on desktop) */}
      <div className="flex flex-col sm:flex-row sm:divide-x divide-gray-100 justify-center">
        {renderMonthCalendar(calYear, calMonth, false)}
        <div className="hidden sm:block flex-1">{renderMonthCalendar(nextCalYear, nextCalMonth, true)}</div>
      </div>

      {/* Bottom Action Footer */}
      <div className="p-3 bg-gray-50/95 border-t border-gray-100 flex items-center justify-between text-xs">
        <button
          type="button"
          onClick={() => handleClear()}
          className="text-rose-600 hover:text-rose-800 font-semibold px-2 py-1 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
        >
          Reset to All Time
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="px-3 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-100 font-semibold text-[var(--ink)] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={!tempStart}
            className="px-4 py-1.5 rounded-xl bg-[var(--ink)] text-white hover:bg-[var(--ink-soft)] font-bold transition-colors shadow-xs cursor-pointer disabled:opacity-40"
          >
            Apply Range
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`relative inline-block ${className}`} ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2 bg-white border border-[#24252c]/15 hover:border-[#1090F8] text-[var(--ink)] px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shadow-2xs cursor-pointer group whitespace-nowrap"
      >
        <IconCalendar className="w-3.5 h-3.5 text-[#1090F8] shrink-0" />
        <span className="truncate max-w-[240px]">{getTriggerLabel()}</span>
        {(startDate || endDate) && (
          <span
            onClick={handleClear}
            className="p-0.5 text-gray-400 hover:text-rose-600 rounded-full cursor-pointer ml-0.5"
            title="Clear date range"
          >
            <IconX className="w-3 h-3" />
          </span>
        )}
        <IconChevronDown
          className={`w-3.5 h-3.5 text-[#24252c]/40 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Popover on Desktop OR Center Screen Modal on Mobile (Portal) */}
      {isOpen && (
        isMobile ? (
          createPortal(
            <div
              className="fixed inset-0 z-[9999] flex items-center justify-center p-3.5 bg-black/60 backdrop-blur-xs animate-fade-in"
              onClick={() => setIsOpen(false)}
            >
              {dialogContent}
            </div>,
            document.body
          )
        ) : (
          dialogContent
        )
      )}
    </div>
  );
}


