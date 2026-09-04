import { useState } from 'react';

import type { Page } from '../../types';
import { IconArrow, IconMenu, IconX } from '../shared/icons';
import { Logo } from './Logo';

export function Header({
  page,
  go,
  wishlistCount = 0,
  hasBanner = false,
}: {
  page: Page;
  go: (p: Page) => void;
  wishlistCount?: number;
  hasBanner?: boolean;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const authPage = page === 'login' || page === 'signup' || page === 'forgot' || page === 'otp';

  const handleNav = (target: Page) => {
    setMobileOpen(false);
    go(target);
  };

  const navItem = (label: string, target: Page, count?: number) => (
    <button
      onClick={() => handleNav(target)}
      className={`px-3.5 py-2 rounded-full text-sm font-medium transition-all outline-none focus:outline-none focus:ring-0 focus-visible:outline-none inline-flex items-center gap-1.5 ${
        page === target || (target === 'packages' && (page === 'package-detail' || page === 'custom-package')) || (target === 'equipment' && page === 'item-detail')
          ? 'bg-[var(--ink)] text-white font-semibold shadow-sm'
          : 'text-black/60 hover:text-[var(--ink)] hover:bg-black/5'
      }`}
    >
      <span>{label}</span>
      {count !== undefined && count > 0 && (
        <span
          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full transition-colors ${
            page === target ? 'bg-white text-[#1090F8]' : 'bg-[#1090F8] text-white shadow-xs'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );

  return (
    <header className={`fixed ${hasBanner ? 'top-9 sm:top-10' : 'top-4 sm:top-5'} inset-x-0 z-50 px-3 sm:px-4 md:px-8 transition-all duration-300`}>
      <div className="mx-auto max-w-6xl bg-white/90 backdrop-blur-md border border-[#24252c]/[0.08] rounded-full shadow-[0_4px_24px_-4px_rgba(0,0,0,.08)] px-4 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between">
        <button onClick={() => handleNav('landing')} className="pl-1 outline-none focus:outline-none focus-visible:outline-none cursor-pointer">
          <Logo />
        </button>

        <nav className="hidden lg:flex items-center gap-2">
          {navItem('Home', 'landing')}
          {navItem('Packages', 'packages')}
          {navItem('Custom Setup', 'custom-package')}
          {navItem('Equipment', 'equipment')}
          {navItem('About', 'about')}
          {navItem('Contact', 'contact')}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          {authPage ? (
            <button
              onClick={() => handleNav('packages')}
              className="text-sm font-semibold px-5 py-2.5 rounded-full bg-[var(--ink)] text-white hover:bg-[var(--ink-soft)] transition-colors inline-flex items-center gap-1.5 outline-none focus:outline-none focus-visible:outline-none shadow-sm"
            >
              Explore packages
              <IconArrow className="w-3.5 h-3.5" />
            </button>
          ) : (
            <>
              <button
                onClick={() => handleNav('login')}
                className="text-sm font-medium px-4.5 py-2 rounded-full hover:bg-[var(--mist)] transition-colors outline-none focus:outline-none focus-visible:outline-none text-[#24252c]/70 hover:text-[var(--ink)]"
              >
                Log in
              </button>
              <button
                onClick={() => handleNav('packages')}
                className="text-sm font-semibold px-5 py-2.5 rounded-full bg-[var(--ink)] text-white hover:bg-[var(--ink-soft)] transition-colors inline-flex items-center gap-1.5 outline-none focus:outline-none focus-visible:outline-none shadow-sm"
              >
                Book an event
                <IconArrow className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>

        <button className="lg:hidden p-2 outline-none focus:outline-none focus-visible:outline-none text-[var(--ink)]" onClick={() => setMobileOpen((v) => !v)} aria-label="Toggle menu">
          {mobileOpen ? <IconX /> : <IconMenu />}
        </button>
      </div>

      {mobileOpen && (
        <div className="mx-auto max-w-6xl mt-2 bg-white border border-[#24252c]/[0.08] rounded-3xl shadow-xl p-4 flex flex-col gap-1.5 lg:hidden animate-blur-in">
          {navItem('Home', 'landing')}
          {navItem('Packages', 'packages')}
          {navItem('Custom Setup', 'custom-package')}
          {navItem('Equipment Catalog', 'equipment')}
          {navItem('About', 'about')}
          {navItem('Contact', 'contact')}
          <div className="h-px bg-[#24252c]/[0.06] my-1" />
          {navItem('Log in', 'login')}
          {navItem('Sign up', 'signup')}
        </div>
      )}
    </header>
  );
}