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
        <div className="mx-auto max-w-7xl mt-2 bg-white border border-[#24252c]/[0.08] rounded-3xl shadow-xl p-4 flex flex-col gap-1.5 lg:hidden animate-blur-in">
          {navItem('Browse Packages', 'packages')}
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

      {/* ── Customer Privacy-Focused System Availability Calendar Modal ── */}
      <ModalOverlay isOpen={showCalendarModal} onClose={() => setShowCalendarModal(false)}>
        <div className="bg-white rounded-[2.5rem] p-6 md:p-8 max-w-xl w-full shadow-2xl border border-[#24252c]/10 relative animate-blur-in">
          <button
            type="button"
            onClick={() => setShowCalendarModal(false)}
            className="absolute top-5 right-5 text-[#24252c]/50 hover:text-[var(--ink)] p-1 cursor-pointer"
          >
            <IconX className="w-5 h-5" />
          </button>

          <div className="mb-4 pb-3 border-b border-[#24252c]/[0.06]">
            <h3 className="text-lg font-black text-[var(--ink)] tracking-tight">Production Booking Calendar</h3>
            <p className="text-xs text-[#24252c]/50 mt-0.5">Live schedule availability and your confirmed event dates.</p>
          </div>

          {/* Month Header & Controls */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="text-sm font-extrabold text-[var(--ink)] tracking-tight">{monthName} {calYear}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="w-8 h-8 rounded-full bg-[var(--mist)] hover:bg-[#24252c]/10 text-[var(--ink)] text-xs font-bold transition-colors cursor-pointer flex items-center justify-center"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="w-8 h-8 rounded-full bg-[var(--mist)] hover:bg-[#24252c]/10 text-[var(--ink)] text-xs font-bold transition-colors cursor-pointer flex items-center justify-center"
              >
                ›
              </button>
            </div>
          </div>

          {/* Calendar Grid Header */}
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase tracking-wider text-[#24252c]/40 mb-1.5">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
              <div key={d} className="py-1">{d}</div>
            ))}
          </div>

          {/* Month Days Grid (Fixed 42 cells = 6 rows x 7 cols) */}
          <div className="grid grid-cols-7 gap-1">
            {/* Blank leading cells */}
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

              let cellStyle = 'text-[var(--ink)] font-medium hover:bg-[var(--mist)] cursor-pointer';
              let dot = null;

              if (isMyBooking) {
                cellStyle = 'bg-blue-50 text-[#1090F8] font-black border border-blue-200 hover:bg-blue-100 cursor-pointer shadow-2xs';
                dot = <span className="w-1.5 h-1.5 rounded-full bg-[#1090F8] mt-0.5" />;
              } else if (isPast) {
                cellStyle = 'text-black/20 font-normal cursor-not-allowed select-none';
              } else if (isBooked) {
                cellStyle = 'text-black/35 font-normal line-through decoration-black/25 bg-black/[0.03] cursor-not-allowed select-none';
                dot = <span className="w-1 h-1 rounded-full bg-black/30 mt-0.5" />;
              } else if (isToday) {
                cellStyle = 'ring-1.5 ring-[var(--ink)] text-[var(--ink)] font-black bg-white cursor-pointer hover:bg-[var(--mist)]';
                dot = <span className="w-1 h-1 rounded-full bg-[var(--ink)] mt-0.5" />;
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
                <button
                  type="button"
                  key={day}
                  onClick={handleSelect}
                  disabled={isPast || (isBooked && !isMyBooking)}
                  title={
                    isMyBooking
                      ? `Your Booking: ${userBooking?.package_name || 'Event Production'} (Click to track)`
                      : isPast
                      ? 'Past Date'
                      : isBooked
                      ? 'Unavailable / Reserved'
                      : isToday
                      ? 'Today'
                      : `Available: ${formattedIso}`
                  }
                  className={`aspect-square rounded-xl text-xs flex flex-col items-center justify-center transition-colors relative ${cellStyle}`}
                >
                  <span className="leading-none">{day}</span>
                  {dot}
                </button>
              );
            })}

            {/* Trailing blank cells to enforce fixed 42-cell layout */}
            {Array.from({ length: Math.max(0, 42 - (firstDayIndex + daysInMonth)) }).map((_, i) => (
              <div key={`trail-${i}`} className="aspect-square rounded-xl bg-transparent opacity-0 pointer-events-none" />
            ))}
          </div>

          {/* Minimalist Legend Bar */}
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 mt-5 pt-3 border-t border-[#24252c]/[0.06] text-[11px] text-[#24252c]/60">
            <span className="flex items-center gap-1.5 font-bold text-[#1090F8]">
              <span className="w-2 h-2 rounded-full bg-[#1090F8]" /> Your Event
            </span>
            <span className="flex items-center gap-1.5 text-[#24252c]/70">
              <span className="w-2 h-2 rounded-full bg-black/30" /> Booked
            </span>
            <span className="flex items-center gap-1.5 font-semibold text-[var(--ink)]">
              <span className="w-2 h-2 rounded-full border border-[var(--ink)]" /> Today
            </span>
            <span className="flex items-center gap-1.5 text-[#24252c]/70">
              <span className="w-2 h-2 rounded-full bg-[var(--mist)] border border-black/15" /> Available
            </span>
          </div>
        </div>
      </ModalOverlay>
    </header>
  );
}
