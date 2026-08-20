import { useState } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import { IconBox, IconPin, IconCalendar, IconCheck, IconX } from '../../components/shared/icons';

export interface ChecklistItem {
  id: string;
  name: string;
  serial: string;
  category: string;
  checked: boolean;
}

export default function CrewBookingDetailPage({ go }: { go: (p: Page) => void }) {
  const [note, setNote] = useState('');
  const [noteSavedModal, setNoteSavedModal] = useState(false);

  const [items, setItems] = useState<ChecklistItem[]>([
    { id: 'c1', name: 'Yamaha DBR12 Powered Speaker', serial: 'SPK-YAM-001', category: 'Audio PA System', checked: true },
    { id: 'c2', name: 'Yamaha DBR12 Powered Speaker', serial: 'SPK-YAM-002', category: 'Audio PA System', checked: true },
    { id: 'c3', name: 'Chauvet Intimidator Moving Head 260', serial: 'MH-CHV-001', category: 'Stage Lighting', checked: true },
    { id: 'c4', name: 'Chauvet Intimidator Moving Head 260', serial: 'MH-CHV-002', category: 'Stage Lighting', checked: false },
    { id: 'c5', name: 'P3 Outdoor LED Display Panel Pack (16x)', serial: 'LED-P3-PACK01', category: 'Visual Wall', checked: true },
    { id: 'c6', name: 'Low Fog Heavy Smoke Hazer Machine', serial: 'HAZ-SMK-001', category: 'Stage Effects', checked: false },
    { id: 'c7', name: 'Shure BLX24/PG58 Wireless Vocal Mic Set', serial: 'MIC-SHU-001', category: 'Microphones', checked: true },
    { id: 'c8', name: '50-Meter 16-Channel XLR Multi-Snake Cable', serial: 'CBL-SNK-001', category: 'Rigging & Cables', checked: true },
  ]);

  const toggleItem = (id: string) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, checked: !it.checked } : it))
    );
  };

  const checkedCount = items.filter((it) => it.checked).length;
  const progressPct = Math.round((checkedCount / items.length) * 100);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#24252c]/[0.06]">
        <div>
          <button onClick={() => go('crew-assigned-bookings')} className="text-xs text-[#1090F8] font-bold hover:underline mb-1 inline-block">
            ← Back to Assigned Bookings
          </button>
          <MonoBadge icon={IconBox}>Inspection & Equipment Checklist</MonoBadge>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ink)] mt-1.5">
            Booking Details & Gear Packing Checklist
          </h1>
          <p className="text-xs text-[#24252c]/60 mt-1">
            Verify assigned physical serial units, technical power specs, and warehouse dispatch readiness.
          </p>
        </div>

        <button
          onClick={() => go('crew-setup-teardown')}
          className="bg-[#1090F8] text-white text-xs font-bold px-5 py-2.5 rounded-full hover:bg-[#1090F8]/90 transition-colors shadow-sm self-start sm:self-auto"
        >
          Proceed to Setup Stage →
        </button>
      </div>

      {/* Booking Summary Card */}
      <div className="bg-white rounded-2xl p-6 border border-[#24252c]/[0.08] shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#24252c]/[0.06]">
          <div>
            <span className="font-mono font-extrabold text-sm text-[#1090F8]">BNH-2026-889</span>
            <h2 className="text-xl font-extrabold text-[var(--ink)] mt-0.5">Grand Wedding Production (P3 LED + Line Array)</h2>
          </div>
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20 uppercase">
            Setup In Progress
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-[#24252c]/50 font-semibold block">Client / Host:</span>
            <span className="font-bold text-[var(--ink)]">Patricia Reyes</span>
          </div>
          <div>
            <span className="text-[#24252c]/50 font-semibold block">Event Date:</span>
            <span className="font-bold text-[var(--ink)]">Sept 14, 2026</span>
          </div>
          <div>
            <span className="text-[#24252c]/50 font-semibold block">Venue Location:</span>
            <span className="font-bold text-[var(--ink)]">Shangri-La Fort, BGC</span>
          </div>
          <div>
            <span className="text-[#24252c]/50 font-semibold block">Lead Technician:</span>
            <span className="font-bold text-[#1090F8]">Marco Valenzuela</span>
          </div>
        </div>

        {/* Technical Specs Callout */}
        <div className="bg-[var(--mist)] p-4 rounded-xl border border-[#24252c]/[0.06] grid sm:grid-cols-3 gap-3 text-xs">
          <div>
            <span className="text-[#24252c]/50 font-semibold block uppercase tracking-wider text-[10px]">Power Requirements:</span>
            <span className="font-bold text-[var(--ink)]">Single 220V 30A Circuit</span>
          </div>
          <div>
            <span className="text-[#24252c]/50 font-semibold block uppercase tracking-wider text-[10px]">Rigging Setup Window:</span>
            <span className="font-bold text-[var(--ink)]">2.5 Hours Prior to Call</span>
          </div>
          <div>
            <span className="text-[#24252c]/50 font-semibold block uppercase tracking-wider text-[10px]">Required Crew Size:</span>
            <span className="font-bold text-[var(--ink)]">3 Audio/Lighting Techs</span>
          </div>
        </div>
      </div>

      {/* Interactive Equipment Inspection Checklist */}
      <div className="bg-white rounded-2xl p-6 border border-[#24252c]/[0.08] shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-base text-[var(--ink)]">Assigned Serial Units Checklist</h3>
            <p className="text-xs text-[#24252c]/60">Check off each item after bench testing and packing into truck.</p>
          </div>
          <div className="text-right">
            <span className="text-lg font-black text-[#1090F8]">{progressPct}% Packed</span>
            <span className="text-xs text-[#24252c]/50 block">({checkedCount} of {items.length} verified)</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-3 rounded-full bg-[var(--mist)] overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[var(--ink)] to-[#1090F8] rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Items List */}
        <div className="space-y-2.5 pt-2">
          {items.map((it) => (
            <label
              key={it.id}
              className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 cursor-pointer select-none transition-all ${
                it.checked
                  ? 'bg-emerald-500/[0.04] border-emerald-500/30'
                  : 'bg-white border-[#24252c]/10 hover:border-[#1090F8]/40'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <input
                  type="checkbox"
                  checked={it.checked}
                  onChange={() => toggleItem(it.id)}
                  className="w-4.5 h-4.5 accent-emerald-600 rounded cursor-pointer shrink-0"
                />
                <div className="min-w-0">
                  <div className={`font-bold text-xs ${it.checked ? 'text-emerald-950 line-through opacity-80' : 'text-[var(--ink)]'}`}>
                    {it.name}
                  </div>
                  <div className="text-[10px] text-[#24252c]/50 font-mono">
                    Serial Tag: <strong className="text-[#1090F8]">{it.serial}</strong> · Category: {it.category}
                  </div>
                </div>
              </div>

              <span
                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase shrink-0 ${
                  it.checked ? 'bg-emerald-500/10 text-emerald-600' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {it.checked ? 'Verified' : 'Pending'}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Crew Rigging Notes Form */}
      <div className="bg-white rounded-2xl p-6 border border-[#24252c]/[0.08] shadow-sm space-y-3 text-xs">
        <h3 className="font-extrabold text-base text-[var(--ink)]">Crew On-Site / Rigging Notes</h3>
        <textarea
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Enter notes regarding venue power outlets, stage clearance, cable lengths, or warehouse issues..."
          className="w-full rounded-2xl border px-4 py-2.5 bg-[#EEEEEE] focus:outline-none focus:border-[#1090F8] border-transparent transition-colors"
        />
        <button
          onClick={() => setNoteSavedModal(true)}
          className="bg-[var(--ink)] text-white text-xs font-semibold px-5 py-2.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors"
        >
          Save Crew Note
        </button>
      </div>

      {/* Note Saved Modal Overlay */}
      {noteSavedModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-blur-in">
          <div className="bg-white rounded-[2rem] p-6 max-w-sm w-full shadow-2xl border border-[#24252c]/10 relative text-center">
            <button onClick={() => setNoteSavedModal(false)} className="absolute top-5 right-5 text-[#24252c]/50 hover:text-[var(--ink)] p-1">
              <IconX className="w-5 h-5" />
            </button>
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 font-extrabold text-xl flex items-center justify-center mx-auto mb-3 border border-emerald-200">
              <IconCheck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-extrabold text-[var(--ink)] mb-1">Crew Note Logged</h3>
            <p className="text-xs text-[#24252c]/60 mb-5">
              On-site rigging note attached to booking <strong className="text-[var(--ink)] font-mono">BNH-2026-889</strong> successfully.
            </p>
            <button
              onClick={() => setNoteSavedModal(false)}
              className="w-full bg-[var(--ink)] text-white font-semibold py-3 rounded-full hover:bg-[var(--ink-soft)] transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
