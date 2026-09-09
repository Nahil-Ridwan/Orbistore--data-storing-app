import { Linking, Platform } from 'react-native';

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

export const handleCommand = async (sim: number) => {
  const message = `Param#`;
  const phone = String(sim).replace(/\D/g, '');
  //const url = `sms:${phone}?text=${encodeURIComponent(message)}`;
  const url = `smsto:${phone}?body=${encodeURIComponent(message)}`;
  
  try {
    await Linking.openURL(url);
  } catch (err) {
    console.log(err, 'Error', ' Cannot open sms ');
  }
};


export const handleOnboard = async (vehicle: string, username: string, mobile: number) => {
const message = `💫💫💫
Dear customer, 

Orbitracker GPS തെരെഞ്ഞെടുത്തതിന് നന്ദി...👍👍

✅ ${vehicle}
വാഹനത്തിലെ GPS  ഇപ്പോൾ SET ആണ്.


TB TRACK Android link 👇🏻 ആൻഡ്രോയിഡ്
https://play.google.com/store/apps/details?id=com.tbtrack.gps


TB TRACK iOS link 👇 ഐഫോൺ
https://apps.apple.com/us/app/tb-track-vehicle-tracking/id1249657981

🔖 User ID: ${username}
🔑 PWD: 112233

For any assistance;

              Please Call or WhatsApp;
📌        9645 994 556 
               www.orbixgps.com`;

    const phone = String(mobile).replace(/\D/g, '');

    await openWhatsAppBusiness(phone, message);
}

export const handleOnboardcompany = async (vehicle: string, username: string, contactnum: number) => {
const message = `💫💫💫
Dear customer, 

Orbitracker GPS തെരെഞ്ഞെടുത്തതിന് നന്ദി...👍👍

✅ ${vehicle}
വാഹനത്തിലെ GPS  ഇപ്പോൾ SET ആണ്.


TB TRACK Android link 👇🏻 ആൻഡ്രോയിഡ്
https://play.google.com/store/apps/details?id=com.tbtrack.gps


TB TRACK iOS link 👇 ഐഫോൺ
https://apps.apple.com/us/app/tb-track-vehicle-tracking/id1249657981

🔖 User ID: ${username}
🔑 PWD: 112233

For any assistance;

              Please Call or WhatsApp;
📌        9645 994 556 
               www.orbixgps.com`;

    const phone = String(contactnum).replace(/\D/g, '');

    await openWhatsAppBusiness(phone, message);
}

export const handleContact = async (contactnum: number) => {
const message = ``;

    const phone = String(contactnum).replace(/\D/g, '');

    await openWhatsAppBusiness(phone, message);
}

export const handleReminder = async (vehicle: string, expdate: string, mobile: number) => {
    const message = `🚨നിങ്ങളുടെ ${vehicle}
വാഹനത്തിലെ GPS  ${expdate} ൽ  EXPIRE ആവുന്നതാണ് / ആയതാണ്...

റീച്ചാർജ് ചെയ്യാൻ 9400250022 (zubair Purayil) എന്ന നമ്പറിലേക്ക് GPay ചെയ്യുക;

Amount: 1500/-
Period: One year`;

    const phone = String(mobile).replace(/\D/g, '');

    await openWhatsAppBusiness(phone, message);
};

export const handleWarning = async (vehicle: string, mobile: number) => {
    const message = `${vehicle}
ഈ വാഹനത്തിലെ GPS  expire ആയതാണ്. ഇതുവരെ റീച്ചാർജ് ചെയ്തിട്ടില്ല.

*2 ദിവസം കൂടി കഴിഞ്ഞാൽ SIM കട്ടാവുന്നതാണ്.*

 പിന്നീട് ഇത് റീചാർജ് ചെയ്യണമെങ്കിൽ SIM മാറ്റിയിടേണ്ടി വരുന്നതാണ്.

റീച്ചാർജ് ചെയ്യാൻ :
please WhatsApp / CALL:  9645 994 556`;

    const phone = String(mobile).replace(/\D/g, '');

    await openWhatsAppBusiness(phone, message);
};