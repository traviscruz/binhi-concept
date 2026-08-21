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
  specs: { powerReq?: string; setupTime: string; crewSize: string };
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
    price: '₱15,000',
    rawPrice: 15000,
    desc: 'Sound system, basic lighting, one host mic. Built for debuts, small birthdays, and backyard gatherings.',
    img: '',
    photos: [],
    inclusions: [
      '2x Active PA 12-inch Speakers (1000W RMS)',
      '4x LED Color Uplights',
      '1x UHF Wireless Host Microphone',
      '1x Digital 8-Channel Compact Mixer',
      'Full Load-in, Soundcheck & On-site Technician',
    ],
    recommendedFor: [
      '18th Birthday Debuts (Small Venues)',
      'Intimate Garden Weddings',
      'Corporate Dinner Meetings',
      'Backyard Parties & Celebrations',
    ],
    specs: {
      powerReq: '220V 15A Single Phase',
      setupTime: '1.5 Hours',
      crewSize: '2 Technicians',
    },
  },
  {
    id: 'b',
    name: 'Package B — Celebration',
    tag: 'Celebration Setup',
    price: '₱28,000',
    rawPrice: 28000,
    desc: 'Full PA system, moving heads, LED uplights, two wireless mics. Built for birthdays, medium weddings, and reunions.',
    img: '',
    photos: [],
    inclusions: [
      '2x Dual 15-inch Subwoofers + 2x Top Speakers',
      '8x Moving Head Beam/Spot Lights with Trussing',
      '8x Wireless LED Par Uplights',
      '2x UHF Dual Wireless Microphones',
      '1x Digital 16-Channel Mixing Console',
      '1x Heavy-Duty Fog/Smoke Effect Unit',
      'Full Technical Crew (Sound & Lighting Operators)',
    ],
    recommendedFor: [
      'Grand 18th Birthdays & Debuts',
      'Medium-Sized Wedding Receptions',
      'Corporate Product Launches',
      'School Galas & Reunions',
    ],
    specs: {
      powerReq: '220V 30A Dedicated Line',
      setupTime: '2.5 Hours',
      crewSize: '3 Technicians',
    },
  },
  {
    id: 'c',
    name: 'Package C — Grand',
    tag: 'Grand Setup',
    price: '₱55,000',
    rawPrice: 55000,
    desc: 'P3 LED wall, line array truss rig, smoke machine, full band backline. Built for grand weddings, concerts, and corporate galas.',
    img: '',
    photos: [],
    inclusions: [
      '1x P3 HD Indoor LED Wall Panel (3.5m x 2m display)',
      '1x Active Line Array System (4x Tops + 2x Dual 18-inch Subs)',
      '12x Moving Head Lights + Overhead Aluminum Truss',
      '4x Wireless Microphones + In-Ear Monitor System',
      '1x Live Band Backline (Drum Kit, Bass Amp, Guitar Amps)',
      '1x High-Output Haze & Fog Machine',
      'Dedicated Stage Director, Sound Engineer & VJ',
    ],
    recommendedFor: [
      'Grand Hotel Weddings & Ballroom Galas',
      'Concerts & Live Music Events',
      'Large Corporate Anniversaries',
      'High-Profile Award Ceremonies',
    ],
    specs: {
      powerReq: '220V 50A Three-Phase / Generator',
      setupTime: '4.0 Hours',
      crewSize: '5 Technicians',
    },
  },
];