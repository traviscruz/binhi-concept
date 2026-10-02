import { useState, useEffect, useMemo } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import {
  IconCalendar,
  IconCheck,
  IconX,
  IconClock,
  IconShield,
  IconPin,
  IconAlertTriangle,
} from '../../components/shared/icons';
import { ModalOverlay } from '../../components/shared/ModalOverlay';
import { supabase } from '../../utils/supabase';
import {
  fetchCrewAvailabilityRecords,
  setCrewDateAvailability,
  getDailyCrewCapacity,
  type DailyCrewCapacity,
} from '../../utils/crewAvailabilityService';
import { formatDisplayDate } from '../../utils/bookingService';
import {
  fetchBookingSettings,
  formatTimeAmPm,
  calculateCrewArrivalTime,
  timeToMinutes,
  type BookingSettings,
  DEFAULT_BOOKING_SETTINGS,
} from '../../utils/bookingEngine';

export default function CrewAvailabilityPage({ go }: { go: (p: Page) => void }) {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<any[]>([]);
  const [activeBookings, setActiveBookings] = useState<any[]>([]);
  const [bookingSettings, setBookingSettings] = useState<BookingSettings>(DEFAULT_BOOKING_SETTINGS);
  const [selectedDay, setSelectedDay] = useState<{
    dateStr: string;
    isPast: boolean;
    myStatus: 'available' | 'on_leave' | 'assigned';
    myReason?: string;
    assignedBooking?: any;
    dayBookings?: any[];
    capacity?: DailyCrewCapacity;
  } | null>(null);

  const [savingStatus, setSavingStatus] = useState(false);
  const [editStatus, setEditStatus] = useState<'available' | 'on_leave'>('available');
  const [leaveType, setLeaveType] = useState<'standard' | 'emergency'>('standard');
  const [editReason, setEditReason] = useState('Rest Day / Off-Duty');
  const [customReason, setCustomReason] = useState('');
  const [emergencyCategory, setEmergencyCategory] = useState<'sickness' | 'family' | 'accident' | 'other'>('sickness');
  const [emergencyNotes, setEmergencyNotes] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthYearString = useMemo(() => {
    return currentDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  }, [currentDate]);

  const monthPrefix = useMemo(() => {
    const mm = String(month + 1).padStart(2, '0');
    return `${year}-${mm}`;
  }, [year, month]);

  // Load current logged-in crew profile and booking settings
  useEffect(() => {
    async function loadUserAndData() {
      setLoading(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        let crewId = user?.id || 'crew-1';
        let crewName = 'Crew Technician';
        let crewEmail = user?.email || 'crew@binhiconcept.ph';

        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, full_name, first_name, last_name, email')
            .eq('id', user.id)
            .maybeSingle();

          if (profile) {
            crewId = profile.id;
            crewName = profile.full_name || `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Crew Technician';
            crewEmail = profile.email || crewEmail;
          }
        }

        setCurrentUser({ id: crewId, name: crewName, email: crewEmail });

        // Fetch records, active bookings & settings
        const [recs, { data: bookingsData }, settings] = await Promise.all([
          fetchCrewAvailabilityRecords(monthPrefix),
          supabase
            .from('bookings')
            .select('*')
            .neq('status', 'cancelled')
            .neq('status', 'declined')
            .neq('status', 'refunded'),
          fetchBookingSettings(),
        ]);

        setRecords(recs);
        setActiveBookings(bookingsData || []);
        if (settings) setBookingSettings(settings);
      } catch (err) {
        console.error('Error loading crew data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadUserAndData();
  }, [monthPrefix]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Build calendar matrix
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days: Array<{
      dayNumber: number;
      dateStr: string;
      isToday: boolean;
      isPast: boolean;
      isCurrentMonth: boolean;
      myStatus: 'available' | 'on_leave' | 'assigned';
      myReason?: string;
      assignedBooking?: any;
      dayBookings?: any[];
    }> = [];

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    for (let i = 0; i < firstDayIndex; i++) {
      days.push({
        dayNumber: 0,
        dateStr: '',
        isToday: false,
        isPast: false,
        isCurrentMonth: false,
        myStatus: 'available',
      });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dayDate = new Date(year, month, d);
      dayDate.setHours(0, 0, 0, 0);
      const isPast = dayDate < now;
      const isToday = dayDate.toDateString() === now.toDateString();
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

      // Check my availability record
      const myRec = records.find(
        (r) =>
          r.date === dateStr &&
          (r.crewId === currentUser?.id ||
            (r.crewName && currentUser?.name && r.crewName.toLowerCase() === currentUser.name.toLowerCase()))
      );

      // Check ALL active bookings on this date, sorted by start time
      const dayBookings = activeBookings
        .filter((b) => {
          const bDate = typeof b.event_date === 'string' ? b.event_date.split('T')[0] : '';
          return bDate === dateStr && b.status !== 'cancelled' && b.status !== 'declined' && b.status !== 'refunded';
        })
        .sort((a, b) => timeToMinutes(a.start_time || '13:00') - timeToMinutes(b.start_time || '13:00'));

      // Check assigned bookings for current user on this date
      const assigned = dayBookings.find((b) => {
        if (!Array.isArray(b.assigned_crew)) return false;
        return b.assigned_crew.some(
          (c: any) =>
            c === currentUser?.id ||
            c === currentUser?.name ||
            c.id === currentUser?.id ||
            c.name === currentUser?.name
        );
      });

      let status: 'available' | 'on_leave' | 'assigned' = 'available';
      if (myRec && (myRec.status === 'on_leave' || myRec.status === 'unavailable')) {
        status = 'on_leave';
      } else if (assigned) {
        status = 'assigned';
      }

      days.push({
        dayNumber: d,
        dateStr,
        isToday,
        isPast,
        isCurrentMonth: true,
        myStatus: status,
        myReason: myRec?.reason,
        assignedBooking: assigned,
        dayBookings,
      });
    }

    return days;
  }, [year, month, records, activeBookings, currentUser]);

  // Summary counts
  const monthStats = useMemo(() => {
    let onDuty = 0;
    let onLeave = 0;
    let assigned = 0;

    calendarDays.forEach((day) => {
      if (!day.isCurrentMonth) return;
      if (day.myStatus === 'on_leave') {
        onLeave++;
      } else if (day.myStatus === 'assigned') {
        assigned++;
      } else {
        onDuty++;
      }
    });

    return { onDuty, onLeave, assigned };
  }, [calendarDays]);

  const handleOpenDayModal = async (day: any) => {
    if (!day.isCurrentMonth) return;

    const eventDateObj = new Date(day.dateStr);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((eventDateObj.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const hasBooking = (day.dayBookings && day.dayBookings.length > 0) || Boolean(day.assignedBooking);

    const isExistingEmergency = Boolean(day.myReason && day.myReason.toLowerCase().includes('emergency'));
    
    setEditStatus(day.myStatus === 'on_leave' ? 'on_leave' : 'available');
    setLeaveType(isExistingEmergency || (diffDays < 7 && hasBooking) ? 'emergency' : 'standard');
    setEditReason(day.myReason || 'Rest Day / Off-Duty');
    setCustomReason('');
    setEmergencyCategory('sickness');
    setEmergencyNotes('');

    // Fetch live daily capacity across all crew
    const cap = await getDailyCrewCapacity(day.dateStr, activeBookings);

    setSelectedDay({
      dateStr: day.dateStr,
      isPast: day.isPast,
      myStatus: day.myStatus,
      myReason: day.myReason,
      assignedBooking: day.assignedBooking,
      dayBookings: day.dayBookings || [],
      capacity: cap,
    });
  };

  const handleSaveAvailability = async () => {
    if (!selectedDay || !currentUser) return;

    const eventDateObj = new Date(selectedDay.dateStr);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((eventDateObj.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      alert('Cannot modify attendance for past dates.');
      return;
    }

    const hasBooking = (selectedDay.dayBookings && selectedDay.dayBookings.length > 0) || Boolean(selectedDay.assignedBooking);

    // Standard Leave Validation: Requires 7+ days notice if an event is booked
    if (editStatus === 'on_leave' && leaveType === 'standard' && diffDays < 7 && hasBooking) {
      alert(
        `Standard scheduled rest days require 7 days advance notice for booked events (${
          diffDays === 0 ? 'today' : diffDays === 1 ? '1 day away' : `${diffDays} days away`
        }).\n\nFor sudden illness, fever, or emergency, please switch to the "Emergency / Medical Absence" tab.`
      );
      return;
    }

    setSavingStatus(true);

    try {
      let finalReason: string | undefined = undefined;

      if (editStatus === 'on_leave') {
        if (leaveType === 'emergency') {
          const catLabel =
            emergencyCategory === 'sickness'
              ? 'Medical Illness / Sickness'
              : emergencyCategory === 'family'
              ? 'Family Emergency'
              : emergencyCategory === 'accident'
              ? 'Transit Accident / Breakdown'
              : 'Urgent Emergency';
          finalReason = `[Emergency Leave - ${catLabel}]${emergencyNotes ? `: ${emergencyNotes}` : ''}`;
        } else {
          finalReason = editReason === 'Others' ? customReason || 'Personal Leave' : editReason;
        }
      }

      const res = await setCrewDateAvailability({
        crewId: currentUser.id,
        crewName: currentUser.name,
        date: selectedDay.dateStr,
        status: editStatus === 'on_leave' ? 'on_leave' : 'available',
        reason: finalReason,
      });

      if (res.success) {
        // 1. Immediately update local records state accurately
        setRecords((prev) => {
          const filtered = prev.filter(
            (r) =>
              !(
                r.date === selectedDay.dateStr &&
                (r.crewId === currentUser.id ||
                  (r.crewName &&
                    currentUser.name &&
                    r.crewName.toLowerCase() === currentUser.name.toLowerCase()))
              )
          );
          filtered.push(res.record);
          return filtered;
        });

        // 2. Also re-fetch fresh records to ensure Supabase sync
        fetchCrewAvailabilityRecords(monthPrefix).then((fresh) => {
          if (fresh && fresh.length > 0) {
            setRecords(fresh);
          }
        });

        const isEmergency = editStatus === 'on_leave' && leaveType === 'emergency';
        setToastMessage(
          isEmergency
            ? `Emergency leave filed for ${formatDisplayDate(selectedDay.dateStr)}. Management has been alerted for crew reassignment.`
            : `Attendance for ${formatDisplayDate(selectedDay.dateStr)} updated to ${
                editStatus === 'on_leave' ? 'On-Leave (Off-Duty)' : 'Available (On-Duty)'
              }.`
        );
        setTimeout(() => setToastMessage(null), 6000);
        setSelectedDay(null);
      }
    } catch (err) {
      console.error('Error saving availability:', err);
      alert('Failed to update attendance status. Please try again.');
    } finally {
      setSavingStatus(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#24252c]/[0.06]">
        <div>
          <MonoBadge icon={IconCalendar}>Technician Portal</MonoBadge>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ink)] mt-1.5">
            My Attendance &amp; Availability
          </h1>
          <p className="text-xs text-[#24252c]/60 mt-1">
            Toggle your on-duty availability or file scheduled rest days. Dates with insufficient crew are automatically closed from customer booking.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleToday}
            className="px-3.5 py-2 rounded-full border border-[#24252c]/15 text-xs font-bold text-[var(--ink)] hover:bg-[var(--mist)] transition-colors cursor-pointer shadow-2xs"
          >
            Today
          </button>
          <div className="inline-flex items-center bg-white rounded-full border border-[#24252c]/15 p-1 shadow-2xs">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-full hover:bg-[var(--mist)] text-[var(--ink)] cursor-pointer"
              title="Previous Month"
            >
              ←
            </button>
            <span className="px-3 text-xs font-extrabold text-[var(--ink)] min-w-[130px] text-center">
              {monthYearString}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 rounded-full hover:bg-[var(--mist)] text-[var(--ink)] cursor-pointer"
              title="Next Month"
            >
              →
            </button>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-950 shadow-sm flex items-center justify-between gap-3 animate-fade-in text-xs">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs">
              <IconCheck className="w-3.5 h-3.5" />
            </span>
            <span className="font-semibold">{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-emerald-800 font-bold p-1 cursor-pointer"
          >
            <IconX className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Monthly Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="bg-white rounded-2xl p-4 border border-[#24252c]/[0.08] shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center shrink-0">
            <IconCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-[#24252c]/50 uppercase tracking-wider block">
              Available &amp; On-Duty
            </span>
            <span className="text-xl font-black text-emerald-700">{monthStats.onDuty} Days</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-[#24252c]/[0.08] shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 font-bold flex items-center justify-center shrink-0">
            <IconClock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-[#24252c]/50 uppercase tracking-wider block">
              Filed Leaves / Off-Duty
            </span>
            <span className="text-xl font-black text-amber-800">{monthStats.onLeave} Days</span>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-[#24252c]/[0.08] shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-100 text-[#1090F8] font-bold flex items-center justify-center shrink-0">
            <IconCalendar className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-[#24252c]/50 uppercase tracking-wider block">
              Assigned Event Gigs
            </span>
            <span className="text-xl font-black text-[#1090F8]">{monthStats.assigned} Events</span>
          </div>
        </div>
      </div>

      {/* Calendar Grid Container (Exact Admin Calendar Style) */}
      <div className="bg-white rounded-2xl p-4 sm:p-6 border border-[#24252c]/[0.08] shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#24252c]/[0.06]">
          <div className="flex items-center gap-3 flex-wrap text-xs">
            <span className="flex items-center gap-1.5 text-emerald-700 font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              On-Duty / Available
            </span>
            <span className="flex items-center gap-1.5 text-amber-700 font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              On-Leave / Rest Day
            </span>
            <span className="flex items-center gap-1.5 text-blue-700 font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-[#1090F8]" />
              Assigned to Staging Event
            </span>
          </div>
          <span className="text-[11px] text-[#24252c]/50">
            Click on any date to manage duty status or inspect event production details.
          </span>
        </div>

        {/* Days of Week Header */}
        <div className="overflow-x-auto pb-2 -mx-1 px-1">
          <div className="min-w-[700px] sm:min-w-0">
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2 text-center text-xs font-semibold text-[#24252c]/50 mb-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} className="py-1">{d}</div>
              ))}
            </div>

            {/* Calendar Days Matrix */}
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {calendarDays.map((day, idx) => {
                if (!day.isCurrentMonth) {
                  return (
                    <div
                      key={`empty-${idx}`}
                      className="min-h-[95px] sm:min-h-[110px] rounded-xl bg-transparent"
                    />
                  );
                }

                const isOnLeave = day.myStatus === 'on_leave';
                const isAssigned = day.myStatus === 'assigned';
                const hasBookings = (day.dayBookings && day.dayBookings.length > 0) || false;

                let cellBorder = 'border-[#24252c]/[0.08]';
                let cellBg = 'bg-[var(--mist)]/50';

                if (day.isToday) {
                  cellBorder = 'border-2 border-[#1090F8]';
                  cellBg = 'bg-[#1090F8]/5';
                }

                if (isOnLeave) {
                  cellBg = 'bg-amber-50/90';
                  cellBorder = 'border-amber-300 shadow-xs';
                } else if (isAssigned) {
                  cellBg = 'bg-blue-50/60';
                  cellBorder = 'border-[#1090F8]/40 shadow-xs';
                } else if (hasBookings) {
                  cellBg = day.isPast ? 'bg-zinc-100' : 'bg-white';
                  cellBorder = day.isPast ? 'border-zinc-300' : 'border-[#1090F8]/30 shadow-xs';
                }

                return (
                  <button
                    key={day.dateStr}
                    type="button"
                    onClick={() => handleOpenDayModal(day)}
                    className={`min-h-[95px] sm:min-h-[110px] p-2 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer hover:border-[#1090F8] hover:shadow-md ${cellBg} ${cellBorder}`}
                  >
                    {/* Date Number & Status Header */}
                    <div className="flex items-center justify-between gap-1 w-full">
                      <span
                        className={`text-xs font-extrabold ${
                          day.isToday ? 'text-[#1090F8]' : day.isPast ? 'text-gray-400' : 'text-[var(--ink)]'
                        }`}
                      >
                        {day.dayNumber}
                      </span>

                      {isOnLeave ? (
                        <span className="text-[7.5px] font-extrabold uppercase text-amber-900 bg-amber-200 border border-amber-300 px-1.5 py-0.5 rounded-full shadow-2xs">
                          {day.assignedBooking ? 'Absent (Gig)' : 'Off-Duty'}
                        </span>
                      ) : isAssigned ? (
                        <span className="text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded-full bg-blue-600 text-white shadow-2xs">
                          Assigned
                        </span>
                      ) : hasBookings ? (
                        <span className="text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded-full bg-[#1090F8] text-white">
                          {day.dayBookings?.length} {day.dayBookings?.length === 1 ? 'Event' : 'Events'}
                        </span>
                      ) : (
                        <span className="text-[7.5px] font-bold uppercase text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded">
                          On-Duty
                        </span>
                      )}
                    </div>

                    {/* Events list in the day box */}
                    <div className="space-y-1 mt-1 flex-1 overflow-hidden w-full">
                      {isOnLeave && (
                        <div className="text-[8px] font-bold text-amber-900 bg-amber-200/90 border border-amber-300 rounded px-1.5 py-0.5 truncate mb-1">
                          {day.myReason || 'Off-Duty / Leave'}
                        </div>
                      )}
                      {hasBookings ? (
                        <>
                          {day.dayBookings?.slice(0, 2).map((b, bIdx) => (
                            <div
                              key={bIdx}
                              className={`${
                                isOnLeave ? 'opacity-70 bg-[var(--ink)]' : 'bg-[var(--ink)]'
                              } text-white text-[9px] rounded-md px-1.5 py-1 leading-tight truncate shadow-2xs`}
                            >
                              <div className="font-bold flex items-center justify-between gap-1">
                                <span className="text-sky-300 font-mono text-[8px]">
                                  {formatTimeAmPm(b.start_time || '13:00').slice(0, -3)}
                                </span>
                                <span className="truncate opacity-90">{b.package_name || b.customer_name}</span>
                              </div>
                              <div className="text-[7.5px] text-white/60 truncate mt-0.5">
                                {b.venue_address ? b.venue_address.split(',')[0] : 'Venue'}
                              </div>
                            </div>
                          ))}

                          {day.dayBookings && day.dayBookings.length > 2 && (
                            <div className="text-[8px] font-bold text-center text-purple-700 bg-purple-50 rounded py-0.5">
                              +{day.dayBookings.length - 2} more events...
                            </div>
                          )}
                        </>
                      ) : !isOnLeave && (
                        <div className="text-[8.5px] text-zinc-400 font-medium truncate mt-auto">
                          Available
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Day Attendance & Production Schedule Modal (Exact Admin Style) ── */}
      <ModalOverlay isOpen={Boolean(selectedDay)} onClose={() => setSelectedDay(null)}>
        {selectedDay && (
          <div className="bg-white rounded-[2rem] p-6 sm:p-8 max-w-xl w-full shadow-2xl border border-[#24252c]/10 relative animate-blur-in text-xs max-h-[90vh] overflow-y-auto modal-scroll space-y-4">
            <button
              type="button"
              onClick={() => setSelectedDay(null)}
              className="absolute top-5 right-5 text-[#24252c]/50 hover:text-[var(--ink)] p-1.5 rounded-full hover:bg-[var(--mist)] transition-colors cursor-pointer"
            >
              <IconX className="w-5 h-5" />
            </button>

            {/* Header */}
            <div>
              <span className="text-[10px] font-mono font-extrabold uppercase tracking-widest text-[#1090F8]">
                Technician Schedule &amp; Production Details
              </span>
              <h3 className="text-xl font-extrabold text-[var(--ink)] mt-0.5">
                {formatDisplayDate(selectedDay.dateStr)}
              </h3>
              <p className="text-xs text-[#24252c]/60">
                {selectedDay.dayBookings && selectedDay.dayBookings.length > 0
                  ? `${selectedDay.dayBookings.length} event production(s) scheduled on this date.`
                  : 'No scheduled client events on this date.'}
              </p>
            </div>

            {/* Scheduled Event Bookings Cards (Identical to Admin Calendar Page) */}
            {selectedDay.dayBookings && selectedDay.dayBookings.length > 0 ? (
              <div className="space-y-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#24252c]/50 block">
                  Scheduled Production Events:
                </span>
                {selectedDay.dayBookings.map((b: any) => {
                  const isAssignedToMe = Array.isArray(b.assigned_crew) && b.assigned_crew.some(
                    (c: any) =>
                      c === currentUser?.id ||
                      c === currentUser?.name ||
                      c.id === currentUser?.id ||
                      c.name === currentUser?.name
                  );

                  return (
                    <div
                      key={b.id}
                      className="p-4 rounded-2xl bg-[var(--mist)] border border-[#24252c]/[0.08] space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-extrabold text-[#1090F8] bg-[#1090F8]/10 px-2.5 py-0.5 rounded-full">
                            Event Proper: {formatTimeAmPm(b.start_time || '13:00')} – {formatTimeAmPm(b.end_time || '18:00')}
                          </span>
                          <span className="font-mono text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            Crew Setup Call Time: ~{formatTimeAmPm(calculateCrewArrivalTime(b.start_time || '13:00', bookingSettings.default_turnaround_hours || 3))}
                          </span>
                        </div>
                        <span
                          className={`text-[9px] font-extrabold uppercase px-2.5 py-0.5 rounded-full self-start sm:self-auto ${
                            isAssignedToMe
                              ? 'bg-blue-600 text-white shadow-2xs'
                              : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                          }`}
                        >
                          {isAssignedToMe ? 'Assigned to You' : 'Confirmed Event'}
                        </span>
                      </div>

                      <div>
                        <h4 className="text-sm font-extrabold text-[var(--ink)]">
                          {b.package_name || 'Event Production'}
                        </h4>
                        <p className="text-xs text-[#24252c]/70 mt-1 flex items-center gap-1.5">
                          <IconPin className="w-3.5 h-3.5 text-[#1090F8] shrink-0" />
                          <span>{b.venue_address || 'Private Venue'}</span>
                        </p>
                        <p className="text-[11px] text-[#24252c]/50 mt-1">
                          Host: <strong className="text-[var(--ink)]">{b.customer_name}</strong>
                          {b.paymongo_reference_number ? ` • Ref: ${b.paymongo_reference_number}` : ''}
                        </p>
                      </div>

                      {/* Ingress Staging Notice Box (Admin Exact Style) */}
                      <div className="flex justify-between items-center bg-emerald-50 border border-emerald-200/80 p-2.5 rounded-xl">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-emerald-900 block">
                            Crew Arrival / Setup (Ingress):
                          </span>
                          <span className="text-[11px] text-emerald-800">
                            Binhi crew arrives ~{bookingSettings.default_turnaround_hours || 3}h early for staging &amp; soundcheck
                          </span>
                        </div>
                        <span className="font-mono font-extrabold text-xs text-emerald-950 bg-white px-2 py-1 rounded-lg border border-emerald-300 shrink-0">
                          {formatTimeAmPm(calculateCrewArrivalTime(b.start_time || '13:00', bookingSettings.default_turnaround_hours || 3))}
                        </span>
                      </div>

                      {b.event_description && (
                        <div className="p-2.5 rounded-xl bg-white border border-[#24252c]/[0.06] text-[11px] text-[#24252c]/70 italic">
                          "{b.event_description}"
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-[var(--mist)]/60 border border-[#24252c]/[0.06] text-[#24252c]/60 text-xs flex items-center gap-2">
                <IconClock className="w-4 h-4 text-[#24252c]/40 shrink-0" />
                <span>No client bookings scheduled for this date.</span>
              </div>
            )}

            {/* Past Date Notice */}
            {(() => {
              let daysUntilDate = 999;
              if (selectedDay.dateStr) {
                const eventDateObj = new Date(selectedDay.dateStr);
                const now = new Date();
                now.setHours(0, 0, 0, 0);
                daysUntilDate = Math.ceil((eventDateObj.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              }
              const isPast = daysUntilDate < 0;

              if (isPast) {
                return (
                  <div className="p-3.5 rounded-2xl bg-zinc-100 border border-zinc-200 text-zinc-600 text-xs flex items-center gap-2">
                    <IconClock className="w-4 h-4 text-zinc-400 shrink-0" />
                    <span>Past Date: Historical attendance records cannot be modified.</span>
                  </div>
                );
              }

              return null;
            })()}

            {/* Daily Crew Capacity Breakdown Card */}
            {selectedDay.capacity && (
              <div className="bg-[var(--mist)]/70 rounded-2xl p-3.5 border border-[#24252c]/[0.06] space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-[var(--ink)]">
                  <span>Total Crew Capacity for Date:</span>
                  <span className="text-[#1090F8] font-black">
                    {selectedDay.capacity.availableCrewCount} / {selectedDay.capacity.totalActiveCrew} Available
                  </span>
                </div>
                <div className="text-[11px]">
                  {selectedDay.capacity.isAvailableForBooking ? (
                    <span className="text-emerald-700 font-semibold flex items-center gap-1">
                      <IconCheck className="w-3.5 h-3.5 text-emerald-600" />
                      System is OPEN for client bookings ({selectedDay.capacity.availableCrewCount} active crew available)
                    </span>
                  ) : (
                    <span className="text-rose-700 font-bold flex items-center gap-1">
                      <IconX className="w-3.5 h-3.5 text-rose-600" />
                      System is CLOSED on this date ({selectedDay.capacity.blockReason || 'Date blacked out due to staffing'})
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Attendance & Leave Management Section */}
            {(() => {
              let daysUntilDate = 999;
              if (selectedDay.dateStr) {
                const eventDateObj = new Date(selectedDay.dateStr);
                const now = new Date();
                now.setHours(0, 0, 0, 0);
                daysUntilDate = Math.ceil((eventDateObj.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              }
              const isPast = daysUntilDate < 0;
              const hasBooking = (selectedDay.dayBookings && selectedDay.dayBookings.length > 0) || Boolean(selectedDay.assignedBooking);
              const isNearEvent = daysUntilDate >= 0 && daysUntilDate < 7 && hasBooking;

              if (isPast) return null;

              return (
                <div className="space-y-4 pt-2 border-t border-[#24252c]/[0.06]">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#24252c]/50 block mb-2">
                      Set Attendance / Duty Status:
                    </label>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setEditStatus('available')}
                        className={`p-3 rounded-2xl border text-left transition-all flex items-center gap-2 cursor-pointer ${
                          editStatus === 'available'
                            ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-bold shadow-2xs ring-1 ring-emerald-400/50'
                            : 'bg-white border-[#24252c]/15 text-[#24252c]/60 hover:bg-[var(--mist)]'
                        }`}
                      >
                        <span
                          className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                            editStatus === 'available' ? 'bg-emerald-600 text-white' : 'border border-black/30'
                          }`}
                        >
                          {editStatus === 'available' ? <IconCheck className="w-2.5 h-2.5" /> : null}
                        </span>
                        <span className="text-xs">On-Duty (Available)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setEditStatus('on_leave')}
                        className={`p-3 rounded-2xl border text-left transition-all flex items-center gap-2 cursor-pointer ${
                          editStatus === 'on_leave'
                            ? 'bg-amber-50 border-amber-400 text-amber-950 font-bold shadow-2xs ring-1 ring-amber-400/50'
                            : 'bg-white border-[#24252c]/15 text-[#24252c]/60 hover:bg-[var(--mist)]'
                        }`}
                      >
                        <span
                          className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                            editStatus === 'on_leave' ? 'bg-amber-600 text-white' : 'border border-black/30'
                          }`}
                        >
                          {editStatus === 'on_leave' ? <IconCheck className="w-2.5 h-2.5" /> : null}
                        </span>
                        <span className="text-xs">Off-Duty / Leave</span>
                      </button>
                    </div>
                  </div>

                  {/* Leave Options Container */}
                  {editStatus === 'on_leave' && (
                    <div className="space-y-3.5 p-3.5 rounded-2xl bg-[#F8F9FA] border border-[#24252c]/[0.08] animate-fade-in">
                      {/* Leave Type Selector (Standard vs Emergency) */}
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-[#24252c]/60 block mb-1.5">
                          Leave Classification:
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setLeaveType('standard')}
                            className={`px-3 py-2.5 rounded-xl border text-xs font-bold transition-all text-center cursor-pointer ${
                              leaveType === 'standard'
                                ? 'bg-white border-[var(--ink)] text-[var(--ink)] shadow-xs'
                                : 'bg-transparent border-[#24252c]/15 text-[#24252c]/60 hover:bg-white'
                            }`}
                          >
                            Standard Rest Day
                          </button>
                          <button
                            type="button"
                            onClick={() => setLeaveType('emergency')}
                            className={`px-3 py-2.5 rounded-xl border text-xs font-bold transition-all text-center cursor-pointer ${
                              leaveType === 'emergency'
                                ? 'bg-rose-600 border-rose-600 text-white shadow-xs'
                                : 'bg-transparent border-rose-300 text-rose-700 hover:bg-rose-50'
                            }`}
                          >
                            Emergency / Medical
                          </button>
                        </div>
                      </div>

                      {/* Standard Scheduled Leave Form */}
                      {leaveType === 'standard' && (
                        <div className="space-y-2.5">
                          {isNearEvent ? (
                            <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-xs space-y-1">
                              <div className="flex items-center gap-1.5 font-bold text-amber-900">
                                <IconShield className="w-4 h-4 text-amber-700 shrink-0" />
                                <span>Advance Notice Policy Required</span>
                              </div>
                              <p className="text-[11px] text-amber-900/80 leading-relaxed">
                                Standard rest days require at least 7 days notice when an event is scheduled ({daysUntilDate} days away).
                                If you are sick, injured, or have an emergency, please switch to <strong>Emergency / Medical</strong> above so Operations can assign a substitute technician.
                              </p>
                            </div>
                          ) : (
                            <div>
                              <label className="text-[10px] font-bold uppercase tracking-wider text-[#24252c]/50 block mb-1">
                                Rest Day Reason:
                              </label>
                              <select
                                value={editReason}
                                onChange={(e) => setEditReason(e.target.value)}
                                className="w-full rounded-full border border-black/15 px-4 py-2.5 bg-white text-xs font-semibold text-[var(--ink)] focus:outline-none focus:border-amber-500 cursor-pointer"
                              >
                                <option value="Rest Day / Off-Duty">Rest Day / Scheduled Off-Duty</option>
                                <option value="Personal Leave / Planned Leave">Personal / Planned Day-Off</option>
                                <option value="External Production Assignment">External Production Gig</option>
                                <option value="Others">Others (Custom reason)</option>
                              </select>

                              {editReason === 'Others' && (
                                <input
                                  type="text"
                                  value={customReason}
                                  onChange={(e) => setCustomReason(e.target.value)}
                                  placeholder="Specify reason..."
                                  className="mt-2 w-full rounded-full border border-black/15 px-4 py-2 bg-white text-xs font-medium text-[var(--ink)] focus:outline-none focus:border-amber-500"
                                />
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Emergency / Sickness Form */}
                      {leaveType === 'emergency' && (
                        <div className="space-y-3">
                          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-950 text-xs space-y-1">
                            <div className="flex items-center gap-1.5 font-bold text-rose-800">
                              <IconAlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                              <span>Immediate Emergency Notice</span>
                            </div>
                            <p className="text-[11px] text-rose-900/80 leading-relaxed">
                              Submitting this emergency absence will mark you Off-Duty immediately and alert Admin to assign an on-duty substitute technician to any assigned events.
                            </p>
                          </div>

                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-wider text-[#24252c]/50 block mb-1">
                              Emergency Category:
                            </label>
                            <select
                              value={emergencyCategory}
                              onChange={(e) => setEmergencyCategory(e.target.value as any)}
                              className="w-full rounded-full border border-rose-300 px-4 py-2.5 bg-white text-xs font-bold text-rose-950 focus:outline-none focus:border-rose-600 cursor-pointer"
                            >
                              <option value="sickness">Medical Sickness / Acute Illness / Injury</option>
                              <option value="family">Urgent Family Emergency / Bereavement</option>
                              <option value="accident">Transit Breakdown / Accident / Calamity</option>
                              <option value="other">Other Urgent Unforeseen Emergency</option>
                            </select>
                          </div>

                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-wider text-[#24252c]/50 block mb-1">
                              Handover / Operational Notes (Optional):
                            </label>
                            <textarea
                              rows={2}
                              value={emergencyNotes}
                              onChange={(e) => setEmergencyNotes(e.target.value)}
                              placeholder="e.g., Doctor advised 2 days rest for acute fever. Audio channel list is stored in group drive."
                              className="w-full rounded-2xl border border-black/15 p-3 bg-white text-xs text-[var(--ink)] focus:outline-none focus:border-rose-500"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Modal Actions */}
            {(() => {
              let daysUntilDate = 999;
              if (selectedDay.dateStr) {
                const eventDateObj = new Date(selectedDay.dateStr);
                const now = new Date();
                now.setHours(0, 0, 0, 0);
                daysUntilDate = Math.ceil((eventDateObj.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              }
              const isPast = daysUntilDate < 0;

              return (
                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#24252c]/[0.06]">
                  <button
                    type="button"
                    onClick={() => setSelectedDay(null)}
                    className="px-5 py-2.5 rounded-full border border-black/10 text-xs font-semibold text-[var(--ink)] hover:bg-[#F0F0F0] transition-colors cursor-pointer"
                  >
                    {isPast ? 'Close' : 'Cancel'}
                  </button>
                  {!isPast && (
                    <button
                      type="button"
                      onClick={handleSaveAvailability}
                      disabled={savingStatus}
                      className={`${
                        editStatus === 'on_leave' && leaveType === 'emergency'
                          ? 'bg-rose-600 hover:bg-rose-700'
                          : 'bg-[var(--ink)] hover:bg-[var(--ink-soft)]'
                      } text-white font-semibold px-6 py-2.5 rounded-full transition-colors cursor-pointer text-xs shadow-md flex items-center gap-1.5 disabled:opacity-50`}
                    >
                      {savingStatus ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : editStatus === 'on_leave' && leaveType === 'emergency' ? (
                        'Submit Emergency Leave'
                      ) : (
                        'Save Attendance'
                      )}
                    </button>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </ModalOverlay>
    </div>
  );
}
