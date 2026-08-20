import type { Page } from '../../types';
import { AuthShell } from '../../components/shared/AuthShell';
import { IconLock } from '../../components/shared/icons';

const inputClass =
  'w-full rounded-full border px-5 py-3.5 bg-[#EEEEEE] text-[var(--ink)] placeholder:text-[#24252c]/40 focus:outline-none focus:border-[#1090F8] border-transparent transition-colors';

export default function ForgotPasswordPage({ go }: { go: (p: Page) => void }) {
  return (
    <AuthShell badgeText="Reset password" badgeIcon={IconLock} title="Forgot your password?" subtitle="Enter your email for reset code." onBack={() => go('login')}>
      <form onSubmit={(e) => { e.preventDefault(); go('otp'); }} className="flex flex-col gap-3.5">
        <input autoFocus placeholder="you@email.com" className={inputClass} />
        <button type="submit" className="mt-2 bg-[var(--ink)] text-white font-semibold py-3.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors">
          Send reset code
        </button>
      </form>

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