import { useState, useEffect } from 'react';
import type { Page } from '../../types';
import { AuthShell } from '../../components/shared/AuthShell';
import { OtpInput } from '../../components/shared/OtpInput';
import { IconShield, IconEye, IconEyeOff } from '../../components/shared/icons';
import { supabase } from '../../utils/supabase';
import { validatePassword } from '../../utils/passwordValidation';
import { PasswordChecklist } from '../../components/shared/PasswordChecklist';
import { sendOtp, verifyOtp, resetPasswordViaSms } from '../../utils/smsService';

const inputClass =
  'w-full rounded-full border px-5 py-3.5 bg-[#EEEEEE] text-[var(--ink)] placeholder:text-[#24252c]/40 focus:outline-none focus:border-[#1090F8] border-transparent transition-colors';

export default function OtpPage({ go }: { go: (p: Page) => void }) {
  const [channel, setChannel] = useState<'email' | 'sms'>('email');
  const [email, setEmail] = useState('');
  const [phoneDigits, setPhoneDigits] = useState('');
  const [phoneHmacToken, setPhoneHmacToken] = useState('');
  const [countryCode] = useState('+63');

  const [otpToken, setOtpToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  const isPasswordValid = validatePassword(newPassword).isValid && newPassword === confirmPassword;

  useEffect(() => {
    const savedChannel = sessionStorage.getItem('binhi_reset_channel');
    if (savedChannel === 'sms') {
      setChannel('sms');
    }
    const savedPhone = sessionStorage.getItem('binhi_reset_phone');
    if (savedPhone) setPhoneDigits(savedPhone);

    const savedToken = sessionStorage.getItem('binhi_reset_token');
    if (savedToken) setPhoneHmacToken(savedToken);

    const savedEmail = sessionStorage.getItem('binhi_reset_email');
    if (savedEmail) setEmail(savedEmail);
  }, []);

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');

    if (otpToken.trim().length < 6) {
      setErrorMsg('Please enter the full 6-digit OTP verification code.');
      return;
    }

    setLoading(true);

    if (channel === 'sms') {
      if (phoneDigits.length !== 10 || !phoneDigits.startsWith('9')) {
        setErrorMsg('Please enter a valid 10-digit Philippine mobile number starting with 9.');
        setLoading(false);
        return;
      }

      if (!phoneHmacToken) {
        setErrorMsg('Verification session token is missing. Please request a new code.');
        setLoading(false);
        return;
      }

      try {
        const fullPhone = `${countryCode}${phoneDigits}`;
        const res = await verifyOtp(fullPhone, otpToken.trim(), phoneHmacToken);

        if (!res.valid) {
          setErrorMsg(res.error || 'Incorrect or expired SMS verification code. Please try again.');
          setLoading(false);
          return;
        }

        setLoading(false);
        setVerified(true);
        setInfoMsg('Mobile verification code approved! Please set your new password below.');
      } catch (err: any) {
        setErrorMsg(err?.message || 'Failed to verify SMS code.');
        setLoading(false);
      }
    } else {
      // Email verification
      if (!email.trim()) {
        setErrorMsg('Please enter your email address.');
        setLoading(false);
        return;
      }

      try {
        // Verify OTP code for recovery or email
        let { data, error } = await supabase.auth.verifyOtp({
          email: email.trim(),
          token: otpToken.trim(),
          type: 'recovery',
        });

        if (error) {
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
        setVerified(true);
        setInfoMsg('Code verified successfully! Please enter your new password.');
      } catch (err: any) {
        setErrorMsg(err?.message || 'Failed to verify OTP code.');
        setLoading(false);
      }
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPasswordValid) {
      setErrorMsg('Please ensure your password meets all requirements and passwords match.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    if (channel === 'sms') {
      try {
        const fullPhone = `${countryCode}${phoneDigits}`;
        const res = await resetPasswordViaSms(
          fullPhone,
          otpToken.trim(),
          phoneHmacToken,
          newPassword
        );

        if (!res.valid) {
          setErrorMsg(res.error || 'Failed to update password.');
          setLoading(false);
          return;
        }

        // Clean up session storage
        sessionStorage.removeItem('binhi_reset_channel');
        sessionStorage.removeItem('binhi_reset_phone');
        sessionStorage.removeItem('binhi_reset_token');
        sessionStorage.removeItem('binhi_reset_email');

        setLoading(false);
        go('login');
      } catch (err: any) {
        setErrorMsg(err?.message || 'Failed to update password.');
        setLoading(false);
      }
    } else {
      // Email update
      try {
        const { error } = await supabase.auth.updateUser({
          password: newPassword,
        });

        if (error) {
          setErrorMsg(error.message);
          setLoading(false);
          return;
        }

        // Clean up session storage
        sessionStorage.removeItem('binhi_reset_channel');
        sessionStorage.removeItem('binhi_reset_phone');
        sessionStorage.removeItem('binhi_reset_token');
        sessionStorage.removeItem('binhi_reset_email');

        setLoading(false);
        go('login');
      } catch (err: any) {
        setErrorMsg(err?.message || 'Failed to update password.');
        setLoading(false);
      }
    }
  };

  const handleResend = async () => {
    setErrorMsg('');
    setInfoMsg('');

    if (channel === 'sms') {
      if (phoneDigits.length !== 10 || !phoneDigits.startsWith('9')) {
        setErrorMsg('Please enter your 10-digit mobile number to resend code.');
        return;
      }

      try {
        const fullPhone = `${countryCode}${phoneDigits}`;
        const res = await sendOtp(fullPhone, 'password_reset');
        if (res.success && res.token) {
          setPhoneHmacToken(res.token);
          sessionStorage.setItem('binhi_reset_token', res.token);
          if (res.simulated) {
            setInfoMsg(`Simulated OTP Mode: Use verification code ${res.simulatedCode || '123456'}.`);
          } else {
            setInfoMsg(`A new 6-digit verification code was sent via SMS to +63 ${phoneDigits}.`);
          }
        } else {
          setErrorMsg(res.error || 'Failed to resend SMS code.');
        }
      } catch (err: any) {
        setErrorMsg(err?.message || 'Failed to resend code.');
      }
    } else {
      if (!email.trim()) {
        setErrorMsg('Please enter your email address to resend the code.');
        return;
      }
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
        if (error) {
          setErrorMsg(error.message);
        } else {
          setInfoMsg('A new 6-digit verification code was sent to your email.');
        }
      } catch (err: any) {
        setErrorMsg(err?.message || 'Failed to resend code.');
      }
    }
  };

  return (
    <AuthShell
      badgeText="Verify OTP"
      badgeIcon={IconShield}
      title={verified ? 'New Password' : 'Enter 6-digit Code'}
      subtitle={
        verified
          ? 'Set your new password to access your account.'
          : channel === 'sms'
          ? `Enter the verification code sent via SMS to +63 ${phoneDigits || 'your mobile phone'}.`
          : 'Enter the verification code sent to your email.'
      }
      onBack={() => go('login')}
    >
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

      {!verified ? (
        <form onSubmit={handleVerifyOtp} className="space-y-4 animate-blur-in">
          {channel === 'sms' ? (
            <div>
              <div className="flex items-center justify-between mb-1.5 ml-3">
                <label className="text-xs font-semibold text-[#24252c]/70">
                  Mobile Phone Number
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setChannel('email');
                    setErrorMsg('');
                    setInfoMsg('');
                  }}
                  className="text-[11px] font-bold text-[#1090F8] hover:underline cursor-pointer"
                >
                  Use Email instead?
                </button>
              </div>
              <div className="flex gap-2">
                <div className="w-20 shrink-0 bg-[#EEEEEE] rounded-full border border-transparent flex items-center justify-center font-bold text-xs text-[var(--ink)]">
                  {countryCode}
                </div>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  required
                  value={phoneDigits}
                  onChange={(e) => setPhoneDigits(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="917 123 4567"
                  className={inputClass + ' flex-1'}
                />
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-1.5 ml-3">
                <label className="text-xs font-semibold text-[#24252c]/70">
                  Email Address
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setChannel('sms');
                    setErrorMsg('');
                    setInfoMsg('');
                  }}
                  className="text-[11px] font-bold text-[#1090F8] hover:underline cursor-pointer"
                >
                  Use SMS instead?
                </button>
              </div>
              <input
                type="email"
                required
                placeholder="you@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#24252c]/70 mb-2 ml-3">
              6-Digit Security Code
            </label>
            <OtpInput
              value={otpToken}
              onChange={(val) => setOtpToken(val)}
              onResend={handleResend}
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={
              loading ||
              otpToken.length < 6 ||
              (channel === 'email' ? !email.trim() : phoneDigits.length !== 10)
            }
            className="mt-4 w-full bg-[var(--ink)] text-white font-semibold py-3.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-xs"
          >
            {loading ? (
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              'Verify Code →'
            )}
          </button>
        </form>
      ) : (
        <form onSubmit={handleUpdatePassword} className="space-y-4 animate-blur-in">
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              placeholder="Create new password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={inputClass + ' pr-12'}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[#24252c]/50 hover:text-[var(--ink)] transition-colors p-1 cursor-pointer"
            >
              {showPassword ? <IconEyeOff className="w-4 h-4" /> : <IconEye className="w-4 h-4" />}
            </button>
          </div>

          <PasswordChecklist password={newPassword} />

          <div className="relative">
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              required
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={inputClass + ' pr-12'}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((v) => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[#24252c]/50 hover:text-[var(--ink)] transition-colors p-1 cursor-pointer"
            >
              {showConfirmPassword ? <IconEyeOff className="w-4 h-4" /> : <IconEye className="w-4 h-4" />}
            </button>
          </div>

          {newPassword && confirmPassword && newPassword !== confirmPassword && (
            <p className="text-[11px] text-rose-500 ml-3 -mt-1">Passwords do not match.</p>
          )}

          <button
            type="submit"
            disabled={loading || !isPasswordValid}
            className="w-full bg-[var(--ink)] text-white font-semibold py-3.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-xs"
          >
            {loading ? (
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              'Save New Password & Log In'
            )}
          </button>
        </form>
      )}

      <div className="mt-6 pt-5 border-t border-[#24252c]/[0.06] text-center">
        <div className="text-sm text-[#24252c]/60">
          Back to{' '}
          <button onClick={() => go('login')} className="font-semibold text-[#1090F8] hover:underline cursor-pointer">
            Log in
          </button>
        </div>
      </div>
    </AuthShell>
  );
}