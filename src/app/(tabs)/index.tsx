import { Ionicons } from '@expo/vector-icons';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import MacroGrid from '../../components/MacroGrid';
import RecentEntries from '../../components/RecentEntries';
import { Entry } from '../../storage_entry/typeEntry';
import { colors, globalStyles } from '../../styles/global';
import { exportData, pickAndImportData } from '../../utility/importExport';

type Props = {
  entries: Entry[];
  openAllEntriesWithSearch: () => void;
  reload: () => void;
};

export default function HomeScreen({ entries, openAllEntriesWithSearch, reload }: Props) {

  const handleImport = async () => {
  try {
    await pickAndImportData();

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
          <Text style={[globalStyles.title, {color:colors.primary}]}>Orbitracker</Text>

          <TouchableOpacity style={{ marginTop: 8, marginLeft: 55 }} onPress={handleImport}>
            <Ionicons name='cloud-download-outline' size={26} color={colors.primary} />
          </TouchableOpacity>

          <TouchableOpacity style={{ marginTop: 8, marginRight: 17 }} onPress={exportData}>
            <Ionicons name='cloud-upload-outline' size={26} color={colors.primary} />
          </TouchableOpacity>
        </View>
        <MacroGrid onPress={openAllEntriesWithSearch} entries={entries} />
        <RecentEntries entries={entries} />
      </ScrollView>
    </View>
  );
}
