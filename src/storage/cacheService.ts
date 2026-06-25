import AsyncStorage from '@react-native-async-storage/async-storage';
import { Entry } from './typeEntry';


export const CACHE_KEY = 'entries_cache';

// ---- AsyncStorage cache helpers ----
// These are the source of truth for instant local reads.
// Firestore is the source of truth for cross-device sync.

export const readCache = async (): Promise<Entry[]> => {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const writeCache = async (entries: Entry[]): Promise<void> => {
  try {
    // Strip computed `validity` before caching — it's always re-derived on
    // read so stale values don't persist in storage across days.
    const stripped = entries.map(({ validity, ...rest }) => rest);
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(stripped));
  } catch (err) {
    console.error('Failed to write AsyncStorage cache:', err);
  }
};

export const updateCacheEntry = async (updated: Entry): Promise<void> => {
  const cached = await readCache();
  const exists = cached.some((e) => e.id === updated.id);
  const next = exists
    ? cached.map((e) => (e.id === updated.id ? updated : e))
    : [updated, ...cached];
  await writeCache(next);
};

export const removeCacheEntry = async (id: string): Promise<void> => {
  const cached = await readCache();
  await writeCache(cached.filter((e) => e.id !== id));
};
