import { useState, ReactNode } from 'react';
import type { Page } from '../../types';
import { Logo } from './Logo';
import { IconBox, IconTicket, IconLogOut, IconMenu, IconX, IconCalendar, IconCheck } from '../shared/icons';

export function CrewLayout({
  page,
  go,
  children,
  assignedCount = 3,
}: {
  page: Page;
  go: (p: Page) => void;
  children: ReactNode;
  assignedCount?: number;
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

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Brand Header */}
      <div className="flex items-center justify-between p-4 border-b border-[#24252c]/[0.06]">
        <Logo onClick={() => handleNav('landing')} />
        <button
          onClick={() => setMobileSidebarOpen(false)}
          className="md:hidden text-[#24252c]/50 hover:text-[var(--ink)] p-1"
        >
          <IconX className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1.5 modal-scroll">
        <div className="text-[10px] font-bold uppercase tracking-wider text-[#24252c]/40 px-3 pb-1">
          Event Operations
        </div>
        {navItem('Assigned Bookings', 'crew-assigned-bookings', <IconCalendar className="w-4 h-4" />, assignedCount)}
        {navItem('Gear Packing & Specs', 'crew-booking-detail', <IconBox className="w-4 h-4" />)}
        {navItem('Setup / Teardown Status', 'crew-setup-teardown', <IconCheck className="w-4 h-4" />)}
      </div>

      {/* Profile Card & Exit Options */}
      <div className="p-4 border-t border-[#24252c]/[0.06] bg-gradient-to-b from-transparent to-[#24252c]/[0.02] space-y-3">
        <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-white border border-[#24252c]/[0.08] shadow-sm">
          <div className="w-9 h-9 rounded-xl bg-[#1090F8]/10 text-[#1090F8] font-black text-xs flex items-center justify-center border border-[#1090F8]/20 shrink-0">
            MV
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-extrabold text-[var(--ink)] truncate">Marco Valenzuela</div>
            <div className="text-[10px] text-[#24252c]/50 truncate">Lead Rigging Crew</div>
          </div>
        </div>

        <div>
          <button
            onClick={() => handleNav('login')}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs text-rose-600 bg-rose-50 hover:bg-rose-100 font-semibold transition-colors border border-rose-200"
          >
            <IconLogOut className="w-4 h-4" />
            Log Out Crew
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--mist)] flex text-[var(--ink)]">
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden md:block w-64 bg-white border-r border-[#24252c]/[0.08] shadow-sm fixed inset-y-0 left-0 z-30">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div className="relative w-72 bg-white h-full shadow-2xl z-10 flex flex-col">
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Main Content Body */}
      <div className="flex-1 md:pl-64 flex flex-col min-w-0">
        {/* Mobile Header Bar */}
        <header className="md:hidden flex items-center justify-between p-4 bg-white border-b border-[#24252c]/[0.08] sticky top-0 z-20 shadow-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="p-2 rounded-xl text-[var(--ink)] hover:bg-black/5 transition-colors"
            >
              <IconMenu className="w-5 h-5" />
            </button>
            <Logo onClick={() => handleNav('landing')} />
          </div>
        </header>

        {/* Page Children Container */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
