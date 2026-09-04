import { useState, useEffect, type ReactNode } from 'react';
import type { Page } from '../../types';
import { Logo } from './Logo';
import { IconBox, IconTicket, IconShield, IconLogOut, IconMenu, IconX, IconCalendar, IconMail, IconUser } from '../shared/icons';
import { supabase } from '../../utils/supabase';

export function AdminLayout({
  page,
  go,
  children,
  pendingBookingsCount,
  inquiryCount,
}: {
  page: Page;
  go: (p: Page) => void;
  children: ReactNode;
  pendingBookingsCount?: number;
  inquiryCount?: number;
}) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [adminName, setAdminName] = useState('');
  const [adminAvatar, setAdminAvatar] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    async function fetchAdminProfile() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setAdminName('Admin');
          return;
        }

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

        setAdminName(name || 'Admin');
        setAdminAvatar(avatar);
      } catch (err) {
        console.error('Error loading admin header profile:', err);
        setAdminName('Admin');
      } finally {
        setLoadingProfile(false);
      }
    }

    fetchAdminProfile();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchAdminProfile();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const [liveInquiryCount, setLiveInquiryCount] = useState(inquiryCount);
  const [liveBookingsCount, setLiveBookingsCount] = useState<number>(0);

  // Real-time listener & fetcher for Bookings Manager pending count
  useEffect(() => {
    async function fetchPendingBookingsCount() {
      try {
        const { data, error } = await supabase
          .from('bookings')
          .select('id, payment_status, status, reschedule_status');

        if (!error && data) {
          const pendingCount = data.filter((b: any) => {
            const s = (b.payment_status || b.status || '').toLowerCase();
            const isPendingPayment = s === 'pending' || s === 'pending deposit approval' || s === 'unpaid';
            const isPendingReschedule = b.reschedule_status === 'pending';
            return isPendingPayment || isPendingReschedule;
          }).length;

          setLiveBookingsCount(pendingCount);
        }
      } catch (err) {
        console.warn('Error fetching live bookings count for AdminLayout:', err);
      }
    }

    fetchPendingBookingsCount();

    const channel = supabase
      .channel('admin-layout-bookings-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        () => {
          fetchPendingBookingsCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Real-time listener & fetcher for Inquiry Inbox count
  useEffect(() => {
    async function fetchNewInquiryCount() {
      try {
        const { count, error } = await supabase
          .from('inquiries')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'New');

        if (!error && count !== null) {
          setLiveInquiryCount(count);
        }
      } catch (err) {
        console.warn('Error fetching new inquiries count:', err);
      }
    }

    fetchNewInquiryCount();

    const channel = supabase
      .channel('admin-layout-inquiries')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inquiries' },
        () => {
          fetchNewInquiryCount();
        }
      )
      .subscribe();

    return () => {
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
      console.error('Admin logout error:', err);
    }
    go('landing');
  };

  const navItem = (label: string, target: Page, icon: ReactNode, count?: number) => {
    const isActive = page === target || (target === 'admin-bookings' && page === 'admin-manual-booking');
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
          <button onClick={() => handleNav('admin-dashboard')}>
            <Logo />
          </button>
          <span className="text-[10px] uppercase font-bold tracking-wider bg-[var(--mist)] text-[var(--ink)] px-2 py-0.5 rounded-full border border-[#24252c]/10">
            Admin
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
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-64 bg-white border-r border-[#24252c]/[0.08] text-[var(--ink)] p-4 flex flex-col justify-between transition-transform duration-300 overflow-y-auto ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div>
          <div className="pb-4 mb-4 border-b border-[#24252c]/[0.08] flex items-center justify-between">
            <button onClick={() => handleNav('admin-dashboard')} className="outline-none cursor-pointer">
              <Logo />
            </button>
          </div>

          <nav className="space-y-1">
            {navItem('Overview & KPIs', 'admin-dashboard', <IconBox className="w-4 h-4" />)}
            {navItem('Bookings Manager', 'admin-bookings', <IconShield className="w-4 h-4" />, liveBookingsCount)}
            {navItem('Package Builder', 'admin-packages', <IconTicket className="w-4 h-4" />)}
            {navItem('Transport Fee Rules', 'admin-transport', <IconBox className="w-4 h-4" />)}
            {navItem('Staff & Accounts', 'admin-staff', <IconUser className="w-4 h-4" />)}
            {navItem('Event Calendar', 'admin-calendar', <IconCalendar className="w-4 h-4" />)}
            {navItem('Revenue Analytics', 'admin-reports', <IconTicket className="w-4 h-4" />)}
            {navItem('Inquiry Inbox', 'admin-inquiries', <IconMail className="w-4 h-4" />, liveInquiryCount)}
            {navItem('Voucher Codes', 'admin-vouchers', <IconTicket className="w-4 h-4" />)}
            {navItem('Loyalty Settings', 'admin-loyalty', <IconShield className="w-4 h-4" />)}
            {navItem('Review Moderation', 'admin-reviews', <IconTicket className="w-4 h-4" />)}
            {navItem('Audit Trail & Logs', 'admin-audit-logs', <IconShield className="w-4 h-4" />)}
          </nav>
        </div>

        <div className="pt-4 mt-4 border-t border-[#24252c]/[0.08]">
          <button
            onClick={() => handleNav('admin-profile')}
            className={`w-full text-left flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${
              page === 'admin-profile'
                ? 'bg-[var(--ink)] text-white border-[var(--ink)] shadow-sm'
                : 'bg-[var(--mist)] text-[var(--ink)] border-[#24252c]/[0.08] hover:border-[#1090F8]/40'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {adminAvatar ? (
                <img
                  src={adminAvatar}
                  alt={adminName}
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
                  <div className="text-xs font-bold truncate">{adminName}</div>
                )}
                <div className={`text-[10px] truncate ${page === 'admin-profile' ? 'text-white/70' : 'text-[#24252c]/50'}`}>
                  Admin Account
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

      {/* Main Content Area - Wide, Spacious & Smooth Blur-in Transition */}
      <main key={page} className="animate-blur-in flex-1 p-4 sm:p-6 lg:p-8 2xl:p-10 max-w-7xl 2xl:max-w-[1600px] mx-auto w-full min-w-0 overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}
