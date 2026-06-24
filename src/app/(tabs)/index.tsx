import { Ionicons } from '@expo/vector-icons';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import HomeHeader from '../../components/HomeHeader';
import MacroGrid from '../../components/MacroGrid';
import RecentEntries from '../../components/RecentEntries';
import { Entry, exportEntries, pickAndImportEntries } from '../../storage/entries';
import { colors, globalStyles } from '../../styles/global';

type Props = {
  entries: Entry[];
  openAllEntriesWithSearch: () => void;
  reload: () => Promise<void>;
};

export default function HomeScreen({ entries, openAllEntriesWithSearch, reload }: Props) {

  const handleImport = async () => {
  try {
    await pickAndImportEntries();

    await reload();

    Alert.alert(
      'Import complete',
      'All entries imported successfully.'
    );
  } catch (err: any) {
    Alert.alert(
      'Import issue',
      err?.message ?? 'Something went wrong during import.'
    );
  }
};

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={globalStyles.container} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={globalStyles.header}>
          <Text style={globalStyles.title}>Orbitracker</Text>

          <TouchableOpacity style={{ marginTop: 8, marginLeft: 55 }} onPress={handleImport}>
            <Ionicons name='cloud-download-outline' size={26} color={colors.primary} />
          </TouchableOpacity>

          <TouchableOpacity style={{ marginTop: 8, marginRight: 17 }} onPress={exportEntries}>
            <Ionicons name='cloud-upload-outline' size={26} color={colors.primary} />
          </TouchableOpacity>
        </View>
        <HomeHeader />
        <MacroGrid onPress={openAllEntriesWithSearch} entries={entries} />
        <RecentEntries entries={entries} />
      </ScrollView>
    </View>
  );
}
