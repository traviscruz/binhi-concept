import { useState, useEffect, type ReactNode } from 'react';
import type { Page } from '../../types';
import { Logo } from './Logo';
import { IconTicket, IconUser, IconLogOut, IconMenu, IconX, IconExternal, IconShield } from '../shared/icons';
import {
  getStoredPartnerSession,
  clearStoredPartnerSession,
  type AffiliatePartner,
} from '../../utils/affiliateService';

export function PartnerLayout({
  page,
  go,
  children,
}: {
  page: Page;
  go: (p: Page) => void;
  children: ReactNode;
}) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [partner, setPartner] = useState<AffiliatePartner | null>(() => getStoredPartnerSession());

  useEffect(() => {
    const current = getStoredPartnerSession();
    setPartner(current);

    const handleStorage = () => {
      setPartner(getStoredPartnerSession());
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [page]);

  const handleNav = (target: Page) => {
    setMobileSidebarOpen(false);
    go(target);
  };

  const handleLogout = () => {
    clearStoredPartnerSession();
    setMobileSidebarOpen(false);
    go('partner-login');
  };

  const navItem = (label: string, target: Page, icon: ReactNode, badge?: string) => {
    const active = page === target;
    return (
      <button
        key={target}
        type="button"
        onClick={() => handleNav(target)}
        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
          active
            ? 'bg-[var(--ink)] text-white shadow-xs'
            : 'text-[#24252c]/70 hover:bg-black/5 hover:text-[var(--ink)]'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <span className={active ? 'text-white' : 'text-[#24252c]/50'}>{icon}</span>
          <span>{label}</span>
        </div>
        {badge && (
          <span
            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
              active
                ? 'bg-white/20 text-white'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }`}
          >
            {badge}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-[#FBFBFC] text-[var(--ink)] flex flex-col md:flex-row">
      {/* ── Sidebar (Desktop) ── */}
      <aside className="hidden md:flex flex-col justify-between w-64 border-r border-[#24252c]/[0.08] bg-white p-5 shrink-0 sticky top-0 h-screen overflow-y-auto">
        <div className="space-y-6">
          {/* Logo */}
          <div>
            <button
              type="button"
              onClick={() => go('landing')}
              className="text-left cursor-pointer transition-opacity hover:opacity-80"
            >
              <Logo />
            </button>
          </div>

          {/* Partner Info Summary Card */}
          {partner && (
            <div className="p-3.5 rounded-2xl bg-[var(--mist)] border border-[#24252c]/[0.06] space-y-1.5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#1090F8] text-white flex items-center justify-center font-black text-xs shrink-0 shadow-2xs">
                  {partner.partnerName.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="font-extrabold text-xs text-[var(--ink)] truncate">
                    {partner.partnerName}
                  </div>
                  <div className="text-[10px] text-[#24252c]/50 truncate">
                    {partner.businessName || partner.profession}
                  </div>
                </div>
              </div>

              <div className="pt-1.5 border-t border-[#24252c]/[0.06] flex items-center justify-between text-[10px]">
                <span className="text-[#24252c]/50 font-bold uppercase tracking-wider">Promo Code</span>
                <span className="font-mono font-black text-[#1090F8] bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
                  {partner.referralCode}
                </span>
              </div>
            </div>
          )}

          {/* Nav Items */}
          <nav className="space-y-1">
            <div className="px-3 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-[#24252c]/40">
              Partner Workspace
            </div>
            {navItem('Overview & Earnings', 'partner-dashboard', <IconTicket className="w-4 h-4" />)}
            {navItem('Profile & Payout Settings', 'partner-profile', <IconUser className="w-4 h-4" />)}
          </nav>
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t border-[#24252c]/[0.08]">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold text-rose-600 bg-rose-50/70 border border-rose-200 hover:bg-rose-100 transition-colors cursor-pointer"
          >
            <IconLogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Mobile Top Header ── */}
      <header className="md:hidden flex items-center justify-between p-4 bg-white border-b border-[#24252c]/[0.08] sticky top-0 z-30">
        <button type="button" onClick={() => go('partner-dashboard')} className="cursor-pointer">
          <Logo />
        </button>
        <button
          type="button"
          onClick={() => setMobileSidebarOpen(true)}
          className="p-2 rounded-xl border border-[#24252c]/10 text-[var(--ink)] hover:bg-black/5 cursor-pointer"
          aria-label="Open menu"
        >
          <IconMenu className="w-5 h-5" />
        </button>
      </header>

      {/* ── Mobile Drawer ── */}
      {mobileSidebarOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div className="relative flex flex-col justify-between w-72 max-w-[80vw] bg-white h-full p-5 shadow-2xl z-10 animate-slide-right">
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-[#24252c]/10">
                <Logo />
                <button
                  type="button"
                  onClick={() => setMobileSidebarOpen(false)}
                  className="p-1.5 rounded-full hover:bg-[var(--mist)] text-[#24252c]/50 cursor-pointer"
                >
                  <IconX className="w-5 h-5" />
                </button>
              </div>

              {partner && (
                <div className="p-3 rounded-xl bg-[var(--mist)] space-y-1 text-xs">
                  <div className="font-extrabold text-[var(--ink)]">{partner.partnerName}</div>
                  <div className="text-[10px] text-[#24252c]/60">{partner.profession}</div>
                  <div className="font-mono text-emerald-700 font-bold text-[11px] pt-1">
                    Code: {partner.referralCode}
                  </div>
                </div>
              )}

              <nav className="space-y-1">
                {navItem('Overview & Earnings', 'partner-dashboard', <IconTicket className="w-4 h-4" />)}
                {navItem('Profile & Payout Settings', 'partner-profile', <IconUser className="w-4 h-4" />)}
              </nav>
            </div>

            <div className="pt-4 border-t border-[#24252c]/10">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200"
              >
                <IconLogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Main Content Area ── */}
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
