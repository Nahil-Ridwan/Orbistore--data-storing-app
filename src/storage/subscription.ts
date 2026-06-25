import AsyncStorage from '@react-native-async-storage/async-storage';
import { onSnapshot, query, where } from 'firebase/firestore';
import { readCache, writeCache } from './cacheService';
import { entriesRef, sortEntries } from './helpers';
import { syncPendingMutations } from './offlineMutation';
import { Entry } from './typeEntry';

export const LAST_SYNC_KEY = 'last_sync_ts'; // add this

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

// The main subscription used by the app's UI.
//
// Flow on first call:
//   1. Immediately reads AsyncStorage cache → calls callback (instant, ~0ms)
//   2. Sets up Firestore onSnapshot listener → when it fires (15-20s on cold
//      start), merges cloud data into cache and calls callback again with
//      the freshest data.
//
// On subsequent app opens:
//   Step 1 already has a warm cache (1211 entries) so the UI is instant.
//   Step 2 still fires but only triggers a callback/re-render if Firestore
//   has changes that differ from the cache (e.g. edits made on another device
//   while this one was offline)

export const subscribeToEntries = (callback: (entries: Entry[]) => void) => {
  subscribers.add(callback);

  // Step 1: serve cache immediately
  readCache().then((cached) => {
    if (cached.length > 0) callback(sortEntries(cached));
  });

  // Try to sync any offline changes immediately
  syncPendingMutations().catch((err) =>
    console.error('Initial launch sync failed:', err)
  );

  let unsubscribe = () => {};

  AsyncStorage.getItem(LAST_SYNC_KEY).then(async (lastSyncRaw) => {
    let lastSync: Date;
    if (lastSyncRaw) {
      lastSync = new Date(lastSyncRaw);
    } else {
      // Warm up the sync timestamp based on the latest entry in cache
      const currentCache = await readCache();
      let maxTime = new Date(0);
      for (const entry of currentCache) {
        const tStr = entry.updatedAt || entry.createdAt;
        if (tStr) {
          const t = new Date(tStr);
          if (t > maxTime) {
            maxTime = t;
          }
        }
      }
      lastSync = maxTime.getTime() > 0 ? maxTime : new Date(0);
      await AsyncStorage.setItem(LAST_SYNC_KEY, lastSync.toISOString());
    }

    // Step 2: instead of listening to ALL 1211 docs, only ask Firestore
    // for documents updated SINCE our last sync.
    const entriesQuery = query(
      entriesRef,
      where('updatedAt', '>', lastSync.toISOString())
    );

    unsubscribe = onSnapshot(entriesQuery, async (snap) => {
      if (snap.empty && !snap.metadata.hasPendingWrites) {
        return;
      }

      console.log('SYNCED ENTRIES FROM CLOUD:', snap.docs.length);
      let changed = false;
      let latestUpdate: Date = lastSync;

      // Always read the latest cache from storage to merge against local updates
      const currentCache = await readCache();
      const updatedCache = [...currentCache];

      for (const doc of snap.docs) {
        const entry = doc.data() as Entry & { deleted?: boolean };
        
        if (entry.updatedAt) {
          const entryUpdate = new Date(entry.updatedAt);
          if (entryUpdate > latestUpdate) {
            latestUpdate = entryUpdate;
          }
        }

        const index = updatedCache.findIndex((e) => e.id === entry.id);

        if (entry.deleted) {
          if (index > -1) {
            updatedCache.splice(index, 1);
            changed = true;
          }
        } else {
          if (index > -1) {
            const local = updatedCache[index];
            if (!local.updatedAt || !entry.updatedAt || new Date(entry.updatedAt) > new Date(local.updatedAt)) {
              updatedCache[index] = entry;
              changed = true;
            }
          } else {
            updatedCache.push(entry);
            changed = true;
          }
        }
      }

      if (changed) {
        await writeCache(updatedCache);
        notifySubscribers(updatedCache);
      }

      if (latestUpdate > lastSync) {
        lastSync = latestUpdate;
        await AsyncStorage.setItem(LAST_SYNC_KEY, latestUpdate.toISOString());
      }
    });
  });

  return () => {
    subscribers.delete(callback);
    unsubscribe();
  };
};
