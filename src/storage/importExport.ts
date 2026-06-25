import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { doc, writeBatch } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { readCache, writeCache } from './cacheService';
import { entriesRef, getEntries } from './coreCrud';
import { db } from './firebaseConfig';
import {
    formatDate,
    formatDateOutput,
    getNextExpiry,
    getValidityDays,
    isExpired,
    monthMap,
    parseAppDate,
} from './helpers';
import { addPendingMutations, removePendingMutations, syncPendingMutations, } from './offlineMutation';
import { notifySubscribers } from './subscription';
import { Entry } from './typeEntry';


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