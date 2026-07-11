import { collection, doc, writeBatch } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { readCache, writeCache } from './cacheService';
import { db } from './firebaseConfig';
import { Entry } from './typeEntry';


// ---- Firestore collection reference ----
export const entriesRef = collection(db, 'entries');

// One-time read — used by export and syncStatuses.
export const getEntries = async (): Promise<Entry[]> => {
  const cached = await readCache();
  return sortEntries(cached);
};


// ---- Shared date helpers ----
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export const monthMap: Record<string, number> = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
};

export const formatDateOutput = (date: Date): string => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = MONTHS[date.getMonth()];
  const year = String(date.getFullYear()).slice(-2);
  return `${day}-${month}-${year}`;
};

export const parseAppDate = (dateStr?: string): Date | undefined => {
  if (!dateStr) return undefined;
  const parts = dateStr.trim().split('-');
  if (parts.length !== 3) return undefined;
  const [day, month, year] = parts;
  const monthIndex = monthMap[month.toUpperCase()];
  if (monthIndex === undefined) return undefined;
  return new Date(2000 + Number(year), monthIndex, Number(day));
};

export const isExpired = (dateStr?: string): boolean => {
  const date = parseAppDate(dateStr);
  if (!date) return false;
  return date < new Date();
};

export const formatDate = (val?: any): string | undefined => {
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

 export const getNextExpiry = (dateStr?: string) => {
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

export const getValidity = (inputdate?: string): number | undefined => {
  const inputDate = parseAppDate(inputdate);
  if (!inputDate) return undefined;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  inputDate.setHours(0, 0, 0, 0);
  const diffMs = inputDate.getTime() - today.getTime();
  return Math.round(diffMs / 86400000);
};

export const getAge = (inputdate?: string): number | undefined => {
  const inputDate = parseAppDate(inputdate);
  if (!inputDate) return undefined;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  inputDate.setHours(0, 0, 0, 0);
  const diffMs = inputDate.getTime() - today.getTime();
  return ( 0 - Math.round(diffMs / 86400000));
};

// ---- Sort helper (shared by both local and cloud paths) ----
 export const sortEntries = (entries: Entry[]): Entry[] =>
  entries
    .map((e) => ({ ...e, validity: getValidity(e.expdate), deviceage: getAge(e.installdate) }))
    .sort((a, b) => (b.validity ?? -Infinity) - (a.validity ?? -Infinity));


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

