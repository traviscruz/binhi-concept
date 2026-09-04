import { useEffect, useState } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import {
  IconCheck,
  IconX,
  IconShield,
  IconSignature,
  IconUser,
  IconClock,
  IconCalendar,
  IconPin,
} from '../../components/shared/icons';
import { ModalOverlay } from '../../components/shared/ModalOverlay';
import { INITIAL_ASSIGNED_BOOKINGS, type AssignedBooking } from '../../data/crewBookings';
import ClientSignOffModal, { type ClientSignOffData } from '../../components/crew/ClientSignOffModal';
import { saveClientSignOff, loadClientSignOff } from '../../utils/signoffService';

export interface SetupStage {
  id: string;
  stepNum: number;
  title: string;
  desc: string;
  completed: boolean;
  completedAt?: string;
}

export default function CrewSetupTeardownPage({ go }: { go: (p: Page) => void }) {
  // Load selected booking ID from sessionStorage
  const [selectedBookingId, setSelectedBookingId] = useState<string>(() => {
    return sessionStorage.getItem('crew_selected_booking_id') || INITIAL_ASSIGNED_BOOKINGS[0].id;
  });

  const booking = INITIAL_ASSIGNED_BOOKINGS.find((b) => b.id === selectedBookingId) || INITIAL_ASSIGNED_BOOKINGS[0];

  // Client digital sign-off state (persisted in Supabase & local cache per booking ID)
  const [signOff, setSignOff] = useState<ClientSignOffData | null>(() => {
    try {
      const saved = localStorage.getItem(`binhi_crew_signoff_${booking.id}`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  });

  const [signOffModalOpen, setSignOffModalOpen] = useState(false);
  const [viewCertificateModal, setViewCertificateModal] = useState(false);
  const [confirmCompleteModal, setConfirmCompleteModal] = useState(false);

  // Sync with Supabase on mount and booking change
  useEffect(() => {
    let isMounted = true;
    loadClientSignOff(booking.id).then((cloudSignOff) => {
      if (isMounted && cloudSignOff) {
        setSignOff(cloudSignOff);
        setStages((prev) =>
          prev.map((st) =>
            st.id === 'st-3' && !st.completed
              ? { ...st, completed: true, completedAt: cloudSignOff.signedAt }
              : st
          )
        );
      }
    });
    return () => {
      isMounted = false;
    };
  }, [booking.id]);

  const getInitialStagesForBooking = (b: AssignedBooking, currentSignOff: ClientSignOffData | null): SetupStage[] => {
    try {
      const saved = localStorage.getItem(`binhi_crew_stages_${b.id}`);
      if (saved) return JSON.parse(saved);
    } catch {}

    if (b.status === 'Teardown Complete') {
      return [
        { id: 'st-1', stepNum: 1, title: 'Warehouse Packing & Dispatch', desc: 'Verify all physical units against packing checklist, load rigging truck, and dispatch from warehouse.', completed: true, completedAt: '08:00 AM' },
        { id: 'st-2', stepNum: 2, title: 'On-Site Stage Rigging & Cable Run', desc: 'Unload gear at venue, position speaker stands, mount LED panels to truss, and lay XLR multi-snake cable runs.', completed: true, completedAt: '10:15 AM' },
        { id: 'st-3', stepNum: 3, title: 'Sound & LED Display Calibration Test', desc: 'Perform pink noise speaker tuning, test wireless mics, calibrate LED video wall brightness, and test low-fog hazer.', completed: true, completedAt: '11:00 AM' },
        { id: 'st-4', stepNum: 4, title: 'Live Event Production Support', desc: 'Standby on-site for live sound mixing, stage light cues, and technical troubleshooting throughout the event duration.', completed: true, completedAt: '06:00 PM' },
        { id: 'st-5', stepNum: 5, title: 'Teardown, Inventory Audit & Return', desc: 'Dismantle stage equipment, pack back into flight cases, audit serial IDs, and return to warehouse shelf storage.', completed: true, completedAt: '08:30 PM' },
      ];
    }

    if (b.status === 'Pending Setup') {
      return [
        { id: 'st-1', stepNum: 1, title: 'Warehouse Packing & Dispatch', desc: 'Verify all physical units against packing checklist, load rigging truck, and dispatch from warehouse.', completed: false },
        { id: 'st-2', stepNum: 2, title: 'On-Site Stage Rigging & Cable Run', desc: 'Unload gear at venue, position speaker stands, mount LED panels to truss, and lay XLR multi-snake cable runs.', completed: false },
        { id: 'st-3', stepNum: 3, title: 'Sound & LED Display Calibration Test', desc: 'Perform pink noise speaker tuning, test wireless mics, calibrate LED video wall brightness, and test low-fog hazer.', completed: Boolean(currentSignOff) },
        { id: 'st-4', stepNum: 4, title: 'Live Event Production Support', desc: 'Standby on-site for live sound mixing, stage light cues, and technical troubleshooting throughout the event duration.', completed: false },
        { id: 'st-5', stepNum: 5, title: 'Teardown, Inventory Audit & Return', desc: 'Dismantle stage equipment, pack back into flight cases, audit serial IDs, and return to warehouse shelf storage.', completed: false },
      ];
    }

    return [
      { id: 'st-1', stepNum: 1, title: 'Warehouse Packing & Dispatch', desc: 'Verify all physical units against packing checklist, load rigging truck, and dispatch from warehouse.', completed: true, completedAt: '07:30 AM' },
      { id: 'st-2', stepNum: 2, title: 'On-Site Stage Rigging & Cable Run', desc: 'Unload gear at venue, position speaker stands, mount LED panels to truss, and lay XLR multi-snake cable runs.', completed: true, completedAt: '09:45 AM' },
      { id: 'st-3', stepNum: 3, title: 'Sound & LED Display Calibration Test', desc: 'Perform pink noise speaker tuning, test wireless mics, calibrate LED video wall brightness, and test low-fog hazer.', completed: Boolean(currentSignOff), completedAt: currentSignOff?.signedAt },
      { id: 'st-4', stepNum: 4, title: 'Live Event Production Support', desc: 'Standby on-site for live sound mixing, stage light cues, and technical troubleshooting throughout the event duration.', completed: false },
      { id: 'st-5', stepNum: 5, title: 'Teardown, Inventory Audit & Return', desc: 'Dismantle stage equipment, pack back into flight cases, audit serial IDs, and return to warehouse shelf storage.', completed: false },
    ];
  };

  const [stages, setStages] = useState<SetupStage[]>(() =>
    getInitialStagesForBooking(booking, signOff)
  );

  // Sync state when booking changes
  const handleSwitchBooking = async (newId: string) => {
    setSelectedBookingId(newId);
    sessionStorage.setItem('crew_selected_booking_id', newId);
    const newBooking = INITIAL_ASSIGNED_BOOKINGS.find((b) => b.id === newId) || INITIAL_ASSIGNED_BOOKINGS[0];

    const currentSignOff = await loadClientSignOff(newBooking.id);
    setSignOff(currentSignOff);
    setStages(getInitialStagesForBooking(newBooking, currentSignOff));
  };

  const toggleStage = (id: string) => {
    setStages((prev) => {
      const updated = prev.map((st) => {
        if (st.id === id) {
          const nextState = !st.completed;
          return {
            ...st,
            completed: nextState,
            completedAt: nextState ? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined,
          };
        }
        return st;
      });
      try {
        localStorage.setItem(`binhi_crew_stages_${booking.id}`, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleSaveSignOff = async (data: ClientSignOffData) => {
    setSignOff(data);
    await saveClientSignOff(booking.id, data);

    // Automatically mark calibration stage as completed with the sign-off timestamp
    setStages((prev) => {
      const updated = prev.map((st) =>
        st.id === 'st-3'
          ? { ...st, completed: true, completedAt: data.signedAt }
          : st
      );
      try {
        localStorage.setItem(`binhi_crew_stages_${booking.id}`, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleClearSignOff = () => {
    if (window.confirm('Are you sure you want to clear the client signature and re-sign?')) {
      setSignOff(null);
      try {
        localStorage.removeItem(`binhi_crew_signoff_${booking.id}`);
      } catch {}
    }
  };

  const completedCount = stages.filter((st) => st.completed).length;
  const progressPct = Math.round((completedCount / stages.length) * 100);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#24252c]/[0.06]">
        <div>
          <button
            onClick={() => go('crew-assigned-bookings')}
            className="text-xs text-[#1090F8] font-bold hover:underline mb-1 inline-block cursor-pointer"
          >
            ← Back to Assigned Bookings
          </button>
          <MonoBadge icon={IconCheck}>Workflow Stage Tracker</MonoBadge>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ink)] mt-1.5">
            Setup & Teardown Stage Tracking
          </h1>
          <p className="text-xs text-[#24252c]/60 mt-1">
            Real-time stage milestones, client ingress sign-off, and warehouse return for{' '}
            <strong className="text-[var(--ink)] font-mono">{booking.id}</strong>.
          </p>
        </div>

        <button
          onClick={() => setConfirmCompleteModal(true)}
          className="bg-emerald-600 text-white text-xs font-bold px-5 py-2.5 rounded-full hover:bg-emerald-700 transition-colors shadow-sm self-start sm:self-auto cursor-pointer"
        >
          Mark All Stages Complete
        </button>
      </div>

      {/* Booking Quick Context Card */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#24252c]/[0.08] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
        <div className="space-y-1.5 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono font-bold text-[#1090F8] bg-[#1090F8]/10 px-2 py-0.5 rounded-md">
              {booking.id}
            </span>
            <span className="font-extrabold text-[var(--ink)] text-sm">{booking.package}</span>
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[var(--mist)] text-[var(--ink)] border border-[#24252c]/10">
              {booking.status}
            </span>
          </div>
          <div className="text-[#24252c]/65 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
            <span>Client / Host: <strong className="text-[var(--ink)]">{booking.customer}</strong></span>
            <span>Venue: <strong className="text-[var(--ink)]">{booking.venue}</strong></span>
            <span>Event Date: <strong className="text-[var(--ink)]">{booking.date}</strong></span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-[#24252c]/10">
          <div className="flex items-center gap-1.5 bg-[var(--mist)] px-3 py-1.5 rounded-xl border border-[#24252c]/10">
            <span className="text-[11px] font-bold text-[#24252c]/60">Assignment:</span>
            <select
              value={booking.id}
              onChange={(e) => handleSwitchBooking(e.target.value)}
              className="bg-transparent text-[var(--ink)] font-extrabold text-xs focus:outline-none cursor-pointer"
            >
              {INITIAL_ASSIGNED_BOOKINGS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.id} — {b.customer}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => go('crew-booking-detail')}
            className="px-3.5 py-2 rounded-xl bg-[var(--mist)] text-[var(--ink)] font-semibold border border-[#24252c]/10 hover:bg-gray-200 transition-colors cursor-pointer"
          >
            Check Gear Specs
          </button>
        </div>
      </div>

      {/* Progress Status Banner */}
      <div className="bg-gradient-to-r from-[var(--ink)] to-[#1090F8] rounded-2xl p-6 text-white shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-mono uppercase tracking-wider opacity-80">Current Event Milestone</div>
          <div className="text-2xl sm:text-3xl font-extrabold mt-0.5">
            {progressPct === 100 ? 'Event Teardown Complete' : `Stage ${completedCount + 1} of ${stages.length} In Progress`}
          </div>
          <div className="text-xs opacity-90 mt-1">
            {completedCount} of {stages.length} workflow steps verified by Lead Tech {booking.leadTechnician}
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/20 text-center shrink-0">
          <div className="text-2xl font-black">{progressPct}%</div>
          <div className="text-[10px] uppercase font-bold tracking-wider opacity-80">Overall Progress</div>
        </div>
      </div>

      {/* CLIENT INGRESS / SOUNDCHECK DIGITAL SIGN-OFF CARD (FEATURE 17) */}
      <div
        className={`rounded-2xl p-6 border transition-all shadow-sm space-y-4 ${
          signOff
            ? 'bg-gradient-to-br from-emerald-500/[0.06] to-white border-emerald-500/30'
            : 'bg-white border-amber-500/30 ring-1 ring-amber-500/20'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-[#24252c]/[0.06]">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span
                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                  signOff
                    ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-700 border border-amber-500/20'
                }`}
              >
                {signOff ? 'Client Sign-Off Verified' : 'Action Required: Client Soundcheck Sign-Off'}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold text-[var(--ink)]">
              Client Ingress / Soundcheck Digital Sign-Off
            </h2>
            <p className="text-xs text-[#24252c]/65 mt-0.5">
              Upon venue setup completion, the client signs on the crew's mobile device to certify that all equipment is fully functional before the event begins.
            </p>
          </div>

          <div className="shrink-0">
            {signOff ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewCertificateModal(true)}
                  className="px-4 py-2 rounded-full bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5"
                >
                  <IconShield className="w-3.5 h-3.5" />
                  <span>View Certificate</span>
                </button>
                <button
                  onClick={() => setSignOffModalOpen(true)}
                  className="px-3 py-2 rounded-full bg-white text-[var(--ink)] text-xs font-semibold border border-[#24252c]/15 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  Re-sign
                </button>
              </div>
            ) : (
              <button
                onClick={() => setSignOffModalOpen(true)}
                className="w-full sm:w-auto px-5 py-3 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-black hover:from-emerald-700 hover:to-teal-700 transition-all shadow-md hover:scale-[1.02] cursor-pointer flex items-center justify-center gap-2"
              >
                <IconSignature className="w-4 h-4" />
                <span>Open Client Sign-Off Pad</span>
              </button>
            )}
          </div>
        </div>

        {/* Sign-Off Details Body */}
        {signOff ? (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 text-xs items-center">
            {/* Signature Preview Box */}
            <div className="md:col-span-4 bg-white p-3.5 rounded-2xl border border-emerald-500/20 shadow-2xs space-y-1.5 text-center">
              <span className="text-[10px] uppercase font-bold text-[#24252c]/50 block">
                Digital Signature on File
              </span>
              <div className="bg-[#f8fafc] rounded-xl p-2 border border-gray-100 flex items-center justify-center h-20">
                <img
                  src={signOff.signatureUrl}
                  alt="Client Signature"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
              <span className="text-[10px] text-emerald-700 font-mono block">
                Secured via Crew Mobile Terminal
              </span>
            </div>

            {/* Metadata and Signer Info */}
            <div className="md:col-span-8 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div className="p-2.5 rounded-xl bg-white border border-[#24252c]/[0.06]">
                  <span className="text-[10px] text-[#24252c]/50 block font-semibold">Authorized Signer</span>
                  <span className="font-extrabold text-[var(--ink)] block truncate">{signOff.clientName}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-white border border-[#24252c]/[0.06]">
                  <span className="text-[10px] text-[#24252c]/50 block font-semibold">Signer Role</span>
                  <span className="font-bold text-[#1090F8] block truncate">{signOff.signerRole}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-white border border-[#24252c]/[0.06]">
                  <span className="text-[10px] text-[#24252c]/50 block font-semibold">Signed Timestamp</span>
                  <span className="font-bold text-emerald-700 block truncate">{signOff.signedAt}</span>
                </div>
              </div>

              {/* Verified Checklist Badges */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-800 border border-emerald-500/20 flex items-center gap-1">
                  <IconCheck className="w-3 h-3 text-emerald-600" />
                  <span>Soundcheck Approved</span>
                </span>
                <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-800 border border-emerald-500/20 flex items-center gap-1">
                  <IconCheck className="w-3 h-3 text-emerald-600" />
                  <span>LED & Lighting Responsive</span>
                </span>
                <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-800 border border-emerald-500/20 flex items-center gap-1">
                  <IconCheck className="w-3 h-3 text-emerald-600" />
                  <span>Rigging & Cabling Safe</span>
                </span>
              </div>

              {signOff.notes && (
                <div className="p-2.5 rounded-xl bg-white/80 border border-[#24252c]/[0.06] text-[11px] text-[#24252c]/80">
                  <strong>Client Note:</strong> "{signOff.notes}"
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3.5 p-4 rounded-xl bg-amber-500/[0.08] border border-amber-500/20 text-xs text-amber-950">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-800 flex items-center justify-center font-bold text-lg shrink-0">
              <IconSignature className="w-4 h-4 text-amber-800" />
            </div>
            <div className="space-y-0.5">
              <strong className="block font-extrabold">Ready for Ingress Testing & Sign-off</strong>
              <p className="text-[#24252c]/75 leading-relaxed">
                After completing speaker tuning, wireless mic soundcheck, and LED wall testing, tap &ldquo;Open Client Sign-Off Pad&rdquo; above and hand this device to{' '}
                <strong>{booking.customer}</strong> to sign the digital equipment acceptance form.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Interactive Setup Stages List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs px-1">
          <span className="font-extrabold text-[#24252c]/70 uppercase tracking-wider">
            Operational Stages Checklist
          </span>
          <span className="text-[#24252c]/50">
            Tap 'Mark Stage Done' to toggle individual milestones
          </span>
        </div>

        {stages.map((st) => (
          <div
            key={st.id}
            className={`p-5 rounded-2xl border transition-all ${
              st.completed
                ? 'bg-emerald-500/[0.04] border-emerald-500/30'
                : 'bg-white border-[#24252c]/[0.08] shadow-sm hover:border-[#1090F8]/40'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                <div
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 ${
                    st.completed
                      ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                      : 'bg-[var(--mist)] text-[var(--ink)] border border-[#24252c]/10'
                  }`}
                >
                  0{st.stepNum}
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[var(--mist)] text-[var(--ink)]">
                      Step {st.stepNum}
                    </span>
                    <h3 className="font-extrabold text-base text-[var(--ink)]">{st.title}</h3>
                    {st.completedAt && (
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        Logged at {st.completedAt}
                      </span>
                    )}
                    {st.id === 'st-3' && signOff && (
                      <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                        Client Signed
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#24252c]/65 mt-1 leading-relaxed">{st.desc}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => toggleStage(st.id)}
                  className={`w-full sm:w-auto text-xs font-extrabold px-5 py-2.5 rounded-full border transition-all shrink-0 cursor-pointer ${
                    st.completed
                      ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 shadow-sm'
                      : 'bg-white text-[var(--ink)] border-[#24252c]/15 hover:border-[#1090F8] hover:text-[#1090F8]'
                  }`}
                >
                  {st.completed ? 'Completed' : 'Mark Stage Done'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Confirmation Modal for Marking All Stages Complete */}
      <ModalOverlay isOpen={confirmCompleteModal} onClose={() => setConfirmCompleteModal(false)}>
        <div className="bg-white rounded-[2rem] p-6 max-w-md w-full shadow-2xl border border-[#24252c]/10 relative text-center">
          <button
            onClick={() => setConfirmCompleteModal(false)}
            className="absolute top-5 right-5 text-[#24252c]/50 hover:text-[var(--ink)] p-1 cursor-pointer"
          >
            <IconX className="w-5 h-5" />
          </button>
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 font-extrabold text-xl flex items-center justify-center mx-auto mb-3 border border-emerald-200">
            <IconCheck className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-extrabold text-[var(--ink)] mb-1">Mark Event Complete?</h3>
          <p className="text-xs text-[#24252c]/60 mb-5">
            This will mark all 5 setup & teardown stages as complete and update inventory status back to warehouse storage.
          </p>

          <div className="flex items-center gap-3 text-xs">
            <button
              onClick={() => setConfirmCompleteModal(false)}
              className="flex-1 bg-[var(--mist)] text-[var(--ink)] font-semibold py-3 rounded-full border border-[#24252c]/10 hover:bg-[var(--ink)] hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                setStages((prev) => prev.map((s) => ({ ...s, completed: true })));
                setConfirmCompleteModal(false);
              }}
              className="flex-1 bg-emerald-600 text-white font-semibold py-3 rounded-full hover:bg-emerald-700 transition-colors shadow-md cursor-pointer"
            >
              Yes, Complete Event
            </button>
          </div>
        </div>
      </ModalOverlay>

      {/* VIEW CERTIFICATE MODAL */}
      {signOff && (
        <ModalOverlay isOpen={viewCertificateModal} onClose={() => setViewCertificateModal(false)}>
          <div className="bg-white rounded-[2rem] max-w-lg w-full shadow-2xl border border-[#24252c]/10 p-6 relative space-y-4">
            <div className="flex items-start justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
                  <IconShield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-[var(--ink)]">
                    Ingress Acceptance Certificate
                  </h3>
                  <span className="text-[10px] text-gray-500 font-mono block">
                    Ref: SIG-{booking.id}-VERIFIED
                  </span>
                </div>
              </div>
              <button
                onClick={() => setViewCertificateModal(false)}
                className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-500 hover:text-black cursor-pointer"
              >
                <IconX className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 bg-[var(--mist)] rounded-2xl space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Booking ID:</span>
                <span className="font-mono font-bold text-[#1090F8]">{booking.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Event Venue:</span>
                <span className="font-bold text-right">{booking.venue}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Client Signer:</span>
                <span className="font-bold">{signOff.clientName} ({signOff.signerRole})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Timestamp:</span>
                <span className="font-bold text-emerald-700">{signOff.signedAt}</span>
              </div>
            </div>

            {/* Signature image */}
            <div className="border border-gray-200 rounded-2xl p-4 bg-[#fafafa] text-center space-y-2">
              <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">
                Authorized Client Signature
              </span>
              <img
                src={signOff.signatureUrl}
                alt="Signature Certificate"
                className="h-20 mx-auto object-contain"
              />
              <span className="text-[10px] text-gray-400 font-mono block">
                Signed electronically on mobile device
              </span>
            </div>

            {/* Checked items */}
            <div className="space-y-1.5 text-xs">
              <span className="text-[11px] font-bold text-gray-600 uppercase tracking-wider block">
                Confirmed Checks:
              </span>
              {signOff.verifiedItems.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2 text-gray-700 text-[11px]">
                  <IconCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>{item}</span>
                </div>
              ))}
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-gray-100">
              <button
                onClick={handleClearSignOff}
                className="text-xs text-rose-600 hover:text-rose-700 font-semibold cursor-pointer"
              >
                Clear & Re-sign
              </button>
              <button
                onClick={() => setViewCertificateModal(false)}
                className="px-5 py-2 rounded-full bg-[var(--ink)] text-white text-xs font-bold hover:bg-gray-800 transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* Interactive Client Sign-Off Modal Pad */}
      <ClientSignOffModal
        isOpen={signOffModalOpen}
        onClose={() => setSignOffModalOpen(false)}
        bookingId={booking.id}
        defaultClientName={booking.customer}
        venueName={booking.venue}
        packageName={booking.package}
        onSaveSignOff={handleSaveSignOff}
      />
    </div>
  );
}
