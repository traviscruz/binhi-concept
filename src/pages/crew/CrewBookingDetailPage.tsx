import { useState, useEffect } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import {
  IconBox,
  IconPin,
  IconCalendar,
  IconCheck,
  IconX,
  IconClock,
  IconShield,
  IconPlus,
  IconEdit,
  IconTrash,
  IconUser,
} from '../../components/shared/icons';
import { ModalOverlay } from '../../components/shared/ModalOverlay';
import type { AssignedBooking } from '../../data/crewBookings';
import {
  fetchAssignedBookingsForCurrentCrew,
  fetchBookingPackingChecklist,
  getCurrentCrewAuth,
  fetchBookingCrewNotes,
  createBookingCrewNote,
  updateBookingCrewNote,
  deleteBookingCrewNote,
  type PackingGearItem,
  type CrewNote,
} from '../../utils/crewService';
import { logAuditEvent } from '../../utils/auditLogger';

const NOTE_CATEGORIES = [
  'General',
  'Power / Electrical',
  'Rigging & Stage',
  'Audio / RF',
  'Lighting',
  'Logistics',
] as const;

type NoteCategory = typeof NOTE_CATEGORIES[number];

const CATEGORY_STYLES: Record<NoteCategory, { bg: string; text: string; border: string }> = {
  'General': { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200' },
  'Power / Electrical': { bg: 'bg-amber-500/10', text: 'text-amber-700', border: 'border-amber-500/20' },
  'Rigging & Stage': { bg: 'bg-blue-500/10', text: 'text-[#1090F8]', border: 'border-blue-500/20' },
  'Audio / RF': { bg: 'bg-purple-500/10', text: 'text-purple-700', border: 'border-purple-500/20' },
  'Lighting': { bg: 'bg-indigo-500/10', text: 'text-indigo-700', border: 'border-indigo-500/20' },
  'Logistics': { bg: 'bg-emerald-500/10', text: 'text-emerald-700', border: 'border-emerald-500/20' },
};

function formatNoteTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return 'Recently';
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return 'Recently';
  }
}

