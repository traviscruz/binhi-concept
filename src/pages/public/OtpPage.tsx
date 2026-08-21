import { useState } from 'react';
import type { Page } from '../../types';
import { AuthShell } from '../../components/shared/AuthShell';
import { OtpInput } from '../../components/shared/OtpInput';
import { IconShield, IconEye, IconEyeOff } from '../../components/shared/icons';
import { supabase } from '../../utils/supabase';
import { validatePassword } from '../../utils/passwordValidation';
import { PasswordChecklist } from '../../components/shared/PasswordChecklist';

const inputClass =
  'w-full rounded-full border px-5 py-3.5 bg-[#EEEEEE] text-[var(--ink)] placeholder:text-[#24252c]/40 focus:outline-none focus:border-[#1090F8] border-transparent transition-colors';

export default function OtpPage({ go }: { go: (p: Page) => void }) {
  const [email, setEmail] = useState('');
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

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || otpToken.length < 6) {
      setErrorMsg('Please enter your email and the 6-digit OTP code.');
      return;
    }

    setLoading(true);
    setErrorMsg('');
    setInfoMsg('');

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
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPasswordValid) {
      setErrorMsg('Please ensure your password meets all requirements and passwords match.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        setErrorMsg(error.message);
        setLoading(false);
        return;
      }

      setLoading(false);
      go('login');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to update password.');
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email.trim()) {
      setErrorMsg('Please enter your email address to resend the code.');
      return;
    }
    setErrorMsg('');
    setInfoMsg('');
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
  };

  return (
    <AuthShell
      badgeText="Verify OTP"
      badgeIcon={IconShield}
      title={verified ? 'New Password' : 'Enter 6-digit Code'}
      subtitle={
        verified
          ? 'Set your new password to access your account.'
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
          <div>
            <label className="block text-xs font-semibold text-[#24252c]/70 mb-1.5 ml-3">
              Email Address
            </label>
            <input
              type="email"
              required
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </div>

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
            disabled={loading || otpToken.length < 6 || !email.trim()}
            className="mt-4 w-full bg-[var(--ink)] text-white font-semibold py-3.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
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
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[#24252c]/50 hover:text-[var(--ink)] transition-colors p-1"
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
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[#24252c]/50 hover:text-[var(--ink)] transition-colors p-1"
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
            className="w-full bg-[var(--ink)] text-white font-semibold py-3.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
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
          <button onClick={() => go('login')} className="font-semibold text-[#1090F8] hover:underline">
            Log in
          </button>
        </div>
      </div>
    </AuthShell>
  );
}