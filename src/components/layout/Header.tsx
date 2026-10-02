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
      className={`px-2.5 xl:px-3.5 py-1.5 xl:py-2 rounded-full text-xs xl:text-sm font-medium transition-all outline-none focus:outline-none focus:ring-0 focus-visible:outline-none inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
        page === target || (target === 'packages' && page === 'package-detail') || (target === 'equipment' && page === 'item-detail')
          ? 'bg-[var(--ink)] text-white font-semibold shadow-sm'
          : 'text-black/60 hover:text-[var(--ink)] hover:bg-black/5'
      }`}
    >
      <span className="whitespace-nowrap">{label}</span>
      {count !== undefined && count > 0 && (
        <span
          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full transition-colors shrink-0 ${
            page === target ? 'bg-white text-[#1090F8]' : 'bg-[#1090F8] text-white shadow-xs'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );

  return (
    <header className={`fixed ${hasBanner ? 'top-9 sm:top-10' : 'top-4 sm:top-5'} inset-x-0 z-50 px-3 sm:px-4 md:px-6 xl:px-8 transition-all duration-300`}>
      <div className="mx-auto max-w-6xl 2xl:max-w-7xl bg-white/90 backdrop-blur-md border border-[#24252c]/[0.08] rounded-full shadow-[0_4px_24px_-4px_rgba(0,0,0,.08)] px-3 sm:px-5 xl:px-6 py-2 sm:py-2.5 xl:py-3 flex items-center justify-between gap-2 xl:gap-4">
        <button onClick={() => handleNav('landing')} className="pl-1 outline-none focus:outline-none focus-visible:outline-none cursor-pointer shrink-0">
          <Logo />
        </button>

        <nav className="hidden lg:flex items-center gap-1 xl:gap-1.5 flex-nowrap shrink-0">
          {navItem('Home', 'landing')}
          {navItem('Packages', 'packages')}
          {navItem('Custom Setup', 'custom-package')}
          {navItem('Equipment', 'equipment')}
          {navItem('Partners', 'affiliates')}
          {navItem('About', 'about')}
          {navItem('Contact', 'contact')}
        </nav>

        <div className="hidden md:flex items-center gap-2 xl:gap-3 shrink-0">
          {authPage ? (
            <button
              onClick={() => handleNav('packages')}
              className="text-xs xl:text-sm font-semibold px-4 xl:px-5 py-2 xl:py-2.5 rounded-full bg-[var(--ink)] text-white hover:bg-[var(--ink-soft)] transition-colors inline-flex items-center gap-1.5 outline-none focus:outline-none focus-visible:outline-none shadow-sm whitespace-nowrap"
            >
              <span>Explore packages</span>
              <IconArrow className="w-3.5 h-3.5 shrink-0" />
            </button>
          ) : (
            <>
              <button
                onClick={() => handleNav('login')}
                className="text-xs xl:text-sm font-medium px-3.5 xl:px-4.5 py-1.5 xl:py-2 rounded-full hover:bg-[var(--mist)] transition-colors outline-none focus:outline-none focus-visible:outline-none text-[#24252c]/70 hover:text-[var(--ink)] whitespace-nowrap"
              >
                Log in
              </button>
              <button
                onClick={() => handleNav('packages')}
                className="text-xs xl:text-sm font-semibold px-4 xl:px-5 py-2 xl:py-2.5 rounded-full bg-[var(--ink)] text-white hover:bg-[var(--ink-soft)] transition-colors inline-flex items-center gap-1.5 outline-none focus:outline-none focus-visible:outline-none shadow-sm whitespace-nowrap"
              >
                <span>Book an event</span>
                <IconArrow className="w-3.5 h-3.5 shrink-0" />
              </button>
            </>
          )}
        </div>

        <button className="lg:hidden p-2 outline-none focus:outline-none focus-visible:outline-none text-[var(--ink)] shrink-0" onClick={() => setMobileOpen((v) => !v)} aria-label="Toggle menu">
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