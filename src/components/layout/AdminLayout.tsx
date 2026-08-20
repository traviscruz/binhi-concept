import { useState, ReactNode } from 'react';
import type { Page } from '../../types';
import { Logo } from './Logo';
import { IconBox, IconTicket, IconShield, IconLogOut, IconMenu, IconX, IconCalendar, IconMail, IconUser } from '../shared/icons';

export function AdminLayout({
  page,
  go,
  children,
  pendingBookingsCount = 2,
  inquiryCount = 1,
}: {
  page: Page;
  go: (p: Page) => void;
  children: ReactNode;
  pendingBookingsCount?: number;
  inquiryCount?: number;
}) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const handleNav = (target: Page) => {
    setMobileSidebarOpen(false);
    go(target);
  };

  const navItem = (label: string, target: Page, icon: ReactNode, count?: number) => {
    const isActive = page === target;
    return (
      <button
        onClick={() => handleNav(target)}
        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs transition-all outline-none ${
          isActive
            ? 'bg-[var(--ink)] text-white font-semibold shadow-sm'
            : 'text-black/60 hover:text-[var(--ink)] hover:bg-black/5 font-medium'
        }`}
      >
        <div className="flex items-center gap-2.5 truncate">
          <span className={isActive ? 'text-white' : 'text-[#24252c]/50'}>{icon}</span>
          <span className="truncate">{label}</span>
        </div>
        {count !== undefined && count > 0 && (
          <span
            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full shrink-0 ${
              isActive ? 'bg-white text-[var(--ink)]' : 'bg-[#1090F8] text-white'
            }`}
          >
            {count}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-white flex flex-col lg:flex-row text-[var(--ink)]">
      {/* Mobile Top Bar */}
      <div className="lg:hidden bg-white border-b border-[#24252c]/[0.08] text-[var(--ink)] px-4 py-3 flex items-center justify-between sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-2">
          <button onClick={() => handleNav('landing')}>
            <Logo />
          </button>
          <span className="text-[10px] uppercase font-bold tracking-wider bg-[var(--mist)] text-[var(--ink)] px-2 py-0.5 rounded-full border border-[#24252c]/10">
            System Admin
          </span>
        </div>
        <button
          onClick={() => setMobileSidebarOpen((v) => !v)}
          className="p-2 text-[var(--ink)] hover:bg-[var(--mist)] rounded-full"
        >
          {mobileSidebarOpen ? <IconX /> : <IconMenu />}
        </button>
      </div>

      {/* Sidebar (Desktop + Mobile Drawer) */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-64 bg-white border-r border-[#24252c]/[0.08] text-[var(--ink)] p-4 flex flex-col justify-between transition-transform duration-300 overflow-y-auto ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div>
          <div className="pb-4 mb-4 border-b border-[#24252c]/[0.08] flex items-center justify-between">
            <button onClick={() => handleNav('landing')} className="outline-none">
              <Logo />
            </button>
          </div>

          <nav className="space-y-1">
            {navItem('Overview & KPIs', 'admin-dashboard', <IconBox className="w-4 h-4" />)}
            {navItem('Bookings Manager', 'admin-bookings', <IconShield className="w-4 h-4" />, pendingBookingsCount)}
            {navItem('Package Builder', 'admin-packages', <IconTicket className="w-4 h-4" />)}
            {navItem('Transport Fee Rules', 'admin-transport', <IconBox className="w-4 h-4" />)}
            {navItem('Staff & Accounts', 'admin-staff', <IconUser className="w-4 h-4" />)}
            {navItem('Event Calendar', 'admin-calendar', <IconCalendar className="w-4 h-4" />)}
            {navItem('Revenue Analytics', 'admin-reports', <IconTicket className="w-4 h-4" />)}
            {navItem('Inquiry Inbox', 'admin-inquiries', <IconMail className="w-4 h-4" />, inquiryCount)}
            {navItem('Loyalty Settings', 'admin-loyalty', <IconShield className="w-4 h-4" />)}
            {navItem('Review Moderation', 'admin-reviews', <IconTicket className="w-4 h-4" />)}
          </nav>
        </div>

        <div className="pt-4 mt-4 border-t border-[#24252c]/[0.08]">
          <div className="flex items-center justify-between bg-[var(--mist)] p-3 rounded-2xl border border-[#24252c]/[0.08] mb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-8 h-8 rounded-full bg-[var(--ink)] text-white text-xs font-bold flex items-center justify-center shrink-0">
                FC
              </span>
              <div className="min-w-0">
                <div className="text-xs font-bold text-[var(--ink)] truncate">Francis Cruz</div>
                <div className="text-[10px] text-[#24252c]/50 truncate">System Administrator</div>
              </div>
            </div>
          </div>

          <button
            onClick={() => handleNav('landing')}
            className="w-full py-2.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <IconLogOut className="w-4 h-4" /> Log out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto w-full overflow-hidden">
        {children}
      </main>
    </div>
  );
}
