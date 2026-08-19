import { clearAllCompanies } from '@/src/storage_company/coreCrud_company';
import { Company } from '@/src/storage_company/typeCompany';
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { useMemo, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown, LinearTransition, ZoomIn, ZoomOut } from 'react-native-reanimated';
import CompanyItem from '../../components/CompanyItem';
import EntryItem from '../../components/EntryItem';
import { clearAllEntries } from '../../storage_entry/coreCrud';
import { Entry } from '../../storage_entry/typeEntry';
import { colors, globalStyles } from '../../styles/global';

type Props = {
  entries: Entry[];
  companies: Company[];
  searchVisible: boolean;
  setSearchVisible: (value: boolean) => void;
};

export default function AllEntriesScreen({ entries, companies, searchVisible, setSearchVisible }: Props) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [filterVehicle, setFilterVehicle] = useState('');
  const [filterCompany, setFilterCompany] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPayment, setFilterPayment] = useState('');
  const [headerHeight, setHeaderHeight] = useState(0);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // for company
  const [addvehicle, setAddvehicle] = useState(true);
  const [filterPlace, setFilterPlace] = useState('');

  const toggleCompany = () => {
    setAddvehicle(!addvehicle)
  };

  const handleSearch = (text: string) => {
    setQuery(text);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebouncedQuery(text), 300);
  };


  const handleClearAll = () => {
   if(addvehicle) {
    Alert.alert('Clear All !', 'Delete all devices?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await clearAllEntries();
          } catch (err) {
            console.error('Failed to clear devices:', err);
            Alert.alert('Error', 'Some devices may not have been deleted. Try again.');
          }
        },
      },
    ]);
   }
   // for company
   else {
    Alert.alert('Clear All !', 'Delete all companies?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await clearAllCompanies();
          } catch (err) {
            console.error('Failed to clear companies:', err);
            Alert.alert('Error', 'Some companies may not have been deleted. Try again.');
          }
        },
      },
    ]);
   }
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
  
      const matchesVehicle = !filterVehicle || String(entry.vehicle ?? '').toLowerCase().includes(filterVehicle.toLowerCase().trim());
      const matchesCompany = !filterCompany || String(entry.company ?? '').toLowerCase().includes(filterCompany.toLowerCase().trim());
      const matchesStatus = !filterStatus || String(entry.status ?? '').toLowerCase().includes(filterStatus.toLowerCase().trim());
      const matchesPayment = !filterPayment || String(entry.payment ?? '').toLowerCase().includes(filterPayment.toLowerCase().trim());
      return matchesQuery && matchesVehicle && matchesCompany && matchesStatus && matchesPayment;
    });
  }, [debouncedQuery, entries, filterVehicle, filterCompany, filterStatus, filterPayment]);

  //for company

  const companyfiltered = useMemo(() => {
    const q = debouncedQuery.toLowerCase().trim();
    return companies.filter((company) => {
      const matchesQuery = !q || (
        String(company.name ?? '').toLowerCase().includes(q) ||
        String(company.companyplace ?? '').toLowerCase().includes(q) ||
        String(company.stock ?? '').toLowerCase().includes(q) ||
        String(company.unpaid ?? '').toLowerCase().includes(q)
      );
  
      const matchesPlace = !filterPlace || String(company.companyplace ?? '').toLowerCase().includes(filterPlace.toLowerCase().trim());
      return matchesQuery && matchesPlace ;
    });
  }, [debouncedQuery, companies, filterPlace]);


  const toggleSearch = () => {
    setSearchVisible(!searchVisible);
    setQuery('');
    setDebouncedQuery('');
    setFilterCompany('');
    setFilterStatus('');
    setFilterPayment('');
    setFilterVehicle('');
    //for company
    setFilterPlace('');
  };

  

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>

      {/* ---- Scrollable list — fills the FULL screen from the very top ---- */}
      <KeyboardAvoidingView 
      style={{flex:1}} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'  
      }>
      {(addvehicle &&
      <FlashList
        key={searchVisible ? 'search-open' : 'search-closed'}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: 70,
          // Push content down by the measured header height so items start below the header.
          // As items scroll up they pass behind the absolutely-positioned header.
          paddingTop: headerHeight + 10,
        }}
        showsVerticalScrollIndicator={false}
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
      )}
    
      {/*for company*/}
      {(!addvehicle &&
      <FlashList
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: 70,
          // Push content down by the measured header height so items start below the header.
          // As items scroll up they pass behind the absolutely-positioned header.
          paddingTop: headerHeight + 10,
        }}
        showsVerticalScrollIndicator={false}
        data={companyfiltered}
        keyExtractor={(company) => String(company.companyid)}
        keyboardDismissMode='on-drag'
        ListEmptyComponent={<Text style={globalStyles.empty}>No entries found.</Text>}
        renderItem={({ item: company }) => (
          <CompanyItem
            key={company.companyid}
            companyid={company.companyid}
            name={company.name}
            companyplace={company.companyplace}
            stock={company.stock}
            unpaid={company.unpaid}
            companycreatedAt={company.companycreatedAt}
          />
        )}
      />
      )}
      </KeyboardAvoidingView>

      {/* ---- Header — absolutely positioned so the list scrolls behind it ---- */}
      <Animated.View
        style={styles.header}
        layout={LinearTransition}
        onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
      >
        <View style={globalStyles.header}>
          <Animated.Text
            key={addvehicle ? 'devices' : 'companies'} //  Force re-mount on change
            entering={FadeInDown.duration(200)} // flipinx stretchx
            exiting={FadeOutDown.duration(150)}
            onLongPress={handleClearAll}
            onPress={toggleCompany}
            style={[globalStyles.title, { marginBottom: 15, marginLeft: 6 }]}
          >
            {addvehicle ? 'Devices' : 'Companies'}
            <Ionicons style={{ paddingLeft:30 }}size={24} color='hsl(20, 1%, 47%)' name='chevron-expand-outline'></Ionicons>
          </Animated.Text>
          
          <TouchableOpacity onPress={toggleSearch}>
            <Ionicons
              style={{ marginBottom: 10, marginRight: 13 }}
              name={searchVisible ? 'close-outline' : 'search-outline'}
              size={26}
              color={colors.primary}
            />
          </TouchableOpacity>
        </View>

        {searchVisible && addvehicle && (
          <Animated.View
            entering={ZoomIn.duration(200)} //zoomin
            exiting={ZoomOut.duration(150)}
            style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}
          >
            <TextInput
              style={[styles.searchInput, { width:'65.91%' }]}
              placeholder='Search Devices...'
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
          </Animated.View>
          )}

        {/*for company*/}

        {searchVisible && !addvehicle && (
          <Animated.View
            entering={ZoomIn.duration(200)} //zoomin
            exiting={ZoomOut.duration(150)}
            style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}
          >
            <TextInput
              style={[styles.searchInput, { width:'65.91%' }]}
              placeholder='Search Companies...'
              placeholderTextColor={colors.textSecondary}
              value={query}
              onChangeText={handleSearch}
              autoFocus
            />

            <TextInput
              style={[styles.searchInput, { width:'31.6%' }]}
              placeholder='Place'
              placeholderTextColor={colors.textSecondary}
              value={filterPlace}
              onChangeText={setFilterPlace}
            />
          </Animated.View>
          )}

        {searchVisible && addvehicle && (
          <Animated.View
            entering={ZoomIn.duration(200)} // flipinx stretchx
            exiting={ZoomOut.duration(150)}
            style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}
          >
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
          </Animated.View>
        )}

        {searchVisible && addvehicle && (
            <Animated.Text 
             entering={ZoomIn.duration(200)} // flipinx stretchx
             exiting={ZoomOut.duration(150)}
             style={{ color: colors.alert, fontSize: 14, marginTop: 13, marginBottom: 4, marginLeft: 10 }}>
               Showing {filtered.length} device{filtered.length !== 1 ? 's...' : '...'}
            </Animated.Text>
        )}

        {/*for company*/}

        {searchVisible && !addvehicle && (
            <Animated.Text 
             entering={ZoomIn.duration(200)} // flipinx stretchx
             exiting={ZoomOut.duration(150)}
             style={{ color: colors.alert, fontSize: 14, marginTop: 13, marginBottom: 4, marginLeft: 10 }}>
               Showing {companyfiltered.length} compan{companyfiltered.length !== 1 ? 'ies...' : 'y...'}
            </Animated.Text>
        )}
      </Animated.View>
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
  },
};
