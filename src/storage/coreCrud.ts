import AsyncStorage from '@react-native-async-storage/async-storage';
import { writeBatch } from 'firebase/firestore';
import {
  CACHE_KEY,
  readCache,
  removeCacheEntry,
  updateCacheEntry
} from './cacheService';
import { db } from './firebaseConfig';
import {
  entriesRef,
  formatDate,
  formatDateOutput,
  getNextExpiry,
  isExpired,
  monthMap
} from './helpers';
import { addPendingMutation, PENDING_MUTATIONS_KEY, syncPendingMutations } from './offlineMutation';
import { LAST_SYNC_KEY, notifySubscribers } from './subscription';
import { Entry } from './typeEntry';



// ---- Core CRUD ----

// Reads from cache for speed; Firestore is always kept in sync via the
// subscribeToEntries listener so the cache stays current.

export const addEntry = async (
  entry: Omit<Entry, 'id' | 'createdAt'>,
): Promise<Entry> => {
  let status = entry.status;
  if (entry.expdate && (!status || status.trim() === '')) {
    status = isExpired(entry.expdate) ? 'EXPIRED' : 'ACTIVE';
  }

  const id = Date.now().toString();
  const newEntry: Entry = {
    ...entry,
    status,
    id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(), // for cloud
  };

  // Write to cache immediately so the UI updates before network confirms.
  await updateCacheEntry(newEntry);
  const cached = await readCache();
  notifySubscribers(cached);

  // Add to pending mutations queue
  await addPendingMutation(id, 'UPSERT', newEntry);

  // Trigger sync in background
  syncPendingMutations().catch((err) =>
    console.error('Firestore addEntry sync failed:', err),
  );

  return newEntry;
};

export const updateEntry = async (updated: Entry): Promise<void> => {
  const formattedInstalldate = formatDate(updated.installdate) ?? updated.installdate;

  const latestRenewal =
    updated.renewal5 || updated.renewal4 || updated.renewal3 ||
    updated.renewal2 || updated.renewal1;

  const newExpdate = latestRenewal
    ? getNextExpiry(latestRenewal)
    : formattedInstalldate
      ? (() => {
          const [dStr, mStr, yStr] = formattedInstalldate.split('-');
          const date = new Date(2000 + Number(yStr), monthMap[mStr], Number(dStr));
          date.setFullYear(date.getFullYear() + 1);
          return formatDateOutput(date);
        })()
      : undefined;

  const formattedStatus =
    updated.status?.toLowerCase().trim() === 'discontinued' ? 'DISCONTD' : updated.status;

  const resolvedStatus = (() => {
    if (formattedStatus?.toLowerCase().trim() === 'discontd') return 'DISCONTD';
    if (newExpdate && updated.installdate !== '') {
      if (!formattedStatus || formattedStatus.trim() === '') {
        return isExpired(newExpdate) ? 'EXPIRED' : 'ACTIVE';
      }
    }
    return formattedStatus;
  })();

  const finalEntry: Entry = {
    ...updated,
    installdate: formattedInstalldate,
    expdate: newExpdate ?? updated.expdate ?? '',
    status: resolvedStatus,
    updatedAt: new Date().toISOString(), // for cloud
  };

  // Update cache immediately.
  await updateCacheEntry(finalEntry);
  const cached = await readCache();
  notifySubscribers(cached);

  // Add to pending mutations queue
  await addPendingMutation(finalEntry.id, 'UPSERT', finalEntry);

  // Trigger sync in background
  syncPendingMutations().catch((err) =>
    console.error('Firestore updateEntry sync failed:', err),
  );
};

export const deleteEntry = async (id: string): Promise<void> => {
  // Remove from cache immediately.
  await removeCacheEntry(id);
  const cached = await readCache();
  notifySubscribers(cached);

  // Add to pending mutations queue
  await addPendingMutation(id, 'DELETE');

  // Trigger sync in background
  syncPendingMutations().catch((err) =>
    console.error('Firestore deleteEntry sync failed:', err),
  );
};

export const clearAllEntries = async (): Promise<void> => {
  // Clear local cache, sync timestamp, and pending mutations immediately.
  await AsyncStorage.removeItem(CACHE_KEY);
  await AsyncStorage.removeItem(LAST_SYNC_KEY);
  await AsyncStorage.removeItem(PENDING_MUTATIONS_KEY);
  notifySubscribers([]);

  // Batch-delete from Firestore.
  const { getDocs: _getDocs } = await import('firebase/firestore');
  const snap = await _getDocs(entriesRef);
  const BATCH_SIZE = 450;
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const chunk = docs.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    chunk.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
};

