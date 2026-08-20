import type { Page } from '../../types';
import { MonoBadge } from '../shared/Badges';
import { IconChevronUp, IconExternal, IconTicket, IconX } from '../shared/icons';

const WORDMARK_BARS = [
  { h: 34, w: 10 }, { h: 58, w: 10 }, { h: 22, w: 8 },
  { h: 44, w: 10 }, { h: 66, w: 10 }, { h: 26, w: 8 },
  { h: 50, w: 10 }, { h: 30, w: 8 }, { h: 62, w: 10 },
  { h: 20, w: 8 }, { h: 46, w: 10 }, { h: 36, w: 8 },
  { h: 58, w: 10 }, { h: 24, w: 8 }, { h: 48, w: 10 },
];

export function Footer({ go }: { go: (p: Page) => void }) {
  return (
    <footer className="border-t border-[#24252c]/[0.06] pt-10 pb-8 px-6 bg-white">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between">
          <span className="w-11 h-11 rounded-2xl bg-[var(--ink)] text-white flex items-center justify-center">
            <IconTicket className="w-5 h-5" />
          </span>
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            aria-label="Back to top"
            className="w-11 h-11 rounded-2xl bg-[var(--ink)] text-white flex items-center justify-center hover:bg-[var(--ink-soft)] transition-colors"
          >
            <IconChevronUp className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-10 mt-14 text-base">
          <div>
            <div className="mb-3"><MonoBadge>Navigation</MonoBadge></div>
            <div className="flex flex-col gap-2 mt-2">
              <button onClick={() => go('landing')} className="text-left text-[#24252c]/70 hover:text-[var(--ink)] transition-colors">Home</button>
              <button onClick={() => go('packages')} className="text-left text-[#24252c]/70 hover:text-[var(--ink)] transition-colors">Packages</button>
              <button onClick={() => go('equipment')} className="text-left text-[#24252c]/70 hover:text-[var(--ink)] transition-colors">Equipment Catalog</button>
              <button onClick={() => go('about')} className="text-left text-[#24252c]/70 hover:text-[var(--ink)] transition-colors">About & Process</button>
              <button onClick={() => go('contact')} className="text-left text-[#24252c]/70 hover:text-[var(--ink)] transition-colors">Contact</button>
            </div>
          </div>
          <div>
            <div className="mb-3"><MonoBadge>Get in touch</MonoBadge></div>
            <div className="flex flex-col gap-2 mt-2">
              <button onClick={() => go('contact')} className="text-left text-[#24252c]/70 hover:text-[var(--ink)] transition-colors">Contact</button>
              <button onClick={() => go('signup')} className="text-left text-[#24252c]/70 hover:text-[var(--ink)] transition-colors">Book an event</button>
              <span className="text-[#24252c]/70">hello@binhiconcept.ph</span>
            </div>
          </div>
          <div>
            <div className="mb-3"><MonoBadge>Legal</MonoBadge></div>
            <div className="flex flex-col gap-2 mt-2">
              <span className="text-[#24252c]/70">Privacy Policy</span>
              <span className="text-[#24252c]/70">Terms of Service</span>
            </div>
          </div>
        </div>

        <div className="h-px bg-[#24252c]/[0.06] mt-14 mb-2" />

        <div className="relative select-none pointer-events-none pb-4 overflow-visible">
          <div className="absolute inset-x-0 bottom-[0.4em] flex items-end gap-[3%] px-[2%]">
            {WORDMARK_BARS.map((bar, i) => (
              <span
                key={i}
                className="bg-[#24252c]/[0.12] rounded-t-full"
                style={{ height: `${bar.h}%`, width: `${bar.w}px`, flexShrink: 0 }}
              />
            ))}
          </div>
          <div
            className="relative z-10 font-extrabold tracking-tighter leading-[0.98] text-[var(--ink)] pb-2"
            style={{ fontSize: 'clamp(2.6rem, 10vw, 7rem)' }}
          >
            BINHI Concept
          </div>
        </div>

        <div className="h-px bg-[#24252c]/[0.06] mt-6 mb-6" />

        <div className="flex items-center justify-between text-sm text-[#24252c]/45">
          <span>© 2026 BINHI Concept · All rights reserved.</span>
          <div className="flex items-center gap-4">
            <IconX className="w-4 h-4 hover:text-[var(--ink)] transition-colors cursor-pointer" />
            <IconExternal className="w-4 h-4 hover:text-[var(--ink)] transition-colors cursor-pointer" />
          </div>
        </div>
      </div>
    </footer>
  );
}