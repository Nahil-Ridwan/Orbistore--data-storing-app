import { StyleSheet, Text, View } from 'react-native';

type MacroCardProps = {
  label: string;
  value: string;
  color: string;
};

export default function MacroCard({
  label,
  value,
  color,
}: MacroCardProps) {
  return (
    <View style={[styles.card, { borderColor: color }]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    borderLeftWidth: 4,
    borderRightWidth: 4,
  },
  label: {
    fontSize: 18,
    color: '#a0a0b0',
  },
  value: {
    fontSize: 38,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 4,
  },
});