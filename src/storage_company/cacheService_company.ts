import AsyncStorage from '@react-native-async-storage/async-storage';
import { Company } from './typeCompany';


export const CACHE_KEY = 'companies_cache';

// ---- AsyncStorage cache helpers ----
// These are the source of truth for instant local reads.
// Firestore is the source of truth for cross-device sync.

export const readCompanyCache = async (): Promise<Company[]> => {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const writeCompanyCache = async (companies: Company[]): Promise<void> => {
  try {
    // Strip computed `validity` before caching — it's always re-derived on
    // read so stale values don't persist in storage across days.
    //const stripped = entries.map(({ validity, deviceage, ...rest }) => rest);
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(companies));
  } catch (err) {
    console.error('Failed to write AsyncStorage cache:', err);
  }
};

export const updateCacheCompany = async (updated: Company): Promise<void> => {
  const cached = await readCompanyCache();
  const exists = cached.some((e) => e.companyid === updated.companyid);
  const next = exists
    ? cached.map((e) => (e.companyid === updated.companyid ? updated : e))
    : [updated, ...cached];
  await writeCompanyCache(next);
};

export const removeCacheCompany = async (id: string): Promise<void> => {
  const cached = await readCompanyCache();
  await writeCompanyCache(cached.filter((e) => e.companyid !== id));
};
