import type { Page } from '../../types';
import { AuthShell } from '../../components/shared/AuthShell';
import { OtpInput } from '../../components/shared/OtpInput';
import { IconShield } from '../../components/shared/icons';

export default function OtpPage({ go }: { go: (p: Page) => void }) {
  return (
    <AuthShell badgeText="Verify" badgeIcon={IconShield} title="Enter code" subtitle="We sent a 6-digit code to your email." onBack={() => go('login')}>
      <div className="animate-blur-in">
        <OtpInput />

        <button onClick={() => go('login')} className="mt-6 w-full bg-[var(--ink)] text-white font-semibold py-3.5 rounded-full hover:bg-[var(--ink-soft)] transition-colors">
          Verify & Continue
        </button>
      </div>

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