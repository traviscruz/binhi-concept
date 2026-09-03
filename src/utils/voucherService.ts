import { supabase } from './supabase';

export interface Voucher {
  id: string;
  code: string;
  description: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  max_uses: number | null; // null or 0 = unlimited
  used_count: number;
  is_all_time: boolean;
  start_date: string | null; // 'YYYY-MM-DD'
  end_date: string | null; // 'YYYY-MM-DD'
  status: 'active' | 'inactive';
  show_in_banner: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface VoucherValidationResult {
  valid: boolean;
  error?: string;
  voucher?: Voucher;
}

const STORAGE_KEY = 'binhi_vouchers_cache';

// BroadcastChannel for instant real-time sync across multiple browser tabs/windows
const syncChannel =
  typeof window !== 'undefined' && 'BroadcastChannel' in window
    ? new BroadcastChannel('binhi_vouchers_sync')
    : null;

// In-flight banner toggle overrides to eliminate network race conditions
const pendingBannerOverrides = new Map<string, boolean>();

if (syncChannel) {
  syncChannel.onmessage = (event) => {
    if (event.data?.type === 'vouchers-updated') {
      window.dispatchEvent(new CustomEvent('vouchers-updated'));
    }
  };
}

// Realtime postgres changes subscription
try {
  supabase
    .channel('binhi_vouchers_realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'vouchers' }, () => {
      notifyVouchersChanged();
    })
    .subscribe();
} catch (e) {
  console.warn('Realtime subscription note:', e);
}

function notifyVouchersChanged() {
  window.dispatchEvent(new CustomEvent('vouchers-updated'));
  try {
    syncChannel?.postMessage({ type: 'vouchers-updated', timestamp: Date.now() });
  } catch (e) {
    // Ignore postMessage errors in detached frames
  }
}

// Initial default seed vouchers with fixed sequence
const INITIAL_VOUCHERS: Voucher[] = [
  {
    id: 'voucher-binhi2026',
    code: 'BINHI2026',
    description: '10% Seasonal Event Discount',
    discount_type: 'percentage',
    discount_value: 10,
    max_uses: 100,
    used_count: 0,
    is_all_time: true,
    start_date: null,
    end_date: null,
    status: 'active',
    show_in_banner: true,
    created_at: '2026-09-01T00:00:04.000Z',
  },
  {
    id: 'voucher-binhi3k',
    code: 'BINHI3K',
    description: '₱3,000 Loyalty Voucher',
    discount_type: 'fixed',
    discount_value: 3000,
    max_uses: 50,
    used_count: 0,
    is_all_time: true,
    start_date: null,
    end_date: null,
    status: 'active',
    show_in_banner: true,
    created_at: '2026-09-01T00:00:03.000Z',
  },
  {
    id: 'voucher-earlybird',
    code: 'EARLYBIRD',
    description: '₱2,000 Early Booking Reward',
    discount_type: 'fixed',
    discount_value: 2000,
    max_uses: 30,
    used_count: 0,
    is_all_time: true,
    start_date: null,
    end_date: null,
    status: 'active',
    show_in_banner: false,
    created_at: '2026-09-01T00:00:02.000Z',
  },
  {
    id: 'voucher-welcome500',
    code: 'WELCOME500',
    description: '₱500 Celebration Discount',
    discount_type: 'fixed',
    discount_value: 500,
    max_uses: null,
    used_count: 0,
    is_all_time: true,
    start_date: null,
    end_date: null,
    status: 'active',
    show_in_banner: false,
    created_at: '2026-09-01T00:00:01.000Z',
  },
];

/**
 * Deterministic sort to guarantee stable position in UI across updates:
 * Primary: created_at descending (newest first)
 * Tie-breaker: voucher code ascending alphabetically
 */
export function sortVouchersDeterministically(list: Voucher[]): Voucher[] {
  return [...list].sort((a, b) => {
    const timeA = new Date(a.created_at || 0).getTime();
    const timeB = new Date(b.created_at || 0).getTime();
    if (timeA !== timeB) {
      return timeB - timeA;
    }
    return a.code.localeCompare(b.code);
  });
}

function getLocalVouchers(): Voucher[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return sortVouchersDeterministically(parsed);
      }
    }
  } catch (e) {
    console.warn('Error reading vouchers from localStorage:', e);
  }
  const initial = sortVouchersDeterministically(INITIAL_VOUCHERS);
  setLocalVouchers(initial, false);
  return initial;
}

function setLocalVouchers(vouchers: Voucher[], notify = true) {
  try {
    const sorted = sortVouchersDeterministically(vouchers);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sorted));
    if (notify) {
      notifyVouchersChanged();
    }
  } catch (e) {
    console.warn('Error saving vouchers to localStorage:', e);
  }
}

/**
 * Synchronously get active banner vouchers from local cache.
 * Enables instant 0ms updates in customer marquee when admin toggles.
 */
export function getBannerVouchersSync(): Voucher[] {
  const all = getLocalVouchers();
  return all.filter((v) => v.show_in_banner && isVoucherValid(v));
}

