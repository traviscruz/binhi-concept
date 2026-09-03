import React from 'react';

interface EquipmentCategoryPlaceholderProps {
  category?: string;
  name?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function EquipmentCategoryPlaceholder({
  category = '',
  name = '',
  className = '',
  size = 'md',
}: EquipmentCategoryPlaceholderProps) {
  const normCategory = (category || '').toLowerCase();

  // Determine category type and design theme
  let theme = {
    title: 'Audio Gear',
    label: 'Professional Audio Equipment',
    badge: 'Audio System',
    bgGradient: 'from-[#0b1329] via-[#131d3d] to-[#0a0f20]',
    accentGlow: 'rgba(59, 130, 246, 0.35)',
    iconColor: 'text-blue-400',
    ringColor: 'border-blue-500/20 bg-blue-500/10',
    subIcon: 'equalizer',
  };

  if (normCategory.includes('light')) {
    theme = {
      title: 'Lighting Rig',
      label: 'Stage & Ambient Lighting',
      badge: 'Lighting FX',
      bgGradient: 'from-[#221808] via-[#352510] to-[#171005]',
      accentGlow: 'rgba(245, 158, 11, 0.35)',
      iconColor: 'text-amber-400',
      ringColor: 'border-amber-500/20 bg-amber-500/10',
      subIcon: 'light',
    };
  } else if (normCategory.includes('video') || normCategory.includes('visual') || normCategory.includes('led')) {
    theme = {
      title: 'LED & Visuals',
      label: 'Video Display & Projection',
      badge: 'Visual System',
      bgGradient: 'from-[#081e28] via-[#0c2f3f] to-[#06141b]',
      accentGlow: 'rgba(6, 182, 212, 0.35)',
      iconColor: 'text-cyan-400',
      ringColor: 'border-cyan-500/20 bg-cyan-500/10',
      subIcon: 'video',
    };
  } else if (
    normCategory.includes('stage') ||
    normCategory.includes('effect') ||
    normCategory.includes('smoke') ||
    normCategory.includes('fog')
  ) {
    theme = {
      title: 'Stage Effects',
      label: 'Atmospheric & Special FX',
      badge: 'Stage FX',
      bgGradient: 'from-[#1c0f2a] via-[#2d1844] to-[#130a1c]',
      accentGlow: 'rgba(168, 85, 247, 0.35)',
      iconColor: 'text-purple-400',
      ringColor: 'border-purple-500/20 bg-purple-500/10',
      subIcon: 'effects',
    };
  } else if (!normCategory.includes('audio')) {
    theme = {
      title: 'Technical Gear',
      label: 'Production Hardware',
      badge: 'Hardware',
      bgGradient: 'from-[#14161f] via-[#1d2230] to-[#0f1118]',
      accentGlow: 'rgba(148, 163, 184, 0.25)',
      iconColor: 'text-slate-300',
      ringColor: 'border-slate-500/20 bg-slate-500/10',
      subIcon: 'hardware',
    };
  }

  const renderIcon = () => {
    switch (theme.subIcon) {
      case 'light':
        return (
          <svg
            className={size === 'lg' ? 'w-16 h-16' : 'w-10 h-10'}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2v3M4.93 4.93l2.12 2.12M2 12h3M4.93 19.07l2.12-2.12M19.07 4.93l-2.12 2.12M22 12h-3" />
            <path d="M9 12a3 3 0 1 0 6 0 3 3 0 0 0-6 0" fill="currentColor" fillOpacity="0.2" />
            <path d="m14 16 2.5 4M10 16l-2.5 4M8 20h8" />
          </svg>
        );
      case 'video':
        return (
          <svg
            className={size === 'lg' ? 'w-16 h-16' : 'w-10 h-10'}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="2" y="4" width="20" height="13" rx="2.5" fill="currentColor" fillOpacity="0.15" />
            <path d="M7 20h10M12 17v3" />
            <path d="M6 8h4M6 12h2M14 8h4M16 12h2" strokeDasharray="1 1.5" />
            <circle cx="12" cy="10.5" r="1.75" fill="currentColor" />
          </svg>
        );
      case 'effects':
        return (
          <svg
            className={size === 'lg' ? 'w-16 h-16' : 'w-10 h-10'}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" fill="currentColor" fillOpacity="0.2" />
            <path d="M8 8l1.5 2M16 6l1 1.5M12 3v2.5" strokeDasharray="1 2" />
            <path d="m19 8 1.5 1.5M4 14l2 .5" />
          </svg>
        );
      case 'hardware':
        return (
          <svg
            className={size === 'lg' ? 'w-16 h-16' : 'w-10 h-10'}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path
              d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
              fill="currentColor"
              fillOpacity="0.15"
            />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
            <circle cx="12" cy="7" r="1" fill="currentColor" />
          </svg>
        );
      case 'equalizer':
      default:
        return (
          <svg
            className={size === 'lg' ? 'w-16 h-16' : 'w-10 h-10'}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M11 5L6 9H2v6h4l5 4V5z" fill="currentColor" fillOpacity="0.2" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14" />
            <line x1="6" y1="12" x2="2" y2="12" />
          </svg>
        );
    }
  };

  return (
    <div
      className={`w-full h-full relative overflow-hidden bg-gradient-to-br ${theme.bgGradient} flex flex-col items-center justify-center select-none ${className}`}
    >
      {/* Dynamic Ambient Backlight Glow */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40 blur-3xl"
        style={{
          background: `radial-gradient(circle at center, ${theme.accentGlow} 0%, transparent 70%)`,
        }}
      />

      {/* Subtle Background Circuit / Grid Pattern */}
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />

      {/* Center Icon Badge Display */}
      <div className="relative z-10 flex flex-col items-center text-center p-4">
        <div
          className={`p-3.5 sm:p-4 rounded-2xl border backdrop-blur-md shadow-2xl transition-transform duration-300 group-hover:scale-105 ${theme.ringColor} ${theme.iconColor}`}
        >
          {renderIcon()}
        </div>

        <div className="mt-3 flex flex-col items-center">
          <span className="text-[11px] sm:text-xs font-bold tracking-wider uppercase text-white/90">
            {category || theme.badge}
          </span>
          <span className="text-[10px] text-white/45 font-medium mt-0.5">
            {theme.label}
          </span>
        </div>
      </div>
    </div>
  );
}
