import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  writeBatch,
  query,
  where
} from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { db } from './firebaseConfig';

export type Entry = {
  id: string;
  company?: string;
  device?: number;
  username?: string;
  mobile?: number;
  vehicle?: string;
  type?: string;
  lock?: string;
  devicemodel?: string;
  installdate: string;
  expdate?: string;
  validity?: number;
  status?: string;
  payment?: string;
  sim: number;
  imei: number;
  note?: string;
  renewal1?: string;
  renewal2?: string;
  renewal3?: string;
  renewal4?: string;
  renewal5?: string;
  createdAt: string;
  updatedAt?: string; // for cloud
};

// ---- Firestore collection reference ----
const entriesRef = collection(db, 'entries');

// ---- AsyncStorage key ----
const CACHE_KEY = 'entries_cache';
const LAST_SYNC_KEY = 'last_sync_ts'; // add this
const PENDING_MUTATIONS_KEY = 'pending_mutations';

// ---- Shared date helpers ----
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const monthMap: Record<string, number> = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
};

const formatDateOutput = (date: Date): string => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = MONTHS[date.getMonth()];
  const year = String(date.getFullYear()).slice(-2);
  return `${day}-${month}-${year}`;
};

const parseAppDate = (dateStr?: string): Date | undefined => {
  if (!dateStr) return undefined;
  const parts = dateStr.trim().split('-');
  if (parts.length !== 3) return undefined;
  const [day, month, year] = parts;
  const monthIndex = monthMap[month.toUpperCase()];
  if (monthIndex === undefined) return undefined;
  return new Date(2000 + Number(year), monthIndex, Number(day));
};

const isExpired = (dateStr?: string): boolean => {
  const date = parseAppDate(dateStr);
  if (!date) return false;
  return date < new Date();
};

const formatDate = (val?: any): string | undefined => {
  if (!val) return undefined;

  if (typeof val === 'number') {
    const date = XLSX.SSF.parse_date_code(val);
    if (date) {
      const d = new Date(date.y, date.m - 1, date.d);
      return formatDateOutput(d);
    }
  }

  const str = String(val).trim();

  const slashParts = str.split('/');
  if (slashParts.length === 3) {
    const [a, b, c] = slashParts;
    const date = new Date(`${c}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`);
    if (!isNaN(date.getTime())) return formatDateOutput(date);
    const date2 = new Date(`${c}-${a.padStart(2, '0')}-${b.padStart(2, '0')}`);
    if (!isNaN(date2.getTime())) return formatDateOutput(date2);
  }

  const parts = str.split(/[\s-]+/);
  if (parts.length === 3) {
    const [day, month, year] = parts;
    const monthIndex = isNaN(Number(month)) ? monthMap[month.toUpperCase()] : Number(month) - 1;
    if (monthIndex === undefined || isNaN(monthIndex)) return str;
    const date = new Date(2000 + Number(year), monthIndex, Number(day));
    if (!isNaN(date.getTime())) return formatDateOutput(date);
  }

  return str;
};

const getNextExpiry = (dateStr?: string) => {
  if (!dateStr) return undefined;
  const parts = dateStr.trim().split('-');
  if (parts.length === 3) {
    const [day, month, year] = parts;
    const monthIndex = monthMap[month.toUpperCase()];
    if (monthIndex === undefined) return undefined;
    const date = new Date(2000 + Number(year), monthIndex, Number(day));
    if (!isNaN(date.getTime())) {
      date.setFullYear(date.getFullYear() + 1);
      return formatDateOutput(date);
    }
  }
  return undefined;
};

export const getValidityDays = (expdate?: string): number | undefined => {
  const expDate = parseAppDate(expdate);
  if (!expDate) return undefined;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expDate.setHours(0, 0, 0, 0);
  const diffMs = expDate.getTime() - today.getTime();
  return Math.round(diffMs / 86400000);
};

// ---- Sort helper (shared by both local and cloud paths) ----
const sortEntries = (entries: Entry[]): Entry[] =>
  entries
    .map((e) => ({ ...e, validity: getValidityDays(e.expdate) }))
    .sort((a, b) => (b.validity ?? -Infinity) - (a.validity ?? -Infinity));

