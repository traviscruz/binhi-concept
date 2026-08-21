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
import AdminPackagesPage from './pages/admin/AdminPackagesPage';
import AdminTransportPage from './pages/admin/AdminTransportPage';
import AdminStaffPage from './pages/admin/AdminStaffPage';
import AdminCalendarPage from './pages/admin/AdminCalendarPage';
import AdminReportsPage from './pages/admin/AdminReportsPage';
import AdminInquiriesPage from './pages/admin/AdminInquiriesPage';
import AdminLoyaltyPage from './pages/admin/AdminLoyaltyPage';

import { CrewLayout } from './components/layout/CrewLayout';
import CrewAssignedBookingsPage from './pages/crew/CrewAssignedBookingsPage';
import CrewBookingDetailPage from './pages/crew/CrewBookingDetailPage';
import CrewSetupTeardownPage from './pages/crew/CrewSetupTeardownPage';
import CrewProfilePage from './pages/crew/CrewProfilePage';
import AdminReviewsPage from './pages/admin/AdminReviewsPage';
import AdminProfilePage from './pages/admin/AdminProfilePage';

import { supabase } from './utils/supabase';

export default function App() {
  const [page, setPage] = useState<Page>(() => {
    try {
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
  const [wishlistIds, setWishlistIds] = useState<string[]>(['a', 'b']);

  // Sync Supabase Auth session with App state
  useEffect(() => {
    async function checkSession() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const role = user.user_metadata?.role || 'customer';
        if (role === 'customer') {
          setIsCustomerSession(true);
        }
      }
    }
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const role = session.user.user_metadata?.role || 'customer';
        if (role === 'customer') {
          setIsCustomerSession(true);
        }
      } else {
        setIsCustomerSession(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const toggleWishlist = (id: string) => {
    setWishlistIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const go = (p: Page) => {
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
      localStorage.setItem('binhi_current_page', p);
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

  const startBooking = (id: string, date: string, _guestCount: number, addons: string[]) => {
    setSelectedPackageId(id);
    setBookingDate(date);
    setBookingAddons(addons);
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
    page === 'admin-packages' ||
    page === 'admin-transport' ||
    page === 'admin-staff' ||
    page === 'admin-calendar' ||
    page === 'admin-reports' ||
    page === 'admin-inquiries' ||
    page === 'admin-loyalty' ||
    page === 'admin-reviews' ||
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
        {page === 'admin-packages' && <AdminPackagesPage go={go} />}
        {page === 'admin-transport' && <AdminTransportPage go={go} />}
        {page === 'admin-staff' && <AdminStaffPage go={go} />}
        {page === 'admin-calendar' && <AdminCalendarPage go={go} />}
        {page === 'admin-reports' && <AdminReportsPage go={go} />}
        {page === 'admin-inquiries' && <AdminInquiriesPage go={go} />}
        {page === 'admin-loyalty' && <AdminLoyaltyPage go={go} />}
        {page === 'admin-reviews' && <AdminReviewsPage go={go} />}
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

  return (
    <div className="min-h-screen bg-white text-[var(--ink)]">
      {showPublicHeader && <Header page={page} go={go} />}
      {showCustomerHeader && (
        <CustomerHeader
          page={page}
          go={(p) => (p === 'landing' ? handleLogout() : go(p))}
          wishlistCount={wishlistIds.length}
        />
      )}

      <main key={page} className="animate-blur-in">
        {page === 'landing' && <LandingPage go={go} goPackageDetail={goPackageDetail} />}
        {page === 'packages' && (
          <PackageCatalogPage
            goPackageDetail={goPackageDetail}
            isCustomer={isCustomerSession}
            wishlistIds={wishlistIds}
            toggleWishlist={toggleWishlist}
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
          />
        )}

        {/* Customer Portal Views */}
        {page === 'booking-tracker' && <BookingStatusPage go={go} />}
        {page === 'booking-history' && <BookingHistoryPage go={go} />}
        {page === 'wishlist' && (
          <WishlistPage
            go={go}
            goPackageDetail={goPackageDetail}
            wishlistIds={wishlistIds}
            toggleWishlist={toggleWishlist}
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