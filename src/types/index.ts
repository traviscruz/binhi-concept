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

export type UserRole = 'customer' | 'inventory_manager' | 'admin' | 'event_staff'

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
