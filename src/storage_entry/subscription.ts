import AsyncStorage from '@react-native-async-storage/async-storage';
import { onSnapshot, query, where } from 'firebase/firestore';
import { AppState, AppStateStatus } from 'react-native';
import { readCompanyCache, writeCompanyCache } from '../storage_company/cacheService_company';
import { notifyCompanySubscribers } from '../storage_company/subscription_company';
import { entriesRef, sortEntries } from '../utility/helpers';
import { readCache, writeCache } from './cacheService';
import { syncPendingMutations } from './offlineMutation';
import { Entry } from './typeEntry';

export const LAST_SYNC_KEY = 'last_sync_ts';

const computeCompanyCounts = (entries: Entry[]) => {
  const counts: Record<string, { stock: number; unpaid: number }> = {};

  entries.forEach((entry) => {
    const companyKey = String(entry.company ?? '').toLowerCase().trim();
    if (!companyKey) return;

    if (!counts[companyKey]) {
      counts[companyKey] = { stock: 0, unpaid: 0 };
    }

    const status = String(entry.status ?? '').toLowerCase().trim();
    const payment = String(entry.payment ?? '').toLowerCase().trim();

    if (status === 'available') {
      counts[companyKey].stock += 1;
      return;
    }

    if (status === 'active' && payment !== 'received') {
      counts[companyKey].unpaid += 1;
    }
  });

  return counts;
};

export const syncCompanyCounts = async (entries: Entry[]) => {
  try {
    const companies = await readCompanyCache();
    if (companies.length === 0) return;

    const counts = computeCompanyCounts(entries);
    let changed = false;
    const updatedCompanies = companies.map((company) => {
      const key = String(company.name ?? '').toLowerCase().trim();
      const count = counts[key] ?? { stock: 0,  unpaid: 0 };
      const newPayment: 'RECEIVED' | 'NOT PAID' = count.unpaid > 0 ? 'NOT PAID' : 'RECEIVED';
      if (company.stock !== count.stock || company.unpaid !== count.unpaid || company.payment !== newPayment) {
        changed = true;
        return { ...company, stock: count.stock, unpaid: count.unpaid, payment: newPayment };
      }
      return company;
    });

    if (changed) {
      await writeCompanyCache(updatedCompanies);
      notifyCompanySubscribers(updatedCompanies, entries);
    }
  } catch (err) {
    console.error('Failed to sync company counts from entries:', err);
  }
};

// How far back (in ms) to roll lastSync when rebuilding the listener.
// This provides a safety margin for clock skew / Firestore reconnect latency
// without re-downloading historic database snapshots on every startup.
const SAFE_OVERLAP_MS = 5 * 1000; // 5 seconds

// ---- Active Subscribers for Local-First Updates ----
export const subscribers = new Set<(entries: Entry[]) => void>();

export const notifySubscribers = (entries: Entry[]) => {
  const sorted = sortEntries(entries);
  subscribers.forEach((cb) => {
    try {
      cb(sorted);
    } catch (err) {
      console.error('Error notifying subscriber:', err);
    }
  });
};

// ---- Internal listener state ----
// Holds the unsubscribe function for the currently-active onSnapshot listener.
// We keep this at module scope so the AppState handler can tear it down and
// rebuild it whenever the app comes back to the foreground.
let _currentUnsubscribe: (() => void) | null = null;

// ---- Core listener builder ----
// Sets up (or re-sets-up) an onSnapshot listener that fetches every Firestore
// doc updated since `fromDate`, merges results into the local cache, and
// notifies subscribers.  Returns an unsubscribe function.
const setupListener = (fromDate: Date): (() => void) => {
  const safeFrom = new Date(fromDate.getTime() - SAFE_OVERLAP_MS);

  const entriesQuery = query(
    entriesRef,
    where('updatedAt', '>', safeFrom.toISOString())
  );

  let sessionLatest: Date = fromDate;

  const unsub = onSnapshot(entriesQuery, async (snap) => {
    if (snap.empty && !snap.metadata.hasPendingWrites) {
      // Even if empty, ensure LAST_SYNC_KEY is up to date so we don't re-check old ranges
      await AsyncStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
      return;
    }

    console.log('SYNCED ENTRIES FROM CLOUD:', snap.docs.length);

    let changed = false;

    // Always read the freshest cache to avoid overwriting concurrent local writes.
    const currentCache = await readCache();
    const updatedCache = [...currentCache];

    // Build O(1) index map to eliminate O(N^2) findIndex overhead
    const indexMap = new Map<string, number>();
    for (let i = 0; i < updatedCache.length; i++) {
      indexMap.set(updatedCache[i].id, i);
    }

    for (const docSnap of snap.docs) {
      const entry = docSnap.data() as Entry & { deleted?: boolean };

      // Track highest updatedAt seen
      if (entry.updatedAt) {
        const entryTime = new Date(entry.updatedAt);
        if (!isNaN(entryTime.getTime()) && entryTime > sessionLatest) {
          sessionLatest = entryTime;
        }
      }

      const index = indexMap.get(entry.id);

      if (entry.deleted) {
        // Soft-deleted on another device — purge from local cache.
        if (index !== undefined && index > -1) {
          updatedCache.splice(index, 1);
          // Re-index map after splice
          indexMap.clear();
          for (let i = 0; i < updatedCache.length; i++) {
            indexMap.set(updatedCache[i].id, i);
          }
          changed = true;
        }
      } else {
        if (index !== undefined && index > -1) {
          // Only overwrite if the cloud version is strictly newer (last-write-wins).
          const local = updatedCache[index];
          const localUpdated = local.updatedAt || '';
          const remoteUpdated = entry.updatedAt || '';
          if (!localUpdated || !remoteUpdated || remoteUpdated > localUpdated) {
            updatedCache[index] = entry;
            changed = true;
          }
        } else {
          // New entry from another device — add to local cache.
          updatedCache.push(entry);
          indexMap.set(entry.id, updatedCache.length - 1);
          changed = true;
        }
      }
    }

    if (changed) {
      await writeCache(updatedCache);
      notifySubscribers(updatedCache);
      try {
        const companies = await readCompanyCache();
        notifyCompanySubscribers(companies, updatedCache);
      } catch (err) {
        console.error('Failed to refresh company subscribers after entries sync:', err);
      }
    }

    // Always update lastSync timestamp to prevent re-querying the same batch on next app start
    const syncToSave = sessionLatest > fromDate ? sessionLatest : new Date();
    await AsyncStorage.setItem(LAST_SYNC_KEY, syncToSave.toISOString());
  });

  return unsub;
};

