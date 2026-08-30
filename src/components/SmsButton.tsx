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

const handleOnboard = async () => {
  const message = `💫💫💫
Dear customer, 

Orbitracker GPS തെരെഞ്ഞെടുത്തതിന് നന്ദി...👍👍

✅ ${entry.vehicle}
വാഹനത്തിലെ GPS  ഇപ്പോൾ SET ആണ്.


TB TRACK Android link 👇🏻 ആൻഡ്രോയിഡ്
https://play.google.com/store/apps/details?id=com.tbtrack.gps


TB TRACK iOS link 👇 ഐഫോൺ
https://apps.apple.com/us/app/tb-track-vehicle-tracking/id1249657981

🔖 User ID: ${entry.username}
🔑 PWD: 112233

For any assistance;

              Please Call or WhatsApp;
📌        9645 994 556 
               www.orbixgps.com`;

    const phone = String(entry.mobile).replace(/\D/g, '');

    await openWhatsAppBusiness(phone, message);
}  
  
  return (
    <TouchableOpacity onPress={handleCommand} onLongPress={handleOnboard}>
      <Ionicons name='chatbox-outline' size={25} color={colors.primary} />
    </TouchableOpacity>
  );
}