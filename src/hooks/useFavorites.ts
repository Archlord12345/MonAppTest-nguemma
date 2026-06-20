import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@wifi_favorites';

export function useFavorites() {
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(raw => {
        if (raw) {
          const arr: string[] = JSON.parse(raw);
          setFavorites(new Set(arr));
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const toggle = useCallback(async (ssid: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(ssid)) {
        next.delete(ssid);
      } else {
        next.add(ssid);
      }
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...next])).catch(() => {});
      return next;
    });
  }, []);

  return { favorites, toggle, loaded };
}
