import { useState } from 'react';
import type { Page } from '../../types';
import { AuthShell } from '../../components/shared/AuthShell';
import { IconLock } from '../../components/shared/icons';
import { supabase } from '../../utils/supabase';
import { sendOtp } from '../../utils/smsService';

const inputClass =
  'w-full rounded-full border px-5 py-3.5 bg-[#EEEEEE] text-[var(--ink)] placeholder:text-[#24252c]/40 focus:outline-none focus:border-[#1090F8] border-transparent transition-colors';

export default function ForgotPasswordPage({ go }: { go: (p: Page) => void }) {
  const [channel, setChannel] = useState<'email' | 'sms'>('email');
  const [email, setEmail] = useState('');
  const [phoneDigits, setPhoneDigits] = useState('');
  const [countryCode] = useState('+63');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [sent, setSent] = useState(false);
  const [sentRecipient, setSentRecipient] = useState('');

  const handleSendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    if (channel === 'email') {
      const targetEmail = email.trim();
      if (!targetEmail) {
        setLoading(false);
        return;
      }

      try {
        // 1. Check if email exists in database (public.profiles table)
        const { data, error: profileErr } = await supabase
          .from('profiles')
          .select('id, email')
          .ilike('email', targetEmail)
          .maybeSingle();

        if (profileErr) {
          console.warn('Profile check warning:', profileErr.message);
        }

        if (!data) {
          setErrorMsg('No account found with this email address. Please check your spelling or create an account.');
          setLoading(false);
          return;
        }

        // 2. Email found -> send reset code
        const { error } = await supabase.auth.resetPasswordForEmail(targetEmail);
        if (error) {
          setErrorMsg(error.message);
          setLoading(false);
          return;
        }

        sessionStorage.setItem('binhi_reset_channel', 'email');
        sessionStorage.setItem('binhi_reset_email', targetEmail);
        setSentRecipient(targetEmail);
        setLoading(false);
        setSent(true);
      } catch (err: any) {
        setErrorMsg(err?.message || 'Failed to send reset code.');
        setLoading(false);
      }
    } else {
      // SMS Channel
      if (phoneDigits.length !== 10 || !phoneDigits.startsWith('9')) {
        setErrorMsg('Please enter a valid 10-digit Philippine mobile number starting with 9 (e.g. 9171234567).');
        setLoading(false);
        return;
      }

      try {
        // 1. Check if a profile with this phone number exists
        const { data, error: profileErr } = await supabase
          .from('profiles')
          .select('id, email, phone')
          .ilike('phone', `%${phoneDigits}%`)
          .maybeSingle();

        if (profileErr) {
          console.warn('Phone profile check warning:', profileErr.message);
        }

        if (!data) {
          setErrorMsg(`No account found with mobile number +63 ${phoneDigits}. Please verify the number or use your registered email.`);
          setLoading(false);
          return;
        }

        // 2. Dispatch SMS OTP via PhilSMS
        const fullPhone = `${countryCode}${phoneDigits}`;
        const res = await sendOtp(fullPhone, 'password_reset');

        if (!res.success || !res.token) {
          setErrorMsg(res.error || 'Failed to dispatch SMS verification code. Please try again.');
          setLoading(false);
          return;
        }

        sessionStorage.setItem('binhi_reset_channel', 'sms');
        sessionStorage.setItem('binhi_reset_phone', phoneDigits);
        sessionStorage.setItem('binhi_reset_token', res.token);
        if (data.email) {
          sessionStorage.setItem('binhi_reset_email', data.email);
        }

        setSentRecipient(`+63 ${phoneDigits}`);
        setLoading(false);
        setSent(true);
      } catch (err: any) {
        setErrorMsg(err?.message || 'Failed to dispatch reset SMS code.');
        setLoading(false);
      }
    }
  };

  return (
    <AuthShell
      badgeText="Reset password"
      badgeIcon={IconLock}
      title="Forgot your password?"
      subtitle={
        channel === 'email'
          ? 'Enter your registered email to receive a reset code.'
          : 'Enter your registered Philippine mobile number to receive an SMS reset code.'
      }
      onBack={() => go('login')}
    >
      {/* Recovery Method Segmented Tabs */}
      {!sent && (
        <div className="flex bg-[#EEEEEE] p-1 rounded-full mb-4">
          <button
            type="button"
            onClick={() => {
              setChannel('email');
              setErrorMsg('');
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-full transition-all cursor-pointer ${
              channel === 'email'
                ? 'bg-white text-[var(--ink)] shadow-xs'
                : 'text-[#24252c]/60 hover:text-[var(--ink)]'
            }`}
          >
            Email Address
          </button>
          <button
            type="button"
            onClick={() => {
              setChannel('sms');
              setErrorMsg('');
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-full transition-all cursor-pointer ${
              channel === 'sms'
                ? 'bg-white text-[var(--ink)] shadow-xs'
                : 'text-[#24252c]/60 hover:text-[var(--ink)]'
            }`}
          >
            Mobile Phone (SMS)
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="mb-4 p-3.5 rounded-2xl text-xs bg-rose-50 border border-rose-200 text-rose-700 font-medium">
          {errorMsg}
        </div>
      )}

      {sent ? (
        <div className="space-y-4 animate-blur-in text-center">
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
            Reset code sent to <span className="font-bold">{sentRecipient}</span> via {channel === 'email' ? 'email' : 'SMS text message'}.
          </div>
          <button
            onClick={() => go('otp')}
            className="w-full bg-[var(--ink)] text-white font-semibold py-3.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors cursor-pointer"
          >
            Enter 6-digit Code →
          </button>
        </div>
      ) : (
        <form onSubmit={handleSendReset} className="flex flex-col gap-3.5">
          {channel === 'email' ? (
            <div>
              <input
                type="email"
                required
                autoFocus
                placeholder="you@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </div>
          ) : (
            <div>
              <div className="flex gap-2">
                <div className="w-20 shrink-0 bg-[#EEEEEE] rounded-full border border-transparent flex items-center justify-center font-bold text-xs text-[var(--ink)]">
                  {countryCode}
                </div>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  required
                  autoFocus
                  value={phoneDigits}
                  onChange={(e) => setPhoneDigits(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="917 123 4567"
                  className={inputClass + ' flex-1'}
                />
              </div>
              {phoneDigits.length > 0 && (phoneDigits.length < 10 || !phoneDigits.startsWith('9')) && (
                <p className="text-[10px] text-rose-500 font-semibold ml-3 mt-1.5">
                  Must be 10 digits starting with 9 (e.g. 9171234567).
                </p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || (channel === 'sms' && phoneDigits.length !== 10)}
            className="mt-2 bg-[var(--ink)] text-white font-semibold py-3.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-xs"
          >
            {loading ? (
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : channel === 'email' ? (
              'Send Reset Code via Email'
            ) : (
              'Send Reset Code via SMS'
            )}
          </button>
        </form>
      )}

      <div className="mt-6 pt-5 border-t border-[#24252c]/[0.06] text-center">
        <div className="text-sm text-[#24252c]/60">
          Remembered your password?{' '}
          <button onClick={() => go('login')} className="font-semibold text-[#1090F8] hover:underline cursor-pointer">
            Log in
          </button>
        </div>
      </div>
    </AuthShell>
  );
}