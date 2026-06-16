import React, { useState } from 'react';
import { 
  SafeAreaView, 
  StyleSheet, 
  Text, 
  Alert, 
  PermissionsAndroid, 
  Platform,
  FlatList,
  View,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator
} from 'react-native';
import { NativeModules } from 'react-native';

const { WifiScanner } = NativeModules;

export default function App() {
  const [listeWifi, setListeWifi] = useState<any[]>([]);
  const [chargement, setChargement] = useState(false);
  const [selectedSSID, setSelectedSSID] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [connecting, setConnecting] = useState(false);

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
        setListeWifi(reseaux || []);
      } else {
        Alert.alert("Erreur", "Le module natif WifiScanner n'est pas détecté.");
      }
    } catch (erreur: any) {
      Alert.alert("Erreur de scan", erreur?.message || "Erreur inconnue");
    } finally {
      setChargement(false);
    }
  };

  const handleConnect = async () => {
    if (!selectedSSID) return;

    setConnecting(true);
    try {
      const success = await WifiScanner.connectToWifi(selectedSSID, password);
      if (success) {
        Alert.alert("Succès", `Connecté à ${selectedSSID}`);
        setModalVisible(false);
        setPassword('');
      } else {
        Alert.alert("Échec", `Impossible de se connecter à ${selectedSSID}`);
      }
    } catch (error: any) {
      Alert.alert("Erreur de connexion", error?.message || "Erreur inconnue");
    } finally {
      setConnecting(false);
    }
  };

  const openConnectModal = (ssid: string) => {
    setSelectedSSID(ssid);
    setModalVisible(true);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.titre}>Scan Wi-Fi</Text>
        <TouchableOpacity
          style={[styles.button, chargement && styles.buttonDisabled]}
          onPress={lancerScan}
          disabled={chargement}
        >
          {chargement ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Lancer le Scan</Text>
          )}
        </TouchableOpacity>
      </View>

      <Text style={styles.sousTitre}>Réseaux disponibles :</Text>
      <FlatList
        data={listeWifi}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({ item }) => {
          const ssid = typeof item === 'string' ? item : (item.SSID || item.ssid || "Réseau Inconnu");
          return (
            <TouchableOpacity style={styles.itemWifi} onPress={() => openConnectModal(ssid)}>
              <View style={styles.wifiInfo}>
                <Text style={styles.textSsid}>{ssid}</Text>
                <Text style={styles.textConnect}>Appuyer pour se connecter</Text>
              </View>
              <View style={styles.chevron} />
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.vide}>Aucun réseau. Cliquez sur lancer le scan.</Text>
        }
      />

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Connexion à {selectedSSID}</Text>
            <TextInput
              style={styles.input}
              placeholder="Mot de passe"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.connectButton, connecting && styles.buttonDisabled]}
                onPress={handleConnect}
                disabled={connecting}
              >
                {connecting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.connectButtonText}>Se connecter</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 40 : 0
  },
  header: {
    paddingVertical: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#BBDEFB',
  },
  titre: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1565C0',
    marginBottom: 15
  },
  button: {
    backgroundColor: '#1976D2',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
    elevation: 3,
    minWidth: 150,
    alignItems: 'center'
  },
  buttonDisabled: {
    backgroundColor: '#90CAF9',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600'
  },
  sousTitre: {
    fontSize: 18,
    marginTop: 25,
    marginBottom: 15,
    fontWeight: '600',
    color: '#0D47A1'
  },
  itemWifi: {
    padding: 18,
    backgroundColor: '#fff',
    marginBottom: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  wifiInfo: {
    flex: 1,
  },
  textSsid: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#1A237E'
  },
  textConnect: {
    fontSize: 12,
    color: '#1976D2',
    marginTop: 4
  },
  chevron: {
    width: 10,
    height: 10,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderColor: '#90CAF9',
    transform: [{ rotate: '45deg' }]
  },
  vide: {
    textAlign: 'center',
    marginTop: 50,
    color: '#546E7A',
    fontStyle: 'italic',
    fontSize: 16
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalContent: {
    backgroundColor: '#fff',
    width: '100%',
    borderRadius: 20,
    padding: 25,
    elevation: 10
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1565C0',
    marginBottom: 20,
    textAlign: 'center'
  },
  input: {
    borderWidth: 1,
    borderColor: '#BBDEFB',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
    color: '#0D47A1'
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  modalButton: {
    flex: 0.48,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center'
  },
  cancelButton: {
    backgroundColor: '#ECEFF1'
  },
  cancelButtonText: {
    color: '#546E7A',
    fontWeight: '600'
  },
  connectButton: {
    backgroundColor: '#1976D2'
  },
  connectButtonText: {
    color: '#fff',
    fontWeight: '600'
  }
});