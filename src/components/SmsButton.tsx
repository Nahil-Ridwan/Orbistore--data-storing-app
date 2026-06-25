import { Ionicons } from '@expo/vector-icons';
import { Linking, TouchableOpacity } from 'react-native';
import { Entry } from '../storage/typeEntry';
import { colors } from '../styles/global';

type SmsButtonProps = {
  entry: Entry;
};

export default function SmsButton({ entry }: SmsButtonProps) {
  const handleShare = async () => {
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
  
  return (
    <TouchableOpacity onPress={handleShare}>
      <Ionicons name='chatbox-outline' size={25} color={colors.primary} />
    </TouchableOpacity>
  );
}