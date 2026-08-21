import { validatePassword } from '../../utils/passwordValidation';

export function PasswordChecklist({ password }: { password: string }) {
  const reqs = validatePassword(password);

  if (!password) return null;

  return (
    <div className="mt-1.5 px-3 py-2 rounded-xl bg-[#EEEEEE]/80 border border-[#24252c]/[0.06] text-[11px] animate-blur-in">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-semibold text-[#24252c]/50 text-[10px] uppercase tracking-wider shrink-0">
          Must have:
        </span>

        <div
          className={`flex items-center gap-1 transition-colors ${
            reqs.minLength ? 'text-emerald-600 font-bold' : 'text-[#24252c]/40 font-medium'
          }`}
        >
          <span>{reqs.minLength ? '✓' : '○'}</span>
          <span>8+ chars</span>
        </div>

        <div
          className={`flex items-center gap-1 transition-colors ${
            reqs.hasUppercase ? 'text-emerald-600 font-bold' : 'text-[#24252c]/40 font-medium'
          }`}
        >
          <span>{reqs.hasUppercase ? '✓' : '○'}</span>
          <span>Uppercase</span>
        </div>

        <div
          className={`flex items-center gap-1 transition-colors ${
            reqs.hasNumber ? 'text-emerald-600 font-bold' : 'text-[#24252c]/40 font-medium'
          }`}
        >
          <span>{reqs.hasNumber ? '✓' : '○'}</span>
          <span>Number</span>
        </div>
      </div>
    </div>
  );
}
