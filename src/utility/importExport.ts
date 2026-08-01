import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { doc, writeBatch } from 'firebase/firestore';
import * as XLSX from 'xlsx';

// ---- Entries (vehicles) plumbing ----
import { readCache as readEntryCache, writeCache as writeEntryCache } from '../storage_entry/cacheService';
import {
  addPendingMutations as addPendingEntryMutations,
  removePendingMutations as removePendingEntryMutations,
  syncPendingMutations as syncPendingEntryMutations,
} from '../storage_entry/offlineMutation';
import { notifySubscribers as notifyEntrySubscribers } from '../storage_entry/subscription';
import { Entry } from '../storage_entry/typeEntry';

// ---- Companies plumbing ----
// NOTE: adjust these three import paths/names if your actual company modules
// are named differently — they're assumed to mirror the storage_entry pattern.
import { readCompanyCache, writeCompanyCache } from '../storage_company/cacheService_company';
import {
  addPendingCompanyMutations,
  removePendingCompanyMutations,
  syncPendingCompanyMutations,
} from '../storage_company/offlineMutation_company';
import { notifyCompanySubscribers } from '../storage_company/subscription_company';
import { Company } from '../storage_company/typeCompany';

import { db } from '../utility/firebaseConfig';
import {
  companiesRef,
  entriesRef,
  formatDateimport,
  formatDateOutput,
  getAge,
  getCompanies,
  getEntries,
  getNextExpiry,
  getValidity,
  isExpired,
  monthMap,
  parseAppDate,
} from '../utility/helpers';

const BATCH_SIZE = 450;
const BACKUP_FILE_NAME = 'orbitracker_backup.xlsx';
const VEHICLES_SHEET = 'devices';
const COMPANIES_SHEET = 'companies';

const toExcelSerial = (date: Date): number =>
  Math.round((date.getTime() - new Date(Date.UTC(1899, 11, 30)).getTime()) / 86400000);

const forceColumnType = (
  worksheet: XLSX.WorkSheet,
  headers: string[],
  rowCount: number,
  columnName: string,
  cellType: 's' | 'n',
  cellFormat?: string,
) => {
  const colIndex = headers.indexOf(columnName);
  if (colIndex === -1) return;
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
    const cellRef = XLSX.utils.encode_cell({ r: rowIndex + 1, c: colIndex });
    const cell = worksheet[cellRef];
    if (!cell) continue;
    if (cellType === 'n' && typeof cell.v !== 'number') continue;
    cell.t = cellType;
    if (cellFormat) cell.z = cellFormat;
  }
};

