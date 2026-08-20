import { useState } from 'react';

import type { Page } from '../../types';
import { AuthShell } from '../../components/shared/AuthShell';
import { OtpInput } from '../../components/shared/OtpInput';
import { IconUser, IconEye, IconEyeOff } from '../../components/shared/icons';

const inputClass =
  'w-full rounded-full border px-5 py-3.5 bg-[#EEEEEE] text-[var(--ink)] placeholder:text-[#24252c]/40 focus:outline-none focus:border-[#1090F8] border-transparent transition-colors';

const STEPS = ['Details', 'Password', 'Verify'];

export default function RegisterPage({ go }: { go: (p: Page) => void }) {
  const [step, setStep] = useState(0);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const canContinue =
    step === 0
      ? firstName.trim() && lastName.trim() && email.trim()
      : password.length > 0 && password === confirmPassword;

  return (
    <AuthShell
      badgeText="Create account"
      badgeIcon={IconUser}
      title="Join BINHI Concept"
      subtitle="Track bookings and earn rewards."
      onBack={() => (step > 0 ? setStep((s) => s - 1) : go('landing'))}
    >
      <div className="mb-6 p-1.5 bg-[#EEEEEE] rounded-full flex items-center justify-between gap-1 sm:gap-1.5 border border-[#24252c]/[0.06]">
        {STEPS.map((label, i) => {
          const isActive = i === step;
          const isDone = i < step;
          return (
            <div
              key={label}
              onClick={() => isDone && setStep(i)}
              className={`flex-1 flex items-center justify-center py-2 px-1.5 sm:px-2.5 rounded-full text-[11px] sm:text-xs transition-all duration-300 ${
                isDone ? 'cursor-pointer' : ''
              } ${
                isActive
                  ? 'bg-[var(--ink)] text-white font-bold shadow-md'
                  : isDone
                  ? 'bg-white text-emerald-600 font-semibold shadow-sm'
                  : 'text-[#24252c]/40 font-medium'
              }`}
            >
              <span className="flex items-center gap-1 sm:gap-1.5 truncate">
                {isDone ? (
                  <span className="text-emerald-500 font-extrabold text-xs">✓</span>
                ) : (
                  <span
                    className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full text-[9px] sm:text-[10px] flex items-center justify-center font-extrabold shrink-0 ${
                      isActive ? 'bg-[#1090F8] text-white' : 'bg-[#24252c]/10 text-[#24252c]/50'
                    }`}
                  >
                    {i + 1}
                  </span>
                )}
                <span className="truncate">{label}</span>
              </span>
            </div>
          );
        })}
      </div>

      {step === 0 && (
        <form
          onSubmit={(e) => { e.preventDefault(); setStep(1); }}
          className="flex flex-col gap-3.5 animate-blur-in"
        >
          <input autoFocus placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} />
          <input placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} />
          <input type="email" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
          <button type="submit" disabled={!canContinue} className="mt-2 bg-[var(--ink)] text-white font-semibold py-3.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            Next: Set up password →
          </button>
        </form>
      )}

      {step === 1 && (
        <form
          onSubmit={(e) => { e.preventDefault(); setStep(2); }}
          className="flex flex-col gap-3.5 animate-blur-in"
        >
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              autoFocus
              placeholder="Create a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass + ' pr-12'}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[#24252c]/50 hover:text-[var(--ink)] transition-colors p-1"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <IconEyeOff className="w-4 h-4" /> : <IconEye className="w-4 h-4" />}
            </button>
          </div>

          <div className="relative">
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={inputClass + ' pr-12'}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((v) => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[#24252c]/50 hover:text-[var(--ink)] transition-colors p-1"
              aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
            >
              {showConfirmPassword ? <IconEyeOff className="w-4 h-4" /> : <IconEye className="w-4 h-4" />}
            </button>
          </div>

          {password && confirmPassword && password !== confirmPassword && (
            <p className="text-[11px] text-rose-500 ml-4 -mt-1">Passwords don't match.</p>
          )}
          <div className="flex gap-3">
            <button type="button" onClick={() => setStep(0)} className="w-1/3 bg-[var(--mist)] text-[var(--ink)] text-sm font-semibold py-3.5 rounded-full border border-[#24252c]/10">
              ← Back
            </button>
            <button type="submit" disabled={!canContinue} className="w-2/3 bg-[var(--ink)] text-white font-semibold py-3.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              Next: Verify email →
            </button>
          </div>
        </form>
      )}

      {step === 2 && (
        <div className="animate-blur-in">
          <p className="text-xs text-[#24252c]/60 text-center mb-5">
            We sent a 6-digit code to <span className="font-semibold text-[var(--ink)]">{email || 'your email'}</span>.
          </p>
          <OtpInput />
          <button
            onClick={() => go('booking-tracker')}
            className="mt-6 w-full bg-[var(--ink)] text-white font-semibold py-3.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors"
          >
            Create account
          </button>
        </div>
      )}

      <div className="mt-6 pt-5 border-t border-[#24252c]/[0.06] text-center">
        <div className="text-sm text-[#24252c]/60">
          Already have an account?{' '}
          <button onClick={() => go('login')} className="font-semibold text-[#1090F8] hover:underline">
            Log in
          </button>
        </div>
      </div>
    </AuthShell>
  );
}