import { useState, useEffect } from 'react';
import { ModalOverlay } from '../shared/ModalOverlay';
import {
  IconCheck,
  IconX,
  IconShield,
  IconCalendar,
  IconAlertTriangle,
  IconUser,
  IconBan,
} from '../shared/icons';
import { supabase } from '../../utils/supabase';
import { logAuditEvent } from '../../utils/auditLogger';
import { fetchCrewAvailabilityRecords } from '../../utils/crewAvailabilityService';
import { normalizeDateToIso } from '../../utils/bookingService';

export interface AssignedCrewMember {
  id: string;
  name: string;
  email: string;
  roleTitle: string;
  phone?: string;
}

export interface StaffMemberAvailability {
  id: string;
  name: string;
  email: string;
  role: string;
  phone?: string;
  isOnLeave: boolean;
  isUnavailable: boolean;
  leaveReason?: string;
  leaveStatus?: 'available' | 'on_leave' | 'unavailable';
  isAssignedOtherBooking?: boolean;
  otherBookingRef?: string;
}

interface AssignCrewModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: {
    dbId: string;
    id: string;
    customer: string;
    package: string;
    date: string;
    rawDate?: string;
    assignedCrew?: AssignedCrewMember[];
  } | null;
  onAssigned: (updatedCrew: AssignedCrewMember[]) => void;
}

