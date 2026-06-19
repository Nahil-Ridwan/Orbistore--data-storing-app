import { Ionicons } from '@expo/vector-icons';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import HomeHeader from '../../components/HomeHeader';
import MacroGrid from '../../components/MacroGrid';
import RecentEntries from '../../components/RecentEntries';
import { Entry, exportEntries, pickAndImportEntries } from '../../storage/entries';
import { colors, globalStyles } from '../../styles/global';

type Props = {
  entries: Entry[];
  onDelete: () => void;
};

export default function HomeScreen({ entries, onDelete }: Props) {
  
  const handleImport = async () => {
      await pickAndImportEntries();
      onDelete();
    };

  return (
    <ScrollView style={globalStyles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={globalStyles.header}>
        <Text style={globalStyles.title}>Orbitracker</Text>

        <TouchableOpacity style={{ marginTop:8, marginLeft:55 }} onPress={handleImport}>
          <Ionicons name='cloud-download-outline' size={26} color={colors.primary} />
        </TouchableOpacity>

        <TouchableOpacity style={{ marginTop:8, marginRight:17 }} onPress={exportEntries}>
          <Ionicons name='cloud-upload-outline' size={26} color={colors.primary} />
        </TouchableOpacity>

      </View>
      <HomeHeader/>
      <MacroGrid entries={entries}/>
      <RecentEntries entries={entries} onDelete={onDelete}/>
    </ScrollView>
  );
}