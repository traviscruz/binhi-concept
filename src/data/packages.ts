export interface PackageSpecs {
  powerReq?: string;
  setupTime: string;
  crewSize: string;
  venueSize?: string;
  guestCapacity?: string;
  defaultGuests?: number;
  guestMin?: number;
  guestMax?: number;
  acousticCoverage?: string;
}

export interface PackageData {
  id: string;
  name: string;
  tag: string;
  price: string;
  rawPrice: number;
  desc: string;
  img: string;
  photos: { url: string; label: string }[];
  inclusions: string[];
  recommendedFor: string[];
  specs: PackageSpecs;
}

export function getPackagePhotoCount(pkg?: Partial<PackageData> | null): number {
  if (!pkg) return 0;
  let photoList: any[] = [];
  if (Array.isArray(pkg.photos)) {
    photoList = pkg.photos;
  } else if (typeof pkg.photos === 'string') {
    try {
      const parsed = JSON.parse(pkg.photos as any);
      if (Array.isArray(parsed)) photoList = parsed;
    } catch (e) {}
  }

  const validGalleryCount = photoList.filter((p) => {
    const url = typeof p === 'string' ? p : p?.url || p?.src || p?.image_url;
    return Boolean(
      url &&
      typeof url === 'string' &&
      url.trim().length > 0 &&
      !url.includes('picsum.photos')
    );
  }).length;

  const hasMainImg = Boolean(
    pkg.img &&
    typeof pkg.img === 'string' &&
    pkg.img.trim().length > 0 &&
    !pkg.img.includes('picsum.photos')
  );

  return validGalleryCount > 0 ? validGalleryCount : (hasMainImg ? 1 : 0);
}

