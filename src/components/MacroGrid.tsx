import { View } from 'react-native';
import { Entry } from '../storage/entries';
import MacroCard from './MacroCard';


type MacroGridProps = {
  entries: Entry[];
};

export default function MacroGrid({ entries }: MacroGridProps) {
  const totals = entries.length;

  return (
    <View >
      <MacroCard
        label='Total Vehicles'
        value={`${totals}`}
        color='#f86307'
      />

    </View>
  );
}
