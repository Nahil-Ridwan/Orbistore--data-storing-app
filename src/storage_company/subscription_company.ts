import AsyncStorage from '@react-native-async-storage/async-storage';
import { onSnapshot, query, where } from 'firebase/firestore';
import { AppState, AppStateStatus } from 'react-native';
import { readCache } from '../storage_entry/cacheService';
import { companiesRef, sortCompanies, sortCompaniesWithEntries } from '../utility/helpers';
import { readCompanyCache, writeCompanyCache } from './cacheService_company';
import { syncPendingCompanyMutations } from './offlineMutation_company';
import { Company } from './typeCompany';

export const LAST_SYNC_KEY = 'last_sync_ts_company';

// How far back (in ms) to roll lastSync when rebuilding the listener.
// This ensures we never miss a write from another device due to:
//   - Clock skew between devices
//   - The brief window while the app was transitioning to foreground
//   - Firestore delivery latency on onSnapshot reconnect
const SAFE_OVERLAP_MS = 5 * 1000; // 5 seconds

// ---- Active Subscribers for Local-First Updates ----
export const subscribers_company = new Set<(companies: Company[]) => void>();

// Notify subscribers with pre-sorted companies.
// Callers that already have entries in memory should pass them to avoid a
// redundant disk read.  If omitted, falls back to a full sortCompanies() call.
export const notifyCompanySubscribers = (
  companies: Company[],
  entries?: import('../storage_entry/typeEntry').Entry[]
) => {
  const doNotify = (sorted: Company[]) => {
    subscribers_company.forEach((cb) => {
      try {
        cb(sorted);
      } catch (err) {
        console.error('Error notifying subscriber:', err);
      }
    });
  };

  if (entries !== undefined) {
    // Synchronous path — entries already in memory, no disk read needed.
    doNotify(sortCompaniesWithEntries(companies, entries));
  } else {
    // Async fallback — read entries from disk then sort.
    sortCompanies(companies)
      .then(doNotify)
      .catch((err) => {
        console.error('Error sorting companies:', err);
        doNotify(companies);
      });
  }
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
    companiesRef,
    where('companyupdatedAt', '>', safeFrom.toISOString())
  );

  let sessionLatest: Date = fromDate;

  const unsub = onSnapshot(entriesQuery, async (snap) => {
    if (snap.empty && !snap.metadata.hasPendingWrites) {
      await AsyncStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
      return;
    }

    console.log('SYNCED COMPANIES FROM CLOUD:', snap.docs.length);

    let changed = false;

    // Always read the freshest cache to avoid overwriting concurrent local writes.
    const currentCache = await readCompanyCache();
    const updatedCache = [...currentCache];

    const indexMap = new Map<string, number>();
    for (let i = 0; i < updatedCache.length; i++) {
      indexMap.set(updatedCache[i].companyid, i);
    }

    for (const docSnap of snap.docs) {
      const entry = docSnap.data() as Company & { deleted?: boolean };

      if (entry.companyupdatedAt) {
        const entryTime = new Date(entry.companyupdatedAt);
        if (!isNaN(entryTime.getTime()) && entryTime > sessionLatest) {
          sessionLatest = entryTime;
        }
      }

      const index = indexMap.get(entry.companyid);

      if (entry.deleted) {
        // Soft-deleted on another device — purge from local cache.
        if (index !== undefined && index > -1) {
          updatedCache.splice(index, 1);
          indexMap.clear();
          for (let i = 0; i < updatedCache.length; i++) {
            indexMap.set(updatedCache[i].companyid, i);
          }
          changed = true;
        }
      } else {
        if (index !== undefined && index > -1) {
          // Only overwrite if the cloud version is strictly newer (last-write-wins).
          const local = updatedCache[index];
          const localUpdated = local.companyupdatedAt || '';
          const remoteUpdated = entry.companyupdatedAt || '';
          if (!localUpdated || !remoteUpdated || remoteUpdated > localUpdated) {
            updatedCache[index] = entry;
            changed = true;
          }
        } else {
          // New entry from another device — add to local cache.
          updatedCache.push(entry);
          indexMap.set(entry.companyid, updatedCache.length - 1);
          changed = true;
        }
      }
    }

    if (changed) {
      await writeCompanyCache(updatedCache);
      // Read entries once so notifyCompanySubscribers can sort synchronously
      // instead of hitting the disk again for every company update.
      try {
        const currentEntries = await readCache();
        notifyCompanySubscribers(updatedCache, currentEntries);
      } catch {
        notifyCompanySubscribers(updatedCache);
      }
    }

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
  const currentCache = await readCompanyCache();
  let maxTime = new Date(0);
  for (const entry of currentCache) {
    const tStr = entry.companyupdatedAt || entry.companycreatedAt;
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

export const subscribeToCompanies = (callback: (companies: Company[]) => void) => {
  subscribers_company.add(callback);

  // Step 1: serve cache immediately so the UI renders without a loading state.
  // We read entries in parallel with companies so sorting is synchronous.
  Promise.all([readCompanyCache(), readCache()])
    .then(([cached, entries]) => {
      if (cached.length > 0) {
        callback(sortCompaniesWithEntries(cached, entries));
      }
    })
    .catch(() => {
      readCompanyCache().then((cached) => {
        if (cached.length > 0) callback(cached);
      });
    });

  // Step 2: flush any queued offline mutations now that we (might) be online.
  syncPendingCompanyMutations().catch((err) =>
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
        console.log('App foregrounded — rebuilding Firestore listener for cross-device sync - company');

        // Tear down the stale listener.
        if (_currentUnsubscribe) {
          _currentUnsubscribe();
          _currentUnsubscribe = null;
        }

        // Flush any mutations queued while we were in the background.
        syncPendingCompanyMutations().catch((err) =>
          console.error('Foreground sync failed:', err)
        );

        // Re-resolve lastSync (may have been updated since launch) and rebuild.
        const lastSync = await resolveLastSync();
        _currentUnsubscribe = setupListener(lastSync);
      }
    });
  }

  return () => {
    subscribers_company.delete(callback);

    // If no more subscribers, tear down the Firestore listener entirely to
    // avoid unnecessary reads (e.g. when navigating away in tests or storybook).
    if (subscribers_company.size === 0 && _currentUnsubscribe) {
      _currentUnsubscribe();
      _currentUnsubscribe = null;
    }
  };
};
// Module-level flag — ensures we only ever register ONE AppState listener
// no matter how many times subscribeToEntries is called.
let _appStateListenerRegistered = false;
