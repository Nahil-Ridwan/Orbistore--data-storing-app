import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { doc, setDoc } from 'firebase/firestore';
import { companiesRef } from '../utility/helpers';
import { Company } from './typeCompany';

export const PENDING_MUTATIONS_KEY = 'pending_mutations_company';


// ---- Offline Mutation Queue (Outbox Pattern) ----
type PendingMutation = {
  id: string;
  type: 'UPSERT' | 'DELETE';
  entry?: Company;
  timestamp: number;
};

const getPendingCompanyMutations = async (): Promise<PendingMutation[]> => {
  try {
    const raw = await AsyncStorage.getItem(PENDING_MUTATIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const savePendingCompanyMutations = async (mutations: PendingMutation[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(PENDING_MUTATIONS_KEY, JSON.stringify(mutations));
  } catch (err) {
    console.error('Failed to save pending mutations:', err);
  }
};

export const addPendingCompanyMutation = async (id: string, type: 'UPSERT' | 'DELETE', entry?: Company): Promise<void> => {
  const mutations = await getPendingCompanyMutations();
  const filtered = mutations.filter((m) => m.id !== id);
  filtered.push({
    id,
    type,
    entry,
    timestamp: Date.now(),
  });
  await savePendingCompanyMutations(filtered);
};

export const removePendingCompanyMutation = async (id: string): Promise<void> => {
  const mutations = await getPendingCompanyMutations();
  const filtered = mutations.filter((m) => m.id !== id);
  await savePendingCompanyMutations(filtered);
};

export const addPendingCompanyMutations = async (
  newMutations: { id: string; type: 'UPSERT' | 'DELETE'; entry?: Company }[],
): Promise<void> => {
  const mutations = await getPendingCompanyMutations();
  const idsToFilter = new Set(newMutations.map((m) => m.id));
  const filtered = mutations.filter((m) => !idsToFilter.has(m.id));
  
  const timestamp = Date.now();
  newMutations.forEach((m) => {
    filtered.push({
      ...m,
      timestamp,
    });
  });
  await savePendingCompanyMutations(filtered);
};

export const removePendingCompanyMutations = async (ids: string[]): Promise<void> => {
  const mutations = await getPendingCompanyMutations();
  const idsToRemove = new Set(ids);
  const filtered = mutations.filter((m) => !idsToRemove.has(m.id));
  await savePendingCompanyMutations(filtered);
};

let isSyncingMutations = false;

export const syncPendingCompanyMutations = async (): Promise<void> => {
  if (isSyncingMutations) return;
  isSyncingMutations = true;

  try {
    const mutations = await getPendingCompanyMutations();
    if (mutations.length === 0) {
      isSyncingMutations = false;
      return;
    }

    console.log(`Processing ${mutations.length} pending offline mutations...`);

    for (const mutation of mutations) {
      try {
        const now = new Date().toISOString();
        if (mutation.type === 'UPSERT') {
          if (mutation.entry) {
            const companyToSync: Company = {
              ...mutation.entry,
              companyupdatedAt: now,
            };
            await setDoc(doc(companiesRef, mutation.id), companyToSync);
          }
        } else if (mutation.type === 'DELETE') {
          await setDoc(doc(companiesRef, mutation.id), { companyid: mutation.id, deleted: true, companyupdatedAt: now });
        }
        await removePendingCompanyMutation(mutation.id);
        console.log(`Successfully synced mutation for ${mutation.id}`);
      } catch (err) {
        console.error(`Failed to sync mutation for ${mutation.id}:`, err);
        break; // Stop loop if offline or network error occurs
      }
    }
  } finally {
    isSyncingMutations = false;
  }
};

// Listen to network connectivity shifts to auto-sync pending updates when we go online
NetInfo.addEventListener((state) => {
  if (state.isConnected && state.isInternetReachable !== false) {
    syncPendingCompanyMutations().catch((err) =>
      console.error('NetInfo triggered sync failed:', err)
    );
  }
});