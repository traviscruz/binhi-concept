import { useState, useEffect } from 'react';
import type { Page } from '../../types';
import type { PackageData } from '../../data/packages';
import { MonoBadge, MonoBadgeDark } from '../../components/shared/Badges';
import { IconArrow, IconCalendar, IconTicket } from '../../components/shared/icons';
import { TestimonialsSection } from '../../components/shared/TestimonialsSection';
import { ImageWithSkeleton } from '../../components/shared/ImageWithSkeleton';
import { fetchDbBookedDates, isPastDate, type DBBooking } from '../../utils/bookingService';
import {
  fetchBookingSettings,
  fetchScheduleOverrides,
  getDayAvailabilityStatus,
  type BookingSettings,
  type ScheduleOverride,
  DEFAULT_BOOKING_SETTINGS,
} from '../../utils/bookingEngine';
import { fetchCrewAvailabilityRecords } from '../../utils/crewAvailabilityService';
import { supabase } from '../../lib/supabase';

function IconChevronLeft({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function IconChevronRight({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
    </svg>
  );
}

interface LiveEquipmentStatus {
  id: string;
  name: string;
  status: string;
  dot: string;
}

export default function LandingPage({
  go,
  goPackageDetail,
  packages = [],
}: {
  go: (p: Page) => void;
  goPackageDetail: (id: string) => void;
  packages?: PackageData[];
}) {
  const [livePackages, setLivePackages] = useState<PackageData[]>(packages);
  const [liveEquipment, setLiveEquipment] = useState<LiveEquipmentStatus[]>([]);
  const [loadingEquipment, setLoadingEquipment] = useState(true);

  // Sync / fetch packages directly from Supabase
  useEffect(() => {
    if (packages && packages.length > 0) {
      setLivePackages(packages);
    } else {
      async function loadDbPackages() {
        try {
          const { data, error } = await supabase
            .from('packages')
            .select('*')
            .order('name', { ascending: true });

          if (!error && data && data.length > 0) {
            const formatted: PackageData[] = data.map((item: any) => ({
              id: item.package_id || item.id,
              name: item.name,
              tag: item.tag || '',
              price: item.price,
              rawPrice: Number(item.raw_price) || parseInt((item.price || '').replace(/\D/g, '')) || 0,
              desc: item.description || '',
              img: item.img || '',
              photos: item.photos || [],
              inclusions: item.inclusions || [],
              recommendedFor: item.recommended_for || [],
              specs: item.specs || {
                setupTime: '2.5 Hours',
                crewSize: '3 Technicians',
              },
            }));
            setLivePackages(formatted);
          }
        } catch (err) {
          console.warn('Error fetching live packages:', err);
        }
      }
      loadDbPackages();
    }
  }, [packages]);

  // Fetch Live Equipment & Physical Unit Stats from Supabase
  useEffect(() => {
    async function loadLiveEquipment() {
      setLoadingEquipment(true);
      try {
        const [modelsRes, unitsRes] = await Promise.all([
          supabase
            .from('equipment_models')
            .select('id, model_id, name, category')
            .order('name', { ascending: true })
            .limit(6),
          supabase
            .from('physical_units')
            .select('model_id, status'),
        ]);

        const models = modelsRes.data || [];
        const units = unitsRes.data || [];

        if (models.length > 0) {
          const mappedList: LiveEquipmentStatus[] = models.map((m: any) => {
            const modelKey = m.model_id || m.id;
            const modelUnits = units.filter((u: any) => u.model_id === modelKey || u.model_id === m.id);
            const total = modelUnits.length;
            const available = modelUnits.filter((u: any) => u.status === 'Available in Warehouse').length;
            const underRepair = modelUnits.filter((u: any) =>
              (u.status || '').toLowerCase().includes('repair') ||
              (u.status || '').toLowerCase().includes('maintenance')
            ).length;

            let statusText = 'Ready in Warehouse';
            let dotColor = 'bg-emerald-500';

            if (total === 0) {
              statusText = 'Available';
              dotColor = 'bg-emerald-500';
            } else if (available > 0) {
              statusText = total > 1 ? `${available}/${total} Ready` : 'Available';
              dotColor = 'bg-emerald-500';
            } else if (underRepair === total) {
              statusText = 'Under Repair';
              dotColor = 'bg-rose-500';
            } else {
              statusText = 'In Deployment';
              dotColor = 'bg-amber-500';
            }

            return {
              id: modelKey,
              name: m.name,
              status: statusText,
              dot: dotColor,
            };
          });

          setLiveEquipment(mappedList);
        }
      } catch (e) {
        console.warn('Error loading live equipment preview:', e);
      } finally {
        setLoadingEquipment(false);
      }
    }

    loadLiveEquipment();
  }, []);

  // Accurate Calendar State
  const today = new Date();
  const [calYear, setCalYear] = useState(() => today.getFullYear());
  const [calMonth, setCalMonth] = useState(() => today.getMonth());
  const [dbBookings, setDbBookings] = useState<DBBooking[]>([]);
  const [bookingSettings, setBookingSettings] = useState<BookingSettings>(DEFAULT_BOOKING_SETTINGS);
  const [scheduleOverrides, setScheduleOverrides] = useState<ScheduleOverride[]>([]);

  useEffect(() => {
    async function loadCalendarData() {
      try {
        const [bookings, settings, overrides] = await Promise.all([
          fetchDbBookedDates(),
          fetchBookingSettings(),
          fetchScheduleOverrides(),
          fetchCrewAvailabilityRecords(),
        ]);
        setDbBookings(bookings);
        setBookingSettings(settings);
        setScheduleOverrides(overrides);
      } catch (e) {
        console.warn('Failed loading calendar data:', e);
      }
    }
    loadCalendarData();
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

  return (
    <>
      <section className="pt-40 pb-16 px-6 text-center">
        <div className="rise-in inline-block">
          <MonoBadge icon={IconCalendar}>Booking open for {calYear} events</MonoBadge>
        </div>

        <h1 className="rise-in rise-in-delay-1 mt-6 font-extrabold tracking-tight leading-[0.98] text-[var(--ink)]" style={{ fontSize: 'clamp(2.6rem, 6vw, 4.6rem)' }}>
          Event production,
          <br />
          booked in one sitting.
        </h1>

        <p className="rise-in rise-in-delay-2 mt-5 text-[#24252c]/60 max-w-xl mx-auto text-base sm:text-lg font-normal leading-relaxed">
          Transparent rates, instant equipment customizer, and crew booking for weddings, debuts, and corporate events across Luzon.
        </p>

        <div className="rise-in rise-in-delay-3 mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => go('packages')}
            className="w-full sm:w-auto bg-[var(--ink)] text-white text-sm font-semibold px-7 py-3.5 rounded-full hover:bg-[var(--ink-soft)] transition-all shadow-md inline-flex items-center justify-center gap-2 group cursor-pointer"
          >
            <span>Explore production packages</span>
            <IconArrow className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
          <button
            onClick={() => go('equipment')}
            className="w-full sm:w-auto bg-[var(--mist)] text-[var(--ink)] text-sm font-semibold px-6 py-3.5 rounded-full hover:bg-[#EBEBEB] transition-colors border border-[#24252c]/[0.06] cursor-pointer"
          >
            Browse gear catalog
          </button>
        </div>

        <div className="rise-in rise-in-delay-3 mt-14 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs font-semibold text-[#24252c]/50">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Real-Time Equipment Availability</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500" /> Transparent Package Rates</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-purple-500" /> Verified On-Site Technicians</span>
        </div>
      </section>

      <section className="px-6 pb-20">
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-5">
          <div className="bg-[var(--mist)] rounded-[2rem] p-6 md:p-8">
            <div className="bg-white rounded-2xl shadow-sm border border-[#24252c]/[0.06] p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <span className="text-sm font-extrabold text-[var(--ink)] block">{monthName} {calYear}</span>
                  <span className="text-[10px] text-[#24252c]/50 font-medium">Master System Calendar</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    className="w-7 h-7 rounded-full bg-[var(--mist)] hover:bg-[var(--ink)] hover:text-white text-[var(--ink)] transition-colors flex items-center justify-center cursor-pointer shadow-xs"
                    title="Previous Month"
                    aria-label="Previous Month"
                  >
                    <IconChevronLeft />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextMonth}
                    className="w-7 h-7 rounded-full bg-[var(--mist)] hover:bg-[var(--ink)] hover:text-white text-[var(--ink)] transition-colors flex items-center justify-center cursor-pointer shadow-xs"
                    title="Next Month"
                    aria-label="Next Month"
                  >
                    <IconChevronRight />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-[#24252c]/50 mb-1.5">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
                  <span key={i}>{d}</span>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1.5">
                {/* Leading blank cells for correct day of week alignment */}
                {Array.from({ length: firstDayIndex }).map((_, i) => (
                  <div key={`empty-${i}`} className="aspect-square rounded-lg bg-transparent" />
                ))}

                {/* Days of the month */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const formattedIso = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const isPast = isPastDate(formattedIso);
                  const dayStatus = getDayAvailabilityStatus(formattedIso, dbBookings, bookingSettings, scheduleOverrides);
                  const now = new Date();
                  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                  const isToday = formattedIso === todayIso;

                  let cellClass = 'bg-[var(--mist)] text-[#24252c]/80 hover:bg-[#1090F8]/10 hover:text-[#1090F8] cursor-pointer';
                  let cellStyle: React.CSSProperties | undefined = undefined;

                  if (isPast) {
                    cellClass = 'bg-gray-100 text-gray-400 font-medium cursor-not-allowed opacity-40';
                  } else if (dayStatus.status === 'fully_booked' || dayStatus.status === 'closed') {
                    cellClass = 'bg-[var(--ink)] text-white font-bold shadow-xs cursor-not-allowed opacity-80';
                  } else if (dayStatus.status === 'slots_available') {
                    cellClass = 'border border-emerald-500/40 font-bold hover:scale-[1.04] hover:shadow-md hover:border-emerald-400 cursor-pointer shadow-xs relative overflow-hidden';
                    cellStyle = { background: 'linear-gradient(135deg, #24252C 0%, #065F46 55%, #059669 100%)' };
                  } else if (isToday) {
                    cellClass = 'border-2 border-[#1090F8] text-[#1090F8] font-extrabold bg-[#1090F8]/10 cursor-pointer hover:bg-[#1090F8]/20 shadow-xs';
                  }

                  const isBlocked = isPast || dayStatus.status === 'fully_booked' || dayStatus.status === 'closed';

                  const handleClick = () => {
                    if (isBlocked) return;
                    localStorage.setItem('binhi_selected_event_date', formattedIso);
                    go('packages');
                  };

                  const isSlotsHalf = dayStatus.status === 'slots_available';

                  return (
                    <div
                      key={day}
                      onClick={handleClick}
                      style={cellStyle}
                      title={
                        isPast
                          ? 'Past Date'
                          : dayStatus.status === 'fully_booked'
                          ? 'Fully Booked: No operational slots remaining'
                          : dayStatus.status === 'slots_available'
                          ? `${dayStatus.bookingCount} Booked • Slots Open (${formattedIso}) - Multiple slots available! Exact timings validated during checkout.`
                          : isToday
                          ? 'Today (Available)'
                          : `Available ${formattedIso}`
                      }
                      className={`aspect-square rounded-lg sm:rounded-xl text-[10px] sm:text-xs flex flex-col items-center justify-center relative transition-all group ${cellClass}`}
                    >
                      <span className={`leading-none ${isSlotsHalf ? 'font-black text-[10px] sm:text-[11.5px] text-white drop-shadow-xs z-10' : ''}`}>
                        {day}
                      </span>
                      {isSlotsHalf && (
                        <span className="text-[5.5px] sm:text-[6.5px] font-extrabold uppercase tracking-tight text-emerald-100 bg-emerald-500/30 border border-emerald-400/30 px-0.5 sm:px-1 py-0.2 rounded-full shadow-2xs mt-0.5 z-10">
                          Slots
                        </span>
                      )}
                      {dayStatus.status === 'fully_booked' && (
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 absolute bottom-1" />
                      )}
                    </div>
                  );
                })}

                {/* Trailing blank cells to enforce fixed 42-cell layout for all months */}
                {Array.from({ length: Math.max(0, 42 - (firstDayIndex + daysInMonth)) }).map((_, i) => (
                  <div key={`trail-${i}`} className="aspect-square rounded-lg sm:rounded-xl bg-transparent opacity-0 pointer-events-none" />
                ))}
              </div>

              <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center justify-between gap-1.5 sm:gap-2 mt-3.5 sm:mt-4 pt-2.5 sm:pt-3 border-t border-[#24252c]/[0.06] text-[9.5px] sm:text-[10px] text-[#24252c]/60">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[var(--ink)] shrink-0" /> Booked</span>
                <span className="flex items-center gap-1.5 font-bold text-emerald-700">
                  <span
                    className="w-2.5 h-2.5 rounded-md border border-emerald-500/40 shadow-2xs inline-block shrink-0"
                    style={{ background: 'linear-gradient(135deg, #24252C 0%, #065F46 55%, #059669 100%)' }}
                  />
                  1 Booked • Slots Open
                </span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full border-2 border-[#1090F8] bg-[#1090F8]/20 shrink-0" /> Today</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[var(--mist)] border border-[#24252c]/10 shrink-0" /> Available</span>
              </div>
            </div>
            <h3 className="font-semibold mt-6 text-base">See real availability, not "let me check"</h3>
            <p className="text-sm text-[#24252c]/55 mt-1.5 leading-relaxed">
              Every date reflects actual crew and equipment availability — no waiting on a reply to find out it's taken.
            </p>
          </div>

          <div className="bg-[var(--ink)] text-white rounded-[2rem] p-6 md:p-8">
            <div className="bg-white/[0.06] border border-white/10 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold">Equipment inventory</span>
                <span className="text-xs text-white/40">Live database status</span>
              </div>
              {loadingEquipment ? (
                <div className="py-8 text-center text-white/40 text-xs animate-pulse">
                  Loading live inventory units...
                </div>
              ) : liveEquipment.length === 0 ? (
                <div className="py-6 text-center text-white/40 text-xs">
                  Inventory models registered in Supabase will appear here in real-time.
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-white/[0.08]">
                  {liveEquipment.map((item) => (
                    <div key={item.id || item.name} className="flex items-center justify-between py-2.5 text-sm">
                      <span className="text-white/85 truncate mr-2">{item.name}</span>
                      <span className="flex items-center gap-1.5 text-[11px] text-white/50 shrink-0">
                        <span className={`w-1.5 h-1.5 rounded-full ${item.dot}`} />
                        {item.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <h3 className="font-semibold mt-6 text-base">Every unit tracked, nothing double-booked</h3>
            <p className="text-sm text-white/55 mt-1.5 leading-relaxed">
              The equipment assigned to your date is tracked in real-time from our warehouse database.
            </p>
          </div>
        </div>
      </section>

      <section className="px-6 pb-24">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <MonoBadge icon={IconTicket}>Featured packages</MonoBadge>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight mt-3">Pick a starting point</h2>
            <p className="text-[#24252c]/55 mt-2 text-base">Every package is fully customizable with add-ons after you pick one.</p>
          </div>

          {livePackages.length === 0 ? (
            <div className="text-center py-12 text-[#24252c]/50 text-sm">
              Loading available packages...
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-5">
              {livePackages.slice(0, 3).map((pkg) => (
                <div
                  key={pkg.id}
                  onClick={() => goPackageDetail(pkg.id)}
                  className="group rounded-[1.75rem] border border-[#24252c]/[0.07] overflow-hidden bg-white hover:shadow-[0_20px_40px_-20px_rgba(0,0,0,.18)] transition-all cursor-pointer"
                >
                  <div className="aspect-[4/3] overflow-hidden bg-[var(--mist)]">
                    <ImageWithSkeleton src={pkg.img} alt={pkg.name} className="w-full h-full group-hover:scale-[1.04] transition-transform duration-500" />
                  </div>
                  <div className="ticket-notch ticket-dash px-5 pt-4 pb-2 flex items-center justify-between">
                    <span className="text-[11px] mono uppercase tracking-widest text-[var(--muted-2)]">{pkg.tag}</span>
                    <span className="text-sm font-bold">{pkg.price}</span>
                  </div>
                  <div className="px-5 pb-5 pt-2">
                    <h3 className="font-semibold text-base">{pkg.name}</h3>
                    <p className="text-sm text-[#24252c]/55 mt-1.5 leading-relaxed">{pkg.desc}</p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        goPackageDetail(pkg.id);
                      }}
                      className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#1090F8] hover:gap-2.5 transition-all"
                    >
                      View package <IconArrow className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <TestimonialsSection />

      <div className="my-16 md:my-24 px-6">
        <div className="max-w-5xl mx-auto bg-[#161823] text-white rounded-[2.5rem] px-8 py-16 md:py-20 text-center shadow-xl">
          <MonoBadgeDark>Get started</MonoBadgeDark>
          <h2 className="mt-6 font-extrabold tracking-tight leading-[1.02]" style={{ fontSize: 'clamp(2rem, 5vw, 3.2rem)' }}>
            Let's lock in your event date.
          </h2>
          <p className="mt-4 text-white/55 max-w-md mx-auto text-base">
            Create an account to browse the full catalog, save packages, and check your event date instantly.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
            <button
              onClick={() => go('signup')}
              className="bg-white text-[var(--ink)] text-sm font-semibold px-6 py-3.5 rounded-full inline-flex items-center gap-2 hover:bg-white/90 transition-colors"
            >
              Create account <IconArrow className="w-4 h-4" />
            </button>
            <button
              onClick={() => go('contact')}
              className="border border-white/25 text-sm font-semibold px-6 py-3.5 rounded-full hover:bg-white/10 transition-colors"
            >
              Ask a question
            </button>
          </div>
        </div>
      </div>
    </>
  );
}