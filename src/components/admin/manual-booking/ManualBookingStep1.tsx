import { useState } from 'react';
import type { PackageData } from '../../../data/packages';
import type { AddonModel, AddonSelection } from './types';
import { CHANNELS } from './types';
import { IconArrow, IconChevronDown, IconChevronUp, IconAlertTriangle, IconBan, IconCheck } from '../../shared/icons';
import { isPastDate, type DBBooking } from '../../../utils/bookingService';
import {
  formatTimeAmPm,
  timeToMinutes,
  minutesToTime,
  calculateCrewArrivalTime,
  getOperatingWindowForDate,
  getDayAvailabilityStatus,
  type BookingSettings,
  type ScheduleOverride,
  type SlotFeasibilityResult,
} from '../../../utils/bookingEngine';
import { AvailabilityDatePicker } from '../../shared/AvailabilityDatePicker';

interface ManualBookingStep1Props {
  channel: string;
  setChannel: (val: string) => void;
  customChannel: string;
  setCustomChannel: (val: string) => void;
  firstName: string;
  setFirstName: (val: string) => void;
  lastName: string;
  setLastName: (val: string) => void;
  email: string;
  setEmail: (val: string) => void;
  phoneDigits: string;
  setPhoneDigits: (val: string) => void;
  packagesList: PackageData[];
  selectedPkgId: string;
  setSelectedPkgId: (val: string) => void;
  addonModels: AddonModel[];
  addonSelections: AddonSelection;
  setAddonQty: (modelId: string, qty: number) => void;
  getAddonQty: (modelId: string) => number;
  addonsCost: number;
  selectedAddonStrings: string[];
  eventType: string;
  setEventType: (val: string) => void;
  eventDate: string;
  setEventDate: (val: string) => void;
  startTime: string;
  setStartTime: (val: string) => void;
  endTime: string;
  setEndTime: (val: string) => void;
  eventDescription: string;
  setEventDescription: (val: string) => void;
  dbBookings: DBBooking[];
  bookingSettings: BookingSettings;
  scheduleOverrides: ScheduleOverride[];
  slotFeasibility: SlotFeasibilityResult | null;
  currentPkgPrice: number;
  packageAndAddonPrice: number;
  selectedPkg: PackageData;
  error: string;
  onNext: () => void;
}

