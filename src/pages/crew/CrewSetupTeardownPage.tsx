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
import type { AssignedBooking } from '../../data/crewBookings';
import ClientSignOffModal, { type ClientSignOffData } from '../../components/crew/ClientSignOffModal';
import { saveClientSignOff, loadClientSignOff } from '../../utils/signoffService';
import { fetchAssignedBookingsForCurrentCrew } from '../../utils/crewService';
import {
  loadBookingWorkflowStages,
  saveBookingWorkflowStages,
  type SetupStage,
} from '../../utils/workflowStageService';

export default function CrewSetupTeardownPage({ go }: { go: (p: Page) => void }) {
  const [bookingsList, setBookingsList] = useState<AssignedBooking[]>([]);
  const [loading, setLoading] = useState(true);

  // Load selected booking ID from sessionStorage
  const [selectedBookingId, setSelectedBookingId] = useState<string>(() => {
    return sessionStorage.getItem('crew_selected_booking_id') || '';
  });

  const [booking, setBooking] = useState<AssignedBooking | null>(null);
  const [signOff, setSignOff] = useState<ClientSignOffData | null>(null);

  const [signOffModalOpen, setSignOffModalOpen] = useState(false);
  const [viewCertificateModal, setViewCertificateModal] = useState(false);
  const [confirmCompleteModal, setConfirmCompleteModal] = useState(false);
  const [syncToast, setSyncToast] = useState<string | null>(null);

  const [stages, setStages] = useState<SetupStage[]>([]);

  // Sync with Supabase on mount and booking change
  useEffect(() => {
    let isMounted = true;

    async function initPage() {
      setLoading(true);
      try {
        const { bookings } = await fetchAssignedBookingsForCurrentCrew();
        if (!isMounted) return;
        setBookingsList(bookings);

        let activeId = selectedBookingId;
        let activeBooking = bookings.find((b) => b.id === activeId);

        if (!activeBooking && bookings.length > 0) {
          activeBooking = bookings[0];
          activeId = activeBooking.id;
          setSelectedBookingId(activeId);
          sessionStorage.setItem('crew_selected_booking_id', activeId);
        }

        if (activeBooking) {
          setBooking(activeBooking);
          const cloudSignOff = await loadClientSignOff(activeBooking.id);
          if (isMounted) {
            setSignOff(cloudSignOff);
            // Load real-time workflow stages from Supabase database
            const { stages: dbStages, status: dbStatus } = await loadBookingWorkflowStages(
              activeBooking.id,
              cloudSignOff
            );
            setStages(dbStages);
            setBooking((prev) => (prev ? { ...prev, status: dbStatus as any } : null));
          }
        }
      } catch (err) {
        console.error('Error in CrewSetupTeardownPage init:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    initPage();

    return () => {
      isMounted = false;
    };
  }, []);

  // Sync state when booking changes
  const handleSwitchBooking = async (newId: string) => {
    setSelectedBookingId(newId);
    sessionStorage.setItem('crew_selected_booking_id', newId);
    const newBooking = bookingsList.find((b) => b.id === newId);
    if (!newBooking) return;

    setBooking(newBooking);
    const currentSignOff = await loadClientSignOff(newBooking.id);
    setSignOff(currentSignOff);

    const { stages: dbStages, status: dbStatus } = await loadBookingWorkflowStages(
      newBooking.id,
      currentSignOff
    );
    setStages(dbStages);
    setBooking((prev) => (prev ? { ...prev, status: dbStatus as any } : null));
  };

  const toggleStage = async (id: string) => {
    if (!booking) return;

    const updated = stages.map((st) => {
      if (st.id === id) {
        const nextState = !st.completed;
        return {
          ...st,
          completed: nextState,
          completedAt: nextState
            ? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : undefined,
        };
      }
      return st;
    });

    setStages(updated);

    // Persist changes to Supabase Database
    const { overallStatus } = await saveBookingWorkflowStages(booking.id, updated, {
      verifiedBy: booking.leadTechnician,
      hasSignOff: Boolean(signOff),
      bookingCustomer: booking.customer,
    });

    setBooking((prev) => (prev ? { ...prev, status: overallStatus as any } : null));
    setSyncToast('Milestone saved to database');
    setTimeout(() => setSyncToast(null), 3000);
  };

  const handleSaveSignOff = async (data: ClientSignOffData) => {
    if (!booking) return;

    setSignOff(data);
    await saveClientSignOff(booking.id, data);

    // Automatically mark calibration stage as completed with the sign-off timestamp
    const updated = stages.map((st) =>
      st.id === 'st-3' ? { ...st, completed: true, completedAt: data.signedAt } : st
    );

    setStages(updated);

    // Save to Supabase Database
    const { overallStatus } = await saveBookingWorkflowStages(booking.id, updated, {
      verifiedBy: data.clientName,
      hasSignOff: true,
      bookingCustomer: booking.customer,
    });

    setBooking((prev) => (prev ? { ...prev, status: overallStatus as any } : null));
    setSyncToast('Client sign-off & stage synced to database');
    setTimeout(() => setSyncToast(null), 3500);
  };

  const handleClearSignOff = async () => {
    if (!booking) return;
    if (window.confirm('Are you sure you want to clear the client signature and re-sign?')) {
      setSignOff(null);
      try {
        localStorage.removeItem(`binhi_crew_signoff_${booking.id}`);
      } catch {}

      const updated = stages.map((st) =>
        st.id === 'st-3' ? { ...st, completed: false, completedAt: undefined } : st
      );
      setStages(updated);
      const { overallStatus } = await saveBookingWorkflowStages(booking.id, updated, {
        hasSignOff: false,
        bookingCustomer: booking.customer,
      });
      setBooking((prev) => (prev ? { ...prev, status: overallStatus as any } : null));
    }
  };

  const handleCompleteAllStages = async () => {
    if (!booking) return;

    const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const updated = stages.map((s) => ({
      ...s,
      completed: true,
      completedAt: s.completedAt || currentTime,
    }));

    setStages(updated);
    setConfirmCompleteModal(false);

    // Persist all 5 completed stages to Supabase Database
    const { overallStatus } = await saveBookingWorkflowStages(booking.id, updated, {
      verifiedBy: booking.leadTechnician,
      hasSignOff: true,
      bookingCustomer: booking.customer,
    });

    setBooking((prev) => (prev ? { ...prev, status: overallStatus as any } : null));
    setSyncToast('All stages completed & updated in database');
    setTimeout(() => setSyncToast(null), 3500);
  };

  const completedCount = stages.filter((st) => st.completed).length;
  const progressPct = stages.length > 0 ? Math.round((completedCount / stages.length) * 100) : 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-64 bg-black/10 rounded-xl animate-pulse" />
        <div className="h-40 w-full bg-white rounded-2xl border border-[#24252c]/10 animate-pulse" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-3xl p-8 sm:p-12 text-center border border-[#24252c]/10 shadow-sm space-y-4 max-w-xl mx-auto my-6">
          <div className="w-14 h-14 rounded-full bg-[#1090F8]/10 text-[#1090F8] flex items-center justify-center mx-auto border border-[#1090F8]/20">
            <IconShield className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-[var(--ink)]">No Assigned Event Selected</h3>
            <p className="text-xs text-[#24252c]/60 mt-1.5 leading-relaxed">
              You are not currently assigned to any active event booking. Once the administrator designates you to an upcoming booking, your stage milestones and digital sign-off tools will appear here.
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={() => go('crew-assigned-bookings')}
              className="px-5 py-2.5 rounded-full bg-[var(--ink)] text-white text-xs font-bold hover:bg-[var(--ink-soft)] transition-colors cursor-pointer"
            >
              Back to Assigned Bookings
            </button>
          </div>
        </div>
      </div>
    );
  }

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

        <div className="flex items-center gap-3 self-start sm:self-auto">
          {syncToast && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200 shadow-2xs animate-fade-in">
              <IconCheck className="w-3.5 h-3.5 stroke-[3]" />
              <span className="font-bold">{syncToast}</span>
            </div>
          )}

          <button
            onClick={() => setConfirmCompleteModal(true)}
            className="bg-emerald-600 text-white text-xs font-bold px-5 py-2.5 rounded-full hover:bg-emerald-700 transition-colors shadow-sm cursor-pointer"
          >
            Mark All Stages Complete
          </button>
        </div>
      </div>

      {/* Booking Quick Context Card */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#24252c]/[0.08] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
        <div className="space-y-1.5 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono font-bold text-[#1090F8] bg-[#1090F8]/10 px-2 py-0.5 rounded-md">
              {booking.id}
            </span>
            <span className="font-extrabold text-[var(--ink)] text-sm">{booking.package}</span>
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 uppercase tracking-wider">
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
          {bookingsList.length > 1 && (
            <div className="flex items-center gap-1.5 bg-[var(--mist)] px-3 py-1.5 rounded-xl border border-[#24252c]/10">
              <span className="text-[11px] font-bold text-[#24252c]/60">Assignment:</span>
              <select
                value={booking.id}
                onChange={(e) => handleSwitchBooking(e.target.value)}
                className="bg-transparent text-[var(--ink)] font-extrabold text-xs focus:outline-none cursor-pointer max-w-[200px] truncate"
              >
                {bookingsList.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.id} — {b.customer}
                  </option>
                ))}
              </select>
            </div>
          )}

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

      {/* CLIENT INGRESS / SOUNDCHECK DIGITAL SIGN-OFF CARD */}
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
                  <IconCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Soundcheck Approved</span>
                </span>
                <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-800 border border-emerald-500/20 flex items-center gap-1">
                  <IconCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>LED & Lighting Responsive</span>
                </span>
                <span className="text-[10px] font-extrabold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-800 border border-emerald-500/20 flex items-center gap-1">
                  <IconCheck className="w-3.5 h-3.5 text-emerald-600" />
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

      {/* STAGE MILESTONES WORKFLOW TIMELINE */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-extrabold text-[var(--ink)]">Production Workflow Timeline</h2>
          <span className="text-xs text-[#24252c]/60">
            {completedCount} of {stages.length} milestones complete
          </span>
        </div>

        {stages.map((st) => (
          <div
            key={st.id}
            className={`p-5 rounded-2xl border transition-all ${
              st.completed
                ? 'bg-white border-emerald-500/30 shadow-xs'
                : 'bg-white border-[#24252c]/[0.08] hover:border-[#1090F8]/30 shadow-2xs'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5 min-w-0">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-extrabold text-xs shrink-0 transition-colors ${
                    st.completed ? 'bg-emerald-600 text-white' : 'bg-[var(--mist)] text-[var(--ink)]'
                  }`}
                >
                  {st.completed ? <IconCheck className="w-4 h-4 stroke-[3]" /> : st.stepNum}
                </div>

                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className={`font-bold text-sm ${st.completed ? 'text-[var(--ink)]' : 'text-[var(--ink)]'}`}>
                      {st.title}
                    </h3>
                    {st.completed && st.completedAt && (
                      <span className="text-[10px] font-mono font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">
                        {st.completedAt}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#24252c]/65 leading-relaxed">{st.desc}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <button
                  type="button"
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
            This will mark all 5 setup & teardown stages as complete and update inventory status back to warehouse storage in the database.
          </p>

          <div className="flex items-center gap-3 text-xs">
            <button
              onClick={() => setConfirmCompleteModal(false)}
              className="flex-1 bg-[var(--mist)] text-[var(--ink)] font-semibold py-3 rounded-full border border-[#24252c]/10 hover:bg-[var(--ink)] hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleCompleteAllStages}
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
