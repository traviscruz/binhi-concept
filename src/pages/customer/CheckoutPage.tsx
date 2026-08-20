import { useState } from 'react';

import type { Page } from '../../types';
import { FEATURED_PACKAGES } from '../../data/packages';

export default function CheckoutPage({
  packageId,
  initialDate,
  initialAddons,
  go,
}: {
  packageId: string;
  initialDate: string;
  initialAddons: string[];
  go: (p: Page) => void;
}) {
  const pkg = FEATURED_PACKAGES.find((p) => p.id === packageId) || FEATURED_PACKAGES[1];
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [firstName, setFirstName] = useState('Juan');
  const [lastName, setLastName] = useState('Dela Cruz');
  const [email, setEmail] = useState('juan.delacruz@email.com');
  const [phone, setPhone] = useState('+63 917 123 4567');
  const [eventType, setEventType] = useState('Grand Wedding Reception');
  const [eventDate, setEventDate] = useState(initialDate || '2026-09-14');
  const [locationRegion, setLocationRegion] = useState('Metro Manila');
  const [venueAddress, setVenueAddress] = useState('Grand Ballroom, Shangri-La Fort, BGC, Taguig');
  const [selectedAddons, setSelectedAddons] = useState<string[]>(initialAddons);
  const [receiptUploaded, setReceiptUploaded] = useState(false);

  const locationFees: Record<string, number> = {
    'Metro Manila': 1500,
    'Tagaytay / Cavite': 3500,
    'Laguna / Batangas': 4500,
    'Bulacan / Pampanga': 4000,
  };

  const transportFee = locationFees[locationRegion] || 1500;
  const addonsCost = selectedAddons.length * 3500;
  const totalCost = pkg.rawPrice + addonsCost + transportFee;
  const depositRequired = totalCost * 0.5;

  const toggleAddon = (id: string) => {
    setSelectedAddons((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <section className="pt-36 pb-24 px-6 min-h-screen bg-[var(--mist)]">
      <div className="max-w-3xl mx-auto">
        {/* Boutique Split-Card Step Progress Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => go('package-detail')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#24252c]/60 hover:text-[var(--ink)] transition-colors group"
            >
              <span className="group-hover:-translate-x-0.5 transition-transform">←</span> Back to package details
            </button>
            <div className="text-right">
              <span className="text-[11px] font-mono uppercase tracking-widest text-[#24252c]/50 block">Booking Summary</span>
              <span className="text-xs sm:text-sm font-extrabold text-[var(--ink)]">{pkg.name} · <span className="text-[#1090F8]">₱{totalCost.toLocaleString()}</span></span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { num: '01', title: 'Contact & Event', desc: 'Who & When', s: 1 },
              { num: '02', title: 'Venue & Logistics', desc: 'Location Fee', s: 2 },
              { num: '03', title: '50% Deposit', desc: 'Slip Upload', s: 3 },
            ].map((st) => {
              const isActive = step === st.s;
              const isDone = step > st.s;
              const canClick = st.s <= step || isDone;

              return (
                <div
                  key={st.s}
                  onClick={() => canClick && setStep(st.s as 1 | 2 | 3)}
                  className={`p-4 rounded-2xl border transition-all duration-300 ${
                    canClick ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
                  } ${
                    isActive
                      ? 'bg-[#161823] text-white border-[#161823] shadow-lg scale-[1.02]'
                      : isDone
                      ? 'bg-white border-emerald-500/30 text-[var(--ink)] hover:border-emerald-500'
                      : 'bg-white border-[#24252c]/[0.08] text-[var(--ink)]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`text-[11px] font-extrabold mono ${
                        isActive
                          ? 'text-[#1090F8]'
                          : isDone
                          ? 'text-emerald-500'
                          : 'text-[#24252c]/40'
                      }`}
                    >
                      {isDone ? '✓ DONE' : `STEP ${st.num}`}
                    </span>
                    {isActive && (
                      <span className="w-2 h-2 rounded-full bg-[#1090F8] animate-pulse" />
                    )}
                  </div>
                  <h4 className={`font-bold text-xs sm:text-sm leading-tight ${isActive ? 'text-white' : 'text-[var(--ink)]'}`}>
                    {st.title}
                  </h4>
                  <p className={`text-[10px] mt-0.5 ${isActive ? 'text-white/60' : 'text-[#24252c]/50'}`}>
                    {st.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {step === 1 && (
          <div className="bg-white rounded-[2rem] p-6 md:p-8 border border-[#24252c]/[0.08] shadow-sm animate-blur-in space-y-5">
            <div>
              <h2 className="text-2xl font-extrabold text-[var(--ink)]">Step 1: Your Contact & Event Info</h2>
              <p className="text-xs text-[#24252c]/60 mt-1">Tell us who to send booking confirmations and crew updates to.</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50 ml-1 block mb-1">First Name</label>
                <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full rounded-full border border-transparent px-4 py-3 text-sm bg-[var(--mist)] text-[var(--ink)]" />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50 ml-1 block mb-1">Last Name</label>
                <input value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full rounded-full border border-transparent px-4 py-3 text-sm bg-[var(--mist)] text-[var(--ink)]" />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50 ml-1 block mb-1">Email Address</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-full border border-transparent px-4 py-3 text-sm bg-[var(--mist)] text-[var(--ink)]" />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50 ml-1 block mb-1">Mobile Phone Number</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full rounded-full border border-transparent px-4 py-3 text-sm bg-[var(--mist)] text-[var(--ink)]" />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50 ml-1 block mb-1">Event Format</label>
                <select value={eventType} onChange={(e) => setEventType(e.target.value)} className="w-full rounded-full border border-transparent px-4 py-3 text-sm bg-[var(--mist)] text-[var(--ink)]">
                  <option>Grand Wedding Reception</option>
                  <option>18th Birthday Debut</option>
                  <option>Corporate Product Launch / Gala</option>
                  <option>Live Band Concert</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50 ml-1 block mb-1">Event Date</label>
                <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="w-full rounded-full border border-transparent px-4 py-3 text-sm bg-[var(--mist)] text-[var(--ink)]" />
              </div>
            </div>

            <button onClick={() => setStep(2)} className="w-full bg-[var(--ink)] text-white text-sm font-semibold py-4 rounded-full hover:bg-[var(--ink-soft)] transition-colors inline-flex items-center justify-center gap-2">
              Next: Logistics & Transport Fee →
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="bg-white rounded-[2rem] p-6 md:p-8 border border-[#24252c]/[0.08] shadow-sm animate-blur-in space-y-5">
            <div>
              <h2 className="text-2xl font-extrabold text-[var(--ink)]">Step 2: Venue Logistics & Equipment Add-ons</h2>
              <p className="text-xs text-[#24252c]/60 mt-1">Specify venue location to calculate crew transport & trucking fee.</p>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50 ml-1 block mb-1">Venue Location Region</label>
              <select value={locationRegion} onChange={(e) => setLocationRegion(e.target.value)} className="w-full rounded-full border border-transparent px-4 py-3 text-sm bg-[var(--mist)] text-[var(--ink)] font-bold">
                <option>Metro Manila</option>
                <option>Tagaytay / Cavite</option>
                <option>Laguna / Batangas</option>
                <option>Bulacan / Pampanga</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50 ml-1 block mb-1">Venue Name & Full Address</label>
              <input value={venueAddress} onChange={(e) => setVenueAddress(e.target.value)} className="w-full rounded-full border border-transparent px-4 py-3 text-sm bg-[var(--mist)] text-[var(--ink)]" />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50 ml-1 block mb-2">Toggle Add-ons</label>
              <div className="space-y-2">
                {[
                  { id: 'add-smoke', name: 'Low-Lying Fog Cloud Machine (+₱4,500)' },
                  { id: 'add-mics', name: 'Extra Dual Wireless Host Microphones (+₱3,000)' },
                  { id: 'add-led', name: 'P3 HD LED Wall Display Upgrade (+₱18,000)' },
                ].map((a) => (
                  <div key={a.id} onClick={() => toggleAddon(a.id)} className="p-3 rounded-xl border bg-[var(--mist)] flex items-center gap-3 text-xs font-semibold cursor-pointer">
                    <input type="checkbox" checked={selectedAddons.includes(a.id)} onChange={() => {}} className="accent-[#1090F8]" />
                    <span>{a.name}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--mist)] text-xs space-y-1.5 border border-[#24252c]/[0.06]">
              <div className="flex justify-between text-[#24252c]/70"><span>Base Setup ({pkg.name})</span><span>{pkg.price}</span></div>
              <div className="flex justify-between text-[#24252c]/70"><span>Logistics Transport Fee ({locationRegion})</span><span>₱{transportFee.toLocaleString()}</span></div>
              <div className="h-px bg-[#24252c]/10 my-1" />
              <div className="flex justify-between text-sm font-extrabold text-[var(--ink)]"><span>Total Calculated Cost</span><span className="text-[#1090F8]">₱{totalCost.toLocaleString()}</span></div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="w-1/3 bg-[var(--mist)] text-[var(--ink)] text-sm font-semibold py-4 rounded-full border border-[#24252c]/10">
                ← Back
              </button>
              <button onClick={() => setStep(3)} className="w-2/3 bg-[var(--ink)] text-white text-sm font-semibold py-4 rounded-full hover:bg-[var(--ink-soft)] transition-colors">
                Next: Payment & Deposit →
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="bg-white rounded-[2rem] p-6 md:p-8 border border-[#24252c]/[0.08] shadow-sm animate-blur-in space-y-6">
            <div>
              <h2 className="text-2xl font-extrabold text-[var(--ink)]">Step 3: 50% Deposit & Reservation Slip</h2>
              <p className="text-xs text-[#24252c]/60 mt-1">Send 50% deposit to lock crew availability and upload your payment slip screenshot.</p>
            </div>

            <div className="p-5 rounded-2xl bg-[#1090F8]/10 border border-[#1090F8]/20 text-center">
              <div className="text-xs font-bold text-[#1090F8] uppercase tracking-wider">Required 50% Reservation Fee</div>
              <div className="text-3xl font-extrabold text-[#1090F8] mt-1">₱{depositRequired.toLocaleString()}</div>
              <div className="text-xs text-[#24252c]/60 mt-2">
                GCash: <span className="font-bold text-[var(--ink)]">0917-888-BINHI</span> · BDO: <span className="font-bold text-[var(--ink)]">00123-8899-00</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50 ml-1 block mb-2">
                Upload Payment Slip Screenshot
              </label>
              <div
                onClick={() => setReceiptUploaded(true)}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-colors ${
                  receiptUploaded
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-[#24252c]/20 bg-[var(--mist)] hover:border-[#1090F8]'
                }`}
              >
                {receiptUploaded ? (
                  <div>
                    <span className="w-10 h-10 rounded-full bg-emerald-500 text-white font-bold text-lg flex items-center justify-center mx-auto mb-2">✓</span>
                    <div className="text-xs font-bold text-emerald-700">deposit_slip_screenshot.png Uploaded!</div>
                    <div className="text-[10px] text-emerald-600 mt-1">Click to replace receipt image</div>
                  </div>
                ) : (
                  <div>
                    <div className="w-10 h-10 rounded-full bg-white text-[#1090F8] font-bold text-lg flex items-center justify-center mx-auto mb-2 shadow-sm">↑</div>
                    <div className="text-xs font-bold text-[var(--ink)]">Click to upload deposit slip image</div>
                    <div className="text-[10px] text-[#24252c]/50 mt-1">PNG, JPG, PDF up to 10MB</div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="w-1/3 bg-[var(--mist)] text-[var(--ink)] text-sm font-semibold py-4 rounded-full border border-[#24252c]/10">
                ← Back
              </button>
              <button
                onClick={() => go('booking-tracker')}
                className="w-2/3 bg-[var(--ink)] text-white text-sm font-semibold py-4 rounded-full hover:bg-[var(--ink-soft)] transition-colors shadow-md flex items-center justify-center gap-2"
              >
                <span>Submit Deposit & Lock Date</span> →
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}