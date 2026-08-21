export interface EquipmentItem {
  id: string;
  name: string;
  category: string;
  status: string;
  price: string;
  rawPrice: number;
  desc: string;
  img: string;
  photos: { url: string; label: string }[];
  specs: string[];
  includedInPackages: string[];
}

export const EQUIPMENT_ITEMS: EquipmentItem[] = [
  {
    id: 'led-wall',
    name: 'P3 HD Indoor LED Wall Panel (3.5m x 2m)',
    category: 'Video & Visuals',
    status: 'Available',
    price: '₱18,000',
    rawPrice: 18000,
    desc: 'High-definition 3mm pixel pitch indoor LED video display. Supports live camera feeds, visual loops, and 4K video playback.',
    img: '',
    photos: [],
    specs: [
      'Pixel Pitch: 3.91mm HD Indoor',
      'Screen Size: 3.5m Width x 2m Height (7 sqm)',
      'Refresh Rate: 3840Hz zero camera flicker',
      'Processor: Novastar Video Controller with HDMI / SDI input',
    ],
    includedInPackages: ['Package C — Grand'],
  },
  {
    id: 'line-array',
    name: 'Active Concert Line Array Speaker Rig (4 Tops + 2 Subs)',
    category: 'Audio Production',
    status: 'Available',
    price: '₱14,000',
    rawPrice: 14000,
    desc: 'Professional dual 8-inch line array modules with 18-inch powered subwoofers for crystal-clear vocals and punchy bass.',
    img: '',
    photos: [],
    specs: [
      'Total Output: 4800W RMS Continuous',
      'Coverage Pattern: 110° Horizontal x 10° Vertical per module',
      'DSP: Built-in FIR filter processing',
      'Max SPL: 134dB Peak',
    ],
    includedInPackages: ['Package C — Grand'],
  },
  {
    id: 'moving-head',
    name: 'Moving Head Beam/Spot Light Set (8 Units)',
    category: 'Lighting',
    status: 'Reserved · Sep 14',
    price: '₱8,500',
    rawPrice: 8500,
    desc: 'High-power 230W 7R moving head lights with gobo wheels, prism effects, and synchronized DMX lightshow control.',
    img: '',
    photos: [],
    specs: [
      'Lamp Source: 230W 7R Discharge Lamp',
      'Color Wheel: 14 colors + open with rainbow effect',
      'Gobo Wheel: 17 static gobos + open',
      'Control Mode: DMX512 / Master-Slave / Sound Active',
    ],
    includedInPackages: ['Package B — Celebration', 'Package C — Grand'],
  },
  {
    id: 'smoke-machine',
    name: 'Low-Lying Fog & Smoke Machine',
    category: 'Stage Effects',
    status: 'Under repair',
    price: '₱4,500',
    rawPrice: 4500,
    desc: 'Water-based low fog generator for "dancing on clouds" bridal entrance effect and dramatic stage atmospheres.',
    img: '',
    photos: [],
    specs: [
      'Fluid Type: Water-based non-toxic fog fluid',
      'Output: 15,000 cu.ft / min',
      'Warm-Up Time: 4 Minutes',
      'Control: Wireless remote + DMX channel',
    ],
    includedInPackages: ['Package B — Celebration', 'Package C — Grand'],
  },
];

export const INVENTORY_PREVIEW = [
  { name: 'LED Wall Panel (P3)', status: 'Available', dot: 'bg-emerald-500' },
  { name: 'Moving Head Set (x8)', status: 'Reserved · Sep 14', dot: 'bg-amber-500' },
  { name: 'Line Array Speaker', status: 'Available', dot: 'bg-emerald-500' },
  { name: 'Smoke Machine', status: 'Under repair', dot: 'bg-rose-500' },
];