// ---- AsyncStorage cache helpers ----
// These are the source of truth for instant local reads.
// Firestore is the source of truth for cross-device sync.

const readCache = async (): Promise<Entry[]> => {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const writeCache = async (entries: Entry[]): Promise<void> => {
  try {
    // Strip computed `validity` before caching — it's always re-derived on
    // read so stale values don't persist in storage across days.
    const stripped = entries.map(({ validity, ...rest }) => rest);
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(stripped));
  } catch (err) {
    console.error('Failed to write AsyncStorage cache:', err);
  }
};

const updateCacheEntry = async (updated: Entry): Promise<void> => {
  const cached = await readCache();
  const exists = cached.some((e) => e.id === updated.id);
  const next = exists
    ? cached.map((e) => (e.id === updated.id ? updated : e))
    : [updated, ...cached];
  await writeCache(next);
};

const removeCacheEntry = async (id: string): Promise<void> => {
  const cached = await readCache();
  await writeCache(cached.filter((e) => e.id !== id));
};

// ---- Active Subscribers for Local-First Updates ----
const subscribers = new Set<(entries: Entry[]) => void>();

const notifySubscribers = (entries: Entry[]) => {
  const sorted = sortEntries(entries);
  subscribers.forEach((cb) => {
    try {
      cb(sorted);
    } catch (err) {
      console.error('Error notifying subscriber:', err);
    }
  });
};

// ---- Offline Mutation Queue (Outbox Pattern) ----
type PendingMutation = {
  id: string;
  type: 'UPSERT' | 'DELETE';
  entry?: Entry;
  timestamp: number;
};

