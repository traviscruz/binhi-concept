import { useState, useEffect } from 'react';
import type { Page } from '../../types';
import { IconMenu, IconX, IconLogOut, IconUser, IconCalendar } from '../shared/icons';
import { ModalOverlay } from '../shared/ModalOverlay';
import { Logo } from './Logo';
import { supabase } from '../../utils/supabase';
import { fetchDbBookedDates, isPastDate, type DBBooking } from '../../utils/bookingService';

export function CustomerHeader({
  page,
  go,
  wishlistCount = 0,
  onSelectDateAndGoToPackages,
  hasBanner = false,
}: {
  page: Page;
  go: (p: Page) => void;
  wishlistCount?: number;
  onSelectDateAndGoToPackages?: (formattedDate: string) => void;
  hasBanner?: boolean;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Master Event Calendar Modal state & DB Bookings
  const today = new Date();
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [calYear, setCalYear] = useState(() => today.getFullYear());
  const [calMonth, setCalMonth] = useState(() => today.getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(() => today.getDate());
  const [dbBookings, setDbBookings] = useState<DBBooking[]>([]);

  useEffect(() => {
    async function loadBookings() {
      const data = await fetchDbBookedDates();
      setDbBookings(data);
    }
    loadBookings();
  }, []);

  const handlePrevMonth = () => {
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear((y) => y - 1);
    } else {
      setCalMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear((y) => y + 1);
    } else {
      setCalMonth((m) => m + 1);
    }
  };

  const firstDayIndex = new Date(calYear, calMonth, 1).getDay(); // 0 = Sun
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthName = monthNames[calMonth];

  const selectedDateStr = selectedDay ? `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}` : '';
  const selectedDayEvent = dbBookings.find((b) => b.event_date === selectedDateStr);

  // Load and listen to Supabase customer user state
  useEffect(() => {
    async function fetchCustomerProfile() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        setCurrentUserId(user.id);
        setCurrentUserEmail(user.email || null);

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

        setCustomerName(name || 'Customer Account');
        setAvatarUrl(avatar);
      } catch (err) {
        console.error('Error fetching customer profile for header:', err);
        setCustomerName('Customer Account');
      } finally {
        setLoadingProfile(false);
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
          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full transition-colors ${
            page === target ? 'bg-white text-[#1090F8]' : 'bg-[#1090F8] text-white shadow-xs'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );

  return (
    <header className={`fixed ${hasBanner ? 'top-9 sm:top-10' : 'top-4 sm:top-5'} inset-x-0 z-50 px-3 sm:px-4 md:px-8 transition-all duration-300`}>
      <div className="mx-auto max-w-7xl 2xl:max-w-[1600px] bg-white/90 backdrop-blur-md border border-[#24252c]/[0.08] rounded-full shadow-[0_4px_24px_-4px_rgba(0,0,0,.08)] px-5 sm:px-8 py-2.5 sm:py-3 flex items-center justify-between">
        <button onClick={() => handleNav('packages')} className="pl-1 outline-none focus:outline-none focus-visible:outline-none cursor-pointer">
          <Logo />
        </button>

        <nav className="hidden lg:flex items-center gap-2">
          {navItem('Packages', 'packages')}
          {navItem('Active Booking', 'booking-tracker')}
          {navItem('History', 'booking-history')}
          {navItem('Wishlist', 'wishlist', wishlistCount)}
          {navItem('Rewards', 'loyalty')}
          {navItem('Review', 'review-submit')}
          <button
            type="button"
            onClick={() => setShowCalendarModal(true)}
            className="px-4 py-2 rounded-full text-sm font-medium text-black/60 hover:text-[var(--ink)] hover:bg-black/5 transition-all outline-none cursor-pointer"
          >
            Calendar
          </button>
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
            {loadingProfile ? (
              <span className="w-16 h-3.5 bg-black/10 animate-pulse rounded-full" />
            ) : (
              <span className="text-sm font-medium">{customerName}</span>
            )}
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
        <div className="mx-auto max-w-7xl mt-2 bg-white border border-[#24252c]/[0.08] rounded-3xl shadow-xl p-4 flex flex-col gap-1.5 lg:hidden animate-blur-in">
          {navItem('Browse Packages', 'packages')}
          {navItem('✨ Build Custom Package', 'custom-package')}
          {navItem('Active Booking Tracker', 'booking-tracker')}
          {navItem('Booking History', 'booking-history')}
          {navItem('Wishlist', 'wishlist', wishlistCount)}
          {navItem('Loyalty Rewards', 'loyalty')}
          {navItem('Submit Review', 'review-submit')}
          <button
            type="button"
            onClick={() => {
              setMobileOpen(false);
              setShowCalendarModal(true);
            }}
            className="w-full text-left px-4 py-2 rounded-full text-sm font-medium text-black/70 hover:bg-black/5 cursor-pointer"
          >
            Calendar
          </button>
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

      {/* ── Customer Master Availability & Booking Calendar Modal ── */}
      <ModalOverlay isOpen={showCalendarModal} onClose={() => setShowCalendarModal(false)}>
        <div className="bg-white rounded-[2.5rem] max-w-xl w-full max-h-[88vh] shadow-2xl border border-[#24252c]/10 relative p-1.5 sm:p-2.5 overflow-hidden flex flex-col animate-blur-in">
          <button
            type="button"
            onClick={() => setShowCalendarModal(false)}
            className="absolute top-6 right-6 z-20 text-[#24252c]/50 hover:text-[var(--ink)] p-1.5 rounded-full hover:bg-[var(--mist)] transition-colors bg-white/90 backdrop-blur-md shadow-sm border border-[#24252c]/10 cursor-pointer"
            title="Close"
          >
            <IconX className="w-5 h-5" />
          </button>

          <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-4 modal-scroll pr-4 sm:pr-6">
            <div className="mb-2 pb-3 border-b border-[#24252c]/[0.06]">
              <div className="flex items-center gap-2 mb-1">
                <span className="p-1.5 rounded-lg bg-[#1090F8]/10 text-[#1090F8]">
                  <IconCalendar className="w-4 h-4" />
                </span>
                <h3 className="text-xl font-extrabold text-[var(--ink)]">
                  Production Booking Calendar
                </h3>
              </div>
              <p className="text-xs text-[#24252c]/60">
                Live schedule availability and your confirmed event dates. Click an open date to reserve your package.
              </p>
            </div>

            {/* Interactive Availability Calendar matching Reschedule Calendar design without strokes */}
            <div className="p-4 rounded-2xl bg-[var(--mist)] space-y-3.5">
              {/* Month Navigation Header */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-base font-extrabold text-[var(--ink)] block">
                    {monthName} {calYear}
                  </span>
                  <span className="text-[11px] text-[#24252c]/50 font-medium">
                    Click an open slot to select your desired event date
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    className="px-3 py-1.5 rounded-full bg-white hover:bg-[var(--ink)] hover:text-white text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                  >
                    ← Prev
                  </button>
                  <button
                    type="button"
                    onClick={handleNextMonth}
                    className="px-3 py-1.5 rounded-full bg-white hover:bg-[var(--ink)] hover:text-white text-xs font-bold transition-colors cursor-pointer shadow-2xs"
                  >
                    Next →
                  </button>
                </div>
              </div>

              {/* Weekday Header */}
              <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-[#24252c]/50">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                  <div key={d} className="py-1">
                    {d}
                  </div>
                ))}
              </div>

              {/* 42-cell Fixed Grid */}
              <div className="grid grid-cols-7 gap-1">
                {/* Leading empty cells */}
                {Array.from({ length: firstDayIndex }).map((_, i) => (
                  <div key={`empty-${i}`} className="aspect-square rounded-xl bg-transparent" />
                ))}

                {/* Days of the month */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const formattedIso = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const isPast = isPastDate(formattedIso);

                  const userBooking = dbBookings.find(
                    (b) =>
                      b.event_date === formattedIso &&
                      ((currentUserId && b.user_id === currentUserId) ||
                       (currentUserEmail && b.customer_email?.toLowerCase() === currentUserEmail.toLowerCase()))
                  );
                  const otherBooking = dbBookings.find((b) => b.event_date === formattedIso && b !== userBooking);
                  const isMyBooking = !!userBooking;
                  const isBooked = isMyBooking || !!otherBooking;
                  
                  const now = new Date();
                  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                  const isToday = formattedIso === todayIso;

                  let cellClass =
                    'bg-white text-[#24252c]/80 font-semibold cursor-pointer hover:bg-[#1090F8]/15 hover:text-[#1090F8] shadow-2xs';
                  let badgeText = '';

                  if (isMyBooking) {
                    cellClass =
                      'bg-[#1090F8] text-white font-black shadow-md scale-[1.03] z-10 cursor-pointer';
                    badgeText = 'Your Event';
                  } else if (isPast) {
                    cellClass = 'bg-black/[0.03] text-gray-300 font-medium cursor-not-allowed opacity-40 select-none';
                    badgeText = 'Past';
                  } else if (isBooked) {
                    cellClass = 'bg-[var(--ink)] text-white font-semibold shadow-2xs cursor-not-allowed opacity-85 select-none';
                    badgeText = 'Booked';
                  } else if (isToday) {
                    cellClass =
                      'text-[#1090F8] font-bold bg-[#1090F8]/15 cursor-pointer hover:bg-[#1090F8]/25 shadow-2xs';
                    badgeText = 'Today';
                  }

                  const handleSelect = () => {
                    if (isMyBooking) {
                      if (userBooking?.id) {
                        localStorage.setItem('binhi_selected_active_booking_id', userBooking.id);
                      }
                      go('booking-tracker');
                      setShowCalendarModal(false);
                      return;
                    }
                    if (isPast || isBooked) return;
                    if (onSelectDateAndGoToPackages) {
                      onSelectDateAndGoToPackages(formattedIso);
                    } else {
                      go('packages');
                    }
                    setShowCalendarModal(false);
                  };

                  return (
                    <div
                      key={day}
                      onClick={handleSelect}
                      title={
                        isMyBooking
                          ? `Your Confirmed Booking: ${userBooking?.package_name || 'Event Production'} (Click to track)`
                          : isPast
                          ? 'Past Date'
                          : isBooked
                          ? 'Date Already Booked / Unavailable'
                          : isToday
                          ? 'Today (Available)'
                          : `Available: ${formattedIso} (Click to reserve)`
                      }
                      className={`aspect-square rounded-xl text-xs flex flex-col items-center justify-center relative transition-all ${cellClass}`}
                    >
                      <span className="leading-none">{day}</span>
                      {badgeText && (
                        <span className="text-[7px] font-extrabold uppercase tracking-tight opacity-90 mt-0.5">
                          {badgeText}
                        </span>
                      )}
                    </div>
                  );
                })}

                {/* Trailing blank cells to enforce fixed 42-cell layout */}
                {Array.from({ length: Math.max(0, 42 - (firstDayIndex + daysInMonth)) }).map((_, i) => (
                  <div key={`trail-${i}`} className="aspect-square rounded-xl bg-transparent opacity-0 pointer-events-none" />
                ))}
              </div>

              {/* Legend Bar without stroke */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 text-[10px] text-[#24252c]/70">
                <span className="flex items-center gap-1.5 font-bold text-[#1090F8]">
                  <span className="w-2.5 h-2.5 rounded-md bg-[#1090F8]" /> Your Event
                </span>
                <span className="flex items-center gap-1.5 font-semibold text-[var(--ink)]">
                  <span className="w-2.5 h-2.5 rounded-md bg-[var(--ink)]" /> Booked / Unavailable
                </span>
                <span className="flex items-center gap-1.5 font-semibold text-[#1090F8]">
                  <span className="w-2.5 h-2.5 rounded-md bg-[#1090F8]/30" /> Today
                </span>
                <span className="flex items-center gap-1.5 text-[#24252c]/60">
                  <span className="w-2.5 h-2.5 rounded-md bg-white shadow-2xs" /> Open Date
                </span>
              </div>
            </div>
          </div>
        </div>
      </ModalOverlay>
    </header>
  );
}
