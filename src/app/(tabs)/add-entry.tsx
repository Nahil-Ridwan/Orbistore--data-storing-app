import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { addCompany } from '../../storage_company/coreCrud_company';
import { addEntry } from '../../storage_entry/coreCrud';
import { colors, globalStyles } from '../../styles/global';
import { formatDate, formatDateOutput, monthMap } from '../../utility/helpers';



export default function AddEntryScreen() {
  const [company, setCompany] = useState('');
  const [place, setPlace] = useState('');
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
  const [address, setAddress] = useState('');

  //for company
  const [name, setName] = useState('');
  const [companyplace, setCompanyplace] = useState('');
  const [contactperson, setContactperson] = useState('');
  const [contactnum, setContactnum] = useState('');

  const [addvehicle, setAddvehicle] = useState(true);

  const toggleCompany = () => {
    setAddvehicle(!addvehicle)
  };
  
  const handleAddVehicle = async () => {
  if ( sim.length != 13 || !imei) {
    Alert.alert('Error', 'Please enter a valid sim and imei.');
    return;
  }



  const formattedInstallDate = formatDate(installdate) || '';

  // reuse the same monthMap — no redeclaration needed
  const [dStr, mStr, yStr] = formattedInstallDate.split('-');
  const installDateObj = new Date(2000 + Number(yStr), monthMap[mStr], Number(dStr));

  const formattedExpDate = formattedInstallDate
  ? formatDateOutput(new Date(installDateObj.setFullYear(installDateObj.getFullYear() + 1)))
  : '';
  

  // rest unchanged...
    console.log('saving:', { company, place, mobile, type, lock, installdate, note, address });
    

    // Don't await this — Firestore's write promise only resolves once the
    // server confirms it, which won't happen while offline. The local
    // cache write (and your subscribeToEntries listener) already update
    // the UI instantly, so fire the write and reset the form right away
    // instead of blocking on network confirmation.
    addEntry({
      company: company || 'Nil',
      place: place || 'Nil',
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
      address: address || 'Nil',
    }).catch((err) => {
      console.error('Failed to add device:', err);
      Alert.alert('Save failed', 'Your device is saved locally and will sync once online.');
    });

    setCompany('');
    setPlace('');
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
    setAddress('');
  };

  // for company
  
  const handleAddCompany = async () => {
    if ( name.length == 0 ) {
      Alert.alert('Error', 'Please enter a valid name.');
      return;
    }
    
    // rest unchanged...
      console.log('saving company:', { name, companyplace, contactperson, contactnum});
      
      // for company
      addCompany({
        name: name || 'Nil',
        companyplace: companyplace || 'Nil',
        contactperson: contactperson || 'Nil',
        contactnum: Number(contactnum) || 0,
        stock: 0,
        unpaid: 0,
        
      }).catch((err) => {
        console.error('Failed to add company:', err);
        Alert.alert('Save failed', 'Your company is saved locally and will sync once online.');
      });
  
      setName('');
      setCompanyplace('');
      setContactperson('');
      setContactnum('');
    };

  return (
    <KeyboardAvoidingView 
    style={globalStyles.container}
    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView showsVerticalScrollIndicator={false}>
      <Animated.View>
        <Animated.Text style={globalStyles.title}
        key={addvehicle ? 'devices' : 'companies'} //  Force re-mount on change
         entering={FadeInDown.duration(200)} // flipinx stretchx
         exiting={FadeOutDown.duration(150)}
         onPress={toggleCompany}>{addvehicle ? 'Add Device': 'Add Company'}
         <Ionicons style={{ paddingLeft:30 }}size={24} color='hsl(20, 1%, 47%)' name='chevron-expand-outline'></Ionicons>
        </Animated.Text>
      </Animated.View>

      {addvehicle && (
      <View>
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

        <TextInput
          style={[styles.input, styles.rowInput]}
          placeholder='Place'
          placeholderTextColor={colors.textSecondary}
          autoCapitalize='characters'
          value={place}
          onChangeText={setPlace}
        />

      </View>

         <TouchableOpacity
            style={[styles.checkboxstyle, payment && styles.checkboxChecked]}
            onPress={() => setPayment(prev => !prev)}
          >
            <Text style={styles.checkboxLabel}>{payment? 'RECEIVED' : 'NOT PAID'}</Text>
          </TouchableOpacity>

      <View style={styles.row}>
      <TextInput
          style={[styles.input, styles.rowInput]}
          placeholder='Username'
          placeholderTextColor={colors.textSecondary}
          autoCapitalize='characters'
          value={username}
          onChangeText={setUsername}
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
          keyboardType='numeric'
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

      <TextInput
        style={[styles.input, styles.noteInput]}
        placeholder='Address'
        placeholderTextColor={colors.textSecondary}
        value={address}
        onChangeText={setAddress}
        multiline
        numberOfLines={4}
        textAlignVertical='top'
      />


      <TouchableOpacity style={styles.button} onPress={handleAddVehicle}>
        <Text style={styles.buttonText}>Add Device</Text>
      </TouchableOpacity>
      </View>
      )}

      {!addvehicle && (
        <View>
        {/*for company*/}
      
          <TextInput
            style={[styles.input, styles.rowInput]}
            placeholder='Name'
            placeholderTextColor={colors.textSecondary}
            autoCapitalize='characters'
            value={name}
            onChangeText={setName}
          />
          <TextInput
            style={[styles.input, styles.rowInput]}
            placeholder='Place'
            placeholderTextColor={colors.textSecondary}
            autoCapitalize='characters'
            value={companyplace}
            onChangeText={setCompanyplace}
          />

          <View style={styles.row}>
            <TextInput
                style={[styles.input, styles.rowInput]}
                placeholder='Contact Person'
                placeholderTextColor={colors.textSecondary}
                autoCapitalize='characters'
                value={contactperson}
                onChangeText={setContactperson}
            />
      
            <TextInput
                style={[styles.input, styles.rowInput]}
                placeholder='Mobile'
                placeholderTextColor={colors.textSecondary}
                keyboardType='numeric'
                value={contactnum}
                onChangeText={setContactnum}
            />
          </View>
  
        <TouchableOpacity style={styles.button} onPress={handleAddCompany}>
          <Text style={styles.buttonText}>Add Company</Text>
        </TouchableOpacity>
      </View>
      )}
      </ScrollView>
    </KeyboardAvoidingView>
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
    marginBottom: 95
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
