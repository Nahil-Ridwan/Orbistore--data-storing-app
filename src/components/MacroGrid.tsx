import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';
import { Entry } from '../storage_entry/typeEntry';
import { colors } from '../styles/global';
import MacroCard from './MacroCard';


type MacroGridProps = {
  entries: Entry[];
  onPress: ()=> void;
};

export default function MacroGrid({ entries, onPress }: MacroGridProps) {
  const today = new Date();
  const dayNumber = today.getDate(); // e.g., 29
  const monthName = today.toLocaleString('default', { month: 'long' }); // e.g., "July"

  return (
    <TouchableOpacity onPress={onPress}>
      <MacroCard
        label={monthName.toUpperCase()}
        value={`${dayNumber}`}
        color='#f86307'
      />
      <Ionicons style={{
      position: 'absolute',
      right: 35,
      top: 75,
      }} name= 'search-outline' size={32} color={colors.primary} />

    </TouchableOpacity>
  );
}
