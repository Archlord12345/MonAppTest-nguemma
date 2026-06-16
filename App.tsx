import React, { useState } from 'react';
import { 
  SafeAreaView, 
  StyleSheet, 
  Button, 
  Text, 
  Alert, 
  PermissionsAndroid, 
  Platform,
  FlatList,
  View
} from 'react-native';
import { NativeModules } from 'react-native';

const { WifiScanner } = NativeModules;

export default function App() {
  const [listeWifi, setListeWifi] = useState<any[]>([]);
  const [chargement, setChargement] = useState(false);

  const demanderPermissionLocalisation = async () => {
    if (Platform.OS === 'android') {
      try {
        const accordee = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: "Permission d'accès à la localisation",
            message: "Cette application a besoin d'accéder à votre position pour scanner les réseaux Wi-Fi environnants.",
            buttonNeutral: "Plus tard",
            buttonNegative: "Annuler",
            buttonPositive: "Autoriser",
          }
        );
        return accordee === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true;
  };

  const lancerScan = async () => {
    setChargement(true);
    
    const aLaPermission = await demanderPermissionLocalisation();
    if (!aLaPermission) {
      Alert.alert("Permission refusée", "Impossible de scanner le Wi-Fi sans la permission de localisation.");
      setChargement(false);
      return;
    }

    try {
      if (WifiScanner && WifiScanner.scanWifi) {
        const reseaux = await WifiScanner.scanWifi();
        let donneesTraitees: any[] = [];

        if (reseaux) {
          if (typeof reseaux === 'string') {
            const texteNettoye = reseaux.trim();
            if (texteNettoye.startsWith('[') || texteNettoye.startsWith('{')) {
              donneesTraitees = JSON.parse(texteNettoye);
            } else {
              Alert.alert("Texte reçu du module", texteNettoye);
              donneesTraitees = [texteNettoye];
            }
          } else if (Array.isArray(reseaux)) {
            donneesTraitees = reseaux;
          } else {
            donneesTraitees = [reseaux];
          }
        }
        setListeWifi(donneesTraitees);
      } else {
        Alert.alert("Erreur", "Le module natif WifiScanner n'est pas détecté.");
      }
    } catch (erreur: any) {
      // ICI : On convertit l'erreur en texte brut pour lire toute la phrase qui commence par D
      const messageErreurComplet = erreur?.message || JSON.stringify(erreur) || "Erreur inconnue";
      Alert.alert("MESSAGE NATIF EXACT (Commence par D)", messageErreurComplet);
    } finally {
      setChargement(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.titre}>Scan Wi-Fi - Mon Module Natif</Text>
      <Button 
        title={chargement ? "Scan en cours..." : "Lancer le Scan Wi-Fi"} 
        onPress={lancerScan} 
        disabled={chargement}
      />
      <Text style={styles.sousTitre}>Réseaux disponibles :</Text>
      <FlatList
        data={listeWifi}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({ item }) => {
          const ssid = typeof item === 'string' ? item : (item.SSID || item.ssid || "Réseau Inconnu");
          return (
            <View style={styles.itemWifi}>
              <Text style={styles.textSsid}>{ssid}</Text>
            </View>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.vide}>Aucun réseau. Cliquez sur lancer le scan.</Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f5f5f5', marginTop: 40 },
  titre: { fontSize: 22, marginBottom: 20, fontWeight: 'bold', textAlign: 'center', color: '#333' },
  sousTitre: { fontSize: 16, marginTop: 20, marginBottom: 10, fontWeight: '600', color: '#666' },
  itemWifi: { padding: 15, backgroundColor: '#fff', marginBottom: 10, borderRadius: 8, elevation: 2 },
  textSsid: { fontSize: 16, fontWeight: 'bold', color: '#000' },
  vide: { textAlign: 'center', marginTop: 40, color: '#999', fontStyle: 'italic' }
});