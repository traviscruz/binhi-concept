import { IconSearch } from './icons';

interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  title?: string;
  description?: string;
}

export function EmptyState({
  icon: Icon = IconSearch,
  title = 'No Matching Records Found',
  description = 'Try adjusting your search terms or filter settings to find what you are looking for.',
}: EmptyStateProps) {
  return (
    <div className="py-12 px-4 text-center flex flex-col items-center justify-center animate-blur-in">
      <div className="w-12 h-12 rounded-full bg-[var(--mist)] text-[#24252c]/40 flex items-center justify-center mb-3 border border-[#24252c]/10 shadow-inner">
        <Icon className="w-6 h-6" />
      </div>
      <h4 className="text-sm font-extrabold text-[var(--ink)] mb-1">{title}</h4>
      <p className="text-xs text-[#24252c]/50 max-w-xs sm:max-w-sm leading-relaxed">{description}</p>
    </div>
  );
}
