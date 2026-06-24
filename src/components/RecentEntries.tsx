import { StyleSheet, Text, View } from 'react-native';
import { Entry } from '../storage/entries';
import EntryItem from './EntryItem';




type RecentEntryProps = {
  entries: Entry[];
};

export default function RecentEntries({ entries }: RecentEntryProps) {
  return (
    <View style={{ marginTop: 30 }}>
      <Text style={styles.sectionTitle}>Recent Vehicles</Text>
      {entries.length === 0 ? (
        <Text style={styles.empty}>No entries logged yet.</Text>
      ) : (
        entries
          .slice(0, 4)
          .map((entry) => (
            <EntryItem
              key={entry.id}
              id={entry.id}
              company={entry.company}
              device={entry.device}
              username={entry.username}
              mobile={entry.mobile}
              vehicle={entry.vehicle}
              type={entry.type}
              lock={entry.lock}
              devicemodel={entry.devicemodel}
              installdate={entry.installdate}
              expdate={entry.expdate}
              validity={entry.validity}
              status={entry.status}
              payment={entry.payment}
              sim={entry.sim}
              imei={entry.imei}
              note={entry.note}
              renewal1={entry.renewal1}
              renewal2={entry.renewal2}
              renewal3={entry.renewal3}
              renewal4={entry.renewal4}
              renewal5={entry.renewal5}
              createdAt={entry.createdAt}
            />
          ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 16,
  },
  empty: {
    color: '#a0a0b0',
    fontSize: 14,
  },
});