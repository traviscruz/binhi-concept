import { useState, useEffect, type ReactNode } from 'react';
import type { Page } from '../../types';
import { Logo } from './Logo';
import { IconBox, IconTicket, IconShield, IconLogOut, IconMenu, IconX, IconUser } from '../shared/icons';
import { supabase } from '../../utils/supabase';

export function InventoryLayout({
  page,
  go,
  children,
  alertCount,
}: {
  page: Page;
  go: (p: Page) => void;
  children: ReactNode;
  alertCount?: number;
}) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [managerName, setManagerName] = useState('');
  const [managerAvatar, setManagerAvatar] = useState<string | null>(null);
  const [dynamicAlertCount, setDynamicAlertCount] = useState<number>(0);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const fetchActiveAlertsCount = async () => {
    try {
      let count = 0;

      // 1. Count physical units requiring maintenance/inspection
      const { data: units } = await supabase
        .from('physical_units')
        .select('condition, status');

      if (units) {
        count += units.filter(
          (u: any) =>
            u.condition === 'In Repair' ||
            u.condition === 'Needs Inspection' ||
            u.condition === 'Minor Wear' ||
            u.status === 'Maintenance / Repair' ||
            u.status === 'Decommissioned / Inactive'
        ).length;
      }

      // 2. Count active logged maintenance alerts
      const { data: customAlerts } = await supabase
        .from('inventory_alerts')
        .select('id, alert_type')
        .eq('status', 'active');

      if (customAlerts) {
        count += customAlerts.filter((ca: any) => ca.alert_type !== 'Low Stock Warning').length;
      }

      setDynamicAlertCount(count);
    } catch (err) {
      console.warn('Error fetching dynamic alerts count for menu bar:', err);
    }
  };

  useEffect(() => {
    async function fetchInventoryProfile() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const meta = user.user_metadata || {};
        let name = meta.full_name || (meta.first_name ? `${meta.first_name} ${meta.last_name || ''}`.trim() : '');
        let avatar = meta.avatar_url || null;

        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, first_name, last_name, avatar_url')
          .eq('id', user.id)
          .maybeSingle();

        if (profile) {
          if (profile.full_name) name = profile.full_name;
          else if (profile.first_name) name = `${profile.first_name} ${profile.last_name || ''}`.trim();
          if (profile.avatar_url) avatar = profile.avatar_url;
        }

        setManagerName(name || 'Inventory Manager');
        setManagerAvatar(avatar);
      } catch (err) {
        console.error('Error loading inventory profile for layout:', err);
        setManagerName('Inventory Manager');
      } finally {
        setLoadingProfile(false);
      }
    }

    fetchInventoryProfile();
    fetchActiveAlertsCount();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchInventoryProfile();
      fetchActiveAlertsCount();
    });

    // Custom Event & Realtime listeners for immediate dynamic count updates
    const handleInventoryUpdated = () => {
      fetchActiveAlertsCount();
    };

    window.addEventListener('inventory-updated', handleInventoryUpdated);

    const channel = supabase
      .channel('inventory_alerts_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'physical_units' }, () => {
        fetchActiveAlertsCount();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_alerts' }, () => {
        fetchActiveAlertsCount();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('inventory-updated', handleInventoryUpdated);
      supabase.removeChannel(channel);
    };
  }, [page]);

  const activeAlertCount = alertCount !== undefined ? alertCount : dynamicAlertCount;

  const handleNav = (target: Page) => {
    setMobileSidebarOpen(false);
    go(target);
  };

  const handleLogout = async () => {
    setMobileSidebarOpen(false);
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Inventory manager logout error:', err);
    }
    go('landing');
  };

  const navItem = (label: string, target: Page, icon: ReactNode, count?: number) => {
    const isActive = page === target;
    return (
      <button
        onClick={() => handleNav(target)}
        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs transition-all outline-none cursor-pointer ${
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
              isActive ? 'bg-white text-[var(--ink)]' : 'bg-amber-500 text-white'
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
          <button onClick={() => handleNav('inventory-dashboard')}>
            <Logo />
          </button>
          <span className="text-[10px] uppercase font-bold tracking-wider bg-[var(--mist)] text-[var(--ink)] px-2 py-0.5 rounded-full border border-[#24252c]/10">
            Inventory Manager
          </span>
        </div>
        <button
          onClick={() => setMobileSidebarOpen((v) => !v)}
          className="p-2 text-[var(--ink)] hover:bg-[var(--mist)] rounded-full cursor-pointer"
        >
          {mobileSidebarOpen ? <IconX /> : <IconMenu />}
        </button>
      </div>

      {/* Sidebar (Desktop + Mobile Drawer) */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-64 bg-white border-r border-[#24252c]/[0.08] text-[var(--ink)] p-4 flex flex-col justify-between transition-transform duration-300 ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div>
          <div className="pb-4 mb-4 border-b border-[#24252c]/[0.08] flex items-center justify-between">
            <button onClick={() => handleNav('inventory-dashboard')} className="outline-none cursor-pointer">
              <Logo />
            </button>
          </div>

          <nav className="space-y-1.5">
            {navItem('Overview KPI', 'inventory-dashboard', <IconBox className="w-4 h-4" />)}
            {navItem('Equipment List', 'inventory-items', <IconTicket className="w-4 h-4" />)}
            {navItem('Unit Assignments', 'inventory-units', <IconShield className="w-4 h-4" />)}
            {navItem('Alerts & Repairs', 'inventory-alerts', <IconBox className="w-4 h-4" />, activeAlertCount)}
            {navItem('Usage Reports', 'inventory-reports', <IconTicket className="w-4 h-4" />)}
          </nav>
        </div>

        <div className="pt-4 border-t border-[#24252c]/[0.08]">
          <button
            onClick={() => handleNav('inventory-profile')}
            className={`w-full text-left flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${
              page === 'inventory-profile'
                ? 'bg-[var(--ink)] text-white border-[var(--ink)] shadow-sm'
                : 'bg-[var(--mist)] text-[var(--ink)] border-[#24252c]/[0.08] hover:border-[#1090F8]/40'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {managerAvatar ? (
                <img
                  src={managerAvatar}
                  alt={managerName}
                  className="w-8 h-8 rounded-full object-cover border border-white/20 shrink-0"
                />
              ) : (
                <span className="w-8 h-8 rounded-full bg-white text-[var(--ink)] border border-[#24252c]/15 text-xs font-bold flex items-center justify-center shrink-0">
                  <IconUser className="w-4 h-4" />
                </span>
              )}
              <div className="min-w-0">
                {loadingProfile ? (
                  <div className="h-3.5 w-20 bg-black/10 animate-pulse rounded my-0.5" />
                ) : (
                  <div className="text-xs font-bold truncate">{managerName}</div>
                )}
                <div className={`text-[10px] truncate ${page === 'inventory-profile' ? 'text-white/70' : 'text-[#24252c]/50'}`}>
                  Inventory Manager
                </div>
              </div>
            </div>
          </button>

          <button
            onClick={handleLogout}
            className="w-full mt-2 py-2.5 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <IconLogOut className="w-4 h-4" /> Log out
          </button>
        </div>
      </aside>

      {/* Main Content Area - Wide & Spacious */}
      <main key={page} className="animate-blur-in flex-1 p-4 sm:p-6 lg:p-8 2xl:p-10 max-w-7xl 2xl:max-w-[1600px] mx-auto w-full min-w-0 overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}
