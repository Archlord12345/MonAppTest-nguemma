import { useState, useEffect } from 'react';
import NetInfo, { NetInfoWifiState } from '@react-native-community/netinfo';

export function useCurrentWifi() {
  const [currentSSID, setCurrentSSID] = useState<string | null>(null);
  const [isWifi, setIsWifi] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.type === 'wifi') {
        const wifi = state as NetInfoWifiState;
        setIsWifi(true);
        setCurrentSSID(wifi.details?.ssid ?? null);
      } else {
        setIsWifi(false);
        setCurrentSSID(null);
      }
    });

    return () => unsubscribe();
  }, []);

  return { currentSSID, isWifi };
}