/**
 * Checks if a voucher is valid based on:
 * 1. status === 'active'
 * 2. usage count < max_uses (if specified)
 * 3. current date within start_date and end_date (if not is_all_time)
 */
export function isVoucherValid(voucher: Voucher): boolean {
  if (voucher.status !== 'active') return false;

  // Usage limit check (1 usage = 1 checkout)
  if (voucher.max_uses !== null && voucher.max_uses > 0 && voucher.used_count >= voucher.max_uses) {
    return false;
  }

  // Validity date check
  if (!voucher.is_all_time) {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    if (voucher.start_date && today < voucher.start_date) {
      return false;
    }
    if (voucher.end_date && today > voucher.end_date) {
      return false;
    }
  }

  return true;
}

/**
 * Returns human-readable status explanation for a voucher
 */
export function getVoucherStatusInfo(voucher: Voucher): {
  label: 'Active' | 'Limit Reached' | 'Expired' | 'Upcoming' | 'Inactive';
  color: string;
  isUsable: boolean;
} {
  if (voucher.status === 'inactive') {
    return { label: 'Inactive', color: 'bg-zinc-100 text-zinc-600 border-zinc-200', isUsable: false };
  }

  if (voucher.max_uses !== null && voucher.max_uses > 0 && voucher.used_count >= voucher.max_uses) {
    return { label: 'Limit Reached', color: 'bg-rose-50 text-rose-700 border-rose-200', isUsable: false };
  }

  if (!voucher.is_all_time) {
    const today = new Date().toISOString().split('T')[0];
    if (voucher.start_date && today < voucher.start_date) {
      return { label: 'Upcoming', color: 'bg-amber-50 text-amber-700 border-amber-200', isUsable: false };
    }
    if (voucher.end_date && today > voucher.end_date) {
      return { label: 'Expired', color: 'bg-rose-50 text-rose-700 border-rose-200', isUsable: false };
    }
  }

  return { label: 'Active', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', isUsable: true };
}

/**
 * Fetch all vouchers (Admin view) from Supabase with fallback to local storage
 */
export async function fetchAllVouchers(): Promise<Voucher[]> {
  try {
    const { data, error } = await supabase
      .from('vouchers')
      .select('*')
      .order('created_at', { ascending: false })
      .order('code', { ascending: true });

    if (!error && data && data.length > 0) {
      const formatted: Voucher[] = data.map((row: any) => {
        // If there's an in-flight local toggle, preserve it over stale network responses
        const override = pendingBannerOverrides.get(row.id);
        const bannerVal = override !== undefined ? override : Boolean(row.show_in_banner);

        return {
          id: row.id,
          code: row.code,
          description: row.description || '',
          discount_type: row.discount_type === 'fixed' ? 'fixed' : 'percentage',
          discount_value: Number(row.discount_value ?? 0),
          max_uses: row.max_uses !== null && row.max_uses !== undefined ? Number(row.max_uses) : null,
          used_count: Number(row.used_count ?? 0),
          is_all_time: Boolean(row.is_all_time ?? true),
          start_date: row.start_date || null,
          end_date: row.end_date || null,
          status: row.status === 'inactive' ? 'inactive' : 'active',
          show_in_banner: bannerVal,
          created_at: row.created_at,
          updated_at: row.updated_at,
        };
      });
      const sorted = sortVouchersDeterministically(formatted);
      setLocalVouchers(sorted, false);
      return sorted;
    }
  } catch (err) {
    console.warn('Note: vouchers table fallback to local cache:', err);
  }

  return getLocalVouchers();
}

/**
 * Fetch vouchers currently configured and eligible to display in the scrolling marquee banner
 */
export async function fetchBannerVouchers(): Promise<Voucher[]> {
  const all = await fetchAllVouchers();
  return all.filter((v) => v.show_in_banner && isVoucherValid(v));
}

/**
 * Validate voucher code submitted at checkout
 */
export async function validateVoucherCode(rawCode: string): Promise<VoucherValidationResult> {
  const code = rawCode.trim().toUpperCase();
  if (!code) {
    return { valid: false, error: 'Please enter a promo code.' };
  }

  const all = await fetchAllVouchers();
  const voucher = all.find((v) => v.code.toUpperCase() === code);

  if (!voucher) {
    return { valid: false, error: `"${code}" is not a valid promo or voucher code.` };
  }

  if (voucher.status !== 'active') {
    return { valid: false, error: `Voucher "${code}" is currently deactivated.` };
  }

  if (voucher.max_uses !== null && voucher.max_uses > 0 && voucher.used_count >= voucher.max_uses) {
    return {
      valid: false,
      error: `Voucher "${code}" has reached its maximum redemption limit (${voucher.max_uses} checkouts).`,
    };
  }

  if (!voucher.is_all_time) {
    const today = new Date().toISOString().split('T')[0];
    if (voucher.start_date && today < voucher.start_date) {
      return {
        valid: false,
        error: `Voucher "${code}" will only be valid starting ${new Date(voucher.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}.`,
      };
    }
    if (voucher.end_date && today > voucher.end_date) {
      return {
        valid: false,
        error: `Voucher "${code}" has expired as of ${new Date(voucher.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}.`,
      };
    }
  }

  return { valid: true, voucher };
}

/**
 * Records a voucher usage (1 usage = 1 checkout).
 * Increments used_count in Supabase and local cache.
 */
export async function recordVoucherUsage(rawCode: string): Promise<void> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return;

  // Local cache update
  const local = getLocalVouchers();
  const index = local.findIndex((v) => v.code.toUpperCase() === code);
  if (index !== -1) {
    local[index].used_count = (local[index].used_count || 0) + 1;
    setLocalVouchers([...local]);
  }

  // Supabase update
  try {
    const { data: existing } = await supabase
      .from('vouchers')
      .select('id, used_count')
      .ilike('code', code)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('vouchers')
        .update({
          used_count: (existing.used_count || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    }
  } catch (err) {
    console.warn('Error recording voucher usage in Supabase:', err);
  }
}

/**
 * Save (create or update) a voucher
 */
export async function saveVoucher(voucher: Partial<Voucher> & { code: string }): Promise<Voucher> {
  const cleanCode = voucher.code.trim().toUpperCase();
  const payload = {
    code: cleanCode,
    description: voucher.description?.trim() || '',
    discount_type: voucher.discount_type || 'percentage',
    discount_value: Number(voucher.discount_value) || 0,
    max_uses: voucher.max_uses !== undefined && voucher.max_uses !== null && voucher.max_uses > 0 ? Number(voucher.max_uses) : null,
    used_count: Number(voucher.used_count) || 0,
    is_all_time: Boolean(voucher.is_all_time),
    start_date: voucher.is_all_time ? null : (voucher.start_date || null),
    end_date: voucher.is_all_time ? null : (voucher.end_date || null),
    status: voucher.status || 'active',
    show_in_banner: Boolean(voucher.show_in_banner),
    updated_at: new Date().toISOString(),
  };

  let savedVoucher: Voucher;

  // Try Supabase first
  try {
    if (voucher.id && !voucher.id.startsWith('voucher-')) {
      const { data, error } = await supabase
        .from('vouchers')
        .update(payload)
        .eq('id', voucher.id)
        .select()
        .single();
      if (error) throw error;
      savedVoucher = { ...data };
    } else {
      const { data, error } = await supabase
        .from('vouchers')
        .insert({
          ...payload,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (error) throw error;
      savedVoucher = { ...data };
    }
  } catch (err) {
    console.warn('Note: saving voucher to local cache fallback:', err);
    // Local fallback
    const local = getLocalVouchers();
    if (voucher.id) {
      const idx = local.findIndex((v) => v.id === voucher.id || v.code.toUpperCase() === cleanCode);
      if (idx !== -1) {
        local[idx] = { ...local[idx], ...payload, id: local[idx].id } as Voucher;
        savedVoucher = local[idx];
      } else {
        savedVoucher = { ...payload, id: voucher.id, created_at: new Date().toISOString() } as Voucher;
        local.unshift(savedVoucher);
      }
    } else {
      savedVoucher = { ...payload, id: `voucher-${Date.now()}`, created_at: new Date().toISOString() } as Voucher;
      local.unshift(savedVoucher);
    }
    setLocalVouchers(local);
    return savedVoucher;
  }

  // Keep local cache synced
  const local = getLocalVouchers();
  const idx = local.findIndex((v) => v.id === savedVoucher.id || v.code.toUpperCase() === cleanCode);
  if (idx !== -1) {
    local[idx] = savedVoucher;
  } else {
    local.unshift(savedVoucher);
  }
  setLocalVouchers(local);

  return savedVoucher;
}

/**
 * Delete a voucher
 */
export async function deleteVoucher(id: string): Promise<void> {
  try {
    await supabase.from('vouchers').delete().eq('id', id);
  } catch (err) {
    console.warn('Note: deleting voucher from local cache fallback:', err);
  }

  const local = getLocalVouchers().filter((v) => v.id !== id);
  setLocalVouchers(local);
}

/**
 * Toggle banner display for a voucher with instant local broadcast and race-condition immunity
 */
export async function toggleVoucherBanner(id: string, showInBanner: boolean): Promise<void> {
  // 1. Register override to protect against stale reads during network flight
  pendingBannerOverrides.set(id, showInBanner);

  // 2. Immediately update local cache and broadcast (0ms instant real-time response)
  const local = getLocalVouchers();
  const item = local.find((v) => v.id === id);
  if (item) {
    item.show_in_banner = showInBanner;
    item.updated_at = new Date().toISOString();
  }
  setLocalVouchers([...local], true);

  // 3. Persist in background to Supabase
  try {
    const { error } = await supabase
      .from('vouchers')
      .update({ show_in_banner: showInBanner, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) console.warn('Supabase toggle banner note:', error);
  } catch (err) {
    console.warn('Note: updating banner toggle in Supabase fallback:', err);
  } finally {
    // Keep override active briefly to ensure no in-flight stale requests overwrite
    setTimeout(() => {
      pendingBannerOverrides.delete(id);
    }, 1200);
  }
}
