import { useState, useEffect, type ReactNode } from 'react';
import type { Page } from '../../types';
import { Logo } from './Logo';
import { IconCalendar, IconBox, IconCheck, IconLogOut, IconMenu, IconX, IconUser } from '../shared/icons';
import { supabase } from '../../utils/supabase';

export function CrewLayout({
  page,
  go,
  children,
  assignedCount = 4,
}: {
  page: Page;
  go: (p: Page) => void;
  children: ReactNode;
  assignedCount?: number;
}) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [crewName, setCrewName] = useState('');
  const [crewAvatar, setCrewAvatar] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [liveAssignedCount, setLiveAssignedCount] = useState<number>(assignedCount ?? 0);

  useEffect(() => {
    async function fetchCrewProfileAndCount() {
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

        setCrewName(name || 'Event Staff');
        setCrewAvatar(avatar);

        // Fetch live count
        const { rawCount } = await import('../../utils/crewService').then((m) =>
          m.fetchAssignedBookingsForCurrentCrew()
        );
        setLiveAssignedCount(rawCount);
      } catch (err) {
        console.error('Error loading crew profile for layout:', err);
        setCrewName('Event Staff');
      } finally {
        setLoadingProfile(false);
      }
    }

    fetchCrewProfileAndCount();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchCrewProfileAndCount();
    });

    const channel = supabase
      .channel('crew-layout-bookings-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        () => {
          fetchCrewProfileAndCount();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, []);

  const handleNav = (target: Page) => {
    setMobileSidebarOpen(false);
    go(target);
  };

  const handleLogout = async () => {
    setMobileSidebarOpen(false);
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Crew logout error:', err);
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
            ? 'bg-[var(--ink)] text-white font-bold shadow-sm'
            : 'text-[#24252c]/70 hover:text-[var(--ink)] hover:bg-black/5 font-semibold'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={isActive ? 'text-white' : 'text-[#24252c]/50'}>{icon}</span>
          <span className="truncate">{label}</span>
        </div>
        {count !== undefined && count > 0 && (
          <span
            className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${
              isActive ? 'bg-white text-[var(--ink)]' : 'bg-emerald-600 text-white'
            }`}
          >
            {count}
          </span>
        )}
      </button>
    );
  };

  const sidebarContent = (
    <div className="h-full flex flex-col justify-between p-4">
      <div className="space-y-6">
        {/* Brand Header */}
        <div className="pb-4 mb-4 border-b border-[#24252c]/[0.08] flex items-center justify-between">
          <button onClick={() => handleNav('crew-assigned-bookings')} className="outline-none cursor-pointer">
            <Logo />
          </button>
        </div>

        {/* Navigation Items */}
        <div className="space-y-1.5">
          {navItem('Assigned Bookings', 'crew-assigned-bookings', <IconCalendar className="w-4 h-4" />, liveAssignedCount)}
          {navItem('Gear Packing & Specs', 'crew-booking-detail', <IconBox className="w-4 h-4" />)}
          {navItem('Setup / Teardown Status', 'crew-setup-teardown', <IconCheck className="w-4 h-4" />)}
        </div>
      </div>

      {/* Profile Card & Exit Options */}
      <div className="pt-4 border-t border-[#24252c]/[0.06] space-y-2">
        <button
          onClick={() => handleNav('crew-profile')}
          className={`w-full text-left flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${
            page === 'crew-profile'
              ? 'bg-[var(--ink)] text-white border-[var(--ink)] shadow-sm'
              : 'bg-white text-[var(--ink)] border-[#24252c]/[0.08] hover:border-[#1090F8]/40 shadow-xs'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {crewAvatar ? (
              <img
                src={crewAvatar}
                alt={crewName}
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
                <div className="text-xs font-extrabold truncate">{crewName}</div>
              )}
              <div className={`text-[10px] truncate ${page === 'crew-profile' ? 'text-white/70' : 'text-[#24252c]/50'}`}>
                Event Staff / Crew
              </div>
            </div>
          </div>
        </button>

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs text-rose-600 bg-rose-50 hover:bg-rose-100 font-semibold transition-colors border border-rose-200 cursor-pointer"
        >
          <IconLogOut className="w-4 h-4" />
          Log Out Crew
        </button>
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
              className="p-2 rounded-xl text-[var(--ink)] hover:bg-black/5 transition-colors cursor-pointer"
            >
              <IconMenu className="w-5 h-5" />
            </button>
            <Logo onClick={() => handleNav('crew-assigned-bookings')} />
          </div>
        </header>

        {/* Page Children Container - Wide, Spacious & Smooth Blur-in Transition */}
        <main key={page} className="animate-blur-in flex-1 p-4 sm:p-6 md:p-8 2xl:p-10 max-w-7xl 2xl:max-w-[1600px] w-full mx-auto overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
