import React from 'react';
import { SafeAreaView, StyleSheet, Button, Text, Alert } from 'react-native';
import { NativeModules } from 'react-native';

export default function App() {
  const lancerScan = async () => {
    try {
      // Appel direct de votre module Kotlin publié sur NPM
      const reseaux = await NativeModules.WifiScanner.scanWifi();
      Alert.alert("Réseaux Wi-Fi trouvés", JSON.stringify(reseaux));
    } catch (erreur) {
      Alert.alert("Erreur", "Impossible de scanner les réseaux");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.titre}>Test de mon Module Wi-Fi</Text>
      <Button title="Lancer le Scan Wi-Fi" onPress={lancerScan} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  titre: { fontSize: 20, marginBottom: 20, fontWeight: 'bold' }
});
