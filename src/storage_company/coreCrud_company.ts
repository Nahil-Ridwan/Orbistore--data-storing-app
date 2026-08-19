import AsyncStorage from '@react-native-async-storage/async-storage';
import { writeBatch } from 'firebase/firestore';
import { readCache } from '../storage_entry/cacheService';
import { db } from '../utility/firebaseConfig';
import { companiesRef } from '../utility/helpers';
import { CACHE_KEY, readCompanyCache, removeCacheCompany, updateCacheCompany } from "./cacheService_company";
import { addPendingCompanyMutation, PENDING_MUTATIONS_KEY, syncPendingCompanyMutations } from "./offlineMutation_company";
import { LAST_SYNC_KEY, notifyCompanySubscribers } from "./subscription_company";
import { Company } from "./typeCompany";

export const addCompany = async (
  company: Omit<Company, 'companyid' | 'companycreatedAt'>,
): Promise<Company> => {
  

  const companyid = Date.now().toString() + Math.random().toString(36).slice(2, 7);
  const newCompany: Company = {
    ...company,
    companyid,
    companycreatedAt: new Date().toISOString(),
    companyupdatedAt: new Date().toISOString(), // for cloud
  };

  // Write to cache immediately so the UI updates before network confirms.
  await updateCacheCompany(newCompany);
  const cached = await readCompanyCache();
  const entries = await readCache();
  notifyCompanySubscribers(cached, entries);

  // Add to pending mutations queue
  await addPendingCompanyMutation(companyid, 'UPSERT', newCompany);

  // Trigger sync in background
  syncPendingCompanyMutations().catch((err) =>
    console.error('Firestore addCompany sync failed:', err),
  );

  return newCompany;
};


export const deleteCompany = async (id: string): Promise<void> => {
  // Remove from cache immediately.
  await removeCacheCompany(id);
  const cached = await readCompanyCache();
  const entries = await readCache();
  notifyCompanySubscribers(cached, entries);

  // Add to pending mutations queue
  await addPendingCompanyMutation(id, 'DELETE');

  // Trigger sync in background
  syncPendingCompanyMutations().catch((err) =>
    console.error('Firestore deleteCompany sync failed:', err),
  );
};

export const clearAllCompanies = async (): Promise<void> => {
  // Clear local cache, sync timestamp, and pending mutations immediately.
  await AsyncStorage.removeItem(CACHE_KEY);
  await AsyncStorage.removeItem(LAST_SYNC_KEY);
  await AsyncStorage.removeItem(PENDING_MUTATIONS_KEY);
  notifyCompanySubscribers([]);

  // Batch-delete from Firestore.
  const { getDocs: _getDocs } = await import('firebase/firestore');
  const snap = await _getDocs(companiesRef);
  const BATCH_SIZE = 450;
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const chunk = docs.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    chunk.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
};

