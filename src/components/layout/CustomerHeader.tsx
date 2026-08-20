import { useState } from 'react';
import type { Page } from '../../types';
import { IconMenu, IconX, IconLogOut } from '../shared/icons';
import { Logo } from './Logo';

export function CustomerHeader({
  page,
  go,
  wishlistCount = 0,
}: {
  page: Page;
  go: (p: Page) => void;
  wishlistCount?: number;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNav = (target: Page) => {
    setMobileOpen(false);
    go(target);
  };

  const navItem = (label: string, target: Page, count?: number) => (
    <button
      onClick={() => handleNav(target)}
      className={`px-3.5 py-2 rounded-full text-sm font-medium transition-all outline-none focus:outline-none focus:ring-0 focus-visible:outline-none flex items-center justify-between lg:justify-start gap-1.5 ${
        page === target || (target === 'packages' && page === 'package-detail')
          ? 'bg-[var(--ink)] text-white font-semibold shadow-sm'
          : 'text-black/60 hover:text-[var(--ink)] hover:bg-black/5'
      }`}
    >
      <span>{label}</span>
      {count !== undefined && count > 0 && (
        <span
          className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
            page === target ? 'bg-[#1090F8] text-white' : 'bg-[#1090F8]/15 text-[#1090F8]'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );

  return (
    <header className="fixed top-4 sm:top-5 inset-x-0 z-50 px-3 sm:px-4 md:px-8">
      <div className="mx-auto max-w-6xl bg-white/90 backdrop-blur-md border border-[#24252c]/[0.08] rounded-full shadow-[0_4px_24px_-4px_rgba(0,0,0,.08)] px-4 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between">
        <button onClick={() => handleNav('landing')} className="pl-1 outline-none focus:outline-none focus-visible:outline-none">
          <Logo />
        </button>

        <nav className="hidden lg:flex items-center gap-2">
          {navItem('Packages', 'packages')}
          {navItem('Active Booking', 'booking-tracker')}
          {navItem('History', 'booking-history')}
          {navItem('Wishlist', 'wishlist', wishlistCount)}
          {navItem('Rewards', 'loyalty')}
          {navItem('Review', 'review-submit')}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <button
            onClick={() => handleNav('profile')}
            className={`flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border transition-all outline-none cursor-pointer ${
              page === 'profile'
                ? 'bg-[var(--ink)] text-white border-[var(--ink)] shadow-sm'
                : 'bg-[var(--mist)] text-[var(--ink)] border-[#24252c]/[0.08] hover:border-[#1090F8]/50'
            }`}
            title="Open Account Profile"
          >
            <span className="w-7 h-7 rounded-full bg-[#1090F8] text-white text-[11px] font-extrabold flex items-center justify-center shrink-0">
              JD
            </span>
            <span className="text-sm font-medium">Juan Dela Cruz</span>
            <span className="text-[9px] font-bold uppercase tracking-wider bg-amber-400/20 text-amber-600 px-2 py-0.5 rounded-full">
              VIP Gold
            </span>
          </button>

          <button
            onClick={() => handleNav('landing')}
            className="p-2 rounded-full border border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 transition-colors outline-none focus:outline-none"
            title="Log out"
            aria-label="Log out"
          >
            <IconLogOut className="w-4 h-4" />
          </button>
        </div>

        <button className="lg:hidden p-2 text-[var(--ink)] outline-none focus:outline-none" onClick={() => setMobileOpen((v) => !v)} aria-label="Toggle menu">
          {mobileOpen ? <IconX /> : <IconMenu />}
        </button>
      </div>

      {mobileOpen && (
        <div className="mx-auto max-w-6xl mt-2 bg-white border border-[#24252c]/[0.08] rounded-3xl shadow-xl p-4 flex flex-col gap-1.5 lg:hidden animate-blur-in">
          {navItem('Browse Packages', 'packages')}
          {navItem('Active Booking Tracker', 'booking-tracker')}
          {navItem('Booking History', 'booking-history')}
          {navItem('Wishlist', 'wishlist', wishlistCount)}
          {navItem('Loyalty Rewards', 'loyalty')}
          {navItem('Submit Review', 'review-submit')}
          {navItem('Profile Settings', 'profile')}
          <div className="h-px bg-[#24252c]/[0.06] my-1" />
          <button
            onClick={() => handleNav('landing')}
            className="w-full text-left px-4 py-2 rounded-full text-sm font-medium text-rose-600 hover:bg-rose-50 flex items-center gap-2"
          >
            <IconLogOut className="w-4 h-4" /> Log out
          </button>
        </div>
      )}
    </header>
  );
}
