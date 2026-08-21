import { useState, useEffect } from 'react';
import type { Page } from '../../types';
import { IconMenu, IconX, IconLogOut, IconUser } from '../shared/icons';
import { Logo } from './Logo';
import { supabase } from '../../utils/supabase';

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
  const [customerName, setCustomerName] = useState('Customer');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Load and listen to Supabase customer user state
  useEffect(() => {
    async function fetchCustomerProfile() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const meta = user.user_metadata || {};
        let name = meta.full_name || (meta.first_name ? `${meta.first_name} ${meta.last_name || ''}`.trim() : '');
        let avatar = meta.avatar_url || null;

        // Fetch latest profile from database
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

        if (name) {
          setCustomerName(name);
        }
        setAvatarUrl(avatar);
      } catch (err) {
        console.error('Error fetching customer profile for header:', err);
      }
    }

    fetchCustomerProfile();

    // Subscribe to auth state changes for real-time updates
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchCustomerProfile();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleNav = (target: Page) => {
    setMobileOpen(false);
    go(target);
  };

  const handleLogout = async () => {
    setMobileOpen(false);
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Logout error:', err);
    }
    go('landing');
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
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={customerName}
                className="w-7 h-7 rounded-full object-cover border border-[#24252c]/10 shrink-0"
              />
            ) : (
              <span className="w-7 h-7 rounded-full bg-white text-[var(--ink)] border border-[#24252c]/15 shadow-xs flex items-center justify-center shrink-0">
                <IconUser className="w-4 h-4" />
              </span>
            )}
            <span className="text-sm font-medium">{customerName}</span>
            <span className="text-[9px] font-bold uppercase tracking-wider bg-amber-400/20 text-amber-600 px-2 py-0.5 rounded-full">
              VIP Gold
            </span>
          </button>

          <button
            onClick={handleLogout}
            className="p-2 rounded-full border border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 transition-colors outline-none focus:outline-none cursor-pointer"
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
            onClick={handleLogout}
            className="w-full text-left px-4 py-2 rounded-full text-sm font-medium text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer"
          >
            <IconLogOut className="w-4 h-4" /> Log out ({customerName})
          </button>
        </div>
      )}
    </header>
  );
}
