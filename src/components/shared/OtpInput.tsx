import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';

const LENGTH = 6;
const RESEND_SECONDS = 60; // 60 seconds resend per user

interface OtpInputProps {
  value?: string;
  onChange?: (val: string) => void;
  onResend?: () => void;
  disabled?: boolean;
}

export function OtpInput({ value = '', onChange, onResend, disabled = false }: OtpInputProps) {
  const [digits, setDigits] = useState<string[]>(() => {
    const arr = Array(LENGTH).fill('');
    for (let i = 0; i < Math.min(value.length, LENGTH); i++) {
      arr[i] = value[i];
    }
    return arr;
  });
  const [seconds, setSeconds] = useState(RESEND_SECONDS);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  const handleChange = (index: number, val: string) => {
    const clean = val.replace(/\D/g, '');
    if (!clean && val !== '') return;
    const next = [...digits];
    next[index] = clean.slice(-1);
    setDigits(next);
    const combined = next.join('');
    if (onChange) onChange(combined);

    if (clean && index < LENGTH - 1) {
      refs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, LENGTH);
    if (!pasted) return;
    const next = Array(LENGTH).fill('');
    for (let i = 0; i < pasted.length; i++) {
      next[i] = pasted[i];
    }
    setDigits(next);
    const combined = next.join('');
    if (onChange) onChange(combined);
    const focusIndex = Math.min(pasted.length, LENGTH - 1);
    refs.current[focusIndex]?.focus();
  };

  const handleResendClick = () => {
    setDigits(Array(LENGTH).fill(''));
    if (onChange) onChange('');
    setSeconds(RESEND_SECONDS);
    if (onResend) onResend();
  };

  const timerLabel = `0:${String(seconds).padStart(2, '0')}`;

  return (
    <div>
      <div className="flex justify-center gap-2 sm:gap-2.5">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            inputMode="numeric"
            maxLength={1}
            value={d}
            disabled={disabled}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            autoFocus={i === 0}
            aria-label={`Digit ${i + 1}`}
            className="w-10 h-12 sm:w-12 sm:h-14 rounded-xl border border-transparent bg-[#EEEEEE] text-center text-lg sm:text-xl font-bold text-[var(--ink)] focus:outline-none focus:border-[#1090F8] transition-colors disabled:opacity-50"
          />
        ))}
      </div>

      <div className="mt-5 text-center">
        {seconds > 0 ? (
          <span className="text-xs font-medium text-[#24252c]/50">
            Resend code in <span className="font-bold text-[#1090F8]">{timerLabel}</span>
          </span>
        ) : (
          <button
            type="button"
            onClick={handleResendClick}
            disabled={disabled}
            className="text-xs font-semibold text-[#1090F8] hover:underline disabled:opacity-50"
          >
            Resend code
          </button>
        )}
      </div>
    </div>
  );
}