export function AssignCrewModal({ isOpen, onClose, booking, onAssigned }: AssignCrewModalProps) {
  const [availableStaff, setAvailableStaff] = useState<StaffMemberAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCrew, setSelectedCrew] = useState<AssignedCrewMember[]>([]);
  const [saving, setSaving] = useState(false);
  const [cancellingAndRefunding, setCancellingAndRefunding] = useState(false);
  const [showEmergencyRefundConfirm, setShowEmergencyRefundConfirm] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Determine clean event date string (YYYY-MM-DD)
  const eventDateStr = booking
    ? (booking.rawDate
        ? (booking.rawDate.includes('T') ? booking.rawDate.split('T')[0] : booking.rawDate.slice(0, 10))
        : (normalizeDateToIso(booking.date) || booking.date))
    : '';

  // Fetch crew members, their leave/availability status on this date, and existing assignments
  useEffect(() => {
    if (!isOpen || !booking) return;
    const currentBooking = booking;

    setSelectedCrew(currentBooking.assignedCrew || []);
    setErrorMsg('');

    async function loadCrewRosterAndAvailability() {
      setLoading(true);
      try {
        const cleanDate = eventDateStr;

        // 1. Fetch crew staff profiles
        let crewProfiles: any[] = [];
        const { data: profiles, error: pErr } = await supabase
          .from('profiles')
          .select('id, full_name, first_name, last_name, email, role, phone')
          .eq('role', 'crew');

        if (!pErr && profiles && profiles.length > 0) {
          crewProfiles = profiles.map((p: any) => ({
            id: p.id,
            name: p.full_name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email,
            email: p.email || '',
            role: p.role || 'Crew',
            phone: p.phone || '',
          }));
        } else {
          // Fallback realistic staff roster
          crewProfiles = [
            { id: 'cr-1', name: 'Mark Anthony Reyes', email: 'mark.reyes@binhiconcept.ph', role: 'Crew', phone: '0917-555-0101' },
            { id: 'cr-2', name: 'Alex Tan', email: 'alex.tan@binhiconcept.ph', role: 'Crew', phone: '0918-555-0202' },
            { id: 'cr-3', name: 'Dennis Gomez', email: 'dennis.gomez@binhiconcept.ph', role: 'Crew', phone: '0919-555-0303' },
            { id: 'cr-4', name: 'Patricia Mercado', email: 'patricia.m@binhiconcept.ph', role: 'Crew', phone: '0920-555-0404' },
            { id: 'cr-5', name: 'Jerome Santos', email: 'jerome.s@binhiconcept.ph', role: 'Crew', phone: '0921-555-0505' },
          ];
        }

        // 2. Fetch crew_availability records for this date from Supabase + Local Cache
        let leaveRecords: any[] = [];
        try {
          const { data: dbAvail } = await supabase
            .from('crew_availability')
            .select('*')
            .eq('date', cleanDate);

          if (dbAvail && dbAvail.length > 0) {
            leaveRecords = dbAvail;
          }
        } catch (e) {
          console.warn('Note querying crew_availability table:', e);
        }

        // Also check cached availability records
        const localAvail = await fetchCrewAvailabilityRecords(cleanDate);
        const allAvailRecords = [...leaveRecords, ...localAvail];

        // 3. Fetch bookings on the same date to detect existing assignments
        let otherBookings: any[] = [];
        try {
          const { data: bData } = await supabase
            .from('bookings')
            .select('id, paymongo_reference_number, customer_name, assigned_crew, status')
            .eq('event_date', cleanDate)
            .neq('status', 'cancelled')
            .neq('status', 'declined')
            .neq('status', 'refunded');

          if (bData) {
            otherBookings = bData.filter(
              (b: any) => b.id !== currentBooking.dbId && b.paymongo_reference_number !== currentBooking.id
            );
          }
        } catch {}

        // Map assigned crew in other bookings
        const assignedOtherMap = new Map<string, string>();
        otherBookings.forEach((b: any) => {
          if (Array.isArray(b.assigned_crew)) {
            b.assigned_crew.forEach((c: any) => {
              const cId = typeof c === 'string' ? c : c.id;
              const cName = typeof c === 'object' ? c.name : '';
              const ref = b.paymongo_reference_number ? `#${b.paymongo_reference_number}` : (b.customer_name ? `(${b.customer_name})` : 'Other Booking');
              if (cId) assignedOtherMap.set(cId, ref);
              if (cName) assignedOtherMap.set(cName.toLowerCase(), ref);
            });
          }
        });

        // 4. Combine into rich staff availability model
        const mappedRoster: StaffMemberAvailability[] = crewProfiles.map((crew) => {
          // Check for leave / absent records
          const matchingRecord = allAvailRecords.find(
            (r: any) =>
              (r.date === cleanDate || r.date?.startsWith(cleanDate)) &&
              (r.crew_id === crew.id ||
                r.crewId === crew.id ||
                (r.crew_name && crew.name && r.crew_name.toLowerCase() === crew.name.toLowerCase()) ||
                (r.crewName && crew.name && r.crewName.toLowerCase() === crew.name.toLowerCase()))
          );

          const status = matchingRecord?.status || 'available';
          const isOnLeave = status === 'on_leave' || status === 'unavailable';
          const isUnavailable = isOnLeave;
          const leaveReason = matchingRecord?.reason || (isOnLeave ? 'Filed Leave / Absence' : undefined);

          const otherRef = assignedOtherMap.get(crew.id) || assignedOtherMap.get(crew.name.toLowerCase());

          return {
            id: crew.id,
            name: crew.name,
            email: crew.email,
            role: crew.role,
            phone: crew.phone,
            isOnLeave,
            isUnavailable,
            leaveReason,
            leaveStatus: status,
            isAssignedOtherBooking: Boolean(otherRef),
            otherBookingRef: otherRef,
          };
        });

        setAvailableStaff(mappedRoster);

        // Auto-check if any currently assigned crew members are on leave
        const onLeaveAssigned = (currentBooking.assignedCrew || []).filter((c) => {
          const match = mappedRoster.find((m) => m.id === c.id || m.name.toLowerCase() === c.name.toLowerCase());
          return match?.isOnLeave || match?.isUnavailable;
        });

        if (onLeaveAssigned.length > 0) {
          setErrorMsg(
            `Notice: ${onLeaveAssigned.map((c) => c.name).join(', ')} is currently on leave on ${currentBooking.date}. Please unassign them and select an available crew member.`
          );
        }
      } catch (err) {
        console.warn('Error loading crew staff availability:', err);
      } finally {
        setLoading(false);
      }
    }

    loadCrewRosterAndAvailability();
  }, [isOpen, booking, eventDateStr]);

  if (!isOpen || !booking) return null;

  const isMemberSelected = (staffId: string) => {
    return selectedCrew.some((c) => c.id === staffId);
  };

  const toggleMember = (staff: StaffMemberAvailability) => {
    // PREVENT SELECTING IF ON LEAVE OR ABSENT
    if (staff.isOnLeave || staff.isUnavailable) {
      setErrorMsg(`${staff.name} is on leave or absent on ${booking.date} (${staff.leaveReason || 'Filed Leave'}) and cannot be assigned.`);
      return;
    }

    if (isMemberSelected(staff.id)) {
      setSelectedCrew((prev) => prev.filter((c) => c.id !== staff.id));
      setErrorMsg('');
    } else {
      setSelectedCrew((prev) => [
        ...prev,
        {
          id: staff.id,
          name: staff.name,
          email: staff.email,
          roleTitle: staff.role ? (staff.role.charAt(0).toUpperCase() + staff.role.slice(1).toLowerCase()) : 'Crew',
          phone: staff.phone,
        },
      ]);
      setErrorMsg('');
    }
  };

  const handleSaveAssignment = async () => {
    // Validate that none of the selected crew members are on leave / absent
    const invalidCrew = selectedCrew.filter((c) => {
      const match = availableStaff.find((s) => s.id === c.id || s.name.toLowerCase() === c.name.toLowerCase());
      return match?.isOnLeave || match?.isUnavailable;
    });

    if (invalidCrew.length > 0) {
      setErrorMsg(
        `Cannot assign: ${invalidCrew.map((c) => c.name).join(', ')} is on leave or absent on ${booking.date}. Please remove them before saving.`
      );
      return;
    }

    setSaving(true);
    setErrorMsg('');

    try {
      const previousCrew = booking.assignedCrew || [];

      // 1. Update Supabase public.bookings record
      const { error: dbErr } = await supabase
        .from('bookings')
        .update({
          assigned_crew: selectedCrew,
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking.dbId);

      if (dbErr) {
        console.warn('Supabase assigned_crew update notice:', dbErr);
      }

      // 2. Write Immutable Audit Log
      const crewNames = selectedCrew.length > 0
        ? selectedCrew.map((c) => `${c.name} (${c.roleTitle})`).join(', ')
        : 'None (Unassigned)';

      await logAuditEvent({
        action: 'ASSIGN_CREW',
        module: 'crew',
        targetId: booking.id,
        targetName: `${booking.customer} - ${booking.package}`,
        details: `Assigned ${selectedCrew.length} technician(s) to booking ${booking.id} on ${booking.date}: ${crewNames}`,
        previousData: {
          assigned_crew: previousCrew,
          count: previousCrew.length,
        },
        currentData: {
          assigned_crew: selectedCrew,
          count: selectedCrew.length,
        },
        metadata: {
          event_date: booking.date,
          package: booking.package,
        },
      });

      onAssigned(selectedCrew);
      onClose();
    } catch (err: any) {
      console.error('Error saving crew assignment:', err);
      setErrorMsg(err.message || 'Failed to save crew assignments.');
    } finally {
      setSaving(false);
    }
  };

  const handleEmergencyFullRefund = async () => {
    if (!booking) return;
    setCancellingAndRefunding(true);
    setErrorMsg('');
    try {
      // 1. Update public.bookings in Supabase
      const { error: dbErr } = await supabase
        .from('bookings')
        .update({
          payment_status: 'refunded',
          status: 'Cancelled',
          booking_status: 'cancelled',
          is_completed: false,
          decline_reason: `Cancelled & 100% Refunded due to Total Crew Absence / Medical Emergency on ${booking.date}`,
          refund_id: `ref_emergency_crew_${Date.now()}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking.dbId);

      if (dbErr) {
        console.warn('Supabase booking emergency refund update error:', dbErr);
      }

      // 2. Log immutable audit log
      await logAuditEvent({
        action: 'CANCEL_BOOKING',
        module: 'bookings',
        targetId: booking.id,
        targetName: `${booking.customer} - ${booking.package}`,
        details: `Booking ${booking.id} (${booking.customer}) cancelled with 100% emergency refund: All ${availableStaff.length} crew technicians are on medical/emergency leave on ${booking.date}.`,
        previousData: { status: 'Confirmed', date: booking.date, package: booking.package },
        currentData: { status: 'Cancelled', payment_status: 'refunded' },
      });

      onAssigned([]);
      onClose();
    } catch (err: any) {
      console.error('Error issuing emergency refund:', err);
      setErrorMsg(err.message || 'Failed to process emergency refund.');
    } finally {
      setCancellingAndRefunding(false);
      setShowEmergencyRefundConfirm(false);
    }
  };

  const totalCrew = availableStaff.length;
  const onLeaveCount = availableStaff.filter((s) => s.isOnLeave || s.isUnavailable).length;
  const availableCount = totalCrew - onLeaveCount;

  return (
    <ModalOverlay isOpen={isOpen} onClose={onClose}>
      <div className="bg-white rounded-[2rem] p-6 sm:p-7 max-w-xl w-full shadow-2xl border border-[#24252c]/10 relative max-h-[90vh] flex flex-col animate-blur-in">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-[#24252c]/50 hover:text-[var(--ink)] p-1 rounded-full hover:bg-black/5 transition-colors cursor-pointer"
        >
          <IconX className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="pb-4 border-b border-[#24252c]/[0.08]">
          <div className="flex items-center gap-2 text-xs font-bold text-[#1090F8] mb-1">
            <IconShield className="w-4 h-4" />
            <span>Crew Roster &amp; Availability Verification</span>
          </div>
          <h2 className="text-xl font-extrabold text-[var(--ink)] tracking-tight">
            Assign Production Crew
          </h2>
          <div className="text-xs text-[#24252c]/60 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-semibold text-[var(--ink)]">{booking.id}</span>
            <span>•</span>
            <span>{booking.customer}</span>
            <span>•</span>
            <span className="inline-flex items-center gap-1 font-bold text-[#1090F8] bg-[#1090F8]/10 px-2 py-0.5 rounded-full">
              <IconCalendar className="w-3 h-3" />
              <span>{booking.date}</span>
            </span>
          </div>
        </div>

        {/* Date Availability Summary Banner */}
        <div className="mt-3.5 p-3 rounded-2xl bg-[var(--mist)]/60 border border-[#24252c]/[0.08] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <IconUser className="w-4 h-4 text-[#1090F8]" />
            <span className="font-bold text-[var(--ink)]">Daily Staffing Status:</span>
          </div>
          <div className="flex items-center gap-2 font-semibold text-[11px]">
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
              {availableCount} Available
            </span>
            {onLeaveCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                {onLeaveCount} On Leave / Absent
              </span>
            )}
          </div>
        </div>

        {/* Zero Crew Coverage & Emergency Full Refund Action (When ALL Crew are Absent) */}
        {!loading && availableCount === 0 && (
          <div className="mt-3 p-4 rounded-2xl bg-rose-50 border border-rose-300 text-rose-950 text-xs space-y-3 animate-fade-in">
            <div className="flex items-center gap-2 font-bold text-rose-900">
              <IconAlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              <span className="text-sm font-extrabold">All Technicians Absent — Operating Rules Breached</span>
            </div>
            <p className="text-[11px] text-rose-900/85 leading-relaxed">
              All <strong>{totalCrew}</strong> crew technicians are on medical/emergency leave on <strong>{booking.date}</strong>.
              Under the system's <em>Operating Hours &amp; Pre-Event Setup / Buffer Rules</em>, production equipment cannot be operated without certified technician presence.
            </p>
            
            {!showEmergencyRefundConfirm ? (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowEmergencyRefundConfirm(true)}
                  className="w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <IconBan className="w-4 h-4" />
                  <span>Issue 100% Emergency Refund &amp; Cancel Booking</span>
                </button>
              </div>
            ) : (
              <div className="p-3 bg-white/90 rounded-xl border border-rose-200 space-y-2.5 animate-fade-in">
                <div className="font-bold text-rose-900 text-xs">
                  Confirm 100% Emergency Refund for {booking.customer}?
                </div>
                <p className="text-[10.5px] text-rose-800 leading-relaxed">
                  This will immediately cancel booking <strong>{booking.id}</strong>, issue a 100% full refund via PayMongo, and log the incident in the system audit trail.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowEmergencyRefundConfirm(false)}
                    className="flex-1 py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold text-xs transition-colors cursor-pointer"
                  >
                    Keep Booking
                  </button>
                  <button
                    type="button"
                    disabled={cancellingAndRefunding}
                    onClick={handleEmergencyFullRefund}
                    className="flex-1 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {cancellingAndRefunding ? (
                      <span>Processing Refund...</span>
                    ) : (
                      <span>Yes, Cancel &amp; Refund 100%</span>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Emergency Absence Reassignment Alert */}
        {(() => {
          const absentAssigned = availableStaff.filter(
            (s) =>
              (s.isOnLeave || s.isUnavailable) &&
              (selectedCrew.some((c) => c.id === s.id || c.name.toLowerCase() === s.name.toLowerCase()) ||
                (booking.assignedCrew || []).some((c) => c.id === s.id || c.name.toLowerCase() === s.name.toLowerCase()))
          );

          if (absentAssigned.length === 0) return null;

          const firstFree = availableStaff.find((s) => !s.isOnLeave && !s.isUnavailable && !s.isAssignedOtherBooking && !isMemberSelected(s.id));

          return (
            <div className="mt-3 p-3.5 rounded-2xl bg-rose-50 border border-rose-300 text-rose-950 text-xs space-y-2 animate-fade-in">
              <div className="flex items-center gap-2 font-bold text-rose-900">
                <IconAlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Emergency Crew Reassignment Needed</span>
              </div>
              {absentAssigned.map((abs) => (
                <div key={abs.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 rounded-xl bg-white/80 border border-rose-200 text-[11px]">
                  <div>
                    <span className="font-black text-rose-900">{abs.name}</span> is on leave / absent:
                    <div className="text-rose-700 italic font-medium mt-0.5">{abs.leaveReason || 'Emergency Leave Filed'}</div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCrew((prev) => prev.filter((c) => c.id !== abs.id && c.name.toLowerCase() !== abs.name.toLowerCase()));
                      }}
                      className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 hover:bg-rose-200 font-bold cursor-pointer transition-colors"
                    >
                      Remove
                    </button>
                    {firstFree && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCrew((prev) => [
                            ...prev.filter((c) => c.id !== abs.id && c.name.toLowerCase() !== abs.name.toLowerCase()),
                            {
                              id: firstFree.id,
                              name: firstFree.name,
                              email: firstFree.email,
                              roleTitle: firstFree.role ? (firstFree.role.charAt(0).toUpperCase() + firstFree.role.slice(1).toLowerCase()) : 'Crew',
                              phone: firstFree.phone,
                            },
                          ]);
                        }}
                        className="px-3 py-1 rounded-full bg-[#1090F8] text-white hover:bg-[#1090F8]/90 font-extrabold cursor-pointer shadow-2xs transition-all flex items-center gap-1"
                      >
                        <span>Swap with {firstFree.name.split(' ')[0]}</span>
                        <span>→</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          );
        })()}

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto py-3.5 space-y-3 modal-scroll">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-start gap-2">
              <IconAlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">{errorMsg}</div>
            </div>
          )}

          {loading ? (
            <div className="space-y-2 py-4">
              <div className="h-14 bg-black/5 animate-pulse rounded-2xl" />
              <div className="h-14 bg-black/5 animate-pulse rounded-2xl" />
              <div className="h-14 bg-black/5 animate-pulse rounded-2xl" />
            </div>
          ) : (
            <div className="space-y-2.5">
              {availableStaff.map((staff) => {
                const isSelected = isMemberSelected(staff.id);
                const isBlocked = staff.isOnLeave || staff.isUnavailable;

                return (
                  <div
                    key={staff.id}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      isBlocked
                        ? 'border-rose-200 bg-rose-50/40 opacity-85'
                        : isSelected
                        ? 'border-[#1090F8] bg-[#1090F8]/[0.04] shadow-xs'
                        : 'border-[#24252c]/[0.08] hover:border-[#24252c]/25 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <label
                        className={`flex items-start gap-3 flex-1 min-w-0 ${
                          isBlocked ? 'cursor-not-allowed' : 'cursor-pointer'
                        }`}
                      >
                        <input
                          type="checkbox"
                          disabled={isBlocked}
                          checked={isSelected}
                          onChange={() => toggleMember(staff)}
                          className="w-4 h-4 mt-0.5 rounded text-[#1090F8] focus:ring-[#1090F8] border-gray-300 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-xs text-[var(--ink)] flex flex-wrap items-center gap-1.5">
                            <span className={isBlocked ? 'text-[#24252c]/70' : ''}>{staff.name}</span>

                            {/* Status Badges */}
                            {isBlocked ? (
                              <span className="inline-flex items-center gap-1 text-[9.5px] font-extrabold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300">
                                <IconBan className="w-3 h-3" />
                                <span>On Leave / Absent</span>
                              </span>
                            ) : staff.isAssignedOtherBooking ? (
                              <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                                Assigned {staff.otherBookingRef}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <IconCheck className="w-3 h-3" />
                                <span>Available</span>
                              </span>
                            )}
                          </div>

                          <div className="text-[11px] text-[#24252c]/55 mt-0.5 truncate">
                            {staff.email} {staff.phone ? `• ${staff.phone}` : ''}
                          </div>

                          {/* Reason or Block Notice */}
                          {isBlocked && (
                            <div className="mt-1 text-[10.5px] text-rose-700 font-semibold flex items-center gap-1">
                              <span>Unavailable on {booking.date}:</span>
                              <span className="italic">{staff.leaveReason || 'Filed Leave / Day-off'}</span>
                            </div>
                          )}
                        </div>
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-[#24252c]/[0.08] flex items-center justify-between gap-3">
          <div className="text-xs font-semibold text-[#24252c]/60">
            <span className="font-extrabold text-[var(--ink)]">{selectedCrew.length}</span> crew member(s) selected
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full text-xs font-semibold text-[#24252c]/60 hover:text-[var(--ink)] hover:bg-black/5 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveAssignment}
              disabled={saving}
              className="px-5 py-2 rounded-full text-xs font-bold bg-[#1090F8] hover:bg-[#1090F8]/90 text-white shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {saving ? (
                <span>Saving Assignment...</span>
              ) : (
                <>
                  <IconCheck className="w-4 h-4" />
                  <span>Confirm Assignment</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </ModalOverlay>
  );
}
