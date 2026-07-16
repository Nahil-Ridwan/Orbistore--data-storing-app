import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';
import EntryItem from '../../components/EntryItem';
import { clearAllEntries } from '../../storage/coreCrud';
import { Entry } from '../../storage/typeEntry';
import { colors, globalStyles } from '../../styles/global';

type Props = {
  entries: Entry[];
  searchVisible: boolean;
  setSearchVisible: (value: boolean) => void;
};

export default function AllEntriesScreen({ entries, searchVisible, setSearchVisible }: Props) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [filterVehicle, setFilterVehicle] = useState('');
  const [filterCompany, setFilterCompany] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPayment, setFilterPayment] = useState('');
  const [headerHeight, setHeaderHeight] = useState(0);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = (text: string) => {
    setQuery(text);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebouncedQuery(text), 300);
  };


  const handleClearAll = () => {
    Alert.alert('Clear All !', 'Delete all vehicles?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await clearAllEntries();
          } catch (err) {
            console.error('Failed to clear entries:', err);
            Alert.alert('Error', 'Some entries may not have been deleted. Try again.');
          }
        },
      },
    ]);
  };

  const filtered = useMemo(() => {
    const q = debouncedQuery.toLowerCase().trim();
    return entries.filter((entry) => {
      const matchesQuery = !q || (
        String(entry.company ?? '').toLowerCase().includes(q) ||
        String(entry.place ?? '').toLowerCase().includes(q) ||
        String(entry.device ?? '').toLowerCase().includes(q) ||
        String(entry.username ?? '').toLowerCase().includes(q) ||
        String(entry.mobile ?? '').toLowerCase().includes(q) ||
        String(entry.vehicle ?? '').toLowerCase().includes(q) ||
        String(entry.type ?? '').toLowerCase().includes(q) ||
        String(entry.lock ?? '').toLowerCase().includes(q) ||
        String(entry.installdate ?? '').toLowerCase().includes(q) ||
        String(entry.status ?? '').toLowerCase().includes(q) ||
        String(entry.payment ?? '').toLowerCase().includes(q) ||
        String(entry.sim ?? '').toLowerCase().includes(q) ||
        String(entry.imei ?? '').toLowerCase().includes(q) ||
        String(entry.shipnum ?? '').toLowerCase().includes(q) ||
        String(entry.note ?? '').toLowerCase().includes(q) ||
        String(entry.address ?? '').toLowerCase().includes(q)
      );
  
      const matchesVehicle = !filterVehicle || String(entry.vehicle ?? '').toLowerCase().includes(filterVehicle.toLowerCase());
      const matchesCompany = !filterCompany || String(entry.company ?? '').toLowerCase().includes(filterCompany.toLowerCase());
      const matchesStatus = !filterStatus || String(entry.status ?? '').toLowerCase().includes(filterStatus.toLowerCase());
      const matchesPayment = !filterPayment || String(entry.payment ?? '').toLowerCase().includes(filterPayment.toLowerCase());
      return matchesQuery && matchesVehicle && matchesCompany && matchesStatus && matchesPayment;
    });
  }, [debouncedQuery, entries, filterVehicle, filterCompany, filterStatus, filterPayment]);


  const toggleSearch = () => {
    setSearchVisible(!searchVisible);
    setQuery('');
    setDebouncedQuery('');
    setFilterCompany('');
    setFilterStatus('');
    setFilterPayment('');
    setFilterVehicle('');
  };

  

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>

      {/* ---- Scrollable list — fills the FULL screen from the very top ---- */}
      <KeyboardAvoidingView 
      style={{flex:1}} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'  
      }>
      <FlashList
        key={searchVisible ? 'search-open' : 'search-closed'}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: 70,
          // Push content down by the measured header height so items start below the header.
          // As items scroll up they pass behind the absolutely-positioned header.
          paddingTop: headerHeight + 10,
        }}
        data={filtered}
        keyExtractor={(entry) => String(entry.id)}
        keyboardDismissMode='on-drag'
        ListEmptyComponent={<Text style={globalStyles.empty}>No entries found.</Text>}
        renderItem={({ item: entry }) => (
          <EntryItem
            key={entry.id}
            id={entry.id}
            company={entry.company}
            place={entry.place}
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
            deviceage={entry.deviceage}
            shipnum={entry.shipnum}
            status={entry.status}
            payment={entry.payment}
            sim={entry.sim}
            imei={entry.imei}
            note={entry.note}
            address={entry.address}
            renewal1={entry.renewal1}
            renewal2={entry.renewal2}
            renewal3={entry.renewal3}
            renewal4={entry.renewal4}
            renewal5={entry.renewal5}
            createdAt={entry.createdAt}
          />
        )}
      />
      </KeyboardAvoidingView>

      {/* ---- Header — absolutely positioned so the list scrolls behind it ---- */}
      <View
        style={styles.header}
        onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
      >
        <View style={globalStyles.header}>
          <Text
            onLongPress={handleClearAll}
            style={[globalStyles.title, { marginBottom: 15, marginLeft: 6 }]}
          >
            All Vehicles
          </Text>
          <TouchableOpacity onPress={toggleSearch}>
            <Ionicons
              style={{ marginBottom: 10, marginRight: 13 }}
              name={searchVisible ? 'close-outline' : 'search-outline'}
              size={26}
              color={colors.primary}
            />
          </TouchableOpacity>
        </View>

        {searchVisible && (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <TextInput
              style={[styles.searchInput, { width:'65.91%' }]}
              placeholder='Search Vehicles...'
              placeholderTextColor={colors.textSecondary}
              value={query}
              onChangeText={handleSearch}
              autoFocus
            />

            <TextInput
              style={[styles.searchInput, { width:'31.6%' }]}
              placeholder='Vehicle'
              placeholderTextColor={colors.textSecondary}
              value={filterVehicle}
              onChangeText={setFilterVehicle}
            />
          </View>
          )}

        {searchVisible && (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <TextInput
              style={[styles.searchInput, { flex: 1, marginTop: 0 }]}
              placeholder='Company'
              placeholderTextColor={colors.textSecondary}
              value={filterCompany}
              onChangeText={setFilterCompany}
            />
            <TextInput
              style={[styles.searchInput, { flex: 1, marginTop: 0 }]}
              placeholder='Status'
              placeholderTextColor={colors.textSecondary}
              value={filterStatus}
              onChangeText={setFilterStatus}
            />
            <TextInput
              style={[styles.searchInput, { flex: 1, marginTop: 0 }]}
              placeholder='Payment'
              placeholderTextColor={colors.textSecondary}
              value={filterPayment}
              onChangeText={setFilterPayment}
            />
          </View>
        )}

        {searchVisible && (
          <Text style={{ color: colors.alert, fontSize: 14, marginTop: 13, marginBottom: 4, marginLeft: 10 }}>
            Showing {filtered.length} vehicle{filtered.length !== 1 ? 's...' : '...'}
          </Text>
        )}
      </View>

    </View>
  );
}

const styles = {
  searchInput: {
    backgroundColor: colors.surface,
    color: colors.alert,
    padding: 13,
    borderRadius: 10,
    fontSize: 15,
    marginTop: 0,
  },
  header: {
    // Floats above the FlashList — the list scrolls behind this
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background,
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 8,
    zIndex: 10,
    elevation: 10,
  },
};
