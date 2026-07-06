import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import PagerView from 'react-native-pager-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NetworkToast from '../../components/NetworkToast';
import { getEntries } from '../../storage/helpers';
import { subscribeToEntries } from '../../storage/subscription';
import { Entry } from '../../storage/typeEntry';
import { colors } from '../../styles/global';


import AddEntryScreen from './add-entry';
import AllEntriesScreen from './entries';
import HomeScreen from './index';

const TABS = [
  { name: 'Home', icon: 'home', iconOutline: 'home-outline' },
  { name: 'Add Entry', icon: 'add', iconOutline: 'add-outline' },
  { name: 'All Entries', icon: 'list', iconOutline: 'list-outline' },
];

export default function TabLayout() {
  
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState(0);
  const pagerRef = useRef<PagerView>(null);

  const [entries, setEntries] = useState<Entry[]>([]);

  const loadEntries = async () => {
  const data = await getEntries();
  console.log('LOAD ENTRIES', data.length);
  setEntries(data);
};

  const goToTab = (index: number) => {
    setActiveTab(index);
    pagerRef.current?.setPage(index);
  };

  const [searchVisible, setSearchVisible] = useState(false);
 
  const openAllEntriesWithSearch = () => {
  setSearchVisible(true);
  goToTab(2); // AllEntriesScreen is page 0 in your PagerView
};

  useEffect(() => {
  const unsubscribe = subscribeToEntries(setEntries);
  return () => unsubscribe();
}, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <PagerView
        ref={pagerRef}
        style={{ flex: 1 }}
        initialPage={0}
        onPageSelected={(e) => setActiveTab(e.nativeEvent.position)}
      >
        <View key="0" style={{ flex: 1 }}><HomeScreen 
         reload={loadEntries}
         openAllEntriesWithSearch={openAllEntriesWithSearch}
         entries={entries}/></View>
        <View key="1" style={{ flex: 1 }}><AddEntryScreen/></View>
        <View key="2" style={{ flex: 1 }}><AllEntriesScreen
         searchVisible={searchVisible} 
         setSearchVisible={setSearchVisible} 
         entries={entries}/></View>
        
        
        
      </PagerView>

       <NetworkToast />

      {/* Custom Tab Bar */}
      <View style={[styles.tabBar, { bottom: insets.bottom + 16 }]}>
        <BlurView
          intensity={80}
          tint="dark"
          style={StyleSheet.absoluteFill}
        />
        {TABS.map((tab, index) => {
          const focused = activeTab === index;
          return (
            <TouchableOpacity
              key={index}
              style={styles.tabItem}
              onPress={() => goToTab(index)}
            >
              <View style={[styles.iconWrapper, focused && styles.iconWrapperFocused]}>
                <Ionicons
                  name={(focused ? tab.icon : tab.iconOutline) as any}
                  size={index === 0 ? 22 : index === 1 ? 26 : 24}
                  color={focused ? colors.primary : 'rgba(255,255,255,0.45)'}
                />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    left: 10,
    right: 10,
    height: 64,
    borderRadius: 32,
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(30,30,40,0.72)',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapper: {
    width: 40,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapperFocused: {
    backgroundColor: `${colors.primary}22`,
    borderRadius:13,
  },
});