import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  scanWifi(): Promise<Object[]>;
  connectToWifi(ssid: string, password: string): Promise<boolean>;
}

export default TurboModuleRegistry.get<Spec>(
  'WifiScanner'
) as Spec | null;