// ---- Resolve the initial lastSync from AsyncStorage / cache ----
// Returns the Date we should pass to the first setupListener call.
const resolveLastSync = async (): Promise<Date> => {
  const lastSyncRaw = await AsyncStorage.getItem(LAST_SYNC_KEY);

  if (lastSyncRaw) {
    return new Date(lastSyncRaw);
  }

  // No saved timestamp yet — warm up from the newest entry in the local cache
  // so we don't redundantly download everything on first launch.
  const currentCache = await readCache();
  let maxTime = new Date(0);
  for (const entry of currentCache) {
    const tStr = entry.updatedAt || entry.createdAt;
    if (tStr) {
      const t = new Date(tStr);
      if (t > maxTime) maxTime = t;
    }
  }

  const resolved = maxTime.getTime() > 0 ? maxTime : new Date(0);
  await AsyncStorage.setItem(LAST_SYNC_KEY, resolved.toISOString());
  return resolved;
};

// ---- Main subscription ----
//
// Flow on first call:
//   1. Immediately reads AsyncStorage cache → calls callback (instant, ~0ms)
//   2. Syncs any pending offline mutations (fire-and-forget)
//   3. Resolves lastSync, then calls setupListener(lastSync) to open the
//      Firestore onSnapshot listener.
//
// On app foreground (AppState active):
//   - Tears down the current listener.
//   - Re-reads lastSync from AsyncStorage (may have been updated by another
//     setupListener call on a different subscriber's lifecycle).
//   - Calls setupListener again with the safe-rolled-back timestamp.
//   - This catches ALL changes made by other devices while this device was
//     backgrounded, including deletions.
//
// On unsubscribe (component unmount):
//   - Removes this callback from the subscriber set.
//   - The AppState listener is left alive (module-level singleton) because
//     other subscribers may still be active.  The actual Firestore listener
//     is torn down only when ALL subscribers are gone.

export const subscribeToEntries = (callback: (entries: Entry[]) => void) => {
  subscribers.add(callback);

  // Step 1: serve cache immediately so the UI renders without a loading state.
  readCache().then((cached) => {
    if (cached.length > 0) callback(sortEntries(cached));
  });

  // Step 2: flush any queued offline mutations now that we (might) be online.
  syncPendingMutations().catch((err) =>
    console.error('Initial launch sync failed:', err)
  );

  // Step 3: open the Firestore listener (only once per process — subsequent
  // subscribeToEntries calls reuse the existing listener via the shared
  // subscriber set).
  if (!_currentUnsubscribe) {
    resolveLastSync().then((lastSync) => {
      _currentUnsubscribe = setupListener(lastSync);
    });
  }

  // ---- AppState handler (module-level singleton guard) ----
  // We only register one AppState listener regardless of how many
  // subscribeToEntries callers there are.
  if (!_appStateListenerRegistered) {
    _appStateListenerRegistered = true;

    AppState.addEventListener('change', async (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        console.log('App foregrounded — rebuilding Firestore listener for cross-device sync - entry');

        // Tear down the stale listener.
        if (_currentUnsubscribe) {
          _currentUnsubscribe();
          _currentUnsubscribe = null;
        }

        // Flush any mutations queued while we were in the background.
        syncPendingMutations().catch((err) =>
          console.error('Foreground sync failed:', err)
        );

        // Re-resolve lastSync (may have been updated since launch) and rebuild.
        const lastSync = await resolveLastSync();
        _currentUnsubscribe = setupListener(lastSync);
      }
    });
  }

  return () => {
    subscribers.delete(callback);

    // If no more subscribers, tear down the Firestore listener entirely to
    // avoid unnecessary reads (e.g. when navigating away in tests or storybook).
    if (subscribers.size === 0 && _currentUnsubscribe) {
      _currentUnsubscribe();
      _currentUnsubscribe = null;
    }
  };
};

// Module-level flag — ensures we only ever register ONE AppState listener
// no matter how many times subscribeToEntries is called.
let _appStateListenerRegistered = false;
