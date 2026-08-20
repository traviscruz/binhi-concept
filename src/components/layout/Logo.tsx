import { IconTicket } from '../shared/icons';

export function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-9 h-9 rounded-xl bg-[var(--ink)] text-white flex items-center justify-center shrink-0">
        <IconTicket className="w-4 h-4" />
      </span>
      <span className="font-semibold tracking-tight text-base">BINHI Concept</span>
    </div>
  );
}