const getPendingMutations = async (): Promise<PendingMutation[]> => {
  try {
    const raw = await AsyncStorage.getItem(PENDING_MUTATIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const savePendingMutations = async (mutations: PendingMutation[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(PENDING_MUTATIONS_KEY, JSON.stringify(mutations));
  } catch (err) {
    console.error('Failed to save pending mutations:', err);
  }
};

const addPendingMutation = async (id: string, type: 'UPSERT' | 'DELETE', entry?: Entry): Promise<void> => {
  const mutations = await getPendingMutations();
  const filtered = mutations.filter((m) => m.id !== id);
  filtered.push({
    id,
    type,
    entry,
    timestamp: Date.now(),
  });
  await savePendingMutations(filtered);
};

const removePendingMutation = async (id: string): Promise<void> => {
  const mutations = await getPendingMutations();
  const filtered = mutations.filter((m) => m.id !== id);
  await savePendingMutations(filtered);
};

const addPendingMutations = async (
  newMutations: { id: string; type: 'UPSERT' | 'DELETE'; entry?: Entry }[],
): Promise<void> => {
  const mutations = await getPendingMutations();
  const idsToFilter = new Set(newMutations.map((m) => m.id));
  const filtered = mutations.filter((m) => !idsToFilter.has(m.id));
  
  const timestamp = Date.now();
  newMutations.forEach((m) => {
    filtered.push({
      ...m,
      timestamp,
    });
  });
  await savePendingMutations(filtered);
};

const removePendingMutations = async (ids: string[]): Promise<void> => {
  const mutations = await getPendingMutations();
  const idsToRemove = new Set(ids);
  const filtered = mutations.filter((m) => !idsToRemove.has(m.id));
  await savePendingMutations(filtered);
};

let isSyncingMutations = false;

export const syncPendingMutations = async (): Promise<void> => {
  if (isSyncingMutations) return;
  isSyncingMutations = true;

  try {
    const mutations = await getPendingMutations();
    if (mutations.length === 0) {
      isSyncingMutations = false;
      return;
    }

    console.log(`Processing ${mutations.length} pending offline mutations...`);

    for (const mutation of mutations) {
      try {
        if (mutation.type === 'UPSERT') {
          if (mutation.entry) {
            await setDoc(doc(entriesRef, mutation.id), mutation.entry);
          }
        } else if (mutation.type === 'DELETE') {
          await setDoc(doc(entriesRef, mutation.id), { id: mutation.id, deleted: true, updatedAt: new Date().toISOString() });
        }
        await removePendingMutation(mutation.id);
        console.log(`Successfully synced mutation for ${mutation.id}`);
      } catch (err) {
        console.error(`Failed to sync mutation for ${mutation.id}:`, err);
        break; // Stop loop if offline or error occurs
      }
    }
  } finally {
    isSyncingMutations = false;
  }
};

// Listen to network connectivity shifts to auto-sync pending updates when we go online
NetInfo.addEventListener((state) => {
  if (state.isConnected) {
    syncPendingMutations().catch((err) =>
      console.error('NetInfo triggered sync failed:', err)
    );
  }
});

// ---- Core CRUD ----

// One-time read — used by export and syncStatuses.
// Reads from cache for speed; Firestore is always kept in sync via the
// subscribeToEntries listener so the cache stays current.
export const getEntries = async (): Promise<Entry[]> => {
  const cached = await readCache();
  return sortEntries(cached);
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

// ---- Status sync ----
export const syncStatuses = async (): Promise<{ updated: number }> => {
  const entries = await getEntries();

  const stale = entries.filter((e) => {
    if (!e.expdate) return false;
    const current = e.status?.toLowerCase().trim() ?? '';
    const expired = isExpired(e.expdate);
    if (expired && (current === 'active' || current === '')) return true;
    if (!expired && (current === 'expired' || current === '')) return true;
    return false;
  });

  if (stale.length === 0) return { updated: 0 };

  // Update cache first.
  const cached = await readCache();
  const updatedCache = cached.map((e) => {
    if (!stale.some((s) => s.id === e.id)) return e;
    return { ...e, status: isExpired(e.expdate) ? 'EXPIRED' : 'ACTIVE' };
  });
  await writeCache(updatedCache);

  // Batch-update Firestore.
  const BATCH_SIZE = 450;
  for (let i = 0; i < stale.length; i += BATCH_SIZE) {
    const chunk = stale.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    chunk.forEach((e) => {
      const newStatus = isExpired(e.expdate) ? 'EXPIRED' : 'ACTIVE';
      batch.set(doc(entriesRef, e.id), { status: newStatus }, { merge: true });
    });
    await batch.commit();
  }

  return { updated: stale.length };
};

// ---- Export to Excel ----
export const exportEntries = async (): Promise<void> => {
  const entries = await getEntries();
  const dateFields: (keyof Entry)[] = [
    'installdate', 'expdate', 'renewal1', 'renewal2', 'renewal3', 'renewal4', 'renewal5',
  ];

  const toExcelSerial = (date: Date): number =>
    Math.round((date.getTime() - new Date(Date.UTC(1899, 11, 30)).getTime()) / 86400000);

  const safeEntries = entries.map((e) => {
    const row: any = { ...e, sim: String(e.sim), imei: String(e.imei), validity: getValidityDays(e.expdate) };
    dateFields.forEach((field) => {
      const date = parseAppDate(e[field] as string);
      if (date) row[field] = toExcelSerial(date);
    });
    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(safeEntries);

  const headers = Object.keys(safeEntries[0] || {});
  dateFields.forEach((field) => {
    const colIndex = headers.indexOf(field as string);
    if (colIndex === -1) return;
    safeEntries.forEach((_, rowIndex) => {
      const cellRef = XLSX.utils.encode_cell({ r: rowIndex + 1, c: colIndex });
      if (worksheet[cellRef] && typeof worksheet[cellRef].v === 'number') {
        worksheet[cellRef].t = 'n';
        worksheet[cellRef].z = 'DD-MMM-YY';
      }
    });
  });

  const simCol = headers.indexOf('sim');
  const imeiCol = headers.indexOf('imei');
  safeEntries.forEach((_, rowIndex) => {
    [simCol, imeiCol].forEach((colIndex) => {
      if (colIndex === -1) return;
      const cellRef = XLSX.utils.encode_cell({ r: rowIndex + 1, c: colIndex });
      if (worksheet[cellRef]) worksheet[cellRef].t = 's';
    });
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Entries');
  const base64 = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });

  const fileUri = FileSystem.documentDirectory + 'orbitracker_backup.xlsx';
  await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
  await Sharing.shareAsync(fileUri);
};

// ---- Import from Excel ----
export const pickAndImportEntries = async (): Promise<void> => {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  if (result.canceled) return;

  const base64 = await FileSystem.readAsStringAsync(result.assets[0].uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const workbook = XLSX.read(base64, { type: 'base64', cellText: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json<any>(sheet, { raw: true });

  const parsed: Entry[] = data.map((row) => {
    const formattedInstalldate = formatDate(row.installdate) ?? row.installdate ?? '';

    const renewal1 = formatDate(row.renewal1);
    const renewal2 = formatDate(row.renewal2);
    const renewal3 = formatDate(row.renewal3);
    const renewal4 = formatDate(row.renewal4);
    const renewal5 = formatDate(row.renewal5);

    const latestRenewal = renewal5 || renewal4 || renewal3 || renewal2 || renewal1;

    const newExpdate = latestRenewal
      ? getNextExpiry(latestRenewal)
      : (() => {
          if (!formattedInstalldate) return formatDate(row.expdate) ?? row.expdate;
          const parts = formattedInstalldate.split('-');
          if (parts.length !== 3) return formatDate(row.expdate) ?? row.expdate;
          const [dStr, mStr, yStr] = parts;
          const monthIndex = monthMap[mStr];
          if (monthIndex === undefined) return formatDate(row.expdate) ?? row.expdate;
          const date = new Date(2000 + Number(yStr), monthIndex, Number(dStr));
          date.setFullYear(date.getFullYear() + 1);
          return formatDateOutput(date);
        })();

    const expdate = newExpdate ?? formatDate(row.expdate) ?? row.expdate;
    const existingStatus = row.status?.toLowerCase().trim();
    const status =
      existingStatus === 'discontinued' || existingStatus === 'discontd'
        ? 'DISCONTD'
        : !existingStatus
          ? isExpired(expdate) ? 'EXPIRED' : 'ACTIVE'
          : row.status;

    return {
      ...row,
      id: row.id ? String(row.id) : Date.now().toString() + Math.random().toString(36).slice(2),
      device: Number(row.device) || 0,
      mobile: Number(row.mobile) || 0,
      sim: Number(row.sim),
      imei: Number(row.imei),
      installdate: formattedInstalldate,
      expdate,
      status,
      renewal1,
      renewal2,
      renewal3,
      renewal4,
      renewal5,
      createdAt: row.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });

  // Write to AsyncStorage cache immediately so the UI reflects the import
  // right away without waiting for Firestore.
  const existingCache = await readCache();
  const merged = [
    ...existingCache.filter((e) => !parsed.some((p) => p.id === e.id)),
    ...parsed,
  ];
  await writeCache(merged);
  notifySubscribers(merged);

  // Add all imported entries to the pending mutations queue
  const mutationsToQueue = parsed.map((entry) => ({
    id: entry.id,
    type: 'UPSERT' as const,
    entry,
  }));
  await addPendingMutations(mutationsToQueue);

  // Batch-write to Firestore in the background.
  const BATCH_SIZE = 450;
  let written = 0;
  const failedBatches: number[] = [];

  for (let i = 0; i < parsed.length; i += BATCH_SIZE) {
    const chunk = parsed.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    chunk.forEach((entry) => {
      batch.set(doc(entriesRef, entry.id), entry);
    });

    try {
      await batch.commit();
      written += chunk.length;
      // Successfully committed this batch, remove these from the pending mutations queue
      const idsToRemove = chunk.map((e) => e.id);
      await removePendingMutations(idsToRemove);
    } catch (err) {
      console.error(`Failed to import batch starting at row ${i}:`, err);
      failedBatches.push(i);
    }
  }

  // Trigger background sync to attempt uploading any failed batches
  syncPendingMutations().catch((err) =>
    console.error('Firestore import background sync failed:', err),
  );

  if (failedBatches.length > 0) {
    throw new Error(
      `Imported ${written}/${parsed.length} entries. ${failedBatches.length} batch(es) failed — check your connection and try importing again.`,
    );
  }
};