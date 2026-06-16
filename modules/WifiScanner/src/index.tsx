import WifiScanner from './NativeWifiScanner';

export function scanWifi(): Promise<any[]> {
  return WifiScanner?.scanWifi() ?? Promise.resolve([]);
}

export function connectToWifi(ssid: string, password: string): Promise<boolean> {
  return WifiScanner?.connectToWifi(ssid, password) ?? Promise.resolve(false);
}

export { multiply } from './multiply';
