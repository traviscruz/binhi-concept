import { useState, ReactNode } from 'react';
import type { Page } from '../../types';
import { Logo } from './Logo';
import { IconBox, IconTicket, IconShield, IconLogOut, IconMenu, IconX } from '../shared/icons';

export function InventoryLayout({
  page,
  go,
  children,
  alertCount = 3,
}: {
  page: Page;
  go: (p: Page) => void;
  children: ReactNode;
  alertCount?: number;
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
        className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-semibold transition-all outline-none ${
          isActive
            ? 'bg-[#1090F8] text-white shadow-md'
            : 'text-white/70 hover:bg-white/10 hover:text-white'
        }`}
      >
        <div className="flex items-center gap-3">
          <span className={isActive ? 'text-white' : 'text-white/50'}>{icon}</span>
          <span>{label}</span>
        </div>
        {count !== undefined && count > 0 && (
          <span
            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
              isActive ? 'bg-white text-[#1090F8]' : 'bg-rose-500 text-white'
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
      <div className="lg:hidden bg-[#161823] text-white px-4 py-3 flex items-center justify-between sticky top-0 z-40 shadow-md">
        <div className="flex items-center gap-2">
          <button onClick={() => handleNav('landing')}>
            <Logo />
          </button>
          <span className="text-[10px] uppercase font-bold tracking-wider bg-[#1090F8]/20 text-[#1090F8] px-2 py-0.5 rounded-full">
            Manager
          </span>
        </div>
        <button
          onClick={() => setMobileSidebarOpen((v) => !v)}
          className="p-2 text-white/80 hover:text-white"
        >
          {mobileSidebarOpen ? <IconX /> : <IconMenu />}
        </button>
      </div>

      {/* Sidebar (Desktop + Mobile Drawer) */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-64 bg-[#161823] text-white p-5 flex flex-col justify-between transition-transform duration-300 ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div>
          <div className="pb-6 mb-6 border-b border-white/10 flex items-center justify-between">
            <button onClick={() => handleNav('landing')} className="outline-none">
              <Logo />
            </button>
            <span className="text-[10px] uppercase font-bold tracking-wider bg-[#1090F8]/20 text-[#1090F8] px-2 py-0.5 rounded-full">
              Inventory
            </span>
          </div>

          <nav className="space-y-1.5">
            {navItem('Overview KPI', 'inventory-dashboard', <IconBox className="w-4 h-4" />)}
            {navItem('Equipment List (CRUD)', 'inventory-items', <IconTicket className="w-4 h-4" />)}
            {navItem('Unit Assignments', 'inventory-units', <IconShield className="w-4 h-4" />)}
            {navItem('Alerts & Repairs', 'inventory-alerts', <IconBox className="w-4 h-4" />, alertCount)}
            {navItem('Usage Reports', 'inventory-reports', <IconTicket className="w-4 h-4" />)}
          </nav>
        </div>

        <div className="pt-4 border-t border-white/10">
          <div className="flex items-center justify-between bg-white/5 p-3 rounded-2xl border border-white/10 mb-3">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-full bg-[#1090F8] text-white text-xs font-bold flex items-center justify-center">
                RM
              </span>
              <div>
                <div className="text-xs font-bold text-white">Raymund M.</div>
                <div className="text-[10px] text-white/50">Warehouse Lead</div>
              </div>
            </div>
          </div>

          <button
            onClick={() => handleNav('landing')}
            className="w-full py-2.5 rounded-xl border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-xs font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <IconLogOut className="w-4 h-4" /> Log out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
