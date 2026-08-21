import { useState } from 'react';
import type { Page } from '../../types';
import { AuthShell } from '../../components/shared/AuthShell';
import { IconLock } from '../../components/shared/icons';
import { supabase } from '../../utils/supabase';

const inputClass =
  'w-full rounded-full border px-5 py-3.5 bg-[#EEEEEE] text-[var(--ink)] placeholder:text-[#24252c]/40 focus:outline-none focus:border-[#1090F8] border-transparent transition-colors';

export default function ForgotPasswordPage({ go }: { go: (p: Page) => void }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [sent, setSent] = useState(false);

  const handleSendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmail = email.trim();
    if (!targetEmail) return;

    setLoading(true);
    setErrorMsg('');

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

      setLoading(false);
      setSent(true);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to send reset code.');
      setLoading(false);
    }
  };

  return (
    <AuthShell
      badgeText="Reset password"
      badgeIcon={IconLock}
      title="Forgot your password?"
      subtitle="Enter your registered email to receive a reset code."
      onBack={() => go('login')}
    >
      {errorMsg && (
        <div className="mb-4 p-3.5 rounded-2xl text-xs bg-rose-50 border border-rose-200 text-rose-700 font-medium">
          {errorMsg}
        </div>
      )}

      {sent ? (
        <div className="space-y-4 animate-blur-in text-center">
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
            Reset code sent to <span className="font-bold">{email}</span>. Please check your inbox.
          </div>
          <button
            onClick={() => go('otp')}
            className="w-full bg-[var(--ink)] text-white font-semibold py-3.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors"
          >
            Enter 6-digit Code →
          </button>
        </div>
      ) : (
        <form onSubmit={handleSendReset} className="flex flex-col gap-3.5">
          <input
            type="email"
            required
            autoFocus
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
          <button
            type="submit"
            disabled={loading}
            className="mt-2 bg-[var(--ink)] text-white font-semibold py-3.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              'Send Reset Code'
            )}
          </button>
        </form>
      )}

      <div className="mt-6 pt-5 border-t border-[#24252c]/[0.06] text-center">
        <div className="text-sm text-[#24252c]/60">
          Remembered your password?{' '}
          <button onClick={() => go('login')} className="font-semibold text-[#1090F8] hover:underline">
            Log in
          </button>
        </div>
      </div>
    </AuthShell>
  );
}