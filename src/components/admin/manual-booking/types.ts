import type { PackageData } from '../../../data/packages';

export interface TransportRuleOption {
  id: string;
  region: string;
  baseFee: number;
}

export interface AddonModel {
  modelId: string;
  name: string;
  brand: string;
  category: string;
  rentalRate: number;
  availableCount: number;
}

export interface AddonSelection {
  [modelId: string]: number;
}

export interface ManualBookingSuccessData {
  ref: string;
  customer: string;
  channel: string;
  package: string;
  date: string;
  total: number;
  paid: number;
  balance: number;
  receiptUrl: string;
  isFull: boolean;
}

export const CHANNELS = [
  { id: 'Walk-in', label: 'Walk-in Customer' },
  { id: 'Phone Call', label: 'Phone Call' },
  { id: 'Viber', label: 'Viber Chat' },
  { id: 'Facebook', label: 'Facebook / Messenger' },
  { id: 'Instagram', label: 'Instagram DM' },
  { id: 'WhatsApp', label: 'WhatsApp' },
  { id: 'Other', label: 'Other' },
];

export const PAYMENT_METHODS = [
  'Cash on Hand / Office',
  'GCash E-Wallet',
  'Maya Wallet',
  'Bank Transfer (BDO)',
  'Bank Transfer (BPI)',
  'Credit / Debit Card (Terminal)',
  'Bank Cheque',
  'Other Payment Method',
];
