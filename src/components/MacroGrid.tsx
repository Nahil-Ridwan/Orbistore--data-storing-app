import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';
import { Entry } from '../storage/entries';
import { colors } from '../styles/global';
import MacroCard from './MacroCard';


type MacroGridProps = {
  entries: Entry[];
  onPress: ()=> void;
};

export default function MacroGrid({ entries, onPress }: MacroGridProps) {
  const totals = entries.length;

  return (
    <TouchableOpacity onPress={onPress}>
      <MacroCard
        label='Total Vehicles'
        value={`${totals}`}
        color='#f86307'
      />
      <Ionicons style={{
      position: 'absolute',
      right: 30,
      top: 41,
      }} name= 'search-outline' size={32} color={colors.primary} />

    </TouchableOpacity>
  );
}
