import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import { useEffect, useRef, useState } from 'react';
import { Animated, Text } from 'react-native';

export default function NetworkToast() {
  const [toast, setToast] = useState<{ message: string; online: boolean; icon: keyof typeof Ionicons.glyphMap } | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (online: boolean) => {
    setToast({
      message: online ? 'Online, syncing...' : 'Offline, not synced',
      online,
      icon: online ? 'sync-outline' : 'remove-circle-outline',
    });

    if (hideTimer.current) clearTimeout(hideTimer.current);

    Animated.timing(toastOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();

    hideTimer.current = setTimeout(() => {
      Animated.timing(toastOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => setToast(null));
    }, 2500);
  };

  useEffect(() => {
    // Show a toast for the current state as soon as the screen mounts.
    NetInfo.fetch().then((state) => {
      showToast(!!state.isConnected);
    });

    // Then keep showing one any time connectivity flips, so a device that
    // goes offline mid-session (or comes back online) gets the same cue.
    const unsubscribe = NetInfo.addEventListener((state) => {
      showToast(!!state.isConnected);
    });

    return () => {
      unsubscribe();
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  if (!toast) return null;

  return (
    <Animated.View
      pointerEvents='none'
      style={{
        position: 'absolute',
        top: 50,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: toast.online ? '#1e3a2a' : '#3a1e1e',
        borderColor: toast.online ? '#4caf50' : '#ff4d4d',
        borderWidth: 1,
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        opacity: toastOpacity,
      }}
    >
      <Ionicons name={toast.icon} size={16} color={toast.online ? '#4caf50' : '#ff4d4d'} />
      <Text style={{ color: toast.online ? '#4caf50' : '#ff4d4d', fontSize: 13, fontWeight: '600' }}>
        {toast.message}
      </Text>
    </Animated.View>
  );
}
