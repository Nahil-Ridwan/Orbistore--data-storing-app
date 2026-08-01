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
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
      
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    width: '100%',
    borderLeftWidth: 4,
    borderRightWidth: 4,
    marginTop:34,
  },
  label: {
    fontSize: 35,
    color: 'hsl(0, 0%, 87%)',
    fontWeight: 600,
    marginTop:-11,
    marginLeft: 17,
    marginBottom: 10
  },
  value: {
    fontSize: 50,
    fontWeight: 'bold',
    color: 'hsl(0, 0%, 96%)',
    marginTop: 4,
    marginLeft: 18
  },
});