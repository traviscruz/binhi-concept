export type Page =
  | 'landing'
  | 'packages'
  | 'package-detail'
  | 'custom-package'
  | 'equipment'
  | 'item-detail'
  | 'about'
  | 'contact'
  | 'testimonials'
  | 'affiliates'
  | 'partner-login'
  | 'partner-dashboard'
  | 'partner-profile'
  | 'login'
  | 'signup'
  | 'forgot'
  | 'otp'
  | 'checkout'
  | 'payment-success'
  | 'payment-failure'
  | 'payment-cancel'
  | 'booking-tracker'
  | 'booking-history'
  | 'wishlist'
  | 'loyalty'
  | 'review-submit'
  | 'my-reviews'
  | 'profile'
  | 'inventory-dashboard'
  | 'inventory-items'
  | 'inventory-units'
  | 'inventory-alerts'
  | 'inventory-reports'
  | 'inventory-maintenance-reports'
  | 'inventory-profile'
  | 'admin-dashboard'
  | 'admin-bookings'
  | 'admin-manual-booking'
  | 'admin-packages'
  | 'admin-transport'
  | 'admin-cancellation-policy'
  | 'admin-staff'
  | 'admin-calendar'
  | 'admin-reports'
  | 'admin-inquiries'
  | 'admin-vouchers'
  | 'admin-loyalty'
  | 'admin-reviews'
  | 'admin-affiliates'
  | 'admin-audit-logs'
  | 'admin-profile'
  | 'crew-assigned-bookings'
  | 'crew-booking-detail'
  | 'crew-setup-teardown'
  | 'crew-profile'

export type UserRole = 'customer' | 'inventory_manager' | 'admin' | 'crew' | 'partner'

export interface User {
  id: string
  email: string
  role: UserRole
}

export interface Service {
  id: string
  name: string
  description: string
  price: number
}

export interface Booking {
  id: string
  userId: string
  serviceId: string
  eventDate: string
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled'
}
