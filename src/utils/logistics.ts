import { supabase } from '../lib/supabase';

export interface LogisticsConfig {
  warehouseName: string;
  warehouseAddress: string;
  warehouseLat: number;
  warehouseLng: number;
  freeRadiusKm: number;
  isFreeRadiusEnabled: boolean;
}

export const DEFAULT_LOGISTICS_CONFIG: LogisticsConfig = {
  warehouseName: 'BINHI Central Warehouse & Production Hub',
  warehouseAddress: 'BINHI Hub, Bonifacio Global City, Taguig, Metro Manila, Philippines',
  warehouseLat: 14.5547,
  warehouseLng: 121.0456,
  freeRadiusKm: 2.0,
  isFreeRadiusEnabled: true,
};

const STORAGE_KEY = 'binhi_logistics_config';

/**
 * Calculates distance in kilometers between two geo coordinates using Haversine formula
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return Number(distance.toFixed(2));
}

/**
 * Fetches logistics warehouse & proximity waiver configuration
 */
export async function fetchLogisticsConfig(): Promise<LogisticsConfig> {
  try {
    const { data, error } = await supabase
      .from('logistics_settings')
      .select('*')
      .eq('id', 'default')
      .maybeSingle();

    if (!error && data) {
      const config: LogisticsConfig = {
        warehouseName: data.warehouse_name || DEFAULT_LOGISTICS_CONFIG.warehouseName,
        warehouseAddress: data.warehouse_address || DEFAULT_LOGISTICS_CONFIG.warehouseAddress,
        warehouseLat: Number(data.warehouse_lat) || DEFAULT_LOGISTICS_CONFIG.warehouseLat,
        warehouseLng: Number(data.warehouse_lng) || DEFAULT_LOGISTICS_CONFIG.warehouseLng,
        freeRadiusKm: Number(data.free_radius_km ?? DEFAULT_LOGISTICS_CONFIG.freeRadiusKm),
        isFreeRadiusEnabled: data.is_free_radius_enabled !== false,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      return config;
    }
  } catch (err) {
    // Graceful fallback if table doesn't exist yet
  }

  // Check localStorage cached config
  const cached = localStorage.getItem(STORAGE_KEY);
  if (cached) {
    try {
      return { ...DEFAULT_LOGISTICS_CONFIG, ...JSON.parse(cached) };
    } catch {}
  }

  return DEFAULT_LOGISTICS_CONFIG;
}

/**
 * Saves logistics warehouse & proximity waiver configuration
 */
export async function saveLogisticsConfig(
  config: Partial<LogisticsConfig>
): Promise<LogisticsConfig> {
  const merged: LogisticsConfig = {
    ...DEFAULT_LOGISTICS_CONFIG,
    ...config,
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));

  try {
    await supabase.from('logistics_settings').upsert({
      id: 'default',
      warehouse_name: merged.warehouseName,
      warehouse_address: merged.warehouseAddress,
      warehouse_lat: merged.warehouseLat,
      warehouse_lng: merged.warehouseLng,
      free_radius_km: merged.freeRadiusKm,
      is_free_radius_enabled: merged.isFreeRadiusEnabled,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Could not save to logistics_settings table:', err);
  }

  return merged;
}
