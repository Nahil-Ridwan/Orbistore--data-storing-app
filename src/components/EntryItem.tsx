import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import React, { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { deleteEntry, updateEntry } from '../storage/coreCrud';
import { Entry } from '../storage/typeEntry';
import { colors } from '../styles/global';
import { formatDate, isExpired, syncStatuses } from '../utils/helpers';
import ShareButton from './ShareButton';
import SmsButton from './SmsButton';


export default React.memo(function EntryItem({
  
  id, company, place, device, username, mobile, vehicle, type, lock, devicemodel, installdate, expdate, validity, deviceage, shipnum, status, payment, sim, imei, note, address, renewal1, renewal2, renewal3, renewal4, renewal5, createdAt,
}: Entry) {
  const [modalVisible, setModalVisible] = useState(false);
  const [edited, setEdited] = useState<Entry>({ id, company, place, device, username, mobile, vehicle, type, lock, devicemodel, installdate, expdate, validity, deviceage, shipnum, status, payment, sim, imei, note, address, renewal1, renewal2, renewal3, renewal4, renewal5, createdAt });
  const [editingField, setEditingField] = useState<keyof Entry | null>(null);
  
  useEffect(() => {
  setEdited({ id, company, place, device, username, mobile, vehicle, type, lock, devicemodel, installdate, expdate, validity, deviceage, shipnum, status, payment, sim, imei, note, address, renewal1, renewal2, renewal3, renewal4, renewal5, createdAt });
}, [id, company, place, device, username, mobile, vehicle, type, lock, devicemodel, installdate, expdate, validity, deviceage, shipnum, status, payment, sim, imei, note, address, renewal1, renewal2, renewal3, renewal4, renewal5, createdAt]);
  const entry: Entry = { id, company, place, device, username, mobile, vehicle, type, lock, devicemodel, installdate, expdate, validity, deviceage, shipnum, status, payment, sim, imei, note, address, renewal1, renewal2, renewal3, renewal4, renewal5, createdAt };

  const handleLongPress = () => {
    Alert.alert('Delete Entry', `Are you sure you want to delete "${vehicle}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { deleteEntry(id).catch((err) => console.error('Failed to delete entry:', err));} },
    ]);
  };

  const handleSave = async () => {


  const updatedEntry = {
    ...edited,
    renewal1: formatDate(edited.renewal1),
    renewal2: formatDate(edited.renewal2),
    renewal3: formatDate(edited.renewal3),
    renewal4: formatDate(edited.renewal4),
    renewal5: formatDate(edited.renewal5),
  };

    setModalVisible(false);
setEditingField(null);
   
    try {
    await updateEntry(updatedEntry);
    await syncStatuses();
  } catch (err) {
    console.error('Failed to save entry:', err);
    Alert.alert('Save failed', 'Your change is saved locally and will sync once online.');
  }
};


  const displayStatus = (() => {
  if (!expdate) return status;
  else if (isExpired(expdate) && status?.toLowerCase().trim() == 'active') return 'EXPIRED';
  else if (!isExpired(expdate) && status?.toLowerCase().trim() == 'expired') return 'ACTIVE'
  else return status;
})();


  return (
    <>
      <TouchableOpacity style={styles.container} onLongPress={handleLongPress} onPress={() => setModalVisible(true)}>
        <View style={styles.row}>
          <View style={styles.info}>
            <Text style={styles.name}>{vehicle}   <Text style={{ fontSize:15, color: isExpired(expdate)? '#ff4d4d' : '#4caf50' }}>{validity}</Text></Text>
            <Text style={styles.macros}><Text style={{fontWeight:'600', color:'#bfbfd2'}}>{device}</Text> • <Text style={{fontWeight:'600', color:'#bfbfd2'}}>{company}</Text></Text>
            <Text style={styles.macros}><Text style={{ fontSize:14, fontWeight:'600', color:colors.text }}>{username}</Text> • <Text style={{ color: isExpired(expdate)? '#ff4d4d' : '#4caf50' }}>{expdate}</Text></Text>
          </View>
          <View style={styles.actions}>
           <Text numberOfLines={1} style={{ fontSize:15, fontWeight:600, marginBottom:6, color: 
              displayStatus?.toLowerCase().trim()==='active' && payment?.toLowerCase().trim()==='received' ? '#4caf50' 
            : displayStatus?.toLowerCase().trim()==='active' && payment?.toLowerCase().trim()!=='received' ? '#ff4d4d' 
            : displayStatus?.toLowerCase().trim()==='expired' ? '#daca3c' 
            : displayStatus?.toLowerCase().trim()==='deleted' ? '#cd66ef' 
            : '#a0a0b0'}}>
            {displayStatus}</Text>
           <View style={styles.actionButtons}>
             <View style={{  marginTop:7 }}><SmsButton entry={entry} /></View>
             <View style={{  marginBottom:4 }}><ShareButton entry={entry} /></View>
           </View>
         </View>
        </View>
      </TouchableOpacity>
      <Modal visible={modalVisible} animationType='slide' transparent>
        <KeyboardAvoidingView
    style={{ flex: 1 }}
    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
  >
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <View style={{flexDirection:'row', alignContent:'center', justifyContent:'space-between'}}>
              <Text style={styles.modalTitle}>Vehicle Details</Text>
              <Ionicons style={{ marginRight:4 }} onPress={() => {setModalVisible(false);setEditingField(null);}} name= 'close-outline' size={27} color={colors.primary} />
            </View>
            
            <ScrollView showsVerticalScrollIndicator = {false}>
              {(() => {
                const rows: [string, keyof Entry][][] = [
                  [['Device', 'device'], ['Status', 'status']],
                  [['Company', 'company'], ['Place', 'place']],
                  [['Payment', 'payment']],
                  [['Username', 'username'], ['Mobile', 'mobile']],
                  [['Vehicle', 'vehicle'], ['Type', 'type']],
                  [['Lock', 'lock'], ['Device Model', 'devicemodel']],
                  [['Install Date', 'installdate']],
                  [['Exp Date', 'expdate'], ['Validity', 'validity']],
                  [['SIM', 'sim'],['IMEI', 'imei']],
                  [['Shipment Number', 'shipnum'],['Device Age', 'deviceage']],
                  [['Note', 'note']],
                  [['Renewal - 1', 'renewal1'], ['Renewal - 2', 'renewal2']],
                  [['Renewal - 3', 'renewal3'], ['Renewal - 4', 'renewal4']],
                  [['Renewal - 5', 'renewal5']],
                  [['Address', 'address']],
                ];

                return rows.map((pair, idx) => (
                  <View key={idx} style={styles.fieldRow}>
                    {pair.map(([label, key]) => (
                      <View key={key} style={[styles.field, styles.fieldHalf]}>
                        <Text style={styles.label}>{label}</Text>
                        {key === 'payment' ? (
                          <TouchableOpacity
                            style={[
                              styles.checkboxstyle,
                              edited.payment === 'RECEIVED' && styles.checkboxChecked,
                            ]}
                            onPress={() =>
                              Alert.alert(
                                'Change Payment Status',
                                `Mark as ${edited.payment === 'RECEIVED' ? 'NOT PAID' : 'RECEIVED'}?`,
                                [
                                  { text: 'Cancel', style: 'cancel' },
                                  {
                                    text: 'Confirm',
                                    onPress: () =>
                                      setEdited(prev => ({
                                        ...prev,
                                        payment: prev.payment === 'RECEIVED' ? 'NOT PAID' : 'RECEIVED',
                                      })),
                                  },
                                ]
                              )
                            }
                          >
                            <Text style={styles.checkboxLabel}>
                              {edited.payment === 'RECEIVED' ? 'RECEIVED' : 'NOT PAID'}
                            </Text>
                          </TouchableOpacity>
                        ) : editingField === key ? (
                          <TextInput
                            style={[
                              styles.fieldInput,
                              ['username', 'status', 'mobile', 'vehicle', 'installdate', 'note'].includes(key) &&
                                styles.highlightField,
                              key === 'note' && styles.noteInput,
                              key === 'address' && styles.addressInput,
                            ]}
                            value={String(edited[key] ?? '')}
                            autoFocus
                            autoCapitalize={['note', 'address'].includes(key) ? 'sentences' : 'characters'}
                            multiline={['note', 'address'].includes(key)}
                            textAlignVertical={['note', 'address'].includes(key) ? 'top' : 'center'}
                            numberOfLines={5}
                            onChangeText={(val) =>
                              setEdited(prev => ({
                                ...prev,
                                [key]: val,
                              }))
                            }
                            onBlur={() => setEditingField(null)}
                            onSubmitEditing={() => setEditingField(null)}
                            placeholderTextColor={colors.textSecondary}
                          />
                        ) : (
                          <TouchableOpacity
                            style={[
                              styles.fieldInput,
                              styles.fieldDisplay,
                              ['username', 'status', 'mobile', 'vehicle', 'installdate', 'note'].includes(key) &&
                                styles.highlightField,
                              key === 'note' && styles.noteInput,
                              key === 'address' && styles.addressInput,
                            ]}
                            activeOpacity={0.7}
                            onPress={() => setEditingField(key)}
                            onLongPress={async () => {
                              const val = String(edited[key] ?? '');
                              await Clipboard.setStringAsync(val);
                            }}
                          >
                            <Text
                              style={styles.fieldDisplayText}
                              numberOfLines={['note', 'address'].includes(key) ? undefined : 1}
                              
                            >
                              {String(edited[key] ?? '') || ' '}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    ))}
                  </View>
                ));
              })()}
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                <Text style={styles.saveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
       </KeyboardAvoidingView>
      </Modal>
   
    </>
  );
})

const styles = StyleSheet.create({
  container: { backgroundColor: colors.surface, borderRadius: 10, padding: 16, marginBottom: 10 },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  macros: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  info: { flex: 1 },
  actions: {
  alignItems: 'center',
  gap: 4,
  width:82,
},
actionButtons: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 14,
},
fieldRow: {
  flexDirection: 'row',
  gap: 10,
},
fieldHalf: {
  flex: 1,
},

checkboxChecked: {
  backgroundColor: '#275728',
},
checkboxLabel: {
  color: colors.text,
  fontSize: 15,
},
checkboxstyle: {
    backgroundColor: '#822828',
    color: colors.text,
    padding: 10,
    borderRadius: 8,
    height:40,
  },
  noteInput: {
  
  paddingTop: 10,
  paddingBottom: 10,
  textAlignVertical: 'top', // safe to also set here for RN versions where the prop above is ignored
  borderWidth:3,
  borderColor:'#7a7ab4'
},

addressInput: {
  
  paddingTop: 13,
  paddingBottom: 10,
  minHeight:46,
  textAlignVertical: 'top', // safe to also set here for RN versions where the prop above is ignored
},

highlightField: {
  backgroundColor: colors.background,
},

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
  modal: { backgroundColor: colors.surface, borderRadius: 16, padding: 20, maxHeight: '85%' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 16 },
  field: { marginBottom: 12 },
  label: { fontSize: 12, color: colors.textSecondary, marginBottom: 4 },
  fieldInput: { backgroundColor: '#3e3e5c', color: colors.text, paddingVertical: 10, paddingLeft: 10, borderRadius: 8, fontSize: 15 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelButton: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center', backgroundColor: colors.background },
  cancelText: { color: colors.textSecondary, fontWeight: '600' },
  saveButton: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center', backgroundColor: colors.primary },
  saveText: { color: colors.background, fontWeight: '600' },
  fieldDisplay: {
  justifyContent: 'center',
},
fieldDisplayText: {
  color: colors.text,
  fontSize: 15,
},
});