export const FEATURED_PACKAGES: PackageData[] = [
  {
    id: 'a',
    name: 'Package A — Intimate',
    tag: 'Intimate Setup',
    price: '₱8,500',
    rawPrice: 8500,
    desc: 'Basic sound system with 2 wireless mics and simple par LED lighting. Built for small, simple gatherings and intimate spaces.',
    img: '',
    photos: [],
    inclusions: [
      '2x Active PA 12-inch Speakers (1000W RMS)',
      '4x LED Color Par Uplights',
      '2x UHF Wireless Host Microphones',
      '1x Digital 8-Channel Compact Audio Mixer',
    ],
    recommendedFor: [
      'Simple Birthday Parties',
      'Small Backyard Weddings',
      'Private Dinners & Anniversaries',
      'Condo Function Gatherings',
    ],
    specs: {
      powerReq: '220V 10A Standard Outlet',
      setupTime: '1.0 Hour',
      crewSize: '1-2 Technicians',
      venueSize: '25 – 60 sq.m',
      guestCapacity: '15 – 50 Guests',
      guestMin: 15,
      guestMax: 60,
      acousticCoverage: 'Intimate Near-Field Vocal & Acoustic Clarity',
    },
  },
  {
    id: 'b',
    name: 'Package B — Essential',
    tag: 'Essential Setup',
    price: '₱12,000',
    rawPrice: 12000,
    desc: 'Basic audio with fuller backdrop lighting and dual frontal lights. A step up for slightly bigger small-venue events.',
    img: '',
    photos: [],
    inclusions: [
      '2x Powered 15-inch Main Speakers',
      '6x LED Stage & Backdrop Uplights',
      '2x Frontal Warm White Face Lights with Stands',
      '2x UHF Wireless Handheld Mics',
      '1x 12-Channel Audio Mixer with Bluetooth & Aux',
    ],
    recommendedFor: [
      'Simple Birthday Parties',
      'Small Venue Weddings',
      'Community & Clubhouse Events',
      'Rooftop Acoustic Nights',
    ],
    specs: {
      powerReq: '220V 15A Dedicated Circuit',
      setupTime: '1.5 Hours',
      crewSize: '2 Technicians',
      venueSize: '50 – 120 sq.m',
      guestCapacity: '40 – 90 Guests',
      guestMin: 30,
      guestMax: 100,
      acousticCoverage: 'Balanced Speech & Background Ambient Sound Field',
    },
  },
  {
    id: 'c',
    name: 'Package C — Semi Loud',
    tag: 'Semi Loud Setup',
    price: '₱15,000',
    rawPrice: 15000,
    desc: 'Semi loud audio with subwoofer and basic lighting package. Suited for medium-sized celebrations that need more sound presence.',
    img: '',
    photos: [],
    inclusions: [
      '2x High-Output 15-inch Tops + 1x 18-inch Subwoofer',
      '8x Multi-Color LED Par Lights',
      '2x Dual UHF Wireless Mics + 1x Backup Corded Mic',
      '1x 16-Channel Digital Sound Console',
    ],
    recommendedFor: [
      'Birthday Debut Parties',
      'Wedding Receptions',
      'Christening & Milestone Celebrations',
      'Medium Function Hall Gatherings',
    ],
    specs: {
      powerReq: '220V 20A Dedicated Line',
      setupTime: '2.0 Hours',
      crewSize: '2-3 Technicians',
      venueSize: '100 – 200 sq.m',
      guestCapacity: '70 – 160 Guests',
      guestMin: 50,
      guestMax: 180,
      acousticCoverage: 'Full-Range High-Energy PA with Dedicated Low-End Bass',
    },
  },
  {
    id: 'd',
    name: 'Package D — Semi Advance',
    tag: 'Semi Advance Setup',
    price: '₱22,000',
    rawPrice: 22000,
    desc: 'Basic audio paired with semi advance lighting — moving heads, smoke machine, and expanded par LEDs. For events wanting more visual impact.',
    img: '',
    photos: [],
    inclusions: [
      '2x Dual 15-inch Subwoofers + 2x Top Speakers',
      '4x Intelligent Moving Head Beam/Spot Fixtures',
      '8x Wireless LED Par Mood Uplights',
      '1x Professional Heavy Fog / Smoke Machine',
      '2x UHF Dual Wireless Microphones',
    ],
    recommendedFor: [
      'Birthday Debut Parties (Themed Lighting)',
      'Hotel Wedding Receptions',
      'Corporate Product Launches',
      'Youth Rallies & School Galas',
    ],
    specs: {
      powerReq: '220V 30A Dedicated Line',
      setupTime: '2.5 Hours',
      crewSize: '3 Technicians',
      venueSize: '150 – 300 sq.m',
      guestCapacity: '100 – 250 Guests',
      guestMin: 80,
      guestMax: 280,
      acousticCoverage: 'Dynamic Club & Dance Floor Sound Reinforcement',
    },
  },
  {
    id: 'e',
    name: 'Package E — Full Production',
    tag: 'Full Production Setup',
    price: '₱35,000',
    rawPrice: 35000,
    desc: 'Loud audio with monitor speakers, wired and wireless mics, plus semi advance lighting with moving heads and smoke effects. Built for bigger crowds and outdoor spaces.',
    img: '',
    photos: [],
    inclusions: [
      '4x Active Main PA Tops + 2x Dual 18-inch Subwoofers',
      '2x Active Stage Floor Monitors',
      '6x Moving Head Lights + T-Bar / Aluminum Trussing',
      '12x LED Par Fixtures (Stage & Ambient Wash)',
      '4x UHF Wireless Mics + Drum / Instrument Mic Kit',
      '1x High-Output Haze & Fog Machine',
    ],
    recommendedFor: [
      'Grand Wedding Receptions',
      '18th Birthday Debuts (Large Hall)',
      'Outdoor Concerts & Live Bands',
      'Corporate Gala Dinners & Award Nights',
    ],
    specs: {
      powerReq: '220V 40A Heavy-Duty Single Phase',
      setupTime: '3.5 Hours',
      crewSize: '4 Technicians',
      venueSize: '300 – 550 sq.m',
      guestCapacity: '200 – 450 Guests',
      guestMin: 150,
      guestMax: 500,
      acousticCoverage: 'High-SPL Long-Throw Audio with Dedicated Stage Monitors',
    },
  },
  {
    id: 'full',
    name: 'Package FULL — Grand Production',
    tag: 'Grand Production Setup',
    price: '₱65,000',
    rawPrice: 65000,
    desc: 'Maximum loud audio with dual monitor and center subwoofers, full mic complement, and semi advance lighting with 6 moving heads. The complete package for major productions.',
    img: '',
    photos: [],
    inclusions: [
      'Full Active Line Array System (6x Line Array Tops + 4x Dual 18-inch Subs)',
      '4x Dedicated Stage Wedge Monitors',
      '8x Intelligent Moving Head Fixtures on Box Aluminum Truss Rig',
      '16x Wireless LED Par 64 Uplights & Stage Profile Lekos',
      '6x UHF Dual Wireless Microphones + In-Ear Monitor System',
      '1x Live Band Full Backline & Multi-Track Recording Mixer',
      '2x Heavy-Duty Low-Lying Dry Ice Fog & Haze Generators',
    ],
    recommendedFor: [
      'Grand Wedding Receptions (5-Star Ballrooms)',
      'Large-Scale Debuts & Pageants',
      'Concerts & Music Festivals',
      'Major Corporate Conventions & Summits',
    ],
    specs: {
      powerReq: '220V 60A Three-Phase Line / Generator Set',
      setupTime: '4.5 Hours',
      crewSize: '5-6 Technicians',
      venueSize: '500 – 1,000+ sq.m',
      guestCapacity: '400 – 1,000+ Guests',
      guestMin: 250,
      guestMax: 1000,
      acousticCoverage: 'Concert-Grade Multi-Sub Audio Rig with 360° Stage Illumination',
    },
  },
];