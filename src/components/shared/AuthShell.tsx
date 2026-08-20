import type { ComponentType, ReactNode } from 'react';

import { MonoBadge } from './Badges';

export function AuthShell({
  badgeText,
  badgeIcon,
  title,
  subtitle,
  onBack,
  children,
}: {
  badgeText: string;
  badgeIcon?: ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  onBack?: () => void;
  children: ReactNode;
}) {
  return (
    <section className="min-h-screen flex flex-col items-center justify-center py-12 px-6 relative bg-white">
      <div className="w-full max-w-md">
        {onBack && (
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#24252c]/60 hover:text-[var(--ink)] transition-colors mb-6 group"
          >
            <span className="group-hover:-translate-x-0.5 transition-transform">←</span> Back to site
          </button>
        )}
        <div className="text-center mb-8">
          <MonoBadge icon={badgeIcon}>{badgeText}</MonoBadge>
          <h1 className="text-3xl font-extrabold tracking-tight mt-3">{title}</h1>
          <p className="text-[#24252c]/60 mt-2 text-[15px]">{subtitle}</p>
        </div>
        <div className="bg-[var(--mist)] rounded-[2rem] p-6 md:p-8 shadow-sm border border-[#24252c]/[0.06]">{children}</div>
      </div>
    </section>
  );
}