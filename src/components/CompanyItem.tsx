import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { deleteCompany } from '../storage_company/coreCrud_company';
import { Company } from '../storage_company/typeCompany';
import { colors } from '../styles/global';


export default React.memo(function CompanyItem({
  
  companyid, name, companyplace, stock, unpaid
}: Company) {
  

  const handleLongPress = () => {
    Alert.alert('Delete Entry', `Are you sure you want to delete "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { deleteCompany(companyid).catch((err) => console.error('Failed to delete entry:', err));} },
    ]);
  };




  return (
    
      <Pressable style={styles.container} onLongPress={handleLongPress}>
        <View style={styles.row}>

          <View style={styles.info}>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.place}>{companyplace}</Text>            
          </View>

         <View style={styles.numbercard}>

            <View style={styles.unpaidcard}>
              <Text style={styles.unpaidstocknum}>{unpaid}</Text>
            </View>
            <View style={styles.stockcard}>
              <Text style={styles.unpaidstocknum}>{stock}</Text>
            </View>

         </View>

        </View>
      </Pressable>
    
  );
})

const styles = StyleSheet.create({
  container: { 
    backgroundColor: colors.surface, 
    borderRadius: 15, 
    paddingTop: 16, 
    paddingBottom:9, 
    paddingHorizontal:10, 
    marginBottom: 10 
  },

  name: { 
    fontSize: 18, 
    fontWeight: '600', 
    color: colors.text 
  },

  place: { 
    fontSize: 15, 
    color: colors.textSecondary, 
    fontWeight:'600' 
  },

  row: { 
    flexDirection: 'column', 
    justifyContent: 'space-between' 
  },

  numbercard: {
    flexDirection:'row', 
    marginTop:10, 
    justifyContent:'space-between',
    backgroundColor: 'hsl(240, 20%, 32%)', 
    padding:9, 
    borderRadius:15
  },

  stockcard: { 
    backgroundColor: 'hsl(122, 39%, 34%)', 
    width:'49.3%', 
    shadowColor:'hsl(20,20%,20%)', 
    height:65, 
    borderRadius:15, 
    justifyContent:'center', 
    alignItems: 'center' 
  },

  unpaidcard: { 
    backgroundColor: 'hsl(0, 60%, 46%)', 
    width:'49.3%', 
    height:65, 
    borderRadius:15, 
    justifyContent:'center', 
    alignItems: 'center' 
  },

  unpaidstocknum: { 
    fontWeight:'600', 
    color: 'hsl(0, 0%, 100%)', 
    fontSize:25 
  },

  info: { 
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal:10,
    justifyContent: 'space-between'      
  },
});