// ---- Build "vehicles" sheet (entries) ----
const buildVehiclesSheet = (entries: Entry[]): XLSX.WorkSheet => {
  const dateFields: (keyof Entry)[] = [
    'installdate', 'expdate', 'renewal1', 'renewal2', 'renewal3', 'renewal4', 'renewal5',
  ];

  const safeEntries = entries.map((e) => {
    const row: any = {
      ...e,
      sim: String(e.sim),
      imei: String(e.imei),
      validity: getValidity(e.expdate),
      deviceage: getAge(e.installdate),
    };
    dateFields.forEach((field) => {
      const date = parseAppDate(e[field] as string);
      if (date) row[field] = toExcelSerial(date);
    });
    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(safeEntries);
  const headers = Object.keys(safeEntries[0] || {});

  dateFields.forEach((field) => forceColumnType(worksheet, headers, safeEntries.length, field as string, 'n', 'DD-MMM-YY'));
  forceColumnType(worksheet, headers, safeEntries.length, 'sim', 's');
  forceColumnType(worksheet, headers, safeEntries.length, 'imei', 's');

  return worksheet;
};

// ---- Build "companies" sheet ----
const buildCompaniesSheet = (companies: Company[]): XLSX.WorkSheet => {
  const safeCompanies = companies.map((c) => ({ ...c, companyid: String(c.companyid) }));
  const worksheet = XLSX.utils.json_to_sheet(safeCompanies);
  const headers = Object.keys(safeCompanies[0] || {});

  forceColumnType(worksheet, headers, safeCompanies.length, 'companyid', 's');

  return worksheet;
};

// ---- Export both sheets into a single workbook ----
export const exportData = async (): Promise<void> => {
  const [entries, companies] = await Promise.all([getEntries(), getCompanies()]);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, buildVehiclesSheet(entries), VEHICLES_SHEET);
  XLSX.utils.book_append_sheet(workbook, buildCompaniesSheet(companies), COMPANIES_SHEET);

  const base64 = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' });
  const fileUri = FileSystem.documentDirectory + BACKUP_FILE_NAME;
  await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
  await Sharing.shareAsync(fileUri);
};

// ---- Parse "vehicles" rows into Entry[] (same logic as before) ----
const parseVehicleRows = (data: any[]): Entry[] =>
  data.map((row) => {
    const formattedInstalldate = formatDateimport(row.installdate) ?? row.installdate ?? '';

    const renewal1 = formatDateimport(row.renewal1);
    const renewal2 = formatDateimport(row.renewal2);
    const renewal3 = formatDateimport(row.renewal3);
    const renewal4 = formatDateimport(row.renewal4);
    const renewal5 = formatDateimport(row.renewal5);

    const latestRenewal = renewal5 || renewal4 || renewal3 || renewal2 || renewal1;

    const newExpdate = latestRenewal
      ? getNextExpiry(latestRenewal)
      : (() => {
          if (!formattedInstalldate) return formatDateimport(row.expdate) ?? row.expdate;
          const parts = formattedInstalldate.split('-');
          if (parts.length !== 3) return formatDateimport(row.expdate) ?? row.expdate;
          const [dStr, mStr, yStr] = parts;
          const monthIndex = monthMap[mStr];
          if (monthIndex === undefined) return formatDateimport(row.expdate) ?? row.expdate;
          const date = new Date(2000 + Number(yStr), monthIndex, Number(dStr));
          date.setFullYear(date.getFullYear() + 1);
          return formatDateOutput(date);
        })();

    const expdate = newExpdate ?? formatDateimport(row.expdate) ?? row.expdate;
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

// ---- Parse "companies" rows into Company[] ----
const parseCompanyRows = (data: any[]): Company[] =>
  data.map((row) => ({
    companyid: row.companyid ? String(row.companyid) : Date.now().toString() + Math.random().toString(36).slice(2),
    name: row.name ?? '',
    companyplace: row.companyplace ?? undefined,
    stock: row.stock !== undefined && row.stock !== '' ? Number(row.stock) : undefined,
    unpaid: Number(row.unpaid) || 0,
    companycreatedAt: row.companycreatedAt ?? new Date().toISOString(),
    companyupdatedAt: new Date().toISOString(),
  }));

// Generic batch-commit-to-Firestore + cache + pending-mutation-queue helper,
// shared between entries and companies so the two import paths stay in sync.
async function commitImport<T extends { id?: string; companyid?: string }>(opts: {
  parsed: T[];
  idOf: (item: T) => string;
  collectionRef: any;
  readCache: () => Promise<T[]>;
  writeCache: (data: T[]) => Promise<void>;
  notify: (data: T[]) => void;
  addPending: (mutations: { id: string; type: 'UPSERT'; entry: T }[]) => Promise<void>;
  removePending: (ids: string[]) => Promise<void>;
  syncPending: () => Promise<void>;
}): Promise<{ written: number; failedBatches: number[] }> {
  const { parsed, idOf, collectionRef, readCache, writeCache, notify, addPending, removePending, syncPending } = opts;

  const existingCache = await readCache();
  const merged = [
    ...existingCache.filter((e) => !parsed.some((p) => idOf(p) === idOf(e))),
    ...parsed,
  ];
  await writeCache(merged);
  notify(merged);

  await addPending(parsed.map((entry) => ({ id: idOf(entry), type: 'UPSERT' as const, entry })));

  let written = 0;
  const failedBatches: number[] = [];

  for (let i = 0; i < parsed.length; i += BATCH_SIZE) {
    const chunk = parsed.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    chunk.forEach((entry) => batch.set(doc(collectionRef, idOf(entry)), entry));

    try {
      await batch.commit();
      written += chunk.length;
      await removePending(chunk.map((e) => idOf(e)));
    } catch (err) {
      console.error(`Failed to import batch starting at row ${i}:`, err);
      failedBatches.push(i);
    }
  }

  syncPending().catch((err) => console.error('Background sync failed:', err));

  return { written, failedBatches };
}

// ---- Import both sheets from a single workbook ----
export const pickAndImportData = async (): Promise<void> => {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  if (result.canceled) return;

  const base64 = await FileSystem.readAsStringAsync(result.assets[0].uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const workbook = XLSX.read(base64, { type: 'base64', cellText: true });

  const vehiclesSheet = workbook.Sheets[VEHICLES_SHEET] ?? workbook.Sheets[workbook.SheetNames[0]];
  const companiesSheet = workbook.Sheets[COMPANIES_SHEET];

  const vehicleRows = vehiclesSheet ? XLSX.utils.sheet_to_json<any>(vehiclesSheet, { raw: true }) : [];
  const companyRows = companiesSheet ? XLSX.utils.sheet_to_json<any>(companiesSheet, { raw: true }) : [];

  const parsedEntries = parseVehicleRows(vehicleRows);
  const parsedCompanies = parseCompanyRows(companyRows);

  const [entryResult, companyResult] = await Promise.all([
    parsedEntries.length
      ? commitImport({
          parsed: parsedEntries,
          idOf: (e) => e.id!,
          collectionRef: entriesRef,
          readCache: readEntryCache,
          writeCache: writeEntryCache,
          notify: notifyEntrySubscribers,
          addPending: addPendingEntryMutations,
          removePending: removePendingEntryMutations,
          syncPending: syncPendingEntryMutations,
        })
      : Promise.resolve({ written: 0, failedBatches: [] }),
    parsedCompanies.length
      ? commitImport({
          parsed: parsedCompanies,
          idOf: (c) => c.companyid!,
          collectionRef: companiesRef,
          readCache: readCompanyCache,
          writeCache: writeCompanyCache,
          notify: notifyCompanySubscribers,
          addPending: addPendingCompanyMutations,
          removePending: removePendingCompanyMutations,
          syncPending: syncPendingCompanyMutations,
        })
      : Promise.resolve({ written: 0, failedBatches: [] }),
  ]);

  const totalFailed = entryResult.failedBatches.length + companyResult.failedBatches.length;
  if (totalFailed > 0) {
    throw new Error(
      `Imported ${entryResult.written}/${parsedEntries.length} devices and ` +
      `${companyResult.written}/${parsedCompanies.length} companies. ` +
      `${totalFailed} batch(es) failed — check your connection and try importing again.`,
    );
  }
};