export default function CrewBookingDetailPage({ go }: { go: (p: Page) => void }) {
  const [bookingsList, setBookingsList] = useState<AssignedBooking[]>([]);
  const [loading, setLoading] = useState(true);

  // Retrieve active selected booking ID
  const [selectedBookingId, setSelectedBookingId] = useState<string>(() => {
    return sessionStorage.getItem('crew_selected_booking_id') || '';
  });

  const [gearItems, setGearItems] = useState<PackingGearItem[]>([]);

  // Notes state
  const [notes, setNotes] = useState<CrewNote[]>([]);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteCategory, setNewNoteCategory] = useState<NoteCategory>('General');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editCategory, setEditCategory] = useState<NoteCategory>('General');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [noteSuccessToast, setNoteSuccessToast] = useState<string | null>(null);

  // Current logged in crew identity
  const [crewProfile, setCrewProfile] = useState<{ name: string; role: string }>({
    name: 'Crew Member',
    role: 'Production Tech',
  });

  // Load available assigned bookings and active packing checklist
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const auth = await getCurrentCrewAuth();
        if (auth) {
          setCrewProfile({
            name: auth.fullName || 'Crew Member',
            role: auth.role === 'admin' ? 'Lead Production Admin' : 'Rigging & Sound Tech',
          });
        }

        const { bookings } = await fetchAssignedBookingsForCurrentCrew();
        setBookingsList(bookings);

        let targetId = selectedBookingId;
        if (!targetId || !bookings.some((b) => b.id === targetId)) {
          if (bookings.length > 0) {
            targetId = bookings[0].id;
            setSelectedBookingId(targetId);
            sessionStorage.setItem('crew_selected_booking_id', targetId);
          }
        }

        if (targetId) {
          const checklist = await fetchBookingPackingChecklist(targetId);
          // Restore saved checklist verification status from localStorage
          try {
            const savedStr = localStorage.getItem(`binhi_crew_packing_${targetId}`);
            if (savedStr) {
              const savedChecked: Record<string, boolean> = JSON.parse(savedStr);
              checklist.forEach((gear) => {
                gear.units.forEach((u) => {
                  if (savedChecked[u.unitId] !== undefined) {
                    u.checked = savedChecked[u.unitId];
                  }
                });
              });
            }
          } catch {}
          setGearItems(checklist);

          // Load notes for target booking from Supabase database
          await loadNotesForBooking(targetId);
        }
      } catch (err) {
        console.error('Error loading crew booking detail data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [selectedBookingId]);

  const loadNotesForBooking = async (bId: string) => {
    try {
      const dbNotes = await fetchBookingCrewNotes(bId);
      if (dbNotes.length > 0) {
        setNotes(dbNotes);
      } else {
        // Fallback to local storage or create initial technical setup note
        const stored = localStorage.getItem(`binhi_crew_notes_${bId}`);
        if (stored) {
          const parsed: CrewNote[] = JSON.parse(stored);
          setNotes(Array.isArray(parsed) ? parsed : []);
        } else {
          setNotes([]);
        }
      }
    } catch {
      setNotes([]);
    }
  };

  const booking = bookingsList.find((b) => b.id === selectedBookingId) || bookingsList[0];

  const handleSwitchBooking = async (newId: string) => {
    setSelectedBookingId(newId);
    sessionStorage.setItem('crew_selected_booking_id', newId);
    const checklist = await fetchBookingPackingChecklist(newId);
    try {
      const savedStr = localStorage.getItem(`binhi_crew_packing_${newId}`);
      if (savedStr) {
        const savedChecked: Record<string, boolean> = JSON.parse(savedStr);
        checklist.forEach((gear) => {
          gear.units.forEach((u) => {
            if (savedChecked[u.unitId] !== undefined) {
              u.checked = savedChecked[u.unitId];
            }
          });
        });
      }
    } catch {}
    setGearItems(checklist);
    loadNotesForBooking(newId);
    setEditingNoteId(null);
    setNewNoteContent('');
  };

  const toggleUnit = (unitId: string) => {
    setGearItems((prev) => {
      const updated = prev.map((g) => ({
        ...g,
        units: g.units.map((u) => (u.unitId === unitId ? { ...u, checked: !u.checked } : u)),
      }));

      if (booking) {
        const checkedMap: Record<string, boolean> = {};
        updated.forEach((g) => {
          g.units.forEach((u) => {
            checkedMap[u.unitId] = u.checked;
          });
        });
        localStorage.setItem(`binhi_crew_packing_${booking.id}`, JSON.stringify(checkedMap));
      }
      return updated;
    });
  };

  const setAllUnitsVerified = (verified: boolean) => {
    setGearItems((prev) => {
      const updated = prev.map((g) => ({
        ...g,
        units: g.units.map((u) => ({ ...u, checked: verified })),
      }));

      if (booking) {
        const checkedMap: Record<string, boolean> = {};
        updated.forEach((g) => {
          g.units.forEach((u) => {
            checkedMap[u.unitId] = verified;
          });
        });
        localStorage.setItem(`binhi_crew_packing_${booking.id}`, JSON.stringify(checkedMap));
      }
      return updated;
    });
  };

  // --- NOTES CRUD ACTIONS WITH SUPABASE DATABASE ---

  const handleAddNote = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newNoteContent.trim() || !booking) return;

    const payload = {
      bookingId: booking.id,
      author: crewProfile.name,
      role: booking.crewRole || crewProfile.role,
      content: newNoteContent.trim(),
      category: newNoteCategory,
    };

    setNewNoteContent('');

    // Insert to database and get resolved note
    const savedNote = await createBookingCrewNote(payload);
    const updatedNotes = [savedNote, ...notes.filter((n) => n.id !== savedNote.id)];
    setNotes(updatedNotes);
    localStorage.setItem(`binhi_crew_notes_${booking.id}`, JSON.stringify(updatedNotes));

    try {
      await logAuditEvent({
        action: 'CREATE_BOOKING',
        module: 'crew',
        targetId: booking.id,
        targetName: `${booking.customer} - ${booking.package}`,
        details: `Crew note added [${savedNote.category}]: "${savedNote.content}"`,
        metadata: {
          note_id: savedNote.id,
          category: savedNote.category,
          author: savedNote.author,
        },
      });
    } catch {}

    setNoteSuccessToast('Rigging note saved to database');
    setTimeout(() => setNoteSuccessToast(null), 3000);
  };

  const handleStartEdit = (note: CrewNote) => {
    setEditingNoteId(note.id);
    setEditContent(note.content);
    setEditCategory(note.category);
  };

  const handleSaveEdit = async () => {
    if (!editingNoteId || !editContent.trim() || !booking) return;

    const targetId = editingNoteId;
    const content = editContent.trim();
    const category = editCategory;
    setEditingNoteId(null);

    // Update in Supabase database
    await updateBookingCrewNote(targetId, content, category);

    const updatedNotes = notes.map((n) => {
      if (n.id === targetId) {
        return {
          ...n,
          content,
          category,
          updatedAt: new Date().toISOString(),
        };
      }
      return n;
    });

    setNotes(updatedNotes);
    localStorage.setItem(`binhi_crew_notes_${booking.id}`, JSON.stringify(updatedNotes));

    try {
      await logAuditEvent({
        action: 'UPDATE_BOOKING',
        module: 'crew',
        targetId: booking.id,
        targetName: `${booking.customer} - ${booking.package}`,
        details: `Crew note updated [${category}]: "${content}"`,
        metadata: { note_id: targetId },
      });
    } catch {}

    setNoteSuccessToast('Note updated in database');
    setTimeout(() => setNoteSuccessToast(null), 3000);
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!booking) return;

    setDeleteConfirmId(null);

    // Delete from Supabase database
    await deleteBookingCrewNote(noteId);

    const updatedNotes = notes.filter((n) => n.id !== noteId);
    setNotes(updatedNotes);
    localStorage.setItem(`binhi_crew_notes_${booking.id}`, JSON.stringify(updatedNotes));

    try {
      await logAuditEvent({
        action: 'DELETE_BOOKING',
        module: 'crew',
        targetId: booking.id,
        targetName: `${booking.customer} - ${booking.package}`,
        details: `Crew note removed from database`,
        metadata: { note_id: noteId },
      });
    } catch {}

    setNoteSuccessToast('Note deleted from database');
    setTimeout(() => setNoteSuccessToast(null), 3000);
  };

  const totalUnits = gearItems.reduce((sum, g) => sum + g.units.length, 0);
  const verifiedUnits = gearItems.reduce(
    (sum, g) => sum + g.units.filter((u) => u.checked).length,
    0
  );
  const progressPct = totalUnits > 0 ? Math.round((verifiedUnits / totalUnits) * 100) : 0;

  const packageGear = gearItems.filter((g) => !g.isAddon);
  const addonGear = gearItems.filter((g) => g.isAddon);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-64 bg-black/10 rounded-xl animate-pulse" />
        <div className="h-40 w-full bg-white rounded-2xl border border-[#24252c]/10 animate-pulse" />
        <div className="h-60 w-full bg-white rounded-2xl border border-[#24252c]/10 animate-pulse" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-3xl p-8 sm:p-12 text-center border border-[#24252c]/10 shadow-sm space-y-4 max-w-xl mx-auto my-6">
          <div className="w-14 h-14 rounded-full bg-[#1090F8]/10 text-[#1090F8] flex items-center justify-center mx-auto border border-[#1090F8]/20">
            <IconBox className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-[var(--ink)]">No Assigned Event Selected</h3>
            <p className="text-xs text-[#24252c]/60 mt-1.5 leading-relaxed">
              No active event booking is currently selected. View upcoming scheduled bookings to inspect equipment serials and begin warehouse dispatch verification.
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
          <MonoBadge icon={IconBox}>Inspection & Equipment Checklist</MonoBadge>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ink)] mt-1.5">
            Booking Details & Gear Packing Checklist
          </h1>
          <p className="text-xs text-[#24252c]/60 mt-1">
            Verify assigned physical serial units, technical power specs, and warehouse dispatch readiness for{' '}
            <strong className="text-[var(--ink)] font-mono">{booking.id}</strong>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {bookingsList.length > 1 && (
            <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full border border-[#24252c]/15 text-xs shadow-2xs">
              <span className="text-[11px] font-bold text-[#24252c]/60">Assignment:</span>
              <select
                value={booking.id}
                onChange={(e) => handleSwitchBooking(e.target.value)}
                className="bg-transparent text-[var(--ink)] font-extrabold text-xs focus:outline-none cursor-pointer max-w-[220px] truncate"
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
            onClick={() => go('crew-setup-teardown')}
            className="bg-[#1090F8] text-white text-xs font-bold px-5 py-2.5 rounded-full hover:bg-[#1090F8]/90 transition-colors shadow-sm cursor-pointer"
          >
            Proceed to Setup Stage →
          </button>
        </div>
      </div>

      {/* Booking Summary Card */}
      <div className="bg-white rounded-2xl p-6 border border-[#24252c]/[0.08] shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#24252c]/[0.06]">
          <div>
            <span className="font-mono font-extrabold text-sm text-[#1090F8] bg-[#1090F8]/10 px-2.5 py-0.5 rounded-md">
              {booking.id}
            </span>
            <h2 className="text-xl font-extrabold text-[var(--ink)] mt-1">{booking.package}</h2>
          </div>
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 uppercase tracking-wider">
            {booking.status}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-[#24252c]/50 font-semibold block">Client / Host:</span>
            <span className="font-bold text-[var(--ink)]">{booking.customer}</span>
          </div>
          <div>
            <span className="text-[#24252c]/50 font-semibold block">Event Date:</span>
            <span className="font-bold text-[var(--ink)]">{booking.date}</span>
          </div>
          <div>
            <span className="text-[#24252c]/50 font-semibold block">Venue Location:</span>
            <span className="font-bold text-[var(--ink)]">{booking.venue}</span>
          </div>
          <div>
            <span className="text-[#24252c]/50 font-semibold block">Lead Technician:</span>
            <span className="font-bold text-[#1090F8]">{booking.leadTechnician}</span>
          </div>
        </div>

        {/* Technical Specs Callout */}
        <div className="bg-[var(--mist)] p-4 rounded-xl border border-[#24252c]/[0.06] grid sm:grid-cols-3 gap-3 text-xs">
          <div>
            <span className="text-[#24252c]/50 font-semibold block uppercase tracking-wider text-[10px]">
              Power Requirements:
            </span>
            <span className="font-bold text-[var(--ink)]">{booking.powerSpecs}</span>
          </div>
          <div>
            <span className="text-[#24252c]/50 font-semibold block uppercase tracking-wider text-[10px]">
              Rigging Setup Window:
            </span>
            <span className="font-bold text-[var(--ink)]">{booking.riggingWindow}</span>
          </div>
          <div>
            <span className="text-[#24252c]/50 font-semibold block uppercase tracking-wider text-[10px]">
              Required Crew Size:
            </span>
            <span className="font-bold text-[var(--ink)]">{booking.crewSize}</span>
          </div>
        </div>
      </div>

      {/* Interactive Assigned Serial Units Checklist — Table Layout matching Unit-Level Date Assignments */}
      <div className="bg-white rounded-2xl p-6 border border-[#24252c]/[0.08] shadow-sm space-y-5">
        {/* Header & Progress Control */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#24252c]/[0.06]">
          <div>
            <h3 className="font-extrabold text-base text-[var(--ink)]">Assigned Serial Units Checklist</h3>
            <p className="text-xs text-[#24252c]/60 mt-0.5">
              Check off each unit after bench testing and scanning into warehouse dispatch truck.
            </p>
          </div>
          <div className="flex items-center gap-3 self-start sm:self-auto">
            <div className="text-right">
              <span className="text-base font-black text-[#1090F8]">{progressPct}% Packed</span>
              <span className="text-[11px] text-[#24252c]/50 block">
                ({verifiedUnits} of {totalUnits} units verified)
              </span>
            </div>
            <div className="flex items-center gap-1.5 pl-3 border-l border-[#24252c]/10 text-xs">
              <button
                type="button"
                onClick={() => setAllUnitsVerified(true)}
                className="px-3 py-1.5 rounded-lg bg-[#1090F8]/10 text-[#1090F8] hover:bg-[#1090F8]/20 font-bold transition-colors cursor-pointer"
              >
                Mark All
              </button>
              <button
                type="button"
                onClick={() => setAllUnitsVerified(false)}
                className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 font-semibold transition-colors cursor-pointer"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-2.5 rounded-full bg-[var(--mist)] overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[var(--ink)] to-[#1090F8] rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Tables Container */}
        {gearItems.length === 0 ? (
          <div className="p-8 text-center bg-[var(--mist)] rounded-xl border border-dashed border-[#24252c]/10">
            <p className="text-xs text-[#24252c]/60">No physical equipment items configured for this booking package.</p>
          </div>
        ) : (
          <div className="space-y-6 pt-1">
            {/* Package Inclusions Section */}
            {packageGear.length > 0 && (
              <div className="space-y-2.5">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#24252c]/60 flex items-center justify-between">
                  <span>{booking.package} — Package Inclusions</span>
                  <span className="text-[#1090F8] font-bold">
                    {packageGear.reduce((s, g) => s + g.units.filter((u) => u.checked).length, 0)}/
                    {packageGear.reduce((s, g) => s + g.units.length, 0)} Units Verified
                  </span>
                </div>

                <div className="rounded-xl border border-[#24252c]/[0.08] overflow-hidden shadow-2xs">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-[var(--mist)] border-b border-[#24252c]/[0.06] text-[#24252c]/50 uppercase tracking-wider text-[10px]">
                        <th className="py-2.5 px-4 font-semibold text-left w-2/5 sm:w-1/3">Equipment Item</th>
                        <th className="py-2.5 px-4 font-semibold text-left">Assigned Serial IDs</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#24252c]/[0.04]">
                      {packageGear.map((g) => (
                        <tr key={g.id} className="hover:bg-[var(--mist)]/40 transition-colors">
                          <td className="py-3 px-4 align-top">
                            <div className="flex items-start gap-2">
                              <span className="w-2 h-2 rounded-full bg-[#1090F8] shrink-0 mt-1" />
                              <div>
                                <span className="font-semibold text-[var(--ink)] block">{g.name}</span>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  {g.qty > 1 && (
                                    <span className="text-[10px] font-extrabold text-[#1090F8] bg-[#1090F8]/10 px-1.5 py-0.5 rounded">
                                      ×{g.qty}
                                    </span>
                                  )}
                                  <span className="text-[10px] text-[#24252c]/50">{g.category}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 align-top">
                            <div className="flex flex-wrap gap-2">
                              {g.units.map((u) => (
                                <button
                                  key={u.unitId}
                                  type="button"
                                  onClick={() => toggleUnit(u.unitId)}
                                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-left text-xs transition-all cursor-pointer ${
                                    u.checked
                                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-950 shadow-2xs'
                                      : 'bg-white border-[#24252c]/15 hover:border-[#1090F8] text-[var(--ink)]'
                                  }`}
                                >
                                  <div
                                    className={`w-4 h-4 rounded flex items-center justify-center border transition-all ${
                                      u.checked
                                        ? 'bg-emerald-600 border-emerald-600 text-white'
                                        : 'bg-white border-[#24252c]/30'
                                    }`}
                                  >
                                    {u.checked && <IconCheck className="w-3 h-3 stroke-[3]" />}
                                  </div>

                                  <div className="flex flex-col">
                                    <span className="font-mono font-extrabold text-[11px] text-[#1090F8]">
                                      {u.serialId}
                                    </span>
                                    <span className="text-[9px] text-[#24252c]/60">
                                      {u.condition || 'Operational'}
                                    </span>
                                  </div>

                                  <span
                                    className={`ml-1 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                                      u.checked
                                        ? 'bg-emerald-600/10 text-emerald-700'
                                        : 'bg-gray-100 text-gray-500'
                                    }`}
                                  >
                                    {u.checked ? 'Verified' : 'Check'}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Selected Add-ons Section */}
            {addonGear.length > 0 && (
              <div className="space-y-2.5 pt-2">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700 flex items-center justify-between">
                  <span>Selected Add-ons</span>
                  <span className="text-amber-600 font-bold">
                    {addonGear.reduce((s, g) => s + g.units.filter((u) => u.checked).length, 0)}/
                    {addonGear.reduce((s, g) => s + g.units.length, 0)} Units Verified
                  </span>
                </div>

                <div className="rounded-xl border border-amber-200/60 overflow-hidden shadow-2xs">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-amber-50 border-b border-amber-200/60 text-amber-900/60 uppercase tracking-wider text-[10px]">
                        <th className="py-2.5 px-4 font-semibold text-left w-2/5 sm:w-1/3">Add-on Item</th>
                        <th className="py-2.5 px-4 font-semibold text-left">Assigned Serial IDs</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-100">
                      {addonGear.map((g) => (
                        <tr key={g.id} className="hover:bg-amber-50/60 transition-colors">
                          <td className="py-3 px-4 align-top">
                            <div className="flex items-start gap-2">
                              <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0 mt-1" />
                              <div>
                                <span className="font-semibold text-[var(--ink)] block">{g.name}</span>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  {g.qty > 1 && (
                                    <span className="text-[10px] font-extrabold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                                      ×{g.qty}
                                    </span>
                                  )}
                                  <span className="text-[10px] text-[#24252c]/50">{g.category}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 align-top">
                            <div className="flex flex-wrap gap-2">
                              {g.units.map((u) => (
                                <button
                                  key={u.unitId}
                                  type="button"
                                  onClick={() => toggleUnit(u.unitId)}
                                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-left text-xs transition-all cursor-pointer ${
                                    u.checked
                                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-950 shadow-2xs'
                                      : 'bg-white border-amber-300/60 hover:border-amber-500 text-[var(--ink)]'
                                  }`}
                                >
                                  <div
                                    className={`w-4 h-4 rounded flex items-center justify-center border transition-all ${
                                      u.checked
                                        ? 'bg-emerald-600 border-emerald-600 text-white'
                                        : 'bg-white border-[#24252c]/30'
                                    }`}
                                  >
                                    {u.checked && <IconCheck className="w-3 h-3 stroke-[3]" />}
                                  </div>

                                  <div className="flex flex-col">
                                    <span className="font-mono font-extrabold text-[11px] text-amber-700">
                                      {u.serialId}
                                    </span>
                                    <span className="text-[9px] text-[#24252c]/60">
                                      {u.condition || 'Operational'}
                                    </span>
                                  </div>

                                  <span
                                    className={`ml-1 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                                      u.checked
                                        ? 'bg-emerald-600/10 text-emerald-700'
                                        : 'bg-amber-100 text-amber-700'
                                    }`}
                                  >
                                    {u.checked ? 'Verified' : 'Check'}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* --- CREW ON-SITE / RIGGING NOTES FEED --- */}
      <div className="bg-white rounded-2xl p-6 border border-[#24252c]/[0.08] shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#24252c]/[0.06]">
          <div>
            <h3 className="font-extrabold text-base text-[var(--ink)] flex items-center gap-2">
              <span>Crew On-Site / Rigging Notes</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--mist)] text-[#24252c]/60 font-bold border border-[#24252c]/10">
                {notes.length}
              </span>
            </h3>
            <p className="text-xs text-[#24252c]/60 mt-0.5">
              Live technical log for stage clearance, power outlets, RF frequencies, and dispatch coordination.
            </p>
          </div>

          {noteSuccessToast && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200 animate-fade-in">
              <IconCheck className="w-3.5 h-3.5 stroke-[3]" />
              <span className="font-bold">{noteSuccessToast}</span>
            </div>
          )}
        </div>

        {/* Add Note Form */}
        <form onSubmit={handleAddNote} className="bg-[var(--mist)]/70 p-4 rounded-2xl border border-[#24252c]/[0.06] space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-xs font-bold text-[var(--ink)]">Add Technical / Rigging Note:</span>
            
            {/* Category Selector */}
            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 text-[10px]">
              {NOTE_CATEGORIES.map((cat) => (
                <button
                  type="button"
                  key={cat}
                  onClick={() => setNewNoteCategory(cat)}
                  className={`px-2.5 py-1 rounded-full font-bold whitespace-nowrap transition-all cursor-pointer border ${
                    newNoteCategory === cat
                      ? 'bg-[var(--ink)] text-white border-[var(--ink)] shadow-2xs'
                      : 'bg-white text-[#24252c]/60 border-[#24252c]/10 hover:text-[var(--ink)]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <textarea
            rows={2}
            value={newNoteContent}
            onChange={(e) => setNewNoteContent(e.target.value)}
            placeholder={`Log notes for ${booking.id} regarding power breakers, venue clearances, audio runs, or warehouse dispatch...`}
            className="w-full rounded-xl border border-white px-3.5 py-2.5 text-xs bg-white text-[var(--ink)] placeholder:text-[#24252c]/40 focus:outline-none focus:border-[#1090F8] shadow-2xs transition-colors"
          />

          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-[10px] text-[#24252c]/50">
              Posting as <strong className="text-[var(--ink)]">{crewProfile.name}</strong> ({crewProfile.role})
            </span>
            <button
              type="submit"
              disabled={!newNoteContent.trim()}
              className="inline-flex items-center gap-1.5 bg-[var(--ink)] text-white text-xs font-bold px-4 py-2 rounded-full hover:bg-[var(--ink-soft)] disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-2xs"
            >
              <IconPlus className="w-3.5 h-3.5" />
              <span>Post Rigging Note</span>
            </button>
          </div>
        </form>

        {/* Notes Feed List */}
        <div className="space-y-3">
          {notes.length === 0 ? (
            <div className="p-8 text-center bg-[var(--mist)]/40 rounded-2xl border border-dashed border-[#24252c]/10 text-xs text-[#24252c]/50">
              No on-site rigging notes logged yet. Use the form above to post technical observations or loading bay reminders.
            </div>
          ) : (
            notes.map((n) => {
              const isEditing = editingNoteId === n.id;
              const catStyle = CATEGORY_STYLES[n.category] || CATEGORY_STYLES['General'];

              return (
                <div
                  key={n.id}
                  className="bg-white rounded-2xl p-4 border border-[#24252c]/[0.08] hover:border-[#24252c]/15 transition-all shadow-2xs space-y-2.5"
                >
                  {/* Note Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-[var(--ink)] text-white font-extrabold text-[10px] flex items-center justify-center shrink-0">
                        {n.author.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-xs text-[var(--ink)]">{n.author}</span>
                          <span className="text-[10px] text-[#24252c]/50">({n.role})</span>
                        </div>
                        <div className="text-[10px] text-[#24252c]/40 flex items-center gap-1">
                          <IconClock className="w-3 h-3" />
                          <span>{formatNoteTime(n.createdAt)}</span>
                          {n.updatedAt && <span className="italic text-[#1090F8]">(edited)</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}
                      >
                        {n.category}
                      </span>

                      {!isEditing && (
                        <div className="flex items-center gap-1 pl-1 border-l border-[#24252c]/10">
                          <button
                            type="button"
                            title="Edit Note"
                            onClick={() => handleStartEdit(n)}
                            className="p-1.5 rounded-lg text-[#24252c]/50 hover:text-[var(--ink)] hover:bg-[var(--mist)] transition-colors cursor-pointer"
                          >
                            <IconEdit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Delete Note"
                            onClick={() => setDeleteConfirmId(n.id)}
                            className="p-1.5 rounded-lg text-rose-500/70 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          >
                            <IconTrash className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Note Body or Edit Mode */}
                  {isEditing ? (
                    <div className="space-y-3 pt-1">
                      <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[10px]">
                        {NOTE_CATEGORIES.map((cat) => (
                          <button
                            type="button"
                            key={cat}
                            onClick={() => setEditCategory(cat)}
                            className={`px-2.5 py-0.5 rounded-full font-bold transition-all cursor-pointer border ${
                              editCategory === cat
                                ? 'bg-[var(--ink)] text-white border-[var(--ink)]'
                                : 'bg-gray-100 text-[#24252c]/60 border-transparent'
                            }`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>

                      <textarea
                        rows={2}
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full rounded-xl border border-[#24252c]/15 px-3 py-2 text-xs bg-[#EEEEEE] focus:outline-none focus:border-[#1090F8] transition-colors"
                      />

                      <div className="flex items-center justify-end gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => setEditingNoteId(null)}
                          className="px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 font-semibold transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveEdit}
                          disabled={!editContent.trim()}
                          className="px-4 py-1.5 rounded-full bg-[#1090F8] text-white hover:bg-[#1090F8]/90 font-bold disabled:opacity-40 transition-colors cursor-pointer"
                        >
                          Save Changes
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-[var(--ink)] whitespace-pre-wrap leading-relaxed pl-9">
                      {n.content}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal Overlay */}
      <ModalOverlay isOpen={Boolean(deleteConfirmId)} onClose={() => setDeleteConfirmId(null)}>
        <div className="bg-white rounded-[2rem] p-6 max-w-sm w-full shadow-2xl border border-[#24252c]/10 relative text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
            <IconTrash className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-[var(--ink)]">Delete Rigging Note?</h3>
            <p className="text-xs text-[#24252c]/60 mt-1">
              Are you sure you want to delete this technical note? This action cannot be undone.
            </p>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => setDeleteConfirmId(null)}
              className="flex-1 py-2.5 rounded-full bg-gray-100 text-gray-700 text-xs font-bold hover:bg-gray-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => deleteConfirmId && handleDeleteNote(deleteConfirmId)}
              className="flex-1 py-2.5 rounded-full bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-colors cursor-pointer"
            >
              Delete Note
            </button>
          </div>
        </div>
      </ModalOverlay>
    </div>
  );
}
