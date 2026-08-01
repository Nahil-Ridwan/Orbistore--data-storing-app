import { collection, doc, writeBatch } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { readCompanyCache } from '../storage_company/cacheService_company';
import { Company } from '../storage_company/typeCompany';
import { readCache, writeCache } from '../storage_entry/cacheService';
import { Entry } from '../storage_entry/typeEntry';
import { db } from './firebaseConfig';


// ---- Firestore collection reference ----
export const entriesRef = collection(db, 'entries');

export const companiesRef = collection(db, 'companies');

// One-time read — used by export and syncStatuses.
export const getEntries = async (): Promise<Entry[]> => {
  const cached = await readCache();
  return sortEntries(cached);
};

export const getCompanies = async (): Promise<Company[]> => {
  const cached = await readCompanyCache();
  return sortCompanies(cached);
};


// ---- Shared date helpers ----
export const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

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

export const formatDate = (val?: string): string | undefined => {
    if (!val) return '';
    const parts = val.trim().split(/[\s-]+/);
    if (parts.length === 3) {
      const [day, month, year] = parts;
      const monthIndex = isNaN(Number(month))
        ? monthMap[month.toUpperCase()]
        : Number(month) - 1;
      if (monthIndex === undefined || isNaN(monthIndex)) return val;
      const date = new Date(2000 + Number(year), monthIndex, Number(day));
      if (!isNaN(date.getTime())) {
        return formatDateOutput(date)
      }
    }
    return val;
  };

export const formatDateimport = (val?: any): string | undefined => {
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

export const getValidity = (inputdate?: string, refTodayMs?: number): number | undefined => {
  const inputDate = parseAppDate(inputdate);
  if (!inputDate) return undefined;
  inputDate.setHours(0, 0, 0, 0);
  const todayMs = refTodayMs ?? (() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today.getTime();
  })();
  const diffMs = inputDate.getTime() - todayMs;
  return Math.round(diffMs / 86400000);
};

export const getAge = (inputdate?: string, refTodayMs?: number): number | undefined => {
  const inputDate = parseAppDate(inputdate);
  if (!inputDate) return undefined;
  inputDate.setHours(0, 0, 0, 0);
  const todayMs = refTodayMs ?? (() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today.getTime();
  })();
  const diffMs = inputDate.getTime() - todayMs;
  return -Math.round(diffMs / 86400000);
};

// ---- Sort helper (shared by both local and cloud paths) ----
export const sortEntries = (entries: Entry[]): Entry[] => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();
  return entries
    .map((e) => ({ ...e, validity: getValidity(e.expdate, todayMs), deviceage: getAge(e.installdate, todayMs) }))
    .sort((a, b) => (b.validity ?? -Infinity) - (a.validity ?? -Infinity));
};

// for company
interface CompanyCounts {
  stock: number;
  unpaid: number;
}

export const computeCompanyCountsMap = (entries: Entry[]): Map<string, CompanyCounts> => {
  const countsMap = new Map<string, CompanyCounts>();
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const companyKey = entry.company?.toLowerCase().trim();
    if (!companyKey) continue;

    let counts = countsMap.get(companyKey);
    if (!counts) {
      counts = { stock: 0, unpaid: 0 };
      countsMap.set(companyKey, counts);
    }

    const status = entry.status?.toLowerCase().trim();
    if (status === 'available') {
      counts.stock += 1;
    } else {
      const payment = entry.payment?.toLowerCase().trim();
      if (status === 'active' && payment !== 'received') {
        counts.unpaid += 1;
      }
    }
  }
  return countsMap;
};

export const sortCompaniesWithEntries = (companies: Company[], entries: Entry[]): Company[] => {
  const countsMap = computeCompanyCountsMap(entries);
  return companies
    .map((company) => {
      const key = company.name?.toLowerCase().trim() || '';
      const counts = countsMap.get(key) || { stock: 0, unpaid: 0 };
      return {
        ...company,
        ...counts,
      };
    })
    .sort((a, b) => (a.stock || 0) - (b.stock || 0));
};

export const sortCompanies = async (companies: Company[]): Promise<Company[]> => {
  const entries = await getEntries();
  return sortCompaniesWithEntries(companies, entries);
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

