export interface AssignedBooking {
  id: string;
  customer: string;
  package: string;
  date: string;
  callTime: string;
  venue: string;
  venueAddress: string;
  coordinates: { lat: number; lng: number };
  loadingBayNote: string;
  crewRole: string;
  leadTechnician: string;
  crewSize: string;
  powerSpecs: string;
  riggingWindow: string;
  status: 'Pending Setup' | 'Setup In Progress' | 'Setup Complete' | 'Teardown Complete';
  rawDate?: string;
}

export const INITIAL_ASSIGNED_BOOKINGS: AssignedBooking[] = [
  {
    id: 'BNH-2026-889',
    customer: 'Patricia Reyes',
    package: 'Grand Wedding Production (P3 LED + Line Array)',
    date: 'September 14, 2026',
    callTime: '08:00 AM (Rigging & Cable Run)',
    venue: 'Shangri-La The Fort, BGC (Grand Ballroom)',
    venueAddress: '30th Street corner 5th Avenue, Bonifacio Global City, Taguig, 1634 Metro Manila',
    coordinates: { lat: 14.5516, lng: 121.0478 },
    loadingBayNote: 'Ingress at Loading Dock B via 30th Street ramp. Security pass required at gate. Service Freight Elevator #4 direct to Level 3 Grand Ballroom.',
    crewRole: 'Lead Audio & Rigging Technician',
    leadTechnician: 'Marco Valenzuela',
    crewSize: '4 Audio/Lighting Techs',
    powerSpecs: 'Single 220V 30A Industrial Breaker + 16A auxiliary line',
    riggingWindow: '3 Hours Prior to Call Time',
    status: 'Setup In Progress',
  },
  {
    id: 'BNH-2026-902',
    customer: 'Dennis Gomez',
    package: 'Standard Concert Sound & Lighting Truss',
    date: 'October 5, 2026',
    callTime: '11:00 AM (Stage Setup)',
    venue: 'The Blue Leaf Events Pavilion, McKinley',
    venueAddress: '100 Park Avenue, McKinley Hill Village, Taguig, 1630 Metro Manila',
    coordinates: { lat: 14.5348, lng: 121.0504 },
    loadingBayNote: 'Rear service driveway Gate 2. Ground level roll-in stage entry via Jade Pavilion service door. Dedicated equipment truck parking bay.',
    crewRole: 'Lighting & Hazer Operator',
    leadTechnician: 'Dennis Gomez',
    crewSize: '3 Stage Techs',
    powerSpecs: 'Dual 220V 20A Wall Outlets',
    riggingWindow: '2 Hours Prior to Call Time',
    status: 'Pending Setup',
  },
  {
    id: 'BNH-2026-104',
    customer: 'Angela Mercado',
    package: 'Minimalist Sound & Mic Package',
    date: 'June 20, 2026',
    callTime: '02:00 PM (Quick Setup)',
    venue: 'Manila Metropolitan Theater Annex',
    venueAddress: 'Padre Burgos Ave, Ermita, Manila, 1000 Metro Manila',
    coordinates: { lat: 14.5951, lng: 120.9806 },
    loadingBayNote: 'Stage Door service entrance along Arroceros street side. Pre-registered crew vehicle badge needed at check-in counter.',
    crewRole: 'Sound Engineer',
    leadTechnician: 'Angela Mercado',
    crewSize: '2 Sound Techs',
    powerSpecs: 'Standard 220V 15A Clean Audio Line',
    riggingWindow: '1.5 Hours Prior to Call Time',
    status: 'Teardown Complete',
  },
];
