import { useState } from 'react';
import type { Page } from '../../types';
import { AuthShell } from '../../components/shared/AuthShell';
import { IconUser, IconEye, IconEyeOff } from '../../components/shared/icons';

const inputClass =
  'w-full rounded-full border px-5 py-3.5 bg-[#EEEEEE] text-[var(--ink)] placeholder:text-[#24252c]/40 focus:outline-none focus:border-[#1090F8] border-transparent transition-colors';

export default function LoginPage({ go }: { go: (p: Page) => void }) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <AuthShell badgeText="Log in" badgeIcon={IconUser} title="Welcome back" subtitle="Log in to track your bookings and rewards." onBack={() => go('landing')}>
      <form onSubmit={(e) => { e.preventDefault(); go('booking-tracker'); }} className="flex flex-col gap-3.5">
        <input autoFocus placeholder="you@email.com" className={inputClass} />
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
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
        <button type="submit" className="mt-2 bg-[var(--ink)] text-white font-semibold py-3.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors">
          Log in
        </button>
      </form>

      <div className="mt-6 pt-5 border-t border-[#24252c]/[0.06] space-y-3 text-center">
        <button onClick={() => go('forgot')} className="text-xs font-semibold text-[#24252c]/50 hover:text-[#1090F8] transition-colors">
          Forgot your password?
        </button>
        <div className="text-sm text-[#24252c]/60">
          Don't have an account?{' '}
          <button onClick={() => go('signup')} className="font-semibold text-[#1090F8] hover:underline">
            Create one
          </button>
        </div>

        <div className="pt-3 border-t border-[#24252c]/[0.06] space-y-2">
          <button
            type="button"
            onClick={() => go('booking-tracker')}
            className="w-full bg-[#1090F8] text-white text-xs font-bold py-3 rounded-full hover:bg-[#1090F8]/90 transition-all shadow-md inline-flex items-center justify-center gap-1.5"
          >
            <span>Demo: Log in as Customer</span> →
          </button>
          <button
            type="button"
            onClick={() => go('inventory-dashboard')}
            className="w-full bg-[var(--mist)] text-[var(--ink)] border border-[#24252c]/10 text-xs font-bold py-3 rounded-full hover:bg-[var(--ink)] hover:text-white transition-all shadow-sm inline-flex items-center justify-center gap-1.5"
          >
            <span>Demo: Log in as Inventory Manager</span> →
          </button>
          <button
            type="button"
            onClick={() => go('admin-dashboard')}
            className="w-full bg-[var(--ink)] text-white text-xs font-bold py-3 rounded-full hover:bg-[var(--ink-soft)] transition-all shadow-md inline-flex items-center justify-center gap-1.5"
          >
            <span>Demo: Log in as Admin (System Portal)</span> →
          </button>
          <button
            type="button"
            onClick={() => go('crew-assigned-bookings')}
            className="w-full bg-emerald-600 text-white text-xs font-bold py-3 rounded-full hover:bg-emerald-700 transition-all shadow-md inline-flex items-center justify-center gap-1.5"
          >
            <span>Demo: Log in as Crew (Event Portal)</span> →
          </button>
        </div>
      </div>
    </AuthShell>
  );
}