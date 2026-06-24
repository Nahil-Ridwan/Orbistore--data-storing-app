import { useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { addEntry } from '../../storage/entries';
import { colors, globalStyles } from '../../styles/global';



export default function AddEntryScreen() {
  const [company, setCompany] = useState('');
  const [device, setDevice] = useState('');
  const [username, setUsername] = useState('');
  const [mobile, setMobile] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [type, setType] = useState('');
  const [lock, setLock] = useState(false);
  const [devicemodel, setDevicemodel] = useState('');
  const [installdate, setInstalldate] = useState('');
  const [status, setStatus] = useState('');
  const [payment, setPayment] = useState(false);
  const [sim, setSim] = useState('');
  const [imei, setImei] = useState('');
  const [note, setNote] = useState('');

  const handleAddEntry = async () => {
  if (!sim || !imei) {
    Alert.alert('Error', 'Please enter a sim and imei.');
    return;
  }

  const monthMap: Record<string, number> = {
    JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
    JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
  };

  const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

  const formatDateOutput = (date: Date): string => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = MONTHS[date.getMonth()];
    const year = String(date.getFullYear()).slice(-2);
    return `${day}-${month}-${year}`;
};

  const formatDate = (val?: string): string => {
    if (!val) return '';
    const parts = val.trim().split(/[\s-]+/);
    if (parts.length === 3) {
      const [day, month, year] = parts;
      const monthIndex = isNaN(Number(month))
        ? monthMap[month.toUpperCase()]
        : Number(month) - 1;
      if (monthIndex === undefined || isNaN(monthIndex)) return val;
      const date = new Date(2000 + Number(year), monthIndex, Number(day));
      if (!isNaN(date.getTime())) {
        return formatDateOutput(date)
      }
    }
    return val;
  };


  const formattedInstallDate = formatDate(installdate) || '';

  // reuse the same monthMap — no redeclaration needed
  const [dStr, mStr, yStr] = formattedInstallDate.split('-');
  const installDateObj = new Date(2000 + Number(yStr), monthMap[mStr], Number(dStr));

  const formattedExpDate = formattedInstallDate
  ? formatDateOutput(new Date(installDateObj.setFullYear(installDateObj.getFullYear() + 1)))
  : '';
  

  // rest unchanged...
    console.log('saving:', { company, mobile, type, lock, installdate, note });

    // Don't await this — Firestore's write promise only resolves once the
    // server confirms it, which won't happen while offline. The local
    // cache write (and your subscribeToEntries listener) already update
    // the UI instantly, so fire the write and reset the form right away
    // instead of blocking on network confirmation.
    addEntry({
      company: company || 'Nil',
      device: Number(device) || 0,
      username: username || 'Nil',
      mobile: Number(mobile) || 0,
      vehicle: vehicle || 'Nil',
      type: type || 'Nil',
      lock: lock ? 'YES' : 'NO' ,
      devicemodel: devicemodel || 'V5',
      installdate: formattedInstallDate || '',
      status: status || '',
      payment: payment ? 'RECEIVED' : 'NOT PAID',
      expdate: formattedExpDate,
      sim: Number(sim),
      imei: Number(imei),
      note: note || 'Nil',
    }).catch((err) => {
      console.error('Failed to add entry:', err);
      Alert.alert('Save failed', 'Your entry is saved locally and will sync once online.');
    });

    setCompany('');
    setDevice('');
    setUsername('');
    setMobile('');
    setVehicle('');
    setType('');
    setLock(false);
    setDevicemodel('');
    setInstalldate('');
    setStatus('');
    setPayment(false);
    setSim('');
    setImei('');
    setNote('');


  };

  return (
    <View style={globalStyles.container}>
      
      <Text style={globalStyles.title}>Add Vehicle</Text>

      <View style={styles.row}>

         <TextInput
          style={[styles.input, styles.rowInput]}
          placeholder='Device'
          placeholderTextColor={colors.textSecondary}
          keyboardType='numeric'
          value={device}
          onChangeText={setDevice}
        />
         
         <TextInput
          style={[styles.input, styles.rowInput]}
          placeholder='Status'
          placeholderTextColor={colors.textSecondary}
          autoCapitalize='characters'
          value={status}
          onChangeText={setStatus}
        />

      </View>

        <View style={styles.row}>

         <TextInput
          style={[styles.input, styles.rowInput]}
          placeholder='Company'
          placeholderTextColor={colors.textSecondary}
          autoCapitalize='characters'
          value={company}
          onChangeText={setCompany}
        />
         
         <TouchableOpacity
            style={[styles.checkboxstyle, styles.rowInput, payment && styles.checkboxChecked]}
            onPress={() => setPayment(prev => !prev)}
        >
          <Text style={styles.checkboxLabel}>{payment? 'RECEIVED' : 'NOT PAID'}</Text>
        </TouchableOpacity>

      </View>

      <View style={styles.row}>
      <TextInput
          style={[styles.input, styles.rowInput]}
          placeholder='Username'
          placeholderTextColor={colors.textSecondary}
          autoCapitalize='none'
          autoCorrect= {false}
          value={username}
          onChangeText={(text) => setUsername(text.toLowerCase())}
        />

      <TextInput
          style={[styles.input, styles.rowInput]}
          placeholder='Mobile'
          placeholderTextColor={colors.textSecondary}
          keyboardType='numeric'
          value={mobile}
          onChangeText={setMobile}
        />
      </View>

      <View style={styles.row}>
        
        <TextInput
          style={[styles.input, styles.rowInput]}
          placeholder='Vehicle'
          placeholderTextColor={colors.textSecondary}
          autoCapitalize='characters'
          value={vehicle}
          onChangeText={setVehicle}
        />
        <TextInput
          style={[styles.input, styles.rowInput]}
          placeholder='Type'
          placeholderTextColor={colors.textSecondary}
          autoCapitalize='characters'
          value={type}
          onChangeText={setType}
        />
      </View>

      <View style={styles.row}>
        <TouchableOpacity
            style={[styles.checkbox, styles.rowInput]}
            onPress={() => setLock(prev => !prev)}
        >
          <Text style={styles.checkboxLabel}>{lock? 'LOCK: YES' : 'LOCK: NO'}</Text>
        </TouchableOpacity>

        <TextInput
          style={[styles.input, styles.rowInput]}
          placeholder='Device Model'
          placeholderTextColor={colors.textSecondary}
          autoCapitalize='characters'
          value={devicemodel}
          onChangeText={setDevicemodel}
        />
        
      </View>

      <TextInput
          style={styles.input}
          placeholder='Install Date'
          placeholderTextColor={colors.textSecondary}
          autoCapitalize='characters'
          value={installdate}
          onChangeText={setInstalldate}
        />

      <View style={styles.row}>
        <TextInput
          style={[styles.input, styles.rowInput]}
          placeholder='Sim'
          placeholderTextColor={colors.textSecondary}
          keyboardType='numeric'
          value={sim}
          onChangeText={setSim}
        />
        <TextInput
          style={[styles.input, styles.rowInput]}
          placeholder='IMEI'
          placeholderTextColor={colors.textSecondary}
          keyboardType='numeric'
          value={imei}
          onChangeText={setImei}
        />
      </View>

        <TextInput
        style={[styles.input, styles.noteInput]}
        placeholder='Note'
        placeholderTextColor={colors.textSecondary}
        value={note}
        onChangeText={setNote}
        multiline
        numberOfLines={4}
        textAlignVertical='top'
      />


      <TouchableOpacity style={styles.button} onPress={handleAddEntry}>
        <Text style={styles.buttonText}>Add Vehicle</Text>
      </TouchableOpacity>

    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.surface,
    color: colors.text,
    padding: 16,
    borderRadius: 10,
    fontSize: 16,
    marginTop: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  rowInput: {
    flex: 1,
  },
  button: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: 'bold',
  },
  checkboxRow: {
  flexDirection: 'row',
  alignItems: 'center',
  marginTop: 16,
  gap: 10,
},
checkbox: {
  backgroundColor: colors.surface,
    color: colors.text,
    padding: 16,
    borderRadius: 10,
    fontSize: 16,
    marginTop: 16,
},
checkboxChecked: {
  backgroundColor: '#275728',
},
checkboxLabel: {
  color: colors.textSecondary,
  fontSize: 16,
},
checkboxstyle: {
    backgroundColor: '#822828',
    color: colors.text,
    padding: 16,
    borderRadius: 10,
    fontSize: 16,
    marginTop: 16,
  },

  noteInput: {
  minHeight: 53,
  paddingTop: 15,
  textAlignVertical: 'top', // safe to also set here for RN versions where the prop above is ignored
},

});
