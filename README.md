# 📡 Wi-Fi Scanner — Application React Native

Application mobile **Android** de scan et de connexion aux réseaux Wi-Fi, développée avec **React Native 0.85** (nouvelle architecture) et un module natif **Kotlin** personnalisé.

---

## 🗂️ Table des matières

1. [Aperçu du projet](#-aperçu-du-projet)
2. [Architecture du projet](#-architecture-du-projet)
3. [Prérequis](#-prérequis)
4. [Installation & lancement](#-installation--lancement)
5. [Résolution de problèmes de build](#-résolution-de-problèmes-de-build)
6. [Module natif WifiScanner](#-module-natif-wifiscanner)
7. [Hooks React personnalisés](#-hooks-react-personnalisés)
8. [Composant principal App.tsx](#-composant-principal-apptsx)
9. [Fonctionnalités de l'app](#-fonctionnalités-de-lapp)
10. [Permissions Android](#-permissions-android)
11. [Contribuer](#-contribuer)
12. [📄 Documentation technique complète](docs/NATIVE_MODULE.md)

---

## 🔭 Aperçu du projet

| Propriété | Valeur |
|---|---|
| Nom de l'app | **Wi-Fi Scanner** |
| Framework | React Native 0.85.3 |
| Architecture | **Nouvelle Architecture** (TurboModules + JSI) |
| Module natif | Kotlin (Android) |
| NDK requis | `27.1.12297006` |
| Min SDK Android | 24 (Android 7.0) |
| Target SDK | 36 |

---

## 🗄️ Architecture du projet

```
MonAppTest-nguemma/
│
├── App.tsx                          ← Composant racine (toute l'UI)
├── index.js                         ← Point d'entrée React Native
├── package.json                     ← Dépendances et scripts npm
│
├── src/
│   └── hooks/
│       ├── useFavorites.ts          ← Hook : gestion des réseaux favoris (AsyncStorage)
│       └── useCurrentWifi.ts        ← Hook : détection du réseau Wi-Fi actif (NetInfo)
│
├── modules/
│   └── WifiScanner/                 ← Module natif local (publié sur npm)
│       ├── package.json
│       ├── src/
│       │   ├── NativeWifiScanner.ts ← Spécification TurboModule (interface JS ↔ natif)
│       │   └── index.tsx            ← API publique exportée du module
│       └── android/
│           ├── build.gradle         ← Config Gradle du module
│           └── src/main/java/com/wifiscanner/
│               └── WifiScannerModule.kt ← Implémentation native Kotlin
│
└── android/
    ├── build.gradle                 ← Config Gradle racine (NDK, SDK versions)
    ├── gradle.properties            ← Flags : newArchEnabled, hermesEnabled…
    └── app/
        ├── build.gradle             ← Config Gradle de l'app
        └── src/main/
            ├── AndroidManifest.xml  ← Permissions + config application
            └── res/
                ├── mipmap-*/        ← Icônes de l'app (5 densités)
                └── values/
                    └── strings.xml  ← Nom de l'application
```

---

## 🛠️ Prérequis

Avant de commencer, vérifiez que ces outils sont installés :

| Outil | Version recommandée | Vérification |
|---|---|---|
| Node.js | ≥ 22.11.0 | `node --version` |
| npm | ≥ 10 | `npm --version` |
| Java (JDK) | 21 | `java --version` |
| Android SDK | API 36 | Android Studio SDK Manager |
| NDK | **27.1.12297006** | Android Studio SDK Manager → NDK |
| CMake | 3.22.1 | Android Studio SDK Manager |

> [!IMPORTANT]
> Le NDK **27.1.12297006** est obligatoire. Les versions 26.x manquent `std::format` (utilisé par RN 0.85) et les versions 28+ peuvent avoir d'autres incompatibilités.

---

## 🚀 Installation & lancement

### 1. Cloner et installer les dépendances

```bash
git clone <url-du-repo>
cd MonAppTest-nguemma
npm install
```

> Le script `postinstall` applique automatiquement le patch NDK de `react-native-safe-area-context` via `patch-package`.

### 2. Connecter un appareil Android

- Activez le **mode développeur** sur votre téléphone
- Activez le **débogage USB**
- Connectez via USB et vérifiez avec :

```bash
adb devices
```

### 3. Lancer l'application

```bash
npm run android
```

---

## 🔧 Résolution de problèmes de build

### Erreur : `undefined symbol: std::__ndk1::basic_string` (NDK 27)

**Cause** : NDK 27 exige un lien explicite vers `libc++_shared.so` que certains modules natifs ne font pas.

**Fix appliqué** : Le fichier `node_modules/react-native-safe-area-context/android/src/main/jni/CMakeLists.txt` est patché via `patch-package` pour ajouter `c++_shared` dans `target_link_libraries`.

Pour le module WifiScanner, un hook Gradle dans `modules/WifiScanner/android/build.gradle` patche automatiquement le `CMakeLists.txt` généré par le codegen après chaque build.

### Erreur : `no member named 'format' in namespace 'std'` (NDK 26)

**Cause** : NDK 26 n'implémente pas `std::format` (C++20), utilisé par React Native 0.85.

**Fix** : Utiliser NDK **27.1.12297006** (défini dans `android/build.gradle`).

### Commandes de nettoyage

```bash
# Nettoyage complet Gradle + CMake
cd android && ./gradlew clean
Remove-Item -Recurse -Force app\.cxx   # PowerShell (Windows)
```

---

## 📦 Module natif WifiScanner

**Emplacement** : [`modules/WifiScanner/`](modules/WifiScanner/)

Ce module est un **TurboModule** React Native (nouvelle architecture) écrit en Kotlin. Il expose deux fonctions au JavaScript.

### Fichiers clés

#### `src/NativeWifiScanner.ts` — Spécification du module

Définit l'interface TypeScript que doit implémenter le côté natif. C'est le "contrat" entre JS et Kotlin.

```typescript
export interface Spec extends TurboModule {
  scanWifi(): Promise<Object[]>;
  connectToWifi(ssid: string, password: string): Promise<boolean>;
}
```

#### `src/index.tsx` — API publique

Point d'entrée du module. Exporte les fonctions utilisées dans l'app.

```typescript
// Scanner les réseaux disponibles
export function scanWifi(): Promise<any[]>

// Se connecter à un réseau
export function connectToWifi(ssid: string, password: string): Promise<boolean>
```

#### `android/src/main/java/com/wifiscanner/WifiScannerModule.kt` — Implémentation Kotlin

##### `scanWifi(promise: Promise)`

Lance un scan Wi-Fi asynchrone via l'API Android.

**Mécanisme** :
1. Obtient le `WifiManager` système
2. Enregistre un `BroadcastReceiver` qui écoute `SCAN_RESULTS_AVAILABLE_ACTION`
3. Appelle `wifiManager.startScan()`
4. Quand les résultats arrivent, construit un tableau de maps et résout la Promise
5. Si `startScan()` retourne `false`, retourne directement les derniers résultats en cache

**Données retournées par réseau** :

| Champ | Type | Description |
|---|---|---|
| `SSID` | `string` | Nom du réseau |
| `BSSID` | `string` | Adresse MAC du point d'accès |
| `level` | `number` | Force du signal en dBm (ex: -65) |
| `frequency` | `number` | Fréquence en MHz (ex: 2437 ou 5180) |
| `capabilities` | `string` | Chaîne brute de sécurité (ex: `[WPA2-PSK-CCMP]`) |
| `security` | `string` | Type simplifié : `"WPA3"`, `"WPA2"`, `"WPA"`, `"WEP"`, `"Open"` |

**Erreurs possibles** :

| Code | Description |
|---|---|
| `PERMISSION_DENIED` | Permission de localisation non accordée |

##### `connectToWifi(ssid, password, promise)`

Tente de se connecter à un réseau Wi-Fi (Android 10+ uniquement).

**Mécanisme** :
1. Construit un `WifiNetworkSpecifier` avec le SSID et le mot de passe WPA2
2. Crée une `NetworkRequest` pour ce réseau spécifique
3. Utilise `ConnectivityManager.requestNetwork()` avec un callback
4. `onAvailable()` → résout la Promise avec `true` et lie le processus à ce réseau
5. `onUnavailable()` → résout avec `false` (mauvais mot de passe ou réseau hors portée)

**Erreurs possibles** :

| Code | Description |
|---|---|
| `UNSUPPORTED` | Android < 10 (API 29) non supporté |
| `CONNECT_ERROR` | Exception inattendue |

---

## 🪝 Hooks React personnalisés

**Emplacement** : [`src/hooks/`](src/hooks/)

### `useFavorites.ts`

Gère la liste des réseaux Wi-Fi marqués comme favoris, avec persistance locale.

```typescript
const { favorites, toggle, loaded } = useFavorites();
```

| Valeur | Type | Description |
|---|---|---|
| `favorites` | `Set<string>` | Ensemble des SSID favoris |
| `toggle(ssid)` | `function` | Ajoute ou retire un SSID des favoris |
| `loaded` | `boolean` | `true` une fois AsyncStorage lu au démarrage |

**Fonctionnement** :
- Au montage : lit `@wifi_favorites` depuis `AsyncStorage` et reconstruit le `Set`
- À chaque `toggle()` : met à jour le `Set` en mémoire **et** persiste dans `AsyncStorage`
- Utilise `useCallback` pour éviter les re-renders inutiles

**Clé de stockage** : `@wifi_favorites` (tableau JSON de strings)

---

### `useCurrentWifi.ts`

Détecte en temps réel le réseau Wi-Fi auquel l'appareil est connecté.

```typescript
const { currentSSID, isWifi } = useCurrentWifi();
```

| Valeur | Type | Description |
|---|---|---|
| `currentSSID` | `string \| null` | SSID du réseau actif, ou `null` |
| `isWifi` | `boolean` | `true` si connecté en Wi-Fi |

**Fonctionnement** :
- S'abonne à `NetInfo.addEventListener` au montage
- Se désabonne au démontage (cleanup automatique)
- Met à jour `currentSSID` à chaque changement de connectivité

---

## 🖥️ Composant principal App.tsx

**Emplacement** : [`App.tsx`](App.tsx)

Composant racine unique qui contient toute l'interface utilisateur.

### Fonctions principales

#### `scan()`

Lance le scan Wi-Fi complet.

```
1. Demande les permissions Android (ACCESS_FINE_LOCATION + NEARBY_WIFI_DEVICES)
2. Appelle scanWifi() du module natif
3. Trie les résultats du meilleur au pire signal
4. Met à jour l'état et l'heure du dernier scan
```

#### `openModal(item)` / `closeModal()`

Ouvre/ferme le bottom-sheet de connexion avec une animation Spring/Timing.

#### `handleConnect()`

Appelle `connectToWifi()` avec le SSID sélectionné et le mot de passe saisi.

### Fonctions utilitaires (hors composant)

| Fonction | Paramètre | Retour | Description |
|---|---|---|---|
| `signalBars(level)` | `number` (dBm) | `0–4` | Nombre de barres de signal |
| `signalColor(level)` | `number` (dBm) | `string` (hex) | Couleur selon la force du signal |
| `signalLabel(level)` | `number` (dBm) | `string` | Label : "Excellent", "Bon", "Moyen"… |
| `bandLabel(freq)` | `number` (MHz) | `string` | "5 GHz" si freq ≥ 5000, sinon "2.4 GHz" |
| `securityColor(sec)` | `string` | `string` (hex) | Couleur du badge de sécurité |

### Sous-composants

| Composant | Props | Rôle |
|---|---|---|
| `SignalIcon` | `level`, `size` | 4 barres verticales colorées selon le signal |
| `WifiCard` | `item`, `onPress`, `onFavorite`, `isFavorite`, `isConnected`, `index` | Carte d'un réseau avec animation d'entrée |
| `SectionHeader` | `title`, `count` | En-tête de section (2.4 GHz / 5 GHz) |
| `ScanButton` | `onPress`, `loading` | Bouton scanner avec animation pulse |

### État React (useState)

| Variable | Type | Description |
|---|---|---|
| `networks` | `WifiItem[]` | Liste complète des réseaux scannés |
| `loading` | `boolean` | Scan en cours |
| `query` | `string` | Texte de la barre de recherche |
| `tab` | `'all' \| 'favorites'` | Onglet actif |
| `lastScan` | `Date \| null` | Heure du dernier scan |
| `selectedNetwork` | `WifiItem \| null` | Réseau sélectionné pour connexion |
| `password` | `string` | Mot de passe saisi dans le modal |
| `connecting` | `boolean` | Connexion en cours |
| `modalVisible` | `boolean` | Visibilité du bottom-sheet |

---

## ✨ Fonctionnalités de l'app

| Fonctionnalité | Description |
|---|---|
| 📡 **Scan Wi-Fi** | Détecte tous les réseaux à proximité et les trie par force de signal |
| 🔒 **Badge de sécurité** | Affiche le type de chiffrement : WPA3, WPA2, WPA, WEP ou Ouvert |
| 📶 **Signal visuel** | Icône 4 barres + label coloré (Excellent → Très faible) |
| 📡 **Groupement par bande** | Sépare les réseaux 2.4 GHz et 5 GHz |
| 🔍 **Recherche** | Filtre les réseaux par nom en temps réel |
| ✅ **Réseau actif** | Badge "Connecté" sur le réseau Wi-Fi actuellement utilisé |
| ⭐ **Favoris** | Étoile persistante par réseau + onglet dédié |
| ↕️ **Pull-to-refresh** | Tirer vers le bas pour relancer le scan |
| 🔌 **Connexion** | Bottom-sheet avec saisie du mot de passe + affichage/masquage |

---

## 🔐 Permissions Android

Déclarées dans [`android/app/src/main/AndroidManifest.xml`](android/app/src/main/AndroidManifest.xml) :

| Permission | Utilité |
|---|---|
| `INTERNET` | Communication réseau générale |
| `ACCESS_WIFI_STATE` | Lire l'état Wi-Fi (scan) |
| `CHANGE_WIFI_STATE` | Modifier la connexion Wi-Fi |
| `ACCESS_FINE_LOCATION` | **Requis** par Android pour scanner les réseaux |
| `ACCESS_COARSE_LOCATION` | Localisation approximative (fallback) |
| `NEARBY_WIFI_DEVICES` | Requis depuis Android 13 (API 33) |

> [!WARNING]
> Le **GPS doit être activé** sur l'appareil pour que le scan fonctionne, même si l'app ne l'utilise pas directement. C'est une contrainte imposée par Android depuis l'API 23.

---

## 🤝 Contribuer

### Structure d'une contribution

```bash
# 1. Créer une branche
git checkout -b feature/ma-fonctionnalite

# 2. Modifier le code
# 3. Tester
npm run android

# 4. Commit
git add .
git commit -m "feat: description de la fonctionnalité"

# 5. Push
git push origin feature/ma-fonctionnalite
```

### Conventions de commit

| Préfixe | Usage |
|---|---|
| `feat:` | Nouvelle fonctionnalité |
| `fix:` | Correction de bug |
| `docs:` | Documentation uniquement |
| `refactor:` | Refactoring sans changement fonctionnel |
| `style:` | Changements de style/UI |

### Scripts disponibles

```bash
npm run android    # Lance l'app sur Android (build + install)
npm run start      # Démarre le serveur Metro uniquement
npm run lint       # Vérifie le code avec ESLint
npm run test       # Lance les tests Jest
```

---

*Documentation rédigée le 19 juin 2026 — Projet MonAppTest / Wi-Fi Scanner*
