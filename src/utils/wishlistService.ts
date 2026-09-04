import { supabase } from './supabase';

const LOCAL_STORAGE_KEY = 'binhi_wishlist_ids';

/**
 * Get cached wishlist IDs from localStorage
 */
export function getLocalWishlistIds(): string[] {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error('Failed to parse local wishlist:', e);
  }
  return [];
}

/**
 * Save wishlist IDs to localStorage
 */
export function saveLocalWishlistIds(ids: string[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(ids));
  } catch (e) {
    console.error('Failed to save local wishlist:', e);
  }
}

/**
 * Fetch wishlist package IDs from Supabase database (CRUD - Read)
 */
export async function fetchWishlistFromDb(userId?: string | null): Promise<string[]> {
  try {
    // If no userId provided, attempt to get active authenticated user
    let uid = userId;
    if (!uid) {
      const { data: { user } } = await supabase.auth.getUser();
      uid = user?.id || null;
    }

    if (!uid) {
      return getLocalWishlistIds();
    }

    const { data, error } = await supabase
      .from('wishlists')
      .select('package_id')
      .eq('user_id', uid);

    if (error) {
      console.warn('Could not query wishlists table (table might not exist yet or offline):', error.message);
      return getLocalWishlistIds();
    }

    const dbIds = (data || []).map((row: any) => row.package_id);
    saveLocalWishlistIds(dbIds);
    return dbIds;
  } catch (err) {
    console.error('Error fetching wishlists from Supabase:', err);
    return getLocalWishlistIds();
  }
}

/**
 * Add package to database wishlist (CRUD - Create)
 */
export async function addToWishlistDb(packageId: string, userId?: string | null): Promise<void> {
  try {
    let uid = userId;
    if (!uid) {
      const { data: { user } } = await supabase.auth.getUser();
      uid = user?.id || null;
    }

    if (!uid) {
      // Save locally if guest
      const current = getLocalWishlistIds();
      if (!current.includes(packageId)) {
        saveLocalWishlistIds([...current, packageId]);
      }
      return;
    }

    const { error } = await supabase
      .from('wishlists')
      .upsert(
        { user_id: uid, package_id: packageId },
        { onConflict: 'user_id,package_id' }
      );

    if (error) {
      console.warn('Failed to insert into wishlists table in Supabase:', error.message);
    }
  } catch (err) {
    console.error('Error adding to wishlist in DB:', err);
  }
}

/**
 * Remove package from database wishlist (CRUD - Delete)
 */
export async function removeFromWishlistDb(packageId: string, userId?: string | null): Promise<void> {
  try {
    let uid = userId;
    if (!uid) {
      const { data: { user } } = await supabase.auth.getUser();
      uid = user?.id || null;
    }

    if (!uid) {
      // Remove locally if guest
      const current = getLocalWishlistIds();
      saveLocalWishlistIds(current.filter((id) => id !== packageId));
      return;
    }

    const { error } = await supabase
      .from('wishlists')
      .delete()
      .eq('user_id', uid)
      .eq('package_id', packageId);

    if (error) {
      console.warn('Failed to delete from wishlists table in Supabase:', error.message);
    }
  } catch (err) {
    console.error('Error removing from wishlist in DB:', err);
  }
}

/**
 * Toggle package in database wishlist (CRUD - Create / Delete)
 */
export async function toggleWishlistDb(
  packageId: string,
  currentIds: string[],
  userId?: string | null
): Promise<string[]> {
  const isCurrentlySaved = currentIds.includes(packageId);
  const updatedIds = isCurrentlySaved
    ? currentIds.filter((id) => id !== packageId)
    : [...currentIds, packageId];

  // Optimistically update localStorage
  saveLocalWishlistIds(updatedIds);

  // Perform database CRUD in background
  if (isCurrentlySaved) {
    await removeFromWishlistDb(packageId, userId);
  } else {
    await addToWishlistDb(packageId, userId);
  }

  return updatedIds;
}

/**
 * Sync local guest wishlist items to database upon login
 */
export async function syncLocalWishlistToDb(userId: string): Promise<string[]> {
  try {
    const localIds = getLocalWishlistIds();
    const dbIds = await fetchWishlistFromDb(userId);

    const merged = Array.from(new Set([...localIds, ...dbIds]));

    // Insert any local items that aren't yet in DB
    const missingInDb = localIds.filter((id) => !dbIds.includes(id));
    if (missingInDb.length > 0) {
      const rows = missingInDb.map((package_id) => ({
        user_id: userId,
        package_id,
      }));
      await supabase.from('wishlists').upsert(rows, { onConflict: 'user_id,package_id' });
    }

    saveLocalWishlistIds(merged);
    return merged;
  } catch (err) {
    console.error('Error syncing local wishlist to DB:', err);
    return getLocalWishlistIds();
  }
}
