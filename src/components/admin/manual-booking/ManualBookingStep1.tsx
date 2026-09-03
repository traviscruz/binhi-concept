import { useState } from 'react';
import type { PackageData } from '../../../data/packages';
import type { AddonModel, AddonSelection } from './types';
import { CHANNELS } from './types';
import { IconArrow, IconChevronDown, IconChevronUp } from '../../shared/icons';
import { isPastDate, type DBBooking } from '../../../utils/bookingService';

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
  eventDescription: string;
  setEventDescription: (val: string) => void;
  dbBookings: DBBooking[];
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
  eventDescription,
  setEventDescription,
  dbBookings,
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
          <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50 ml-1 block mb-1">
            Event Date <span className="text-rose-500">*</span>
          </label>
          <input
            type="date"
            value={eventDate}
            min={new Date().toISOString().split('T')[0]}
            onChange={(e) => setEventDate(e.target.value)}
            className={`w-full rounded-full border px-4 py-3 text-sm font-semibold focus:outline-none ${
              isPastDate(eventDate) || dbBookings.some((b) => b.event_date === eventDate)
                ? 'border-rose-400 bg-rose-50/50 text-rose-800'
                : 'border-transparent bg-[var(--mist)] text-[var(--ink)] focus:border-[#1090F8]'
            }`}
            required
          />
          {(isPastDate(eventDate) || dbBookings.some((b) => b.event_date === eventDate)) && (
            <p className="text-[11px] font-bold text-rose-600 mt-1 ml-2">
              {isPastDate(eventDate)
                ? 'Past Date: Please choose a future event date.'
                : 'Reserved Date: This date is already booked in database. Please select an available date.'}
            </p>
          )}
        </div>
      </div>

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
