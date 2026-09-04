import { useState, useEffect } from 'react';
import './App.css';

import type { Page } from './types';
import { Header } from './components/layout/Header';
import { CustomerHeader } from './components/layout/CustomerHeader';
import { InventoryLayout } from './components/layout/InventoryLayout';
import { AdminLayout } from './components/layout/AdminLayout';
import { Footer } from './components/layout/Footer';

import LandingPage from './pages/public/LandingPage';
import PackageCatalogPage from './pages/public/PackageCatalogPage';
import PackageDetailPage from './pages/public/PackageDetailPage';
import EquipmentCatalogPage from './pages/public/EquipmentCatalogPage';
import ItemDetailPage from './pages/public/ItemDetailPage';
import AboutPage from './pages/public/AboutPage';
import ContactPage from './pages/public/ContactPage';
import TestimonialsPage from './pages/public/TestimonialsPage';
import LoginPage from './pages/public/LoginPage';
import RegisterPage from './pages/public/RegisterPage';
import ForgotPasswordPage from './pages/public/ForgotPasswordPage';
import OtpPage from './pages/public/OtpPage';

import CheckoutPage from './pages/customer/CheckoutPage';
import CustomPackagePage from './pages/customer/CustomPackagePage';
import PaymentResultPage from './pages/customer/PaymentResultPage';
import BookingStatusPage from './pages/customer/BookingStatusPage';
import BookingHistoryPage from './pages/customer/BookingHistoryPage';
import WishlistPage from './pages/customer/WishlistPage';
import LoyaltyPage from './pages/customer/LoyaltyPage';
import MyReviewsPage from './pages/customer/MyReviewsPage';
import ProfilePage from './pages/customer/ProfilePage';

import InventoryDashboard from './pages/inventory-manager/InventoryDashboard';
import InventoryItemsPage from './pages/inventory-manager/InventoryItemsPage';
import UnitAssignmentPage from './pages/inventory-manager/UnitAssignmentPage';
import InventoryAlertsPage from './pages/inventory-manager/InventoryAlertsPage';
import UsageReportsPage from './pages/inventory-manager/UsageReportsPage';
import InventoryProfilePage from './pages/inventory-manager/InventoryProfilePage';

import AdminDashboard from './pages/admin/AdminDashboard';
import AdminBookingsPage from './pages/admin/AdminBookingsPage';
import AdminManualBookingPage from './pages/admin/AdminManualBookingPage';
import AdminPackagesPage from './pages/admin/AdminPackagesPage';
import AdminTransportPage from './pages/admin/AdminTransportPage';
import AdminStaffPage from './pages/admin/AdminStaffPage';
import AdminCalendarPage from './pages/admin/AdminCalendarPage';
import AdminReportsPage from './pages/admin/AdminReportsPage';
import AdminInquiriesPage from './pages/admin/AdminInquiriesPage';
import AdminVouchersPage from './pages/admin/AdminVouchersPage';
import AdminLoyaltyPage from './pages/admin/AdminLoyaltyPage';
import { VoucherMarqueeBanner } from './components/layout/VoucherMarqueeBanner';
import { fetchBannerVouchers, getBannerVouchersSync } from './utils/voucherService';

import { CrewLayout } from './components/layout/CrewLayout';
import CrewAssignedBookingsPage from './pages/crew/CrewAssignedBookingsPage';
import CrewBookingDetailPage from './pages/crew/CrewBookingDetailPage';
import CrewSetupTeardownPage from './pages/crew/CrewSetupTeardownPage';
import CrewProfilePage from './pages/crew/CrewProfilePage';
import AdminReviewsPage from './pages/admin/AdminReviewsPage';
import AdminAuditLogsPage from './pages/admin/AdminAuditLogsPage';
import AdminProfilePage from './pages/admin/AdminProfilePage';
import { FEATURED_PACKAGES, type PackageData } from './data/packages';
import { supabase } from './lib/supabase';
import { fetchWishlistFromDb, toggleWishlistDb, syncLocalWishlistToDb, getLocalWishlistIds } from './utils/wishlistService';

