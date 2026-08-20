import type { ComponentType, ReactNode } from 'react';

export function MonoBadge({
  children,
  icon: Icon,
}: {
  children: ReactNode;
  icon?: ComponentType<{ className?: string }>;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--mist)] px-3.5 py-1 text-[11px] mono uppercase tracking-widest text-[#24252c]/60">
      {Icon && <Icon className="w-3.5 h-3.5 text-current" />}
      {children}
    </span>
  );
}

export function MonoBadgeDark({
  children,
  icon: Icon,
}: {
  children: ReactNode;
  icon?: ComponentType<{ className?: string }>;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1 text-[11px] mono uppercase tracking-widest text-white/60">
      {Icon && <Icon className="w-3.5 h-3.5 text-current" />}
      {children}
    </span>
  );
}