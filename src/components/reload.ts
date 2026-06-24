import { getEntries } from '../storage/entries';

export default function loadEntries(setEntries: (entries: any[]) => void) {
  return async () => {
    const data = await getEntries();
    setEntries(data);
  };
} 