export default function App() {
  const [page, setPage] = useState<Page>(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const pageParam = urlParams.get('page');
      if (pageParam) return pageParam as Page;

      const hash = window.location.hash.replace('#', '');
      if (hash) return hash as Page;

      const saved = localStorage.getItem('binhi_current_page');
      if (saved) return saved as Page;
    } catch (e) {
      console.error('Error restoring page state:', e);
    }
    return 'landing';
  });

  const [selectedPackageId, setSelectedPackageId] = useState<string>(() => {
    return localStorage.getItem('binhi_selected_package_id') || 'b';
  });

  const [selectedItemId, setSelectedItemId] = useState<string>(() => {
    return localStorage.getItem('binhi_selected_item_id') || 'led-wall';
  });

  const [bookingDate, setBookingDate] = useState('September 14, 2026');
  const [bookingAddons, setBookingAddons] = useState<string[]>(['add-smoke']);
  const [isCustomerSession, setIsCustomerSession] = useState(false);
  const [hasBannerVouchers, setHasBannerVouchers] = useState(false);
  const [wishlistIds, setWishlistIds] = useState<string[]>(() => getLocalWishlistIds());
  const [packages, setPackages] = useState<PackageData[]>(FEATURED_PACKAGES);

  // Check active banner vouchers for header spacing
  useEffect(() => {
    async function checkBanner() {
      // 1. Immediate synchronous cache check
      const syncBanners = getBannerVouchersSync();
      setHasBannerVouchers(syncBanners.length > 0);

      // 2. Refresh from Supabase in background
      try {
        const banners = await fetchBannerVouchers();
        setHasBannerVouchers(banners.length > 0);
      } catch (e) {}
    }
    checkBanner();

    const handleBannerUpdate = () => checkBanner();
    window.addEventListener('vouchers-updated', handleBannerUpdate);
    window.addEventListener('storage', handleBannerUpdate);
    return () => {
      window.removeEventListener('vouchers-updated', handleBannerUpdate);
      window.removeEventListener('storage', handleBannerUpdate);
    };
  }, []);

  // Fetch Packages from Supabase Database (Alphabetical order by name)
  const fetchDbPackages = async () => {
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

        formatted.sort((a, b) => a.name.localeCompare(b.name));
        setPackages(formatted);
      }
    } catch (err) {
      console.warn('Note fetching packages from Supabase:', err);
    }
  };

  useEffect(() => {
    fetchDbPackages();

    const handlePackageUpdate = () => fetchDbPackages();
    window.addEventListener('inventory-updated', handlePackageUpdate);
    return () => window.removeEventListener('inventory-updated', handlePackageUpdate);
  }, []);

  // Sync Supabase Auth session with App state & Wishlist Database CRUD
  useEffect(() => {
    async function checkSession() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const role = user.user_metadata?.role || 'customer';
        if (role === 'customer') {
          setIsCustomerSession(true);
        }
        // Load user's wishlist from Supabase database
        const userWishlist = await syncLocalWishlistToDb(user.id);
        setWishlistIds(userWishlist);
      } else {
        const local = await fetchWishlistFromDb(null);
        setWishlistIds(local);
      }
    }
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const role = session.user.user_metadata?.role || 'customer';
        if (role === 'customer') {
          setIsCustomerSession(true);
        }
        const userWishlist = await syncLocalWishlistToDb(session.user.id);
        setWishlistIds(userWishlist);
      } else {
        setIsCustomerSession(false);
        const local = getLocalWishlistIds();
        setWishlistIds(local);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const toggleWishlist = async (id: string) => {
    // Optimistically update local state immediately
    setWishlistIds((prev) => {
      const isCurrentlySaved = prev.includes(id);
      return isCurrentlySaved ? prev.filter((item) => item !== id) : [...prev, id];
    });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const updated = await toggleWishlistDb(id, wishlistIds, user?.id || null);
      setWishlistIds(updated);
    } catch (err) {
      console.error('Error toggling wishlist in database:', err);
    }
  };

  const go = (p: Page) => {
    // If navigating away from payment result pages, clean up URL search parameters
    if (window.location.search && (window.location.search.includes('page=payment-') || window.location.search.includes('ref='))) {
      try {
        window.history.replaceState({}, '', window.location.pathname);
      } catch (e) {}
    }

    if (
      p === 'booking-tracker' ||
      p === 'booking-history' ||
      p === 'wishlist' ||
      p === 'loyalty' ||
      p === 'review-submit' ||
      p === 'profile'
    ) {
      setIsCustomerSession(true);
    }

    try {
      if (!p.startsWith('payment-')) {
        localStorage.setItem('binhi_current_page', p);
      } else {
        localStorage.setItem('binhi_current_page', 'booking-tracker');
      }
    } catch (e) {
      console.error('Error saving current page:', e);
    }
    setPage(p);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const handleLogout = () => {
    setIsCustomerSession(false);
    try {
      localStorage.removeItem('binhi_current_page');
    } catch (e) {
      console.error('Error clearing page on logout:', e);
    }
    go('landing');
  };

  const goPackageDetail = (id: string) => {
    setSelectedPackageId(id);
    try {
      localStorage.setItem('binhi_selected_package_id', id);
    } catch (e) {}
    go('package-detail');
  };

  const goItemDetail = (id: string) => {
    setSelectedItemId(id);
    try {
      localStorage.setItem('binhi_selected_item_id', id);
    } catch (e) {}
    go('item-detail');
  };

  const startBooking = async (id: string, date: string, _guestCount: number, addons: string[]) => {
    setSelectedPackageId(id);
    setBookingDate(date);
    setBookingAddons(addons);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        localStorage.setItem('binhi_pending_checkout', 'true');
        go('login');
        return;
      }
    } catch (e) {
      console.error('Error checking auth state for booking:', e);
    }

    localStorage.removeItem('binhi_pending_checkout');
    go('checkout');
  };

  const isInventoryPage =
    page === 'inventory-dashboard' ||
    page === 'inventory-items' ||
    page === 'inventory-units' ||
    page === 'inventory-alerts' ||
    page === 'inventory-reports' ||
    page === 'inventory-profile';

  const isAdminPage =
    page === 'admin-dashboard' ||
    page === 'admin-bookings' ||
    page === 'admin-manual-booking' ||
    page === 'admin-packages' ||
    page === 'admin-transport' ||
    page === 'admin-staff' ||
    page === 'admin-calendar' ||
    page === 'admin-reports' ||
    page === 'admin-inquiries' ||
    page === 'admin-vouchers' ||
    page === 'admin-loyalty' ||
    page === 'admin-reviews' ||
    page === 'admin-audit-logs' ||
    page === 'admin-profile';

  const isCrewPage = page.startsWith('crew-');

  const isAuthOrCheckout =
    page === 'checkout' ||
    page === 'login' ||
    page === 'signup' ||
    page === 'forgot' ||
    page === 'otp';

  const showPublicHeader = !isAuthOrCheckout && !isCustomerSession && !isInventoryPage && !isAdminPage && !isCrewPage;
  const showCustomerHeader = !isAuthOrCheckout && isCustomerSession && !isInventoryPage && !isAdminPage && !isCrewPage;
  const showFooter = !isAuthOrCheckout && !isCustomerSession && !isInventoryPage && !isAdminPage && !isCrewPage;

  if (isInventoryPage) {
    return (
      <InventoryLayout page={page} go={go}>
        {page === 'inventory-dashboard' && <InventoryDashboard go={go} />}
        {page === 'inventory-items' && <InventoryItemsPage go={go} />}
        {page === 'inventory-units' && <UnitAssignmentPage go={go} />}
        {page === 'inventory-alerts' && <InventoryAlertsPage go={go} />}
        {page === 'inventory-reports' && <UsageReportsPage go={go} />}
        {page === 'inventory-profile' && <InventoryProfilePage go={go} />}
      </InventoryLayout>
    );
  }

  if (isAdminPage) {
    return (
      <AdminLayout page={page} go={go}>
        {page === 'admin-dashboard' && <AdminDashboard go={go} />}
        {page === 'admin-bookings' && <AdminBookingsPage go={go} />}
        {page === 'admin-manual-booking' && <AdminManualBookingPage go={go} />}
        {page === 'admin-packages' && <AdminPackagesPage go={go} />}
        {page === 'admin-transport' && <AdminTransportPage go={go} />}
        {page === 'admin-staff' && <AdminStaffPage go={go} />}
        {page === 'admin-calendar' && <AdminCalendarPage go={go} />}
        {page === 'admin-reports' && <AdminReportsPage go={go} />}
        {page === 'admin-inquiries' && <AdminInquiriesPage go={go} />}
        {page === 'admin-vouchers' && <AdminVouchersPage go={go} />}
        {page === 'admin-loyalty' && <AdminLoyaltyPage go={go} />}
        {page === 'admin-reviews' && <AdminReviewsPage go={go} />}
        {page === 'admin-audit-logs' && <AdminAuditLogsPage go={go} />}
        {page === 'admin-profile' && <AdminProfilePage go={go} />}
      </AdminLayout>
    );
  }

  if (isCrewPage) {
    return (
      <CrewLayout page={page} go={go}>
        {page === 'crew-assigned-bookings' && <CrewAssignedBookingsPage go={go} />}
        {page === 'crew-booking-detail' && <CrewBookingDetailPage go={go} />}
        {page === 'crew-setup-teardown' && <CrewSetupTeardownPage go={go} />}
        {page === 'crew-profile' && <CrewProfilePage go={go} />}
      </CrewLayout>
    );
  }

  // Calculate exact wishlist count matching valid database packages
  const validPackages = packages && packages.length > 0 ? packages : FEATURED_PACKAGES;
  const activeWishlistCount = validPackages.filter((pkg) => wishlistIds.includes(pkg.id)).length;

  const selectDateAndGoToPackages = (formattedDate: string) => {
    setBookingDate(formattedDate);
    try {
      localStorage.setItem('binhi_selected_event_date', formattedDate);
    } catch (e) {}
    go('packages');
  };

  return (
    <div className="min-h-screen bg-white text-[var(--ink)]">
      {/* Marquee Banner on Public & Customer Pages */}
      {!isAdminPage && !isInventoryPage && !isCrewPage && !isAuthOrCheckout && (
        <VoucherMarqueeBanner go={go} onVisibilityChange={setHasBannerVouchers} />
      )}

      {showPublicHeader && (
        <Header
          page={page}
          go={go}
          wishlistCount={activeWishlistCount}
          hasBanner={hasBannerVouchers}
        />
      )}
      {showCustomerHeader && (
        <CustomerHeader
          page={page}
          go={(p) => (p === 'landing' ? handleLogout() : go(p))}
          wishlistCount={activeWishlistCount}
          onSelectDateAndGoToPackages={selectDateAndGoToPackages}
          hasBanner={hasBannerVouchers}
        />
      )}

      <main key={page} className="animate-blur-in">
        {page === 'landing' && <LandingPage go={go} goPackageDetail={goPackageDetail} packages={packages} />}
        {page === 'packages' && (
          <PackageCatalogPage
            goPackageDetail={goPackageDetail}
            isCustomer={isCustomerSession}
            wishlistIds={wishlistIds}
            toggleWishlist={toggleWishlist}
            packages={packages}
            go={go}
          />
        )}
        {page === 'custom-package' && (
          <CustomPackagePage
            go={go}
            startBooking={startBooking}
          />
        )}
        {page === 'package-detail' && (
          <PackageDetailPage
            packageId={selectedPackageId}
            go={go}
            startBooking={startBooking}
            isCustomer={isCustomerSession}
            wishlistIds={wishlistIds}
            toggleWishlist={toggleWishlist}
            packages={packages}
          />
        )}
        {page === 'equipment' && <EquipmentCatalogPage goItemDetail={goItemDetail} />}
        {page === 'item-detail' && <ItemDetailPage itemId={selectedItemId} go={go} />}
        {page === 'about' && <AboutPage go={go} />}
        {page === 'contact' && <ContactPage />}
        {page === 'testimonials' && <TestimonialsPage />}
        {page === 'login' && <LoginPage go={go} />}
        {page === 'signup' && <RegisterPage go={go} />}
        {page === 'forgot' && <ForgotPasswordPage go={go} />}
        {page === 'otp' && <OtpPage go={go} />}

        {page === 'checkout' && (
          <CheckoutPage
            packageId={selectedPackageId}
            initialDate={bookingDate}
            initialAddons={bookingAddons}
            go={go}
            packages={packages}
          />
        )}

        {page === 'payment-success' && <PaymentResultPage type="success" go={go} />}
        {page === 'payment-failure' && <PaymentResultPage type="failure" go={go} />}
        {page === 'payment-cancel' && <PaymentResultPage type="cancel" go={go} />}

        {/* Customer Portal Views */}
        {page === 'booking-tracker' && <BookingStatusPage go={go} />}
        {page === 'booking-history' && <BookingHistoryPage go={go} />}
        {page === 'wishlist' && (
          <WishlistPage
            go={go}
            goPackageDetail={goPackageDetail}
            wishlistIds={wishlistIds}
            toggleWishlist={toggleWishlist}
            packages={packages}
          />
        )}
        {page === 'loyalty' && <LoyaltyPage go={go} />}
        {page === 'review-submit' && <MyReviewsPage go={go} />}
        {page === 'profile' && <ProfilePage go={go} />}
      </main>

      {showFooter && <Footer go={go} />}
    </div>
  );
}