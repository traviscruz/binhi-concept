import binhiLogo from '../../assets/branding/BINHI Concept Logo.webp';

interface LogoProps {
  onClick?: () => void;
  className?: string;
}

export function Logo({ onClick, className = '' }: LogoProps) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-2.5 ${onClick ? 'cursor-pointer' : ''} ${className}`}
    >
      <img
        src={binhiLogo}
        alt="BINHI Concept"
        className="h-8 w-auto object-contain shrink-0"
        draggable={false}
      />
      <span className="font-semibold tracking-tight text-base">BINHI Concept</span>
    </div>
  );
}