import { Ionicons } from '@expo/vector-icons';
import { Linking, Platform, TouchableOpacity } from 'react-native';
import { Entry } from '../storage_entry/typeEntry';
import { colors } from '../styles/global';

type SmsButtonProps = {
  entry: Entry;
};

const openWhatsAppBusiness = async (phone: string, message: string) => {
  const encodedMessage = encodeURIComponent(message);

  if (Platform.OS === 'android') {
    // Target WhatsApp Business package explicitly
    const intentUrl = `intent://send?phone=91${phone}&text=${encodedMessage}#Intent;package=com.whatsapp.w4b;scheme=whatsapp;end`;
    try {
      await Linking.openURL(intentUrl);
    } catch (e) {
      // Fallback to wa.me if Business app isn't installed
      await Linking.openURL(`https://wa.me/91${phone}?text=${encodedMessage}`);
    }
  } else {
    // iOS doesn't support forcing a specific app this way
    await Linking.openURL(`https://wa.me/91${phone}?text=${encodedMessage}`);
  }
};

export default function SmsButton({ entry }: SmsButtonProps) {
  const handleCommand = async () => {
    const message = `Param#`;

    const phone = String(entry.sim).replace(/\D/g, '');
    //const url = `sms:${phone}?text=${encodeURIComponent(message)}`;
    const url = `smsto:${phone}?body=${encodeURIComponent(message)}`;

    
    try {
      await Linking.openURL(url);
    } catch (err) {
      console.log(err, 'Error', ' Cannot open sms ');
    }
  };

  const handleWarning = async () => {
    const message = `${entry.vehicle}
ഈ വാഹനത്തിലെ GPS  expire ആയതാണ്. ഇതുവരെ റീച്ചാർജ് ചെയ്തിട്ടില്ല.

*2 ദിവസം കൂടി കഴിഞ്ഞാൽ SIM കട്ടാവുന്നതാണ്.*

 പിന്നീട് ഇത് റീചാർജ് ചെയ്യണമെങ്കിൽ SIM മാറ്റിയിടേണ്ടി വരുന്നതാണ്.

റീച്ചാർജ് ചെയ്യാൻ :
please WhatsApp / CALL:  9645 994 556`;

    const phone = String(entry.mobile).replace(/\D/g, '');

    await openWhatsAppBusiness(phone, message);
  };
  
  return (
    <TouchableOpacity onPress={handleCommand} onLongPress={handleWarning}>
      <Ionicons name='chatbox-outline' size={25} color={colors.primary} />
    </TouchableOpacity>
  );
}