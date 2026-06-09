# React Native Wifi Scanner Module

Ce projet contient un module natif écrit en **Kotlin** pour React Native permettant de scanner les réseaux Wi-Fi environnants, publié sur le registre NPM.

---

## 🚀 Installation

Pour installer et utiliser ce module dans votre propre projet React Native, exécutez la commande suivante dans votre terminal :

```bash
npm install react-native-wifi-scanner-nguema
```

---

## ⚙️ Configuration Requise (Android)

Pour que le scan Wi-Fi fonctionne sur Android, vous devez activer les permissions nécessaires et le GPS.

### 1. Permissions Android
Vérifiez que les lignes suivantes sont présentes dans votre fichier `android/src/main/AndroidManifest.xml` :

```xml
<uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />
<uses-permission android:name="android.permission.CHANGE_WIFI_STATE" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
```

### 2. Activation du GPS
> ⚠️ **Important** : Android exige obligatoirement que la **localisation (GPS)** soit activée sur l'appareil pour autoriser le scan des réseaux Wi-Fi. Pensez également à accorder la permission de position à l'application dans les paramètres du téléphone.

---

## 💻 Utilisation

Voici comment importer et appeler le module dans votre composant React Native :

```javascript
import React from 'react';
import { SafeAreaView, Button, Text, Alert, StyleSheet } from 'react-native';
import { NativeModules } from 'react-native';

export default function App() {
  
  const lancerScan = async () => {
    try {
      // Appel de la méthode native Kotlin
      const reseaux = await NativeModules.WifiScanner.scanWifi();
      Alert.alert("Réseaux Wi-Fi trouvés", JSON.stringify(reseaux));
    } catch (erreur) {
      Alert.alert("Erreur", "Impossible de scanner les réseaux");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.titre}>Test du Module Wi-Fi</Text>
      <Button title="Lancer le Scan Wi-Fi" onPress={lancerScan} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  titre: { fontSize: 20, marginBottom: 20, fontWeight: 'bold' }
});
```
