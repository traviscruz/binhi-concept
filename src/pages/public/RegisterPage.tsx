import { useState } from 'react';
import type { Page } from '../../types';
import { AuthShell } from '../../components/shared/AuthShell';
import { OtpInput } from '../../components/shared/OtpInput';
import { IconUser, IconEye, IconEyeOff } from '../../components/shared/icons';
import { supabase } from '../../utils/supabase';

import { validatePassword } from '../../utils/passwordValidation';
import { PasswordChecklist } from '../../components/shared/PasswordChecklist';

const inputClass =
  'w-full rounded-full border px-5 py-3.5 bg-[#EEEEEE] text-[var(--ink)] placeholder:text-[#24252c]/40 focus:outline-none focus:border-[#1090F8] border-transparent transition-colors';

const STEPS = ['Details', 'Password', 'Verify'];

export default function RegisterPage({ go }: { go: (p: Page) => void }) {
  const [step, setStep] = useState(0);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [countryCode, setCountryCode] = useState('+63');
  const [phoneDigits, setPhoneDigits] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [otpToken, setOtpToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  const isPhoneValid = phoneDigits.length === 0 || phoneDigits.length === 10;
  const canContinueStep0 = firstName.trim() !== '' && lastName.trim() !== '' && email.trim() !== '' && isPhoneValid;
  const canContinueStep1 = validatePassword(password).isValid && password === confirmPassword;

  // Step 1 Submission: Trigger Supabase Auth Sign Up
  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canContinueStep1) return;

    setLoading(true);
    setErrorMsg('');
    setInfoMsg('');

    const formattedPhone = phoneDigits ? `${countryCode} ${phoneDigits}` : '';

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            full_name: `${firstName.trim()} ${lastName.trim()}`,
            phone: formattedPhone,
            role: 'customer', // Default role as customer
          },
        },
      });

      if (error) {
        setErrorMsg(error.message);
        setLoading(false);
        return;
      }

      setLoading(false);
      setInfoMsg(`A 6-digit confirmation code was sent to ${email}.`);
      setStep(2);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to sign up. Please try again.');
      setLoading(false);
    }
  };

  // Step 2 Submission: Verify 6-digit OTP code
  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (otpToken.length < 6) {
      setErrorMsg('Please enter the full 6-digit verification code.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      // First try signup type verification
      let { data, error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otpToken.trim(),
        type: 'signup',
      });

      if (error) {
        // Fallback try email type
        const res = await supabase.auth.verifyOtp({
          email: email.trim(),
          token: otpToken.trim(),
          type: 'email',
        });
        data = res.data;
        error = res.error;
      }

      if (error) {
        setErrorMsg(error.message);
        setLoading(false);
        return;
      }

      setLoading(false);
      // Account created and verified -> redirect to customer booking tracker
      go('booking-tracker');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Verification failed. Please check your OTP code.');
      setLoading(false);
    }
  };

  // Resend 6-digit OTP code handler
  const handleResendOtp = async () => {
    setErrorMsg('');
    setInfoMsg('');
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
      });
      if (error) {
        setErrorMsg(error.message);
      } else {
        setInfoMsg('New 6-digit verification code sent to your email.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to resend code.');
    }
  };

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

      {errorMsg && (
        <div className="mb-4 p-3.5 rounded-2xl text-xs bg-rose-50 border border-rose-200 text-rose-700 font-medium">
          {errorMsg}
        </div>
      )}

      {infoMsg && (
        <div className="mb-4 p-3.5 rounded-2xl text-xs bg-emerald-50 border border-emerald-200 text-emerald-700 font-medium">
          {infoMsg}
        </div>
      )}

      {step === 0 && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canContinueStep0) setStep(1);
          }}
          className="flex flex-col gap-3.5 animate-blur-in"
        >
          <input
            required
            autoFocus
            placeholder="First name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className={inputClass}
          />
          <input
            required
            placeholder="Last name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className={inputClass}
          />
          <input
            required
            type="email"
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
          <div>
            <div className="flex gap-2">
              <div className="w-24 shrink-0 bg-[#EEEEEE] rounded-full border border-transparent flex items-center justify-center font-bold text-xs text-[var(--ink)]">
                {countryCode}
              </div>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                placeholder="917 123 4567 (Optional)"
                value={phoneDigits}
                onChange={(e) => setPhoneDigits(e.target.value.replace(/\D/g, '').slice(0, 10))}
                className={inputClass + ' flex-1'}
              />
            </div>
            {phoneDigits.length > 0 && phoneDigits.length < 10 && (
              <p className="text-[11px] text-rose-500 ml-4 mt-1">
                Phone number must be exactly 10 digits (e.g. 9171234567).
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={!canContinueStep0}
            className="mt-2 bg-[var(--ink)] text-white font-semibold py-3.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next: Set up password →
          </button>
        </form>
      )}

      {step === 1 && (
        <form onSubmit={handleSignUpSubmit} className="flex flex-col gap-3.5 animate-blur-in">
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              autoFocus
              required
              minLength={6}
              placeholder="Create a password (min. 6 chars)"
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

          <PasswordChecklist password={password} />

          <div className="relative">
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              required
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
            <button
              type="button"
              onClick={() => setStep(0)}
              className="w-1/3 bg-[var(--mist)] text-[var(--ink)] text-sm font-semibold py-3.5 rounded-full border border-[#24252c]/10 hover:bg-[#EEEEEE]"
            >
              ← Back
            </button>
            <button
              type="submit"
              disabled={!canContinueStep1 || loading}
              className="w-2/3 bg-[var(--ink)] text-white font-semibold py-3.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                'Send OTP & Verify →'
              )}
            </button>
          </div>
        </form>
      )}

      {step === 2 && (
        <div className="animate-blur-in">
          <p className="text-xs text-[#24252c]/60 text-center mb-5">
            We sent a 6-digit verification code to{' '}
            <span className="font-semibold text-[var(--ink)]">{email}</span>.
          </p>

          <OtpInput
            value={otpToken}
            onChange={(val) => setOtpToken(val)}
            onResend={handleResendOtp}
            disabled={loading}
          />

          <button
            onClick={() => handleVerifyOtp()}
            disabled={loading || otpToken.length < 6}
            className="mt-6 w-full bg-[var(--ink)] text-white font-semibold py-3.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              'Verify & Create Account'
            )}
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