import { Ionicons } from '@expo/vector-icons';
import { Linking, TouchableOpacity } from 'react-native';
import { Entry } from '../storage/entries';
import { colors } from '../styles/global';

type ShareButtonProps = {
  entry: Entry;
};

export default function ShareButton({ entry }: ShareButtonProps) {
  const handleShare = async () => {
    const message = `🚨നിങ്ങളുടെ ${entry.vehicle}
വാഹനത്തിലെ GPS  ${entry.expdate} ൽ  EXPIRE ആവുന്നതാണ് / ആയതാണ്...

റീച്ചാർജ് ചെയ്യാൻ 9400250022 (zubair Purayil) എന്ന നമ്പറിലേക്ക് GPay ചെയ്യുക;

Amount: 1500/-
Period: One year`;

    const phone = String(entry.mobile).replace(/\D/g, '');
    const url = `https://wa.me/91${phone}?text=${encodeURIComponent(message)}`;

    
    try {
      await Linking.openURL(url);
    } catch (err) {
      console.log(err, 'Error', 'WhatsApp is not installed.');
    }
  };
  
  return (
    <TouchableOpacity onPress={handleShare}>
      <Ionicons name='share-outline' size={28} color={colors.primary} />
    </TouchableOpacity>
  );
}