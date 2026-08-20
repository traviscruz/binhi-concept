import { useState } from 'react';
import './App.css';

import type { Page } from './types';
import { Header } from './components/layout/Header';
import { CustomerHeader } from './components/layout/CustomerHeader';
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

export default function App() {
  const [page, setPage] = useState<Page>('landing');
  const [selectedPackageId, setSelectedPackageId] = useState<string>('b');
  const [selectedItemId, setSelectedItemId] = useState<string>('led-wall');

  const [bookingDate, setBookingDate] = useState('2026-09-14');
  const [bookingAddons, setBookingAddons] = useState<string[]>(['add-smoke']);
  const [isCustomerSession, setIsCustomerSession] = useState(false);
  const [wishlistIds, setWishlistIds] = useState<string[]>(['a', 'b']);

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
    setPage(p);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const handleLogout = () => {
    setIsCustomerSession(false);
    go('landing');
  };

  const goPackageDetail = (id: string) => {
    setSelectedPackageId(id);
    go('package-detail');
  };

  const goItemDetail = (id: string) => {
    setSelectedItemId(id);
    go('item-detail');
  };

  const startBooking = (id: string, date: string, _guestCount: number, addons: string[]) => {
    setSelectedPackageId(id);
    setBookingDate(date);
    setBookingAddons(addons);
    go('checkout');
  };

  const isAuthOrCheckout =
    page === 'checkout' ||
    page === 'login' ||
    page === 'signup' ||
    page === 'forgot' ||
    page === 'otp';

  const showPublicHeader = !isAuthOrCheckout && !isCustomerSession;
  const showCustomerHeader = !isAuthOrCheckout && isCustomerSession;
  const showFooter = !isAuthOrCheckout && !isCustomerSession;

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

      <main>
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