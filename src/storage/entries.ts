import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';

export type Entry = {
  id: string;
  company?: string;
  device?: number;
  username?:string;
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
};

const ENTRIES_KEY = 'entries';

export const exportEntries = async (): Promise<void> => {
  const entries = await getEntries();
  const dateFields: (keyof Entry)[] = ['installdate', 'expdate', 'renewal1', 'renewal2', 'renewal3', 'renewal4', 'renewal5'];

  const toExcelSerial = (date: Date): number =>
    Math.round((date.getTime() - new Date(Date.UTC(1899, 11, 30)).getTime()) / 86400000);

  const safeEntries = entries.map((e) => {
    const row: any = { ...e, sim: String(e.sim), imei: String(e.imei),validity: getValidityDays(e.expdate), };
    dateFields.forEach((field) => {
      const date = parseAppDate(e[field] as string);
      if (date) row[field] = toExcelSerial(date);
       
    });
    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(safeEntries);

  // mark date columns as dates in Excel
  const headers = Object.keys(safeEntries[0] || {});
  dateFields.forEach((field) => {
    const colIndex = headers.indexOf(field as string);
    if (colIndex === -1) return;
    safeEntries.forEach((_, rowIndex) => {
      const cellRef = XLSX.utils.encode_cell({ r: rowIndex + 1, c: colIndex });
      if (worksheet[cellRef] && typeof worksheet[cellRef].v === 'number') {
        worksheet[cellRef].t = 'n';
        worksheet[cellRef].z = 'DD-MMM-YY'; // default display format
      }
    });
  });

  // force sim/imei to text
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
const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

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
  const monthMap: Record<string, number> = {
    JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
    JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
  };
  const monthIndex = monthMap[month.toUpperCase()];
  if (monthIndex === undefined) return undefined;
  return new Date(2000 + Number(year), monthIndex, Number(day));
};

const isExpired = (dateStr?: string): boolean => {
      if (!dateStr) return false;
      const parts = dateStr.split('-');
      if (parts.length !== 3) return false;
      const [day, month, year] = parts;

      const monthMap: Record<string, number> = {
      JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
      JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
     };

      const monthIndex = monthMap[month.toUpperCase()];
      if (monthIndex === undefined) return false;
      const expDate = new Date(2000 + Number(year), monthIndex, Number(day));
      return expDate < new Date();
    };

export const pickAndImportEntries = async (): Promise<void> => {
  const existingEntries = await getEntries();
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

  const monthMap: Record<string, number> = {
    JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
    JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
  };

  

  const formatDate = (val?: any): string | undefined => {
  if (!val) return undefined;

  // Handle Excel serial number
  if (typeof val === 'number') {
    const date = XLSX.SSF.parse_date_code(val);
    if (date) {
      const d = new Date(date.y, date.m - 1, date.d);
      return formatDateOutput(d);
    }
  }

  const str = String(val).trim();

  // Handle Excel short date string: M/D/YYYY or D/M/YYYY
  const slashParts = str.split('/');
  if (slashParts.length === 3) {
    const [a, b, c] = slashParts;
    // Try D/M/YYYY first (en-GB), fallback to M/D/YYYY
    const date = new Date(`${c}-${b.padStart(2,'0')}-${a.padStart(2,'0')}`);
    if (!isNaN(date.getTime())) return formatDateOutput(date);
    // fallback M/D/YYYY
    const date2 = new Date(`${c}-${a.padStart(2,'0')}-${b.padStart(2,'0')}`);
    if (!isNaN(date2.getTime())) return formatDateOutput(date2);
  }

  // Handle app format DD-MMM-YY or space separated
  const parts = str.split(/[\s-]+/);
  if (parts.length === 3) {
    const [day, month, year] = parts;
    const monthIndex = isNaN(Number(month))
      ? monthMap[month.toUpperCase()]
      : Number(month) - 1;
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
        return formatDateOutput(date)
      }
    }
    return undefined;
  };

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
          if(parts.length !==3) return formatDate(row.expdate) ?? row.expdate;
          const [dStr, mStr, yStr] = parts ;
          const monthIndex = monthMap[mStr];
          if (monthIndex === undefined) return formatDate(row.expdate) ?? row.expdate;
          const date = new Date(2000 + Number(yStr), monthIndex, Number(dStr));
          date.setFullYear(date.getFullYear() + 1);
          return formatDateOutput(date)
        })();
      
    

    const expdate = newExpdate ?? formatDate(row.expdate) ?? row.expdate;
    const existingStatus = row.status?.toLowerCase().trim();
    const status = existingStatus === 'discontinued' || existingStatus === 'discontd'
     ? 'DISCONTD'
    : !existingStatus
     ? isExpired(expdate) ? 'EXPIRED' : 'ACTIVE'
     : row.status;

       return {
     ...row,
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
   };
  });

  const merged = [
  ...existingEntries.filter((e) => !parsed.some((p) => p.id === e.id)),
  ...parsed,
];

  await AsyncStorage.setItem(ENTRIES_KEY, JSON.stringify(merged));
};

export const clearAllEntries = async (): Promise<void> => {
  await AsyncStorage.removeItem(ENTRIES_KEY);
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

export const getEntries = async (): Promise<Entry[]> => {
  const data = await AsyncStorage.getItem(ENTRIES_KEY);
  const entries: Entry[] = data ? JSON.parse(data) : [];
  return entries.map((e) => ({
    ...e,
    validity: getValidityDays(e.expdate),
  }));
};

export const deleteEntry = async (id: string): Promise<void> => {
  const entries = await getEntries();
  const filtered = entries.filter((entry) => entry.id !== id);
  await AsyncStorage.setItem(ENTRIES_KEY, JSON.stringify(filtered));
};


export const addEntry = async (
  entry: Omit<Entry, 'id' | 'createdAt'>,
): Promise<Entry> => {
  const entries = await getEntries();
   let status = entry.status;
   if(entry.expdate) {
    if (!status || status.trim() === '') {
      status = isExpired(entry.expdate) ? 'EXPIRED' : 'ACTIVE';
    }
  }

  const newEntry: Entry = {
    ...entry,
    status,
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
  };
  console.log('newEntry being saved:', JSON.stringify(newEntry))
  await AsyncStorage.setItem(ENTRIES_KEY, JSON.stringify([newEntry, ...entries]));
  return newEntry;
};

export const updateEntry = async (updated: Entry): Promise<void> => {
  const entries = await getEntries();

  const monthMap: Record<string, number> = {
    JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
    JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
  };

  const formatDate = (val?: string): string | undefined => {
    if (!val) return val;
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
        return formatDateOutput(date)
      }
    }
    return undefined;
  };

  const formattedInstalldate = formatDate(updated.installdate) ?? updated.installdate;

  const latestRenewal =
    updated.renewal5 ||
    updated.renewal4 ||
    updated.renewal3 ||
    updated.renewal2 ||
    updated.renewal1;

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
  
  const formattedStatus = updated.status?.toLowerCase().trim() === 'discontinued' ? 'DISCONTD' : updated.status;

  const resolvedStatus = (() => {
    if (formattedStatus?.toLowerCase().trim() === 'discontd') return 'DISCONTD';
    if (newExpdate && updated.installdate!=='') {
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
  };

  const newEntries = entries.map((e) => e.id === finalEntry.id ? finalEntry : e);
  console.log(newEntries);
  await AsyncStorage.setItem(ENTRIES_KEY, JSON.stringify(newEntries));
};