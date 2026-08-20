import { useState } from 'react';
import type { Page } from '../../types';
import { MonoBadge } from '../../components/shared/Badges';
import { OtpInput } from '../../components/shared/OtpInput';
import { IconShield, IconX, IconEye, IconEyeOff } from '../../components/shared/icons';

const inputClass =
  'w-full rounded-full border px-5 py-3.5 bg-[#EEEEEE] text-[var(--ink)] placeholder:text-[#24252c]/40 focus:outline-none focus:border-[#1090F8] border-transparent transition-colors text-sm';

export default function ProfilePage({ go }: { go: (p: Page) => void }) {
  const [firstName, setFirstName] = useState('Juan');
  const [lastName, setLastName] = useState('Dela Cruz');
  const [email, setEmail] = useState('juan.delacruz@gmail.com');
  const [phone, setPhone] = useState('+63 917 123 4567');
  const [password, setPassword] = useState('••••••••');
  const [showPassword, setShowPassword] = useState(false);
  const [venueRegion, setVenueRegion] = useState('Metro Manila');

  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleVerifyOtp = () => {
    setIsPhoneVerified(true);
    setShowOtpModal(false);
  };

  return (
    <section className="pt-36 pb-24 px-6 min-h-screen bg-white">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-[2rem] p-6 md:p-8 border border-[#24252c]/[0.08] shadow-sm">
          <div className="mb-6 pb-4 border-b border-[#24252c]/[0.06]">
            <MonoBadge icon={IconShield}>Account Settings</MonoBadge>
            <h1 className="text-3xl font-extrabold tracking-tight text-[var(--ink)] mt-2">
              Customer Profile & Security
            </h1>
            <p className="text-xs text-[#24252c]/60 mt-1">
              Manage your personal details, verified mobile contact, password, and venue preferences.
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSavedSuccess(true);
              setTimeout(() => setSavedSuccess(false), 3000);
            }}
            className="space-y-5"
          >
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50 ml-1 block mb-1">
                  First Name
                </label>
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50 ml-1 block mb-1">
                  Last Name
                </label>
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50 ml-1 block mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <div className="flex items-center justify-between ml-1 mb-1">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50">
                    Mobile Phone Number
                  </label>
                  {isPhoneVerified ? (
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                      Verified
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowOtpModal(true)}
                      className="text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full hover:bg-rose-100 transition-colors inline-flex items-center gap-1"
                    >
                      Unverified (Click to Verify)
                    </button>
                  )}
                </div>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50 ml-1 block mb-1">
                  Account Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputClass + ' pr-12'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#24252c]/50 hover:text-[var(--ink)] transition-colors p-1"
                  >
                    {showPassword ? <IconEyeOff className="w-4 h-4" /> : <IconEye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-[#24252c]/50 ml-1 block mb-1">
                  Default Venue Region
                </label>
                <select
                  value={venueRegion}
                  onChange={(e) => setVenueRegion(e.target.value)}
                  className={inputClass + ' font-semibold'}
                >
                  <option>Metro Manila</option>
                  <option>Tagaytay / Cavite</option>
                  <option>Laguna / Batangas</option>
                  <option>Bulacan / Pampanga</option>
                </select>
              </div>
            </div>

            {savedSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-semibold text-center border border-emerald-200">
                Profile details saved successfully.
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                className="bg-[var(--ink)] text-white text-xs font-semibold px-8 py-3.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors shadow-md"
              >
                Save Profile Updates
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* OTP Verification Modal */}
      {showOtpModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-blur-in">
          <div className="bg-white rounded-[2rem] p-6 md:p-8 max-w-md w-full shadow-2xl border border-[#24252c]/10 relative">
            <button
              onClick={() => setShowOtpModal(false)}
              className="absolute top-5 right-5 text-[#24252c]/50 hover:text-[var(--ink)] p-1"
            >
              <IconX className="w-5 h-5" />
            </button>

            <div className="text-center mb-6">
              <span className="w-12 h-12 rounded-full bg-[#1090F8]/10 text-[#1090F8] font-bold text-lg flex items-center justify-center mx-auto mb-3">
                <IconShield className="w-6 h-6" />
              </span>
              <h3 className="text-2xl font-extrabold text-[var(--ink)]">Verify Phone Number</h3>
              <p className="text-xs text-[#24252c]/60 mt-1.5 leading-relaxed">
                We sent a 6-digit security code to <strong className="text-[var(--ink)]">{phone}</strong>. Enter it below to confirm verification.
              </p>
            </div>

            <div className="my-6">
              <OtpInput />
            </div>

            <button
              onClick={handleVerifyOtp}
              className="w-full bg-[var(--ink)] text-white font-semibold py-3.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors text-xs"
            >
              Confirm Verification Code
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
