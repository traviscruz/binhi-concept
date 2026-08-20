import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

const LENGTH = 6;
const RESEND_SECONDS = 30;

export function OtpInput() {
  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(''));
  const [seconds, setSeconds] = useState(RESEND_SECONDS);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  const handleChange = (index: number, value: string) => {
    const clean = value.replace(/\D/g, '');
    if (!clean) return;
    const next = [...digits];
    next[index] = clean.slice(-1);
    setDigits(next);
    if (index < LENGTH - 1) refs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  const resend = () => {
    setDigits(Array(LENGTH).fill(''));
    setSeconds(RESEND_SECONDS);
  };

  const timerLabel = `0:${String(seconds).padStart(2, '0')}`;

  return (
    <div>
      <div className="flex justify-center gap-2.5">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => { refs.current[i] = el; }}
            inputMode="numeric"
            maxLength={2}
            value={d}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            autoFocus={i === 0}
            aria-label={`Digit ${i + 1}`}
            className="w-12 h-14 rounded-xl border border-transparent bg-[#EEEEEE] text-center text-xl font-bold text-[var(--ink)] focus:outline-none focus:border-[#1090F8] transition-colors"
          />
        ))}
      </div>

      <div className="mt-5 text-center">
        {seconds > 0 ? (
          <span className="text-xs font-medium text-[#24252c]/50">
            Resend code in <span className="font-bold text-[#1090F8]">{timerLabel}</span>
          </span>
        ) : (
          <button onClick={resend} className="text-xs font-semibold text-[#1090F8] hover:underline">
            Resend code
          </button>
        )}
      </div>
    </div>
  );
}