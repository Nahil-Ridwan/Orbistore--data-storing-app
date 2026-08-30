import { Ionicons } from '@expo/vector-icons';
import { Linking, Platform, TouchableOpacity } from 'react-native';
import { Entry } from '../storage_entry/typeEntry';
import { colors } from '../styles/global';

type ShareButtonProps = {
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

export default function ShareButton({ entry }: ShareButtonProps) {
  const handleReminder = async () => {
    const message = `🚨നിങ്ങളുടെ ${entry.vehicle}
വാഹനത്തിലെ GPS  ${entry.expdate} ൽ  EXPIRE ആവുന്നതാണ് / ആയതാണ്...

റീച്ചാർജ് ചെയ്യാൻ 9400250022 (zubair Purayil) എന്ന നമ്പറിലേക്ക് GPay ചെയ്യുക;

Amount: 1500/-
Period: One year`;

    const phone = String(entry.mobile).replace(/\D/g, '');

    await openWhatsAppBusiness(phone, message);
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
    <TouchableOpacity onPress={handleReminder} onLongPress={handleWarning}>
      <Ionicons name="share-outline" size={28} color={colors.primary} />
    </TouchableOpacity>
  );
}