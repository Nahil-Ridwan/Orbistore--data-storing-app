import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { doc, setDoc } from 'firebase/firestore';
import { entriesRef } from './helpers';
import { Entry } from './typeEntry';

export const PENDING_MUTATIONS_KEY = 'pending_mutations';


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

export const addPendingMutation = async (id: string, type: 'UPSERT' | 'DELETE', entry?: Entry): Promise<void> => {
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

export const addPendingMutations = async (
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

export const removePendingMutations = async (ids: string[]): Promise<void> => {
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