export type Page =
  | 'landing'
  | 'packages'
  | 'package-detail'
  | 'equipment'
  | 'item-detail'
  | 'about'
  | 'contact'
  | 'testimonials'
  | 'login'
  | 'signup'
  | 'forgot'
  | 'otp'
  | 'checkout'
  | 'booking-tracker'
  | 'booking-history'
  | 'wishlist'
  | 'loyalty'
  | 'review-submit'
  | 'profile'
  | 'inventory-dashboard'
  | 'inventory-items'
  | 'inventory-units'
  | 'inventory-alerts'
  | 'inventory-reports'
  | 'admin-dashboard'
  | 'admin-bookings'
  | 'admin-packages'
  | 'admin-transport'
  | 'admin-staff'
  | 'admin-calendar'
  | 'admin-reports'
  | 'admin-inquiries'
  | 'admin-loyalty'
  | 'admin-reviews'
  | 'crew-assigned-bookings'
  | 'crew-booking-detail'
  | 'crew-setup-teardown'

export type UserRole = 'customer' | 'inventory_manager' | 'admin' | 'crew'

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