export function ManualBookingStep1({
  channel,
  setChannel,
  customChannel,
  setCustomChannel,
  firstName,
  setFirstName,
  lastName,
  setLastName,
  email,
  setEmail,
  phoneDigits,
  setPhoneDigits,
  packagesList,
  selectedPkgId,
  setSelectedPkgId,
  addonModels,
  addonSelections,
  setAddonQty,
  getAddonQty,
  addonsCost,
  selectedAddonStrings,
  eventType,
  setEventType,
  eventDate,
  setEventDate,
  startTime,
  setStartTime,
  endTime,
  setEndTime,
  eventDescription,
  setEventDescription,
  dbBookings,
  bookingSettings,
  scheduleOverrides,
  slotFeasibility,
  currentPkgPrice,
  packageAndAddonPrice,
  selectedPkg,
  error,
  onNext,
}: ManualBookingStep1Props) {
  const [showAddonsAccordion, setShowAddonsAccordion] = useState(false);

  return (
    <div className="bg-white rounded-[2rem] p-6 md:p-8 border border-[#24252c]/[0.08] shadow-sm animate-blur-in space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold text-[var(--ink)]">Step 1: Client & Event Information</h2>
        <p className="text-xs text-[#24252c]/60 mt-1">
          Select the client booking channel, enter their contact details, and configure the event package.
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-2xl text-xs bg-rose-50 border border-rose-200 text-rose-700 font-semibold">
          {error}
        </div>
      )}

      {/* Booking Channel Selection (CLEAN PILLS - NO EMOJIS) */}
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50 ml-1 block mb-2">
          Booking Source Channel <span className="text-rose-500">*</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {CHANNELS.map((ch) => (
            <button
              key={ch.id}
              type="button"
              onClick={() => setChannel(ch.id)}
              className={`px-3.5 py-2 rounded-full border text-xs font-semibold transition-all cursor-pointer ${
                channel === ch.id
                  ? 'bg-[#1090F8] text-white border-[#1090F8] shadow-xs'
                  : 'bg-white border-[#24252c]/15 text-[var(--ink)] hover:bg-[var(--mist)]'
              }`}
            >
              {ch.label}
            </button>
          ))}
        </div>

        {channel === 'Other' && (
          <div className="mt-3 animate-blur-in">
            <label className="text-xs font-semibold text-[#24252c]/60 ml-1 block mb-1">
              Specify Other Platform / Channel <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={customChannel}
              onChange={(e) => setCustomChannel(e.target.value)}
              placeholder="Type platform name (e.g. TikTok, Telegram, Email, Personal Referral...)"
              className="w-full sm:w-96 rounded-full border border-transparent px-4 py-2.5 text-xs bg-[var(--mist)] text-[var(--ink)] font-medium focus:outline-none focus:border-[#1090F8]"
              autoFocus
              required
            />
          </div>
        )}
      </div>

      {/* Client Name Fields */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50 ml-1 block mb-1">
            Client First Name <span className="text-rose-500">*</span>
          </label>
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="e.g. Maria"
            className="w-full rounded-full border border-transparent px-4 py-3 text-sm bg-[var(--mist)] text-[var(--ink)] font-medium focus:outline-none focus:border-[#1090F8]"
            required
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50 ml-1 block mb-1">
            Client Last Name <span className="text-rose-500">*</span>
          </label>
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="e.g. Santos"
            className="w-full rounded-full border border-transparent px-4 py-3 text-sm bg-[var(--mist)] text-[var(--ink)] font-medium focus:outline-none focus:border-[#1090F8]"
            required
          />
        </div>
      </div>

      {/* Email & Phone */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50 ml-1 block mb-1">
            Client Email Address <span className="text-rose-500">*</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. maria.santos@gmail.com"
            className="w-full rounded-full border border-transparent px-4 py-3 text-sm bg-[var(--mist)] text-[var(--ink)] font-medium focus:outline-none focus:border-[#1090F8]"
            required
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50 ml-1 block mb-1">
            Mobile Phone Number <span className="text-rose-500">*</span>
          </label>
          <div className="flex gap-2">
            <div className="w-16 shrink-0 bg-[#EEEEEE] rounded-full border border-transparent flex items-center justify-center font-bold text-xs text-[var(--ink)]">
              +63
            </div>
            <input
              type="tel"
              inputMode="numeric"
              maxLength={10}
              value={phoneDigits}
              onChange={(e) => setPhoneDigits(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="917 123 4567"
              className="w-full rounded-full border border-transparent px-4 py-3 text-sm bg-[var(--mist)] text-[var(--ink)] font-medium focus:outline-none focus:border-[#1090F8]"
              required
            />
          </div>
        </div>
      </div>

      {/* Package Selection */}
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50 ml-1 block mb-1">
          Select Event Production Package <span className="text-rose-500">*</span>
        </label>
        <select
          value={selectedPkgId}
          onChange={(e) => setSelectedPkgId(e.target.value)}
          className="w-full rounded-full border border-transparent px-4 py-3 text-sm bg-[var(--mist)] text-[var(--ink)] font-bold focus:outline-none focus:border-[#1090F8] cursor-pointer"
        >
          {packagesList.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {p.price} ({p.tag})
            </option>
          ))}
        </select>
      </div>

      {/* Optional Equipment Add-ons Accordion */}
      <div className="rounded-2xl border border-[#24252c]/[0.08] bg-white overflow-hidden shadow-xs">
        <button
          type="button"
          onClick={() => setShowAddonsAccordion(!showAddonsAccordion)}
          className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-[var(--mist)]/40 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#1090F8]/10 text-[#1090F8] flex items-center justify-center font-bold text-xs shrink-0">
              +
            </div>
            <div>
              <span className="text-xs font-bold text-[var(--ink)] block">
                Optional Equipment Add-ons ({Object.values(addonSelections).filter((q) => q > 0).length} selected)
              </span>
              <span className="text-[10px] text-[#24252c]/50">
                Add microphones, uplights, smoke machines, or active speakers
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {addonsCost > 0 && (
              <span className="text-[10px] font-bold text-[#1090F8] bg-[#1090F8]/10 px-2.5 py-0.5 rounded-full border border-[#1090F8]/20">
                +₱{addonsCost.toLocaleString()}
              </span>
            )}
            <span className="text-[#24252c]/40">
              {showAddonsAccordion ? <IconChevronUp className="w-4 h-4" /> : <IconChevronDown className="w-4 h-4" />}
            </span>
          </div>
        </button>

        {showAddonsAccordion && (
          <div className="px-5 pb-5 pt-2 border-t border-[#24252c]/[0.06] bg-[var(--mist)]/20 space-y-2 max-h-64 overflow-y-auto">
            {addonModels.length === 0 ? (
              <p className="text-[11px] text-[#24252c]/50">No equipment units available in warehouse.</p>
            ) : (
              addonModels.map((m) => {
                const qty = getAddonQty(m.modelId);
                const isSelected = qty > 0;
                return (
                  <div
                    key={m.modelId}
                    className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs transition-colors ${
                      isSelected ? 'bg-white border-[#1090F8] shadow-xs' : 'bg-white/60 border-transparent'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-[var(--ink)] truncate">{m.name}</div>
                      <div className="text-[10px] text-[#24252c]/50">
                        {m.brand} · {m.category} · {m.availableCount} in warehouse
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-bold text-[#1090F8]">
                        +₱{m.rentalRate.toLocaleString()}<span className="text-[10px] font-normal text-[#24252c]/40">/day</span>
                      </span>
                      <div className="flex items-center gap-1 ml-2">
                        <button
                          type="button"
                          onClick={() => setAddonQty(m.modelId, qty - 1)}
                          disabled={qty === 0}
                          className="w-6 h-6 rounded-full bg-[var(--mist)] border border-[#24252c]/10 flex items-center justify-center font-bold text-xs disabled:opacity-30 cursor-pointer"
                        >
                          −
                        </button>
                        <span className="w-5 text-center font-bold text-xs text-[var(--ink)]">{qty}</span>
                        <button
                          type="button"
                          onClick={() => setAddonQty(m.modelId, qty + 1)}
                          disabled={qty >= m.availableCount}
                          className="w-6 h-6 rounded-full bg-[var(--mist)] border border-[#24252c]/10 flex items-center justify-center font-bold text-xs disabled:opacity-30 cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Event Format & Event Date */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50 ml-1 block mb-1">
            Event Format <span className="text-rose-500">*</span>
          </label>
          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            className="w-full rounded-full border border-transparent px-4 py-3 text-sm bg-[var(--mist)] text-[var(--ink)] font-semibold focus:outline-none focus:border-[#1090F8]"
            required
          >
            <option value="Birthday / Debut Celebration">Birthday / Debut Celebration</option>
            <option value="Wedding / Engagement Reception">Wedding / Engagement Reception</option>
            <option value="Corporate Event / Gala / Launch">Corporate Event / Gala / Launch</option>
            <option value="Concert / Music Festival">Concert / Music Festival</option>
            <option value="Private Party / Social Gathering">Private Party / Social Gathering</option>
            <option value="Anniversary / Alumni Homecoming">Anniversary / Alumni Homecoming</option>
            <option value="Other Special Event">Other Special Event</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50 ml-1 mb-1 block">
            Event Date <span className="text-rose-500">*</span>
          </label>
          <AvailabilityDatePicker
            selectedDate={eventDate}
            onChange={(d) => setEventDate(d)}
            buttonClassName="bg-[var(--mist)] border-transparent text-sm font-semibold"
            placeholder="Select Event Date"
            showAvailabilityBadge={false}
          />
          {isPastDate(eventDate) ? (
            <p className="text-[11px] font-bold text-rose-600 mt-1 ml-2">
              Past Date: Please choose a current or future event date.
            </p>
          ) : eventDate && getDayAvailabilityStatus(eventDate, dbBookings, bookingSettings, scheduleOverrides).status === 'fully_booked' ? (
            <p className="text-[11px] font-bold text-rose-600 mt-1 ml-2">
              Fully Booked: All operational windows for this day are reserved. Please select another date.
            </p>
          ) : eventDate && getDayAvailabilityStatus(eventDate, dbBookings, bookingSettings, scheduleOverrides).status === 'closed' ? (
            <p className="text-[11px] font-bold text-zinc-600 mt-1 ml-2">
              Closed: System does not accept bookings on this date.
            </p>
          ) : null}
        </div>
      </div>

      {/* Event Time Slot Selection (Operating Hours & Feasibility aware) */}
      {(() => {
        const opWindow = getOperatingWindowForDate(eventDate, bookingSettings, scheduleOverrides);
        const openTime = opWindow.openTime || '08:00';
        const closeTime = opWindow.closeTime === '00:00' && opWindow.isOpen ? '23:59' : (opWindow.closeTime || '23:00');

        const hasSlotConflict = Boolean(slotFeasibility && !slotFeasibility.isAvailable);

        const isStartBeforeOpen = opWindow.isOpen && Boolean(startTime) && timeToMinutes(startTime) < timeToMinutes(openTime);
        const isStartAfterClose = opWindow.isOpen && Boolean(startTime) && timeToMinutes(startTime) >= timeToMinutes(closeTime);
        const isStartOutOfRange = isStartBeforeOpen || isStartAfterClose;

        const isEndAfterClose = opWindow.isOpen && Boolean(endTime) && timeToMinutes(endTime) > timeToMinutes(closeTime);
        const isEndBeforeStart = Boolean(startTime && endTime) && timeToMinutes(endTime) <= timeToMinutes(startTime);
        const isEndOutOfRange = isEndAfterClose || isEndBeforeStart;

        const isStartInputError = isStartOutOfRange || hasSlotConflict;
        const isEndInputError = isEndOutOfRange || hasSlotConflict;

        const quickPresetSlots = ['09:00', '13:00', '15:00', '18:00'].filter((t) => {
          if (!opWindow.isOpen) return false;
          const m = timeToMinutes(t);
          return m >= timeToMinutes(openTime) && m <= timeToMinutes(closeTime) - 60;
        });

        return (
          <div className="bg-[var(--mist)] rounded-2xl p-4 border border-[#24252c]/[0.06] space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-[#24252c]/[0.08] pb-2.5">
              <div>
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-[var(--ink)]">Event Schedule Window</h4>
                <p className="text-[11px] text-[#24252c]/60">Select actual event program start and end time (Event Proper).</p>
              </div>
              {opWindow.isOpen ? (
                <span className="text-[10px] font-bold text-[#1090F8] bg-[#1090F8]/10 px-2.5 py-1 rounded-full self-start sm:self-auto">
                  Daily Operating Hours: {formatTimeAmPm(openTime)} – {formatTimeAmPm(closeTime)}
                </span>
              ) : (
                <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-2.5 py-1 rounded-full self-start sm:self-auto">
                  Closed for Bookings
                </span>
              )}
            </div>

            {opWindow.isOpen && startTime && (
              <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200/90 px-3 py-2 rounded-xl text-xs">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-900 block">Binhi Crew Arrival &amp; Setup (Ingress):</span>
                  <span className="text-[11px] text-emerald-800">
                    Crew will arrive on-site early to assemble styling before program starts
                  </span>
                </div>
                <span className="font-mono font-extrabold text-xs text-emerald-950 bg-white px-2.5 py-1 rounded-lg border border-emerald-300 shrink-0">
                  Call Time: ~{formatTimeAmPm(calculateCrewArrivalTime(startTime, bookingSettings.default_turnaround_hours))}
                </span>
              </div>
            )}

            {!opWindow.isOpen && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
                <IconBan className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{opWindow.reason || 'Bookings are not accepted on this date.'} Please select another event date above.</span>
              </div>
            )}

            {/* Quick Preset Slots */}
            {opWindow.isOpen && quickPresetSlots.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#24252c]/50 mr-1">
                  Quick Slots:
                </span>
                {quickPresetSlots.map((slot) => {
                  const isSelected = startTime === slot;
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => {
                        setStartTime(slot);
                        const endMin = Math.min(timeToMinutes(slot) + 240, timeToMinutes(closeTime));
                        setEndTime(minutesToTime(endMin));
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all border ${
                        isSelected
                          ? 'bg-[#1090F8] text-white border-[#1090F8] shadow-xs'
                          : 'bg-white text-[var(--ink)] border-[#24252c]/10 hover:border-[#1090F8] hover:text-[#1090F8]'
                      }`}
                    >
                      {formatTimeAmPm(slot)}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between ml-1 mb-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[#24252c]/60">
                    Event Start Time <span className="text-rose-500">*</span>
                  </label>
                  {opWindow.isOpen && (
                    <span className="text-[10px] text-[#24252c]/50 font-semibold">
                      Min: {formatTimeAmPm(openTime)}
                    </span>
                  )}
                </div>
                <input
                  type="time"
                  value={startTime}
                  min={openTime}
                  max={closeTime}
                  disabled={!opWindow.isOpen}
                  onChange={(e) => setStartTime(e.target.value)}
                  onBlur={() => {
                    if (!startTime || !opWindow.isOpen) return;
                    const sMin = timeToMinutes(startTime);
                    const oMin = timeToMinutes(openTime);
                    const cMin = timeToMinutes(closeTime);
                    if (sMin < oMin) setStartTime(openTime);
                    else if (sMin > cMin) setStartTime(closeTime);
                  }}
                  className={`w-full rounded-xl border px-4 py-2.5 text-sm font-bold shadow-2xs focus:outline-none transition-colors ${
                    isStartInputError
                      ? 'border-rose-400 bg-rose-50/70 text-rose-800 focus:border-rose-500'
                      : 'border-white bg-white text-[var(--ink)] focus:border-[#1090F8]'
                  } ${!opWindow.isOpen ? 'opacity-50 cursor-not-allowed bg-zinc-100' : ''}`}
                  required
                />
                {isStartBeforeOpen && (
                  <p className="text-[11px] font-bold text-rose-600 mt-1 ml-1 flex items-center gap-1.5">
                    <IconBan className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span>Blocked: Cannot start before open time ({formatTimeAmPm(openTime)})</span>
                  </p>
                )}
                {isStartAfterClose && (
                  <p className="text-[11px] font-bold text-rose-600 mt-1 ml-1 flex items-center gap-1.5">
                    <IconBan className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span>Blocked: Cannot start at or after close time ({formatTimeAmPm(closeTime)})</span>
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between ml-1 mb-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[#24252c]/60">
                    Event End / Pack-up Time <span className="text-rose-500">*</span>
                  </label>
                  {opWindow.isOpen && (
                    <span className="text-[10px] text-[#24252c]/50 font-semibold">
                      Max: {formatTimeAmPm(closeTime)}
                    </span>
                  )}
                </div>
                <input
                  type="time"
                  value={endTime}
                  min={startTime && timeToMinutes(startTime) >= timeToMinutes(openTime) ? startTime : openTime}
                  max={closeTime}
                  disabled={!opWindow.isOpen}
                  onChange={(e) => setEndTime(e.target.value)}
                  onBlur={() => {
                    if (!endTime || !opWindow.isOpen) return;
                    const eMin = timeToMinutes(endTime);
                    const sMin = timeToMinutes(startTime);
                    const cMin = timeToMinutes(closeTime);
                    if (eMin > cMin) setEndTime(closeTime);
                    else if (sMin && eMin <= sMin) {
                      const fixedEnd = Math.min(sMin + 60, cMin);
                      setEndTime(minutesToTime(fixedEnd));
                    }
                  }}
                  className={`w-full rounded-xl border px-4 py-2.5 text-sm font-bold shadow-2xs focus:outline-none transition-colors ${
                    isEndInputError
                      ? 'border-rose-400 bg-rose-50/70 text-rose-800 focus:border-rose-500'
                      : 'border-white bg-white text-[var(--ink)] focus:border-[#1090F8]'
                  } ${!opWindow.isOpen ? 'opacity-50 cursor-not-allowed bg-zinc-100' : ''}`}
                  required
                />
                {isEndAfterClose && (
                  <p className="text-[11px] font-bold text-rose-600 mt-1 ml-1 flex items-center gap-1.5">
                    <IconBan className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span>Blocked: Cannot extend past close time ({formatTimeAmPm(closeTime)})</span>
                  </p>
                )}
                {isEndBeforeStart && (
                  <p className="text-[11px] font-bold text-rose-600 mt-1 ml-1 flex items-center gap-1.5">
                    <IconBan className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span>Blocked: End time must be later than start time</span>
                  </p>
                )}
              </div>
            </div>

            {/* Real-time Feasibility & Conflict Check Alert */}
            {slotFeasibility && !slotFeasibility.isAvailable && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 space-y-2 animate-fadeIn">
                <div className="flex items-start gap-2.5">
                  <IconAlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h5 className="text-xs font-bold text-rose-950 uppercase tracking-wide">
                      Schedule Conflict on Selected Date
                    </h5>
                    <div className="space-y-1 mt-1">
                      {slotFeasibility.conflicts.map((c, i) => (
                        <div key={i} className="text-xs font-medium text-rose-800 leading-snug">
                          <p>{c.message}</p>
                          {c.suggestedAvailableTime && (
                            <button
                              type="button"
                              onClick={() => {
                                if (c.type === 'insufficient_turnaround' && c.conflictingBooking) {
                                  const existEndStr = (c.conflictingBooking.end_time || '18:00').slice(0, 5);
                                  if (timeToMinutes(startTime) >= timeToMinutes(existEndStr)) {
                                    setStartTime(c.suggestedAvailableTime!);
                                    const dur = Math.max(60, timeToMinutes(endTime) - timeToMinutes(startTime));
                                    const newEnd = minutesToTime(Math.min(timeToMinutes(c.suggestedAvailableTime!) + dur, timeToMinutes(closeTime)));
                                    setEndTime(newEnd);
                                  } else {
                                    setEndTime(c.suggestedAvailableTime!);
                                  }
                                }
                              }}
                              className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-rose-300 rounded-lg text-[11px] font-bold text-rose-900 hover:bg-rose-100/50 cursor-pointer shadow-2xs transition-colors"
                            >
                              <IconArrow className="w-3.5 h-3.5 text-rose-700" />
                              <span>Auto-adjust time to {formatTimeAmPm(c.suggestedAvailableTime)}</span>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {slotFeasibility && slotFeasibility.isAvailable && opWindow.isOpen && !isStartOutOfRange && !isEndOutOfRange && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs animate-fadeIn">
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-emerald-200 flex items-center justify-center text-emerald-800 shrink-0">
                    <IconCheck className="w-2.5 h-2.5 stroke-[3]" />
                  </span>
                  <span className="font-bold text-emerald-950">
                    Selected Time Slot is Available!
                  </span>
                </div>
                <span className="text-[11px] font-semibold text-emerald-700">
                  Meets required {bookingSettings.default_turnaround_hours}h rest &amp; turnaround gap
                </span>
              </div>
            )}

            {/* Dynamic Duration and Turnaround Buffer Note */}
            <div className="flex flex-wrap items-center justify-between text-[11px] text-[#24252c]/70 pt-1">
              <span>
                Estimated Event Duration:{' '}
                <strong className={isStartOutOfRange || isEndOutOfRange ? 'text-rose-600' : 'text-[var(--ink)]'}>
                  {isStartOutOfRange || isEndOutOfRange
                    ? 'Invalid range (outside operating hours)'
                    : timeToMinutes(endTime) > timeToMinutes(startTime)
                    ? `${((timeToMinutes(endTime) - timeToMinutes(startTime)) / 60).toFixed(1)} Hours`
                    : 'Invalid range'}
                </strong>
              </span>
              <span className="text-emerald-700 font-semibold inline-flex items-center gap-1">
                <IconCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Constrained to operational window ({formatTimeAmPm(openTime)} – {formatTimeAmPm(closeTime)})</span>
              </span>
            </div>
          </div>
        );
      })()}

      {/* Tell Me About Your Event */}
      <div>
        <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50 ml-1 block mb-1">
          Tell Me About Your Event <span className="text-rose-500">*</span>
        </label>
        <textarea
          rows={3}
          value={eventDescription}
          onChange={(e) => setEventDescription(e.target.value)}
          placeholder="Tell us about the event schedule, venue acoustic expectations, special staging requests..."
          className="w-full rounded-2xl border border-transparent p-4 text-sm bg-[var(--mist)] text-[var(--ink)] focus:outline-none focus:border-[#1090F8]"
          required
        />
      </div>

      {/* Step 1 Price Breakdown (Package + Add-ons ONLY) */}
      <div className="p-4 rounded-2xl bg-[var(--mist)] border border-[#24252c]/[0.08] space-y-2.5 text-xs">
        <div className="flex items-center justify-between">
          <div>
            <span className="font-bold text-[var(--ink)] block">{selectedPkg.name}</span>
            <span className="text-[#24252c]/50 text-[11px]">Standard Package Base Rate</span>
          </div>
          <span className="font-bold text-[var(--ink)]">₱{currentPkgPrice.toLocaleString()}</span>
        </div>

        {selectedAddonStrings.length > 0 ? (
          <div className="pt-2 border-t border-[#24252c]/[0.06] space-y-1.5">
            <span className="text-[10px] font-extrabold text-[#1090F8] uppercase tracking-wider block">
              Selected Optional Equipment Add-ons ({selectedAddonStrings.length})
            </span>
            {selectedAddonStrings.map((addonStr, idx) => (
              <div key={idx} className="flex justify-between text-[#24252c]/80 text-[11px] font-medium pl-1">
                <span>• {addonStr}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="pt-1.5 text-[11px] text-[#24252c]/50">
            No optional equipment add-ons selected.
          </div>
        )}

        <div className="pt-2 border-t border-[#24252c]/[0.08] flex items-center justify-between">
          <span className="font-extrabold text-[var(--ink)]">Package & Add-ons Price</span>
          <span className="text-base font-extrabold text-[#1090F8]">₱{packageAndAddonPrice.toLocaleString()}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={onNext}
        className="w-full bg-[#1090F8] hover:bg-[#1090F8]/90 text-white text-sm font-semibold py-4 rounded-full transition-colors flex items-center justify-center gap-2 shadow-md cursor-pointer"
      >
        <span>Next: Logistics & Transport Fee</span>
        <IconArrow className="w-4 h-4" />
      </button>
    </div>
  );
}
